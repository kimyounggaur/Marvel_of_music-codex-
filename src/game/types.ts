export type CellKind =
  | 'START'
  | 'NORMAL'
  | 'MULTI_REST'
  | 'REPEAT_START'
  | 'REPEAT_END'
  | 'DAL_SEGNO'
  | 'SEGNO'
  | 'CODA'
  | 'DA_CAPO'
  | 'FIRST_ENDING'
  | 'SECOND_ENDING'
  | 'FERMATA'
  | 'DOUBLE_SEGNO'
  | 'DOUBLE_SEGNO_TRIGGER'
  | 'DOUBLE_CODA'
  | 'OCTAVE_DOWN'
  | 'FINE';

export interface BoardCell {
  index: number;
  kind: CellKind;
  label: string;
  side: 'top' | 'right' | 'bottom' | 'left';
  isCorner?: boolean;
  markerOnly?: boolean;
  count?: number;
  pairId?: string;
  occurrence?: 1 | 2;
}

export type GamePhase =
  | 'READY'
  | 'ROLLING'
  | 'WAITING_STEP'
  | 'MOVING'
  | 'RESOLVING_EVENT'
  | 'SKIPPING'
  | 'GAME_OVER';

export type ResolvedEventType =
  | 'NONE'
  | 'MOVE_FORWARD'
  | 'MOVE_BACKWARD'
  | 'JUMP_TO_INDEX'
  | 'SKIP_TURNS'
  | 'GAME_FINISH';

export interface ResolvedEvent {
  type: ResolvedEventType;
  sourceIndex: number;
  targetIndex?: number;
  steps?: number;
  skipTurns?: number;
  animationClass: string;
  kind: CellKind;
  warning?: string;
}

export interface Player {
  id: number;
  name: string;
  color: string;
  position: number;
  skipTurns: number;
  finished: boolean;
  laps: number;
}

export interface MovementPlan {
  direction: 1 | -1;
  stepsRemaining: number;
  origin: 'dice' | 'event';
  durationMs: number;
  passStartWins: boolean;
}

export interface GameState {
  players: Player[];
  currentPlayer: number;
  diceValue: number | null;
  rollingFace: number;
  remainingSteps: number;
  phase: GamePhase;
  activeEvent: ResolvedEvent | null;
  eventLog: string[];
  chainDepth: number;
  turnCount: number;
  movement: MovementPlan | null;
  movementTick: number;
  turnLearningEvents: ResolvedEvent[];
  learningQueue: ResolvedEvent[];
  setupOpen: boolean;
  selectedPlayerCount: number;
  winnerId: number | null;
  soundEnabled: boolean;
}
