import { useEffect, useRef } from 'react';
import { sound } from '../audio/sound';
import { BOARD } from '../data/boardCells';
import { rollDice } from '../game/dice';
import { resolveCellEvent } from '../game/rules';
import type { GameAction } from '../game/reducer';
import type { GameState } from '../game/types';
import { AFTER_JUMP_MS, ROLL_MS, SETTLE_MS, eventShowMs, jumpTravelMs } from '../three/timing';

/** 2D 화면에서 기호 효과를 보여주는 시간 */
const CLASSIC_EVENT_MS = 1120;
const CLASSIC_ROLL_MS = 700;
const CLASSIC_RESOLVE_MS = 120;

export interface GameLoopOptions {
  /**
   * true면 3D 무대용 시간표를 쓴다. 규칙은 같고, 화면이 연출을 끝낼 때까지 기다리는 시간만 길어진다.
   * 효과음도 무대가 장면에 맞춰 직접 울리므로 여기서는 내지 않는다.
   */
  cinematic: boolean;
  /** 주사위 눈이 정해진 순간(던지기 시작). 3D 주사위가 이 눈으로 멈추도록 굴린다 */
  onRoll?: (value: number, durationMs: number) => void;
}

export function useGameLoop(state: GameState, dispatch: React.Dispatch<GameAction>, options: GameLoopOptions): void {
  const { cinematic } = options;
  const onRollRef = useRef(options.onRoll);
  onRollRef.current = options.onRoll;

  const previousMovementTick = useRef(state.movementTick);
  const previousDiceValue = useRef(state.diceValue);
  const stepInTurn = useRef(0);

  // 주사위 굴리기
  useEffect(() => {
    if (state.phase !== 'ROLLING') return undefined;
    stepInTurn.current = 0;

    if (cinematic) {
      // 눈을 먼저 정하고, 무대가 그 눈으로 멈추는 연출을 끝낼 때쯤 결과를 확정한다
      const value = rollDice();
      onRollRef.current?.(value, ROLL_MS);
      const timeout = window.setTimeout(() => {
        dispatch({ type: 'ROLL_DICE_COMPLETE', value });
      }, ROLL_MS);
      return () => window.clearTimeout(timeout);
    }

    const interval = window.setInterval(() => {
      dispatch({ type: 'ROLL_DICE_TICK', value: rollDice() });
    }, 72);
    const timeout = window.setTimeout(() => {
      dispatch({ type: 'ROLL_DICE_COMPLETE', value: rollDice() });
    }, CLASSIC_ROLL_MS);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [cinematic, dispatch, state.phase]);

  // 한 칸씩 자동 이동
  useEffect(() => {
    if (state.phase !== 'MOVING' || !state.movement) return undefined;

    const timeout = window.setTimeout(() => {
      dispatch({ type: 'MOVE_ONE_STEP_COMPLETE' });
    }, state.movement.durationMs);

    return () => window.clearTimeout(timeout);
  }, [dispatch, state.movement, state.phase, state.movementTick]);

  // 칸 효과 판정 → 연출 → 적용
  useEffect(() => {
    if (state.phase !== 'RESOLVING_EVENT') return undefined;

    if (!state.activeEvent && state.chainDepth > 10) {
      const timeout = window.setTimeout(() => dispatch({ type: 'STOP_CHAIN' }), 0);
      return () => window.clearTimeout(timeout);
    }

    if (!state.activeEvent) {
      let delay = CLASSIC_RESOLVE_MS;
      if (cinematic) {
        // 방금 기호 효과로 날아왔다면 말이 목적지에 내려앉을 때까지 기다린다
        const last = state.turnLearningEvents[state.turnLearningEvents.length - 1];
        const afterJump = state.chainDepth > 0 && last?.type === 'JUMP_TO_INDEX';
        delay = afterJump ? jumpTravelMs(last.animationClass) + AFTER_JUMP_MS : SETTLE_MS;
      }
      const timeout = window.setTimeout(() => {
        const position = state.players[state.currentPlayer].position;
        dispatch({ type: 'RESOLVE_EVENT_RESULT', event: resolveCellEvent(BOARD, position) });
      }, delay);
      return () => window.clearTimeout(timeout);
    }

    const showMs = cinematic ? eventShowMs(state.activeEvent.animationClass) : CLASSIC_EVENT_MS;
    const timeout = window.setTimeout(() => {
      dispatch({ type: 'APPLY_ACTIVE_EVENT' });
    }, showMs);

    return () => window.clearTimeout(timeout);
  }, [
    cinematic,
    dispatch,
    state.activeEvent,
    state.chainDepth,
    state.currentPlayer,
    state.phase,
    state.players,
    state.turnLearningEvents,
  ]);

  // 키보드: Space/Enter로 굴리기, Enter/Esc로 학습 카드 닫기
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if (isTyping) return;
      // 버튼에 포커스가 있으면 브라우저가 그 버튼을 누르게 둔다(중복 동작 방지)
      if (target?.tagName === 'BUTTON' && (event.key === ' ' || event.key === 'Enter')) return;

      if (state.learningQueue.length > 0 && (event.key === 'Enter' || event.key === 'Escape')) {
        event.preventDefault();
        dispatch({ type: 'CLOSE_LEARNING' });
        return;
      }

      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        sound.unlock();
        dispatch({ type: 'ROLL_DICE_START' });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dispatch, state.learningQueue.length]);

  // 2D 화면용 효과음(3D에서는 무대가 장면에 맞춰 울린다)
  useEffect(() => {
    if (previousMovementTick.current !== state.movementTick) {
      previousMovementTick.current = state.movementTick;
      if (!cinematic) {
        stepInTurn.current += 1;
        sound.step(stepInTurn.current);
      }
    }
  }, [cinematic, state.movementTick]);

  useEffect(() => {
    if (previousDiceValue.current !== state.diceValue) {
      previousDiceValue.current = state.diceValue;
      if (!cinematic && state.diceValue !== null) sound.diceSettle(state.diceValue);
    }
  }, [cinematic, state.diceValue]);

  useEffect(() => {
    if (!cinematic && state.activeEvent) sound.event();
  }, [cinematic, state.activeEvent]);
}
