import { webMercatorScaleAtLatitude, wgs84ToWebMercator } from '@bendyline/molen-terrain/kernel';
import { expect, it } from 'vitest';
import { formatCameraLocation } from './location-readout.js';

it('reports precise WGS84 coordinates from the absolute metric world frame', () => {
  const scale = webMercatorScaleAtLatitude(47.6);
  const [x, z] = wgs84ToWebMercator(-122.0356789, 47.6139456);
  const camera = { pos: [x * scale, 111.234, z * scale] as const, yaw: -Math.PI / 2, pitch: -0.25 };
  const world = { label: 'Sammamish', metersPerUnit: scale, geospatial: true };
  const before = formatCameraLocation(camera, world);
  expect(before).toContain('Lat 47.6139456° · Lon -122.0356789° (WGS84)');
  expect(before).toContain('Altitude 111.23 m · Heading 0.0°');
  expect(before).toContain('Yaw -1.57080 rad · Pitch -0.25000 rad');
  // A one-meter move must be visible even though the world coordinates are millions of meters.
  expect(
    formatCameraLocation(
      { ...camera, pos: [camera.pos[0] + 1, camera.pos[1], camera.pos[2]] },
      world,
    ),
  ).not.toBe(before);
});

it.each([
  [0, '90.0'],
  [Math.PI / 2, '180.0'],
  [Math.PI, '270.0'],
  [(3 * Math.PI) / 2, '0.0'],
  [(-5 * Math.PI) / 2, '0.0'],
])('uses compass heading for yaw %s', (yaw, heading) => {
  expect(
    formatCameraLocation(
      { pos: [0, 0, 0], yaw: Number(yaw), pitch: 0 },
      { label: 'World', metersPerUnit: 1, geospatial: true },
    ),
  ).toContain(`Heading ${heading}°`);
});

it('labels local packages with world coordinates instead of invented latitude/longitude', () => {
  const text = formatCameraLocation(
    { pos: [12.345, 8, -45.678], yaw: 0, pitch: 0 },
    { label: 'Local demo', metersPerUnit: 1, geospatial: false },
  );
  expect(text).toContain('Local X 12.35 m · Z -45.68 m');
  expect(text).not.toContain('WGS84');
});
