import * as THREE from 'three';
import { SimContext } from './Types';

export function createLand(ctx: SimContext): {
  waterPlane: THREE.Mesh;
  buildPreview: THREE.Mesh;
} {
  const halfGridWorld = (ctx.gridSize * ctx.cellSize) / 2;

  // Grass Ground
  const groundGeom = ctx.getGeometry('ground', () => new THREE.PlaneGeometry(300, 300));
  const groundMat = ctx.getMaterial('ground', { color: '#557a46', roughness: 0.9, flatShading: true });
  const ground = new THREE.Mesh(groundGeom, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  ctx.scene.add(ground);

  // Grid Floor Helper (Buildable area)
  const gridHelper = new THREE.GridHelper(ctx.gridSize * ctx.cellSize, ctx.gridSize, '#779e6b', '#608655');
  gridHelper.position.y = 0.01;
  ctx.scene.add(gridHelper);

  // Water Bay on the left edge
  const waterGeom = ctx.getGeometry('water', () => new THREE.PlaneGeometry(120, 300));
  const waterMat = ctx.getMaterial('water', {
    color: '#286086',
    roughness: 0.1,
    metalness: 0.8,
    transparent: true,
    opacity: 0.8,
    flatShading: true
  });
  const waterPlane = new THREE.Mesh(waterGeom, waterMat);
  waterPlane.rotation.x = -Math.PI / 2;
  waterPlane.position.set(-halfGridWorld - 60 / 2 - 2, -0.02, 0);
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
