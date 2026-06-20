import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Types for simulation
export type BuildType = 'road' | 'tree' | 'house' | 'skyscraper' | 'delete' | null;

export interface CityStats {
  population: number;
  houses: number;
  skyscrapers: number;
  trees: number;
  roads: number;
  activeConstruction: number;
}

interface GridCell {
  x: number;
  z: number;
  type: 'empty' | 'road' | 'tree' | 'house' | 'skyscraper' | 'construction';
  mesh: THREE.Group | null;
  constructionProgress: number; // 0 to 100
  targetType: 'road' | 'tree' | 'house' | 'skyscraper' | 'empty';
  height: number;
  id: string;
}

interface HumanAgent {
  id: string;
  mesh: THREE.Group;
  x: number; // world x
  z: number; // world z
  targetX: number;
  targetZ: number;
  state: 'idle' | 'walking' | 'working';
  targetCellX: number;
  targetCellZ: number;
  path: { x: number; z: number }[];
  pathIndex: number;
  speed: number;
  bounceTimer: number;
  workTimer: number;
  jobCellX: number | null;
  jobCellZ: number | null;
  clothingColor: number;
}

interface VehicleAgent {
  id: string;
  mesh: THREE.Group;
  x: number;
  z: number;
  targetX: number;
  targetZ: number;
  path: { x: number; z: number }[];
  pathIndex: number;
  speed: number;
  color: number;
  heading: number;
}

interface Particle {
  mesh: THREE.Sprite | THREE.Mesh;
  velocity: THREE.Vector3;
  life: number; // 0 to 1
  decay: number;
}

// Simple synthesizer for audio effects using Web Audio API
class CityAudio {
  private ctx: AudioContext | null = null;
  private enabled: boolean = false;

  constructor() {
    // Initialized on first interaction
  }

  toggle(enabled: boolean) {
    this.enabled = enabled;
    if (enabled && !this.ctx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
  }

  playPop() {
    if (!this.enabled || !this.ctx) return;
    this.resume();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.12);
  }

  playBuild() {
    if (!this.enabled || !this.ctx) return;
    this.resume();

    // Noise/crackling sound
    const bufferSize = this.ctx.sampleRate * 0.1;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1000, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start();
    noise.stop(this.ctx.currentTime + 0.1);
  }

  playDestroy() {
    if (!this.enabled || !this.ctx) return;
    this.resume();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(40, this.ctx.currentTime + 0.25);

    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);
  }

  playChirp() {
    if (!this.enabled || !this.ctx) return;
    this.resume();

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1800, this.ctx.currentTime);
    osc1.frequency.setValueAtTime(2100, this.ctx.currentTime + 0.05);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(2400, this.ctx.currentTime);
    osc2.frequency.setValueAtTime(2700, this.ctx.currentTime + 0.05);

    gain.gain.setValueAtTime(0.02, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);

    osc1.start();
    osc2.start();
    osc1.stop(this.ctx.currentTime + 0.15);
    osc2.stop(this.ctx.currentTime + 0.15);
  }

  private resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }
}

export class ThreeCity {
  // Three.js Core
  public container: HTMLDivElement;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;

  // Simulation Grid Configuration
  private gridSize = 20;
  private cellSize = 3.0; // Size of each cell in world units
  private grid: GridCell[][] = [];

  // Lights & Shadows
  private ambientLight!: THREE.AmbientLight;
  private hemiLight!: THREE.HemisphereLight;
  private dirLight!: THREE.DirectionalLight;
  private skyColorDay = new THREE.Color('#7ec0ee');
  private skyColorSunset = new THREE.Color('#fd5e53');
  private skyColorNight = new THREE.Color('#0a1128');
  private fogColorDay = new THREE.Color('#e0f0ff');
  private fogColorSunset = new THREE.Color('#ffb380');
  private fogColorNight = new THREE.Color('#050814');

  // Environments objects
  private clouds: THREE.Group[] = [];
  private waterPlane!: THREE.Mesh;
  private buildPreview!: THREE.Mesh;

  // Simulation States
  public buildMode: BuildType = 'road';
  public timeOfDay = 8.0; // 0 to 24 (starts at 8:00 AM)
  public timeSpeed = 0.5; // default scale speed
  public audio = new CityAudio();
  private onStatsChange: (stats: CityStats) => void;
  private isDestroyed = false;

  // Agents & Animations
  private humans: HumanAgent[] = [];
  private vehicles: VehicleAgent[] = [];
  private particles: Particle[] = [];
  private animationFrameId: number | null = null;
  private clock = new THREE.Clock();

  // Materials & Geometries caching
  private materialsCache: { [key: string]: THREE.Material } = {};
  private geometriesCache: { [key: string]: THREE.BufferGeometry } = {};

  // Raycaster & Mouse tracking
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private gridPlane!: THREE.Mesh;
  private currentHoverCell: { x: number; z: number } | null = null;

  constructor(container: HTMLDivElement, onStatsChange: (stats: CityStats) => void) {
    this.container = container;
    this.onStatsChange = onStatsChange;

    this.initThree();
    this.initEnvironment();
    this.initGrid();
    this.initRaycasting();
    this.animate();

    // Trigger initial stats calculation
    this.updateStats();

    // Occasional bird chirp at day
    setInterval(() => {
      if (!this.isDestroyed && this.timeOfDay > 5 && this.timeOfDay < 19 && Math.random() < 0.3) {
        this.audio.playChirp();
      }
    }, 12000);
  }

  private initThree() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    // Scene with nice atmospheric fog
    this.scene = new THREE.Scene();
    this.scene.background = this.skyColorDay;
    this.scene.fog = new THREE.FogExp2(this.fogColorDay, 0.015);

    // Camera
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.set(35, 30, 45);

    // Renderer with shadows enabled
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.container.appendChild(this.renderer.domElement);

    // OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = false;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05; // Don't go below ground
    this.controls.minDistance = 5;
    this.controls.maxDistance = 150;
    this.controls.target.set(0, 0, 0);

    // Lights
    this.ambientLight = new THREE.AmbientLight('#ffffff', 0.4);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight('#ffffff', '#444444', 0.4);
    this.hemiLight.position.set(0, 50, 0);
    this.scene.add(this.hemiLight);

    // Directional Sun Light
    this.dirLight = new THREE.DirectionalLight('#fff8e7', 1.2);
    this.dirLight.position.set(30, 40, 20);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.camera.top = 40;
    this.dirLight.shadow.camera.bottom = -40;
    this.dirLight.shadow.camera.left = -40;
    this.dirLight.shadow.camera.right = 40;
    this.dirLight.shadow.camera.near = 0.1;
    this.dirLight.shadow.camera.far = 200;
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.bias = -0.0005;
    this.scene.add(this.dirLight);

    // Window Resize Event
    window.addEventListener('resize', this.onWindowResize);
  }

  private onWindowResize = () => {
    if (!this.container || this.isDestroyed) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private getMaterial(name: string, config: THREE.MeshStandardMaterialParameters): THREE.Material {
    if (this.materialsCache[name]) return this.materialsCache[name];
    const mat = new THREE.MeshStandardMaterial({
      ...config,
      roughness: config.roughness ?? 0.8,
      metalness: config.metalness ?? 0.1,
    });
    this.materialsCache[name] = mat;
    return mat;
  }

  private getGeometry(name: string, creator: () => THREE.BufferGeometry): THREE.BufferGeometry {
    if (this.geometriesCache[name]) return this.geometriesCache[name];
    const geom = creator();
    this.geometriesCache[name] = geom;
    return geom;
  }

  private initEnvironment() {
    const halfGridWorld = (this.gridSize * this.cellSize) / 2;

    // Grass Ground
    const groundGeom = this.getGeometry('ground', () => new THREE.PlaneGeometry(300, 300));
    const groundMat = this.getMaterial('ground', { color: '#557a46', roughness: 0.9, flatShading: true });
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Grid Floor Helper (Just for the buildable area)
    const gridHelper = new THREE.GridHelper(this.gridSize * this.cellSize, this.gridSize, '#779e6b', '#608655');
    gridHelper.position.y = 0.01;
    this.scene.add(gridHelper);

    // Water Bay on the left edge
    const waterGeom = this.getGeometry('water', () => new THREE.PlaneGeometry(120, 300));
    const waterMat = this.getMaterial('water', {
      color: '#286086',
      roughness: 0.1,
      metalness: 0.8,
      transparent: true,
      opacity: 0.8,
      flatShading: true
    });
    this.waterPlane = new THREE.Mesh(waterGeom, waterMat);
    this.waterPlane.rotation.x = -Math.PI / 2;
    this.waterPlane.position.set(-halfGridWorld - 60 / 2 - 2, -0.02, 0);
    this.waterPlane.receiveShadow = true;
    this.scene.add(this.waterPlane);

    // Build Hover Preview
    const previewGeom = this.getGeometry('preview', () => new THREE.BoxGeometry(this.cellSize, 0.1, this.cellSize));
    const previewMat = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.4,
      wireframe: false
    });
    this.buildPreview = new THREE.Mesh(previewGeom, previewMat);
    this.buildPreview.position.set(0, 0.05, 0);
    this.buildPreview.visible = false;
    this.scene.add(this.buildPreview);

    // Generate Clouds
    this.generateClouds();
  }

  private generateClouds() {
    const cloudGroup = new THREE.Group();
    const cloudMat = this.getMaterial('cloud', {
      color: '#ffffff',
      roughness: 1.0,
      metalness: 0.0,
      flatShading: true,
      transparent: true,
      opacity: 0.95
    });

    for (let c = 0; c < 12; c++) {
      const singleCloud = new THREE.Group();
      const numPuffs = 4 + Math.floor(Math.random() * 4);

      for (let p = 0; p < numPuffs; p++) {
        const r = 2 + Math.random() * 3;
        const puffGeom = new THREE.SphereGeometry(r, 6, 6);
        const puff = new THREE.Mesh(puffGeom, cloudMat);
        puff.position.set(
          (p - numPuffs / 2) * 2.5,
          Math.random() * 1.0,
          (Math.random() - 0.5) * 2
        );
        puff.scale.set(1, 0.7 + Math.random() * 0.4, 0.8 + Math.random() * 0.4);
        singleCloud.add(puff);
      }

      // Position single clouds high in the sky randomly
      singleCloud.position.set(
        (Math.random() - 0.5) * 160,
        18 + Math.random() * 8,
        (Math.random() - 0.5) * 160
      );
      this.clouds.push(singleCloud);
      cloudGroup.add(singleCloud);
    }
    this.scene.add(cloudGroup);
  }

  private initGrid() {
    const halfGridWorld = (this.gridSize * this.cellSize) / 2;

    // Initialize 2D grid matrix
    for (let x = 0; x < this.gridSize; x++) {
      this.grid[x] = [];
      for (let z = 0; z < this.gridSize; z++) {
        this.grid[x][z] = {
          x,
          z,
          type: 'empty',
          mesh: null,
          constructionProgress: 0,
          targetType: 'empty',
          height: 0,
          id: `cell_${x}_${z}`
        };
      }
    }

    // Place a few starting items: a small central road and some trees
    const center = Math.floor(this.gridSize / 2);

    // Initial trees
    for (let i = 0; i < 15; i++) {
      const tx = Math.floor(Math.random() * this.gridSize);
      const tz = Math.floor(Math.random() * this.gridSize);
      if ((tx < center - 2 || tx > center + 2) && (tz < center - 2 || tz > center + 2)) {
        this.spawnInstantItem(tx, tz, 'tree');
      }
    }

    // Initial connecting road
    for (let z = 4; z < 16; z++) {
      this.spawnInstantItem(center, z, 'road');
    }

    // A few initial houses
    this.spawnInstantItem(center - 1, 6, 'house');
    this.spawnInstantItem(center + 1, 10, 'house');
    this.spawnInstantItem(center - 1, 14, 'house');

    // Spawn starting humans
    for (let i = 0; i < 8; i++) {
      this.spawnHumanAtRandomHouse();
    }
  }

  private initRaycasting() {
    // Hidden plane at grid level to raycast onto
    const halfGridWorld = (this.gridSize * this.cellSize) / 2;
    const planeGeom = new THREE.PlaneGeometry(this.gridSize * this.cellSize, this.gridSize * this.cellSize);
    const planeMat = new THREE.MeshBasicMaterial({ visible: false });
    this.gridPlane = new THREE.Mesh(planeGeom, planeMat);
    this.gridPlane.rotation.x = -Math.PI / 2;
    this.gridPlane.position.set(0, 0, 0);
    this.scene.add(this.gridPlane);

    // Add pointer event listeners
    this.container.addEventListener('pointermove', this.onPointerMove);
    this.container.addEventListener('pointerdown', this.onPointerDown);
    this.container.addEventListener('pointerleave', this.onPointerLeave);
  }

  private onPointerMove = (event: PointerEvent) => {
    // Get mouse position relative to canvas container
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(this.gridPlane);

    if (intersects.length > 0 && this.buildMode) {
      const point = intersects[0].point;
      const halfGrid = (this.gridSize * this.cellSize) / 2;

      // Map world coords back to grid coordinates (0 to gridSize-1)
      const gx = Math.floor((point.x + halfGrid) / this.cellSize);
      const gz = Math.floor((point.z + halfGrid) / this.cellSize);

      if (gx >= 0 && gx < this.gridSize && gz >= 0 && gz < this.gridSize) {
        this.currentHoverCell = { x: gx, z: gz };

        // Position the build preview box
        const worldX = (gx * this.cellSize) - halfGrid + this.cellSize / 2;
        const worldZ = (gz * this.cellSize) - halfGrid + this.cellSize / 2;
        this.buildPreview.position.set(worldX, 0.05, worldZ);
        this.buildPreview.visible = true;

        // Change color based on validity
        const cell = this.grid[gx][gz];
        if (this.buildMode === 'delete') {
          (this.buildPreview.material as THREE.MeshBasicMaterial).color.setHex(0xff0000); // Red
        } else {
          const isValid = cell.type === 'empty';
          (this.buildPreview.material as THREE.MeshBasicMaterial).color.setHex(isValid ? 0x00ff00 : 0xffa500); // Green / Orange
        }
        return;
      }
    }

    this.buildPreview.visible = false;
    this.currentHoverCell = null;
  };

  private onPointerDown = (event: PointerEvent) => {
    // Only register clicks for primary button (left click)
    if (event.button !== 0 || !this.buildMode) return;

    if (this.currentHoverCell) {
      const { x, z } = this.currentHoverCell;
      if (this.buildMode === 'delete') {
        this.demolishCell(x, z);
      } else {
        this.orderConstruction(x, z, this.buildMode);
      }
    }
  };

  private onPointerLeave = () => {
    this.buildPreview.visible = false;
    this.currentHoverCell = null;
  };

  // Immediate placements on initial generation
  private spawnInstantItem(x: number, z: number, type: 'road' | 'tree' | 'house' | 'skyscraper') {
    if (x < 0 || x >= this.gridSize || z < 0 || z >= this.gridSize) return;

    const cell = this.grid[x][z];
    if (cell.mesh) {
      this.scene.remove(cell.mesh);
    }

    cell.type = type;
    cell.constructionProgress = 100;
    cell.targetType = type;

    const mesh = this.createMeshForType(type, x, z);
    cell.mesh = mesh;
    this.scene.add(mesh);

    // Apply quick scale-in bounce animation
    mesh.scale.set(0.01, 0.01, 0.01);
    this.animateGrow(mesh, 1.0, 400);

    // Update road network textures if needed
    if (type === 'road') {
      this.recalculateRoadConnections();
    }
  }

  // Set construction request
  private orderConstruction(x: number, z: number, type: 'road' | 'tree' | 'house' | 'skyscraper') {
    const cell = this.grid[x][z];
    if (cell.type !== 'empty') return;

    // Set cell as under construction
    cell.type = 'construction';
    cell.targetType = type;
    cell.constructionProgress = 0;

    // Create a temporary construction site mesh (scaffolding/fence)
    const constructionMesh = this.createConstructionSiteMesh(x, z);
    cell.mesh = constructionMesh;
    this.scene.add(constructionMesh);

    this.audio.playPop();
    this.spawnParticle(x, z, '#eebb33', 8);

    // Alert human workers to come build it!
    this.dispatchWorkerTo(x, z);
    this.updateStats();
  }

  private demolishCell(x: number, z: number) {
    const cell = this.grid[x][z];
    if (cell.type === 'empty') return;

    if (cell.mesh) {
      this.scene.remove(cell.mesh);
    }

    const oldType = cell.type;
    cell.type = 'empty';
    cell.targetType = 'empty';
    cell.mesh = null;
    cell.constructionProgress = 0;

    this.audio.playDestroy();
    this.spawnParticle(x, z, '#555555', 15);

    if (oldType === 'road') {
      this.recalculateRoadConnections();
      // Remove vehicles that might be stranded
      this.cleanStrandedVehicles();
    }

    // Refresh workers working on this site
    this.humans.forEach(h => {
      if (h.jobCellX === x && h.jobCellZ === z) {
        h.state = 'idle';
        h.jobCellX = null;
        h.jobCellZ = null;
        h.path = [];
      }
    });

    this.updateStats();
  }

  private createMeshForType(type: 'road' | 'tree' | 'house' | 'skyscraper', x: number, z: number): THREE.Group {
    const group = new THREE.Group();
    const halfGrid = (this.gridSize * this.cellSize) / 2;
    const worldX = (x * this.cellSize) - halfGrid + this.cellSize / 2;
    const worldZ = (z * this.cellSize) - halfGrid + this.cellSize / 2;
    group.position.set(worldX, 0, worldZ);

    switch (type) {
      case 'road': {
        // Base dark grey asphalt
        const roadGeom = this.getGeometry('road_base', () => new THREE.BoxGeometry(this.cellSize, 0.08, this.cellSize));
        const roadMat = this.getMaterial('road_asphalt', { color: '#333333', roughness: 0.9, flatShading: true });
        const roadMesh = new THREE.Mesh(roadGeom, roadMat);
        roadMesh.position.y = 0.04;
        roadMesh.receiveShadow = true;
        group.add(roadMesh);

        // Dashed lines will be dynamically updated in recalculateRoadConnections
        break;
      }
      case 'tree': {
        // Wooden trunk
        const trunkGeom = this.getGeometry('trunk', () => new THREE.CylinderGeometry(0.15, 0.22, 1.2, 5));
        const trunkMat = this.getMaterial('trunk', { color: '#5c4033', roughness: 0.95 });
        const trunk = new THREE.Mesh(trunkGeom, trunkMat);
        trunk.position.y = 0.6;
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        group.add(trunk);

        // Fluffy green leaves (stacked cones for low-poly feel)
        const foliageMat = this.getMaterial('foliage', { color: '#3a5f0b', roughness: 0.8, flatShading: true });
        const leafHeights = [1.2, 1.7, 2.1];
        const leafSizes = [0.9, 0.7, 0.5];

        leafHeights.forEach((h, idx) => {
          const leafGeom = new THREE.ConeGeometry(leafSizes[idx], 0.8, 5);
          const leaves = new THREE.Mesh(leafGeom, foliageMat);
          leaves.position.y = h;
          leaves.castShadow = true;
          group.add(leaves);
        });
        break;
      }
      case 'house': {
        // Main base walls
        const wallColor = ['#dedede', '#f0c2a2', '#a0c4ff', '#ffd6a5', '#caffbf'][Math.floor(Math.random() * 5)];
        const wallsGeom = this.getGeometry('house_walls', () => new THREE.BoxGeometry(1.6, 1.2, 1.6));
        const wallsMat = this.getMaterial(`walls_${wallColor}`, { color: wallColor, roughness: 0.85 });
        const walls = new THREE.Mesh(wallsGeom, wallsMat);
        walls.position.y = 0.6;
        walls.castShadow = true;
        walls.receiveShadow = true;
        group.add(walls);

        // Pitched Red roof
        const roofGeom = this.getGeometry('house_roof', () => new THREE.ConeGeometry(1.3, 0.9, 4));
        const roofMat = this.getMaterial('house_roof', { color: '#b22222', roughness: 0.7, flatShading: true });
        const roof = new THREE.Mesh(roofGeom, roofMat);
        roof.rotation.y = Math.PI / 4;
        roof.position.y = 1.2 + 0.45;
        roof.castShadow = true;
        group.add(roof);

        // Windows (glow at night)
        const windowGeom = this.getGeometry('window', () => new THREE.BoxGeometry(0.3, 0.3, 0.05));
        const windowMat = this.getMaterial('lit_window', {
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
        const doorGeom = this.getGeometry('door', () => new THREE.BoxGeometry(0.4, 0.8, 0.02));
        const doorMat = this.getMaterial('house_door', { color: '#5c4033', roughness: 0.9 });
        const door = new THREE.Mesh(doorGeom, doorMat);
        door.position.set(-0.3, 0.4, 0.81);
        group.add(door);
        break;
      }
      case 'skyscraper': {
        const height = 4.0 + Math.random() * 3.5;
        const widthSize = 1.6 + Math.random() * 0.4;
        const glassColor = ['#3a86c8', '#1a365d', '#008080', '#2d3748'][Math.floor(Math.random() * 4)];

        // Glass skyscraper body
        const towerGeom = new THREE.BoxGeometry(widthSize, height, widthSize); // Custom height, no cache
        const towerMat = this.getMaterial(`sky_glass_${glassColor}`, {
          color: glassColor,
          roughness: 0.1,
          metalness: 0.9
        });
        const tower = new THREE.Mesh(towerGeom, towerMat);
        tower.position.y = height / 2;
        tower.castShadow = true;
        tower.receiveShadow = true;
        group.add(tower);

        // Add visual window grids on sides
        const gridGroup = new THREE.Group();
        const winRows = Math.floor(height * 2.5);
        const winCols = 4;
        const gridWinGeom = this.getGeometry('skys_win', () => new THREE.BoxGeometry(0.12, 0.12, 0.02));
        const gridWinMat = this.getMaterial('lit_window', { color: '#ffffff', emissive: '#000000', roughness: 0.1 });

        for (let r = 0; r < winRows; r++) {
          const yPos = 0.4 + r * 0.35;
          for (let c = 0; c < winCols; c++) {
            const xPos = (c - (winCols - 1) / 2) * (widthSize / winCols);

            // Add windows on the 4 vertical faces
            // North face
            const wN = new THREE.Mesh(gridWinGeom, gridWinMat);
            wN.position.set(xPos, yPos, widthSize / 2 + 0.01);
            gridGroup.add(wN);

            // South face
            const wS = new THREE.Mesh(gridWinGeom, gridWinMat);
            wS.position.set(xPos, yPos, -widthSize / 2 - 0.01);
            gridGroup.add(wS);

            // East face
            const wE = new THREE.Mesh(gridWinGeom, gridWinMat);
            wE.rotation.y = Math.PI / 2;
            wE.position.set(widthSize / 2 + 0.01, yPos, xPos);
            gridGroup.add(wE);

            // West face
            const wW = new THREE.Mesh(gridWinGeom, gridWinMat);
            wW.rotation.y = Math.PI / 2;
            wW.position.set(-widthSize / 2 - 0.01, yPos, xPos);
            gridGroup.add(wW);
          }
        }
        group.add(gridGroup);

        // Antenna on top
        const antGeom = this.getGeometry('antenna', () => new THREE.CylinderGeometry(0.04, 0.04, 1.0, 4));
        const antMat = this.getMaterial('metal_ant', { color: '#cccccc', metalness: 0.8, roughness: 0.2 });
        const antenna = new THREE.Mesh(antGeom, antMat);
        antenna.position.y = height + 0.5;
        group.add(antenna);

        // Beacon light on top of antenna
        const beaconGeom = this.getGeometry('beacon', () => new THREE.SphereGeometry(0.08, 4, 4));
        const beaconMat = this.getMaterial('red_beacon', { color: '#ff0000', emissive: '#ff0000', roughness: 0.1 });
        const beacon = new THREE.Mesh(beaconGeom, beaconMat);
        beacon.position.y = height + 1.05;
        group.add(beacon);
        break;
      }
    }

    return group;
  }

  private createConstructionSiteMesh(x: number, z: number): THREE.Group {
    const group = new THREE.Group();
    const halfGrid = (this.gridSize * this.cellSize) / 2;
    const worldX = (x * this.cellSize) - halfGrid + this.cellSize / 2;
    const worldZ = (z * this.cellSize) - halfGrid + this.cellSize / 2;
    group.position.set(worldX, 0, worldZ);

    // Site base dirt/sand
    const dirtGeom = this.getGeometry('dirt_base', () => new THREE.BoxGeometry(this.cellSize - 0.1, 0.05, this.cellSize - 0.1));
    const dirtMat = this.getMaterial('dirt', { color: '#a07855', roughness: 0.95 });
    const dirt = new THREE.Mesh(dirtGeom, dirtMat);
    dirt.position.y = 0.025;
    dirt.receiveShadow = true;
    group.add(dirt);

    // Warning post columns at corners
    const postGeom = this.getGeometry('post', () => new THREE.CylinderGeometry(0.05, 0.05, 0.8, 4));
    const postMat = this.getMaterial('yellow_posts', { color: '#eebb33', roughness: 0.8 });
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
    const bandMat = this.getMaterial('site_tape', { color: '#333333', roughness: 0.9 });
    const longBandGeom = this.getGeometry('tape_long', () => new THREE.BoxGeometry(2.6, 0.1, 0.02));
    const sideBandGeom = this.getGeometry('tape_side', () => new THREE.BoxGeometry(0.02, 0.1, 2.6));

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

  // Animation to pop-in scale
  private animateGrow(mesh: THREE.Group, targetScale: number, duration: number) {
    const startTime = performance.now();
    const startScale = mesh.scale.x;

    const update = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1.0);

      // Elastic Out ease
      const ease = (t: number) => {
        const p = 0.3;
        return Math.pow(2, -10 * t) * Math.sin((t - p / 4) * (2 * Math.PI) / p) + 1;
      };

      const scale = startScale + (targetScale - startScale) * ease(progress);
      mesh.scale.set(scale, scale, scale);

      if (progress < 1.0) {
        requestAnimationFrame(update);
      }
    };
    requestAnimationFrame(update);
  }

  // Road drawing lines recalculation based on neighbors
  private recalculateRoadConnections() {
    const halfGrid = (this.gridSize * this.cellSize) / 2;

    for (let x = 0; x < this.gridSize; x++) {
      for (let z = 0; z < this.gridSize; z++) {
        const cell = this.grid[x][z];
        if (cell.type !== 'road' || !cell.mesh) continue;

        // Clear existing markers/lines on the road mesh
        const roadBase = cell.mesh.children[0];
        // Remove old child lines (keep only base mesh)
        while (cell.mesh.children.length > 1) {
          cell.mesh.remove(cell.mesh.children[1]);
        }

        // Neighbors
        const nN = z > 0 && this.grid[x][z - 1].type === 'road';
        const nS = z < this.gridSize - 1 && this.grid[x][z + 1].type === 'road';
        const nW = x > 0 && this.grid[x - 1][z].type === 'road';
        const nE = x < this.gridSize - 1 && this.grid[x + 1][z].type === 'road';

        // Add yellow dashes or solid lines depending on connections
        const lineMat = this.getMaterial('road_lines', { color: '#ffcc00', roughness: 0.9 });
        const lineGeomNS = this.getGeometry('line_ns', () => new THREE.BoxGeometry(0.1, 0.01, 1.0));
        const lineGeomWE = this.getGeometry('line_we', () => new THREE.BoxGeometry(1.0, 0.01, 0.1));

        // If it's a straight north-south road
        if ((nN || nS) && !nW && !nE) {
          // North-South line segments
          const l1 = new THREE.Mesh(lineGeomNS, lineMat);
          l1.position.set(0, 0.09, -0.8);
          cell.mesh.add(l1);

          const l2 = new THREE.Mesh(lineGeomNS, lineMat);
          l2.position.set(0, 0.09, 0.8);
          cell.mesh.add(l2);
        }
        // If it's a straight west-east road
        else if ((nW || nE) && !nN && !nS) {
          const l1 = new THREE.Mesh(lineGeomWE, lineMat);
          l1.position.set(-0.8, 0.09, 0);
          cell.mesh.add(l1);

          const l2 = new THREE.Mesh(lineGeomWE, lineMat);
          l2.position.set(0.8, 0.09, 0);
          cell.mesh.add(l2);
        }
        // Crossroad or T-junctions: draw central intersection square marker
        else if ((nN || nS) && (nW || nE)) {
          const centerMarkGeom = this.getGeometry('road_center', () => new THREE.BoxGeometry(0.4, 0.01, 0.4));
          const centerMark = new THREE.Mesh(centerMarkGeom, lineMat);
          centerMark.position.set(0, 0.09, 0);
          cell.mesh.add(centerMark);
        }
      }
    }
  }

  // Pathfinding on Road network
  private findPath(startX: number, startZ: number, endX: number, endZ: number): { x: number; z: number }[] | null {
    // Standard BFS pathfinding
    const queue: { x: number; z: number; path: { x: number; z: number }[] }[] = [];
    const visited = new Set<string>();

    queue.push({ x: startX, z: startZ, path: [{ x: startX, z: startZ }] });
    visited.add(`${startX}_${startZ}`);

    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (curr.x === endX && curr.z === endZ) {
        return curr.path;
      }

      // Check 4 directions
      const dirs = [
        { dx: 0, dz: -1 },
        { dx: 0, dz: 1 },
        { dx: -1, dz: 0 },
        { dx: 1, dz: 0 }
      ];

      for (const dir of dirs) {
        const nx = curr.x + dir.dx;
        const nz = curr.z + dir.dz;
        const key = `${nx}_${nz}`;

        if (nx >= 0 && nx < this.gridSize && nz >= 0 && nz < this.gridSize && !visited.has(key)) {
          // Can walk on roads, construction sites (if visiting them), or empty grass (as shortcut but we prefer roads)
          // For pathfinder, let's enforce traveling strictly on roads.
          const neighborCell = this.grid[nx][nz];
          const isRoad = neighborCell.type === 'road';
          const isTarget = nx === endX && nz === endZ;

          if (isRoad || isTarget) {
            visited.add(key);
            queue.push({
              x: nx,
              z: nz,
              path: [...curr.path, { x: nx, z: nz }]
            });
          }
        }
      }
    }

    // No road-only path found: fallback to a straight line pathway across grass
    return this.findGrassPath(startX, startZ, endX, endZ);
  }

  private findGrassPath(startX: number, startZ: number, endX: number, endZ: number): { x: number; z: number }[] {
    const path: { x: number; z: number }[] = [];
    let cx = startX;
    let cz = startZ;
    path.push({ x: cx, z: cz });

    while (cx !== endX || cz !== endZ) {
      if (cx < endX) cx++;
      else if (cx > endX) cx--;

      if (cz < endZ) cz++;
      else if (cz > endZ) cz--;

      path.push({ x: cx, z: cz });
    }
    return path;
  }

  // Human Simulation Logic
  private spawnHumanAtRandomHouse() {
    // Find all houses
    const houses: { x: number; z: number }[] = [];
    for (let x = 0; x < this.gridSize; x++) {
      for (let z = 0; z < this.gridSize; z++) {
        if (this.grid[x][z].type === 'house' && this.grid[x][z].constructionProgress === 100) {
          houses.push({ x, z });
        }
      }
    }

    let spawnX = Math.floor(Math.random() * this.gridSize);
    let spawnZ = Math.floor(Math.random() * this.gridSize);

    if (houses.length > 0) {
      const house = houses[Math.floor(Math.random() * houses.length)];
      spawnX = house.x;
      spawnZ = house.z;
    }

    const humanGroup = new THREE.Group();
    const halfGrid = (this.gridSize * this.cellSize) / 2;
    const worldX = (spawnX * this.cellSize) - halfGrid + this.cellSize / 2;
    const worldZ = (spawnZ * this.cellSize) - halfGrid + this.cellSize / 2;
    humanGroup.position.set(worldX, 0, worldZ);

    // Body (Capsule)
    const clothingColor = [0x4287f5, 0xeb4034, 0x228b22, 0xe0c012, 0x8a2be2, 0xff69b4][Math.floor(Math.random() * 6)];
    const bodyGeom = this.getGeometry('human_body', () => new THREE.CylinderGeometry(0.12, 0.12, 0.45, 6));
    const bodyMat = this.getMaterial(`human_shirt_${clothingColor}`, { color: clothingColor, roughness: 0.8 });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.position.y = 0.225;
    body.castShadow = true;
    humanGroup.add(body);

    // Head (Sphere)
    const headGeom = this.getGeometry('human_head', () => new THREE.SphereGeometry(0.11, 6, 6));
    const headMat = this.getMaterial('human_skin', { color: '#ffdbac', roughness: 0.9 });
    const head = new THREE.Mesh(headGeom, headMat);
    head.position.y = 0.52;
    head.castShadow = true;
    humanGroup.add(head);

    this.scene.add(humanGroup);

    const human: HumanAgent = {
      id: `human_${Math.random().toString(36).substr(2, 9)}`,
      mesh: humanGroup,
      x: worldX,
      z: worldZ,
      targetX: worldX,
      targetZ: worldZ,
      state: 'idle',
      targetCellX: spawnX,
      targetCellZ: spawnZ,
      path: [],
      pathIndex: 0,
      speed: 1.5 + Math.random() * 0.8,
      bounceTimer: Math.random() * 10,
      workTimer: 0,
      jobCellX: null,
      jobCellZ: null,
      clothingColor
    };

    this.humans.push(human);
  }

  // Find a building job/construction site for this human
  private dispatchWorkerTo(cellX: number, cellZ: number) {
    // Find an idle human close by, or any idle human
    const idleHuman = this.humans.find(h => h.state === 'idle');
    if (idleHuman) {
      idleHuman.state = 'walking';
      idleHuman.jobCellX = cellX;
      idleHuman.jobCellZ = cellZ;

      const path = this.findPath(idleHuman.targetCellX, idleHuman.targetCellZ, cellX, cellZ);
      if (path) {
        idleHuman.path = path;
        idleHuman.pathIndex = 0;
      }
    }
  }

  // Vehicles Spawner
  private spawnVehicleOnRoad(x: number, z: number) {
    if (this.vehicles.length >= 8) return; // Limit total vehicles

    const halfGrid = (this.gridSize * this.cellSize) / 2;
    const worldX = (x * this.cellSize) - halfGrid + this.cellSize / 2;
    const worldZ = (z * this.cellSize) - halfGrid + this.cellSize / 2;

    const carGroup = new THREE.Group();
    carGroup.position.set(worldX, 0.08, worldZ);

    const carColor = [0xd32f2f, 0x1976d2, 0x388e3c, 0xfbc02d, 0x7b1fa2, 0x00796b][Math.floor(Math.random() * 6)];

    // Chassis Box
    const chassisGeom = this.getGeometry('car_chassis', () => new THREE.BoxGeometry(0.7, 0.35, 0.45));
    const chassisMat = this.getMaterial(`car_body_${carColor}`, { color: carColor, roughness: 0.3, metalness: 0.6 });
    const chassis = new THREE.Mesh(chassisGeom, chassisMat);
    chassis.position.y = 0.175;
    chassis.castShadow = true;
    carGroup.add(chassis);

    // Cab / Windows Box
    const cabGeom = this.getGeometry('car_cab', () => new THREE.BoxGeometry(0.42, 0.25, 0.38));
    const cabMat = this.getMaterial('car_windows', { color: '#222222', roughness: 0.1, metalness: 0.9 });
    const cab = new THREE.Mesh(cabGeom, cabMat);
    cab.position.set(-0.05, 0.4, 0);
    cab.castShadow = true;
    carGroup.add(cab);

    // Wheels (4 small cylinders)
    const wheelGeom = this.getGeometry('car_wheel', () => new THREE.CylinderGeometry(0.12, 0.12, 0.1, 8));
    const wheelMat = this.getMaterial('car_wheels', { color: '#111111', roughness: 0.95 });
    wheelGeom.rotateX(Math.PI / 2); // align cylinders with sides

    const wheelOffsets = [
      [0.2, 0.08, 0.24],
      [-0.2, 0.08, 0.24],
      [0.2, 0.08, -0.24],
      [-0.2, 0.08, -0.24]
    ];

    wheelOffsets.forEach(offset => {
      const wheel = new THREE.Mesh(wheelGeom, wheelMat);
      wheel.position.set(offset[0], offset[1], offset[2]);
      wheel.castShadow = true;
      carGroup.add(wheel);
    });

    this.scene.add(carGroup);

    const vehicle: VehicleAgent = {
      id: `car_${Math.random().toString(36).substr(2, 9)}`,
      mesh: carGroup,
      x: worldX,
      z: worldZ,
      targetX: worldX,
      targetZ: worldZ,
      path: [{ x, z }],
      pathIndex: 0,
      speed: 3.5 + Math.random() * 1.5,
      color: carColor,
      heading: 0
    };

    this.vehicles.push(vehicle);
  }

  // Clean stranded cars
  private cleanStrandedVehicles() {
    this.vehicles = this.vehicles.filter(v => {
      const halfGrid = (this.gridSize * this.cellSize) / 2;
      const gx = Math.floor((v.x + halfGrid) / this.cellSize);
      const gz = Math.floor((v.z + halfGrid) / this.cellSize);
      if (gx >= 0 && gx < this.gridSize && gz >= 0 && gz < this.gridSize) {
        if (this.grid[gx][gz].type === 'road') {
          return true;
        }
      }
      this.scene.remove(v.mesh);
      return false;
    });
  }

  // Spawning floating particles (+1, hammer, spark)
  public spawnParticle(cellX: number, cellZ: number, colorStr: string, count: number = 5) {
    const halfGrid = (this.gridSize * this.cellSize) / 2;
    const worldX = (cellX * this.cellSize) - halfGrid + this.cellSize / 2;
    const worldZ = (cellZ * this.cellSize) - halfGrid + this.cellSize / 2;

    const partMat = this.getMaterial(`particle_${colorStr}`, {
      color: colorStr,
      transparent: true,
      opacity: 0.8,
      emissive: colorStr,
      roughness: 0.5
    });

    const partGeom = this.getGeometry('part_mesh', () => new THREE.BoxGeometry(0.12, 0.12, 0.12));

    for (let i = 0; i < count; i++) {
      const pMesh = new THREE.Mesh(partGeom, partMat);
      pMesh.position.set(
        worldX + (Math.random() - 0.5) * 1.5,
        0.5 + Math.random() * 0.8,
        worldZ + (Math.random() - 0.5) * 1.5
      );
      this.scene.add(pMesh);

      this.particles.push({
        mesh: pMesh,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 1.0,
          1.5 + Math.random() * 2.0,
          (Math.random() - 0.5) * 1.0
        ),
        life: 1.0,
        decay: 0.8 + Math.random() * 0.8 // life decay per second
      });
    }
  }

  // Simulation Loop Tick
  private animate = () => {
    if (this.isDestroyed) return;
    this.animationFrameId = requestAnimationFrame(this.animate);

    const delta = Math.min(this.clock.getDelta(), 0.1); // cap delta

    // Update controls
    this.controls.update();

    // 1. Time-of-day dynamics (Sun rotation, colors shift)
    this.updateTimeOfDay(delta);

    // 2. Cloud movements
    this.clouds.forEach(cloud => {
      cloud.position.x += 1.5 * delta;
      // Wrap around grid boundaries
      if (cloud.position.x > 150) {
        cloud.position.x = -150;
        cloud.position.z = (Math.random() - 0.5) * 160;
      }
    });

    // 3. Human updates
    this.updateHumans(delta);

    // 4. Vehicles updates
    this.updateVehicles(delta);

    // 5. Particles updates
    this.updateParticles(delta);

    // 6. Water wave slight animation
    if (this.waterPlane) {
      this.waterPlane.position.y = -0.02 + Math.sin(this.clock.getElapsedTime() * 1.2) * 0.025;
    }

    this.renderer.render(this.scene, this.camera);
  };

  private updateTimeOfDay(delta: number) {
    // Increment timeOfDay: 24 units = 1 day
    this.timeOfDay = (this.timeOfDay + delta * this.timeSpeed) % 24;

    // Angle of the sun: 6:00 is sunrise, 18:00 is sunset
    const angle = ((this.timeOfDay - 6) / 24) * Math.PI * 2;
    this.dirLight.position.x = Math.cos(angle) * 60;
    this.dirLight.position.y = Math.sin(angle) * 60;
    this.dirLight.position.z = 20;

    // Interpolate Sky/Fog/Sun Colors
    let skyCol = this.skyColorDay;
    let fogCol = this.fogColorDay;
    let sunIntensity = 1.2;
    let moonIntensity = 0.05;
    let isNight = false;

    if (this.timeOfDay >= 18.0 && this.timeOfDay < 20.0) {
      // Sunset transition (18:00 - 20:00)
      const t = (this.timeOfDay - 18.0) / 2.0;
      skyCol = this.skyColorSunset.clone().lerp(this.skyColorNight, t);
      fogCol = this.fogColorSunset.clone().lerp(this.fogColorNight, t);
      sunIntensity = 1.2 * (1.0 - t);
      moonIntensity = 0.05 + 0.15 * t;
    } else if (this.timeOfDay >= 20.0 || this.timeOfDay < 4.0) {
      // Night (20:00 - 4:00)
      skyCol = this.skyColorNight;
      fogCol = this.fogColorNight;
      sunIntensity = 0.0;
      moonIntensity = 0.2;
      isNight = true;
    } else if (this.timeOfDay >= 4.0 && this.timeOfDay < 6.0) {
      // Sunrise transition (4:00 - 6:00)
      const t = (this.timeOfDay - 4.0) / 2.0;
      skyCol = this.skyColorNight.clone().lerp(this.skyColorSunset, t);
      fogCol = this.fogColorNight.clone().lerp(this.fogColorSunset, t);
      sunIntensity = 0.4 * t;
      moonIntensity = 0.2 * (1.0 - t);
    } else if (this.timeOfDay >= 6.0 && this.timeOfDay < 8.0) {
      // Morning transition (6:00 - 8:00)
      const t = (this.timeOfDay - 6.0) / 2.0;
      skyCol = this.skyColorSunset.clone().lerp(this.skyColorDay, t);
      fogCol = this.fogColorSunset.clone().lerp(this.fogColorDay, t);
      sunIntensity = 0.4 + 0.8 * t;
      moonIntensity = 0.05;
    }

    this.scene.background = skyCol;
    if (this.scene.fog) {
      (this.scene.fog as THREE.FogExp2).color = fogCol;
    }

    this.dirLight.intensity = sunIntensity;
    this.hemiLight.intensity = isNight ? 0.15 : 0.4;
    this.ambientLight.color.set(isNight ? '#112244' : '#ffffff');

    // Dynamic windows illumination in buildings
    this.updateBuildingWindows(isNight);
  }

  private updateBuildingWindows(isNight: boolean) {
    const emissiveColor = isNight ? new THREE.Color('#ffcc44') : new THREE.Color('#000000');
    const mat = this.materialsCache['lit_window'] as THREE.MeshStandardMaterial;
    if (mat) {
      mat.emissive.copy(emissiveColor);
    }
  }

  private updateHumans(delta: number) {
    const halfGrid = (this.gridSize * this.cellSize) / 2;

    this.humans.forEach(h => {
      // Small limb breathing wiggle animation
      h.bounceTimer += delta * h.speed * 4.5;
      const wiggleY = Math.abs(Math.sin(h.bounceTimer)) * 0.16;
      h.mesh.children[0].position.y = 0.225 + wiggleY; // Lift body
      h.mesh.children[1].position.y = 0.52 + wiggleY;  // Lift head

      if (h.state === 'walking' || h.state === 'working') {
        // If has path to navigate
        if (h.path.length > 0 && h.pathIndex < h.path.length) {
          const nextTargetCell = h.path[h.pathIndex];
          const targetWorldX = (nextTargetCell.x * this.cellSize) - halfGrid + this.cellSize / 2;
          const targetWorldZ = (nextTargetCell.z * this.cellSize) - halfGrid + this.cellSize / 2;

          // Move mesh towards next cell target
          const dirX = targetWorldX - h.x;
          const dirZ = targetWorldZ - h.z;
          const dist = Math.sqrt(dirX * dirX + dirZ * dirZ);

          const stepDist = h.speed * delta;

          if (dist <= stepDist) {
            // Reached node
            h.x = targetWorldX;
            h.z = targetWorldZ;
            h.targetCellX = nextTargetCell.x;
            h.targetCellZ = nextTargetCell.z;
            h.pathIndex++;

            // Visual rotation towards direction
            if (h.pathIndex < h.path.length) {
              const lookTarget = h.path[h.pathIndex];
              const angle = Math.atan2(lookTarget.x - nextTargetCell.x, lookTarget.z - nextTargetCell.z);
              h.mesh.rotation.y = angle;
            }
          } else {
            // Interpolate step
            h.x += (dirX / dist) * stepDist;
            h.z += (dirZ / dist) * stepDist;
            h.mesh.rotation.y = Math.atan2(dirX, dirZ);
          }

          h.mesh.position.set(h.x, 0, h.z);
        } else {
          // Finished path
          if (h.jobCellX !== null && h.jobCellZ !== null) {
            // Reached construction site, start working!
            h.state = 'working';
            h.workTimer += delta;

            // Emit sparks/construction dust
            if (Math.random() < 0.18) {
              this.spawnParticle(h.jobCellX, h.jobCellZ, '#ffaa00', 2);
              this.audio.playBuild();
            }

            const cell = this.grid[h.jobCellX][h.jobCellZ];
            if (cell.type === 'construction') {
              cell.constructionProgress += 16 * delta; // building speed

              if (cell.constructionProgress >= 100) {
                // Construction completed!
                this.completeConstruction(h.jobCellX, h.jobCellZ);
                h.state = 'idle';
                h.jobCellX = null;
                h.jobCellZ = null;
                h.path = [];
              }
            } else {
              // Site was deleted/changed
              h.state = 'idle';
              h.jobCellX = null;
              h.jobCellZ = null;
              h.path = [];
            }
          } else {
            // Simply wandering around or idle
            h.state = 'idle';
            h.workTimer += delta;

            if (h.workTimer > 3.0 + Math.random() * 5.0) {
              // Wander to a random cell nearby
              this.wanderHuman(h);
            }
          }
        }
      } else if (h.state === 'idle') {
        h.workTimer += delta;
        if (h.workTimer > 3.0 + Math.random() * 5.0) {
          this.wanderHuman(h);
        }
      }
    });
  }

  private wanderHuman(h: HumanAgent) {
    h.workTimer = 0;
    // Find all roads or random spaces
    const tx = Math.max(0, Math.min(this.gridSize - 1, h.targetCellX + Math.floor(Math.random() * 7) - 3));
    const tz = Math.max(0, Math.min(this.gridSize - 1, h.targetCellZ + Math.floor(Math.random() * 7) - 3));

    const path = this.findPath(h.targetCellX, h.targetCellZ, tx, tz);
    if (path && path.length > 1) {
      h.state = 'walking';
      h.path = path;
      h.pathIndex = 0;
    }
  }

  private completeConstruction(x: number, z: number) {
    const cell = this.grid[x][z];
    if (cell.type !== 'construction') return;

    if (cell.mesh) {
      this.scene.remove(cell.mesh);
    }

    const type = cell.targetType as 'road' | 'tree' | 'house' | 'skyscraper';
    cell.type = type;
    cell.constructionProgress = 100;

    const mesh = this.createMeshForType(type, x, z);
    cell.mesh = mesh;
    this.scene.add(mesh);

    // Grow in animation
    mesh.scale.set(0.01, 0.01, 0.01);
    this.animateGrow(mesh, 1.0, 500);

    this.audio.playPop();
    this.spawnParticle(x, z, '#5cd65c', 12); // Green success dust

    if (type === 'road') {
      this.recalculateRoadConnections();
      // Try to spawn a vehicle on this road with 25% chance
      if (Math.random() < 0.25) {
        this.spawnVehicleOnRoad(x, z);
      }
    } else if (type === 'house') {
      // House built: spawn 1-2 new humans!
      const spawns = 1 + Math.floor(Math.random() * 2);
      for (let s = 0; s < spawns; s++) {
        this.spawnHumanAtRandomHouse();
      }
    }

    this.updateStats();
  }

  private updateVehicles(delta: number) {
    const halfGrid = (this.gridSize * this.cellSize) / 2;

    this.vehicles.forEach(v => {
      if (v.path.length > 0 && v.pathIndex < v.path.length) {
        const nextCell = v.path[v.pathIndex];
        const targetWorldX = (nextCell.x * this.cellSize) - halfGrid + this.cellSize / 2;
        const targetWorldZ = (nextCell.z * this.cellSize) - halfGrid + this.cellSize / 2;

        const dirX = targetWorldX - v.x;
        const dirZ = targetWorldZ - v.z;
        const dist = Math.sqrt(dirX * dirX + dirZ * dirZ);
        const stepDist = v.speed * delta;

        // Drive animation: rotate wheels slightly based on velocity
        const wheelRotSpeed = v.speed * 3 * delta;
        v.mesh.children.slice(2, 6).forEach(wheel => {
          wheel.rotation.z += wheelRotSpeed;
        });

        if (dist <= stepDist) {
          v.x = targetWorldX;
          v.z = targetWorldZ;
          const currentCellX = nextCell.x;
          const currentCellZ = nextCell.z;

          // Pick next destination road
          const choices: { x: number; z: number }[] = [];
          const dirs = [
            { dx: 0, dz: -1 },
            { dx: 0, dz: 1 },
            { dx: -1, dz: 0 },
            { dx: 1, dz: 0 }
          ];

          dirs.forEach(d => {
            const nx = currentCellX + d.dx;
            const nz = currentCellZ + d.dz;
            if (nx >= 0 && nx < this.gridSize && nz >= 0 && nz < this.gridSize) {
              if (this.grid[nx][nz].type === 'road') {
                // Avoid heading backward immediately if possible
                if (v.pathIndex > 0) {
                  const prev = v.path[v.pathIndex - 1];
                  if (prev.x === nx && prev.z === nz && choices.length > 0) return;
                }
                choices.push({ x: nx, z: nz });
              }
            }
          });

          if (choices.length > 0) {
            const nextChoice = choices[Math.floor(Math.random() * choices.length)];
            v.path = [nextCell, nextChoice];
            v.pathIndex = 1;
          } else {
            // Dead end, spin around
            v.pathIndex = 0;
            v.path = [{ x: currentCellX, z: currentCellZ }];
          }
        } else {
          v.x += (dirX / dist) * stepDist;
          v.z += (dirZ / dist) * stepDist;

          // Smoothly rotate the car mesh towards target heading
          const targetHeading = Math.atan2(dirX, dirZ);
          // Simple interpolation of heading angle
          let diff = targetHeading - v.heading;
          // Normalize diff to -PI to PI
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          v.heading += diff * 12 * delta;
          v.mesh.rotation.y = v.heading;
        }

        v.mesh.position.set(v.x, 0.08, v.z);
      }
    });
  }

  private updateParticles(delta: number) {
    this.particles = this.particles.filter(p => {
      // Apply velocity
      p.mesh.position.x += p.velocity.x * delta;
      p.mesh.position.y += p.velocity.y * delta;
      p.mesh.position.z += p.velocity.z * delta;

      // Apply gravity slowing vertical speed
      p.velocity.y -= 2.0 * delta;

      // Decay life
      p.life -= p.decay * delta;

      // Scale down particle size based on life
      const size = Math.max(p.life, 0.01);
      p.mesh.scale.set(size, size, size);

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        return false;
      }
      return true;
    });
  }

  private updateStats() {
    let houses = 0;
    let skyscrapers = 0;
    let trees = 0;
    let roads = 0;
    let activeConstruction = 0;

    for (let x = 0; x < this.gridSize; x++) {
      for (let z = 0; z < this.gridSize; z++) {
        const cell = this.grid[x][z];
        if (cell.type === 'house') houses++;
        else if (cell.type === 'skyscraper') skyscrapers++;
        else if (cell.type === 'tree') trees++;
        else if (cell.type === 'road') roads++;
        else if (cell.type === 'construction') activeConstruction++;
      }
    }

    this.onStatsChange({
      population: this.humans.length,
      houses,
      skyscrapers,
      trees,
      roads,
      activeConstruction
    });
  }

  // Cleanup scene on unmount
  public destroy() {
    this.isDestroyed = true;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener('resize', this.onWindowResize);

    // Remove event listeners
    this.container.removeEventListener('pointermove', this.onPointerMove);
    this.container.removeEventListener('pointerdown', this.onPointerDown);
    this.container.removeEventListener('pointerleave', this.onPointerLeave);

    // Dispose geometries and materials
    Object.values(this.geometriesCache).forEach(g => g.dispose());
    Object.values(this.materialsCache).forEach(m => m.dispose());

    // Clear scene meshes
    while (this.scene.children.length > 0) {
      const obj = this.scene.children[0];
      this.scene.remove(obj);
    }

    // Dispose renderer
    this.renderer.dispose();
    this.container.innerHTML = '';
  }
}
