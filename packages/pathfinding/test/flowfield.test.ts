import { describe, expect, it } from 'vitest';
import { computeFlowField, DEFAULT_MAX_CELLS, Grid } from '../src/index';

function grid(cols: number, rows: number): Grid {
  return new Grid({ cols, rows, cellSize: 1, origin: [0, 0] });
}

describe('Grid', () => {
  it('maps world <-> cells', () => {
    const g = new Grid({ cols: 4, rows: 4, cellSize: 2, origin: [0, 0] });
    expect(g.worldToCell(3, 5)).toEqual([1, 2]);
    expect(g.cellToWorld(1, 2)).toEqual([3, 5]);
  });
  it('treats out-of-bounds as blocked', () => {
    const g = grid(2, 2);
    expect(g.isBlocked(-1, 0)).toBe(true);
    expect(g.isBlocked(0, 0)).toBe(false);
  });
  it('rejects invalid dimensions before allocating storage', () => {
    expect(() => new Grid({ cols: 0, rows: 4, cellSize: 1 })).toThrow(/cols/);
    expect(() => new Grid({ cols: 4, rows: 4, cellSize: Number.NaN })).toThrow(/cellSize/);
  });
  it('caps cell count at a queryable size and says how to raise the limit', () => {
    // A 10,000x10,000 grid allocates fine but makes every query ~1.3 GB / minutes long.
    const huge = (): Grid => new Grid({ cols: 10_000, rows: 10_000, cellSize: 1 });
    expect(huge).toThrow(RangeError);
    expect(huge).toThrow(/100000000 cells exceeds the 4000000-cell limit/);
    expect(huge).toThrow(/pass maxCells to raise the limit/);

    // The default cap is inclusive, and it is what a grid reports when none was requested.
    const atCap = new Grid({ cols: 2000, rows: 2000, cellSize: 1 });
    expect(atCap.maxCells).toBe(DEFAULT_MAX_CELLS);

    // Beyond it, bigger grids are an explicit opt-in rather than a silent allocation.
    expect(() => new Grid({ cols: 3000, rows: 2000, cellSize: 1 })).toThrow(/maxCells/);
    const optedIn = new Grid({ cols: 3000, rows: 2000, cellSize: 1, maxCells: 6_000_000 });
    expect(optedIn.maxCells).toBe(6_000_000);
    expect(optedIn.isBlocked(2999, 1999)).toBe(false);
    expect(() => new Grid({ cols: 4, rows: 4, cellSize: 1, maxCells: 0 })).toThrow(/maxCells/);
  });
});

describe('computeFlowField', () => {
  it('points toward the goal on an open grid', () => {
    const g = grid(8, 8);
    const field = computeFlowField(g, g.cellToWorld(7, 7));
    // from cell (0,0), direction should head toward +x,+z (the goal corner)
    const [dx, dz] = field.directionAt(...g.cellToWorld(0, 0));
    expect(dx).toBeGreaterThan(0);
    expect(dz).toBeGreaterThan(0);
  });

  it('costs increase with distance from the goal', () => {
    const g = grid(10, 1);
    const field = computeFlowField(g, g.cellToWorld(0, 0));
    expect(field.cost[g.index(1, 0)]).toBeLessThan(field.cost[g.index(9, 0)] as number);
  });

  it('routes around a wall instead of through it', () => {
    const g = grid(7, 7);
    // vertical wall at cx=3 from cz=0..5, leaving a gap at the bottom (cz=6)
    for (let cz = 0; cz < 6; cz++) g.setBlocked(3, cz);
    const field = computeFlowField(g, g.cellToWorld(6, 0)); // goal on the right side
    // a unit at (2,0) (left of the wall, top) must NOT head straight +x into the wall;
    // it should be routed downward (+z) toward the gap.
    const [, dz] = field.directionAt(...g.cellToWorld(2, 0));
    expect(dz).toBeGreaterThan(0); // heads toward the gap, not into the wall
    // the wall cells themselves are unreachable
    expect(field.reachable(3, 2)).toBe(false);
  });

  it('marks fully walled-off regions unreachable', () => {
    const g = grid(5, 5);
    // box in a single cell at (4,4)
    g.setBlocked(3, 4);
    g.setBlocked(4, 3);
    const field = computeFlowField(g, g.cellToWorld(0, 0));
    expect(field.reachable(4, 4)).toBe(false);
    expect(field.directionAt(...g.cellToWorld(4, 4))).toEqual([0, 0]);
  });

  it('does not point diagonally through a blocked corner', () => {
    const g = grid(2, 2);
    g.setBlocked(1, 0);
    const field = computeFlowField(g, g.cellToWorld(1, 1));
    expect(field.directionAt(...g.cellToWorld(0, 0))).toEqual([0, 1]);
  });

  it('is deterministic', () => {
    const build = (): Float32Array => {
      const g = grid(12, 12);
      g.setBlocked(5, 5);
      g.setBlocked(5, 6);
      g.setBlocked(6, 5);
      return computeFlowField(g, g.cellToWorld(11, 11)).cost;
    };
    expect(Array.from(build())).toEqual(Array.from(build()));
  });

  it('returns an empty field when the goal is blocked', () => {
    const g = grid(4, 4);
    g.setBlocked(2, 2);
    const field = computeFlowField(g, g.cellToWorld(2, 2));
    expect(field.reachable(0, 0)).toBe(false);
  });
});
