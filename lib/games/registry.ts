import type { ComponentType } from "react";
import RocasGame from "@/components/games/rocas/RocasGame";
import type { RealGameProps } from "@/lib/games/types";

export const REAL_GAMES: Partial<Record<string, ComponentType<RealGameProps>>> = {
  rocas: RocasGame,
};
