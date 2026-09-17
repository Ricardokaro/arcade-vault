# SPEC 03 — Envío real del formulario de contacto vía Resend

> **Status:** Implementado
> **Depends on:** SPEC 02
> **Date:** 2026-09-17
> **Objective:** Conectar el formulario de contacto de `/acerca-de` a un envío real de correo usando Resend, en vez de la simulación actual.

## Por qué existe este spec

SPEC 02 implementó `/acerca-de` con un formulario de contacto 100% mock: valida campos vacíos y muestra una animación de "terminal" de éxito falso, dejando explícitamente fuera de alcance "envío real del formulario de contacto (API propia, servicio de email, etc.)". Este spec cierra ese pendiente: agrega el primer endpoint de backend real del proyecto (hasta ahora todo es mock/localStorage) y lo conecta al formulario existente sin rediseñar su UI.

## Scope

**In:**

- Nueva dependencia `resend` (SDK oficial de Node) en `package.json`.
- Nuevo route handler `app/api/contacto/route.ts` (`POST`) que recibe `{ name, email, msg, honeypot }`, valida en servidor, envía el correo vía Resend y responde `200` o un error con mensaje.
- Remitente: `onboarding@resend.dev` (dominio de pruebas de Resend, sin verificación DNS necesaria). Destinatario fijo: `rcarocardona@gmail.com`, vía variable de entorno `CONTACT_TO_EMAIL` (no hardcodeado en el código).
- Variable de entorno `RESEND_API_KEY` leída en el servidor (nunca expuesta al cliente). Se agrega `.env.local.example` con ambas variables vacías/documentadas como placeholder; `.env.local` real (con la key de verdad) lo crea el usuario localmente y ya está cubierto por `.env*` en `.gitignore`.
- Campo honeypot oculto (`_gotcha` o similar) en el formulario de `app/acerca-de/page.tsx`: invisible para humanos (CSS, fuera de la tabulación), si llega lleno el servidor descarta el envío silenciosamente (responde `200` como si hubiera funcionado, sin llamar a Resend) para no delatar la protección a bots.
- `app/acerca-de/page.tsx`: el `onSubmit` deja de solo hacer `setSent(...)` en local y pasa a hacer `fetch("/api/contacto", { method: "POST", ... })`. Se agrega un estado `sending` (deshabilita el botón y muestra una línea de "transmitiendo" mientras espera la respuesta) y un estado `error` (ver UI de error abajo). La validación de campos vacíos en cliente (shake) se mantiene igual que hoy, sin cambios.
- Nuevo estado de error dentro del mismo panel `terminal-success`: si el `fetch` falla o el servidor responde error, se reutiliza la estética de terminal pero con líneas de error (rojo, color ya definido para errores en `app/globals.css` si existe, o el color `magenta`/`red` de la paleta neón) terminando en un mensaje tipo `[ERROR] FALLO DE CONEXIÓN CON EL SERVIDOR` y un botón "REINTENTAR" que vuelve al formulario **sin perder lo que el usuario escribió** (no se limpia `form` en el camino de error).
- Manejo de errores server-side: `RESEND_API_KEY` ausente o inválida, error de red hacia la API de Resend, y payload inválido (campos faltantes o `email` con formato inválido) devuelven `4xx`/`5xx` con un mensaje JSON `{ error: string }` que el cliente puede mostrar.

**Out of scope (para futuros specs):**

- Correo de confirmación automático al remitente (autoresponder). Decisión explícita del usuario — por ahora solo se notifica al equipo.
- Dominio propio verificado en Resend (SPF/DKIM). Se usa `onboarding@resend.dev` mientras no exista un dominio configurado.
- Rate limiting / throttling del endpoint más allá del honeypot (p. ej. límite por IP). El honeypot cubre bots simples; un abuso mayor se atiende en otro spec si aparece.
- Persistir los mensajes de contacto en algún storage (DB, localStorage, etc.) — el endpoint solo reenvía por correo, no guarda historial.
- Reemplazar o versionar la key de Resend en runtime (rotación, múltiples entornos) — un solo `RESEND_API_KEY` en `.env.local`, como el resto del proyecto que no tiene backend hasta ahora.
- Tests automatizados.

## Data model

Este spec no introduce estructuras de datos nuevas en `lib/data.ts`. Introduce un contrato de request/response para el nuevo endpoint:

```ts
// POST /api/contacto — request body
type ContactRequest = {
  name: string;
  email: string;
  msg: string;
  honeypot: string; // debe llegar vacío; si no, se descarta silenciosamente
};

// respuesta
// 200 OK              → { ok: true }
// 400 Bad Request      → { error: "..." }  (campo faltante o email inválido)
// 502 Bad Gateway       → { error: "..." }  (Resend no disponible / key inválida)
```

Variables de entorno (`.env.local`, no versionado; `.env.local.example` sí versionado con placeholders):

```
RESEND_API_KEY=
CONTACT_TO_EMAIL=
```

## Implementation plan

1. Agregar la dependencia `resend` a `package.json` (`npm install resend`) y crear `.env.local.example` con `RESEND_API_KEY=` y `CONTACT_TO_EMAIL=` documentadas con un comentario corto. Verificación: `npm install` corre sin errores; `.env.local.example` queda versionado y `.env.local` (si se crea) queda ignorado por git.
2. Crear `app/api/contacto/route.ts`: valida el body (`name`, `email`, `msg` no vacíos; `email` con formato válido; `honeypot` vacío), instancia `Resend` con `process.env.RESEND_API_KEY`, y envía el correo a `process.env.CONTACT_TO_EMAIL` desde `onboarding@resend.dev` con el asunto y cuerpo armados a partir del payload. Si `honeypot` viene lleno, responde `200 { ok: true }` sin llamar a Resend. Si falta `RESEND_API_KEY`/`CONTACT_TO_EMAIL` o Resend devuelve error, responde `502 { error: "..." }`. Verificación: probar el endpoint con `curl`/Postman local (con una key de prueba) y confirmar que llega el correo, y que un payload inválido responde `400`.
3. Agregar el campo honeypot oculto al formulario en `app/acerca-de/page.tsx` (input adicional en el estado `form`, oculto vía CSS — `position: absolute; left: -9999px` o similar, con `tabIndex={-1}` y `autoComplete="off"`). Verificación: el campo no es visible ni alcanzable con Tab, y viaja en el payload del submit.
4. Conectar `onSubmit` en `app/acerca-de/page.tsx` a `fetch("/api/contacto", …)`: agregar estado `sending` (deshabilita el botón, texto "▶ ENVIANDO…") y mantener la validación de campos vacíos (shake) tal cual. En éxito (`res.ok`), comportamiento actual (`setSent`). Verificación: enviar el formulario completo hace la llamada real y, si el correo llega, muestra la vista de éxito existente.
5. Agregar el estado de error a la vista `terminal-success` de `app/acerca-de/page.tsx`: si el `fetch` lanza o `res.ok` es falso, mostrar líneas de error dentro del mismo panel terminal y un botón "REINTENTAR" que vuelve al formulario con los datos intactos (no limpia `form`). Verificación: forzar un error (p. ej. `RESEND_API_KEY` vacía o inválida en local) y confirmar que se ve el estado de error y que "REINTENTAR" recupera el formulario con lo ya escrito.
6. Revisión final: enviar un mensaje real de punta a punta con una key válida de Resend y confirmar que llega a `rcarocardona@gmail.com` desde `onboarding@resend.dev`, con el nombre/correo/mensaje del formulario visibles en el cuerpo.

## Acceptance criteria

- [x] `npm install` instala `resend` sin errores.
- [x] `.env.local.example` existe en el repo con `RESEND_API_KEY` y `CONTACT_TO_EMAIL` vacías; `.env.local` (si existe localmente) no aparece en `git status`.
- [x] Enviar el formulario completo con una `RESEND_API_KEY` válida hace llegar un correo real a la dirección de `CONTACT_TO_EMAIL`, remitente `onboarding@resend.dev`, con nombre/correo/mensaje del formulario.
- [x] El formulario sigue disparando el "shake" si algún campo (nombre/correo/mensaje) está vacío, sin llegar a llamar al endpoint.
- [x] Mientras la petición está en curso, el botón de envío se deshabilita y muestra un estado de "enviando".
- [x] Si el endpoint responde error o el `fetch` falla, se muestra un estado de error dentro del panel `terminal-success` (mismo componente visual, líneas de error) con un botón "REINTENTAR".
- [x] Al pulsar "REINTENTAR" tras un error, el formulario vuelve a mostrarse con los valores que el usuario ya había escrito (no se pierden).
- [x] Rellenar el campo honeypot (simulando un bot, p. ej. vía DevTools) hace que el servidor responda `200` sin enviar ningún correo real.
- [x] Un payload con `email` en formato inválido enviado directo al endpoint (sin pasar por el formulario) responde `400`.
- [x] `npm run lint` no reporta errores nuevos.
- [x] `npm run dev` levanta la app sin errores en consola del navegador ni del servidor.

## Decisiones

- **Sí:** `onboarding@resend.dev` como remitente. Decisión explícita del usuario — no hay dominio propio verificado en Resend todavía, y este dominio de pruebas funciona sin configurar DNS.
- **No:** dominio propio verificado. Se deja para cuando el proyecto tenga un dominio real que verificar en Resend.
- **Sí:** destinatario fijo vía `CONTACT_TO_EMAIL` en variable de entorno, no hardcodeado en el código. Permite cambiarlo sin tocar código y no deja el correo personal del usuario commiteado en el repo.
- **Sí:** placeholder en `.env.local.example`, la key real la configura el usuario localmente. Decisión explícita del usuario — pegar una API key real en el chat no es seguro.
- **Sí:** honeypot simple como única protección anti-spam de este spec. Decisión explícita del usuario — cero dependencias nuevas, cubre bots básicos, evita sobre-ingeniería para un formulario de contacto de bajo volumen.
- **No:** rate limiting por IP u otra protección más robusta. Se deja para un spec futuro si aparece abuso real.
- **Sí:** solo notificación interna al equipo, sin autoresponder al remitente. Decisión explícita del usuario — menor alcance, menos plantillas que mantener.
- **No:** correo de confirmación automático al remitente. Puede agregarse después como spec independiente si se necesita.
- **Sí:** estado de error reutiliza la estética `terminal-success` existente (líneas de error en vez de líneas de éxito) en vez de un mensaje de error separado. Decisión explícita del usuario — consistente con el resto del look neón/terminal del proyecto, y evita construir un segundo componente de error desde cero.
- **No:** mensaje de error simple fuera del panel terminal. Rompería la coherencia visual que ya existe en esa vista.
- **Sí:** el formulario conserva los datos escritos tras un error, para no obligar al usuario a re-escribir todo si falla el envío.
- **No:** persistir los mensajes de contacto en algún storage. El endpoint es un simple "forward" a correo; no se introduce una base de datos ni se reutiliza `lib/storage.ts` (que es solo para sesión/puntuaciones).

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| `RESEND_API_KEY` faltante o inválida en producción | El endpoint responde `502` con mensaje claro; el usuario ve el estado de error del formulario en vez de un fallo silencioso. |
| `onboarding@resend.dev` tiene límites más estrictos que un dominio verificado (throughput bajo, posible marca como spam en algunos proveedores) | Aceptable para el volumen esperado de un formulario de contacto; migrar a dominio propio queda documentado como pendiente fuera de alcance. |
| Bots que sí completan el honeypot con headless browsers avanzados | El honeypot cubre el caso común (bots simples); no se pretende cobertura total, ver "Out of scope". |

## Qué **no** incluye este spec

- Correo de confirmación automático al remitente del formulario.
- Dominio propio verificado en Resend (SPF/DKIM).
- Rate limiting o protección anti-spam más allá de un campo honeypot.
- Persistencia de los mensajes de contacto en algún storage.
- Tests automatizados.
