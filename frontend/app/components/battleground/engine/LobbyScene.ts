import * as THREE from "three/webgpu";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { CharacterVisual, type CharacterPose } from "./Character";
import { ASSET_ROOT, isTouchDevice } from "./config";
import { createM416 } from "./Weapons";

/** The lobby's 3D stage: your soldier on a platform, turnable by dragging. */
export class LobbyScene {
  private renderer!: THREE.WebGPURenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  private visual: CharacterVisual | null = null;
  private yaw = -0.35;
  private dragging = false;
  private lastX = 0;
  private resizeObserver?: ResizeObserver;
  private disposed = false;
  private clock = new THREE.Timer();
  private tint = "#ffffff";

  constructor(private container: HTMLElement) {}

  async init(tint: string) {
    this.tint = tint;
    const forceWebGL = new URLSearchParams(window.location.search).get("renderer") === "webgl";
    // Phone and tablet GPUs: antialiasing and high-DPI rendering cost ~3x the frame time
    // (measured on a Mali-G52: 18 fps -> 64 fps without them) for little visible gain.
    const touch = isTouchDevice();
    this.renderer = new THREE.WebGPURenderer({ antialias: !touch, alpha: true, forceWebGL });
    await this.renderer.init();
    if (this.disposed) return;
    this.renderer.setPixelRatio(Math.min(touch ? 1 : 2, window.devicePixelRatio));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.setClearColor(0x000000, 0);
    this.container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = "block";

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;

    const key = new THREE.DirectionalLight("#fff0d8", 2.6);
    key.position.set(2.5, 4, 3);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = key.shadow.camera.bottom = -2;
    key.shadow.camera.right = key.shadow.camera.top = 2;
    // Without bias the turning soldier shadows itself in shimmering stripes.
    key.shadow.bias = -0.0006;
    key.shadow.normalBias = 0.03;
    const rim = new THREE.DirectionalLight("#6fb3ff", 3.2);
    rim.position.set(-3, 2.5, -3);
    const warmRim = new THREE.DirectionalLight("#ffb057", 1.6);
    warmRim.position.set(3, 1.5, -2.5);
    this.scene.add(key, rim, warmRim, new THREE.HemisphereLight("#b9cdf0", "#2a2118", 0.5));

    // Platform: brushed metal disc with a glowing ring.
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(1.05, 1.15, 0.12, 64),
      new THREE.MeshStandardMaterial({ color: "#1b2027", metalness: 0.85, roughness: 0.35 }),
    );
    disc.position.y = -0.06;
    disc.receiveShadow = true;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.08, 0.012, 8, 96),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(1.1, 0.62, 0.12) }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.005;
    this.scene.add(disc, ring);

    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    await MeshoptDecoder.ready;
    const gltf = await loader.loadAsync(`${ASSET_ROOT}/models/soldier.glb`);
    if (this.disposed) return;
    // The outfit may have changed while the model was loading.
    this.visual = new CharacterVisual(gltf, this.tint);
    this.visual.setWeapon(createM416("reddot"));
    this.scene.add(this.visual.root);

    this.camera.position.set(0, 1.25, 4.6);
    this.camera.lookAt(0, 0.95, 0);
    this.resize();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);

    const el = this.renderer.domElement;
    el.addEventListener("pointerdown", this.onDown);
    window.addEventListener("pointerup", this.onUp);
    window.addEventListener("pointermove", this.onMove);
    el.style.cursor = "grab";

    if (typeof document !== "undefined") this.clock.connect(document);
    this.renderer.setAnimationLoop(this.frame);
  }

  setTint(tint: string) {
    this.tint = tint;
    this.visual?.setTint(tint);
  }

  private onDown = (e: PointerEvent) => {
    this.dragging = true;
    this.lastX = e.clientX;
    this.renderer.domElement.style.cursor = "grabbing";
  };
  private onUp = () => {
    this.dragging = false;
    if (this.renderer) this.renderer.domElement.style.cursor = "grab";
  };
  private onMove = (e: PointerEvent) => {
    if (!this.dragging) return;
    this.yaw += (e.clientX - this.lastX) * 0.01;
    this.lastX = e.clientX;
  };

  private resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private frame = () => {
    this.clock.update();
    const dt = Math.min(0.05, this.clock.getDelta());
    if (!this.dragging) this.yaw += dt * 0.12;
    if (this.visual) {
      // Relaxed low-ready stance, rifle across the chest.
      const pose: CharacterPose = {
        aimYaw: this.yaw,
        aimPitch: -0.1,
        velX: 0,
        velZ: 0,
        grounded: true,
        stance: "stand",
        sprinting: true,
        aiming: false,
        reloading: 0,
        healing: false,
        recoil: 0,
      };
      this.visual.update(dt, pose, 1);
    }
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.resizeObserver?.disconnect();
    window.removeEventListener("pointerup", this.onUp);
    window.removeEventListener("pointermove", this.onMove);
    if (this.renderer) {
      this.renderer.setAnimationLoop(null);
      this.renderer.domElement.removeEventListener("pointerdown", this.onDown);
      this.renderer.domElement.remove();
      this.renderer.dispose();
    }
    this.visual?.dispose();
  }
}
