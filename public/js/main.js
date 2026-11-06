function formatCLP(n) {
  return '$' + Number(n).toLocaleString('es-CL');
}

function waLink(telefono, mensaje) {
  return `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`;
}

function setPhoto(containerId, filename) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (filename) {
    el.innerHTML = `<img src="/img/${filename}" alt="">`;
  }
  // Si no hay foto, se deja el placeholder que ya está en el HTML.
}

function renderServiceCard(servicio, negocio) {
  let precioHtml = '';
  if (servicio.tipoPrecio === 'fijo') {
    precioHtml = `<div class="precio">${formatCLP(servicio.precio)}</div>`;
  } else if (servicio.tipoPrecio === 'por_zona') {
    precioHtml = `<div class="precio">${servicio.notaPrecio}</div>`;
  } else if (servicio.tipoPrecio === 'igual_asesoria') {
    precioHtml = `<div class="precio" style="font-size:1rem;">${servicio.notaPrecio}</div>`;
  } else if (servicio.tipoPrecio === 'proximamente') {
    precioHtml = `<div class="precio proximamente">${servicio.notaPrecio}</div>`;
  } else if (servicio.tipoPrecio === 'por_hora') {
    if (servicio.precioHora) {
      precioHtml = `<div class="precio">${formatCLP(servicio.precioHora)} / hora</div>`
        + (servicio.notaPrecio ? `<div class="precio-nota">${servicio.notaPrecio}</div>` : '');
    } else {
      precioHtml = `<div class="precio proximamente">${servicio.notaPrecio}</div>`;
    }
  } else if (servicio.tipoPrecio === 'paquete') {
    precioHtml = servicio.precio
      ? `<div class="precio">${servicio.notaPrecio || formatCLP(servicio.precio)}</div>`
      : `<div class="precio proximamente">${servicio.notaPrecio}</div>`;
  }

  const duracionHtml = servicio.duracion ? `<div class="duracion">${servicio.duracion}</div>` : '';
  const incluyeHtml = (servicio.incluye || []).map(i => `<li>${i}</li>`).join('');

  const mensaje = `Hola Graciela, quiero información sobre: ${servicio.nombre}`;
  const esDisponible = servicio.tipoPrecio !== 'proximamente'
    && !(servicio.tipoPrecio === 'por_hora' && !servicio.precioHora)
    && !(servicio.tipoPrecio === 'paquete' && !servicio.precio);
  const btnHtml = esDisponible
    ? `<a class="btn btn-primary" href="${waLink(negocio.whatsapp, mensaje)}" target="_blank" rel="noopener">Agenda por WhatsApp</a>`
    : `<span class="btn btn-secondary" style="opacity:.7;cursor:default;">Próximamente</span>`;

  return `
    <div class="service-card">
      <h3>${servicio.nombre}</h3>
      ${duracionHtml}
      ${precioHtml}
      <ul>${incluyeHtml}</ul>
      ${btnHtml}
    </div>`;
}

function renderZonasTable(zonas) {
  const tbody = document.querySelector('#zonas-table tbody');
  tbody.innerHTML = zonas.map(z => `
    <tr>
      <td>${z.etiqueta}</td>
      <td>${z.comunas.join(', ')}</td>
      <td class="precio">${formatCLP(z.precio)}</td>
    </tr>
  `).join('');
}

function renderComunaSelect(zonas) {
  const select = document.getElementById('comuna-select');
  zonas.forEach(z => {
    z.comunas.forEach(c => {
      const opt = document.createElement('option');
      opt.value = `${c}|${z.precio}|${z.etiqueta}`;
      opt.textContent = c;
      select.appendChild(opt);
    });
  });

  select.addEventListener('change', () => {
    const resultado = document.getElementById('comuna-resultado');
    if (!select.value) { resultado.textContent = ''; return; }
    const [comuna, precio, etiqueta] = select.value.split('|');
    resultado.textContent = `${comuna} está en ${etiqueta}: ${formatCLP(precio)}`;
  });
}

function renderTemas(temas) {
  const grid = document.getElementById('temas-grid');
  grid.innerHTML = temas.map(t => `
    <div class="tema-item">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 21s-7-4.4-9.5-9C1 7.5 3 4 6.5 4 9 4 11 5.8 12 7.5 13 5.8 15 4 17.5 4 21 4 23 7.5 21.5 11 19 15.6 12 21 12 21z"/></svg>
      <span>${t}</span>
    </div>
  `).join('');
}

function renderPosts(posts) {
  const grid = document.getElementById('posts-grid');
  if (!posts || posts.length === 0) {
    grid.innerHTML = `<div class="empty-state">Pronto encontrarás aquí artículos cortos de evidencia sobre lactancia, cada lunes.</div>`;
    return;
  }
  grid.innerHTML = posts.map(p => `
    <div class="post-card">
      <div class="fecha">${p.fecha}</div>
      <h3>${p.titulo}</h3>
      <p>${p.extracto}</p>
      ${p.url ? `<a href="${p.url}" target="_blank" rel="noopener">Leer más</a>` : ''}
    </div>
  `).join('');
}

let igEmbedScriptCargado = false;
function cargarIgEmbedScript() {
  return new Promise(resolve => {
    if (window.instgrm) { resolve(); return; }
    if (igEmbedScriptCargado) {
      // Ya se pidió antes; espera a que exista window.instgrm.
      const check = setInterval(() => {
        if (window.instgrm) { clearInterval(check); resolve(); }
      }, 100);
      return;
    }
    igEmbedScriptCargado = true;
    const script = document.createElement('script');
    script.src = 'https://www.instagram.com/embed.js';
    script.async = true;
    script.onload = resolve;
    document.body.appendChild(script);
  });
}

function renderReels(reels) {
  const grid = document.getElementById('reels-grid');
  const section = document.getElementById('reels-destacados');
  if (!reels || reels.length === 0) {
    if (section) section.style.display = 'none';
    return;
  }
  if (section) section.style.display = '';
  grid.innerHTML = reels.map(r => `
    <blockquote class="instagram-media" data-instgrm-permalink="${r.url}" data-instgrm-version="14" style="background:#FFF; border:0; border-radius:3px; box-shadow:0 0 1px 0 rgba(0,0,0,0.5),0 1px 10px 0 rgba(0,0,0,0.15); margin: 1px; max-width:540px; min-width:326px; padding:0; width:99.375%; width:calc(100% - 2px);">
      <a href="${r.url}" target="_blank" rel="noopener"></a>
    </blockquote>
  `).join('');
  cargarIgEmbedScript().then(() => {
    if (window.instgrm) window.instgrm.Embeds.process();
  });
}

function renderCondiciones(condiciones) {
  document.getElementById('condiciones-list').innerHTML =
    condiciones.map(c => `<li>${c}</li>`).join('');
}

async function init() {
  const res = await fetch('/api/content');
  const { config, posts, reels, photos } = await res.json();
  const { negocio, servicios, zonas, temas, condiciones, sobreMi } = config;

  document.getElementById('anio').textContent = new Date().getFullYear();

  // Hero y textos "Sobre mí"
  document.getElementById('sobre-mi-corta').textContent = sobreMi.corta;
  document.getElementById('sobre-mi-completa').innerHTML =
    sobreMi.completa.map(p => `<p>${p}</p>`).join('');

  // Fotos
  setPhoto('foto-hero', photos.hero);
  setPhoto('foto-about', photos.about);

  // Botones de WhatsApp
  const defaultMsg = negocio.whatsappMensajeDefault;
  ['hero-whatsapp', 'contacto-whatsapp', 'float-whatsapp', 'zona-whatsapp'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.href = waLink(negocio.whatsapp, defaultMsg);
  });
  document.getElementById('giftcard-whatsapp').href =
    waLink(negocio.whatsapp, 'Hola Graciela, quiero comprar una gift card de asesoría de lactancia');

  // Servicios
  document.getElementById('services-grid').innerHTML =
    servicios.map(s => renderServiceCard(s, negocio)).join('');

  // Zonas / comunas
  renderZonasTable(zonas);
  renderComunaSelect(zonas);

  // Temas
  renderTemas(temas);

  // Posts
  renderPosts(posts);

  // Reels de Instagram
  renderReels(reels);

  // Condiciones
  renderCondiciones(condiciones);

  // Contacto
  document.getElementById('contacto-horario').textContent = negocio.horario;
  document.getElementById('contacto-cobertura').textContent = negocio.cobertura;
  const ig = document.getElementById('contacto-instagram');
  ig.textContent = negocio.instagram;
  ig.href = negocio.instagramUrl;
}

init();
