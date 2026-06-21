import * as THREE from 'three';
import { SimContext, HumanAgent } from './Types';
import { findPath } from './Pathfinding';

export function createRefinedHumanMesh(
  ctx: SimContext,
  clothingColor: number,
  isPlayer: boolean,
  agent: Partial<HumanAgent>
): THREE.Group {
  const group = new THREE.Group();

  // Skin Tone
  const skinTone = ['#ffdbac', '#f1c27d', '#e0ac69', '#c68642', '#8d5524'][Math.floor(Math.random() * 5)];
  const skinMat = ctx.getMaterial(`skin_${skinTone}`, { color: skinTone, roughness: 0.85 });

  // Pants Color
  const pantsColor = isPlayer ? '#111111' : ['#2b2b2b', '#1a2a3a', '#444444'][Math.floor(Math.random() * 3)];
  const pantsMat = ctx.getMaterial(`pants_${pantsColor}`, { color: pantsColor, roughness: 0.9 });

  // Shoes Color
  const shoeMat = ctx.getMaterial('shoes_black', { color: '#111111', roughness: 0.95 });

  // Hair Color
  const hairColor = ['#1a1a1a', '#4a2f13', '#d9a752', '#b83b1d'][Math.floor(Math.random() * 4)];
  const hairMat = ctx.getMaterial(`hair_${hairColor}`, { color: hairColor, roughness: 0.9, flatShading: true });

  const mouthMat = ctx.getMaterial('mouth_pink', { color: '#e57373', roughness: 0.9 });

  // Left Leg
  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.07, 0.24, 0);
  const legGeom = ctx.getGeometry('limb_leg', () => new THREE.BoxGeometry(0.08, 0.24, 0.08));
  const leftLeg = new THREE.Mesh(legGeom, pantsMat);
  leftLeg.position.y = -0.12;
  leftLeg.castShadow = true;
  leftLegPivot.add(leftLeg);
  
  // Sock and Shoe to left leg
  const sockMat = ctx.getMaterial('socks_white', { color: '#ffffff', roughness: 0.9 });
  const sockGeom = ctx.getGeometry('limb_sock', () => new THREE.BoxGeometry(0.082, 0.04, 0.082));
  const leftSock = new THREE.Mesh(sockGeom, sockMat);
  leftSock.position.set(0, -0.18, 0);
  leftSock.castShadow = true;
  leftLegPivot.add(leftSock);

  const shoeGeom = ctx.getGeometry('limb_shoe', () => new THREE.BoxGeometry(0.09, 0.04, 0.12));
  const leftShoe = new THREE.Mesh(shoeGeom, shoeMat);
  leftShoe.position.set(0, -0.24 + 0.02, 0.02);
  leftShoe.castShadow = true;
  leftLegPivot.add(leftShoe);

  group.add(leftLegPivot);
  agent.leftLegPivot = leftLegPivot;

  // Right Leg
  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.07, 0.24, 0);
  const rightLeg = new THREE.Mesh(legGeom, pantsMat);
  rightLeg.position.y = -0.12;
  rightLeg.castShadow = true;
  rightLegPivot.add(rightLeg);

  // Sock and Shoe to right leg
  const rightSock = new THREE.Mesh(sockGeom, sockMat);
  rightSock.position.set(0, -0.18, 0);
  rightSock.castShadow = true;
  rightLegPivot.add(rightSock);

  const rightShoe = new THREE.Mesh(shoeGeom, shoeMat);
  rightShoe.position.set(0, -0.24 + 0.02, 0.02);
  rightShoe.castShadow = true;
  rightLegPivot.add(rightShoe);

  group.add(rightLegPivot);
  agent.rightLegPivot = rightLegPivot;

  // Upper Body Group
  const upperBody = new THREE.Group();
  upperBody.position.set(0, 0.24, 0);
  group.add(upperBody);
  agent.upperBody = upperBody;

  // Torso
  const torsoGeom = ctx.getGeometry('torso_box', () => new THREE.BoxGeometry(0.24, 0.32, 0.16));
  const torsoMat = ctx.getMaterial(`shirt_${clothingColor}`, { color: clothingColor, roughness: 0.8 });
  const torso = new THREE.Mesh(torsoGeom, torsoMat);
  torso.position.y = 0.16;
  torso.castShadow = true;
  torso.receiveShadow = true;
  upperBody.add(torso);

  // Neck
  const neckGeom = ctx.getGeometry('neck_box', () => new THREE.BoxGeometry(0.06, 0.05, 0.06));
  const neck = new THREE.Mesh(neckGeom, skinMat);
  neck.position.set(0, 0.335, 0);
  neck.castShadow = true;
  upperBody.add(neck);

  // Shirt Collar
  const collarGeom = ctx.getGeometry('collar_box', () => new THREE.BoxGeometry(0.12, 0.02, 0.10));
  const collar = new THREE.Mesh(collarGeom, torsoMat);
  collar.position.set(0, 0.315, 0.035);
  collar.castShadow = true;
  upperBody.add(collar);

  // Head
  const headGeom = ctx.getGeometry('head_box', () => new THREE.BoxGeometry(0.18, 0.18, 0.18));
  const head = new THREE.Mesh(headGeom, skinMat);
  head.position.set(0, 0.44, 0); // Raised slightly to fit neck
  head.castShadow = true;
  upperBody.add(head);

  // Detailed Eyes (White Sclera + Black Pupil)
  const scleraGeom = ctx.getGeometry('sclera_box', () => new THREE.BoxGeometry(0.04, 0.03, 0.015));
  const scleraMat = ctx.getMaterial('sclera_white', { color: '#ffffff', roughness: 0.1 });
  const pupilGeom = ctx.getGeometry('pupil_box', () => new THREE.BoxGeometry(0.02, 0.025, 0.016));
  const pupilMat = ctx.getMaterial('pupil_black', { color: '#000000', roughness: 0.1 });

  const leftSclera = new THREE.Mesh(scleraGeom, scleraMat);
  leftSclera.position.set(-0.045, 0.03, 0.091);
  head.add(leftSclera);

  const leftPupil = new THREE.Mesh(pupilGeom, pupilMat);
  leftPupil.position.set(-0.04, 0.03, 0.096);
  head.add(leftPupil);

  const rightSclera = new THREE.Mesh(scleraGeom, scleraMat);
  rightSclera.position.set(0.045, 0.03, 0.091);
  head.add(rightSclera);

  const rightPupil = new THREE.Mesh(pupilGeom, pupilMat);
  rightPupil.position.set(0.04, 0.03, 0.096);
  head.add(rightPupil);

  // Eyebrows
  const eyebrowGeom = ctx.getGeometry('eyebrow_box', () => new THREE.BoxGeometry(0.045, 0.01, 0.01));
  const leftEyebrow = new THREE.Mesh(eyebrowGeom, hairMat);
  leftEyebrow.position.set(-0.045, 0.06, 0.092);
  head.add(leftEyebrow);

  const rightEyebrow = new THREE.Mesh(eyebrowGeom, hairMat);
  rightEyebrow.position.set(0.045, 0.06, 0.092);
  head.add(rightEyebrow);

  // Blush Cheeks
  const blushGeom = ctx.getGeometry('blush_box', () => new THREE.BoxGeometry(0.03, 0.02, 0.01));
  const blushMat = ctx.getMaterial('blush_pink', { color: '#ff8a8a', roughness: 0.9, transparent: true, opacity: 0.5 });
  
  const leftBlush = new THREE.Mesh(blushGeom, blushMat);
  leftBlush.position.set(-0.05, -0.01, 0.091);
  head.add(leftBlush);

  const rightBlush = new THREE.Mesh(blushGeom, blushMat);
  rightBlush.position.set(0.05, -0.01, 0.091);
  head.add(rightBlush);

  // Nose
  const noseGeom = ctx.getGeometry('nose_box', () => new THREE.BoxGeometry(0.025, 0.04, 0.025));
  const nose = new THREE.Mesh(noseGeom, skinMat);
  nose.position.set(0, -0.01, 0.095);
  head.add(nose);

  // Mouth
  const mouthGeom = ctx.getGeometry('mouth_box', () => new THREE.BoxGeometry(0.05, 0.015, 0.01));
  const mouth = new THREE.Mesh(mouthGeom, mouthMat);
  mouth.position.set(0, -0.045, 0.091);
  head.add(mouth);

  // Hair Base
  const hairGeom = ctx.getGeometry('hair_box', () => new THREE.BoxGeometry(0.19, 0.1, 0.19));
  const hairMain = new THREE.Mesh(hairGeom, hairMat);
  hairMain.position.set(0, 0.06, 0);
  head.add(hairMain);

  const hairBackGeom = ctx.getGeometry('hair_back_box', () => new THREE.BoxGeometry(0.19, 0.14, 0.08));
  const hairBack = new THREE.Mesh(hairBackGeom, hairMat);
  hairBack.position.set(0, 0.01, -0.055);
  head.add(hairBack);

  // Hair Bangs (Fringe) & Sideburns
  const bangsGeom = ctx.getGeometry('hair_bangs', () => new THREE.BoxGeometry(0.19, 0.04, 0.04));
  const hairBangs = new THREE.Mesh(bangsGeom, hairMat);
  hairBangs.position.set(0, 0.06, 0.08);
  head.add(hairBangs);

  const sideburnGeom = ctx.getGeometry('hair_sideburn', () => new THREE.BoxGeometry(0.025, 0.08, 0.04));
  const leftSideburn = new THREE.Mesh(sideburnGeom, hairMat);
  leftSideburn.position.set(-0.095, 0.01, 0.03);
  head.add(leftSideburn);

  const rightSideburn = new THREE.Mesh(sideburnGeom, hairMat);
  rightSideburn.position.set(0.095, 0.01, 0.03);
  head.add(rightSideburn);

  // Special crown for player
  if (isPlayer) {
    const crownMat = ctx.getMaterial('crown_gold', { color: '#ffbd03', metalness: 0.8, roughness: 0.1 });
    const crownGroup = new THREE.Group();
    crownGroup.position.set(0, 0.14, 0);
    
    // Base ring
    const baseGeom = ctx.getGeometry('crown_base', () => new THREE.CylinderGeometry(0.08, 0.09, 0.03, 8));
    const base = new THREE.Mesh(baseGeom, crownMat);
    crownGroup.add(base);

    // Spikes
    const spikeGeom = ctx.getGeometry('crown_spike', () => new THREE.ConeGeometry(0.02, 0.05, 4));
    for (let angle = 0; angle < Math.PI * 2; angle += (Math.PI * 2) / 5) {
      const spike = new THREE.Mesh(spikeGeom, crownMat);
      const r = 0.085;
      spike.position.set(Math.cos(angle) * r, 0.035, Math.sin(angle) * r);
      spike.rotation.y = -angle;
      spike.rotation.x = 0.2;
      crownGroup.add(spike);
    }

    // Gem on front spike
    const gemMat = ctx.getMaterial('crown_gem', { color: '#ff0055', metalness: 0.9, roughness: 0.05 });
    const gemGeom = ctx.getGeometry('crown_gem_box', () => new THREE.BoxGeometry(0.02, 0.02, 0.02));
    const gem = new THREE.Mesh(gemGeom, gemMat);
    gem.position.set(0, 0.03, 0.09);
    crownGroup.add(gem);

    head.add(crownGroup);
  }

  // Left Arm (Short sleeve + bare forearm)
  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.16, 0.24, 0);
  
  const sleeveGeom = ctx.getGeometry('limb_sleeve', () => new THREE.BoxGeometry(0.072, 0.10, 0.072));
  const leftSleeve = new THREE.Mesh(sleeveGeom, torsoMat);
  leftSleeve.position.y = -0.05;
  leftSleeve.castShadow = true;
  leftArmPivot.add(leftSleeve);

  const forearmGeom = ctx.getGeometry('limb_forearm', () => new THREE.BoxGeometry(0.06, 0.14, 0.06));
  const leftForearm = new THREE.Mesh(forearmGeom, skinMat);
  leftForearm.position.y = -0.17;
  leftForearm.castShadow = true;
  leftArmPivot.add(leftForearm);

  const handGeom = ctx.getGeometry('limb_hand', () => new THREE.BoxGeometry(0.07, 0.05, 0.07));
  const leftHand = new THREE.Mesh(handGeom, skinMat);
  leftHand.position.y = -0.24 - 0.025;
  leftHand.castShadow = true;
  leftArmPivot.add(leftHand);

  upperBody.add(leftArmPivot);
  agent.leftArmPivot = leftArmPivot;

  // Right Arm (Short sleeve + bare forearm)
  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.16, 0.24, 0);

  const rightSleeve = new THREE.Mesh(sleeveGeom, torsoMat);
  rightSleeve.position.y = -0.05;
  rightSleeve.castShadow = true;
  rightArmPivot.add(rightSleeve);

  const rightForearm = new THREE.Mesh(forearmGeom, skinMat);
  rightForearm.position.y = -0.17;
  rightForearm.castShadow = true;
  rightArmPivot.add(rightForearm);

  const rightHand = new THREE.Mesh(handGeom, skinMat);
  rightHand.position.y = -0.24 - 0.025;
  rightHand.castShadow = true;
  rightArmPivot.add(rightHand);

  upperBody.add(rightArmPivot);
  agent.rightArmPivot = rightArmPivot;

  return group;
}

export function createNameTag(name: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const c = canvas.getContext('2d');
  if (c) {
    c.fillStyle = 'rgba(15, 23, 42, 0.8)';
    c.beginPath();
    const x = 4;
    const y = 4;
    const w = 248;
    const h = 56;
    const r = 12;
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

    c.strokeStyle = 'rgba(56, 189, 248, 0.9)';
    c.lineWidth = 3;
    c.stroke();

    c.font = 'bold 22px "Outfit", sans-serif';
    c.fillStyle = '#ffffff';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(name, 128, 32);
  }

  const texture = new THREE.CanvasTexture(canvas);
  const spriteMat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: true
  });

  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(1.5, 0.375, 1);
  sprite.position.set(0, 0.9, 0); // floats above character head
  return sprite;
}

export function wanderHuman(ctx: SimContext, h: HumanAgent) {
  h.workTimer = 0;
  const tx = Math.max(0, Math.min(ctx.gridSize - 1, h.targetCellX + Math.floor(Math.random() * 7) - 3));
  const tz = Math.max(0, Math.min(ctx.gridSize - 1, h.targetCellZ + Math.floor(Math.random() * 7) - 3));

  const path = findPath(ctx.grid, ctx.gridSize, h.targetCellX, h.targetCellZ, tx, tz);
  if (path && path.length > 1) {
    h.state = 'walking';
    h.path = path;
    h.pathIndex = 0;
  }
}

export function dispatchWorkerTo(ctx: SimContext, humansList: HumanAgent[], cellX: number, cellZ: number) {
  const idleHuman = humansList.find(h => h.state === 'idle' && !h.isPlayer && !h.playerEmail && !h.seatedInVehicleId);
  if (idleHuman) {
    idleHuman.state = 'walking';
    idleHuman.jobCellX = cellX;
    idleHuman.jobCellZ = cellZ;

    const path = findPath(ctx.grid, ctx.gridSize, idleHuman.targetCellX, idleHuman.targetCellZ, cellX, cellZ);
    if (path) {
      idleHuman.path = path;
      idleHuman.pathIndex = 0;
    }
  }
}

export function loadAllDatabaseUsers(
  ctx: SimContext,
  humansList: HumanAgent[],
  users: any[],
  currentPlayerEmail: string
) {
  const emailLowerPlayer = currentPlayerEmail.toLowerCase().trim();

  users.forEach(u => {
    const emailLower = u.email.toLowerCase().trim();

    // Skip player
    if (emailLower === emailLowerPlayer) {
      // Clean up any stale duplicate NPC avatar representing this player (e.g. from prior guest load or REST load before auth state resolved)
      const npcIndex = humansList.findIndex(h => !h.isPlayer && h.playerEmail === emailLower);
      if (npcIndex !== -1) {
        const npc = humansList[npcIndex];
        ctx.scene.remove(npc.mesh);
        humansList.splice(npcIndex, 1);
      }
      return;
    }

    const existing = humansList.find(h => h.playerEmail === emailLower);
    if (existing) {
      // If already seated, skip manual update
      if (existing.seatedInVehicleId) return;

      const dx = Math.abs(existing.mesh.position.x - u.x);
      const dz = Math.abs(existing.mesh.position.z - u.z);
      if (dx > 8.0 || dz > 8.0) {
        existing.mesh.position.set(u.x, 0, u.z);
        existing.x = u.x;
        existing.z = u.z;
        existing.targetX = u.x;
        existing.targetZ = u.z;
        const halfGrid = (ctx.gridSize * ctx.cellSize) / 2;
        const cx = Math.max(0, Math.min(ctx.gridSize - 1, Math.floor((u.x + halfGrid) / ctx.cellSize)));
        const cz = Math.max(0, Math.min(ctx.gridSize - 1, Math.floor((u.z + halfGrid) / ctx.cellSize)));
        ctx.spawnParticle(cx, cz, '#38bdf8', 6);
      } else {
        existing.targetX = u.x;
        existing.targetZ = u.z;
      }
      return;
    }

    // Spawn user avatar NPC
    const clothingColor = u.clothingColor || 0x4287f5;
    const humanGroup = new THREE.Group();
    humanGroup.position.set(u.x, 0, u.z);

    const agent: Partial<HumanAgent> = {};
    const mesh = createRefinedHumanMesh(ctx, clothingColor, false, agent);
    humanGroup.add(mesh);

    const nameTag = createNameTag(`[Lvl ${u.level || 1}] ${u.name}`);
    humanGroup.add(nameTag);

    ctx.scene.add(humanGroup);

    const halfGrid = (ctx.gridSize * ctx.cellSize) / 2;
    const cellX = Math.max(0, Math.min(ctx.gridSize - 1, Math.floor((u.x + halfGrid) / ctx.cellSize)));
    const cellZ = Math.max(0, Math.min(ctx.gridSize - 1, Math.floor((u.z + halfGrid) / ctx.cellSize)));

    const npcAgent: HumanAgent = {
      id: `db_user_${u._id || Math.random().toString(36).substr(2, 9)}`,
      mesh: humanGroup,
      x: u.x,
      z: u.z,
      targetX: u.x,
      targetZ: u.z,
      state: 'idle',
      targetCellX: cellX,
      targetCellZ: cellZ,
      path: [],
      pathIndex: 0,
      speed: 1.5 + Math.random() * 0.8,
      bounceTimer: Math.random() * 10,
      workTimer: 0,
      jobCellX: null,
      jobCellZ: null,
      clothingColor,
      isPlayer: false,
      playerName: u.name,
      playerEmail: emailLower,
      upperBody: agent.upperBody,
      leftLegPivot: agent.leftLegPivot,
      rightLegPivot: agent.rightLegPivot,
      leftArmPivot: agent.leftArmPivot,
      rightArmPivot: agent.rightArmPivot,
      actionState: 'idle',
      actionTimer: 0,
      jumpVelocity: 0,
      nameTag,
    };

    humansList.push(npcAgent);
  });

  // Handle deleted user profiles
  const dbEmails = new Set(users.map(u => u.email.toLowerCase().trim()));
  humansList.forEach(h => {
    if (h.isPlayer || !h.playerEmail || dbEmails.has(h.playerEmail)) {
      return;
    }
    ctx.scene.remove(h.mesh);
    const halfGrid = (ctx.gridSize * ctx.cellSize) / 2;
    const cx = Math.max(0, Math.min(ctx.gridSize - 1, Math.floor((h.mesh.position.x + halfGrid) / ctx.cellSize)));
    const cz = Math.max(0, Math.min(ctx.gridSize - 1, Math.floor((h.mesh.position.z + halfGrid) / ctx.cellSize)));
    ctx.spawnParticle(cx, cz, '#ff4444', 10);
  });

  const updatedList = humansList.filter(h => h.isPlayer || !h.playerEmail || dbEmails.has(h.playerEmail));
  humansList.length = 0;
  humansList.push(...updatedList);
}

export function addDatabaseUser(
  ctx: SimContext,
  humansList: HumanAgent[],
  u: any,
  currentPlayerEmail: string
) {
  const emailLowerPlayer = currentPlayerEmail.toLowerCase().trim();
  const emailLower = u.email.toLowerCase().trim();

  // Skip player
  if (emailLower === emailLowerPlayer) {
    // Clean up any stale duplicate NPC avatar representing this player (e.g. from prior guest load or REST load before auth state resolved)
    const npcIndex = humansList.findIndex(h => !h.isPlayer && h.playerEmail === emailLower);
    if (npcIndex !== -1) {
      const npc = humansList[npcIndex];
      ctx.scene.remove(npc.mesh);
      humansList.splice(npcIndex, 1);
    }
    return;
  }

  const existing = humansList.find(h => h.playerEmail === emailLower);
  if (existing) {
    // If already seated, skip manual update
    if (existing.seatedInVehicleId) return;

    const dx = Math.abs(existing.mesh.position.x - u.x);
    const dz = Math.abs(existing.mesh.position.z - u.z);
    if (dx > 8.0 || dz > 8.0) {
      existing.mesh.position.set(u.x, 0, u.z);
      existing.x = u.x;
      existing.z = u.z;
      existing.targetX = u.x;
      existing.targetZ = u.z;
      const halfGrid = (ctx.gridSize * ctx.cellSize) / 2;
      const cx = Math.max(0, Math.min(ctx.gridSize - 1, Math.floor((u.x + halfGrid) / ctx.cellSize)));
      const cz = Math.max(0, Math.min(ctx.gridSize - 1, Math.floor((u.z + halfGrid) / ctx.cellSize)));
      ctx.spawnParticle(cx, cz, '#38bdf8', 6);
    } else {
      existing.targetX = u.x;
      existing.targetZ = u.z;
    }
    return;
  }

  // Spawn user avatar NPC
  const clothingColor = u.clothingColor || 0x4287f5;
  const humanGroup = new THREE.Group();
  humanGroup.position.set(u.x, 0, u.z);

  const agent: Partial<HumanAgent> = {};
  const mesh = createRefinedHumanMesh(ctx, clothingColor, false, agent);
  humanGroup.add(mesh);

  const nameTag = createNameTag(`[Lvl ${u.level || 1}] ${u.name}`);
  humanGroup.add(nameTag);

  ctx.scene.add(humanGroup);

  const halfGrid = (ctx.gridSize * ctx.cellSize) / 2;
  const cellX = Math.max(0, Math.min(ctx.gridSize - 1, Math.floor((u.x + halfGrid) / ctx.cellSize)));
  const cellZ = Math.max(0, Math.min(ctx.gridSize - 1, Math.floor((u.z + halfGrid) / ctx.cellSize)));

  const npcAgent: HumanAgent = {
    id: `db_user_${u._id || Math.random().toString(36).substr(2, 9)}`,
    mesh: humanGroup,
    x: u.x,
    z: u.z,
    targetX: u.x,
    targetZ: u.z,
    state: 'idle',
    targetCellX: cellX,
    targetCellZ: cellZ,
    path: [],
    pathIndex: 0,
    speed: 1.5 + Math.random() * 0.8,
    bounceTimer: Math.random() * 10,
    workTimer: 0,
    jobCellX: null,
    jobCellZ: null,
    clothingColor,
    isPlayer: false,
    playerName: u.name,
    playerEmail: emailLower,
    upperBody: agent.upperBody,
    leftLegPivot: agent.leftLegPivot,
    rightLegPivot: agent.rightLegPivot,
    leftArmPivot: agent.leftArmPivot,
    rightArmPivot: agent.rightArmPivot,
    actionState: 'idle',
    actionTimer: 0,
    jumpVelocity: 0,
    nameTag,
  };

  humansList.push(npcAgent);
}

export function updateHumans(
  ctx: SimContext,
  humansList: HumanAgent[],
  keysPressed: { [key: string]: boolean },
  delta: number,
  syncStates: {
    positionSyncTimer: number;
    lastSyncedPosition: THREE.Vector3;
    lastPlayerPosition: THREE.Vector3 | null;
  },
  fidoQuestOwnerId?: string | null
) {
  const halfGrid = (ctx.gridSize * ctx.cellSize) / 2;

  humansList.forEach(h => {
    // Lock the quest owner in place if Fido is found/quest is active
    if (fidoQuestOwnerId && h.id === fidoQuestOwnerId) {
      h.state = 'idle';
      h.path = [];
      h.pathIndex = 0;
      h.targetX = h.mesh.position.x;
      h.targetZ = h.mesh.position.z;
      return;
    }

    // Skip updates if they are sitting in a car
    if (h.seatedInVehicleId) return;

    // Skip player updates if they are working (locked animation)
    if (h.isPlayer && h.state === 'working') {
      if (h.actionTimer !== undefined && h.actionTimer > 0) {
        h.actionTimer -= delta;
        if (h.actionTimer <= 0) h.actionState = 'idle';
      }
      if (h.actionState === 'jumping') {
        if (h.jumpVelocity === undefined) h.jumpVelocity = 0;
        h.mesh.position.y += h.jumpVelocity * delta;
        h.jumpVelocity -= 15.0 * delta;
        if (h.mesh.position.y <= 0) {
          h.mesh.position.y = 0;
          h.jumpVelocity = 0;
          h.actionState = 'idle';
        }
      }
      return;
    }

    // 1. Process action timer
    if (h.actionTimer !== undefined && h.actionTimer > 0) {
      h.actionTimer -= delta;
      if (h.actionTimer <= 0) {
        h.actionState = 'idle';
      }
    }

    // 2. Handle movement and actions
    if (h.isPlayer) {
      const hasMovementInput =
        keysPressed['w'] || keysPressed['s'] ||
        keysPressed['a'] || keysPressed['d'] ||
        keysPressed['arrowup'] || keysPressed['arrowdown'] ||
        keysPressed['arrowleft'] || keysPressed['arrowright'];

      let currentActionState = h.actionState || 'idle';

      if (currentActionState === 'sitting' && hasMovementInput) {
        h.actionState = 'idle';
        currentActionState = 'idle';
      }

      if (currentActionState !== 'sitting' && currentActionState !== 'punching' && currentActionState !== 'kicking') {


        // Camera-relative movement
        const camDir = new THREE.Vector3();
        ctx.camera.getWorldDirection(camDir);
        camDir.y = 0;
        camDir.normalize();

        const camRight = new THREE.Vector3();
        camRight.crossVectors(camDir, ctx.camera.up);
        camRight.y = 0;
        camRight.normalize();

        const moveVec = new THREE.Vector3(0, 0, 0);
        if (keysPressed['w'] || keysPressed['arrowup']) moveVec.add(camDir);
        if (keysPressed['s'] || keysPressed['arrowdown']) moveVec.sub(camDir);
        if (keysPressed['d'] || keysPressed['arrowright']) moveVec.add(camRight);
        if (keysPressed['a'] || keysPressed['arrowleft']) moveVec.sub(camRight);

        if (moveVec.lengthSq() > 0) {
          moveVec.normalize();
          h.state = 'walking';

          const speed = h.speed;
          const candidateX = h.mesh.position.x + moveVec.x * speed * delta;
          const candidateZ = h.mesh.position.z + moveVec.z * speed * delta;

          // Collision sliding
          const gxX = Math.floor((candidateX + halfGrid) / ctx.cellSize);
          const gzX = Math.floor((h.mesh.position.z + halfGrid) / ctx.cellSize);
          let canMoveX = true;
          if (gxX < 0 || gxX >= ctx.gridSize || gzX < 0 || gzX >= ctx.gridSize) {
            canMoveX = false;
          } else {
            const cell = ctx.grid[gxX][gzX];
            if (cell.type === 'house' || cell.type === 'skyscraper' || cell.type === 'tree' || cell.type === 'construction' || cell.type === 'restaurant' || cell.type === 'clothshop' || cell.type === 'barbershop' || cell.type === 'policestation') {
              canMoveX = false;
            }
          }

          const gxZ = Math.floor((h.mesh.position.x + halfGrid) / ctx.cellSize);
          const gzZ = Math.floor((candidateZ + halfGrid) / ctx.cellSize);
          let canMoveZ = true;
          if (gxZ < 0 || gxZ >= ctx.gridSize || gzZ < 0 || gzZ >= ctx.gridSize) {
            canMoveZ = false;
          } else {
            const cell = ctx.grid[gxZ][gzZ];
            if (cell.type === 'house' || cell.type === 'skyscraper' || cell.type === 'tree' || cell.type === 'construction' || cell.type === 'restaurant' || cell.type === 'clothshop' || cell.type === 'barbershop' || cell.type === 'policestation') {
              canMoveZ = false;
            }
          }

          if (canMoveX) h.mesh.position.x = candidateX;
          if (canMoveZ) h.mesh.position.z = candidateZ;

          const targetAngle = Math.atan2(moveVec.x, moveVec.z);
          let diff = targetAngle - h.mesh.rotation.y;
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          h.mesh.rotation.y += diff * 12 * delta;

          h.x = h.mesh.position.x;
          h.z = h.mesh.position.z;

          if (typeof window !== "undefined") {
            const actualMoveDist = Math.sqrt((canMoveX ? moveVec.x : 0) ** 2 + (canMoveZ ? moveVec.z : 0) ** 2) * speed * delta;
            window.dispatchEvent(new CustomEvent("shunya-walked", { detail: { distance: actualMoveDist } }));
          }
        } else {
          h.state = 'idle';
        }
      } else {
        h.state = 'idle';
      }

      // Jump
      if (h.actionState === 'jumping') {
        if (h.jumpVelocity === undefined) h.jumpVelocity = 0;
        h.mesh.position.y += h.jumpVelocity * delta;
        h.jumpVelocity -= 15.0 * delta;

        if (h.mesh.position.y <= 0) {
          h.mesh.position.y = 0;
          h.jumpVelocity = 0;
          h.actionState = 'idle';
        }
      }

      // Camera target follow Y=0
      const targetPos = new THREE.Vector3(h.mesh.position.x, 0, h.mesh.position.z);
      ctx.controls.target.copy(targetPos);

      // Camera position follow (X and Z only)
      if (syncStates.lastPlayerPosition) {
        const deltaPos = new THREE.Vector3().copy(h.mesh.position).sub(syncStates.lastPlayerPosition);
        deltaPos.y = 0; // Keep camera height independent of character jumps/vertical movement
        ctx.camera.position.add(deltaPos);
        syncStates.lastPlayerPosition.copy(h.mesh.position);
      }

      // Periodic database sync
      syncStates.positionSyncTimer -= delta;
      if (syncStates.positionSyncTimer <= 0) {
        const hasWs = ctx.ws && ctx.ws.readyState === WebSocket.OPEN;
        syncStates.positionSyncTimer = hasWs ? 0.1 : 10.0;
        const distSq = h.mesh.position.distanceToSquared(syncStates.lastSyncedPosition);
        if (distSq > 0.005 && h.playerEmail) {
          syncStates.lastSyncedPosition.copy(h.mesh.position);
          if (hasWs && ctx.ws) {
            ctx.ws.send(
              JSON.stringify({
                type: "player-move",
                x: h.mesh.position.x,
                z: h.mesh.position.z,
              }),
            );
          } else {
            fetch("/api/users/position", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                x: h.mesh.position.x,
                z: h.mesh.position.z,
              }),
            })
              .then((res) => {
                if (res.status === 401) {
                  window.dispatchEvent(new CustomEvent("auth-unauthorized"));
                }
              })
              .catch((err) =>
                console.error("Failed to sync player position:", err),
              );
          }
        }
      }
    } else if (h.playerEmail) {
      // Other registered users
      const dirX = h.targetX - h.mesh.position.x;
      const dirZ = h.targetZ - h.mesh.position.z;
      const dist = Math.sqrt(dirX * dirX + dirZ * dirZ);

      if (dist > 0.05) {
        h.state = 'walking';
        const stepDist = h.speed * delta;
        if (dist <= stepDist) {
          h.mesh.position.set(h.targetX, 0, h.targetZ);
          h.x = h.targetX;
          h.z = h.targetZ;
          h.state = 'idle';
        } else {
          h.x += (dirX / dist) * stepDist;
          h.z += (dirZ / dist) * stepDist;
          h.mesh.position.set(h.x, 0, h.z);
          h.mesh.rotation.y = Math.atan2(dirX, dirZ);
        }
      } else {
        h.state = 'idle';
      }
    } else {
      // System NPCs
      if (ctx.isAdmin) {
        if (h.state === 'walking' || h.state === 'working') {
          if (h.path.length > 0 && h.pathIndex < h.path.length) {
            const nextTargetCell = h.path[h.pathIndex];
            const targetWorldX = (nextTargetCell.x * ctx.cellSize) - halfGrid + ctx.cellSize / 2;
            const targetWorldZ = (nextTargetCell.z * ctx.cellSize) - halfGrid + ctx.cellSize / 2;

            const dirX = targetWorldX - h.x;
            const dirZ = targetWorldZ - h.z;
            const dist = Math.sqrt(dirX * dirX + dirZ * dirZ);
            const stepDist = h.speed * delta;

            if (dist <= stepDist) {
              h.x = targetWorldX;
              h.z = targetWorldZ;
              h.targetCellX = nextTargetCell.x;
              h.targetCellZ = nextTargetCell.z;
              h.pathIndex++;

              if (h.pathIndex < h.path.length) {
                const lookTarget = h.path[h.pathIndex];
                const angle = Math.atan2(lookTarget.x - nextTargetCell.x, lookTarget.z - nextTargetCell.z);
                h.mesh.rotation.y = angle;
              }
            } else {
              h.x += (dirX / dist) * stepDist;
              h.z += (dirZ / dist) * stepDist;
              h.mesh.rotation.y = Math.atan2(dirX, dirZ);
            }

            h.mesh.position.set(h.x, 0, h.z);
          } else {
            // Finished path
            if (h.jobCellX !== null && h.jobCellZ !== null) {
              h.state = 'working';
              h.workTimer += delta;

              if (Math.random() < 0.18) {
                ctx.spawnParticle(h.jobCellX, h.jobCellZ, '#ffaa00', 2);
                ctx.audio.playBuild();
              }

              const cell = ctx.grid[h.jobCellX][h.jobCellZ];
              if (cell.type === 'construction') {
                cell.constructionProgress += 16 * delta;

                if (cell.constructionProgress >= 100) {
                  ctx.completeConstruction(h.jobCellX, h.jobCellZ);
                  h.state = 'idle';
                  h.jobCellX = null;
                  h.jobCellZ = null;
                  h.path = [];
                }
              } else {
                h.state = 'idle';
                h.jobCellX = null;
                h.jobCellZ = null;
                h.path = [];
              }
            } else {
              h.state = 'idle';
              h.workTimer += delta;

              if (h.workTimer > 3.0 + Math.random() * 5.0) {
                wanderHuman(ctx, h);
              }
            }
          }
        } else if (h.state === 'idle') {
          h.workTimer += delta;
          if (h.workTimer > 3.0 + Math.random() * 5.0) {
            wanderHuman(ctx, h);
          }
        }
      } else {
        // Normal client: smooth-walk
        const dirX = h.targetX - h.mesh.position.x;
        const dirZ = h.targetZ - h.mesh.position.z;
        const dist = Math.sqrt(dirX * dirX + dirZ * dirZ);

        if (dist > 0.05) {
          h.state = 'walking';
          const stepDist = h.speed * delta;
          if (dist <= stepDist) {
            h.mesh.position.set(h.targetX, 0, h.targetZ);
            h.x = h.targetX;
            h.z = h.targetZ;
            h.state = 'idle';
          } else {
            h.x += (dirX / dist) * stepDist;
            h.z += (dirZ / dist) * stepDist;
            h.mesh.position.set(h.x, 0, h.z);
            h.mesh.rotation.y = Math.atan2(dirX, dirZ);
          }
        } else {
          h.state = 'idle';
        }
      }
    }

    // 3. Limb animations
    h.bounceTimer += delta * (h.state === 'walking' ? h.speed * 4.5 : 2.0);
    const time = h.bounceTimer;

    const leftLeg = h.leftLegPivot;
    const rightLeg = h.rightLegPivot;
    const leftArm = h.leftArmPivot;
    const rightArm = h.rightArmPivot;
    const upperBody = h.upperBody;

    if (leftLeg && rightLeg && leftArm && rightArm && upperBody) {
      upperBody.position.y = 0.24;
      leftLeg.position.y = 0.24;
      rightLeg.position.y = 0.24;

      leftLeg.rotation.set(0, 0, 0);
      rightLeg.rotation.set(0, 0, 0);
      leftArm.rotation.set(0, 0, -0.05);
      rightArm.rotation.set(0, 0, 0.05);

      const action = h.actionState || 'idle';

      if (action === 'sitting') {
        upperBody.position.y = 0.12;
        leftLeg.rotation.set(-Math.PI / 2, 0, 0);
        rightLeg.rotation.set(-Math.PI / 2, 0, 0);
        leftArm.rotation.set(-0.3, 0, -0.05);
        rightArm.rotation.set(-0.3, 0, 0.05);
      } else if (action === 'punching') {
        leftArm.rotation.set(0.1, 0, -0.05);
        rightArm.rotation.set(-Math.PI / 2, 0, 0.1);
      } else if (action === 'kicking') {
        rightLeg.rotation.set(-Math.PI / 3, 0, 0);
        leftLeg.rotation.set(0.1, 0, 0);
        leftArm.rotation.set(0.2, 0, -0.2);
        rightArm.rotation.set(0.2, 0, 0.2);
      } else if (action === 'jumping') {
        leftLeg.rotation.set(-0.3, 0, 0);
        rightLeg.rotation.set(-0.3, 0, 0);
        leftArm.rotation.set(-Math.PI * 0.7, 0, -0.2);
        rightArm.rotation.set(-Math.PI * 0.7, 0, 0.2);
      } else {
        if (h.state === 'walking') {
          const legSwing = Math.sin(time) * 0.6;
          leftLeg.rotation.set(legSwing, 0, 0);
          rightLeg.rotation.set(-legSwing, 0, 0);

          const armSwing = -Math.sin(time) * 0.6;
          leftArm.rotation.set(armSwing, 0, -0.05);
          rightArm.rotation.set(-armSwing, 0, 0.05);

          const bob = Math.abs(Math.sin(time * 2)) * 0.04;
          upperBody.position.y = 0.24 - bob;
        } else if (h.state === 'working') {
          leftArm.rotation.set(0.2, 0, -0.05);
          const hammerSwing = Math.sin(time * 6.0) * 0.5 - 0.5;
          rightArm.rotation.set(hammerSwing, 0, 0.05);
        } else {
          const breathe = Math.sin(time) * 0.02;
          leftArm.rotation.set(breathe * 2, 0, -0.05);
          rightArm.rotation.set(breathe * 2, 0, 0.05);
          upperBody.position.y = 0.24 + breathe * 0.5;
        }
      }
    }
  });
}

export async function syncNpcsToDatabase(ctx: SimContext, humansList: HumanAgent[]) {
  if (!ctx.isAdmin) return;

  // Find player details to act as credentials
  const player = humansList.find(h => h.isPlayer);
  if (!player || !player.playerEmail) return;

  const npcsData = humansList
    .filter(h => !h.isPlayer && !h.playerEmail)
    .map(h => ({
      npcId: h.id,
      name: h.playerName || `NPC_${h.id.split('_')[1] || h.id}`,
      x: h.mesh.position.x,
      z: h.mesh.position.z,
      targetX: h.state === 'walking' && h.path && h.pathIndex < h.path.length
        ? (h.path[h.path.length - 1].x * ctx.cellSize) - ((ctx.gridSize * ctx.cellSize) / 2) + ctx.cellSize / 2
        : h.targetX,
      targetZ: h.state === 'walking' && h.path && h.pathIndex < h.path.length
        ? (h.path[h.path.length - 1].z * ctx.cellSize) - ((ctx.gridSize * ctx.cellSize) / 2) + ctx.cellSize / 2
        : h.targetZ,
      state: h.state,
      clothingColor: h.clothingColor
    }));

  if (ctx.ws && ctx.ws.readyState === WebSocket.OPEN) {
    ctx.ws.send(
      JSON.stringify({
        type: "npc-sync",
        npcs: npcsData,
      }),
    );
  } else {
    try {
      const res = await fetch("/api/npcs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          npcs: npcsData,
        }),
      });
      if (res.status === 401) {
        window.dispatchEvent(new CustomEvent("auth-unauthorized"));
      }
    } catch (e) {
      console.error("Failed to sync NPCs to database:", e);
    }
  }
}
