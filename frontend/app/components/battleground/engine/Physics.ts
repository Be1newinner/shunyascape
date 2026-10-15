import RAPIER from "@dimforge/rapier3d-compat";
import type * as THREE from "three/webgpu";

export type Rapier = typeof RAPIER;

/** Collision layers (membership bits). */
export const LAYER = {
  WORLD: 0x1,
  PLAYER: 0x2,
  BOT: 0x4,
} as const;

export const groups = (membership: number, filter: number) => ((membership & 0xffff) << 16) | (filter & 0xffff);

export const WORLD_GROUPS = groups(LAYER.WORLD, 0xffff);
export const CHARACTER_FILTER = LAYER.WORLD | LAYER.PLAYER | LAYER.BOT;

export interface RayHit {
  point: THREE.Vector3Like;
  normal: THREE.Vector3Like;
  distance: number;
  collider: RAPIER.Collider;
}

/** Thin wrapper around a Rapier world used only for queries and kinematic characters. */
export class Physics {
  world!: RAPIER.World;
  rapier: Rapier = RAPIER;
  private ray!: RAPIER.Ray;

  async init() {
    await RAPIER.init();
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  }

  addTrimesh(vertices: Float32Array, indices: Uint32Array) {
    const desc = RAPIER.ColliderDesc.trimesh(vertices, indices).setCollisionGroups(WORLD_GROUPS);
    return this.world.createCollider(desc);
  }

  /** Static box. Rotation is a yaw in radians. */
  addBox(x: number, y: number, z: number, hx: number, hy: number, hz: number, yaw = 0) {
    const desc = RAPIER.ColliderDesc.cuboid(hx, hy, hz)
      .setTranslation(x, y, z)
      .setRotation(yawQuat(yaw))
      .setCollisionGroups(WORLD_GROUPS);
    return this.world.createCollider(desc);
  }

  addCylinder(x: number, y: number, z: number, halfHeight: number, radius: number) {
    const desc = RAPIER.ColliderDesc.cylinder(halfHeight, radius).setTranslation(x, y, z).setCollisionGroups(WORLD_GROUPS);
    return this.world.createCollider(desc);
  }

  addConvexHull(points: Float32Array) {
    const desc = RAPIER.ColliderDesc.convexHull(points);
    if (!desc) return null;
    return this.world.createCollider(desc.setCollisionGroups(WORLD_GROUPS));
  }

  /** Raycast. `filter` is a mask of LAYER bits the ray may hit. */
  castRay(
    origin: THREE.Vector3Like,
    dir: THREE.Vector3Like,
    maxDist: number,
    filter: number,
    exclude?: RAPIER.Collider,
  ): RayHit | null {
    this.ray.origin = { x: origin.x, y: origin.y, z: origin.z };
    this.ray.dir = { x: dir.x, y: dir.y, z: dir.z };
    const hit = this.world.castRayAndGetNormal(
      this.ray,
      maxDist,
      true,
      undefined,
      groups(0xffff, filter),
      exclude,
    );
    if (!hit) return null;
    const t = hit.timeOfImpact;
    return {
      point: { x: origin.x + dir.x * t, y: origin.y + dir.y * t, z: origin.z + dir.z * t },
      normal: hit.normal,
      distance: t,
      collider: hit.collider,
    };
  }

  step() {
    // Only kinematic characters and static colliders: update the query pipeline.
    this.world.step();
  }
}

export function yawQuat(yaw: number) {
  return { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) };
}
