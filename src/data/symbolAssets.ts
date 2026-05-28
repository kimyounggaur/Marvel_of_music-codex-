import type { BoardCell, CellKind } from '../game/types';

const SYMBOL_ASSETS: Partial<Record<CellKind, string>> = {
  REPEAT_START: '/assets/symbols/repeat-start.png',
  REPEAT_END: '/assets/symbols/repeat-end.png',
  SEGNO: '/assets/symbols/segno.png',
  CODA: '/assets/symbols/coda.png',
  FERMATA: '/assets/symbols/fermata.png',
  FIRST_ENDING: '/assets/symbols/first-ending.jpg',
  SECOND_ENDING: '/assets/symbols/second-ending.jpg',
  OCTAVE_DOWN: '/assets/symbols/octave-down.png',
};

export function getCellAsset(cell: BoardCell): string | null {
  if (cell.kind === 'MULTI_REST') {
    return cell.count === 2 ? '/assets/symbols/multi-rest-02.png' : '/assets/symbols/multi-rest-01.png';
  }

  return SYMBOL_ASSETS[cell.kind] ?? null;
}
