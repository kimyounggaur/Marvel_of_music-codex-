import { getSymbolMeta } from '../data/symbolMeta';
import type { ResolvedEvent } from '../game/types';

interface EventOverlayProps {
  event: ResolvedEvent | null;
}

function overlayMessage(event: ResolvedEvent): string {
  switch (event.type) {
    case 'MOVE_FORWARD':
      return `${event.steps ?? 0}칸 앞으로!`;
    case 'MOVE_BACKWARD':
      return `${event.steps ?? 0}칸 뒤로!`;
    case 'JUMP_TO_INDEX':
      return `${event.targetIndex}번 칸으로 이동!`;
    case 'SKIP_TURNS':
      return `${event.skipTurns ?? 0}번 쉬기!`;
    case 'GAME_FINISH':
      return 'Fine! 완성!';
    case 'NONE':
      return '';
  }
}

function overlayIcon(event: ResolvedEvent): string {
  if (event.animationClass === 'fx-rocket-dash') return '🚀';
  if (event.animationClass === 'fx-rewind') return '⏪';
  if (event.animationClass === 'fx-segno-fly') return '𝄋';
  if (event.animationClass === 'fx-coda-portal') return '⊕';
  if (event.animationClass === 'fx-spotlight-start') return '🎯';
  if (event.animationClass === 'fx-spring-jump') return '↗';
  if (event.animationClass === 'fx-ice-freeze') return '𝄐';
  if (event.animationClass === 'fx-hologram') return '%%';
  if (event.animationClass === 'fx-wormhole') return '⊕⊕';
  if (event.animationClass === 'fx-octave-drop') return '8vb';
  if (event.animationClass === 'fx-finale') return '🏁';
  return '♪';
}

export function EventOverlay({ event }: EventOverlayProps) {
  if (!event) return null;

  const meta = getSymbolMeta(event.kind);

  return (
    <div className={`event-overlay ${event.animationClass}`} aria-live="polite" aria-label={`${meta?.name ?? ''} 이벤트`}>
      <div className="fx-layer">
        <span className="fx-ring ring-one" />
        <span className="fx-ring ring-two" />
        <span className="fx-spark spark-one" />
        <span className="fx-spark spark-two" />
        <span className="fx-spark spark-three" />
      </div>
      <div className="overlay-card">
        <span className="overlay-icon">{overlayIcon(event)}</span>
        <strong>{meta?.name ?? '이벤트'}</strong>
        <p>{overlayMessage(event)}</p>
      </div>
    </div>
  );
}
