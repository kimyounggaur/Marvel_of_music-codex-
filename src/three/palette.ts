// 3D 무대의 색 체계. 일반 칸은 건반처럼 조용한 아이보리, 색은 "기호의 종류"에만 쓴다.
import type { BoardCell, CellKind } from '../game/types';

/** 악보 인쇄 잉크색. 모든 기호 조형물의 기본색 */
export const INK = '#16223f';

export type Family = 'normal' | 'start' | 'finish' | 'repeat' | 'jump' | 'coda' | 'rest';

export interface FamilyColor {
  /** 타일 몸통 */
  body: string;
  /** 이름표 띠 / 받침대 */
  band: string;
  /** 효과 입자·빛 */
  glow: string;
}

export const FAMILY_COLORS: Record<Family, FamilyColor> = {
  normal: { body: '#fffdf4', band: '#d9d2bd', glow: '#ffffff' },
  start: { body: '#7ccf3c', band: '#4a9f1c', glow: '#b6ff7a' },
  finish: { body: '#ffc83d', band: '#e08e06', glow: '#ffe48a' },
  repeat: { body: '#3d8bff', band: '#2060d6', glow: '#8fc0ff' },
  jump: { body: '#8b6cff', band: '#6041dc', glow: '#c2b0ff' },
  coda: { body: '#ff4f78', band: '#dc2a56', glow: '#ff9db4' },
  rest: { body: '#34c978', band: '#1b9c56', glow: '#9af0c0' },
};

const FAMILY_BY_KIND: Record<CellKind, Family> = {
  START: 'start',
  NORMAL: 'normal',
  MULTI_REST: 'rest',
  REPEAT_START: 'repeat',
  REPEAT_END: 'repeat',
  DAL_SEGNO: 'jump',
  SEGNO: 'jump',
  CODA: 'coda',
  DA_CAPO: 'jump',
  FIRST_ENDING: 'repeat',
  SECOND_ENDING: 'repeat',
  FERMATA: 'rest',
  DOUBLE_SEGNO: 'jump',
  DOUBLE_SEGNO_TRIGGER: 'jump',
  DOUBLE_CODA: 'coda',
  FINE: 'finish',
};

export function familyOf(kind: CellKind): Family {
  return FAMILY_BY_KIND[kind];
}

export function familyColor(cell: BoardCell): FamilyColor {
  return FAMILY_COLORS[familyOf(cell.kind)];
}

/** 실물 보드판 모서리 색(초록·빨강·주황)을 그대로 가져온 장식 모서리 */
export const CORNER_COLORS = ['#2e9e4f', '#e8323c', '#f08a24'];

/** 실물 보드판 안쪽 테두리 띠 색 */
export const EDGE_STRIP = {
  topLeft: '#8cc63f',
  topRight: '#2e9e4f',
  right: '#2a9fd8',
  bottomRight: '#e5252a',
  bottomLeft: '#e8741e',
  left: '#f5b921',
};

/** 도·레·미·파·솔·라·시 — 말이 걸을 때 건반(타일)이 이 색으로 빛난다 */
export const NOTE_COLORS = ['#ff4d4d', '#ff9a3d', '#ffd83d', '#4ccf6a', '#3dc6e8', '#4f7cff', '#9a6cff'];

/** 실물 보드판 제목 글자색: 반 복 기 호 의 마 블 */
export const TITLE_COLORS = ['#8cc63f', '#2a9fd8', '#2a9fd8', '#2a9fd8', '#e5252a', '#e8741e', '#f5b921'];
