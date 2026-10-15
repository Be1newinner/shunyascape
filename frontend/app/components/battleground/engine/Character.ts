import * as THREE from "three/webgpu";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { WeaponModel } from "./Weapons";
import { clamp, lerp } from "./noise";

export type Stance = "stand" | "crouch" | "prone";

/** Everything the visual needs to know about a character this frame. */
export interface CharacterPose {
  /** Direction the gun points (yaw/pitch, radians). Forward is +Z at yaw 0. */
  aimYaw: number;
  aimPitch: number;
  /** World-space horizontal velocity. */
  velX: number;
  velZ: number;
  grounded: boolean;
  stance: Stance;
  sprinting: boolean;
  aiming: boolean;
  reloading: number; // 0..1 progress, 0 when not reloading
  healing: boolean;
  recoil: number; // 0..1, decays after each shot
}

const BONES = [
  "Hips", "Spine", "Spine1", "Spine2", "Neck", "Head",
  "RightArm", "RightForeArm", "RightHand", "LeftArm", "LeftForeArm", "LeftHand",
  "RightUpLeg", "RightLeg", "RightFoot", "LeftUpLeg", "LeftLeg", "LeftFoot",
] as const;
type BoneName = (typeof BONES)[number];

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _d = new THREE.Vector3();
const _e = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);

function rotateBoneWorld(bone: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3) {
  _q.setFromUnitVectors(from, to);
  bone.getWorldQuaternion(_q2);
  _q2.premultiply(_q);
  setWorldQuaternion(bone, _q2);
}

function setWorldQuaternion(bone: THREE.Object3D, world: THREE.Quaternion) {
  const parent = bone.parent!;
  parent.getWorldQuaternion(_q);
  bone.quaternion.copy(_q.invert().multiply(world));
  bone.updateMatrixWorld(true);
}

/** Analytic two-bone IK: places the end bone at `target` bending toward `pole`. */
function solveTwoBone(upper: THREE.Object3D, lower: THREE.Object3D, end: THREE.Object3D, target: THREE.Vector3, pole: THREE.Vector3) {
  const a = upper.getWorldPosition(_a);
  const b = lower.getWorldPosition(_b);
  const c = end.getWorldPosition(_c);
  const lab = a.distanceTo(b);
  const lbc = b.distanceTo(c);
  const toT = _d.subVectors(target, a);
  const dist = clamp(toT.length(), Math.abs(lab - lbc) + 0.01, (lab + lbc) * 0.999);
  const dir = toT.normalize();
  const cosA = clamp((lab * lab + dist * dist - lbc * lbc) / (2 * lab * dist), -1, 1);
  const sinA = Math.sqrt(1 - cosA * cosA);
  const poleDir = _e.subVectors(pole, a);
  poleDir.addScaledVector(dir, -poleDir.dot(dir)).normalize();
  const elbow = new THREE.Vector3().copy(a).addScaledVector(dir, cosA * lab).addScaledVector(poleDir, sinA * lab);
  const reach = new THREE.Vector3().copy(a).addScaledVector(dir, dist);
  rotateBoneWorld(upper, b.clone().sub(a).normalize(), elbow.clone().sub(a).normalize());
  const b2 = lower.getWorldPosition(new THREE.Vector3());
  const c2 = end.getWorldPosition(new THREE.Vector3());
  rotateBoneWorld(lower, c2.sub(b2).normalize(), reach.sub(b2).normalize());
}

/** Turn a bone so its local +Y points along `yDir` and local +Z along (roughly) `zDir`. */
function orientBone(bone: THREE.Object3D, yDir: THREE.Vector3, zDir: THREE.Vector3) {
  const y = yDir.clone().normalize();
  const x = new THREE.Vector3().crossVectors(y, zDir).normalize();
  const z = new THREE.Vector3().crossVectors(x, y).normalize();
  _m.makeBasis(x, y, z);
  _q2.setFromRotationMatrix(_m);
  setWorldQuaternion(bone, _q2);
}

export class CharacterVisual {
  readonly root = new THREE.Group();
  /** Rotates with stance (prone lies the model down). */
  private body = new THREE.Group();
  private model: THREE.Object3D;
  private mixer: THREE.AnimationMixer;
  private actions: Record<"idle" | "walk" | "run", THREE.AnimationAction>;
  private bones = {} as Record<BoneName, THREE.Bone>;
  private weapon: WeaponModel | null = null;
  private weaponHolder = new THREE.Group();
  private stanceBlend = { crouch: 0, prone: 0 };
  private lowerYaw = 0;
  private walkPhase = 0;
  private deathT = -1;
  private flinch = 0;
  private farAccum = 0;
  private lean = 0;
  private fallDir = -1;
  private fallRoll = 0;
  private farTick = Math.floor(Math.random() * 3);
  /** Model faces -Z in the source file; we flip so +Z is forward. */
  private yawOffset = 0;
  readonly meshes: THREE.SkinnedMesh[] = [];
  visibleWeapon = true;

  constructor(gltf: GLTF, tint?: THREE.ColorRepresentation) {
    this.model = cloneSkinned(gltf.scene);
    this.body.add(this.model);
    this.root.add(this.body);
    this.root.add(this.weaponHolder);
    this.model.traverse((o) => {
      const mesh = o as THREE.SkinnedMesh;
      if (mesh.isSkinnedMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
        if (tint) {
          const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
          mat.color = new THREE.Color(tint);
          mesh.material = mat;
          mesh.userData.ownMaterial = true;
        }
        this.meshes.push(mesh);
      }
      const bone = o as THREE.Bone;
      if (bone.isBone) {
        const name = bone.name.replace(/^mixamorig:?/, "") as BoneName;
        if ((BONES as readonly string[]).includes(name)) this.bones[name] = bone;
      }
    });
    this.mixer = new THREE.AnimationMixer(this.model);
    const clip = (n: string) => gltf.animations.find((a) => a.name === n)!;
    this.actions = {
      idle: this.mixer.clipAction(clip("Idle")),
      walk: this.mixer.clipAction(clip("Walk")),
      run: this.mixer.clipAction(clip("Run")),
    };
    for (const a of Object.values(this.actions)) {
      a.play();
      a.setEffectiveWeight(0);
    }
    this.actions.idle.setEffectiveWeight(1);

    // Work out which way the toes point in the bind pose to find "forward".
    this.model.updateMatrixWorld(true);
    const foot = this.bones.LeftFoot.getWorldPosition(new THREE.Vector3());
    const toe = this.bones.LeftFoot.children[0]?.getWorldPosition(new THREE.Vector3()) ?? foot.clone().add(new THREE.Vector3(0, 0, 1));
    this.yawOffset = toe.z - foot.z >= 0 ? 0 : Math.PI;
    this.model.rotation.y = this.yawOffset;
  }

  setWeapon(model: WeaponModel | null) {
    if (this.weapon) this.weaponHolder.remove(this.weapon.object);
    this.weapon = model;
    if (model) this.weaponHolder.add(model.object);
  }

  get weaponModel() {
    return this.weapon;
  }

  /** World position of the muzzle (for tracers and flashes). */
  muzzleWorld(out = new THREE.Vector3()) {
    if (!this.weapon) return this.bones.RightHand.getWorldPosition(out);
    return this.weapon.object.localToWorld(out.copy(this.weapon.muzzle));
  }

  headWorld(out = new THREE.Vector3()) {
    return this.bones.Head.getWorldPosition(out);
  }

  get dead() {
    return this.deathT >= 0;
  }

  /** Start falling; `shotDir` (world) decides whether they fall forward or backward. */
  die(shotDir?: THREE.Vector3) {
    if (this.deathT >= 0) return;
    this.deathT = 0;
    const fwd = new THREE.Vector3(Math.sin(this.root.rotation.y), 0, Math.cos(this.root.rotation.y));
    // Hit from the front -> knocked onto the back; hit from behind -> pitched forward.
    this.fallDir = shotDir && shotDir.dot(fwd) > 0 ? 1 : -1;
    this.fallRoll = (Math.random() - 0.5) * 0.5;
  }

  hit() {
    this.flinch = 1;
  }

  /** Re-tint the armour (outfit change in the lobby). */
  setTint(color: THREE.ColorRepresentation) {
    for (const mesh of this.meshes) {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (!mesh.userData.ownMaterial) {
        mesh.material = mat.clone();
        mesh.userData.ownMaterial = true;
      }
      (mesh.material as THREE.MeshStandardMaterial).color = new THREE.Color(color);
    }
  }

  setVisible(v: boolean) {
    this.body.visible = v;
  }

  /**
   * Animate one frame. `detail` < 1 skips IK work for distant characters.
   */
  update(dt: number, pose: CharacterPose, detail = 1) {
    if (this.deathT >= 0) {
      this.updateDeath(dt);
      return;
    }
    const speed = Math.hypot(pose.velX, pose.velZ);
    const moving = speed > 0.3;
    const moveYaw = Math.atan2(pose.velX, pose.velZ);

    // Lower body turns toward the walking direction; upper body keeps aiming.
    let rel = moving ? wrapAngle(moveYaw - pose.aimYaw) : 0;
    let backwards = false;
    if (Math.abs(rel) > Math.PI * 0.6) {
      backwards = true;
      rel = wrapAngle(rel + Math.PI);
    }
    let targetLower = clamp(rel, -1.15, 1.15);
    if (pose.sprinting && moving) targetLower = wrapAngle(moveYaw - pose.aimYaw);
    if (pose.stance === "prone") targetLower = 0;
    this.lowerYaw = lerpAngle(this.lowerYaw, targetLower, 1 - Math.exp(-dt * 10));
    this.root.rotation.y = pose.aimYaw + this.lowerYaw;

    // Distant characters animate every third frame (with the accumulated time).
    let animDt = dt;
    if (detail <= 0) {
      this.farAccum += dt;
      if (++this.farTick % 3 !== 0) return;
      animDt = this.farAccum;
      this.farAccum = 0;
    } else {
      this.farAccum = 0;
    }

    // Locomotion blend.
    const crouchK = this.stanceBlend.crouch;
    const proneK = this.stanceBlend.prone;
    const runW = pose.grounded ? clamp((speed - 2.6) / 1.4, 0, 1) : 0;
    const walkW = pose.grounded ? clamp(speed / 1.2, 0, 1) * (1 - runW) : 0;
    const idleW = 1 - Math.max(walkW + runW, 0);
    this.actions.idle.setEffectiveWeight(Math.max(idleW, pose.grounded ? 0 : 1));
    this.actions.walk.setEffectiveWeight(walkW);
    this.actions.run.setEffectiveWeight(runW);
    const dir = backwards ? -1 : 1;
    const slow = proneK > 0.5 ? 0.45 : crouchK > 0.5 ? 0.75 : 1;
    // Clips are in place; their feet cover ~1.4 m/s (walk) and ~3.8 m/s (run).
    // Playing them at the body's real speed keeps feet from sliding.
    this.actions.walk.setEffectiveTimeScale(dir * clamp(speed / 1.4, 0.55, 1.9) * slow);
    this.actions.run.setEffectiveTimeScale(dir * clamp(speed / 3.8, 0.8, 1.75));
    this.walkPhase += animDt * speed;
    this.mixer.update(animDt);

    // Stance transitions.
    const k = 1 - Math.exp(-animDt * 8);
    this.stanceBlend.crouch = lerp(crouchK, pose.stance === "crouch" ? 1 : 0, k);
    this.stanceBlend.prone = lerp(proneK, pose.stance === "prone" ? 1 : 0, k);
    const prone = this.stanceBlend.prone;
    this.body.rotation.x = prone * (Math.PI / 2 - 0.08);
    this.body.position.set(0, prone * 0.16, -prone * 1.0);
    this.root.updateMatrixWorld(true);

    if (detail <= 0) {
      this.placeWeaponOnHand();
      return;
    }

    if (this.stanceBlend.crouch > 0.01 && prone < 0.5) this.applyCrouch(this.stanceBlend.crouch);
    this.applyUpperBody(pose, dt);
  }

  private applyCrouch(t: number) {
    const { Hips } = this.bones;
    // Remember where the feet are, drop the hips, then IK the legs back to the feet.
    const lf = this.bones.LeftFoot.getWorldPosition(new THREE.Vector3());
    const rf = this.bones.RightFoot.getWorldPosition(new THREE.Vector3());
    const hipsW = Hips.getWorldPosition(new THREE.Vector3());
    hipsW.y -= 0.48 * t;
    const fwd = new THREE.Vector3(Math.sin(this.root.rotation.y), 0, Math.cos(this.root.rotation.y));
    hipsW.addScaledVector(fwd, -0.12 * t);
    Hips.parent!.worldToLocal(hipsW);
    Hips.position.copy(hipsW);
    Hips.updateMatrixWorld(true);
    lf.addScaledVector(fwd, 0.1 * t);
    rf.addScaledVector(fwd, 0.1 * t);
    const knee = (foot: THREE.Vector3) => foot.clone().addScaledVector(fwd, 1.2).add(new THREE.Vector3(0, 0.6, 0));
    solveTwoBone(this.bones.LeftUpLeg, this.bones.LeftLeg, this.bones.LeftFoot, lf, knee(lf));
    solveTwoBone(this.bones.RightUpLeg, this.bones.RightLeg, this.bones.RightFoot, rf, knee(rf));
  }

  private applyUpperBody(pose: CharacterPose, dt: number) {
    const b = this.bones;
    const prone = this.stanceBlend.prone;
    const lowReady = pose.sprinting && !pose.aiming;
    const aimYaw = pose.aimYaw;
    let pitch = clamp(pose.aimPitch, -1.2, 1.2);
    if (lowReady) pitch = -0.55;
    // Sprinters lean into the run.
    const speed = Math.hypot(pose.velX, pose.velZ);
    this.lean = lerp(this.lean, pose.sprinting ? clamp(speed / 6.3, 0, 1) * 0.28 : 0, 1 - Math.exp(-dt * 6));
    if (pose.healing) pitch = -0.9;
    pitch += pose.recoil * 0.06;
    this.flinch = Math.max(0, this.flinch - dt * 5);

    const fwd = new THREE.Vector3(Math.sin(aimYaw), 0, Math.cos(aimYaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x); // forward x up: -X at yaw 0
    const aimDir = fwd.clone().multiplyScalar(Math.cos(pitch)).add(new THREE.Vector3(0, Math.sin(pitch), 0)).normalize();

    // Twist the spine back toward the aim yaw and bend it with pitch.
    const spines = [b.Spine, b.Spine1, b.Spine2];
    const twist = -this.lowerYaw / spines.length;
    // Rotating about `right` by +a tips forward up, so aiming up bends back.
    const bend = (pitch * (1 - prone * 0.6) + this.flinch * 0.15 - this.lean) / spines.length;
    for (const s of spines) {
      s.getWorldQuaternion(_q2);
      _q.setFromAxisAngle(UP, twist);
      _q2.premultiply(_q);
      _q.setFromAxisAngle(right, bend);
      _q2.premultiply(_q);
      setWorldQuaternion(s, _q2);
    }
    // Head follows the aim a bit more.
    b.Head.getWorldQuaternion(_q2);
    _q.setFromAxisAngle(right, pitch * 0.25);
    setWorldQuaternion(b.Head, _q2.premultiply(_q));

    if (!this.weapon) return;
    const w = this.weapon;
    const chest = b.Spine2.getWorldPosition(new THREE.Vector3());
    const isPistol = w.id === "p92";

    // Gun pose in body space: stock in the shoulder, pistol held out front.
    const shoulderOffset = isPistol
      ? new THREE.Vector3(0.05, 0.12, 0.42)
      : new THREE.Vector3(pose.aiming ? 0.13 : 0.16, pose.aiming ? 0.17 : 0.08, 0.2);
    if (prone > 0.5) shoulderOffset.set(isPistol ? 0.05 : 0.14, 0.1, isPistol ? 0.45 : 0.25);
    const pos = chest
      .clone()
      .addScaledVector(right, shoulderOffset.x)
      .addScaledVector(UP, shoulderOffset.y)
      .addScaledVector(aimDir, shoulderOffset.z);
    let weaponDir = aimDir.clone();
    if (lowReady) weaponDir = aimDir.clone().addScaledVector(right, -0.6).normalize();
    // Reload: tip the gun down and toward the off hand.
    if (pose.reloading > 0) {
      const r = Math.sin(pose.reloading * Math.PI);
      weaponDir.addScaledVector(UP, -0.5 * r).addScaledVector(right, -0.4 * r).normalize();
    }
    const q = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().lookAt(new THREE.Vector3(), weaponDir.clone().negate(), UP),
    );
    // Recoil kicks the gun back along its axis.
    const local = this.root.worldToLocal(pos.clone().addScaledVector(weaponDir, -pose.recoil * 0.05));
    this.weaponHolder.position.copy(local);
    this.root.getWorldQuaternion(_q);
    this.weaponHolder.quaternion.copy(_q.invert().multiply(q));
    this.weaponHolder.updateMatrixWorld(true);

    const grip = w.object.localToWorld(w.grip.clone());
    const fore = w.object.localToWorld(w.fore.clone());
    if (pose.reloading > 0 && !isPistol) {
      // Off hand goes to the magazine and back.
      const r = Math.sin(pose.reloading * Math.PI);
      fore.lerp(w.object.localToWorld(new THREE.Vector3(0, -0.2, 0.08)), r);
    }
    const down = new THREE.Vector3(0, -1, 0);
    const elbowR = grip.clone().addScaledVector(right, 0.5).addScaledVector(down, 0.6);
    const elbowL = fore.clone().addScaledVector(right, -0.6).addScaledVector(down, 0.6);
    solveTwoBone(b.RightArm, b.RightForeArm, b.RightHand, grip, elbowR);
    solveTwoBone(b.LeftArm, b.LeftForeArm, b.LeftHand, fore, elbowL);
    // Hands: fingers along the gun, palms inward.
    const gunUp = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const gunRight = new THREE.Vector3().crossVectors(weaponDir, gunUp).normalize();
    orientBone(b.RightHand, weaponDir.clone().addScaledVector(gunUp, -0.55).addScaledVector(gunRight, -0.35), gunRight.clone().negate());
    orientBone(b.LeftHand, weaponDir.clone().addScaledVector(gunUp, isPistol ? -0.4 : -0.2).addScaledVector(gunRight, 0.5), gunUp.clone().negate());
  }

  /** Cheap path for far-away characters: gun follows the right hand. */
  private placeWeaponOnHand() {
    if (!this.weapon) return;
    const hand = this.bones.RightHand.getWorldPosition(new THREE.Vector3());
    this.weaponHolder.position.copy(this.root.worldToLocal(hand));
    this.weaponHolder.rotation.set(0, 0, 0);
  }

  private updateDeath(dt: number) {
    this.deathT += dt;
    // Knees give, then the body tips over and settles with a small bounce.
    const t = clamp(this.deathT / 0.7, 0, 1);
    const ease = t < 1 ? t * t * (3 - 2 * t) : 1;
    const settle = t >= 1 ? Math.sin(Math.min(1, (this.deathT - 0.7) / 0.25) * Math.PI) * 0.04 : 0;
    this.body.rotation.x = lerp(this.body.rotation.x, this.fallDir * (Math.PI / 2 - 0.12) + settle * this.fallDir, ease);
    this.body.rotation.z = lerp(this.body.rotation.z, this.fallRoll, ease);
    this.body.position.y = lerp(this.body.position.y, 0.14, ease);
    this.mixer.update(dt * (1 - t));
    if (this.weapon) this.weaponHolder.position.y = lerp(this.weaponHolder.position.y, 0.08, ease);
  }

  dispose() {
    this.mixer.stopAllAction();
    this.root.removeFromParent();
  }
}

export function wrapAngle(a: number) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function lerpAngle(a: number, b: number, t: number) {
  return a + wrapAngle(b - a) * t;
}
