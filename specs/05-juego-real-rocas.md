# SPEC 05 — Primer juego real: ROCAS (Asteroids)

> **Status:** Implementado
> **Depends on:** (ninguno)
> **Date:** 2026-09-22
> **Objective:** Portar el juego de Asteroids ya construido en `references/started-games/02-asteroids/` a `/jugar/rocas`, reemplazando su reproductor de puntuación falsa por el motor real, e integrarlo con el HUD, pausa, fin de partida y guardado de puntuación que ya existen.

## Por qué existe este spec

SPEC 01 dejó explícitamente fuera de alcance la lógica de juego real para los 8 juegos del catálogo — `/jugar/[id]` solo simula puntuación con un `setInterval`. Ahora existe un juego de Asteroids completo y funcional en `references/started-games/02-asteroids/` (canvas HTML5 puro, sin dependencias) que hay que adaptar a esta plataforma. Este es el primer juego real que entra al proyecto, así que el spec también decide el patrón de integración (motor de juego + wrapper React + registro por `id`) que los specs futuros de los otros 7 juegos reutilizarán.

`lib/data.ts` ya tiene una entrada de catálogo con el tema correcto: `id: "rocas"` ("Pulveriza asteroides en gravedad cero"). Este spec conecta el motor real a esa entrada existente, sin tocar las otras 7.

## Scope

**In:**

- Port completo de `references/started-games/02-asteroids/game.js` (clases `Bullet`, `Asteroid`, `PowerUp`, `Ship`, `Particle`, física, colisiones, división de asteroides, power-up de disparo triple, partículas de explosión, envolvimiento toroidal) a `lib/games/rocas/engine.ts`, sin cambiar reglas de juego ni valores (puntos, velocidades, radios, tiempos de invencibilidad).
- `lib/games/types.ts` con el contrato `RealGameProps` que usará este y los futuros juegos reales (props `running`, `resetSignal`, callbacks `onScoreChange`/`onLivesChange`/`onLevelChange`/`onGameOver`).
- `components/games/rocas/RocasGame.tsx`: wrapper React con el `<canvas>` (800×600), monta/desmonta el motor y sincroniza `running`/`resetSignal`.
- `lib/games/registry.ts`: mapa `{ [gameId]: ComponentType<RealGameProps> }` con la entrada `rocas`, usado por `GamePlayer.tsx` para decidir si monta el juego real o el loop falso actual.
- `components/GamePlayer.tsx` actualizado: cuando `game.id` está en el registro, monta el componente real dentro del marco CRT (reemplazando las divs decorativas `.game-arena`/`.enemy`/`.player-ship` solo para ese juego) y conecta el motor con el HUD, pausa, botón "FIN", modal de fin de partida y `addScore` que ya existen. Para el resto de los juegos, el comportamiento actual no cambia.
- Controles: teclado idéntico al original (`←`/`→` rotar, `↑` propulsar, `Espacio` disparar), agregando `preventDefault` en esas teclas mientras `/jugar/rocas` está montado, para que no hagan scroll de la página.
- Actualización puntual de la nota en `CLAUDE.md` sobre "no hay lógica de juego real para ninguno de los 8 juegos", reflejando que `rocas` ya es una excepción.

**Out of scope (para futuros specs):**

- Los otros 7 juegos del catálogo — siguen usando el loop de puntuación falsa sin cambios; se portan en specs futuros, uno a la vez, reutilizando el mismo patrón de motor + registro que este spec introduce.
- Controles táctiles/on-screen — el original es solo teclado, no se agrega nada nuevo.
- Hacer el motor responsive a distintos tamaños de contenedor — el canvas queda fijo en 800×600 (igual que el original) y se escala visualmente por CSS dentro del marco CRT.
- Cambiar el leaderboard mock de `/juego/rocas` (`seededScores`) — sigue siendo mock, no se deriva de partidas reales jugadas.
- Sonido/efectos de audio — el original no los tiene, no se agregan.
- Cualquier persistencia más allá del `addScore` que ya existe (replays, estadísticas históricas, ranking por sesión).
- Tests automatizados.

## Data model

Este spec no introduce datos nuevos en `lib/data.ts` (reutiliza la entrada `rocas` existente). Introduce el contrato de integración motor-UI:

```ts
// lib/games/types.ts
export interface RealGameProps {
  running: boolean; // false → el motor debe pausar/no arrancar
  resetSignal: number; // se incrementa para forzar reset() del motor
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}
```

```ts
// lib/games/rocas/engine.ts
export interface RocasEngine {
  start(): void;
  setRunning(running: boolean): void;
  reset(): void;
  destroy(): void;
}

export function createRocasEngine(
  canvas: HTMLCanvasElement,
  callbacks: Pick<
    RealGameProps,
    "onScoreChange" | "onLivesChange" | "onLevelChange" | "onGameOver"
  >,
): RocasEngine;
```

```ts
// lib/games/registry.ts
export const REAL_GAMES: Partial<Record<string, ComponentType<RealGameProps>>>;
```

## Implementation plan

1. Crear `lib/games/types.ts` con la interfaz `RealGameProps` de arriba. Verificación: compila sin errores de TypeScript.
2. Crear `lib/games/rocas/engine.ts` portando `references/started-games/02-asteroids/game.js` completo dentro de la factory `createRocasEngine(canvas, callbacks)`: las variables globales del original pasan a ser estado interno del closure; `document.getElementById('canvas')` se sustituye por el `canvas` recibido como parámetro; se agregan `start()` (agrega los listeners de teclado con `preventDefault` para `ArrowLeft`/`ArrowRight`/`ArrowUp`/`Space`, inicializa el juego y arranca el loop `requestAnimationFrame`), `setRunning(running)` (cancela/reanuda el loop sin tocar el estado del juego), `reset()` (reinicia el juego como el `initGame()` original) y `destroy()` (cancela el loop y remueve los listeners); se invoca `onScoreChange`/`onLivesChange`/`onLevelChange` en los puntos donde esos valores cambian (impacto de bala, `killShip`, `nextLevel`, `initGame`/`reset`) y `onGameOver(score)` dentro de `killShip` cuando `lives` llega a 0; se elimina `drawHUD`, `drawOverlay` y el reinicio con `Espacio` en el estado `'gameover'` (ese reinicio ahora lo dispara `reset()` desde React); se elimina el auto-arranque de nivel de módulo (`initGame(); requestAnimationFrame(loop);`), que pasa a ejecutarse dentro de `start()`. Verificación: el archivo compila sin errores de TypeScript.
3. Crear `components/games/rocas/RocasGame.tsx`: Client Component con un `<canvas width={800} height={600}>` referenciado por `ref`; en un `useEffect` que corre una sola vez al montar, crea el motor con `createRocasEngine` y lo arranca con `start()`, retornando `destroy()` como limpieza; un segundo `useEffect` sincroniza la prop `running` con `setRunning()`; un tercer `useEffect` sobre `resetSignal` (ignorando el valor inicial del montaje) llama a `reset()`. Verificación: el archivo compila sin errores de TypeScript.
4. Crear `lib/games/registry.ts` con `REAL_GAMES = { rocas: RocasGame }`. Verificación: compila sin errores.
5. Actualizar `components/GamePlayer.tsx`: buscar `REAL_GAMES[game.id]`; agregar estado `lives`, `levelReal` y `resetSignal`; cuando existe un juego real, renderizarlo dentro de `.crt-screen` (en vez de las divs `.game-arena` decorativas) pasando `running={!paused && !over}`, `resetSignal`, `onScoreChange={setScore}`, `onLivesChange={setLives}`, `onLevelChange={setLevelReal}` y `onGameOver={() => setOver(true)}`; desactivar el `setInterval` de puntuación falsa cuando hay un juego real montado; en `restart()`, además de lo que ya resetea, incrementar `resetSignal` y reiniciar `lives`/`levelReal`; el HUD usa `lives`/`levelReal` cuando hay juego real, o el valor constante `3`/la fórmula derivada actual para el resto. Verificación: `/jugar/rocas` muestra el canvas real jugable dentro del marco CRT; `/jugar/[otro-id]` (ej. `/jugar/pixel-devorador`) sigue mostrando exactamente el loop falso de antes.
6. Actualizar la línea correspondiente de `CLAUDE.md` (sección "Rutas") para reflejar que `rocas` ya tiene lógica de juego real portada desde `references/started-games/02-asteroids/`, mientras los otros 7 juegos siguen sin ella. Verificación: revisión manual del texto.
7. Revisión final: jugar una partida completa en `/jugar/rocas` de principio a fin (moverse, disparar, romper asteroides grandes/medianos/pequeños, subir de nivel al limpiar el campo, recoger el power-up de disparo triple, perder las 3 vidas), confirmar que el modal de fin de partida muestra la puntuación real y que "GUARDAR PUNTUACIÓN" la persiste en `localStorage` bajo `game: "rocas"`; probar "PAUSA"/"REANUDAR", el botón "FIN" a mitad de partida, y "JUGAR DE NUEVO"; navegar a otro juego del catálogo y confirmar que su reproductor sigue funcionando como antes, sin errores en la consola del navegador.

## Acceptance criteria

- [x] `npm run dev` levanta la app sin errores en la consola del navegador ni del servidor.
- [x] `/jugar/rocas` muestra el canvas real de Asteroids (800×600, escalado dentro del marco CRT existente) en vez de las divs decorativas de enemigos/nave.
- [x] `←`/`→` rotan la nave, `↑` propulsa (con llama visible), `Espacio` dispara — igual que `references/started-games/02-asteroids/game.js`.
- [x] Pulsar esas teclas mientras se juega no produce scroll de la página.
- [x] El HUD de React (puntuación, vidas, nivel) se actualiza en tiempo real reflejando el estado del motor; no hay un HUD duplicado dibujado sobre el canvas.
- [x] Destruir un asteroide grande lo divide en 2 medianos y un mediano en 2 pequeños; uno pequeño desaparece sin dividirse. Los puntos otorgados siguen la tabla original (grande 20, mediano 50, pequeño 100).
- [x] Recoger el power-up de disparo triple habilita disparo en abanico durante su duración, igual que el original.
- [x] Colisionar la nave con un asteroide sin invencibilidad activa resta una vida, hace explotar la nave, y la reaparición tiene invencibilidad temporal con parpadeo.
- [x] Perder las 3 vidas abre automáticamente el modal "FIN DEL JUEGO" con la puntuación real acumulada.
- [x] El botón "PAUSA" detiene el movimiento y la física del juego; "REANUDAR" lo retoma sin saltos bruscos de posición ni de tiempo.
- [x] El botón "FIN" detiene el motor y abre el modal de fin de partida con la puntuación acumulada hasta ese momento, sin tratarlo como una pérdida de vida.
- [x] Guardar la puntuación en el modal la persiste en `localStorage` (`av_scores`) con `game: "rocas"`, igual que los demás juegos.
- [x] "JUGAR DE NUEVO" reinicia completamente el motor: nueva nave, nuevos asteroides, puntuación en 0, 3 vidas, nivel 1.
- [x] Salir del reproductor (botón "SALIR" o navegación a otra ruta) detiene el loop del motor y remueve sus listeners de teclado — no hay fuga de listeners ni doble input al volver a entrar a `/jugar/rocas`.
- [x] Los otros 7 juegos del catálogo siguen usando el loop de puntuación falsa sin cambios de comportamiento.
- [x] `/juego/rocas` (detalle + leaderboard mock) no cambia.
- [x] `npm run lint` no reporta errores nuevos.
- [x] `npm run build` completa sin errores.

## Decisiones

- **Sí:** reutilizar el `id: "rocas"` ya existente en `lib/data.ts` en vez de crear una entrada nueva. Decisión explícita del usuario — el tema y el copy ya coinciden con Asteroids.
- **No:** crear un `id` nuevo (ej. `"asteroides"`) dejando `rocas` con su reproductor falso. Hubiera duplicado innecesariamente el catálogo.
- **Sí:** separar el motor (`lib/games/rocas/engine.ts`, lógica pura framework-agnostic con `start`/`setRunning`/`reset`/`destroy`) del wrapper React (`components/games/rocas/RocasGame.tsx`). Decisión explícita del usuario — sienta el patrón que reutilizarán los specs futuros de los otros 7 juegos, aunque implique más trabajo de refactor ahora que portar el script tal cual dentro de un componente.
- **No:** un componente React único autocontenido con toda la lógica adentro. Más rápido para este juego, pero cada juego futuro reinventaría su propia forma de organizarse.
- **Sí:** `lib/games/registry.ts` como mapa `id → componente` que `GamePlayer.tsx` consulta, con fallback al loop falso actual si el `id` no está registrado. Decisión explícita del usuario — escala sin acumular condicionales en `GamePlayer.tsx` a medida que se agreguen más juegos reales.
- **No:** un `if (game.id === "rocas")` hardcodeado dentro de `GamePlayer.tsx`. Igual de válido para un solo juego, pero no es el patrón que se quiere mantener a futuro.
- **Sí:** React (el `player-hud` existente) como única fuente de verdad de puntuación/vidas/nivel durante el juego; el canvas solo dibuja el campo de juego. Decisión explícita del usuario — se elimina el `drawHUD`/`drawOverlay` de `game.js` para no duplicar esa información.
- **No:** mantener el HUD y el overlay de "GAME OVER" dibujados en el canvas del original. Hubiera generado dos fuentes de verdad visibles a la vez (HUD de React + HUD de canvas).
- **Sí:** canvas fijo en 800×600, escalado visualmente por CSS (`max-width:100%; height:auto`) dentro de `.crt-screen`. Decisión explícita del usuario — conserva intacta la física/coordenadas del original (que asume ese tamaño fijo) sin el riesgo de reescribir colisiones y wrap para que sean responsive.
- **No:** reescribir el motor para que sea responsive al tamaño del contenedor. Fuera de alcance de este primer port; se evalúa si hace falta cuando haya más juegos reales.
- **Sí:** controles solo de teclado, idénticos al original, agregando `preventDefault` en `ArrowLeft`/`ArrowRight`/`ArrowUp`/`Space` mientras el juego está montado. Decisión explícita del usuario — sin controles táctiles nuevos en este spec.
- **No:** agregar controles táctiles/on-screen. No estaban en el juego original; se evalúa en un spec futuro si se necesita soporte móvil real.
- **Sí:** al llegar a 0 vidas, el motor dispara `onGameOver(score)` y React abre automáticamente el modal "FIN DEL JUEGO" existente, reutilizando el flujo de `addScore` que ya tienen los demás juegos. Decisión explícita del usuario.
- **No:** mantener el overlay "GAME OVER / ESPACIO PARA REINICIAR" dibujado en el canvas del original, redundante con el modal de React.
- **Sí:** "PAUSA" detiene por completo el loop del motor (sin física ni render mientras está pausado) y "JUGAR DE NUEVO" llama a `reset()` sobre el motor real (no solo resetea estado de React). Decisión explícita del usuario.
- **No:** dejar esos botones sin conexión real al motor en este spec.
- **Sí:** el botón "FIN" detiene el motor (vía la misma prop `running`) y abre el modal con la puntuación acumulada hasta ese momento, sin tratarlo como una muerte de la nave dentro del juego. Decisión explícita del usuario — mismo comportamiento que ya tienen los demás juegos con el loop falso.
- **No:** deshabilitar el botón "FIN" para este juego.
- **Sí:** actualizar la nota de `CLAUDE.md` sobre "no hay lógica de juego real para ninguno de los 8 juegos" para reflejar la excepción de `rocas`. Mantiene la documentación del proyecto alineada con el código.

## Riesgos

| Riesgo                                                                                                                                                                                         | Mitigación                                                                                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Los listeners de teclado del motor quedan en `window` (igual que el original); si no se remueven al desmontar, se duplicarían al reentrar a `/jugar/rocas` o interferirían con otras pantallas | `destroy()` remueve explícitamente los listeners agregados en `start()`; el criterio de aceptación correspondiente exige probar salir y reentrar sin doble input.                                          |
| Canvas fijo en 800×600 puede desbordar en viewports angostos si el escalado CSS no se aplica correctamente                                                                                     | Se usa `max-width:100%; height:auto` dentro de `.crt-screen`, que ya está pensado para contener contenido de tamaño variable en el resto del reproductor.                                                  |
| Cancelar y reanudar el `requestAnimationFrame` en `setRunning()` puede introducir un salto brusco de `dt` (tiempo transcurrido mientras estuvo en pausa)                                       | El motor debe resetear su referencia de `lastTime` a `null` al reanudar, igual que hace `loop()` en el primer frame tras `initGame()`, para que el primer `dt` post-pausa sea 0 en vez de un salto grande. |

## Qué **no** incluye este spec

- Lógica de juego real para los otros 7 juegos del catálogo.
- Controles táctiles/on-screen.
- Un motor responsive a distintos tamaños de contenedor.
- Cambios al leaderboard mock de `/juego/rocas`.
- Sonido o efectos de audio.
- Persistencia más allá de `addScore` (replays, estadísticas históricas).
- Tests automatizados.

Cada uno de estos, si se necesita, va en su propio spec futuro.
