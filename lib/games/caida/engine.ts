import type { RealGameProps } from "@/lib/games/types";

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;
const W = COLS * BLOCK;
const H = ROWS * BLOCK;

const COLORS: (string | null)[] = [
  null,
  "#4dd0e1", // I - cyan
  "#ffd54f", // O - amarillo
  "#ba68c8", // T - violeta
  "#81c784", // S - verde
  "#e57373", // Z - rojo
  "#90caf9", // J - celeste
  "#ffb74d", // L - naranja
  "#9e9e9e", // N - tuerca (gris metálico)
];

const PIECES: (number[][] | null)[] = [
  null,
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
  [
    [8, 8, 8],
    [8, 0, 8],
    [8, 8, 8],
  ], // N (tuerca)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const CONTROL_CODES = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"]);

// vista previa de la próxima pieza, dibujada en la esquina del canvas principal
const PREVIEW_CELL = 14;
const PREVIEW_PAD = 8;
const PREVIEW_BOX = PREVIEW_CELL * 4 + PREVIEW_PAD * 2;
const PREVIEW_MARGIN = 6;

export interface CaidaEngine {
  start(): void;
  setRunning(running: boolean): void;
  reset(): void;
  destroy(): void;
}

type EngineCallbacks = Pick<RealGameProps, "onScoreChange" | "onLevelChange" | "onGameOver">;

interface Piece {
  shape: number[][];
  x: number;
  y: number;
}

export function createCaidaEngine(
  canvas: HTMLCanvasElement,
  callbacks: EngineCallbacks,
): CaidaEngine {
  const ctx = canvas.getContext("2d")!;

  let board: number[][] = [];
  let current: Piece;
  let next: Piece;
  let score = 0;
  let lines = 0;
  let level = 1;
  let gameOver = false;
  let dropAccum = 0;
  let dropInterval = 1000;

  function setScore(v: number) {
    score = v;
    callbacks.onScoreChange(score);
  }

  function setLevel(v: number) {
    level = v;
    callbacks.onLevelChange(level);
  }

  function createBoard(): number[][] {
    return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
  }

  function randomPiece(): Piece {
    const type = Math.floor(Math.random() * 8) + 1;
    const shape = (PIECES[type] as number[][]).map((row) => [...row]);
    return {
      shape,
      x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
      y: 0,
    };
  }

  function collide(shape: number[][], ox: number, oy: number): boolean {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = ox + c;
        const ny = oy + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && board[ny][nx]) return true;
      }
    }
    return false;
  }

  function rotateCW(shape: number[][]): number[][] {
    const rows = shape.length;
    const cols = shape[0].length;
    const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
    return result;
  }

  function tryRotate() {
    const rotated = rotateCW(current.shape);
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      if (!collide(rotated, current.x + kick, current.y)) {
        current.shape = rotated;
        current.x += kick;
        return;
      }
    }
  }

  function merge() {
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c]) board[current.y + r][current.x + c] = current.shape[r][c];
  }

  function clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every((v) => v !== 0)) {
        board.splice(r, 1);
        board.unshift(new Array(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    if (cleared) {
      lines += cleared;
      setScore(score + (LINE_SCORES[cleared] || 0) * level);
      setLevel(Math.floor(lines / 10) + 1);
      dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    }
  }

  function ghostY(): number {
    let gy = current.y;
    while (!collide(current.shape, current.x, gy + 1)) gy++;
    return gy;
  }

  function hardDrop() {
    const gy = ghostY();
    setScore(score + (gy - current.y) * 2);
    current.y = gy;
    lockPiece();
  }

  function softDrop() {
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      setScore(score + 1);
    } else {
      lockPiece();
    }
  }

  function lockPiece() {
    merge();
    clearLines();
    spawn();
  }

  function spawn() {
    current = next;
    next = randomPiece();
    if (collide(current.shape, current.x, current.y)) {
      handleGameOver();
    }
  }

  function handleGameOver() {
    gameOver = true;
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
    callbacks.onGameOver(score);
  }

  function drawBlock(x: number, y: number, colorIndex: number, size: number, alpha?: number) {
    if (!colorIndex) return;
    ctx.globalAlpha = alpha ?? 1;
    ctx.fillStyle = COLORS[colorIndex]!;
    ctx.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(x * size + 1, y * size + 1, size - 2, 4);
    ctx.globalAlpha = 1;
  }

  function drawGrid() {
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 0.5;
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * BLOCK, 0);
      ctx.lineTo(c * BLOCK, ROWS * BLOCK);
      ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * BLOCK);
      ctx.lineTo(COLS * BLOCK, r * BLOCK);
      ctx.stroke();
    }
  }

  function drawNextPreview() {
    const boxX = W - PREVIEW_BOX - PREVIEW_MARGIN;
    const boxY = PREVIEW_MARGIN;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(boxX, boxY, PREVIEW_BOX, PREVIEW_BOX);
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1;
    ctx.strokeRect(boxX, boxY, PREVIEW_BOX, PREVIEW_BOX);

    const shape = next.shape;
    const offX = Math.floor((4 - shape[0].length) / 2);
    const offY = Math.floor((4 - shape.length) / 2);
    const baseX = boxX + PREVIEW_PAD;
    const baseY = boxY + PREVIEW_PAD;
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        const colorIndex = shape[r][c];
        if (!colorIndex) continue;
        ctx.fillStyle = COLORS[colorIndex]!;
        ctx.fillRect(
          baseX + (offX + c) * PREVIEW_CELL + 1,
          baseY + (offY + r) * PREVIEW_CELL + 1,
          PREVIEW_CELL - 2,
          PREVIEW_CELL - 2,
        );
      }
    }
  }

  function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    drawGrid();

    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) drawBlock(c, r, board[r][c], BLOCK);

    const gy = ghostY();
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c]) drawBlock(current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        drawBlock(current.x + c, current.y + r, current.shape[r][c], BLOCK);

    drawNextPreview();
  }

  function initGame() {
    board = createBoard();
    setScore(0);
    lines = 0;
    setLevel(1);
    dropInterval = 1000;
    dropAccum = 0;
    gameOver = false;
    next = randomPiece();
    spawn();
  }

  function onKeyDown(e: KeyboardEvent) {
    if (CONTROL_CODES.has(e.code)) e.preventDefault();
    if (gameOver) return;
    switch (e.code) {
      case "ArrowLeft":
        if (!collide(current.shape, current.x - 1, current.y)) current.x--;
        break;
      case "ArrowRight":
        if (!collide(current.shape, current.x + 1, current.y)) current.x++;
        break;
      case "ArrowDown":
        softDrop();
        break;
      case "ArrowUp":
      case "KeyX":
        tryRotate();
        break;
      case "Space":
        hardDrop();
        break;
    }
  }

  let lastTime: number | null = null;
  let rafId: number | null = null;
  let running = false;

  function loop(ts: number) {
    const dt = lastTime === null ? 0 : ts - lastTime;
    lastTime = ts;
    dropAccum += dt;
    if (dropAccum >= dropInterval) {
      dropAccum = 0;
      if (!collide(current.shape, current.x, current.y + 1)) {
        current.y++;
      } else {
        lockPiece();
      }
    }
    if (gameOver) return;
    draw();
    if (running) rafId = requestAnimationFrame(loop);
  }

  function start() {
    window.addEventListener("keydown", onKeyDown);
    initGame();
    running = true;
    lastTime = null;
    rafId = requestAnimationFrame(loop);
  }

  function setRunning(nextRunning: boolean) {
    if (nextRunning === running) return;
    running = nextRunning;
    if (running) {
      lastTime = null;
      dropAccum = 0; // evita una caída inmediata por tiempo acumulado durante la pausa
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
  }

  return { start, setRunning, reset, destroy };
}
