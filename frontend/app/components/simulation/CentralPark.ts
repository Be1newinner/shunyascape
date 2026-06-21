import * as THREE from 'three';
import { SimContext } from './Types';

/** Creates the central park at the center of the grid, spanning parkRadius cells in each direction */
export function createCentralPark(ctx: SimContext): void {
  const gs = ctx.gridSize;
  const cs = ctx.cellSize;
  const halfGrid = (gs * cs) / 2;

  const centerCell = Math.floor(gs / 2);
  const parkRadius = 9; // ±9 cells from center = 18×18 park

  const parkMinX = centerCell - parkRadius;
  const parkMaxX = centerCell + parkRadius - 1;
  const parkMinZ = centerCell - parkRadius;
  const parkMaxZ = centerCell + parkRadius - 1;

  const parkWorldMinX = parkMinX * cs - halfGrid;
  const parkWorldMinZ = parkMinZ * cs - halfGrid;
  const parkWorldW = (parkMaxX - parkMinX + 1) * cs;
  const parkWorldD = (parkMaxZ - parkMinZ + 1) * cs;
  const parkCenterX = parkWorldMinX + parkWorldW / 2;
  const parkCenterZ = parkWorldMinZ + parkWorldD / 2;

  // ── 1. Bright grass base ──────────────────────────────────────────────────
  const grassGeom = new THREE.PlaneGeometry(parkWorldW, parkWorldD);
  const grassMat = new THREE.MeshLambertMaterial({ color: '#4a7c59' });
  const grassPlane = new THREE.Mesh(grassGeom, grassMat);
  grassPlane.rotation.x = -Math.PI / 2;
  grassPlane.position.set(parkCenterX, 0.02, parkCenterZ);
  grassPlane.receiveShadow = true;
  ctx.scene.add(grassPlane);

  // ── 2. Diagonal stone paths ───────────────────────────────────────────────
  const pathMat = new THREE.MeshLambertMaterial({ color: '#b0a090' });

  // North-South path (thin vertical strip through center)
  const pathH = new THREE.Mesh(new THREE.PlaneGeometry(cs * 0.5, parkWorldD), pathMat);
  pathH.rotation.x = -Math.PI / 2;
  pathH.position.set(parkCenterX, 0.03, parkCenterZ);
  pathH.receiveShadow = true;
  ctx.scene.add(pathH);

  // East-West path (thin horizontal strip through center)
  const pathV = new THREE.Mesh(new THREE.PlaneGeometry(parkWorldW, cs * 0.5), pathMat);
  pathV.rotation.x = -Math.PI / 2;
  pathV.position.set(parkCenterX, 0.03, parkCenterZ);
  pathV.receiveShadow = true;
  ctx.scene.add(pathV);

  // ── 3. Fountain at center ─────────────────────────────────────────────────
  _createFountain(ctx, parkCenterX, parkCenterZ);

  // ── 4. Park benches (one per quadrant) ────────────────────────────────────
  const benchOffset = cs * 4.5;
  _createBench(ctx, parkCenterX - benchOffset, parkCenterZ - benchOffset, Math.PI * 0.25);
  _createBench(ctx, parkCenterX + benchOffset, parkCenterZ - benchOffset, Math.PI * -0.25);
  _createBench(ctx, parkCenterX - benchOffset, parkCenterZ + benchOffset, Math.PI * 0.75);
  _createBench(ctx, parkCenterX + benchOffset, parkCenterZ + benchOffset, Math.PI * -0.75);
  // Extra benches
  _createBench(ctx, parkCenterX, parkCenterZ - benchOffset, 0);
  _createBench(ctx, parkCenterX, parkCenterZ + benchOffset, Math.PI);
  _createBench(ctx, parkCenterX - benchOffset, parkCenterZ, Math.PI * 0.5);
  _createBench(ctx, parkCenterX + benchOffset, parkCenterZ, Math.PI * -0.5);

  // ── 5. Lamp posts ─────────────────────────────────────────────────────────
  const lampOffset = cs * 6.5;
  _createLampPost(ctx, parkCenterX - lampOffset, parkCenterZ - lampOffset);
  _createLampPost(ctx, parkCenterX + lampOffset, parkCenterZ - lampOffset);
  _createLampPost(ctx, parkCenterX - lampOffset, parkCenterZ + lampOffset);
  _createLampPost(ctx, parkCenterX + lampOffset, parkCenterZ + lampOffset);
  _createLampPost(ctx, parkCenterX - lampOffset, parkCenterZ);
  _createLampPost(ctx, parkCenterX + lampOffset, parkCenterZ);
  _createLampPost(ctx, parkCenterX, parkCenterZ - lampOffset);
  _createLampPost(ctx, parkCenterX, parkCenterZ + lampOffset);

  // ── 6. Flower beds ────────────────────────────────────────────────────────
  const flowerColors = [0xff6688, 0xffdd44, 0xff9922, 0xee44ff, 0x44ddff, 0xff4444, 0x44ff88, 0xffaa22];
  const flowerPositions = [
    { x: parkCenterX - cs * 3.0, z: parkCenterZ - cs * 6.5 },
    { x: parkCenterX + cs * 3.0, z: parkCenterZ - cs * 6.5 },
    { x: parkCenterX - cs * 3.0, z: parkCenterZ + cs * 6.5 },
    { x: parkCenterX + cs * 3.0, z: parkCenterZ + cs * 6.5 },
    { x: parkCenterX - cs * 6.5, z: parkCenterZ - cs * 3.0 },
    { x: parkCenterX + cs * 6.5, z: parkCenterZ - cs * 3.0 },
    { x: parkCenterX - cs * 6.5, z: parkCenterZ + cs * 3.0 },
    { x: parkCenterX + cs * 6.5, z: parkCenterZ + cs * 3.0 },
  ];

  flowerPositions.forEach((fp, i) => {
    _createFlowerBed(ctx, fp.x, fp.z, flowerColors[i % flowerColors.length]);
  });

  // ── 7. Decorative park trees in corners ───────────────────────────────────
  const treeOffset = cs * 7.8;
  _createParkTree(ctx, parkCenterX - treeOffset, parkCenterZ - treeOffset);
  _createParkTree(ctx, parkCenterX + treeOffset, parkCenterZ - treeOffset);
  _createParkTree(ctx, parkCenterX - treeOffset, parkCenterZ + treeOffset);
  _createParkTree(ctx, parkCenterX + treeOffset, parkCenterZ + treeOffset);
  // Extra trees along edges
  _createParkTree(ctx, parkCenterX - treeOffset, parkCenterZ);
  _createParkTree(ctx, parkCenterX + treeOffset, parkCenterZ);
  _createParkTree(ctx, parkCenterX, parkCenterZ - treeOffset);
  _createParkTree(ctx, parkCenterX, parkCenterZ + treeOffset);
  _createParkTree(ctx, parkCenterX - cs * 4, parkCenterZ - cs * 4);
  _createParkTree(ctx, parkCenterX + cs * 4, parkCenterZ - cs * 4);
  _createParkTree(ctx, parkCenterX - cs * 4, parkCenterZ + cs * 4);
  _createParkTree(ctx, parkCenterX + cs * 4, parkCenterZ + cs * 4);
}

// ── Helpers ────────────────────────────────────────────────────────────────

function _createFountain(ctx: SimContext, x: number, z: number) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  // Basin
  const basinGeom = new THREE.CylinderGeometry(1.0, 1.1, 0.35, 12);
  const stoneMat = new THREE.MeshLambertMaterial({ color: '#8b9aaa' });
  const basin = new THREE.Mesh(basinGeom, stoneMat);
  basin.position.y = 0.18;
  basin.castShadow = true;
  basin.receiveShadow = true;
  group.add(basin);

  // Inner water pool
  const waterGeom = new THREE.CylinderGeometry(0.85, 0.85, 0.05, 12);
  const waterMat = new THREE.MeshLambertMaterial({
    color: '#2090cc',
    transparent: true,
    opacity: 0.85,
  });
  const water = new THREE.Mesh(waterGeom, waterMat);
  water.position.y = 0.36;
  group.add(water);

  // Center column
  const colGeom = new THREE.CylinderGeometry(0.1, 0.15, 1.0, 8);
  const column = new THREE.Mesh(colGeom, stoneMat);
  column.position.y = 0.85;
  column.castShadow = true;
  group.add(column);

  // Top bowl
  const topBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.25, 0.2, 10), stoneMat);
  topBowl.position.y = 1.45;
  group.add(topBowl);

  // Animated water spray particles (static blue spheres)
  const sprayMat = new THREE.MeshLambertMaterial({
    color: '#66ccff',
    emissive: '#224466',
    transparent: true,
    opacity: 0.7,
  });
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const r = 0.25 + Math.random() * 0.2;
    const spray = new THREE.Mesh(new THREE.SphereGeometry(0.04, 5, 5), sprayMat);
    spray.position.set(Math.cos(angle) * r, 1.55 + Math.random() * 0.3, Math.sin(angle) * r);
    group.add(spray);
  }

  ctx.scene.add(group);
}

function _createBench(ctx: SimContext, x: number, z: number, rotY: number) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = rotY;

  const woodMat = new THREE.MeshLambertMaterial({ color: '#7a4a20' });
  const metalMat = new THREE.MeshLambertMaterial({ color: '#555' });

  // Seat
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.07, 0.35), woodMat);
  seat.position.y = 0.38;
  seat.castShadow = true;
  group.add(seat);

  // Backrest
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.28, 0.06), woodMat);
  back.position.set(0, 0.62, -0.15);
  back.rotation.x = 0.1;
  back.castShadow = true;
  group.add(back);

  // Legs (2 metal stands)
  [-0.35, 0.35].forEach(lx => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.38, 0.35), metalMat);
    leg.position.set(lx, 0.19, 0);
    leg.castShadow = true;
    group.add(leg);
  });

  ctx.scene.add(group);
}

function _createLampPost(ctx: SimContext, x: number, z: number) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const metalMat = new THREE.MeshLambertMaterial({ color: '#3a3a4a' });

  // Pole
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.8, 8), metalMat);
  pole.position.y = 1.4;
  pole.castShadow = true;
  group.add(pole);

  // Arm
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.05), metalMat);
  arm.position.set(0.25, 2.8, 0);
  group.add(arm);

  // Lamp globe (glowing)
  const globeMat = new THREE.MeshLambertMaterial({
    color: '#fffbe0',
    emissive: '#ffe066',
    emissiveIntensity: 1.2,
    transparent: true,
    opacity: 0.92,
  });
  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), globeMat);
  globe.position.set(0.5, 2.8, 0);
  group.add(globe);

  // Point light
  const light = new THREE.PointLight('#ffe088', 1.2, 6.0);
  light.position.set(0.5, 2.8, 0);
  group.add(light);

  ctx.scene.add(group);
}

function _createFlowerBed(ctx: SimContext, x: number, z: number, color: number) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const soilMat = new THREE.MeshLambertMaterial({ color: '#3a2a1a' });
  const flowerMat = new THREE.MeshLambertMaterial({
    color,
    emissive: new THREE.Color(color).multiplyScalar(0.2),
  });
  const leafMat = new THREE.MeshLambertMaterial({ color: '#2d6e2d' });

  // Soil patch
  const soil = new THREE.Mesh(new THREE.CircleGeometry(0.5, 8), soilMat);
  soil.rotation.x = -Math.PI / 2;
  soil.position.y = 0.025;
  group.add(soil);

  // Flower spheres
  for (let i = 0; i < 7; i++) {
    const angle = (i / 7) * Math.PI * 2;
    const r = i === 0 ? 0 : 0.28 + Math.random() * 0.1;
    const flower = new THREE.Mesh(new THREE.SphereGeometry(0.08 + Math.random() * 0.04, 6, 6), flowerMat);
    flower.position.set(Math.cos(angle) * r, 0.2 + Math.random() * 0.1, Math.sin(angle) * r);
    flower.castShadow = true;
    group.add(flower);

    // Stem
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.2, 4), leafMat);
    stem.position.set(Math.cos(angle) * r, 0.1, Math.sin(angle) * r);
    group.add(stem);
  }

  ctx.scene.add(group);
}

function _createParkTree(ctx: SimContext, x: number, z: number) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const trunkMat = new THREE.MeshLambertMaterial({ color: '#5c4033' });
  const foliageMat = new THREE.MeshLambertMaterial({ color: '#2d6b10', flatShading: true });

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.3, 6), trunkMat);
  trunk.position.y = 0.65;
  trunk.castShadow = true;
  group.add(trunk);

  // 3-layer foliage
  [[1.3, 0.85], [1.75, 0.7], [2.15, 0.55]].forEach(([h, r]) => {
    const leaves = new THREE.Mesh(new THREE.ConeGeometry(r, 0.9, 7), foliageMat);
    leaves.position.y = h;
    leaves.castShadow = true;
    group.add(leaves);
  });

  ctx.scene.add(group);
}

/** Returns the set of grid cells that belong to the central park */
export function getParkCells(gridSize: number): Set<string> {
  const center = Math.floor(gridSize / 2);
  const parkRadius = 9;
  const set = new Set<string>();
  for (let x = center - parkRadius; x < center + parkRadius; x++) {
    for (let z = center - parkRadius; z < center + parkRadius; z++) {
      set.add(`${x}_${z}`);
    }
  }
  return set;
}
