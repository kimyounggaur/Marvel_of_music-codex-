// 3D 무대 전체를 지휘하는 컨트롤러.
// React 쪽(Game3D)이 게임 상태 변화를 "말이 뛰었다 / 기호가 발동했다" 같은 명령으로 번역해 넘기면,
// 여기서는 그 결과를 보여주는 연출만 한다. 규칙 판단은 하지 않는다.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { BoardCell, ResolvedEvent } from '../game/types';
import { Board3D } from './board';
import { CameraRig, FOV, type Insets } from './camera';
import { Dice3D } from './dice';
import { Fx, RouteArc } from './fx';
import { ISLAND_D, ISLAND_W, cellPosition, pathBetween, rotateXZ, slotOffset } from './layout';
import { FAMILY_COLORS, NOTE_COLORS, familyOf } from './palette';
import { Sky } from './sky';
import { Token3D } from './token';
import { Animator, clamp, damp, ease, lerp, wrapAngle } from './tween';

export type Cue =
  | 'step'
  | 'step-down'
  | 'dice-throw'
  | 'dice-bounce'
  | 'dice-settle'
  | 'arrive'
  | 'event'
  | 'portal-in'
  | 'portal-out'
  | 'whoosh'
  | 'freeze'
  | 'crack'
  | 'shatter'
  | 'rocket'
  | 'spring'
  | 'rewind'
  | 'teleport'
  | 'spotlight'
  | 'firework'
  | 'fanfare';

export interface StageCallbacks {
  /** 칸을 탭했을 때(빈 곳이면 null) */
  onTileTap?: (index: number | null) => void;
  onDiceTap?: () => void;
  /** 소리를 낼 순간을 알린다 */
  onCue?: (cue: Cue, value?: number) => void;
}

export interface StagePlayer {
  id: number;
  color: string;
  position: number;
  skipTurns: number;
}

export type ViewMode = 'follow' | 'overview';

interface HopOptions {
  /** 기호 효과로 달리는 중(로켓 대시) */
  dash: boolean;
  /** 이번 이동의 마지막 걸음 */
  final: boolean;
}

const UP = new THREE.Vector3(0, 1, 0);

// 낮 조명 세기. 큰 연출 때는 이 값에서 저녁빛으로 줄어든다.
const HEMI_DAY = 0.62;
const SUN_DAY = 2.5;
const ENV_DAY = 0.4;

export class Stage {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly rig = new CameraRig();
  private readonly animator = new Animator();
  private readonly board: Board3D;
  private readonly dice: Dice3D;
  private readonly fx = new Fx();
  private readonly route = new RouteArc();
  private readonly sky = new Sky();
  private readonly hemi: THREE.HemisphereLight;
  private readonly sun: THREE.DirectionalLight;
  private readonly spot: THREE.SpotLight;
  private readonly tokens = new Map<number, Token3D>();
  private readonly raycaster = new THREE.Raycaster();
  private readonly fitPoints: THREE.Vector3[] = [];
  private readonly pickables: THREE.Object3D[] = [];

  private time = 0;
  private lastFrame = 0;
  private disposed = false;

  // 화질 단계(3 = 최고). 기기가 버거워하면 스스로 한 단계씩 낮춘다.
  private quality = 3;
  private qualityLocked = false;
  private slowFrames = 0;
  private frameSamples = 0;
  private width = 1;
  private height = 1;

  // 화면·시점
  private viewMode: ViewMode = 'overview';
  private baseYaw = 0;
  private facing = 0;
  private fitAll = 40;
  private followDistance = 20;
  private insets: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
  private reduced = false;

  // 진행 상태
  private attract = true;
  private currentId: number | null = null;
  private awaitingRoll = false;
  private rolling = false;
  private eventActive = false;
  private winnerId: number | null = null;
  private stepCount = 0;
  private dimGoal = 0;
  private dim = 0;
  private readonly focus = new THREE.Vector3();
  private focusOverride: THREE.Vector3 | null = null;
  private fireworkTimer = 0;
  private titleTimer = 0;

  // 포인터
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private downAt = 0;
  private downX = 0;
  private downY = 0;
  private dragged = false;
  private pinchDistance = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    cells: BoardCell[],
    private readonly callbacks: StageCallbacks = {},
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // 톤 매핑을 쓰지 않아야 장난감 같은 선명한 원색이 그대로 나온다(밝기는 조명 세기로 맞춘다)
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    // 광택 재질에 비칠 주변 환경(외부 이미지 없이 즉석 생성)
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.scene.environment = pmrem.fromScene(room, 0.04).texture;
    this.scene.environmentIntensity = ENV_DAY;
    room.dispose();
    pmrem.dispose();

    this.scene.add(this.sky.group);

    this.hemi = new THREE.HemisphereLight('#eaf6ff', '#ffdf9e', HEMI_DAY);
    this.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight('#fff2d6', SUN_DAY);
    this.sun.position.set(-7, 15, 9);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -10;
    this.sun.shadow.camera.right = 10;
    this.sun.shadow.camera.top = 8;
    this.sun.shadow.camera.bottom = -8;
    this.sun.shadow.camera.near = 2;
    this.sun.shadow.camera.far = 42;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);

    // 큰 연출 때만 켜지는 무대 조명
    this.spot = new THREE.SpotLight('#fff6dc', 0, 30, 0.3, 0.55, 0.6);
    this.spot.position.set(0, 12, 4);
    this.scene.add(this.spot, this.spot.target);

    this.board = new Board3D(cells, this.animator);
    this.scene.add(this.board.group);

    this.dice = new Dice3D(this.animator);
    this.dice.setHome(this.board.diceHome());
    this.dice.rest(1, 0);
    this.scene.add(this.dice.group);

    this.scene.add(this.fx.group, this.route.mesh);

    for (const tile of this.board.tiles) this.pickables.push(tile.body);
    this.pickables.push(this.dice.mesh);

    const hw = ISLAND_W / 2;
    const hd = ISLAND_D / 2;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        this.fitPoints.push(new THREE.Vector3(sx * hw, -0.25, sz * hd));
        this.fitPoints.push(new THREE.Vector3(sx * (hw - 0.6), 1.15, sz * (hd - 0.6)));
      }
    }

    this.focus.set(0, 0.3, 0);

    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerCancel);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });

    this.lastFrame = performance.now();
    this.renderer.setAnimationLoop(this.frame);
  }

  dispose(): void {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.animator.clear();
    const canvas = this.canvas;
    canvas.removeEventListener('pointerdown', this.onPointerDown);
    canvas.removeEventListener('pointermove', this.onPointerMove);
    canvas.removeEventListener('pointerup', this.onPointerUp);
    canvas.removeEventListener('pointercancel', this.onPointerCancel);
    canvas.removeEventListener('wheel', this.onWheel);
    for (const token of this.tokens.values()) token.dispose();
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      const list = Array.isArray(material) ? material : material ? [material] : [];
      for (const item of list) {
        const map = (item as THREE.MeshStandardMaterial).map;
        if (map) map.dispose();
        item.dispose();
      }
    });
    this.scene.environment?.dispose();
    this.renderer.dispose();
  }

  // ───────────────────────── 화면 크기·시점 ─────────────────────────

  /**
   * 화면 크기와 HUD 안전 영역을 알려준다.
   * snap이 true면 카메라가 새 구도로 바로 옮겨 가고, false면 부드럽게 미끄러진다(HUD만 바뀐 경우).
   */
  resize(width: number, height: number, insets: Insets, snap = true): void {
    if (this.disposed || width < 2 || height < 2) return;
    this.width = width;
    this.height = height;
    const dpr = this.pixelRatio();
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);
    this.insets = insets;
    this.rig.setViewport(width, height, insets);
    this.fx.setViewport(height * dpr, FOV);
    this.refit();
    if (snap) this.rig.snap();
  }

  private pixelRatio(): number {
    const device = window.devicePixelRatio || 1;
    const cap = this.quality >= 3 ? 2 : this.quality === 2 ? 1.5 : 1;
    return Math.min(device, cap);
  }

  /**
   * 화질 단계를 정한다. 3: 고해상도+그림자, 2: 해상도 낮춤, 1: 그림자 해상도도 낮춤, 0: 그림자 끔.
   * lock이 true면 자동 조절을 멈춘다(주소에 ?quality=high 또는 low를 붙인 경우).
   */
  setQuality(level: number, lock = false): void {
    this.quality = clamp(Math.round(level), 0, 3);
    if (lock) this.qualityLocked = true;
    const dpr = this.pixelRatio();
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(this.width, this.height, false);
    this.fx.setViewport(this.height * dpr, FOV);
    const mapSize = this.quality >= 2 ? 2048 : 1024;
    if (this.sun.shadow.mapSize.x !== mapSize) {
      this.sun.shadow.mapSize.set(mapSize, mapSize);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    this.sun.castShadow = this.quality >= 1;
    this.fx.density = this.reduced ? 0.35 : this.quality >= 2 ? 1 : 0.6;
  }

  /** 프레임이 계속 느리면(초당 약 30장 미만) 화질을 한 단계 낮춘다 */
  private watchPerformance(elapsed: number): void {
    if (this.qualityLocked || this.quality === 0 || document.hidden) return;
    if (elapsed <= 0 || elapsed >= 0.25) return;
    this.frameSamples += 1;
    if (elapsed > 0.034) this.slowFrames += 1;
    if (this.frameSamples < 120) return;
    const slowRatio = this.slowFrames / this.frameSamples;
    this.frameSamples = 0;
    this.slowFrames = 0;
    if (slowRatio > 0.6) this.setQuality(this.quality - 1);
  }

  private refit(): void {
    const center = new THREE.Vector3(0, 0, 0);
    const portrait = this.rig.isPortrait;
    // 세로 화면에서 전체 보기를 고르면 판을 90° 돌려 긴 쪽을 세로로 세운다
    this.baseYaw = portrait && this.viewMode === 'overview' ? Math.PI / 2 : 0;
    this.fitAll = this.rig.fitDistance(this.fitPoints, center, this.baseYaw, this.overviewPitch());
    const tilesAcross = portrait ? 5.6 : 9.5;
    this.followDistance = Math.min(this.fitAll, this.rig.distanceForWidth(tilesAcross));
  }

  private overviewPitch(): number {
    return this.rig.isPortrait ? 1.08 : 0.99;
  }

  setViewMode(mode: ViewMode): void {
    if (this.viewMode === mode) return;
    this.viewMode = mode;
    this.rig.resetUser();
    this.refit();
  }

  setReducedMotion(reduced: boolean): void {
    this.reduced = reduced;
    this.fx.density = reduced ? 0.35 : this.quality >= 2 ? 1 : 0.6;
  }

  // ───────────────────────── 게임 상태 반영 ─────────────────────────

  /** 새 게임: 말을 다시 만들고 모든 연출을 걷어낸다 */
  resetGame(players: StagePlayer[]): void {
    this.animator.clear();
    this.fx.clear();
    this.route.hide();
    for (const token of this.tokens.values()) {
      this.scene.remove(token.group);
      token.dispose();
    }
    this.tokens.clear();
    for (const player of players) {
      const token = new Token3D(player.id, player.color);
      token.cellIndex = player.position;
      this.tokens.set(player.id, token);
      this.scene.add(token.group);
    }
    for (const tile of this.board.tiles) {
      tile.group.position.y = 0;
      tile.material.color.copy(tile.baseColor);
      tile.material.emissive.set(0x000000);
    }
    this.winnerId = null;
    this.eventActive = false;
    this.rolling = false;
    this.focusOverride = null;
    this.stepCount = 0;
    this.dimGoal = 0;
    this.spot.intensity = 0;
    this.dice.rest(1, this.facing);
    this.layoutAll(false);
    for (const player of players) this.setFrozen(player.id, player.skipTurns, true);
    // 말이 하늘에서 톡 떨어지며 등장
    let order = 0;
    for (const token of this.tokens.values()) {
      const rest = token.group.position.clone();
      token.busy = true;
      token.group.position.y = rest.y + 5;
      this.animator.add({
        duration: 520,
        delay: 120 + order * 110,
        tag: token,
        ease: ease.outBounce,
        update: (k) => {
          token.group.position.y = rest.y + 5 * (1 - k);
        },
        complete: () => {
          token.busy = false;
          this.fx.ring(rest, token.color, 0.2, 0.9, 0.45);
        },
      });
      order += 1;
    }
    this.board.waveTitle();
  }

  /** 시작 화면(게임 전): 말 없이 무대만 천천히 보여준다 */
  setAttract(on: boolean): void {
    this.attract = on;
    for (const token of this.tokens.values()) token.group.visible = !on;
    this.dice.group.visible = !on;
    if (on) this.dimGoal = 0;
  }

  /** 누구 차례인지, 주사위를 기다리는 중인지 */
  setTurn(playerId: number | null, awaitingRoll: boolean): void {
    this.currentId = playerId;
    this.awaitingRoll = awaitingRoll;
    for (const token of this.tokens.values()) {
      token.setCurrent(token.id === playerId && this.winnerId === null, awaitingRoll && token.frozen === 0);
    }
    this.dice.hovering = awaitingRoll && this.winnerId === null && !this.attract;
    if (awaitingRoll) {
      // 차례가 넘어오면 이전 차례의 큰 연출 흔적을 정리한다
      this.eventActive = false;
      this.focusOverride = null;
      this.route.hide();
      if (this.winnerId === null) this.dimGoal = 0;
    }
  }

  /** 상태와 화면이 어긋났을 때(탭이 가려졌다 돌아온 경우 등) 말 위치를 바로잡는다 */
  syncPositions(players: StagePlayer[]): void {
    for (const player of players) {
      const token = this.tokens.get(player.id);
      if (!token || token.busy) continue;
      if (token.cellIndex !== player.position) {
        const old = token.cellIndex;
        token.cellIndex = player.position;
        this.layoutCell(old, false);
        this.layoutCell(player.position, false);
      }
    }
  }

  // ───────────────────────── 자리 배치 ─────────────────────────

  private residents(cell: number, exceptId?: number): Token3D[] {
    const list: Token3D[] = [];
    for (const token of this.tokens.values()) {
      if (token.cellIndex === cell && token.id !== exceptId) list.push(token);
    }
    return list.sort((a, b) => a.id - b.id);
  }

  private slotPosition(cell: number, count: number, slot: number, out = new THREE.Vector3()): THREE.Vector3 {
    const offset = rotateXZ(slotOffset(count, slot), this.facing);
    this.board.tileTop(cell, out);
    out.x += offset.x;
    out.z += offset.z;
    return out;
  }

  /** 이 말이 cell에 내려앉을 자리 */
  private landingPosition(token: Token3D, cell: number): THREE.Vector3 {
    const others = this.residents(cell, token.id).filter((t) => !t.busy);
    return this.slotPosition(cell, others.length + 1, others.length);
  }

  private layoutCell(cell: number, animate: boolean): void {
    const list = this.residents(cell);
    list.forEach((token, slot) => {
      if (token.busy) return;
      const goal = this.slotPosition(cell, list.length, slot);
      if (!animate) {
        token.group.position.copy(goal);
        return;
      }
      const from = token.group.position.clone();
      if (from.distanceToSquared(goal) < 0.0004) return;
      this.animator.add({
        duration: 220,
        tag: token,
        ease: ease.outCubic,
        update: (k) => {
          if (!token.busy) token.group.position.lerpVectors(from, goal, k);
        },
      });
    });
  }

  private layoutAll(animate: boolean): void {
    const cells = new Set<number>();
    for (const token of this.tokens.values()) cells.add(token.cellIndex);
    for (const cell of cells) this.layoutCell(cell, animate);
  }

  // ───────────────────────── 주사위 ─────────────────────────

  rollDice(value: number, durationMs: number, power: number): void {
    this.rolling = true;
    this.stepCount = 0;
    this.route.hide();
    const home = this.board.diceHome();
    const scatter = rotateXZ({ x: (Math.random() - 0.5) * 1.3, z: (Math.random() - 0.5) * 0.7 }, this.facing);
    const to = new THREE.Vector3(home.x + scatter.x, 0, home.z + scatter.z);
    this.callbacks.onCue?.('dice-throw');
    this.dice.roll({
      value,
      durationMs: durationMs * 0.88,
      power,
      to,
      yaw: this.facing,
      onBounce: (index, strength) => {
        this.callbacks.onCue?.('dice-bounce', strength);
        if (!this.reduced) this.rig.addShake(0.07 * strength);
        const at = this.dice.group.position.clone();
        at.y = 0.03;
        this.fx.ring(at, '#ffc83d', 0.15, 0.7 + strength * 0.5, 0.4, false, 0.8);
        if (index === 0) {
          this.fx.burst(at, {
            count: 10,
            colors: ['#fff3c4', '#ffd45a'],
            speed: [0.6, 1.6],
            up: 0.8,
            gravity: 3,
            life: [0.3, 0.6],
            size: [0.08, 0.16],
            glow: false,
          });
        }
      },
      onSettle: () => {
        this.callbacks.onCue?.('dice-settle', value);
        const at = this.dice.group.position.clone();
        this.fx.flash(at, '#fff0a8', 2.2, 0.35);
        this.fx.burst(at, {
          count: 22,
          colors: ['#ffd23f', '#ffffff', '#ff9a3d'],
          speed: [1.2, 2.8],
          up: 1.4,
          gravity: 4,
          life: [0.4, 0.8],
          size: [0.1, 0.2],
          glow: false,
        });
        this.rolling = false;
      },
    });
  }

  // ───────────────────────── 한 칸 이동 ─────────────────────────

  hop(playerId: number, to: number, durationMs: number, opts: HopOptions): void {
    const token = this.tokens.get(playerId);
    if (!token) return;
    const fromCell = token.cellIndex;
    const from = token.group.position.clone();
    this.animator.cancel(token);
    token.busy = true;
    token.cellIndex = to;
    token.pivot.visible = true;
    this.layoutCell(fromCell, true);
    const dest = opts.final ? this.landingPosition(token, to) : this.slotPosition(to, 1, 0);
    const height = opts.dash ? 0.34 : 0.52;
    this.stepCount += 1;
    const step = this.stepCount;
    const lean = this.screenDirection(from, dest);

    this.animator.add({
      duration: durationMs * 0.9,
      tag: token,
      update: (_, raw) => {
        const e = ease.inOutQuad(raw);
        token.group.position.set(
          lerp(from.x, dest.x, e),
          lerp(from.y, dest.y, e) + height * 4 * raw * (1 - raw),
          lerp(from.z, dest.z, e),
        );
        // 뛰어오를 때 길쭉, 닿을 때 납작
        const stretch = raw < 0.18 ? lerp(0.82, 1.14, raw / 0.18) : raw > 0.84 ? lerp(1.14, 0.8, (raw - 0.84) / 0.16) : 1.14;
        token.squash(stretch);
        token.pivot.rotation.z = -lean * Math.sin(raw * Math.PI) * 0.3;
        if (opts.dash) {
          this.fx.trail(token.group.position, raw < 0.5 ? '#ffb02e' : '#ff5a2e', 0.2, 0.42);
        }
      },
      complete: () => {
        token.group.position.copy(dest);
        token.pivot.rotation.z = 0;
        this.landFx(token, to, step, opts);
        // 착지 탄성
        this.animator.add({
          duration: 200,
          tag: token,
          ease: ease.outBack,
          update: (k) => token.squash(lerp(0.8, 1, k)),
          complete: () => {
            token.resetPose();
            token.busy = false;
            if (opts.final) this.layoutCell(to, true);
          },
        });
      },
    });
  }

  private landFx(token: Token3D, cell: number, step: number, opts: HopOptions): void {
    const noteColor = NOTE_COLORS[(step - 1) % NOTE_COLORS.length];
    const at = this.board.tileTop(cell);
    this.board.press(cell, opts.final ? 0.09 : 0.06);
    this.board.flash(cell, noteColor, 110, 480);
    this.fx.ring(at, noteColor, 0.2, opts.final ? 1.25 : 0.85, 0.45, false, 0.9);
    this.fx.burst(at, {
      count: opts.final ? 12 : 5,
      colors: ['#ffffff', '#fff1c9', noteColor],
      speed: [0.5, 1.4],
      up: 0.9,
      spread: 1,
      gravity: 3.2,
      life: [0.25, 0.55],
      size: [0.07, 0.14],
      glow: false,
    });
    this.callbacks.onCue?.('step', step);
    if (opts.final && !this.reduced) this.rig.addShake(0.035);
    void token;
  }

  /** 화면에서 볼 때 왼쪽(-1)으로 가는지 오른쪽(+1)으로 가는지 */
  private screenDirection(from: THREE.Vector3, to: THREE.Vector3): number {
    const yaw = this.rig.yaw;
    const dx = (to.x - from.x) * Math.cos(yaw) - (to.z - from.z) * Math.sin(yaw);
    return Math.abs(dx) < 0.05 ? 0 : Math.sign(dx);
  }

  // ───────────────────────── 기호 발동(예고) ─────────────────────────

  playEvent(event: ResolvedEvent, playerId: number, durationMs: number, travelMs: number): void {
    const token = this.tokens.get(playerId);
    const tile = this.board.tiles[event.sourceIndex];
    if (!token || !tile) return;
    const family = FAMILY_COLORS[familyOf(event.kind)];
    const top = this.board.tileTop(event.sourceIndex);
    const anchor = this.board.monumentAnchor(event.sourceIndex);

    this.eventActive = true;
    this.dimGoal = 1;
    this.activateMonument(event.sourceIndex);
    this.board.flash(event.sourceIndex, family.glow, 320, 760);
    this.fx.ring(top, family.glow, 0.3, 1.7, 0.75, true);
    this.fx.flash(anchor, family.glow, 2.6, 0.45);
    this.fx.burst(anchor, {
      count: 30,
      colors: [family.glow, '#ffffff', family.body],
      speed: [1, 2.8],
      up: 1.3,
      gravity: 2.4,
      life: [0.45, 1],
      size: [0.1, 0.22],
    });
    this.callbacks.onCue?.('event');

    if (event.targetIndex !== undefined) {
      const targetTop = this.board.tileTop(event.targetIndex);
      this.route.show(top, targetTop, family.glow);
      this.fx.beam(targetTop, family.glow, 0.44, 3.6, (durationMs + travelMs) / 1000 + 0.3, 0.8);
      this.fx.ring(targetTop, family.glow, 0.2, 1.2, 0.9, true);
    }

    switch (event.animationClass) {
      case 'fx-rocket-dash':
        this.chargeUp(token, durationMs);
        break;
      case 'fx-ice-freeze':
        this.freezeIn(token, durationMs);
        break;
      case 'fx-spring-jump':
        this.springWindup(token, durationMs);
        break;
      case 'fx-spotlight-start':
        this.callbacks.onCue?.('spotlight');
        this.spotlightOn(event.targetIndex ?? 0, (durationMs + travelMs) / 1000 + 0.6);
        this.surprise(token);
        break;
      case 'fx-finale':
        this.finalePrelude(token, top);
        break;
      default:
        this.surprise(token);
    }
  }

  /** 기호가 벌떡 일어나 한 바퀴 돌고 제자리로 돌아간다 */
  private activateMonument(cell: number): void {
    const tile = this.board.tiles[cell];
    const holder = tile?.monumentHolder;
    const tilt = tile?.monumentTilt;
    if (!tile || !holder || !tilt) return;
    const emblem = tile.monument?.pose === 'emblem';
    const restTilt = tilt.userData.restTilt as number;
    const restScale = tilt.userData.restScale as number;
    this.animator.cancel(holder);
    this.animator.add({
      duration: 950,
      tag: holder,
      update: (_, raw) => {
        const up = Math.sin(Math.min(1, raw * 1.25) * Math.PI);
        tilt.scale.setScalar(restScale * (1 + up * 0.45));
        tilt.rotation.y = ease.outCubic(raw) * Math.PI * 2;
        if (emblem) {
          // 누워 있던 기호가 일어서며 떠오른다
          tilt.rotation.x = lerp(restTilt, -0.5, up);
          tilt.position.y = up * 0.45;
        }
      },
      complete: () => {
        tilt.scale.setScalar(restScale);
        tilt.rotation.set(restTilt, 0, 0);
        tilt.position.y = 0;
      },
    });
  }

  private surprise(token: Token3D): void {
    token.busy = true;
    this.animator.add({
      duration: 420,
      tag: token,
      update: (_, raw) => {
        token.pivot.position.y = Math.sin(raw * Math.PI) * 0.32;
        token.squash(1 + Math.sin(raw * Math.PI) * 0.16);
      },
      complete: () => {
        token.resetPose();
        token.busy = false;
      },
    });
  }

  /** 다중쉼표: 웅크려 떨다가 불꽃을 뿜을 준비 */
  private chargeUp(token: Token3D, durationMs: number): void {
    token.busy = true;
    this.callbacks.onCue?.('rocket');
    this.animator.add({
      duration: durationMs * 0.92,
      tag: token,
      update: (_, raw) => {
        token.squash(lerp(1, 0.68, ease.outQuad(raw)));
        token.pivot.position.x = Math.sin(raw * 90) * 0.02 * raw;
        if (raw > 0.15) {
          const at = token.group.position.clone();
          at.y += 0.05;
          this.fx.trail(at, Math.random() < 0.5 ? '#ffb02e' : '#ff5a2e', 0.18 + raw * 0.12, 0.4);
        }
      },
      complete: () => {
        token.resetPose();
        token.busy = false;
      },
    });
  }

  /** 페르마타: 얼음이 자라 말을 가둔다 */
  private freezeIn(token: Token3D, durationMs: number): void {
    token.busy = true;
    const ice = token.iceMesh;
    const center = token.group.position.clone();
    center.y += 0.4;
    this.animator.after(
      260,
      () => {
        this.callbacks.onCue?.('freeze');
        ice.visible = true;
        this.fx.ring(token.group.position, '#bfeaff', 0.2, 1.5, 0.7, true);
        this.fx.burst(center, {
          count: 34,
          colors: ['#ffffff', '#bfeaff', '#7fd4ff'],
          speed: [0.8, 2.4],
          up: 0.6,
          gravity: 1.2,
          life: [0.5, 1.1],
          size: [0.08, 0.18],
          glow: false,
        });
      },
      token,
    );
    this.animator.add({
      duration: 700,
      delay: 260,
      tag: token,
      ease: ease.outElastic,
      update: (k) => ice.scale.set(k, k * 1.2, k),
    });
    this.animator.add({
      duration: Math.min(900, durationMs * 0.6),
      tag: token,
      update: (_, raw) => {
        // 오들오들
        token.pivot.rotation.z = Math.sin(raw * 70) * 0.06 * (1 - raw);
      },
      complete: () => {
        token.pivot.rotation.z = 0;
        token.busy = false;
      },
    });
  }

  /** 제1괄호: 용수철처럼 움츠렸다 폈다 */
  private springWindup(token: Token3D, durationMs: number): void {
    token.busy = true;
    this.callbacks.onCue?.('spring');
    this.animator.add({
      duration: durationMs * 0.9,
      tag: token,
      update: (_, raw) => {
        const wobble = Math.sin(raw * Math.PI * 6) * (0.12 + raw * 0.2);
        token.squash(1 - Math.abs(wobble) * 1.2 + (wobble > 0 ? wobble * 0.5 : 0));
      },
      complete: () => {
        token.resetPose();
        token.busy = false;
      },
    });
  }

  private spotlightOn(cell: number, seconds: number): void {
    const at = this.board.tileTop(cell);
    this.spot.position.set(at.x, 11, at.z + 0.01);
    this.spot.target.position.copy(at);
    this.spot.intensity = 0;
    this.animator.cancel(this.spot);
    this.animator.add({
      duration: 400,
      tag: this.spot,
      update: (k) => {
        this.spot.intensity = 900 * k;
      },
    });
    this.animator.add({
      duration: 500,
      delay: seconds * 1000,
      tag: this.spot,
      update: (k) => {
        this.spot.intensity = 900 * (1 - k);
      },
    });
    this.fx.beam(at, '#fff3c4', 0.85, 6.5, seconds + 0.4, 0.55);
  }

  private finalePrelude(token: Token3D, at: THREE.Vector3): void {
    this.fx.ring(at, '#ffd23f', 0.3, 2.6, 1, true);
    this.fx.beam(at, '#ffe48a', 0.6, 6, 1.6, 0.8);
    this.surprise(token);
    for (let i = 0; i < 3; i += 1) {
      this.animator.after(250 + i * 330, () => this.launchFirework());
    }
  }

  // ───────────────────────── 기호 이동(점프) ─────────────────────────

  jump(playerId: number, from: number, to: number, animationClass: string, durationMs: number): void {
    const token = this.tokens.get(playerId);
    if (!token) return;
    this.animator.cancel(token);
    token.busy = true;
    token.cellIndex = to;
    token.resetPose();
    this.layoutCell(from, true);
    const start = token.group.position.clone();
    const dest = this.landingPosition(token, to);
    const glow = FAMILY_COLORS[familyOf(this.board.tiles[from].cell.kind)].glow;
    const done = () => this.arrive(token, to, glow);

    switch (animationClass) {
      case 'fx-rewind':
        this.rewindTravel(token, from, to, dest, durationMs, done);
        break;
      case 'fx-coda-portal':
        this.portalTravel(token, from, to, start, dest, durationMs, ['#ff9db4', '#ffffff', '#ff4f78'], false, done);
        break;
      case 'fx-wormhole':
        this.portalTravel(token, from, to, start, dest, durationMs, ['#ff6ad5', '#6ae3ff', '#ffffff'], true, done);
        break;
      case 'fx-hologram':
        this.teleportTravel(token, start, dest, durationMs, done);
        break;
      case 'fx-spring-jump':
        this.callbacks.onCue?.('whoosh');
        this.arcTravel(token, start, dest, durationMs, 1.7, 1, glow, done);
        break;
      case 'fx-spotlight-start':
        this.callbacks.onCue?.('whoosh');
        this.arcTravel(token, start, dest, durationMs, 3.2, 2, '#ffe48a', done);
        break;
      default:
        this.callbacks.onCue?.('whoosh');
        this.arcTravel(token, start, dest, durationMs, 2.5, 1, glow, done);
    }
  }

  private arrive(token: Token3D, cell: number, color: THREE.ColorRepresentation): void {
    const at = this.board.tileTop(cell);
    token.resetPose();
    token.group.position.copy(this.landingPosition(token, cell));
    this.board.press(cell, 0.11);
    this.board.flash(cell, color, 200, 700);
    this.fx.ring(at, color, 0.25, 1.9, 0.7, true);
    this.fx.ring(at, '#ffffff', 0.2, 1.1, 0.45, false, 0.9);
    this.fx.burst(at, {
      count: 34,
      colors: [color, '#ffffff', '#ffe48a'],
      speed: [1.2, 3.2],
      up: 1.6,
      gravity: 3.4,
      life: [0.45, 1],
      size: [0.1, 0.22],
    });
    this.callbacks.onCue?.('arrive');
    if (!this.reduced) this.rig.addShake(0.09);
    this.route.hide();
    this.focusOverride = null;
    this.animator.add({
      duration: 260,
      tag: token,
      ease: ease.outBack,
      update: (k) => token.squash(lerp(0.72, 1, k)),
      complete: () => {
        token.resetPose();
        token.busy = false;
        this.layoutCell(cell, true);
      },
    });
  }

  /** 포물선으로 날아가며 공중제비 */
  private arcTravel(
    token: Token3D,
    start: THREE.Vector3,
    dest: THREE.Vector3,
    durationMs: number,
    height: number,
    flips: number,
    color: THREE.ColorRepresentation,
    done: () => void,
  ): void {
    const span = start.distanceTo(dest);
    const peak = clamp(height + span * 0.08, 1.2, 4.2);
    this.animator.add({
      duration: durationMs,
      tag: token,
      update: (_, raw) => {
        const e = ease.inOutQuad(raw);
        token.group.position.set(
          lerp(start.x, dest.x, e),
          lerp(start.y, dest.y, e) + peak * 4 * raw * (1 - raw),
          lerp(start.z, dest.z, e),
        );
        token.pivot.rotation.x = -ease.inOutCubic(raw) * Math.PI * 2 * flips;
        token.squash(1 + Math.sin(raw * Math.PI) * 0.12);
        const at = token.group.position.clone();
        at.y += 0.3;
        this.fx.trail(at, color, 0.2, 0.55);
        if (Math.random() < 0.4) this.fx.trail(at, '#ffffff', 0.12, 0.4);
      },
      complete: done,
    });
  }

  /** 도돌이표: 지나온 칸을 거꾸로 훑으며 되감긴다 */
  private rewindTravel(token: Token3D, from: number, to: number, dest: THREE.Vector3, durationMs: number, done: () => void): void {
    const cells = pathBetween(from, to, -1);
    if (cells.length === 0) {
      done();
      return;
    }
    this.callbacks.onCue?.('rewind');
    const points = [token.group.position.clone(), ...cells.map((cell) => this.slotPosition(cell, 1, 0))];
    points[points.length - 1] = dest.clone();
    let passed = 0;
    this.animator.add({
      duration: durationMs,
      tag: token,
      update: (_, raw) => {
        const e = ease.inOutQuad(raw);
        const f = e * (points.length - 1);
        const i = Math.min(points.length - 2, Math.floor(f));
        const u = f - i;
        token.group.position.lerpVectors(points[i], points[i + 1], u);
        token.group.position.y += 0.28 * Math.sin(Math.min(1, raw * 6) * (Math.PI / 2)) * (raw > 0.9 ? (1 - raw) / 0.1 : 1);
        token.pivot.rotation.y = -e * Math.PI * 6;
        token.pivot.rotation.z = 0.22 * Math.sin(raw * Math.PI);
        this.fx.trail(token.group.position, '#8fc0ff', 0.2, 0.5);
        // 칸을 지날 때마다 그 건반이 내려가는 음으로 울린다
        while (passed < cells.length && f >= passed + 0.5) {
          const cell = cells[passed];
          this.board.flash(cell, '#8fc0ff', 60, 420);
          this.board.press(cell, 0.04);
          this.callbacks.onCue?.('step-down', passed);
          passed += 1;
        }
      },
      complete: done,
    });
  }

  /** 코다·더블코다: 고리 속으로 빨려 들어가 반대편 고리에서 튀어나온다 */
  private portalTravel(
    token: Token3D,
    from: number,
    to: number,
    start: THREE.Vector3,
    dest: THREE.Vector3,
    durationMs: number,
    colors: string[],
    twin: boolean,
    done: () => void,
  ): void {
    const gateIn = this.board.monumentAnchor(from);
    const gateOut = this.board.monumentAnchor(to);
    const a = 0.34;
    const b = 0.68;
    const orb = new THREE.Vector3();
    const side = new THREE.Vector3().subVectors(gateOut, gateIn).cross(UP).normalize();
    const peak = clamp(gateIn.distanceTo(gateOut) * 0.28, 1.4, 3.4);
    let phase = 0;

    this.callbacks.onCue?.('portal-in');
    this.fx.implode(gateIn, colors, 46, 1.2, (durationMs * a) / 1000);
    this.fx.ring(this.board.tileTop(from), colors[0], 1.6, 0.2, (durationMs * a) / 1000, true);

    this.animator.add({
      duration: durationMs,
      tag: token,
      update: (_, raw) => {
        if (raw < a) {
          // 빨려 들어가기
          const u = ease.inCubic(raw / a);
          token.group.position.lerpVectors(start, gateIn, u);
          token.pivot.rotation.y = u * Math.PI * 6;
          token.pivot.scale.setScalar(0.95 * (1 - u * 0.95));
        } else if (raw < b) {
          if (phase === 0) {
            phase = 1;
            token.pivot.visible = false;
            this.fx.flash(gateIn, colors[0], 3, 0.4);
            this.fx.burst(gateIn, { count: 18, colors, speed: [0.8, 2], life: [0.3, 0.6], size: [0.1, 0.2] });
            this.focusOverride = orb;
          }
          // 빛 덩어리가 하늘길을 건넌다
          const u = ease.inOutQuad((raw - a) / (b - a));
          orb.lerpVectors(gateIn, gateOut, u);
          orb.y += peak * 4 * u * (1 - u);
          if (twin) {
            const swirl = u * Math.PI * 6;
            const r = 0.32 * Math.sin(u * Math.PI);
            const p1 = orb.clone().addScaledVector(side, Math.cos(swirl) * r);
            p1.y += Math.sin(swirl) * r;
            const p2 = orb.clone().addScaledVector(side, -Math.cos(swirl) * r);
            p2.y -= Math.sin(swirl) * r;
            this.fx.trail(p1, colors[0], 0.3, 0.6);
            this.fx.trail(p2, colors[1], 0.3, 0.6);
          } else {
            this.fx.trail(orb, colors[0], 0.34, 0.6);
            this.fx.trail(orb, '#ffffff', 0.18, 0.4);
          }
        } else {
          if (phase === 1) {
            phase = 2;
            token.pivot.visible = true;
            this.callbacks.onCue?.('portal-out');
            this.fx.flash(gateOut, colors[0], 3.4, 0.45);
            this.fx.burst(gateOut, { count: 30, colors, speed: [1.2, 3], up: 0.8, life: [0.4, 0.9], size: [0.1, 0.22] });
            this.fx.ring(this.board.tileTop(to), colors[0], 0.2, 1.6, 0.6, true);
            this.focusOverride = null;
          }
          // 튀어나오기
          const u = ease.outCubic((raw - b) / (1 - b));
          token.group.position.lerpVectors(gateOut, dest, u);
          token.group.position.y += Math.sin(u * Math.PI) * 0.5;
          token.pivot.rotation.y = (1 - u) * Math.PI * 4;
          token.pivot.scale.setScalar(0.95 * (0.05 + 0.95 * ease.outBack(u)));
        }
      },
      complete: done,
    });
  }

  /** 더블세뇨: 빛기둥에 실려 올라갔다가 목적지에 다시 내려온다 */
  private teleportTravel(token: Token3D, start: THREE.Vector3, dest: THREE.Vector3, durationMs: number, done: () => void): void {
    const a = 0.4;
    const b = 0.58;
    let phase = 0;
    this.callbacks.onCue?.('teleport');
    this.fx.beam(start, '#9be8ff', 0.36, 5.5, (durationMs * a) / 1000 + 0.25, 0.9);
    const lift = 2.4;

    this.animator.add({
      duration: durationMs,
      tag: token,
      update: (_, raw) => {
        if (raw < a) {
          const u = ease.inCubic(raw / a);
          token.group.position.set(start.x, start.y + u * lift, start.z);
          token.pivot.scale.set(0.95 * (1 - u * 0.92), 0.95 * (1 + u * 2.2), 0.95 * (1 - u * 0.92));
          // 깜빡이는 홀로그램
          token.pivot.visible = u < 0.5 || Math.sin(raw * 160) > -0.2;
          if (Math.random() < 0.7) {
            const at = token.group.position.clone();
            at.y += Math.random() * 0.8;
            this.fx.trail(at, Math.random() < 0.5 ? '#9be8ff' : '#c2b0ff', 0.14, 0.5);
          }
        } else if (raw < b) {
          if (phase === 0) {
            phase = 1;
            token.pivot.visible = false;
            this.fx.beam(dest, '#c2b0ff', 0.36, 5.5, (durationMs * (1 - a)) / 1000, 0.9);
            this.focusOverride = dest.clone();
          }
        } else {
          if (phase === 1) {
            phase = 2;
            token.pivot.visible = true;
            this.callbacks.onCue?.('teleport');
          }
          const u = ease.outCubic((raw - b) / (1 - b));
          token.group.position.set(dest.x, dest.y + (1 - u) * lift, dest.z);
          const thin = 1 - u;
          token.pivot.scale.set(0.95 * (1 - thin * 0.92), 0.95 * (1 + thin * 2.2), 0.95 * (1 - thin * 0.92));
          token.pivot.visible = u > 0.5 || Math.sin(raw * 160) > -0.2;
          if (Math.random() < 0.7) {
            const at = token.group.position.clone();
            at.y += Math.random() * 0.8;
            this.fx.trail(at, Math.random() < 0.5 ? '#9be8ff' : '#c2b0ff', 0.14, 0.5);
          }
        }
      },
      complete: done,
    });
  }

  // ───────────────────────── 쉬기(페르마타) ─────────────────────────

  setFrozen(playerId: number, count: number, instant = false): void {
    const token = this.tokens.get(playerId);
    if (!token) return;
    const before = token.frozen;
    if (before === count) return;
    token.frozen = count;
    const ice = token.iceMesh;
    token.setLabel(count > 0 ? `쉬는 중 ${count}` : '');

    if (count > 0) {
      ice.visible = true;
      if (instant || ice.scale.x < 0.5) ice.scale.set(1, 1.2, 1);
      if (!instant && before > count) {
        // 한 번 쉬었다: 얼음에 금이 간다
        this.callbacks.onCue?.('crack');
        const at = token.group.position.clone();
        at.y += 0.45;
        this.fx.burst(at, {
          count: 12,
          colors: ['#ffffff', '#bfeaff'],
          speed: [0.8, 1.8],
          gravity: 4,
          life: [0.3, 0.6],
          size: [0.06, 0.13],
          glow: false,
        });
        this.animator.add({
          duration: 320,
          tag: ice,
          update: (_, raw) => {
            const s = 1 + Math.sin(raw * Math.PI) * 0.12;
            ice.scale.set(s, 1.2 * s, s);
          },
        });
      }
      return;
    }

    if (instant || before === 0) {
      ice.visible = false;
      ice.scale.set(0, 0, 0);
      return;
    }
    // 다 쉬었다: 얼음이 산산조각
    this.callbacks.onCue?.('shatter');
    const at = token.group.position.clone();
    at.y += 0.45;
    this.fx.flash(at, '#dff6ff', 2.4, 0.35);
    this.fx.ring(token.group.position, '#bfeaff', 0.3, 1.6, 0.55, true);
    this.fx.burst(at, {
      count: 40,
      colors: ['#ffffff', '#bfeaff', '#7fd4ff'],
      speed: [1.4, 3.6],
      up: 1.2,
      gravity: 6,
      life: [0.4, 0.9],
      size: [0.08, 0.2],
      glow: false,
    });
    this.animator.add({
      duration: 180,
      tag: ice,
      ease: ease.inBack,
      update: (k) => {
        const s = 1 - k;
        ice.scale.set(s, 1.2 * s, s);
      },
      complete: () => {
        ice.visible = false;
      },
    });
  }

  // ───────────────────────── 우승 ─────────────────────────

  celebrate(playerId: number): void {
    this.winnerId = playerId;
    // 밤하늘 불꽃놀이. 판의 색은 남도록 완전히 어둡게 하지는 않는다
    this.dimGoal = 0.82;
    this.eventActive = false;
    this.route.hide();
    this.fireworkTimer = 0;
    this.titleTimer = 0.6;
    this.dice.hovering = false;
    for (const token of this.tokens.values()) {
      token.setCurrent(false, false);
      token.celebrating = token.id === playerId;
    }
    this.fx.startConfetti(new THREE.Vector3(0, 0.2, 0), ISLAND_W, ISLAND_D);
    this.callbacks.onCue?.('fanfare');
  }

  private launchFirework(): void {
    const colors = ['#ff4d6d', '#ffd23f', '#3ddc97', '#6ab8ff', '#c79bff', '#ff9a3d'];
    // 카메라가 어디를 보고 있든 화면 위쪽 절반, 무대 너머 하늘에서 터지도록 화면 좌표에서 거꾸로 계산한다
    const camera = this.rig.camera;
    const ndc = new THREE.Vector3((Math.random() - 0.5) * 1.6, 0.1 + Math.random() * 0.75, 0.5);
    const direction = ndc.unproject(camera).sub(camera.position).normalize();
    const depth = camera.position.length() * (1.05 + Math.random() * 0.35);
    const at = camera.position.clone().addScaledVector(direction, depth);
    this.fx.firework(at, colors[Math.floor(Math.random() * colors.length)]);
    this.callbacks.onCue?.('firework');
  }

  // ───────────────────────── 칸 도감(탭 미리보기) ─────────────────────────

  /** from 칸에서 to 칸으로 가는 길을 점선으로 보여준다. null이면 지운다 */
  showRoute(from: number | null, to?: number): void {
    if (from === null || to === undefined) {
      if (!this.eventActive) this.route.hide();
      return;
    }
    const glow = FAMILY_COLORS[familyOf(this.board.tiles[from].cell.kind)].glow;
    this.route.show(this.board.tileTop(from), this.board.tileTop(to), glow);
    this.fx.ring(this.board.tileTop(to), glow, 0.2, 1.2, 0.8, false, 0.9);
    this.board.flash(to, glow, 500, 700);
  }

  /** 칸을 가볍게 강조(탭 반응) */
  pulseTile(index: number): void {
    const tile = this.board.tiles[index];
    if (!tile) return;
    this.board.press(index, 0.05);
    if (tile.monumentHolder) this.activateMonument(index);
  }

  // ───────────────────────── 매 프레임 ─────────────────────────

  private readonly frame = (): void => {
    if (this.disposed) return;
    const now = performance.now();
    // 연출은 실제 흐른 시간만큼 진행시킨다. 게임 루프의 타이머와 어긋나지 않아야 느린 기기에서도
    // 말이 제때 도착한다. (탭이 가려졌다 돌아온 경우의 큰 점프만 0.25초로 자른다)
    const elapsed = Math.min(0.25, Math.max(0, (now - this.lastFrame) / 1000));
    this.watchPerformance((now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.animator.tick(elapsed * 1000);
    // 입자·카메라 같은 적분 계산은 한 번에 너무 큰 걸음을 밟지 않게 한다
    const dt = Math.min(0.1, elapsed);
    this.time += elapsed;

    // 이름표·조형물이 바라보는 방향
    const facingBefore = this.facing;
    this.facing += wrapAngle(this.baseYaw - this.facing) * damp(5, dt);
    if (Math.abs(this.baseYaw - this.facing) < 0.0005) this.facing = this.baseYaw;
    if (this.facing !== facingBefore) {
      this.board.setFacing(this.facing);
      this.dice.setHome(this.board.diceHome());
      this.layoutAll(false);
    }

    this.board.update(this.time);
    this.dice.update(this.time, dt);
    this.fx.update(dt);
    this.route.update(this.time, dt);
    this.sky.update(this.time, dt);
    for (const token of this.tokens.values()) {
      token.update(this.time);
      token.group.rotation.y = this.rig.yaw;
    }

    // 큰 연출 때 하늘과 조명이 저녁빛으로 가라앉는다
    this.dim += (this.dimGoal - this.dim) * damp(4.5, dt);
    this.hemi.intensity = lerp(HEMI_DAY, HEMI_DAY * 0.4, this.dim);
    this.sun.intensity = lerp(SUN_DAY, SUN_DAY * 0.42, this.dim);
    this.scene.environmentIntensity = lerp(ENV_DAY, ENV_DAY * 0.5, this.dim);
    this.sky.setDim(this.dim);

    if (this.winnerId !== null) {
      this.fireworkTimer -= dt;
      if (this.fireworkTimer <= 0) {
        this.launchFirework();
        this.fireworkTimer = this.reduced ? 1.6 : 0.42 + Math.random() * 0.5;
      }
      this.titleTimer -= dt;
      if (this.titleTimer <= 0) {
        this.board.waveTitle();
        this.titleTimer = 2.6;
      }
    }

    this.updateCamera(dt);
    this.renderer.render(this.scene, this.rig.camera);
  };

  private updateCamera(dt: number): void {
    const center = new THREE.Vector3(0, 0.2, 0);
    const follow = this.viewMode === 'follow';
    const current = this.currentId !== null ? this.tokens.get(this.currentId) : undefined;

    // 지금 화면의 주인공이 어디 있는가
    const subject = new THREE.Vector3(0, 0.3, 0);
    if (this.focusOverride) {
      subject.copy(this.focusOverride);
    } else if (this.rolling) {
      subject.copy(this.dice.group.position);
    } else if (current) {
      subject.copy(current.group.position);
      if (follow) {
        if (this.awaitingRoll && !current.busy) {
          // 굴리기 전: 앞으로 갈 칸들이 보이도록 진행 방향을 미리 내다본다
          const ahead = cellPosition(current.cellIndex + 3);
          subject.x = lerp(subject.x, ahead.x, 0.4);
          subject.z = lerp(subject.z, ahead.z, 0.4);
        }
        // 판 바깥의 빈 하늘보다 판 안쪽이 더 보이도록 가운데로 조금 당긴다
        subject.lerp(center, 0.18);
      }
    }
    subject.y = 0.3;
    this.focus.lerp(subject, damp(6, dt));

    if (this.attract) {
      // 시작 화면: 무대를 천천히 둘러본다. 세로 화면에서는 3D 제목이 화면 폭을 채우도록 다가간다.
      const sway = this.reduced ? 0 : Math.sin(this.time * 0.13) * 0.3;
      const distance = this.rig.isPortrait ? Math.min(this.fitAll, this.rig.distanceForWidth(8.8)) : this.fitAll * 1.02;
      this.rig.setGoal({ target: center, distance, yaw: this.baseYaw + sway, pitch: 0.9 });
      this.rig.update(dt, 1.6);
      return;
    }

    if (this.winnerId !== null) {
      const winner = this.tokens.get(this.winnerId);
      const at = winner ? winner.group.position.clone() : center;
      at.y = 0.5;
      const orbit = this.reduced ? 0 : this.time * 0.22;
      this.rig.setGoal({
        target: at.lerp(center, 0.35),
        distance: Math.min(this.fitAll, this.followDistance * 1.45),
        yaw: this.baseYaw + Math.sin(orbit) * 0.6,
        pitch: 0.72,
      });
      this.rig.update(dt, 1.8);
      return;
    }

    const zoom = this.reduced ? 1 : this.eventActive ? 0.84 : this.rolling ? 0.94 : 1;
    if (follow) {
      this.rig.setGoal({
        target: this.focus,
        distance: this.followDistance * zoom,
        yaw: this.baseYaw,
        pitch: 0.94,
      });
    } else {
      // 전체 보기: 판 전체가 HUD에 가리지 않게 유지하면서, 연출 때만 주인공 쪽으로 살짝 다가간다
      const lean = this.eventActive ? 0.12 : 0;
      const target = center.clone().lerp(this.focus, this.reduced ? 0 : lean);
      target.y = 0.2;
      this.rig.setGoal({
        target,
        distance: this.fitAll * (this.eventActive && !this.reduced ? 0.95 : 1),
        yaw: this.baseYaw,
        pitch: this.overviewPitch(),
      });
    }
    this.rig.update(dt);
  }

  // ───────────────────────── 포인터 ─────────────────────────

  private readonly onPointerDown = (event: PointerEvent): void => {
    this.canvas.setPointerCapture?.(event.pointerId);
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.pointers.size === 1) {
      this.downAt = performance.now();
      this.downX = event.clientX;
      this.downY = event.clientY;
      this.dragged = false;
    } else if (this.pointers.size === 2) {
      this.pinchDistance = this.currentPinch();
      this.dragged = true;
    }
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    const prev = this.pointers.get(event.pointerId);
    if (!prev) {
      this.updateCursor(event);
      return;
    }
    const dx = event.clientX - prev.x;
    const dy = event.clientY - prev.y;
    prev.x = event.clientX;
    prev.y = event.clientY;

    if (this.pointers.size === 2) {
      const distance = this.currentPinch();
      if (this.pinchDistance > 0 && distance > 0) {
        this.rig.userZoom = clamp((this.rig.userZoom * this.pinchDistance) / distance, 0.45, 1.5);
      }
      this.pinchDistance = distance;
      return;
    }

    if (Math.hypot(event.clientX - this.downX, event.clientY - this.downY) > 8) this.dragged = true;
    if (!this.dragged) return;
    this.rig.userYaw = clamp(this.rig.userYaw - dx * 0.005, -0.75, 0.75);
    this.rig.userPitch = clamp(this.rig.userPitch + dy * 0.004, -0.4, 0.4);
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    const wasSingle = this.pointers.size === 1;
    this.pointers.delete(event.pointerId);
    this.pinchDistance = 0;
    if (!wasSingle || this.dragged || performance.now() - this.downAt > 450) return;
    this.handleTap(event);
  };

  private readonly onPointerCancel = (event: PointerEvent): void => {
    this.pointers.delete(event.pointerId);
    this.pinchDistance = 0;
  };

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    this.rig.userZoom = clamp(this.rig.userZoom * Math.exp(event.deltaY * 0.0012), 0.45, 1.5);
  };

  private currentPinch(): number {
    const points = Array.from(this.pointers.values());
    if (points.length < 2) return 0;
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  }

  private pick(event: PointerEvent): THREE.Object3D | null {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -(((event.clientY - rect.top) / rect.height) * 2 - 1),
    );
    this.raycaster.setFromCamera(ndc, this.rig.camera);
    const hits = this.raycaster.intersectObjects(this.pickables, false);
    return hits.length > 0 ? hits[0].object : null;
  }

  private handleTap(event: PointerEvent): void {
    if (this.attract) return;
    const object = this.pick(event);
    if (!object) {
      this.callbacks.onTileTap?.(null);
      return;
    }
    if (object.userData.isDice) {
      this.callbacks.onDiceTap?.();
      return;
    }
    const index = object.userData.tileIndex as number | undefined;
    this.callbacks.onTileTap?.(index ?? null);
  }

  private updateCursor(event: PointerEvent): void {
    if (event.pointerType !== 'mouse' || this.attract) return;
    const object = this.pick(event);
    const clickable =
      object !== null &&
      (object.userData.isDice === true ||
        (typeof object.userData.tileIndex === 'number' &&
          this.board.tiles[object.userData.tileIndex as number].cell.kind !== 'NORMAL'));
    this.canvas.style.cursor = clickable ? 'pointer' : 'grab';
  }

  /** 시점을 기본으로 되돌린다 */
  resetView(): void {
    this.rig.resetUser();
  }

  /** 현재 안전 영역(디버그·테스트용) */
  get safeInsets(): Insets {
    return this.insets;
  }
}
