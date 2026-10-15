import * as THREE from "three/webgpu";
import type { Combatant, SlotIndex } from "./Combatant";
import { MEDKIT_HEAL_TIME } from "./config";
import { adsFov, isMagnified } from "./Weapons";
import type { Input } from "./Input";
import { clamp, lerp } from "./noise";
import { LAYER, type Physics } from "./Physics";

const HIP_FOV = 72;

/**
 * Turns input into movement for the player's combatant and runs the camera:
 * third-person over the right shoulder, first-person down the sights when aiming.
 */
export class PlayerController {
  yaw = 0;
  pitch = 0;
  sensitivity = 0.0022;
  touchScale = 2.2;
  adsBlend = 0;
  /** Extra camera kick that recovers on its own. */
  private kick = 0;
  private pivotY = 1.6;
  private stepTimer = 0;
  private camDist = 2.8;
  private vel = new THREE.Vector3();
  private bobPhase = 0;
  private sprintFov = 0;
  spread = 0; // degrees, current
  private bloom = 0;
  readonly camera: THREE.PerspectiveCamera;

  constructor(
    readonly me: Combatant,
    private input: Input,
    private physics: Physics,
    camera: THREE.PerspectiveCamera,
    private sounds: { footstep: (g?: number) => void },
  ) {
    this.camera = camera;
    this.yaw = me.aimYaw;
  }

  get scoped() {
    return this.me.aiming && isMagnified(this.me.gun) && this.adsBlend > 0.85;
  }

  /** Handles look + movement. Returns true if the trigger should be pulled this frame. */
  update(dt: number): { fire: boolean; actions: ReturnType<Input["actions"]> } {
    const me = this.me;
    const { dx, dy, firePressed } = this.input.consumeMouse();
    const actions = this.input.actions();
    if (!me.alive) return { fire: false, actions: [] };

    const fovScale = this.camera.fov / HIP_FOV;
    // Finger drags cover fewer pixels than mouse moves, so they turn faster.
    const sens = this.sensitivity * (this.input.touch ? this.touchScale : 1);
    this.yaw -= dx * sens * fovScale;
    this.pitch = clamp(this.pitch - dy * sens * fovScale, -1.35, 1.25);
    this.kick = lerp(this.kick, 0, 1 - Math.exp(-dt * 9));

    for (const a of actions) {
      if (a === "crouch") me.setStance(me.stance === "crouch" ? "stand" : "crouch");
      if (a === "prone") me.setStance(me.stance === "prone" ? "stand" : "prone");
      if (a === "jump" && me.stance !== "stand") me.setStance("stand");
      if (a === "switch") me.cycleWeapon();
      if (a === "slot1" || a === "slot2" || a === "slot3") me.equip((Number(a.slice(-1)) - 1) as SlotIndex);
      if (a === "reload") me.startReload();
      if (a === "heal") me.startHeal();
    }

    // Movement relative to the camera yaw.
    const k = this.input;
    const { f, r } = k.moveAxis();
    const fwd = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const wish = fwd.multiplyScalar(f).addScaledVector(right, r);
    // Keys are all-or-nothing; a half-pushed joystick walks.
    const push = Math.min(1, wish.length());
    const moving = push > 0.05;
    if (moving) wish.normalize().multiplyScalar(Math.max(push, 0.35));

    me.aiming = this.input.aim && me.healLeft <= 0 && !!me.gun;
    me.sprinting = k.sprintHeld && f > 0.3 && !me.aiming && me.stance !== "prone" && !me.busy;
    if (me.sprinting && me.stance === "crouch") me.setStance("stand");
    let speed = 4.6;
    if (me.sprinting) speed = 6.3;
    if (me.stance === "crouch") speed = 2.3;
    if (me.stance === "prone") speed = 0.9;
    if (me.aiming) speed = Math.min(speed, me.stance === "stand" ? 2.6 : speed);
    if (me.healLeft > 0) speed = Math.min(speed, 1.5);
    if (f < 0) speed *= 0.8;
    const jump = actions.includes("jump") && me.stance === "stand";
    // Quick but not instant starts and stops; less control in the air.
    const accel = !me.grounded ? 6 : moving ? 22 : 28;
    const blend = 1 - Math.exp(-dt * accel * 0.35);
    this.vel.x += (wish.x * speed - this.vel.x) * blend;
    this.vel.z += (wish.z * speed - this.vel.z) * blend;
    me.move(dt, this.vel.x, this.vel.z, jump);
    me.aimYaw = this.yaw;
    me.aimPitch = this.pitch + this.kick;

    // Footsteps.
    const hs = Math.hypot(me.velocity.x, me.velocity.z);
    if (me.grounded && hs > 1) {
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.stepTimer = me.sprinting ? 0.3 : me.stance === "crouch" ? 0.55 : 0.4;
        this.sounds.footstep(me.stance === "crouch" ? 0.03 : 0.07);
      }
    }

    // Spread (degrees) used both for shooting and the HUD crosshair.
    const gun = me.gun?.stats;
    const base = gun ? lerp(gun.hipSpread, gun.adsSpread, this.adsBlend) : 2;
    let s = base * (1 + Math.min(hs / 4, 1.2) * (me.aiming ? 0.6 : 1));
    if (!me.grounded) s *= 2.5;
    if (me.stance === "crouch") s *= 0.8;
    if (me.stance === "prone") s *= 0.6;
    this.bloom = Math.max(0, this.bloom - dt * 6);
    this.spread = s + this.bloom;

    const wantFire = !!gun && (gun.auto ? this.input.fire : firePressed);
    return { fire: wantFire && !me.sprinting, actions };
  }

  /** Called after a shot: camera recoil and spread bloom. */
  onShot() {
    const g = this.me.gun?.stats;
    if (!g) return;
    const ads = this.me.aiming ? 0.65 : 1;
    const stance = this.me.stance === "prone" ? 0.55 : this.me.stance === "crouch" ? 0.8 : 1;
    this.pitch += g.recoilPitch * ads * stance;
    this.yaw += (Math.random() - 0.5) * 2 * g.recoilYaw * ads;
    this.kick += g.recoilPitch * 0.8;
    this.bloom = Math.min(this.bloom + (g.auto ? 0.35 : 0.8), 4);
    this.me.recoil = 1;
  }

  /** Taking a hit jolts the view. */
  onHurt() {
    this.kick += 0.02 + Math.random() * 0.015;
    this.yaw += (Math.random() - 0.5) * 0.03;
  }

  /** Camera placement. Call after the character visual has been updated this frame. */
  updateCamera(dt: number) {
    const me = this.me;
    const cam = this.camera;
    const target = me.aiming && me.alive ? 1 : 0;
    this.adsBlend = lerp(this.adsBlend, target, 1 - Math.exp(-dt * 14));
    this.pivotY = lerp(this.pivotY, me.eyeHeight, 1 - Math.exp(-dt * 10));

    const pitch = this.pitch + this.kick;
    const dir = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(this.yaw) * Math.cos(pitch));
    const right = new THREE.Vector3(-Math.cos(this.yaw), 0, Math.sin(this.yaw));

    // Third-person: over the right shoulder, pulled in if a wall is in the way.
    // Subtle head bob while moving on foot (none when aiming).
    const hs = Math.hypot(me.velocity.x, me.velocity.z);
    if (me.grounded && hs > 0.5) this.bobPhase += dt * hs * 1.9;
    const bobAmp = me.aiming ? 0 : Math.min(hs / 6.3, 1) * (me.sprinting ? 0.045 : 0.025);
    const bob = Math.sin(this.bobPhase * 2) * bobAmp;
    this.sprintFov = lerp(this.sprintFov, me.sprinting ? 7 : 0, 1 - Math.exp(-dt * 5));
    const pivot = new THREE.Vector3(me.position.x, me.position.y + this.pivotY + 0.12 + bob, me.position.z);
    const shoulder = pivot.clone().addScaledVector(right, 0.55);
    const wantDist = me.alive ? 2.8 : 5;
    const back = dir.clone().negate();
    const hit = this.physics.castRay(shoulder, back, wantDist + 0.3, LAYER.WORLD);
    const dist = hit ? Math.max(0.4, hit.distance - 0.3) : wantDist;
    this.camDist = dist < this.camDist ? dist : lerp(this.camDist, dist, 1 - Math.exp(-dt * 6));
    const tpp = shoulder.clone().addScaledVector(back, this.camDist);

    // First-person down the sights.
    let fpp = tpp;
    const w = me.visual.weaponModel;
    if (w) {
      const sightBack = isMagnified(me.gun) ? 0.12 : w.id === "kar98k" ? 0.18 : 0.22;
      fpp = w.object.localToWorld(w.sight.clone()).addScaledVector(dir, -sightBack);
    }
    const a = this.adsBlend;
    cam.position.lerpVectors(tpp, fpp, a > 0.97 ? 1 : a * a * (3 - 2 * a));
    cam.lookAt(cam.position.clone().add(dir));

    const fov = lerp(HIP_FOV + this.sprintFov, me.gun ? adsFov(me.gun) : 55, a);
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
    cam.near = a > 0.5 ? 0.03 : 0.1;
    cam.updateProjectionMatrix();

    // Hide our own body when the camera is inside it; hide the rifle behind the scope.
    me.visual.setVisible(a < 0.6);
    if (w) w.object.visible = !(isMagnified(me.gun) && a > 0.85);
  }

  /** World-space shot ray from the crosshair. */
  aimRay() {
    const pitch = this.pitch + this.kick;
    const origin = this.camera.position.clone();
    const dir = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(this.yaw) * Math.cos(pitch));
    return { origin, dir };
  }

  healProgress() {
    return this.me.healLeft > 0 ? 1 - this.me.healLeft / MEDKIT_HEAL_TIME : 0;
  }
}
