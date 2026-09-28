import type { ComponentType } from "react";
import RocasGame from "@/components/games/rocas/RocasGame";
import CaidaGame from "@/components/games/caida/CaidaGame";
import type { RealGameProps } from "@/lib/games/types";

export interface RealGameEntry {
  Component: ComponentType<RealGameProps>;
  hasLives?: boolean; // false → GamePlayer oculta el campo "Vidas" del HUD (default: true)
}

export const REAL_GAMES: Partial<Record<string, RealGameEntry>> = {
  rocas: { Component: RocasGame },
  caida: { Component: CaidaGame, hasLives: false },
};
