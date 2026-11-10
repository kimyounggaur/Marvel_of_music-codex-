import { useRef, useState } from 'react';
import { Dices, Snowflake } from 'lucide-react';
import type { GameState } from '../game/types';

interface RollButtonProps {
  state: GameState;
  canRoll: boolean;
  /** power: 0~1. 버튼을 꾹 눌렀다 떼면 게이지에 따라 던지는 세기가 달라진다(눈의 확률은 그대로) */
  onRoll: (power: number) => void;
}

/** 게이지가 한 번 차오르는 데 걸리는 시간 */
const CHARGE_MS = 900;
const DEFAULT_POWER = 0.55;

function statusLine(state: GameState, frozen: boolean): string {
  switch (state.phase) {
    case 'ROLLING':
      return '주사위가 구르는 중';
    case 'MOVING':
      return state.movement?.origin === 'event' ? '기호 효과로 달리는 중' : `남은 이동 ${state.remainingSteps}칸`;
    case 'RESOLVING_EVENT':
      return state.activeEvent ? '기호 효과 발동' : '칸을 확인하는 중';
    case 'GAME_OVER':
      return '게임 끝';
    default: {
      if (frozen) return '페르마타로 쉬는 차례예요';
      // 처음 몇 차례만 조작법을 알려 주고, 그 뒤로는 누구 차례인지 보여준다
      if (state.turnCount <= 3) return '꾹 눌렀다 떼면 더 세게 던져요';
      const current = state.players[state.currentPlayer];
      return current ? `${current.name} 차례예요` : '주사위를 굴릴 차례예요';
    }
  }
}

export function RollButton({ state, canRoll, onRoll }: RollButtonProps) {
  const [charging, setCharging] = useState(false);
  const pressedAt = useRef<number | null>(null);
  const releasedPower = useRef<number | null>(null);
  const current = state.players[state.currentPlayer];
  const frozen = canRoll && (current?.skipTurns ?? 0) > 0;

  const powerNow = (): number => {
    if (pressedAt.current === null) return DEFAULT_POWER;
    // 0 → 1 → 0 으로 오가는 게이지
    const t = (performance.now() - pressedAt.current) / CHARGE_MS;
    const wave = 1 - Math.abs((t % 2) - 1);
    return 0.2 + wave * 0.8;
  };

  const release = (): void => {
    if (pressedAt.current !== null) releasedPower.current = powerNow();
    pressedAt.current = null;
    setCharging(false);
  };

  return (
    <div className="g3-roll">
      <p className="g3-roll-status" aria-live="polite">
        {statusLine(state, frozen)}
      </p>
      <button
        type="button"
        className={['g3-roll-button', frozen ? 'is-frozen' : '', charging ? 'is-charging' : ''].filter(Boolean).join(' ')}
        disabled={!canRoll}
        aria-label={frozen ? '쉬어가기' : '주사위 굴리기'}
        onPointerDown={(event) => {
          if (!canRoll || frozen || event.button !== 0) return;
          pressedAt.current = performance.now();
          releasedPower.current = null;
          setCharging(true);
        }}
        onPointerUp={release}
        onPointerLeave={release}
        onPointerCancel={release}
        onClick={() => {
          const power = releasedPower.current ?? DEFAULT_POWER;
          releasedPower.current = null;
          onRoll(power);
        }}
      >
        <svg className="g3-roll-gauge" viewBox="0 0 120 120" aria-hidden="true">
          <circle className="g3-roll-gauge-track" cx="60" cy="60" r="54" />
          <circle className="g3-roll-gauge-fill" cx="60" cy="60" r="54" pathLength={100} />
        </svg>
        <span className="g3-roll-face">
          {frozen ? <Snowflake size={30} aria-hidden="true" /> : <Dices size={30} aria-hidden="true" />}
          <span>{frozen ? '쉬어가기' : '굴리기'}</span>
        </span>
      </button>
    </div>
  );
}
