// 40칸 보드의 3D 배치. 칸의 순서와 격자 좌표는 game/movement.ts(실물 보드판 14×8)를 그대로 따른다.
import { BOARD_LEN, COLS, ROWS, cellCoord } from '../game/movement';

/** 칸 사이 간격(월드 단위) */
export const PITCH = 1;
/** 타일 한 변 길이 */
export const TILE_SIZE = 0.9;
/** 타일 높이 = 타일 윗면의 y */
export const TILE_TOP = 0.24;

/** 타일 고리 바깥쪽 여백을 포함한 무대(섬) 크기 */
export const ISLAND_W = COLS * PITCH + 1.3;
export const ISLAND_D = ROWS * PITCH + 1.3;
/** 타일 고리 안쪽 무대 바닥 크기 */
export const STAGE_W = (COLS - 2) * PITCH - 0.2;
export const STAGE_D = (ROWS - 2) * PITCH - 0.2;

export interface XZ {
  x: number;
  z: number;
}

/** 칸 중심의 월드 좌표. 0번 칸(Start)이 왼쪽 위(멀리), 시계 방향으로 진행한다. */
export function cellPosition(index: number): XZ {
  const { row, col } = cellCoord(((index % BOARD_LEN) + BOARD_LEN) % BOARD_LEN);
  return {
    x: (col - (COLS - 1) / 2) * PITCH,
    z: (row - (ROWS - 1) / 2) * PITCH,
  };
}

/** 한 칸에 여러 말이 설 때의 자리(칸 중심 기준, 카메라를 향한 로컬 좌표: +z가 카메라 쪽) */
const SLOTS: Record<number, XZ[]> = {
  1: [{ x: 0, z: 0.16 }],
  2: [
    { x: -0.2, z: 0.18 },
    { x: 0.2, z: 0.18 },
  ],
  3: [
    { x: -0.24, z: 0.24 },
    { x: 0.24, z: 0.24 },
    { x: 0, z: -0.02 },
  ],
  4: [
    { x: -0.22, z: 0.26 },
    { x: 0.22, z: 0.26 },
    { x: -0.22, z: -0.04 },
    { x: 0.22, z: -0.04 },
  ],
};

export function slotOffset(count: number, slot: number): XZ {
  const list = SLOTS[Math.min(4, Math.max(1, count))];
  return list[Math.min(slot, list.length - 1)];
}

/** 로컬(카메라를 향한) 좌표를 facing 각도만큼 돌려 월드 오프셋으로 바꾼다 */
export function rotateXZ(p: XZ, yaw: number): XZ {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return { x: p.x * c + p.z * s, z: -p.x * s + p.z * c };
}

/** from에서 to까지 한 칸씩 뒤로(또는 앞으로) 지나가는 칸 목록. from은 빼고 to는 포함한다. */
export function pathBetween(from: number, to: number, direction: 1 | -1): number[] {
  const out: number[] = [];
  let cursor = from;
  for (let guard = 0; guard < BOARD_LEN && cursor !== to; guard += 1) {
    cursor = (((cursor + direction) % BOARD_LEN) + BOARD_LEN) % BOARD_LEN;
    out.push(cursor);
  }
  return out;
}

/** 두 칸 사이의 직선 거리(월드 단위) */
export function cellDistance(a: number, b: number): number {
  const pa = cellPosition(a);
  const pb = cellPosition(b);
  return Math.hypot(pa.x - pb.x, pa.z - pb.z);
}
