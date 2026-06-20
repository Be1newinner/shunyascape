import * as THREE from 'three';
import { SimContext } from './Types';

let groundMesh: THREE.Mesh | null = null;
let gridHelperMesh: THREE.GridHelper | null = null;

export function createLand(ctx: SimContext): {
  waterPlane: THREE.Mesh;
  buildPreview: THREE.Mesh;
} {
  const halfGridWorld = (ctx.gridSize * ctx.cellSize) / 2;

  // Grass Ground (covers entire scene including mountains area)
  const groundSize = Math.max(ctx.gridSize * ctx.cellSize + 160, 400);
  const groundGeom = ctx.getGeometry('ground', () => new THREE.PlaneGeometry(groundSize, groundSize));
  const groundMat = ctx.getMaterial('ground', { color: '#4a6840', roughness: 0.9, flatShading: true });
  groundMesh = new THREE.Mesh(groundGeom, groundMat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.y = -0.05;
  groundMesh.receiveShadow = true;
  ctx.scene.add(groundMesh);

  // Grid Floor Helper (Buildable area)
  gridHelperMesh = new THREE.GridHelper(ctx.gridSize * ctx.cellSize, ctx.gridSize, '#5a7a50', '#4a6840');
  gridHelperMesh.position.y = 0.01;
  ctx.scene.add(gridHelperMesh);

  // Water Bay on the left edge (decorative, separate from river)
  const waterGeom = ctx.getGeometry('water', () => new THREE.PlaneGeometry(80, Math.max(ctx.gridSize * ctx.cellSize + 80, 300)));
  const waterMat = ctx.getMaterial('water', {
    color: '#1a5f86',
    roughness: 0.05,
    metalness: 0.85,
    transparent: true,
    opacity: 0.8,
    flatShading: true
  });
  const waterPlane = new THREE.Mesh(waterGeom, waterMat);
  waterPlane.rotation.x = -Math.PI / 2;
  waterPlane.position.set(-halfGridWorld - 42, -0.02, 0);
  waterPlane.receiveShadow = true;
  ctx.scene.add(waterPlane);

  // Build Hover Preview
  const previewGeom = ctx.getGeometry('preview', () => new THREE.BoxGeometry(ctx.cellSize, 0.1, ctx.cellSize));
  const previewMat = new THREE.MeshBasicMaterial({
    color: 0x00ff00,
    transparent: true,
    opacity: 0.4,
    wireframe: false
  });
  const buildPreview = new THREE.Mesh(previewGeom, previewMat);
  buildPreview.position.set(0, 0.05, 0);
  buildPreview.visible = false;
  ctx.scene.add(buildPreview);

  return { waterPlane, buildPreview };
}

/** Call after grid expansion to resize the grid helper */
export function resizeGridHelper(scene: THREE.Scene, newGridSize: number, cellSize: number): void {
  if (gridHelperMesh) {
    scene.remove(gridHelperMesh);
    gridHelperMesh.dispose();
  }
  gridHelperMesh = new THREE.GridHelper(newGridSize * cellSize, newGridSize, '#5a7a50', '#4a6840');
  gridHelperMesh.position.y = 0.01;
  scene.add(gridHelperMesh);
}
