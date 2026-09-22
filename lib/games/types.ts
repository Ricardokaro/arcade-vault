export interface RealGameProps {
  running: boolean; // false → el motor debe pausar/no arrancar
  resetSignal: number; // se incrementa para forzar reset() del motor
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}
