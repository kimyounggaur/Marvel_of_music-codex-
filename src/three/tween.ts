// 아주 작은 애니메이션 관리자. 외부 라이브러리 없이 무대(Stage)의 모든 움직임을 한 곳에서 돌린다.

export type Ease = (t: number) => number;

const c1 = 1.70158;
const c3 = c1 + 1;

export const ease = {
  linear: (t: number) => t,
  inQuad: (t: number) => t * t,
  outQuad: (t: number) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inCubic: (t: number) => t * t * t,
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outQuart: (t: number) => 1 - Math.pow(1 - t, 4),
  inBack: (t: number) => c3 * t * t * t - c1 * t * t,
  outBack: (t: number) => 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2),
  outElastic: (t: number) => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
  },
  outBounce: (t: number) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
} satisfies Record<string, Ease>;

export interface AnimOptions {
  /** 밀리초 */
  duration: number;
  /** 시작 전 대기(밀리초) */
  delay?: number;
  ease?: Ease;
  /** k: 이징이 적용된 0~1, raw: 선형 0~1 */
  update?: (k: number, raw: number) => void;
  complete?: () => void;
  /** 같은 tag로 묶인 애니메이션을 한꺼번에 취소할 때 쓴다 */
  tag?: unknown;
}

interface Anim {
  opts: AnimOptions;
  elapsed: number;
  started: boolean;
  dead: boolean;
}

export class Animator {
  private items: Anim[] = [];

  add(opts: AnimOptions): void {
    this.items.push({ opts, elapsed: -(opts.delay ?? 0), started: false, dead: false });
  }

  /** ms 뒤에 한 번 실행 */
  after(ms: number, fn: () => void, tag?: unknown): void {
    this.add({ duration: 0, delay: ms, complete: fn, tag });
  }

  /** tag로 묶인 애니메이션을 끝내지 않고 버린다 */
  cancel(tag: unknown): void {
    for (const item of this.items) {
      if (item.opts.tag === tag) item.dead = true;
    }
  }

  clear(): void {
    this.items.length = 0;
  }

  tick(dtMs: number): void {
    // 콜백 안에서 add/cancel이 일어나도 안전하도록 현재 목록만 순회한다
    const current = this.items.slice();
    for (const item of current) {
      if (item.dead) continue;
      item.elapsed += dtMs;
      if (item.elapsed < 0) continue;
      const { duration, ease: easing, update, complete } = item.opts;
      const raw = duration <= 0 ? 1 : Math.min(1, item.elapsed / duration);
      item.started = true;
      if (update) update(easing ? easing(raw) : raw, raw);
      if (raw >= 1) {
        item.dead = true;
        if (complete) complete();
      }
    }
    if (this.items.some((item) => item.dead)) {
      this.items = this.items.filter((item) => !item.dead);
    }
  }
}

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

/** 프레임률과 무관한 감쇠 보간 계수. k가 클수록 빨리 따라간다. */
export const damp = (k: number, dtSec: number): number => 1 - Math.exp(-k * dtSec);

/** 각도를 -π~π 범위로 */
export function wrapAngle(a: number): number {
  let r = a % (Math.PI * 2);
  if (r > Math.PI) r -= Math.PI * 2;
  if (r < -Math.PI) r += Math.PI * 2;
  return r;
}
