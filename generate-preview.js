// Genera preview-graciela.html: una sola página HTML autocontenida
// (CSS y datos embebidos, fotos en base64 si existen) para abrir
// directamente en el navegador sin levantar el servidor.
const fs = require('fs');
const path = require('path');

const root = __dirname;
const css = fs.readFileSync(path.join(root, 'public/css/style.css'), 'utf8');
const config = JSON.parse(fs.readFileSync(path.join(root, 'data/config.json'), 'utf8'));
const posts = JSON.parse(fs.readFileSync(path.join(root, 'data/posts.json'), 'utf8'));
const photosManifest = JSON.parse(fs.readFileSync(path.join(root, 'data/photos.json'), 'utf8'));

function toBase64Photo(filename) {
  if (!filename) return null;
  const filePath = path.join(root, 'public/img', filename);
  if (!fs.existsSync(filePath)) return null;
  const ext = path.extname(filename).slice(1).toLowerCase();
  const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  const data = fs.readFileSync(filePath).toString('base64');
  return `data:${mime};base64,${data}`;
}

const photos = {
  hero: toBase64Photo(photosManifest.hero),
  about: toBase64Photo(photosManifest.about),
  consulta: toBase64Photo(photosManifest.consulta),
};

const dataScript = `
window.__DATA__ = ${JSON.stringify({ config, posts, photos })};
`;

// Reutiliza el mismo main.js, solo que en vez de "fetch('/api/content')"
// lee window.__DATA__.
const mainJs = fs.readFileSync(path.join(root, 'public/js/main.js'), 'utf8')
  .replace(
    "const res = await fetch('/api/content');\n  const { config, posts, photos } = await res.json();",
    'const { config, posts, photos } = window.__DATA__;'
  );

let html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
// Nota: se usa una función como reemplazo (no un string) porque String.replace
// interpreta patrones especiales ($&, $', $1...) dentro de un string de
// reemplazo, y el CSS/JS embebido aquí contiene ese tipo de secuencias.
html = html.replace('<link rel="stylesheet" href="/css/style.css">', () => `<style>\n${css}\n</style>`);
const scriptsBlock = '<script>' + dataScript + '</script>\n<script>' + mainJs + '</script>';
html = html.replace('<script src="/js/main.js"></script>', () => scriptsBlock);
html = html.replace(
  '<body>',
  () => '<body>\n<!-- Vista previa estática: generada con generate-preview.js. Para producción usar el servidor Express. -->'
);

fs.writeFileSync(path.join(root, 'preview-graciela.html'), html, 'utf8');
console.log('preview-graciela.html generado.');
