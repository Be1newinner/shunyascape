import * as THREE from "three/webgpu";
import { uv, time, sin, float, mix, vec3, positionWorld, abs, fract } from "three/tsl";
import { mulberry32 } from "./noise";

interface Phase {
  wait: number;
  shrink: number;
  radius: number;
  dps: number;
}

/** Shrinking play zone. Outside it you take damage every second. */
const PHASES: Phase[] = [
  { wait: 75, shrink: 50, radius: 210, dps: 1 },
  { wait: 60, shrink: 40, radius: 130, dps: 2 },
  { wait: 50, shrink: 35, radius: 75, dps: 4 },
  { wait: 40, shrink: 30, radius: 38, dps: 7 },
  { wait: 30, shrink: 25, radius: 14, dps: 10 },
  { wait: 25, shrink: 20, radius: 0, dps: 14 },
];

export class Zone {
  readonly mesh: THREE.Mesh;
  /** Current circle. */
  cx = 0;
  cz = 0;
  radius = 340;
  /** Circle the zone is shrinking toward. */
  nx = 0;
  nz = 0;
  nRadius = PHASES[0].radius;
  phase = 0;
  shrinking = false;
  timer = PHASES[0].wait;
  private fromX = 0;
  private fromZ = 0;
  private fromR = 340;
  private rng = mulberry32(Date.now() & 0xffff);

  constructor() {
    const geo = new THREE.CylinderGeometry(1, 1, 400, 96, 1, true);
    const mat = new THREE.MeshBasicNodeMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: false });
    const stripes = fract(positionWorld.y.mul(0.08).sub(time.mul(0.25)));
    const band = abs(stripes.sub(0.5)).mul(2);
    const pulse = sin(time.mul(1.5)).mul(0.1).add(0.9);
    mat.colorNode = mix(vec3(0.15, 0.4, 1.0), vec3(0.45, 0.75, 1.0), band);
    mat.opacityNode = float(0.22).add(band.mul(0.12)).mul(pulse).mul(float(1).sub(uv().y.mul(0.6)));
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.renderOrder = 10;
    this.pickNext();
    this.apply();
  }

  private pickNext() {
    const p = PHASES[this.phase];
    if (!p) return;
    // Next circle lies fully inside the current one.
    const maxOff = Math.max(0, this.radius - p.radius) * 0.85;
    const a = this.rng() * Math.PI * 2;
    const r = Math.sqrt(this.rng()) * maxOff;
    this.nx = this.cx + Math.cos(a) * r;
    this.nz = this.cz + Math.sin(a) * r;
    this.nRadius = p.radius;
  }

  get damagePerSecond() {
    return PHASES[Math.min(this.phase, PHASES.length - 1)].dps;
  }

  update(dt: number) {
    const p = PHASES[this.phase];
    if (!p) return;
    this.timer -= dt;
    if (!this.shrinking && this.timer <= 0) {
      this.shrinking = true;
      this.timer = p.shrink;
      this.fromX = this.cx;
      this.fromZ = this.cz;
      this.fromR = this.radius;
    } else if (this.shrinking) {
      const t = 1 - Math.max(0, this.timer) / p.shrink;
      this.cx = this.fromX + (this.nx - this.fromX) * t;
      this.cz = this.fromZ + (this.nz - this.fromZ) * t;
      this.radius = this.fromR + (this.nRadius - this.fromR) * t;
      if (this.timer <= 0) {
        this.shrinking = false;
        this.phase++;
        const next = PHASES[this.phase];
        if (next) {
          this.timer = next.wait;
          this.pickNext();
        }
      }
    }
    this.apply();
  }

  private apply() {
    this.mesh.position.set(this.cx, 150, this.cz);
    const r = Math.max(0.5, this.radius);
    this.mesh.scale.set(r, 1, r);
  }

  /** Take the server's zone (online matches); local updates just smooth between syncs. */
  sync(z: { cx: number; cz: number; radius: number; nx: number; nz: number; nRadius: number; phase: number; shrinking: boolean; timer: number }) {
    this.cx = z.cx;
    this.cz = z.cz;
    this.radius = z.radius;
    this.nx = z.nx;
    this.nz = z.nz;
    this.nRadius = z.nRadius;
    this.phase = z.phase - 1;
    this.shrinking = z.shrinking;
    this.timer = z.timer;
    if (z.shrinking) {
      // Resume interpolation from here toward the target circle.
      const p = PHASES[this.phase];
      if (p) {
        const t = 1 - this.timer / p.shrink;
        const k = t < 1 ? 1 / (1 - t) : 1;
        this.fromX = this.nx + (this.cx - this.nx) * k;
        this.fromZ = this.nz + (this.cz - this.nz) * k;
        this.fromR = this.nRadius + (this.radius - this.nRadius) * k;
      }
    }
    this.apply();
  }

  contains(x: number, z: number, margin = 0) {
    return Math.hypot(x - this.cx, z - this.cz) <= this.radius - margin;
  }

  /** A point inside the zone the next circle will also cover, for bots heading in. */
  safePoint(rng: () => number): [number, number] {
    const r = Math.max(4, this.nRadius * 0.8) * Math.sqrt(rng());
    const a = rng() * Math.PI * 2;
    return [this.nx + Math.cos(a) * r, this.nz + Math.sin(a) * r];
  }

  get status() {
    return {
      phase: this.phase + 1,
      shrinking: this.shrinking,
      timer: Math.max(0, Math.ceil(this.timer)),
      cx: this.cx,
      cz: this.cz,
      radius: this.radius,
      nx: this.nx,
      nz: this.nz,
      nRadius: this.nRadius,
      dps: this.damagePerSecond,
    };
  }
}
