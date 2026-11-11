// 하늘·구름·떠다니는 음표. 큰 연출 때는 dim 값으로 하늘 전체가 저녁빛으로 가라앉는다.
import * as THREE from 'three';

const SKY_VERTEX = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAGMENT = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uDeep;
  uniform vec3 uNightTop;
  uniform vec3 uNightDeep;
  uniform float uDim;
  varying vec3 vDir;
  void main() {
    float h = normalize(vDir).y;
    // 카메라가 위에서 내려다보므로 화면에 보이는 것은 대부분 수평선 아래쪽이다.
    // 먼 쪽(화면 위)은 옅은 안개빛, 바로 아래(화면 아래)는 깊은 파랑으로 그러데이션을 준다.
    vec3 day = mix(uHorizon, uTop, smoothstep(0.0, 0.8, h));
    day = mix(day, uDeep, smoothstep(-0.25, -1.0, h));
    vec3 night = mix(uNightTop, uNightDeep, smoothstep(-0.3, -1.0, h));
    gl_FragColor = vec4(mix(day, night, uDim), 1.0);
    #include <colorspace_fragment>
  }
`;

interface CloudPuff {
  cluster: number;
  offset: THREE.Vector3;
  scale: THREE.Vector3;
}

interface CloudCluster {
  origin: THREE.Vector3;
  speed: number;
}

function noteTexture(): THREE.CanvasTexture {
  const S = 128;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ffffff';
    // 8분음표: 머리 + 기둥 + 꼬리
    ctx.save();
    ctx.translate(48, 96);
    ctx.rotate(-0.35);
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(66, 90);
    ctx.lineTo(66, 22);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(66, 22);
    ctx.bezierCurveTo(84, 34, 104, 44, 96, 72);
    ctx.bezierCurveTo(94, 56, 82, 48, 66, 44);
    ctx.closePath();
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const rand = (min: number, max: number): number => min + Math.random() * (max - min);

export class Sky {
  readonly group = new THREE.Group();
  private readonly skyMaterial: THREE.ShaderMaterial;
  private readonly cloudMesh: THREE.InstancedMesh;
  private readonly cloudMaterial: THREE.MeshStandardMaterial;
  private readonly clusters: CloudCluster[] = [];
  private readonly puffs: CloudPuff[] = [];
  private readonly notes: THREE.Sprite[] = [];
  private readonly noteMaterial: THREE.SpriteMaterial;
  private readonly matrix = new THREE.Matrix4();
  private readonly position = new THREE.Vector3();
  private readonly quaternion = new THREE.Quaternion();
  private readonly dayCloud = new THREE.Color('#ffffff');
  private readonly nightCloud = new THREE.Color('#6a6fb8');

  constructor() {
    this.skyMaterial = new THREE.ShaderMaterial({
      vertexShader: SKY_VERTEX,
      fragmentShader: SKY_FRAGMENT,
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTop: { value: new THREE.Color('#2f9bff') },
        uHorizon: { value: new THREE.Color('#c9eeff') },
        uDeep: { value: new THREE.Color('#2f8ff0') },
        uNightTop: { value: new THREE.Color('#3b3f9c') },
        uNightDeep: { value: new THREE.Color('#141845') },
        uDim: { value: 0 },
      },
    });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(160, 32, 20), this.skyMaterial);
    dome.renderOrder = -10;
    dome.frustumCulled = false;
    this.group.add(dome);

    // 구름: 납작한 공 여러 개를 뭉쳐 한 덩이로. 무대 둘레와 아래쪽을 천천히 흘러간다.
    this.cloudMaterial = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 1,
      emissive: '#ffffff',
      emissiveIntensity: 0.32,
    });
    const clusterCount = 16;
    const perCluster = 6;
    this.cloudMesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 14, 10),
      this.cloudMaterial,
      clusterCount * perCluster,
    );
    this.cloudMesh.frustumCulled = false;
    for (let c = 0; c < clusterCount; c += 1) {
      // 무대(대략 ±8 × ±5) 바깥 고리와 아래쪽에 흩어 놓는다
      const angle = (c / clusterCount) * Math.PI * 2 + rand(-0.2, 0.2);
      const z = Math.sin(angle) * rand(6.5, 11.5);
      this.clusters.push({
        // 카메라 쪽(z>0)은 무대보다 한참 아래, 먼 쪽은 무대 높이 근처에 두어 화면 가장자리에 고루 걸리게 한다
        origin: new THREE.Vector3(Math.cos(angle) * rand(10, 17), z > 0 ? rand(-7, -4.2) : rand(-4.5, -2), z),
        speed: rand(0.1, 0.3),
      });
      const size = rand(0.9, 1.7);
      for (let p = 0; p < perCluster; p += 1) {
        this.puffs.push({
          cluster: c,
          offset: new THREE.Vector3(rand(-1.6, 1.6) * size, rand(-0.25, 0.35) * size, rand(-0.8, 0.8) * size),
          scale: new THREE.Vector3(rand(0.8, 1.5) * size, rand(0.5, 0.8) * size, rand(0.7, 1.2) * size),
        });
      }
    }
    this.group.add(this.cloudMesh);

    // 공중을 떠다니는 음표
    this.noteMaterial = new THREE.SpriteMaterial({
      map: noteTexture(),
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    });
    for (let i = 0; i < 14; i += 1) {
      const sprite = new THREE.Sprite(this.noteMaterial);
      const angle = rand(0, Math.PI * 2);
      const radius = rand(9.5, 15);
      sprite.position.set(Math.cos(angle) * radius * 1.2, rand(-3, 4), Math.sin(angle) * radius * 0.75);
      const scale = rand(0.5, 1.0);
      sprite.scale.set(scale, scale, 1);
      sprite.userData.speed = rand(0.18, 0.42);
      sprite.userData.phase = rand(0, Math.PI * 2);
      sprite.userData.baseX = sprite.position.x;
      this.notes.push(sprite);
      this.group.add(sprite);
    }
    this.update(0, 0);
  }

  setDim(dim: number): void {
    this.skyMaterial.uniforms.uDim.value = dim;
    this.cloudMaterial.color.copy(this.dayCloud).lerp(this.nightCloud, dim);
    this.cloudMaterial.emissiveIntensity = 0.32 * (1 - dim * 0.8);
    this.noteMaterial.opacity = 0.75 * (1 - dim * 0.5);
  }

  update(time: number, dtSec: number): void {
    const wrap = 28;
    for (const cluster of this.clusters) {
      cluster.origin.x += cluster.speed * dtSec;
      if (cluster.origin.x > wrap) cluster.origin.x = -wrap;
    }
    for (let i = 0; i < this.puffs.length; i += 1) {
      const puff = this.puffs[i];
      const cluster = this.clusters[puff.cluster];
      this.position.copy(cluster.origin).add(puff.offset);
      this.position.y += Math.sin(time * 0.4 + puff.cluster) * 0.12;
      this.matrix.compose(this.position, this.quaternion, puff.scale);
      this.cloudMesh.setMatrixAt(i, this.matrix);
    }
    this.cloudMesh.instanceMatrix.needsUpdate = true;

    for (const note of this.notes) {
      note.position.y += (note.userData.speed as number) * dtSec;
      note.position.x = (note.userData.baseX as number) + Math.sin(time * 0.7 + (note.userData.phase as number)) * 0.5;
      if (note.position.y > 6.5) note.position.y = -4;
    }
  }
}
