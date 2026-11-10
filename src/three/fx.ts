// 효과 시스템: 입자(빛나는 것/불투명한 것), 충격파 고리, 빛기둥, 번쩍임, 색종이.
// 모두 미리 만들어 둔 풀에서 꺼내 쓰므로 연출 중에 새 객체를 만들지 않는다.
import * as THREE from 'three';
import { beamTexture, glowTexture, ringTexture } from './textures';

const VERTEX = /* glsl */ `
  attribute vec4 aColor;
  attribute float aSize;
  uniform float uPx;
  varying vec4 vColor;
  void main() {
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPx / max(0.1, -mv.z);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform float uSoft;
  varying vec4 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float hard = 1.0 - smoothstep(0.78, 1.0, d);
    float soft = pow(1.0 - d, 1.5);
    gl_FragColor = vec4(vColor.rgb, vColor.a * mix(hard, soft, uSoft));
    #include <colorspace_fragment>
  }
`;

export interface BurstOptions {
  count: number;
  colors: THREE.ColorRepresentation[];
  /** 초속(월드 단위) 범위 */
  speed?: [number, number];
  /** 위쪽으로 더하는 속도 */
  up?: number;
  /** 수평으로 퍼지는 정도(1 = 사방, 0 = 위로만) */
  spread?: number;
  gravity?: number;
  drag?: number;
  /** 수명(초) 범위 */
  life?: [number, number];
  /** 크기(월드 단위) 범위 */
  size?: [number, number];
  /** true면 빛나는(더하기) 입자, false면 불투명 입자 */
  glow?: boolean;
  /** 시작 위치를 흩뜨리는 반경 */
  radius?: number;
}

class ParticleLayer {
  readonly points: THREE.Points;
  private readonly capacity: number;
  private readonly pos: Float32Array;
  private readonly col: Float32Array;
  private readonly size: Float32Array;
  private readonly vel: Float32Array;
  private readonly life: Float32Array;
  private readonly maxLife: Float32Array;
  private readonly baseSize: Float32Array;
  private readonly gravity: Float32Array;
  private readonly drag: Float32Array;
  private readonly baseAlpha: Float32Array;
  private cursor = 0;
  private alive = 0;
  readonly material: THREE.ShaderMaterial;

  constructor(capacity: number, glow: boolean) {
    this.capacity = capacity;
    this.pos = new Float32Array(capacity * 3);
    this.col = new Float32Array(capacity * 4);
    this.size = new Float32Array(capacity);
    this.vel = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.baseSize = new Float32Array(capacity);
    this.gravity = new Float32Array(capacity);
    this.drag = new Float32Array(capacity);
    this.baseAlpha = new Float32Array(capacity);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 200);

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: { uPx: { value: 600 }, uSoft: { value: glow ? 1 : 0 } },
      transparent: true,
      depthWrite: false,
      blending: glow ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = glow ? 6 : 5;
  }

  spawn(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    color: THREE.Color,
    size: number,
    life: number,
    gravity: number,
    drag: number,
    alpha = 1,
  ): void {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.capacity;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx;
    this.vel[i * 3 + 1] = vy;
    this.vel[i * 3 + 2] = vz;
    this.col[i * 4] = color.r;
    this.col[i * 4 + 1] = color.g;
    this.col[i * 4 + 2] = color.b;
    this.col[i * 4 + 3] = alpha;
    this.baseAlpha[i] = alpha;
    this.baseSize[i] = size;
    this.size[i] = size;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.gravity[i] = gravity;
    this.drag[i] = drag;
    this.alive = Math.max(this.alive, 1);
  }

  update(dt: number): void {
    if (this.alive === 0) return;
    let any = 0;
    for (let i = 0; i < this.capacity; i += 1) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.size[i] = 0;
        this.col[i * 4 + 3] = 0;
        continue;
      }
      any += 1;
      const k = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i * 3] *= k;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * k - this.gravity[i] * dt;
      this.vel[i * 3 + 2] *= k;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const t = this.life[i] / this.maxLife[i];
      // 태어날 때 살짝 커졌다가 끝으로 갈수록 작아지며 사라진다
      this.size[i] = this.baseSize[i] * (0.35 + 0.65 * Math.min(1, t * 1.6));
      this.col[i * 4 + 3] = this.baseAlpha[i] * Math.min(1, t * 2.2);
    }
    this.alive = any;
    const g = this.points.geometry;
    (g.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (g.getAttribute('aColor') as THREE.BufferAttribute).needsUpdate = true;
    (g.getAttribute('aSize') as THREE.BufferAttribute).needsUpdate = true;
  }

  clear(): void {
    this.life.fill(0);
    this.size.fill(0);
    this.alive = 1; // 다음 update에서 버퍼를 한 번 올려보낸다
  }
}

interface RingItem {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  life: number;
  maxLife: number;
  r0: number;
  r1: number;
  opacity: number;
}

interface BeamItem {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  life: number;
  maxLife: number;
  opacity: number;
}

interface FlashItem {
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  life: number;
  maxLife: number;
  size: number;
}

const CONFETTI_COUNT = 240;
const tmpColor = new THREE.Color();
const tmpMatrix = new THREE.Matrix4();
const tmpQuat = new THREE.Quaternion();
const tmpEuler = new THREE.Euler();
const tmpScale = new THREE.Vector3(1, 1, 1);
const tmpPos = new THREE.Vector3();

const rand = (min: number, max: number): number => min + Math.random() * (max - min);

export class Fx {
  readonly group = new THREE.Group();
  /** 움직임 줄이기 설정이면 입자 수를 줄인다 */
  density = 1;

  private readonly glowLayer = new ParticleLayer(900, true);
  private readonly solidLayer = new ParticleLayer(700, false);
  private readonly rings: RingItem[] = [];
  private readonly beams: BeamItem[] = [];
  private readonly flashes: FlashItem[] = [];

  private readonly confetti: THREE.InstancedMesh;
  private readonly confettiState = new Float32Array(CONFETTI_COUNT * 10);
  private confettiTime = 0;
  private confettiCenter = new THREE.Vector3();
  private confettiArea = new THREE.Vector2(10, 6);

  constructor() {
    this.group.add(this.solidLayer.points, this.glowLayer.points);

    const ringMap = ringTexture();
    const ringGeometry = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < 16; i += 1) {
      const material = new THREE.MeshBasicMaterial({
        map: ringMap,
        transparent: true,
        depthWrite: false,
        opacity: 0,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(ringGeometry, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      mesh.renderOrder = 4;
      this.group.add(mesh);
      this.rings.push({ mesh, material, life: 0, maxLife: 1, r0: 0.2, r1: 1, opacity: 1 });
    }

    const beamMap = beamTexture();
    const beamGeometry = new THREE.CylinderGeometry(1, 1, 1, 28, 1, true);
    beamGeometry.translate(0, 0.5, 0);
    for (let i = 0; i < 8; i += 1) {
      const material = new THREE.MeshBasicMaterial({
        map: beamMap,
        transparent: true,
        depthWrite: false,
        opacity: 0,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(beamGeometry, material);
      mesh.visible = false;
      mesh.renderOrder = 4;
      this.group.add(mesh);
      this.beams.push({ mesh, material, life: 0, maxLife: 1, opacity: 1 });
    }

    const glowMap = glowTexture();
    for (let i = 0; i < 8; i += 1) {
      const material = new THREE.SpriteMaterial({
        map: glowMap,
        transparent: true,
        depthWrite: false,
        opacity: 0,
        blending: THREE.AdditiveBlending,
      });
      const sprite = new THREE.Sprite(material);
      sprite.visible = false;
      sprite.renderOrder = 7;
      this.group.add(sprite);
      this.flashes.push({ sprite, material, life: 0, maxLife: 1, size: 1 });
    }

    this.confetti = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.11, 0.16),
      new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
      CONFETTI_COUNT,
    );
    this.confetti.frustumCulled = false;
    this.confetti.visible = false;
    const palette = ['#ff4d6d', '#ffd23f', '#3ddc97', '#3d8bff', '#b388ff', '#ff9a3d', '#ffffff'];
    for (let i = 0; i < CONFETTI_COUNT; i += 1) {
      this.confetti.setColorAt(i, tmpColor.set(palette[i % palette.length]));
    }
    this.group.add(this.confetti);
  }

  /** 화면 높이(px)와 시야각에 맞춰 입자 크기 환산값을 갱신한다 */
  setViewport(heightPx: number, fovDeg: number): void {
    const px = heightPx / (2 * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2));
    this.glowLayer.material.uniforms.uPx.value = px;
    this.solidLayer.material.uniforms.uPx.value = px;
  }

  burst(at: THREE.Vector3, opts: BurstOptions): void {
    const layer = opts.glow === false ? this.solidLayer : this.glowLayer;
    const count = Math.max(1, Math.round(opts.count * this.density));
    const [s0, s1] = opts.speed ?? [1, 3];
    const [l0, l1] = opts.life ?? [0.5, 1];
    const [z0, z1] = opts.size ?? [0.1, 0.2];
    const spread = opts.spread ?? 1;
    const radius = opts.radius ?? 0;
    for (let i = 0; i < count; i += 1) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(rand(-1, 1));
      const speed = rand(s0, s1);
      const dx = Math.sin(phi) * Math.cos(theta) * spread;
      const dy = Math.cos(phi) * (0.4 + 0.6 * spread);
      const dz = Math.sin(phi) * Math.sin(theta) * spread;
      tmpColor.set(opts.colors[Math.floor(Math.random() * opts.colors.length)]);
      layer.spawn(
        at.x + rand(-radius, radius),
        at.y + rand(-radius, radius) * 0.4,
        at.z + rand(-radius, radius),
        dx * speed,
        dy * speed + (opts.up ?? 0),
        dz * speed,
        tmpColor,
        rand(z0, z1),
        rand(l0, l1),
        opts.gravity ?? 3,
        opts.drag ?? 1.2,
      );
    }
  }

  /** 지나간 자리에 남기는 한 톨(꼬리) */
  trail(at: THREE.Vector3, color: THREE.ColorRepresentation, size = 0.16, life = 0.5, glow = true): void {
    if (this.density < 1 && Math.random() > this.density) return;
    const layer = glow ? this.glowLayer : this.solidLayer;
    layer.spawn(
      at.x + rand(-0.06, 0.06),
      at.y + rand(-0.06, 0.06),
      at.z + rand(-0.06, 0.06),
      rand(-0.25, 0.25),
      rand(-0.1, 0.4),
      rand(-0.25, 0.25),
      tmpColor.set(color),
      size,
      life,
      0.4,
      1.5,
    );
  }

  /** 한 점을 향해 빨려 들어가는 입자(포털) */
  implode(at: THREE.Vector3, colors: THREE.ColorRepresentation[], count = 40, radius = 1.1, life = 0.45): void {
    const n = Math.max(1, Math.round(count * this.density));
    for (let i = 0; i < n; i += 1) {
      const theta = Math.random() * Math.PI * 2;
      const r = rand(radius * 0.6, radius);
      const y = rand(-0.2, 0.7);
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      // 접선 방향 속도를 섞어 소용돌이처럼 감겨 들어가게 한다
      const inward = r / life;
      const vx = -Math.cos(theta) * inward - Math.sin(theta) * 1.6;
      const vz = -Math.sin(theta) * inward + Math.cos(theta) * 1.6;
      tmpColor.set(colors[Math.floor(Math.random() * colors.length)]);
      this.glowLayer.spawn(at.x + x, at.y + y, at.z + z, vx, -y / life, vz, tmpColor, rand(0.1, 0.2), life, 0, 0);
    }
  }

  ring(
    at: THREE.Vector3,
    color: THREE.ColorRepresentation,
    r0 = 0.3,
    r1 = 1.6,
    life = 0.6,
    glow = false,
    opacity = 1,
  ): void {
    const item = this.rings.find((r) => r.life <= 0) ?? this.rings[0];
    item.life = life;
    item.maxLife = life;
    item.r0 = r0;
    item.r1 = r1;
    item.opacity = opacity;
    item.material.color.set(color);
    item.material.blending = glow ? THREE.AdditiveBlending : THREE.NormalBlending;
    item.mesh.position.set(at.x, at.y + 0.02, at.z);
    item.mesh.scale.setScalar(r0 * 2);
    item.mesh.visible = true;
  }

  beam(at: THREE.Vector3, color: THREE.ColorRepresentation, radius = 0.45, height = 4, life = 1, opacity = 0.8): void {
    const item = this.beams.find((b) => b.life <= 0) ?? this.beams[0];
    item.life = life;
    item.maxLife = life;
    item.opacity = opacity;
    item.material.color.set(color);
    item.mesh.position.set(at.x, at.y, at.z);
    item.mesh.scale.set(radius, height, radius);
    item.mesh.visible = true;
  }

  flash(at: THREE.Vector3, color: THREE.ColorRepresentation, size = 2, life = 0.35): void {
    const item = this.flashes.find((f) => f.life <= 0) ?? this.flashes[0];
    item.life = life;
    item.maxLife = life;
    item.size = size;
    item.material.color.set(color);
    item.sprite.position.copy(at);
    item.sprite.visible = true;
  }

  /** 하늘에서 터지는 불꽃 */
  firework(at: THREE.Vector3, color: THREE.ColorRepresentation): void {
    this.flash(at, color, 5, 0.4);
    this.burst(at, {
      count: 90,
      colors: [color, '#ffffff', color],
      speed: [2.2, 5.2],
      gravity: 2.4,
      drag: 1.5,
      life: [0.9, 1.7],
      size: [0.14, 0.3],
      glow: true,
    });
  }

  /** 색종이를 뿌리기 시작한다 */
  startConfetti(center: THREE.Vector3, areaW: number, areaD: number): void {
    this.confettiCenter.copy(center);
    this.confettiArea.set(areaW, areaD);
    this.confettiTime = 0;
    this.confetti.visible = true;
    for (let i = 0; i < CONFETTI_COUNT; i += 1) this.resetConfetti(i, true);
  }

  stopConfetti(): void {
    this.confetti.visible = false;
  }

  private resetConfetti(i: number, initial: boolean): void {
    const s = this.confettiState;
    const o = i * 10;
    s[o] = this.confettiCenter.x + rand(-0.5, 0.5) * this.confettiArea.x;
    s[o + 1] = this.confettiCenter.y + (initial ? rand(2, 11) : rand(7, 10));
    s[o + 2] = this.confettiCenter.z + rand(-0.5, 0.5) * this.confettiArea.y;
    s[o + 3] = rand(0.9, 2.1); // 낙하 속도
    s[o + 4] = rand(0, Math.PI * 2); // 흔들림 위상
    s[o + 5] = rand(1.5, 4); // 회전 속도
    s[o + 6] = rand(0, Math.PI * 2);
    s[o + 7] = rand(0, Math.PI * 2);
    s[o + 8] = rand(0.6, 1.3); // 크기
    s[o + 9] = rand(0.4, 1.1); // 흔들림 폭
  }

  private updateConfetti(dt: number): void {
    if (!this.confetti.visible) return;
    this.confettiTime += dt;
    const s = this.confettiState;
    const visible = Math.round(CONFETTI_COUNT * Math.max(0.3, this.density));
    for (let i = 0; i < CONFETTI_COUNT; i += 1) {
      const o = i * 10;
      if (i >= visible) {
        tmpMatrix.makeScale(0, 0, 0);
        this.confetti.setMatrixAt(i, tmpMatrix);
        continue;
      }
      s[o + 1] -= s[o + 3] * dt;
      if (s[o + 1] < this.confettiCenter.y - 0.2) this.resetConfetti(i, false);
      const sway = Math.sin(this.confettiTime * 2 + s[o + 4]) * s[o + 9];
      tmpPos.set(s[o] + sway * 0.4, s[o + 1], s[o + 2] + Math.cos(this.confettiTime * 1.6 + s[o + 4]) * 0.2);
      tmpEuler.set(
        this.confettiTime * s[o + 5] + s[o + 6],
        this.confettiTime * s[o + 5] * 0.7 + s[o + 7],
        sway,
      );
      tmpQuat.setFromEuler(tmpEuler);
      tmpScale.setScalar(s[o + 8]);
      tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
      this.confetti.setMatrixAt(i, tmpMatrix);
    }
    this.confetti.instanceMatrix.needsUpdate = true;
  }

  update(dt: number): void {
    this.glowLayer.update(dt);
    this.solidLayer.update(dt);

    for (const item of this.rings) {
      if (item.life <= 0) continue;
      item.life -= dt;
      if (item.life <= 0) {
        item.mesh.visible = false;
        continue;
      }
      const t = 1 - item.life / item.maxLife;
      const k = 1 - Math.pow(1 - t, 3);
      item.mesh.scale.setScalar((item.r0 + (item.r1 - item.r0) * k) * 2);
      item.material.opacity = item.opacity * (1 - t);
    }

    for (const item of this.beams) {
      if (item.life <= 0) continue;
      item.life -= dt;
      if (item.life <= 0) {
        item.mesh.visible = false;
        continue;
      }
      const t = 1 - item.life / item.maxLife;
      // 빠르게 켜지고 천천히 꺼진다
      const env = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
      item.material.opacity = item.opacity * env;
    }

    for (const item of this.flashes) {
      if (item.life <= 0) continue;
      item.life -= dt;
      if (item.life <= 0) {
        item.sprite.visible = false;
        continue;
      }
      const t = 1 - item.life / item.maxLife;
      item.sprite.scale.setScalar(item.size * (0.5 + t * 0.8));
      item.material.opacity = 1 - t;
    }

    this.updateConfetti(dt);
  }

  clear(): void {
    this.glowLayer.clear();
    this.solidLayer.clear();
    for (const item of this.rings) {
      item.life = 0;
      item.mesh.visible = false;
    }
    for (const item of this.beams) {
      item.life = 0;
      item.mesh.visible = false;
    }
    for (const item of this.flashes) {
      item.life = 0;
      item.sprite.visible = false;
    }
    this.stopConfetti();
  }
}

const ROUTE_COUNT = 34;

/** 기호가 말을 보내는 길을 점선 포물선으로 보여준다(이벤트 예고·칸 도감 미리보기) */
export class RouteArc {
  readonly mesh: THREE.InstancedMesh;
  private readonly from = new THREE.Vector3();
  private readonly to = new THREE.Vector3();
  private height = 1.5;
  private visibleAmount = 0;
  private goal = 0;
  private readonly matrix = new THREE.Matrix4();
  private readonly pos = new THREE.Vector3();
  private readonly quat = new THREE.Quaternion();
  private readonly scale = new THREE.Vector3();
  private readonly material: THREE.MeshBasicMaterial;

  constructor() {
    this.material = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95 });
    this.mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 10, 8), this.material, ROUTE_COUNT);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.renderOrder = 5;
  }

  show(from: THREE.Vector3, to: THREE.Vector3, color: THREE.ColorRepresentation): void {
    this.from.copy(from);
    this.to.copy(to);
    this.height = Math.min(3, Math.max(1, from.distanceTo(to) * 0.3));
    this.material.color.set(color);
    this.goal = 1;
    this.mesh.visible = true;
  }

  hide(): void {
    this.goal = 0;
  }

  get active(): boolean {
    return this.goal > 0;
  }

  /** 포물선 위의 점(u: 0~1) */
  pointAt(u: number, out: THREE.Vector3): THREE.Vector3 {
    out.lerpVectors(this.from, this.to, u);
    out.y += this.height * 4 * u * (1 - u) + 0.25;
    return out;
  }

  update(time: number, dtSec: number): void {
    if (!this.mesh.visible) return;
    this.visibleAmount += (this.goal - this.visibleAmount) * (1 - Math.exp(-7 * dtSec));
    if (this.goal === 0 && this.visibleAmount < 0.02) {
      this.mesh.visible = false;
      return;
    }
    const march = (time * 0.9) % 1;
    for (let i = 0; i < ROUTE_COUNT; i += 1) {
      const u = (i + march) / ROUTE_COUNT;
      this.pointAt(u, this.pos);
      // 양 끝은 작게, 아직 그려지지 않은 구간은 숨긴다
      const taper = Math.min(1, Math.min(u, 1 - u) * 9);
      const shown = u <= this.visibleAmount ? 1 : 0;
      this.scale.setScalar(taper * shown * (0.75 + 0.25 * Math.sin((u - march) * 40)));
      this.matrix.compose(this.pos, this.quat, this.scale);
      this.mesh.setMatrixAt(i, this.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
