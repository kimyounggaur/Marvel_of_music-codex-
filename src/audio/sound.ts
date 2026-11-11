// 효과음·배경음 엔진. 녹음 파일 없이 WebAudio로 전부 합성한다.
// 소리 자체가 교재가 되도록: 말이 한 칸 갈 때마다 도·레·미…로 음계를 오르고,
// 우승 팡파르는 G7 → C(딸림7화음 → 으뜸화음)로 마친다.

type OscType = OscillatorType;

interface ToneOptions {
  freq: number;
  type?: OscType;
  /** 초 */
  duration: number;
  gain?: number;
  attack?: number;
  /** 시작 시각(지금으로부터 초) */
  delay?: number;
  /** 끝날 때의 주파수(미끄러지는 소리) */
  slideTo?: number;
  music?: boolean;
}

interface NoiseOptions {
  duration: number;
  gain?: number;
  delay?: number;
  type?: BiquadFilterType;
  freq?: number;
  slideTo?: number;
  q?: number;
}

/** 다장조 음계(도=0)를 MIDI 번호로 */
const MAJOR = [0, 2, 4, 5, 7, 9, 11];

function degreeToMidi(degree: number, base = 72): number {
  const octave = Math.floor(degree / 7);
  const step = ((degree % 7) + 7) % 7;
  return base + octave * 12 + MAJOR[step];
}

const midiToFreq = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

type AudioContextCtor = typeof AudioContext;

declare global {
  interface Window {
    webkitAudioContext?: AudioContextCtor;
  }
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private sfxOn = true;
  private musicOn = true;
  private musicTimer: number | null = null;
  private nextBeat = 0;
  private beatIndex = 0;
  private failed = false;

  /** 사용자 조작(클릭·터치) 안에서 불러야 브라우저가 소리를 허용한다 */
  unlock(): void {
    if (this.failed) return;
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext ?? window.webkitAudioContext;
        if (!Ctor) {
          this.failed = true;
          return;
        }
        const ctx = new Ctor();
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -14;
        compressor.knee.value = 18;
        compressor.ratio.value = 6;
        compressor.connect(ctx.destination);
        const master = ctx.createGain();
        master.gain.value = 0.8;
        master.connect(compressor);
        const sfxBus = ctx.createGain();
        sfxBus.gain.value = this.sfxOn ? 1 : 0;
        sfxBus.connect(master);
        const musicBus = ctx.createGain();
        musicBus.gain.value = this.musicOn ? 1 : 0;
        musicBus.connect(master);

        const length = Math.floor(ctx.sampleRate * 1.2);
        const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;

        this.ctx = ctx;
        this.master = master;
        this.sfxBus = sfxBus;
        this.musicBus = musicBus;
        this.noiseBuffer = buffer;
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.failed = true;
    }
  }

  get sfxEnabled(): boolean {
    return this.sfxOn;
  }

  get musicEnabled(): boolean {
    return this.musicOn;
  }

  setSfx(on: boolean): void {
    this.sfxOn = on;
    if (this.ctx && this.sfxBus) this.sfxBus.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.03);
  }

  setMusic(on: boolean): void {
    this.musicOn = on;
    if (this.ctx && this.musicBus) this.musicBus.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.08);
  }

  private ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  private tone(opts: ToneOptions): void {
    const ctx = this.ctx;
    const bus = opts.music ? this.musicBus : this.sfxBus;
    if (!ctx || !bus || !this.ready()) return;
    const start = ctx.currentTime + (opts.delay ?? 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = opts.type ?? 'sine';
    osc.frequency.setValueAtTime(opts.freq, start);
    if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.slideTo), start + opts.duration);
    const peak = opts.gain ?? 0.2;
    const attack = opts.attack ?? 0.008;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + opts.duration);
    osc.connect(gain);
    gain.connect(bus);
    osc.start(start);
    osc.stop(start + opts.duration + 0.05);
  }

  private noise(opts: NoiseOptions): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus || !this.noiseBuffer || !this.ready()) return;
    const start = ctx.currentTime + (opts.delay ?? 0);
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = opts.type ?? 'bandpass';
    filter.frequency.setValueAtTime(opts.freq ?? 1200, start);
    if (opts.slideTo) filter.frequency.exponentialRampToValueAtTime(Math.max(40, opts.slideTo), start + opts.duration);
    filter.Q.value = opts.q ?? 0.8;
    const gain = ctx.createGain();
    const peak = opts.gain ?? 0.15;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + Math.min(0.03, opts.duration * 0.3));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + opts.duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxBus);
    source.start(start, Math.random() * 0.5);
    source.stop(start + opts.duration + 0.05);
  }

  /** 실로폰 같은 맑은 음 */
  private mallet(midi: number, delay = 0, gain = 0.26, music = false): void {
    const freq = midiToFreq(midi);
    this.tone({ freq, type: 'sine', duration: 0.42, gain, delay, music });
    this.tone({ freq: freq * 4, type: 'sine', duration: 0.12, gain: gain * 0.3, delay, music });
    this.tone({ freq: freq * 2, type: 'triangle', duration: 0.22, gain: gain * 0.25, delay, music });
  }

  private chord(midis: number[], delay: number, duration: number, gain: number): void {
    for (const midi of midis) {
      this.tone({ freq: midiToFreq(midi), type: 'triangle', duration, gain, delay, attack: 0.012 });
      this.tone({ freq: midiToFreq(midi) * 2, type: 'sine', duration: duration * 0.7, gain: gain * 0.35, delay });
    }
  }

  // ───────────── 게임 효과음 ─────────────

  /** 이번 이동의 n번째 걸음: 도(1)부터 한 음씩 올라간다 */
  step(n: number): void {
    this.mallet(degreeToMidi(Math.max(0, n - 1)), 0, 0.24);
  }

  /** 도돌이표 되감기: 한 칸 뒤로 갈 때마다 한 음씩 내려간다 */
  stepDown(n: number): void {
    this.mallet(degreeToMidi(9 - n), 0, 0.2);
  }

  diceThrow(): void {
    this.noise({ duration: 0.28, gain: 0.1, type: 'bandpass', freq: 500, slideTo: 2400, q: 0.7 });
  }

  diceBounce(strength: number): void {
    const s = Math.max(0.15, Math.min(1, strength));
    this.tone({ freq: 190, slideTo: 80, type: 'sine', duration: 0.11, gain: 0.3 * s });
    this.noise({ duration: 0.06, gain: 0.16 * s, type: 'highpass', freq: 1800 });
  }

  /** 주사위가 멈췄다: 나온 눈의 수만큼 음계를 훑어 올린다 */
  diceSettle(value: number): void {
    for (let i = 0; i < value; i += 1) this.mallet(degreeToMidi(i, 84), i * 0.045, 0.1);
    this.mallet(degreeToMidi(value - 1), value * 0.045, 0.24);
  }

  arrive(): void {
    this.tone({ freq: 150, slideTo: 60, type: 'sine', duration: 0.2, gain: 0.34 });
    this.mallet(79, 0.02, 0.2);
    this.mallet(84, 0.09, 0.22);
    this.mallet(88, 0.16, 0.18);
  }

  /** 기호 칸에 걸렸다 */
  event(): void {
    this.mallet(76, 0, 0.2);
    this.mallet(83, 0.07, 0.2);
    this.mallet(88, 0.14, 0.22);
    this.noise({ duration: 0.4, gain: 0.05, type: 'highpass', freq: 5000 });
  }

  portalIn(): void {
    this.tone({ freq: 260, slideTo: 1500, type: 'sine', duration: 0.45, gain: 0.2 });
    this.tone({ freq: 392, slideTo: 2200, type: 'triangle', duration: 0.45, gain: 0.08 });
    this.noise({ duration: 0.45, gain: 0.09, type: 'bandpass', freq: 400, slideTo: 3200, q: 2 });
  }

  portalOut(): void {
    this.tone({ freq: 1500, slideTo: 330, type: 'sine', duration: 0.35, gain: 0.2 });
    this.noise({ duration: 0.3, gain: 0.09, type: 'bandpass', freq: 3000, slideTo: 500, q: 2 });
  }

  whoosh(): void {
    this.noise({ duration: 0.5, gain: 0.14, type: 'bandpass', freq: 300, slideTo: 2600, q: 1.2 });
    this.tone({ freq: 330, slideTo: 880, type: 'sine', duration: 0.5, gain: 0.08 });
  }

  freeze(): void {
    const notes = [96, 93, 89, 86, 84];
    notes.forEach((midi, i) => this.tone({ freq: midiToFreq(midi), type: 'sine', duration: 0.9, gain: 0.11, delay: i * 0.07 }));
    this.noise({ duration: 0.7, gain: 0.07, type: 'highpass', freq: 6000 });
  }

  crack(): void {
    this.noise({ duration: 0.09, gain: 0.2, type: 'highpass', freq: 3200 });
    this.tone({ freq: 2100, slideTo: 900, type: 'triangle', duration: 0.08, gain: 0.1 });
  }

  shatter(): void {
    this.noise({ duration: 0.35, gain: 0.24, type: 'highpass', freq: 2600 });
    [98, 103, 95, 100].forEach((midi, i) =>
      this.tone({ freq: midiToFreq(midi), type: 'sine', duration: 0.25, gain: 0.08, delay: i * 0.035 }),
    );
  }

  rocket(): void {
    this.noise({ duration: 0.95, gain: 0.16, type: 'lowpass', freq: 180, slideTo: 3200, q: 0.9 });
    this.tone({ freq: 110, slideTo: 660, type: 'sawtooth', duration: 0.95, gain: 0.07 });
  }

  spring(): void {
    for (let i = 0; i < 3; i += 1) {
      this.tone({ freq: 180 + i * 70, slideTo: 520 + i * 160, type: 'sine', duration: 0.2, gain: 0.2, delay: i * 0.24 });
    }
  }

  rewind(): void {
    this.noise({ duration: 0.9, gain: 0.07, type: 'bandpass', freq: 2600, slideTo: 500, q: 3 });
  }

  teleport(): void {
    [72, 79, 84, 91, 96].forEach((midi, i) =>
      this.tone({ freq: midiToFreq(midi), type: 'square', duration: 0.1, gain: 0.06, delay: i * 0.05 }),
    );
    this.noise({ duration: 0.3, gain: 0.05, type: 'highpass', freq: 4500 });
  }

  /** 다카포: "짜잔" — 딸림화음에서 으뜸화음으로 */
  spotlight(): void {
    this.chord([67, 71, 74], 0, 0.22, 0.1);
    this.chord([72, 76, 79], 0.2, 0.7, 0.12);
  }

  firework(): void {
    this.tone({ freq: 120, slideTo: 45, type: 'sine', duration: 0.3, gain: 0.2 });
    this.noise({ duration: 0.5, gain: 0.1, type: 'lowpass', freq: 2400, slideTo: 300 });
    this.noise({ duration: 0.25, gain: 0.05, type: 'highpass', freq: 5000, delay: 0.12 });
  }

  /** 우승: G7 → C 완전종지 */
  fanfare(): void {
    const g7 = [67, 71, 74, 77];
    g7.forEach((midi, i) => this.mallet(midi, i * 0.11, 0.2));
    this.chord(g7, 0.44, 0.5, 0.09);
    this.chord([60, 64, 67, 72], 0.98, 1.6, 0.13);
    [72, 76, 79, 84, 88].forEach((midi, i) => this.mallet(midi, 1.0 + i * 0.09, 0.2));
  }

  tap(): void {
    this.tone({ freq: 880, type: 'triangle', duration: 0.06, gain: 0.12 });
  }

  card(): void {
    this.noise({ duration: 0.16, gain: 0.08, type: 'bandpass', freq: 1800, slideTo: 3600, q: 1 });
    this.mallet(84, 0.05, 0.12);
  }

  /** 차례가 넘어왔다 */
  turn(): void {
    this.mallet(76, 0, 0.14);
    this.mallet(79, 0.09, 0.14);
  }

  // ───────────── 배경음: C – F – G7 – C 를 도는 오르골 ─────────────

  startMusic(): void {
    if (!this.ctx || this.musicTimer !== null) return;
    this.nextBeat = this.ctx.currentTime + 0.15;
    this.beatIndex = 0;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 110);
  }

  stopMusic(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private scheduleMusic(): void {
    const ctx = this.ctx;
    if (!ctx || !this.ready()) return;
    const eighth = 60 / 96 / 2; // 1분에 96박
    // 탭이 오래 가려졌다 돌아오면 밀린 박을 버리고 지금부터 다시 센다
    if (this.nextBeat < ctx.currentTime - 0.3) this.nextBeat = ctx.currentTime + 0.05;
    const chords = [
      [48, 60, 64, 67], // C
      [41, 60, 65, 69], // F
      [43, 59, 62, 65], // G7
      [48, 60, 64, 67], // C
    ];
    const pattern = [1, 3, 2, 3, 1, 3, 2, 3];
    while (this.nextBeat < ctx.currentTime + 0.28) {
      const bar = Math.floor(this.beatIndex / 8) % 4;
      const pos = this.beatIndex % 8;
      const chord = chords[bar];
      const delay = Math.max(0, this.nextBeat - ctx.currentTime);
      if (pos === 0 || pos === 4) {
        this.tone({ freq: midiToFreq(chord[0]), type: 'triangle', duration: 0.5, gain: 0.07, delay, music: true });
      }
      this.tone({
        freq: midiToFreq(chord[pattern[pos]] + 12),
        type: 'sine',
        duration: 0.34,
        gain: pos % 2 === 0 ? 0.045 : 0.03,
        delay,
        music: true,
      });
      this.nextBeat += eighth;
      this.beatIndex += 1;
    }
  }
}

export const sound = new SoundEngine();
