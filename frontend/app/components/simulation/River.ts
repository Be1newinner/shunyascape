import * as THREE from 'three';

export interface RiverSystem {
  update: (delta: number, elapsed: number) => void;
  dispose: () => void;
}

/**
 * Creates a winding river that flows from one corner of the map to the other,
 * curving beautifully along the city edge.
 */
export function createRiver(scene: THREE.Scene, halfGridWorld: number): RiverSystem {
  const riverMeshes: THREE.Mesh[] = [];
  const riverMaterials: THREE.MeshStandardMaterial[] = [];

  // ── River path: sinusoidal curve from NW to SE edge ───────────────────────
  // Control points form a gentle S-curve flowing from top-left to bottom-right
  const riverOffset = halfGridWorld + 6; // just outside the buildable area
  const curvePoints: THREE.Vector3[] = [
    new THREE.Vector3(-riverOffset - 10, 0, -halfGridWorld - 20),
    new THREE.Vector3(-riverOffset - 5, 0, -halfGridWorld * 0.3),
    new THREE.Vector3(-riverOffset + 8, 0, 0),
    new THREE.Vector3(-riverOffset - 3, 0, halfGridWorld * 0.4),
    new THREE.Vector3(-riverOffset + 5, 0, halfGridWorld + 10),
    new THREE.Vector3(-riverOffset - 5, 0, halfGridWorld + 20),
  ];

  const curve = new THREE.CatmullRomCurve3(curvePoints, false, 'catmullrom', 0.5);

  // ── Water tube ─────────────────────────────────────────────────────────────
  const tubeGeom = new THREE.TubeGeometry(curve, 60, 2.8, 8, false);
  const waterMat = new THREE.MeshStandardMaterial({
    color: '#2277aa',
    roughness: 0.05,
    metalness: 0.5,
    transparent: true,
    opacity: 0.82,
    // We'll animate UV offset to simulate river flow
  });

  const riverTube = new THREE.Mesh(tubeGeom, waterMat);
  riverTube.receiveShadow = true;
  riverTube.position.y = -0.12;
  scene.add(riverTube);
  riverMeshes.push(riverTube);
  riverMaterials.push(waterMat);

  // ── Secondary gloss highlight surface (slightly narrower) ──────────────────
  const glossTubeGeom = new THREE.TubeGeometry(curve, 40, 1.8, 6, false);
  const glossMat = new THREE.MeshStandardMaterial({
    color: '#44aadd',
    roughness: 0.0,
    metalness: 0.9,
    transparent: true,
    opacity: 0.45,
    emissive: '#1155aa',
    emissiveIntensity: 0.15,
  });
  const glossTube = new THREE.Mesh(glossTubeGeom, glossMat);
  glossTube.position.y = -0.05;
  scene.add(glossTube);
  riverMeshes.push(glossTube);
  riverMaterials.push(glossMat);

  // ── Green river banks ──────────────────────────────────────────────────────
  _createRiverBanks(scene, curve, halfGridWorld);

  // ── River bank trees & rocks ───────────────────────────────────────────────
  _createBankDecorations(scene, curve);

  // ── Update function for animation ─────────────────────────────────────────
  const update = (_delta: number, elapsed: number) => {
    // Animate UV offset to simulate water flowing
    waterMat.map?.offset.setY(elapsed * 0.3);
    glossMat.map?.offset.setY(elapsed * 0.5);

    // Bob the river slightly
    riverTube.position.y = -0.12 + Math.sin(elapsed * 0.8) * 0.015;
    glossTube.position.y = -0.05 + Math.sin(elapsed * 1.1) * 0.01;

    // Shimmer opacity on gloss layer
    glossMat.opacity = 0.35 + Math.sin(elapsed * 2.5) * 0.08;
  };

  const dispose = () => {
    tubeGeom.dispose();
    glossTubeGeom.dispose();
    waterMat.dispose();
    glossMat.dispose();
  };

  return { update, dispose };
}

function _createRiverBanks(
  scene: THREE.Scene,
  curve: THREE.CatmullRomCurve3,
  _halfGridWorld: number
): void {
  const bankMat = new THREE.MeshStandardMaterial({ color: '#3d5e2e', roughness: 0.9 });
  const sandMat = new THREE.MeshStandardMaterial({ color: '#c8b87e', roughness: 0.95 });

  // Sample points along curve and create bank segments
  const numSamples = 30;
  for (let i = 0; i < numSamples; i++) {
    const t = i / numSamples;
    const pos = curve.getPoint(t);
    const tangent = curve.getTangent(t).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

    // Left bank (green grass)
    const leftBank = new THREE.Mesh(
      new THREE.PlaneGeometry(4, 3.5 + Math.random()),
      bankMat
    );
    leftBank.rotation.x = -Math.PI / 2;
    leftBank.position.copy(pos).addScaledVector(normal, 4.0);
    leftBank.position.y = -0.04;
    leftBank.receiveShadow = true;
    scene.add(leftBank);

    // Right bank (sandy)
    const rightBank = new THREE.Mesh(
      new THREE.PlaneGeometry(3, 2.5 + Math.random()),
      sandMat
    );
    rightBank.rotation.x = -Math.PI / 2;
    rightBank.position.copy(pos).addScaledVector(normal, -3.5);
    rightBank.position.y = -0.04;
    rightBank.receiveShadow = true;
    scene.add(rightBank);
  }
}

function _createBankDecorations(scene: THREE.Scene, curve: THREE.CatmullRomCurve3): void {
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#5c4033', roughness: 0.95 });
  const foliageMat = new THREE.MeshStandardMaterial({
    color: '#2a5e15',
    roughness: 0.8,
    flatShading: true,
  });
  const rockMat = new THREE.MeshStandardMaterial({ color: '#888', roughness: 0.9 });

  const numTrees = 18;
  for (let i = 0; i < numTrees; i++) {
    const t = i / numTrees;
    const pos = curve.getPoint(t);
    const tangent = curve.getTangent(t).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const side = Math.random() > 0.5 ? 1 : -1;
    const spread = 5 + Math.random() * 4;

    const treePos = new THREE.Vector3()
      .copy(pos)
      .addScaledVector(normal, side * spread);
    treePos.y = 0;

    const treeGroup = new THREE.Group();
    treeGroup.position.copy(treePos);

    // Willow-like droopy bank tree
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.15, 1.6, 6),
      trunkMat
    );
    trunk.position.y = 0.8;
    trunk.castShadow = true;
    treeGroup.add(trunk);

    const leaves = new THREE.Mesh(
      new THREE.SphereGeometry(0.7 + Math.random() * 0.3, 7, 5),
      foliageMat
    );
    leaves.scale.y = 1.3;
    leaves.position.y = 1.85;
    leaves.castShadow = true;
    treeGroup.add(leaves);

    scene.add(treeGroup);

    // Occasional riverside rock
    if (Math.random() < 0.4) {
      const rock = new THREE.Mesh(
        new THREE.SphereGeometry(0.3 + Math.random() * 0.25, 5, 4),
        rockMat
      );
      rock.scale.y = 0.5;
      rock.position.copy(pos).addScaledVector(normal, (side * spread * 0.4));
      rock.position.y = 0.1;
      rock.castShadow = true;
      scene.add(rock);
    }
  }
}
