import { Dice5, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import type { Dispatch } from 'react';
import type { GameAction } from '../game/reducer';
import type { GameState } from '../game/types';

interface DicePanelProps {
  state: GameState;
  dispatch: Dispatch<GameAction>;
  canRoll: boolean;
}

function phaseText(state: GameState): string {
  if (state.phase === 'ROLLING') return '주사위를 굴리는 중';
  if (state.phase === 'MOVING') return `${state.remainingSteps}칸 자동 이동 중`;
  if (state.phase === 'RESOLVING_EVENT') return '기호 효과 실행 중';
  if (state.phase === 'GAME_OVER') return '게임 완료';
  return '주사위를 굴릴 차례';
}

export function DicePanel({ state, dispatch, canRoll }: DicePanelProps) {
  const face = state.phase === 'ROLLING' ? state.rollingFace : state.diceValue ?? state.rollingFace;

  return (
    <section className="dice-panel" aria-label="주사위와 이동">
      <div className="dice-readout">
        <div className={state.phase === 'ROLLING' ? 'dice-cube rolling' : 'dice-cube'} aria-live="polite">
          {face}
        </div>
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
