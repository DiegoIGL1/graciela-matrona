require('dotenv').config();
const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { WebpayPlus, Options, IntegrationApiKeys, Environment } = require('transbank-sdk');
const db = require('./db');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'cambia-esta-clave';

// ---------------------------------------------------------------------------
// Configuracion de servicios y horario de atencion.
// Tu mama puede editar esto libremente: precios, duracion y nombres.
// ---------------------------------------------------------------------------
const SERVICES = {
  lactancia_online: { name: 'Asesoría de lactancia online', duration: 45, price: 25000 },
  lactancia_domicilio: { name: 'Asesoría de lactancia a domicilio', duration: 60, price: 40000 },
  cuidado_recien_nacido: { name: 'Cuidado de recién nacido', duration: 90, price: 50000 },
  taller_destete: { name: 'Taller de destete', duration: 60, price: 30000 },
  visita_domicilio: { name: 'Visita a domicilio postparto', duration: 75, price: 45000 },
  banco_leche: { name: 'Asesoría banco de leche', duration: 45, price: 25000 },
  gift_card_baby_shower: { name: 'Gift card baby shower — Asesoría de lactancia', duration: 30, price: 25000 },
};
// Nota: precios y duraciones son valores de partida — tu mamá los puede
// cambiar libremente editando los números de arriba.

const WORK_DAYS = [1, 2, 3, 4, 5]; // lunes a viernes (0=domingo)
const WORK_START_HOUR = 9;
const WORK_END_HOUR = 18;
const SLOT_MINUTES = 60;

// ---------------------------------------------------------------------------
// Webpay Plus (Transbank)
// En integration usa las credenciales de prueba oficiales automaticamente.
// En production, usa TBK_COMMERCE_CODE y TBK_API_KEY del .env
// ---------------------------------------------------------------------------
const isProd = (process.env.TBK_ENV || 'integration') === 'production';
const webpay = new WebpayPlus.Transaction(
  isProd
    ? new Options(process.env.TBK_COMMERCE_CODE, process.env.TBK_API_KEY, Environment.Production)
    : new Options(IntegrationApiKeys.WEBPAY, IntegrationApiKeys.WEBPAY, Environment.Integration)
);

// ---------------------------------------------------------------------------
// Utilidades de agenda
// ---------------------------------------------------------------------------
function generateSlotsForDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  if (!WORK_DAYS.includes(date.getDay())) return [];

  const slots = [];
  for (let h = WORK_START_HOUR; h < WORK_END_HOUR; h++) {
    for (let m = 0; m < 60; m += SLOT_MINUTES) {
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }

  const taken = new Set(db.getBookingsByDate(dateStr).map(b => b.time));
  const now = new Date();
  const isToday = dateStr === now.toISOString().slice(0, 10);

  return slots.filter(t => {
    if (taken.has(t)) return false;
    if (isToday) {
      const [h, m] = t.split(':').map(Number);
      const slotDate = new Date(date);
      slotDate.setHours(h, m, 0, 0);
      if (slotDate.getTime() < now.getTime()) return false;
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
// API: servicios y disponibilidad
// ---------------------------------------------------------------------------
app.get('/api/services', (req, res) => {
  res.json(SERVICES);
});

app.get('/api/availability', (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'Falta el parámetro date (YYYY-MM-DD)' });
  res.json({ date, slots: generateSlotsForDate(date) });
});

// ---------------------------------------------------------------------------
// API: crear reserva + iniciar pago en Webpay
// ---------------------------------------------------------------------------
app.post('/api/bookings', async (req, res) => {
  try {
    const { serviceId, date, time, name, email, phone, address, notes } = req.body;

    const service = SERVICES[serviceId];
    if (!service) return res.status(400).json({ error: 'Servicio inválido' });
    if (!date || !time || !name || !email || !phone) {
      return res.status(400).json({ error: 'Faltan datos obligatorios' });
    }

    const freeSlots = generateSlotsForDate(date);
    if (!freeSlots.includes(time)) {
      return res.status(409).json({ error: 'Ese horario ya no está disponible, elige otro.' });
    }

    const bookingId = uuidv4();
    const buyOrder = bookingId.replace(/-/g, '').slice(0, 20);
    const sessionId = uuidv4().slice(0, 20);
    const returnUrl = `${req.protocol}://${req.get('host')}/api/payment/commit`;

    const booking = {
      id: bookingId,
      serviceId,
      serviceName: service.name,
      price: service.price,
      date,
      time,
      name,
      email,
      phone,
      address: address || '',
      notes: notes || '',
      status: 'pending_payment',
      buyOrder,
      createdAt: new Date().toISOString(),
    };
    db.addBooking(booking);

    const tbkResponse = await webpay.create(buyOrder, sessionId, service.price, returnUrl);

    db.updateBooking(bookingId, { tbkToken: tbkResponse.token });

    res.json({
      bookingId,
      redirectUrl: tbkResponse.url,
      token: tbkResponse.token,
    });
  } catch (err) {
    console.error('Error creando reserva/pago:', err);
    res.status(500).json({ error: 'No se pudo iniciar el pago. Intenta nuevamente.' });
  }
});

// ---------------------------------------------------------------------------
// Webpay redirige aquí (POST) despues de que la persona paga o cancela.
// ---------------------------------------------------------------------------
app.post('/api/payment/commit', async (req, res) => {
  const token = req.body.token_ws;
  if (!token) return res.redirect('/reserva-fallida.html');

  try {
    const result = await webpay.commit(token);
    const bookings = db.readAll();
    const booking = bookings.find(b => b.tbkToken === token);

    if (result.status === 'AUTHORIZED' && result.response_code === 0) {
      if (booking) db.updateBooking(booking.id, { status: 'confirmed', tbkResult: result });
      return res.redirect(`/reserva-exitosa.html?id=${booking ? booking.id : ''}`);
    } else {
      if (booking) db.updateBooking(booking.id, { status: 'payment_failed', tbkResult: result });
      return res.redirect('/reserva-fallida.html');
    }
  } catch (err) {
    console.error('Error confirmando pago:', err);
    return res.redirect('/reserva-fallida.html');
  }
});

app.get('/api/bookings/:id', (req, res) => {
  const booking = db.getBooking(req.params.id);
  if (!booking) return res.status(404).json({ error: 'No encontrada' });
  res.json(booking);
});

// ---------------------------------------------------------------------------
// Panel simple de administración (protegido por clave)
// ---------------------------------------------------------------------------
app.get('/api/admin/bookings', (req, res) => {
  const pass = req.query.password;
  if (pass !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Clave incorrecta' });
  res.json(db.readAll().sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)));
});

app.listen(PORT, () => {
  console.log(`Sitio de Graciela corriendo en http://localhost:${PORT}`);
  console.log(`Modo de pago Webpay: ${isProd ? 'PRODUCCIÓN' : 'INTEGRACIÓN (pruebas)'}`);
});
