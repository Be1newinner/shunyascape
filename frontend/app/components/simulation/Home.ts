import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SimContext } from './Types';

export function createHouseMesh(ctx: SimContext, x: number, z: number): THREE.Group {
  const group = new THREE.Group();
  const halfGrid = (ctx.gridSize * ctx.cellSize) / 2;
  const worldX = (x * ctx.cellSize) - halfGrid + ctx.cellSize / 2;
  const worldZ = (z * ctx.cellSize) - halfGrid + ctx.cellSize / 2;
  group.position.set(worldX, 0, worldZ);

  // Main base walls
  const wallColor = ['#dedede', '#f0c2a2', '#a0c4ff', '#ffd6a5', '#caffbf'][Math.floor(Math.random() * 5)];
  const wallsGeom = ctx.getGeometry('house_walls', () => new THREE.BoxGeometry(1.6, 1.2, 1.6));
  const wallsMat = ctx.getMaterial(`walls_${wallColor}`, { color: wallColor, roughness: 0.85 });
  const walls = new THREE.Mesh(wallsGeom, wallsMat);
  walls.position.y = 0.6;
  walls.castShadow = true;
  walls.receiveShadow = true;
  group.add(walls);

  // Pitched Red roof
  const roofGeom = ctx.getGeometry('house_roof', () => new THREE.ConeGeometry(1.3, 0.9, 4));
  const roofMat = ctx.getMaterial('house_roof', { color: '#b22222', roughness: 0.7, flatShading: true });
  const roof = new THREE.Mesh(roofGeom, roofMat);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 1.2 + 0.45;
  roof.castShadow = true;
  group.add(roof);

  // Windows (glow at night)
  const windowGeom = ctx.getGeometry('window', () => new THREE.BoxGeometry(0.3, 0.3, 0.05));
  const windowMat = ctx.getMaterial('lit_window', {
    color: '#ffffff',
    emissive: '#000000',
    roughness: 0.1
  });

  // Front window
  const win1 = new THREE.Mesh(windowGeom, windowMat);
  win1.position.set(0.3, 0.7, 0.81);
  group.add(win1);

  // Back window
  const win2 = new THREE.Mesh(windowGeom, windowMat);
  win2.position.set(-0.3, 0.7, -0.81);
  group.add(win2);

  // Door
  const doorGeom = ctx.getGeometry('door', () => new THREE.BoxGeometry(0.4, 0.8, 0.02));
  const doorMat = ctx.getMaterial('house_door', { color: '#5c4033', roughness: 0.9 });
  const door = new THREE.Mesh(doorGeom, doorMat);
  door.position.set(-0.3, 0.4, 0.81);
  group.add(door);

  return group;
}

export function createSkyscraperMesh(ctx: SimContext, x: number, z: number): THREE.Group {
  const group = new THREE.Group();
  const halfGrid = (ctx.gridSize * ctx.cellSize) / 2;
  const worldX = (x * ctx.cellSize) - halfGrid + ctx.cellSize / 2;
  const worldZ = (z * ctx.cellSize) - halfGrid + ctx.cellSize / 2;
  group.position.set(worldX, 0, worldZ);

  const height = 4.0 + Math.random() * 3.5;
  const widthSize = 1.6 + Math.random() * 0.4;
  const glassColor = ['#3a86c8', '#1a365d', '#008080', '#2d3748'][Math.floor(Math.random() * 4)];

  // Glass skyscraper body
  const towerGeom = new THREE.BoxGeometry(widthSize, height, widthSize); // Custom height, no cache
  const towerMat = ctx.getMaterial(`sky_glass_${glassColor}`, {
    color: glassColor,
    roughness: 0.1,
    metalness: 0.9
  });
  const tower = new THREE.Mesh(towerGeom, towerMat);
  tower.position.y = height / 2;
  tower.castShadow = true;
  tower.receiveShadow = true;
  group.add(tower);

  // Add visual window grids on sides (merged into a single geometry for massive draw call savings)
  const winRows = Math.floor(height * 2.5);
  const winCols = 4;
  const gridWinGeom = ctx.getGeometry('skys_win', () => new THREE.BoxGeometry(0.12, 0.12, 0.02));
  const gridWinMat = ctx.getMaterial('lit_window', { color: '#ffffff', emissive: '#000000', roughness: 0.1 });
  const windowGeometries: THREE.BufferGeometry[] = [];

  for (let r = 0; r < winRows; r++) {
    const yPos = 0.4 + r * 0.35;
    for (let c = 0; c < winCols; c++) {
      const xPos = (c - (winCols - 1) / 2) * (widthSize / winCols);

      // North face
      const gN = gridWinGeom.clone();
      gN.translate(xPos, yPos, widthSize / 2 + 0.01);
      windowGeometries.push(gN);

      // South face
      const gS = gridWinGeom.clone();
      gS.translate(xPos, yPos, -widthSize / 2 - 0.01);
      windowGeometries.push(gS);

      // East face
      const gE = gridWinGeom.clone();
      gE.rotateY(Math.PI / 2);
      gE.translate(widthSize / 2 + 0.01, yPos, xPos);
      windowGeometries.push(gE);

      // West face
      const gW = gridWinGeom.clone();
      gW.rotateY(Math.PI / 2);
      gW.translate(-widthSize / 2 - 0.01, yPos, xPos);
      windowGeometries.push(gW);
    }
  }

  if (windowGeometries.length > 0) {
    const mergedWinGeom = BufferGeometryUtils.mergeGeometries(windowGeometries, true);
    const mergedWinMesh = new THREE.Mesh(mergedWinGeom, gridWinMat);
    mergedWinMesh.castShadow = false;
    mergedWinMesh.receiveShadow = false;
    group.add(mergedWinMesh);

    // Dispose of the temporary cloned geometries to prevent memory leaks
    windowGeometries.forEach((g) => g.dispose());
  }

  // Antenna on top
  const antGeom = ctx.getGeometry('antenna', () => new THREE.CylinderGeometry(0.04, 0.04, 1.0, 4));
  const antMat = ctx.getMaterial('metal_ant', { color: '#cccccc', metalness: 0.8, roughness: 0.2 });
  const antenna = new THREE.Mesh(antGeom, antMat);
  antenna.position.y = height + 0.5;
  group.add(antenna);

  // Beacon light on top of antenna
  const beaconGeom = ctx.getGeometry('beacon', () => new THREE.SphereGeometry(0.08, 4, 4));
  const beaconMat = ctx.getMaterial('red_beacon', { color: '#ff0000', emissive: '#ff0000', roughness: 0.1 });
  const beacon = new THREE.Mesh(beaconGeom, beaconMat);
  beacon.position.y = height + 1.05;
  group.add(beacon);

  return group;
}

export function createConstructionSiteMesh(ctx: SimContext, x: number, z: number): THREE.Group {
  const group = new THREE.Group();
  const halfGrid = (ctx.gridSize * ctx.cellSize) / 2;
  const worldX = (x * ctx.cellSize) - halfGrid + ctx.cellSize / 2;
  const worldZ = (z * ctx.cellSize) - halfGrid + ctx.cellSize / 2;
  group.position.set(worldX, 0, worldZ);

  // Site base dirt/sand
  const dirtGeom = ctx.getGeometry('dirt_base', () => new THREE.BoxGeometry(3.0 - 0.1, 0.05, 3.0 - 0.1));
  const dirtMat = ctx.getMaterial('dirt', { color: '#a07855', roughness: 0.95 });
  const dirt = new THREE.Mesh(dirtGeom, dirtMat);
  dirt.position.y = 0.025;
  dirt.receiveShadow = true;
  group.add(dirt);

  // Warning post columns at corners
  const postGeom = ctx.getGeometry('post', () => new THREE.CylinderGeometry(0.05, 0.05, 0.8, 4));
  const postMat = ctx.getMaterial('yellow_posts', { color: '#eebb33', roughness: 0.8 });
  const offsets = [
    [1.3, 1.3],
    [-1.3, 1.3],
    [1.3, -1.3],
    [-1.3, -1.3]
  ];

  offsets.forEach(offset => {
    const post = new THREE.Mesh(postGeom, postMat);
    post.position.set(offset[0], 0.4, offset[1]);
    post.castShadow = true;
    group.add(post);
  });

  // Striped warning barrier bands connecting the posts
  const bandMat = ctx.getMaterial('site_tape', { color: '#333333', roughness: 0.9 });
  const longBandGeom = ctx.getGeometry('tape_long', () => new THREE.BoxGeometry(2.6, 0.1, 0.02));
  const sideBandGeom = ctx.getGeometry('tape_side', () => new THREE.BoxGeometry(0.02, 0.1, 2.6));

  const band1 = new THREE.Mesh(longBandGeom, bandMat);
  band1.position.set(0, 0.5, 1.3);
  group.add(band1);

  const band2 = new THREE.Mesh(longBandGeom, bandMat);
  band2.position.set(0, 0.5, -1.3);
  group.add(band2);

  const band3 = new THREE.Mesh(sideBandGeom, bandMat);
  band3.position.set(1.3, 0.5, 0);
  group.add(band3);

  const band4 = new THREE.Mesh(sideBandGeom, bandMat);
  band4.position.set(-1.3, 0.5, 0);
  group.add(band4);

  return group;
}
