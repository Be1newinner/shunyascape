import * as THREE from 'three';
import { SimContext } from './Types';

export function createTreeMesh(ctx: SimContext, x: number, z: number): THREE.Group {
  const group = new THREE.Group();
  const halfGrid = (ctx.gridSize * ctx.cellSize) / 2;
  const worldX = (x * ctx.cellSize) - halfGrid + ctx.cellSize / 2;
  const worldZ = (z * ctx.cellSize) - halfGrid + ctx.cellSize / 2;
  group.position.set(worldX, 0, worldZ);

  // Wooden trunk
  const trunkGeom = ctx.getGeometry('trunk', () => new THREE.CylinderGeometry(0.15, 0.22, 1.2, 5));
  const trunkMat = ctx.getMaterial('trunk', { color: '#5c4033', roughness: 0.95 });
  const trunk = new THREE.Mesh(trunkGeom, trunkMat);
  trunk.position.y = 0.6;
  trunk.castShadow = false;
  trunk.receiveShadow = false;
  group.add(trunk);

  // Fluffy green leaves (stacked cones for low-poly feel)
  const foliageMat = ctx.getMaterial('foliage', { color: '#3a5f0b', roughness: 0.8, flatShading: true });
  const leafHeights = [1.2, 1.7, 2.1];
  const leafSizes = [0.9, 0.7, 0.5];

  leafHeights.forEach((h, idx) => {
    const leafGeom = new THREE.ConeGeometry(leafSizes[idx], 0.8, 5);
    const leaves = new THREE.Mesh(leafGeom, foliageMat);
    leaves.position.y = h;
    leaves.castShadow = false;
    group.add(leaves);
  });

  return group;
}
