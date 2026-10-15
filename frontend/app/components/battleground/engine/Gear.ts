import * as THREE from "three/webgpu";
import type { GearLevel, GearSlot } from "./config";

/**
 * Procedural body armour: helmets and vests in three levels, as loot on the
 * ground and worn on soldiers. Level 1 is sand, 2 is olive, 3 is black with
 * a gold stripe so you can tell at a glance what someone is wearing.
 */

const SHELL = ["#000000", "#9a8a62", "#55603f", "#26292c"];
const TRIM = ["#000000", "#6f6346", "#3b4430", "#c9a043"];

const materials = new Map<string, THREE.MeshStandardMaterial>();
function mat(color: string, roughness = 0.75, metalness = 0.05) {
  const key = `${color}|${roughness}|${metalness}`;
  let m = materials.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    materials.set(key, m);
  }
  return m;
}

function box(w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

/** A helmet, +Y up and +Z forward, origin at the middle of the head. */
export function helmetMesh(level: GearLevel) {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.14, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(SHELL[level], 0.6));
  shell.scale.set(1, 0.92, 1.12);
  shell.castShadow = true;
  g.add(shell);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.142, 0.012, 6, 24), mat(TRIM[level], 0.5, level === 3 ? 0.6 : 0.05));
  rim.rotation.x = Math.PI / 2;
  rim.scale.set(1, 1.12, 1);
  rim.position.y = 0.022;
  g.add(rim);
  if (level >= 2) g.add(box(0.05, 0.03, 0.02, mat("#1d1f20"), 0, 0.09, 0.14)); // NVG mount
  return g;
}

/** A plate carrier, +Y up and +Z forward, origin at the middle of the chest. */
export function vestMesh(level: GearLevel) {
  const g = new THREE.Group();
  const shell = mat(SHELL[level], 0.85);
  const trim = mat(TRIM[level], 0.6, level === 3 ? 0.6 : 0.05);
  g.add(box(0.36, 0.42, 0.075, shell, 0, 0, 0.115)); // front plate
  g.add(box(0.36, 0.42, 0.06, shell, 0, 0, -0.115)); // back plate
  g.add(box(0.06, 0.3, 0.22, shell, 0.19, -0.04, 0));
  g.add(box(0.06, 0.3, 0.22, shell, -0.19, -0.04, 0));
  // Magazine pouches across the front.
  for (let i = 0; i < 3; i++) g.add(box(0.085, 0.11, 0.05, trim, (i - 1) * 0.1, -0.12, 0.17));
  if (level === 3) g.add(box(0.36, 0.025, 0.08, trim, 0, 0.12, 0.12));
  return g;
}

/** Loot version: a bit bigger so it reads on the ground. */
export function gearLootMesh(slot: GearSlot, level: GearLevel) {
  const g = new THREE.Group();
  const m = slot === "helmet" ? helmetMesh(level) : vestMesh(level);
  if (slot === "helmet") {
    m.position.y = 0.02;
    m.scale.setScalar(1.25);
  } else {
    m.rotation.x = -Math.PI / 2; // lying on its back
    m.position.y = 0.16;
    m.scale.setScalar(1.1);
  }
  g.add(m);
  return g;
}

export function gearName(slot: GearSlot, level: GearLevel) {
  return `${slot === "helmet" ? "Helmet" : "Vest"} Lv.${level}`;
}
