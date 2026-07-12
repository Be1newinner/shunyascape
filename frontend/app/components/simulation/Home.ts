import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SimContext } from './Types';
import { loadGltfAsset, CITY_KIT } from './GltfLoader';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function cellWorldPos(
  ctx: SimContext,
  x: number,
  z: number,
): [number, number] {
  const halfGrid = (ctx.gridSize * ctx.cellSize) / 2;
  return [
    x * ctx.cellSize - halfGrid + ctx.cellSize / 2,
    z * ctx.cellSize - halfGrid + ctx.cellSize / 2,
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// 🏠 HOUSE  — uses Building_Small_1 (glTF) with procedural fallback
// ─────────────────────────────────────────────────────────────────────────────

export function createHouseMesh(ctx: SimContext, x: number, z: number): THREE.Group {
  const group = new THREE.Group();
  const [worldX, worldZ] = cellWorldPos(ctx, x, z);
  group.position.set(worldX, 0, worldZ);

  // ── Immediate procedural stand-in (shows instantly while glTF loads) ────────
  const wallColor = ['#dedede', '#f0c2a2', '#a0c4ff', '#ffd6a5', '#caffbf'][
    Math.floor(Math.random() * 5)
  ];
  const wallsGeom = ctx.getGeometry('house_walls', () => new THREE.BoxGeometry(1.6, 1.2, 1.6));
  const wallsMat  = ctx.getMaterial(`walls_${wallColor}`, { color: wallColor, roughness: 0.85 });
  const walls     = new THREE.Mesh(wallsGeom, wallsMat);
  walls.position.y = 0.6;
  walls.castShadow   = true;
  walls.receiveShadow = true;
  group.add(walls);

  const roofGeom = ctx.getGeometry('house_roof', () => new THREE.ConeGeometry(1.3, 0.9, 4));
  const roofMat  = ctx.getMaterial('house_roof', { color: '#b22222', roughness: 0.7, flatShading: true });
  const roof     = new THREE.Mesh(roofGeom, roofMat);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 1.65;
  roof.castShadow = true;
  group.add(roof);

  const windowGeom = ctx.getGeometry('window', () => new THREE.BoxGeometry(0.3, 0.3, 0.05));
  const windowMat  = ctx.getMaterial('lit_window', { color: '#ffffff', emissive: '#000000', roughness: 0.1 });
  const win1       = new THREE.Mesh(windowGeom, windowMat);
  win1.position.set(0.3, 0.7, 0.81);
  group.add(win1);

  const win2 = new THREE.Mesh(windowGeom, windowMat);
  win2.position.set(-0.3, 0.7, -0.81);
  group.add(win2);

  const doorGeom = ctx.getGeometry('door', () => new THREE.BoxGeometry(0.4, 0.8, 0.02));
  const doorMat  = ctx.getMaterial('house_door', { color: '#5c4033', roughness: 0.9 });
  const door     = new THREE.Mesh(doorGeom, doorMat);
  door.position.set(-0.3, 0.4, 0.81);
  group.add(door);

  // ── Async: swap in the real glTF model once loaded ──────────────────────────
  // Scale factor: the megaKit building is ~5m wide; our cellSize is ~2.25 units.
  // We scale to roughly 1.8 units wide so it fits in one city cell.
  const gltfScale = (ctx.cellSize / 5.0) * 0.75;

  loadGltfAsset(CITY_KIT.BUILDING_SMALL, gltfScale)
    .then((gltfGroup) => {
      // Remove procedural stand-in children
      while (group.children.length > 0) {
        group.remove(group.children[0]);
      }

      // Random Y rotation so not every house faces the same way
      gltfGroup.rotation.y = (Math.floor(Math.random() * 4) * Math.PI) / 2;

      group.add(gltfGroup);
      group.matrixAutoUpdate = false;
      group.updateMatrix();
    })
    .catch(() => {
      // Silently keep the procedural fallback if glTF fails to load
    });

  return group;
}

// ─────────────────────────────────────────────────────────────────────────────
// 🏢 SKYSCRAPER — uses Building_Large_2 / Building_Medium_2 (glTF)
// ─────────────────────────────────────────────────────────────────────────────

export function createSkyscraperMesh(ctx: SimContext, x: number, z: number): THREE.Group {
  const group = new THREE.Group();
  const [worldX, worldZ] = cellWorldPos(ctx, x, z);
  group.position.set(worldX, 0, worldZ);

  const height     = 4.0 + Math.random() * 3.5;
  const widthSize  = 1.6 + Math.random() * 0.4;
  const glassColor = ['#3a86c8', '#1a365d', '#008080', '#2d3748'][Math.floor(Math.random() * 4)];

  // ── Immediate procedural stand-in ──────────────────────────────────────────
  const towerGeom = new THREE.BoxGeometry(widthSize, height, widthSize);
  const towerMat  = ctx.getMaterial(`sky_glass_${glassColor}`, {
    color: glassColor,
    roughness: 0.1,
    metalness: 0.9,
  });
  const tower = new THREE.Mesh(towerGeom, towerMat);
  tower.position.y = height / 2;
  tower.castShadow   = true;
  tower.receiveShadow = true;
  group.add(tower);

  // Merged window grid
  const winRows    = Math.floor(height * 2.5);
  const winCols    = 4;
  const gridWinGeom = ctx.getGeometry('skys_win', () => new THREE.BoxGeometry(0.12, 0.12, 0.02));
  const gridWinMat  = ctx.getMaterial('lit_window', { color: '#ffffff', emissive: '#000000', roughness: 0.1 });
  const windowGeoms: THREE.BufferGeometry[] = [];

  for (let r = 0; r < winRows; r++) {
    const yPos = 0.4 + r * 0.35;
    for (let c = 0; c < winCols; c++) {
      const xPos = (c - (winCols - 1) / 2) * (widthSize / winCols);
      const gN = gridWinGeom.clone(); gN.translate(xPos, yPos, widthSize / 2 + 0.01);                     windowGeoms.push(gN);
      const gS = gridWinGeom.clone(); gS.translate(xPos, yPos, -widthSize / 2 - 0.01);                    windowGeoms.push(gS);
      const gE = gridWinGeom.clone(); gE.rotateY(Math.PI / 2); gE.translate(widthSize / 2 + 0.01, yPos, xPos); windowGeoms.push(gE);
      const gW = gridWinGeom.clone(); gW.rotateY(Math.PI / 2); gW.translate(-widthSize / 2 - 0.01, yPos, xPos); windowGeoms.push(gW);
    }
  }
  if (windowGeoms.length > 0) {
    const merged = BufferGeometryUtils.mergeGeometries(windowGeoms, true);
    group.add(new THREE.Mesh(merged, gridWinMat));
    windowGeoms.forEach((g) => g.dispose());
  }

  const antGeom = ctx.getGeometry('antenna', () => new THREE.CylinderGeometry(0.04, 0.04, 1.0, 4));
  const antMat  = ctx.getMaterial('metal_ant', { color: '#cccccc', metalness: 0.8, roughness: 0.2 });
  const antenna = new THREE.Mesh(antGeom, antMat);
  antenna.position.y = height + 0.5;
  group.add(antenna);

  const beaconGeom = ctx.getGeometry('beacon', () => new THREE.SphereGeometry(0.08, 4, 4));
  const beaconMat  = ctx.getMaterial('red_beacon', { color: '#ff0000', emissive: '#ff0000', roughness: 0.1 });
  const beacon     = new THREE.Mesh(beaconGeom, beaconMat);
  beacon.position.y = height + 1.05;
  group.add(beacon);

  // ── Async: swap in the real glTF building once loaded ─────────────────────
  // Alternate between Large and Medium for visual variety
  const useLarge   = Math.random() > 0.5;
  const gltfUrl    = useLarge ? CITY_KIT.BUILDING_LARGE : CITY_KIT.BUILDING_MEDIUM;
  // MegaKit buildings are ~5m; scale so they fill ~1.8–2.0 world units wide
  const gltfScale  = (ctx.cellSize / 5.0) * (useLarge ? 0.95 : 0.85);

  loadGltfAsset(gltfUrl, gltfScale)
    .then((gltfGroup) => {
      while (group.children.length > 0) {
        group.remove(group.children[0]);
      }
      gltfGroup.rotation.y = (Math.floor(Math.random() * 4) * Math.PI) / 2;
      group.add(gltfGroup);
      group.matrixAutoUpdate = false;
      group.updateMatrix();
    })
    .catch(() => {
      // Keep procedural fallback
    });

  return group;
}

// ─────────────────────────────────────────────────────────────────────────────
// 🚧 CONSTRUCTION SITE  (unchanged — procedural only)
// ─────────────────────────────────────────────────────────────────────────────

export function createConstructionSiteMesh(ctx: SimContext, x: number, z: number): THREE.Group {
  const group = new THREE.Group();
  const [worldX, worldZ] = cellWorldPos(ctx, x, z);
  group.position.set(worldX, 0, worldZ);

  const dirtGeom = ctx.getGeometry('dirt_base', () => new THREE.BoxGeometry(3.0 - 0.1, 0.05, 3.0 - 0.1));
  const dirtMat  = ctx.getMaterial('dirt', { color: '#a07855', roughness: 0.95 });
  const dirt     = new THREE.Mesh(dirtGeom, dirtMat);
  dirt.position.y = 0.025;
  dirt.receiveShadow = true;
  group.add(dirt);

  const postGeom = ctx.getGeometry('post', () => new THREE.CylinderGeometry(0.05, 0.05, 0.8, 4));
  const postMat  = ctx.getMaterial('yellow_posts', { color: '#eebb33', roughness: 0.8 });
  const offsets  = [[1.3, 1.3], [-1.3, 1.3], [1.3, -1.3], [-1.3, -1.3]];
  offsets.forEach(([ox, oz]) => {
    const post = new THREE.Mesh(postGeom, postMat);
    post.position.set(ox, 0.4, oz);
    post.castShadow = true;
    group.add(post);
  });

  const bandMat      = ctx.getMaterial('site_tape', { color: '#333333', roughness: 0.9 });
  const longBandGeom = ctx.getGeometry('tape_long', () => new THREE.BoxGeometry(2.6, 0.1, 0.02));
  const sideBandGeom = ctx.getGeometry('tape_side', () => new THREE.BoxGeometry(0.02, 0.1, 2.6));

  const band1 = new THREE.Mesh(longBandGeom, bandMat); band1.position.set(0, 0.5,  1.3); group.add(band1);
  const band2 = new THREE.Mesh(longBandGeom, bandMat); band2.position.set(0, 0.5, -1.3); group.add(band2);
  const band3 = new THREE.Mesh(sideBandGeom, bandMat); band3.position.set( 1.3, 0.5, 0); group.add(band3);
  const band4 = new THREE.Mesh(sideBandGeom, bandMat); band4.position.set(-1.3, 0.5, 0); group.add(band4);

  return group;
}
