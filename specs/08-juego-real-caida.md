# SPEC 08 — Segundo juego real: CAÍDA (Tetris)

> **Status:** Implementado
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-09-28
> **Objective:** Portar el juego de Tetris de `references/started-games/03-tetris/` a `/jugar/caida`, reemplazando su loop de puntuación falsa por el motor real, siguiendo el patrón motor/wrapper/registro que SPEC 05 estableció con `rocas`.

## Por qué existe este spec

`caida` ya tiene una entrada de catálogo con el tema correcto en Supabase (`title: "CAÍDA"`, `cat: PUZZLE`, descripción de piezas geométricas que caen y se encastran). SPEC 05 portó el primer juego real (`rocas`/Asteroids) y sentó el patrón; este es el segundo, generado con `/real-game`. A diferencia de `rocas`, Tetris no encaja 1:1 en el contrato existente: no tiene vidas, usa dos `<canvas>` (tablero + vista previa de la próxima pieza) y dibuja su HUD/overlay en el DOM en vez de en canvas. Este spec documenta cómo se resuelven esas divergencias sin romper el patrón que ya usan `GamePlayer.tsx` y el resto del catálogo.

## Scope

**In:**

- Port completo de `references/started-games/03-tetris/game.js` a `lib/games/caida/engine.ts`: tablero `10×20` (`BLOCK=30px`, canvas `300×600`), las 8 piezas (incluida la pieza "N"/tuerca), rotación en sentido horario con wall-kicks `[0,-1,1,-2,2]`, colisión (`collide`), pieza fantasma (`ghostY`), caída suave y caída dura (`softDrop`/`hardDrop`), fusión al tablero (`merge`), limpieza de líneas (`clearLines`) con `LINE_SCORES=[0,100,300,500,800] × level`, velocidad `dropInterval = max(100, 1000 - (level-1)×90)` y `level = floor(lines/10) + 1`, sin cambiar ninguno de estos valores.
- Vista previa de la próxima pieza dibujada dentro del mismo canvas principal (esquina superior derecha), no en un segundo `<canvas>`.
- `components/games/caida/CaidaGame.tsx`: wrapper React con la misma forma que `components/games/rocas/RocasGame.tsx` (monta/desmonta el motor, sincroniza `running`/`resetSignal`), con un `<canvas width={300} height={600}>`.
- Clase CSS `.caida-canvas` en `app/globals.css` con letterboxing centrado (no la copia literal de `.rocas-canvas`, ver Decisiones).
- Cambio de forma de `REAL_GAMES` (`lib/games/registry.ts`) de `Partial<Record<string, ComponentType<RealGameProps>>>` a `Partial<Record<string, { Component: ComponentType<RealGameProps>; hasLives?: boolean }>>` (`hasLives` por defecto `true` si se omite), con entrada `caida: { Component: CaidaGame, hasLives: false }` y `rocas: { Component: RocasGame }` sin cambios de comportamiento.
- `components/GamePlayer.tsx`: leer `REAL_GAMES[game.id]` como `{ Component, hasLives }`, ocultar el bloque `hud-stat lives` del HUD cuando `hasLives` es `false`.
- Controles: teclado idéntico al original (`←`/`→` mover, `↑` o `X` rotar, `↓` caída suave, `Espacio` caída dura), con `preventDefault` en esas teclas mientras `/jugar/caida` está montado.
- Actualización de la sección "Juegos reales" de `CLAUDE.md` agregando `caida` a la lista de juegos con motor real.

**Out of scope (para futuros specs):**

- Los otros 6 juegos del catálogo sin `rocas`/`caida` — siguen usando el loop de puntuación falsa.
- Segundo `<canvas>` real para la vista previa — se fusiona en el canvas principal (decisión explícita del usuario, ver Decisiones).
- Tecla `P` de pausa interna del original — se elimina; `running` (controlado por React) es la única fuente de verdad de pausa.
- Selector de tema claro/oscuro (`theme-toggle` + `localStorage['tetris-theme']`) — efecto colateral ajeno al juego, se elimina.
- Botón de reinicio en DOM (`#restart-btn`) y overlay `#overlay` de pausa/game-over — se eliminan; el modal y los botones de React ya cubren ese flujo.
- Sonido/efectos de audio — el original no los tiene.
- Cambiar el leaderboard mock/real de `/juego/caida` más allá de lo que ya hace SPEC 07.
- Generalizar `hasLives`/el letterboxing de canvas no-4:3 a un mecanismo documentado en `pattern.md` del skill `/real-game` — se deja como nota de seguimiento, no bloquea este spec.
- Tests automatizados.

## Data model

Este spec reutiliza el contrato de SPEC 05 (`lib/games/types.ts`, sin cambios) y extiende la forma de `REAL_GAMES`:

```ts
// lib/games/caida/engine.ts
export interface CaidaEngine {
  start(): void;
  setRunning(running: boolean): void;
  reset(): void;
  destroy(): void;
}

export function createCaidaEngine(
  canvas: HTMLCanvasElement,
  callbacks: Pick<
    RealGameProps,
    "onScoreChange" | "onLevelChange" | "onGameOver"
  >,
): CaidaEngine;
// Nota: no recibe onLivesChange — caída no reporta vidas.
```

```ts
// lib/games/registry.ts
export const REAL_GAMES: Partial<
  Record<
    string,
    { Component: ComponentType<RealGameProps>; hasLives?: boolean }
  >
> = {
  rocas: { Component: RocasGame }, // hasLives por defecto true
  caida: { Component: CaidaGame, hasLives: false },
};
```

## Implementation plan

1. Crear `lib/games/caida/engine.ts` portando `references/started-games/03-tetris/game.js` dentro de la factory `createCaidaEngine(canvas, callbacks)`: variables globales del original pasan a estado del closure; `document.getElementById('board')`/`'next-canvas'` se eliminan junto con el segundo canvas — la vista previa se dibuja en la esquina superior derecha del canvas principal usando el mismo `ctx`; se agregan `start()` (listeners de teclado con `preventDefault` para `ArrowLeft`/`ArrowRight`/`ArrowDown`/`ArrowUp`/`KeyX`/`Space`, `init()` y arranque del loop), `setRunning()` (cancela/reanuda `requestAnimationFrame` sin tocar el estado del tablero, resetea el acumulador de tiempo al reanudar para evitar un salto de `dropAccum`), `reset()` (reinicia como `init()` original) y `destroy()` (cancela el loop y remueve listeners); se invoca `onScoreChange`/`onLevelChange` donde el original llama `updateHUD()`; `onGameOver(score)` se dispara una sola vez dentro de `spawn()` cuando la pieza nueva colisiona de inmediato (mismo punto que `endGame()` original); se elimina `updateHUD()` (DOM), el overlay de pausa/game-over, el botón de reinicio, la tecla `P` de pausa interna y el bloque de `theme-toggle`/`localStorage`. Verificación: el archivo compila sin errores de TypeScript.
2. Crear `components/games/caida/CaidaGame.tsx` con la misma forma que `RocasGame.tsx` (efecto de montaje único que crea y arranca el motor devolviendo `destroy` como cleanup, efecto que sincroniza `running`, efecto que sincroniza `resetSignal` ignorando el primer montaje), `<canvas width={300} height={600} className="caida-canvas">`, sin pasar `onLivesChange` (el tipo `Pick<...>` del motor no lo pide). Verificación: compila sin errores de TypeScript.
3. Agregar en `app/globals.css`, junto a `.rocas-canvas`, la clase `.caida-canvas` con letterboxing centrado dentro de `.crt-screen` (que es `aspect-ratio: 4/3`): `position: absolute; inset: 0; margin: auto; display: block; width: auto; height: auto; max-width: 100%; max-height: 100%;` — a diferencia de `.rocas-canvas` (que usa `width/height: 100%` porque 800×600 ya es 4:3), esto evita estirar/distorsionar el tablero angosto de 300×600. Verificación: revisión visual en `/jugar/caida`, el tablero se ve completo, centrado, sin distorsión ni recortes.
4. Actualizar juntos `lib/games/registry.ts` y `components/GamePlayer.tsx` (cambio de forma acoplado, no puede dividirse sin romper el build): cambiar `REAL_GAMES` a `Partial<Record<string, { Component: ComponentType<RealGameProps>; hasLives?: boolean }>>`, agregar `caida: { Component: CaidaGame, hasLives: false }`, dejar `rocas: { Component: RocasGame }`; en `GamePlayer.tsx`, leer `const realEntry = REAL_GAMES[game.id]; const RealGame = realEntry?.Component; const showLives = realEntry?.hasLives ?? true;` y envolver el bloque `<div className="hud-stat lives">...</div>` en `{showLives && (...)}`. Verificación: `npm run build` compila sin errores; `/jugar/rocas` sigue mostrando el campo "Vidas" (comportamiento sin cambios); `/jugar/caida` no lo muestra.
5. Actualizar la sección "Juegos reales" de `CLAUDE.md`, agregando `caida` a la lista de juegos con motor real y mencionando el mecanismo `hasLives` de `REAL_GAMES`. Verificación: revisión manual del texto.
6. Revisión final: jugar una partida completa en `/jugar/caida` de principio a fin (mover piezas, rotar con wall-kick, caída suave y dura, limpiar 1/2/3/4 líneas de una vez y verificar el puntaje `LINE_SCORES × level`, subir de nivel cada 10 líneas y notar el aumento de velocidad, ver la vista previa de la próxima pieza en la esquina del canvas); confirmar que al perder (pieza nueva sin espacio) se abre el modal "FIN DEL JUEGO" con la puntuación real y sin el campo "Vidas"; probar "PAUSA"/"REANUDAR" (sin salto de velocidad de caída al reanudar) y el botón "FIN"; guardar la puntuación y confirmar que persiste en Supabase (`scores`, `game_id: "caida"`) y aparece en `/juego/caida` y `/salon`; "JUGAR DE NUEVO" reinicia tablero/puntaje/nivel; salir y reentrar a `/jugar/caida` sin fuga de listeners ni doble input; navegar a `/jugar/rocas` y a un juego sin motor real (ej. `/jugar/bloque-buster`) y confirmar que ninguno cambió de comportamiento; sin errores en la consola del navegador.

## Acceptance criteria

- [x] `npm run dev` levanta la app sin errores en la consola del navegador ni del servidor.
- [x] `/jugar/caida` muestra el canvas real de Tetris (300×600, letterboxed sin distorsión dentro del marco CRT) en vez del loop de puntuación falsa.
- [x] `←`/`→` mueven la pieza, `↑`/`X` rotan con wall-kick, `↓` hace caída suave (+1 punto/fila), `Espacio` hace caída dura (+2 puntos/celda) — igual que el original.
- [x] Pulsar esas teclas mientras se juega no produce scroll de la página.
- [x] El HUD de React (puntuación, nivel) se actualiza en tiempo real; el campo "Vidas" no se muestra para este juego.
- [x] La vista previa de la próxima pieza se ve dentro del mismo canvas, sin un segundo `<canvas>`.
- [x] Limpiar 1/2/3/4 líneas a la vez otorga `LINE_SCORES=[0,100,300,500,800] × level` puntos, igual que el original.
- [x] El nivel sube cada 10 líneas limpiadas (`floor(lines/10)+1`) y la velocidad de caída aumenta según `dropInterval = max(100, 1000-(level-1)×90)`.
- [x] Que una pieza nueva no tenga espacio para aparecer dispara `onGameOver(score)` y abre automáticamente el modal "FIN DEL JUEGO" con la puntuación real.
- [x] El botón "PAUSA" detiene el motor (sin auto-caída ni animación); "REANUDAR" lo retoma sin un salto brusco de velocidad de caída.
- [x] El botón "FIN" detiene el motor y abre el modal de fin de partida con la puntuación acumulada, sin tratarlo como derrota.
- [x] Guardar la puntuación en el modal la persiste en Supabase (`scores`, `game_id: "caida"`) y aparece luego en `/juego/caida` y `/salon` al recargar.
- [x] "JUGAR DE NUEVO" reinicia completamente el motor: tablero vacío, puntuación en 0, nivel 1.
- [x] Salir del reproductor (botón "SALIR" o navegación a otra ruta) detiene el loop del motor y remueve sus listeners de teclado — sin fuga de listeners ni doble input al reentrar a `/jugar/caida`.
- [x] `/jugar/rocas` sigue mostrando el campo "Vidas" y funcionando sin cambios de comportamiento.
- [x] Los juegos del catálogo sin motor real registrado siguen usando el loop de puntuación falsa sin cambios.
- [x] `/juego/caida` (detalle + leaderboard) no cambia salvo lo ya cubierto por SPEC 07.
- [x] `npm run lint` no reporta errores nuevos.
- [x] `npm run build` completa sin errores.

## Decisiones

- **Sí:** reutilizar el `id: "caida"` ya existente en la tabla `games` de Supabase — coincide temáticamente con Tetris (piezas que caen, se encastran, limpian líneas). Decisión explícita del usuario al invocar `/real-game caida references/started-games/03-tetris`.
- **Sí:** ocultar el campo "Vidas" del HUD para `caida` en vez de mostrar un valor fijo. Decisión explícita del usuario — evita mostrar un dato falso ("3 vidas" que nunca baja). Implica extender `REAL_GAMES` con un flag `hasLives` opcional (por defecto `true`), tocando `GamePlayer.tsx` de forma genérica y reutilizable por futuros juegos sin vidas, no con un `if (game.id === "caida")` hardcodeado.
- **No:** invocar `onLivesChange(1)` una sola vez para simular una vida fija. Se descartó por mostrar información que no refleja ningún estado real del juego.
- **Sí:** fusionar la vista previa de la próxima pieza dentro del mismo canvas principal (esquina superior derecha), en vez de agregar un segundo `<canvas>` al wrapper o de omitir la función. Decisión explícita del usuario — mantiene el contrato actual de "un solo canvas" por wrapper sin perder una mecánica real del juego original.
- **No:** extender el wrapper (`CaidaGame.tsx`/patrón general) para soportar un segundo `<canvas>` opcional. Se descartó por ser un cambio transversal al patrón que hoy asumen todos los wrappers de juegos reales, innecesario cuando fusionar la vista previa alcanza.
- **Sí:** usar la resolución nativa del tablero original, 300×600, en vez de forzar 800×600 como `rocas`. Decisión explícita del usuario — preserva las coordenadas/física originales (`BLOCK=30px`, `COLS=10`, `ROWS=20`) sin tener que reescribir colisiones con un offset de centrado.
- **No:** extender el canvas a 800×600 con el tablero centrado y márgenes vacíos. Requería reescribir todas las coordenadas de dibujo con un offset, sin ningún beneficio funcional.
- **Sí:** como consecuencia directa de usar 300×600 (aspecto 1:2) dentro de `.crt-screen` (aspecto 4:3 fijo), `.caida-canvas` usa letterboxing centrado (`width/height: auto; max-width/max-height: 100%; margin: auto;`) en vez de copiar literal `width/height: 100%` de `.rocas-canvas`. Decisión técnica derivada de la elección de tamaño nativo, no una pregunta nueva — la alternativa (estirar el canvas a 100%/100%) distorsionaría visiblemente el tablero.
- **Sí:** eliminar la tecla `P` de pausa interna del motor original. Decisión por defecto de la política de simplificación del skill — `running` (controlado por el botón "PAUSA"/"REANUDAR" de React) ya es la única fuente de verdad de pausa; mantener `P` como atajo interno del motor crearía dos mecanismos de pausa desincronizados.
- **Sí:** eliminar el `theme-toggle`/`localStorage['tetris-theme']` del original. Decisión por defecto — es un efecto colateral de DOM/`localStorage` ajeno al juego; el motor no debe tocar nada fuera del `canvas` que recibe.
- **Sí:** eliminar el overlay `#overlay` (pausa/game-over) y el botón `#restart-btn` del DOM original. Mismo criterio que SPEC 05 usó para borrar `drawHUD`/`drawOverlay` de `rocas` — el HUD y los modales de React son la única fuente visible, evita una segunda fuente de verdad.
- **No:** portar sonido o assets de imagen. El original de Tetris no tiene ninguno — no aplica la política de simplificación de assets, no hay nada que simplificar.

## Riesgos

| Riesgo                                                                                                                                                                                 | Mitigación                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Un futuro juego real sin vidas podría olvidarse de pasar `hasLives: false` en `REAL_GAMES` (el default es `true`) y mostraría un campo "Vidas" falso en el HUD                         | Documentar el mecanismo `hasLives` en `pattern.md` del skill `/real-game` como seguimiento de este spec (fuera de su alcance formal, ver Scope), para que futuros ports lo tengan presente.      |
| El letterboxing de `.caida-canvas` dentro de `.crt-screen` (4:3 fijo) puede dejar el tablero visualmente pequeño en pantallas muy angostas, a diferencia de `rocas` que llena el frame | Es un compromiso aceptado explícitamente junto con la decisión de usar resolución nativa 300×600; `max-height: 100%` asegura que el tablero siempre ocupe el alto completo disponible del frame. |
| Cancelar y reanudar el loop en `setRunning()` puede dejar `dropAccum` con un valor grande acumulado antes de la pausa, provocando una caída inmediata al reanudar                      | El motor debe resetear `dropAccum = 0` (no solo `lastTime`) al reanudar, igual que `lastTime = null` en `rocas`, para que el primer frame post-pausa no cuente el tiempo pausado.                |

## Qué **no** incluye este spec

- Lógica de juego real para los otros 6 juegos del catálogo restantes.
- Un segundo `<canvas>` real para la vista previa de la próxima pieza.
- La tecla `P` de pausa interna, el selector de tema, el overlay/botón de reinicio en DOM del original.
- Sonido o efectos de audio.
- Cambios al leaderboard de `/juego/caida` más allá de lo ya conectado en SPEC 07.
- Generalizar el mecanismo `hasLives` o el letterboxing no-4:3 dentro de `pattern.md` del skill `/real-game` (queda como nota de seguimiento).
- Tests automatizados.

Cada uno de estos, si se necesita, va en su propio spec futuro.
