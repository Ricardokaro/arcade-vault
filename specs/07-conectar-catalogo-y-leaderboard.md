# SPEC 07 — Conectar catálogo y leaderboard a Supabase

> **Status:** Implementado
> **Depends on:** SPEC 04, SPEC 06
> **Date:** 2026-09-22
> **Objective:** Reemplazar `GAMES`/`seededScores`/`av_scores` por lecturas y escrituras reales contra las tablas `games`/`scores` de Supabase en las 5 pantallas que hoy dependen de datos mock (`/`, `/games`, `/juego/[id]`, `/jugar/[id]`, `/salon`) y en el guardado de puntuación de `GamePlayer`.

## Por qué existe este spec

SPEC 06 creó `games` (sembrada) y `scores` (vacía) en Supabase, pero dejó explícitamente sin tocar la UI. Este spec conecta esa UI: todas las pantallas que hoy leen `GAMES`/`seededScores` de `lib/data.ts` pasan a leer de Supabase, y `GamePlayer` pasa a escribir puntuaciones reales en `scores` en vez de `localStorage` (`av_scores`). Es un spec deliberadamente grande — se evaluó dividirlo (solo catálogo primero, leaderboard después), pero se decidió mantenerlo junto para no dejar el leaderboard vacío entre specs (ver Decisiones).

Durante la definición se encontraron dos consecuencias directas de eliminar `GAMES` de `lib/data.ts` que no eran obvias al pedir la feature: `/jugar/[id]` también hace `GAMES.find(...)` para obtener el juego que le pasa a `GamePlayer`, y la landing (`/`) usa `GAMES.slice(0, 6)` para su preview de juegos. Ambas quedan dentro del alcance.

## Scope

**In:**

- `lib/games/queries.ts`: funciones de consulta compartidas, parametrizadas por una instancia de `SupabaseClient` (usable desde el cliente server de SPEC 04 o el cliente browser, según la pantalla):
  - `fetchGames(supabase)` → `Game[]` (todos los juegos, para `/`, `/games`, `/salon`).
  - `fetchGame(supabase, id)` → `Game | null` (para `/juego/[id]`, `/jugar/[id]`).
  - `fetchTopScores(supabase, gameId, limit)` → filas ordenadas por `score desc` (para `/juego/[id]`, `/salon`).
  - `fetchUserBestScore(supabase, gameId, playerName)` → mejor puntuación real de ese jugador para ese juego, o `null` si no tiene ninguna.
  - `insertScore(supabase, { gameId, playerName, score })` → inserta una fila en `scores`.
- `app/games/page.tsx`: pasa a ser Server Component async que hace `fetchGames()` y renderiza `components/LibraryClient.tsx` (extraído del código actual, recibe `games: Game[]` como prop, conserva la búsqueda/filtro client-side tal cual). `app/games/error.tsx` nuevo.
- `app/juego/[id]/page.tsx`: reemplaza `GAMES.find`/`seededScores` por `fetchGame(id)` (con `notFound()` si no existe) y `fetchTopScores(id, 10)`. Si no hay puntuaciones, muestra el mensaje de estado vacío (ver UX abajo). `app/juego/[id]/error.tsx` nuevo.
- `app/jugar/[id]/page.tsx`: reemplaza `GAMES.find` por `fetchGame(id)`. `app/jugar/[id]/error.tsx` nuevo.
- `app/salon/page.tsx`: pasa a ser Server Component async que hace `fetchGames()` y renderiza `components/HallOfFameClient.tsx` (extraído del código actual, recibe `games: Game[]`, conserva el estado de tab client-side). Al cambiar de tab, `HallOfFameClient` hace `fetchTopScores`/`fetchUserBestScore` client-side (cliente browser de SPEC 04) con un estado de carga simple. El podio se redibuja de forma defensiva para 0/1/2/3+ filas (sin filas fantasma). `app/salon/error.tsx` nuevo.
- `app/page.tsx`: pasa a ser Server Component async que hace `fetchGames()`, toma los primeros 6, y renderiza `components/HomeClient.tsx` (extraído del código actual, recibe `previewGames: Game[]`). `app/error.tsx` nuevo (boundary raíz).
- `components/GamePlayer.tsx`: el flujo de "GUARDAR PUNTUACIÓN" reemplaza `addScore` (localStorage) por `insertScore` (cliente browser de Supabase), con estados `sending`/`error` siguiendo el mismo patrón que el formulario de contacto de SPEC 03 (botón deshabilitado + texto "GUARDANDO…" mientras espera, estado de error con botón "REINTENTAR" sin perder los datos ya ingresados).
- Limpieza: `lib/data.ts` pierde el export `GAMES` (reemplazado por Supabase) y también `PLAYERS`/`seededScores`, que quedan sin ningún consumidor tras esta migración (confirmado por búsqueda en el repo); conserva `Game`, `ScoreRow`, `CATS`. `lib/storage.ts` pierde `addScore`/`getScores` (y la clave `av_scores` deja de usarse); conserva las funciones de sesión (`av_user`) sin cambios, ya que la autenticación mock no es parte de este spec.
- Estado vacío: en `/juego/[id]` y en cada tab de `/salon`, si `fetchTopScores` devuelve 0 filas se muestra un mensaje corto ("SÉ EL PRIMERO EN PUNTUAR" o similar, ajustado a la estética del proyecto) en vez de una tabla/podio vacíos.

**Out of scope (para futuros specs):**

- Autenticación real — `player_name` sigue siendo el nombre mock de `av_user`/las iniciales ingresadas en el modal, igual que hoy.
- Calcular `games.best`/`games.plays` en vivo desde `scores` — siguen siendo los valores estáticos sembrados en SPEC 06.
- Restringir el guardado de puntuaciones a solo `rocas` (el único juego con lógica real) — los otros 7 juegos siguen pudiendo guardar su puntuación simulada, ahora en la tabla pública `scores`, igual que hoy la guardaban en su `localStorage` privado.
- Rate limiting, moderación o cualquier protección contra spam en `scores` más allá del RLS ya definido en SPEC 06.
- Migrar puntuaciones que ya existan en `localStorage` de navegadores actuales hacia Supabase.
- Tests automatizados.

## Data model

Este spec no cambia el esquema de Supabase (ver SPEC 06). Introduce el contrato de las funciones de consulta compartidas:

```ts
// lib/games/queries.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Game, ScoreRow } from "@/lib/data";

export function fetchGames(supabase: SupabaseClient): Promise<Game[]>;
export function fetchGame(
  supabase: SupabaseClient,
  id: string,
): Promise<Game | null>;
export function fetchTopScores(
  supabase: SupabaseClient,
  gameId: string,
  limit: number,
): Promise<ScoreRow[]>;
export function fetchUserBestScore(
  supabase: SupabaseClient,
  gameId: string,
  playerName: string,
): Promise<number | null>;
export function insertScore(
  supabase: SupabaseClient,
  params: { gameId: string; playerName: string; score: number },
): Promise<void>;
```

`ScoreRow.date` se deriva de `scores.created_at` con `toLocaleDateString("es-ES")`; `ScoreRow.rank` se calcula por posición (índice + 1) sobre el resultado ya ordenado por `score desc`.

## Implementation plan

1. Crear `lib/games/queries.ts` con las 5 funciones de arriba, usando los nombres de tabla/columna de SPEC 06. Verificación: compila sin errores de TypeScript.
2. Migrar `/games`: extraer el contenido actual a `components/LibraryClient.tsx` (prop `games: Game[]`), convertir `app/games/page.tsx` en Server Component async con `fetchGames()`, agregar `app/games/error.tsx`. Verificación: `/games` muestra el mismo grid/búsqueda/filtro de antes, ahora con datos de Supabase.
3. Migrar `/juego/[id]`: reemplazar `GAMES.find`/`seededScores` por `fetchGame`/`fetchTopScores(id, 10)`, agregar el estado vacío si no hay puntuaciones, agregar `app/juego/[id]/error.tsx`. Verificación: la página muestra el juego y su leaderboard real (vacío o con datos según corresponda).
4. Migrar `/jugar/[id]`: reemplazar `GAMES.find` por `fetchGame(id)`, agregar `app/jugar/[id]/error.tsx`. Verificación: `/jugar/rocas` y `/jugar/[cualquier-otro-id]` siguen funcionando igual que antes de este spec.
5. Migrar `/salon`: extraer a `components/HallOfFameClient.tsx` (prop `games: Game[]`, fetch client-side de scores/mejor marca por tab con estado de carga), convertir `app/salon/page.tsx` en Server Component async con `fetchGames()`, rediseñar el podio para 0/1/2/3+ filas, agregar `app/salon/error.tsx`. Verificación: cambiar de tab actualiza el leaderboard con datos reales; con sesión iniciada, "tu mejor marca" solo aparece si el usuario tiene una puntuación real guardada para ese juego.
6. Migrar la landing (`/`): extraer a `components/HomeClient.tsx` (prop `previewGames: Game[]`), convertir `app/page.tsx` en Server Component async con `fetchGames().slice(0, 6)`, agregar `app/error.tsx`. Verificación: la landing muestra el mismo preview de 6 juegos, ahora desde Supabase.
7. Conectar `GamePlayer.tsx` a `insertScore`: reemplazar la llamada a `addScore` por una llamada async a `insertScore` (cliente browser de SPEC 04), con estado `sending` (botón "GUARDAR PUNTUACIÓN" deshabilitado, texto "GUARDANDO…") y estado de error (mensaje + botón "REINTENTAR" que no borra `score`/`displayName`). Verificación: guardar una puntuación real inserta la fila en `scores` (confirmable con `execute_sql`) y luego aparece en el leaderboard de `/juego/[id]` y `/salon` al recargar.
8. Limpiar `lib/data.ts` (quitar `GAMES`, `PLAYERS`, `seededScores`; conservar `Game`, `ScoreRow`, `CATS`) y `lib/storage.ts` (quitar `addScore`/`getScores`; conservar las funciones de `av_user`). Verificación: `npm run build` compila sin errores ni imports rotos.
9. Revisión final: recorrer `/`, `/games`, `/juego/[id]`, `/jugar/[id]`, `/salon` manualmente, guardar una puntuación real desde `/jugar/rocas` y confirmar que se refleja en los leaderboards; simular un fallo de Supabase (ej. una variable de entorno temporalmente inválida) y confirmar que cada `error.tsx` se muestra en vez de que la página rompa.

## Acceptance criteria

- [x] `npm run dev`/`npm run build` funcionan sin errores.
- [x] `/` muestra el preview de 6 juegos leído de Supabase (mismo diseño que antes).
- [x] `/games` muestra el grid completo de juegos leído de Supabase; la búsqueda y el filtro por categoría siguen funcionando client-side sobre esos datos.
- [x] `/juego/[id]` muestra la info del juego y su leaderboard real; si el juego no tiene puntuaciones guardadas, se ve el mensaje de estado vacío en vez de una tabla vacía.
- [x] `/jugar/[id]` sigue funcionando igual que antes de este spec (HUD, motor real de `rocas`, loop falso de los demás juegos) para cualquier `id` válido del catálogo.
- [x] `/salon` muestra las tabs de todos los juegos; cambiar de tab actualiza el podio/tabla con datos reales de ese juego (o el estado vacío si no hay ninguno).
- [x] Con sesión iniciada, "tu mejor marca" en `/salon` muestra la mejor puntuación real guardada por ese usuario para el juego seleccionado, y no aparece si no tiene ninguna.
- [x] El podio de `/salon` no muestra filas ni datos inventados cuando hay menos de 3 puntuaciones para el juego seleccionado.
- [x] Guardar una puntuación desde el modal de fin de partida (cualquier juego) inserta una fila real en la tabla `scores` de Supabase (verificable con `execute_sql`), con el `player_name` mostrado en el modal.
- [x] Mientras se guarda la puntuación, el botón "GUARDAR PUNTUACIÓN" se deshabilita y muestra un estado de "guardando".
- [x] Si falla el guardado de la puntuación (ej. red caída), se muestra un estado de error con un botón para reintentar, sin perder la puntuación ni el nombre ya ingresados.
- [x] Una puntuación guardada en `/jugar/rocas` (o cualquier otro juego) aparece reflejada al recargar `/juego/[id]` y `/salon` para ese juego.
- [x] Si el fetch a Supabase falla en `/`, `/games`, `/juego/[id]`, `/jugar/[id]` o `/salon`, se muestra el `error.tsx` correspondiente en vez de que la página rompa.
- [x] `lib/data.ts` ya no exporta `GAMES`, `PLAYERS` ni `seededScores`; `lib/storage.ts` ya no exporta `addScore`/`getScores`.
- [x] `npm run lint` no reporta errores nuevos.

## Decisiones

- **Sí:** un solo spec para catálogo + leaderboard (lectura y escritura), en vez de dividirlo en dos. Decisión explícita del usuario tras presentarle la alternativa más chica — evita dejar el leaderboard vacío/mock durante un spec intermedio.
- **No:** dividir en "solo catálogo" primero y "leaderboard + escritura" después, que era la opción recomendada por tamaño. Se documenta la recomendación descartada porque el spec terminó siendo notablemente más grande de lo habitual en este proyecto.
- **Sí:** fetch server-side en cada página (Server Component), reemplazando `GAMES` por completo, sin fallback silencioso a datos mock si Supabase falla. Decisión explícita del usuario — una sola fuente de verdad, errores visibles en vez de ocultos.
- **Sí:** `error.tsx` nativo de Next.js por ruta para manejar fallos de fetch. Decisión explícita del usuario — sigue la convención idiomática de App Router.
- **Sí:** `/jugar/[id]` y la landing (`/`) entran al alcance porque también dependen de `GAMES`. Encontrado durante la implementación de la spec, no en el pedido original del usuario; confirmado con el usuario antes de escribir el spec.
- **Sí:** el preview de la landing también se migra a Supabase (en vez de dejar un snapshot local, que era la opción más chica). Decisión explícita del usuario — prioriza consistencia total sobre menor esfuerzo.
- **Sí:** `av_scores`/`localStorage` se reemplaza por completo con escritura real a Supabase. Decisión explícita del usuario — una sola fuente de verdad para puntuaciones.
- **No:** escritura dual (localStorage + Supabase). Se descartó por mantener dos fuentes de verdad indefinidamente.
- **Sí:** los 7 juegos sin lógica real siguen pudiendo guardar su puntuación simulada, ahora en la tabla pública `scores`. Decisión explícita del usuario — mismo comportamiento que hoy, `GamePlayer` no necesita distinguir juego real/falso para el flujo de guardado.
- **No:** restringir el guardado real solo a `rocas`. Se descartó por trabajo adicional en `GamePlayer` para un problema (leaderboard con números simulados) que ya existía de forma privada antes de este spec.
- **Sí:** `games.best`/`games.plays` siguen siendo los valores estáticos sembrados en SPEC 06, no se calculan en vivo. Decisión explícita del usuario — evita abrir un sub-problema de diseño (¿mejor histórico? ¿solo partidas reales?) dentro de un spec ya grande.
- **Sí:** "tu mejor marca" en `/salon` pasa a calcularse real (`max(score)` del usuario logueado para el juego seleccionado) en vez de la fórmula fabricada que tiene hoy. Decisión explícita del usuario — coherente con que el resto de la pantalla ya es data real.
- **Sí:** estado vacío con mensaje ("SÉ EL PRIMERO EN PUNTUAR") en vez de ocultar la sección, cuando un juego no tiene puntuaciones reales todavía. Decisión explícita del usuario.
- **Sí:** funciones de consulta compartidas en `lib/games/queries.ts`, parametrizadas por la instancia de `SupabaseClient` en vez de duplicar `.from("games").select(...)` en cada pantalla. Mantiene una sola definición de cada consulta, reutilizable tanto desde Server Components (cliente server) como desde `GamePlayer`/`HallOfFameClient` (cliente browser).
- **Sí:** remover `PLAYERS`/`seededScores` de `lib/data.ts` en vez de dejarlos sin uso. Confirmado por búsqueda en el repo que ningún archivo los importa una vez migradas estas 5 pantallas — dejarlos sería código muerto.

## Riesgos

| Riesgo                                                                                                                                                                                                                                   | Mitigación                                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La escritura abierta en `scores` (RLS de SPEC 06) ahora es alcanzable desde la UI real, no solo en teoría — cualquiera con devtools puede insertar puntuaciones arbitrarias en el leaderboard público                                    | Riesgo ya documentado y aceptado en SPEC 06 como decisión temporal; este spec no lo agrava, solo lo activa desde la UI. Se endurece cuando exista autenticación real. |
| Migrar 5 pantallas + el flujo de escritura en un solo spec aumenta la chance de dejar un caso sin cubrir (ej. podio con 1-2 filas, tab sin puntuaciones)                                                                                 | Criterios de aceptación explícitos para 0/1/2/3+ filas y para el estado vacío en cada pantalla con leaderboard.                                                       |
| `app/page.tsx`, `app/games/page.tsx` y `app/salon/page.tsx` pasan de "use client" puro a Server Component + Client Component separados — riesgo de romper hooks que dependían de ejecutarse en el árbol completo (ej. `useScrollReveal`) | El hook se queda dentro del Client Component extraído (`HomeClient`, etc.), que sigue siendo "use client"; solo el fetch de datos sube al Server Component padre.     |

## Qué **no** incluye este spec

- Autenticación real.
- Cálculo en vivo de `games.best`/`games.plays`.
- Restricción de escritura real solo a juegos con lógica real.
- Rate limiting o moderación de `scores`.
- Migración de puntuaciones existentes en `localStorage`.
- Tests automatizados.

Cada uno de estos, si se necesita, va en su propio spec futuro.
