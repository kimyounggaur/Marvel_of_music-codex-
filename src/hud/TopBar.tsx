import { useEffect, useState, type ReactNode } from 'react';
import { LayoutGrid, LocateFixed, Map as MapIcon, Music, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import type { ViewMode } from '../three/Stage';

interface TopBarProps {
  turnCount: number;
  soundOn: boolean;
  musicOn: boolean;
  viewMode: ViewMode;
  onToggleSound: () => void;
  onToggleMusic: () => void;
  onToggleView: () => void;
  onSwitch2D: () => void;
  onReset: () => void;
  /** 이름표와 도구 버튼 사이에 놓이는 내용(플레이어 칩) */
  children?: ReactNode;
}

export function TopBar({
  turnCount,
  soundOn,
  musicOn,
  viewMode,
  onToggleSound,
  onToggleMusic,
  onToggleView,
  onSwitch2D,
  onReset,
  children,
}: TopBarProps) {
  // 새 게임은 실수로 누르기 쉬워서 두 번 눌러야 실행된다
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return undefined;
    const timeout = window.setTimeout(() => setArmed(false), 3200);
    return () => window.clearTimeout(timeout);
  }, [armed]);

  return (
    <header className="g3-topbar">
      <div className="g3-brand">
        <span className="g3-brand-name">반복기호의 마블</span>
        <span className="g3-turn-count" aria-live="polite">
          {turnCount}번째 차례
        </span>
      </div>

      {children}

      <div className="g3-tools">
        <button
          type="button"
          className="g3-icon-button"
          aria-pressed={soundOn}
          aria-label={soundOn ? '효과음 끄기' : '효과음 켜기'}
          title={soundOn ? '효과음 끄기' : '효과음 켜기'}
          onClick={onToggleSound}
        >
          {soundOn ? <Volume2 size={20} aria-hidden="true" /> : <VolumeX size={20} aria-hidden="true" />}
        </button>
        <button
          type="button"
          className="g3-icon-button"
          aria-pressed={musicOn}
          aria-label={musicOn ? '배경음 끄기' : '배경음 켜기'}
          title={musicOn ? '배경음 끄기' : '배경음 켜기'}
          onClick={onToggleMusic}
        >
          <Music size={20} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="g3-icon-button"
          aria-label={viewMode === 'follow' ? '판 전체 보기' : '내 말 따라가기'}
          title={viewMode === 'follow' ? '판 전체 보기' : '내 말 따라가기'}
          onClick={onToggleView}
        >
          {viewMode === 'follow' ? <MapIcon size={20} aria-hidden="true" /> : <LocateFixed size={20} aria-hidden="true" />}
        </button>
        <button
          type="button"
          className="g3-icon-button"
          aria-label="2D 판으로 보기"
          title="2D 판으로 보기"
          onClick={onSwitch2D}
        >
          <LayoutGrid size={20} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={armed ? 'g3-icon-button g3-armed' : 'g3-icon-button'}
          aria-label={armed ? '한 번 더 누르면 새 게임을 시작해요' : '새 게임'}
          title="새 게임"
          onClick={() => {
            if (armed) {
              setArmed(false);
              onReset();
            } else {
              setArmed(true);
            }
          }}
        >
          <RotateCcw size={20} aria-hidden="true" />
          {armed ? <span className="g3-armed-text">한 번 더!</span> : null}
        </button>
      </div>
    </header>
  );
}
