"use client";
import { useEffect, useRef } from "react";
import { createCaidaEngine, type CaidaEngine } from "@/lib/games/caida/engine";
import type { RealGameProps } from "@/lib/games/types";
export default function CaidaGame({
  running,
  resetSignal,
  onScoreChange,
  onLevelChange,
  onGameOver,
}: RealGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<CaidaEngine | null>(null);
  const isFirstReset = useRef(true);
  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = createCaidaEngine(canvasRef.current, {
      onScoreChange,
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
  return <canvas ref={canvasRef} width={300} height={600} className="caida-canvas" />;
}