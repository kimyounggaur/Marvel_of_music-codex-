// 3D 주사위. 결과 값은 게임 루프가 미리 정해서 넘겨주고, 여기서는 그 눈이 위로 오도록 굴려서 멈춘다.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { diceFaceTexture } from './textures';
import { Animator, clamp, ease } from './tween';

export const DICE_SIZE = 0.6;
const HALF = DICE_SIZE / 2;

// 면 배치(마주 보는 면의 합 = 7): +x 3, -x 4, +y 1, -y 6, +z 2, -z 5
const FACE_ORDER = [3, 4, 1, 6, 2, 5];

/** 값 v가 위(+y)를 향하게 만드는 회전 */
const FACE_UP: Record<number, THREE.Euler> = {
  1: new THREE.Euler(0, 0, 0),
  6: new THREE.Euler(Math.PI, 0, 0),
  2: new THREE.Euler(-Math.PI / 2, 0, 0),
  5: new THREE.Euler(Math.PI / 2, 0, 0),
  3: new THREE.Euler(0, 0, Math.PI / 2),
  4: new THREE.Euler(0, 0, -Math.PI / 2),
};

const Y_AXIS = new THREE.Vector3(0, 1, 0);

export interface RollOptions {
  value: number;
  durationMs: number;
  /** 0~1: 세게 던질수록 높이 뜨고 더 많이 구른다 */
  power: number;
  to: THREE.Vector3;
  /** 카메라 방향(주사위 윗면 눈이 화면에 바르게 보이도록) */
  yaw: number;
  onBounce?: (index: number, strength: number) => void;
  onSettle?: () => void;
}

export class Dice3D {
  readonly group = new THREE.Group();
  readonly mesh: THREE.Mesh;
  value = 1;
  rolling = false;
  /** 굴릴 차례를 기다리며 떠서 도는 중 */
  hovering = false;
  private readonly home = new THREE.Vector3();
  /** 마지막으로 멈춘 자리. 다음 차례에 떠오를 때까지 여기 놓여 있다 */
  private readonly anchor = new THREE.Vector3();
  private readonly target = new THREE.Quaternion();
  private hoverBlend = 0;
  private hoverAngle = 0;
  private readonly spinEuler = new THREE.Euler();
  private readonly spinQuat = new THREE.Quaternion();

  constructor(private readonly animator: Animator) {
    const materials = FACE_ORDER.map(
      (value) =>
        new THREE.MeshPhysicalMaterial({
          map: diceFaceTexture(value),
          roughness: 0.25,
          clearcoat: 1,
          clearcoatRoughness: 0.12,
        }),
    );
    this.mesh = new THREE.Mesh(new RoundedBoxGeometry(DICE_SIZE, DICE_SIZE, DICE_SIZE, 5, 0.1), materials);
    this.mesh.castShadow = true;
    this.mesh.userData.isDice = true;
    this.group.add(this.mesh);
    this.target.copy(Dice3D.faceQuaternion(1, 0));
  }

  static faceQuaternion(value: number, yaw: number): THREE.Quaternion {
    const face = new THREE.Quaternion().setFromEuler(FACE_UP[value] ?? FACE_UP[1]);
    const spin = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, yaw);
    return spin.multiply(face);
  }

  /** 주사위 자리 지정(무대 방향이 바뀌면 다시 불린다) */
  setHome(position: THREE.Vector3): void {
    this.home.copy(position);
  }

  /** 지정한 눈으로 바닥에 그냥 내려놓는다 */
  rest(value: number, yaw: number): void {
    this.animator.cancel(this);
    this.rolling = false;
    this.value = value;
    this.target.copy(Dice3D.faceQuaternion(value, yaw));
    this.mesh.quaternion.copy(this.target);
    this.mesh.scale.setScalar(1);
    this.anchor.copy(this.home);
    this.group.position.set(this.home.x, HALF, this.home.z);
    this.hoverBlend = 0;
  }

  roll(opts: RollOptions): void {
    const { value, durationMs, onBounce, onSettle } = opts;
    const power = clamp(opts.power, 0, 1);
    this.animator.cancel(this);
    this.rolling = true;
    this.hovering = false;
    this.hoverBlend = 0;
    this.value = value;

    const from = this.group.position.clone();
    const to = opts.to.clone();
    const startY = Math.max(from.y, HALF + 0.4);
    const peak = 1.5 + power * 1.7;
    const target = Dice3D.faceQuaternion(value, opts.yaw + (Math.random() - 0.5) * 0.5);
    this.target.copy(target);

    // 굴러가는 방향에 수직인 축으로 앞구르기 + 비스듬한 축으로 한 번 더
    const travel = new THREE.Vector3(to.x - from.x, 0, to.z - from.z);
    if (travel.lengthSq() < 0.01) travel.set(Math.random() - 0.5, 0, Math.random() - 0.5);
    travel.normalize();
    const axisA = new THREE.Vector3(travel.z, 0, -travel.x).normalize();
    const axisB = new THREE.Vector3(Math.random() - 0.5, 0.6, Math.random() - 0.5).normalize();
    const turnsA = (2.5 + power * 2.5) * Math.PI * 2;
    const turnsB = (1 + power * 1.5) * Math.PI * 2 * (Math.random() < 0.5 ? -1 : 1);
    const qa = new THREE.Quaternion();
    const qb = new THREE.Quaternion();

    // 시간 구간: 던져 올림 → 첫 낙하 → 튀기 3번 → 멈춤
    const seg = [0.0, 0.46, 0.7, 0.86, 0.94];
    const heights = [peak, peak * 0.3, peak * 0.1, 0.03];
    let bounceIndex = 0;

    this.animator.add({
      duration: durationMs,
      tag: this,
      update: (_, raw) => {
        // 수평 이동: 처음엔 빠르고 끝에서 멈춘다
        const h = ease.outCubic(Math.min(1, raw / 0.94));
        const x = from.x + (to.x - from.x) * h;
        const z = from.z + (to.z - from.z) * h;

        // 수직: 구간별 포물선
        let y = HALF;
        if (raw < seg[1]) {
          const u = raw / seg[1];
          // 첫 구간은 손에서 떠올랐다가 떨어진다
          const arc = 4 * u * (1 - u);
          y = startY + (HALF - startY) * u * u + heights[0] * arc;
        } else if (raw < seg[4]) {
          const i = raw < seg[2] ? 1 : raw < seg[3] ? 2 : 3;
          const u = (raw - seg[i]) / (seg[i + 1] - seg[i]);
          y = HALF + heights[i] * 4 * u * (1 - u);
        }
        this.group.position.set(x, y, z);

        // 바닥에 닿는 순간 알림(소리·먼지)
        while (bounceIndex < 4 && raw >= seg[bounceIndex + 1]) {
          onBounce?.(bounceIndex, 1 - bounceIndex * 0.28);
          bounceIndex += 1;
        }

        // 회전: 남은 회전량이 0으로 줄어들며 정확히 목표 면에서 멈춘다
        const remain = 1 - ease.outCubic(Math.min(1, raw / 0.9));
        qa.setFromAxisAngle(axisA, turnsA * remain);
        qb.setFromAxisAngle(axisB, turnsB * remain);
        this.mesh.quaternion.copy(qa).multiply(qb).multiply(target);

        // 멈춘 뒤 톡 튀어나오는 강조
        if (raw > 0.94) {
          const u = (raw - 0.94) / 0.06;
          this.mesh.scale.setScalar(1 + Math.sin(u * Math.PI) * 0.22);
        }
      },
      complete: () => {
        this.mesh.quaternion.copy(target);
        this.mesh.scale.setScalar(1);
        this.group.position.set(to.x, HALF, to.z);
        this.anchor.copy(to);
        this.rolling = false;
        onSettle?.();
      },
    });
  }

  update(time: number, dtSec: number): void {
    if (this.rolling) return;
    // 굴릴 차례면 떠올라 천천히 돌고, 아니면 제자리에 내려앉는다
    const goal = this.hovering ? 1 : 0;
    this.hoverBlend += (goal - this.hoverBlend) * (1 - Math.exp(-6 * dtSec));
    const k = this.hoverBlend;
    const bob = Math.sin(time * 2.2) * 0.07 * k;
    const follow = 1 - Math.exp(-5 * dtSec);
    const spot = this.hovering ? this.home : this.anchor;
    this.group.position.x += (spot.x - this.group.position.x) * follow;
    this.group.position.z += (spot.z - this.group.position.z) * follow;
    this.group.position.y = HALF + k * 0.75 + bob;
    if (k > 0.002) {
      // 떠 있는 동안에만 회전각이 쌓이고, 내려앉을 때는 목표 눈으로 부드럽게 되돌아간다
      this.hoverAngle += dtSec * k;
      this.spinEuler.set(this.hoverAngle * 0.9, this.hoverAngle * 1.3, 0);
      this.spinQuat.setFromEuler(this.spinEuler).multiply(this.target);
      this.mesh.quaternion.copy(this.target).slerp(this.spinQuat, Math.min(1, k * 1.2));
    } else {
      this.hoverAngle = 0;
      this.mesh.quaternion.copy(this.target);
    }
  }
}
