import type { TerrainSemanticPolygon } from '@bendyline/molen-terrain/kernel';
import { ringArea } from '@bendyline/molen-worldgen/kernel';
import { describe, expect, it } from 'vitest';
import { analyzeTileEdge, PROTOMAPS_TILE_BUFFER } from '../src/kernel/tile-edges';

const b = PROTOMAPS_TILE_BUFFER;

function rect(u0: number, v0: number, u1: number, v1: number): TerrainSemanticPolygon {
  return {
    outer: [
      [u0, v0],
      [u1, v0],
      [u1, v1],
      [u0, v1],
    ],
  };
}

/** The same footprint as seen by the tile to the left (u shifted by +1). */
function leftNeighbourView(polygon: TerrainSemanticPolygon): TerrainSemanticPolygon {
  return { outer: polygon.outer.map(([u, v]) => [u + 1, v]) };
}

describe('tile-edge ownership', () => {
  it('renders interior footprints whole and drops footprints entirely outside', () => {
    expect(analyzeTileEdge(rect(0.2, 0.2, 0.3, 0.3), b).mode).toBe('whole');
    expect(analyzeTileEdge(rect(-0.2, 0.2, -0.1, 0.3), b).mode).toBe('skip');
  });

  it('gives a complete straddling footprint to exactly one tile', () => {
    const mostlyHere = rect(-0.004, 0.4, 0.05, 0.45);
    expect(analyzeTileEdge(mostlyHere, b).mode).toBe('whole');
    expect(analyzeTileEdge(leftNeighbourView(mostlyHere), b).mode).toBe('skip');
    const mostlyThere = rect(-0.012, 0.4, 0.003, 0.45);
    expect(analyzeTileEdge(mostlyThere, b).mode).toBe('skip');
    expect(analyzeTileEdge(leftNeighbourView(mostlyThere), b).mode).toBe('whole');
    const tie = rect(-0.005, 0.4, 0.005, 0.45);
    const here = analyzeTileEdge(tie, b).mode;
    const there = analyzeTileEdge(leftNeighbourView(tie), b).mode;
    expect([here, there].sort()).toEqual(['skip', 'whole']);
  });

  it('renders footprints cut by both buffers piecewise with seam edges', () => {
    const here = analyzeTileEdge(rect(-b, 0.4, 0.3, 0.45), b);
    expect(here.mode).toBe('clipped');
    if (here.mode !== 'clipped') return;
    expect(ringArea(here.polygon.outer)).toBeCloseTo(0.3 * 0.05, 9);
    expect(here.seamEdges).toHaveLength(1);
    const thereView: TerrainSemanticPolygon = rect(0.7, 0.4, 1 + b, 0.45);
    const there = analyzeTileEdge(thereView, b);
    expect(there.mode).toBe('clipped');
    if (there.mode !== 'clipped') return;
    expect(ringArea(there.polygon.outer)).toBeCloseTo(0.3 * 0.05, 9);
  });

  it('lets the neighbour render a footprint that barely enters this tile', () => {
    const sliver = rect(-b, 0.4, 0.004, 0.45);
    expect(analyzeTileEdge(sliver, b).mode).toBe('skip');
    const neighbour = rect(1 - 0.02, 0.4, 1.004, 0.45);
    expect(analyzeTileEdge(neighbour, b).mode).toBe('whole');
  });

  it('handles zero-buffer sources by clipping at the seam', () => {
    const decision = analyzeTileEdge(rect(0, 0.4, 0.3, 0.45), 0);
    expect(decision.mode).toBe('clipped');
  });
});
