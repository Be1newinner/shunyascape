import * as THREE from "three";

import {
  BuildType,
  CityStats,
  GridCell,
  HumanAgent,
  VehicleAgent,
  AnimalAgent,
  Particle,
  SimContext,
} from "./Types";
import { CityAudio } from "./Audio";
import { createLand } from "./Land";
import { createTreeMesh } from "./Trees";
import { createRoadMesh, recalculateRoadConnections } from "./Road";
import {
  createHouseMesh,
  createSkyscraperMesh,
  createConstructionSiteMesh,
} from "./Home";
import { WeatherManager } from "./Weather";
import { CameraManager } from "./Camera";
import { spawnAnimals, updateAnimals, createAnimalMesh } from "./NPCAnimals";
import {
  spawnVehicleOnRoad,
  cleanStrandedVehicles,
  updateVehicles,
} from "./Vehicle";
import {
  createRefinedHumanMesh,
  createNameTag,
  syncRemotePlayers,
  upsertRemotePlayer,
  applyNpcSnapshots,
  NpcSnapshot,
  RemoteUser,
  updateHumans,
  assignNpcCharacter,
  updateCharacterLOD,
  preloadCharacters,
  PRELOAD_PRIORITY,
} from "./NPCHuman";
import { CollectibleManager } from "./Collectibles";
import { createCentralPark, getParkCells } from "./CentralPark";
import { createAllMountains } from "./Mountains";
import { createRiver, RiverSystem } from "./River";
import { LandExpansionManager } from "./LandExpansion";
import { resizeGridHelper } from "./Land";
import {
  createRestaurantMesh,
  createClothShopMesh,
  createBarbershopMesh,
  createPoliceStationMesh,
  getBarberPoles,
  getPoliceRefs,
} from "./SpecialBuildings";
import { preloadGltfAssets, ALL_BUILDING_URLS } from "./GltfLoader";

type PlaceableType = "road" | "tree" | "house" | "skyscraper" | "restaurant" | "clothshop" | "barbershop" | "policestation";

/** Cell codes in the /api/world layout string (backend/src/world/layout.ts). */
const LAYOUT_CODES: Record<string, PlaceableType | undefined> = {
  r: "road",
  t: "tree",
  h: "house",
  s: "skyscraper",
  R: "restaurant",
  c: "clothshop",
  b: "barbershop",
  p: "policestation",
};

/** A server cell that differs from the base layout. */
export interface WorldCell {
  x: number;
  z: number;
  type: GridCell["type"];
  targetType: GridCell["targetType"];
  constructionProgress: number;
  height?: number;
  scale?: number;
  ownerName?: string | null;
  ownerId?: string | null;
  builderId?: string | null;
  price?: number;
  isPurchased?: boolean;
}

interface WorldPayload {
  size: number;
  cellSize: number;
  seed: number;
  layout: string;
  cells: WorldCell[];
}

export class ThreeCity {
  // Three.js Core
  public container: HTMLDivElement;
  private scene!: THREE.Scene;
  public camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private cameraManager!: CameraManager;
  public controls!: any; // OrbitControls

  // Simulation Grid Configuration
  public gridSize = 200;
  private cellSize = 2.25; // Size of each cell in world units (shrunk from 3.0)
  public grid: GridCell[][] = [];
  public selectedBuildScale = 1.0;
  public shunyaCoins = 100;
  private parkCells: Set<string> = new Set();
  // Grid updates that arrive before the shared layout has been built
  private worldLoaded = false;
  private pendingGridCells: WorldCell[] = [];
  private chirpInterval: ReturnType<typeof setInterval> | null = null;

  // Land Expansion
  public landExpansionManager: LandExpansionManager = new LandExpansionManager(200);

  // Environment
  private riverSystem: RiverSystem | null = null;

  // Weather & Environment
  private weatherManager!: WeatherManager;
  private waterPlane!: THREE.Mesh;
  private buildPreview!: THREE.Mesh;

  // Simulation States
  public buildMode: BuildType = "road";
  public timeOfDay = 8.0; // 0 to 24 (starts at 8:00 AM)
  public ws: WebSocket | null = null;
  public timeSpeed = 0.5; // default scale speed
  public audio = new CityAudio();
  private onStatsChange: (stats: CityStats) => void;
  private isDestroyed = false;
  private isInitializing = false;
  public isAdmin = false;
  public unlockedPermits: string[] = [];
  public gridVersion = 0;
  /** serverClock - Date.now(), from the `t` field of server messages. */
  private serverTimeOffset = 0;
  private lastVisibleGx = -1;
  private lastVisibleGz = -1;
  private lastReportedZoomScale = 1.0;
  public collectibleManager!: CollectibleManager;

  // Agents & Animations
  public humans: HumanAgent[] = [];
  private vehicles: VehicleAgent[] = [];
  private animals: AnimalAgent[] = []; // Voxel Cows, Dogs, Cats, Birds
  private particles: Particle[] = [];
  private animationFrameId: number | null = null;
  private timer = new THREE.Timer();

  // Quest State
  public fidoQuestState: "not_started" | "active" | "fido_found" | "completed" = "not_started";
  public fidoQuestOwnerId: string | null = null;
  private fidoQuestZone: THREE.Group | null = null;

  // Player Controls
  public player: HumanAgent | null = null;
  private keysPressed: { [key: string]: boolean } = {};
  private hasKeyboardListeners = false;
  private lastSyncedPosition = new THREE.Vector3();
  private positionSyncTimer = 0.5;
  private lastPlayerPosition: THREE.Vector3 | null = null;
  private treeHits = new Map<string, number>();
  public currentCellType = "empty";

  // Graphics & Performance settings
  public fpsCap = 60;
  public graphicsPreset: "low" | "medium" | "high" = "low";
  private lastFrameTime = 0;
  private frameCounter = 0;

  // Materials & Geometries caching
  private materialsCache: { [key: string]: THREE.Material } = {};
  private geometriesCache: { [key: string]: THREE.BufferGeometry } = {};

  // Raycaster & Mouse tracking
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private gridPlane!: THREE.Mesh;
  private currentHoverCell: { x: number; z: number } | null = null;

  constructor(
    container: HTMLDivElement,
    onStatsChange: (stats: CityStats) => void,
  ) {
    this.container = container;
    this.onStatsChange = onStatsChange;

    this.initThree();
    this.initEnvironment();
    this.setGraphicsPreset(this.graphicsPreset);

    // Occasional bird chirp
    this.chirpInterval = setInterval(() => {
      if (
        !this.isDestroyed &&
        this.timeOfDay > 5 &&
        this.timeOfDay < 19 &&
        Math.random() < 0.3
      ) {
        this.audio.playChirp();
      }
    }, 12000);
  }

  public async loadCity(onProgress?: (progress: number, text: string) => void) {
    // The server owns the city layout so every player sees the same world
    const res = await fetch("/api/world");
    if (!res.ok) throw new Error(`Failed to load the shared city (HTTP ${res.status})`);
    const world: WorldPayload = await res.json();
    if (world.size !== this.gridSize || world.layout.length !== world.size * world.size) {
      throw new Error("Server world size does not match this client");
    }

    // Kick off glTF downloads in parallel — models will be cached by the time
    // the city grid spawns buildings, minimising visible stand-in swap delay.
    preloadGltfAssets([...ALL_BUILDING_URLS]);

    // Preload the 5 most common character types (King + Suit + 3 NPC outfits)
    preloadCharacters([...PRELOAD_PRIORITY]);

    await this.initGrid(world.layout, onProgress);
    this.worldLoaded = true;
    this.syncGrid([...world.cells, ...this.pendingGridCells]);
    this.pendingGridCells = [];
    this.initRaycasting();
    this.collectibleManager = new CollectibleManager(this.getSimContext());
    this.animate();
    this.updateStats();
    
    // Freeze all static meshes for maximum 60fps performance
    this.optimizeStaticMeshes();
  }

  private getDynamicObjectsSet(): Set<THREE.Object3D> {
    const dynamicObjects = new Set<THREE.Object3D>();
    if (this.player && this.player.mesh) {
      this.player.mesh.traverse((obj) => dynamicObjects.add(obj));
    }
    this.vehicles.forEach((v) => {
      if (v.mesh) v.mesh.traverse((obj) => dynamicObjects.add(obj));
    });
    this.animals.forEach((a) => {
      if (a.mesh) a.mesh.traverse((obj) => dynamicObjects.add(obj));
    });
    this.humans.forEach((h) => {
      if (h.mesh) h.mesh.traverse((obj) => dynamicObjects.add(obj));
    });
    try {
      getBarberPoles().forEach((pole) => {
        if (pole) {
          pole.traverse((obj) => dynamicObjects.add(obj));
        }
      });
    } catch (e) {
      console.warn("Error getting barber poles:", e);
    }
    try {
      getPoliceRefs().forEach((ref) => {
        if (ref) {
          if (ref.blinkMesh) ref.blinkMesh.traverse((obj) => dynamicObjects.add(obj));
          if (ref.blinkLight) ref.blinkLight.traverse((obj) => dynamicObjects.add(obj));
        }
      });
    } catch (e) {
      console.warn("Error getting police refs:", e);
    }
    return dynamicObjects;
  }

  private makeStatic(obj: THREE.Object3D, dynamicSet?: Set<THREE.Object3D>) {
    const set = dynamicSet || this.getDynamicObjectsSet();
    if (set.has(obj)) return;

    obj.matrixAutoUpdate = false;
    obj.updateMatrix();
    obj.updateMatrixWorld(true);
    obj.children.forEach((child) => this.makeStatic(child, set));
  }

  public optimizeStaticMeshes() {
    const dynamicSet = this.getDynamicObjectsSet();
    this.scene.traverse((obj) => {
      if (dynamicSet.has(obj)) return;
      if (
        obj instanceof THREE.Mesh ||
        obj instanceof THREE.Group ||
        obj instanceof THREE.Line ||
        obj instanceof THREE.Points
      ) {
        obj.matrixAutoUpdate = false;
        obj.updateMatrix();
        obj.updateMatrixWorld(true);
      }
    });
  }

  public updateCellVisibility(playerGx: number, playerGz: number) {
    if (playerGx === -1 || playerGz === -1) {
      for (let x = 0; x < this.gridSize; x++) {
        if (!this.grid[x]) continue;
        for (let z = 0; z < this.gridSize; z++) {
          const cell = this.grid[x][z];
          if (cell && cell.mesh) {
            cell.mesh.visible = true;
          }
        }
      }
      this.humans.forEach((h) => {
        if (h.mesh) h.mesh.visible = !h.hidden;
      });
      this.vehicles.forEach((v) => {
        if (v.mesh) v.mesh.visible = true;
      });
      this.animals.forEach((a) => {
        if (a.mesh) a.mesh.visible = true;
      });
      return;
    }

    const range = 12; // 25x25 blocks visibility area (12 on each side + 1 center block)
    const minX = Math.max(0, playerGx - range);
    const maxX = Math.min(this.gridSize - 1, playerGx + range);
    const minZ = Math.max(0, playerGz - range);
    const maxZ = Math.min(this.gridSize - 1, playerGz + range);

    for (let x = 0; x < this.gridSize; x++) {
      if (!this.grid[x]) continue;
      for (let z = 0; z < this.gridSize; z++) {
        const cell = this.grid[x][z];
        if (cell && cell.mesh) {
          const isVisible = (x >= minX && x <= maxX && z >= minZ && z <= maxZ);
          cell.mesh.visible = isVisible;
        }
      }
    }

    this.updateDynamicEntitiesVisibility(minX, maxX, minZ, maxZ);
  }

  private updateDynamicEntitiesVisibility(minX: number, maxX: number, minZ: number, maxZ: number) {
    const halfGrid = (this.gridSize * this.cellSize) / 2;

    this.humans.forEach((h) => {
      if (!h.mesh) return;
      if (h.isPlayer) {
        h.mesh.visible = true;
        return;
      }
      const gx = Math.floor((h.mesh.position.x + halfGrid) / this.cellSize);
      const gz = Math.floor((h.mesh.position.z + halfGrid) / this.cellSize);
      h.mesh.visible = !h.hidden && gx >= minX && gx <= maxX && gz >= minZ && gz <= maxZ;
    });

    this.vehicles.forEach((v) => {
      if (!v.mesh) return;
      const gx = Math.floor((v.mesh.position.x + halfGrid) / this.cellSize);
      const gz = Math.floor((v.mesh.position.z + halfGrid) / this.cellSize);
      v.mesh.visible = gx >= minX && gx <= maxX && gz >= minZ && gz <= maxZ;
    });

    this.animals.forEach((a) => {
      if (!a.mesh) return;
      const gx = Math.floor((a.mesh.position.x + halfGrid) / this.cellSize);
      const gz = Math.floor((a.mesh.position.z + halfGrid) / this.cellSize);
      a.mesh.visible = gx >= minX && gx <= maxX && gz >= minZ && gz <= maxZ;
    });
  }

  private updateZoomScale() {
    if (!this.camera || !this.controls) return;
    const distance = this.camera.position.distanceTo(this.controls.target);
    const baseDistance = 40.62;
    let zoomScale = baseDistance / distance;
    zoomScale = Math.round(zoomScale * 100) / 100;
    if (zoomScale !== this.lastReportedZoomScale) {
      this.lastReportedZoomScale = zoomScale;
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("shunya-zoom-change", {
            detail: { zoomScale },
          }),
        );
      }
    }
  }

  // Caching Methods
  public getGeometry = (
    name: string,
    creator: () => THREE.BufferGeometry,
  ): THREE.BufferGeometry => {
    if (!this.geometriesCache[name]) {
      this.geometriesCache[name] = creator();
    }
    return this.geometriesCache[name];
  };

  public getMaterial = (name: string, params: any): THREE.Material => {
    if (!this.materialsCache[name]) {
      const mat = new THREE.MeshLambertMaterial(params);
      mat.name = name; // store key as name for traversal lookup
      this.materialsCache[name] = mat;
    }
    return this.materialsCache[name];
  };


  private getSimContext(): SimContext {
    return {
      gridSize: this.gridSize,
      cellSize: this.cellSize,
      grid: this.grid,
      scene: this.scene,
      camera: this.camera,
      controls: this.controls,
      audio: this.audio,
      isAdmin: this.isAdmin,
      getGeometry: this.getGeometry,
      getMaterial: this.getMaterial,
      spawnParticle: this.spawnParticle.bind(this),
      completeConstruction: this.completeConstruction.bind(this),
      recalculateRoadConnections: this.recalculateRoadConnections.bind(this),
      spawnVehicleOnRoad: (x: number, z: number) => {
        spawnVehicleOnRoad(
          this.getSimContext(),
          this.vehicles,
          this.humans,
          x,
          z,
        );
      },
      ws: this.ws,
      parkCells: this.parkCells,
    };
  }

  private initThree() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();

    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(1.0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    if (typeof document !== "undefined") {
      this.timer.connect(document);
    }
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.container.appendChild(this.renderer.domElement);

    this.cameraManager = new CameraManager(this.container, this.renderer);
    this.camera = this.cameraManager.camera;
    this.controls = this.cameraManager.controls;

    this.controls.addEventListener("change", () => {
      this.updateZoomScale();
    });

    window.addEventListener("resize", this.onWindowResize);
  }

  private onWindowResize = () => {
    if (this.isDestroyed) return;
    this.cameraManager.handleResize();
    this.renderer.setSize(
      this.container.clientWidth,
      this.container.clientHeight,
    );
  };

  public rotateCamera(dx: number, dy: number) {
    if (this.controls) {
      this.controls.rotateLeft(dx);
      this.controls.rotateUp(dy);
      this.controls.update();
    }
  }

  public zoomCamera(zoomIn: boolean) {
    if (this.controls) {
      if (zoomIn) {
        this.controls.dollyIn(1.15);
      } else {
        this.controls.dollyOut(1.15);
      }
      this.controls.update();
    }
  }

  public resetCamera() {
    if (this.camera && this.controls) {
      this.camera.position.set(150, 130, 180);
      this.controls.target.set(0, 0, 0);
      this.controls.update();
    }
  }

  public setGraphicsPreset(preset: "low" | "medium" | "high") {
    this.graphicsPreset = preset;
    if (!this.renderer) return;

    if (preset === "low") {
      this.renderer.shadowMap.enabled = false;
      if (this.weatherManager && this.weatherManager.dirLight) {
        this.weatherManager.dirLight.castShadow = false;
      }
      this.scene.fog = null;
    } else {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      if (this.weatherManager && this.weatherManager.dirLight) {
        this.weatherManager.dirLight.castShadow = true;
        const size = preset === "medium" ? 512 : 1024;
        this.weatherManager.dirLight.shadow.mapSize.width = size;
        this.weatherManager.dirLight.shadow.mapSize.height = size;
        
        if (this.weatherManager.dirLight.shadow.map) {
          this.weatherManager.dirLight.shadow.map.dispose();
          this.weatherManager.dirLight.shadow.map = null as any;
        }
      }
      if (!this.scene.fog) {
        const fogColor = new THREE.Color("#e0f0ff");
        this.scene.fog = new THREE.FogExp2(fogColor, 0.015);
      }
    }

    // Force materials shader recompilation to apply shadow map changes
    this.scene.traverse((node) => {
      if ((node as THREE.Mesh).isMesh) {
        const mesh = node as THREE.Mesh;
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((mat) => {
            mat.needsUpdate = true;
          });
        } else if (mesh.material) {
          mesh.material.needsUpdate = true;
        }
      }
    });
  }

  private initEnvironment() {
    this.weatherManager = new WeatherManager(this.getSimContext());
    const land = createLand(this.getSimContext());
    this.waterPlane = land.waterPlane;
    this.buildPreview = land.buildPreview;

    // Mountains at all 4 corners
    const halfGridWorld = (this.gridSize * this.cellSize) / 2;
    createAllMountains(this.scene, halfGridWorld);

    // Beautiful flowing river
    this.riverSystem = createRiver(this.scene, halfGridWorld);
  }

  private async initGrid(layout: string, onProgress?: (progress: number, text: string) => void) {
    const report = async (progress: number, text: string) => {
      if (onProgress) {
        onProgress(progress, text);
        // Yield to browser main thread to allow UI rendering
        await new Promise((resolve) => setTimeout(resolve, 30));
      }
    };

    await report(10, "Initializing grid space...");
    // Initialize 2D grid matrix
    for (let x = 0; x < this.gridSize; x++) {
      this.grid[x] = [];
      for (let z = 0; z < this.gridSize; z++) {
        this.grid[x][z] = {
          x, z,
          type: "empty",
          mesh: null,
          constructionProgress: 0,
          targetType: "empty",
          height: 0,
          id: `cell_${x}_${z}`,
          scale: 1.0,
        };
      }
    }

    await report(20, "Cultivating Central Park...");
    // Park
    this.parkCells = getParkCells(this.gridSize);
    this.parkCells.forEach(key => {
      const [px, pz] = key.split('_').map(Number);
      if (this.grid[px]?.[pz]) {
        this.grid[px][pz].type = 'park';
        this.grid[px][pz].targetType = 'park';
      }
    });
    createCentralPark(this.getSimContext());

    this.isInitializing = true;

    await report(40, "Building the shared city...");
    // Layout string from /api/world: one character per cell, index = x * size + z
    for (let x = 0; x < this.gridSize; x++) {
      for (let z = 0; z < this.gridSize; z++) {
        const type = LAYOUT_CODES[layout[x * this.gridSize + z]];
        if (type && !this.parkCells.has(`${x}_${z}`)) this.spawnInstantItem(x, z, type);
      }
      if (x % 50 === 49) await report(40 + Math.round((x / this.gridSize) * 50), "Building the shared city...");
    }

    await report(95, "Spawning city population & wildlife...");
    // City NPCs are simulated on the server and arrive over the WebSocket

    // Animals: 10 dogs + 10 cows + 15 cats + colorful parrots
    this._spawnSpecificAnimals('dog', 10);
    this._spawnSpecificAnimals('cow', 10);
    this._spawnSpecificAnimals('cat', 15);
    spawnAnimals(this.getSimContext(), this.animals);
    spawnAnimals(this.getSimContext(), this.animals);

    this.isInitializing = false;
    this.recalculateRoadConnections();
    this.gridVersion++;

    await report(100, "City Loaded!");
  }

  /** Spawn a specific type of animal N times */
  private _spawnSpecificAnimals(type: 'cow' | 'dog' | 'cat' | 'bird', count: number) {
    const ctx = this.getSimContext();
    for (let i = 0; i < count; i++) {
      const spawnX = (Math.random() - 0.5) * (this.gridSize * this.cellSize - 8);
      const spawnZ = (Math.random() - 0.5) * (this.gridSize * this.cellSize - 8);

      const isFido = type === 'dog' && i === 0 && !this.animals.some(a => a.isFido);

      const group = new THREE.Group();
      group.position.set(spawnX, 0, spawnZ);

      const agent: Partial<AnimalAgent> = { isFido };
      const mesh = createAnimalMesh(ctx, type, agent);
      mesh.scale.set(this.cellSize / 3.0, this.cellSize / 3.0, this.cellSize / 3.0);
      group.add(mesh);

      ctx.scene.add(group);
      this.animals.push({
        id: isFido ? 'fido' : `animal_${type}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        mesh: group,
        x: spawnX, z: spawnZ,
        targetX: spawnX, targetZ: spawnZ,
        state: 'idle',
        speed: 0.8 + Math.random() * 0.6,
        bounceTimer: Math.random() * 5,
        idleTimer: Math.random() * 4,
        legSwingPivot1: agent.legSwingPivot1,
        legSwingPivot2: agent.legSwingPivot2,
        tailPivot: agent.tailPivot,
        isFido,
      });
    }
  }


  private initRaycasting() {
    const planeGeom = new THREE.PlaneGeometry(
      this.gridSize * this.cellSize,
      this.gridSize * this.cellSize,
    );
    const planeMat = new THREE.MeshBasicMaterial({ visible: false });
    this.gridPlane = new THREE.Mesh(planeGeom, planeMat);
    this.gridPlane.rotation.x = -Math.PI / 2;
    this.gridPlane.position.set(0, 0, 0);
    this.scene.add(this.gridPlane);

    this.container.addEventListener("pointermove", this.onPointerMove);
    this.container.addEventListener("pointerdown", this.onPointerDown, true);
    this.container.addEventListener("pointerleave", this.onPointerLeave);
    this.container.addEventListener("contextmenu", this.onContextMenu);
  }

  private onPointerMove = (event: PointerEvent) => {
    this.cameraManager.rotateCameraOnHover(
      event,
      !!this.player,
      this.buildMode,
      this.isAdmin,
    );

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(this.gridPlane);

    const canBuild = this.isAdmin || (this.buildMode && this.buildMode !== "delete" && this.unlockedPermits.includes(this.buildMode));
    if (intersects.length > 0 && this.buildMode && canBuild) {
      const point = intersects[0].point;
      const halfGrid = (this.gridSize * this.cellSize) / 2;

      const gx = Math.floor((point.x + halfGrid) / this.cellSize);
      const gz = Math.floor((point.z + halfGrid) / this.cellSize);

      if (gx >= 0 && gx < this.gridSize && gz >= 0 && gz < this.gridSize) {
        this.currentHoverCell = { x: gx, z: gz };

        const worldX = gx * this.cellSize - halfGrid + this.cellSize / 2;
        const worldZ = gz * this.cellSize - halfGrid + this.cellSize / 2;
        this.buildPreview.position.set(worldX, 0.05, worldZ);
        this.buildPreview.visible = true;

        const cell = this.grid[gx][gz];
        if (this.buildMode === "delete") {
          (this.buildPreview.material as THREE.MeshBasicMaterial).color.setHex(
            0xff0000,
          );
        } else {
          const isPark = cell.type === 'park';
          const isValid = cell.type === "empty";
          (this.buildPreview.material as THREE.MeshBasicMaterial).color.setHex(
            isPark ? 0x44ff88 : isValid ? 0x00ff00 : 0xffa500,
          );
        }
        return;
      }
    }

    this.buildPreview.visible = false;
  };

  private onContextMenu = (event: MouseEvent) => {
    event.preventDefault();
  };

  private onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) {
      return;
    }
    const canBuild = this.isAdmin || (this.buildMode && this.buildMode !== "delete" && this.unlockedPermits.includes(this.buildMode));
    if (!canBuild) return;
    if (this.currentHoverCell && this.buildMode) {
      const { x, z } = this.currentHoverCell;
      // Block building on park cells
      if (this.parkCells.has(`${x}_${z}`)) return;
      if (this.buildMode === "delete") {
        if (!this.isAdmin) return;
        this.demolishCell(x, z);
      } else {
        this.orderConstruction(x, z, this.buildMode);
      }
    }
  };

  private onPointerLeave = () => {
    this.buildPreview.visible = false;
    this.currentHoverCell = null;
    this.cameraManager.resetPrevMouse();
  };

  private spawnInstantItem(
    x: number,
    z: number,
    type: "road" | "tree" | "house" | "skyscraper" | "restaurant" | "clothshop" | "barbershop" | "policestation",
  ) {
    if (x < 0 || x >= this.gridSize || z < 0 || z >= this.gridSize) return;
    // Never overwrite park cells
    if (this.parkCells.has(`${x}_${z}`)) return;

    const cell = this.grid[x][z];
    if (cell.mesh) {
      this.scene.remove(cell.mesh);
    }

    cell.type = type;
    cell.constructionProgress = 100;
    cell.targetType = type;
    cell.scale = cell.scale || 1.0;

    const mesh = this.createMeshForType(type, x, z);
    cell.mesh = mesh;
    this.scene.add(mesh);

    if (this.isInitializing) {
      const cellScale = cell.scale || 1.0;
      const finalScale = (this.cellSize / 3.0) * cellScale;
      mesh.scale.set(finalScale, finalScale, finalScale);
      if (type !== "road") {
        this.updateStoreBoard(x, z);
      }
      this.makeStatic(mesh);
    } else {
      mesh.scale.set(0.01, 0.01, 0.01);
      const cellScale = cell.scale || 1.0;
      const finalScale = (this.cellSize / 3.0) * cellScale;
      this.animateGrow(mesh, finalScale, 400);

      if (type === "road") {
        this.recalculateRoadConnections();
      } else {
        this.updateStoreBoard(x, z);
      }
      this.gridVersion++;
      this.updateCellVisibility(this.lastVisibleGx, this.lastVisibleGz);
    }
  }

  private orderConstruction(
    x: number,
    z: number,
    type: "road" | "tree" | "house" | "skyscraper" | "restaurant" | "clothshop" | "barbershop" | "policestation",
  ) {
    const cell = this.grid[x][z];
    if (cell.type !== "empty") return;

    // Deduct coins if applicable based on building type and scale
    const baseCostMap: Record<string, number> = {
      road: 5,
      tree: 10,
      house: 50,
      skyscraper: 150,
      restaurant: 100,
      clothshop: 80,
      barbershop: 60,
      policestation: 120
    };

    const baseCost = baseCostMap[type] || 0;
    const selectedScale = this.selectedBuildScale || 1.0;
    const finalCost = Math.round(baseCost * selectedScale);

    if (!this.isAdmin && this.shunyaCoins < finalCost) {
      window.dispatchEvent(new CustomEvent("shunya-toast", { 
        detail: { message: `Not enough ShunyaCoins! Need ${finalCost} SC.`, type: "warning" } 
      }));
      return;
    }

    // The server deducts the construction cost when it accepts the grid update

    // Optimistic owner info; the server's grid-updated reply is authoritative
    const isStoreType = ["restaurant", "clothshop", "barbershop", "policestation"].includes(type);
    cell.ownerId = isStoreType ? this.player?.playerId ?? null : null;
    cell.ownerName = isStoreType ? this.player?.playerName ?? null : null;
    cell.builderId = this.player?.playerId ?? null;
    cell.isPurchased = isStoreType;
    cell.price = isStoreType ? finalCost : 0;

    cell.type = "construction";
    cell.targetType = type;
    cell.constructionProgress = 0;
    cell.scale = selectedScale;

    const constructionMesh = createConstructionSiteMesh(
      this.getSimContext(),
      x,
      z,
    );
    const finalScale = (this.cellSize / 3.0) * selectedScale;
    constructionMesh.scale.set(finalScale, finalScale, finalScale);
    cell.mesh = constructionMesh;
    this.scene.add(constructionMesh);
    this.makeStatic(constructionMesh);
    this.gridVersion++;
    this.updateCellVisibility(this.lastVisibleGx, this.lastVisibleGz);

    this.audio.playPop();
    this.spawnParticle(x, z, "#eebb33", 8);

    // A builder NPC is dispatched by the server
    this.updateStats();

    if (this.player) {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(
          JSON.stringify({
            type: "grid-update",
            cell: {
              x,
              z,
              type: "construction",
              targetType: type,
              constructionProgress: 0,
              height: cell.height,
              scale: selectedScale,
            },
          }),
        );
      } else {
        fetch("/api/grid", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            x,
            z,
            type: "construction",
            targetType: type,
            constructionProgress: 0,
            height: cell.height,
            scale: selectedScale,
          }),
        })
          .then((res) => {
            if (res.status === 401) {
              window.dispatchEvent(new CustomEvent("auth-unauthorized"));
            }
          })
          .catch((err) =>
            console.error("Failed to save grid construction:", err),
          );
      }
    }
  }

  private demolishCell(x: number, z: number) {
    const cell = this.grid[x][z];
    if (cell.type === "empty") return;

    if (cell.mesh) {
      this.scene.remove(cell.mesh);
    }

    const oldType = cell.type;
    cell.type = "empty";
    cell.targetType = "empty";
    cell.mesh = null;
    cell.constructionProgress = 0;
    this.gridVersion++;

    this.audio.playDestroy();
    this.spawnParticle(x, z, "#555555", 15);

    if (oldType === "road") {
      this.recalculateRoadConnections();
      this.vehicles = cleanStrandedVehicles(
        this.getSimContext(),
        this.vehicles,
        this.grid,
      );
    }

    this.humans.forEach((h) => {
      if (h.jobCellX === x && h.jobCellZ === z) {
        h.state = "idle";
        h.jobCellX = null;
        h.jobCellZ = null;
        h.path = [];
      }
    });

    this.updateStats();

    if (this.isAdmin && this.player) {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(
          JSON.stringify({
            type: "grid-update",
            cell: {
              x,
              z,
              type: "empty",
              targetType: "empty",
              constructionProgress: 0,
              height: 0,
            },
          }),
        );
      } else {
        fetch("/api/grid", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            x,
            z,
            type: "empty",
            targetType: "empty",
            constructionProgress: 0,
            height: 0,
          }),
        })
          .then((res) => {
            if (res.status === 401) {
              window.dispatchEvent(new CustomEvent("auth-unauthorized"));
            }
          })
          .catch((err) => console.error("Failed to save grid demolition:", err));
      }
    }
    this.updateCellVisibility(this.lastVisibleGx, this.lastVisibleGz);
  }

  public recalculateRoadConnections() {
    recalculateRoadConnections(this.getSimContext(), this.grid);
  }

  private createMeshForType(
    type: "road" | "tree" | "house" | "skyscraper" | "restaurant" | "clothshop" | "barbershop" | "policestation",
    x: number,
    z: number,
  ): THREE.Group {
    let mesh: THREE.Group;
    switch (type) {
      case "road":
        mesh = createRoadMesh(this.getSimContext(), x, z);
        break;
      case "tree":
        mesh = createTreeMesh(this.getSimContext(), x, z);
        break;
      case "house":
        mesh = createHouseMesh(this.getSimContext(), x, z);
        break;
      case "skyscraper":
        mesh = createSkyscraperMesh(this.getSimContext(), x, z);
        break;
      case "restaurant":
        mesh = createRestaurantMesh(this.getSimContext(), x, z);
        break;
      case "clothshop":
        mesh = createClothShopMesh(this.getSimContext(), x, z);
        break;
      case "barbershop":
        mesh = createBarbershopMesh(this.getSimContext(), x, z);
        break;
      case "policestation":
        mesh = createPoliceStationMesh(this.getSimContext(), x, z);
        break;
    }

    const cell = this.grid[x]?.[z];
    const cellScale = cell?.scale ?? 1.0;
    const baseScale = this.cellSize / 3.0;
    const finalScale = baseScale * cellScale;
    mesh.scale.set(finalScale, finalScale, finalScale);
    return mesh;
  }

  private animateGrow(
    mesh: THREE.Group,
    targetScale: number,
    duration: number,
  ) {
    const startTime = performance.now();
    const startScale = mesh.scale.x;

    const update = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1.0);

      // Elastic Out ease
      const ease = (t: number) => {
        const p = 0.3;
        return (
          Math.pow(2, -10 * t) * Math.sin(((t - p / 4) * (2 * Math.PI)) / p) + 1
        );
      };

      const scale = startScale + (targetScale - startScale) * ease(progress);
      mesh.scale.set(scale, scale, scale);

      if (progress < 1.0) {
        requestAnimationFrame(update);
      } else {
        this.makeStatic(mesh);
      }
    };
    requestAnimationFrame(update);
  }

  /** Ask the server to finish a construction site (player job helper). */
  public completeConstruction(x: number, z: number) {
    const cell = this.grid[x]?.[z];
    if (!cell || cell.type !== "construction" || !this.player) return;

    const payload = {
      x,
      z,
      type: cell.targetType,
      targetType: cell.targetType,
      constructionProgress: 100,
      height: cell.height,
      scale: cell.scale,
    };
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "grid-update", cell: payload }));
    } else {
      fetch("/api/grid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then((res) => {
          if (res.status === 401) {
            window.dispatchEvent(new CustomEvent("auth-unauthorized"));
          }
        })
        .catch((err) => console.error("Failed to save grid completion:", err));
    }
  }

  /**
   * Effects for a construction site the server just finished: grow the new
   * building in, and credit the build to the player who ordered it.
   */
  private playCompletion(cell: GridCell, mesh: THREE.Group) {
    const finalScale = (this.cellSize / 3.0) * (cell.scale || 1.0);
    mesh.scale.set(0.01, 0.01, 0.01);
    this.animateGrow(mesh, finalScale, 500);

    if (this.player) {
      const dist = Math.hypot(
        mesh.position.x - this.player.mesh.position.x,
        mesh.position.z - this.player.mesh.position.z,
      );
      if (dist < 30) this.audio.playPop();
    }
    this.spawnParticle(cell.x, cell.z, "#5cd65c", 12);

    if (cell.type === "road" && Math.random() < 0.25) {
      spawnVehicleOnRoad(this.getSimContext(), this.vehicles, this.humans, cell.x, cell.z);
    }

    if (cell.builderId && cell.builderId === this.player?.playerId && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("shunya-build-completed", { detail: { type: cell.type } }));
      if (cell.type === "tree") {
        window.dispatchEvent(new CustomEvent("shunya-tree-planted"));
      }
    }
  }

  private playerLevel = 1;

  public spawnPlayer(
    name: string,
    _x: number = 0,
    _z: number = 0,
    clothingColor?: number,
    userId?: string,
    level: number = 1,
  ) {
    if (this.isDestroyed) return;

    this.playerLevel = level;

    if (this.player) {
      this.scene.remove(this.player.mesh);
      this.humans = this.humans.filter((h) => h.id !== this.player!.id);
      this.player = null;
    }

    const halfGrid = (this.gridSize * this.cellSize) / 2;
    // Always spawn users in the central park (center of the grid) when they start
    const center = Math.floor(this.gridSize / 2);
    const worldX = center * this.cellSize - halfGrid + this.cellSize / 2;
    const worldZ = center * this.cellSize - halfGrid + this.cellSize / 2;

    const col = clothingColor ?? 0xff3b30;

    const humanGroup = new THREE.Group();
    humanGroup.position.set(worldX, 3.5, worldZ);

    const agent: Partial<HumanAgent> = {};
    const mesh = createRefinedHumanMesh(this.getSimContext(), col, true, agent);
    mesh.scale.set(this.cellSize / 3.0, this.cellSize / 3.0, this.cellSize / 3.0);
    humanGroup.add(mesh);

    const nameTag = createNameTag(`[Lvl ${level}] ${name}`);
    humanGroup.add(nameTag);

    this.scene.add(humanGroup);

    const cellX = Math.max(
      0,
      Math.min(
        this.gridSize - 1,
        Math.floor((worldX + halfGrid) / this.cellSize),
      ),
    );
    const cellZ = Math.max(
      0,
      Math.min(
        this.gridSize - 1,
        Math.floor((worldZ + halfGrid) / this.cellSize),
      ),
    );

    const playerAgent: HumanAgent = {
      id: `player_${Math.random().toString(36).substr(2, 9)}`,
      mesh: humanGroup,
      x: worldX,
      z: worldZ,
      targetX: worldX,
      targetZ: worldZ,
      state: "idle",
      targetCellX: cellX,
      targetCellZ: cellZ,
      path: [],
      pathIndex: 0,
      speed: 8.5,
      bounceTimer: 0,
      workTimer: 0,
      jobCellX: null,
      jobCellZ: null,
      clothingColor: col,
      isPlayer: true,
      playerName: name,
      playerId: userId,
      upperBody: agent.upperBody,
      leftLegPivot: agent.leftLegPivot,
      rightLegPivot: agent.rightLegPivot,
      leftArmPivot: agent.leftArmPivot,
      rightArmPivot: agent.rightArmPivot,
      actionState: "jumping", // Drop animation
      actionTimer: 0,
      jumpVelocity: 0,
      nameTag,
    };

    // Assign King character for the player — loads immediately (distance = 0)
    assignNpcCharacter(playerAgent, true, false);

    this.humans.push(playerAgent);
    this.player = playerAgent;

    // Position camera close-up at 5.5× zoom (offset scaled to distance ≈ 7.39 from target)
    this.camera.position.set(worldX + 4.55, 3.64, worldZ + 4.55);
    this.controls.target.set(worldX, 0, worldZ);
    this.controls.update();

    this.lastSyncedPosition.copy(humanGroup.position);
    this.lastPlayerPosition = new THREE.Vector3().copy(humanGroup.position);

    this.updateCameraControls();

    this.audio.playSpawn();

    const pCellX = Math.max(
      0,
      Math.min(
        this.gridSize - 1,
        Math.floor((worldX + halfGrid) / this.cellSize),
      ),
    );
    const pCellZ = Math.max(
      0,
      Math.min(
        this.gridSize - 1,
        Math.floor((worldZ + halfGrid) / this.cellSize),
      ),
    );
    this.spawnParticle(pCellX, pCellZ, "#ffbd03", 25);

    this.initKeyboardListeners();
    this.updateStats();

    this.lastVisibleGx = pCellX;
    this.lastVisibleGz = pCellZ;
    this.updateCellVisibility(pCellX, pCellZ);
  }

  public updatePlayerLevel(newLvl: number) {
    this.playerLevel = newLvl;
    if (this.player) {
      const oldTag = this.player.mesh.children.find(c => c instanceof THREE.Sprite);
      if (oldTag) {
        this.player.mesh.remove(oldTag);
      }
      const newTag = createNameTag(`[Lvl ${newLvl}] ${this.player.playerName || ""}`);
      this.player.mesh.add(newTag);
      this.player.nameTag = newTag;
    }
  }

  public updateOtherPlayerLevel(userId: string, newLevel: number) {
    if (this.isDestroyed) return;
    const existing = this.humans.find(h => h.id === `db_user_${userId}`);
    if (existing) {
      const oldTag = existing.mesh.children.find(c => c instanceof THREE.Sprite);
      if (oldTag) {
        existing.mesh.remove(oldTag);
      }
      const newTag = createNameTag(`[Lvl ${newLevel}] ${existing.playerName || ""}`);
      existing.mesh.add(newTag);
      existing.nameTag = newTag;
    }
  }

  public startWorking() {
    if (this.player) {
      this.player.state = "working";
      this.player.actionState = "idle";
    }
  }

  public stopWorking() {
    if (this.player) {
      this.player.state = "idle";
    }
  }

  public setFidoQuestOwner(npcId: string) {
    this.fidoQuestOwnerId = npcId;
  }

  public stopFidoFollowing() {
    if (this.animals) {
      const dog = this.animals.find((a) => a.type === "dog" && a.isFido);
      if (dog) {
        dog.isFollowingPlayer = false;
      }
    }
    this.fidoQuestOwnerId = null;
  }

  /** Changes the player's hair color instantly by traversing mesh materials */
  public updatePlayerHairColor(hexColor: string) {
    if (!this.player) return;
    const colorVal = new THREE.Color(hexColor);
    this.player.mesh.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const mat = obj.material as THREE.MeshLambertMaterial;
      // Hair meshes use a material name prefixed with 'hair_'
      if (mat.name?.startsWith('hair_') || (mat.color && (
        mat.color.getHexString() === '1a1a1a' ||
        mat.color.getHexString() === '4a2f13' ||
        mat.color.getHexString() === 'd9a752' ||
        mat.color.getHexString() === 'b83b1d'
      ))) {
        // Clone material to avoid affecting NPCs sharing the cached material
        const cloned = (mat as THREE.MeshLambertMaterial).clone();
        cloned.color = colorVal;
        obj.material = cloned;
      }
    });
    // Store new color on player for persistence
    if (this.player) {
      (this.player as any).hairColor = hexColor;
    }
  }

  /** Changes player shirt, pant, or shoe color by swapping materials */
  public updatePlayerClothing(slot: 'shirt' | 'pant' | 'shoe', hexColor: string) {
    if (!this.player) return;
    const colorVal = new THREE.Color(hexColor);

    this.player.mesh.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const mat = obj.material as THREE.MeshLambertMaterial;
      const matName = mat.name ?? '';

      let matches = false;
      if (slot === 'shirt' && matName.startsWith('shirt_')) matches = true;
      if (slot === 'pant' && matName.startsWith('pants_')) matches = true;
      if (slot === 'shoe' && (matName === 'shoes_black' || matName.startsWith('shoes_'))) matches = true;

      if (matches) {
        const cloned = (mat as THREE.MeshLambertMaterial).clone();
        cloned.color = colorVal;
        obj.material = cloned;
      }
    });
  }


  /**
   * Expands the city grid by purchasing a land plot.
   * Called by CitySimulator after coins are deducted.
   */
  public expandGrid(plotId: string): boolean {
    const result = this.landExpansionManager.purchase(plotId);
    if (!result) return false;

    const { newGridCols, newGridRows, offsetX, offsetZ, newCells } = result;

    // Build new 2D grid array with expanded dimensions
    const newGrid: GridCell[][] = [];
    for (let x = 0; x < newGridCols; x++) {
      newGrid[x] = [];
      for (let z = 0; z < newGridRows; z++) {
        const oldX = x - offsetX;
        const oldZ = z - offsetZ;
        if (
          oldX >= 0 && oldX < this.grid.length &&
          this.grid[oldX] &&
          oldZ >= 0 && oldZ < (this.grid[oldX]?.length ?? 0) &&
          this.grid[oldX][oldZ]
        ) {
          // Existing cell — update its indices if shifted
          const existing = this.grid[oldX][oldZ];
          existing.x = x;
          existing.z = z;
          existing.id = `cell_${x}_${z}`;
          // Update world position of any mesh
          if (existing.mesh) {
            const halfGridNew = (newGridCols * this.cellSize) / 2;
            const wx = x * this.cellSize - halfGridNew + this.cellSize / 2;
            const wz = z * this.cellSize - halfGridNew + this.cellSize / 2;
            existing.mesh.position.x = wx;
            existing.mesh.position.z = wz;
          }
          newGrid[x][z] = existing;
        } else {
          // New cell
          newGrid[x][z] = {
            x,
            z,
            type: 'empty',
            mesh: null,
            constructionProgress: 0,
            targetType: 'empty',
            height: 0,
            id: `cell_${x}_${z}`,
          };
        }
      }
    }

    this.grid = newGrid;
    this.gridSize = Math.max(newGridCols, newGridRows);

    // Shift all scene objects if grid origin moved (north/west expansion)
    if (offsetX !== 0 || offsetZ !== 0) {
      const dx = offsetX * this.cellSize;
      const dz = offsetZ * this.cellSize;
      this.scene.traverse(obj => {
        if (obj === this.scene) return;
        // Only shift if it's a positioned object that's not the ground/water
        if ((obj as THREE.Mesh).isMesh || (obj as THREE.Group).isGroup) {
          const parent = obj.parent;
          if (parent === this.scene) {
            obj.position.x += dx;
            obj.position.z += dz;
          }
        }
      });
    }

    // Rebuild raycasting plane
    if (this.gridPlane) {
      this.scene.remove(this.gridPlane);
    }
    const planeGeom = new THREE.PlaneGeometry(
      newGridCols * this.cellSize,
      newGridRows * this.cellSize,
    );
    const planeMat = new THREE.MeshBasicMaterial({ visible: false });
    this.gridPlane = new THREE.Mesh(planeGeom, planeMat);
    this.gridPlane.rotation.x = -Math.PI / 2;
    this.gridPlane.position.set(0, 0, 0);
    this.scene.add(this.gridPlane);

    // Resize the grid helper overlay
    resizeGridHelper(this.scene, Math.max(newGridCols, newGridRows), this.cellSize);

    // Seed a few trees on new land
    const newAreaCells = newCells.filter(c => c.type === 'empty');
    const treesToSeed = Math.floor(newAreaCells.length * 0.08);
    for (let i = 0; i < treesToSeed; i++) {
      const rCell = newAreaCells[Math.floor(Math.random() * newAreaCells.length)];
      this.spawnInstantItem(rCell.x, rCell.z, 'tree');
    }

    // Reveal animation — golden particle sweep across new cells
    newAreaCells.forEach((cell, idx) => {
      setTimeout(() => {
        if (!this.isDestroyed) {
          this.spawnParticle(cell.x, cell.z, '#ffcc33', 2);
        }
      }, idx * 8 + Math.random() * 120);
    });

    this.audio.playPop();
    this.updateStats();
    return true;
  }

  /** Replace other players' avatars with the server's online list. */
  public syncRemotePlayers(users: RemoteUser[], selfId: string | null) {
    if (this.isDestroyed) return;
    syncRemotePlayers(this.getSimContext(), this.humans, users, selfId);
  }

  public addRemotePlayer(user: RemoteUser, selfId: string | null) {
    if (this.isDestroyed) return;
    upsertRemotePlayer(this.getSimContext(), this.humans, user, selfId);
  }

  /** Server NPC routes; also records the server clock offset from `t`. */
  public applyNpcSnapshots(npcs: NpcSnapshot[], serverTime: number, replaceAll: boolean) {
    if (this.isDestroyed) return;
    this.serverTimeOffset = serverTime - Date.now();
    applyNpcSnapshots(this.getSimContext(), this.humans, npcs, replaceAll);
  }

  public updateOtherPlayerPosition(userId: string, x: number, z: number) {
    if (this.isDestroyed) return;
    if (this.player && this.player.playerId === userId) return; // ignore self

    const existing = this.humans.find(h => h.id === `db_user_${userId}`);
    if (existing) {
      existing.targetX = x;
      existing.targetZ = z;

      const dx = Math.abs(existing.mesh.position.x - x);
      const dz = Math.abs(existing.mesh.position.z - z);
      if (dx > 8.0 || dz > 8.0) {
        existing.mesh.position.set(x, 0, z);
        existing.x = x;
        existing.z = z;
      }
    }
  }

  public removePlayerAvatar(userId: string) {
    if (this.isDestroyed) return;
    const existingIndex = this.humans.findIndex(h => h.id === `db_user_${userId}`);
    if (existingIndex !== -1) {
      const h = this.humans[existingIndex];
      this.scene.remove(h.mesh);
      this.humans.splice(existingIndex, 1);

      const halfGrid = (this.gridSize * this.cellSize) / 2;
      const cx = Math.max(0, Math.min(this.gridSize - 1, Math.floor((h.mesh.position.x + halfGrid) / this.cellSize)));
      const cz = Math.max(0, Math.min(this.gridSize - 1, Math.floor((h.mesh.position.z + halfGrid) / this.cellSize)));
      this.spawnParticle(cx, cz, "#ff4444", 10);
    }
  }

  public syncGrid(cells: WorldCell[]) {
    if (this.isDestroyed) return;
    if (!this.worldLoaded) {
      this.pendingGridCells.push(...cells);
      return;
    }

    let hasGridChanges = false;
    let roadsChanged = false;
    cells.forEach((c) => {
      if (c.x < 0 || c.x >= this.gridSize || c.z < 0 || c.z >= this.gridSize)
        return;
      // Park cells are fixed scenery; the server never changes them
      if (c.type === "park") return;
      const localCell = this.grid[c.x][c.z];
      const wasRoad = localCell.type === "road";

      const needsUpdate =
        localCell.type !== c.type ||
        localCell.targetType !== c.targetType ||
        localCell.constructionProgress !== c.constructionProgress ||
        localCell.scale !== c.scale ||
        localCell.ownerName !== c.ownerName ||
        localCell.ownerId !== c.ownerId ||
        localCell.builderId !== c.builderId ||
        localCell.price !== c.price ||
        localCell.isPurchased !== c.isPurchased;

      if (needsUpdate) {
        hasGridChanges = true;
        const typeOrScaleChanged = localCell.type !== c.type || localCell.scale !== c.scale;
        const completed =
          localCell.type === "construction" && c.type !== "construction" && c.type !== "empty";

        localCell.type = c.type;
        localCell.targetType = c.targetType;
        localCell.constructionProgress = c.constructionProgress;
        localCell.scale = c.scale !== undefined ? c.scale : 1.0;
        localCell.ownerName = c.ownerName !== undefined ? c.ownerName : null;
        localCell.ownerId = c.ownerId ?? null;
        localCell.builderId = c.builderId ?? null;
        localCell.price = c.price !== undefined ? c.price : 0;
        localCell.isPurchased = c.isPurchased !== undefined ? c.isPurchased : false;

        if (typeOrScaleChanged && localCell.mesh) {
          this.scene.remove(localCell.mesh);
          localCell.mesh = null;
          localCell.boardSprite = null;
        }

        if (!localCell.mesh && c.type !== "empty") {
          if (c.type === "construction") {
            localCell.mesh = createConstructionSiteMesh(
              this.getSimContext(),
              c.x,
              c.z,
            );
            const scaleMultiplier = (this.cellSize / 3.0) * (localCell.scale ?? 1.0);
            localCell.mesh.scale.set(scaleMultiplier, scaleMultiplier, scaleMultiplier);
          } else {
            localCell.mesh = this.createMeshForType(c.type, c.x, c.z);
          }
          this.scene.add(localCell.mesh);
          // animateGrow freezes the mesh itself once the animation ends
          if (completed) this.playCompletion(localCell, localCell.mesh);
          else this.makeStatic(localCell.mesh);
        }

        if (c.type === "road" || wasRoad) roadsChanged = true;

        // Draw/update store boards
        this.updateStoreBoard(c.x, c.z);
      }
    });
    if (roadsChanged) this.recalculateRoadConnections();
    if (hasGridChanges) {
      this.gridVersion++;
    }
    this.updateStats();
    this.updateCellVisibility(this.lastVisibleGx, this.lastVisibleGz);
  }

  public spawnParticle(
    cellX: number,
    cellZ: number,
    colorStr: string,
    count: number = 5,
  ) {
    const halfGrid = (this.gridSize * this.cellSize) / 2;
    const worldX = cellX * this.cellSize - halfGrid + this.cellSize / 2;
    const worldZ = cellZ * this.cellSize - halfGrid + this.cellSize / 2;

    const partMat = this.getMaterial(`particle_${colorStr}`, {
      color: colorStr,
      transparent: true,
      opacity: 0.8,
      emissive: colorStr,
      roughness: 0.5,
    });

    const partGeom = this.getGeometry(
      "part_mesh",
      () => new THREE.BoxGeometry(0.12, 0.12, 0.12),
    );

    for (let i = 0; i < count; i++) {
      const pMesh = new THREE.Mesh(partGeom, partMat);
      pMesh.position.set(
        worldX + (Math.random() - 0.5) * 1.5,
        0.5 + Math.random() * 0.8,
        worldZ + (Math.random() - 0.5) * 1.5,
      );
      this.scene.add(pMesh);

      this.particles.push({
        mesh: pMesh,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 1.0,
          1.5 + Math.random() * 2.0,
          (Math.random() - 0.5) * 1.0,
        ),
        life: 1.0,
        decay: 0.8 + Math.random() * 0.8,
      });
    }
  }

  private initKeyboardListeners() {
    if (this.hasKeyboardListeners) return;
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    this.hasKeyboardListeners = true;
  }

  private onKeyDown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    this.keysPressed[key] = true;
    if (event.code === "Space") {
      this.keysPressed["space"] = true;
    }

    if (!this.player) return;

    if (event.code === "Space") {
      if (
        this.player.mesh.position.y <= 0.05 &&
        this.player.actionState !== "jumping"
      ) {
        this.player.jumpVelocity = 7.0;
        this.player.actionState = "jumping";
        this.audio.playPop();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("shunya-jumped"));
        }
      }
    }

    if (key === "u" || key === "i") {
      this.player.actionState = key === "u" ? "punching" : "kicking";
      this.player.actionTimer = key === "u" ? 0.25 : 0.35;
      if (key === "u") this.audio.playPunch();
      else this.audio.playKick();

      // Check if there is a tree nearby
      const halfGrid = (this.gridSize * this.cellSize) / 2;
      const playerX = this.player.mesh.position.x;
      const playerZ = this.player.mesh.position.z;
      const pgx = Math.floor((playerX + halfGrid) / this.cellSize);
      const pgz = Math.floor((playerZ + halfGrid) / this.cellSize);

      let nearTreeCell: GridCell | null = null;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          const cx = pgx + dx;
          const cz = pgz + dz;
          if (cx >= 0 && cx < this.gridSize && cz >= 0 && cz < this.gridSize) {
            if (this.grid[cx][cz].type === "tree") {
              nearTreeCell = this.grid[cx][cz];
              break;
            }
          }
        }
        if (nearTreeCell) break;
      }

      if (nearTreeCell) {
        this.spawnParticle(nearTreeCell.x, nearTreeCell.z, "#22c55e", 6);
        const tKey = `${nearTreeCell.x}_${nearTreeCell.z}`;
        const hits = (this.treeHits.get(tKey) || 0) + 1;
        this.treeHits.set(tKey, hits);

        if (hits >= 3) {
          this.treeHits.delete(tKey);
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("shunya-harvest", {
                detail: {
                  type: "wood",
                  coins: 5,
                  wood: 2,
                  xp: 4,
                },
              }),
            );
          }
          this.audio.playPop();
          this.spawnParticle(nearTreeCell.x, nearTreeCell.z, "#8b5a2b", 12);
        }
      }
    }
    if (key === "j") {
      if (this.player.actionState === "sitting") {
        this.player.actionState = "idle";
      } else {
        this.player.actionState = "sitting";
      }
    }
  };

  private onKeyUp = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    this.keysPressed[key] = false;
    if (event.code === "Space") {
      this.keysPressed["space"] = false;
    }
  };

  private animate = () => {
    if (this.isDestroyed) return;
    this.animationFrameId = requestAnimationFrame(this.animate);

    const now = performance.now();
    const minFrameInterval = 1000 / this.fpsCap;
    if (now - this.lastFrameTime < minFrameInterval - 1) { // 1ms tolerance to avoid dropping frames close to target
      return;
    }
    this.lastFrameTime = now;

    this.timer.update();
    const delta = Math.min(this.timer.getDelta(), 0.1);

    // Keyboard Camera Rotation (WASD keys for horizontal and vertical orbit)
    if (
      this.keysPressed["w"] ||
      this.keysPressed["s"] ||
      this.keysPressed["a"] ||
      this.keysPressed["d"]
    ) {
      const offset = new THREE.Vector3().copy(this.camera.position).sub(this.controls.target);
      
      // Horizontal rotation (A and D keys)
      if (this.keysPressed["a"] || this.keysPressed["d"]) {
        const rotationSpeed = 1.5 * delta;
        const angle = this.keysPressed["a"] ? rotationSpeed : -rotationSpeed;
        offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
      }

      // Vertical rotation (W and S keys)
      if (this.keysPressed["w"] || this.keysPressed["s"]) {
        const rotationSpeed = 1.5 * delta;
        // w moves camera UP (decreases polar angle), s moves camera DOWN (increases polar angle)
        const angle = this.keysPressed["w"] ? -rotationSpeed : rotationSpeed;
        
        // Calculate the local camera right axis in the horizontal plane
        const right = new THREE.Vector3().crossVectors(offset, new THREE.Vector3(0, 1, 0)).normalize();
        
        // Test rotate the offset around the right axis
        const testOffset = offset.clone().applyAxisAngle(right, angle);
        
        // Check polar angle limits to prevent flipping/clipping
        const up = new THREE.Vector3(0, 1, 0);
        const polarAngle = testOffset.angleTo(up);
        
        const minPolar = 0.01;
        const maxPolar = this.controls.maxPolarAngle || (Math.PI / 2 - 0.05);
        
        if (polarAngle >= minPolar && polarAngle <= maxPolar) {
          offset.copy(testOffset);
        }
      }

      this.camera.position.copy(this.controls.target).add(offset);
      this.controls.update();
    }

    // Keyboard Camera Zooming (q to zoom in, e to zoom out)
    if (this.keysPressed["q"] || this.keysPressed["e"]) {
      const offset = new THREE.Vector3().copy(this.camera.position).sub(this.controls.target);
      const zoomSpeed = 2.0; // zoom speed factor
      // Zoom factor: if 'q' is pressed, zoom in (multiplier < 1), if 'e' is pressed, zoom out (multiplier > 1)
      const factor = this.keysPressed["q"] ? (1 - zoomSpeed * delta) : (1 + zoomSpeed * delta);
      offset.multiplyScalar(factor);
      
      const currentDist = offset.length();
      const clampedDist = Math.max(this.controls.minDistance, Math.min(this.controls.maxDistance, currentDist));
      offset.setLength(clampedDist);
      
      this.camera.position.copy(this.controls.target).add(offset);
      this.controls.update();
    }

    // 1. Weather Update
    this.timeOfDay = this.weatherManager.updateTime(
      this.timeOfDay,
      this.timeSpeed,
      delta,
    );
    this.weatherManager.updateClouds(delta);

    // 2. Human updates
    const syncStates = {
      positionSyncTimer: this.positionSyncTimer,
      lastSyncedPosition: this.lastSyncedPosition,
      lastPlayerPosition: this.lastPlayerPosition,
    };
    updateHumans(
      this.getSimContext(),
      this.humans,
      this.keysPressed,
      delta,
      syncStates,
      Date.now() + this.serverTimeOffset,
      this.fidoQuestOwnerId,
    );
    this.positionSyncTimer = syncStates.positionSyncTimer;

    // LOD-gated glTF character swap + AnimationMixer updates
    const playerPos = this.player ? this.player.mesh.position : null;
    this.humans.forEach((h) => updateCharacterLOD(h, playerPos, delta));

    // 3. Vehicles updates
    updateVehicles(this.getSimContext(), this.vehicles, this.grid, delta);

    // 4. Animal updates (Wandering Cows, Dogs, Cats, Flying Birds)
    updateAnimals(this.getSimContext(), this.animals, delta, this.player);

    // 4.2. Update dynamic entity visibility every 10 frames to reduce CPU overhead (to keep up with NPC movement)
    this.frameCounter++;
    if (this.player && this.lastVisibleGx !== -1 && this.frameCounter % 10 === 0) {
      const range = 15;
      this.updateDynamicEntitiesVisibility(
        this.lastVisibleGx - range,
        this.lastVisibleGx + range,
        this.lastVisibleGz - range,
        this.lastVisibleGz + range
      );
    }

    // 4.5. Collectibles updates
    if (this.player && this.collectibleManager) {
      this.collectibleManager.update(
        delta,
        this.player.mesh.position.x,
        this.player.mesh.position.z,
        this.timer.getElapsed()
      );
    }

    // 4.6. Fido Quest check
    if (this.player && this.animals) {
      const dog = this.animals.find((a) => a.type === "dog" && a.isFido);
      if (dog) {
        const dx = this.player.mesh.position.x - dog.mesh.position.x;
        const dz = this.player.mesh.position.z - dog.mesh.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < 2.5) {
          if (this.fidoQuestState === "active") {
            dog.isFollowingPlayer = true;
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("shunya-fido-near"));
            }
          }
        }
      }
    }

    // 4.7. Update Name Tag Visibility dynamically
    this.humans.forEach((h) => {
      if (h.nameTag) {
        if (h.isPlayer) {
          h.nameTag.visible = false; // Hidden as requested
        } else if (this.fidoQuestOwnerId && h.id === this.fidoQuestOwnerId) {
          h.nameTag.visible = (this.fidoQuestState === "active" || this.fidoQuestState === "fido_found");
        } else {
          h.nameTag.visible = false;
        }
      }
    });

    this.animals.forEach((a) => {
      if (a.nameTag) {
        if (a.type === "dog" && a.isFido) {
          a.nameTag.visible = (this.fidoQuestState === "active" || this.fidoQuestState === "fido_found");
        } else {
          a.nameTag.visible = false;
        }
      }
    });

    // 4.8. Fido Quest Completion Zone (Glowing Circle around Owner)
    if (this.fidoQuestState === "fido_found" && this.fidoQuestOwnerId) {
      const owner = this.humans.find(h => h.id === this.fidoQuestOwnerId);
      if (owner) {
        if (!this.fidoQuestZone) {
          this.fidoQuestZone = new THREE.Group();
          
          // Semi-transparent blue cylinder
          const cylGeom = new THREE.CylinderGeometry(1.6, 1.6, 0.4, 32, 1, true);
          const cylMat = new THREE.MeshBasicMaterial({
            color: 0x0ea5e9,
            transparent: true,
            opacity: 0.2,
            side: THREE.DoubleSide,
            depthWrite: false
          });
          const cylMesh = new THREE.Mesh(cylGeom, cylMat);
          cylMesh.position.y = 0.2;
          this.fidoQuestZone.add(cylMesh);
          
          // Outer blue ring outline on ground
          const ringGeom = new THREE.RingGeometry(1.55, 1.6, 32);
          const ringMat = new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            side: THREE.DoubleSide,
            depthWrite: false
          });
          const ringMesh = new THREE.Mesh(ringGeom, ringMat);
          ringMesh.rotation.x = Math.PI / 2;
          ringMesh.position.y = 0.01;
          this.fidoQuestZone.add(ringMesh);
          
          this.scene.add(this.fidoQuestZone);
        }
        
        // Position it at the owner NPC's position
        this.fidoQuestZone.position.set(owner.mesh.position.x, 0, owner.mesh.position.z);
        
        // Pulse animation effect
        const scale = 1.0 + Math.sin(this.timer.getElapsed() * 4.0) * 0.08;
        this.fidoQuestZone.scale.set(scale, 1.0, scale);
        
        // Proximity check to auto-complete quest
        if (this.player) {
          const dx = this.player.mesh.position.x - owner.mesh.position.x;
          const dz = this.player.mesh.position.z - owner.mesh.position.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist < 1.8) {
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("shunya-fido-returned"));
            }
          }
        }
      }
    } else {
      if (this.fidoQuestZone) {
        this.scene.remove(this.fidoQuestZone);
        this.fidoQuestZone = null;
      }
    }

    // 5. Particles updates
    this.particles = this.particles.filter((p) => {
      p.mesh.position.x += p.velocity.x * delta;
      p.mesh.position.y += p.velocity.y * delta;
      p.mesh.position.z += p.velocity.z * delta;
      p.velocity.y -= 2.0 * delta;
      p.life -= p.decay * delta;
      const size = Math.max(p.life, 0.01);
      p.mesh.scale.set(size, size, size);

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        return false;
      }
      return true;
    });

    // 6. Water wave animation
    if (this.waterPlane) {
      this.waterPlane.position.y =
        -0.02 + Math.sin(this.timer.getElapsed() * 1.2) * 0.025;
    }

    // 7. River system animation
    if (this.riverSystem) {
      this.riverSystem.update(delta, this.timer.getElapsed());
    }

    // 8. Barber pole rotation
    const elapsed = this.timer.getElapsed();
    for (const pole of getBarberPoles()) {
      pole.rotation.y += delta * 1.8;
    }

    // 9. Police station emergency light blink
    const blinkOn = Math.sin(elapsed * 8) > 0;
    for (const ref of getPoliceRefs()) {
      ref.blinkLight.intensity = blinkOn ? 3.0 : 0;
      (ref.blinkMesh.material as THREE.MeshLambertMaterial).emissiveIntensity = blinkOn ? 2.5 : 0.2;
    }

    // standing cell check
    if (this.player) {
      const halfGrid = (this.gridSize * this.cellSize) / 2;
      const gx = Math.floor((this.player.mesh.position.x + halfGrid) / this.cellSize);
      const gz = Math.floor((this.player.mesh.position.z + halfGrid) / this.cellSize);
      if (gx >= 0 && gx < this.gridSize && gz >= 0 && gz < this.gridSize) {
        if (this.lastVisibleGx !== gx || this.lastVisibleGz !== gz) {
          this.lastVisibleGx = gx;
          this.lastVisibleGz = gz;
          this.updateCellVisibility(gx, gz);
        }

        const cell = this.grid[gx][gz];
        if (this.currentCellType !== cell.type) {
          this.currentCellType = cell.type;
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("shunya-cell-change", {
                detail: { type: cell.type, x: gx, z: gz },
              }),
            );
          }
        }
      }
    }

    this.renderer.render(this.scene, this.camera);
  };

  private updateStats() {
    let houses = 0;
    let skyscrapers = 0;
    let trees = 0;
    let roads = 0;
    let activeConstruction = 0;

    for (let x = 0; x < this.grid.length; x++) {
      if (!this.grid[x]) continue;
      for (let z = 0; z < this.grid[x].length; z++) {
        const cell = this.grid[x][z];
        if (!cell) continue;
        if (cell.type === "house") houses++;
        else if (cell.type === "skyscraper") skyscrapers++;
        else if (cell.type === "tree") trees++;
        else if (cell.type === "road") roads++;
        else if (cell.type === "construction") activeConstruction++;
        // 'park' cells are intentionally excluded from counts
      }
    }

    this.onStatsChange({
      population: this.humans.length,
      houses,
      skyscrapers,
      trees,
      roads,
      activeConstruction,
    });
  }

  public isPlayerInsideBlockedCell(): boolean {
    if (!this.player) return false;
    const halfGrid = (this.gridSize * this.cellSize) / 2;
    const gx = Math.floor(
      (this.player.mesh.position.x + halfGrid) / this.cellSize,
    );
    const gz = Math.floor(
      (this.player.mesh.position.z + halfGrid) / this.cellSize,
    );

    if (gx < 0 || gx >= this.gridSize || gz < 0 || gz >= this.gridSize)
      return false;
    // The grid is empty until the shared layout has downloaded
    const cell = this.grid[gx]?.[gz];
    if (!cell) return false;
    return (
      cell.type === "house" ||
      cell.type === "skyscraper" ||
      cell.type === "tree" ||
      cell.type === "construction"
    );
  }

  public teleportPlayerToSafeCell() {
    if (!this.player) return;

    const halfGrid = (this.gridSize * this.cellSize) / 2;
    const playerX = this.player.mesh.position.x;
    const playerZ = this.player.mesh.position.z;
    const pgx = Math.floor((playerX + halfGrid) / this.cellSize);
    const pgz = Math.floor((playerZ + halfGrid) / this.cellSize);

    // Search outwards from current cell for the nearest empty or road cell
    let foundCell: { x: number; z: number } | null = null;
    let minDistance = Infinity;

    for (let x = 0; x < this.gridSize; x++) {
      for (let z = 0; z < this.gridSize; z++) {
        const cell = this.grid[x][z];
        if (cell.type === "empty" || cell.type === "road") {
          const dist = Math.max(Math.abs(x - pgx), Math.abs(z - pgz));
          if (dist < minDistance) {
            minDistance = dist;
            foundCell = { x, z };
          }
        }
      }
    }

    if (foundCell) {
      const targetWorldX =
        foundCell.x * this.cellSize - halfGrid + this.cellSize / 2;
      const targetWorldZ =
        foundCell.z * this.cellSize - halfGrid + this.cellSize / 2;
      this.player.mesh.position.set(targetWorldX, 0.05, targetWorldZ);
      this.player.x = targetWorldX;
      this.player.z = targetWorldZ;
      this.player.targetX = targetWorldX;
      this.player.targetZ = targetWorldZ;
      this.player.path = [];
      this.player.actionState = "idle";
      this.spawnParticle(foundCell.x, foundCell.z, "#00ff00", 10);
      this.audio.playSpawn();
    }
  }

   public updateCameraControls() {
    if (!this.controls) return;
    this.controls.enableRotate = true;
    const canBuild = this.isAdmin || (this.buildMode && this.buildMode !== "delete" && this.unlockedPermits.includes(this.buildMode));
    if (canBuild) {
      (this.controls.mouseButtons as any).LEFT = -1;
    } else {
      (this.controls.mouseButtons as any).LEFT = THREE.MOUSE.ROTATE;
    }
  }

  public updateStoreBoard(x: number, z: number) {
    const cell = this.grid[x]?.[z];
    if (!cell || !cell.mesh) return;

    const isStore = ["restaurant", "clothshop", "barbershop", "policestation"].includes(cell.type);
    if (!isStore) return;

    if (cell.boardSprite) {
      cell.mesh.remove(cell.boardSprite);
      cell.boardSprite = null;
    }

    let storeName = "";
    if (cell.type === "restaurant") storeName = "MCd";
    else if (cell.type === "clothshop") storeName = "Cloth Shop";
    else if (cell.type === "barbershop") storeName = "Barbershop";
    else if (cell.type === "policestation") storeName = "Police Station";

    const ownerDisplayName = cell.isPurchased && cell.ownerName ? cell.ownerName : "For Sale";
    const text = `${ownerDisplayName} ${storeName}`;

    const sprite = this.createStoreBoardSprite(text, !!cell.isPurchased);
    cell.boardSprite = sprite;
    sprite.position.set(0, 3.2, 0);
    cell.mesh.add(sprite);
  }

  private createStoreBoardSprite(text: string, isPurchased: boolean): THREE.Sprite {
    const canvas = document.createElement("canvas");
    canvas.width = 300;
    canvas.height = 70;
    const c = canvas.getContext("2d");
    if (c) {
      c.fillStyle = isPurchased ? "rgba(15, 118, 110, 0.9)" : "rgba(217, 119, 6, 0.9)";
      c.beginPath();
      const x = 5;
      const y = 5;
      const w = 290;
      const h = 60;
      const r = 10;
      c.moveTo(x + r, y);
      c.lineTo(x + w - r, y);
      c.quadraticCurveTo(x + w, y, x + w, y + r);
      c.lineTo(x + w, y + h - r);
      c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      c.lineTo(x + r, y + h);
      c.quadraticCurveTo(x, y + h, x, y + h - r);
      c.lineTo(x, y + r);
      c.quadraticCurveTo(x, y, x + r, y);
      c.closePath();
      c.fill();

      c.strokeStyle = isPurchased ? "#2dd4bf" : "#f59e0b";
      c.lineWidth = 4;
      c.stroke();

      c.font = "bold 20px 'Outfit', sans-serif";
      c.fillStyle = "#ffffff";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(text, 150, 35);
    }

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: true
    });

    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(3.6, 0.84, 1);
    return sprite;
  }

  public destroy() {
    this.isDestroyed = true;
    if (this.chirpInterval) clearInterval(this.chirpInterval);
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener("resize", this.onWindowResize);

    this.container.removeEventListener("pointermove", this.onPointerMove);
    this.container.removeEventListener("pointerdown", this.onPointerDown, true);
    this.container.removeEventListener("pointerleave", this.onPointerLeave);
    this.container.removeEventListener("contextmenu", this.onContextMenu);

    if (this.hasKeyboardListeners) {
      window.removeEventListener("keydown", this.onKeyDown);
      window.removeEventListener("keyup", this.onKeyUp);
    }

    if (this.collectibleManager) {
      this.collectibleManager.destroy();
    }

    // Recursively dispose geometries and materials in the scene
    this.scene.traverse((node) => {
      if ((node as THREE.Mesh).isMesh) {
        const mesh = node as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose());
          } else {
            mesh.material.dispose();
          }
        }
      }
    });

    Object.values(this.geometriesCache).forEach((g) => g.dispose());
    Object.values(this.materialsCache).forEach((m) => m.dispose());

    while (this.scene.children.length > 0) {
      const obj = this.scene.children[0];
      this.scene.remove(obj);
    }

    this.timer.dispose();
    this.renderer.dispose();
    this.container.innerHTML = "";
  }
}
