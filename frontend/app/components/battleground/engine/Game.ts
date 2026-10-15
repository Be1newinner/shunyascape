import * as THREE from "three/webgpu";
import { SkyMesh } from "three/examples/jsm/objects/SkyMesh.js";
import { Assets, type ModelKey } from "./Assets";
import { GameAudio } from "./Audio";
import { BotBrain, type BotWorld } from "./Bots";
import { Buildings } from "./Buildings";
import { Combatant, type SlotIndex } from "./Combatant";
import {
  ARMOR, BOT_COUNT, BOT_NAMES, GRENADE, MAX_HIT_DAMAGE, armorHit, blastDamage, rangeFalloff, MAP_HALF, MAP_SIZE, PLAYER_MAX_HEALTH, QUALITY, SCOPES, WEAPONS,
  type AmmoType, type GearLevel, type Quality, type ScopeId, type WeaponId,
} from "./config";
import { Airdrops, airdropItems } from "./Airdrops";
import { DropController, planeMesh, spinProps } from "./Drop";
import { gearName } from "./Gear";
import { Grenades } from "./Grenades";
import { Effects } from "./Effects";
import { Input } from "./Input";
import { Loot, lootLabel, type LootEntity } from "./Loot";
import { MapLayout } from "./MapGen";
import { mulberry32, pick, range } from "./noise";
import { LAYER, Physics } from "./Physics";
import { PlayerController } from "./Player";
import { Terrain } from "./Terrain";
import { Vegetation } from "./Vegetation";
import { WeaponFactory } from "./Weapons";
import { Zone } from "./Zone";
import { decodeState, encodeState, type MatchClient, type MatchEnd, type MatchStart, type ServerMessage } from "./MatchClient";
import { outfitTint } from "./outfits";
import type { LootItem } from "./Loot";

export type GamePhase = "loading" | "ready" | "playing" | "paused" | "dead" | "won";

export interface KillEvent {
  id: number;
  killer: string;
  victim: string;
  weapon: string;
  headshot: boolean;
  byPlayer: boolean;
  time: number;
}

export interface HudState {
  phase: GamePhase;
  health: number;
  maxHealth: number;
  alive: number;
  kills: number;
  slots: Array<{ slot: number; name: string; mag: number; magSize: number; reserve: number; ammo: AmmoType; active: boolean; scope: string | null; range: number } | null>;
  /** What the held gun aims through: iron sights, a red dot or a magnified scope. */
  sight: "iron" | "reddot" | "magnified";
  zoom: string | null;
  pickup: { text: string; time: number } | null;
  spareScopes: string[];
  medkits: number;
  reserve: Record<AmmoType, number>;
  prompt: string | null;
  aiming: boolean;
  scoped: boolean;
  reload: number;
  heal: number;
  switching: boolean;
  spreadPx: number;
  hitMarker: { time: number; kind: "hit" | "head" | "kill" } | null;
  damageDirs: Array<{ angle: number; time: number }>;
  killFeed: KillEvent[];
  zone: Zone["status"] & { inside: boolean; distance: number };
  heading: number;
  player: { x: number; z: number };
  stance: string;
  sprinting: boolean;
  backend: string;
  fps: number;
  now: number;
  placement: number;
  damageDealt: number;
  survived: number;
  /** Seconds until the match's time limit (online only). */
  timeLeft: number | null;
  /** Alive when the time limit ended the match. */
  survivor: boolean;
  /** How the match ended and its top killers, once it's decided. */
  matchEnd: MatchEnd | null;
  /** Our id in an online match. */
  you: string | null;
  peaceful: number;
  online: boolean;
  total: number;
  resolution: number;
  touch: boolean;
  /** Worn armour: level and how much is left (0..1). */
  armor: { vest: number; vestPct: number; helmet: number; helmetPct: number };
  grenades: number;
  /** Floating damage numbers over whoever we hit, in screen percent. */
  damageNumbers: Array<{ id: number; x: number; y: number; text: string; kind: FloaterKind; age: number }>;
  /** Big centre-screen callout: kill streaks, headshots, airdrops. */
  callout: { id: number; text: string; sub: string; age: number } | null;
  /** Dropping in at the start of the match. */
  drop: { stage: "plane" | "fall" | "chute"; altitude: number; canJump: boolean; timeLeft: number; path: { ax: number; az: number; bx: number; bz: number } } | null;
  airdrops: Array<{ id: string; x: number; z: number; landed: boolean; screen: ScreenPoint | null; distance: number }>;
  /** Who killed us, shown for a few seconds after death. */
  killcam: { killer: string; weapon: string; distance: number; headshot: boolean; killerHp: number; bot: boolean } | null;
  spectating: { name: string; hp: number; kills: number; bot: boolean; mate: boolean } | null;
  /** Squad mates (online squads only). */
  squad: Array<{ id: string; name: string; hp: number; alive: boolean; screen: ScreenPoint | null; distance: number; x: number; z: number }>;
  /** We're out but the squad is still fighting: the final placement comes later. */
  awaitingSquad: boolean;
  /** Bot difficulty for this match (shown on the start card). */
  difficulty: string | null;
  /** Teams in the match (soldiers, when everyone plays alone). */
  teams: number;
  /** Where we were shot from lately: red dots on the minimap and on screen. `age` 0..1 of their lifetime. */
  threats: Array<{ id: string; x: number; z: number; age: number; screen: ScreenPoint | null; distance: number }>;
}

export type FloaterKind = "hit" | "head" | "kill" | "armor";
export interface ScreenPoint {
  x: number;
  y: number;
}

/** How long the red "shot from here" dot stays up. */
export const THREAT_SECONDS = 6;

/** Seconds the camera stays on whoever killed us before the results. */
export const KILLCAM_SECONDS = 4;

export function difficultyLabel(d: number) {
  return d < 0.2 ? "Rookie" : d < 0.45 ? "Regular" : d < 0.7 ? "Veteran" : "Elite";
}

/** The battleground: owns the renderer, world, combatants and the frame loop. */
export class Game {
  private renderer!: THREE.WebGPURenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(72, 1, 0.1, 2400);
  private sun = new THREE.DirectionalLight("#fff1d6", 3.4);
  private sky!: SkyMesh;
  private physics = new Physics();
  private assets: Assets;
  private map = new MapLayout();
  private terrain!: Terrain;
  private vegetation!: Vegetation;
  private weapons!: WeaponFactory;
  private loot!: Loot;
  private zone = new Zone();
  private effects!: Effects;
  readonly audio = new GameAudio();
  private input!: Input;
  private player!: PlayerController;
  private me!: Combatant;
  private bots: BotBrain[] = [];
  private combatants: Combatant[] = [];
  private byCollider = new Map<number, Combatant>();
  private quality = QUALITY.medium;
  private phase: GamePhase = "loading";
  private now = 0;
  private startTime = 0;
  private deathTime = 0;
  private killFeed: KillEvent[] = [];
  private killId = 0;
  private hitMarker: HudState["hitMarker"] = null;
  private damageDirs: HudState["damageDirs"] = [];
  private lastPickup: { text: string; time: number } | null = null;
  private zoneTick = 0;
  private fps = 60;
  private disposed = false;
  private resizeObserver?: ResizeObserver;
  private sunDir = new THREE.Vector3(0.45, 0.62, 0.32).normalize();
  minimap = "";
  backend = "";
  /** Dev only: pin the camera to inspect the scene (`__bg.debugCam = { pos, target }`). */
  debugCam: { pos: [number, number, number]; target: [number, number, number] } | null = null;

  constructor(
    private container: HTMLElement,
    private onPhase: (p: GamePhase) => void,
    onProgress: (fraction: number, label: string) => void,
  ) {
    this.assets = new Assets(onProgress);
  }

  private playerName = "You";
  private playerTint: string | undefined;
  private grenades!: Grenades;
  private airdrops!: Airdrops;
  /** The plane ride and parachute at the start; null once we're down (or never, e.g. tests). */
  private drop: DropController | null = null;
  private planeObj: THREE.Object3D | null = null;
  /** When we touched the ground (game time); Infinity while still in the air. */
  private landTime = Infinity;
  private throwCooldown = 0;
  private floaters: Array<{ id: number; pos: THREE.Vector3; text: string; kind: FloaterKind; time: number }> = [];
  private floaterId = 0;
  private callout: { id: number; text: string; sub: string; time: number } | null = null;
  private calloutId = 0;
  private streak = { count: 0, last: -100 };
  private anyKill = false;
  private death: { killer: Combatant | null; weapon: string; distance: number; headshot: boolean; time: number } | null = null;
  private spectating: Combatant | null = null;
  private offlineDrops = 0;
  /** Where we were last shot at from (shown as red dots). */
  private threats: Array<{ id: string; pos: THREE.Vector3; time: number }> = [];
  /** Bot difficulty 0 (rookie) .. 1 (elite), from the players' levels. */
  private difficulty = 0.35;
  /** Online match state; null in offline practice. */
  private net: {
    client: MatchClient;
    start: MatchStart;
    byId: Map<string, Combatant>;
    sendAcc: number;
    alive: number;
    peaceEndsAt: number;
    /** End of our spawn protection (set when we start playing; cleared when we fire). */
    graceEndsAt: number;
    pendingPicks: Set<string>;
    unsubscribe: () => void;
    result: { placement: number; kills: number; damage: number; survived: number; survivor?: boolean } | null;
    /** Server's match clock (seconds) and when we last heard it. */
    elapsed: number;
    elapsedAt: number;
    end: MatchEnd | null;
  } | null = null;

  /** Rendering resolution right now (lowered automatically when frames run slow). */
  private pixelRatio = 1;
  private frameTimes: number[] = [];
  private touch = false;

  async init(
    quality: Quality,
    player: { name?: string; tint?: string; touch?: boolean; level?: number } = {},
    online?: { client: MatchClient; start: MatchStart },
  ) {
    this.touch = !!player.touch;
    this.quality = QUALITY[quality];
    // Practice bots get tougher as you level up; online the server picks it for the whole lobby.
    this.difficulty = online?.start.difficulty ?? Math.max(0, Math.min(1, ((player.level ?? 1) - 1) / 25));
    if (player.name) this.playerName = player.name;
    this.playerTint = player.tint;
    if (online) {
      this.net = {
        client: online.client,
        start: online.start,
        byId: new Map(),
        sendAcc: 0,
        alive: online.start.roster.length,
        peaceEndsAt: performance.now() / 1000 + online.start.peace,
        graceEndsAt: 0,
        pendingPicks: new Set(),
        unsubscribe: () => {},
        result: null,
        elapsed: 0,
        elapsedAt: performance.now() / 1000,
        end: null,
      };
    }
    const q = this.quality;
    // `?renderer=webgl` forces the WebGL 2 backend (WebGPU is used when available).
    const forceWebGL = new URLSearchParams(window.location.search).get("renderer") === "webgl";
    this.renderer = new THREE.WebGPURenderer({ antialias: q.antialias, powerPreference: "high-performance", forceWebGL });
    await this.renderer.init();
    this.backend = (this.renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? "WebGPU" : "WebGL 2";
    this.pixelRatio = q.pixelRatio;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.8;
    this.renderer.shadowMap.enabled = q.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = "block";
    this.resize();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);

    await Promise.all([this.physics.init(), this.assets.loadAll()]);
    if (this.disposed) return;
    const aniso = Math.min(8, this.renderer.getMaxAnisotropy?.() ?? 4);

    this.setupSky();
    this.terrain = new Terrain(this.map);
    const ground = await this.terrain.createMesh(this.assets.textures, aniso);
    this.scene.add(ground);
    const g = ground.geometry;
    this.physics.addTrimesh(g.attributes.position.array as Float32Array, g.index!.array as Uint32Array);

    const buildings = new Buildings(this.map, this.terrain, this.physics);
    this.scene.add(await buildings.build(this.assets.textures, aniso));

    this.vegetation = new Vegetation(this.assets, this.map, this.terrain, this.physics, q);
    this.scene.add(this.vegetation.build());

    this.weapons = new WeaponFactory(this.assets);
    this.loot = new Loot(this.assets, this.weapons);
    const propLoot = this.placeProps();
    this.loot.scatter(buildings.lootSpots, propLoot);
    this.scene.add(this.loot.group);

    this.effects = new Effects();
    this.effects.camera = this.camera.position;
    this.scene.add(this.effects.group);
    this.scene.add(this.zone.mesh);
    this.grenades = new Grenades(this.assets, this.physics);
    this.scene.add(this.grenades.group);
    this.airdrops = new Airdrops(this.assets, this.effects, (x, z) => this.terrain.heightAt(x, z));
    this.scene.add(this.airdrops.group);
    this.drop = new DropController(this.net ? this.net.start.seed : Date.now() & 0xffffff, this.physics, (x, z) => this.terrain.heightAt(x, z));
    this.planeObj = planeMesh();
    this.planeObj.visible = false;
    this.scene.add(this.planeObj);

    if (this.net) this.spawnOnline();
    else this.spawnCombatants();
    if (this.net) this.net.unsubscribe = this.net.client.on(this.onServer);
    this.input = new Input(this.renderer.domElement);
    this.input.touch = this.touch;
    this.input.onLockChange = (locked) => {
      if (this.phase === "playing" && !locked) this.setPhase("paused");
      else if (this.phase === "paused" && locked) this.setPhase("playing");
    };
    this.player = new PlayerController(this.me, this.input, this.physics, this.camera, this.audio);
    this.minimap = this.drawMinimap();

    // Warm up shaders so the first frames don't hitch.
    this.player.updateCamera(0.016);
    this.vegetation.update(1, this.me.position);
    await this.renderer.compileAsync(this.scene, this.camera);
    this.setPhase("ready");
    this.renderer.setAnimationLoop(this.frame);
  }

  private setPhase(p: GamePhase) {
    this.phase = p;
    this.onPhase(p);
  }

  /** Start / resume from a click (needs a user gesture for pointer lock + audio). */
  play() {
    this.audio.resume();
    if (this.touch) {
      // No pointer lock on touch screens: go fullscreen, landscape, and play.
      const el = document.documentElement;
      if (!document.fullscreenElement) el.requestFullscreen?.({ navigationUI: "hide" }).catch(() => {});
      const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
      orientation?.lock?.("landscape").catch(() => {});
    } else {
      this.input.requestLock();
    }
    if (this.phase === "ready") {
      this.startTime = this.now;
      // Board the plane: it starts its run across the map now.
      if (this.drop) {
        this.drop.t = 0;
        this.drop.planePos(this.drop.position);
        this.me.teleport(this.drop.position);
        // Face along the flight path, looking slightly down at the island.
        this.player.yaw = this.drop.planeYaw;
        this.player.pitch = -0.25;
        this.audio.setDrone(1);
      }
      this.setPhase("playing");
    } else if (this.phase === "paused" && this.touch) {
      this.setPhase("playing");
    }
  }

  /** Pause button on touch screens (with a mouse, Esc releases the pointer instead). */
  pause() {
    if (this.phase === "playing") {
      this.input.setFire(false);
      this.input.setStick(0, 0, false);
      this.setPhase("paused");
    }
  }

  /** The on-screen controls feed this. */
  get controls() {
    return this.input;
  }

  setSensitivity(v: number) {
    if (this.player) this.player.sensitivity = v;
  }

  private resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h || !this.renderer) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private setupSky() {
    const sky = new SkyMesh();
    sky.scale.setScalar(2000);
    sky.turbidity.value = 4;
    sky.rayleigh.value = 1.6;
    sky.mieCoefficient.value = 0.004;
    sky.mieDirectionalG.value = 0.85;
    // The built-in clouds band badly on some GPUs; the analytic sky alone reads cleaner.
    sky.cloudCoverage.value = 0;
    // The disc's raw intensity overflows after tone mapping (renders as a black dot).
    sky.showSunDisc.value = 0;
    sky.sunPosition.value.copy(this.sunDir);
    (sky.material as THREE.Material & { fog: boolean }).fog = false;
    this.sky = sky;
    this.scene.add(sky);

    const q = this.quality;
    this.scene.fog = new THREE.Fog("#a9bccf", 90, q.fogFar);
    this.sun.castShadow = q.shadows;
    this.sun.shadow.mapSize.set(q.shadowMapSize, q.shadowMapSize);
    const ext = q.shadowMapSize >= 4096 ? 70 : 50;
    const sc = this.sun.shadow.camera;
    sc.left = -ext;
    sc.right = ext;
    sc.top = ext;
    sc.bottom = -ext;
    sc.near = 1;
    sc.far = 400;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.sun, this.sun.target);
    this.scene.add(new THREE.HemisphereLight("#cfe3ff", "#4a4430", 0.35));

    // Image-based lighting from the same sky for metals and soft fill.
    try {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      const envScene = new THREE.Scene();
      const envSky = new SkyMesh();
      envSky.scale.setScalar(100);
      envSky.turbidity.value = 4;
      envSky.rayleigh.value = 1.6;
      envSky.cloudCoverage.value = 0;
      // The sun disc is thousands of times brighter than the sky and blows up the prefilter.
      envSky.showSunDisc.value = 0;
      envSky.sunPosition.value.copy(this.sunDir);
      envScene.add(envSky);
      this.scene.environment = pmrem.fromScene(envScene).texture;
      this.scene.environmentIntensity = 0.3;
    } catch (e) {
      console.warn("[battleground] environment map unavailable", e);
    }
  }

  /** Cover props as instanced meshes with box colliders. Returns spots for extra loot. */
  private placeProps() {
    const rng = mulberry32(31337);
    const placements = new Map<ModelKey, Array<{ x: number; z: number; yaw: number; size: number; y?: number }>>();
    const add = (key: ModelKey, x: number, z: number, yaw: number, size: number) => {
      if (!placements.has(key)) placements.set(key, []);
      placements.get(key)!.push({ x, z, yaw, size });
    };
    const lootSpots: Array<{ x: number; y: number; z: number }> = [];

    // Around houses: crates, barrels, jerry cans, gas bottles.
    for (const lot of this.map.lots) {
      const n = 1 + Math.floor(rng() * 3);
      for (let i = 0; i < n; i++) {
        const side = Math.floor(rng() * 4);
        const along = (rng() - 0.5) * 0.8;
        const lx = side < 2 ? along * lot.width : (side === 2 ? -1 : 1) * (lot.width / 2 + 1.4);
        const lz = side >= 2 ? along * lot.depth : (side === 0 ? -1 : 1) * (lot.depth / 2 + 1.4);
        const c = Math.cos(lot.rotation);
        const s = Math.sin(lot.rotation);
        const x = lot.x + lx * c + lz * s;
        const z = lot.z - lx * s + lz * c;
        if (this.map.roadInfluence(x, z) > 0.2) continue;
        const kind = pick(rng, ["crateWood", "crateWood", "crateOld", "barrel1", "barrel2", "jerrycan", "propane"] as const);
        const size = { crateWood: 1.25, crateOld: 1.8, barrel1: 0.95, barrel2: 0.95, jerrycan: 0.5, propane: 0.6 }[kind];
        add(kind, x, z, rng() * Math.PI * 2, size);
        if (kind.startsWith("crate") && rng() < 0.5) lootSpots.push({ x: x + 1.2 * Math.cos(rng() * 6), y: this.terrain.heightAt(x, z), z: z + 1.0 });
      }
    }
    // Abandoned cars and barriers along roads near towns.
    for (const r of this.map.roads) {
      if (rng() > 0.18) continue;
      const t = rng();
      const x = r.ax + (r.bx - r.ax) * t;
      const z = r.az + (r.bz - r.az) * t;
      if (this.map.insideLot(x, z, 3)) continue;
      const yaw = Math.atan2(r.bx - r.ax, r.bz - r.az);
      if (rng() < 0.55) add("car", x + range(rng, -1.5, 1.5), z + range(rng, -1.5, 1.5), yaw + range(rng, -0.4, 0.4), 4.4);
      else add("barrier", x, z, yaw + Math.PI / 2 + range(rng, -0.2, 0.2), 1.6);
    }
    // Open fields: rocks, boulders, logs, tyres.
    const field = (key: ModelKey, count: number, min: number, max: number) => {
      for (let i = 0; i < count; i++) {
        const [x, z] = this.map.randomOpenPoint(rng, 0, 0, MAP_HALF - 50);
        if (this.map.roadInfluence(x, z) > 0.05 || this.map.insideLot(x, z, 4)) continue;
        if (this.map.sites.some((s) => Math.hypot(s.x - x, s.z - z) < s.radius * 0.7)) continue;
        add(key, x, z, rng() * Math.PI * 2, range(rng, min, max));
      }
    };
    field("boulder", 110, 2, 4.5);
    field("rocks", 25, 6, 9);
    field("log", 40, 3.5, 5.5);
    field("tyre", 25, 0.75, 0.9);
    field("crateOld", 20, 1.8, 1.8);

    // One instanced mesh per prop part, plus a box collider per placement.
    for (const [key, list] of placements) {
      const template = this.assets.instance(key, 1);
      template.updateMatrixWorld(true);
      const parts: Array<{ mesh: THREE.Mesh; rel: THREE.Matrix4 }> = [];
      template.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) parts.push({ mesh: m, rel: m.matrixWorld.clone() });
      });
      const bounds = new THREE.Box3().setFromObject(template);
      const instanced = parts.map((p) => {
        const im = new THREE.InstancedMesh(p.mesh.geometry, p.mesh.material, list.length);
        im.castShadow = true;
        im.receiveShadow = true;
        this.scene.add(im);
        return im;
      });
      const mat = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      list.forEach((pl, i) => {
        const yGround = Math.min(
          this.terrain.heightAt(pl.x, pl.z),
          this.terrain.heightAt(pl.x + 0.6, pl.z),
          this.terrain.heightAt(pl.x, pl.z + 0.6),
        );
        const sink = key.startsWith("boulder") || key === "rocks" ? pl.size * 0.12 : 0.02;
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), pl.yaw);
        const placement = new THREE.Matrix4().compose(new THREE.Vector3(pl.x, yGround - sink, pl.z), q, new THREE.Vector3(pl.size, pl.size, pl.size));
        parts.forEach((p, k) => instanced[k].setMatrixAt(i, mat.multiplyMatrices(placement, p.rel)));
        const size = bounds.getSize(new THREE.Vector3()).multiplyScalar(pl.size);
        const center = bounds.getCenter(new THREE.Vector3()).multiplyScalar(pl.size).applyQuaternion(q);
        const shrink = key.startsWith("boulder") || key === "rocks" ? 0.8 : 0.95;
        this.physics.addBox(pl.x + center.x, yGround - sink + center.y, pl.z + center.z, (size.x / 2) * shrink, size.y / 2, (size.z / 2) * shrink, pl.yaw);
      });
      instanced.forEach((im) => {
        im.instanceMatrix.needsUpdate = true;
        im.computeBoundingSphere();
      });
    }
    return lootSpots;
  }

  private spawnCombatants() {
    const rng = mulberry32((Date.now() & 0xffffff) ^ 0x9e37);
    const soldier = this.assets.get("soldier");
    // Player drops into a random town with a pistol.
    const site = this.map.sites[1 + Math.floor(rng() * (this.map.sites.length - 1))];
    const [px, pz] = this.map.randomOpenPoint(rng, site.x, site.z, site.radius + 12);
    const spawn = new THREE.Vector3(px, this.terrain.heightAt(px, pz) + 0.05, pz);
    this.me = new Combatant("me", this.playerName, true, this.physics, this.weapons, soldier, spawn, this.playerTint);
    this.me.aimYaw = Math.atan2(site.x - px, site.z - pz);
    this.me.give("p92");
    this.me.reserve["9mm"] = 30;
    this.me.medkits = 1;
    this.addCombatant(this.me);

    const tints = ["#ffffff", "#d9d2b8", "#b9c7a8", "#c7c2cf", "#a9b4c2", "#e0c9a6"];
    const names = [...BOT_NAMES].sort(() => rng() - 0.5);
    for (let i = 0; i < BOT_COUNT; i++) {
      let x = 0;
      let z = 0;
      for (let tries = 0; tries < 30; tries++) {
        [x, z] = this.map.randomOpenPoint(rng, 0, 0, MAP_HALF - 70);
        if (Math.hypot(x - px, z - pz) > 70) break;
      }
      const pos = new THREE.Vector3(x, this.terrain.heightAt(x, z) + 0.05, z);
      const bot = new Combatant(`bot:${i}`, names[i % names.length], false, this.physics, this.weapons, soldier, pos, pick(rng, tints));
      bot.markBot();
      const weapon = pick(rng, ["m416", "m416", "m416", "kar98k", "p92"] as WeaponId[]);
      if (weapon !== "p92") bot.give("p92");
      bot.give(weapon, undefined, weapon === "kar98k" ? "4x" : weapon === "m416" && rng() < 0.5 ? pick(rng, ["reddot", "2x"] as ScopeId[]) : null);
      bot.aimYaw = rng() * Math.PI * 2;
      // Tougher lobbies: more bots wear armour.
      if (rng() < 0.15 + this.difficulty * 0.55) bot.wear("vest", (rng() < this.difficulty * 0.6 ? 2 : 1) as GearLevel);
      if (rng() < 0.1 + this.difficulty * 0.5) bot.wear("helmet", (rng() < this.difficulty * 0.5 ? 2 : 1) as GearLevel);
      this.addCombatant(bot);
      this.bots.push(new BotBrain(bot, i * 7919 + 13, this.difficulty));
    }
  }

  /** Online match: everyone from the server roster, at spawn points every client agrees on. */
  private spawnOnline() {
    const net = this.net!;
    const { roster, seed, you } = net.start;
    const soldier = this.assets.get("soldier");
    const points = this.map.spawnPoints(seed, roster.length);
    // Bot loadouts come from the seed so every client builds the same soldiers.
    const rng = mulberry32(seed ^ 0xb075);
    const tints = ["#ffffff", "#d9d2b8", "#b9c7a8", "#c7c2cf", "#a9b4c2", "#e0c9a6"];
    roster.forEach((r, i) => {
      const [x, z] = points[i];
      const pos = new THREE.Vector3(x, this.terrain.heightAt(x, z) + 0.05, z);
      const isMe = r.id === you;
      const tint = r.bot ? pick(rng, tints) : isMe ? this.playerTint : outfitTint(r.outfit);
      const c = new Combatant(r.id, isMe ? this.playerName : r.name, isMe, this.physics, this.weapons, soldier, pos, tint);
      if (r.bot) {
        c.markBot();
        const weapon = pick(rng, ["m416", "m416", "m416", "kar98k", "p92"] as WeaponId[]);
        const scope = weapon === "kar98k" ? "4x" : weapon === "m416" && rng() < 0.5 ? pick(rng, ["reddot", "2x"] as ScopeId[]) : null;
        if (weapon !== "p92") c.give("p92");
        c.give(weapon, undefined, scope);
      }
      c.aimYaw = rng() * Math.PI * 2;
      if (isMe) {
        c.give("p92");
        c.reserve["9mm"] = 30;
        c.medkits = 1;
        this.me = c;
      }
      // Squads: same team = can't hurt each other. Solo players are their own team.
      c.team = r.team ?? r.id;
      // Everyone else, bots included, is simulated by the game server.
      c.remote = !isMe;
      this.addCombatant(c);
      net.byId.set(r.id, c);
    });
  }

  private onServer = (msg: ServerMessage) => {
    const net = this.net;
    if (!net || this.disposed) return;
    const t = performance.now() / 1000;
    switch (msg.t) {
      case "snap":
        net.alive = msg.alive;
        for (const row of msg.s) {
          const c = net.byId.get(row[0] as string);
          if (!c || !c.remote) continue;
          const st = decodeState(row.slice(1));
          if (st) c.pushNetState(st, t);
        }
        break;
      case "zone":
        this.zone.sync(msg);
        if (typeof msg.elapsed === "number") {
          net.elapsed = msg.elapsed;
          net.elapsedAt = performance.now() / 1000;
        }
        break;
      case "fx": {
        const shooter = net.byId.get(msg.by);
        if (shooter && shooter.remote) this.remoteShot(shooter, msg.w, msg.o, msg.e, !!msg.h);
        break;
      }
      case "hp": {
        const c = net.byId.get(msg.id);
        if (!c) break;
        const before = c.health;
        c.health = msg.hp;
        const by = msg.by ? net.byId.get(msg.by) : null;
        if (by) {
          c.lastDamageFrom = by;
          c.lastDamageTime = this.now;
          if (msg.by !== net.start.you && c !== this.me) c.visual.hit();
        }
        if (c === this.me && msg.ar) {
          // The server keeps our armour's durability; it breaks when it runs out.
          const [v, vd, h, hd] = msg.ar;
          this.me.gear = { vest: v as GearLevel, vestDur: vd, helmet: h as GearLevel, helmetDur: hd };
          this.me.visual.setGear(this.me.gear.vest, this.me.gear.helmet);
        }
        if (c === this.me && msg.hp < before) {
          if (by) {
            const rel = by.position.clone().sub(c.position);
            this.damageDirs.push({ angle: Math.atan2(rel.x, rel.z), time: this.now });
            this.markThreat(by);
          }
          this.audio.hurt();
          this.player.onHurt();
          this.me.visual.hit();
          this.buzz(40);
        }
        // Our damage, as the server counted it, floats over the target.
        if (msg.by === net.start.you && c !== this.me && msg.hp < before) {
          this.pushFloater(c.visual.headWorld().add(new THREE.Vector3(0, 0.35, 0)), before - msg.hp, msg.hp <= 0 ? "kill" : msg.head ? "head" : "hit");
        }
        break;
      }
      case "nade": {
        if (msg.by === net.start.you) break;
        this.grenades.throw(msg.by, new THREE.Vector3(msg.o[0], msg.o[1], msg.o[2]), new THREE.Vector3(msg.v[0], msg.v[1], msg.v[2]), false);
        break;
      }
      case "boom": {
        if (msg.by === net.start.you) break;
        const g = this.grenades.latestOf(msg.by);
        if (g) this.grenades.remove(g.id);
        this.burst(new THREE.Vector3(msg.pos[0], msg.pos[1], msg.pos[2]), false);
        break;
      }
      case "airdrop":
        this.announceAirdrop(msg.id, msg.x, msg.z, msg.items, msg.land);
        break;
      case "kill": {
        net.alive = msg.alive;
        const victim = net.byId.get(msg.victim);
        if (!victim) break;
        const killer = msg.killer ? net.byId.get(msg.killer) ?? null : null;
        const weapon = msg.w === "left" ? "Left the match" : msg.w === "grenade" ? "Frag Grenade" : msg.w in WEAPONS ? WEAPONS[msg.w as WeaponId].name : msg.w;
        this.markDead(victim, killer, weapon, msg.head);
        break;
      }
      case "taken": {
        const e = this.loot.items.get(msg.id);
        const mine = msg.by === net.start.you && net.pendingPicks.delete(msg.id);
        if (e && mine) this.pickup(e);
        else this.loot.remove(msg.id);
        break;
      }
      case "pick-denied":
        net.pendingPicks.delete(msg.id);
        break;
      case "spawn":
        this.loot.spawn(msg.item, new THREE.Vector3(msg.pos[0], msg.pos[1], msg.pos[2]), msg.id);
        break;
      case "result":
        net.result = msg;
        this.deathTime = this.now;
        this.input?.exitLock();
        this.setPhase(msg.placement === 1 || msg.survivor ? "won" : "dead");
        break;
      case "end":
        net.end = msg;
        // Our squad won (we may be out ourselves, spectating the ones who finished it).
        if ((msg.winner === net.start.you || (msg.winnerTeam && msg.winnerTeam === this.me.team)) && this.phase !== "won") {
          this.deathTime = this.now;
          this.input?.exitLock();
          this.setPhase("won");
        }
        break;
    }
  };

  /** Online death: animation, kill feed and (for us or our bots) dropping the gear. */
  private markDead(victim: Combatant, killer: Combatant | null, weapon: string, headshot: boolean) {
    if (!victim.alive) return;
    victim.health = 0;
    victim.alive = false;
    victim.collider.setCollisionGroups(0);
    const dir = killer ? victim.position.clone().sub(killer.position).setY(0).normalize() : undefined;
    victim.visual.die(dir);
    if (killer && killer !== victim) killer.kills++;
    this.pushKillFeed(victim, killer, weapon, headshot);
    this.noteKill(victim, killer, weapon, headshot);
    if (killer === this.me) {
      this.hitMarker = { time: this.now, kind: "kill" };
      this.audio.hitMarker(true);
    }
    if (victim === this.me) {
      // Our kit goes on the ground through the server; dead bots' kits are dropped by the server itself.
      this.dropGear(victim);
      this.deathTime = this.now;
      this.input?.exitLock();
      if (this.phase === "playing" || this.phase === "paused") this.setPhase("dead");
    }
  }

  /** Remote soldier fired: flash, tracer, sound and impact where the server says it landed. */
  private remoteShot(shooter: Combatant, w: WeaponId, o: number[], e: number[], hitBody: boolean) {
    const muzzle = shooter.visual.muzzleWorld();
    const end = new THREE.Vector3(e[0], e[1], e[2]);
    const origin = new THREE.Vector3(o[0], o[1], o[2]);
    const dir = end.clone().sub(muzzle).normalize();
    const camDist = muzzle.distanceTo(this.camera.position);
    if (camDist < 400) {
      this.effects.muzzleFlash(muzzle, w === "p92" ? 0.25 : 0.4, camDist < 60, dir);
      this.effects.tracer(muzzle, end);
    }
    const rel = muzzle.clone().sub(this.camera.position);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    this.audio.shot(w, rel.length(), rel.normalize().dot(right));
    if (this.me.alive) {
      const head = this.me.position.clone().setY(this.me.position.y + this.me.eyeHeight);
      const seg = end.clone().sub(origin);
      const tt = Math.max(0, Math.min(1, head.clone().sub(origin).dot(seg) / Math.max(seg.lengthSq(), 1e-6)));
      const closest = origin.clone().addScaledVector(seg, tt).distanceTo(head);
      if (closest < 2.5 && closest > 0.4) this.audio.whiz();
      if (closest < 4 && !hitBody) this.markThreat(shooter);
    }
    if (end.distanceTo(this.camera.position) > 150) return;
    if (hitBody) {
      this.effects.impact(end, dir.clone().negate(), "blood", dir);
      return;
    }
    // Find out what it hit here, for the right kind of impact.
    const back = end.clone().addScaledVector(dir, -0.3);
    const hit = this.physics.castRay(back, dir, 0.6, LAYER.WORLD);
    if (hit) {
      const isGround = hit.collider.shape.type === this.physics.rapier.ShapeType.TriMesh;
      this.effects.impact(end, hit.normal, isGround ? "dirt" : "hard");
    }
  }

  /** Online: gear goes on the ground through the server so everyone sees the same pile. */
  private dropGear(c: Combatant) {
    const p = c.position;
    const drop = (item: LootItem, dx: number, dz: number) =>
      this.net!.client.send({ t: "drop", item, pos: [p.x + dx, p.y + 0.02, p.z + dz] });
    c.slots.forEach((g, i) => {
      if (!g) return;
      const ox = Math.cos(i * 2.1) * 0.8;
      const oz = Math.sin(i * 2.1) * 0.8;
      drop({ kind: "weapon", weapon: g.stats.id, mag: g.mag, scope: g.scope }, ox, oz);
      drop({ kind: "ammo", ammo: g.stats.ammo, amount: c.isBot ? Math.round(g.stats.magSize * 1.5) : c.reserve[g.stats.ammo] }, ox + 0.4, oz + 0.4);
    });
    if (c.medkits > 0 || (c.isBot && Math.random() < 0.35)) drop({ kind: "medkit" }, -0.6, 0.5);
    if (c.gear.vest) drop({ kind: "armor", slot: "vest", level: c.gear.vest, dur: Math.round(c.gear.vestDur) }, 0.2, -0.7);
    if (c.gear.helmet) drop({ kind: "armor", slot: "helmet", level: c.gear.helmet, dur: Math.round(c.gear.helmetDur) }, -0.5, -0.5);
    if (c.grenades > 0) drop({ kind: "grenade", count: c.grenades }, 0.7, -0.2);
  }

  private pushKillFeed(victim: Combatant, killer: Combatant | null, weapon: string, headshot: boolean) {
    this.killFeed.push({
      id: ++this.killId,
      killer: killer?.name ?? (weapon === "Left the match" ? "" : "Zone"),
      victim: victim.name,
      weapon,
      headshot,
      byPlayer: killer === this.me,
      time: this.now,
    });
    if (this.killFeed.length > 6) this.killFeed.shift();
  }

  private addCombatant(c: Combatant) {
    this.combatants.push(c);
    this.byCollider.set(c.collider.handle, c);
    this.scene.add(c.visual.root);
  }

  /** Resolve one shot from `origin` along `dir` (hitscan) with tracer, sound and damage. */
  private fire = (shooter: Combatant, origin: THREE.Vector3, dir: THREE.Vector3) => {
    const gun = shooter.gun;
    if (!gun || !shooter.alive || shooter.busy || shooter.fireCooldown > 0) return false;
    if (gun.mag <= 0) {
      if (shooter.isPlayer) {
        this.audio.empty();
        if (shooter.startReload()) this.audio.reload(gun.stats.reloadTime);
      }
      shooter.fireCooldown = 0.25;
      return false;
    }
    shooter.lastShotTime = this.now;
    // Firing gives you away: spawn protection ends.
    if (shooter.isPlayer && this.net) this.net.graceEndsAt = 0;
    gun.mag--;
    shooter.fireCooldown = gun.stats.fireInterval;
    shooter.recoil = 1;
    const stats = gun.stats;
    const muzzle = shooter.visual.muzzleWorld();

    // Humans can hit anyone; bots only fight humans, so their bullets pass through other bots.
    const targets = shooter.isBot ? LAYER.WORLD | LAYER.PLAYER : LAYER.WORLD | LAYER.BOT | LAYER.PLAYER;
    let hit = this.physics.castRay(origin, dir, stats.range, targets, shooter.collider);
    let end = hit ? new THREE.Vector3().copy(hit.point) : origin.clone().addScaledVector(dir, stats.range);
    // The bullet leaves the muzzle: make sure nothing is between the muzzle and the aim point.
    const toEnd = end.clone().sub(muzzle);
    const len = toEnd.length();
    if (len > 0.5) {
      const block = this.physics.castRay(muzzle, toEnd.divideScalar(len), len - 0.05, targets, shooter.collider);
      if (block) {
        hit = block;
        end = new THREE.Vector3().copy(block.point);
      }
    }

    const camDist = muzzle.distanceTo(this.camera.position);
    const barrel = dir.clone();
    this.effects.muzzleFlash(muzzle, stats.id === "p92" ? 0.25 : 0.4, shooter.isPlayer || camDist < 60, barrel);
    // Spent brass for guns you can see up close (the bolt-action ejects on the bolt cycle).
    if (camDist < 25 && stats.id !== "kar98k") {
      const right = new THREE.Vector3(-Math.cos(shooter.aimYaw), 0, Math.sin(shooter.aimYaw));
      this.effects.ejectBrass(muzzle.clone().addScaledVector(dir, -0.5), right, this.terrain.heightAt(muzzle.x, muzzle.z));
    }
    // Enemy rounds that miss you narrowly crack past your head.
    if (!shooter.isPlayer && this.me.alive) {
      const head = this.me.position.clone().setY(this.me.position.y + this.me.eyeHeight);
      const seg = end.clone().sub(origin);
      const t = Math.max(0, Math.min(1, head.clone().sub(origin).dot(seg) / Math.max(seg.lengthSq(), 1e-6)));
      const closest = origin.clone().addScaledVector(seg, t).distanceTo(head);
      if (closest < 2.5 && closest > 0.4) this.audio.whiz();
      if (closest < 4) this.markThreat(shooter);
    }
    // Bots' bullets always show (so you can tell where fire comes from); yours only now and then.
    if (!shooter.isPlayer || Math.random() < 0.3) this.effects.tracer(muzzle, end);
    if (shooter.isPlayer) {
      this.audio.shot(stats.id, 0, 0);
      if (stats.id === "kar98k") this.audio.bolt();
      this.player.onShot();
    } else {
      const rel = muzzle.clone().sub(this.camera.position);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
      this.audio.shot(stats.id, rel.length(), rel.normalize().dot(right));
    }

    const victim = hit ? this.byCollider.get(hit.collider.handle) : undefined;
    // Squad mates can't hurt each other: the round just stops on them.
    const friendly = !!victim && victim !== shooter && !!shooter.team && victim.team === shooter.team;
    if (this.net) {
      // The server decides damage; tell it what we hit (and let others see the shot).
      const v = victim && victim.alive && victim !== shooter && !friendly ? victim : null;
      const headshot = v ? end.distanceTo(v.visual.headWorld()) < 0.26 : false;
      this.net.client.send({
        t: "shot", by: shooter.id, w: stats.id,
        o: [origin.x, origin.y, origin.z].map((n) => Math.round(n * 100) / 100),
        e: [end.x, end.y, end.z].map((n) => Math.round(n * 100) / 100),
        ...(v ? { hit: { id: v.id, head: headshot } } : {}),
      });
      if (v) {
        this.effects.impact(end, { x: -dir.x, y: -dir.y + 0.3, z: -dir.z }, "blood", dir);
        if (shooter.isPlayer) {
          this.hitMarker = { time: this.now, kind: headshot ? "head" : "hit" };
          this.audio.hitMarker(false);
        }
        return true;
      }
    }
    if (!hit) return true;
    if (!victim) {
      const isGround = hit.collider.shape.type === this.physics.rapier.ShapeType.TriMesh;
      this.effects.impact(end, hit.normal, isGround ? "dirt" : "hard");
      const d = end.distanceTo(this.camera.position);
      if (d < 35) this.audio.impact(isGround ? "dirt" : "hard", d);
      return true;
    }
    if (!victim.alive || victim === shooter || friendly) return true;
    const head = victim.visual.headWorld();
    const headshot = end.distanceTo(head) < 0.26;
    const dist = end.distanceTo(muzzle);
    const falloff = rangeFalloff(stats, dist);
    const raw = Math.min(MAX_HIT_DAMAGE, stats.damage * (headshot ? stats.headMultiplier : 1) * falloff);
    // Armour soaks part of the hit (and wears down doing it).
    const ar = armorHit(raw, victim.gear, headshot ? "head" : "body");
    victim.wearDown(ar.vestWear, ar.helmetWear);
    const dmg = ar.damage;
    const killed = victim.damage(dmg, shooter, this.now);
    if (shooter.isPlayer) this.pushFloater(head.clone().add(new THREE.Vector3(0, 0.35, 0)), dmg, killed ? "kill" : headshot ? "head" : "hit");
    shooter.damageDealt += dmg;
    this.effects.impact(end, { x: -dir.x, y: -dir.y + 0.3, z: -dir.z }, "blood", dir);
    if (killed) victim.visual.die(dir);
    if (shooter.isPlayer) {
      this.hitMarker = { time: this.now, kind: killed ? "kill" : headshot ? "head" : "hit" };
      this.audio.hitMarker(killed);
    }
    if (victim.isPlayer) {
      const rel = shooter.position.clone().sub(victim.position);
      this.damageDirs.push({ angle: Math.atan2(rel.x, rel.z), time: this.now });
      this.markThreat(shooter);
      this.audio.hurt();
      this.player.onHurt();
      this.buzz(40);
    }
    if (killed) this.onKill(victim, shooter, stats.name, headshot);
    return true;
  };

  /** Damage number over a target; merges quick hits on the same spot so automatic fire stays readable. */
  private pushFloater(pos: THREE.Vector3, amount: number, kind: FloaterKind) {
    const n = Math.max(1, Math.round(amount));
    const last = this.floaters[this.floaters.length - 1];
    if (last && kind !== "kill" && last.kind !== "kill" && this.now - last.time < 0.35 && last.pos.distanceTo(pos) < 1.2) {
      last.text = String(Number(last.text) + n);
      last.time = this.now;
      if (kind === "head") last.kind = "head";
      return;
    }
    this.floaters.push({ id: ++this.floaterId, pos: pos.clone(), text: String(n), kind, time: this.now });
    if (this.floaters.length > 12) this.floaters.shift();
    if (kind !== "hit") this.buzz(kind === "kill" ? [25, 40, 45] : 15);
    else this.buzz(8);
  }

  /**
   * Someone shot at us (hit or a close miss): remember where they stood, so
   * the minimap and the screen show a red dot there for a few seconds.
   */
  private markThreat(shooter: Combatant) {
    if (shooter === this.me || !this.me.alive || (this.me.team && shooter.team === this.me.team)) return;
    const t = this.threats.find((x) => x.id === shooter.id);
    if (t) {
      t.pos.copy(shooter.position);
      t.time = this.now;
    } else {
      this.threats.push({ id: shooter.id, pos: shooter.position.clone(), time: this.now });
      if (this.threats.length > 8) this.threats.shift();
    }
  }

  /** Vibrate on phones (hits, kills, getting hurt). */
  private buzz(pattern: number | number[]) {
    if (!this.touch) return;
    try {
      navigator.vibrate?.(pattern);
    } catch {
      // Not supported: no haptics.
    }
  }

  private showCallout(text: string, sub = "") {
    this.callout = { id: ++this.calloutId, text, sub, time: this.now };
  }

  /** Bookkeeping shared by offline and online deaths: kill-cam info, streaks and callouts. */
  private noteKill(victim: Combatant, killer: Combatant | null, weapon: string, headshot: boolean) {
    const first = !this.anyKill && !!killer && killer !== victim;
    if (killer && killer !== victim) this.anyKill = true;
    if (victim === this.me) {
      this.death = { killer: killer && killer !== victim ? killer : null, weapon, distance: killer ? killer.position.distanceTo(victim.position) : 0, headshot, time: this.now };
      this.spectating = null;
      this.buzz([60, 40, 120]);
      return;
    }
    if (killer !== this.me) return;
    const s = this.streak;
    s.count = this.now - s.last < 10 ? s.count + 1 : 1;
    s.last = this.now;
    const names = ["", "", "Double kill", "Triple kill", "Quad kill", "Rampage"];
    const text = s.count >= 2 ? names[Math.min(5, s.count)] : first ? "First blood" : headshot ? "Headshot" : "Eliminated";
    this.showCallout(text, `${victim.name}${headshot && text !== "Headshot" ? " · headshot" : ""} · ${weapon}`);
    this.audio.streak(s.count + (first ? 1 : 0));
  }

  // ---------- grenades ----------

  private throwGrenade() {
    const me = this.me;
    if (me.grenades <= 0 || this.throwCooldown > 0 || me.healLeft > 0) return;
    me.grenades--;
    this.throwCooldown = 1.2;
    const { dir } = this.player.aimRay();
    const flat = new THREE.Vector3(dir.x, 0, dir.z).normalize();
    const origin = me.position.clone().setY(me.position.y + me.eyeHeight + 0.1).addScaledVector(flat, 0.45);
    const vel = Grenades.launch(dir);
    this.grenades.throw(me.id, origin, vel, true);
    me.lastShotTime = this.now;
    this.audio.grenadeThrow();
    if (this.net) {
      this.net.graceEndsAt = 0;
      const r = (n: number) => Math.round(n * 100) / 100;
      this.net.client.send({ t: "nade", o: [origin.x, origin.y, origin.z].map(r), v: [vel.x, vel.y, vel.z].map(r) });
    }
  }

  /** A grenade bursts here. Ours are reported to the server (online) or resolved right here (offline). */
  private burst(at: THREE.Vector3, local: boolean) {
    this.effects.explosion(at);
    const rel = at.clone().sub(this.camera.position);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const dist = rel.length();
    this.audio.explosion(dist, rel.normalize().dot(right));
    if (dist < 30) {
      this.player.onHurt();
      this.buzz(dist < 12 ? [50, 30, 50] : 30);
    }
    if (!local) return;
    if (this.net) {
      const r = (n: number) => Math.round(n * 100) / 100;
      this.net.client.send({ t: "boom", pos: [at.x, at.y, at.z].map(r) });
      return;
    }
    this.applyBlast(at, this.me);
  }

  /** Offline blast damage: everyone in range who isn't behind cover. */
  private applyBlast(at: THREE.Vector3, owner: Combatant) {
    const from = at.clone().add(new THREE.Vector3(0, 0.3, 0));
    for (const c of this.combatants) {
      if (!c.alive) continue;
      const chest = c.position.clone().setY(c.position.y + c.eyeHeight * 0.7);
      const d = from.distanceTo(chest);
      if (d >= GRENADE.radius) continue;
      if (c !== owner && owner.team && c.team === owner.team) continue;
      const dir = chest.clone().sub(from).normalize();
      if (d > 0.5 && this.physics.castRay(from, dir, d - 0.3, LAYER.WORLD)) continue;
      const ar = armorHit(blastDamage(d), c.gear, "blast");
      c.wearDown(ar.vestWear, ar.helmetWear);
      const killed = c.damage(ar.damage, owner, this.now);
      if (c !== owner) owner.damageDealt += ar.damage;
      if (owner === this.me && c !== this.me) {
        this.hitMarker = { time: this.now, kind: killed ? "kill" : "hit" };
        this.pushFloater(c.visual.headWorld().add(new THREE.Vector3(0, 0.35, 0)), ar.damage, killed ? "kill" : "hit");
      }
      if (c === this.me) {
        const rel = at.clone().sub(c.position);
        this.damageDirs.push({ angle: Math.atan2(rel.x, rel.z), time: this.now });
        this.audio.hurt();
      }
      if (killed) {
        c.visual.die(dir);
        this.onKill(c, owner, "Frag Grenade", false);
      }
    }
  }

  // ---------- airdrops ----------

  private announceAirdrop(id: string, x: number, z: number, items: Array<{ id: string; item: LootItem }>, landIn: number) {
    this.airdrops.announce(id, x, z, items, landIn, this.now);
    if (landIn > 0) {
      this.showCallout("Airdrop incoming", "Red smoke marks the crate · top-tier gear inside");
      this.audio.chime();
    }
  }

  /** Practice matches schedule their own crates. */
  private offlineAirdrops() {
    const at = [130, 280];
    if (this.offlineDrops >= at.length || this.landTime === Infinity) return;
    if (this.now - this.startTime < at[this.offlineDrops]) return;
    const n = ++this.offlineDrops;
    const zs = this.zone.status;
    const [x, z] = this.map.randomOpenPoint(Math.random, zs.nx, zs.nz, Math.max(10, zs.nRadius * 0.6));
    const items = airdropItems(n).map((item, k) => ({ id: `A${n}-${k}`, item }));
    this.announceAirdrop(`A${n}`, x, z, items, 32);
  }

  // ---------- dropping in ----------

  /** Plane ride, free-fall and parachute: our soldier follows the drop controller. */
  private updateDrop(dt: number) {
    const d = this.drop!;
    const me = this.me;
    const actions = this.player.lookOnly();
    const { f, r } = this.input.moveAxis();
    const ev = d.update(dt, { f, r, yaw: this.player.yaw, jump: actions.includes("jump") });
    me.teleport(d.position);
    me.aimYaw = this.player.yaw;
    me.aimPitch = 0;
    me.velocity.copy(d.velocity);
    me.grounded = false;
    if (ev === "jumped") {
      me.setDropping(1);
      this.audio.setDrone(0.25);
      this.audio.whiz();
    } else if (ev === "chute") {
      me.setDropping(2);
      this.audio.setDrone(0);
    } else if (ev === "landed") {
      this.land();
    }
  }

  private land() {
    const me = this.me;
    me.setDropping(0);
    me.teleport(this.drop!.position);
    me.velocity.set(0, 0, 0);
    me.grounded = true;
    this.landTime = this.now;
    this.audio.setDrone(0);
    this.audio.footstep(0.4);
    this.player.pitch = 0;
    if (this.net) {
      // The server starts our spawn protection now that we're on the ground.
      this.net.client.send({ t: "play" });
      this.net.graceEndsAt = performance.now() / 1000 + (this.net.start.grace ?? 0);
    }
  }

  private dropCamera(dt: number) {
    const d = this.drop!;
    if (d.stage === "plane") {
      // Riding in the plane: we watch it from outside.
      this.player.chaseCamera(dt, d.planePos().add(new THREE.Vector3(0, 3, 0)), 30, 70);
      this.me.visual.root.visible = false;
    } else {
      this.player.chaseCamera(dt, this.me.position.clone().setY(this.me.position.y + 1.2), d.stage === "chute" ? 7.5 : 5.5, 76);
      this.me.visual.setVisible(true);
    }
  }

  private get inAir() {
    return !!this.drop && this.drop.stage !== "landed" && this.phase !== "ready";
  }

  /** The plane keeps flying its route after we jump, until it's off the map. */
  private updatePlane(dt: number) {
    const plane = this.planeObj;
    const d = this.drop;
    if (!plane || !d) return;
    // The drop controller keeps the clock while we're in the air; after landing we keep it here.
    if (d.stage === "landed") d.t += dt;
    const flying = this.phase !== "ready" && d.t * 55 < d.path.length;
    plane.visible = flying;
    if (!flying) return;
    plane.position.copy(d.planePos());
    plane.rotation.y = d.planeYaw;
    spinProps(plane, dt);
  }

  // ---------- kill-cam and spectating ----------

  /** Watch someone else after dying: squad mates first, then whoever killed us, then the nearest. */
  startSpectate() {
    this.spectating = this.spectateOrder()[0] ?? null;
  }

  nextSpectate() {
    const order = this.spectateOrder();
    if (!order.length) {
      this.spectating = null;
      return;
    }
    const i = this.spectating ? order.indexOf(this.spectating) : -1;
    this.spectating = order[(i + 1) % order.length];
  }

  stopSpectate() {
    this.spectating = null;
  }

  private spectateOrder() {
    const me = this.me;
    const killer = this.death?.killer;
    return this.combatants
      .filter((c) => c.alive && c !== me)
      .sort((a, b) => {
        const rank = (c: Combatant) => (me.team && c.team === me.team ? 0 : c === killer ? 1 : c.isBot ? 3 : 2);
        return rank(a) - rank(b) || a.position.distanceTo(me.position) - b.position.distanceTo(me.position);
      });
  }

  private spectatorCamera(dt: number) {
    const cam = this.camera;
    const d = this.death;
    if (d && d.killer && !this.spectating && this.now - d.time < KILLCAM_SECONDS) {
      // From where we fell, the view swings round and zooms in on whoever did it.
      const eye = this.me.position.clone().setY(this.me.position.y + 1.4);
      const target = d.killer.position.clone().setY(d.killer.position.y + d.killer.eyeHeight - 0.15);
      const dist = Math.max(1, eye.distanceTo(target));
      const k = Math.min(1, (this.now - d.time) / 0.9);
      const ease = k * k * (3 - 2 * k);
      const look = new THREE.Vector3();
      cam.getWorldDirection(look);
      const want = target.clone().sub(eye).normalize();
      look.lerp(want, 1 - Math.exp(-dt * 6)).normalize();
      cam.position.copy(eye);
      cam.lookAt(eye.clone().add(look));
      const fit = THREE.MathUtils.radToDeg(2 * Math.atan(2.2 / dist));
      cam.fov = THREE.MathUtils.lerp(72, Math.max(5, Math.min(60, fit)), ease);
      cam.near = 0.1;
      cam.updateProjectionMatrix();
      return;
    }
    const t = this.spectating;
    if (t && !t.alive) this.nextSpectate();
    if (this.spectating) {
      const s = this.spectating;
      // Ride along behind them, looking where they look.
      this.player.yaw += (s.aimYaw - this.player.yaw) * (1 - Math.exp(-dt * 5));
      const pitch = Math.max(-0.5, Math.min(0.4, s.aimPitch * 0.6 - 0.12));
      this.player.pitch += (pitch - this.player.pitch) * (1 - Math.exp(-dt * 5));
      this.player.chaseCamera(dt, s.position.clone().setY(s.position.y + (s.dropping === 1 ? 0.6 : 1.65)), s.dropping ? 7 : 3.6);
      return;
    }
    this.player.updateCamera(dt);
  }

  private onKill(victim: Combatant, killer: Combatant | null, weapon: string, headshot: boolean) {
    if (killer && killer !== victim) killer.kills++;
    this.pushKillFeed(victim, killer, weapon, headshot);
    this.noteKill(victim, killer, weapon, headshot);
    // Drop their gear as a loot pile.
    const p = victim.position.clone();
    victim.slots.forEach((g, i) => {
      if (!g) return;
      const off = new THREE.Vector3(Math.cos(i * 2.1) * 0.8, 0.02, Math.sin(i * 2.1) * 0.8);
      this.loot.spawn({ kind: "weapon", weapon: g.stats.id, mag: g.mag, scope: g.scope }, p.clone().add(off));
      this.loot.spawn({ kind: "ammo", ammo: g.stats.ammo, amount: victim.isPlayer ? victim.reserve[g.stats.ammo] : Math.round(g.stats.magSize * 1.5) }, p.clone().add(off).add(new THREE.Vector3(0.4, 0, 0.4)));
    });
    if (!victim.isPlayer && Math.random() < 0.35) this.loot.spawn({ kind: "medkit" }, p.clone().add(new THREE.Vector3(-0.6, 0.02, 0.5)));
    if (victim.gear.vest) this.loot.spawn({ kind: "armor", slot: "vest", level: victim.gear.vest, dur: Math.round(victim.gear.vestDur) }, p.clone().add(new THREE.Vector3(0.2, 0.02, -0.7)));
    if (victim.gear.helmet) this.loot.spawn({ kind: "armor", slot: "helmet", level: victim.gear.helmet, dur: Math.round(victim.gear.helmetDur) }, p.clone().add(new THREE.Vector3(-0.5, 0.02, -0.5)));
    if (victim.grenades > 0) this.loot.spawn({ kind: "grenade", count: victim.grenades }, p.clone().add(new THREE.Vector3(0.7, 0.02, -0.2)));
    if (victim.isPlayer) {
      this.deathTime = this.now;
      this.input.exitLock();
      this.setPhase("dead");
    } else if (this.me.alive && this.aliveCount() === 1) {
      this.deathTime = this.now;
      this.input.exitLock();
      this.setPhase("won");
    }
  }

  private aliveCount() {
    if (this.net) return this.net.alive;
    return this.combatants.reduce((n, c) => n + (c.alive ? 1 : 0), 0);
  }

  /** Online, loot is claimed through the server first; offline it's ours right away. */
  private requestPickup(e: LootEntity) {
    if (!this.net) {
      this.pickup(e);
      return;
    }
    if (this.net.pendingPicks.has(e.id)) return;
    this.net.pendingPicks.add(e.id);
    this.net.client.send({ t: "pick", id: e.id });
  }

  private pickup(e: LootEntity) {
    const me = this.me;
    const it = e.item;
    const here = me.position.clone().add(new THREE.Vector3(0, 0.02, 0));
    let text = lootLabel(it);
    if (it.kind === "ammo") me.reserve[it.ammo] += it.amount;
    else if (it.kind === "medkit") me.medkits++;
    else if (it.kind === "scope") text = me.takeScope(it.scope);
    else if (it.kind === "armor") {
      // Better armour replaces what we wear; the old piece goes on the ground.
      const old = me.wear(it.slot, it.level, it.dur);
      if (old.level > 0) {
        const item: LootItem = { kind: "armor", slot: it.slot, level: old.level, dur: Math.round(old.dur) };
        if (this.net) this.net.client.send({ t: "drop", item, pos: [here.x, here.y, here.z] });
        else this.loot.spawn(item, here);
      }
      const max = ARMOR[it.slot].durability[it.level];
      text = `${gearName(it.slot, it.level)}${it.dur !== undefined && it.dur < max ? ` (${Math.round((it.dur / max) * 100)}%)` : ""}`;
    } else if (it.kind === "grenade") {
      const took = me.addGrenades(it.count);
      text = `Frag Grenade ×${took}`;
    } else {
      const stats = WEAPONS[it.weapon];
      // Full slots: swap with the held gun of that kind and drop the old one here.
      const swapSlot: SlotIndex | null =
        stats.slot === "secondary" ? (me.slots[2] ? 2 : null) : me.slots[0] && me.slots[1] ? (me.active === 1 ? 1 : 0) : null;
      if (swapSlot !== null) {
        // The old gun is dropped; its scope goes into the backpack, like in BGMI.
        const old = me.slots[swapSlot]!;
        if (old.scope) me.scopeBag.push(old.scope);
        if (this.net) this.net.client.send({ t: "drop", item: { kind: "weapon", weapon: old.stats.id, mag: old.mag }, pos: [here.x, here.y, here.z] });
        else this.loot.spawn({ kind: "weapon", weapon: old.stats.id, mag: old.mag }, here);
      }
      me.give(it.weapon, it.mag, it.scope ?? null);
    }
    this.lastPickup = { text, time: this.now };
    this.loot.remove(e.id);
    this.audio.pickup();
  }

  /** Walking over this picks it up: always for ammo and med kits; guns into a free slot; better armour; grenades if there's room. */
  private wants(it: LootItem) {
    if (it.kind === "weapon") return this.hasRoomFor(it.weapon);
    if (it.kind === "armor") return it.level > this.me.gear[it.slot];
    if (it.kind === "grenade") return this.me.grenades < GRENADE.carry;
    return true;
  }

  /** Is there a free slot for this gun (so walking over it picks it up)? */
  private hasRoomFor(id: WeaponId) {
    const s = WEAPONS[id].slot;
    return s === "secondary" ? !this.me.slots[2] : !this.me.slots[0] || !this.me.slots[1];
  }

  private frame = () => {
    if (this.disposed) return;
    const t = performance.now() / 1000;
    const realDt = this.lastT ? Math.min(0.05, t - this.lastT) : 1 / 60;
    this.lastT = t;
    this.fps = this.fps * 0.95 + (1 / Math.max(realDt, 1e-3)) * 0.05;
    this.adaptResolution(realDt);
    if (this.phase === "playing" || this.phase === "dead" || this.phase === "won") this.update(realDt);
    else if (this.phase === "ready" || this.phase === "paused") this.idleCamera(realDt);
    if (this.debugCam) {
      this.camera.position.set(...this.debugCam.pos);
      this.camera.lookAt(...this.debugCam.target);
      this.me.visual.setVisible(true);
    }
    // Behind the results screen the world only needs a few frames a second; on phones
    // that leaves the main thread free so its buttons respond straight away.
    if (this.touch && (this.phase === "dead" || this.phase === "won")) {
      this.idleRender += realDt;
      if (this.idleRender < 1 / 12) return;
      this.idleRender = 0;
    }
    this.renderer.render(this.scene, this.camera);
  };
  private lastT = 0;
  private idleRender = 0;

  /**
   * Dynamic resolution: if frames run slow, render fewer pixels; when there's
   * headroom, climb back toward the preset's resolution.
   */
  private adaptResolution(dt: number) {
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 45) return;
    const sorted = [...this.frameTimes].sort((a, b) => a - b);
    const typical = sorted[Math.floor(sorted.length * 0.7)];
    this.frameTimes = [];
    const max = this.quality.pixelRatio;
    let next = this.pixelRatio;
    if (typical > 1 / 40) next = Math.max(0.5, this.pixelRatio - 0.1);
    else if (typical < 1 / 57) next = Math.min(max, this.pixelRatio + 0.05);
    if (Math.abs(next - this.pixelRatio) > 0.001) {
      this.pixelRatio = next;
      this.renderer.setPixelRatio(next);
      this.resize();
    }
  }

  private idleCamera(dt: number) {
    if (this.net) {
      // The match keeps going while you're on the menu: keep everyone else moving.
      this.now += dt;
      this.netTick(dt);
      this.physics.world.timestep = dt;
      this.physics.step();
      this.zone.update(dt);
      this.effects.update(dt);
      this.grenades.update(dt, (g) => this.burst(g.position, true));
      this.airdrops.update(dt, this.now, (items, at) =>
        items.forEach((it, i) => this.loot.spawn(it.item, Airdrops.lootSpot(at, i, items.length), it.id)),
      );
    }
    this.combatants.forEach((c) => c.updateVisual(dt, c.isPlayer ? 1 : 0));
    if (this.inAir) this.dropCamera(dt);
    else this.player.updateCamera(dt);
    this.followSun();
    this.vegetation.update(dt, this.camera.position);
  }

  private update(dt: number) {
    this.now += dt;
    const me = this.me;
    const playing = this.phase === "playing";

    if (playing && me.alive && this.inAir) {
      this.updateDrop(dt);
    } else if (playing && me.alive) {
      me.tick(dt);
      const { fire, actions } = this.player.update(dt);
      this.throwCooldown = Math.max(0, this.throwCooldown - dt);
      if (actions.includes("throw")) this.throwGrenade();
      if (fire) {
        const { origin, dir } = this.player.aimRay();
        // Start the ray at the player so walls behind the camera don't eat shots.
        const toPlayer = me.position.clone().setY(me.position.y + me.eyeHeight).sub(origin).dot(dir);
        origin.addScaledVector(dir, Math.max(0, toPlayer));
        const spread = (this.player.spread * Math.PI) / 180;
        dir.x += (Math.random() - 0.5) * 2 * spread * 0.5;
        dir.y += (Math.random() - 0.5) * 2 * spread * 0.5;
        dir.z += (Math.random() - 0.5) * 2 * spread * 0.5;
        dir.normalize();
        if (this.fire(me, origin, dir)) me.cancelActions();
      }
      if (actions.includes("reload") && me.reloadLeft > 0 && me.gun) this.audio.reload(me.gun.stats.reloadTime);
      // Walking over ammo, med kits and scopes picks them up, and guns too while a slot is free.
      const auto = this.loot.nearest(me.position, 1.4, (e) => this.wants(e.item));
      if (auto) this.requestPickup(auto);
      // I picks up (or swaps for) the nearest gun or scope, even with ammo lying closer.
      if (actions.includes("pickup")) {
        const near = this.loot.nearest(me.position, 2.6, (e) => e.item.kind === "weapon" || e.item.kind === "scope") ?? this.loot.nearest(me.position, 2.6);
        if (near) this.requestPickup(near);
      }
    } else if (!me.alive) {
      me.move(dt, 0, 0, false);
      if (this.spectating && this.player.lookOnly().includes("switch")) this.nextSpectate();
    }

    const world: BotWorld = {
      physics: this.physics,
      zone: this.zone,
      map: this.map,
      combatants: this.combatants,
      now: this.now,
      fire: this.fire,
      // Practice: bots hold fire until 20 s after you land.
      peaceful: this.net ? performance.now() / 1000 < this.net.peaceEndsAt : this.now - this.landTime < 20 || this.landTime === Infinity,
      hunters: new Map(),
    };
    for (const b of this.bots) if (b.me.alive && b.target) world.hunters.set(b.target, (world.hunters.get(b.target) ?? 0) + 1);
    for (const b of this.bots) b.update(dt, world);
    if (this.net) this.netTick(dt);
    this.physics.world.timestep = dt;
    this.physics.step();

    this.grenades.update(dt, (g) => this.burst(g.position, true));
    this.airdrops.update(dt, this.now, (items, at) =>
      items.forEach((it, i) => this.loot.spawn(it.item, Airdrops.lootSpot(at, i, items.length), it.id)),
    );
    if (!this.net) this.offlineAirdrops();

    // Zone (online, the server applies zone damage).
    this.zone.update(dt);
    this.zoneTick += dt;
    if (this.zoneTick >= 1 && !this.net) {
      this.zoneTick -= 1;
      for (const c of this.combatants) {
        // Nobody takes zone damage before they've landed.
        if (c === this.me && this.inAir) continue;
        if (c.alive && !this.zone.contains(c.position.x, c.position.z)) {
          if (c.damage(this.zone.damagePerSecond, null, this.now)) this.onKill(c, null, "Blue zone", false);
        }
      }
    }

    // Animate: full detail up close, cheap far away, hidden beyond the fog.
    for (const c of this.combatants) {
      const d = c.position.distanceTo(this.camera.position);
      c.visual.root.visible = d < this.quality.fogFar;
      if (!c.visual.root.visible) continue;
      c.updateVisual(dt, c.isPlayer || d < this.quality.detailDistance ? 1 : 0);
    }
    this.updatePlane(dt);
    if (!me.alive) this.spectatorCamera(dt);
    else if (this.inAir) this.dropCamera(dt);
    else this.player.updateCamera(dt);
    this.followSun();
    this.vegetation.update(dt, this.camera.position);
    this.effects.hideTracers = !me.alive && !this.spectating;
    this.effects.update(dt);
    this.damageDirs = this.damageDirs.filter((d) => this.now - d.time < 1.6);
    this.floaters = this.floaters.filter((f) => this.now - f.time < 1.1);
    this.threats = this.threats.filter((t) => this.now - t.time < THREAT_SECONDS);
  }

  /** Online upkeep: play back everyone else and report our soldier ~15 times a second. */
  private netTick(dt: number) {
    const net = this.net!;
    const now = performance.now() / 1000;
    for (const c of this.combatants) if (c.remote) c.applyNetBuffer(now);
    net.sendAcc += dt;
    if (net.sendAcc < 0.066) return;
    net.sendAcc = 0;
    // Nobody sees us until we jump out of the plane.
    const aboard = this.phase === "ready" || this.drop?.stage === "plane";
    if (this.me.alive && !aboard) net.client.send({ t: "s", d: encodeState(this.me.netState()) });
  }

  /** Keep the shadow camera centred on the view, snapped to texels to avoid shimmer. */
  private followSun() {
    const p = this.me.position;
    const sc = this.sun.shadow.camera;
    const texel = (sc.right - sc.left) / this.sun.shadow.mapSize.x;
    const x = Math.round(p.x / texel) * texel;
    const z = Math.round(p.z / texel) * texel;
    this.sun.target.position.set(x, p.y, z);
    this.sun.position.set(x, p.y, z).addScaledVector(this.sunDir, 200);
    this.sun.target.updateMatrixWorld();
    this.sky.position.copy(this.camera.position);
  }

  getHud(): HudState {
    const me = this.me;
    const zs = this.zone.status;
    const g = me?.gun;
    const fovRad = (this.camera.fov * Math.PI) / 180;
    const h = this.container.clientHeight || 800;
    const near = this.loot && me ? this.loot.nearest(me.position, 2.6, (e) => e.item.kind === "weapon" || e.item.kind === "scope") : null;
    let prompt: string | null = null;
    if (near && near.item.kind === "weapon") {
      const full = !this.hasRoomFor(near.item.weapon);
      prompt = `${full ? "Swap for" : "Pick up"} ${lootLabel(near.item)}${near.item.scope ? ` + ${SCOPES[near.item.scope].name}` : ""}`;
    } else if (near) prompt = `Pick up ${lootLabel(near.item)}`;
    else if (me && g && g.mag === 0 && me.reserve[g.stats.ammo] === 0) prompt = `No ${g.stats.ammo} ammo`;
    return {
      phase: this.phase,
      health: me?.health ?? 0,
      maxHealth: PLAYER_MAX_HEALTH,
      alive: this.aliveCount(),
      kills: this.net?.result?.kills ?? me?.kills ?? 0,
      slots: me
        ? me.slots.map((s, i) =>
            s
              ? { slot: i + 1, name: s.stats.name, mag: s.mag, magSize: s.stats.magSize, reserve: me.reserve[s.stats.ammo], ammo: s.stats.ammo, active: me.active === i, scope: s.scope ? SCOPES[s.scope].name : null, range: s.stats.range }
              : null,
          )
        : [null, null, null],
      medkits: me?.medkits ?? 0,
      sight: !g?.scope ? "iron" : SCOPES[g.scope].magnified ? "magnified" : "reddot",
      zoom: g?.scope && SCOPES[g.scope].magnified ? g.scope : null,
      pickup: this.lastPickup && this.now - this.lastPickup.time < 2.2 ? this.lastPickup : null,
      spareScopes: me ? me.scopeBag.map((sc) => SCOPES[sc].name) : [],
      reserve: me?.reserve ?? { "5.56mm": 0, "7.62mm": 0, "9mm": 0 },
      prompt,
      aiming: !!me?.aiming,
      scoped: !!this.player?.scoped,
      reload: me && me.reloadLeft > 0 ? 1 - me.reloadLeft / me.reloadTotal : 0,
      heal: this.player?.healProgress() ?? 0,
      switching: !!me && me.switchLeft > 0,
      spreadPx: this.player ? (Math.tan((this.player.spread * Math.PI) / 360) / Math.tan(fovRad / 2)) * (h / 2) : 0,
      hitMarker: this.hitMarker,
      damageDirs: this.damageDirs.map((d) => ({ ...d, angle: d.angle - (this.player?.yaw ?? 0) })),
      killFeed: this.killFeed.filter((k) => this.now - k.time < 8),
      zone: {
        ...zs,
        inside: me ? this.zone.contains(me.position.x, me.position.z) : true,
        distance: me ? Math.max(0, Math.hypot(me.position.x - zs.nx, me.position.z - zs.nz) - zs.nRadius) : 0,
      },
      // North is -Z (up on the map); yaw PI faces north and turning right lowers yaw.
      heading: this.player ? (((180 - (this.player.yaw * 180) / Math.PI) % 360) + 360) % 360 : 0,
      player: { x: me?.position.x ?? 0, z: me?.position.z ?? 0 },
      stance: me?.stance ?? "stand",
      sprinting: !!me?.sprinting,
      backend: this.backend,
      resolution: Math.round(this.pixelRatio * 100),
      touch: this.touch,
      fps: Math.round(this.fps),
      now: this.now,
      placement: this.net?.result?.placement ?? this.aliveCount() + (me?.alive ? 0 : 1),
      damageDealt: Math.round(this.net?.result?.damage ?? me?.damageDealt ?? 0),
      survived:
        this.net?.result?.survived ??
        Math.round((this.phase === "dead" || this.phase === "won" ? this.deathTime : this.now) - this.startTime),
      peaceful: this.inAir
        ? 0
        : this.net
          ? Math.max(0, Math.ceil(Math.max(this.net.peaceEndsAt, this.net.graceEndsAt) - performance.now() / 1000))
          : this.landTime === Infinity ? 0 : Math.max(0, Math.ceil(20 - (this.now - this.landTime))),
      online: !!this.net,
      total: this.net ? this.net.start.teams ?? this.net.start.roster.length : this.combatants.length,
      timeLeft: this.net?.start.limit
        ? Math.max(0, Math.ceil(this.net.start.limit - this.net.elapsed - (this.net.end ? 0 : performance.now() / 1000 - this.net.elapsedAt)))
        : null,
      survivor: !!this.net?.result?.survivor,
      matchEnd: this.net?.end ?? null,
      you: this.net?.start.you ?? null,
      ...this.hudExtras(),
    };
  }

  /** Screen position (percent) of a world point, or null when it's behind the camera. */
  private toScreen(p: THREE.Vector3): ScreenPoint | null {
    const v = p.clone().project(this.camera);
    if (v.z > 1 || v.z < -1) return null;
    return { x: ((v.x + 1) / 2) * 100, y: ((1 - v.y) / 2) * 100 };
  }

  private hudExtras() {
    const me = this.me;
    const d = this.drop;
    const g = me?.gear;
    const camPos = this.camera.position;
    const inAir = this.inAir && !!d && d.stage !== "landed";
    const killer = this.death?.killer;
    const killcamOn = !!(this.death && !me?.alive && !this.spectating && this.now - this.death.time < KILLCAM_SECONDS);
    const mates = me && this.net && me.team && me.team !== me.id ? this.combatants.filter((c) => c !== me && c.team === me.team) : [];
    const sp = this.spectating;
    return {
      armor: {
        vest: g?.vest ?? 0,
        vestPct: g?.vest ? g.vestDur / ARMOR.vest.durability[g.vest] : 0,
        helmet: g?.helmet ?? 0,
        helmetPct: g?.helmet ? g.helmetDur / ARMOR.helmet.durability[g.helmet] : 0,
      },
      grenades: me?.grenades ?? 0,
      damageNumbers: this.floaters.flatMap((f) => {
        const age = this.now - f.time;
        const s = this.toScreen(f.pos.clone().add(new THREE.Vector3(0, age * 0.6, 0)));
        return s ? [{ id: f.id, x: s.x, y: s.y, text: f.text, kind: f.kind, age }] : [];
      }),
      callout: this.callout && this.now - this.callout.time < 2.4 ? { ...this.callout, age: this.now - this.callout.time } : null,
      drop:
        inAir && d && d.stage !== "landed"
          ? {
              stage: d.stage,
              altitude: Math.round(d.altitude),
              canJump: d.stage === "plane" ? d.overMap : d.stage === "fall",
              timeLeft: d.timeLeft,
              path: { ax: d.path.ax, az: d.path.az, bx: d.path.ax + d.path.dx * d.path.length, bz: d.path.az + d.path.dz * d.path.length },
            }
          : null,
      airdrops: this.airdrops
        ? this.airdrops.markers().map((a) => {
            const p = new THREE.Vector3(a.x, a.y + 2.4, a.z);
            return { id: a.id, x: a.x, z: a.z, landed: a.landed, screen: a.landed ? this.toScreen(p) : null, distance: Math.round(p.distanceTo(camPos)) };
          })
        : [],
      killcam:
        killcamOn && this.death
          ? {
              killer: killer?.name ?? this.death.weapon,
              weapon: this.death.weapon,
              distance: Math.round(this.death.distance),
              headshot: this.death.headshot,
              killerHp: killer ? Math.max(0, Math.round(killer.health)) : 0,
              bot: !!killer?.isBot,
            }
          : null,
      spectating: sp ? { name: sp.name, hp: Math.max(0, Math.round(sp.health)), kills: sp.kills, bot: sp.isBot, mate: !!me?.team && sp.team === me.team } : null,
      squad: mates.map((c) => {
        const head = c.position.clone().setY(c.position.y + 2.2);
        return {
          id: c.id, name: c.name, hp: Math.max(0, Math.round(c.health)), alive: c.alive,
          screen: c.alive ? this.toScreen(head) : null, distance: Math.round(head.distanceTo(camPos)), x: c.position.x, z: c.position.z,
        };
      }),
      awaitingSquad: !!this.net && !this.net.result && !!me && !me.alive && mates.some((c) => c.alive),
      difficulty: difficultyLabel(this.difficulty),
      threats: this.threats.map((t) => {
        const p = t.pos.clone().setY(t.pos.y + 1.4);
        return { id: t.id, x: t.pos.x, z: t.pos.z, age: (this.now - t.time) / THREAT_SECONDS, screen: this.toScreen(p), distance: Math.round(p.distanceTo(camPos)) };
      }),
      teams: this.net?.start.teams ?? (this.net ? this.net.start.roster.length : this.combatants.length),
    };
  }

  /** Top-down map image for the minimap / big map. */
  private drawMinimap() {
    const size = 512;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d")!;
    const img = g.createImageData(size, size);
    for (let j = 0; j < size; j++) {
      for (let i = 0; i < size; i++) {
        const x = -MAP_HALF + ((i + 0.5) / size) * MAP_SIZE;
        const z = -MAP_HALF + ((j + 0.5) / size) * MAP_SIZE;
        const h = this.terrain.heightAt(x, z);
        const n = this.terrain.normalAt(x, z);
        const s = this.terrain.surfaceAt(x, z);
        const shade = 0.75 + (n.x * -0.5 + n.z * -0.3) * 1.2 + h * 0.004;
        let r = 92, gg = 122, b = 66;
        const f = this.map.forestDensity(x, z);
        r -= f * 30; gg -= f * 22; b -= f * 18;
        r += (146 - r) * s.dirt * 0.7; gg += (128 - gg) * s.dirt * 0.7; b += (92 - b) * s.dirt * 0.7;
        if (s.road > 0.4) { r = 168; gg = 156; b = 132; }
        if (n.y < 0.84) { r = 128; gg = 124; b = 116; }
        const o = (j * size + i) * 4;
        img.data[o] = Math.min(255, r * shade);
        img.data[o + 1] = Math.min(255, gg * shade);
        img.data[o + 2] = Math.min(255, b * shade);
        img.data[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    const toPx = (v: number) => ((v + MAP_HALF) / MAP_SIZE) * size;
    g.fillStyle = "#e8e1d4";
    g.strokeStyle = "rgba(40,30,20,0.8)";
    for (const l of this.map.lots) {
      g.save();
      g.translate(toPx(l.x), toPx(l.z));
      g.rotate(-l.rotation);
      const w = (l.width / MAP_SIZE) * size;
      const d = (l.depth / MAP_SIZE) * size;
      g.fillRect(-w / 2, -d / 2, w, d);
      g.strokeRect(-w / 2, -d / 2, w, d);
      g.restore();
    }
    g.font = "600 13px sans-serif";
    g.textAlign = "center";
    for (const s of this.map.sites) {
      g.fillStyle = "rgba(0,0,0,0.55)";
      g.fillText(s.name, toPx(s.x) + 1, toPx(s.z) - (s.radius / MAP_SIZE) * size - 3);
      g.fillStyle = "#fff";
      g.fillText(s.name, toPx(s.x), toPx(s.z) - (s.radius / MAP_SIZE) * size - 4);
    }
    return c.toDataURL("image/jpeg", 0.85);
  }

  /**
   * Collision world for the game server's bots: terrain heights plus every
   * static box and cylinder. When map generation changes, regenerate
   * `backend/src/match/world.json`: start a practice match in a dev build and
   * run `copy(JSON.stringify(__bg.exportCollisionWorld()))` in the console.
   */
  exportCollisionWorld() {
    const r = (n: number) => Math.round(n * 100) / 100;
    const n = this.terrain.segments + 1;
    // Heights in 5 cm steps as little-endian int16, base64.
    const q = new Int16Array(n * n);
    for (let i = 0; i < q.length; i++) q[i] = Math.round(this.terrain.heights[i] * 20);
    const bytes = new Uint8Array(q.buffer);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    // Open ground for bots to roam to.
    const rng = mulberry32(8080);
    const open: number[][] = [];
    for (let i = 0; i < 2500; i++) {
      const [x, z] = this.map.randomOpenPoint(rng, 0, 0, MAP_HALF - 45);
      open.push([r(x), r(z)]);
    }
    return {
      version: 1,
      mapSize: MAP_SIZE,
      segments: this.terrain.segments,
      heights: btoa(bin),
      boxes: this.physics.statics.boxes.map((b) => b.map(r)),
      cylinders: this.physics.statics.cylinders.map((c) => c.map(r)),
      sites: this.map.sites.map((s) => ({ name: s.name, x: s.x, z: s.z, radius: s.radius })),
      open,
    };
  }

  dispose() {
    // Safe to call twice (leaving a match and the screen unmounting both dispose).
    if (this.disposed) return;
    this.disposed = true;
    this.net?.unsubscribe();
    this.renderer?.setAnimationLoop(null);
    this.resizeObserver?.disconnect();
    this.input?.dispose();
    this.grenades?.dispose();
    this.audio.dispose();
    this.combatants.forEach((c) => c.dispose());
    this.renderer?.domElement.remove();
    this.renderer?.dispose();
  }
}
