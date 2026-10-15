import * as THREE from "three/webgpu";

/**
 * Pooled combat effects: bullet slugs, muzzle flash and smoke, impact dust,
 * sparks, blood, bullet holes and ejected brass. Everything is preallocated
 * so firing never allocates.
 */

function canvasTexture(size: number, draw: (g: CanvasRenderingContext2D, s: number) => void) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  draw(c.getContext("2d")!, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const softTexture = () =>
  canvasTexture(64, (g, s) => {
    const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grad.addColorStop(0, "rgba(255,255,255,0.95)");
    grad.addColorStop(0.45, "rgba(255,255,255,0.45)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
  });

const flashTexture = () =>
  canvasTexture(128, (g, s) => {
    g.translate(s / 2, s / 2);
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, s / 2);
    grad.addColorStop(0, "rgba(255,252,230,1)");
    grad.addColorStop(0.2, "rgba(255,214,120,0.95)");
    grad.addColorStop(0.55, "rgba(255,140,40,0.5)");
    grad.addColorStop(1, "rgba(255,100,20,0)");
    g.fillStyle = grad;
    for (let i = 0; i < 5; i++) {
      g.rotate((Math.PI * 2) / 5 + (i % 2) * 0.2);
      g.beginPath();
      g.moveTo(-5, 0);
      g.lineTo(0, -s * (0.32 + (i % 3) * 0.06));
      g.lineTo(5, 0);
      g.fill();
    }
    g.beginPath();
    g.arc(0, 0, s * 0.17, 0, Math.PI * 2);
    g.fill();
  });

/** Dark scorched bullet hole with a lighter chipped rim. */
const holeTexture = () =>
  canvasTexture(64, (g, s) => {
    const c = s / 2;
    const rim = g.createRadialGradient(c, c, 0, c, c, c);
    rim.addColorStop(0, "rgba(10,8,6,1)");
    rim.addColorStop(0.22, "rgba(20,16,12,0.95)");
    rim.addColorStop(0.35, "rgba(70,62,54,0.55)");
    rim.addColorStop(0.6, "rgba(40,34,28,0.25)");
    rim.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = rim;
    g.fillRect(0, 0, s, s);
    g.strokeStyle = "rgba(25,20,15,0.6)";
    g.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      g.beginPath();
      g.moveTo(c + Math.cos(a) * 6, c + Math.sin(a) * 6);
      g.lineTo(c + Math.cos(a) * (12 + Math.random() * 10), c + Math.sin(a) * (12 + Math.random() * 10));
      g.stroke();
    }
  });

interface Tracer {
  mesh: THREE.Mesh;
  from: THREE.Vector3;
  dir: THREE.Vector3;
  dist: number;
  travelled: number;
}

interface Particle {
  sprite: THREE.Sprite;
  mat: THREE.SpriteMaterial;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  grow: number;
  gravity: number;
  drag: number;
  alpha: number;
}

interface Spark {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
}

interface Hole {
  mesh: THREE.Mesh;
  age: number;
}

interface Brass {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
  life: number;
  floor: number;
}

export type ImpactKind = "dirt" | "hard" | "blood";

const UP = new THREE.Vector3(0, 1, 0);

export class Effects {
  readonly group = new THREE.Group();
  private tracers: Tracer[] = [];
  private particles: Particle[] = [];
  private flashes: Array<{ sprite: THREE.Sprite; life: number }> = [];
  private sparks: Spark[] = [];
  private holes: Hole[] = [];
  private brass: Brass[] = [];
  private light = new THREE.PointLight("#ffb860", 0, 10, 2);
  private lightLife = 0;
  private soft = softTexture();
  private idx = { tracer: 0, particle: 0, flash: 0, spark: 0, hole: 0, brass: 0 };

  constructor() {
    // A short glowing slug, not a beam: it flies along the shot and is gone in a few frames.
    const tracerMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.2, 0.9), transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const tracerGeo = new THREE.BoxGeometry(0.008, 0.008, 1);
    tracerGeo.translate(0, 0, 0.5);
    for (let i = 0; i < 48; i++) {
      const mesh = new THREE.Mesh(tracerGeo, tracerMat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.tracers.push({ mesh, from: new THREE.Vector3(), dir: new THREE.Vector3(), dist: 0, travelled: 0 });
    }
    // Each particle owns its material so it can fade on its own.
    for (let i = 0; i < 220; i++) {
      const mat = new THREE.SpriteMaterial({ map: this.soft, transparent: true, depthWrite: false });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      this.group.add(sprite);
      this.particles.push({ sprite, mat, vel: new THREE.Vector3(), life: 0, maxLife: 1, grow: 1, gravity: 0, drag: 2, alpha: 1 });
    }
    const flashMat = new THREE.SpriteMaterial({ map: flashTexture(), color: new THREE.Color(3, 2.6, 2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    for (let i = 0; i < 12; i++) {
      const sprite = new THREE.Sprite(flashMat);
      sprite.visible = false;
      this.group.add(sprite);
      this.flashes.push({ sprite, life: 0 });
    }
    const sparkMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 2.6, 1.1), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false });
    const sparkGeo = new THREE.BoxGeometry(0.006, 0.006, 0.09);
    for (let i = 0; i < 90; i++) {
      const mesh = new THREE.Mesh(sparkGeo, sparkMat);
      mesh.visible = false;
      this.group.add(mesh);
      this.sparks.push({ mesh, vel: new THREE.Vector3(), life: 0 });
    }
    const holeMat = new THREE.MeshBasicMaterial({ map: holeTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    const holeGeo = new THREE.PlaneGeometry(0.11, 0.11);
    for (let i = 0; i < 90; i++) {
      const mesh = new THREE.Mesh(holeGeo, holeMat);
      mesh.visible = false;
      this.group.add(mesh);
      this.holes.push({ mesh, age: 0 });
    }
    const brassMat = new THREE.MeshStandardMaterial({ color: "#c9a043", metalness: 0.9, roughness: 0.3 });
    const brassGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.03, 6);
    for (let i = 0; i < 30; i++) {
      const mesh = new THREE.Mesh(brassGeo, brassMat);
      mesh.visible = false;
      this.group.add(mesh);
      this.brass.push({ mesh, vel: new THREE.Vector3(), spin: new THREE.Vector3(), life: 0, floor: 0 });
    }
    this.group.add(this.light);
  }

  private particle(at: THREE.Vector3, color: THREE.ColorRepresentation, size: number, vel: THREE.Vector3Like, life: number, opts: Partial<Pick<Particle, "grow" | "gravity" | "drag" | "alpha">> = {}) {
    const p = this.particles[this.idx.particle++ % this.particles.length];
    p.mat.color.set(color);
    p.mat.opacity = opts.alpha ?? 1;
    p.mat.rotation = Math.random() * Math.PI * 2;
    p.sprite.position.copy(at);
    p.sprite.scale.setScalar(size);
    p.vel.set(vel.x, vel.y, vel.z);
    p.maxLife = p.life = life;
    p.grow = opts.grow ?? 0.8;
    p.gravity = opts.gravity ?? 0;
    p.drag = opts.drag ?? 2.5;
    p.alpha = opts.alpha ?? 1;
    p.sprite.visible = true;
  }

  tracer(from: THREE.Vector3, to: THREE.Vector3) {
    const t = this.tracers[this.idx.tracer++ % this.tracers.length];
    t.from.copy(from);
    t.dir.subVectors(to, from);
    t.dist = t.dir.length();
    if (t.dist < 1) return;
    t.dir.divideScalar(t.dist);
    t.travelled = 0;
    t.mesh.visible = true;
  }

  /** Flash, light pop and a wisp of smoke; `dir` is the barrel direction. */
  muzzleFlash(at: THREE.Vector3, size = 0.35, light = true, dir?: THREE.Vector3) {
    const f = this.flashes[this.idx.flash++ % this.flashes.length];
    f.sprite.position.copy(at);
    f.sprite.scale.setScalar(size * (0.75 + Math.random() * 0.5));
    f.sprite.material.rotation = Math.random() * Math.PI * 2;
    f.sprite.visible = true;
    f.life = 0.045;
    if (light) {
      this.light.position.copy(at);
      this.light.intensity = 35 + Math.random() * 15;
      this.lightLife = 0.045;
    }
    const d = dir ?? UP;
    this.particle(at, "#b9b4ac", 0.12, { x: d.x * 0.8, y: 0.35 + d.y * 0.8, z: d.z * 0.8 }, 0.9, { grow: 0.9, drag: 1.6, alpha: 0.35 });
  }

  /** A spent case flips out of the ejection port to the right. */
  ejectBrass(at: THREE.Vector3, right: THREE.Vector3, floorY: number) {
    const b = this.brass[this.idx.brass++ % this.brass.length];
    b.mesh.position.copy(at);
    b.vel.copy(right).multiplyScalar(1.6 + Math.random()).add(new THREE.Vector3(0, 1.8 + Math.random(), 0));
    b.spin.set(Math.random() * 20, Math.random() * 20, Math.random() * 20);
    b.life = 1.6;
    b.floor = floorY + 0.01;
    b.mesh.visible = true;
  }

  impact(at: THREE.Vector3, normal: THREE.Vector3Like, kind: ImpactKind, shotDir?: THREE.Vector3) {
    const n = new THREE.Vector3(normal.x, normal.y, normal.z).normalize();
    const r = (k: number) => (Math.random() - 0.5) * k;
    if (kind === "blood") {
      // Spray continues along the bullet, plus a hanging red mist.
      const d = shotDir ? shotDir.clone() : n.clone().negate();
      for (let i = 0; i < 6; i++) {
        this.particle(at, i % 2 ? "#6e0b0b" : "#8f1212", 0.05 + Math.random() * 0.05,
          { x: d.x * 3 + r(1.5), y: d.y * 3 + 0.8 + r(1), z: d.z * 3 + r(1.5) }, 0.45, { grow: 0.1, gravity: 9, drag: 1.5 });
      }
      this.particle(at, "#7a0f0f", 0.22, { x: d.x * 0.5, y: 0.1, z: d.z * 0.5 }, 0.5, { grow: 0.9, drag: 3, alpha: 0.6 });
      return;
    }
    if (kind === "hard") {
      for (let i = 0; i < 7; i++) {
        const s = this.sparks[this.idx.spark++ % this.sparks.length];
        s.mesh.position.copy(at);
        s.vel.copy(n).multiplyScalar(2 + Math.random() * 4).add(new THREE.Vector3(r(5), r(4) + 1.5, r(5)));
        s.life = 0.18 + Math.random() * 0.2;
        s.mesh.visible = true;
      }
      this.particle(at, "#cfc8bd", 0.12, { x: n.x * 0.8, y: n.y * 0.8 + 0.3, z: n.z * 0.8 }, 0.7, { grow: 0.8, alpha: 0.6 });
      this.particle(at, "#9c948a", 0.06, { x: n.x * 2 + r(1), y: n.y * 2 + 1, z: n.z * 2 + r(1) }, 0.5, { grow: 0.05, gravity: 9, drag: 0.5 });
    } else {
      // Dirt: a plume kicked up and away from the surface, plus falling clods.
      this.particle(at, "#8d7b5e", 0.18, { x: n.x * 1.2 + r(0.6), y: n.y * 1.8 + 0.5, z: n.z * 1.2 + r(0.6) }, 1.1, { grow: 1.2, drag: 2.2, alpha: 0.75 });
      this.particle(at, "#a39070", 0.12, { x: r(1), y: 1.2, z: r(1) }, 0.8, { grow: 0.9, drag: 2.5, alpha: 0.55 });
      for (let i = 0; i < 4; i++) {
        this.particle(at, "#4e3f2c", 0.035 + Math.random() * 0.03, { x: n.x * 2 + r(2), y: 2 + Math.random() * 2, z: n.z * 2 + r(2) }, 0.7, { grow: 0, gravity: 12, drag: 0.4 });
      }
    }
    this.bulletHole(at, n);
  }

  private bulletHole(at: THREE.Vector3, n: THREE.Vector3) {
    const h = this.holes[this.idx.hole++ % this.holes.length];
    h.mesh.position.copy(at).addScaledVector(n, 0.004);
    h.mesh.lookAt(at.clone().add(n));
    h.mesh.rotateZ(Math.random() * Math.PI * 2);
    h.mesh.scale.setScalar(0.8 + Math.random() * 0.5);
    h.age = 0;
    h.mesh.visible = true;
  }

  update(dt: number) {
    const speed = 900;
    for (const t of this.tracers) {
      if (!t.mesh.visible) continue;
      t.travelled += speed * dt;
      const head = Math.min(t.travelled, t.dist);
      const tail = Math.max(0, head - 1.4);
      if (tail >= t.dist - 0.01) {
        t.mesh.visible = false;
        continue;
      }
      t.mesh.position.copy(t.from).addScaledVector(t.dir, tail);
      t.mesh.lookAt(t.mesh.position.clone().add(t.dir));
      t.mesh.scale.set(1, 1, Math.max(0.01, head - tail));
    }
    for (const p of this.particles) {
      if (!p.sprite.visible) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.sprite.visible = false;
        continue;
      }
      p.vel.y -= p.gravity * dt;
      p.vel.multiplyScalar(Math.max(0, 1 - dt * p.drag));
      p.sprite.position.addScaledVector(p.vel, dt);
      p.sprite.scale.setScalar(p.sprite.scale.x + p.grow * dt);
      const t = p.life / p.maxLife;
      p.mat.opacity = p.alpha * Math.min(1, t * 2.5);
    }
    for (const s of this.sparks) {
      if (!s.mesh.visible) continue;
      s.life -= dt;
      if (s.life <= 0) {
        s.mesh.visible = false;
        continue;
      }
      s.vel.y -= 9.8 * dt;
      s.mesh.position.addScaledVector(s.vel, dt);
      s.mesh.lookAt(s.mesh.position.clone().add(s.vel));
    }
    for (const b of this.brass) {
      if (!b.mesh.visible) continue;
      b.life -= dt;
      if (b.life <= 0) {
        b.mesh.visible = false;
        continue;
      }
      if (b.mesh.position.y > b.floor) {
        b.vel.y -= 9.8 * dt;
        b.mesh.position.addScaledVector(b.vel, dt);
        b.mesh.rotation.x += b.spin.x * dt;
        b.mesh.rotation.y += b.spin.y * dt;
        b.mesh.rotation.z += b.spin.z * dt;
      } else {
        b.mesh.position.y = b.floor;
        b.mesh.rotation.set(Math.PI / 2, b.mesh.rotation.y, 0);
      }
    }
    // Bullet holes linger, then quietly disappear.
    for (const h of this.holes) {
      if (!h.mesh.visible) continue;
      h.age += dt;
      if (h.age > 25) h.mesh.visible = false;
    }
    for (const f of this.flashes) {
      if (!f.sprite.visible) continue;
      f.life -= dt;
      if (f.life <= 0) f.sprite.visible = false;
    }
    if (this.lightLife > 0) {
      this.lightLife -= dt;
      if (this.lightLife <= 0) this.light.intensity = 0;
    }
  }
}
