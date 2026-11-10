// 게임 앞뒤의 큰 화면: 시작(인원 선택)과 우승
import type { CSSProperties } from 'react';
import { Play, RotateCcw, Trophy } from 'lucide-react';
import type { Player } from '../game/types';
import { TokenIcon } from './TokenIcon';

const PLAYER_COLORS = ['#ef476f', '#4f7cff', '#43c77a', '#f0ad00'];

interface SetupPanelProps {
  selected: number;
  onSelect: (count: number) => void;
  onStart: () => void;
  onSwitch2D: () => void;
}

export function SetupPanel({ selected, onSelect, onStart, onSwitch2D }: SetupPanelProps) {
  return (
    <section className="g3-setup" aria-label="플레이어 선택">
      <h1 className="g3-sr-only">반복기호의 마블</h1>
      <p className="g3-setup-question">몇 명이 함께 할까요?</p>
      <div className="g3-count-grid" role="group" aria-label="플레이어 수">
        {[1, 2, 3, 4].map((count) => (
          <button
            key={count}
            type="button"
            className={selected === count ? 'g3-count is-selected' : 'g3-count'}
            aria-pressed={selected === count}
            onClick={() => onSelect(count)}
          >
            <span className="g3-count-tokens" aria-hidden="true">
              {PLAYER_COLORS.slice(0, count).map((color) => (
                <TokenIcon key={color} color={color} size={22} />
              ))}
            </span>
            {count}명
          </button>
        ))}
      </div>
      <button type="button" className="g3-primary g3-start" onClick={onStart} aria-label="선택한 인원으로 게임 시작">
        <Play size={22} aria-hidden="true" />
        게임 시작
      </button>
      <p className="g3-setup-rule">한 바퀴를 먼저 돌거나 Fine 칸에 도착하면 우승이에요.</p>
      <button type="button" className="g3-text-button" onClick={onSwitch2D}>
        2D 판으로 하기
      </button>
    </section>
  );
}

interface WinnerPanelProps {
  winner: Player;
  onRestart: () => void;
}

export function WinnerPanel({ winner, onRestart }: WinnerPanelProps) {
  return (
    <section
      className="g3-winner"
      style={{ '--player': winner.color } as CSSProperties}
      role="dialog"
      aria-label="게임 결과"
      aria-live="polite"
    >
      <span className="g3-winner-trophy" aria-hidden="true">
        <Trophy size={40} />
      </span>
      <div className="g3-winner-name">
        <TokenIcon color={winner.color} size={44} />
        <strong>{winner.name} 우승!</strong>
      </div>
      <p>반복기호 여행을 완성했어요.</p>
      <button type="button" className="g3-primary" onClick={onRestart} autoFocus>
        <RotateCcw size={20} aria-hidden="true" />
        다시 하기
      </button>
    </section>
  );
}
