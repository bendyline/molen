import {
  pointInPolygon,
  polygonArea,
  type TerrainLandcoverFeature,
  type TerrainSemanticPoint,
} from '@bendyline/molen-terrain/kernel';
import { describe, expect, it } from 'vitest';
import { contextLabelAt, isLandcoverDesignation } from '../src/kernel/labels';

const USES = new Set(['residential', 'commercial', 'industrial', 'school']);

/** contextLabelAt as a scan of every polygon, the definition the indexed lookup must match. */
function scanned(
  point: TerrainSemanticPoint,
  landcover: readonly TerrainLandcoverFeature[],
): string | undefined {
  let best: { area: number; label: string; use: boolean } | undefined;
  for (const feature of landcover) {
    if (isLandcoverDesignation(feature)) continue;
    const label =
      feature.subclass !== undefined && USES.has(feature.subclass)
        ? feature.subclass
        : feature.class;
    const use = USES.has(label);
    for (const polygon of feature.polygons) {
      if (!pointInPolygon(point, polygon)) continue;
      const area = polygonArea(polygon);
      if (best === undefined || (use && !best.use) || (use === best.use && area < best.area))
        best = { area, label, use };
    }
  }
  return best?.label;
}

/** A deterministic pseudo-random sequence in [0, 1). */
function sequence(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 2 ** 32;
  };
}

describe('contextLabelAt', () => {
  it('matches a scan of every polygon, on edges, corners, holes and ties', () => {
    const random = sequence(7);
    const classes = ['grass', 'wood', 'farmland', 'park', 'landuse'];
    const subclasses = [undefined, 'residential', 'commercial', 'industrial', 'school'];
    const landcover: TerrainLandcoverFeature[] = [];
    for (let i = 0; i < 60; i++) {
      // Buffered geometry reaches past the tile, so some rings do too.
      const u = random() * 1.2 - 0.1,
        v = random() * 1.2 - 0.1,
        w = 0.02 + random() * 0.5,
        h = 0.02 + random() * 0.5;
      const sides = 3 + Math.floor(random() * 6);
      const outer: TerrainSemanticPoint[] = [];
      for (let k = 0; k < sides; k++) {
        const angle = (k / sides) * Math.PI * 2;
        outer.push([u + w * (0.5 + 0.5 * Math.cos(angle)), v + h * (0.5 + 0.5 * Math.sin(angle))]);
      }
      const holes =
        i % 5 === 0
          ? [
              [
                [u + w * 0.4, v + h * 0.4],
                [u + w * 0.6, v + h * 0.4],
                [u + w * 0.6, v + h * 0.6],
                [u + w * 0.4, v + h * 0.6],
              ] as TerrainSemanticPoint[],
            ]
          : undefined;
      landcover.push({
        class: classes[i % classes.length] as string,
        ...(subclasses[i % subclasses.length] !== undefined
          ? { subclass: subclasses[i % subclasses.length] as string }
          : {}),
        polygons: [{ outer, ...(holes ? { holes } : {}) }],
      });
    }
    // Two equal squares of one use: the first listed wins the tie.
    for (const label of ['park', 'grass'])
      landcover.push({
        class: label,
        polygons: [
          {
            outer: [
              [0.3, 0.3],
              [0.4, 0.3],
              [0.4, 0.4],
              [0.3, 0.4],
            ],
          },
        ],
      });
    landcover.push({
      class: 'nature_reserve',
      polygons: [
        {
          outer: [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
          ],
        },
      ],
    });

    const points: TerrainSemanticPoint[] = [[0.35, 0.35]];
    for (let i = 0; i < 4000; i++) points.push([random() * 1.4 - 0.2, random() * 1.4 - 0.2]);
    // Vertices and edge midpoints, where bounds and the even-odd test meet.
    for (const feature of landcover)
      for (const polygon of feature.polygons)
        polygon.outer.forEach((p, k) => {
          const q = polygon.outer[(k + 1) % polygon.outer.length] as TerrainSemanticPoint;
          points.push(p, [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]);
        });
    for (const point of points)
      expect(contextLabelAt(point, landcover)).toBe(scanned(point, landcover));
    expect(contextLabelAt([0.35, 0.35], landcover)).toBe(scanned([0.35, 0.35], landcover));
  });

  it('sees landcover added to a list it has already indexed', () => {
    const landcover: TerrainLandcoverFeature[] = [
      {
        class: 'grass',
        polygons: [
          {
            outer: [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 1],
            ],
          },
        ],
      },
    ];
    expect(contextLabelAt([0.5, 0.5], landcover)).toBe('grass');
    landcover.push({
      class: 'landuse',
      subclass: 'residential',
      polygons: [
        {
          outer: [
            [0.4, 0.4],
            [0.6, 0.4],
            [0.6, 0.6],
            [0.4, 0.6],
          ],
        },
      ],
    });
    expect(contextLabelAt([0.5, 0.5], landcover)).toBe('residential');
  });
});
