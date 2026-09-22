"use client";
import { useEffect, useRef } from "react";
import { createRocasEngine, type RocasEngine } from "@/lib/games/rocas/engine";
import type { RealGameProps } from "@/lib/games/types";
export default function RocasGame({
  running,
  resetSignal,
  onScoreChange,
  onLivesChange,
  onLevelChange,
  onGameOver,
}: RealGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<RocasEngine | null>(null);
  const isFirstReset = useRef(true);
  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = createRocasEngine(canvasRef.current, {
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
  return <canvas ref={canvasRef} width={800} height={600} className="rocas-canvas" />;
}