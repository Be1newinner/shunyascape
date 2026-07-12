/**
 * CharacterLoader.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * Performance-safe loader for the 11 animated low-poly human characters.
 *
 * Architecture
 * ────────────
 * • Each glTF is fetched ONCE and cached.
 * • Callers receive a CLONE of the cached scene (own transform, shared geometry).
 * • AnimationClips are shared — they hold no per-instance state.
 * • THREE.AnimationMixer is created PER AGENT only when requested (LOD-gated).
 *
 * Usage
 * ─────
 *   // 1. Preload at startup (non-blocking):
 *   preloadCharacters([CHARACTER.KING, CHARACTER.SUIT, ...NPC_POOL]);
 *
 *   // 2. Spawn a character (async, non-blocking):
 *   const result = await loadCharacter(CHARACTER.CASUAL_2);
 *   scene.add(result.group);
 *   const mixer = new THREE.AnimationMixer(result.group);
 *   const idleClip = THREE.AnimationClip.findByName(result.clips, 'Idle');
 *   mixer.clipAction(idleClip).play();
 * ──────────────────────────────────────────────────────────────────────────────
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

// ── Singleton loader ───────────────────────────────────────────────────────────
const _loader = new GLTFLoader();

import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';

// Cache: url → Promise<GLTF>
const _cache = new Map<string, Promise<GLTF>>();


// ── Character path constants ───────────────────────────────────────────────────
export const CHARACTER = {
  KING:         '/images/characters/King.gltf',
  SUIT:         '/images/characters/Suit.gltf',
  CASUAL:       '/images/characters/Casual_2.gltf',
  HOODIE:       '/images/characters/Casual_Hoodie.gltf',
  WORKER:       '/images/characters/Worker.gltf',
  FARMER:       '/images/characters/Farmer.gltf',
  ADVENTURER:   '/images/characters/Adventurer.gltf',
  PUNK:         '/images/characters/Punk.gltf',
  BEACH:        '/images/characters/Beach.gltf',
  SWAT:         '/images/characters/Swat.gltf',
  SPACESUIT:    '/images/characters/Spacesuit.gltf',
} as const;

/** Characters to load at startup (most common roles) */
export const PRELOAD_PRIORITY = [
  CHARACTER.KING,
  CHARACTER.SUIT,
  CHARACTER.CASUAL,
  CHARACTER.HOODIE,
  CHARACTER.WORKER,
] as const;

/**
 * NPC pool — deterministic assignment so the same NPC index always
 * maps to the same outfit, avoiding visual "flicker" on re-load.
 */
const NPC_POOL = [
  CHARACTER.CASUAL,
  CHARACTER.HOODIE,
  CHARACTER.WORKER,
  CHARACTER.FARMER,
  CHARACTER.ADVENTURER,
  CHARACTER.PUNK,
  CHARACTER.BEACH,
] as const;

/** Get a deterministic NPC character URL based on a stable index */
export function getNpcCharacterUrl(npcIndex: number): string {
  return NPC_POOL[npcIndex % NPC_POOL.length];
}

// ── Animation name constants ───────────────────────────────────────────────────
export const ANIM = {
  IDLE:   'Idle',
  WALK:   'Walk',
  RUN:    'Run',
  WAVE:   'Wave',
  INTERACT: 'Interact',
  PUNCH_L:  'Punch_Left',
  PUNCH_R:  'Punch_Right',
  KICK_L:   'Kick_Left',
  KICK_R:   'Kick_Right',
  ROLL:   'Roll',
  DEATH:  'Death',
} as const;

// ── Core loading functions ─────────────────────────────────────────────────────

/** Internal: fetch + cache a glTF. Returns the same Promise for concurrent callers. */
function _loadRaw(url: string): Promise<GLTF> {
  if (!_cache.has(url)) {
    const p = new Promise<GLTF>((resolve, reject) => {
      _loader.load(url, resolve, undefined, (err) => {
        console.warn(`[CharacterLoader] Failed to load ${url}:`, err);
        reject(err);
      });
    });
    _cache.set(url, p);
  }
  return _cache.get(url)!;
}

export interface CharacterResult {
  /** Cloned scene graph, ready to add to the THREE.Scene */
  group: THREE.Group;
  /** Shared animation clips (no per-instance state) */
  clips: THREE.AnimationClip[];
}

/**
 * Load a character and return a clone ready for placement.
 * The underlying glTF is fetched only once; subsequent calls clone it.
 *
 * @param url   One of the CHARACTER.* constants
 * @param scale Uniform scale (default 1.0 — characters are ~1.8 units tall)
 */
export async function loadCharacter(
  url: string,
  scale = 1.0,
): Promise<CharacterResult> {
  const gltf  = await _loadRaw(url);
  const group = cloneSkeleton(gltf.scene) as THREE.Group;

  // Enable shadows on every skinned/static mesh
  group.traverse((node) => {
    if ((node as THREE.SkinnedMesh).isSkinnedMesh) {
      const sm = node as THREE.SkinnedMesh;
      sm.castShadow    = true;
      sm.receiveShadow = false; // characters rarely receive shadows — saves perf
      sm.frustumCulled = false; // Disable frustum culling to prevent invisible model bugs
    }
  });

  if (scale !== 1.0) group.scale.setScalar(scale);

  return { group, clips: gltf.animations };
}

/**
 * Fire-and-forget warm-up. Call early during city load so models
 * are already cached when agents need them.
 */
export function preloadCharacters(urls: readonly string[]): void {
  urls.forEach((url) => _loadRaw(url).catch(() => {}));
}

// ── Mixer helpers ──────────────────────────────────────────────────────────────

/**
 * Create a mixer and start playing an animation by name.
 * Returns null if the clip is not found (safe no-op).
 */
export function startAnimation(
  mixer: THREE.AnimationMixer,
  clips:  THREE.AnimationClip[],
  name:   string,
  loop    = true,
  fadeSec = 0.25,
): THREE.AnimationAction | null {
  const clip = THREE.AnimationClip.findByName(clips, name);
  if (!clip) return null;

  const action = mixer.clipAction(clip);
  action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
  if (!loop) action.clampWhenFinished = true;
  action.reset().fadeIn(fadeSec).play();
  return action;
}

/**
 * Cross-fade from the currently playing action to a new one.
 * Safe to call every frame — only fades if the target clip isn't already active.
 */
export function crossFadeTo(
  mixer:   THREE.AnimationMixer,
  clips:   THREE.AnimationClip[],
  name:    string,
  fadeSec = 0.2,
): void {
  const clip = THREE.AnimationClip.findByName(clips, name);
  if (!clip) return;

  const next = mixer.clipAction(clip);
  if (next.isRunning()) return; // already playing, skip

  next.reset().setEffectiveWeight(1).fadeIn(fadeSec).play();
  // Fade out every other clip that is currently active.
  // THREE.AnimationMixer doesn't expose a public "all actions" list,
  // so we iterate the known clips and stop ones that aren't `next`.
  clips.forEach((clip) => {
    const a = mixer.existingAction(clip);
    if (a && a !== next && a.isRunning()) a.fadeOut(fadeSec);
  });
}
