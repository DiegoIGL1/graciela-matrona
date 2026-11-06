// Almacenamiento simple basado en archivos JSON.
// Suficiente para el sitio de una matrona independiente.
// Si el negocio crece, esto se puede migrar a una base real (Postgres/Supabase)
// sin cambiar el resto del sitio: solo hay que reemplazar las funciones de este archivo.

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const POSTS_FILE = path.join(DATA_DIR, 'posts.json');
const REELS_FILE = path.join(DATA_DIR, 'reels.json');

// Datos de partida reales (no un objeto vacío): viven FUERA de data/ porque
// en Railway data/ es un volumen persistente que arranca vacío en el primer
// deploy y tapa cualquier archivo que viniera en el repo dentro de esa
// carpeta. Si no existiera este respaldo, el primer arranque guardaría un
// config.json vacío y el sitio se quedaría sin textos, servicios ni zonas.
const SEED_DIR = path.join(__dirname, 'seed');
const CONFIG_SEED = path.join(SEED_DIR, 'config.default.json');
const POSTS_SEED = path.join(SEED_DIR, 'posts.default.json');
const REELS_SEED = path.join(SEED_DIR, 'reels.default.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readSeed(seedFile, fallback) {
  try {
    return JSON.parse(fs.readFileSync(seedFile, 'utf8'));
  } catch {
    return fallback;
  }
}

function readJson(file, fallback) {
  ensureDir();
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(fallback, null, 2), 'utf8');
    return fallback;
  }
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    // Si el archivo quedó vacío (p. ej. de un primer arranque anterior a
    // este fix, que guardó {} o [] en el volumen), se repara solo con el
    // respaldo en vez de servir un sitio sin contenido.
    const isEmptyObject = data && typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length === 0;
    if (isEmptyObject) {
      fs.writeFileSync(file, JSON.stringify(fallback, null, 2), 'utf8');
      return fallback;
    }
    return data;
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  ensureDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

// --- Config (servicios, zonas, textos) ---
function getConfig() {
  return readJson(CONFIG_FILE, readSeed(CONFIG_SEED, {}));
}

function saveConfig(config) {
  writeJson(CONFIG_FILE, config);
  return config;
}

// --- Posts de "Lunes de Investigación" ---
function getPosts() {
  return readJson(POSTS_FILE, readSeed(POSTS_SEED, []));
}

function savePosts(posts) {
  writeJson(POSTS_FILE, posts);
  return posts;
}

function addPost(post) {
  const posts = getPosts();
  posts.unshift(post);
  savePosts(posts);
  return post;
}

function deletePost(id) {
  const posts = getPosts().filter(p => p.id !== id);
  savePosts(posts);
  return posts;
}

// --- Reels de Instagram destacados en la página ---
function getReels() {
  return readJson(REELS_FILE, readSeed(REELS_SEED, []));
}

function saveReels(reels) {
  writeJson(REELS_FILE, reels);
  return reels;
}

function addReel(reel) {
  const reels = getReels();
  reels.unshift(reel);
  saveReels(reels);
  return reel;
}

function deleteReel(id) {
  const reels = getReels().filter(r => r.id !== id);
  saveReels(reels);
  return reels;
}

module.exports = {
  getConfig,
  saveConfig,
  getPosts,
  savePosts,
  addPost,
  deletePost,
  getReels,
  saveReels,
  addReel,
  deleteReel,
};
