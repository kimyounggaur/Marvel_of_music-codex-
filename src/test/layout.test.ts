import { describe, expect, it } from 'vitest';
import { BOARD } from '../data/boardCells';
import { createInitialState, gameReducer } from '../game/reducer';
import { cellDistance, cellPosition, pathBetween, rotateXZ, slotOffset } from '../three/layout';

describe('3D 보드 배치', () => {
  it('40칸이 서로 다른 자리에 놓이고 이웃 칸과는 한 칸 간격이다', () => {
    const seen = new Set<string>();
    for (const cell of BOARD) {
      const { x, z } = cellPosition(cell.index);
      seen.add(`${x},${z}`);
      expect(cellDistance(cell.index, (cell.index + 1) % BOARD.length)).toBeCloseTo(1, 5);
    }
    expect(seen.size).toBe(BOARD.length);
  });

  it('출발 칸은 왼쪽 위(멀리), 모서리 칸들은 네 귀퉁이에 있다', () => {
    expect(cellPosition(0)).toEqual({ x: -6.5, z: -3.5 });
    expect(cellPosition(13)).toEqual({ x: 6.5, z: -3.5 });
    expect(cellPosition(20)).toEqual({ x: 6.5, z: 3.5 });
    expect(cellPosition(33)).toEqual({ x: -6.5, z: 3.5 });
    for (const cell of BOARD.filter((item) => item.isCorner)) {
      const { x, z } = cellPosition(cell.index);
      expect(Math.abs(x)).toBe(6.5);
      expect(Math.abs(z)).toBe(3.5);
    }
  });

  it('뒤로 되감는 길은 지나는 칸을 순서대로 돌려준다', () => {
    expect(pathBetween(15, 8, -1)).toEqual([14, 13, 12, 11, 10, 9, 8]);
    expect(pathBetween(2, 38, -1)).toEqual([1, 0, 39, 38]);
    expect(pathBetween(38, 1, 1)).toEqual([39, 0, 1]);
    expect(pathBetween(5, 5, 1)).toEqual([]);
  });

  it('한 칸에 여럿이 서도 자리가 겹치지 않고 타일 안에 머문다', () => {
    for (let count = 1; count <= 4; count += 1) {
      const slots = Array.from({ length: count }, (_, i) => slotOffset(count, i));
      for (const slot of slots) {
        expect(Math.abs(slot.x)).toBeLessThan(0.45);
        expect(Math.abs(slot.z)).toBeLessThan(0.45);
      }
      for (let a = 0; a < count; a += 1) {
        for (let b = a + 1; b < count; b += 1) {
          expect(Math.hypot(slots[a].x - slots[b].x, slots[a].z - slots[b].z)).toBeGreaterThan(0.25);
        }
      }
    }
  });

  it('세로 화면에서 판을 90° 돌리면 카메라 쪽(+z)이 +x가 된다', () => {
    const rotated = rotateXZ({ x: 0, z: 1 }, Math.PI / 2);
    expect(rotated.x).toBeCloseTo(1, 5);
    expect(rotated.z).toBeCloseTo(0, 5);
  });
});

describe('소리 설정', () => {
  it('새 게임을 시작하거나 리셋해도 유지된다', () => {
    let state = createInitialState();
    expect(state.soundEnabled).toBe(true);
    state = gameReducer(state, { type: 'TOGGLE_SOUND' });
    expect(state.soundEnabled).toBe(false);
    state = gameReducer(state, { type: 'START_GAME', count: 2 });
    expect(state.soundEnabled).toBe(false);
    state = gameReducer(state, { type: 'RESET_GAME' });
    expect(state.soundEnabled).toBe(false);
  });
});
