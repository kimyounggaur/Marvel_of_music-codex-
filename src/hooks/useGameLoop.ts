import { useEffect, useRef } from 'react';
import { BOARD } from '../data/boardCells';
import { rollDice } from '../game/dice';
import { resolveCellEvent } from '../game/rules';
import type { GameAction } from '../game/reducer';
import type { GameState } from '../game/types';

const EVENT_DURATION_MS = 1120;

function randomFace(): number {
  return rollDice();
}

function playTone(frequency: number, durationMs: number, enabled: boolean): void {
  if (!enabled) return;

  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) return;

  const audio = new AudioContextCtor();
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.frequency.value = frequency;
  oscillator.type = 'sine';
  gain.gain.value = 0.04;
  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.start();
  oscillator.stop(audio.currentTime + durationMs / 1000);
  oscillator.addEventListener('ended', () => {
    void audio.close();
  });
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

export function useGameLoop(state: GameState, dispatch: React.Dispatch<GameAction>): void {
  const previousMovementTick = useRef(state.movementTick);
  const previousDiceValue = useRef(state.diceValue);

  useEffect(() => {
    if (state.phase !== 'ROLLING') return undefined;

    const interval = window.setInterval(() => {
      dispatch({ type: 'ROLL_DICE_TICK', value: randomFace() });
    }, 72);

    const timeout = window.setTimeout(() => {
      dispatch({ type: 'ROLL_DICE_COMPLETE', value: rollDice() });
    }, 700);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [dispatch, state.phase]);

  useEffect(() => {
    if (state.phase !== 'MOVING' || !state.movement) return undefined;

    const timeout = window.setTimeout(() => {
      dispatch({ type: 'MOVE_ONE_STEP_COMPLETE' });
    }, state.movement.durationMs);

    return () => window.clearTimeout(timeout);
  }, [dispatch, state.movement, state.phase, state.movementTick]);

  useEffect(() => {
    if (state.phase !== 'RESOLVING_EVENT') return undefined;

    if (!state.activeEvent && state.chainDepth > 10) {
      const timeout = window.setTimeout(() => dispatch({ type: 'STOP_CHAIN' }), 0);
      return () => window.clearTimeout(timeout);
    }

    if (!state.activeEvent) {
      const timeout = window.setTimeout(() => {
        const position = state.players[state.currentPlayer].position;
        dispatch({ type: 'RESOLVE_EVENT_RESULT', event: resolveCellEvent(BOARD, position) });
      }, 120);
      return () => window.clearTimeout(timeout);
    }

    const timeout = window.setTimeout(() => {
      dispatch({ type: 'APPLY_ACTIVE_EVENT' });
    }, EVENT_DURATION_MS);

    return () => window.clearTimeout(timeout);
  }, [
    dispatch,
    state.activeEvent,
    state.chainDepth,
    state.currentPlayer,
    state.phase,
    state.players,
  ]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if (isTyping) return;

      if (state.learningQueue.length > 0 && (event.key === 'Enter' || event.key === 'Escape')) {
        event.preventDefault();
        dispatch({ type: 'CLOSE_LEARNING' });
        return;
      }

      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        dispatch({ type: 'ROLL_DICE_START' });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dispatch, state.learningQueue.length]);

  useEffect(() => {
    if (previousMovementTick.current !== state.movementTick) {
      previousMovementTick.current = state.movementTick;
      playTone(640, 80, state.soundEnabled);
    }
  }, [state.movementTick, state.soundEnabled]);

  useEffect(() => {
    if (previousDiceValue.current !== state.diceValue && state.diceValue !== null) {
      previousDiceValue.current = state.diceValue;
      playTone(420 + state.diceValue * 55, 120, state.soundEnabled);
    }
  }, [state.diceValue, state.soundEnabled]);

  useEffect(() => {
    if (state.activeEvent) playTone(780, 180, state.soundEnabled);
  }, [state.activeEvent, state.soundEnabled]);
}
