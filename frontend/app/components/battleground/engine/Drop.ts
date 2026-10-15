import * as THREE from "three/webgpu";
import { MAP_HALF } from "./config";
import { mulberry32 } from "./noise";
import { LAYER, type Physics } from "./Physics";

/**
 * The start of every match: a transport plane crosses the map, you pick your
 * moment to jump, free-fall (push forward to dive), open the parachute (it
 * opens by itself low down) and steer it in to land wherever you like.
 */

export type DropStage = "plane" | "fall" | "chute" | "landed";

export const PLANE_ALT = 175;
const PLANE_SPEED = 55;
/** The parachute opens by itself this high above the ground. */
const AUTO_CHUTE = 85;
/** Can't open it straight out of the door. */
const MIN_FALL_TIME = 1.5;

export interface FlightPath {
  ax: number;
  az: number;
  dx: number;
  dz: number;
  length: number;
}

/** Same straight line across the map for everyone in the match (from its seed). */
export function flightPath(seed: number): FlightPath {
  const rng = mulberry32(seed ^ 0xf11e);
  const angle = rng() * Math.PI * 2;
  const dx = Math.cos(angle);
  const dz = Math.sin(angle);
  // Passes up to 140 m off centre, starts and ends beyond the map edge.
  const off = (rng() - 0.5) * 280;
  const half = MAP_HALF + 120;
  return { ax: -dz * off - dx * half, az: dx * off - dz * half, dx, dz, length: half * 2 };
}

const shared = new Map<string, THREE.Material>();
function m(color: string, roughness = 0.7, metalness = 0.2) {
  const k = `${color}${roughness}${metalness}`;
  if (!shared.has(k)) shared.set(k, new THREE.MeshStandardMaterial({ color, roughness, metalness }));
  return shared.get(k)!;
}

/** A four-engine transport, nose along +Z. About 30 m wingspan. */
export function planeMesh() {
  const g = new THREE.Group();
  const body = m("#7d8579", 0.6, 0.35);
  const dark = m("#3b403b", 0.6, 0.3);
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, rx = 0, rz = 0) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, 0, rz);
    g.add(mesh);
    return mesh;
  };
  add(new THREE.CylinderGeometry(1.9, 1.9, 20, 14), body, 0, 0, 0, Math.PI / 2);
  add(new THREE.SphereGeometry(1.9, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), body, 0, 0, 10, Math.PI / 2);
  add(new THREE.ConeGeometry(1.9, 7, 14), body, 0, 0.6, -13.4, -Math.PI / 2);
  add(new THREE.BoxGeometry(30, 0.35, 3.6), body, 0, 1.4, 1);
  add(new THREE.BoxGeometry(10, 0.3, 2.4), body, 0, 2.2, -15.5);
  add(new THREE.BoxGeometry(0.35, 5, 3.2), body, 0, 4.2, -15.5);
  add(new THREE.BoxGeometry(2.2, 0.6, 0.2), dark, 0, 0.9, 11.6); // cockpit glass
  const props: THREE.Mesh[] = [];
  for (const x of [-10, -5, 5, 10]) {
    add(new THREE.CylinderGeometry(0.55, 0.65, 3.4, 10), dark, x, 1.1, 2.4, Math.PI / 2);
    props.push(add(new THREE.BoxGeometry(3.6, 0.22, 0.08), dark, x, 1.1, 4.2));
  }
  g.userData.props = props;
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
  });
  return g;
}

export function spinProps(plane: THREE.Object3D, dt: number) {
  for (const p of plane.userData.props as THREE.Mesh[]) p.rotation.z += dt * 40;
}

/** Canopy and lines above a soldier (origin at their feet). */
export function chuteMesh(color = "#e8572f") {
  const g = new THREE.Group();
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(3.2, 20, 8, 0, Math.PI * 2, 0, Math.PI * 0.32),
    new THREE.MeshStandardMaterial({ color, roughness: 0.8, side: THREE.DoubleSide }),
  );
  canopy.scale.set(1, 0.55, 0.75);
  canopy.position.y = 4.2;
  g.add(canopy);
  const stripe = new THREE.Mesh(
    new THREE.SphereGeometry(3.22, 20, 2, 0, Math.PI * 2, Math.PI * 0.2, Math.PI * 0.06),
    new THREE.MeshStandardMaterial({ color: "#f4efe4", roughness: 0.8, side: THREE.DoubleSide }),
  );
  stripe.scale.copy(canopy.scale);
  stripe.position.copy(canopy.position);
  g.add(stripe);
  const lineMat = new THREE.LineBasicMaterial({ color: "#2b2b2b" });
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    pts.push(new THREE.Vector3(0, 1.45, 0), new THREE.Vector3(Math.cos(a) * 2.6, 5.4, Math.sin(a) * 1.9));
  }
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
  return g;
}

export interface DropInput {
  /** Joystick / WASD: forward and right, -1..1. */
  f: number;
  r: number;
  /** Camera heading (radians). */
  yaw: number;
  /** Jump pressed this frame: leave the plane, or open the parachute. */
  jump: boolean;
}

/** Your soldier from the plane door to the ground. */
export class DropController {
  stage: DropStage = "plane";
  /** Seconds since the plane started its run. */
  t = 0;
  readonly path: FlightPath;
  readonly position = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();
  private fallTime = 0;
  private down = new THREE.Vector3(0, -1, 0);

  constructor(seed: number, private physics: Physics, private heightAt: (x: number, z: number) => number) {
    this.path = flightPath(seed);
    this.position.copy(this.planePos());
  }

  planePos(out = new THREE.Vector3()) {
    const d = Math.min(this.t * PLANE_SPEED, this.path.length);
    return out.set(this.path.ax + this.path.dx * d, PLANE_ALT, this.path.az + this.path.dz * d);
  }

  get planeYaw() {
    return Math.atan2(this.path.dx, this.path.dz);
  }

  /** The plane is over the map (you may jump). */
  get overMap() {
    const p = this.planePos();
    return Math.abs(p.x) < MAP_HALF - 15 && Math.abs(p.z) < MAP_HALF - 15;
  }

  /** Seconds until you're thrown out at the far edge. */
  get timeLeft() {
    const exit = this.exitTime();
    return Math.max(0, Math.ceil(exit - this.t));
  }

  private exitTime() {
    // When the plane leaves the playable square again.
    const { ax, az, dx, dz } = this.path;
    const lim = MAP_HALF - 15;
    let tExit = Infinity;
    for (const [p, d] of [[ax, dx], [az, dz]]) {
      if (Math.abs(d) < 1e-6) continue;
      tExit = Math.min(tExit, ((d > 0 ? lim : -lim) - p) / d);
    }
    return tExit / PLANE_SPEED;
  }

  get altitude() {
    return Math.max(0, this.position.y - this.heightAt(this.position.x, this.position.z));
  }

  /** Advance one frame. Returns what changed, if anything. */
  update(dt: number, input: DropInput): "jumped" | "chute" | "landed" | null {
    this.t += dt;
    if (this.stage === "plane") {
      this.planePos(this.position);
      const past = this.t >= this.exitTime();
      if ((input.jump && this.overMap) || past) {
        this.stage = "fall";
        this.fallTime = 0;
        this.velocity.set(this.path.dx * 20, -2, this.path.dz * 20);
        this.position.y -= 3;
        return "jumped";
      }
      return null;
    }
    if (this.stage === "landed") return null;

    const fwd = new THREE.Vector3(Math.sin(input.yaw), 0, Math.cos(input.yaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    let event: "chute" | "landed" | null = null;
    let wantH: THREE.Vector3;
    let wantV: number;
    if (this.stage === "fall") {
      this.fallTime += dt;
      // Push forward to dive (fast and steep), pull back to float, steer sideways.
      const f = input.f;
      const fwdSpeed = f > 0 ? 6 + f * 12 : 6 + f * 4;
      wantH = fwd.multiplyScalar(fwdSpeed).addScaledVector(right, input.r * 8);
      wantV = f > 0 ? -(24 + f * 14) : -(24 + f * 6);
      if ((input.jump && this.fallTime > MIN_FALL_TIME) || this.altitude < AUTO_CHUTE) {
        this.stage = "chute";
        event = "chute";
      }
    } else {
      // Under the canopy: slow and floaty, but you can still cover ground.
      wantH = fwd.multiplyScalar(4 + Math.max(0, input.f) * 6 - Math.max(0, -input.f) * 3).addScaledVector(right, input.r * 4.5);
      wantV = -7;
    }
    const k = 1 - Math.exp(-dt * (this.stage === "chute" ? 2.5 : 1.6));
    this.velocity.x += (wantH.x - this.velocity.x) * k;
    this.velocity.z += (wantH.z - this.velocity.z) * k;
    this.velocity.y += (wantV - this.velocity.y) * k;

    const step = this.velocity.clone().multiplyScalar(dt);
    // Roofs, trees and the ground all stop you.
    const from = this.position.clone().add(new THREE.Vector3(0, 0.6, 0));
    const hit = this.physics.castRay(from, this.down, -step.y + 0.65, LAYER.WORLD);
    this.position.add(step);
    this.position.x = Math.max(-MAP_HALF + 2, Math.min(MAP_HALF - 2, this.position.x));
    this.position.z = Math.max(-MAP_HALF + 2, Math.min(MAP_HALF - 2, this.position.z));
    const ground = this.heightAt(this.position.x, this.position.z);
    if (hit || this.position.y <= ground) {
      this.position.y = hit ? hit.point.y + 0.02 : ground + 0.02;
      this.stage = "landed";
      this.velocity.set(0, 0, 0);
      return "landed";
    }
    return event;
  }
}
