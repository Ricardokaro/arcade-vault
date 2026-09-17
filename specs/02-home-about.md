# SPEC 02 — Landing page (Home) y página Acerca de

> **Status:** Aprobado
> **Depends on:** SPEC 01
> **Date:** 2026-09-17
> **Objective:** Convertir `/` en la landing page de marketing del prototipo (`home.jsx`), mover la biblioteca de juegos actual a `/games`, y agregar una página `/acerca-de` con misión del proyecto y formulario de contacto mock (`about.jsx`).

## Por qué existe este spec

SPEC 01 implementó `/` como la pantalla Biblioteca (grid de juegos), porque el prototipo original en `references/templates/` no tenía una landing separada. Ahora existe una versión más completa del prototipo en `references/templates/home-about/` que sí separa "Inicio" (landing de marketing: hero, features, preview de juegos, stats, actividad en vivo, pricing, CTA final) de "Biblioteca" (el grid con buscador/filtros que hoy vive en `/`), y agrega una pantalla "Acerca de" con misión + formulario de contacto. Este spec decide cómo reacomodar las rutas existentes para dar espacio a la nueva landing sin romper los flujos de SPEC 01.

## Scope

**In:**

- Ruta `/` (`app/page.tsx`) reemplazada por la landing (puerto de `home.jsx`): hero con siluetas SVG flotantes, sección "por qué Arcade Vault" (4 feature cards), preview de 6 juegos (`GAMES.slice(0, 6)`), sección de stats, sección de actividad en vivo (ticker de puntuaciones recientes + top 5 jugadores del día, con datos hardcodeados igual que el prototipo), sección de precios (plan único gratis + FAQ), y CTA final.
- Ruta `/games` (`app/games/page.tsx`) — el contenido actual de `app/page.tsx` (biblioteca: hero, buscador, chips de categoría, grid con `GameCard`) se mueve tal cual a esta ruta nueva, sin cambios funcionales.
- Ruta `/acerca-de` (`app/acerca-de/page.tsx`) — puerto de `about.jsx`: sección de misión + 3 highlights, separador decorativo animado, y formulario de contacto (nombre/correo/mensaje) que valida campos no vacíos y muestra una animación de "terminal" de éxito simulado al enviar. Sin envío real a ningún servicio.
- CSS: se agregan a `app/globals.css` los dos bloques de `references/templates/home-about/styles.css` ausentes hoy (líneas ~930–1147 "HOME PAGE" y ~1150–1725 "ABOUT/CONTACT"), sin modificar el resto del archivo.
- `components/Nav.tsx` actualizado: nuevo link "Inicio" (→ `/`), el link "Biblioteca" pasa a apuntar a `/games`, nuevo link "Acerca de" (→ `/acerca-de`), en ese orden, tanto en el nav de escritorio como en el panel móvil. El logo también pasa a apuntar a `/games`.
- Actualización de todos los puntos que hoy navegan a `/` asumiendo que es la biblioteca, para que apunten a `/games`:
  - `components/Nav.tsx`: logo y links "Biblioteca" (desktop + móvil).
  - `app/salon/page.tsx`: botón "volver" (línea ~100).
  - `app/juego/[id]/page.tsx`: botón "Volver al Vault" (línea ~55).
  - `components/GamePlayer.tsx`: botón de salir del reproductor (línea ~137).
  - `app/login/page.tsx`: redirect tras iniciar sesión y tras "jugar como invitado" (líneas ~19 y ~24).
- Hook compartido `useScrollReveal` (nuevo, p. ej. `lib/useScrollReveal.ts`) que reemplaza la lógica de `IntersectionObserver` duplicada idéntica en `home.jsx` y `about.jsx`, usado por las dos páginas nuevas.

**Out of scope (para futuros specs):**

- Envío real del formulario de contacto (API propia, servicio de email, etc.) — se queda como simulación con validación de campos vacíos y mensaje de éxito falso.
- Datos reales para el ticker de "actividad en vivo" y el "top jugadores · hoy" del home — se portan hardcodeados igual que el prototipo, no se derivan de `PLAYERS`/`seededScores`.
- Cambiar el copy o las categorías de precios (sigue siendo un único plan gratuito, sin planes pagos reales).
- Cualquier lógica de juego real, autenticación real, o sistema de créditos real (sigue fuera de alcance, ver SPEC 01).
- Tests automatizados.

## Data model

Este spec no introduce estructuras de datos nuevas en `lib/data.ts`. Reutiliza `GAMES` (para el preview de 6 juegos en el home y para `/games`) sin cambios.

Los datos del ticker de actividad y del top de jugadores del home (`home.jsx`, arrays `[{ p, g, s, t, c }]` y `[{ r, p, s }]`) se portan como arrays hardcodeados dentro de `app/page.tsx`, igual que en el prototipo — no viven en `lib/data.ts` porque no son datos de dominio reutilizables, son contenido decorativo de una sola pantalla.

## Implementation plan

1. Agregar a `app/globals.css` los bloques CSS "HOME PAGE" y "ABOUT/CONTACT" desde `references/templates/home-about/styles.css` (líneas ~930 en adelante), sin tocar las reglas existentes. Verificación: `npm run dev` no muestra errores de CSS en consola y las clases `home-*`, `about-*`, `contact-*` quedan disponibles.
2. Crear `lib/useScrollReveal.ts` con el hook compartido que observa `.reveal` vía `IntersectionObserver` y agrega la clase `in` (portado de la función duplicada en `home.jsx`/`about.jsx`). Verificación: el archivo compila sin errores de TypeScript.
3. Mover el contenido actual de `app/page.tsx` a `app/games/page.tsx` sin cambios funcionales. Verificación: `/games` renderiza exactamente lo que hoy renderiza `/` (hero, buscador, chips, grid).
4. Crear el nuevo `app/page.tsx` (Client Component) como puerto de `home.jsx`: hero con `FloatingSilhouettes`, sección de features con `FeatureIcon`, preview de juegos con `MiniCard` usando `GAMES.slice(0, 6)`, sección de stats, sección de actividad en vivo (ticker + top jugadores, datos hardcodeados), sección de pricing + FAQ, y CTA final. Los botones de esta página navegan a `/games` (explorar juegos, ver todos los juegos) y `/login` (crear cuenta, empezar gratis). Usa `useScrollReveal`. Verificación: `/` renderiza todas las secciones y las animaciones `reveal` se activan al hacer scroll.
5. Crear `app/acerca-de/page.tsx` (Client Component) como puerto de `about.jsx`: sección de misión + highlights con `HighlightIcon`, separador decorativo, y formulario de contacto con estado local (`name`/`email`/`msg`), validación de campos vacíos (shake al fallar), y vista de éxito tipo terminal al enviar. Sin llamada a ningún servicio externo. Usa `useScrollReveal`. Verificación: enviar el formulario vacío dispara el shake; enviarlo completo muestra la animación de terminal de éxito con el nombre ingresado.
6. Actualizar `components/Nav.tsx`: agregar link "Inicio" (`/`, activo solo en `pathname === "/"`), cambiar el link "Biblioteca" y el logo para apuntar a `/games` (activo en `/games`, `/juego/*`, `/jugar/*`), agregar link "Acerca de" (`/acerca-de`, activo en esa ruta), en el nav de escritorio y en el panel móvil. Verificación: cada link resalta como activo en su ruta correspondiente y ninguno queda roto.
7. Actualizar las referencias a `/` que asumían la biblioteca, para que apunten a `/games`: `app/salon/page.tsx` (botón volver), `app/juego/[id]/page.tsx` (botón "Volver al Vault"), `components/GamePlayer.tsx` (botón de salir del reproductor), `app/login/page.tsx` (redirect tras login y tras invitado). Verificación: cada botón/redirect lleva a `/games`, no a la nueva landing.
8. Revisión final: navegar manualmente `/`, `/games`, `/acerca-de`, y confirmar que los flujos existentes de SPEC 01 (login → `/games`, salón → volver a `/games`, detalle → volver a `/games`, reproductor → salir a `/games`) siguen funcionando. Confirmar el menú móvil con los 4 links en el orden correcto.

## Acceptance criteria

- [ ] `npm run dev` levanta la app sin errores en la consola del navegador ni del servidor.
- [ ] `/` muestra la landing completa: hero con CTAs, sección de features (4 tarjetas), preview de 6 juegos, sección de stats, sección de actividad en vivo (ticker + top 5), sección de pricing con FAQ, y CTA final.
- [ ] El botón "EXPLORAR JUEGOS" del hero y "VER TODOS LOS JUEGOS" de la sección de preview navegan a `/games`.
- [ ] El botón "CREAR CUENTA" del hero y "EMPEZAR GRATIS" de pricing navegan a `/login`.
- [ ] Las tarjetas de la sección de preview navegan a `/juego/[id]` del juego correspondiente.
- [ ] `/games` muestra el mismo contenido que antes mostraba `/` (hero de biblioteca, buscador, chips de categoría, grid de 8 juegos).
- [ ] `/acerca-de` muestra la sección de misión, los 3 highlights, y el formulario de contacto.
- [ ] Enviar el formulario de contacto con algún campo vacío dispara la animación de "shake" y no avanza.
- [ ] Enviar el formulario completo muestra la vista de "terminal" de éxito con el nombre ingresado, sin llamada de red.
- [ ] El botón "ENVIAR OTRO MENSAJE" de la vista de éxito vuelve al formulario vacío.
- [ ] El Nav muestra 4 links en orden: Inicio, Biblioteca, Salón de la Fama, Acerca de — cada uno resalta como activo en su ruta.
- [ ] El link "Biblioteca" del Nav y el logo apuntan a `/games`; el link "Inicio" apunta a `/`.
- [ ] Tras iniciar sesión o entrar como invitado desde `/login`, la app redirige a `/games` (no a `/`).
- [ ] El botón "Volver al Vault" en `/juego/[id]`, el botón de volver en `/salon`, y el botón de salir en `/jugar/[id]` navegan a `/games`.
- [ ] El menú móvil (hamburguesa) incluye los 4 links en el mismo orden que el nav de escritorio.
- [ ] Ninguna pantalla implementa lógica de juego real ni envío real de datos a un backend.

## Decisiones

- **Sí:** `/` pasa a ser la landing de marketing (puerto de `home.jsx`) y la biblioteca actual se mueve a `/games`. Decisión explícita del usuario — replica la separación "Inicio" vs "Biblioteca" del prototipo `home-about/nav.jsx`.
- **No:** dejar `/` como biblioteca y ubicar la landing en otra ruta secundaria. Hubiera sido menos disruptivo pero no refleja cómo funciona el prototipo (donde "Inicio" es la portada).
- **Sí:** ruta `/acerca-de` en español, consistente con el resto de rutas del proyecto (`/juego`, `/jugar`, `/salon`, `/login`).
- **No:** `/about`. Coincide con el nombre del archivo de referencia pero rompe el patrón en español del resto de rutas.
- **Sí:** formulario de contacto mock total (validación + animación de éxito, sin backend). Coherente con el resto del proyecto, que no tiene backend (ver SPEC 01).
- **Sí:** todos los puntos que hoy navegan a `/` asumiendo la biblioteca (logo del Nav, link "Biblioteca", volver desde detalle/salón/reproductor, redirect post-login) pasan a apuntar a `/games`. Decisión explícita del usuario — tras loguearse o terminar de jugar, el usuario espera volver al catálogo, no a la landing de marketing.
- **No:** mantener esos mismos puntos apuntando a `/` (la nueva landing). Hubiera generado una regresión de UX: cada "volver" te devuelve a una página de marketing en vez de al catálogo de juegos.
- **Sí:** datos hardcodeados en `app/page.tsx` para el ticker de actividad y el top de jugadores del home, igual que el prototipo. Decisión explícita del usuario — fiel al mockup, menor riesgo, evita inventar una función determinista nueva solo para contenido decorativo de una pantalla.
- **No:** derivar esos datos de `PLAYERS`/`seededScores`. Más "correcto" en términos de una sola fuente de verdad, pero esos datos no fueron diseñados para generar un ticker de actividad reciente ni un ranking "de hoy".
- **Sí:** extraer `useScrollReveal` como hook compartido en `lib/`, en vez de duplicar la misma lógica de `IntersectionObserver` en `home.jsx` y `about.jsx` como hace el prototipo. Es una duplicación exacta entre dos archivos nuevos del mismo spec, no una abstracción prematura.
- **Sí:** mantener el resto de la organización de SPEC 01 (`components/` para UI compartida, páginas mayormente inline en `app/**/page.tsx` salvo componentes reutilizables como `GameCard`) — `FloatingSilhouettes`, `MiniCard`, `FeatureIcon`, `HighlightIcon` se quedan como funciones locales dentro de sus respectivos `page.tsx`, igual que el prototipo mantiene todo en un solo archivo por pantalla.

## Qué **no** incluye este spec

- Envío real de mensajes de contacto a un backend o servicio de email.
- Datos reales/dinámicos para el ticker de actividad y el top de jugadores del home.
- Nuevos planes de precios o lógica de pagos.
- Lógica de juego real, autenticación real, o sistema de créditos real (ver SPEC 01).
- Tests automatizados.
