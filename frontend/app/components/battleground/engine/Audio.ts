import type { WeaponId } from "./config";

/** Procedural combat sounds with Web Audio: no audio files to download. */
export class GameAudio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private noise!: AudioBuffer;
  private wind: AudioBufferSourceNode | null = null;
  volume = 0.8;

  /** Must be called from a user gesture (click to play). */
  resume() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 2;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.startWind();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  private startWind() {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 380;
    const g = ctx.createGain();
    g.gain.value = 0.05;
    // Slow swell so the wind breathes.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.03;
    lfo.connect(lfoGain).connect(g.gain);
    lfo.start();
    src.connect(lp).connect(g).connect(this.master);
    src.start();
    this.wind = src;
  }

  /**
   * Gunshot at a distance (metres) and stereo pan (-1..1). Far shots are
   * quieter, duller and arrive later.
   */
  shot(weapon: WeaponId, distance = 0, pan = 0) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + Math.min(distance / 343, 1.2);
    const near = 1 / (1 + distance / 18);
    const heavy = weapon === "kar98k" ? 1.5 : weapon === "p92" ? 0.7 : 1;
    const out = ctx.createStereoPanner();
    out.pan.value = Math.max(-1, Math.min(1, pan));
    out.connect(this.master);

    const crack = ctx.createBufferSource();
    crack.buffer = this.noise;
    crack.playbackRate.value = 0.9 + Math.random() * 0.2;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 600 + 7000 * near;
    const g = ctx.createGain();
    const peak = 0.9 * heavy * Math.max(near, 0.04);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.002);
    g.gain.exponentialRampToValueAtTime(peak * 0.25, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18 + 0.25 * heavy * (1 - near * 0.5));
    crack.connect(lp).connect(g).connect(out);
    crack.start(t, Math.random());
    crack.stop(t + 0.8);

    const thump = ctx.createOscillator();
    thump.type = "sine";
    thump.frequency.setValueAtTime(140 * (weapon === "p92" ? 1.3 : 1), t);
    thump.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(0.8 * heavy * near, t);
    tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    thump.connect(tg).connect(out);
    thump.start(t);
    thump.stop(t + 0.25);

    // Echo tail off the hills for distant / heavy shots.
    if (distance > 40 || heavy > 1.2) {
      const echo = ctx.createBufferSource();
      echo.buffer = this.noise;
      const bp = ctx.createBiquadFilter();
      bp.type = "lowpass";
      bp.frequency.value = 500;
      const eg = ctx.createGain();
      eg.gain.setValueAtTime(0, t + 0.12);
      eg.gain.linearRampToValueAtTime(0.12 * heavy * Math.max(near, 0.15), t + 0.2);
      eg.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
      echo.connect(bp).connect(eg).connect(out);
      echo.start(t + 0.12, Math.random());
      echo.stop(t + 1.2);
    }
  }

  private click(freq: number, when: number, gain = 0.25, dur = 0.03) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const hp = ctx.createBiquadFilter();
    hp.type = "bandpass";
    hp.frequency.value = freq;
    hp.Q.value = 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(hp).connect(g).connect(this.master);
    src.start(when, Math.random());
    src.stop(when + dur + 0.02);
  }

  reload(duration: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.click(1800, t + 0.15, 0.3);
    this.click(900, t + duration * 0.45, 0.35, 0.05);
    this.click(2400, t + duration * 0.85, 0.35);
    this.click(1500, t + duration * 0.95, 0.3);
  }

  bolt() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.click(1300, t + 0.45, 0.3, 0.05);
    this.click(2100, t + 0.75, 0.3, 0.04);
  }

  empty() {
    if (this.ctx) this.click(3000, this.ctx.currentTime, 0.25, 0.02);
  }

  hitMarker(kill = false) {
    const ctx = this.ctx;
    if (!ctx) return;
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.value = kill ? 1250 : 2100;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.12, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (kill ? 0.2 : 0.07));
    o.connect(g).connect(this.master);
    o.start();
    o.stop(ctx.currentTime + 0.25);
  }

  /** Supersonic crack of a round passing close by. */
  whiz() {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(4200, t);
    bp.frequency.exponentialRampToValueAtTime(1400, t + 0.12);
    bp.Q.value = 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.6 - 0.8;
    src.connect(bp).connect(g).connect(pan).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + 0.2);
  }

  /** Bullet striking the ground (thud) or something hard (ping). */
  impact(kind: "dirt" | "hard", distance: number) {
    if (!this.ctx) return;
    const near = 1 / (1 + distance / 8);
    if (kind === "dirt") this.click(260 + Math.random() * 120, this.ctx.currentTime, 0.25 * near, 0.08);
    else {
      this.click(3200 + Math.random() * 1500, this.ctx.currentTime, 0.22 * near, 0.05);
      this.click(900, this.ctx.currentTime + 0.01, 0.12 * near, 0.06);
    }
  }

  footstep(gain = 0.08) {
    if (this.ctx) this.click(220 + Math.random() * 80, this.ctx.currentTime, gain, 0.06);
  }

  pickup() {
    if (this.ctx) {
      this.click(1600, this.ctx.currentTime, 0.2, 0.04);
      this.click(2400, this.ctx.currentTime + 0.06, 0.15, 0.04);
    }
  }

  hurt() {
    if (this.ctx) this.click(160, this.ctx.currentTime, 0.4, 0.12);
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.ctx) this.master.gain.value = v;
  }

  dispose() {
    this.wind?.stop();
    void this.ctx?.close();
    this.ctx = null;
  }
}
