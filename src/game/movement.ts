export const COLS = 14;
export const ROWS = 8;
export const BOARD_LEN = 40;

export function cellCoord(i: number): { row: number; col: number } {
  if (i <= 13) return { row: 0, col: i };
  if (i <= 19) return { row: i - 13, col: 13 };
  if (i <= 33) return { row: 7, col: 13 - (i - 20) };
  return { row: 6 - (i - 34), col: 0 };
}

export const stepForward = (pos: number, len: number): number => (pos + 1) % len;

export const stepBackward = (pos: number, n: number, len: number): number =>
  ((pos - n) % len + len) % len;
