// 하늘에 떠 있는 공연 무대와 40칸 타일. 칸 순서·모양은 실물 보드판(14×8)을 그대로 입체로 옮겼다.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { COLS, ROWS } from '../game/movement';
import type { BoardCell } from '../game/types';
import { getSymbolMeta } from '../data/symbolMeta';
import { ISLAND_D, ISLAND_W, PITCH, STAGE_D, STAGE_W, TILE_SIZE, TILE_TOP, cellPosition } from './layout';
import { buildMonument, type Monument } from './monuments';
import { CORNER_COLORS, EDGE_STRIP, FAMILY_COLORS, TITLE_COLORS, familyOf } from './palette';
import { advanceOf, textGeometry } from './text3d';
import { cornerTopTexture, dicePadTexture, stageFloorTexture, tileTopTexture } from './textures';
import { Animator, ease } from './tween';

export interface TileView {
  index: number;
  cell: BoardCell;
  /** 눌림 애니메이션으로 위아래로 움직이는 묶음 */
  group: THREE.Group;
  body: THREE.Mesh;
  material: THREE.MeshPhysicalMaterial;
  baseColor: THREE.Color;
  /** 카메라 방향으로 도는 묶음(이름표·조형물) */
  facing: THREE.Group;
  monument: Monument | null;
  /** 조형물 묶음(둥실 떠오르는 애니메이션용) */
  monumentHolder: THREE.Group | null;
  /** 기호의 기울기를 잡는 묶음(발동 연출 때 벌떡 일어선다) */
  monumentTilt: THREE.Group | null;
}

function roundedRect(w: number, h: number, r: number): THREE.Shape {
  const shape = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(x + w, y + h - r);
  shape.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  shape.lineTo(x + r, y + h);
  shape.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(x, y + r);
  shape.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return shape;
}

/** 둥근 사각 판. 윗면이 y=top에 오도록 눕혀서 돌려준다 */
function slab(w: number, d: number, r: number, depth: number, bevel: number, top: number): THREE.ExtrudeGeometry {
  const geometry = new THREE.ExtrudeGeometry(roundedRect(w, d, r), {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 10,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, top - depth - bevel, 0);
  return geometry;
}

/**
 * 떠 있는 기호(엠블럼): 바닥에서 약 20° 들린 채 카메라를 향해 누워 있다.
 * 높이·각도·크기는 "뒤 칸의 이름표 띠를 가리지 않는다"는 조건으로 맞춘 값이다.
 */
export const EMBLEM_TILT = -1.22;
export const EMBLEM_HEIGHT = 0.2;
const EMBLEM_Z = -0.08;
const EMBLEM_MAX_W = 0.72;
const EMBLEM_MAX_H = 0.5;
/** 서 있는 조형물(깃발문 등)도 카메라 쪽으로 살짝 젖힌다 */
const STANDING_TILT = -0.3;

export class Board3D {
  readonly group = new THREE.Group();
  readonly tiles: TileView[] = [];
  /** 무대 한가운데(제목 글자 + 주사위 자리). 카메라 방향에 맞춰 통째로 돈다 */
  readonly center = new THREE.Group();
  readonly titleLetters: THREE.Mesh[] = [];
  private readonly dicePad: THREE.Mesh;
  private readonly tickers: Array<(time: number) => void> = [];
  private facingYaw = 0;

  constructor(
    cells: BoardCell[],
    private readonly animator: Animator,
  ) {
    this.buildIsland();
    this.buildEdgeStrips();
    this.buildTiles(cells);
    this.buildTitle();

    this.dicePad = new THREE.Mesh(
      new THREE.PlaneGeometry(2.7, 2.7),
      new THREE.MeshBasicMaterial({ map: dicePadTexture(), transparent: true, depthWrite: false }),
    );
    this.dicePad.rotation.x = -Math.PI / 2;
    this.dicePad.position.set(0, 0.012, 1.3);
    this.center.add(this.dicePad);
    this.group.add(this.center);
  }

  private buildIsland(): void {
    const cream = new THREE.MeshStandardMaterial({ color: '#f9d68c', roughness: 0.75 });
    const goldTrim = new THREE.MeshStandardMaterial({ color: '#ffbf2e', metalness: 0.7, roughness: 0.3 });
    const top = new THREE.Mesh(slab(ISLAND_W, ISLAND_D, 1.0, 0.3, 0.09, 0), [cream, goldTrim]);
    top.receiveShadow = true;
    this.group.add(top);

    // 무대 치마(공연장 벨벳 커튼)
    const velvet = new THREE.MeshStandardMaterial({ color: '#c2264a', roughness: 0.85 });
    const skirt = new THREE.Mesh(slab(ISLAND_W - 0.5, ISLAND_D - 0.5, 0.85, 0.95, 0, -0.48), velvet);
    this.group.add(skirt);
    const hem = new THREE.Mesh(slab(ISLAND_W - 0.36, ISLAND_D - 0.36, 0.9, 0.1, 0.03, -1.4), goldTrim);
    this.group.add(hem);

    // 떠 있는 섬의 밑동
    const rock = new THREE.Mesh(
      new THREE.SphereGeometry(1, 40, 18, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: '#8e1d3c', roughness: 0.9 }),
    );
    rock.scale.set((ISLAND_W - 0.7) / 2, 2.3, (ISLAND_D - 0.7) / 2);
    rock.position.y = -1.52;
    this.group.add(rock);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(STAGE_W, STAGE_D),
      new THREE.MeshStandardMaterial({ map: stageFloorTexture(), roughness: 0.82 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.006;
    floor.receiveShadow = true;
    this.group.add(floor);
  }

  /** 실물 보드판의 안쪽 색 띠 */
  private buildEdgeStrips(): void {
    const halfW = STAGE_W / 2;
    const halfD = STAGE_D / 2;
    const zEdge = ((ROWS - 2) * PITCH) / 2 - 0.025;
    const xEdge = ((COLS - 2) * PITCH) / 2 - 0.025;
    const strips: Array<{ color: string; x: number; z: number; w: number; d: number }> = [
      { color: EDGE_STRIP.topLeft, x: -halfW / 2, z: -zEdge, w: halfW, d: 0.11 },
      { color: EDGE_STRIP.topRight, x: halfW / 2, z: -zEdge, w: halfW, d: 0.11 },
      { color: EDGE_STRIP.bottomLeft, x: -halfW / 2, z: zEdge, w: halfW, d: 0.11 },
      { color: EDGE_STRIP.bottomRight, x: halfW / 2, z: zEdge, w: halfW, d: 0.11 },
      { color: EDGE_STRIP.left, x: -xEdge, z: 0, w: 0.11, d: halfD * 2 },
      { color: EDGE_STRIP.right, x: xEdge, z: 0, w: 0.11, d: halfD * 2 },
    ];
    for (const strip of strips) {
      const m = new THREE.Mesh(
        new RoundedBoxGeometry(strip.w, 0.07, strip.d, 2, 0.03),
        new THREE.MeshPhysicalMaterial({ color: strip.color, roughness: 0.4, clearcoat: 0.6 }),
      );
      m.position.set(strip.x, 0.035, strip.z);
      m.receiveShadow = true;
      this.group.add(m);
    }
  }

  private buildTiles(cells: BoardCell[]): void {
    const bodyGeometry = new RoundedBoxGeometry(TILE_SIZE, TILE_TOP, TILE_SIZE, 3, 0.06);
    const decalGeometry = new THREE.PlaneGeometry(TILE_SIZE - 0.04, TILE_SIZE - 0.04);
    let decorIndex = 0;

    for (const cell of cells) {
      const family = FAMILY_COLORS[familyOf(cell.kind)];
      const isDecorCorner = cell.kind === 'NORMAL' && cell.isCorner === true;
      const bodyColor = isDecorCorner ? CORNER_COLORS[decorIndex % CORNER_COLORS.length] : family.body;

      const material = new THREE.MeshPhysicalMaterial({
        color: bodyColor,
        roughness: 0.36,
        clearcoat: 0.65,
        clearcoatRoughness: 0.28,
      });
      const body = new THREE.Mesh(bodyGeometry, material);
      body.position.y = TILE_TOP / 2;
      body.castShadow = true;
      body.receiveShadow = true;
      body.userData.tileIndex = cell.index;

      const group = new THREE.Group();
      const pos = cellPosition(cell.index);
      group.position.set(pos.x, 0, pos.z);
      group.add(body);

      const facing = new THREE.Group();
      facing.position.y = TILE_TOP;
      group.add(facing);

      // 윗면 이름표
      const meta = getSymbolMeta(cell.kind);
      let decalTexture: THREE.Texture | null = null;
      if (cell.kind === 'START') {
        decalTexture = cornerTopTexture(family.body, '출발');
      } else if (isDecorCorner) {
        decalTexture = cornerTopTexture(bodyColor);
      } else if (meta) {
        decalTexture = tileTopTexture({ label: meta.name, band: family.band, panel: '#ffffff', marker: cell.markerOnly });
      }
      if (decalTexture) {
        const decal = new THREE.Mesh(
          decalGeometry,
          new THREE.MeshStandardMaterial({ map: decalTexture, transparent: true, roughness: 0.55 }),
        );
        decal.rotation.x = -Math.PI / 2;
        decal.position.y = 0.004;
        decal.receiveShadow = true;
        facing.add(decal);
      }

      // 조형물
      const monument = buildMonument(cell, decorIndex);
      let monumentHolder: THREE.Group | null = null;
      let monumentTilt: THREE.Group | null = null;
      if (monument) {
        monumentHolder = new THREE.Group();
        monumentTilt = new THREE.Group();
        if (monument.pose === 'emblem') {
          // 기호를 가운데로 모으고, 이름표 띠를 가리지 않는 크기로 맞춘 뒤 타일 위에 비스듬히 띄운다.
          // 세워 두면 뒤 칸의 이름표를 가리므로, 위에서 내려다보는 카메라를 향해 눕혀서 악보처럼 읽히게 한다.
          const box = new THREE.Box3().setFromObject(monument.group);
          const size = box.getSize(new THREE.Vector3());
          const mid = box.getCenter(new THREE.Vector3());
          monument.group.position.sub(mid);
          const fit = Math.min(EMBLEM_MAX_W / size.x, EMBLEM_MAX_H / size.y, 1.6);
          monumentTilt.scale.setScalar(fit);
          monumentTilt.rotation.x = EMBLEM_TILT;
          monumentHolder.position.set(0, EMBLEM_HEIGHT, EMBLEM_Z);
        } else {
          monumentTilt.rotation.x = STANDING_TILT;
          monumentTilt.scale.setScalar(cell.kind === 'NORMAL' ? 1.25 : 1.1);
          monumentHolder.position.set(0, 0, cell.kind === 'NORMAL' ? -0.04 : -0.14);
        }
        // 발동 연출이 끝나면 이 자세로 돌아온다
        monumentTilt.userData.restTilt = monumentTilt.rotation.x;
        monumentTilt.userData.restScale = monumentTilt.scale.x;
        monumentTilt.add(monument.group);
        monumentHolder.add(monumentTilt);
        facing.add(monumentHolder);
        if (monument.props) facing.add(monument.props);
        if (monument.tick) this.tickers.push(monument.tick);
      }
      if (isDecorCorner) decorIndex += 1;

      this.group.add(group);
      this.tiles.push({
        index: cell.index,
        cell,
        group,
        body,
        material,
        baseColor: new THREE.Color(bodyColor),
        facing,
        monument,
        monumentHolder,
        monumentTilt,
      });
    }
  }

  /** 무대 한가운데에 세우는 3D 제목 "반복기호의 마블" */
  private buildTitle(): void {
    const text = '반복기호의 마블';
    const size = 1.04;
    const holder = new THREE.Group();
    let cursor = 0;
    let colorIndex = 0;
    const placed: Array<{ mesh: THREE.Mesh; x: number }> = [];

    for (const char of Array.from(text)) {
      if (char === ' ') {
        cursor += size * 0.42;
        continue;
      }
      const color = new THREE.Color(TITLE_COLORS[colorIndex % TITLE_COLORS.length]);
      colorIndex += 1;
      const face = new THREE.MeshStandardMaterial({ color, roughness: 0.42, envMapIntensity: 0.5 });
      const side = new THREE.MeshStandardMaterial({
        color: color.clone().multiplyScalar(0.6),
        roughness: 0.5,
        envMapIntensity: 0.4,
      });
      const letter = new THREE.Mesh(textGeometry(char, { size, depth: 0.24, bevel: 0.035 }), [face, side]);
      letter.castShadow = true;
      const advance = advanceOf(char, size);
      placed.push({ mesh: letter, x: cursor + advance / 2 });
      cursor += advance * 0.98;
    }

    const total = cursor;
    for (const item of placed) {
      item.mesh.position.set(item.x - total / 2, 0, 0);
      holder.add(item.mesh);
      this.titleLetters.push(item.mesh);
    }
    holder.position.set(0, 0.06, -0.75);
    holder.rotation.x = -0.72;
    this.center.add(holder);
  }

  /** 카메라가 보는 방향(yaw)에 맞춰 이름표·조형물·제목을 돌린다 */
  setFacing(yaw: number): void {
    if (yaw === this.facingYaw) return;
    this.facingYaw = yaw;
    for (const tile of this.tiles) tile.facing.rotation.y = yaw;
    this.center.rotation.y = yaw;
    // 세로 화면(90° 회전)에서는 제목이 무대 깊이 안에 들어오도록 줄인다
    this.center.scale.setScalar(1 - 0.2 * Math.abs(Math.sin(yaw)));
  }

  get facing(): number {
    return this.facingYaw;
  }

  /** 칸 윗면 중심의 월드 좌표(눌림 포함) */
  tileTop(index: number, out = new THREE.Vector3()): THREE.Vector3 {
    const tile = this.tiles[index];
    return out.set(tile.group.position.x, TILE_TOP + tile.group.position.y, tile.group.position.z);
  }

  /** 조형물의 중심(포털이 열리는 곳) 월드 좌표 */
  monumentAnchor(index: number, out = new THREE.Vector3()): THREE.Vector3 {
    const tile = this.tiles[index];
    const emblem = tile.monument?.pose === 'emblem';
    const local = new THREE.Vector3(0, emblem ? EMBLEM_HEIGHT + 0.08 : tile.monument?.portalY ?? 0.4, tile.monumentHolder?.position.z ?? 0);
    local.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.facingYaw);
    return out.set(tile.group.position.x + local.x, TILE_TOP + local.y, tile.group.position.z + local.z);
  }

  /** 주사위가 놓이는 자리의 월드 좌표 */
  diceHome(out = new THREE.Vector3()): THREE.Vector3 {
    out.copy(this.dicePad.position);
    out.y = 0;
    return this.center.localToWorld(out);
  }

  /** 건반처럼 눌렸다 올라온다 */
  press(index: number, depth = 0.07): void {
    const tile = this.tiles[index];
    if (!tile) return;
    const tag = tile.group;
    this.animator.cancel(tag);
    this.animator.add({
      duration: 90,
      tag,
      ease: ease.outQuad,
      update: (k) => {
        tile.group.position.y = -depth * k;
      },
      complete: () => {
        this.animator.add({
          duration: 420,
          tag,
          ease: ease.outElastic,
          update: (k) => {
            tile.group.position.y = -depth * (1 - k);
          },
        });
      },
    });
  }

  /** 타일 몸통이 잠깐 지정한 색으로 물든다(계이름 색) */
  flash(index: number, color: THREE.ColorRepresentation, holdMs = 140, fadeMs = 520): void {
    const tile = this.tiles[index];
    if (!tile) return;
    const tag = tile.material;
    const target = new THREE.Color(color);
    this.animator.cancel(tag);
    tile.material.color.copy(target);
    tile.material.emissive.copy(target).multiplyScalar(0.35);
    this.animator.add({
      duration: fadeMs,
      delay: holdMs,
      tag,
      ease: ease.inOutQuad,
      update: (k) => {
        tile.material.color.copy(target).lerp(tile.baseColor, k);
        tile.material.emissive.copy(target).multiplyScalar(0.35 * (1 - k));
      },
    });
  }

  /** 제목 글자가 차례로 튀어 오른다(시작·우승 때) */
  waveTitle(): void {
    this.titleLetters.forEach((letter, i) => {
      this.animator.add({
        duration: 620,
        delay: i * 90,
        tag: this.titleLetters,
        update: (_, raw) => {
          letter.position.y = Math.sin(raw * Math.PI) * 0.55;
          letter.rotation.z = Math.sin(raw * Math.PI * 2) * 0.12;
        },
        complete: () => {
          letter.position.y = 0;
          letter.rotation.z = 0;
        },
      });
    });
  }

  update(time: number): void {
    for (const tick of this.tickers) tick(time);
    // 기호 조형물이 칸마다 엇박으로 둥실거린다
    for (const tile of this.tiles) {
      if (tile.monumentHolder && tile.monument?.pose === 'emblem') {
        tile.monumentHolder.position.y = EMBLEM_HEIGHT + Math.sin(time * 1.6 + tile.index * 0.9) * 0.025;
      }
    }
  }
}
