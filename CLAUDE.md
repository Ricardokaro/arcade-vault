# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Comandos

```bash
npm run dev      # servidor de desarrollo (Next.js con Turbopack)
npm run build    # build de producción
npm run start    # sirve el build de producción
npm run lint     # ESLint (eslint-config-next core-web-vitals + typescript)
```

No hay suite de tests configurada en este proyecto.

## Next.js 16 — antes de tocar rutas o layouts

Este repo corre Next.js 16.3.5, que introduce cambios respecto al conocimiento de entrenamiento del modelo (ver `AGENTS.md`). Antes de escribir código que toque App Router, `params`, layouts o tipos de página, lee la guía relevante en `node_modules/next/dist/docs/` (secciones `01-app`, `02-pages`, `03-architecture`, `04-community`).

Cambios ya visibles en este código y que hay que replicar, no "corregir":

- `params` en páginas dinámicas es una **Promise** que debe awaitearse: `const { id } = await params;` (ver `app/juego/[id]/page.tsx`).
- Las props de página/layout usan los tipos globales generados por Next (`PageProps<"/juego/[id]">`, `LayoutProps<"/">`) en vez de interfaces manuales — no definas tus propias interfaces de props para páginas/layouts.

## Arquitectura

Arcade Vault es un portal de juegos arcade con datos mock y sesión simulada (sin backend). Nació como un prototipo estático en `references/templates/` (React vía CDN + Babel, `app.jsx`/`biblioteca.jsx`/`detalle.jsx`/`reproductor.jsx`/`auth.jsx`/`salon.jsx`/`nav.jsx`/`data.jsx`, enrutamiento por `location.hash`) y se está migrando a rutas reales de App Router. Ese directorio es la referencia visual/funcional de la que se portan pantallas — no es código que se ejecute en la app.

## Skills

Usa siempre /frontend-design para diseñar la interfaz de usuario.

**Flujo de datos:**

- `lib/data.ts` — datos mock puros: `GAMES`, `CATS`, `PLAYERS` y `seededScores(seed, count)` (genera leaderboards deterministas a partir de una semilla, sin llamadas a red ni estado).
- `lib/storage.ts` — toda la persistencia vive en `localStorage` bajo dos claves: `av_user` (sesión) y `av_scores` (historial de puntuaciones). Cada lectura/escritura está envuelta en try/catch porque `localStorage` puede estar deshabilitado. La sesión se expone vía `useSyncExternalStore` (no `useEffect` + estado) para evitar parpadeo de hidratación — `getUserServerSnapshot()` siempre devuelve `null` en el servidor.
- `components/UserProvider.tsx` — Context de React que envuelve `lib/storage.ts` y expone `useUser()` con `{ user, login, signOut }`. Es Client Component y envuelve todo `app/layout.tsx`.

**Rutas (App Router, nombres en español, consistentes con el prototipo):**

- `/` (`app/page.tsx`) — biblioteca: grid de juegos con búsqueda y filtro por categoría.
- `/juego/[id]` — detalle de un juego + leaderboard mock.
- `/jugar/[id]` — reproductor: HUD, marco CRT, guarda puntuación al finalizar con `addScore`. Para juegos sin motor real usa un loop de puntuación falsa vía `setInterval`; `components/GamePlayer.tsx` consulta `lib/games/registry.ts` y, si el `id` tiene una entrada ahí, monta ese motor real en vez del loop falso (ver más abajo).
- `/login` — login/registro simulado contra `lib/storage.ts`, sin backend.
- `/salon` — salón de la fama: podio + tabla por juego, con fila "tu mejor marca" si hay sesión.

**Juegos reales:** el catálogo tenía 8 juegos sin lógica real (colisiones, controles, física) como alcance explícito del MVP (ver `specs/01-mvp-pantallas-visuales.md`). `rocas` es la primera excepción — su motor vive en `lib/games/rocas/engine.ts` (portado de `references/started-games/02-asteroids/`) con un wrapper React en `components/games/rocas/RocasGame.tsx`, registrado en `lib/games/registry.ts`. El contrato que debe implementar cada juego real está en `lib/games/types.ts` (`RealGameProps`). Los otros 7 juegos siguen sin lógica real hasta que se les porte su propio motor siguiendo el mismo patrón (ver `specs/05-juego-real-rocas.md`).

**Estilos:** `app/globals.css` está portado casi tal cual desde `references/templates/styles.css` para preservar la identidad visual neón/píxel/CRT. Se prefiere extender ese CSS global (variables, animaciones, clases `av-*`/`cover-*`) antes que introducir utilidades de Tailwind nuevas para este look.

## Metodología: Spec Driven Design

El proyecto sigue un flujo de specs antes de implementar features grandes, vía los skills en `.agents/skills/`:

- `/spec` — diseña un spec nuevo en `specs/NN-slug.md` a través de preguntas de clarificación. No escribe código.
- `/spec-impl NN-slug` — implementa un spec cuyo estado sea `Aprobado`/`Approved`, creando la rama `spec-NN-slug` (controlado por `AutoCreateBranch` en `specs/.spec-config.yml`) e implementando paso a paso con pausas para revisar cada diff.

Un spec solo se implementa si su estado es `Aprobado`. Si el estado es `Borrador`/`Draft` u otro, `/spec-impl` debe detenerse sin tocar código. Al implementar, cada spec aprobado (p. ej. `specs/01-mvp-pantallas-visuales.md`) es la fuente de verdad sobre alcance, plan y criterios de aceptación — ante ambigüedad no cubierta por el spec, se pregunta al usuario en vez de improvisar.
