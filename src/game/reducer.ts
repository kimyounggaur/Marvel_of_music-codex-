import { BOARD_LEN, stepBackward, stepForward } from './movement';
import type { GameState, MovementPlan, Player, ResolvedEvent } from './types';

export type GameAction =
  | { type: 'SET_PLAYER_COUNT'; count: number }
  | { type: 'START_GAME'; count: number }
  | { type: 'ROLL_DICE_START' }
  | { type: 'ROLL_DICE_TICK'; value: number }
  | { type: 'ROLL_DICE_COMPLETE'; value: number }
  | { type: 'MOVE_ONE_STEP_COMPLETE' }
  | { type: 'RESOLVE_EVENT_RESULT'; event: ResolvedEvent }
  | { type: 'APPLY_ACTIVE_EVENT' }
  | { type: 'STOP_CHAIN' }
  | { type: 'CLOSE_LEARNING' }
  | { type: 'RESET_GAME' }
  | { type: 'TOGGLE_SOUND' }
  | { type: 'ADD_LOG'; message: string };

const PLAYER_COLORS = ['#ef476f', '#4f7cff', '#43c77a', '#f0ad00'];
const PLAYER_NAMES = ['빨강 음표', '파랑 음표', '초록 음표', '노랑 음표'];
const MAX_LOGS = 20;
const CHAIN_LIMIT = 10;

function makePlayers(count: number): Player[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    name: PLAYER_NAMES[index],
    color: PLAYER_COLORS[index],
    position: 0,
    skipTurns: 0,
    finished: false,
    laps: 0,
  }));
}

export function createInitialState(count = 1, setupOpen = true): GameState {
  return {
    players: makePlayers(count),
    currentPlayer: 0,
    diceValue: null,
    rollingFace: 1,
    remainingSteps: 0,
    phase: 'READY',
    activeEvent: null,
    eventLog: [],
    chainDepth: 0,
    turnCount: 1,
    movement: null,
    movementTick: 0,
    turnLearningEvents: [],
    learningQueue: [],
    setupOpen,
    selectedPlayerCount: count,
    winnerId: null,
    soundEnabled: false,
  };
}

export const initialGameState = createInitialState();

function addLog(state: GameState, message: string): GameState {
  return {
    ...state,
    eventLog: [message, ...state.eventLog].slice(0, MAX_LOGS),
  };
}

function updateCurrentPlayer(state: GameState, updater: (player: Player) => Player): Player[] {
  return state.players.map((player, index) =>
    index === state.currentPlayer ? updater(player) : player,
  );
}

function advanceTurn(state: GameState): GameState {
  const nextPlayer = (state.currentPlayer + 1) % state.players.length;

  return {
    ...state,
    currentPlayer: nextPlayer,
    diceValue: null,
    remainingSteps: 0,
    phase: 'READY',
    activeEvent: null,
    chainDepth: 0,
    movement: null,
    turnCount: state.turnCount + 1,
    learningQueue: state.turnLearningEvents,
    turnLearningEvents: [],
  };
}

function finishTurnWithLog(state: GameState, message?: string): GameState {
  const logged = message ? addLog(state, message) : state;
  return advanceTurn(logged);
}

function eventLogMessage(event: ResolvedEvent): string {
  switch (event.type) {
    case 'MOVE_FORWARD':
      return `🚀 ${event.sourceIndex}번 칸 효과! ${event.steps ?? 0}칸 앞으로 이동해요.`;
    case 'JUMP_TO_INDEX':
      return `✨ ${event.sourceIndex}번 칸에서 ${event.targetIndex}번 칸으로 이동해요.`;
    case 'SKIP_TURNS':
      return `⏸ 페르마타! 다음 ${event.skipTurns ?? 0}번 쉬어요.`;
    case 'GAME_FINISH':
      return '🏁 Fine! 곡이 멋지게 끝났어요.';
    case 'NONE':
      return '';
  }
}

function createMovement(direction: 1 | -1, stepsRemaining: number, origin: MovementPlan['origin']): MovementPlan {
  return {
    direction,
    stepsRemaining,
    origin,
    durationMs: origin === 'event' ? 190 : 290,
    passStartWins: direction === 1,
  };
}

function hasCompletedLap(prev: number, next: number, movement: MovementPlan): boolean {
  return movement.passStartWins && movement.direction === 1 && prev === BOARD_LEN - 1 && next === 0;
}

function finishGame(state: GameState, message: string): GameState {
  const players = updateCurrentPlayer(state, (player) => ({
    ...player,
    finished: true,
  }));

  return addLog(
    {
      ...state,
      players,
      phase: 'GAME_OVER',
      winnerId: state.players[state.currentPlayer].id,
      movement: null,
      activeEvent: null,
      learningQueue: state.turnLearningEvents,
      turnLearningEvents: [],
      remainingSteps: 0,
    },
    message,
  );
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SET_PLAYER_COUNT':
      return {
        ...state,
        selectedPlayerCount: Math.min(4, Math.max(1, action.count)),
      };
    case 'START_GAME': {
      const nextState = createInitialState(Math.min(4, Math.max(1, action.count)), false);
      return addLog(nextState, `🎼 ${action.count}명이 함께 시작해요.`);
    }
    case 'ROLL_DICE_START': {
      if (state.setupOpen || state.learningQueue.length > 0 || state.phase !== 'READY') return state;

      const player = state.players[state.currentPlayer];
      if (player.skipTurns > 0) {
        const players = updateCurrentPlayer(state, (current) => ({
          ...current,
          skipTurns: Math.max(0, current.skipTurns - 1),
        }));
        const skipped = addLog(
          { ...state, players },
          `⏸ ${player.name}은 페르마타로 쉬었어요. 남은 쉬기 ${player.skipTurns - 1}번.`,
        );
        return advanceTurn(skipped);
      }

      return {
        ...state,
        phase: 'ROLLING',
        diceValue: null,
        activeEvent: null,
        turnLearningEvents: [],
      };
    }
    case 'ROLL_DICE_TICK':
      return state.phase === 'ROLLING' ? { ...state, rollingFace: action.value } : state;
    case 'ROLL_DICE_COMPLETE':
      if (state.phase !== 'ROLLING') return state;
      return addLog(
        {
          ...state,
          phase: 'MOVING',
          diceValue: action.value,
          rollingFace: action.value,
          remainingSteps: action.value,
          movement: createMovement(1, action.value, 'dice'),
        },
        `🎲 주사위 ${action.value}! ${action.value}칸 자동으로 이동해요.`,
      );
    case 'MOVE_ONE_STEP_COMPLETE': {
      if (state.phase !== 'MOVING' || !state.movement) return state;

      const movement = state.movement;
      const current = state.players[state.currentPlayer];
      const prev = current.position;
      const next =
        movement.direction === 1 ? stepForward(prev, BOARD_LEN) : stepBackward(prev, 1, BOARD_LEN);
      const completedLap = hasCompletedLap(prev, next, movement);
      const players = updateCurrentPlayer(state, (player) => ({
        ...player,
        position: next,
        laps: completedLap ? player.laps + 1 : player.laps,
      }));
      const remainingSteps =
        movement.origin === 'dice' ? Math.max(0, state.remainingSteps - 1) : state.remainingSteps;
      const moved = addLog(
        {
          ...state,
          players,
          remainingSteps,
          movementTick: state.movementTick + 1,
        },
        `➡️ ${current.name}가 ${next}번 칸으로 이동.`,
      );

      if (completedLap) {
        return finishGame(moved, `🏆 ${current.name}이 Start를 지나 한 바퀴를 완성했어요!`);
      }

      if (movement.stepsRemaining > 1) {
        return {
          ...moved,
          phase: 'MOVING',
          movement: {
            ...movement,
            stepsRemaining: movement.stepsRemaining - 1,
          },
        };
      }

      if (movement.origin === 'dice') {
        return {
          ...moved,
          remainingSteps,
          movement: null,
          phase: 'RESOLVING_EVENT',
          activeEvent: null,
        };
      }

      return {
        ...moved,
        movement: null,
        phase: 'RESOLVING_EVENT',
        activeEvent: null,
      };
    }
    case 'RESOLVE_EVENT_RESULT': {
      if (state.phase !== 'RESOLVING_EVENT' || state.activeEvent) return state;
      const warned = action.event.warning ? addLog(state, `⚠️ ${action.event.warning}`) : state;

      if (action.event.type === 'NONE') {
        return finishTurnWithLog(warned);
      }

      return addLog(
        {
          ...warned,
          activeEvent: action.event,
          turnLearningEvents: [...warned.turnLearningEvents, action.event],
        },
        eventLogMessage(action.event),
      );
    }
    case 'APPLY_ACTIVE_EVENT': {
      if (state.phase !== 'RESOLVING_EVENT' || !state.activeEvent) return state;
      const event = state.activeEvent;

      if (state.chainDepth >= CHAIN_LIMIT) {
        return finishTurnWithLog(
          {
            ...state,
            activeEvent: null,
          },
          '🛑 이벤트 연쇄가 길어져서 안전하게 멈췄어요.',
        );
      }

      if (event.type === 'MOVE_FORWARD') {
        const steps = Math.max(0, event.steps ?? 0);
        if (steps === 0) return finishTurnWithLog({ ...state, activeEvent: null });
        return {
          ...state,
          activeEvent: null,
          chainDepth: state.chainDepth + 1,
          phase: 'MOVING',
          movement: createMovement(1, steps, 'event'),
        };
      }

      if (event.type === 'JUMP_TO_INDEX' && event.targetIndex !== undefined) {
        const players = updateCurrentPlayer(state, (player) => ({
          ...player,
          position: event.targetIndex ?? player.position,
        }));
        return addLog(
          {
            ...state,
            players,
            activeEvent: null,
            chainDepth: state.chainDepth + 1,
            phase: 'RESOLVING_EVENT',
            movementTick: state.movementTick + 1,
          },
          `🎯 목적지 ${event.targetIndex}번 칸에 도착.`,
        );
      }

      if (event.type === 'SKIP_TURNS') {
        const players = updateCurrentPlayer(state, (player) => ({
          ...player,
          skipTurns: player.skipTurns + (event.skipTurns ?? 0),
        }));
        return finishTurnWithLog({
          ...state,
          players,
          activeEvent: null,
          chainDepth: state.chainDepth + 1,
          phase: 'SKIPPING',
        });
      }

      if (event.type === 'GAME_FINISH') {
        return finishGame(
          {
            ...state,
            activeEvent: null,
            chainDepth: state.chainDepth + 1,
          },
          `🏆 ${state.players[state.currentPlayer].name}이 Fine에 도착했어요!`,
        );
      }

      return finishTurnWithLog({ ...state, activeEvent: null });
    }
    case 'STOP_CHAIN':
      if (state.phase !== 'RESOLVING_EVENT') return state;
      return finishTurnWithLog(
        {
          ...state,
          activeEvent: null,
        },
        '🛑 이벤트 연쇄가 길어져서 안전하게 멈췄어요.',
      );
    case 'CLOSE_LEARNING':
      return {
        ...state,
        learningQueue: [],
      };
    case 'RESET_GAME':
      return addLog(createInitialState(state.selectedPlayerCount, false), '🔄 게임을 다시 시작했어요.');
    case 'TOGGLE_SOUND':
      return {
        ...state,
        soundEnabled: !state.soundEnabled,
      };
    case 'ADD_LOG':
      return addLog(state, action.message);
    default:
      return state;
  }
}
