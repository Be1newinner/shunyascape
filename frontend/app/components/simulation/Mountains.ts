import * as THREE from 'three';

/** Creates all 4 corner mountain clusters far outside the city grid */
export function createAllMountains(scene: THREE.Scene, halfGridWorld: number): void {
  const far = halfGridWorld + 30;

  // NW corner
  _createMountainCluster(scene, -far, -far, 1.0);
  // NE corner
  _createMountainCluster(scene, far, -far, 1.2);
  // SW corner
  _createMountainCluster(scene, -far, far, 0.9);
  // SE corner
  _createMountainCluster(scene, far, far, 1.1);
}

function _createMountainCluster(scene: THREE.Scene, cx: number, cz: number, scale: number): void {
  // Each cluster = 1 main peak + 2-3 smaller peaks
  const peaks = [
    { dx: 0, dz: 0, h: 30 * scale, r: 9 * scale },       // main peak
    { dx: -7 * scale, dz: 5 * scale, h: 18 * scale, r: 6 * scale },
    { dx: 8 * scale, dz: 3 * scale, h: 22 * scale, r: 7 * scale },
    { dx: 2 * scale, dz: -8 * scale, h: 14 * scale, r: 5 * scale },
  ];

  peaks.forEach(peak => {
    _createMountainPeak(scene, cx + peak.dx, cz + peak.dz, peak.h, peak.r);
  });
}

function _createMountainPeak(
  scene: THREE.Scene,
  x: number,
  z: number,
  height: number,
  baseRadius: number
): void {
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  // Rock material — slightly random-ish flat shading
  const rockMat = new THREE.MeshLambertMaterial({
    color: '#7a8a9a',
    flatShading: true,
  });
  const snowMat = new THREE.MeshLambertMaterial({
    color: '#e8eef5',
    flatShading: true,
  });

  // Main rock cone (tall, narrow)
  const mainConeGeom = new THREE.ConeGeometry(baseRadius, height, 7);
  // Randomise vertices slightly for natural look
  _jitterGeometry(mainConeGeom, 0.6);
  const mainCone = new THREE.Mesh(mainConeGeom, rockMat);
  mainCone.position.y = height / 2;
  mainCone.castShadow = true;
  mainCone.receiveShadow = true;
  group.add(mainCone);

  // Mid-level rocky band
  const midConeGeom = new THREE.ConeGeometry(baseRadius * 0.85, height * 0.45, 8);
  _jitterGeometry(midConeGeom, 0.4);
  const midCone = new THREE.Mesh(midConeGeom, rockMat);
  midCone.position.y = height * 0.25;
  midCone.castShadow = true;
  group.add(midCone);

  // Snow cap (top 35% of peak)
  const snowCapGeom = new THREE.ConeGeometry(baseRadius * 0.42, height * 0.35, 7);
  _jitterGeometry(snowCapGeom, 0.25);
  const snowCap = new THREE.Mesh(snowCapGeom, snowMat);
  snowCap.position.y = height * 0.825;
  snowCap.castShadow = true;
  group.add(snowCap);

  // Small snow blob at very tip
  const tipGeom = new THREE.SphereGeometry(baseRadius * 0.18, 6, 5);
  const tip = new THREE.Mesh(tipGeom, snowMat);
  tip.position.y = height + 0.5;
  group.add(tip);

  scene.add(group);
}

/** Slightly randomises vertex positions for a natural non-uniform mountain look */
function _jitterGeometry(geom: THREE.BufferGeometry, amount: number): void {
  const pos = geom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    // Don't jitter apex vertex (y is max) to keep tip sharp-ish
    const y = pos.getY(i);
    if (y < pos.getY(0) * 0.95) {
      pos.setX(i, pos.getX(i) + (Math.random() - 0.5) * amount);
      pos.setZ(i, pos.getZ(i) + (Math.random() - 0.5) * amount);
    }
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();
}
