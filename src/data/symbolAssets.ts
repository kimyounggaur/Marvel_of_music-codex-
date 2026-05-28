import type { BoardCell, CellKind } from '../game/types';

const withBase = (path: string): string => `${import.meta.env.BASE_URL}${path}`;

const SYMBOL_ASSETS: Partial<Record<CellKind, string>> = {
  REPEAT_START: withBase('assets/symbols/repeat-start.png'),
  REPEAT_END: withBase('assets/symbols/repeat-end.png'),
  SEGNO: withBase('assets/symbols/segno.png'),
  CODA: withBase('assets/symbols/coda.png'),
  FERMATA: withBase('assets/symbols/fermata.png'),
  FIRST_ENDING: withBase('assets/symbols/first-ending.png'),
  SECOND_ENDING: withBase('assets/symbols/second-ending.png'),
};

export function getCellAsset(cell: BoardCell): string | null {
  if (cell.kind === 'MULTI_REST') {
    return cell.count === 2
      ? withBase('assets/symbols/multi-rest-02.png')
      : withBase('assets/symbols/multi-rest-01.png');
  }

  return SYMBOL_ASSETS[cell.kind] ?? null;
}
