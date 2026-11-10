// 캔버스로 직접 그려 만드는 텍스처 모음. 이미지 파일 없이 타일 이름표·주사위 눈·빛 번짐을 만든다.
import * as THREE from 'three';
import { loadDisplayFont } from '../fonts';

export const DISPLAY_FONT = "'Jua', 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', sans-serif";

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D 캔버스를 만들 수 없어요.');
  return [canvas, ctx];
}

function finish(canvas: HTMLCanvasElement, anisotropy = 8): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;
  return texture;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** 글자가 maxWidth 안에 들어가도록 글자 크기를 줄여 가며 맞춘다 */
function fitFont(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, startPx: number): number {
  let size = startPx;
  ctx.font = `${size}px ${DISPLAY_FONT}`;
  while (size > 10 && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `${size}px ${DISPLAY_FONT}`;
  }
  return size;
}

export interface TileTopOptions {
  label: string;
  /** 이름표 띠 색 */
  band: string;
  /** 띠 위쪽 패널 색(보통 흰색 계열) */
  panel: string;
  /** 도착 전용 칸(표지판)이면 true: 띠에 작은 깃발 점을 찍어 구분한다 */
  marker?: boolean;
}

/** 기호 칸 윗면: 흰 악보 종이 패널 + 카메라 쪽 가장자리의 이름표 띠 */
export function tileTopTexture(opts: TileTopOptions): THREE.CanvasTexture {
  const S = 384;
  const [canvas, ctx] = makeCanvas(S, S);
  const pad = 14;

  // 패널
  roundRect(ctx, pad, pad, S - pad * 2, S - pad * 2, 44);
  ctx.fillStyle = opts.panel;
  ctx.fill();

  // 패널 안쪽에 옅은 오선
  ctx.save();
  roundRect(ctx, pad, pad, S - pad * 2, S - pad * 2, 44);
  ctx.clip();
  ctx.strokeStyle = 'rgba(20, 33, 61, 0.07)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 5; i += 1) {
    const y = 70 + i * 34;
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(S - pad, y);
    ctx.stroke();
  }

  // 이름표 띠(카메라 쪽 = 캔버스 아래쪽)
  const bandH = 112;
  ctx.fillStyle = opts.band;
  ctx.fillRect(pad, S - pad - bandH, S - pad * 2, bandH);
  // 띠 위 하이라이트
  ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.fillRect(pad, S - pad - bandH, S - pad * 2, 10);
  ctx.restore();

  // 이름
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const size = fitFont(ctx, opts.label, S - pad * 2 - 34, 76);
  ctx.font = `${size}px ${DISPLAY_FONT}`;
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(6, size * 0.16);
  ctx.strokeStyle = 'rgba(20, 33, 61, 0.42)';
  ctx.strokeText(opts.label, S / 2, S - pad - bandH / 2 + 5);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(opts.label, S / 2, S - pad - bandH / 2 + 5);

  // 도착 전용 칸: 왼쪽 위에 "여기로 내려앉는다"는 화살 배지
  if (opts.marker) {
    const bx = pad + 50;
    const by = pad + 50;
    ctx.fillStyle = opts.band;
    ctx.beginPath();
    ctx.arc(bx, by, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(bx - 15, by - 9);
    ctx.lineTo(bx + 15, by - 9);
    ctx.lineTo(bx, by + 15);
    ctx.closePath();
    ctx.fill();
  }

  // 패널 테두리
  roundRect(ctx, pad, pad, S - pad * 2, S - pad * 2, 44);
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(20, 33, 61, 0.16)';
  ctx.stroke();

  return finish(canvas);
}

/** 모서리 칸 윗면: 색 패널 한 장 */
export function cornerTopTexture(color: string, label?: string): THREE.CanvasTexture {
  const S = 384;
  const [canvas, ctx] = makeCanvas(S, S);
  const pad = 14;
  roundRect(ctx, pad, pad, S - pad * 2, S - pad * 2, 48);
  const grad = ctx.createLinearGradient(0, pad, 0, S - pad);
  grad.addColorStop(0, 'rgba(255,255,255,0.34)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.06)');
  grad.addColorStop(1, 'rgba(0,0,0,0.08)');
  ctx.fillStyle = color;
  ctx.fill();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.stroke();

  if (label) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const size = fitFont(ctx, label, S - 80, 84);
    ctx.font = `${size}px ${DISPLAY_FONT}`;
    ctx.lineJoin = 'round';
    ctx.lineWidth = size * 0.16;
    ctx.strokeStyle = 'rgba(20, 33, 61, 0.38)';
    ctx.strokeText(label, S / 2, S - 92);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, S / 2, S - 92);
  }
  return finish(canvas);
}

/** 무대 바닥: 크림색 악보 종이에 오선이 흐른다 */
export function stageFloorTexture(): THREE.CanvasTexture {
  const W = 2048;
  const H = 1024;
  const [canvas, ctx] = makeCanvas(W, H);
  const grad = ctx.createRadialGradient(W / 2, H / 2, 80, W / 2, H / 2, W * 0.62);
  grad.addColorStop(0, '#fff8dc');
  grad.addColorStop(1, '#f7e3ab');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // 오선 세 단
  ctx.strokeStyle = 'rgba(122, 96, 44, 0.26)';
  ctx.lineWidth = 5;
  const systems = [170, 460, 750];
  for (const top of systems) {
    for (let i = 0; i < 5; i += 1) {
      const y = top + i * 30;
      ctx.beginPath();
      ctx.moveTo(60, y);
      ctx.lineTo(W - 60, y);
      ctx.stroke();
    }
    // 마디선
    for (let bar = 0; bar <= 6; bar += 1) {
      const x = 60 + ((W - 120) / 6) * bar;
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, top + 120);
      ctx.stroke();
    }
  }
  return finish(canvas, 4);
}

/** 주사위가 떨어지는 자리 표시 */
export function dicePadTexture(): THREE.CanvasTexture {
  const S = 512;
  const [canvas, ctx] = makeCanvas(S, S);
  const c = S / 2;
  const fill = ctx.createRadialGradient(c, c, 20, c, c, 230);
  fill.addColorStop(0, 'rgba(255, 255, 255, 0.92)');
  fill.addColorStop(0.72, 'rgba(255, 244, 205, 0.7)');
  fill.addColorStop(1, 'rgba(255, 214, 110, 0)');
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(c, c, 236, 0, Math.PI * 2);
  ctx.fill();
  ctx.setLineDash([34, 22]);
  ctx.lineWidth = 12;
  ctx.strokeStyle = 'rgba(229, 154, 12, 0.75)';
  ctx.beginPath();
  ctx.arc(c, c, 192, 0, Math.PI * 2);
  ctx.stroke();
  return finish(canvas, 4);
}

const PIPS: Record<number, Array<[number, number]>> = {
  1: [[0.5, 0.5]],
  2: [
    [0.28, 0.28],
    [0.72, 0.72],
  ],
  3: [
    [0.26, 0.26],
    [0.5, 0.5],
    [0.74, 0.74],
  ],
  4: [
    [0.28, 0.28],
    [0.72, 0.28],
    [0.28, 0.72],
    [0.72, 0.72],
  ],
  5: [
    [0.26, 0.26],
    [0.74, 0.26],
    [0.5, 0.5],
    [0.26, 0.74],
    [0.74, 0.74],
  ],
  6: [
    [0.29, 0.24],
    [0.29, 0.5],
    [0.29, 0.76],
    [0.71, 0.24],
    [0.71, 0.5],
    [0.71, 0.76],
  ],
};

export function diceFaceTexture(value: number): THREE.CanvasTexture {
  const S = 256;
  const [canvas, ctx] = makeCanvas(S, S);
  ctx.fillStyle = '#fffdf7';
  ctx.fillRect(0, 0, S, S);
  const shade = ctx.createRadialGradient(S / 2, S / 2, S * 0.2, S / 2, S / 2, S * 0.75);
  shade.addColorStop(0, 'rgba(255,255,255,0)');
  shade.addColorStop(1, 'rgba(210, 196, 160, 0.42)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, S, S);

  for (const [px, py] of PIPS[value]) {
    const r = value === 1 ? 46 : 26;
    const x = px * S;
    const y = py * S;
    // 파인 눈처럼 보이도록 아래쪽에 밝은 테를 깔고 위에 짙은 원을 얹는다
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    ctx.arc(x, y + 3, r + 1, 0, Math.PI * 2);
    ctx.fill();
    const pip = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
    if (value === 1) {
      pip.addColorStop(0, '#ff7b96');
      pip.addColorStop(1, '#e0224f');
    } else {
      pip.addColorStop(0, '#3a4a78');
      pip.addColorStop(1, '#14213d');
    }
    ctx.fillStyle = pip;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return finish(canvas);
}

/** 둥근 빛 번짐 */
export function glowTexture(): THREE.CanvasTexture {
  const S = 128;
  const [canvas, ctx] = makeCanvas(S, S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.72)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.2)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return finish(canvas, 1);
}

/** 충격파 고리 */
export function ringTexture(): THREE.CanvasTexture {
  const S = 256;
  const [canvas, ctx] = makeCanvas(S, S);
  const c = S / 2;
  const g = ctx.createRadialGradient(c, c, c * 0.52, c, c, c);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.62, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.8, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return finish(canvas, 1);
}

/** 아래가 진하고 위로 사라지는 빛기둥 */
export function beamTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(32, 256);
  const g = ctx.createLinearGradient(0, 256, 0, 0);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 256);
  return finish(canvas, 1);
}

export function checkerTexture(): THREE.CanvasTexture {
  const S = 128;
  const [canvas, ctx] = makeCanvas(S, S);
  const n = 4;
  const cell = S / n;
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#14213d' : '#ffffff';
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }
  const texture = finish(canvas, 4);
  texture.magFilter = THREE.NearestFilter;
  return texture;
}

/** 말 머리 위에 띄우는 말풍선 라벨 */
export function labelTexture(text: string, bg: string, fg = '#ffffff'): THREE.CanvasTexture {
  const W = 320;
  const H = 112;
  const [canvas, ctx] = makeCanvas(W, H);
  roundRect(ctx, 6, 6, W - 12, H - 12, 44);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const size = fitFont(ctx, text, W - 56, 58);
  ctx.font = `${size}px ${DISPLAY_FONT}`;
  ctx.fillStyle = fg;
  ctx.fillText(text, W / 2, H / 2 + 4);
  return finish(canvas, 4);
}

/** 캔버스 텍스처에 쓸 글꼴이 준비될 때까지 기다린다(최대 timeoutMs). 늦어지면 시스템 글꼴로 진행한다. */
export async function waitForDisplayFont(timeoutMs = 3500): Promise<void> {
  const timeout = new Promise<void>((resolve) => window.setTimeout(resolve, timeoutMs));
  await Promise.race([loadDisplayFont(), timeout]);
}
