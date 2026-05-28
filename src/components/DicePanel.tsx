import { Dice5, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import type { Dispatch } from 'react';
import type { GameAction } from '../game/reducer';
import type { GameState } from '../game/types';

interface DicePanelProps {
  state: GameState;
  dispatch: Dispatch<GameAction>;
  canRoll: boolean;
}

const FACE_VALUES = [
  { value: 1, className: 'face-front' },
  { value: 2, className: 'face-right' },
  { value: 3, className: 'face-top' },
  { value: 4, className: 'face-bottom' },
  { value: 5, className: 'face-left' },
  { value: 6, className: 'face-back' },
] as const;

const PIP_POSITIONS: Record<number, string[]> = {
  1: ['center'],
  2: ['top-left', 'bottom-right'],
  3: ['top-left', 'center', 'bottom-right'],
  4: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
  5: ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'],
  6: ['top-left', 'middle-left', 'bottom-left', 'top-right', 'middle-right', 'bottom-right'],
};

function phaseText(state: GameState): string {
  if (state.phase === 'ROLLING') return '주사위를 굴리는 중';
  if (state.phase === 'MOVING') return `${state.remainingSteps}칸 자동 이동 중`;
  if (state.phase === 'RESOLVING_EVENT') return '기호 효과 실행 중';
  if (state.phase === 'GAME_OVER') return '게임 완료';
  return '주사위를 굴릴 차례';
}

function DiceFace({ value, className }: { value: number; className: string }) {
  return (
    <div className={`dice-face ${className}`} aria-hidden="true">
      {PIP_POSITIONS[value].map((position) => (
        <span key={position} className={`dice-pip pip-${position}`} />
      ))}
    </div>
  );
}

function DiceCube({ face, isRolling }: { face: number; isRolling: boolean }) {
  return (
    <div className="dice-cube-shell" aria-live="polite" aria-label={`주사위 ${face}`}>
      <div className={`dice-cube dice-face-${face}${isRolling ? ' rolling' : ''}`}>
        {FACE_VALUES.map(({ value, className }) => (
          <DiceFace key={value} value={value} className={className} />
        ))}
      </div>
    </div>
  );
}

export function DicePanel({ state, dispatch, canRoll }: DicePanelProps) {
  const face = state.phase === 'ROLLING' ? state.rollingFace : state.diceValue ?? state.rollingFace;

  return (
    <section className="dice-panel" aria-label="주사위와 이동">
      <div className="dice-readout">
        <DiceCube face={face} isRolling={state.phase === 'ROLLING'} />
        <div>
          <p className="panel-label">현재 상태</p>
          <strong>{phaseText(state)}</strong>
        </div>
      </div>

      <div className="remaining-box" aria-live="polite">
        <span>남은 이동 수</span>
        <strong>{state.remainingSteps}</strong>
      </div>

      <div className="action-grid">
        <button
          type="button"
          className="primary-action"
          onClick={() => dispatch({ type: 'ROLL_DICE_START' })}
          disabled={!canRoll}
          aria-label="주사위 굴리기"
        >
          <Dice5 size={20} aria-hidden="true" />
          주사위 굴리기
        </button>
      </div>

      <div className="utility-actions">
        <button type="button" onClick={() => dispatch({ type: 'RESET_GAME' })} aria-label="게임 리셋">
          <RotateCcw size={18} aria-hidden="true" />
          리셋
        </button>
        <button type="button" onClick={() => dispatch({ type: 'TOGGLE_SOUND' })} aria-label="소리 토글">
          {state.soundEnabled ? <Volume2 size={18} aria-hidden="true" /> : <VolumeX size={18} aria-hidden="true" />}
          {state.soundEnabled ? '소리 켬' : '소리 끔'}
        </button>
      </div>
    </section>
  );
}
