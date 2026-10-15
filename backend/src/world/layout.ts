// Deterministic base layout of the shared city.
//
// Every client used to generate its own random 200x200 city, so players saw
// different worlds. The server now generates the layout once from a fixed seed
// and sends it to clients; the database only stores cells that changed since
// (player builds, demolitions, construction sites).

export const WORLD_SIZE = 200;
export const WORLD_SEED = 20261015;
/** World units per cell; must match ThreeCity.cellSize. */
export const WORLD_CELL_SIZE = 2.25;

/** One character per cell type in the layout string sent to clients. */
export const CELL_CODES: Record<string, string> = {
  empty: ".",
  road: "r",
  tree: "t",
  house: "h",
  skyscraper: "s",
  restaurant: "R",
  clothshop: "c",
  barbershop: "b",
  policestation: "p",
  park: "P",
};

type ShopType = "restaurant" | "clothshop" | "barbershop" | "policestation";
type PlaceType = "road" | "house" | "skyscraper" | "tree" | ShopType;

/** mulberry32: small, fast, deterministic PRNG. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Same square as getParkCells() in frontend CentralPark.ts. */
export function isParkCell(x: number, z: number, size = WORLD_SIZE): boolean {
  const center = Math.floor(size / 2);
  const r = 9;
  return x >= center - r && x < center + r && z >= center - r && z < center + r;
}

function generate(size: number, seed: number): string[] {
  const rand = mulberry32(seed);
  const gs = size;
  const ctr = Math.floor(gs / 2);
  const pr = 9;
  const cells: string[] = new Array(gs * gs).fill("empty");
  const idx = (x: number, z: number) => x * gs + z;

  for (let x = 0; x < gs; x++) {
    for (let z = 0; z < gs; z++) {
      if (isParkCell(x, z, gs)) cells[idx(x, z)] = "park";
    }
  }

  const isAvail = (x: number, z: number) =>
    x >= 2 && z >= 2 && x < gs - 2 && z < gs - 2 && cells[idx(x, z)] === "empty";
  const place = (x: number, z: number, type: PlaceType) => {
    if (isAvail(x, z)) cells[idx(x, z)] = type;
  };
  const fillBlock = (x1: number, z1: number, x2: number, z2: number, type: PlaceType, density = 0.6) => {
    for (let x = x1; x <= x2; x++) {
      for (let z = z1; z <= z2; z++) {
        if (rand() < density) place(x, z, type);
      }
    }
  };

  // Road network: avenue grid every 20 cells, main cross, park ring, perimeter
  const AVE = 20;
  for (let r = AVE; r < gs - 2; r += AVE) {
    for (let i = 2; i < gs - 2; i++) {
      place(r, i, "road");
      place(i, r, "road");
    }
  }
  for (let i = 2; i < gs - 2; i++) {
    place(ctr, i, "road");
    place(i, ctr, "road");
  }
  for (let x = ctr - pr - 1; x <= ctr + pr; x++) {
    place(x, ctr - pr - 1, "road");
    place(x, ctr + pr, "road");
  }
  for (let z = ctr - pr - 1; z <= ctr + pr; z++) {
    place(ctr - pr - 1, z, "road");
    place(ctr + pr, z, "road");
  }
  for (let i = 3; i < gs - 3; i++) {
    place(3, i, "road");
    place(gs - 4, i, "road");
    place(i, 3, "road");
    place(i, gs - 4, "road");
  }

  // Downtown skyscrapers ring the central park
  fillBlock(ctr - pr - 8, ctr - pr - 8, ctr - pr - 2, ctr - pr - 2, "skyscraper", 0.7);
  fillBlock(ctr + pr + 2, ctr - pr - 8, ctr + pr + 8, ctr - pr - 2, "skyscraper", 0.7);
  fillBlock(ctr - pr - 8, ctr + pr + 2, ctr - pr - 2, ctr + pr + 8, "skyscraper", 0.7);
  fillBlock(ctr + pr + 2, ctr + pr + 2, ctr + pr + 8, ctr + pr + 8, "skyscraper", 0.7);

  // Commercial strip along the central avenues
  const shopTypes: ShopType[] = ["restaurant", "clothshop", "barbershop", "policestation"];
  let si = 0;
  for (let x = AVE + 2; x < gs - AVE - 2; x += 5) {
    if (Math.abs(x - ctr) <= pr + 12) continue;
    place(x, ctr - 2, shopTypes[si % 4]);
    place(x, ctr + 2, shopTypes[(si + 2) % 4]);
    si++;
  }
  si = 0;
  for (let z = AVE + 2; z < gs - AVE - 2; z += 5) {
    if (Math.abs(z - ctr) <= pr + 12) continue;
    place(ctr - 2, z, shopTypes[(si + 1) % 4]);
    place(ctr + 2, z, shopTypes[(si + 3) % 4]);
    si++;
  }

  const residentialBlock = (bx: number, bz: number, density: number) => {
    fillBlock(bx + 1, bz + 1, bx + AVE - 2, bz + 3, "house", density);
    fillBlock(bx + 1, bz + AVE - 4, bx + AVE - 2, bz + AVE - 2, "house", density);
    fillBlock(bx + 1, bz + 4, bx + 3, bz + AVE - 5, "house", density);
    fillBlock(bx + AVE - 4, bz + 4, bx + AVE - 2, bz + AVE - 5, "house", density);
  };

  // NW residential
  for (let bx = 4; bx < ctr - pr - 12; bx += AVE) {
    for (let bz = 4; bz < ctr - pr - 12; bz += AVE) {
      residentialBlock(bx, bz, 0.85);
      fillBlock(bx + 4, bz + 4, bx + AVE - 5, bz + AVE - 5, "tree", 0.35);
    }
  }
  // NE residential
  for (let bx = ctr + pr + 12; bx < gs - 6; bx += AVE) {
    for (let bz = 4; bz < ctr - pr - 12; bz += AVE) {
      residentialBlock(bx, bz, 0.85);
      fillBlock(bx + 4, bz + 4, bx + AVE - 5, bz + AVE - 5, "tree", 0.35);
    }
  }
  // SW mixed: houses with occasional shops
  for (let bx = 4; bx < ctr - pr - 12; bx += AVE) {
    for (let bz = ctr + pr + 12; bz < gs - 6; bz += AVE) {
      residentialBlock(bx, bz, 0.8);
      if (rand() < 0.4) place(bx + 1, bz + 1, "barbershop");
      if (rand() < 0.3) place(bx + AVE - 3, bz + 1, "restaurant");
      fillBlock(bx + 4, bz + 4, bx + AVE - 5, bz + AVE - 5, "tree", 0.3);
    }
  }
  // SE commercial: skyscrapers and shops
  for (let bx = ctr + pr + 12; bx < gs - 6; bx += AVE) {
    for (let bz = ctr + pr + 12; bz < gs - 6; bz += AVE) {
      fillBlock(bx + 1, bz + 1, bx + AVE - 2, bz + AVE - 2, "skyscraper", 0.45);
      if (rand() < 0.5) place(bx + 1, bz + 1, "clothshop");
      if (rand() < 0.5) place(bx + AVE - 3, bz + AVE - 3, "policestation");
      fillBlock(bx + 5, bz + 5, bx + AVE - 6, bz + AVE - 6, "tree", 0.2);
    }
  }

  // Guaranteed shop corners at 8 positions across the map
  const shopCorners = [
    [AVE + 2, AVE + 2], [gs - AVE - 5, AVE + 2],
    [AVE + 2, gs - AVE - 5], [gs - AVE - 5, gs - AVE - 5],
    [ctr - 30, AVE + 2], [ctr + 28, AVE + 2],
    [ctr - 30, gs - AVE - 5], [ctr + 28, gs - AVE - 5],
  ];
  shopCorners.forEach(([sx, sz], i) => {
    place(sx, sz, shopTypes[i % 4]);
    place(sx + 2, sz, shopTypes[(i + 1) % 4]);
    place(sx, sz + 2, shopTypes[(i + 2) % 4]);
  });

  // Tree boulevards alongside each avenue, then scattered trees
  for (let r = AVE; r < gs - 2; r += AVE) {
    for (let i = 4; i < gs - 4; i += 3) {
      place(r - 1, i, "tree");
      place(r + 1, i, "tree");
      place(i, r - 1, "tree");
      place(i, r + 1, "tree");
    }
  }
  for (let i = 0; i < 200; i++) {
    const tx = 4 + Math.floor(rand() * (gs - 8));
    const tz = 4 + Math.floor(rand() * (gs - 8));
    place(tx, tz, "tree");
  }

  return cells;
}

const baseCells = generate(WORLD_SIZE, WORLD_SEED);

/** Compact layout for clients: one character per cell, index = x * size + z. */
export const baseLayoutString = baseCells.map((t) => CELL_CODES[t]).join("");

export function baseCellType(x: number, z: number): string {
  return baseCells[x * WORLD_SIZE + z];
}

export function inWorld(x: number, z: number): boolean {
  return Number.isInteger(x) && Number.isInteger(z) && x >= 0 && z >= 0 && x < WORLD_SIZE && z < WORLD_SIZE;
}

/** Grid cell containing a world-space position (same maths as the client). */
export function worldToCell(wx: number, wz: number): { x: number; z: number } {
  const half = (WORLD_SIZE * WORLD_CELL_SIZE) / 2;
  return {
    x: Math.floor((wx + half) / WORLD_CELL_SIZE),
    z: Math.floor((wz + half) / WORLD_CELL_SIZE),
  };
}
