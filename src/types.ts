export type GameMode = 'completion' | 'time';

export interface Player {
  id: string;
  nickname: string;
  progress: number;
  wpm: number;
  accuracy: number;
  isFinished: boolean;
  finishTime: number | null;
  rematchRequested?: boolean;
}

export interface Room {
  id: string;
  players: Player[];
  status: 'waiting' | 'starting' | 'playing' | 'finished';
  gameMode: GameMode;
  duration: number; // in seconds for time mode
  snippet: {
    id: string;
    text: string;
    difficulty: string;
  };
  startTime: number | null;
  endTime: number | null;
}
