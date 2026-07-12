/**
 * GltfLoader.ts
 * ─────────────────────────────────────────────────────────────────
 * Shared, cached GLTFLoader for the City MegaKit assets.
 *
 * Usage:
 *   const group = await loadGltfAsset('/images/city_kit/buildings/Building_Small_1.gltf');
 *   scene.add(group);
 *
 * Each .gltf is fetched only ONCE.  Subsequent calls return a cloned
 * scene so every building/road gets its own transform while sharing
 * the same underlying BufferGeometry / texture objects.
 * ─────────────────────────────────────────────────────────────────
 */

import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

// ── Singleton loader ───────────────────────────────────────────────────────────
const _loader = new GLTFLoader();

// Raw parsed GLTF cache (keyed by URL)
const _cache = new Map<string, Promise<GLTF>>();

/**
 * Load a glTF file and cache the raw result.
 * Returns the SAME Promise for concurrent callers loading the same URL.
 */
function _loadRaw(url: string): Promise<GLTF> {
  if (!_cache.has(url)) {
    const p = new Promise<GLTF>((resolve, reject) => {
      _loader.load(url, resolve, undefined, reject);
    });
    _cache.set(url, p);
  }
  return _cache.get(url)!;
}

/**
 * Load a glTF asset and return a **cloned** THREE.Group ready to be placed in
 * the scene. Each call returns a fresh clone so the caller owns the transform.
 *
 * @param url   Public URL e.g. '/images/city_kit/buildings/Building_Small_1.gltf'
 * @param scale Uniform scale to apply (default 1). Adjust to match cellSize.
 */
export async function loadGltfAsset(
  url: string,
  scale = 1,
): Promise<THREE.Group> {
  const gltf = await _loadRaw(url);
  const clone = gltf.scene.clone(true);

  // Apply shadows to every mesh inside
  clone.traverse((node) => {
    if ((node as THREE.Mesh).isMesh) {
      const mesh = node as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });

  if (scale !== 1) {
    clone.scale.setScalar(scale);
  }

  return clone;
}

/**
 * Pre-warm the cache by kicking off loads for a list of URLs.
 * Call this early during city initialisation so models are ready when needed.
 */
export function preloadGltfAssets(urls: string[]): void {
  urls.forEach((url) => _loadRaw(url));
}

// ── Convenience path constants ─────────────────────────────────────────────────
export const CITY_KIT = {
  // Buildings
  BUILDING_LARGE:  '/images/city_kit/buildings/Building_Large_2.gltf',
  BUILDING_MEDIUM: '/images/city_kit/buildings/Building_Medium_2_001.gltf',
  BUILDING_SMALL:  '/images/city_kit/buildings/Building_Small_1.gltf',

  // Streets
  STREET_4WAY:        '/images/city_kit/streets/Street_4WayIntersection.gltf',
  STREET_4LANE:       '/images/city_kit/streets/Street_4Lane.gltf',
  STREET_2LANE:       '/images/city_kit/streets/Street_2Lane.gltf',
  STREET_T:           '/images/city_kit/streets/Street_TIntersection.gltf',
  STREET_CURVE_4LANE: '/images/city_kit/streets/Street_Curve_4LaneShort.gltf',
  STREET_CURVE_2LANE: '/images/city_kit/streets/Street_Curve_2Lane.gltf',
  SIDEWALK_STRAIGHT:  '/images/city_kit/streets/Sidewalk_Straight_3m.gltf',
  SIDEWALK_CORNER:    '/images/city_kit/streets/Sidewalk_Corner_Round_3m.gltf',
  SIDEWALK_PLANTER:   '/images/city_kit/streets/Sidewalk_Planter.gltf',

  // Props
  PROP_BOLLARD:  '/images/city_kit/props/Prop_Bollard.gltf',
  PROP_AC_UNIT:  '/images/city_kit/props/Prop_ACUnit.gltf',
  PROP_PLANTER:  '/images/city_kit/props/Prop_Planter_Single.gltf',
  PROP_MANHOLE:  '/images/city_kit/props/Prop_ManholeCover.gltf',
  STAIRS:        '/images/city_kit/props/Stairs_Entrance_Concrete.gltf',
} as const;

/** All building URLs — pass to preloadGltfAssets() */
export const ALL_BUILDING_URLS = [
  CITY_KIT.BUILDING_LARGE,
  CITY_KIT.BUILDING_MEDIUM,
  CITY_KIT.BUILDING_SMALL,
] as const;
