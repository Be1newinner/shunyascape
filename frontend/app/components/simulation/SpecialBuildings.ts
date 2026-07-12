import * as THREE from 'three';
import { SimContext } from './Types';

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

function cellWorld(ctx: SimContext, x: number, z: number): [number, number] {
  const halfGrid = (ctx.gridSize * ctx.cellSize) / 2;
  return [
    x * ctx.cellSize - halfGrid + ctx.cellSize / 2,
    z * ctx.cellSize - halfGrid + ctx.cellSize / 2,
  ];
}

/** Billboard sign: coloured panel with a raised text strip */
function makeSign(
  g: THREE.Group,
  w: number, h: number, d: number,
  px: number, py: number, pz: number,
  panelColor: string,
  textColor: string,
): void {
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color: panelColor }),
  );
  panel.position.set(px, py, pz);
  g.add(panel);

  // Raised letter strip (contrasting colour)
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.85, h * 0.45, d + 0.01),
    new THREE.MeshLambertMaterial({ color: textColor, emissive: textColor, emissiveIntensity: 0.15 }),
  );
  strip.position.set(px, py + h * 0.02, pz);
  g.add(strip);
}

/** Neon tube ring / border glow (emissive cylinder) */
function neonTrim(
  g: THREE.Group,
  r: number, tubeR: number, py: number,
  color: string,
): void {
  const mat = new THREE.MeshLambertMaterial({
    color,
    emissive: color,
    emissiveIntensity: 1.4,
  });
  const geom = new THREE.TorusGeometry(r, tubeR, 6, 20);
  const mesh = new THREE.Mesh(geom, mat);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.y = py;
  g.add(mesh);
}

// ─────────────────────────────────────────────────────────────────────────────
// 🍔 RESTAURANT  — Fast-food diner, bold red + yellow, large neon sign
// ─────────────────────────────────────────────────────────────────────────────
export function createRestaurantMesh(ctx: SimContext, x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  const [wx, wz] = cellWorld(ctx, x, z);
  g.position.set(wx, 0, wz);
  const cs = ctx.cellSize;

  // ── Structure ──────────────────────────────────────────────────────────────
  const redMat    = new THREE.MeshLambertMaterial({ color: '#cc1a1a' });
  const yellowMat = new THREE.MeshLambertMaterial({ color: '#ffcc00' });
  const whiteMat  = new THREE.MeshLambertMaterial({ color: '#f5f5f5' });
  const glassMat  = new THREE.MeshLambertMaterial({ color: '#90caf9', transparent: true, opacity: 0.55 });
  const darkMat   = new THREE.MeshLambertMaterial({ color: '#1a1a1a' });

  // Main body — bold red
  const body = new THREE.Mesh(new THREE.BoxGeometry(cs * 0.88, cs * 0.72, cs * 0.88), redMat);
  body.position.set(0, cs * 0.36, 0);
  body.castShadow = true; body.receiveShadow = true;
  g.add(body);

  // White band at mid-height (restaurant stripe)
  const band = new THREE.Mesh(new THREE.BoxGeometry(cs * 0.89, cs * 0.09, cs * 0.89), whiteMat);
  band.position.set(0, cs * 0.46, 0);
  g.add(band);

  // Flat roof with yellow trim
  const roof = new THREE.Mesh(new THREE.BoxGeometry(cs * 0.95, cs * 0.07, cs * 0.95), yellowMat);
  roof.position.set(0, cs * 0.755, 0);
  roof.castShadow = true;
  g.add(roof);

  // Roof overhang (extended lip)
  const overhang = new THREE.Mesh(new THREE.BoxGeometry(cs * 1.02, cs * 0.04, cs * 1.02), yellowMat);
  overhang.position.set(0, cs * 0.74, 0);
  g.add(overhang);

  // ── Storefront glass (large window) ───────────────────────────────────────
  const bigWin = new THREE.Mesh(new THREE.BoxGeometry(cs * 0.55, cs * 0.3, 0.04), glassMat);
  bigWin.position.set(0, cs * 0.38, cs * 0.445);
  g.add(bigWin);

  // Window frame
  const frameMat = new THREE.MeshLambertMaterial({ color: '#888888' });
  [[-cs * 0.27, 0], [cs * 0.27, 0]].forEach(([fx]) => {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.03, cs * 0.32, 0.06), frameMat);
    frame.position.set(fx, cs * 0.38, cs * 0.445);
    g.add(frame);
  });

  // Door (double glass)
  const door = new THREE.Mesh(new THREE.BoxGeometry(cs * 0.18, cs * 0.3, 0.04), glassMat);
  door.position.set(0, cs * 0.15, cs * 0.445);
  g.add(door);
  const doorHandle = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, 0.04), darkMat);
  doorHandle.position.set(0.06, cs * 0.15, cs * 0.465);
  g.add(doorHandle);

  // ── Golden arch sign on roof ───────────────────────────────────────────────
  const archMat = yellowMat;
  for (const side of [-1, 1]) {
    const arch = new THREE.Group();
    arch.position.set(side * cs * 0.14, cs * 0.82, cs * 0.05);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, cs * 0.3, 8), archMat);
    pole.position.y = cs * 0.05;
    arch.add(pole);

    for (let i = 0; i < 6; i++) {
      const t = i / 5;
      const ang = Math.PI * t;
      const ax  = Math.cos(ang) * 0.08 * side;
      const ay  = Math.sin(ang) * 0.1;
      const seg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.04), archMat);
      seg.position.set(ax, cs * 0.2 + ay, 0);
      arch.add(seg);
    }
    g.add(arch);
  }

  // Neon sign pole
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, cs * 0.35, 6), darkMat);
  pole.position.set(0, cs * 1.08, 0);
  g.add(pole);
  makeSign(g, cs * 0.38, cs * 0.14, 0.04, 0, cs * 1.28, 0, '#cc1a1a', '#ffcc00');

  // Red neon glow ring under roof
  neonTrim(g, cs * 0.44, 0.018, cs * 0.73, '#ff3300');

  return g;
}

// ─────────────────────────────────────────────────────────────────────────────
// 👕 CLOTH SHOP — Boutique, clean white + blue awning, mannequins in window
// ─────────────────────────────────────────────────────────────────────────────
export function createClothShopMesh(ctx: SimContext, x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  const [wx, wz] = cellWorld(ctx, x, z);
  g.position.set(wx, 0, wz);
  const cs = ctx.cellSize;

  const whiteMat   = new THREE.MeshLambertMaterial({ color: '#f8f8f8' });
  const blueMat    = new THREE.MeshLambertMaterial({ color: '#1565c0' });
  const creamMat   = new THREE.MeshLambertMaterial({ color: '#fffdf0' });
  const glassMat   = new THREE.MeshLambertMaterial({ color: '#b3e5fc', transparent: true, opacity: 0.55 });
  const goldMat    = new THREE.MeshStandardMaterial({ color: '#d4a843', metalness: 0.6, roughness: 0.3 });
  const skinMat    = new THREE.MeshLambertMaterial({ color: '#f1c27d' });
  const mannClothMat = new THREE.MeshLambertMaterial({ color: '#e53935' }); // red dress

  // Main body — cream white
  const body = new THREE.Mesh(new THREE.BoxGeometry(cs * 0.88, cs * 0.68, cs * 0.88), creamMat);
  body.position.set(0, cs * 0.34, 0);
  body.castShadow = true; body.receiveShadow = true;
  g.add(body);

  // Stone-effect lower plinth (darker base)
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(cs * 0.9, cs * 0.1, cs * 0.9),
    new THREE.MeshLambertMaterial({ color: '#d0cfc0' }));
  plinth.position.set(0, cs * 0.05, 0);
  g.add(plinth);

  // Flat roof
  const roof = new THREE.Mesh(new THREE.BoxGeometry(cs * 0.94, cs * 0.06, cs * 0.94), blueMat);
  roof.position.set(0, cs * 0.71, 0);
  roof.castShadow = true;
  g.add(roof);

  // Parapet edge on roof (raised border detail)
  const parapet = new THREE.Mesh(new THREE.BoxGeometry(cs * 0.96, cs * 0.08, cs * 0.96), whiteMat);
  parapet.position.set(0, cs * 0.78, 0);
  g.add(parapet);
  const parapetInner = new THREE.Mesh(new THREE.BoxGeometry(cs * 0.84, cs * 0.07, cs * 0.84), creamMat);
  parapetInner.position.set(0, cs * 0.785, 0);
  g.add(parapetInner);

  // ── Blue/white striped awning ──────────────────────────────────────────────
  const awningBase = new THREE.Mesh(new THREE.BoxGeometry(cs * 0.9, 0.06, cs * 0.22), blueMat);
  awningBase.position.set(0, cs * 0.57, cs * 0.36);
  awningBase.rotation.x = -0.28;
  g.add(awningBase);

  for (let i = -1; i <= 1; i++) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.065, cs * 0.22), whiteMat);
    stripe.position.set(i * cs * 0.2, cs * 0.575, cs * 0.36);
    stripe.rotation.x = -0.28;
    g.add(stripe);
  }

  // Awning fringe
  for (let i = -3; i <= 3; i++) {
    const fringe = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.02), blueMat);
    fringe.position.set(i * cs * 0.13, cs * 0.5, cs * 0.465);
    g.add(fringe);
  }

  // ── Large shop window ──────────────────────────────────────────────────────
  const win = new THREE.Mesh(new THREE.BoxGeometry(cs * 0.6, cs * 0.28, 0.04), glassMat);
  win.position.set(0, cs * 0.38, cs * 0.445);
  g.add(win);

  // Gold window frame border
  const wfTop = new THREE.Mesh(new THREE.BoxGeometry(cs * 0.63, 0.025, 0.05), goldMat);
  wfTop.position.set(0, cs * 0.525, cs * 0.444);
  g.add(wfTop);
  const wfBot = wfTop.clone(); wfBot.position.y = cs * 0.235; g.add(wfBot);

  // ── Two mannequins in window ───────────────────────────────────────────────
  for (const [sx, sc] of [[-0.18, '#e53935'], [0.18, '#6a1b9a']] as [number, string][]) {
    const cloth = new THREE.MeshLambertMaterial({ color: sc });
    // Body
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.07), cloth);
    torso.position.set(sx, cs * 0.38, cs * 0.44);
    g.add(torso);
    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 6), skinMat);
    head.position.set(sx, cs * 0.49, cs * 0.44);
    g.add(head);
    // Legs
    [-0.025, 0.025].forEach(lx => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.05), cloth);
      leg.position.set(sx + lx, cs * 0.25, cs * 0.44);
      g.add(leg);
    });
  }

  // ── Boutique name sign ────────────────────────────────────────────────────
  makeSign(g, cs * 0.62, cs * 0.1, 0.04, 0, cs * 0.62, cs * 0.445, '#1565c0', '#ffffff');

  // Gold neon trim
  neonTrim(g, cs * 0.46, 0.014, cs * 0.68, '#d4a843');

  return g;
}

// ─────────────────────────────────────────────────────────────────────────────
// ✂️ BARBER SHOP — with animated pole + tiled awning + mirror window
// ─────────────────────────────────────────────────────────────────────────────
const _barberPoles: THREE.Mesh[] = [];
export function getBarberPoles(): THREE.Mesh[] { return _barberPoles; }

export function createBarbershopMesh(ctx: SimContext, x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  const [wx, wz] = cellWorld(ctx, x, z);
  g.position.set(wx, 0, wz);
  const cs = ctx.cellSize;

  const whiteMat = new THREE.MeshLambertMaterial({ color: '#f8f8f8' });
  const redMat   = new THREE.MeshLambertMaterial({ color: '#d32f2f' });
  const blueMat  = new THREE.MeshLambertMaterial({ color: '#1565c0' });
  const darkMat  = new THREE.MeshLambertMaterial({ color: '#2a2a2a' });
  const glassMat = new THREE.MeshLambertMaterial({ color: '#b3e5fc', transparent: true, opacity: 0.5 });
  const tileMat  = new THREE.MeshLambertMaterial({ color: '#e8e8e8' });

  // Main body — bright white barbershop look
  const body = new THREE.Mesh(new THREE.BoxGeometry(cs * 0.88, cs * 0.68, cs * 0.88), whiteMat);
  body.position.set(0, cs * 0.34, 0);
  body.castShadow = true; body.receiveShadow = true;
  g.add(body);

  // Tiled lower facade (checkered pattern impression)
  const lower = new THREE.Mesh(new THREE.BoxGeometry(cs * 0.89, cs * 0.14, cs * 0.89), tileMat);
  lower.position.set(0, cs * 0.07, 0);
  g.add(lower);

  // Red-striped roof
  const roofBase = new THREE.Mesh(new THREE.BoxGeometry(cs * 0.95, cs * 0.07, cs * 0.95), redMat);
  roofBase.position.set(0, cs * 0.715, 0);
  g.add(roofBase);
  // White stripes on roof
  for (let i = -1; i <= 1; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(cs * 0.27, cs * 0.075, cs * 0.95), whiteMat);
    s.position.set(i * cs * 0.27, cs * 0.72, 0);
    g.add(s);
  }
  // Blue roof border
  const roofBorder = new THREE.Mesh(new THREE.BoxGeometry(cs * 0.97, cs * 0.04, cs * 0.97), blueMat);
  roofBorder.position.set(0, cs * 0.755, 0);
  g.add(roofBorder);

  // ── Storefront: mirror-effect windows ─────────────────────────────────────
  const mirrorMat = new THREE.MeshLambertMaterial({ color: '#c5e8f7', transparent: true, opacity: 0.7 });
  const winL = new THREE.Mesh(new THREE.BoxGeometry(cs * 0.24, cs * 0.28, 0.04), mirrorMat);
  winL.position.set(-cs * 0.22, cs * 0.38, cs * 0.445);
  g.add(winL);
  const winR = winL.clone(); winR.position.x = cs * 0.22; g.add(winR);

  // Scissors icon cutout impression above windows
  const scissors = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.04),
    new THREE.MeshStandardMaterial({ color: '#cccccc', metalness: 0.8, roughness: 0.3 }));
  scissors.position.set(0, cs * 0.55, cs * 0.445);
  g.add(scissors);

  // Door
  const door = new THREE.Mesh(new THREE.BoxGeometry(cs * 0.18, cs * 0.3, 0.04), glassMat);
  door.position.set(0, cs * 0.15, cs * 0.445);
  g.add(door);

  // "BARBER" neon sign
  makeSign(g, cs * 0.6, cs * 0.1, 0.04, 0, cs * 0.615, cs * 0.445, '#1565c0', '#ffffff');

  // ── Animated Barber Pole ──────────────────────────────────────────────────
  const poleGroup = new THREE.Group();
  poleGroup.position.set(cs * 0.37, 0, cs * 0.37);

  // Base post
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.15, 8),
    new THREE.MeshLambertMaterial({ color: '#888888' }));
  base.position.y = 0.075;
  poleGroup.add(base);

  // White pole cylinder
  const poleCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, cs * 0.7, 12), whiteMat);
  poleCyl.position.y = cs * 0.35;
  poleCyl.castShadow = true;
  poleGroup.add(poleCyl);

  // Red + blue spiral stripes
  const stripeGeom = new THREE.TorusGeometry(0.055, 0.018, 8, 20, Math.PI * 0.6);
  for (let i = 0; i < 6; i++) {
    const mat = i % 2 === 0
      ? new THREE.MeshLambertMaterial({ color: '#d32f2f' })
      : new THREE.MeshLambertMaterial({ color: '#1a69c4' });
    const stripe = new THREE.Mesh(stripeGeom, mat);
    stripe.position.y = cs * 0.1 + i * cs * 0.09;
    stripe.rotation.x = Math.PI / 2;
    stripe.rotation.y = i * (Math.PI * 0.7);
    poleGroup.add(stripe);
  }

  // Sphere cap
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), whiteMat);
  cap.position.y = cs * 0.72;
  poleGroup.add(cap);

  // Neon ring at top
  neonTrim(poleGroup, 0.08, 0.012, cs * 0.72, '#ff3300');

  g.add(poleGroup);
  _barberPoles.push(poleCyl);

  return g;
}

// ─────────────────────────────────────────────────────────────────────────────
// 🚔 POLICE STATION — imposing navy + stone, columns, blinking emergency light
// ─────────────────────────────────────────────────────────────────────────────
export interface PoliceStationRefs {
  blinkLight: THREE.PointLight;
  blinkMesh: THREE.Mesh;
}
const _policeRefs: PoliceStationRefs[] = [];
export function getPoliceRefs(): PoliceStationRefs[] { return _policeRefs; }

export function createPoliceStationMesh(ctx: SimContext, x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  const [wx, wz] = cellWorld(ctx, x, z);
  g.position.set(wx, 0, wz);
  const cs = ctx.cellSize;

  const navyMat   = new THREE.MeshLambertMaterial({ color: '#0d1b4b' });
  const midMat    = new THREE.MeshLambertMaterial({ color: '#1a237e' });
  const stoneMat  = new THREE.MeshLambertMaterial({ color: '#c8c0b0' });
  const whiteMat  = new THREE.MeshLambertMaterial({ color: '#eceff1' });
  const darkMat   = new THREE.MeshLambertMaterial({ color: '#0d1117' });
  const glassMat  = new THREE.MeshLambertMaterial({ color: '#90caf9', transparent: true, opacity: 0.5 });
  const goldMat   = new THREE.MeshStandardMaterial({ color: '#c8a840', metalness: 0.6, roughness: 0.3 });
  const badgeMat  = new THREE.MeshLambertMaterial({ color: '#ffd54f' });

  // ── Stone foundation ───────────────────────────────────────────────────────
  const foundation = new THREE.Mesh(new THREE.BoxGeometry(cs * 0.96, cs * 0.12, cs * 0.96), stoneMat);
  foundation.position.set(0, cs * 0.06, 0);
  foundation.castShadow = true; foundation.receiveShadow = true;
  g.add(foundation);

  // ── Main building body (navy) ─────────────────────────────────────────────
  const body = new THREE.Mesh(new THREE.BoxGeometry(cs * 0.88, cs * 0.78, cs * 0.88), midMat);
  body.position.set(0, cs * 0.51, 0);
  body.castShadow = true; body.receiveShadow = true;
  g.add(body);

  // Stone horizontal band (authority stripe)
  const band = new THREE.Mesh(new THREE.BoxGeometry(cs * 0.9, cs * 0.1, cs * 0.9), stoneMat);
  band.position.set(0, cs * 0.48, 0);
  g.add(band);

  // ── Flat roof with parapet ────────────────────────────────────────────────
  const roof = new THREE.Mesh(new THREE.BoxGeometry(cs * 0.98, cs * 0.07, cs * 0.98), navyMat);
  roof.position.set(0, cs * 0.935, 0);
  roof.castShadow = true;
  g.add(roof);
  const parapet = new THREE.Mesh(new THREE.BoxGeometry(cs * 1.0, cs * 0.1, cs * 1.0), stoneMat);
  parapet.position.set(0, cs * 0.975, 0);
  g.add(parapet);
  const parapetCap = new THREE.Mesh(new THREE.BoxGeometry(cs * 1.02, cs * 0.03, cs * 1.02), navyMat);
  parapetCap.position.set(0, cs * 1.03, 0);
  g.add(parapetCap);

  // ── Front columns (4, classical pillar look) ──────────────────────────────
  const colPositions = [-cs * 0.3, -cs * 0.1, cs * 0.1, cs * 0.3];
  colPositions.forEach(cx2 => {
    // Fluted column shaft
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, cs * 0.82, 8), stoneMat);
    shaft.position.set(cx2, cs * 0.53, cs * 0.44);
    shaft.castShadow = true;
    g.add(shaft);
    // Column capital (top)
    const capital = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.06, 0.12), stoneMat);
    capital.position.set(cx2, cs * 0.95, cs * 0.44);
    g.add(capital);
    // Column base
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.06, 0.12), stoneMat);
    base.position.set(cx2, cs * 0.14, cs * 0.44);
    g.add(base);
  });

  // Horizontal entablature beam above columns
  const entablature = new THREE.Mesh(new THREE.BoxGeometry(cs * 0.78, cs * 0.07, 0.13), stoneMat);
  entablature.position.set(0, cs * 0.91, cs * 0.44);
  g.add(entablature);

  // ── Steps leading to door ─────────────────────────────────────────────────
  [0, 1, 2].forEach(i => {
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(cs * (0.5 - i * 0.06), 0.04, 0.08 * (i + 1) + 0.04),
      stoneMat
    );
    step.position.set(0, i * 0.04, cs * 0.445 + 0.04 * (i + 1));
    step.receiveShadow = true;
    g.add(step);
  });

  // ── Front windows ─────────────────────────────────────────────────────────
  const winPositions = [-cs * 0.2, cs * 0.2];
  winPositions.forEach(wx2 => {
    const win = new THREE.Mesh(new THREE.BoxGeometry(cs * 0.15, cs * 0.22, 0.04), glassMat);
    win.position.set(wx2, cs * 0.6, cs * 0.445);
    g.add(win);
    // Stone window surround
    const surround = new THREE.Mesh(new THREE.BoxGeometry(cs * 0.18, cs * 0.25, 0.03), stoneMat);
    surround.position.set(wx2, cs * 0.6, cs * 0.443);
    g.add(surround);
    const win2 = new THREE.Mesh(new THREE.BoxGeometry(cs * 0.13, cs * 0.20, 0.05), glassMat);
    win2.position.set(wx2, cs * 0.6, cs * 0.446);
    g.add(win2);
  });

  // ── Tall front door (double, arched top) ──────────────────────────────────
  const door = new THREE.Mesh(new THREE.BoxGeometry(cs * 0.2, cs * 0.38, 0.04), darkMat);
  door.position.set(0, cs * 0.19, cs * 0.445);
  g.add(door);
  // Arch above door
  const arch = new THREE.Mesh(new THREE.TorusGeometry(cs * 0.1, 0.025, 6, 12, Math.PI), stoneMat);
  arch.rotation.z = Math.PI;
  arch.position.set(0, cs * 0.38, cs * 0.445);
  g.add(arch);

  // ── "POLICE" sign plate ────────────────────────────────────────────────────
  makeSign(g, cs * 0.55, cs * 0.1, 0.05, 0, cs * 0.78, cs * 0.445, '#0d1b4b', '#eceff1');

  // ── Badge emblem (star) ───────────────────────────────────────────────────
  const badge = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.04, 6), badgeMat);
  badge.position.set(0, cs * 0.65, cs * 0.446);
  badge.rotation.y = Math.PI / 6;
  g.add(badge);
  const badgeInner = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.045, 5), goldMat);
  badgeInner.position.set(0, cs * 0.65, cs * 0.448);
  badgeInner.rotation.y = Math.PI / 5;
  g.add(badgeInner);

  // ── Emergency beacon light on roof ────────────────────────────────────────
  const lightBase = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.1, 8), darkMat);
  lightBase.position.set(0, cs * 1.05, 0);
  g.add(lightBase);

  const blinkMeshMat = new THREE.MeshLambertMaterial({
    color: '#2196f3',
    emissive: '#2196f3',
    emissiveIntensity: 2.5,
    transparent: true,
    opacity: 0.9,
  });
  const blinkMesh = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 8), blinkMeshMat);
  blinkMesh.position.set(0, cs * 1.12, 0);
  g.add(blinkMesh);

  const blinkLight = new THREE.PointLight('#2255ff', 3.0, 9.0);
  blinkLight.position.set(0, cs * 1.12, 0);
  g.add(blinkLight);

  _policeRefs.push({ blinkLight, blinkMesh });
  return g;
}
