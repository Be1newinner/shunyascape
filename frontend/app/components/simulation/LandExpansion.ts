import * as THREE from 'three';
import { GridCell } from './Types';

export const PLOT_COST_RING1 = 500;  // N/S/E/W
export const PLOT_COST_RING2 = 800;  // diagonal
export const PLOT_COST_RING3 = 1200; // further expansion
export const PLOT_SIZE = 8;          // each plot is 8x8 grid cells

export type PlotDirection =
  | 'north' | 'south' | 'east' | 'west'
  | 'northeast' | 'northwest' | 'southeast' | 'southwest';

export interface LandPlot {
  id: string;
  direction: PlotDirection;
  ring: number;
  startX: number; // grid cell indices
  startZ: number;
  endX: number;   // inclusive
  endZ: number;   // inclusive
  purchased: boolean;
  cost: number;
}

export interface ExpansionState {
  currentGridSize: number;   // always square
  northExpansions: number;
  southExpansions: number;
  eastExpansions: number;
  westExpansions: number;
}

export class LandExpansionManager {
  private state: ExpansionState;
  private purchasedIds = new Set<string>();

  constructor(initialGridSize: number = 32) {
    this.state = {
      currentGridSize: initialGridSize,
      northExpansions: 0,
      southExpansions: 0,
      eastExpansions: 0,
      westExpansions: 0,
    };
  }

  getState(): Readonly<ExpansionState> {
    return { ...this.state };
  }

  /**
   * Returns the list of plots available for purchase.
   * We offer the next ring in each cardinal direction.
   */
  getAvailablePlots(): LandPlot[] {
    const gs = this.state.currentGridSize;
    const plots: LandPlot[] = [];

    // North (negative Z direction — new rows above z=0)
    const nRing = this.state.northExpansions + 1;
    plots.push({
      id: `north_${nRing}`,
      direction: 'north',
      ring: nRing,
      startX: 0,
      startZ: -nRing * PLOT_SIZE,
      endX: gs - 1,
      endZ: -((nRing - 1) * PLOT_SIZE) - 1,
      purchased: false,
      cost: _plotCost(nRing),
    });

    // South
    const sRing = this.state.southExpansions + 1;
    plots.push({
      id: `south_${sRing}`,
      direction: 'south',
      ring: sRing,
      startX: 0,
      startZ: gs + (sRing - 1) * PLOT_SIZE,
      endX: gs - 1,
      endZ: gs + sRing * PLOT_SIZE - 1,
      purchased: false,
      cost: _plotCost(sRing),
    });

    // East
    const eRing = this.state.eastExpansions + 1;
    plots.push({
      id: `east_${eRing}`,
      direction: 'east',
      ring: eRing,
      startX: gs + (eRing - 1) * PLOT_SIZE,
      startZ: 0,
      endX: gs + eRing * PLOT_SIZE - 1,
      endZ: gs - 1,
      purchased: false,
      cost: _plotCost(eRing),
    });

    // West
    const wRing = this.state.westExpansions + 1;
    plots.push({
      id: `west_${wRing}`,
      direction: 'west',
      ring: wRing,
      startX: -wRing * PLOT_SIZE,
      startZ: 0,
      endX: -((wRing - 1) * PLOT_SIZE) - 1,
      endZ: gs - 1,
      purchased: false,
      cost: _plotCost(wRing),
    });

    return plots.filter(p => !this.purchasedIds.has(p.id));
  }

  /**
   * Records a purchase and returns the new grid cells to add.
   * Returns null if not valid or already purchased.
   */
  purchase(plotId: string): {
    newCells: GridCell[];
    newGridCols: number;
    newGridRows: number;
    offsetX: number; // shift of existing grid origin in new space
    offsetZ: number;
  } | null {
    const available = this.getAvailablePlots();
    const plot = available.find(p => p.id === plotId);
    if (!plot) return null;

    this.purchasedIds.add(plotId);

    const direction = plot.direction;
    const newCells: GridCell[] = [];

    let newGridCols = this.state.currentGridSize;
    let newGridRows = this.state.currentGridSize;
    let offsetX = 0;
    let offsetZ = 0;

    if (direction === 'north') {
      this.state.northExpansions++;
      newGridRows += PLOT_SIZE;
      offsetZ = PLOT_SIZE; // existing grid shifts south by PLOT_SIZE in new coord
    } else if (direction === 'south') {
      this.state.southExpansions++;
      newGridRows += PLOT_SIZE;
      // no offset — new rows append after existing
    } else if (direction === 'east') {
      this.state.eastExpansions++;
      newGridCols += PLOT_SIZE;
    } else if (direction === 'west') {
      this.state.westExpansions++;
      newGridCols += PLOT_SIZE;
      offsetX = PLOT_SIZE;
    }

    // Generate new cell objects for expanded region
    for (let x = 0; x < newGridCols; x++) {
      for (let z = 0; z < newGridRows; z++) {
        // Only generate cells in the new area (not existing ones)
        const inOldX = x >= offsetX && x < offsetX + (direction === 'east' || direction === 'west' ? this.state.currentGridSize - (direction === 'east' ? PLOT_SIZE : PLOT_SIZE) : this.state.currentGridSize);
        const inOldZ = z >= offsetZ && z < offsetZ + (direction === 'north' || direction === 'south' ? this.state.currentGridSize - (direction === 'south' ? PLOT_SIZE : PLOT_SIZE) : this.state.currentGridSize);
        if (inOldX && inOldZ) continue; // old cell — skip

        newCells.push({
          x,
          z,
          type: 'empty',
          mesh: null,
          constructionProgress: 0,
          targetType: 'empty',
          height: 0,
          id: `cell_${x}_${z}`,
        });
      }
    }

    return { newCells, newGridCols, newGridRows, offsetX, offsetZ };
  }

  /** Returns direction label for UI */
  static directionLabel(dir: PlotDirection): string {
    const labels: Record<PlotDirection, string> = {
      north: '↑ North',
      south: '↓ South',
      east: '→ East',
      west: '← West',
      northeast: '↗ NE',
      northwest: '↖ NW',
      southeast: '↘ SE',
      southwest: '↙ SW',
    };
    return labels[dir] ?? dir;
  }
}

function _plotCost(ring: number): number {
  if (ring === 1) return PLOT_COST_RING1;
  if (ring === 2) return PLOT_COST_RING2;
  return PLOT_COST_RING3 + (ring - 3) * 400;
}
