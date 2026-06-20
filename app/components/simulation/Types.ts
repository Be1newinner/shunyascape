import * as THREE from 'three';

export interface SimContext {
  gridSize: number;
  cellSize: number;
  grid: GridCell[][];
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: any; // OrbitControls
  audio: any; // CityAudio
  isAdmin: boolean;
  getGeometry: (name: string, creator: () => THREE.BufferGeometry) => THREE.BufferGeometry;
  getMaterial: (name: string, params: any) => THREE.Material;
  spawnParticle: (cellX: number, cellZ: number, color: string, count?: number) => void;
  completeConstruction: (x: number, z: number) => void;
  recalculateRoadConnections: () => void;
  spawnVehicleOnRoad: (x: number, z: number) => void;
}

export type BuildType = 'road' | 'tree' | 'house' | 'skyscraper' | 'delete' | null;

export interface CityStats {
  population: number;
  houses: number;
  skyscrapers: number;
  trees: number;
  roads: number;
  activeConstruction: number;
}

export interface GridCell {
  x: number;
  z: number;
  type: 'empty' | 'road' | 'tree' | 'house' | 'skyscraper' | 'construction';
  mesh: THREE.Group | null;
  constructionProgress: number; // 0 to 100
  targetType: 'road' | 'tree' | 'house' | 'skyscraper' | 'empty';
  height: number;
  id: string;
}

export interface HumanAgent {
  id: string;
  mesh: THREE.Group;
  x: number; // world x
  z: number; // world z
  targetX: number;
  targetZ: number;
  state: 'idle' | 'walking' | 'working' | 'sitting';
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
  isPlayer?: boolean;
  playerName?: string;
  playerEmail?: string;
  upperBody?: THREE.Group;
  leftLegPivot?: THREE.Group;
  rightLegPivot?: THREE.Group;
  leftArmPivot?: THREE.Group;
  rightArmPivot?: THREE.Group;
  actionState?: 'idle' | 'walking' | 'jumping' | 'punching' | 'kicking' | 'sitting';
  actionTimer?: number;
  jumpVelocity?: number;
  seatedInVehicleId?: string; // tracks if seated in a car
}

export interface VehicleAgent {
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
  passenger?: HumanAgent; // seated NPC passenger/driver
}

export interface AnimalAgent {
  id: string;
  type: 'cow' | 'dog' | 'cat' | 'bird';
  mesh: THREE.Group;
  x: number;
  z: number;
  targetX: number;
  targetZ: number;
  state: 'idle' | 'wandering' | 'flying' | 'resting';
  speed: number;
  bounceTimer: number;
  idleTimer: number;
  legSwingPivot1?: THREE.Group;
  legSwingPivot2?: THREE.Group;
  tailPivot?: THREE.Group;
  leftWingPivot?: THREE.Group;
  rightWingPivot?: THREE.Group;
}

export interface Particle {
  mesh: THREE.Sprite | THREE.Mesh;
  velocity: THREE.Vector3;
  life: number; // 0 to 1
  decay: number;
}
