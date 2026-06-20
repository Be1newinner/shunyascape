import * as THREE from 'three';
import { SimContext, HumanAgent, GridCell } from './Types';
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

  // Eye Material
  const eyeMat = ctx.getMaterial('eye_black', { color: '#000000', roughness: 0.1 });
  const mouthMat = ctx.getMaterial('mouth_pink', { color: '#e57373', roughness: 0.9 });

  // Left Leg
  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.07, 0.24, 0);
  const legGeom = ctx.getGeometry('limb_leg', () => new THREE.BoxGeometry(0.08, 0.24, 0.08));
  const leftLeg = new THREE.Mesh(legGeom, pantsMat);
  leftLeg.position.y = -0.12;
  leftLeg.castShadow = true;
  leftLegPivot.add(leftLeg);
  
  // Shoe to left leg
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

  // Shoe to right leg
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

  // Head
  const headGeom = ctx.getGeometry('head_box', () => new THREE.BoxGeometry(0.18, 0.18, 0.18));
  const head = new THREE.Mesh(headGeom, skinMat);
  head.position.set(0, 0.41, 0);
  head.castShadow = true;
  upperBody.add(head);

  // Eyes
  const eyeGeom = ctx.getGeometry('eye_box', () => new THREE.BoxGeometry(0.03, 0.03, 0.015));
  const leftEye = new THREE.Mesh(eyeGeom, eyeMat);
  leftEye.position.set(-0.045, 0.03, 0.091);
  head.add(leftEye);

  const rightEye = new THREE.Mesh(eyeGeom, eyeMat);
  rightEye.position.set(0.045, 0.03, 0.091);
  head.add(rightEye);

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

  // Hair
  const hairGeom = ctx.getGeometry('hair_box', () => new THREE.BoxGeometry(0.19, 0.1, 0.19));
  const hairMain = new THREE.Mesh(hairGeom, hairMat);
  hairMain.position.set(0, 0.06, 0);
  head.add(hairMain);

  const hairBackGeom = ctx.getGeometry('hair_back_box', () => new THREE.BoxGeometry(0.19, 0.14, 0.08));
  const hairBack = new THREE.Mesh(hairBackGeom, hairMat);
  hairBack.position.set(0, 0.01, -0.055);
  head.add(hairBack);

  // Special crown for player
  if (isPlayer) {
    const crownMat = ctx.getMaterial('crown_gold', { color: '#ffbd03', metalness: 0.8, roughness: 0.1 });
    const crownGeom = ctx.getGeometry('player_crown', () => new THREE.CylinderGeometry(0.1, 0.11, 0.06, 6));
    const crown = new THREE.Mesh(crownGeom, crownMat);
    crown.position.set(0, 0.13, 0);
    head.add(crown);
  }

  // Left Arm
  const armGeom = ctx.getGeometry('limb_arm', () => new THREE.BoxGeometry(0.07, 0.24, 0.07));
  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.16, 0.24, 0);
  const leftArm = new THREE.Mesh(armGeom, torsoMat);
  leftArm.position.y = -0.12;
  leftArm.castShadow = true;
  leftArmPivot.add(leftArm);

  const handGeom = ctx.getGeometry('limb_hand', () => new THREE.BoxGeometry(0.07, 0.05, 0.07));
  const leftHand = new THREE.Mesh(handGeom, skinMat);
  leftHand.position.y = -0.24 - 0.025;
  leftHand.castShadow = true;
  leftArmPivot.add(leftHand);

  upperBody.add(leftArmPivot);
  agent.leftArmPivot = leftArmPivot;

  // Right Arm
  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.16, 0.24, 0);
  const rightArm = new THREE.Mesh(armGeom, torsoMat);
  rightArm.position.y = -0.12;
  rightArm.castShadow = true;
  rightArmPivot.add(rightArm);

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

    const nameTag = createNameTag(u.name);
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

export function updateHumans(
  ctx: SimContext,
  humansList: HumanAgent[],
  keysPressed: { [key: string]: boolean },
  delta: number,
  syncStates: {
    positionSyncTimer: number;
    lastSyncedPosition: THREE.Vector3;
    lastPlayerPosition: THREE.Vector3 | null;
  }
) {
  const halfGrid = (ctx.gridSize * ctx.cellSize) / 2;

  humansList.forEach(h => {
    // Skip updates if they are sitting in a car
    if (h.seatedInVehicleId) return;

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
            if (cell.type === 'house' || cell.type === 'skyscraper' || cell.type === 'tree' || cell.type === 'construction') {
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
            if (cell.type === 'house' || cell.type === 'skyscraper' || cell.type === 'tree' || cell.type === 'construction') {
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
        syncStates.positionSyncTimer = 0.5;
        const distSq = h.mesh.position.distanceToSquared(syncStates.lastSyncedPosition);
        if (distSq > 0.01 && h.playerEmail) {
          syncStates.lastSyncedPosition.copy(h.mesh.position);
          fetch('/api/users/position', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              x: h.mesh.position.x,
              z: h.mesh.position.z
            })
          }).then(res => {
            if (res.status === 401) {
              window.dispatchEvent(new CustomEvent('auth-unauthorized'));
            }
          }).catch(err => console.error('Failed to sync player position:', err));
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

  try {
    const res = await fetch('/api/npcs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        npcs: npcsData
      })
    });
    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent('auth-unauthorized'));
    }
  } catch (e) {
    console.error('Failed to sync NPCs to database:', e);
  }
}
