import type { ResolvedEvent, GamePhase, Player, BoardCell as BoardCellType } from '../game/types';
import { COLS, ROWS, cellCoord } from '../game/movement';
import { BoardCell } from './BoardCell';

interface BoardProps {
  cells: BoardCellType[];
  players: Player[];
  currentPlayerId: number;
  phase: GamePhase;
  activeEvent: ResolvedEvent | null;
  movementTick: number;
}

function ColoredTitle() {
  const chars = ['반', '복', '기', '호', '의', ' ', '마', '블'];
  const colors = ['#43c77a', '#4f7cff', '#ef476f', '#f0ad00', '#8d6bff'];

  return (
    <h2 className="board-title" aria-label="반복기호의 마블">
      {chars.map((char, index) => (
        <span key={`${char}-${index}`} style={{ color: char === ' ' ? 'inherit' : colors[index % colors.length] }}>
          {char}
        </span>
      ))}
    </h2>
  );
}

export function Board({ cells, players, currentPlayerId, phase, activeEvent, movementTick }: BoardProps) {
  const targetIndex = activeEvent?.targetIndex;

  return (
    <section className="board-shell" aria-label="40칸 음악 보드판">
      <div
        className="board-grid"
        style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, gridTemplateRows: `repeat(${ROWS}, 1fr)` }}
      >
        <div className="center-panel" style={{ gridColumn: '2 / 14', gridRow: '2 / 8' }}>
          <p className="center-kicker">Music Marble</p>
          <ColoredTitle />
          <p className="center-copy">주사위를 굴리면 나온 숫자만큼 자동으로 이동하고 악보의 반복·이동 기호를 만나요.</p>
          <div className="center-rules" aria-hidden="true">
            <span>자동 이동</span>
            <span>🎲 주사위</span>
            <span>🎵 기호 효과</span>
          </div>
        </div>

        {cells.map((cell) => {
          const { row, col } = cellCoord(cell.index);
          const cellPlayers = players.filter((player) => player.position === cell.index);

          return (
            <BoardCell
              key={cell.index}
              cell={cell}
              players={cellPlayers}
              currentPlayerId={currentPlayerId}
              isTarget={targetIndex === cell.index}
              isMoving={phase === 'MOVING'}
              movementTick={movementTick}
              style={{ gridColumn: col + 1, gridRow: row + 1 }}
            />
          );
        })}
      </div>
    </section>
  );
}
