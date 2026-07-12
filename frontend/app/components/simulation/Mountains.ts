import * as THREE from 'three';

/** Creates all 4 corner mountain ranges with ridges, forests, and snow peaks */
export function createAllMountains(scene: THREE.Scene, halfGridWorld: number): void {
  const far = halfGridWorld + 28;

  _createMountainRange(scene, -far, -far, 1.00, 0);
  _createMountainRange(scene, far,  -far, 1.25, 1);
  _createMountainRange(scene, -far,  far, 0.90, 2);
  _createMountainRange(scene,  far,   far, 1.12, 3);
}

// ─────────────────────────────────────────────────────────────────────────────
// Mountain range — a staggered ridge of peaks + foothills + forest skirt
// ─────────────────────────────────────────────────────────────────────────────
function _createMountainRange(
  scene: THREE.Scene,
  cx: number,
  cz: number,
  scale: number,
  seed: number,
): void {
  const peaks = [
    // main peak
    { dx: 0,            dz: 0,            h: 38 * scale, r: 11 * scale, snow: 0.38 },
    // secondary peaks in a staggered ridge
    { dx: -9 * scale,   dz:  6 * scale,   h: 26 * scale, r:  8 * scale, snow: 0.35 },
    { dx:  10 * scale,  dz:  4 * scale,   h: 30 * scale, r:  9 * scale, snow: 0.37 },
    { dx:  3 * scale,   dz: -10 * scale,  h: 20 * scale, r:  7 * scale, snow: 0.32 },
    { dx: -13 * scale,  dz: -5 * scale,   h: 14 * scale, r:  5 * scale, snow: 0.28 },
    { dx:  15 * scale,  dz: -8 * scale,   h: 17 * scale, r:  6 * scale, snow: 0.30 },
    // foothills
    { dx: -18 * scale,  dz:  0,           h:  9 * scale, r:  6 * scale, snow: 0 },
    { dx:  18 * scale,  dz:  3 * scale,   h: 10 * scale, r:  6 * scale, snow: 0 },
    { dx:   2 * scale,  dz:  14 * scale,  h:  8 * scale, r:  5 * scale, snow: 0 },
    { dx:  -5 * scale,  dz: -14 * scale,  h:  7 * scale, r:  5 * scale, snow: 0 },
  ];

  peaks.forEach((p, i) => {
    _createPeak(scene, cx + p.dx, cz + p.dz, p.h, p.r, p.snow, seed + i);
  });

  // Forest skirt around the base
  _createForestSkirt(scene, cx, cz, scale);

  // Atmospheric haze plane (semi-transparent fog sheet at base)
  _createMistPlane(scene, cx, cz, scale);
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual mountain peak with rock strata layers
// ─────────────────────────────────────────────────────────────────────────────
function _createPeak(
  scene: THREE.Scene,
  x: number,
  z: number,
  height: number,
  baseRadius: number,
  snowFraction: number,
  seed: number,
): void {
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  // 3 rock shades for variety across peaks
  const rockPalette = ['#6e7d8c', '#7a8a9a', '#5c6d7a', '#8a9aaa', '#95a0a8'];
  const rockColor   = rockPalette[seed % rockPalette.length];

  const rockMat = new THREE.MeshLambertMaterial({ color: rockColor, flatShading: true });
  const snowMat = new THREE.MeshLambertMaterial({ color: '#e8eef5', flatShading: true });
  const iceMat  = new THREE.MeshLambertMaterial({
    color: '#c8def5',
    flatShading: true,
    transparent: true,
    opacity: 0.85,
  });

  // ── Base rock mass (wide flat cone) ──────────────────────────────────────
  const baseGeom = new THREE.ConeGeometry(baseRadius * 1.3, height * 0.35, 8);
  _jitterGeo(baseGeom, 0.9);
  const base = new THREE.Mesh(baseGeom, rockMat);
  base.position.y = height * 0.175;
  base.receiveShadow = true;
  group.add(base);

  // ── Mid rocky cone ────────────────────────────────────────────────────────
  const midGeom = new THREE.ConeGeometry(baseRadius * 0.9, height * 0.55, 7);
  _jitterGeo(midGeom, 0.7);
  const mid = new THREE.Mesh(midGeom, rockMat);
  mid.position.y = height * 0.38;
  mid.castShadow  = true;
  mid.receiveShadow = true;
  group.add(mid);

  // ── Main peak (tall narrow cone) ─────────────────────────────────────────
  const mainGeom = new THREE.ConeGeometry(baseRadius * 0.55, height * 0.72, 6);
  _jitterGeo(mainGeom, 0.55);
  const main = new THREE.Mesh(mainGeom, rockMat);
  main.position.y = height * 0.65;
  main.castShadow = true;
  group.add(main);

  // ── Dark rock cliff face on one side (adds dimension) ────────────────────
  const cliffMat = new THREE.MeshLambertMaterial({
    color: '#3d4a56',
    flatShading: true,
  });
  const cliffGeom = new THREE.ConeGeometry(baseRadius * 0.42, height * 0.6, 4);
  _jitterGeo(cliffGeom, 0.4);
  const cliff = new THREE.Mesh(cliffGeom, cliffMat);
  cliff.position.set(baseRadius * 0.28, height * 0.6, baseRadius * 0.12);
  cliff.rotation.z = 0.35;
  cliff.castShadow = true;
  group.add(cliff);

  if (snowFraction > 0) {
    const snowBase = height * (1 - snowFraction);

    // ── Snow collar (wide low cone at snow line) ──────────────────────────
    const collarGeom = new THREE.ConeGeometry(baseRadius * 0.52, height * 0.1, 7);
    _jitterGeo(collarGeom, 0.25);
    const collar = new THREE.Mesh(collarGeom, snowMat);
    collar.position.y = snowBase - height * 0.05;
    group.add(collar);

    // ── Snow cap (main) ───────────────────────────────────────────────────
    const capGeom = new THREE.ConeGeometry(baseRadius * 0.38, height * snowFraction * 0.9, 6);
    _jitterGeo(capGeom, 0.2);
    const cap = new THREE.Mesh(capGeom, snowMat);
    cap.position.y = snowBase + (height * snowFraction * 0.9) / 2;
    cap.castShadow = true;
    group.add(cap);

    // ── Glacier/ice seam running down the peak ────────────────────────────
    const glacierGeom = new THREE.BoxGeometry(baseRadius * 0.12, height * snowFraction * 0.55, baseRadius * 0.08);
    _jitterGeo(glacierGeom, 0.1);
    const glacier = new THREE.Mesh(glacierGeom, iceMat);
    glacier.position.set(baseRadius * 0.05, snowBase + height * snowFraction * 0.28, baseRadius * 0.05);
    glacier.rotation.z = 0.15;
    group.add(glacier);

    // ── Small snow patches on rock faces ─────────────────────────────────
    for (let i = 0; i < 4; i++) {
      const ang   = (i / 4) * Math.PI * 2;
      const pGeom = new THREE.SphereGeometry(baseRadius * 0.12, 4, 3);
      const patch = new THREE.Mesh(pGeom, snowMat);
      patch.position.set(
        Math.cos(ang) * baseRadius * 0.3,
        snowBase - height * 0.06,
        Math.sin(ang) * baseRadius * 0.3,
      );
      group.add(patch);
    }

    // ── Tip blob ──────────────────────────────────────────────────────────
    const tipGeom = new THREE.SphereGeometry(baseRadius * 0.14, 5, 4);
    const tip = new THREE.Mesh(tipGeom, snowMat);
    tip.position.y = height + 0.4;
    group.add(tip);
  }

  scene.add(group);
}

// ─────────────────────────────────────────────────────────────────────────────
// Forest skirt — small dark pine silhouettes ringing the base
// ─────────────────────────────────────────────────────────────────────────────
function _createForestSkirt(
  scene: THREE.Scene,
  cx: number,
  cz: number,
  scale: number,
): void {
  const treeMat = new THREE.MeshLambertMaterial({ color: '#1a3d0a', flatShading: true });
  const trunkMat = new THREE.MeshLambertMaterial({ color: '#2d1a0a' });
  const count   = 32;
  const minR    = 8 * scale;
  const maxR    = 18 * scale;

  for (let i = 0; i < count; i++) {
    const ang  = (i / count) * Math.PI * 2 + (i % 3) * 0.2;
    const r    = minR + (i % 4) * ((maxR - minR) / 4) + Math.random() * 2 * scale;
    const px   = cx + Math.cos(ang) * r;
    const pz   = cz + Math.sin(ang) * r;
    const h    = (1.5 + Math.random() * 2.5) * scale;

    const group = new THREE.Group();
    group.position.set(px, 0, pz);

    // Trunk
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1 * scale, 0.16 * scale, h * 0.35, 4),
      trunkMat
    );
    trunk.position.y = h * 0.175;
    group.add(trunk);

    // 3 pine layers
    [[0.55, 0.5, h * 0.3], [0.40, 0.45, h * 0.55], [0.22, 0.38, h * 0.75]].forEach(([r2, lh, ly]) => {
      const layer = new THREE.Mesh(
        new THREE.ConeGeometry(r2 * scale, lh * scale, 5),
        treeMat
      );
      layer.position.y = ly;
      group.add(layer);
    });

    scene.add(group);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Atmospheric mist plane — a semi-transparent disc at the mountain base
// ─────────────────────────────────────────────────────────────────────────────
function _createMistPlane(
  scene: THREE.Scene,
  cx: number,
  cz: number,
  scale: number,
): void {
  const mistMat = new THREE.MeshBasicMaterial({
    color: '#c8ddf5',
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const geom = new THREE.CircleGeometry(22 * scale, 12);
  const mist = new THREE.Mesh(geom, mistMat);
  mist.rotation.x = -Math.PI / 2;
  mist.position.set(cx, 1.5, cz);
  scene.add(mist);
}

// ─────────────────────────────────────────────────────────────────────────────
// Vertex jitter for organic-looking geometry
// ─────────────────────────────────────────────────────────────────────────────
function _jitterGeo(geom: THREE.BufferGeometry, amount: number): void {
  const pos    = geom.attributes.position;
  let   maxY   = -Infinity;
  for (let i = 0; i < pos.count; i++) maxY = Math.max(maxY, pos.getY(i));

  for (let i = 0; i < pos.count; i++) {
    const y  = pos.getY(i);
    const t  = 1 - y / maxY; // stronger jitter near base
    const jt = amount * t;
    pos.setX(i, pos.getX(i) + (Math.random() - 0.5) * jt);
    pos.setZ(i, pos.getZ(i) + (Math.random() - 0.5) * jt);
    if (y < maxY * 0.95) {
      pos.setY(i, y + (Math.random() - 0.5) * jt * 0.5);
    }
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();
}
