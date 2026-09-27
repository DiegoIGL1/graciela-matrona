# Sitio de Graciela — Matrona y Asesora de Lactancia

Sitio con agenda de horas y pago en línea con **Webpay Plus (Transbank)**.

## Qué incluye
- Landing con la identidad visual de tu imagen (colores, tipografía, "destacadas" como navegación).
- Secciones: Sobre mí, Servicios, Lactancia, Embarazo, Banco de leche, Testimonios.
- Sistema de agenda: calendario con horarios disponibles (lunes a viernes, 9:00–18:00, editable).
- Pago real con Webpay Plus: la reserva solo se confirma si el pago fue aprobado.
- Panel simple en `/admin.html` para que tu mamá vea sus reservas.

---

## 1. Cómo probarlo ahora mismo (sin gastar nada, sin banco todavía)

```bash
npm install
cp .env.example .env
npm start
```

Abre `http://localhost:3000`. El sitio va a estar en **modo de pruebas de Webpay**
(`TBK_ENV=integration`), que usa credenciales oficiales de prueba de Transbank.
Puedes simular una compra completa con estas tarjetas de prueba:

- **Tarjeta de crédito:** 4051 8856 0044 6623 · CVV 123 · cualquier fecha futura
- **RUT y clave de prueba:** los que entrega Transbank en la pantalla de pago (aparecen automáticos en integración)

Esto te deja probar TODO el flujo (elegir hora → pagar → confirmación) sin ser
comercio afiliado todavía.

---

## 2. Cómo activar cobros reales

1. Tu mamá debe afiliarse como comercio en Transbank: https://www.transbankdevelopers.cl/
   (piden RUT, cuenta bancaria y datos del negocio; la aprobación toma unos días).
2. Cuando Transbank entregue el **código de comercio** y la **API key** de producción,
   los pones en el archivo `.env`:
   ```
   TBK_ENV=production
   TBK_COMMERCE_CODE=el_codigo_que_te_den
   TBK_API_KEY=la_api_key_que_te_den
   ```
3. Reinicia el servidor. Desde ese momento los pagos son reales y el dinero
   llega a la cuenta bancaria que ella registró en Transbank.

No se necesita tocar nada más del código para este cambio.

---

## 3. Cómo publicarlo con dominio propio (sin tener nada contratado aún)

Recomendación simple porque este sitio guarda las reservas en un archivo
(no necesita configurar una base de datos aparte):

1. **Hosting:** crea una cuenta gratis en [Railway](https://railway.app) o
   [Render](https://render.com). Ambos permiten "Deploy from GitHub" y tienen
   plan gratuito/​económico suficiente para un sitio de agendamiento.
2. Sube esta carpeta a un repositorio de GitHub (puedo ayudarte con esto).
3. Conecta el repositorio en Railway/Render, agrega las variables del `.env`
   en su panel ("Environment Variables"), y dale deploy.
4. **Dominio:** compra el dominio (ej. `graciela-matrona.cl`) en NIC Chile
   (https://www.nic.cl) o en cualquier proveedor, y apunta el DNS al hosting
   siguiendo las instrucciones que Railway/Render te muestran.

Si quieres, en el siguiente paso te ayudo a dejarlo publicado paso a paso.

---

## 4. Personalizar

- **Servicios, precios y duración:** editar el objeto `SERVICES` en `server.js`.
- **Horario de atención:** constantes `WORK_DAYS`, `WORK_START_HOUR`, `WORK_END_HOUR` en `server.js`.
- **Textos e imágenes:** `public/index.html`.
- **Colores:** variables al inicio de `public/css/style.css`.
- **Clave del panel de administración:** variable `ADMIN_PASSWORD` en `.env`.

---

## 5. Notificaciones por correo (opcional)

El proyecto incluye `nodemailer` en las dependencias para que, si quieren,
se pueda avisar por correo cada vez que llega una reserva pagada. Si lo
necesitas, dime y lo activo (falta conectar 3 líneas en `server.js` con los
datos SMTP que ya están en el `.env.example`).
