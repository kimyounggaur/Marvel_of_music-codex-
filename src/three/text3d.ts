// 3D로 세우는 글자. 실물 보드판 글씨와 같은 계열(주아체) 외곽선을 미리 뽑아 둔 JSON으로 만든다.
// JSON은 scripts/make-title-glyphs.mjs로 다시 만들 수 있다.
import * as THREE from 'three';
import { Font, type FontData } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import glyphData from './assets/jua-glyphs.json';

const data = glyphData as unknown as FontData;
const font = new Font(data);

export interface Text3DOptions {
  /** 글자 크기(em, 월드 단위) */
  size: number;
  /** 두께 */
  depth: number;
  /** 모서리 둥글림. 0이면 끔 */
  bevel?: number;
}

/** 준비된 글리프만 남긴다(없는 글자를 넘기면 three의 Font가 예외를 던진다) */
function supported(text: string): string {
  return Array.from(text)
    .filter((char) => data.glyphs[char] !== undefined)
    .join('');
}

/** 글자의 가로 진행 폭(월드 단위) */
export function advanceOf(char: string, size: number): number {
  const glyph = data.glyphs[char];
  return glyph ? (glyph.ha / data.resolution) * size : size * 0.3;
}

/**
 * 가운데 정렬된 3D 글자 지오메트리. 바닥이 y=0, 좌우·앞뒤 중심이 0에 오도록 옮겨서 돌려준다.
 * 머티리얼을 [앞뒤면, 옆면] 배열로 주면 두 색으로 칠할 수 있다.
 */
export function textGeometry(text: string, opts: Text3DOptions): THREE.BufferGeometry {
  const bevel = opts.bevel ?? 0;
  const geometry = new TextGeometry(supported(text), {
    font,
    size: opts.size,
    depth: opts.depth,
    curveSegments: 5,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel * 0.85,
    bevelSegments: 2,
  });
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (box) {
    geometry.translate(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  }
  geometry.computeBoundingBox();
  return geometry;
}

export function geometryWidth(geometry: THREE.BufferGeometry): number {
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  return box ? box.max.x - box.min.x : 0;
}

export function geometryHeight(geometry: THREE.BufferGeometry): number {
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  return box ? box.max.y - box.min.y : 0;
}
