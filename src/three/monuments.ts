// 음악기호를 입체 조형물로 세운다. 모양은 악보에 쓰이는 실제 기호(프로젝트의 기호 그림)를 따른다.
// 모든 조형물은 원점이 타일 윗면 중심이고 +z(카메라 쪽)를 바라본다.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { BoardCell } from '../game/types';
import { INK } from './palette';
import { checkerTexture } from './textures';
import { geometryWidth, textGeometry } from './text3d';

export interface Monument {
  group: THREE.Group;
  /** 매 프레임 호출(초 단위 시간). 흔들리는 추처럼 스스로 움직이는 조형물만 가진다 */
  tick?: (time: number) => void;
  /** 조형물의 "입구" 높이: 포털 효과가 말을 빨아들이는 지점(로컬 y) */
  portalY: number;
  /**
   * 'emblem': 타일 위에 비스듬히 떠 있는 납작한 기호(대부분의 음악기호)
   * 'standing': 타일에 똑바로 서 있는 조형물(메트로놈, 핸드벨)
   */
  pose: 'emblem' | 'standing';
  /** 기호와 별개로 타일에 세워 두는 장식(깃발) */
  props?: THREE.Group;
}

// 잉크색은 반사를 줄여 어느 각도에서도 짙게 읽히도록 한다
const ink = new THREE.MeshStandardMaterial({
  color: INK,
  roughness: 0.5,
  envMapIntensity: 0.35,
});
const white = new THREE.MeshPhysicalMaterial({
  color: '#ffffff',
  roughness: 0.32,
  clearcoat: 0.7,
  clearcoatRoughness: 0.25,
});
const gold = new THREE.MeshStandardMaterial({ color: '#ffc02e', metalness: 0.85, roughness: 0.24 });
const wood = new THREE.MeshStandardMaterial({ color: '#a8672f', roughness: 0.55 });

const colorMaterials = new Map<string, THREE.MeshPhysicalMaterial>();
function enamel(color: string): THREE.MeshPhysicalMaterial {
  let material = colorMaterials.get(color);
  if (!material) {
    material = new THREE.MeshPhysicalMaterial({ color, roughness: 0.34, clearcoat: 0.8, clearcoatRoughness: 0.25 });
    colorMaterials.set(color, material);
  }
  return material;
}

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[]): THREE.Mesh {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = true;
  return m;
}

function box(w: number, h: number, d: number, material: THREE.Material = ink): THREE.Mesh {
  const radius = Math.min(w, h, d) * 0.28;
  return mesh(new RoundedBoxGeometry(w, h, d, 2, radius), material);
}

function ball(r: number, material: THREE.Material = ink): THREE.Mesh {
  return mesh(new THREE.SphereGeometry(r, 20, 14), material);
}

const DEPTH = 0.085;
/** 기호가 서는 높이(타일 위) */
const FLOOR = 0.1;

/** 도돌이표: 굵은 세로줄 + 가는 세로줄 + 두 점 */
function repeatSign(isEnd: boolean): THREE.Group {
  const g = new THREE.Group();
  const H = 0.54;
  const dir = isEnd ? -1 : 1; // 시작 도돌이표는 왼쪽이 굵은 줄, 끝 도돌이표는 좌우 반전
  const thick = box(0.12, H, DEPTH);
  thick.position.set(-0.15 * dir, FLOOR + H / 2, 0);
  const thin = box(0.055, H, DEPTH);
  thin.position.set(0.0 * dir, FLOOR + H / 2, 0);
  const dotA = ball(0.047);
  dotA.position.set(0.115 * dir, FLOOR + H / 2 + 0.07, 0);
  const dotB = ball(0.047);
  dotB.position.set(0.115 * dir, FLOOR + H / 2 - 0.07, 0);
  g.add(thick, thin, dotA, dotB);
  return g;
}

/** 제1·제2괄호: 꺾인 괄호선 + 번호 */
function volta(n: 1 | 2): THREE.Group {
  const g = new THREE.Group();
  const top = box(0.62, 0.045, DEPTH);
  top.position.set(0, FLOOR + 0.5, 0);
  const drop = box(0.045, 0.24, DEPTH);
  drop.position.set(-0.2875, FLOOR + 0.4, 0);
  const number = mesh(textGeometry(`${n}.`, { size: 0.3, depth: DEPTH, bevel: 0.008 }), ink);
  number.position.set(-0.07, FLOOR + 0.1, 0);
  g.add(top, drop, number);
  return g;
}

/** 다중쉼표: 굵은 가로 막대와 양 끝의 세로 마구리, 위에는 쉬는 마디 수 */
function multiRest(count: number): THREE.Group {
  const g = new THREE.Group();
  const bar = box(0.44, 0.085, DEPTH);
  bar.position.set(0, FLOOR + 0.1, 0);
  const capL = box(0.03, 0.2, DEPTH);
  capL.position.set(-0.235, FLOOR + 0.1, 0);
  const capR = box(0.03, 0.2, DEPTH);
  capR.position.set(0.235, FLOOR + 0.1, 0);
  const number = mesh(textGeometry(String(count), { size: 0.34, depth: DEPTH, bevel: 0.01 }), ink);
  number.position.set(0, FLOOR + 0.27, 0);
  g.add(bar, capL, capR, number);
  return g;
}

/** 세뇨: 끝이 말린 S자 곡선 + 사선 + 두 점 */
function segnoShape(): THREE.Group {
  const g = new THREE.Group();
  const pts: Array<[number, number]> = [
    [0.06, 0.13],
    [0.1, 0.2],
    [0.02, 0.265],
    [-0.12, 0.245],
    [-0.2, 0.14],
    [-0.17, 0.04],
    [-0.06, 0.006],
    [0.06, -0.006],
    [0.17, -0.04],
    [0.2, -0.14],
    [0.12, -0.245],
    [-0.02, -0.265],
    [-0.1, -0.2],
    [-0.06, -0.13],
  ];
  const curve = new THREE.CatmullRomCurve3(
    pts.map(([x, y]) => new THREE.Vector3(x, y, 0)),
    false,
    'catmullrom',
    0.5,
  );
  const s = mesh(new THREE.TubeGeometry(curve, 56, 0.04, 8, false), ink);
  const endA = ball(0.058);
  endA.position.set(pts[0][0], pts[0][1], 0);
  const endB = ball(0.058);
  endB.position.set(pts[pts.length - 1][0], pts[pts.length - 1][1], 0);
  const slash = box(0.05, 0.8, 0.06);
  slash.rotation.z = -Math.PI / 4;
  const dotL = ball(0.045);
  dotL.position.set(-0.3, -0.07, 0);
  const dotR = ball(0.045);
  dotR.position.set(0.3, 0.07, 0);
  g.add(s, endA, endB, slash, dotL, dotR);
  return g;
}

function segno(): THREE.Group {
  const g = new THREE.Group();
  const shape = segnoShape();
  shape.scale.setScalar(0.92);
  shape.position.y = FLOOR + 0.3;
  g.add(shape);
  return g;
}

function doubleSegno(): THREE.Group {
  const g = new THREE.Group();
  for (const x of [-0.19, 0.19]) {
    const shape = segnoShape();
    shape.scale.setScalar(0.56);
    shape.position.set(x, FLOOR + 0.24, 0);
    g.add(shape);
  }
  return g;
}

/** 코다: 세로로 긴 타원 고리 + 고리 밖으로 뻗는 십자선(끝에 짧은 마구리) */
function codaShape(): THREE.Group {
  const g = new THREE.Group();
  const ring = mesh(new THREE.TorusGeometry(0.17, 0.03, 12, 40), ink);
  ring.scale.set(1, 1.22, 1);
  const vertical = box(0.034, 0.58, 0.05);
  const horizontal = box(0.5, 0.034, 0.05);
  const capT = box(0.15, 0.034, 0.05);
  capT.position.y = 0.29;
  const capB = box(0.15, 0.034, 0.05);
  capB.position.y = -0.29;
  const capL = box(0.034, 0.15, 0.05);
  capL.position.x = -0.25;
  const capR = box(0.034, 0.15, 0.05);
  capR.position.x = 0.25;
  g.add(ring, vertical, horizontal, capT, capB, capL, capR);
  return g;
}

function coda(): THREE.Group {
  const g = new THREE.Group();
  const shape = codaShape();
  shape.position.y = FLOOR + 0.31;
  g.add(shape);
  return g;
}

function doubleCoda(): THREE.Group {
  const g = new THREE.Group();
  for (const x of [-0.18, 0.18]) {
    const shape = codaShape();
    shape.scale.setScalar(0.66);
    shape.position.set(x, FLOOR + 0.24, 0);
    g.add(shape);
  }
  return g;
}

/** 페르마타: 반원 호 + 가운데 점 */
function fermata(): THREE.Group {
  const g = new THREE.Group();
  const arc = mesh(new THREE.TorusGeometry(0.27, 0.036, 12, 36, Math.PI), ink);
  arc.position.y = FLOOR + 0.04;
  const footL = ball(0.036);
  footL.position.set(-0.27, FLOOR + 0.04, 0);
  const footR = ball(0.036);
  footR.position.set(0.27, FLOOR + 0.04, 0);
  const dot = ball(0.07);
  dot.position.y = FLOOR + 0.1;
  g.add(arc, footL, footR, dot);
  return g;
}

/** 글자로 쓰는 기호(D.C. / D.S. / D.S.S) */
function textSign(text: string, maxWidth: number, size: number, material: THREE.Material | THREE.Material[] = ink): THREE.Mesh {
  const geometry = textGeometry(text, { size, depth: 0.1, bevel: 0.012 });
  const width = geometryWidth(geometry);
  const m = mesh(geometry, material);
  if (width > maxWidth) m.scale.setScalar(maxWidth / width);
  m.position.y = FLOOR;
  return m;
}

/** 깃대와 깃발 */
function flag(color: THREE.Material, height: number): THREE.Group {
  const g = new THREE.Group();
  const pole = mesh(new THREE.CylinderGeometry(0.014, 0.014, height, 8), gold);
  pole.position.set(0, height / 2, 0);
  const cloth = mesh(new THREE.PlaneGeometry(0.2, 0.13, 6, 1), color);
  cloth.position.set(0.1, height - 0.075, 0);
  const knob = ball(0.024, gold);
  knob.position.y = height;
  g.add(pole, cloth, knob);
  g.userData.cloth = cloth;
  return g;
}

function wave(cloth: THREE.Mesh, time: number, phase: number): void {
  const pos = cloth.geometry.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    // 깃대 쪽(x=-0.1)은 고정, 바깥쪽으로 갈수록 크게 펄럭인다
    const k = (x + 0.1) / 0.2;
    pos.setZ(i, Math.sin(time * 5 + k * 4 + phase) * 0.028 * k);
  }
  pos.needsUpdate = true;
}

/**
 * 출발·Fine 칸: 글자는 다른 기호처럼 타일 위에 띄우고, 타일 뒤쪽 두 모서리에 깃발을 세운다.
 * (글자를 문처럼 세우면 뒤 칸에 선 말을 가려서 어느 칸에 있는지 헷갈린다)
 */
function flaggedSign(sign: THREE.Mesh, clothMaterial: THREE.Material): Monument {
  const group = new THREE.Group().add(sign);
  const props = new THREE.Group();
  const cloths: THREE.Mesh[] = [];
  for (const x of [-0.34, 0.34]) {
    const item = flag(clothMaterial, 0.5);
    item.position.set(x, 0, -0.36);
    props.add(item);
    cloths.push(item.userData.cloth as THREE.Mesh);
  }
  return {
    group,
    props,
    portalY: 0.4,
    pose: 'emblem',
    tick: (time) => cloths.forEach((cloth, i) => wave(cloth, time, i * 1.7)),
  };
}

function startGate(): Monument {
  const sign = textSign('Start!', 0.78, 0.3, [white, enamel('#2f8f12')]);
  const cloth = new THREE.MeshStandardMaterial({ color: '#ffe14d', side: THREE.DoubleSide, roughness: 0.6 });
  return flaggedSign(sign, cloth);
}

function fineGate(): Monument {
  const sign = textSign('Fine', 0.66, 0.36, [ink, gold]);
  const cloth = new THREE.MeshStandardMaterial({ map: checkerTexture(), side: THREE.DoubleSide, roughness: 0.6 });
  return flaggedSign(sign, cloth);
}

/** 황금열쇠(실물 보드판 모서리 그림) */
function goldenKey(): Monument {
  const g = new THREE.Group();
  const bow = mesh(new THREE.TorusGeometry(0.13, 0.042, 12, 28), gold);
  bow.position.y = 0.2;
  const shaft = mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.4, 12), gold);
  shaft.position.y = -0.12;
  const toothA = box(0.12, 0.05, 0.055, gold);
  toothA.position.set(0.07, -0.27, 0);
  const toothB = box(0.085, 0.05, 0.055, gold);
  toothB.position.set(0.055, -0.17, 0);
  g.add(bow, shaft, toothA, toothB);
  g.rotation.z = 0.6;
  const holder = new THREE.Group();
  holder.add(g);
  return { group: holder, portalY: 0.4, pose: 'emblem' };
}

/** 메트로놈: 추가 좌우로 흔들린다 */
function metronome(): Monument {
  const g = new THREE.Group();
  const body = mesh(new THREE.CylinderGeometry(0.075, 0.2, 0.52, 4, 1), wood);
  body.rotation.y = Math.PI / 4;
  body.position.y = 0.3;
  const face = mesh(new THREE.PlaneGeometry(0.12, 0.36), enamel('#fff3d0'));
  face.position.set(0, 0.3, 0.118);
  face.rotation.x = -0.24;
  face.castShadow = false;
  const base = box(0.36, 0.05, 0.3, gold);
  base.position.y = 0.045;
  const arm = new THREE.Group();
  const rod = mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.46, 6), gold);
  rod.position.y = 0.23;
  const weight = box(0.07, 0.06, 0.03, gold);
  weight.position.y = 0.3;
  arm.add(rod, weight);
  arm.position.set(0, 0.14, 0.15);
  g.add(body, face, base, arm);
  return {
    group: g,
    portalY: 0.4,
    pose: 'standing',
    // 1분에 96박(BGM 빠르기)에 맞춰 흔들린다
    tick: (time) => {
      arm.rotation.z = Math.sin(time * ((96 / 60) * Math.PI)) * 0.42;
    },
  };
}

/** 핸드벨 */
function handbell(): Monument {
  const g = new THREE.Group();
  const bell = new THREE.Group();
  const profile: THREE.Vector2[] = [
    new THREE.Vector2(0.0, 0.3),
    new THREE.Vector2(0.06, 0.3),
    new THREE.Vector2(0.1, 0.24),
    new THREE.Vector2(0.13, 0.12),
    new THREE.Vector2(0.19, 0.02),
    new THREE.Vector2(0.215, 0.0),
  ];
  const cup = mesh(new THREE.LatheGeometry(profile, 28), gold);
  const handle = mesh(new THREE.CylinderGeometry(0.03, 0.036, 0.26, 12), enamel('#16223f'));
  handle.position.y = 0.42;
  const cap = ball(0.045, enamel('#16223f'));
  cap.position.y = 0.56;
  const clapper = ball(0.04, gold);
  clapper.position.y = 0.0;
  bell.add(cup, handle, cap, clapper);
  bell.position.y = FLOOR + 0.04;
  g.add(bell);
  return {
    group: g,
    portalY: 0.4,
    pose: 'standing',
    tick: (time) => {
      bell.rotation.z = Math.sin(time * 2.4) * 0.16;
    },
  };
}

function wrap(group: THREE.Group, portalY = 0.42): Monument {
  return { group, portalY, pose: 'emblem' };
}

/** 칸 데이터에 맞는 조형물을 만든다. 일반 칸은 null */
export function buildMonument(cell: BoardCell, decorIndex: number): Monument | null {
  let monument: Monument | null = null;

  switch (cell.kind) {
    case 'START':
      monument = startGate();
      break;
    case 'MULTI_REST':
      monument = wrap(multiRest(cell.count ?? 0));
      break;
    case 'DA_CAPO':
      monument = wrap(new THREE.Group().add(textSign('D.C.', 0.72, 0.4)));
      break;
    case 'DAL_SEGNO':
      monument = wrap(new THREE.Group().add(textSign('D.S.', 0.72, 0.4)));
      break;
    case 'DOUBLE_SEGNO_TRIGGER':
      monument = wrap(new THREE.Group().add(textSign('D.S.S', 0.76, 0.36)));
      break;
    case 'REPEAT_START':
      monument = wrap(repeatSign(false));
      break;
    case 'REPEAT_END':
      monument = wrap(repeatSign(true));
      break;
    case 'FIRST_ENDING':
      monument = wrap(volta(1));
      break;
    case 'SECOND_ENDING':
      monument = wrap(volta(2));
      break;
    case 'SEGNO':
      monument = wrap(segno());
      break;
    case 'CODA':
      monument = wrap(coda());
      break;
    case 'DOUBLE_SEGNO':
      monument = wrap(doubleSegno(), 0.36);
      break;
    case 'DOUBLE_CODA':
      monument = wrap(doubleCoda(), 0.36);
      break;
    case 'FERMATA':
      monument = wrap(fermata(), 0.3);
      break;
    case 'FINE':
      monument = fineGate();
      break;
    case 'NORMAL':
      if (cell.label === '🔑') monument = goldenKey();
      else if (cell.isCorner) monument = decorIndex % 2 === 0 ? metronome() : handbell();
      break;
    default:
      monument = null;
  }

  return monument;
}
