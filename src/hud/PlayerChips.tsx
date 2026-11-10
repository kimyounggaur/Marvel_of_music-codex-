import type { CSSProperties } from 'react';
import type { GameState, Player } from '../game/types';
import { TokenIcon } from './TokenIcon';

interface PlayerChipsProps {
  state: GameState;
}

function statusText(player: Player): string {
  if (player.finished) return '도착!';
  if (player.skipTurns > 0) return `쉬는 중 ${player.skipTurns}`;
  if (player.position === 0) return '출발 칸';
  return `${player.position}번 칸`;
}

export function PlayerChips({ state }: PlayerChipsProps) {
  const playing = state.winnerId === null;

  return (
    <ul className="g3-players" aria-label="플레이어" data-count={state.players.length}>
      {state.players.map((player, index) => {
        const current = playing && index === state.currentPlayer;
        // "빨강 음표" → 좁은 화면에서는 "빨강"만 보여준다
        const [head, ...rest] = player.name.split(' ');
        const tail = rest.join(' ');
        return (
          <li
            key={player.id}
            className={['g3-player', current ? 'is-current' : '', player.skipTurns > 0 ? 'is-frozen' : '']
              .filter(Boolean)
              .join(' ')}
            style={{ '--player': player.color } as CSSProperties}
            aria-current={current ? 'true' : undefined}
          >
            <TokenIcon color={player.color} size={30} />
            <span className="g3-player-text">
              <strong>
                {head}
                {tail ? <span className="g3-player-suffix"> {tail}</span> : null}
              </strong>
              <small>{statusText(player)}</small>
            </span>
            {current ? <span className="g3-player-flag">차례</span> : null}
          </li>
        );
      })}
    </ul>
  );
}
