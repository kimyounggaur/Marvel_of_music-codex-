import type { GameState } from '../game/types';

interface PlayerStatusBarProps {
  state: GameState;
}

export function PlayerStatusBar({ state }: PlayerStatusBarProps) {
  const current = state.players[state.currentPlayer];

  return (
    <section className="status-panel" aria-label="플레이어 상태">
      <div className="section-heading" aria-live="polite">
        <p className="panel-label">현재 턴</p>
        <strong>{current.name}</strong>
      </div>
      <div className="player-list">
        {state.players.map((player, index) => (
          <article
            key={player.id}
            className={index === state.currentPlayer ? 'player-row active' : 'player-row'}
            style={{ '--player-color': player.color } as React.CSSProperties}
          >
            <span className="player-dot" aria-hidden="true" />
            <span>{player.name}</span>
            <small>{player.skipTurns > 0 ? `쉬기 ${player.skipTurns}` : `${player.position}번`}</small>
          </article>
        ))}
      </div>
    </section>
  );
}
