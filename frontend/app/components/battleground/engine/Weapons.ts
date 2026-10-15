import * as THREE from "three/webgpu";
import type { Assets } from "./Assets";
import { SCOPES, WEAPONS, type ScopeId, type WeaponId, type WeaponStats } from "./config";

/**
 * Weapon visuals share one local frame: +Z is the barrel direction, +Y is up,
 * origin at the right-hand grip. Anchors give the hand and muzzle positions.
 */
export interface WeaponModel {
  id: WeaponId;
  object: THREE.Group;
  grip: THREE.Vector3;
  fore: THREE.Vector3;
  muzzle: THREE.Vector3;
  /** Where the stock meets the shoulder (rifles) or the hands (pistol). */
  stock: THREE.Vector3;
  /** Point the eye lines up with when aiming (changes with the attached scope). */
  sight: THREE.Vector3;
  /** Sight points for iron sights, a red dot and a magnified scope. */
  sights: { iron: THREE.Vector3; reddot: THREE.Vector3; magnified: THREE.Vector3 };
}

/** Runtime state of one carried gun. */
export interface Gun {
  stats: WeaponStats;
  mag: number;
  scope: ScopeId | null;
}

export function makeGun(id: WeaponId, mag?: number, scope: ScopeId | null = null): Gun {
  return { stats: WEAPONS[id], mag: mag ?? WEAPONS[id].magSize, scope };
}

/** FOV when aiming this gun, from its scope (or iron sights). */
export function adsFov(gun: Gun) {
  return gun.scope ? SCOPES[gun.scope].fov : gun.stats.ironFov;
}

export function isMagnified(gun: Gun | null | undefined) {
  return !!gun?.scope && SCOPES[gun.scope].magnified;
}

/** Show the attachment's meshes on a weapon model and move its sight point. */
export function applyScope(model: WeaponModel, scope: ScopeId | null) {
  const kind = !scope ? "iron" : scope === "reddot" ? "reddot" : "magnified";
  model.object.traverse((o) => {
    if (o.userData.attachment === "reddot") o.visible = kind === "reddot";
    if (o.userData.attachment === "magnified") o.visible = kind === "magnified";
  });
  model.sight.copy(model.sights[kind]);
}

let attachmentMats: { body: THREE.Material; lens: THREE.Material; dot: THREE.Material } | null = null;
function attachmentMaterials() {
  attachmentMats ??= {
    body: new THREE.MeshStandardMaterial({ color: "#1d1f21", roughness: 0.4, metalness: 0.7 }),
    lens: new THREE.MeshStandardMaterial({ color: "#0d1a24", roughness: 0.05, metalness: 0.5, transparent: true, opacity: 0.6 }),
    dot: new THREE.MeshBasicMaterial({ color: "#ff3030" }),
  };
  return attachmentMats;
}

/** Red-dot sight: small open housing; origin at its mounting point. */
function redDotMesh() {
  const { body, lens, dot } = attachmentMaterials();
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.06), body);
  base.position.y = 0.01;
  const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.05, 18, 1, true), body);
  housing.rotation.x = Math.PI / 2;
  housing.position.y = 0.042;
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.019, 18), lens);
  glass.position.set(0, 0.042, 0.02);
  const reticle = new THREE.Mesh(new THREE.CircleGeometry(0.0025, 8), dot);
  reticle.position.set(0, 0.042, 0.021);
  g.add(base, housing, glass, reticle);
  return g;
}

/** Magnified scope: tube with front and rear bells. `power` scales the objective. */
function scopeMesh(power = 4) {
  const { body, lens } = attachmentMaterials();
  const g = new THREE.Group();
  const big = 0.018 + power * 0.002;
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.2, 16), body);
  tube.rotation.x = Math.PI / 2;
  tube.position.y = 0.05;
  const front = new THREE.Mesh(new THREE.CylinderGeometry(big, 0.014, 0.07, 16), body);
  front.rotation.x = Math.PI / 2;
  front.position.set(0, 0.05, 0.12);
  const rear = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.019, 0.05, 16), body);
  rear.rotation.x = Math.PI / 2;
  rear.position.set(0, 0.05, -0.11);
  const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.025, 10), body);
  turret.position.set(0, 0.07, 0);
  const lensF = new THREE.Mesh(new THREE.CircleGeometry(big * 0.92, 18), lens);
  lensF.position.set(0, 0.05, 0.156);
  const mounts = [-0.05, 0.05].map((z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.04, 0.02), body);
    m.position.set(0, 0.02, z);
    return m;
  });
  g.add(tube, front, rear, turret, lensF, ...mounts);
  return g;
}

/** A scope lying on the ground as loot. */
export function scopeLootMesh(id: ScopeId) {
  const g = id === "reddot" ? redDotMesh() : scopeMesh(id === "2x" ? 2 : id === "4x" ? 4 : 6);
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  g.scale.setScalar(1.6); // a bit larger than life so it reads on the ground
  return g;
}

const polymer = () => new THREE.MeshStandardMaterial({ color: "#232527", roughness: 0.62, metalness: 0.08 });
const metal = () => new THREE.MeshStandardMaterial({ color: "#2d3033", roughness: 0.34, metalness: 0.85 });

let m416Materials: { poly: THREE.Material; steel: THREE.Material } | null = null;

/** M416-style carbine assembled from primitives (no realistic CC0 scan exists yet). */
function buildM416(): WeaponModel {
  m416Materials ??= { poly: polymer(), steel: metal() };
  const { poly, steel } = m416Materials;
  const g = new THREE.Group();
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material, rx = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.rotation.x = rx;
    g.add(m);
    return m;
  };
  const cyl = (r: number, len: number, x: number, y: number, z: number, mat: THREE.Material, seg = 14) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat);
    m.rotation.x = Math.PI / 2;
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  // Receiver
  box(0.052, 0.062, 0.34, 0, 0.062, 0.06, steel);
  box(0.046, 0.05, 0.24, 0, 0.012, 0.03, poly);
  box(0.024, 0.012, 0.36, 0, 0.099, 0.08, steel); // top rail
  for (let i = 0; i < 14; i++) box(0.03, 0.006, 0.012, 0, 0.108, -0.06 + i * 0.024, steel);
  box(0.012, 0.03, 0.05, 0.03, 0.065, 0.08, steel); // ejection port cover
  box(0.016, 0.012, 0.03, -0.03, 0.07, -0.08, steel); // charging handle
  // Handguard with rails
  box(0.062, 0.066, 0.3, 0, 0.058, 0.38, poly);
  for (const sx of [-1, 1]) box(0.008, 0.02, 0.28, sx * 0.034, 0.058, 0.38, steel);
  box(0.024, 0.01, 0.28, 0, 0.094, 0.38, steel);
  // Barrel, gas block, flash hider
  cyl(0.011, 0.24, 0, 0.06, 0.64, steel);
  cyl(0.016, 0.03, 0, 0.06, 0.55, steel);
  const hider = cyl(0.017, 0.07, 0, 0.06, 0.78, steel, 6);
  hider.rotation.y = Math.PI / 6;
  // Magazine (slight curve: two tilted segments)
  box(0.026, 0.11, 0.07, 0, -0.045, 0.1, steel, 0.12);
  box(0.026, 0.1, 0.066, 0, -0.14, 0.118, steel, 0.32);
  // Pistol grip + trigger guard
  box(0.034, 0.11, 0.045, 0, -0.045, -0.035, poly, -0.32);
  box(0.006, 0.006, 0.07, 0, -0.022, 0.03, steel);
  // Vertical foregrip
  const fg = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.014, 0.1, 12), poly);
  fg.position.set(0, -0.02, 0.36);
  g.add(fg);
  // Buffer tube + stock
  cyl(0.017, 0.22, 0, 0.055, -0.2, steel);
  box(0.042, 0.09, 0.17, 0, 0.035, -0.3, poly);
  box(0.044, 0.105, 0.02, 0, 0.03, -0.39, poly);
  // Flip-up iron sights (rear on the receiver, front post on the gas block)
  box(0.02, 0.025, 0.012, 0, 0.12, -0.08, steel);
  box(0.004, 0.03, 0.004, 0, 0.11, 0.52, steel);
  // Optics, shown when attached
  const rd = redDotMesh();
  rd.position.set(0, 0.105, 0.05);
  rd.userData.attachment = "reddot";
  g.add(rd);
  const sc = scopeMesh(4);
  sc.position.set(0, 0.105, 0.04);
  sc.userData.attachment = "magnified";
  g.add(sc);
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  return {
    id: "m416",
    object: g,
    grip: new THREE.Vector3(0, -0.05, -0.04),
    fore: new THREE.Vector3(0, -0.03, 0.36),
    muzzle: new THREE.Vector3(0, 0.06, 0.82),
    stock: new THREE.Vector3(0, 0.03, -0.4),
    sight: new THREE.Vector3(0, 0.125, -0.08),
    sights: {
      iron: new THREE.Vector3(0, 0.125, -0.08),
      reddot: new THREE.Vector3(0, 0.147, 0.05),
      magnified: new THREE.Vector3(0, 0.155, -0.07),
    },
  };
}

/**
 * Orient a scanned gun: longest axis becomes +Z with the muzzle forward. The
 * muzzle end is the end whose cross-section is smaller (barrel vs stock).
 */
function orientScan(assets: Assets, key: "kar98k" | "p92", length: number, upFix: THREE.Euler) {
  const src = assets.get(key).scene.clone(true);
  src.updateMatrixWorld(true);
  const pts: THREE.Vector3[] = [];
  src.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const pos = mesh.geometry.attributes.position;
    const v = new THREE.Vector3();
    const stride = Math.max(1, Math.floor(pos.count / 4000));
    for (let i = 0; i < pos.count; i += stride) pts.push(v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld).clone());
  });
  const box = new THREE.Box3().setFromPoints(pts);
  const size = box.getSize(new THREE.Vector3());
  const axis: "x" | "y" | "z" = size.x >= size.y && size.x >= size.z ? "x" : size.y >= size.z ? "y" : "z";
  const lo = box.min[axis];
  const hi = box.max[axis];
  const span = hi - lo;
  const crossSection = (fromT: number, toT: number) => {
    const sel = pts.filter((p) => {
      const t = (p[axis] - lo) / span;
      return t >= fromT && t <= toT;
    });
    return new THREE.Box3().setFromPoints(sel).getSize(new THREE.Vector3());
  };
  const a = crossSection(0, 0.12);
  const b = crossSection(0.88, 1);
  const area = (s: THREE.Vector3) => (axis === "x" ? s.y * s.z : axis === "y" ? s.x * s.z : s.x * s.y);
  const muzzleAtHigh = area(b) < area(a);

  const inner = new THREE.Group();
  inner.add(src);
  // Rotate so the long axis points along +Z, muzzle forward.
  // Rotating about Y by -90deg takes +X onto +Z.
  if (axis === "x") inner.rotation.y = muzzleAtHigh ? -Math.PI / 2 : Math.PI / 2;
  else if (axis === "y") inner.rotation.x = muzzleAtHigh ? Math.PI / 2 : -Math.PI / 2;
  else if (!muzzleAtHigh) inner.rotation.y = Math.PI;
  const fix = new THREE.Group();
  fix.add(inner);
  const outer = new THREE.Group();
  outer.add(fix);
  outer.updateMatrixWorld(true);
  // A gun is taller than it is wide: roll it upright if it lies on its side.
  const lying = new THREE.Box3().setFromObject(outer).getSize(new THREE.Vector3());
  const roll = lying.x > lying.y ? Math.PI / 2 : 0;
  fix.rotation.set(upFix.x, upFix.y, upFix.z + roll);
  outer.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(outer);
  const s = length / (b2.max.z - b2.min.z);
  fix.scale.setScalar(s);
  outer.updateMatrixWorld(true);
  const b3 = new THREE.Box3().setFromObject(outer);
  outer.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      const m = mesh.material as THREE.MeshStandardMaterial;
      if (m.isMeshStandardMaterial) m.envMapIntensity = 1;
    }
  });
  return { outer, fix, bounds: b3 };
}

export function buildWeaponModel(assets: Assets, id: WeaponId): WeaponModel {
  if (id === "m416") return buildM416();
  if (id === "kar98k") {
    const { outer, fix, bounds } = orientScan(assets, "kar98k", 1.11, new THREE.Euler(0, 0, 0));
    const len = bounds.max.z - bounds.min.z;
    // Grip sits ~32% from the butt; re-centre so it is the origin.
    const gripZ = bounds.min.z + len * 0.32;
    const midY = bounds.min.y + (bounds.max.y - bounds.min.y) * 0.35;
    fix.position.set(-(bounds.min.x + bounds.max.x) / 2, -midY, -gripZ);
    // The scan comes with a scope; it only shows when a magnified scope is attached.
    outer.traverse((o) => {
      if (o.name.toLowerCase().includes("scope")) o.userData.attachment = "magnified";
    });
    const top = bounds.max.y - midY;
    const receiverTop = top - 0.065;
    const rd = redDotMesh();
    rd.position.set(0, receiverTop - 0.005, len * 0.06);
    rd.userData.attachment = "reddot";
    outer.add(rd);
    const iron = new THREE.Vector3(0, receiverTop + 0.012, len * 0.02);
    return {
      id,
      object: outer,
      grip: new THREE.Vector3(0, -0.02, 0),
      fore: new THREE.Vector3(0, -0.005, len * 0.3),
      muzzle: new THREE.Vector3(0, 0.03, bounds.max.z - gripZ),
      stock: new THREE.Vector3(0, -0.02, bounds.min.z - gripZ),
      sight: iron.clone(),
      sights: {
        iron,
        reddot: new THREE.Vector3(0, receiverTop + 0.037, len * 0.06),
        magnified: new THREE.Vector3(0, top - 0.02, len * 0.1),
      },
    };
  }
  const { outer, fix, bounds } = orientScan(assets, "p92", 0.21, new THREE.Euler(0, 0, 0));
  const h = bounds.max.y - bounds.min.y;
  // Grip sits ~20% from the back of the frame, a third of the way up.
  fix.position.set(-(bounds.min.x + bounds.max.x) / 2, -(bounds.min.y + h * 0.3), -(bounds.min.z + (bounds.max.z - bounds.min.z) * 0.2));
  return {
    id: "p92",
    object: outer,
    grip: new THREE.Vector3(0, -0.03, 0),
    fore: new THREE.Vector3(-0.02, -0.05, 0.01),
    muzzle: new THREE.Vector3(0, h * 0.55, 0.17),
    stock: new THREE.Vector3(0, 0, -0.06),
    sight: new THREE.Vector3(0, h * 0.72, 0.0),
    sights: {
      iron: new THREE.Vector3(0, h * 0.72, 0.0),
      reddot: new THREE.Vector3(0, h * 0.72, 0.0),
      magnified: new THREE.Vector3(0, h * 0.72, 0.0),
    },
  };
}

/** Stand-alone M416 for the lobby (needs no loaded assets). */
export function createM416(scope: ScopeId | null = "reddot") {
  const model = buildM416();
  applyScope(model, scope);
  return model;
}

/** Builds models once per weapon type and hands out clones. */
export class WeaponFactory {
  private cache = new Map<WeaponId, WeaponModel>();
  constructor(private assets: Assets) {}

  create(id: WeaponId, scope: ScopeId | null = null): WeaponModel {
    let base = this.cache.get(id);
    if (!base) {
      base = buildWeaponModel(this.assets, id);
      this.cache.set(id, base);
    }
    const model: WeaponModel = {
      ...base,
      object: base.object.clone(true),
      grip: base.grip.clone(),
      fore: base.fore.clone(),
      muzzle: base.muzzle.clone(),
      stock: base.stock.clone(),
      sight: base.sight.clone(),
      sights: { iron: base.sights.iron.clone(), reddot: base.sights.reddot.clone(), magnified: base.sights.magnified.clone() },
    };
    applyScope(model, scope);
    return model;
  }
}
