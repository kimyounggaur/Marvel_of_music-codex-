// 카메라 리그: 목표(바라볼 점·거리·각도)를 부드럽게 따라가고, HUD가 가리지 않는 안전 영역에 장면을 맞춘다.
import * as THREE from 'three';
import { clamp, damp, wrapAngle } from './tween';

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Shot {
  target: THREE.Vector3;
  distance: number;
  yaw: number;
  pitch: number;
}

export const FOV = 30;

export class CameraRig {
  readonly camera = new THREE.PerspectiveCamera(FOV, 1, 1, 400);

  // 현재 값(부드럽게 변한다)
  private readonly target = new THREE.Vector3();
  private distance = 40;
  private yawNow = 0;
  private pitchNow = 1;

  // 목표 값
  private readonly goalTarget = new THREE.Vector3();
  private goalDistance = 40;
  private goalYaw = 0;
  private goalPitch = 1;

  // 사용자가 드래그·핀치로 더한 값
  userYaw = 0;
  userPitch = 0;
  userZoom = 1;

  private width = 1;
  private height = 1;
  private insets: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
  private shake = 0;
  private readonly shakeOffset = new THREE.Vector3();
  private readonly probe = new THREE.PerspectiveCamera(FOV, 1, 1, 400);
  private readonly tmp = new THREE.Vector3();
  private snapNext = true;

  setViewport(width: number, height: number, insets: Insets): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.insets = insets;
    this.camera.aspect = this.width / this.height;
    this.applyProjection();
  }

  get aspect(): number {
    return this.width / this.height;
  }

  get yaw(): number {
    return this.yawNow;
  }

  get isPortrait(): boolean {
    return this.height > this.width * 1.05;
  }

  /** HUD 안전 영역의 중심이 화면 중심이 되도록 투영 중심을 옮긴다 */
  private applyProjection(): void {
    this.camera.updateProjectionMatrix();
    const cx = (this.insets.left - this.insets.right) / this.width;
    const cy = (this.insets.bottom - this.insets.top) / this.height;
    this.camera.projectionMatrix.elements[8] = -cx;
    this.camera.projectionMatrix.elements[9] = -cy;
    this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
  }

  private place(camera: THREE.PerspectiveCamera, target: THREE.Vector3, distance: number, yaw: number, pitch: number): void {
    const cp = Math.cos(pitch);
    camera.position.set(
      target.x + Math.sin(yaw) * cp * distance,
      target.y + Math.sin(pitch) * distance,
      target.z + Math.cos(yaw) * cp * distance,
    );
    camera.lookAt(target);
    camera.updateMatrixWorld(true);
  }

  /** 주어진 점들이 안전 영역 안에 모두 들어오는 가장 가까운 거리 */
  fitDistance(points: THREE.Vector3[], target: THREE.Vector3, yaw: number, pitch: number): number {
    const hx = Math.max(0.2, 1 - (this.insets.left + this.insets.right) / this.width);
    const hy = Math.max(0.2, 1 - (this.insets.top + this.insets.bottom) / this.height);
    this.probe.fov = FOV;
    this.probe.aspect = this.width / this.height;
    this.probe.updateProjectionMatrix();

    const fits = (distance: number): boolean => {
      this.place(this.probe, target, distance, yaw, pitch);
      for (const point of points) {
        this.tmp.copy(point).project(this.probe);
        if (Math.abs(this.tmp.x) > hx || Math.abs(this.tmp.y) > hy) return false;
      }
      return true;
    };

    let lo = 4;
    let hi = 260;
    for (let i = 0; i < 26; i += 1) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) hi = mid;
      else lo = mid;
    }
    return hi;
  }

  /** 가로로 widthUnits만큼 보이는 거리 */
  distanceForWidth(widthUnits: number): number {
    const hx = Math.max(0.2, 1 - (this.insets.left + this.insets.right) / this.width);
    const halfTan = Math.tan(THREE.MathUtils.degToRad(FOV) / 2) * (this.width / this.height) * hx;
    return widthUnits / (2 * halfTan);
  }

  setGoal(shot: Shot): void {
    this.goalTarget.copy(shot.target);
    this.goalDistance = shot.distance;
    this.goalYaw = shot.yaw;
    this.goalPitch = shot.pitch;
  }

  /** 다음 프레임에 보간 없이 목표로 바로 이동 */
  snap(): void {
    this.snapNext = true;
  }

  addShake(amount: number): void {
    this.shake = Math.min(0.5, this.shake + amount);
  }

  resetUser(): void {
    this.userYaw = 0;
    this.userPitch = 0;
    this.userZoom = 1;
  }

  update(dtSec: number, speed = 3.6): void {
    const yawGoal = this.goalYaw + this.userYaw;
    const pitchGoal = clamp(this.goalPitch + this.userPitch, 0.42, 1.42);
    const distGoal = this.goalDistance * this.userZoom;

    if (this.snapNext) {
      this.snapNext = false;
      this.target.copy(this.goalTarget);
      this.distance = distGoal;
      this.yawNow = yawGoal;
      this.pitchNow = pitchGoal;
    } else {
      const k = damp(speed, dtSec);
      this.target.lerp(this.goalTarget, k);
      this.distance += (distGoal - this.distance) * k;
      this.yawNow += wrapAngle(yawGoal - this.yawNow) * k;
      this.pitchNow += (pitchGoal - this.pitchNow) * k;
    }

    this.place(this.camera, this.target, this.distance, this.yawNow, this.pitchNow);

    if (this.shake > 0.001) {
      this.shakeOffset.set((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake, 0);
      this.camera.position.add(this.shakeOffset.applyQuaternion(this.camera.quaternion));
      this.camera.updateMatrixWorld(true);
      this.shake *= Math.exp(-9 * dtSec);
    } else {
      this.shake = 0;
    }
  }
}
