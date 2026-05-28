import type { BoardCell, CellKind, ResolvedEvent } from './types';

const PASSIVE_KINDS = new Set<CellKind>([
  'NORMAL',
  'START',
  'SEGNO',
  'SECOND_ENDING',
  'REPEAT_START',
]);

function noneEvent(cell: BoardCell, warning?: string): ResolvedEvent {
  return {
    type: 'NONE',
    sourceIndex: cell.index,
    animationClass: 'fx-none',
    kind: cell.kind,
    warning,
  };
}

function withMissingTarget(cell: BoardCell, targetName: string): ResolvedEvent {
  return noneEvent(cell, `${cell.index}번 칸의 ${targetName} 목적지를 찾지 못했어요.`);
}

export function findIndexByKind(board: BoardCell[], kind: CellKind): number | undefined {
  return board.find((cell) => cell.kind === kind)?.index;
}

export function findPair(board: BoardCell[], cell: BoardCell): BoardCell | undefined {
  if (!cell.pairId || !cell.occurrence) return undefined;
  const targetOccurrence = cell.occurrence === 1 ? 2 : 1;

  return board.find(
    (candidate) =>
      candidate.pairId === cell.pairId &&
      candidate.occurrence === targetOccurrence &&
      candidate.index !== cell.index,
  );
}

export function getPositionAfterSteps(pos: number, steps: number, len: number): number {
  return ((pos + steps) % len + len) % len;
}

export function resolveCellEvent(board: BoardCell[], position: number): ResolvedEvent {
  const cell = board[position];

  if (!cell) {
    return {
      type: 'NONE',
      sourceIndex: position,
      animationClass: 'fx-none',
      kind: 'NORMAL',
      warning: `${position}번 칸을 찾지 못했어요.`,
    };
  }

  if (cell.markerOnly || PASSIVE_KINDS.has(cell.kind)) return noneEvent(cell);

  switch (cell.kind) {
    case 'MULTI_REST':
      return {
        type: 'MOVE_FORWARD',
        sourceIndex: cell.index,
        steps: cell.count ?? 0,
        animationClass: 'fx-rocket-dash',
        kind: cell.kind,
      };
    case 'REPEAT_END': {
      const targetIndex = board.find(
        (candidate) => candidate.kind === 'REPEAT_START' && candidate.pairId === cell.pairId,
      )?.index;
      return targetIndex === undefined
        ? withMissingTarget(cell, '시작 도돌이표')
        : {
            type: 'JUMP_TO_INDEX',
            sourceIndex: cell.index,
            targetIndex,
            animationClass: 'fx-rewind',
            kind: cell.kind,
          };
    }
    case 'DAL_SEGNO': {
      const targetIndex = findIndexByKind(board, 'SEGNO');
      return targetIndex === undefined
        ? withMissingTarget(cell, '세뇨')
        : {
            type: 'JUMP_TO_INDEX',
            sourceIndex: cell.index,
            targetIndex,
            animationClass: 'fx-segno-fly',
            kind: cell.kind,
          };
    }
    case 'CODA': {
      const pair = findPair(board, cell);
      return pair?.index === undefined
        ? withMissingTarget(cell, '두 번째 코다')
        : {
            type: 'JUMP_TO_INDEX',
            sourceIndex: cell.index,
            targetIndex: pair.index,
            animationClass: 'fx-coda-portal',
            kind: cell.kind,
          };
    }
    case 'DA_CAPO':
      return {
        type: 'JUMP_TO_INDEX',
        sourceIndex: cell.index,
        targetIndex: 0,
        animationClass: 'fx-spotlight-start',
        kind: cell.kind,
      };
    case 'FIRST_ENDING': {
      const targetIndex = findIndexByKind(board, 'SECOND_ENDING');
      return targetIndex === undefined
        ? withMissingTarget(cell, '제2괄호')
        : {
            type: 'JUMP_TO_INDEX',
            sourceIndex: cell.index,
            targetIndex,
            animationClass: 'fx-spring-jump',
            kind: cell.kind,
          };
    }
    case 'FERMATA':
      return {
        type: 'SKIP_TURNS',
        sourceIndex: cell.index,
        skipTurns: 2,
        animationClass: 'fx-ice-freeze',
        kind: cell.kind,
      };
    case 'DOUBLE_SEGNO': {
      const pair = findPair(board, cell);
      return pair?.index === undefined
        ? withMissingTarget(cell, '두 번째 더블세뇨')
        : {
            type: 'JUMP_TO_INDEX',
            sourceIndex: cell.index,
            targetIndex: pair.index,
            animationClass: 'fx-hologram',
            kind: cell.kind,
          };
    }
    case 'DOUBLE_SEGNO_TRIGGER': {
      const targetIndex = board.find(
        (candidate) => candidate.kind === 'DOUBLE_SEGNO' && candidate.pairId === 'dsegno' && candidate.occurrence === 1,
      )?.index;
      return targetIndex === undefined
        ? withMissingTarget(cell, '첫 번째 더블세뇨')
        : {
            type: 'JUMP_TO_INDEX',
            sourceIndex: cell.index,
            targetIndex,
            animationClass: 'fx-hologram',
            kind: cell.kind,
          };
    }
    case 'DOUBLE_CODA': {
      const pair = findPair(board, cell);
      return pair?.index === undefined
        ? withMissingTarget(cell, '두 번째 더블코다')
        : {
            type: 'JUMP_TO_INDEX',
            sourceIndex: cell.index,
            targetIndex: pair.index,
            animationClass: 'fx-wormhole',
            kind: cell.kind,
          };
    }
    case 'FINE':
      return {
        type: 'GAME_FINISH',
        sourceIndex: cell.index,
        animationClass: 'fx-finale',
        kind: cell.kind,
      };
    default:
      return noneEvent(cell);
  }
}
