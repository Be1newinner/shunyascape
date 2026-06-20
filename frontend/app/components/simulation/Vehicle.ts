import * as THREE from 'three';
import { SimContext, VehicleAgent, HumanAgent, GridCell } from './Types';

export function createVehicleMesh(ctx: SimContext, color: number): THREE.Group {
  const carGroup = new THREE.Group();

  // Chassis Box
  const chassisGeom = ctx.getGeometry('car_chassis', () => new THREE.BoxGeometry(0.7, 0.35, 0.45));
  const chassisMat = ctx.getMaterial(`car_body_${color}`, { color, roughness: 0.3, metalness: 0.6 });
  const chassis = new THREE.Mesh(chassisGeom, chassisMat);
  chassis.position.y = 0.175;
  chassis.castShadow = true;
  carGroup.add(chassis);

  // Cab / Windows Box (Pitched/Translucent)
  const cabGeom = ctx.getGeometry('car_cab', () => new THREE.BoxGeometry(0.42, 0.25, 0.38));
  const cabMat = ctx.getMaterial('car_windows', { color: '#222222', roughness: 0.1, metalness: 0.9, transparent: true, opacity: 0.7 });
  const cab = new THREE.Mesh(cabGeom, cabMat);
  cab.position.set(-0.05, 0.4, 0);
  cab.castShadow = true;
  carGroup.add(cab);

  // Wheels (4 small cylinders)
  const wheelGeom = ctx.getGeometry('car_wheel', () => new THREE.CylinderGeometry(0.12, 0.12, 0.1, 8));
  const wheelMat = ctx.getMaterial('car_wheels', { color: '#111111', roughness: 0.95 });
  wheelGeom.rotateX(Math.PI / 2);

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

  return carGroup;
}

export function spawnVehicleOnRoad(
  ctx: SimContext,
  vehiclesList: VehicleAgent[],
  humansList: HumanAgent[],
  x: number,
  z: number
) {
  if (vehiclesList.length >= 8) return; // Limit vehicles

  const halfGrid = (ctx.gridSize * ctx.cellSize) / 2;
  const worldX = (x * ctx.cellSize) - halfGrid + ctx.cellSize / 2;
  const worldZ = (z * ctx.cellSize) - halfGrid + ctx.cellSize / 2;

  const carColor = [0xd32f2f, 0x1976d2, 0x388e3c, 0xfbc02d, 0x7b1fa2, 0x00796b][Math.floor(Math.random() * 6)];
  const carGroup = createVehicleMesh(ctx, carColor);
  carGroup.position.set(worldX, 0.08, worldZ);
  ctx.scene.add(carGroup);

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

  // Passenger boarding feature
  // Chance to pick an idle system NPC to sit in the car
  if (Math.random() < 0.5) {
    const idleNPC = humansList.find(h => h.state === 'idle' && !h.isPlayer && !h.playerEmail && !h.seatedInVehicleId);
    if (idleNPC) {
      idleNPC.state = 'sitting';
      idleNPC.actionState = 'sitting';
      idleNPC.seatedInVehicleId = vehicle.id;

      // Remove NPC mesh from scene and attach it to the car
      ctx.scene.remove(idleNPC.mesh);
      
      // Position the character to look like they are sitting in the driver/commuter seat
      idleNPC.mesh.position.set(-0.05, 0.28, 0); 
      idleNPC.mesh.rotation.set(0, -Math.PI / 2, 0); // face forward in car coordinates
      idleNPC.mesh.scale.set(0.65, 0.65, 0.65); // scale down slightly to fit inside cab
      
      carGroup.add(idleNPC.mesh);
      vehicle.passenger = idleNPC;
    }
  }

  vehiclesList.push(vehicle);
}

export function cleanStrandedVehicles(
  ctx: SimContext,
  vehiclesList: VehicleAgent[],
  grid: GridCell[][]
): VehicleAgent[] {
  return vehiclesList.filter(v => {
    const halfGrid = (ctx.gridSize * ctx.cellSize) / 2;
    const gx = Math.floor((v.x + halfGrid) / ctx.cellSize);
    const gz = Math.floor((v.z + halfGrid) / ctx.cellSize);
    
    let isRoad = false;
    if (gx >= 0 && gx < ctx.gridSize && gz >= 0 && gz < ctx.gridSize) {
      isRoad = grid[gx][gz].type === 'road';
    }

    if (isRoad) {
      return true;
    }

    // If deleting car, make sure passenger exits
    if (v.passenger) {
      unboardPassenger(ctx, v);
    }
    
    ctx.scene.remove(v.mesh);
    return false;
  });
}

function unboardPassenger(ctx: SimContext, v: VehicleAgent) {
  const p = v.passenger;
  if (!p) return;

  v.mesh.remove(p.mesh);
  p.mesh.position.set(v.x, 0, v.z);
  p.mesh.rotation.set(0, 0, 0);
  p.mesh.scale.set(1.0, 1.0, 1.0); // restore original scale
  
  p.x = v.x;
  p.z = v.z;
  p.targetX = v.x;
  p.targetZ = v.z;
  
  const halfGrid = (ctx.gridSize * ctx.cellSize) / 2;
  p.targetCellX = Math.max(0, Math.min(ctx.gridSize - 1, Math.floor((v.x + halfGrid) / ctx.cellSize)));
  p.targetCellZ = Math.max(0, Math.min(ctx.gridSize - 1, Math.floor((v.z + halfGrid) / ctx.cellSize)));
  
  p.state = 'idle';
  p.actionState = 'idle';
  p.seatedInVehicleId = undefined;
  
  ctx.scene.add(p.mesh);
  v.passenger = undefined;
}

export function updateVehicles(
  ctx: SimContext,
  vehiclesList: VehicleAgent[],
  grid: GridCell[][],
  delta: number
) {
  const halfGrid = (ctx.gridSize * ctx.cellSize) / 2;

  vehiclesList.forEach(v => {
    if (v.path.length > 0 && v.pathIndex < v.path.length) {
      const nextCell = v.path[v.pathIndex];
      const targetWorldX = (nextCell.x * ctx.cellSize) - halfGrid + ctx.cellSize / 2;
      const targetWorldZ = (nextCell.z * ctx.cellSize) - halfGrid + ctx.cellSize / 2;

      const dirX = targetWorldX - v.x;
      const dirZ = targetWorldZ - v.z;
      const dist = Math.sqrt(dirX * dirX + dirZ * dirZ);
      const stepDist = v.speed * delta;

      if (dist <= stepDist) {
        v.x = targetWorldX;
        v.z = targetWorldZ;
        v.pathIndex++;

        // Select next path index choice
        if (v.pathIndex >= v.path.length) {
          const currentCellX = nextCell.x;
          const currentCellZ = nextCell.z;

          // Find road neighbors
          const choices: { x: number; z: number }[] = [];
          const dirs = [
            { x: 0, z: -1 },
            { x: 0, z: 1 },
            { x: -1, z: 0 },
            { x: 1, z: 0 }
          ];

          dirs.forEach(d => {
            const nx = currentCellX + d.x;
            const nz = currentCellZ + d.z;
            if (nx >= 0 && nx < ctx.gridSize && nz >= 0 && nz < ctx.gridSize) {
              if (grid[nx][nz].type === 'road') {
                choices.push({ x: nx, z: nz });
              }
            }
          });

          if (choices.length > 0) {
            const nextChoice = choices[Math.floor(Math.random() * choices.length)];
            v.path = [nextCell, nextChoice];
            v.pathIndex = 1;
          } else {
            v.pathIndex = 0;
            v.path = [{ x: currentCellX, z: currentCellZ }];

            // End of road line, let passenger out
            if (v.passenger) {
              unboardPassenger(ctx, v);
            }
          }
        }
      } else {
        v.x += (dirX / dist) * stepDist;
        v.z += (dirZ / dist) * stepDist;

        const targetHeading = Math.atan2(dirX, dirZ);
        let diff = targetHeading - v.heading;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        v.heading += diff * 12 * delta;
        v.mesh.rotation.y = v.heading;
      }

      v.mesh.position.set(v.x, 0.08, v.z);
    }
  });
}
