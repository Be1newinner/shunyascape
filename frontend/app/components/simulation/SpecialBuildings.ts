import * as THREE from 'three';
import { SimContext } from './Types';

// ─────────────────────────────────────────────────────────────────────────────
// Shared helper: world position from grid cell
// ─────────────────────────────────────────────────────────────────────────────
function cellWorld(ctx: SimContext, x: number, z: number): [number, number] {
  const halfGrid = (ctx.gridSize * ctx.cellSize) / 2;
  return [
    x * ctx.cellSize - halfGrid + ctx.cellSize / 2,
    z * ctx.cellSize - halfGrid + ctx.cellSize / 2,
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// 🍔 RESTAURANT  (McDonald's-style fast food)
// ─────────────────────────────────────────────────────────────────────────────
export function createRestaurantMesh(ctx: SimContext, x: number, z: number): THREE.Group {
  const group = new THREE.Group();
  const [wx, wz] = cellWorld(ctx, x, z);
  group.position.set(wx, 0, wz);

  const cs = 3.0;
  const redMat   = new THREE.MeshLambertMaterial({ color: '#cc1a1a' });
  const yellowMat = new THREE.MeshLambertMaterial({ color: '#ffcc00' });
  const whiteMat = new THREE.MeshLambertMaterial({ color: '#f5f5f5' });
  const glassMat = new THREE.MeshLambertMaterial({ color: '#90caf9', transparent: true, opacity: 0.6 });
  const darkMat  = new THREE.MeshLambertMaterial({ color: '#1a1a1a' });

  // Main building body
  const body = new THREE.Mesh(new THREE.BoxGeometry(cs * 0.88, cs * 0.7, cs * 0.88), redMat);
  body.position.set(0, cs * 0.35, 0);
  body.castShadow = true; body.receiveShadow = true;
  group.add(body);

  // White facade strip (front)
  const facade = new THREE.Mesh(new THREE.BoxGeometry(cs * 0.88, cs * 0.18, 0.05), whiteMat);
  facade.position.set(0, cs * 0.45, cs * 0.44 + 0.01);
  group.add(facade);

  // Roof (flat red with yellow trim)
  const roof = new THREE.Mesh(new THREE.BoxGeometry(cs * 0.94, cs * 0.06, cs * 0.94), yellowMat);
  roof.position.set(0, cs * 0.73, 0);
  roof.castShadow = true;
  group.add(roof);

  // Golden Arches — 2 bent-tube arches on the facade
  const archMat = yellowMat;
  for (let side = -1; side <= 1; side += 2) {
    const arch = new THREE.Group();
    arch.position.set(side * cs * 0.15, cs * 0.55, cs * 0.45);

    // Left/right vertical pole
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, cs * 0.32, 8), archMat);
    pole.position.y = -cs * 0.05;
    arch.add(pole);

    // Arch curve (approximated as 5 small boxes)
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      const angle = Math.PI * t;
      const ax = Math.cos(angle) * 0.09 * side;
      const ay = Math.sin(angle) * 0.12;
      const seg = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.05), archMat);
      seg.position.set(ax, cs * 0.12 + ay, 0);
      seg.rotation.z = (Math.PI / 4) * (i - 2) * side * 0.5;
      arch.add(seg);
    }
    group.add(arch);
  }

  // "M" Sign on roof
  const signPole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, cs * 0.28, 6), darkMat);
  signPole.position.set(0, cs * 0.9, 0);
  group.add(signPole);

  const signBoard = new THREE.Mesh(new THREE.BoxGeometry(cs * 0.35, cs * 0.18, 0.04), yellowMat);
  signBoard.position.set(0, cs * 1.05, 0);
  group.add(signBoard);

  // Front windows (glass)
  const win = new THREE.Mesh(new THREE.BoxGeometry(cs * 0.3, cs * 0.22, 0.04), glassMat);
  win.position.set(0, cs * 0.38, cs * 0.445);
  group.add(win);

  const winL = new THREE.Mesh(new THREE.BoxGeometry(cs * 0.2, cs * 0.18, 0.04), glassMat);
  winL.position.set(-cs * 0.28, cs * 0.36, cs * 0.445);
  group.add(winL);

  const winR = win.clone();
  winR.position.set(cs * 0.28, cs * 0.36, cs * 0.445);
  group.add(winR);

  // Door
  const door = new THREE.Mesh(new THREE.BoxGeometry(cs * 0.18, cs * 0.28, 0.04), darkMat);
  door.position.set(0, cs * 0.14, cs * 0.445);
  group.add(door);

  return group;
}

// ─────────────────────────────────────────────────────────────────────────────
// 👕 CLOTH SHOP
// ─────────────────────────────────────────────────────────────────────────────
export function createClothShopMesh(ctx: SimContext, x: number, z: number): THREE.Group {
  const group = new THREE.Group();
  const [wx, wz] = cellWorld(ctx, x, z);
  group.position.set(wx, 0, wz);

  const cs = 3.0;
  const blueMat   = new THREE.MeshLambertMaterial({ color: '#1565c0' });
  const whiteMat  = new THREE.MeshLambertMaterial({ color: '#f0f0f0' });
  const glassMat  = new THREE.MeshLambertMaterial({ color: '#b3e5fc', transparent: true, opacity: 0.55 });
  const skinMat   = new THREE.MeshLambertMaterial({ color: '#f1c27d' });

  // Main body
  const body = new THREE.Mesh(new THREE.BoxGeometry(cs * 0.88, cs * 0.65, cs * 0.88), whiteMat);
  body.position.set(0, cs * 0.325, 0);
  body.castShadow = true; body.receiveShadow = true;
  group.add(body);

  // Blue roof
  const roof = new THREE.Mesh(new THREE.BoxGeometry(cs * 0.94, cs * 0.08, cs * 0.94), blueMat);
  roof.position.set(0, cs * 0.69, 0);
  group.add(roof);

  // Awning (striped) — 3 stripes
  const awningBase = new THREE.Mesh(new THREE.BoxGeometry(cs * 0.9, 0.06, cs * 0.22), blueMat);
  awningBase.position.set(0, cs * 0.55, cs * 0.38);
  awningBase.rotation.x = -0.3;
  group.add(awningBase);

  for (let i = -1; i <= 1; i++) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.065, cs * 0.22), whiteMat);
    stripe.position.set(i * cs * 0.2, cs * 0.555, cs * 0.38);
    stripe.rotation.x = -0.3;
    group.add(stripe);
  }

  // Shop window (large glass)
  const win = new THREE.Mesh(new THREE.BoxGeometry(cs * 0.5, cs * 0.3, 0.04), glassMat);
  win.position.set(0, cs * 0.38, cs * 0.445);
  group.add(win);

  // Mannequin in window
  const mannBody = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.07), skinMat);
  mannBody.position.set(0, cs * 0.39, cs * 0.44);
  group.add(mannBody);

  const mannHead = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 6), skinMat);
  mannHead.position.set(0, cs * 0.49, cs * 0.44);
  group.add(mannHead);

  // "FASHION" sign above
  const signBack = new THREE.Mesh(new THREE.BoxGeometry(cs * 0.65, cs * 0.12, 0.04), blueMat);
  signBack.position.set(0, cs * 0.6, cs * 0.445);
  group.add(signBack);

  // Cloth hangers (small hooks on sides)
  for (const side of [-1, 1]) {
    const hanger = new THREE.Mesh(new THREE.BoxGeometry(0.04, cs * 0.12, 0.04), new THREE.MeshLambertMaterial({ color: '#888' }));
    hanger.position.set(side * cs * 0.35, cs * 0.48, cs * 0.44);
    group.add(hanger);
  }

  return group;
}

// ─────────────────────────────────────────────────────────────────────────────
// ✂️ BARBER SHOP  (with animated barber pole — pole mesh returned for animation)
// ─────────────────────────────────────────────────────────────────────────────
const _barberPoles: THREE.Mesh[] = [];

export function getBarberPoles(): THREE.Mesh[] { return _barberPoles; }

export function createBarbershopMesh(ctx: SimContext, x: number, z: number): THREE.Group {
  const group = new THREE.Group();
  const [wx, wz] = cellWorld(ctx, x, z);
  group.position.set(wx, 0, wz);

  const cs = 3.0;
  const whiteMat = new THREE.MeshLambertMaterial({ color: '#f8f8f8' });
  const redMat   = new THREE.MeshLambertMaterial({ color: '#d32f2f' });
  const blueMat  = new THREE.MeshLambertMaterial({ color: '#1565c0' });
  const darkMat  = new THREE.MeshLambertMaterial({ color: '#2a2a2a' });
  const glassMat = new THREE.MeshLambertMaterial({ color: '#b3e5fc', transparent: true, opacity: 0.5 });

  // Main body
  const body = new THREE.Mesh(new THREE.BoxGeometry(cs * 0.88, cs * 0.65, cs * 0.88), whiteMat);
  body.position.set(0, cs * 0.325, 0);
  body.castShadow = true; body.receiveShadow = true;
  group.add(body);

  // Red/white roof stripe
  const roofBase = new THREE.Mesh(new THREE.BoxGeometry(cs * 0.94, cs * 0.08, cs * 0.94), redMat);
  roofBase.position.set(0, cs * 0.69, 0);
  group.add(roofBase);

  for (let i = -1; i <= 1; i++) {
    const roofStripe = new THREE.Mesh(new THREE.BoxGeometry(cs * 0.27, cs * 0.085, cs * 0.94), whiteMat);
    roofStripe.position.set(i * cs * 0.27, cs * 0.695, 0);
    group.add(roofStripe);
  }

  // Front windows and door
  const win = new THREE.Mesh(new THREE.BoxGeometry(cs * 0.25, cs * 0.28, 0.04), glassMat);
  win.position.set(-cs * 0.22, cs * 0.38, cs * 0.445);
  group.add(win);

  const winR = win.clone();
  winR.position.set(cs * 0.22, cs * 0.38, cs * 0.445);
  group.add(winR);

  const door = new THREE.Mesh(new THREE.BoxGeometry(cs * 0.18, cs * 0.28, 0.04), darkMat);
  door.position.set(0, cs * 0.14, cs * 0.445);
  group.add(door);

  // "BARBER" sign
  const signBack = new THREE.Mesh(new THREE.BoxGeometry(cs * 0.6, cs * 0.1, 0.04), blueMat);
  signBack.position.set(0, cs * 0.6, cs * 0.445);
  group.add(signBack);

  // ── Barber Pole (animated) ──────────────────────────────────────────────
  const poleGroup = new THREE.Group();
  poleGroup.position.set(cs * 0.38, 0, cs * 0.38);

  const poleCylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, cs * 0.7, 12),
    whiteMat
  );
  poleCylinder.position.y = cs * 0.35;
  poleCylinder.castShadow = true;
  poleGroup.add(poleCylinder);

  // Red spiral stripe (approximated with tilted thin discs)
  const spiralRedMat = new THREE.MeshLambertMaterial({ color: '#d32f2f' });
  const spiralBlueMat = new THREE.MeshLambertMaterial({ color: '#1a69c4' });

  const stripeGeom = new THREE.TorusGeometry(0.055, 0.018, 8, 20, Math.PI * 0.6);
  for (let i = 0; i < 5; i++) {
    const stripe = new THREE.Mesh(stripeGeom, i % 2 === 0 ? spiralRedMat : spiralBlueMat);
    stripe.position.y = cs * 0.15 + i * cs * 0.1;
    stripe.rotation.x = Math.PI / 2;
    stripe.rotation.y = i * (Math.PI * 0.7);
    poleGroup.add(stripe);
  }

  // Globe top
  const glob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), whiteMat);
  glob.position.y = cs * 0.72;
  poleGroup.add(glob);

  group.add(poleGroup);

  // Store reference for animation
  _barberPoles.push(poleCylinder);

  return group;
}

// ─────────────────────────────────────────────────────────────────────────────
// 🚔 POLICE STATION  (with blinking blue light)
// ─────────────────────────────────────────────────────────────────────────────
export interface PoliceStationRefs {
  blinkLight: THREE.PointLight;
  blinkMesh: THREE.Mesh;
}

const _policeRefs: PoliceStationRefs[] = [];
export function getPoliceRefs(): PoliceStationRefs[] { return _policeRefs; }

export function createPoliceStationMesh(ctx: SimContext, x: number, z: number): THREE.Group {
  const group = new THREE.Group();
  const [wx, wz] = cellWorld(ctx, x, z);
  group.position.set(wx, 0, wz);

  const cs = 3.0;
  const navyMat  = new THREE.MeshLambertMaterial({ color: '#1a237e' });
  const midMat   = new THREE.MeshLambertMaterial({ color: '#283593' });
  const whiteMat = new THREE.MeshLambertMaterial({ color: '#eceff1' });
  const darkMat  = new THREE.MeshLambertMaterial({ color: '#0d1117' });
  const glassMat = new THREE.MeshLambertMaterial({ color: '#90caf9', transparent: true, opacity: 0.5 });

  // Main building
  const body = new THREE.Mesh(new THREE.BoxGeometry(cs * 0.88, cs * 0.8, cs * 0.88), midMat);
  body.position.set(0, cs * 0.4, 0);
  body.castShadow = true; body.receiveShadow = true;
  group.add(body);

  // Flat roof
  const roof = new THREE.Mesh(new THREE.BoxGeometry(cs * 0.96, cs * 0.06, cs * 0.96), navyMat);
  roof.position.set(0, cs * 0.83, 0);
  group.add(roof);

  // White horizontal band (police stripe)
  const band = new THREE.Mesh(new THREE.BoxGeometry(cs * 0.88, cs * 0.08, cs * 0.88), whiteMat);
  band.position.set(0, cs * 0.45, 0);
  group.add(band);

  // Columns on front
  for (let cx = -1; cx <= 1; cx += 2) {
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.08, cs * 0.8, 0.08), whiteMat);
    col.position.set(cx * cs * 0.38, cs * 0.4, cs * 0.44);
    col.castShadow = true;
    group.add(col);
  }

  // Windows
  const win = new THREE.Mesh(new THREE.BoxGeometry(cs * 0.22, cs * 0.2, 0.04), glassMat);
  win.position.set(-cs * 0.24, cs * 0.55, cs * 0.445);
  group.add(win);

  const winR = win.clone();
  winR.position.set(cs * 0.24, cs * 0.55, cs * 0.445);
  group.add(winR);

  // Door (tall)
  const door = new THREE.Mesh(new THREE.BoxGeometry(cs * 0.18, cs * 0.35, 0.04), darkMat);
  door.position.set(0, cs * 0.175, cs * 0.445);
  group.add(door);

  // "POLICE" sign plate
  const signPlate = new THREE.Mesh(new THREE.BoxGeometry(cs * 0.55, cs * 0.1, 0.05), navyMat);
  signPlate.position.set(0, cs * 0.72, cs * 0.445);
  group.add(signPlate);

  // Badge emblem (star shape — simplified as concentric cylinders)
  const badgeMat = new THREE.MeshLambertMaterial({ color: '#ffd54f' });
  const badge = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 6), badgeMat);
  badge.position.set(0, cs * 0.57, cs * 0.445);
  badge.rotation.y = Math.PI / 6;
  group.add(badge);

  // ── Blue emergency light on roof ──────────────────────────────────────────
  const lightBase = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 8), darkMat);
  lightBase.position.set(0, cs * 0.88, 0);
  group.add(lightBase);

  const blinkMeshMat = new THREE.MeshLambertMaterial({
    color: '#2196f3',
    emissive: '#2196f3',
    emissiveIntensity: 2.0,
    transparent: true,
    opacity: 0.9,
  });
  const blinkMesh = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), blinkMeshMat);
  blinkMesh.position.set(0, cs * 0.95, 0);
  group.add(blinkMesh);

  const blinkLight = new THREE.PointLight('#2255ff', 2.5, 8.0);
  blinkLight.position.set(0, cs * 0.95, 0);
  group.add(blinkLight);

  _policeRefs.push({ blinkLight, blinkMesh });

  return group;
}
