// 게임 루프(useGameLoop)와 3D 무대(Stage)가 함께 쓰는 연출 시간표.
// 규칙은 reducer가 결정하고, 여기서는 "화면이 그 결과를 보여줄 시간"만 정한다.

/** 주사위를 던져서 멈출 때까지 */
export const ROLL_MS = 1500;
/** 주사위 이동의 마지막 칸에 내려앉은 뒤 칸 효과를 확인하기까지 */
export const SETTLE_MS = 520;
/** 기호 이동(점프)이 끝난 뒤 다음 판정까지의 숨 고르기 */
export const AFTER_JUMP_MS = 280;

/** 기호 칸을 밟았을 때 배너와 준비 연출을 보여주는 시간 */
const EVENT_SHOW_MS: Record<string, number> = {
  'fx-rocket-dash': 1150,
  'fx-rewind': 1250,
  'fx-segno-fly': 1250,
  'fx-coda-portal': 1300,
  'fx-spotlight-start': 1350,
  'fx-spring-jump': 1100,
  'fx-ice-freeze': 1700,
  'fx-hologram': 1200,
  'fx-wormhole': 1350,
  'fx-finale': 1500,
};

/** 기호 효과로 말이 목적지까지 날아가는 시간 */
const JUMP_TRAVEL_MS: Record<string, number> = {
  'fx-rewind': 1050,
  'fx-segno-fly': 1150,
  'fx-coda-portal': 1300,
  'fx-spotlight-start': 1250,
  'fx-spring-jump': 900,
  'fx-hologram': 1150,
  'fx-wormhole': 1450,
};

export function eventShowMs(animationClass: string): number {
  return EVENT_SHOW_MS[animationClass] ?? 1200;
}

export function jumpTravelMs(animationClass: string): number {
  return JUMP_TRAVEL_MS[animationClass] ?? 1000;
}

/** 움직임을 줄여 달라는 설정이면 연출을 짧게 */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}
