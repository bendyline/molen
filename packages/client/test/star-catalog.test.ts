import { readFileSync } from 'node:fs';
import type { EarthSkyData, Vec3 } from '@bendyline/molen-schema';
import type * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  decodeStarCatalog,
  decodeStarCatalogRows,
  encodeStarCatalog,
  type StarCatalogRow,
} from '../src/sky/star-catalog';
import { SkyVisual } from '../src/sky/visual';

const RAD = Math.PI / 180;
const unit = ([ra, dec]: readonly number[]): Vec3 => [
  Math.cos((ra as number) * RAD) * Math.cos((dec as number) * RAD),
  Math.sin((ra as number) * RAD) * Math.cos((dec as number) * RAD),
  Math.sin((dec as number) * RAD),
];
const degreesBetween = (a: Vec3, b: Vec3): number =>
  Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])) / RAD;

function expectClose(decoded: StarCatalogRow[], source: readonly StarCatalogRow[]): void {
  expect(decoded).toHaveLength(source.length);
  let worst = 0;
  decoded.forEach((row, i) => {
    const original = source[i] as StarCatalogRow;
    worst = Math.max(worst, degreesBetween(unit(row), unit(original)));
    expect(Math.abs(row[2] - original[2])).toBeLessThanOrEqual(0.02 + 1e-9);
    expect(Math.abs(row[3] - original[3])).toBeLessThanOrEqual(0.01 + 1e-9);
  });
  expect(worst).toBeLessThan(0.01);
}

describe('molen/stars@1', () => {
  it('round-trips positions within 0.01 degrees', () => {
    const rows: StarCatalogRow[] = [
      [0, 0, -1.46, -0.03],
      [359.999, 89.9, 6.5, 2.1],
      [101.287, -16.716, -1.46, 0],
      [180, -90, 3, -0.4],
    ];
    expectClose(decodeStarCatalogRows(encodeStarCatalog(rows)), rows);
  });

  it('holds the Bright Star Catalogue subset in the sky pack', () => {
    const bytes = readFileSync(new URL('../../../content/sky/stars.bin', import.meta.url));
    const rows = decodeStarCatalogRows(bytes);
    expect(rows).toHaveLength(8404);
    expect(bytes.length).toBe(16 + rows.length * 6);
    const sirius = rows.find(
      ([ra, dec]) => Math.abs(ra - 101.287) < 0.01 && Math.abs(dec + 16.716) < 0.01,
    );
    expect(sirius?.[2]).toBeLessThan(-1.4);
    expect(rows.some(([, dec]) => dec > 60) && rows.some(([, dec]) => dec < -60)).toBe(true);
    // Magnitude is quantized to 0.04, so the 6.5 cut decodes to at most 6.52.
    expect(
      rows.every(([ra, dec, mag]) => ra >= 0 && ra < 360 && Math.abs(dec) <= 90 && mag <= 6.52),
    ).toBe(true);
    // Re-encoding the decoded rows reproduces the file: the format is stable at its precision.
    expect(Buffer.from(encodeStarCatalog(rows)).equals(bytes)).toBe(true);
  });

  it('decodes to sky stars in the J2000 frame', () => {
    const [sirius] = decodeStarCatalog(encodeStarCatalog([[101.287, -16.716, -1.46, 0]]));
    expect(degreesBetween(sirius?.direction as Vec3, unit([101.287, -16.716]))).toBeLessThan(0.01);
    expect(sirius?.color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('rejects bytes that are not a catalog', () => {
    expect(() => decodeStarCatalogRows(new Uint8Array(40))).toThrow(/not a molen\/stars@1/);
    const truncated = encodeStarCatalog([[1, 2, 3, 0]]).subarray(0, 20);
    expect(() => decodeStarCatalogRows(truncated)).toThrow(/need 22/);
  });
});

describe('SkyVisual.setStars', () => {
  const earth: EarthSkyData = {
    mode: 'earth',
    observer: { latitude: 47, longitude: -122 },
    time: { epochMs: Date.parse('2024-03-20T06:00:00Z') },
  };
  const starCount = (sky: SkyVisual): number =>
    (sky.scene.getObjectByName('molen:sky-stars') as THREE.Mesh).geometry.getAttribute('position')
      .count / 7;

  it('starts without stars, replaces the catalog on the same mesh, and undefined removes it', () => {
    const sky = new SkyVisual(earth);
    expect(starCount(sky)).toBe(0);
    const mesh = sky.scene.getObjectByName('molen:sky-stars');
    sky.setStars(decodeStarCatalog(encodeStarCatalog([[10, 20, 1, 0.5]])));
    expect(starCount(sky)).toBe(1);
    expect(sky.scene.getObjectByName('molen:sky-stars')).toBe(mesh);
    sky.update(0);
    sky.setStars(undefined);
    expect(starCount(sky)).toBe(0);
    sky.dispose();
    expect(() => sky.setStars(undefined)).toThrow(/disposed/);
  });
});
