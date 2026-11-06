import '../../worldgen/scripts/install-deterministic-math.mjs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import * as THREE from 'three';
import { expect, it } from 'vitest';
import {
  buildHyattLevel,
  hyattControls,
  hyattEntryPoint,
  hyattGroundY,
  hyattSurfaces,
} from '../../../content/worldgen/source/places/u0/u09/hyatt_regency_paris_etoile/models/hyatt-model.mjs';
import { createEmptyTerrainSemanticTile, heightfieldFromPng } from '../../terrain/dist/kernel.mjs';
import { StructureModelLibrary } from '../../worldgen/dist/client.mjs';
import { emptyWorldgenStats, encodeGlb, MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { hashBytes } from '../../worldgen/scripts/structure-model-files.mjs';
import { reviewedSourceMapFrame } from '../../worldgen-earth/scripts/reviewed-source-map-frame.mjs';
import { createWorldgenSemanticRenderers } from '../../worldgen-earth/src/client/renderers.ts';
import { createStructureIndex } from '../../worldgen-earth/src/kernel/structure-index.ts';
import { loadDefaultPack } from '../../worldgen-earth/test/helpers/pack.ts';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

const source = resolve('../../content/worldgen/source/places/u0/u09/hyatt_regency_paris_etoile'),
  installed = source.replace(/([\\/])source([\\/])/, '$1assets$2'),
  runtime = await runtimeLodFixture(installed),
  read = async (p) => JSON.parse(await readFile(p));
async function triangles(path, slot) {
  const d = await new NodeIO().readBinary(await readFile(path));
  return d
    .getRoot()
    .listMeshes()
    .flatMap((m) =>
      m
        .listPrimitives()
        .filter(
          (p) =>
            !slot ||
            (Array.isArray(slot) ? slot : [slot]).includes(
              p.getMaterial()?.getExtras()?.molenSurface?.slot,
            ),
        )
        .flatMap((p) => {
          const a = p.getAttribute('POSITION').getArray(),
            ids = p.getIndices().getArray();
          return Array.from({ length: ids.length / 3 }, (_, i) =>
            Array.from(ids.slice(i * 3, i * 3 + 3), (j) => Array.from(a.slice(j * 3, j * 3 + 3))),
          );
        }),
    );
}
const sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
  cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
function nearest(ts, o, d) {
  return ts.reduce((best, p) => {
    const a = sub(p[1], p[0]),
      b = sub(p[2], p[0]),
      h = cross(d, b),
      det = dot(a, h);
    if (Math.abs(det) < 1e-8) return best;
    const q = sub(o, p[0]),
      u = dot(q, h) / det,
      v = dot(d, cross(q, a)) / det,
      t = dot(b, cross(q, a)) / det;
    return u < -1e-7 || v < -1e-7 || u + v > 1 + 1e-7 || t <= 1e-5 ? best : Math.min(best, t);
  }, Infinity);
}

it('reconstitutes the complete curved hotel source,signed separate body/podium frame andunmodified native contacts', async () => {
  const brief = await read(source + '/model-brief.json'),
    frame = await read(source + '/map-frame.json'),
    grid = await read(source + '/terrain-grid.json'),
    b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring(hyattSurfaces);
  buildHyattLevel(a.wrap(b), 'master');
  const m = b.finalize(),
    bytes = Buffer.from(encodeGlb(m, a.materials(m.groups), brief.exportLabel));
  expect(hashBytes(bytes)).toBe(brief.expectedDraftMasterHash);
  expect(bytes.equals(await readFile(source + '/models/source.glb'))).toBe(true);
  expect(frame.anchor).toEqual([2.284314106, 48.880235878]);
  expect(frame.heading).toBe(-0.486868130324);
  expect(frame.mappedIdentity.wikidataId).toBe('Q3142395');
  expect(hyattControls.bodyTop).toBe(137);
  expect(hyattControls.podiumTop).toBe(21);
  expect(hyattControls.mast.top).toBe(174);
  expect(
    hyattEntryPoint(22.875, 0, 10)[2] - hyattEntryPoint(22.875, 0, 0)[2],
    'entry canopy faces the northern forecourt',
  ).toBeLessThan(-9.9);
  expect(brief.sourceFacts.retainedPinnacleHeightMeters).toBe(190);
  expect(brief.sourceFacts.antennaInventoryStatus).toContain('unverified');
  const png = await readFile(source + '/terrain-review.height.png');
  expect(hashBytes(png)).toBe(grid.reviewHeightfieldHash);
  expect(grid.tiles).toHaveLength(4);
  const field = heightfieldFromPng(await read(source + '/terrain-review.terrain.json'), png),
    ts = await triangles(source + '/models/source.glb');
  for (const u of [13, 32.75]) {
    const p = hyattEntryPoint(u, 0, 5.8),
      ground = hyattGroundY(p[0], p[2]);
    expect(field.sampleHeight(p[0], p[2])).toBeCloseTo(ground, 2);
    expect(
      nearest(ts, [p[0], ground + 1, p[2]], [0, -1, 0]),
      'canopy post physically embeds in unmodified field',
    ).toBeCloseTo(1.4, 2);
  }
  const p = (await read(source + '/placement-report.json')).entry;
  expect(p.replaceFootprint).toBe(true);
  expect(p.elevation).toBe(49);
  expect(p.anchor).toEqual(frame.anchor);
  expect(p.heading).toBe(frame.heading);
  expect(
    reviewedSourceMapFrame({
      frameBytes: await readFile(source + '/map-frame.json'),
      sourceManifest: await read(source + '/source.json'),
      spec: await read(source + '/spec.json'),
      placement: p,
      geographicReviewed: true,
    }),
  ).toBeDefined();
}, 30000);
it('retains the137m lens,21m whole low parent and174m native-envelope mast;near tiers keep physical entry/canopy geometry', async () => {
  const asset = await read(runtime + '/asset.json'),
    e = hyattControls.entrance,
    dx = e.q[0] - e.p[0],
    dz = e.q[1] - e.p[1],
    L = Math.hypot(dx, dz),
    inside = [dz / L, 0, -dx / L];
  for (const l of asset.runtimeLods.levels) {
    const ts = await triangles(runtime + '/' + l.file),
      roof = await triangles(runtime + '/' + l.file, l.name === 'skyline' ? undefined : 'roof');
    expect(
      200 - nearest(roof, [10, 200, 20], [0, -1, 0]),
      l.name + ' actual curved body roof',
    ).toBeCloseTo(137, 2);
    expect(
      50 - nearest(roof, [-12, 50, -24], [0, -1, 0]),
      l.name + ' whole low parent roof',
    ).toBeCloseTo(21, 2);
    const p = hyattControls.mast.center;
    expect(
      200 - nearest(ts, [p[0], 200, p[1]], [0, -1, 0]),
      l.name + ' separate native-envelope antenna top',
    ).toBeCloseTo(174, 2);
    expect(nearest(ts, [80, 100, 0], [0, -1, 0]), l.name + ' excludes independent apartments').toBe(
      Infinity,
    );
    if (['street', 'closeup'].includes(l.name)) {
      for (const y of [4, 6.7]) {
        const d = nearest(ts, hyattEntryPoint(23.6, y, 12), inside);
        expect(d, l.name + ' recessed entry without crossing facade bands').toBeGreaterThan(13.65);
        expect(d).toBeLessThan(13.85);
      }
      expect(
        nearest(ts, hyattEntryPoint(23.6, 4, -0.5), [0, 1, 0]),
        l.name + ' actual recess ceiling',
      ).toBeCloseTo(3, 2);
      const q = hyattEntryPoint(23.6, 20, 4.1);
      expect(nearest(ts, q, [0, -1, 0]), l.name + ' actual canopy roof').toBeCloseTo(
        20 - (e.canopyBackY + ((e.canopyFrontY - e.canopyBackY) * 4.1) / e.canopyDepth),
        1,
      );
    }
  }
}, 60000);
it('uses the production viewer to replace the actual native building parts while retaining nearby buildings', async () => {
  const map = await read(source + '/pmtiles-map.json'),
    frame = await read(source + '/map-frame.json'),
    placed = (await read(source + '/placement-report.json')).entry,
    local = ([lon, lat]) => {
      const E =
          (lon - frame.anchor[0]) * 111319.490793 * Math.cos((frame.anchor[1] * Math.PI) / 180),
        S = -(lat - frame.anchor[1]) * 111319.490793;
      return [
        E * Math.cos(frame.heading) - S * Math.sin(frame.heading),
        E * Math.sin(frame.heading) + S * Math.cos(frame.heading),
      ];
    };
  const c = Math.cos(frame.heading),
    s = Math.sin(frame.heading),
    point = ([x, z]) => [(c * x + s * z + 300) / 600, (-s * x + c * z + 300) / 600],
    all = [];
  for (const f of map.features.filter(
    (f) => f.layer === 'buildings' && ['Polygon', 'MultiPolygon'].includes(f.geometry.type),
  ))
    for (const rings of f.geometry.type === 'MultiPolygon'
      ? f.geometry.coordinates
      : [f.geometry.coordinates]) {
      const p = rings.map((r) => r.map(local)),
        flat = p.flat(),
        bb = [
          Math.min(...flat.map((p) => p[0])),
          Math.min(...flat.map((p) => p[1])),
          Math.max(...flat.map((p) => p[0])),
          Math.max(...flat.map((p) => p[1])),
        ];
      all.push({
        id: 'native-' + all.length,
        kind: f.properties.kind,
        height: f.properties.height ?? 30,
        minHeight: f.properties.min_height ?? 0,
        polygons: [
          {
            outer: p[0].map(point),
            ...(p.length > 1 ? { holes: p.slice(1).map((r) => r.map(point)) } : {}),
          },
        ],
        bb,
      });
    }
  const target = hyattControls.nativeMap.ownedParts.map((i) => all[i]),
    neighbor = hyattControls.nativeMap.preservedNeighbors.map((i) => all[i]);
  expect(all).toHaveLength(157);
  expect(target).toHaveLength(hyattControls.nativeMap.ownedParts.length);
  expect(target[0].height).toBe(174);
  expect(target[2].height).toBe(137);
  expect(target[3].height).toBe(21);

  expect(neighbor).toHaveLength(4);
  const asset = await read(installed + '/asset.json'),
    doc = await new NodeIO().readBinary(
      await readFile(installed + '/' + asset.runtimeLods.levels[0].file),
    ),
    model = new THREE.Group();
  for (const m of doc.getRoot().listMeshes())
    for (const p of m.listPrimitives()) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(p.getAttribute('POSITION').getArray(), 3),
      );
      geometry.setIndex(Array.from(p.getIndices().getArray()));
      model.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial()));
    }
  const objects = new StructureModelLibrary(async () => model),
    seen = [],
    pack = await loadDefaultPack(),
    renderers = createWorldgenSemanticRenderers(pack, {
      structures: createStructureIndex({
        format: 'molen/structure-placements@1',
        title: 'Hyatt Regency Paris Etoile actual map replacement',
        entries: [{ ...placed, anchor: [0, 0], bounds: undefined, minLevel: 0 }],
      }),
      structureObjects: objects,
      roads: { renderTransportation: false },
      generator: {
        generate: async (request) => {
          if (request.features?.buildings) seen.push(request.tile.buildings.map((b) => b.id));
          return {
            placements: [],
            records: [],
            stats: emptyWorldgenStats(),
            hash: 'sha256:empty',
            skippedByOwnership: 0,
            clippedPieces: 0,
          };
        },
        dispose() {},
      },
    });
  let root;
  try {
    const tile = createEmptyTerrainSemanticTile();
    tile.buildings = [...target, ...neighbor];
    const field = heightfieldFromPng(
      await read(source + '/terrain-review.terrain.json'),
      await readFile(source + '/terrain-review.height.png'),
    );
    root = await renderers.humanFeatures.createTile(tile, {
      address: { level: 14, x: 0, z: 0 },
      tileSize: 600,
      origin: [-300, -300],
      pyramid: {
        name: 'hyatt-native-replacement',
        origin: [-300, -300],
        rootSize: 9830400,
        minLevel: 0,
        maxLevel: 14,
        tileResolution: 129,
        height: { min: -10, max: 300 },
        layers: [],
        skirts: false,
      },
      descriptor: {},
      heightfield: field,
      signal: new AbortController().signal,
    });
    expect(root?.getObjectByName('structure:' + placed.id)).toBeDefined();
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.at(-1).sort()).toEqual(neighbor.map((b) => b.id).sort());
  } finally {
    if (root) renderers.humanFeatures.disposeTile?.(root);
    renderers.dispose();
    objects.dispose();
  }
}, 30000);
it('rebuilds four exact budgeted tiers with four shared graphs, no image copies and separate GPU streams', async () => {
  const r = await buildModelLandmarkLods(runtime + '/asset.json', { force: true }),
    asset = await read(installed + '/asset.json');
  expect(r.levels[0].bytes + r.levels[1].bytes).toBeLessThan(3000000);
  for (const [name, cap] of Object.entries({
    skyline: 1000,
    district: 4000,
    street: 16000,
    closeup: 64000,
  })) {
    const l = r.levels.find((l) => l.name === name),
      bytes = await readFile(runtime + '/' + l.file),
      g = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
    expect(hashBytes(bytes)).toBe(asset.runtimeLods.levels.find((l) => l.name === name).hash);
    expect(l.triangles).toBeLessThanOrEqual(cap);
    expect(l.drawCalls).toBeLessThanOrEqual(8);
    expect(g.images ?? []).toHaveLength(0);
    if (name !== 'skyline')
      for (const graph of ['window_grid', 'metal_painted', 'membrane', 'stone_granite'])
        expect(
          g.materials.some(
            (m) => m.extras?.molenSurface?.ref === 'matgraph:molen.worldgen.material.' + graph,
          ),
        ).toBe(true);
    for (const p of g.meshes.flatMap((m) => m.primitives)) {
      const a = g.accessors[p.attributes.POSITION],
        n = g.accessors[p.attributes.NORMAL];
      expect(a.bufferView).not.toBe(n.bufferView);
      expect(g.bufferViews[a.bufferView].byteStride ?? 12).toBe(12);
      expect(g.bufferViews[n.bufferView].byteStride ?? 12).toBe(12);
    }
  }
}, 30000);
