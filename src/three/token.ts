// 플레이어 말: 얼굴이 달린 8분음표 캐릭터. 이 프로젝트만의 오리지널 디자인이다.
import * as THREE from 'three';
import { labelTexture } from './textures';

const eyeMaterial = new THREE.MeshStandardMaterial({ color: '#16223f', roughness: 0.25 });
const glintMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff' });
const cheekMaterial = new THREE.MeshBasicMaterial({ color: '#ff8fa8', transparent: true, opacity: 0.85 });
const arrowMaterial = new THREE.MeshStandardMaterial({
  color: '#ffd23f',
  emissive: '#ff9d00',
  emissiveIntensity: 0.35,
  roughness: 0.3,
  metalness: 0.2,
});

function flagShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.09, -0.07, 0.25, -0.11, 0.21, -0.32);
  s.bezierCurveTo(0.2, -0.2, 0.1, -0.15, 0, -0.14);
  s.closePath();
  return s;
}

export class Token3D {
  /** 월드 위치(발 기준). 카메라를 향해 돈다 */
  readonly group = new THREE.Group();
  /** 찌그러짐·기울기·회전이 걸리는 몸통 묶음(원점 = 발) */
  readonly pivot = new THREE.Group();
  readonly color: THREE.Color;
  readonly id: number;

  /** 지금 서 있는(또는 향하고 있는) 칸 */
  cellIndex = 0;
  /** 이동·점프 애니메이션 중이면 true: 자리 맞춤을 건드리지 않는다 */
  busy = false;
  /** 우승 세리머니 중 */
  celebrating = false;
  frozen = 0;

  private readonly ring: THREE.Mesh;
  private readonly arrow: THREE.Mesh;
  private readonly ice: THREE.Mesh;
  private label: THREE.Sprite | null = null;
  private labelText = '';
  private current = false;
  private showArrow = false;
  private phase: number;

  constructor(id: number, colorHex: string) {
    this.id = id;
    this.color = new THREE.Color(colorHex);
    this.phase = id * 1.7;

    const body = new THREE.MeshPhysicalMaterial({
      color: this.color,
      roughness: 0.28,
      clearcoat: 1,
      clearcoatRoughness: 0.18,
    });
    const dark = new THREE.MeshPhysicalMaterial({
      color: this.color.clone().multiplyScalar(0.55),
      roughness: 0.4,
      clearcoat: 0.6,
    });

    // 음표 머리(몸통)
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 22), body);
    head.scale.set(1.14, 0.94, 1);
    head.position.y = 0.215;
    head.rotation.z = 0.2;
    head.castShadow = true;

    // 기둥과 꼬리
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.5, 10), body);
    stem.position.set(0.195, 0.5, 0);
    stem.castShadow = true;
    const flagGeometry = new THREE.ExtrudeGeometry(flagShape(), {
      depth: 0.04,
      bevelEnabled: true,
      bevelThickness: 0.01,
      bevelSize: 0.01,
      bevelSegments: 2,
      curveSegments: 10,
    });
    flagGeometry.translate(0, 0, -0.02);
    const flag = new THREE.Mesh(flagGeometry, body);
    flag.position.set(0.21, 0.75, 0);
    flag.castShadow = true;

    // 얼굴
    const eyeGeometry = new THREE.SphereGeometry(0.03, 14, 10);
    const glintGeometry = new THREE.SphereGeometry(0.011, 8, 6);
    const face = new THREE.Group();
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(eyeGeometry, eyeMaterial);
      eye.position.set(side * 0.078, 0.255, 0.178);
      eye.scale.set(1, 1.25, 0.7);
      const glint = new THREE.Mesh(glintGeometry, glintMaterial);
      glint.position.set(side * 0.078 + 0.012, 0.272, 0.2);
      const cheek = new THREE.Mesh(new THREE.CircleGeometry(0.03, 14), cheekMaterial);
      cheek.position.set(side * 0.142, 0.2, 0.15);
      cheek.rotation.y = side * 0.72;
      face.add(eye, glint, cheek);
    }
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.011, 8, 16, Math.PI), eyeMaterial);
    smile.rotation.z = Math.PI;
    smile.position.set(0, 0.205, 0.192);
    face.add(smile);

    // 발
    const footGeometry = new THREE.SphereGeometry(0.06, 14, 10);
    for (const side of [-1, 1]) {
      const foot = new THREE.Mesh(footGeometry, dark);
      foot.scale.set(1, 0.55, 1.35);
      foot.position.set(side * 0.09, 0.03, 0.05);
      foot.castShadow = true;
      this.pivot.add(foot);
    }

    this.pivot.add(head, stem, flag, face);
    this.pivot.scale.setScalar(0.95);
    this.group.add(this.pivot);

    // 현재 차례 표시: 발밑 고리
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.29, 0.37, 40),
      new THREE.MeshBasicMaterial({ color: this.color, transparent: true, opacity: 0.9, depthWrite: false }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.012;
    this.ring.visible = false;
    this.group.add(this.ring);

    // 현재 차례 표시: 머리 위 화살표
    this.arrow = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.17, 4), arrowMaterial);
    this.arrow.rotation.x = Math.PI;
    this.arrow.position.y = 1.08;
    this.arrow.visible = false;
    this.group.add(this.arrow);

    // 페르마타 얼음
    this.ice = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.47, 0),
      new THREE.MeshPhysicalMaterial({
        color: '#c4ecff',
        roughness: 0.06,
        transparent: true,
        opacity: 0.55,
        flatShading: true,
        clearcoat: 1,
        depthWrite: false,
      }),
    );
    this.ice.scale.set(0, 0, 0);
    this.ice.position.y = 0.42;
    this.ice.visible = false;
    this.ice.renderOrder = 3;
    this.group.add(this.ice);
  }

  setCurrent(current: boolean, showArrow: boolean): void {
    this.current = current;
    this.showArrow = current && showArrow;
    this.ring.visible = current;
    this.arrow.visible = this.showArrow;
  }

  get iceMesh(): THREE.Mesh {
    return this.ice;
  }

  /** 머리 위 말풍선("쉬는 중 2" 등). 빈 문자열이면 지운다 */
  setLabel(text: string, bg = '#3fa9f5'): void {
    if (text === this.labelText) return;
    this.labelText = text;
    if (this.label) {
      this.group.remove(this.label);
      this.label.material.map?.dispose();
      this.label.material.dispose();
      this.label = null;
    }
    if (!text) return;
    const material = new THREE.SpriteMaterial({ map: labelTexture(text, bg), transparent: true, depthWrite: false });
    this.label = new THREE.Sprite(material);
    this.label.scale.set(0.95, 0.33, 1);
    this.label.position.y = 1.2;
    this.label.renderOrder = 8;
    this.group.add(this.label);
  }

  update(time: number): void {
    if (this.ring.visible) {
      const pulse = 1 + Math.sin(time * 4) * 0.08;
      this.ring.scale.setScalar(pulse);
      (this.ring.material as THREE.MeshBasicMaterial).opacity = 0.65 + Math.sin(time * 4) * 0.25;
      this.ring.rotation.z = time * 0.8;
    }
    if (this.arrow.visible) {
      this.arrow.position.y = 1.08 + Math.sin(time * 5) * 0.06;
      this.arrow.rotation.y = time * 2.4;
    }
    if (this.ice.visible) {
      this.ice.rotation.y = time * 0.3 + this.phase;
    }
    if (this.celebrating && !this.busy) {
      // 제자리에서 신나게 뛴다
      const t = (time * 2.1 + this.phase) % 1;
      const hop = Math.sin(t * Math.PI);
      this.pivot.position.y = hop * 0.55;
      this.pivot.rotation.y = t * Math.PI * 2;
      const squash = t < 0.12 || t > 0.9 ? 0.82 : 1.06;
      this.pivot.scale.set(0.95 / Math.sqrt(squash), 0.95 * squash, 0.95 / Math.sqrt(squash));
    } else if (!this.busy && this.frozen === 0) {
      // 숨쉬기
      const breathe = Math.sin(time * 2.6 + this.phase) * (this.current ? 0.035 : 0.015);
      this.pivot.scale.set(0.95 * (1 - breathe * 0.5), 0.95 * (1 + breathe), 0.95 * (1 - breathe * 0.5));
    }
  }

  /** 찌그러뜨리기: sy가 1보다 작으면 납작, 크면 길쭉 */
  squash(sy: number): void {
    const sx = 1 / Math.sqrt(Math.max(0.2, sy));
    this.pivot.scale.set(0.95 * sx, 0.95 * sy, 0.95 * sx);
  }

  resetPose(): void {
    this.pivot.position.set(0, 0, 0);
    this.pivot.rotation.set(0, 0, 0);
    this.pivot.scale.setScalar(0.95);
    this.pivot.visible = true;
  }

  dispose(): void {
    this.setLabel('');
  }
}
