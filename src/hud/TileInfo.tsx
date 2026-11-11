// 칸 도감: 보드의 기호 칸을 누르면 그 기호의 뜻과 이 게임에서의 효과를 보여준다.
import type { CSSProperties } from 'react';
import { X } from 'lucide-react';
import { BOARD } from '../data/boardCells';
import { getSymbolMeta } from '../data/symbolMeta';
import { resolveCellEvent } from '../game/rules';
import type { BoardCell } from '../game/types';
import { FAMILY_COLORS, familyOf } from '../three/palette';
import { SymbolIcon } from './SymbolIcon';

/** 이 칸을 밟으면 어디로 가는가(이동 기호가 아니면 null) */
export function destinationOf(index: number): number | null {
  const event = resolveCellEvent(BOARD, index);
  return event.type === 'JUMP_TO_INDEX' && event.targetIndex !== undefined ? event.targetIndex : null;
}

/** 이 칸으로 보내는 기호 칸들 */
function sourcesOf(index: number): BoardCell[] {
  return BOARD.filter((cell) => cell.index !== index && destinationOf(cell.index) === index);
}

function cellName(cell: BoardCell): string {
  if (cell.kind === 'START') return '출발';
  return getSymbolMeta(cell.kind)?.name ?? `${cell.index}번`;
}

/** 도감에 보여줄 내용이 있는 칸인가 */
export function hasTileInfo(index: number): boolean {
  const cell = BOARD[index];
  return cell !== undefined && cell.kind !== 'NORMAL';
}

interface TileInfoProps {
  index: number;
  onClose: () => void;
}

export function TileInfo({ index, onClose }: TileInfoProps) {
  const cell = BOARD[index];
  if (!cell || cell.kind === 'NORMAL') return null;
  const meta = getSymbolMeta(cell.kind);
  const color = FAMILY_COLORS[familyOf(cell.kind)];
  const destination = destinationOf(index);
  const sources = sourcesOf(index);

  const title = cell.kind === 'START' ? '출발' : meta?.name ?? cell.label;
  const subtitle = cell.kind === 'START' ? 'Start' : meta?.nameEn ?? '';
  const meaning = cell.kind === 'START' ? '곡이 시작되는 자리예요.' : meta?.meaning ?? '';
  let effect = cell.kind === 'START' ? '한 바퀴를 돌아 이 칸을 다시 지나면 우승이에요.' : meta?.effect ?? '';
  if (cell.kind === 'MULTI_REST') effect = `${cell.count ?? 0}칸 앞으로 달려요.`;

  return (
    <aside
      className="g3-tile-info"
      style={{ '--family': color.body, '--family-deep': color.band } as CSSProperties}
      aria-label={`${title} 칸 설명`}
    >
      <button type="button" className="g3-icon-button g3-tile-info-close" onClick={onClose} aria-label="설명 닫기">
        <X size={18} aria-hidden="true" />
      </button>
      <div className="g3-tile-info-head">
        <span className="g3-tile-info-symbol">
          <SymbolIcon kind={cell.kind} count={cell.count} />
        </span>
        <div>
          <h2>{title}</h2>
          {subtitle ? <p className="g3-tile-info-en">{subtitle}</p> : null}
        </div>
      </div>
      <dl>
        <div>
          <dt>악보에서는</dt>
          <dd>{meaning}</dd>
        </div>
        <div>
          <dt>이 칸에서는</dt>
          <dd>{effect}</dd>
        </div>
      </dl>
      {destination !== null ? (
        <p className="g3-tile-info-route">
          밟으면 <strong>{cellName(BOARD[destination])}</strong> 칸으로 날아가요. 판 위의 점선을 따라가 보세요.
        </p>
      ) : null}
      {destination === null && sources.length > 0 ? (
        <p className="g3-tile-info-route">
          <strong>{sources.map((source) => cellName(source)).join(', ')}</strong> 칸을 밟으면 여기로 와요.
        </p>
      ) : null}
    </aside>
  );
}
