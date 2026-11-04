require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('./db');

const app = express();
app.use(express.json({ limit: '20mb' })); // las fotos viajan en base64 entre los dos servidores

const PORT = process.env.PORT || 3000;
const ROLE = (process.env.ROLE || 'public').toLowerCase(); // 'public' | 'admin'

// ---------------------------------------------------------------------------
// Fotos: se guardan en public/img con nombre único por subida.
// Un manifiesto (data/photos.json) guarda qué archivo va en cada "slot"
// (hero, about, consulta) para que el sitio siempre apunte al archivo
// correcto sin que haya que cambiar ningún link a mano.
// ---------------------------------------------------------------------------
const IMG_DIR = path.join(__dirname, 'public', 'img');
const PHOTOS_FILE = path.join(__dirname, 'data', 'photos.json');
const VALID_SLOTS = ['hero', 'about', 'consulta'];

function ensureImgDir() {
  if (!fs.existsSync(IMG_DIR)) fs.mkdirSync(IMG_DIR, { recursive: true });
}

function getPhotos() {
  ensureImgDir();
  if (!fs.existsSync(PHOTOS_FILE)) {
    fs.writeFileSync(PHOTOS_FILE, JSON.stringify({ hero: null, about: null, consulta: null }, null, 2));
  }
  try {
    return JSON.parse(fs.readFileSync(PHOTOS_FILE, 'utf8'));
  } catch {
    return { hero: null, about: null, consulta: null };
  }
}

function savePhotos(photos) {
  fs.writeFileSync(PHOTOS_FILE, JSON.stringify(photos, null, 2));
}

// ---------------------------------------------------------------------------
// API de solo lectura: la usan ambos servidores.
// En el público, la consume el sitio (main.js). En el admin, la usa el
// propio panel para cargar los valores actuales en los formularios.
// ---------------------------------------------------------------------------
app.get('/api/content', (req, res) => {
  res.json({
    config: db.getConfig(),
    posts: db.getPosts(),
    photos: getPhotos(),
  });
});

if (ROLE === 'public') {
  // ---------------------------------------------------------------------
  // SERVIDOR PÚBLICO: el que tiene el dominio. Sirve el sitio y solo
  // recibe datos ya armados del servidor admin — no tiene ninguna ruta
  // de edición propia, así que aunque alguien adivine un secreto, aquí
  // no hay panel ni formularios que atacar.
  // ---------------------------------------------------------------------
  app.use(express.static(path.join(__dirname, 'public')));

  const SYNC_SECRET = process.env.SYNC_SECRET;

  function requireSync(req, res, next) {
    if (!SYNC_SECRET) {
      return res.status(500).json({ error: 'Este servidor no tiene SYNC_SECRET configurado.' });
    }
    if (req.headers['x-sync-secret'] !== SYNC_SECRET) {
      return res.status(401).json({ error: 'Secreto de sincronización inválido.' });
    }
    next();
  }

  // El servidor admin llama esto cada vez que se guardan precios/zonas/posts.
  app.put('/api/sync/config', requireSync, (req, res) => {
    const { config, posts } = req.body;
    if (!config) return res.status(400).json({ error: 'Falta config' });
    db.saveConfig(config);
    if (posts) db.savePosts(posts);
    res.json({ ok: true });
  });

  // El servidor admin llama esto cada vez que se sube/reemplaza una foto.
  app.post('/api/sync/photo', requireSync, (req, res) => {
    const { slot, filename, dataBase64 } = req.body;
    if (!VALID_SLOTS.includes(slot) || !filename || !dataBase64) {
      return res.status(400).json({ error: 'Faltan datos de la foto.' });
    }
    ensureImgDir();
    const photos = getPhotos();
    const oldFile = photos[slot] && photos[slot] !== filename
      ? path.join(IMG_DIR, photos[slot])
      : null;
    fs.writeFileSync(path.join(IMG_DIR, filename), Buffer.from(dataBase64, 'base64'));
    if (oldFile) fs.unlink(oldFile, () => {}); // se borra DESPUÉS de escribir el nuevo archivo
    photos[slot] = filename;
    savePhotos(photos);
    res.json({ ok: true });
  });

} else if (ROLE === 'admin') {
  // ---------------------------------------------------------------------
  // SERVIDOR ADMIN: lo usan Diego y Graciela. Tiene el panel y toda la
  // lógica de edición. No sirve el sitio público ni sus rutas — solo
  // este panel. Cada guardado exitoso se reenvía automáticamente al
  // servidor público vía /api/sync/*.
  // ---------------------------------------------------------------------
  app.use(express.static(path.join(__dirname, 'admin')));

  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'cambia-esta-clave';
  const SYNC_SECRET = process.env.SYNC_SECRET;
  const PUBLIC_SITE_URL = (process.env.PUBLIC_SITE_URL || '').replace(/\/+$/, '');

  function requireAdmin(req, res, next) {
    const pass = req.body.password || req.query.password || req.headers['x-admin-password'];
    if (pass !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Clave incorrecta' });
    next();
  }

  async function pushConfigToPublic() {
    if (!PUBLIC_SITE_URL || !SYNC_SECRET) {
      return { ok: false, error: 'falta PUBLIC_SITE_URL o SYNC_SECRET en el servidor admin' };
    }
    try {
      const r = await fetch(`${PUBLIC_SITE_URL}/api/sync/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-sync-secret': SYNC_SECRET },
        body: JSON.stringify({ config: db.getConfig(), posts: db.getPosts() }),
      });
      if (!r.ok) return { ok: false, error: `el sitio público respondió ${r.status}` };
      return { ok: true };
    } catch (err) {
      return { ok: false, error: 'no se pudo contactar al sitio público (' + err.message + ')' };
    }
  }

  async function pushPhotoToPublic(slot, filename) {
    if (!PUBLIC_SITE_URL || !SYNC_SECRET) {
      return { ok: false, error: 'falta PUBLIC_SITE_URL o SYNC_SECRET en el servidor admin' };
    }
    try {
      const data = fs.readFileSync(path.join(IMG_DIR, filename));
      const r = await fetch(`${PUBLIC_SITE_URL}/api/sync/photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-sync-secret': SYNC_SECRET },
        body: JSON.stringify({ slot, filename, dataBase64: data.toString('base64') }),
      });
      if (!r.ok) return { ok: false, error: `el sitio público respondió ${r.status}` };
      return { ok: true };
    } catch (err) {
      return { ok: false, error: 'no se pudo contactar al sitio público (' + err.message + ')' };
    }
  }

  const upload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => { ensureImgDir(); cb(null, IMG_DIR); },
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.jpg';
        cb(null, `${req.body.slot}-${Date.now()}${ext}`);
      },
    }),
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (!VALID_SLOTS.includes(req.body.slot)) return cb(new Error('Slot inválido'));
      if (!/^image\/(jpeg|png|webp)$/.test(file.mimetype)) return cb(new Error('Formato no soportado'));
      cb(null, true);
    },
  });

  app.post('/api/admin/login', requireAdmin, (req, res) => {
    res.json({ ok: true });
  });

  app.put('/api/admin/config', requireAdmin, async (req, res) => {
    const { config } = req.body;
    if (!config || typeof config !== 'object') {
      return res.status(400).json({ error: 'Falta el objeto config' });
    }
    db.saveConfig(config);
    const sync = await pushConfigToPublic();
    res.json({ ok: true, publicado: sync.ok, error: sync.ok ? undefined : sync.error });
  });

  app.post('/api/admin/posts', requireAdmin, async (req, res) => {
    const { titulo, extracto, fecha, url } = req.body;
    if (!titulo || !extracto) return res.status(400).json({ error: 'Falta título o extracto' });
    const post = {
      id: Date.now().toString(36),
      titulo,
      extracto,
      fecha: fecha || new Date().toISOString().slice(0, 10),
      url: url || '',
    };
    db.addPost(post);
    const sync = await pushConfigToPublic();
    res.json({ ...post, publicado: sync.ok, error: sync.ok ? undefined : sync.error });
  });

  app.delete('/api/admin/posts/:id', requireAdmin, async (req, res) => {
    db.deletePost(req.params.id);
    const sync = await pushConfigToPublic();
    res.json({ ok: true, publicado: sync.ok, error: sync.ok ? undefined : sync.error });
  });

  app.post('/api/admin/photos', (req, res) => {
    upload.single('foto')(req, res, async (err) => {
      if (err) return res.status(400).json({ error: err.message });

      const pass = req.body.password || req.headers['x-admin-password'];
      if (pass !== ADMIN_PASSWORD) {
        if (req.file) fs.unlink(req.file.path, () => {});
        return res.status(401).json({ error: 'Clave incorrecta' });
      }
      if (!req.file) return res.status(400).json({ error: 'Falta el archivo' });

      const slot = req.body.slot;
      const photos = getPhotos();
      if (photos[slot]) {
        fs.unlink(path.join(IMG_DIR, photos[slot]), () => {});
      }
      photos[slot] = req.file.filename;
      savePhotos(photos);

      const sync = await pushPhotoToPublic(slot, req.file.filename);
      res.json({ ok: true, photos, publicado: sync.ok, error: sync.ok ? undefined : sync.error });
    });
  });

  // Reintento manual: reenvía TODO (config, posts y las 3 fotos) al sitio
  // público. Útil si un guardado anterior no se pudo publicar.
  app.post('/api/admin/resync', requireAdmin, async (req, res) => {
    const configSync = await pushConfigToPublic();
    const photos = getPhotos();
    const photoResults = {};
    for (const slot of VALID_SLOTS) {
      if (photos[slot]) {
        const r = await pushPhotoToPublic(slot, photos[slot]);
        photoResults[slot] = r.ok;
      }
    }
    res.json({ ok: true, config: configSync.ok, configError: configSync.error, photos: photoResults });
  });

} else {
  console.error(`ROLE desconocido: "${ROLE}". Usa ROLE=public o ROLE=admin en las variables de entorno.`);
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`Servidor de Matronalactancia (rol: ${ROLE}) corriendo en el puerto ${PORT}`);
});
