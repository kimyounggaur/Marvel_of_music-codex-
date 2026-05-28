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
  if (cell.kind === 'NORMAL') return '일반 칸';
  if (cell.kind === 'START') return 'Start 칸';
  return `${meta?.name ?? cell.label} 칸`;
}

function cellFamily(cell: BoardCellType): string {
  if (cell.kind === 'START' || cell.kind === 'FINE') return 'finish';
  if (cell.kind === 'REPEAT_START' || cell.kind === 'REPEAT_END' || cell.kind === 'FIRST_ENDING' || cell.kind === 'SECOND_ENDING') {
    return 'repeat';
  }
  if (cell.kind === 'DAL_SEGNO' || cell.kind === 'SEGNO' || cell.kind === 'DA_CAPO' || cell.kind === 'DOUBLE_SEGNO' || cell.kind === 'DOUBLE_SEGNO_TRIGGER') {
    return 'jump';
  }
  if (cell.kind === 'CODA' || cell.kind === 'DOUBLE_CODA') return 'coda';
  if (cell.kind === 'MULTI_REST' || cell.kind === 'FERMATA') return 'rest';
  return 'normal';
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
  const showCellContent = cell.kind !== 'NORMAL';
  const showKoreanName = cell.kind !== 'START' && meta !== null;
  const className = [
    'board-cell',
    `side-${cell.side}`,
    `kind-${cell.kind.toLowerCase().replace(/_/g, '-')}`,
    `cell-family-${cellFamily(cell)}`,
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
      {showCellContent ? (
        <div className="cell-content" aria-hidden="true">
          <div className="cell-symbol">
            {asset && !assetFailed ? (
              <img src={asset} alt="" onError={() => setAssetFailed(true)} />
            ) : (
              <span className="symbol-fallback">{meta?.fallback ?? cell.label}</span>
            )}
          </div>
          {showKoreanName ? <span className="cell-korean-name">{meta.name}</span> : null}
        </div>
      ) : null}
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
