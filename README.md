# Matronalactancia — sitio de Graciela

Sitio de una página que convierte visitas en conversaciones de WhatsApp.
No hay pago en línea: cada botón abre WhatsApp con un mensaje prellenado
según el servicio elegido, y el pago se coordina directamente con Graciela.

## Arquitectura: dos servidores separados

El mismo código (`server.js`) se comporta distinto según la variable
`ROLE`, así que en producción se despliegan **dos servicios independientes**
a partir del mismo repositorio:

- **`ROLE=public`** — el sitio que ve todo el mundo, en el dominio real
  (ej. matronalactancia.cl). Sirve `public/` y una sola ruta de lectura
  (`GET /api/content`). **No tiene ningún panel ni ruta de edición**: aunque
  alguien adivine una clave, en este servidor no hay nada que escribir.
- **`ROLE=admin`** — el panel que usan Diego y Graciela (`admin/index.html`).
  Tiene toda la lógica de editar precios, zonas, fotos y posts. Cada vez que
  se guarda algo, este servidor **empuja el cambio automáticamente** al
  servidor público mediante `PUT /api/sync/config` y `POST /api/sync/photo`,
  protegidos por un secreto compartido (`SYNC_SECRET`) que no es la misma
  clave del panel.

Si el servidor público estuviera caído o reiniciándose justo cuando se
guarda un cambio, el panel avisa que no se pudo publicar y queda un botón
**"Reenviar ahora"** para reintentar sin tener que volver a escribir nada.

## 1. Probarlo en este computador

Hace falta correr los dos servidores en paralelo (dos terminales o dos
carpetas), apuntando uno al otro:

```bash
npm install
cp .env.example .env
```

**Terminal 1 — público** (edita `.env`: `ROLE=public`, define `SYNC_SECRET`):
```bash
npm run start:public
```

**Terminal 2 — admin** (edita `.env`: `ROLE=admin`, `ADMIN_PASSWORD`, el
mismo `SYNC_SECRET`, y `PUBLIC_SITE_URL=http://localhost:3000`):
```bash
npm run start:admin
```

Abre `http://localhost:3000` (sitio) y `http://localhost:3001` (panel).

## 2. Vista previa sin servidor (para el computador de trabajo)

```bash
node generate-preview.js
```

Genera `preview-graciela.html`: un solo archivo con el CSS y los datos del
sitio **público** embebidos (las fotos que ya estén subidas se incluyen en
base64), para abrir con doble clic, sin instalar nada ni levantar ningún
servidor. Vuelve a correrlo cada vez que quieras una vista previa actualizada.

## 3. Publicarlo en Railway (dos servicios)

1. Sube este proyecto a GitHub (un solo repo sirve para los dos servicios).
2. En Railway, crea un **nuevo proyecto** y agrega **dos servicios** apuntando
   al mismo repo:

   **Servicio público:**
   - Variables: `ROLE=public`, `SYNC_SECRET=<genera uno largo, ej. con
     "openssl rand -hex 32">`
   - Start command: `npm run start:public` (o deja el start command por
     defecto y pon `ROLE=public` como variable — ambas formas funcionan)
   - Volumen persistente: uno en `/app/data` (ahí vive también `data/img`
     con las fotos — Railway solo permite un volumen por servicio)
   - Dominio: este es el que conecta con `matronalactancia.cl`

   **Servicio admin:**
   - Variables: `ROLE=admin`, `ADMIN_PASSWORD=<clave del panel>`,
     `SYNC_SECRET=<el mismo valor de arriba>`, `PUBLIC_SITE_URL=<la URL que
     Railway le dio al servicio público, sin "/" al final>`
   - Start command: `npm run start:admin`
   - Volumen persistente: uno en `/app/data` (es su propia copia de
     trabajo — el servicio público tiene la suya)
   - No hace falta dominio propio: usa la URL que Railway asigna por
     defecto (algo.up.railway.app). Solo la usan Diego y Graciela, y ya
     está protegida por `ADMIN_PASSWORD`.

3. Despliega ambos. Entra al servicio admin, guarda cualquier cambio y
   confirma que aparece en el sitio público.
4. **Dominio:** cuando tengas el `.cl` de NIC Chile, apúntalo solo al
   servicio público (Settings → Networking → Custom Domain).

## 4. Personalizar

- **Servicios, precios, zonas, temas, condiciones, textos "Sobre mí" y SEO:**
  todo vive en `data/config.json` — editable a mano o desde el panel admin.
- **Artículos de "Lunes de Investigación":** `data/posts.json`, o desde el panel.
- **Fotos:** se suben desde el panel admin — quedan en `public/img/` de
  cada servidor (el admin las empuja automáticamente a la copia del público).
- **Colores y tipografías del sitio:** variables al inicio de `public/css/style.css`.
- **Colores del panel admin:** variables al inicio de `admin/index.html` (están
  separadas a propósito, para que el panel no dependa de ningún archivo del sitio público).
- **Número de WhatsApp y mensaje por defecto:** `negocio.whatsapp` y
  `negocio.whatsappMensajeDefault` en `data/config.json`.

## Pendientes del brief (para resolver con Graciela)

- Dominio y dónde alojar la página.
- Archivo del logo en PNG/SVG con fondo transparente.
- Si el número de WhatsApp se mantiene al pasar a WhatsApp Business.
- Testimonios con autorización de las mamás (hoy el sitio muestra un espacio reservado).
- Precio definitivo del destete respetuoso y del valor por hora de los
  cuidados a domicilio de recién nacidos (hoy ambos muestran "Próximamente";
  se cargan desde el panel admin igual que cualquier otro precio).
