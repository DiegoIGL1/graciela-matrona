// Almacenamiento simple basado en archivo JSON.
// Suficiente para el volumen de reservas de un consultorio/matrona individual.
// Si el negocio crece mucho, esto se puede migrar a una base real (Postgres/Supabase)
// sin cambiar el resto del sitio: solo hay que reemplazar las funciones de este archivo.

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const FILE = path.join(DATA_DIR, 'bookings.json');

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, '[]', 'utf8');
}

function readAll() {
  ensureFile();
  const raw = fs.readFileSync(FILE, 'utf8');
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeAll(bookings) {
  ensureFile();
  fs.writeFileSync(FILE, JSON.stringify(bookings, null, 2), 'utf8');
}

function addBooking(booking) {
  const bookings = readAll();
  bookings.push(booking);
  writeAll(bookings);
  return booking;
}

function updateBooking(id, patch) {
  const bookings = readAll();
  const idx = bookings.findIndex(b => b.id === id);
  if (idx === -1) return null;
  bookings[idx] = { ...bookings[idx], ...patch };
  writeAll(bookings);
  return bookings[idx];
}

function getBooking(id) {
  return readAll().find(b => b.id === id) || null;
}

function getBookingsByDate(date) {
  return readAll().filter(b => b.date === date && b.status !== 'cancelled');
}

module.exports = { readAll, addBooking, updateBooking, getBooking, getBookingsByDate };
