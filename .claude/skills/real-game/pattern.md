# pattern.md — Contrato y esqueleto de referencia para /real-game

Este archivo documenta, tal como existen hoy en el código, las piezas que hay que replicar para cada juego real nuevo. No es pseudocódigo — son los archivos reales de `rocas` (el único juego ya portado, SPEC 05), con los nombres genéricos donde cambian por juego.

## El contrato: `lib/games/types.ts`

```ts
export interface RealGameProps {
  running: boolean; // false → el motor debe pausar/no arrancar
  resetSignal: number; // se incrementa para forzar reset() del motor
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}
```

Todo wrapper de React de un juego real recibe exactamente estas props. No se extiende este contrato sin que la Fase 1 de `/real-game` lo haya decidido explícitamente con el usuario (ver "Divergencias ya relevadas" abajo).

## El registro: `lib/games/registry.ts`

```ts
import type { ComponentType } from "react";
import RocasGame from "@/components/games/rocas/RocasGame";
import type { RealGameProps } from "@/lib/games/types";

export const REAL_GAMES: Partial<Record<string, ComponentType<RealGameProps>>> =
  {
    rocas: RocasGame,
    // <id>: <Nombre>Game,
  };
```

Agregar un juego nuevo es una sola línea acá. `GamePlayer.tsx` ya consulta `REAL_GAMES[game.id]` y no necesita ningún otro cambio.

## El esqueleto del motor: `lib/games/<id>/engine.ts`

Forma exacta a replicar (basada en `lib/games/rocas/engine.ts`):

```ts
import type { RealGameProps } from "@/lib/games/types";

const W = 800; // resolución lógica fija; se escala por CSS, no se hace responsive
const H = 600;

const CONTROL_CODES = new Set([
  "ArrowLeft",
  "ArrowRight" /* ...teclas del juego... */,
]);

export interface NombreEngine {
  start(): void;
  setRunning(running: boolean): void;
  reset(): void;
  destroy(): void;
}

type EngineCallbacks = Pick<
  RealGameProps,
  "onScoreChange" | "onLivesChange" | "onLevelChange" | "onGameOver"
>;

export function createNombreEngine(
  canvas: HTMLCanvasElement,
  callbacks: EngineCallbacks,
): NombreEngine {
  const ctx = canvas.getContext("2d")!;

  // Todo el estado del juego vive en este closure — nada a nivel de módulo.
  const keys: Record<string, boolean> = {};

  function onKeyDown(e: KeyboardEvent) {
    if (CONTROL_CODES.has(e.code)) e.preventDefault();
    keys[e.code] = true;
  }
  function onKeyUp(e: KeyboardEvent) {
    if (CONTROL_CODES.has(e.code)) e.preventDefault();
    keys[e.code] = false;
  }

  let score = 0;
  let lives = 3;
  let level = 1;

  function setScore(v: number) {
    score = v;
    callbacks.onScoreChange(score);
  }
  function setLives(v: number) {
    lives = v;
    callbacks.onLivesChange(lives);
  }
  function setLevel(v: number) {
    level = v;
    callbacks.onLevelChange(level);
  }

  function initGame() {
    setScore(0);
    setLives(3);
    setLevel(1);
    // ...reconstruir entidades...
  }

  function handleGameOver() {
    callbacks.onGameOver(score); // se dispara una sola vez, al llegar a 0 vidas (o condición equivalente)
  }

  function update(dt: number) {
    /* ...física, colisiones... */
  }
  function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    // Solo el campo de juego. Nunca dibujar HUD/overlays acá — React ya lo hace.
  }

  let lastTime: number | null = null;
  let rafId: number | null = null;
  let running = false;

  function loop(ts: number) {
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    update(dt);
    draw();
    if (running) rafId = requestAnimationFrame(loop);
  }

  function start() {
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    initGame();
    running = true;
    lastTime = null;
    rafId = requestAnimationFrame(loop);
  }

  function setRunning(next: boolean) {
    if (next === running) return;
    running = next;
    if (running) {
      lastTime = null; // evita un salto grande de dt al reanudar
      rafId = requestAnimationFrame(loop);
    } else if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function reset() {
    initGame();
  }

  function destroy() {
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
    running = false;
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
  }

  return { start, setRunning, reset, destroy };
}
```

Puntos no negociables del patrón (verificados en `rocas`, se rompen solo si la Fase 1 lo decide explícitamente):

- Todo el estado vive en el closure de la factory — nada a nivel de módulo (evita fugas entre partidas/instancias).
- Los listeners de teclado van en `window`, con `preventDefault()` acotado a un `Set` explícito de teclas de control (nunca `preventDefault()` de todo).
- `setScore`/`setLives`/`setLevel` son la única vía para cambiar esos valores — siempre notifican al callback correspondiente en el mismo lugar donde cambian.
- `onGameOver` se dispara una sola vez, en el punto exacto donde termina la partida.
- Nada de `drawHUD`/`drawOverlay`/texto de "game over" dibujado en canvas — el HUD y los modales de React son la única fuente visible.
- `setRunning` cancela/reanuda el `requestAnimationFrame` sin tocar entidades del juego, y resetea `lastTime = null` al reanudar para que el primer `dt` post-pausa sea 0.
- `reset()` reinicializa el juego (como `initGame()`), sin tocar el loop ni los listeners.
- `destroy()` cancela el RAF pendiente y remueve exactamente los listeners agregados en `start()` — es la limpieza que evita fugas al desmontar.

## El esqueleto del wrapper: `components/games/<id>/<Nombre>Game.tsx`

Forma exacta a replicar (basada en `components/games/rocas/RocasGame.tsx`):

```tsx
"use client";
import { useEffect, useRef } from "react";
import { createNombreEngine, type NombreEngine } from "@/lib/games/<id>/engine";
import type { RealGameProps } from "@/lib/games/types";

export default function NombreGame({
  running,
  resetSignal,
  onScoreChange,
  onLivesChange,
  onLevelChange,
  onGameOver,
}: RealGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<NombreEngine | null>(null);
  const isFirstReset = useRef(true);

  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = createNombreEngine(canvasRef.current, {
      onScoreChange,
      onLivesChange,
      onLevelChange,
      onGameOver,
    });
    engineRef.current = engine;
    engine.start();
    return () => engine.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    engineRef.current?.setRunning(running);
  }, [running]);

  useEffect(() => {
    if (isFirstReset.current) {
      isFirstReset.current = false;
      return;
    }
    engineRef.current?.reset();
  }, [resetSignal]);

  return (
    <canvas ref={canvasRef} width={800} height={600} className="<id>-canvas" />
  );
}
```

## La clase CSS del canvas (`app/globals.css`)

Bloque exacto a duplicar, junto a `.rocas-canvas` (línea ~712 de `app/globals.css`):

```css
.ID-canvas {
  /* reemplazar ID por el id de catálogo del juego, p. ej. .caida-canvas */
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
}
```

## Lo que NO hace falta tocar por juego nuevo

- `components/GamePlayer.tsx` — ya consulta `REAL_GAMES[game.id]` genéricamente, ya llama `insertScore` genéricamente. Solo se toca si la Fase 1 de `/real-game` decidió soporte explícito para un caso nuevo (p. ej. juego sin vidas).
- `lib/games/queries.ts`, `lib/supabase/client.ts`, `lib/supabase/server.ts` — parametrizados por `SupabaseClient`, no conocen ids específicos.
- `app/juego/[id]/page.tsx`, `app/jugar/[id]/page.tsx` y sus `error.tsx` — rutas dinámicas genéricas.
- Migraciones de Supabase — la fila en `games` ya debe existir (verificado en la Fase 0 de `/real-game`); no se crean filas nuevas desde este skill.

## Divergencias ya relevadas en `references/started-games/`

Tabla de referencia para saber qué preguntar en la Fase 1 sin tener que re-leer las tres fuentes cada vez:

| Aspecto                    | `02-asteroids` (`rocas`, ya portado)                | `03-tetris` (mapea a `caida`)                           | `04-arkanoid` (mapea a `bloque-buster`)                                                      |
| -------------------------- | --------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Vidas                      | sí (3)                                              | **no tiene**                                            | sí (3), sin sub-estado de muerte/invencibilidad                                              |
| Niveles                    | infinitos, se derivan de limpiar el campo           | derivados de líneas limpiadas (solo velocidad)          | 5 niveles finitos con layout propio + estado **"victoria"** al completarlos                  |
| HUD                        | dibujado en canvas (ya eliminado en el port)        | **DOM** (`textContent` en elementos fuera del canvas)   | dibujado en canvas                                                                           |
| Overlay de pausa/game-over | canvas (ya eliminado en el port)                    | **div de DOM** con botón de reinicio real               | canvas, **con menú clickeable de selección de nivel** (funcionalidad real, no solo texto)    |
| Canvas                     | 1                                                   | **2** (tablero + vista previa de la próxima pieza)      | 1                                                                                            |
| Controles                  | teclado (`keys`/`justPressed` con estado sostenido) | teclado, una acción discreta por `keydown`, sin `keyup` | **mouse (principal) + teclado (alternativo)** + clicks sobre el canvas para el menú de pausa |
| Assets externos            | ninguno                                             | ninguno (solo CSS)                                      | **imagen spritesheet + 2 archivos de audio**, cargados de forma asíncrona antes de arrancar  |
| Efectos colaterales ajenos | ninguno                                             | `localStorage` para un selector de tema claro/oscuro    | reproducción de audio (`Audio.play()`)                                                       |

Resoluciones por defecto (política de simplificación ya acordada, a confirmar puntualmente en la Fase 1):

- **Vidas ausentes (tetris):** no invocar `onLivesChange`, confirmando con el usuario si `GamePlayer.tsx` debe ocultar el campo "Vidas" para ese juego o mostrar un valor fijo.
- **Estado "victoria" (arkanoid):** enrutar por `onGameOver(score)`, igual que una derrota — sin texto especial, ya que el modal de React no distingue variantes.
- **Segundo canvas (tetris):** fusionar la vista previa dentro del canvas principal (dibujarla en una esquina), o preguntar si se omite.
- **Menú de pausa clickeable (arkanoid):** se elimina — React ya tiene su propio overlay de pausa (mismo criterio que SPEC 05 usó para borrar `drawHUD`/`drawOverlay` de `rocas`); si el usuario quiere conservar el salto directo a nivel, se resuelve como una función nueva en el HUD de React, no dibujada en canvas.
- **Assets de imagen/audio (arkanoid):** por defecto, primitivas de canvas (`fillRect`/`arc`) con la paleta neón del proyecto (`--cyan`/`--magenta`/`--green`/`--yellow` de `app/globals.css`), sin sonido. Fidelidad 1:1 solo si el usuario la pide explícitamente.
- **Efecto colateral de tema (tetris):** se elimina — el motor no debe leer/escribir `localStorage` ni tocar DOM fuera del `canvas` recibido.
