import { useState, type CSSProperties } from 'react';
import { getCellAsset } from '../data/symbolAssets';
import { getSymbolMeta } from '../data/symbolMeta';
import type { BoardCell as BoardCellType, Player } from '../game/types';
import { PlayerToken } from './PlayerToken';

interface BoardCellProps {
  cell: BoardCellType;
  players: Player[];
  currentPlayerId: number;
  isTarget: boolean;
  isMoving: boolean;
  movementTick: number;
  style: CSSProperties;
}

function cellTitle(cell: BoardCellType): string {
  const meta = getSymbolMeta(cell.kind);
  if (cell.kind === 'NORMAL') return `${cell.index}번 일반 칸`;
  if (cell.kind === 'START') return 'Start 칸';
  return `${cell.index}번 ${meta?.name ?? cell.label} 칸`;
}

export function BoardCell({
  cell,
  players,
  currentPlayerId,
  isTarget,
  isMoving,
  movementTick,
  style,
}: BoardCellProps) {
  const [assetFailed, setAssetFailed] = useState(false);
  const asset = getCellAsset(cell);
  const meta = getSymbolMeta(cell.kind);
  const currentHere = players.some((player) => player.id === currentPlayerId);
  const className = [
    'board-cell',
    `side-${cell.side}`,
    cell.isCorner ? 'corner-cell' : '',
    cell.markerOnly ? 'marker-cell' : '',
    currentHere ? 'current-cell' : '',
    isTarget ? 'target-cell' : '',
    cell.kind !== 'NORMAL' && cell.kind !== 'START' ? 'special-cell' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <article className={className} style={style} aria-label={cellTitle(cell)}>
      <span className="cell-index">{cell.index}</span>
      <div className="cell-symbol" aria-hidden="true">
        {asset && !assetFailed ? (
          <img src={asset} alt="" onError={() => setAssetFailed(true)} />
        ) : (
          <span className="symbol-fallback">{meta?.fallback ?? cell.label}</span>
        )}
      </div>
      <span className="cell-label">{cell.label}</span>
      {cell.markerOnly ? <span className="marker-badge">목표</span> : null}
      <div className="token-stack" aria-hidden="true">
        {players.map((player, index) => (
          <PlayerToken
            key={player.id}
            player={player}
            isCurrent={player.id === currentPlayerId}
            isMoving={player.id === currentPlayerId && isMoving}
            offsetIndex={index}
            movementTick={movementTick}
          />
        ))}
      </div>
    </article>
  );
}
