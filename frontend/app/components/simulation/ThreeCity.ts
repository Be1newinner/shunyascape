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
import { spawnAnimals, updateAnimals } from "./NPCAnimals";
import {
  spawnVehicleOnRoad,
  cleanStrandedVehicles,
  updateVehicles,
} from "./Vehicle";
import {
  createRefinedHumanMesh,
  createNameTag,
  wanderHuman,
  dispatchWorkerTo,
  loadAllDatabaseUsers,
  addDatabaseUser,
  updateHumans,
  syncNpcsToDatabase,
} from "./NPCHuman";

export class ThreeCity {
  // Three.js Core
  public container: HTMLDivElement;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private cameraManager!: CameraManager;
  public controls!: any; // OrbitControls

  // Simulation Grid Configuration
  private gridSize = 20;
  private cellSize = 3.0; // Size of each cell in world units
  private grid: GridCell[][] = [];

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
  public isAdmin = false;
  private npcSyncTimer = 1.0;

  // Agents & Animations
  private humans: HumanAgent[] = [];
  private vehicles: VehicleAgent[] = [];
  private animals: AnimalAgent[] = []; // Voxel Cows, Dogs, Cats, Birds
  private particles: Particle[] = [];
  private animationFrameId: number | null = null;
  private clock = new THREE.Clock();

  // Player Controls
  public player: HumanAgent | null = null;
  private keysPressed: { [key: string]: boolean } = {};
  private hasKeyboardListeners = false;
  private lastSyncedPosition = new THREE.Vector3();
  private positionSyncTimer = 0.5;
  private lastPlayerPosition: THREE.Vector3 | null = null;

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
    this.initGrid();
    this.initRaycasting();
    this.animate();

    this.updateStats();

    // Occasional bird chirp
    setInterval(() => {
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
      this.materialsCache[name] = new THREE.MeshStandardMaterial(params);
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
    };
  }

  private initThree() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.container.appendChild(this.renderer.domElement);

    this.cameraManager = new CameraManager(this.container, this.renderer);
    this.camera = this.cameraManager.camera;
    this.controls = this.cameraManager.controls;

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

  private initEnvironment() {
    this.weatherManager = new WeatherManager(this.getSimContext());
    const land = createLand(this.getSimContext());
    this.waterPlane = land.waterPlane;
    this.buildPreview = land.buildPreview;
  }

  private initGrid() {
    // Initialize 2D grid matrix
    for (let x = 0; x < this.gridSize; x++) {
      this.grid[x] = [];
      for (let z = 0; z < this.gridSize; z++) {
        this.grid[x][z] = {
          x,
          z,
          type: "empty",
          mesh: null,
          constructionProgress: 0,
          targetType: "empty",
          height: 0,
          id: `cell_${x}_${z}`,
        };
      }
    }

    const center = Math.floor(this.gridSize / 2);

    // Initial trees
    for (let i = 0; i < 15; i++) {
      const tx = Math.floor(Math.random() * this.gridSize);
      const tz = Math.floor(Math.random() * this.gridSize);
      if (
        (tx < center - 2 || tx > center + 2) &&
        (tz < center - 2 || tz > center + 2)
      ) {
        this.spawnInstantItem(tx, tz, "tree");
      }
    }

    // Initial connecting road
    for (let z = 4; z < 16; z++) {
      this.spawnInstantItem(center, z, "road");
    }

    // Initial houses
    this.spawnInstantItem(center - 1, 6, "house");
    this.spawnInstantItem(center + 1, 10, "house");
    this.spawnInstantItem(center - 1, 14, "house");

    // Spawn starting humans
    for (let i = 0; i < 8; i++) {
      this.spawnHumanAtRandomHouse();
    }

    // Spawn voxel Cow, Dog, Cat, Bird
    spawnAnimals(this.getSimContext(), this.animals);
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

    if (intersects.length > 0 && this.buildMode && this.isAdmin) {
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
          const isValid = cell.type === "empty";
          (this.buildPreview.material as THREE.MeshBasicMaterial).color.setHex(
            isValid ? 0x00ff00 : 0xffa500,
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
    if (!this.isAdmin) return;
    if (this.currentHoverCell && this.buildMode) {
      const { x, z } = this.currentHoverCell;
      if (this.buildMode === "delete") {
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
    type: "road" | "tree" | "house" | "skyscraper",
  ) {
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

    mesh.scale.set(0.01, 0.01, 0.01);
    this.animateGrow(mesh, 1.0, 400);

    if (type === "road") {
      this.recalculateRoadConnections();
    }
  }

  private orderConstruction(
    x: number,
    z: number,
    type: "road" | "tree" | "house" | "skyscraper",
  ) {
    const cell = this.grid[x][z];
    if (cell.type !== "empty") return;

    cell.type = "construction";
    cell.targetType = type;
    cell.constructionProgress = 0;

    const constructionMesh = createConstructionSiteMesh(
      this.getSimContext(),
      x,
      z,
    );
    cell.mesh = constructionMesh;
    this.scene.add(constructionMesh);

    this.audio.playPop();
    this.spawnParticle(x, z, "#eebb33", 8);

    dispatchWorkerTo(this.getSimContext(), this.humans, x, z);
    this.updateStats();

    if (this.isAdmin && this.player) {
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
  }

  public recalculateRoadConnections() {
    recalculateRoadConnections(this.getSimContext(), this.grid);
  }

  private createMeshForType(
    type: "road" | "tree" | "house" | "skyscraper",
    x: number,
    z: number,
  ): THREE.Group {
    switch (type) {
      case "road":
        return createRoadMesh(this.getSimContext(), x, z);
      case "tree":
        return createTreeMesh(this.getSimContext(), x, z);
      case "house":
        return createHouseMesh(this.getSimContext(), x, z);
      case "skyscraper":
        return createSkyscraperMesh(this.getSimContext(), x, z);
    }
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
      }
    };
    requestAnimationFrame(update);
  }

  private completeConstruction(x: number, z: number) {
    const cell = this.grid[x][z];
    if (cell.type !== "construction") return;

    if (cell.mesh) {
      this.scene.remove(cell.mesh);
    }

    const type = cell.targetType as "road" | "tree" | "house" | "skyscraper";
    cell.type = type;
    cell.constructionProgress = 100;

    const mesh = this.createMeshForType(type, x, z);
    cell.mesh = mesh;
    this.scene.add(mesh);

    mesh.scale.set(0.01, 0.01, 0.01);
    this.animateGrow(mesh, 1.0, 500);

    this.audio.playPop();
    this.spawnParticle(x, z, "#5cd65c", 12);

    if (type === "road") {
      this.recalculateRoadConnections();
      if (Math.random() < 0.25) {
        spawnVehicleOnRoad(
          this.getSimContext(),
          this.vehicles,
          this.humans,
          x,
          z,
        );
      }
    } else if (type === "house") {
      const spawns = 1 + Math.floor(Math.random() * 2);
      for (let s = 0; s < spawns; s++) {
        this.spawnHumanAtRandomHouse();
      }
    }

    this.updateStats();

    if (this.isAdmin && this.player) {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(
          JSON.stringify({
            type: "grid-update",
            cell: {
              x,
              z,
              type,
              targetType: type,
              constructionProgress: 100,
              height: cell.height,
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
            type,
            targetType: type,
            constructionProgress: 100,
            height: cell.height,
          }),
        })
          .then((res) => {
            if (res.status === 401) {
              window.dispatchEvent(new CustomEvent("auth-unauthorized"));
            }
          })
          .catch((err) => console.error("Failed to save grid completion:", err));
      }
    }
  }

  private spawnHumanAtRandomHouse() {
    const houses: { x: number; z: number }[] = [];
    for (let x = 0; x < this.gridSize; x++) {
      for (let z = 0; z < this.gridSize; z++) {
        if (
          this.grid[x][z].type === "house" &&
          this.grid[x][z].constructionProgress === 100
        ) {
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
    const worldX = spawnX * this.cellSize - halfGrid + this.cellSize / 2;
    const worldZ = spawnZ * this.cellSize - halfGrid + this.cellSize / 2;
    humanGroup.position.set(worldX, 0, worldZ);

    const clothingColor = [
      0x4287f5, 0xeb4034, 0x228b22, 0xe0c012, 0x8a2be2, 0xff69b4,
    ][Math.floor(Math.random() * 6)];
    const agent: Partial<HumanAgent> = {};
    const mesh = createRefinedHumanMesh(
      this.getSimContext(),
      clothingColor,
      false,
      agent,
    );
    humanGroup.add(mesh);

    this.scene.add(humanGroup);

    const human: HumanAgent = {
      id: `human_${Math.random().toString(36).substr(2, 9)}`,
      mesh: humanGroup,
      x: worldX,
      z: worldZ,
      targetX: worldX,
      targetZ: worldZ,
      state: "idle",
      targetCellX: spawnX,
      targetCellZ: spawnZ,
      path: [],
      pathIndex: 0,
      speed: 1.5 + Math.random() * 0.8,
      bounceTimer: Math.random() * 10,
      workTimer: 0,
      jobCellX: null,
      jobCellZ: null,
      clothingColor,
      isPlayer: false,
      upperBody: agent.upperBody,
      leftLegPivot: agent.leftLegPivot,
      rightLegPivot: agent.rightLegPivot,
      leftArmPivot: agent.leftArmPivot,
      rightArmPivot: agent.rightArmPivot,
      actionState: "idle",
      actionTimer: 0,
      jumpVelocity: 0,
    };

    this.humans.push(human);
  }

  public spawnPlayer(
    name: string,
    x: number = 0,
    z: number = 0,
    email?: string,
    clothingColor?: number,
    dbUserId?: string,
  ) {
    if (this.isDestroyed) return;

    if (this.player) {
      this.scene.remove(this.player.mesh);
      this.humans = this.humans.filter((h) => h.id !== this.player!.id);
      this.player = null;
    }

    const halfGrid = (this.gridSize * this.cellSize) / 2;
    let worldX = x;
    let worldZ = z;

    if (x === 0 && z === 0) {
      const center = Math.floor(this.gridSize / 2);
      worldX = center * this.cellSize - halfGrid + this.cellSize / 2;
      worldZ = center * this.cellSize - halfGrid + this.cellSize / 2;
    }

    const col = clothingColor ?? 0xff3b30;

    const humanGroup = new THREE.Group();
    humanGroup.position.set(worldX, 3.5, worldZ);

    const agent: Partial<HumanAgent> = {};
    const mesh = createRefinedHumanMesh(this.getSimContext(), col, true, agent);
    humanGroup.add(mesh);

    const nameTag = createNameTag(name);
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
      dbUserId,
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
      speed: 4.5,
      bounceTimer: 0,
      workTimer: 0,
      jobCellX: null,
      jobCellZ: null,
      clothingColor: col,
      isPlayer: true,
      playerName: name,
      playerEmail: email ? email.toLowerCase().trim() : undefined,
      upperBody: agent.upperBody,
      leftLegPivot: agent.leftLegPivot,
      rightLegPivot: agent.rightLegPivot,
      leftArmPivot: agent.leftArmPivot,
      rightArmPivot: agent.rightArmPivot,
      actionState: "jumping", // Drop animation
      actionTimer: 0,
      jumpVelocity: 0,
    };

    this.humans.push(playerAgent);
    this.player = playerAgent;

    // Position camera at a beautiful diagonal perspective relative to player
    this.camera.position.set(worldX + 25, 20, worldZ + 25);
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
  }

  public loadAllDatabaseUsers(users: any[], currentPlayerEmail: string) {
    if (this.isDestroyed) return;
    loadAllDatabaseUsers(
      this.getSimContext(),
      this.humans,
      users,
      currentPlayerEmail,
    );
  }

  public addDatabaseUser(user: any, currentPlayerEmail: string) {
    if (this.isDestroyed) return;
    addDatabaseUser(
      this.getSimContext(),
      this.humans,
      user,
      currentPlayerEmail,
    );
  }

  public updateOtherPlayerPosition(userId: string, x: number, z: number) {
    if (this.isDestroyed) return;
    if (this.player && (this.player.id === `db_user_${userId}` || this.player.dbUserId === userId)) return; // ignore self

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

  public syncGrid(cells: any[]) {
    if (this.isDestroyed) return;

    cells.forEach((c) => {
      if (c.x < 0 || c.x >= this.gridSize || c.z < 0 || c.z >= this.gridSize)
        return;
      const localCell = this.grid[c.x][c.z];

      const needsUpdate =
        localCell.type !== c.type ||
        localCell.targetType !== c.targetType ||
        localCell.constructionProgress !== c.constructionProgress;

      if (needsUpdate) {
        localCell.type = c.type;
        localCell.targetType = c.targetType;
        localCell.constructionProgress = c.constructionProgress;

        if (localCell.mesh) {
          this.scene.remove(localCell.mesh);
          localCell.mesh = null;
        }

        if (c.type !== "empty") {
          if (c.type === "construction") {
            localCell.mesh = createConstructionSiteMesh(
              this.getSimContext(),
              c.x,
              c.z,
            );
          } else {
            localCell.mesh = this.createMeshForType(c.type, c.x, c.z);
          }
          this.scene.add(localCell.mesh);
        }

        if (c.type === "road" || localCell.type === "road") {
          this.recalculateRoadConnections();
        }
      }
    });
    this.updateStats();
  }

  public syncNpcs(npcs: any[], isAdmin: boolean) {
    if (this.isDestroyed) return;

    if (isAdmin) {
      const localSystemNpcs = this.humans.filter(
        (h) => !h.isPlayer && !h.playerEmail,
      );
      if (localSystemNpcs.length === 0 && npcs.length > 0) {
        npcs.forEach((n) => {
          this.spawnNpcFromData(n);
        });
      }
      return;
    }

    const currentNpcIds = new Set(npcs.map((n) => n.npcId));

    this.humans = this.humans.filter((h) => {
      if (h.isPlayer || h.playerEmail) return true;
      if (!currentNpcIds.has(h.id)) {
        this.scene.remove(h.mesh);
        return false;
      }
      return true;
    });

    npcs.forEach((n) => {
      const existing = this.humans.find((h) => h.id === n.npcId);
      if (existing) {
        existing.targetX = n.targetX;
        existing.targetZ = n.targetZ;
        existing.state = n.state;

        const dx = Math.abs(existing.mesh.position.x - n.x);
        const dz = Math.abs(existing.mesh.position.z - n.z);
        if (dx > 5.0 || dz > 5.0) {
          existing.mesh.position.set(n.x, 0, n.z);
          existing.x = n.x;
          existing.z = n.z;
        }
      } else {
        this.spawnNpcFromData(n);
      }
    });
  }

  private spawnNpcFromData(n: any) {
    const humanGroup = new THREE.Group();
    humanGroup.position.set(n.x, 0, n.z);

    const agent: Partial<HumanAgent> = {};
    const mesh = createRefinedHumanMesh(
      this.getSimContext(),
      n.clothingColor,
      false,
      agent,
    );
    humanGroup.add(mesh);

    const nameTag = createNameTag(n.name);
    humanGroup.add(nameTag);

    this.scene.add(humanGroup);

    const halfGrid = (this.gridSize * this.cellSize) / 2;
    const cellX = Math.max(
      0,
      Math.min(this.gridSize - 1, Math.floor((n.x + halfGrid) / this.cellSize)),
    );
    const cellZ = Math.max(
      0,
      Math.min(this.gridSize - 1, Math.floor((n.z + halfGrid) / this.cellSize)),
    );

    const npc: HumanAgent = {
      id: n.npcId,
      mesh: humanGroup,
      x: n.x,
      z: n.z,
      targetX: n.targetX,
      targetZ: n.targetZ,
      state: n.state as "idle" | "walking" | "working",
      targetCellX: cellX,
      targetCellZ: cellZ,
      path: [],
      pathIndex: 0,
      speed: 1.5 + Math.random() * 0.8,
      bounceTimer: Math.random() * 10,
      workTimer: 0,
      jobCellX: null,
      jobCellZ: null,
      clothingColor: n.clothingColor,
      isPlayer: false,
      upperBody: agent.upperBody,
      leftLegPivot: agent.leftLegPivot,
      rightLegPivot: agent.rightLegPivot,
      leftArmPivot: agent.leftArmPivot,
      rightArmPivot: agent.rightArmPivot,
      actionState: "idle",
      actionTimer: 0,
      jumpVelocity: 0,
    };

    this.humans.push(npc);
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
      }
    }

    if (key === "u") {
      this.player.actionState = "punching";
      this.player.actionTimer = 0.25;
      this.audio.playPunch();
    }
    if (key === "i") {
      this.player.actionState = "kicking";
      this.player.actionTimer = 0.35;
      this.audio.playKick();
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

    const delta = Math.min(this.clock.getDelta(), 0.1);

    // Keyboard Camera Rotation (for touchpad/laptop usability)
    if (this.keysPressed["q"] || this.keysPressed["e"]) {
      const offset = new THREE.Vector3().copy(this.camera.position).sub(this.controls.target);
      const rotationSpeed = 1.5 * delta;
      const angle = this.keysPressed["q"] ? rotationSpeed : -rotationSpeed;
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
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
    );
    this.positionSyncTimer = syncStates.positionSyncTimer;

    // Periodic NPC database sync (admin only)
    if (this.isAdmin && this.player && this.player.playerEmail) {
      this.npcSyncTimer -= delta;
      if (this.npcSyncTimer <= 0) {
        const hasWs = this.ws && this.ws.readyState === WebSocket.OPEN;
        this.npcSyncTimer = hasWs ? 1.0 : 10.0;
        syncNpcsToDatabase(this.getSimContext(), this.humans);
      }
    }

    // 3. Vehicles updates
    updateVehicles(this.getSimContext(), this.vehicles, this.grid, delta);

    // 4. Animal updates (Wandering Cows, Dogs, Cats, Flying Birds)
    updateAnimals(this.getSimContext(), this.animals, delta);

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
        -0.02 + Math.sin(this.clock.getElapsedTime() * 1.2) * 0.025;
    }

    // Update controls
    this.controls.update();

    this.renderer.render(this.scene, this.camera);
  };

  private updateStats() {
    let houses = 0;
    let skyscrapers = 0;
    let trees = 0;
    let roads = 0;
    let activeConstruction = 0;

    for (let x = 0; x < this.gridSize; x++) {
      for (let z = 0; z < this.gridSize; z++) {
        const cell = this.grid[x][z];
        if (cell.type === "house") houses++;
        else if (cell.type === "skyscraper") skyscrapers++;
        else if (cell.type === "tree") trees++;
        else if (cell.type === "road") roads++;
        else if (cell.type === "construction") activeConstruction++;
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
    const cell = this.grid[gx][gz];
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
    if (this.isAdmin && this.buildMode) {
      (this.controls.mouseButtons as any).LEFT = -1;
    } else {
      (this.controls.mouseButtons as any).LEFT = THREE.MOUSE.ROTATE;
    }
  }

  public destroy() {
    this.isDestroyed = true;
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

    Object.values(this.geometriesCache).forEach((g) => g.dispose());
    Object.values(this.materialsCache).forEach((m) => m.dispose());

    while (this.scene.children.length > 0) {
      const obj = this.scene.children[0];
      this.scene.remove(obj);
    }

    this.renderer.dispose();
    this.container.innerHTML = "";
  }
}
