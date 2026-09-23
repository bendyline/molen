import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { visibleLandcoverPolygons } from '../src/landcover-surface';
import { pointInPolygon, polygonArea } from '../src/polygon';
import type { TerrainLandcoverFeature, TerrainSemanticPolygon } from '../src/semantic-types';

const rectangle = (min: number, max: number): TerrainSemanticPolygon => ({
  outer: [
    [min, min],
    [max, min],
    [max, max],
    [min, max],
  ],
});

describe('land-cover coverage', () => {
  it('leaves one winning surface in the reported Sammamish forest and park tile', () => {
    const { landcover } = JSON.parse(
      readFileSync(new URL('./fixtures/sammamish-landcover.json', import.meta.url), 'utf8'),
    ) as { landcover: TerrainLandcoverFeature[] };
    const visible = visibleLandcoverPolygons(landcover);
    let overlaps = 0;
    for (let x = 0.013; x < 1; x += 0.037) {
      for (let z = 0.017; z < 1; z += 0.041) {
        const point: [number, number] = [x, z];
        const original = landcover.flatMap((feature, index) =>
          feature.polygons.some((polygon) => pointInPolygon(point, polygon)) ? [index] : [],
        );
        if (original.length > 1) overlaps++;
        const covering = visible.flatMap((polygons, index) =>
          polygons.filter((polygon) => pointInPolygon(point, polygon)).map(() => index),
        );
        expect(covering).toEqual(original.slice(-1));
      }
    }
    expect(overlaps).toBeGreaterThan(100);
  });

  it('renders only the last covering feature, including through holes in higher layers', () => {
    const features: TerrainLandcoverFeature[] = [
      { class: 'urban_area', polygons: [rectangle(-0.2, 1.2)] },
      { class: 'forest', polygons: [rectangle(0.1, 0.9)] },
      { class: 'park', polygons: [{ ...rectangle(0.2, 0.8), holes: [rectangle(0.4, 0.6).outer] }] },
    ];
    const before = structuredClone(features);
    const visible = visibleLandcoverPolygons(features);
    expect(features).toEqual(before);
    expect(visible.flat().reduce((area, polygon) => area + polygonArea(polygon), 0)).toBeCloseTo(1);
    for (let x = 0.013; x < 1; x += 0.037) {
      for (let z = 0.017; z < 1; z += 0.041) {
        const point: [number, number] = [x, z];
        const expected = features.findLastIndex((f) =>
          f.polygons.some((p) => pointInPolygon(point, p)),
        );
        const covering = visible.flatMap((polygons, index) =>
          polygons.filter((p) => pointInPolygon(point, p)).map(() => index),
        );
        expect(covering).toEqual([expected]);
      }
    }
  });

  it('unions overlapping polygons of one feature and ignores degenerate rings', () => {
    const visible = visibleLandcoverPolygons([
      { class: 'forest', polygons: [rectangle(-1, 0.75), rectangle(0.25, 2), rectangle(0.5, 0.5)] },
    ]);
    expect(visible.flat().reduce((area, polygon) => area + polygonArea(polygon), 0)).toBeCloseTo(
      0.875,
    );
    expect(visible[0]?.filter((polygon) => pointInPolygon([0.5, 0.5], polygon))).toHaveLength(1);
  });
});
