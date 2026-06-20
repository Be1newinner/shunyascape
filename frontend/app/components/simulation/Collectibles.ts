import * as THREE from 'three';
import { SimContext } from './Types';

export interface CollectibleItem {
  id: string;
  type: 'coin' | 'crystal' | 'crate';
  x: number; // grid x
  z: number; // grid z
  mesh: THREE.Group;
}

export class CollectibleManager {
  private ctx: SimContext;
  private collectibles: CollectibleItem[] = [];
  private maxItems = 12;
  private spawnTimer = 0;
  private spawnDelay = 4.0; // Spawn check every 4 seconds

  constructor(ctx: SimContext) {
    this.ctx = ctx;
    this.initCollectibles();
  }

  private initCollectibles() {
    // Spawn initial items
    for (let i = 0; i < 8; i++) {
      this.spawnRandomCollectible();
    }
  }

  private createCollectibleMesh(type: 'coin' | 'crystal' | 'crate'): THREE.Group {
    const group = new THREE.Group();

    if (type === 'coin') {
      // Spinning gold coin
      const coinGeom = this.ctx.getGeometry('col_coin', () => new THREE.CylinderGeometry(0.18, 0.18, 0.04, 8));
      const coinMat = this.ctx.getMaterial('col_coin_mat', {
        color: '#ffd700',
        metalness: 0.85,
        roughness: 0.15,
        emissive: '#b8860b',
        emissiveIntensity: 0.2
      });
      const mesh = new THREE.Mesh(coinGeom, coinMat);
      mesh.rotation.x = Math.PI / 2; // Face forward
      mesh.castShadow = true;
      group.add(mesh);

      // Inner coin detail
      const innerGeom = this.ctx.getGeometry('col_coin_inner', () => new THREE.CylinderGeometry(0.1, 0.1, 0.05, 8));
      const innerMesh = new THREE.Mesh(innerGeom, coinMat);
      innerMesh.rotation.x = Math.PI / 2;
      group.add(innerMesh);

    } else if (type === 'crystal') {
      // Glowing cyan crystal (octahedron)
      const cryGeom = this.ctx.getGeometry('col_crystal', () => new THREE.CylinderGeometry(0, 0.14, 0.35, 4, 1));
      const cryMat = this.ctx.getMaterial('col_crystal_mat', {
        color: '#00ffff',
        roughness: 0.1,
        emissive: '#00ffff',
        emissiveIntensity: 0.6
      });
      const mesh1 = new THREE.Mesh(cryGeom, cryMat);
      mesh1.castShadow = true;
      group.add(mesh1);

      const mesh2 = new THREE.Mesh(cryGeom, cryMat);
      mesh2.rotation.x = Math.PI;
      mesh2.castShadow = true;
      group.add(mesh2);

    } else if (type === 'crate') {
      // Material box
      const boxGeom = this.ctx.getGeometry('col_crate', () => new THREE.BoxGeometry(0.3, 0.3, 0.3));
      const crateMat = this.ctx.getMaterial('col_crate_mat', {
        color: '#8b5a2b',
        roughness: 0.9
      });
      const mesh = new THREE.Mesh(boxGeom, crateMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);

      // Metal bands on crate
      const bandGeom = this.ctx.getGeometry('col_crate_band', () => new THREE.BoxGeometry(0.32, 0.04, 0.32));
      const bandMat = this.ctx.getMaterial('col_crate_band_mat', {
        color: '#daa520',
        metalness: 0.7,
        roughness: 0.3
      });
      const band1 = new THREE.Mesh(bandGeom, bandMat);
      band1.position.y = 0.08;
      const band2 = new THREE.Mesh(bandGeom, bandMat);
      band2.position.y = -0.08;
      group.add(band1);
      group.add(band2);
    }

    return group;
  }

  private spawnRandomCollectible(): boolean {
    if (this.collectibles.length >= this.maxItems) return false;

    // Find a random empty cell
    const emptyCells: { x: number; z: number }[] = [];
    for (let x = 0; x < this.ctx.gridSize; x++) {
      for (let z = 0; z < this.ctx.gridSize; z++) {
        if (this.ctx.grid[x][z].type === 'empty') {
          // Verify no active collectible already exists here
          const exists = this.collectibles.some(c => c.x === x && c.z === z);
          if (!exists) {
            emptyCells.push({ x, z });
          }
        }
      }
    }

    if (emptyCells.length === 0) return false;

    const cell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    
    // Choose type randomly
    const rand = Math.random();
    let type: 'coin' | 'crystal' | 'crate' = 'coin';
    if (rand > 0.8) {
      type = 'crystal'; // 20% chance
    } else if (rand > 0.55) {
      type = 'crate'; // 25% chance
    } // 55% chance of coin

    const mesh = this.createCollectibleMesh(type);
    
    // Position in world
    const halfGrid = (this.ctx.gridSize * this.ctx.cellSize) / 2;
    const worldX = cell.x * this.ctx.cellSize - halfGrid + this.ctx.cellSize / 2;
    const worldZ = cell.z * this.ctx.cellSize - halfGrid + this.ctx.cellSize / 2;
    mesh.position.set(worldX, 0.4, worldZ);
    
    this.ctx.scene.add(mesh);

    this.collectibles.push({
      id: `col_${type}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      x: cell.x,
      z: cell.z,
      mesh
    });

    return true;
  }

  public update(delta: number, playerX: number, playerZ: number, clockTime: number) {
    // 1. Spawning timer check
    this.spawnTimer += delta;
    if (this.spawnTimer >= this.spawnDelay) {
      this.spawnTimer = 0;
      if (this.collectibles.length < this.maxItems) {
        this.spawnRandomCollectible();
      }
    }

    // 2. Animate and check collisions
    this.collectibles = this.collectibles.filter(c => {
      // Bobbing & Spinning animation
      c.mesh.rotation.y += delta * 1.8;
      c.mesh.position.y = 0.35 + Math.sin(clockTime * 2.5 + c.x * 0.5) * 0.12;

      // Distance check to player
      const dx = c.mesh.position.x - playerX;
      const dz = c.mesh.position.z - playerZ;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < 1.1) {
        // Collect!
        this.ctx.scene.remove(c.mesh);
        this.triggerCollection(c);
        return false; // Remove from list
      }

      return true;
    });
  }

  private triggerCollection(item: CollectibleItem) {
    let coins = 0;
    let xp = 0;
    let wood = 0;
    let particleColor = '#ffd700';

    if (item.type === 'coin') {
      coins = 10;
      xp = 3;
      particleColor = '#ffd700';
    } else if (item.type === 'crystal') {
      coins = 25;
      xp = 12;
      particleColor = '#00ffff';
    } else if (item.type === 'crate') {
      coins = 15;
      xp = 6;
      wood = 5;
      particleColor = '#d2b48c';
    }

    // Play sounds & particles
    this.ctx.audio.playPop();
    this.ctx.spawnParticle(item.x, item.z, particleColor, 12);

    // Dispatch custom client-side event for CitySimulator HUD
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('shunya-collect', {
        detail: {
          type: item.type,
          coins,
          xp,
          wood
        }
      });
      window.dispatchEvent(event);
    }
  }

  public destroy() {
    this.collectibles.forEach(c => {
      this.ctx.scene.remove(c.mesh);
    });
    this.collectibles = [];
  }
}
