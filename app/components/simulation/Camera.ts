import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class CameraManager {
  public camera: THREE.PerspectiveCamera;
  public controls: OrbitControls;
  private container: HTMLDivElement;
  private prevClientX: number | null = null;
  private prevClientY: number | null = null;

  constructor(container: HTMLDivElement, renderer: THREE.WebGLRenderer) {
    this.container = container;
    const width = container.clientWidth;
    const height = container.clientHeight;

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.set(35, 30, 45);

    this.controls = new OrbitControls(this.camera, renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = false;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 150;
    this.controls.target.set(0, 0, 0);
    
    this.controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE
    };
  }

  public handleResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  public rotateCameraOnHover(event: PointerEvent, playerExists: boolean, buildMode: any, isAdmin: boolean) {
    const canRotateCamera = playerExists && (!isAdmin || !buildMode);
    if (canRotateCamera) {
      if (this.prevClientX !== null && this.prevClientY !== null) {
        const movementX = event.clientX - this.prevClientX;
        const movementY = event.clientY - this.prevClientY;

        if (Math.abs(movementX) < 100 && Math.abs(movementY) < 100) {
          const sensitivity = 0.0025;
          this.controls.rotateLeft(-movementX * sensitivity);
          this.controls.rotateUp(-movementY * sensitivity);
        }
      }
      this.prevClientX = event.clientX;
      this.prevClientY = event.clientY;
    } else {
      this.prevClientX = null;
      this.prevClientY = null;
    }
  }

  public resetPrevMouse() {
    this.prevClientX = null;
    this.prevClientY = null;
  }
}
