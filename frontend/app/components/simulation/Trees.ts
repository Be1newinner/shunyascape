import * as THREE from 'three';
import { SimContext } from './Types';

// ─────────────────────────────────────────────────────────────────────────────
// Tree species palette  — we pick one per cell based on position hash
// ─────────────────────────────────────────────────────────────────────────────
type TreeSpecies = 'oak' | 'pine' | 'cherry' | 'palm' | 'autumn';

function speciesAt(x: number, z: number): TreeSpecies {
  const h = (x * 7 + z * 13) % 5;
  return (['oak', 'pine', 'cherry', 'palm', 'autumn'] as TreeSpecies[])[h];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function jitter(v: number, amt: number) {
  return v + (Math.random() - 0.5) * amt;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────
export function createTreeMesh(ctx: SimContext, x: number, z: number): THREE.Group {
  const group = new THREE.Group();
  const halfGrid = (ctx.gridSize * ctx.cellSize) / 2;
  const worldX = x * ctx.cellSize - halfGrid + ctx.cellSize / 2;
  const worldZ = z * ctx.cellSize - halfGrid + ctx.cellSize / 2;
  group.position.set(worldX, 0, worldZ);

  // Slight random lean so trees look natural in a crowd
  group.rotation.y = Math.random() * Math.PI * 2;

  const species = speciesAt(x, z);

  switch (species) {
    case 'oak':     _buildOak(ctx, group);    break;
    case 'pine':    _buildPine(ctx, group);   break;
    case 'cherry':  _buildCherry(ctx, group); break;
    case 'palm':    _buildPalm(ctx, group);   break;
    case 'autumn':  _buildAutumn(ctx, group); break;
    default:        _buildOak(ctx, group);
  }

  return group;
}

// ─────────────────────────────────────────────────────────────────────────────
// 🌳 OAK — classic broad green canopy with thick trunk
// ─────────────────────────────────────────────────────────────────────────────
function _buildOak(ctx: SimContext, g: THREE.Group) {
  const trunkH   = jitter(1.1, 0.3);
  const trunkMat = ctx.getMaterial('trunk_oak', { color: '#4a3220', roughness: 0.97 });

  // Tapered trunk (wider at base)
  const trunkGeom = ctx.getGeometry('trunk_oak', () =>
    new THREE.CylinderGeometry(0.11, 0.18, trunkH, 6)
  );
  const trunk = new THREE.Mesh(trunkGeom, trunkMat);
  trunk.position.y = trunkH / 2;
  trunk.castShadow = true;
  g.add(trunk);

  // Bark rings for texture
  const barkMat = ctx.getMaterial('bark_ring', { color: '#3a2510', roughness: 1.0 });
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(
      ctx.getGeometry(`bark_r${i}`, () => new THREE.TorusGeometry(0.14, 0.015, 4, 8)),
      barkMat
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.25 + i * 0.32;
    g.add(ring);
  }

  // 3-layer canopy (bottom wide, top small = roundish dome)
  const greens  = ['#2d6a1a', '#3a7a22', '#4a9030'];
  const radii   = [1.05, 0.80, 0.55];
  const yOffsets = [trunkH + 0.10, trunkH + 0.68, trunkH + 1.15];
  greens.forEach((col, i) => {
    const mat  = ctx.getMaterial(`oak_foliage_${i}`, { color: col, roughness: 0.85, flatShading: true });
    const geom = ctx.getGeometry(`oak_sphere_${i}`, () =>
      new THREE.IcosahedronGeometry(radii[i], 1)
    );
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.y = yOffsets[i];
    mesh.position.x = jitter(0, 0.08);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
  });

  // A few small fruit/dots (darker green spheres peeking out)
  const fruitMat = ctx.getMaterial('oak_fruit', { color: '#1e4d0f', roughness: 0.9 });
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2;
    const fGeom = ctx.getGeometry('oak_blob', () => new THREE.SphereGeometry(0.22, 5, 4));
    const f = new THREE.Mesh(fGeom, fruitMat);
    f.position.set(
      Math.cos(ang) * 0.7,
      trunkH + 0.45,
      Math.sin(ang) * 0.7
    );
    g.add(f);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 🌲 PINE — tall, dark green layered spire
// ─────────────────────────────────────────────────────────────────────────────
function _buildPine(ctx: SimContext, g: THREE.Group) {
  const totalH = jitter(2.6, 0.5);
  const trunkMat = ctx.getMaterial('trunk_pine', { color: '#3d2b18', roughness: 0.98 });

  const trunkGeom = ctx.getGeometry('trunk_pine', () =>
    new THREE.CylinderGeometry(0.08, 0.16, totalH * 0.45, 5)
  );
  const trunk = new THREE.Mesh(trunkGeom, trunkMat);
  trunk.position.y = (totalH * 0.45) / 2;
  trunk.castShadow = true;
  g.add(trunk);

  // 4 stacked cone layers, each smaller/higher = classic pine shape
  const layers = [
    { r: 0.88, h: 0.75, y: totalH * 0.32, col: '#1a4a0d' },
    { r: 0.68, h: 0.70, y: totalH * 0.55, col: '#1f5512' },
    { r: 0.50, h: 0.65, y: totalH * 0.72, col: '#245e16' },
    { r: 0.28, h: 0.55, y: totalH * 0.87, col: '#296919' },
  ];
  layers.forEach((l, i) => {
    const mat  = ctx.getMaterial(`pine_layer_${i}`, { color: l.col, roughness: 0.9, flatShading: true });
    const geom = ctx.getGeometry(`pine_cone_${i}`, () => new THREE.ConeGeometry(l.r, l.h, 7));
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.y = l.y;
    mesh.castShadow = true;
    g.add(mesh);
  });

  // Snow caps on top two layers
  const snowMat = ctx.getMaterial('snow_cap', { color: '#dff0fb', roughness: 0.6 });
  [{ r: 0.30, h: 0.18, y: totalH * 0.72 + 0.28 }, { r: 0.12, h: 0.12, y: totalH * 0.87 + 0.24 }].forEach((s, i) => {
    const geom = ctx.getGeometry(`pine_snow_${i}`, () => new THREE.ConeGeometry(s.r, s.h, 6));
    const mesh = new THREE.Mesh(geom, snowMat);
    mesh.position.y = s.y;
    g.add(mesh);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 🌸 CHERRY BLOSSOM — pale pink puffy canopy, light trunk
// ─────────────────────────────────────────────────────────────────────────────
function _buildCherry(ctx: SimContext, g: THREE.Group) {
  const trunkH   = jitter(0.9, 0.2);
  const trunkMat = ctx.getMaterial('trunk_cherry', { color: '#6b3a2a', roughness: 0.95 });

  // Gnarled trunk: 2 slightly offset cylinders
  for (let i = 0; i < 2; i++) {
    const geom = ctx.getGeometry(`cherry_trunk_${i}`, () => new THREE.CylinderGeometry(0.06, 0.12, trunkH, 5));
    const mesh = new THREE.Mesh(geom, trunkMat);
    mesh.position.set(i * 0.06 - 0.03, trunkH / 2, i * 0.04 - 0.02);
    mesh.rotation.z = (i - 0.5) * 0.1;
    mesh.castShadow = true;
    g.add(mesh);
  }

  // Fluffy blossom puffs
  const pinkShades = ['#f9a8c9', '#f472b6', '#ec4899', '#fce7f3'];
  for (let i = 0; i < 7; i++) {
    const ang = (i / 7) * Math.PI * 2;
    const r   = i === 0 ? 0 : 0.58;
    const col = pinkShades[i % pinkShades.length];
    const mat  = ctx.getMaterial(`cherry_puff_${col}`, { color: col, roughness: 0.9, flatShading: true });
    const size = jitter(0.55, 0.2);
    const geom = ctx.getGeometry(`cherry_ico_${i}`, () => new THREE.IcosahedronGeometry(size, 1));
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(
      Math.cos(ang) * r,
      trunkH + 0.5 + (i === 0 ? 0.2 : Math.random() * 0.4),
      Math.sin(ang) * r
    );
    mesh.castShadow = true;
    g.add(mesh);
  }

  // Falling petals (flat tiny diamonds at base)
  const petalMat = ctx.getMaterial('cherry_petal', { color: '#fce7f3', roughness: 0.7, transparent: true, opacity: 0.8 });
  for (let i = 0; i < 6; i++) {
    const geom = ctx.getGeometry('cherry_petal', () => new THREE.CircleGeometry(0.06, 4));
    const petal = new THREE.Mesh(geom, petalMat);
    petal.position.set(jitter(0, 0.5), jitter(0.05, 0.05), jitter(0, 0.5));
    petal.rotation.set(-Math.PI / 2 + jitter(0, 0.4), Math.random() * Math.PI * 2, 0);
    g.add(petal);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 🌴 PALM — tropical, tall segmented trunk, wide fronds
// ─────────────────────────────────────────────────────────────────────────────
function _buildPalm(ctx: SimContext, g: THREE.Group) {
  const h       = jitter(2.2, 0.4);
  const trunkMat = ctx.getMaterial('trunk_palm', { color: '#8b6914', roughness: 0.97 });

  // Segmented trunk with slight curve
  const segments = 5;
  let prevY = 0;
  for (let i = 0; i < segments; i++) {
    const segH = h / segments;
    const geom = ctx.getGeometry(`palm_seg_${i}`, () => new THREE.CylinderGeometry(0.08, 0.14, segH, 6));
    const seg  = new THREE.Mesh(geom, trunkMat);
    const tiltX = Math.sin((i / segments) * Math.PI) * 0.08;
    seg.position.set(tiltX, prevY + segH / 2, 0);
    seg.rotation.z = tiltX * 0.3;
    seg.castShadow = true;
    g.add(seg);
    prevY += segH;
  }

  // Segment rings (darker bands)
  const ringMat = ctx.getMaterial('palm_ring', { color: '#5a4208', roughness: 1.0 });
  for (let i = 1; i < segments; i++) {
    const ring = new THREE.Mesh(
      ctx.getGeometry(`palm_ring_${i}`, () => new THREE.TorusGeometry(0.1, 0.012, 4, 8)),
      ringMat
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = (i / segments) * h;
    g.add(ring);
  }

  // Crown of 6 drooping fronds
  const frondMat = ctx.getMaterial('frond_green', { color: '#3d8c10', roughness: 0.85, flatShading: true });
  for (let i = 0; i < 6; i++) {
    const ang  = (i / 6) * Math.PI * 2;
    const geom = ctx.getGeometry(`frond_${i}`, () => new THREE.BoxGeometry(0.06, 0.06, 0.9));
    const frond = new THREE.Mesh(geom, frondMat);
    frond.position.set(Math.cos(ang) * 0.45, h + 0.1, Math.sin(ang) * 0.45);
    frond.rotation.y = ang;
    frond.rotation.z = -Math.PI / 5; // droop
    g.add(frond);

    // Leaf tip widening
    const tip = new THREE.Mesh(
      ctx.getGeometry(`frond_tip_${i}`, () => new THREE.BoxGeometry(0.12, 0.04, 0.5)),
      frondMat
    );
    tip.position.set(Math.cos(ang) * 0.85, h - 0.15, Math.sin(ang) * 0.85);
    tip.rotation.y = ang;
    tip.rotation.z = -Math.PI / 3.5;
    g.add(tip);
  }

  // Coconuts cluster
  const coconutMat = ctx.getMaterial('coconut', { color: '#6b4c11', roughness: 0.9 });
  for (let i = 0; i < 3; i++) {
    const ang = (i / 3) * Math.PI * 2;
    const geom = ctx.getGeometry(`coconut_${i}`, () => new THREE.SphereGeometry(0.1, 6, 5));
    const nut = new THREE.Mesh(geom, coconutMat);
    nut.position.set(Math.cos(ang) * 0.18, h + 0.05, Math.sin(ang) * 0.18);
    g.add(nut);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 🍂 AUTUMN OAK — warm orange/red canopy with sparse leaves
// ─────────────────────────────────────────────────────────────────────────────
function _buildAutumn(ctx: SimContext, g: THREE.Group) {
  const trunkH   = jitter(1.2, 0.25);
  const trunkMat = ctx.getMaterial('trunk_autumn', { color: '#4a2e14', roughness: 0.97 });

  const trunkGeom = ctx.getGeometry('trunk_autumn', () => new THREE.CylinderGeometry(0.10, 0.17, trunkH, 6));
  const trunk = new THREE.Mesh(trunkGeom, trunkMat);
  trunk.position.y = trunkH / 2;
  trunk.castShadow = true;
  g.add(trunk);

  // Bare branches (thin cylinders)
  const branchMat = ctx.getMaterial('branch_autumn', { color: '#3d2308', roughness: 0.99 });
  const branches = [
    { dx: 0.3, dy: 0.3, dz: 0.1, len: 0.5, ang: 0.6 },
    { dx: -0.28, dy: 0.28, dz: -0.05, len: 0.45, ang: -0.5 },
    { dx: 0.05, dy: 0.35, dz: 0.25, len: 0.4, ang: 0.4 },
  ];
  branches.forEach((b, i) => {
    const geom = ctx.getGeometry(`autumn_branch_${i}`, () => new THREE.CylinderGeometry(0.03, 0.05, b.len, 4));
    const mesh = new THREE.Mesh(geom, branchMat);
    mesh.position.set(b.dx, trunkH + b.dy, b.dz);
    mesh.rotation.z = b.ang;
    mesh.castShadow = true;
    g.add(mesh);
  });

  // Warm-coloured leaf puffs
  const autumnColors = ['#c0392b', '#e67e22', '#e74c3c', '#f39c12', '#d35400'];
  for (let i = 0; i < 8; i++) {
    const ang  = (i / 8) * Math.PI * 2;
    const r    = i % 3 === 0 ? 0.1 : 0.65;
    const col  = autumnColors[i % autumnColors.length];
    const mat  = ctx.getMaterial(`autumn_leaf_${col}`, { color: col, roughness: 0.88, flatShading: true });
    const size = jitter(0.45, 0.18);
    const geom = ctx.getGeometry(`autumn_ico_${i}`, () => new THREE.IcosahedronGeometry(size, 1));
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(Math.cos(ang) * r, trunkH + 0.5 + Math.random() * 0.6, Math.sin(ang) * r);
    mesh.castShadow = true;
    g.add(mesh);
  }

  // Scattered fallen leaves on the ground
  const leafMat = ctx.getMaterial('fallen_leaf', { color: '#b7440a', roughness: 0.9 });
  for (let i = 0; i < 5; i++) {
    const geom = ctx.getGeometry(`fallen_${i}`, () => new THREE.CircleGeometry(0.08, 4));
    const leaf = new THREE.Mesh(geom, leafMat);
    leaf.rotation.x = -Math.PI / 2;
    leaf.position.set(jitter(0, 0.7), 0.005, jitter(0, 0.7));
    g.add(leaf);
  }
}
