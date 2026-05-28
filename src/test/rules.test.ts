import { describe, expect, it } from 'vitest';
import { BOARD } from '../data/boardCells';
import { stepBackward, stepForward } from '../game/movement';
import { resolveCellEvent } from '../game/rules';

describe('movement helpers', () => {
  it('wraps forward and backward positions', () => {
    expect(stepForward(39, 40)).toBe(0);
    expect(stepBackward(3, 8, 40)).toBe(35);
  });
});

describe('resolveCellEvent', () => {
  it('resolves all special event cells', () => {
    expect(resolveCellEvent(BOARD, 30)).toMatchObject({ type: 'MOVE_FORWARD', steps: 4 });
    expect(resolveCellEvent(BOARD, 15)).toMatchObject({ type: 'JUMP_TO_INDEX', targetIndex: 8 });
    expect(resolveCellEvent(BOARD, 21)).toMatchObject({ type: 'JUMP_TO_INDEX', targetIndex: 17 });
    expect(resolveCellEvent(BOARD, 18)).toMatchObject({ type: 'JUMP_TO_INDEX', targetIndex: 22 });
    expect(resolveCellEvent(BOARD, 22)).toMatchObject({ type: 'NONE' });
    expect(resolveCellEvent(BOARD, 4)).toMatchObject({ type: 'JUMP_TO_INDEX', targetIndex: 0 });
    expect(resolveCellEvent(BOARD, 14)).toMatchObject({ type: 'JUMP_TO_INDEX', targetIndex: 16 });
    expect(resolveCellEvent(BOARD, 34)).toMatchObject({ type: 'SKIP_TURNS', skipTurns: 2 });
    expect(resolveCellEvent(BOARD, 28)).toMatchObject({ type: 'JUMP_TO_INDEX', targetIndex: 35 });
    expect(resolveCellEvent(BOARD, 25)).toMatchObject({ type: 'JUMP_TO_INDEX', targetIndex: 28 });
    expect(resolveCellEvent(BOARD, 27)).toMatchObject({ type: 'JUMP_TO_INDEX', targetIndex: 36 });
    expect(resolveCellEvent(BOARD, 23)).toMatchObject({ type: 'NONE' });
    expect(resolveCellEvent(BOARD, 38)).toMatchObject({ type: 'GAME_FINISH' });
  });

  it('returns NONE for passive and marker cells', () => {
    expect(resolveCellEvent(BOARD, 0)).toMatchObject({ type: 'NONE' });
    expect(resolveCellEvent(BOARD, 8)).toMatchObject({ type: 'NONE' });
    expect(resolveCellEvent(BOARD, 17)).toMatchObject({ type: 'NONE' });
    expect(resolveCellEvent(BOARD, 16)).toMatchObject({ type: 'NONE' });
  });

  it('does not throw when a target is missing', () => {
    const brokenBoard = BOARD.filter((cell) => cell.kind !== 'SEGNO');
    expect(resolveCellEvent(brokenBoard, 21)).toMatchObject({ type: 'NONE' });
  });
});
