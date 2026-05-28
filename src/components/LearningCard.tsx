import { useEffect, useState } from 'react';
import { getSymbolMeta } from '../data/symbolMeta';
import type { ResolvedEvent } from '../game/types';

interface LearningCardProps {
  events: ResolvedEvent[];
  onClose: () => void;
}

export function LearningCard({ events, onClose }: LearningCardProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [events]);

  if (events.length === 0) return null;

  const event = events[Math.min(index, events.length - 1)];
  const meta = getSymbolMeta(event.kind);
  if (!meta) return null;
  const isLast = index === events.length - 1;

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="learning-card" role="dialog" aria-modal="true" aria-labelledby="learning-title">
        <div className="learning-symbol" aria-hidden="true">
          {meta.fallback}
        </div>
        <p className="eyebrow">
          이번 턴 학습 {index + 1}/{events.length}
        </p>
        <h2 id="learning-title">
          {meta.name} <span>{meta.nameEn}</span>
        </h2>
        <dl>
          <div>
            <dt>악보 의미</dt>
            <dd>{meta.meaning}</dd>
          </div>
          <div>
            <dt>게임 효과</dt>
            <dd>{meta.effect}</dd>
          </div>
          <div>
            <dt>기억법</dt>
            <dd>{meta.mnemonic}</dd>
          </div>
        </dl>
        <div className="learning-actions">
          {events.length > 1 ? (
            <button
              type="button"
              onClick={() => setIndex((current) => Math.min(events.length - 1, current + 1))}
              disabled={isLast}
            >
              다음 기호
            </button>
          ) : null}
          <button type="button" className="primary-action" onClick={onClose} autoFocus>
            계속하기
          </button>
        </div>
      </section>
    </div>
  );
}
