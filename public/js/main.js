let SERVICES = {};
let selectedTime = null;

async function loadServices() {
  const res = await fetch('/api/services');
  SERVICES = await res.json();

  const grid = document.getElementById('services-grid');
  const select = document.getElementById('serviceId');
  grid.innerHTML = '';
  select.innerHTML = '';

  Object.entries(SERVICES).forEach(([id, s]) => {
    grid.innerHTML += `
      <div class="service-card">
        <h3>${s.name}</h3>
        <div class="price">$${s.price.toLocaleString('es-CL')}</div>
        <div class="duration">${s.duration} minutos</div>
        <button type="button" onclick="pickService('${id}')">Reservar</button>
      </div>`;

    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = `${s.name} — $${s.price.toLocaleString('es-CL')}`;
    select.appendChild(opt);
  });
}

function pickService(id) {
  document.getElementById('serviceId').value = id;
  document.getElementById('reserva').scrollIntoView({ behavior: 'smooth' });
}

async function loadSlots(date) {
  const slotsDiv = document.getElementById('slots');
  selectedTime = null;
  document.getElementById('time').value = '';

  if (!date) {
    slotsDiv.innerHTML = '<span class="note">Elige una fecha para ver horarios.</span>';
    return;
  }

  slotsDiv.innerHTML = '<span class="note">Cargando horarios...</span>';
  const res = await fetch(`/api/availability?date=${date}`);
  const data = await res.json();

  if (!data.slots || data.slots.length === 0) {
    slotsDiv.innerHTML = '<span class="note">No hay horarios disponibles ese día. Prueba otra fecha.</span>';
    return;
  }

  slotsDiv.innerHTML = '';
  data.slots.forEach(t => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'slot-btn';
    btn.textContent = t;
    btn.onclick = () => {
      document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedTime = t;
      document.getElementById('time').value = t;
    };
    slotsDiv.appendChild(btn);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadServices();

  const dateInput = document.getElementById('date');
  const today = new Date().toISOString().slice(0, 10);
  dateInput.min = today;
  dateInput.addEventListener('change', () => loadSlots(dateInput.value));

  document.getElementById('booking-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('form-msg');
    const btn = document.getElementById('submit-btn');
    msg.textContent = '';
    msg.className = 'form-msg';

    if (!selectedTime) {
      msg.textContent = 'Elige un horario disponible.';
      msg.classList.add('error');
      return;
    }

    const payload = {
      serviceId: document.getElementById('serviceId').value,
      date: document.getElementById('date').value,
      time: selectedTime,
      name: document.getElementById('name').value,
      email: document.getElementById('email').value,
      phone: document.getElementById('phone').value,
      address: document.getElementById('address').value,
      notes: document.getElementById('notes').value,
    };

    btn.disabled = true;
    btn.textContent = 'Redirigiendo a Webpay...';

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        msg.textContent = data.error || 'No se pudo crear la reserva.';
        msg.classList.add('error');
        btn.disabled = false;
        btn.textContent = 'Ir a pagar con Webpay';
        return;
      }

      // Redirección estándar de Webpay Plus: formulario POST con el token.
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = data.redirectUrl;
      const tokenInput = document.createElement('input');
      tokenInput.type = 'hidden';
      tokenInput.name = 'token_ws';
      tokenInput.value = data.token;
      form.appendChild(tokenInput);
      document.body.appendChild(form);
      form.submit();
    } catch (err) {
      msg.textContent = 'Error de conexión. Intenta nuevamente.';
      msg.classList.add('error');
      btn.disabled = false;
      btn.textContent = 'Ir a pagar con Webpay';
    }
  });
});
