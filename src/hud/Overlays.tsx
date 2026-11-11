// 게임 진행 중 잠깐 떴다 사라지는 화면 요소들: 기호 배너, 주사위 눈, 차례 알림, 기록
import { useEffect, useState, type CSSProperties } from 'react';
import { ScrollText, X } from 'lucide-react';
import { BOARD } from '../data/boardCells';
import { getSymbolMeta } from '../data/symbolMeta';
import type { Player, ResolvedEvent } from '../game/types';
import { FAMILY_COLORS, familyOf } from '../three/palette';
import { SymbolIcon } from './SymbolIcon';

/** 값이 사라진 뒤에도 ms 동안 마지막 값을 붙잡아 둔다(퇴장 애니메이션용) */
function useLinger<T>(value: T | null, ms: number): { shown: T | null; leaving: boolean } {
  const [shown, setShown] = useState<T | null>(value);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (value !== null) {
      setShown(value);
      setLeaving(false);
      return undefined;
    }
    setLeaving(true);
    const timeout = window.setTimeout(() => {
      setShown(null);
      setLeaving(false);
    }, ms);
    return () => window.clearTimeout(timeout);
  }, [value, ms]);

  return { shown, leaving };
}

function effectLine(event: ResolvedEvent): string {
  switch (event.type) {
    case 'MOVE_FORWARD':
      return `${event.steps ?? 0}칸 앞으로 달려요!`;
    case 'SKIP_TURNS':
      return `${event.skipTurns ?? 0}번 쉬어요`;
    case 'GAME_FINISH':
      return '곡이 끝났어요. 우승!';
    case 'JUMP_TO_INDEX': {
      const target = event.targetIndex !== undefined ? BOARD[event.targetIndex] : undefined;
      if (!target) return '';
      if (target.kind === 'START') return '곡의 처음, 출발 칸으로!';
      const name = getSymbolMeta(target.kind)?.name;
      return name ? `${name} 칸으로 이동!` : `${target.index}번 칸으로 이동!`;
    }
    default:
      return '';
  }
}

export function EventBanner({ event }: { event: ResolvedEvent | null }) {
  const { shown, leaving } = useLinger(event, 260);
  if (!shown) return null;
  const meta = getSymbolMeta(shown.kind);
  const cell = BOARD[shown.sourceIndex];
  const color = FAMILY_COLORS[familyOf(shown.kind)];

  return (
    <div
      className={leaving ? 'g3-banner is-leaving' : 'g3-banner'}
      style={{ '--family': color.body, '--family-deep': color.band } as CSSProperties}
      role="status"
      aria-live="polite"
    >
      <span className="g3-banner-symbol">
        <SymbolIcon kind={shown.kind} count={cell?.count} />
      </span>
      <span className="g3-banner-text">
        <strong>{meta?.name ?? '기호 효과'}</strong>
        <span>{effectLine(shown)}</span>
      </span>
    </div>
  );
}

/** 주사위가 멈췄을 때 눈을 크게 한 번 보여준다 */
export function DiceCallout({ value, turnKey }: { value: number | null; turnKey: number }) {
  const [shown, setShown] = useState<number | null>(null);

  useEffect(() => {
    if (value === null) {
      setShown(null);
      return undefined;
    }
    setShown(value);
    const timeout = window.setTimeout(() => setShown(null), 1050);
    return () => window.clearTimeout(timeout);
  }, [value, turnKey]);

  if (shown === null) return null;
  return (
    <div className="g3-dice-callout" role="status" aria-live="polite" aria-label={`주사위 ${shown}`}>
      <strong>{shown}</strong>
      <span>칸 이동</span>
    </div>
  );
}

/** 여럿이 할 때 차례가 넘어가면 잠깐 알린다 */
export function TurnFlag({ player, active }: { player: Player | undefined; active: boolean }) {
  const [shown, setShown] = useState(false);
  const id = player?.id;

  useEffect(() => {
    if (!active || id === undefined) {
      setShown(false);
      return undefined;
    }
    setShown(true);
    const timeout = window.setTimeout(() => setShown(false), 1300);
    return () => window.clearTimeout(timeout);
  }, [active, id]);

  if (!shown || !player) return null;
  return (
    <div className="g3-turn-flag" style={{ '--player': player.color } as CSSProperties} role="status" aria-live="polite">
      {player.name} 차례
    </div>
  );
}

/** 가장 최근 기록 한 줄 + 누르면 전체 기록 */
export function LogToast({ logs }: { logs: string[] }) {
  const [open, setOpen] = useState(false);
  // 한 칸씩 움직인 기록은 너무 잦아서 한 줄 알림에서는 뺀다
  const latest = logs.find((log) => !log.startsWith('➡️')) ?? '';

  return (
    <>
      <button
        type="button"
        className="g3-log-toast"
        onClick={() => setOpen(true)}
        aria-label="기록 전체 보기"
        title="기록 전체 보기"
      >
        <ScrollText size={18} aria-hidden="true" />
        <span key={latest}>{latest || '아직 기록이 없어요'}</span>
      </button>

      {open ? (
        <div className="g3-sheet-backdrop" role="presentation" onClick={() => setOpen(false)}>
          <section
            className="g3-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="게임 기록"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <h2>게임 기록</h2>
              <button type="button" className="g3-icon-button" onClick={() => setOpen(false)} aria-label="기록 닫기" autoFocus>
                <X size={20} aria-hidden="true" />
              </button>
            </header>
            {logs.length === 0 ? (
              <p className="g3-sheet-empty">주사위를 굴리면 여기에 기록이 쌓여요.</p>
            ) : (
              <ol>
                {logs.map((log, index) => (
                  <li key={`${log}-${index}`}>{log}</li>
                ))}
              </ol>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
