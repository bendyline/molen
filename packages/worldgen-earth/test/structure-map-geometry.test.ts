import { describe, expect, it } from 'vitest';
import {
  closedLine,
  featureIsObsolete,
  featureLines,
  fitMapFrame,
  lengthMeters,
  metricFrame,
} from '../scripts/structure-map-geometry.mjs';

describe('offline structure map registration', () => {
  it('recovers a rotated metric footprint and its renderer handedness', () => {
    const reference = [-122.3, 47.6];
    const projection = metricFrame(reference);
    const angle = 0.37;
    const c = Math.cos(angle),
      s = Math.sin(angle);
    const local = [
      [-60, -15],
      [60, -15],
      [60, 15],
      [-60, 15],
      [-60, -15],
    ];
    const ring = local.map(([x, z]) => projection.unproject([c * x + s * z, s * x - c * z]));
    const fit = fitMapFrame(ring, reference);
    expect(fit.heading).toBeCloseTo(angle, 8);
    expect(fit.length).toBeCloseTo(120, 6);
    expect(fit.width).toBeCloseTo(30, 6);
    expect(fit.anchor[0]).toBeCloseTo(reference[0], 10);
    expect(fit.anchor[1]).toBeCloseTo(reference[1], 10);
    for (let index = 0; index < ring.length; index++) {
      const point = fit.toLocal(ring[index]);
      expect(point[0]).toBeCloseTo(local[index][0], 6);
      expect(point[1]).toBeCloseTo(local[index][1], 6);
    }
  });

  it('fits a centerline without inventing bridge width and rejects a point-only orientation', () => {
    const projection = metricFrame([0, 50]);
    const fit = fitMapFrame(
      [projection.unproject([-500, 0]), projection.unproject([500, 0])],
      [0, 50],
    );
    expect(fit.length).toBeCloseTo(1000, 6);
    expect(fit.width).toBeCloseTo(0, 6);
    expect(fitMapFrame([[0, 50]], [0, 50])).toBeUndefined();
    expect(
      fitMapFrame(
        [
          [0, 50],
          [0, 50],
        ],
        [0, 50],
      ),
    ).toBeUndefined();
  });

  it('keeps original ring closure and filters obsolete feature geometry', () => {
    expect(
      closedLine([
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 0],
      ]),
    ).toBe(true);
    expect(
      closedLine([
        [0, 0],
        [1, 0],
        [1, 1],
      ]),
    ).toBe(false);
    expect(featureIsObsolete({ tags: { 'demolished:building': 'yes' } })).toBe(true);
    expect(featureIsObsolete({ tags: { building: 'construction' } })).toBe(true);
    expect(featureIsObsolete({ tags: { building: 'church', start_date: '1630' } })).toBe(false);
  });

  it('only converts explicit length units and refuses ambiguous map values', () => {
    expect(lengthMeters('200 ft')).toBeCloseTo(60.96);
    expect(lengthMeters('23.6 m')).toBe(23.6);
    expect(lengthMeters('20;30')).toBeUndefined();
    expect(lengthMeters('-10')).toBeUndefined();
    expect(lengthMeters('unknown')).toBeUndefined();
  });

  it('stitches reversed multipolygon members without filling inner courtyards', () => {
    const feature = {
      members: [
        {
          role: 'outer',
          geometry: [
            { lon: 0, lat: 0 },
            { lon: 1, lat: 0 },
            { lon: 1, lat: 1 },
          ],
        },
        {
          role: 'outer',
          geometry: [
            { lon: 0, lat: 0 },
            { lon: 0, lat: 1 },
            { lon: 1, lat: 1 },
          ],
        },
        {
          role: 'inner',
          geometry: [
            { lon: 0.2, lat: 0.2 },
            { lon: 0.8, lat: 0.2 },
            { lon: 0.5, lat: 0.8 },
            { lon: 0.2, lat: 0.2 },
          ],
        },
      ],
    };
    const lines = featureLines(feature);
    expect(lines).toHaveLength(2);
    expect(lines[0].role).toBe('outer');
    expect(lines[1].role).toBe('inner');
    expect(lines.every((line) => closedLine(line.coordinates))).toBe(true);
    expect(feature.members[0].geometry).toHaveLength(3);
  });
});
