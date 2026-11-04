// Almacenamiento simple basado en archivos JSON.
// Suficiente para el sitio de una matrona independiente.
// Si el negocio crece, esto se puede migrar a una base real (Postgres/Supabase)
// sin cambiar el resto del sitio: solo hay que reemplazar las funciones de este archivo.

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const POSTS_FILE = path.join(DATA_DIR, 'posts.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson(file, fallback) {
  ensureDir();
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(fallback, null, 2), 'utf8');
    return fallback;
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
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
  return readJson(CONFIG_FILE, {});
}

function saveConfig(config) {
  writeJson(CONFIG_FILE, config);
  return config;
}

// --- Posts de "Lunes de Investigación" ---
function getPosts() {
  return readJson(POSTS_FILE, []);
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

module.exports = {
  getConfig,
  saveConfig,
  getPosts,
  savePosts,
  addPost,
  deletePost,
};
