import * as THREE from 'three';
import { SimContext, GridCell } from './Types';

export function createRoadMesh(ctx: SimContext, x: number, z: number): THREE.Group {
  const group = new THREE.Group();
  const halfGrid = (ctx.gridSize * ctx.cellSize) / 2;
  const worldX = (x * ctx.cellSize) - halfGrid + ctx.cellSize / 2;
  const worldZ = (z * ctx.cellSize) - halfGrid + ctx.cellSize / 2;
  group.position.set(worldX, 0, worldZ);

  // Base dark grey asphalt
  const roadGeom = ctx.getGeometry('road_base', () => new THREE.BoxGeometry(ctx.cellSize, 0.08, ctx.cellSize));
  const roadMat = ctx.getMaterial('road_base', { color: '#2b2b2b', roughness: 0.8 });
  const roadMesh = new THREE.Mesh(roadGeom, roadMat);
  roadMesh.position.y = 0.04;
  roadMesh.receiveShadow = true;
  group.add(roadMesh);

  return group;
}

export function recalculateRoadConnections(ctx: SimContext, grid: GridCell[][]) {
  for (let x = 0; x < ctx.gridSize; x++) {
    for (let z = 0; z < ctx.gridSize; z++) {
      const cell = grid[x][z];
      if (cell.type !== 'road' || !cell.mesh) continue;

      // Clear existing markers/lines on the road mesh (keep only asphalt base)
      while (cell.mesh.children.length > 1) {
        cell.mesh.remove(cell.mesh.children[1]);
      }

      // Neighbors
      const nN = z > 0 && grid[x][z - 1].type === 'road';
      const nS = z < ctx.gridSize - 1 && grid[x][z + 1].type === 'road';
      const nW = x > 0 && grid[x - 1][z].type === 'road';
      const nE = x < ctx.gridSize - 1 && grid[x + 1][z].type === 'road';

      // Yellow dashes or solid lines depending on connections
      const lineMat = ctx.getMaterial('road_lines', { color: '#ffcc00', roughness: 0.9 });
      const lineGeomNS = ctx.getGeometry('line_ns', () => new THREE.BoxGeometry(0.1, 0.01, 1.0));
      const lineGeomWE = ctx.getGeometry('line_we', () => new THREE.BoxGeometry(1.0, 0.01, 0.1));

      // Straight north-south road
      if ((nN || nS) && !nW && !nE) {
        const l1 = new THREE.Mesh(lineGeomNS, lineMat);
        l1.position.set(0, 0.09, -0.8);
        cell.mesh.add(l1);

        const l2 = new THREE.Mesh(lineGeomNS, lineMat);
        l2.position.set(0, 0.09, 0.8);
        cell.mesh.add(l2);
      }
      // Straight west-east road
      else if ((nW || nE) && !nN && !nS) {
        const l1 = new THREE.Mesh(lineGeomWE, lineMat);
        l1.position.set(-0.8, 0.09, 0);
        cell.mesh.add(l1);

        const l2 = new THREE.Mesh(lineGeomWE, lineMat);
        l2.position.set(0.8, 0.09, 0);
        cell.mesh.add(l2);
      }
      // Crossroads or T-junctions
      else if ((nN || nS) && (nW || nE)) {
        const centerMarkGeom = ctx.getGeometry('road_center', () => new THREE.BoxGeometry(0.4, 0.01, 0.4));
        const centerMark = new THREE.Mesh(centerMarkGeom, lineMat);
        centerMark.position.set(0, 0.09, 0);
        cell.mesh.add(centerMark);
      }
    }
  }
}
