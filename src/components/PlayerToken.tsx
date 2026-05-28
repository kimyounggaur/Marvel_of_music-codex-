import type { CSSProperties } from 'react';
import type { Player } from '../game/types';

interface PlayerTokenProps {
  player: Player;
  isCurrent: boolean;
  isMoving: boolean;
  offsetIndex: number;
  movementTick: number;
}

export function PlayerToken({ player, isCurrent, isMoving, offsetIndex, movementTick }: PlayerTokenProps) {
  const style = {
    '--player-color': player.color,
    '--token-offset-x': `${offsetIndex * 9}px`,
    '--token-offset-y': `${offsetIndex * 6}px`,
  } as CSSProperties;

  return (
    <span
      className={[
        'player-token',
        isCurrent ? 'current-token' : '',
        isMoving ? 'token-moving' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={style}
      data-hop={movementTick}
      title={player.name}
    >
      <svg viewBox="0 0 64 64" role="img" aria-label={`${player.name} 말`}>
        <ellipse className="token-shadow" cx="31" cy="56" rx="15" ry="4" />
        <path
          className="token-note-tail"
          d="M40 11v29c0 10-7 17-17 17-8 0-14-5-14-12 0-8 7-13 16-13 3 0 6 1 8 2V13c0-3 2-5 5-5 5 0 10 4 14 8 2 2 2 6 0 8-2 1-4 1-6 0l-6-4z"
        />
        <circle className="token-face" cx="24" cy="44" r="13" />
        <circle className="token-eye" cx="20" cy="41" r="2" />
        <circle className="token-eye" cx="29" cy="41" r="2" />
        <path className="token-smile" d="M20 48c3 3 7 3 10 0" />
        <path className="token-spark" d="M49 32l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" />
      </svg>
    </span>
  );
}
