# SPEC 01 — MVP visual de pantallas de Arcade Vault

> **Status:** Aprobado
> **Depends on:** (ninguno, primer spec del proyecto)
> **Date:** 2026-09-15
> **Objective:** Implementar como rutas reales de Next.js las 5 pantallas del prototipo (biblioteca, detalle, reproductor, login/registro y salón de la fama) con datos mock y sesión simulada en localStorage, sin lógica de juego real.

## Por qué existe este spec

El proyecto arrancó como el boilerplate de `create-next-app` (Next.js 16, App Router, React 19, Tailwind v4) y existe un prototipo visual completo en `references/templates/` construido como SPA sin build (React vía CDN + Babel, enrutamiento por `location.hash`, persistencia directa en `localStorage`). Este spec decide cómo migrar ese prototipo al proyecto real: usando rutas reales de Next.js en vez de replicar el hash-router, y conservando el CSS del prototipo casi tal cual para no arriesgar la identidad visual neón/píxel/CRT. Ver [Decisiones](#decisiones) para el detalle de cada elección.

## Scope

**In:**

- Layout raíz (`app/layout.tsx`) con las tres fuentes del prototipo vía `next/font/google` (Press Start 2P, Courier Prime, JetBrains Mono), fondo (`av-bg`, `av-noise`), `Nav` y footer compartidos.
- Ruta `/` → pantalla Biblioteca: hero, buscador por texto, chips de categoría y grid de tarjetas de juego con efecto *tilt* (puerto de `biblioteca.jsx`).
- Ruta `/juego/[id]` → pantalla Detalle: info del juego, tags, stats, tabla de mejores puntuaciones mock y botones "Jugar ahora" / "Volver al Vault" (puerto de `detalle.jsx`).
- Ruta `/jugar/[id]` → pantalla Reproductor: HUD (puntuación, vidas, nivel), marco CRT con animaciones CSS decorativas, loop de puntuación falsa (no es un juego real), pausa, y modal de fin de partida con guardado de puntuación (puerto de `reproductor.jsx`).
- Ruta `/login` → pantalla Auth: tabs "Iniciar sesión" / "Crear cuenta", botón "Jugar como invitado", botones sociales decorativos (puerto de `auth.jsx`).
- Ruta `/salon` → pantalla Salón de la Fama: tabs por juego, podio top 3, tabla de puntuaciones y fila "tu mejor marca" cuando hay sesión iniciada (puerto de `salon.jsx`).
- `Nav` compartido con estado de sesión (nombre de usuario o botón "Iniciar Sesión"), resaltado de ruta activa, menú móvil tipo hamburguesa y contador de créditos estático ("CRÉDITOS · 03").
- Sesión de usuario simulada vía Context de React (`UserProvider`), persistida en `localStorage` bajo la clave `av_user`.
- Guardado de puntuación en `localStorage` bajo la clave `av_scores` al finalizar una partida en `/jugar/[id]`.
- Datos mock (`GAMES`, `CATS`, `PLAYERS`, función `seededScores`) portados a TypeScript en `lib/data.ts`.
- Estilos: `references/templates/styles.css` portado casi tal cual a CSS global del proyecto, conservando variables, animaciones y clases.

**Out of scope (para futuros specs):**

- Lógica de juego real para cualquiera de los 8 juegos (colisiones, controles, física, puntuación real).
- Autenticación real contra un backend (API propia, base de datos, OAuth funcional para los botones de Google/GitHub — quedan decorativos, sin acción).
- Persistencia de cuentas o puntuaciones fuera del `localStorage` del navegador (sin servidor, sin sincronización entre dispositivos).
- Sistema real de créditos/monedas (el contador del Nav se queda fijo en "03").
- Tests automatizados.

## Data model

```ts
// lib/data.ts
interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
  cover: string; // clase CSS de fondo, ej. "cover-bricks"
  color: "cyan" | "magenta" | "green" | "yellow";
  best: number;
  plays: string;
}

interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string; // dd/mm/aaaa
}
```

`GAMES`, `CATS` y `PLAYERS` se portan tal cual desde `references/templates/data.jsx`, igual que la función determinista `seededScores(seed, count)`.

Claves de `localStorage`:

- `av_user`: `{ name: string } | null` — sesión simulada.
- `av_scores`: `Array<{ game: string; score: number; name: string; at: number }>` — historial de puntuaciones guardadas.

Conventions:

- Los `id` de `Game` son slugs en minúscula con guiones (ej. `"bloque-buster"`), y son el parámetro dinámico de `/juego/[id]` y `/jugar/[id]`.
- Las puntuaciones se formatean con `toLocaleString("es-ES")` en la UI, igual que el prototipo.

## Implementation plan

1. Crear `lib/data.ts` con las interfaces `Game`/`ScoreRow`, los arreglos `GAMES`/`CATS`/`PLAYERS` y `seededScores`, portados desde `references/templates/data.jsx`. Verificación: el archivo compila sin errores de TypeScript.
2. Portar `references/templates/styles.css` a `app/globals.css` (reemplazando el CSS del boilerplate), agregando las capas `av-bg` y `av-noise` al layout raíz. Verificación: `npm run dev` sirve la página con el fondo y sin errores de CSS en consola.
3. Configurar las tres fuentes (Press Start 2P, Courier Prime, JetBrains Mono) con `next/font/google` en `app/layout.tsx`, reemplazando las fuentes Geist del boilerplate. Verificación: las variables CSS de fuente quedan expuestas y se aplican en un texto de prueba.
4. Crear `lib/storage.ts` con helpers `getUser`, `setUser`, `clearUser`, `getScores`, `addScore` que leen/escriben `av_user` y `av_scores` en `localStorage`, cada uno envuelto en try/catch.
5. Crear `components/UserProvider.tsx` (Client Component) con un Context que expone `user`, `login(user)` y `signOut()`, inicializado desde `lib/storage.ts`. Envolver `app/layout.tsx` con este provider.
6. Crear `components/Nav.tsx` (puerto de `nav.jsx`) usando `usePathname()` de `next/navigation` para la ruta activa, el contexto de usuario para la sesión, y el menú móvil. Insertarlo junto con el footer estático en `app/layout.tsx`.
7. Crear `app/page.tsx` (puerto de `biblioteca.jsx`) y `components/GameCard.tsx` (con el efecto *tilt*): hero, buscador, chips de categoría y grid de tarjetas que navegan a `/juego/[id]`.
8. Crear `app/juego/[id]/page.tsx` (puerto de `detalle.jsx`): info del juego, leaderboard con `seededScores`, botones hacia `/jugar/[id]` y `/`.
9. Crear `app/jugar/[id]/page.tsx` (puerto de `reproductor.jsx`, Client Component): HUD, marco CRT con animaciones decorativas, loop de puntuación falsa vía `setInterval` con limpieza en `useEffect`, pausa, y modal de fin de partida que guarda con `addScore`.
10. Crear `app/login/page.tsx` (puerto de `auth.jsx`, Client Component): tabs iniciar sesión/crear cuenta, formulario que llama a `login()` del contexto y redirige a `/`, botón de invitado, botones sociales decorativos sin acción.
11. Crear `app/salon/page.tsx` (puerto de `salon.jsx`): tabs por juego, podio, tabla con `seededScores`, fila "tu mejor marca" condicionada al usuario del contexto.
12. Revisión final: navegar manualmente las 5 pantallas, confirmar el menú móvil responsive, y eliminar los restos del boilerplate de `create-next-app` (contenido original de `app/page.tsx`, SVGs de `public/` sin uso).

## Acceptance criteria

- [ ] `npm run dev` levanta la app sin errores en la consola del navegador ni del servidor.
- [ ] La ruta `/` muestra el grid de los 8 juegos de `GAMES`, con buscador por texto y filtro por categoría funcionando en el cliente.
- [ ] Cada tarjeta de juego navega a `/juego/[id]` con el `id` correspondiente.
- [ ] `/juego/[id]` muestra la info del juego y una tabla de mejores puntuaciones generada con `seededScores`.
- [ ] El botón "JUGAR AHORA" en `/juego/[id]` navega a `/jugar/[id]`.
- [ ] `/jugar/[id]` muestra el HUD, el marco CRT y una puntuación que se incrementa automáticamente mientras no está en pausa ni terminada la partida.
- [ ] El botón "PAUSA" detiene el incremento de puntuación y "REANUDAR" lo retoma.
- [ ] El botón "FIN" abre el modal de fin de partida con la puntuación final.
- [ ] Guardar la puntuación en el modal la persiste en `localStorage` bajo `av_scores` y muestra el mensaje "PUNTUACIÓN GUARDADA".
- [ ] `/login` permite alternar entre "Iniciar sesión" y "Crear cuenta"; enviar el formulario guarda el usuario en `localStorage` (`av_user`) y redirige a `/`.
- [ ] Tras iniciar sesión, el Nav muestra el nombre de usuario en lugar del botón "Iniciar Sesión" en cualquier ruta.
- [ ] El botón "JUGAR COMO INVITADO" en `/login` navega a `/` sin crear sesión.
- [ ] Cerrar sesión desde el Nav borra `av_user` de `localStorage` y el Nav vuelve a mostrar "Iniciar Sesión".
- [ ] `/salon` muestra podio (top 3), tabla de puntuaciones y tabs para cambiar de juego.
- [ ] Con sesión iniciada, `/salon` muestra la fila "tu mejor marca" para el juego seleccionado.
- [ ] El menú móvil (hamburguesa) abre y cierra el panel de navegación en pantallas angostas.
- [ ] Ninguna pantalla implementa lógica de juego real (sin detección de colisiones ni controles de teclado/táctil para jugar).

## Decisiones

- **Sí:** rutas reales de Next.js App Router (`/`, `/juego/[id]`, `/jugar/[id]`, `/login`, `/salon`) en vez del hash-router de una sola página del prototipo. Es lo idiomático en App Router y da URLs navegables y compartibles.
- **No:** replicar el hash-router SPA del prototipo. Más fiel al mockup original pero va contra las convenciones de Next.js App Router.
- **Sí:** loop decorativo de puntuación falsa (`setInterval` + animaciones CSS) en `/jugar/[id]`, sin lógica real de juego. Da la sensación de "arcade vivo" sin implementar ningún juego.
- **No:** pantalla de reproductor completamente estática (sin animación ni contador). Se sentía menos fiel al prototipo y menos demostrable como MVP.
- **Sí:** login/registro mock funcional con `localStorage` (`av_user`), igual que el prototipo. Permite probar el flujo completo (sesión reflejada en Nav y Salón de la Fama) sin backend.
- **No:** formulario de login puramente visual sin acción. Hubiera dejado el Nav y el Salón de la Fama sin forma de mostrar el estado "con sesión".
- **Sí:** portar `references/templates/styles.css` casi tal cual a CSS global. Preserva fielmente la identidad visual neón/píxel/CRT sin el riesgo y esfuerzo de reescribirla en Tailwind.
- **No:** reescribir el diseño con utilidades de Tailwind. Alto riesgo de desviación visual para un MVP que debe verse igual al mockup.
- **Sí:** `next/font/google` para las tres fuentes del prototipo. Sigue la convención ya usada en `app/layout.tsx` (fuentes Geist) y evita `<link>` bloqueantes.
- **Sí:** nombres de ruta en español (`/juego/[id]`, `/jugar/[id]`, `/salon`, `/login`), consistentes con los textos y el código del prototipo.
- **Sí:** guardar la puntuación en `localStorage` (`av_scores`) al finalizar la partida, coherente con la sesión mock funcional.
- **Sí:** organización en `components/` (UI compartida) + `lib/data.ts` + `lib/storage.ts`, separado de las carpetas de ruta en `app/`.
- **No:** implementar autenticación real, sistema de créditos real o lógica de los 8 juegos — fuera del alcance de este MVP visual (ver Scope).

## Risks

| Riesgo | Mitigación |
| --- | --- |
| `localStorage` deshabilitado (modo privado o política del navegador) | Los helpers de `lib/storage.ts` envuelven cada lectura/escritura en try/catch; la app sigue funcionando pero sin persistir sesión ni puntuaciones. |
| Cambios de API en Next.js 16 respecto al conocimiento de entrenamiento del modelo (ver `AGENTS.md`) | Antes de implementar, `/spec-impl` debe leer `node_modules/next/dist/docs/` para confirmar convenciones vigentes de App Router (ej. `params` asíncronos). |
| El loop de puntuación falsa (`setInterval`) puede seguir corriendo si no se limpia al desmontar `/jugar/[id]` | Usar `useEffect` con función de limpieza (`clearInterval`), igual que el prototipo, para evitar fugas de memoria. |

## Qué **no** incluye este spec

- Lógica de juego real para ninguno de los 8 juegos.
- Autenticación real contra backend u OAuth funcional.
- Sistema de créditos/monedas real.
- Persistencia fuera de `localStorage` (servidor, base de datos, sincronización entre dispositivos).
- Tests automatizados.

Cada uno de estos, si se necesita, va en su propio spec futuro.
