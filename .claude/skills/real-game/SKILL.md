---
name: real-game
description: Porta o crea el motor real (canvas) de un juego del catálogo e intégralo con el leaderboard de Supabase, siguiendo el patrón motor/wrapper/registro de SPEC 05 y el flujo ya conectado de SPEC 06/07. Genera su propio spec en specs/NN-slug.md (mismo formato que /spec) antes de implementar. Úsalo cuando un juego del catálogo deba dejar el loop de puntuación falsa por lógica real.
disable-model-invocation: true
argument-hint: '<id-de-catalogo> [ruta en references/started-games/NN-nombre | "desde cero"]'
allowed-tools: Read, Glob, Grep, Write, Edit, AskUserQuestion, Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(ls:*), Bash(npm run lint:*), Bash(npm run build:*), mcp__supabase__execute_sql, mcp__supabase__list_tables
---

# /real-game — Portar o crear el motor real de un juego del catálogo

## Contexto de sesión

Estado del repositorio:
!`git status --short`

Rama actual:
!`git branch --show-current`

Juegos que ya tienen motor real (`REAL_GAMES`):
!`cat lib/games/registry.ts 2>/dev/null || echo "lib/games/registry.ts no existe todavía"`

Juegos de referencia disponibles en references/started-games/:
!`ls references/started-games/ 2>/dev/null || echo "references/started-games/ no existe"`

---

Este skill repite, para cualquier juego del catálogo, el patrón que SPEC 05 estableció con `rocas`/Asteroids: un motor framework-agnostic (`lib/games/<id>/engine.ts`), un wrapper de React (`components/games/<id>/<Nombre>Game.tsx`) y una entrada en `lib/games/registry.ts`. SPEC 06 y 07 ya conectaron el resto del flujo (catálogo y leaderboard en Supabase) de forma completamente genérica — `GamePlayer.tsx`, `lib/games/queries.ts`, las rutas `/juego/[id]` y `/jugar/[id]`, y los `error.tsx` no cambian por juego nuevo.

Lee `pattern.md` (en el mismo directorio que este archivo) antes de escribir ningún código — contiene el contrato exacto (`RealGameProps`), el esqueleto exacto del motor y del wrapper, y la tabla de divergencias ya relevada entre los juegos de `references/started-games/` y el patrón canónico.

Además, antes de crear el archivo de especificaciones en `specs/`, lee `.claude/skills/spec/SKILL.md` y `.claude/skills/spec/template.md` — son la skill y la plantilla que ya usa el proyecto para escribir specs, y este skill reutiliza esa misma estructura y convenciones en vez de inventar un formato propio.

## Filosofía

Este skill no diseña catálogo ni reabre decisiones de arquitectura ya tomadas en SPEC 05/06/07 — las hereda. Su trabajo es: identificar qué `id` de catálogo recibe motor real, decidir con el usuario cómo resolver las divergencias de género (vidas, niveles, canvases, controles, assets) contra el contrato ya fijo, dejar esas decisiones asentadas en un spec propio (siguiendo el formato de `/spec`) y ejecutar el port archivo por archivo con pausas para revisar cada diff — mismo ritmo que `/spec-impl`.

Tus respuestas deben estar en el mismo idioma que el prompt inicial. Ej.: si el prompt inicial está en español, respondé en español.

## Flujo del comando

### Fase 0 — Identificar destino y fuente

1. `$ARGUMENTS` trae `<id-de-catalogo>` como primer token, y opcionalmente una ruta bajo `references/started-games/` o el literal `"desde cero"` como segundo. Si falta el `id`, pedirlo antes de continuar.
2. Verificar con `mcp__supabase__execute_sql` que el `id` exista en `games`:
   ```sql
   select id, title, cat, color from games where id = '<id>';
   ```
   Si no devuelve fila: **detenerse**. Este skill no da de alta juegos nuevos en el catálogo — decisión explícita del usuario. Mostrar:
   ```
   ❌ "<id>" no existe en la tabla `games` de Supabase.
   Este skill solo conecta un motor real a un id de catálogo ya existente.
   Para dar de alta un juego nuevo hace falta un spec/migración aparte
   (mismo patrón que SPEC 06) antes de poder usar /real-game con ese id.
   ```
3. Revisar `lib/games/registry.ts` (ya cargado en el contexto de sesión arriba). Si `<id>` ya está en `REAL_GAMES`, detenerse y preguntar si el usuario quiere re-portar/reemplazar el motor existente — es un caso distinto, con más riesgo, no asumir que sí.
4. Resolver la fuente:
   - Si se pasó una ruta: confirmar que existe bajo `references/started-games/` y leer **todos** sus archivos relevantes (`game.js` y cualquier módulo que importe: `levels.js`, `assets/*`, `index.html` para ver qué IDs de DOM/canvas usa).
   - Si se pasó `"desde cero"` o no se pasó ruta: no hay fuente — la mecánica se define en la Fase 1 por descripción del usuario.

### Fase 1 — Analizar y aclarar

Con la fuente leída (o la descripción del usuario si es "desde cero"), contrastar contra el contrato canónico de `pattern.md` y detectar divergencias. Para cada una que la política de simplificación por defecto no resuelva sola, preguntar con `AskUserQuestion` en bloques de 3 a 5, marcando la opción recomendada:

- **¿El juego tiene vidas?** Si no (p. ej. un juego tipo Tetris), la opción por defecto es no invocar `onLivesChange` y confirmar con el usuario si el HUD debe mostrar el campo "Vidas" igual (con un valor fijo) o si preferís ocultarlo para ese juego — esto es un cambio a `GamePlayer.tsx`, que hoy asume que todo juego real reporta vidas, así que confirmarlo explícitamente antes de tocar ese archivo compartido.
- **¿Tiene un estado "completado"/"victoria"** además de "game over" (p. ej. niveles finitos)? Por defecto se enruta por `onGameOver(score)` igual que una derrota, sin texto especial — confirmar.
- **¿Usa más de un `<canvas>`** (p. ej. una vista previa de la próxima pieza)? El wrapper actual (`RocasGame.tsx`) monta un solo `<canvas>`. Por defecto, fusionar esa información dentro del mismo canvas principal (dibujarla en una esquina) — confirmar o preguntar si se omite.
- **¿Tiene controles de mouse/click sobre el canvas** además o en vez de teclado? Si sí, los listeners van sobre el `HTMLCanvasElement` recibido por la factory (no sobre `window`), agregados en `start()` y removidos en `destroy()`, igual que los de teclado.
- **¿Tiene assets externos (imágenes, audio)?** Por defecto (política ya acordada): simplificar — reemplazar sprites por primitivas de canvas con la paleta neón del proyecto (variables `--cyan`/`--magenta`/`--green`/`--yellow` de `app/globals.css`) y omitir audio. Un port fiel con los assets originales (copiados a `public/games/<id>/`) solo si el usuario lo pide explícitamente en esta fase.
- **¿Tiene efectos colaterales de DOM/localStorage ajenos al juego** (p. ej. un selector de tema)? Se eliminan siempre — el motor no debe tocar nada fuera del `canvas` que recibe.

Si es "desde cero": en vez de analizar una fuente, preguntar mecánica, controles, condición de derrota/victoria y cómo se otorgan los puntos, con las mismas categorías de arriba.

No avanzar a la Fase 2 hasta tener respuesta a cada divergencia detectada.

### Fase 2 — Generar el spec

Antes de escribir nada en `specs/`, leer `.claude/skills/spec/SKILL.md` y `.claude/skills/spec/template.md` completos y usarlos como referencia de estructura y convenciones (header con Status/Depends on/Date/Objective, Scope In/Out, Data model, Implementation plan, Acceptance criteria, Decisiones, Riesgos, cierre "Qué no incluye"). No reinventar el formato.

1. Determinar el siguiente número secuencial en `specs/` (mismo criterio que `/spec`: tomar el mayor número existente en `ls specs/` y sumar uno, con dos dígitos).
2. Generar un slug kebab-case corto a partir del `id` de catálogo y la fuente (ej. `08-juego-real-caida`).
3. Escribir `specs/NN-slug.md` con el contenido ya decidido en la Fase 0 y la Fase 1:
   - **Header:** `Status: Aprobado` (la ronda de preguntas de la Fase 1 ya cumplió el rol de validación que en `/spec` haría un usuario revisando un `Draft` — este skill no genera specs en borrador para revisión posterior), `Depends on` apuntando a SPEC 05/06/07, `Date` de hoy, `Objective` en una sola frase.
   - **Scope:** "In" con el motor/wrapper/registro a crear; "Out of scope" con lo que la Fase 1 decidió simplificar u omitir (assets, canvas extra, menú de pausa, etc.).
   - **Data model:** la forma de `<Nombre>Engine`/`create<Nombre>Engine` (ver `pattern.md`).
   - **Implementation plan:** la lista concreta de archivos, en el mismo orden en que se van a implementar en la Fase 3:
     1. `lib/games/<id>/engine.ts` — `create<Nombre>Engine(canvas, callbacks): <Nombre>Engine` con `{ start, setRunning, reset, destroy }`, siguiendo el esqueleto de `pattern.md`.
     2. `components/games/<id>/<Nombre>Game.tsx` — wrapper con la misma forma que `RocasGame.tsx`.
     3. Clase CSS `.<id>-canvas` en `app/globals.css`, junto al resto de las reglas `.rocas-canvas`/`.cover-*` (mismo bloque: `position: absolute; inset: 0; display: block; width: 100%; height: 100%;`).
     4. Una línea nueva en `REAL_GAMES` (`lib/games/registry.ts`).
     5. Solo si la Fase 1 pidió fidelidad con assets (excepción): copiarlos a `public/games/<id>/` y referenciarlos desde el motor.
     6. Confirmar explícitamente que `GamePlayer.tsx`, `lib/games/queries.ts`, `lib/supabase/*` y las rutas `app/juego/[id]`/`app/jugar/[id]` no cambian — salvo que la Fase 1 haya decidido que `GamePlayer.tsx` necesita soportar un juego sin vidas, en cuyo caso ese cambio se suma acá explícitamente.
     7. Actualizar la sección "Juegos reales" de `CLAUDE.md`, agregando `<id>` a la lista de juegos con motor real.
   - **Acceptance criteria:** el checklist de la Fase 4 (ver abajo), en formato booleano `- [ ]`.
   - **Decisiones:** cada divergencia detectada en la Fase 1 con su resolución ("Sí"/"No" + motivo), igual que hacen SPEC 05/06/07.
   - **Riesgos:** solo si aplica (p. ej. simplificar assets pierde fidelidad visual respecto al original).
4. Mostrar el spec recién escrito y esperar confirmación explícita del usuario antes de pasar a la Fase 3. Si el usuario pide cambios, editarlo y volver a mostrarlo — no avanzar a implementar con un spec que el usuario todavía no confirmó.

### Fase 3 — Implementar paso a paso

Seguir el "Implementation plan" del spec generado en la Fase 2, un archivo a la vez. Después de cada uno: mostrar el diff (`git diff` o el contenido si es archivo nuevo) y preguntar "¿Reviso el diff y seguimos con el paso N+1?". Esperar confirmación antes de continuar.

Reglas:

- Nunca commitear — eso lo decide el usuario.
- Implementar exactamente lo acordado en el spec; si algo parece subóptimo durante la implementación, mencionarlo como observación pero no improvisar un cambio de alcance (un cambio de alcance real implica editar el spec primero, no improvisar en el código).
- Ante cualquier ambigüedad no cubierta por el spec, detenerse, describirla con precisión, ofrecer 2-3 opciones concretas y esperar la decisión del usuario.

### Fase 4 — Verificación final

Recorrer los "Acceptance criteria" del spec generado en la Fase 2 (adaptados de los criterios de aceptación de SPEC 05) y reportar el resultado de cada ítem:

- [ ] Las teclas/controles usados no producen scroll de la página.
- [ ] El HUD de React (`player-hud`) es la única fuente de verdad visible — no hay HUD ni overlay de pausa/game-over duplicado dibujado en el canvas.
- [ ] Perder (o completar el juego, si aplica) dispara `onGameOver(score)` y abre el modal "FIN DEL JUEGO" con la puntuación real.
- [ ] "PAUSA"/"REANUDAR" detiene y retoma sin saltos de `dt` (el motor resetea `lastTime` a `null` al reanudar).
- [ ] El botón "FIN" detiene el motor y abre el modal sin contarlo como derrota.
- [ ] Guardar la puntuación inserta una fila real en `scores` (verificable con `mcp__supabase__execute_sql`) y aparece luego en `/juego/<id>` y `/salon` al recargar.
- [ ] "JUGAR DE NUEVO" reinicia el motor por completo (`reset()`), no solo el estado de React.
- [ ] Salir del reproductor (o navegar a otra ruta) llama a `destroy()`: sin fuga de listeners ni doble input al reentrar.
- [ ] El resto del catálogo (juegos sin motor real registrado) sigue usando el loop de puntuación falsa sin cambios.
- [ ] `npm run lint` no reporta errores nuevos.
- [ ] `npm run build` completa sin errores.

Cuando todos los criterios pasen, marcar cada casillero del spec como `[x]` y actualizar su `Status` de `Aprobado` a `Implementado` (mismo estado final que usan SPEC 05/06/07) — es la última edición de la Fase 4, antes de cerrar.

## Reglas duras

- Nunca escribir el archivo en `specs/` sin haber leído antes `.claude/skills/spec/SKILL.md` y `.claude/skills/spec/template.md` en esa misma ejecución — no improvisar una estructura de spec distinta a la que ya usa el proyecto.
- Nunca dar de alta un `id` nuevo en la tabla `games` — si no existe, detenerse en la Fase 0.
- Nunca modificar `GamePlayer.tsx`, `lib/games/queries.ts`, `lib/supabase/*` o las rutas dinámicas salvo que la Fase 1 haya identificado explícitamente que hace falta (p. ej. soporte para un juego sin vidas) y el usuario lo haya confirmado.
- Nunca empezar la Fase 3 sin que el usuario haya confirmado el spec escrito en la Fase 2.
- Nunca commitear ni saltar la pausa de revisión entre pasos de la Fase 3.
- Nunca incorporar sonido/sprites de imagen por defecto — solo si el usuario lo pide explícitamente en la Fase 1.

## Argumentos

`$ARGUMENTS` = `<id-de-catalogo> [ruta-en-references/started-games | "desde cero"]`. El `id` es obligatorio; la fuente es opcional (sin ella, se asume "desde cero" y se pregunta la mecánica en la Fase 1).
