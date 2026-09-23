import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { generateBuilding } from '../../src/kernel/building';
import { MeshBufferBuilder } from '../../src/kernel/mesh-buffers';
import { resolveStylePackDocuments } from '../../src/kernel/stylepack';
import { type BuildingRequest, FLAT_GROUND, type Vec2 } from '../../src/kernel/types';
import '../../src/kernel';

interface CatalogEntry {
  style: string;
  title: string;
  taxonomy: string;
  region: string;
  countries: string[];
  type: string;
  description: string;
  width: number;
  depth: number;
  levels: number;
  shape: 'rectangle' | 'l' | 'u' | 't' | 'courtyard';
  classes: string[];
  existing: boolean;
}

const packDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../content/worldgen');
const readJson = async (path: string): Promise<unknown> =>
  JSON.parse(await readFile(resolve(packDir, path), 'utf8'));
const catalog = (await readJson('structures/catalog.json')) as {
  format: string;
  taxonomies: Array<{ id: string }>;
  entries: CatalogEntry[];
};
const pack = await resolveStylePackDocuments(await readJson('stylepack.json'), readJson);
const identity = { name: pack.root.name, version: pack.root.version };

function footprint(
  entry: CatalogEntry,
  xScale = 1,
  zScale = 1,
): Pick<BuildingRequest, 'outline' | 'holes'> {
  const w = entry.width * xScale;
  const d = entry.depth * zScale;
  const outline: Vec2[] = [
    [0, 0],
    [w, 0],
    [w, d],
    [0, d],
  ];
  if (entry.shape === 'l')
    return {
      outline: [
        [0, 0],
        [w, 0],
        [w, d * 0.45],
        [w * 0.45, d * 0.45],
        [w * 0.45, d],
        [0, d],
      ],
    };
  if (entry.shape === 'u')
    return {
      outline: [
        [0, 0],
        [w, 0],
        [w, d],
        [w * 0.72, d],
        [w * 0.72, d * 0.34],
        [w * 0.28, d * 0.34],
        [w * 0.28, d],
        [0, d],
      ],
    };
  if (entry.shape === 't')
    return {
      outline: [
        [0, 0],
        [w, 0],
        [w, d * 0.4],
        [w * 0.64, d * 0.4],
        [w * 0.64, d],
        [w * 0.36, d],
        [w * 0.36, d * 0.4],
        [0, d * 0.4],
      ],
    };
  if (entry.shape === 'courtyard')
    return {
      outline,
      holes: [
        [
          [w * 0.28, d * 0.28],
          [w * 0.28, d * 0.72],
          [w * 0.72, d * 0.72],
          [w * 0.72, d * 0.28],
        ],
      ],
    };
  return { outline };
}

function build(entry: CatalogEntry, xScale = 1, zScale = 1, height?: number) {
  const style = pack.archstyles[entry.style];
  if (!style) throw new Error(`missing structure ${entry.style}`);
  const builder = new MeshBufferBuilder();
  const result = generateBuilding(
    {
      request: {
        identity: `catalog:${entry.style}`,
        labels: [entry.type],
        style: entry.style,
        levels: entry.levels,
        ...(height === undefined ? {} : { height }),
        ...footprint(entry, xScale, zScale),
      },
      style,
      pack: identity,
      ground: FLAT_GROUND,
      tier: 0,
    },
    builder,
  );
  const mesh = builder.finalize();
  return { result, mesh };
}

describe('default structure catalog', () => {
  it('ships exactly120 reachable structures, including104 additions in13 geographic/use taxonomies', () => {
    expect(catalog.format).toBe('molen/structure-catalog@1');
    expect(catalog.entries).toHaveLength(120);
    expect(catalog.entries.filter((entry) => !entry.existing)).toHaveLength(104);
    expect(new Set(catalog.entries.map((entry) => entry.style)).size).toBe(120);
    expect(new Set(catalog.entries.map((entry) => entry.title)).size).toBe(120);
    expect(catalog.taxonomies).toHaveLength(13);
    expect(catalog.entries.map((entry) => entry.style).sort()).toEqual(
      Object.keys(pack.archstyles).sort(),
    );
    for (const entry of catalog.entries) {
      expect(
        catalog.taxonomies.some((taxonomy) => taxonomy.id === entry.taxonomy),
        entry.style,
      ).toBe(true);
      expect(entry.countries.length, entry.style).toBeGreaterThan(0);
      expect(entry.description.length, entry.style).toBeGreaterThan(30);
      expect(entry.width, entry.style).toBeGreaterThan(0);
      expect(entry.depth, entry.style).toBeGreaterThan(0);
      expect(entry.levels, entry.style).toBeGreaterThan(0);
    }
  });

  it('renders every canonical structure and preserves deterministic geometry', () => {
    const silhouettes = new Set<string>();
    for (const entry of catalog.entries) {
      const first = build(entry);
      const second = build(entry);
      expect(first.result.skipped, entry.style).toBeUndefined();
      expect(first.mesh.positions.length, entry.style).toBeGreaterThan(0);
      expect(Array.from(first.mesh.positions).every(Number.isFinite), entry.style).toBe(true);
      expect(first.mesh.positions, entry.style).toEqual(second.mesh.positions);
      expect(first.mesh.indices, entry.style).toEqual(second.mesh.indices);
      silhouettes.add(createHash('sha256').update(first.mesh.positions).digest('hex'));
    }
    expect(silhouettes.size).toBe(120);
  }, 30_000); // Builds all 120 canonical structures twice.

  it('rebuilds independent width/depth changes and respects caller-supplied height for all120 styles', () => {
    for (const entry of catalog.entries) {
      for (const [xScale, zScale] of [
        [0.65, 1.35],
        [1.55, 0.75],
      ]) {
        const { result, mesh } = build(entry, xScale, zScale, 18);
        expect(result.skipped, entry.style).toBeUndefined();
        expect(result.record?.height, entry.style).toBe(18);
        const coordinates = Array.from(mesh.positions);
        expect(coordinates.every(Number.isFinite), entry.style).toBe(true);
        const heights = coordinates.filter((_, index) => index % 3 === 1);
        expect(Math.max(...heights), entry.style).toBeLessThanOrEqual(18.001);
        expect(
          mesh.indices.every((index) => index < mesh.positions.length / 3),
          entry.style,
        ).toBe(true);
      }
    }
  });

  it('uses material construction and geometry detail across the added styles', () => {
    const newStyles = catalog.entries
      .filter((entry) => !entry.existing)
      .map((entry) => pack.archstyles[entry.style]);
    const wallMaterials = new Set(
      newStyles.flatMap((style) => style?.materials.wall.choices.map((choice) => choice.ref) ?? []),
    );
    const roofMaterials = new Set(
      newStyles.flatMap((style) => style?.materials.roof.choices.map((choice) => choice.ref) ?? []),
    );
    expect(wallMaterials.size).toBeGreaterThanOrEqual(20);
    expect(roofMaterials.size).toBeGreaterThanOrEqual(12);
    expect(
      newStyles.filter((style) => style?.facade.details !== undefined).length,
    ).toBeGreaterThanOrEqual(90);
    expect(
      catalog.entries.filter((entry) => entry.shape === 'courtyard').length,
    ).toBeGreaterThanOrEqual(10);
  });
});
