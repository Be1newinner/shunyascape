import * as THREE from 'three';
import { SimContext, AnimalAgent } from './Types';

export function createAnimalMesh(
  ctx: SimContext,
  type: 'cow' | 'dog' | 'cat' | 'bird',
  agent: Partial<AnimalAgent>
): THREE.Group {
  const group = new THREE.Group();

  switch (type) {
    case 'cow': {
      // Body
      const bodyGeom = ctx.getGeometry('cow_body', () => new THREE.BoxGeometry(0.5, 0.4, 0.7));
      const bodyMat = ctx.getMaterial('cow_white', { color: '#ffffff', roughness: 0.9 });
      const body = new THREE.Mesh(bodyGeom, bodyMat);
      body.position.y = 0.45;
      body.castShadow = true;
      body.receiveShadow = true;
      group.add(body);

      // Spots (Black boxes)
      const spotMat = ctx.getMaterial('cow_black', { color: '#111111', roughness: 0.9 });
      const spot1 = new THREE.Mesh(ctx.getGeometry('cow_spot1', () => new THREE.BoxGeometry(0.2, 0.2, 0.2)), spotMat);
      spot1.position.set(0.26, 0.5, 0.1);
      group.add(spot1);
      const spot2 = new THREE.Mesh(ctx.getGeometry('cow_spot2', () => new THREE.BoxGeometry(0.2, 0.15, 0.25)), spotMat);
      spot2.position.set(-0.26, 0.45, -0.15);
      group.add(spot2);

      // Head
      const headGeom = ctx.getGeometry('cow_head', () => new THREE.BoxGeometry(0.3, 0.3, 0.35));
      const head = new THREE.Mesh(headGeom, bodyMat);
      head.position.set(0, 0.65, 0.35);
      head.castShadow = true;
      group.add(head);

      // Snout (Pink)
      const snoutGeom = ctx.getGeometry('cow_snout', () => new THREE.BoxGeometry(0.24, 0.12, 0.1));
      const snoutMat = ctx.getMaterial('cow_pink', { color: '#ffb6c1', roughness: 0.8 });
      const snout = new THREE.Mesh(snoutGeom, snoutMat);
      snout.position.set(0, 0.6, 0.53);
      group.add(snout);

      // Horns
      const hornGeom = ctx.getGeometry('cow_horn', () => new THREE.BoxGeometry(0.06, 0.14, 0.06));
      const hornMat = ctx.getMaterial('cow_horns', { color: '#dddddd', roughness: 0.5 });
      const h1 = new THREE.Mesh(hornGeom, hornMat);
      h1.position.set(0.12, 0.82, 0.3);
      h1.rotation.z = -0.2;
      const h2 = new THREE.Mesh(hornGeom, hornMat);
      h2.position.set(-0.12, 0.82, 0.3);
      h2.rotation.z = 0.2;
      group.add(h1);
      group.add(h2);

      // Legs (Pivots)
      const legGeom = ctx.getGeometry('cow_leg', () => new THREE.BoxGeometry(0.12, 0.3, 0.12));
      const legMat = ctx.getMaterial('cow_legs', { color: '#eeeeee', roughness: 0.9 });
      
      const legL1 = new THREE.Group();
      legL1.position.set(0.18, 0.3, 0.22);
      const lMesh1 = new THREE.Mesh(legGeom, legMat);
      lMesh1.position.y = -0.15;
      lMesh1.castShadow = true;
      legL1.add(lMesh1);
      group.add(legL1);
      agent.legSwingPivot1 = legL1;

      const legR1 = new THREE.Group();
      legR1.position.set(-0.18, 0.3, 0.22);
      const lMesh2 = new THREE.Mesh(legGeom, legMat);
      lMesh2.position.y = -0.15;
      lMesh2.castShadow = true;
      legR1.add(lMesh2);
      group.add(legR1);
      agent.legSwingPivot2 = legR1;

      const legL2 = new THREE.Group();
      legL2.position.set(0.18, 0.3, -0.22);
      const lMesh3 = new THREE.Mesh(legGeom, legMat);
      lMesh3.position.y = -0.15;
      lMesh3.castShadow = true;
      legL2.add(lMesh3);
      group.add(legL2);

      const legR2 = new THREE.Group();
      legR2.position.set(-0.18, 0.3, -0.22);
      const lMesh4 = new THREE.Mesh(legGeom, legMat);
      lMesh4.position.y = -0.15;
      lMesh4.castShadow = true;
      legR2.add(lMesh4);
      group.add(legR2);
      break;
    }
    case 'dog': {
      // Body
      const bodyGeom = ctx.getGeometry('dog_body', () => new THREE.BoxGeometry(0.28, 0.24, 0.5));
      const bodyMat = ctx.getMaterial('dog_brown', { color: '#8b5a2b', roughness: 0.95 });
      const body = new THREE.Mesh(bodyGeom, bodyMat);
      body.position.y = 0.26;
      body.castShadow = true;
      group.add(body);

      // Head
      const headGeom = ctx.getGeometry('dog_head', () => new THREE.BoxGeometry(0.2, 0.2, 0.22));
      const head = new THREE.Mesh(headGeom, bodyMat);
      head.position.set(0, 0.44, 0.2);
      head.castShadow = true;
      group.add(head);

      // Ears (Floppy dark brown)
      const earGeom = ctx.getGeometry('dog_ear', () => new THREE.BoxGeometry(0.05, 0.16, 0.08));
      const earMat = ctx.getMaterial('dog_ears', { color: '#5c3818', roughness: 0.95 });
      const e1 = new THREE.Mesh(earGeom, earMat);
      e1.position.set(0.11, 0.42, 0.2);
      const e2 = new THREE.Mesh(earGeom, earMat);
      e2.position.set(-0.11, 0.42, 0.2);
      group.add(e1);
      group.add(e2);

      // Tail
      const tailGroup = new THREE.Group();
      tailGroup.position.set(0, 0.34, -0.25);
      const tailGeom = ctx.getGeometry('dog_tail', () => new THREE.BoxGeometry(0.04, 0.16, 0.04));
      const tail = new THREE.Mesh(tailGeom, bodyMat);
      tail.position.y = 0.08;
      tail.rotation.x = Math.PI / 4;
      tail.castShadow = true;
      tailGroup.add(tail);
      group.add(tailGroup);
      agent.tailPivot = tailGroup;

      // Legs
      const legGeom = ctx.getGeometry('dog_leg', () => new THREE.BoxGeometry(0.08, 0.18, 0.08));
      const legL1 = new THREE.Group();
      legL1.position.set(0.1, 0.18, 0.16);
      const l1 = new THREE.Mesh(legGeom, bodyMat);
      l1.position.y = -0.09;
      l1.castShadow = true;
      legL1.add(l1);
      group.add(legL1);
      agent.legSwingPivot1 = legL1;

      const legR1 = new THREE.Group();
      legR1.position.set(-0.1, 0.18, 0.16);
      const r1 = new THREE.Mesh(legGeom, bodyMat);
      r1.position.y = -0.09;
      r1.castShadow = true;
      legR1.add(r1);
      group.add(legR1);
      agent.legSwingPivot2 = legR1;

      const legL2 = new THREE.Group();
      legL2.position.set(0.1, 0.18, -0.16);
      const l2 = new THREE.Mesh(legGeom, bodyMat);
      l2.position.y = -0.09;
      l2.castShadow = true;
      legL2.add(l2);
      group.add(legL2);

      const legR2 = new THREE.Group();
      legR2.position.set(-0.1, 0.18, -0.16);
      const r2 = new THREE.Mesh(legGeom, bodyMat);
      r2.position.y = -0.09;
      r2.castShadow = true;
      legR2.add(r2);
      group.add(legR2);
      break;
    }
    case 'cat': {
      // Body (Orange Voxel)
      const bodyGeom = ctx.getGeometry('cat_body', () => new THREE.BoxGeometry(0.2, 0.16, 0.38));
      const bodyMat = ctx.getMaterial('cat_orange', { color: '#ff8c00', roughness: 0.9 });
      const body = new THREE.Mesh(bodyGeom, bodyMat);
      body.position.y = 0.18;
      body.castShadow = true;
      group.add(body);

      // Head
      const headGeom = ctx.getGeometry('cat_head', () => new THREE.BoxGeometry(0.16, 0.15, 0.16));
      const head = new THREE.Mesh(headGeom, bodyMat);
      head.position.set(0, 0.3, 0.15);
      head.castShadow = true;
      group.add(head);

      // Ears (Pointy)
      const earGeom = ctx.getGeometry('cat_ear', () => new THREE.ConeGeometry(0.04, 0.08, 4));
      const e1 = new THREE.Mesh(earGeom, bodyMat);
      e1.position.set(0.06, 0.4, 0.14);
      const e2 = new THREE.Mesh(earGeom, bodyMat);
      e2.position.set(-0.06, 0.4, 0.14);
      group.add(e1);
      group.add(e2);

      // Tail
      const tailGroup = new THREE.Group();
      tailGroup.position.set(0, 0.24, -0.19);
      const tailGeom = ctx.getGeometry('cat_tail', () => new THREE.BoxGeometry(0.03, 0.2, 0.03));
      const tail = new THREE.Mesh(tailGeom, bodyMat);
      tail.position.y = 0.1;
      tail.rotation.x = Math.PI / 6;
      tail.castShadow = true;
      tailGroup.add(tail);
      group.add(tailGroup);
      agent.tailPivot = tailGroup;

      // Legs
      const legGeom = ctx.getGeometry('cat_leg', () => new THREE.BoxGeometry(0.05, 0.12, 0.05));
      const legL1 = new THREE.Group();
      legL1.position.set(0.07, 0.12, 0.12);
      const l1 = new THREE.Mesh(legGeom, bodyMat);
      l1.position.y = -0.06;
      l1.castShadow = true;
      legL1.add(l1);
      group.add(legL1);
      agent.legSwingPivot1 = legL1;

      const legR1 = new THREE.Group();
      legR1.position.set(-0.07, 0.12, 0.12);
      const r1 = new THREE.Mesh(legGeom, bodyMat);
      r1.position.y = -0.06;
      r1.castShadow = true;
      legR1.add(r1);
      group.add(legR1);
      agent.legSwingPivot2 = legR1;

      const legL2 = new THREE.Group();
      legL2.position.set(0.07, 0.12, -0.12);
      const l2 = new THREE.Mesh(legGeom, bodyMat);
      l2.position.y = -0.06;
      l2.castShadow = true;
      legL2.add(l2);
      group.add(legL2);

      const legR2 = new THREE.Group();
      legR2.position.set(-0.07, 0.12, -0.12);
      const r2 = new THREE.Mesh(legGeom, bodyMat);
      r2.position.y = -0.06;
      r2.castShadow = true;
      legR2.add(r2);
      group.add(legR2);
      break;
    }
    case 'bird': {
      // Body (Red Cardinal Voxel)
      const bodyGeom = ctx.getGeometry('bird_body', () => new THREE.BoxGeometry(0.12, 0.1, 0.18));
      const bodyMat = ctx.getMaterial('bird_red', { color: '#ff2222', roughness: 0.5 });
      const body = new THREE.Mesh(bodyGeom, bodyMat);
      body.position.y = 0.5;
      body.castShadow = true;
      group.add(body);

      // Head
      const headGeom = ctx.getGeometry('bird_head', () => new THREE.BoxGeometry(0.08, 0.08, 0.08));
      const head = new THREE.Mesh(headGeom, bodyMat);
      head.position.set(0, 0.58, 0.08);
      head.castShadow = true;
      group.add(head);

      // Beak (Yellow)
      const beakGeom = ctx.getGeometry('bird_beak', () => new THREE.ConeGeometry(0.02, 0.05, 4));
      const beakMat = ctx.getMaterial('bird_beak', { color: '#ffcc00', roughness: 0.1 });
      const beak = new THREE.Mesh(beakGeom, beakMat);
      beak.rotation.x = Math.PI / 2;
      beak.position.set(0, 0.58, 0.14);
      group.add(beak);

      // Left Wing (Pivot)
      const wingGeom = ctx.getGeometry('bird_wing', () => new THREE.BoxGeometry(0.02, 0.08, 0.14));
      const leftWing = new THREE.Group();
      leftWing.position.set(0.065, 0.5, 0);
      const w1 = new THREE.Mesh(wingGeom, bodyMat);
      w1.position.y = 0.03;
      w1.rotation.z = -Math.PI / 6;
      w1.castShadow = true;
      leftWing.add(w1);
      group.add(leftWing);
      agent.leftWingPivot = leftWing;

      // Right Wing (Pivot)
      const rightWing = new THREE.Group();
      rightWing.position.set(-0.065, 0.5, 0);
      const w2 = new THREE.Mesh(wingGeom, bodyMat);
      w2.position.y = 0.03;
      w2.rotation.z = Math.PI / 6;
      w2.castShadow = true;
      rightWing.add(w2);
      group.add(rightWing);
      agent.rightWingPivot = rightWing;
      break;
    }
  }

  return group;
}

export function spawnAnimals(ctx: SimContext, animalsList: AnimalAgent[]) {
  const types: ('cow' | 'dog' | 'cat' | 'bird')[] = ['cow', 'dog', 'cat', 'bird'];
  
  for (let i = 0; i < 6; i++) {
    const type = types[i % types.length];
    const halfGrid = (ctx.gridSize * ctx.cellSize) / 2;
    const spawnX = (Math.random() - 0.5) * (ctx.gridSize * ctx.cellSize - 4);
    const spawnZ = (Math.random() - 0.5) * (ctx.gridSize * ctx.cellSize - 4);
    const yVal = type === 'bird' ? 6.0 + Math.random() * 4.0 : 0;

    const group = new THREE.Group();
    group.position.set(spawnX, yVal, spawnZ);

    const agent: Partial<AnimalAgent> = {};
    const mesh = createAnimalMesh(ctx, type, agent);
    group.add(mesh);
    ctx.scene.add(group);

    const fullAgent: AnimalAgent = {
      id: `animal_${type}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      mesh: group,
      x: spawnX,
      z: spawnZ,
      targetX: spawnX,
      targetZ: spawnZ,
      state: type === 'bird' ? 'flying' : 'idle',
      speed: type === 'bird' ? 3.0 : 0.8 + Math.random() * 0.6,
      bounceTimer: Math.random() * 5,
      idleTimer: Math.random() * 4,
      legSwingPivot1: agent.legSwingPivot1,
      legSwingPivot2: agent.legSwingPivot2,
      tailPivot: agent.tailPivot,
      leftWingPivot: agent.leftWingPivot,
      rightWingPivot: agent.rightWingPivot
    };

    animalsList.push(fullAgent);
  }
}

export function updateAnimals(
  ctx: SimContext,
  animalsList: AnimalAgent[],
  delta: number
) {
  const halfGrid = (ctx.gridSize * ctx.cellSize) / 2;

  animalsList.forEach(a => {
    // 1. Movement AI
    const dx = a.targetX - a.x;
    const dz = a.targetZ - a.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > 0.1) {
      a.state = a.type === 'bird' ? 'flying' : 'wandering';
      const step = a.speed * delta;
      
      if (dist <= step) {
        a.x = a.targetX;
        a.z = a.targetZ;
      } else {
        a.x += (dx / dist) * step;
        a.z += (dz / dist) * step;
        
        // Rotation facing movement
        a.mesh.rotation.y = Math.atan2(dx, dz);
      }
      
      a.mesh.position.x = a.x;
      a.mesh.position.z = a.z;
    } else {
      a.state = 'idle';
      a.idleTimer -= delta;
      
      if (a.idleTimer <= 0) {
        // Find a new target to wander/fly to
        a.idleTimer = 3.0 + Math.random() * 5.0;
        
        if (a.type === 'bird') {
          // Fly to a random roof, tree, or high point
          a.targetX = (Math.random() - 0.5) * (ctx.gridSize * ctx.cellSize - 6);
          a.targetZ = (Math.random() - 0.5) * (ctx.gridSize * ctx.cellSize - 6);
          
          // Randomly transition flying Y altitude
          const nextY = 5.0 + Math.random() * 6.0;
          a.mesh.position.y = nextY;
        } else {
          // Wander to nearby coordinates on ground
          const rx = a.x + (Math.random() - 0.5) * 15;
          const rz = a.z + (Math.random() - 0.5) * 15;
          a.targetX = Math.max(-halfGrid + 1, Math.min(halfGrid - 1, rx));
          a.targetZ = Math.max(-halfGrid + 1, Math.min(halfGrid - 1, rz));
        }
      }
    }

    // 2. Animations
    a.bounceTimer += delta * (a.state !== 'idle' ? 6.0 : 2.0);
    const time = a.bounceTimer;

    // Leg swinging (cow, dog, cat)
    if (a.legSwingPivot1 && a.legSwingPivot2) {
      if (a.state !== 'idle') {
        const swing = Math.sin(time) * 0.45;
        a.legSwingPivot1.rotation.x = swing;
        a.legSwingPivot2.rotation.x = -swing;
      } else {
        a.legSwingPivot1.rotation.x = 0;
        a.legSwingPivot2.rotation.x = 0;
      }
    }

    // Tail wagging (dog, cat)
    if (a.tailPivot) {
      if (a.state !== 'idle') {
        a.tailPivot.rotation.y = Math.sin(time * 1.5) * 0.3;
      } else {
        a.tailPivot.rotation.y = Math.sin(time * 0.5) * 0.1;
      }
    }

    // Wing flapping (bird)
    if (a.leftWingPivot && a.rightWingPivot) {
      const flap = Math.sin(time * 10.0) * 0.7; // Fast wings flapping
      a.leftWingPivot.rotation.z = flap;
      a.rightWingPivot.rotation.z = -flap;
    }
  });
}
