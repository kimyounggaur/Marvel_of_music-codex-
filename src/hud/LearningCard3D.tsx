// 차례가 끝난 뒤 뜨는 학습 카드: 이번 차례에 만난 기호를 한 장씩 복습한다.
import { useEffect, useState, type CSSProperties } from 'react';
import { BOARD } from '../data/boardCells';
import { getSymbolMeta } from '../data/symbolMeta';
import type { ResolvedEvent } from '../game/types';
import { FAMILY_COLORS, familyOf } from '../three/palette';
import { SymbolIcon } from './SymbolIcon';

interface LearningCardProps {
  events: ResolvedEvent[];
  onClose: () => void;
  onFlip?: () => void;
}

export function LearningCard3D({ events, onClose, onFlip }: LearningCardProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [events]);

  if (events.length === 0) return null;

  const event = events[Math.min(index, events.length - 1)];
  const meta = getSymbolMeta(event.kind);
  if (!meta) return null;
  const cell = BOARD[event.sourceIndex];
  const color = FAMILY_COLORS[familyOf(event.kind)];
  const isLast = index >= events.length - 1;
  const effect = event.kind === 'MULTI_REST' ? `${event.steps ?? cell?.count ?? 0}칸 앞으로 이동!` : meta.effect;

  return (
    <div className="g3-modal-backdrop" role="presentation">
      <section
        key={index}
        className="g3-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="g3-card-title"
        style={{ '--family': color.body, '--family-deep': color.band } as CSSProperties}
      >
        <p className="g3-card-count">
          이번 차례에 만난 기호 {index + 1} / {events.length}
        </p>
        <div className="g3-card-symbol">
          <SymbolIcon kind={event.kind} count={cell?.count} />
        </div>
        <h2 id="g3-card-title">
          {meta.name} <span>{meta.nameEn}</span>
        </h2>
        <dl>
          <div>
            <dt>악보 의미</dt>
            <dd>{meta.meaning}</dd>
          </div>
          <div>
            <dt>게임 효과</dt>
            <dd>{effect}</dd>
          </div>
          <div>
            <dt>기억법</dt>
            <dd>{meta.mnemonic}</dd>
          </div>
        </dl>
        <div className="g3-card-actions">
          {isLast ? (
            <button type="button" className="g3-primary" onClick={onClose} autoFocus>
              계속하기
            </button>
          ) : (
            <button
              type="button"
              className="g3-primary"
              autoFocus
              onClick={() => {
                onFlip?.();
                setIndex((value) => Math.min(events.length - 1, value + 1));
              }}
            >
              다음 기호
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
