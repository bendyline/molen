import '../../worldgen/scripts/install-deterministic-math.mjs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import * as THREE from 'three';
import { expect, it } from 'vitest';
import {
  createEmptyTerrainSemanticTile,
  heightfieldFromPng,
  wgs84ToWorld,
} from '../../terrain/dist/kernel.mjs';
import { StructureModelLibrary } from '../../worldgen/dist/client.mjs';
import { emptyWorldgenStats } from '../../worldgen/dist/kernel.mjs';
import { hashBytes, modelInputHash } from '../../worldgen/scripts/structure-model-files.mjs';
import { reviewedSourceMapFrame } from '../../worldgen-earth/scripts/reviewed-source-map-frame.mjs';
import { createWorldgenSemanticRenderers } from '../../worldgen-earth/src/client/renderers.ts';
import { createStructureIndex } from '../../worldgen-earth/src/kernel/structure-index.ts';
import { loadDefaultPack } from '../../worldgen-earth/test/helpers/pack.ts';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

const source = resolve('../../content/worldgen/source/places/ez/ezm/segovia_cathedral'),
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
function nearest(ts, o, d, frontOnly = false) {
  return ts.reduce((best, p) => {
    const a = sub(p[1], p[0]),
      b = sub(p[2], p[0]),
      h = cross(d, b),
      det = dot(a, h);
    if (Math.abs(det) < 1e-8 || (frontOnly && det < 0)) return best;
    const q = sub(o, p[0]),
      u = dot(q, h) / det,
      v = dot(d, cross(q, a)) / det,
      t = dot(b, cross(q, a)) / det;
    return u < -1e-7 || v < -1e-7 || u + v > 1 + 1e-7 || t <= 1e-5 ? best : Math.min(best, t);
  }, Infinity);
}

const frame = await read(source + '/map-frame.json'),
  layout = await read(source + '/layout.json');
it('pins the complete cathedral and88/90m tower facts while preserving thecloister hole', async () => {
  const m = await read(source + '/source.json'),
    a = await read(installed + '/asset.json'),
    p = await read(source + '/placement-report.json'),
    spec = await read(source + '/spec.json'),
    g = await read(source + '/ground-masks.json');
  expect(hashBytes(await readFile(source + '/models/source.glb'))).toBe(m.files.models[0].sha256);
  expect(a.sourceHash).toBe(m.files.models[0].sha256);
  expect(hashBytes(await readFile(installed + '/' + a.files.main))).toBe(a.hash);
  expect(p.inputHash).toBe(await modelInputHash(source, a.id));
  expect(frame.anchor).toEqual([-4.12552732, 40.950027456]);
  expect(frame.heading).toBe(-2.3543771267808964);
  expect(frame.mappedIdentity.featureIds).toContain('relation/16786106');
  expect(frame.mappedIdentity.nativePrincipalId).toBe(52776574919354);
  expect(frame.mappedIdentity.nativeGreatTowerId).toBe(35185510104600);
  expect(frame.orientationControl.uncertaintyDegrees).toBe(10);
  expect(layout.nativeMap.ownedParts).toEqual([313, 411]);
  expect(layout.nativeMap.preservedNeighbors).toHaveLength(412);
  expect(frame.geometry.holes).toHaveLength(1);
  expect(p.entry.replaceFootprint).toBe(true);
  expect(p.entry.buildingCutout.outlines).toHaveLength(48);
  expect(p.entry.groundCutout.outlines).toHaveLength(48);
  expect(p.entry.datum).toBe('terrain');
  expect(p.entry.elevation).toBe(0);
  expect(p.entry.terrainReference.anchor).toEqual([-4.12585649311068, 40.950516112695674]);
  expect(spec.sourceFacts.retainedHeightMeters).toBe(90);
  expect(spec.sourceFacts.nativeGreatTowerHeightMeters).toBe(88);
  expect(g.occupiedSquareMeters).toBeCloseTo(g.maskedSquareMeters, 7);
  expect(
    reviewedSourceMapFrame({
      frameBytes: await readFile(source + '/map-frame.json'),
      sourceManifest: m,
      spec,
      placement: p.entry,
      geographicReviewed: true,
    }),
  ).toBeDefined();
  const inside = (p, r) => {
    let hit = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const a = r[i],
        b = r[j];
      if (
        a[1] > p[1] !== b[1] > p[1] &&
        p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
      )
        hit = !hit;
    }
    return hit;
  };
  for (const r of p.entry.groundCutout.outlines)
    expect(inside([25, 25], r), 'no ground mask fills open court').toBe(false);
});
it('keeps theentire cathedral,court opening,real great belfry,major roofs/domes andall returns in all six GLBs', async () => {
  const asset = await read(runtime + '/asset.json'),
    files = [
      { name: 'source', path: source + '/models/source.glb' },
      { name: 'import', path: installed + '/' + asset.files.main },
      ...asset.runtimeLods.levels.map((l) => ({ name: l.name, path: runtime + '/' + l.file })),
    ];
  for (const f of files) {
    const ts = await triangles(f.path),
      far = f.name === 'skyline',
      flat = far || f.name === 'district';
    expect
      .soft(
        nearest(ts, [25, 110, 25], [0, -1, 0], false),
        f.name + ' court open fromsky throughfloor',
      )
      .toBe(Infinity);
    expect
      .soft(
        110 - nearest(ts, [18.67666, 110, 47.808708], [0, -1, 0], true),
        f.name + ' full90m tower',
      )
      .toBeCloseTo(far ? 89.2 : 90, 2);
    expect
      .soft(
        110 - nearest(ts, [-19, 110, -13], [0, -1, 0], false),
        f.name + ' full central dome/lantern',
      )
      .toBeCloseTo(far ? 61 : 62, 2);
    if (far) {
      // Skyline crosses are vertical plates: a vertical ray is coplanar with them.
      expect.soft(nearest(ts, [18.67666, 89.7, 50.808708], [0, 0, -1])).toBeCloseTo(3, 2);
      expect.soft(nearest(ts, [-19, 61.7, -10], [0, 0, -1])).toBeCloseTo(3, 2);
    }
    expect
      .soft(
        110 - nearest(ts, [-43.7, 110, -29.2], [0, -1, 0], false),
        f.name + ' smaller slateportal turret',
      )
      .toBeCloseTo(44, 2);
    for (const [o, d] of [
      [
        [18.67666, 69, 80],
        [0, 0, -1],
      ],
      [
        [18.67666, 69, 20],
        [0, 0, 1],
      ],
      [
        [40, 69, 47.808708],
        [-1, 0, 0],
      ],
      [
        [0, 69, 47.808708],
        [1, 0, 0],
      ],
    ])
      expect
        .soft(nearest(ts, o, d, true), f.name + ' allfour actual greatbelfry arches')
        .toBe(Infinity);
    expect
      .soft(
        69 + nearest(ts, [18.67666, 69, 55.4], [0, 1, 0], false),
        f.name + ' closed belfry soffit',
      )
      .toBeCloseTo(76.2, 2);
    const ridge = 80 - nearest(ts, [-19, 80, 20], [0, -1, 0], true);
    expect.soft(ridge, f.name + ' long nave roofcomplete').toBeGreaterThan(38.5);
    expect.soft(ridge).toBeLessThan(38.9);
    for (const x of [-39, 2])
      expect
        .soft(50 - nearest(ts, [x, 50, 20], [0, -1, 0], true), f.name + ' both loweraisle roofs')
        .toBeGreaterThan(21);
    for (const p of [
      [42, 25],
      [25, 45],
      [10.5, 25],
      [25, 7],
    ])
      expect
        .soft(
          50 - nearest(ts, [p[0], 50, p[1]], [0, -1, 0], true),
          f.name + ' allfour cloisterwing roofs',
        )
        .toBeGreaterThan(14.2);
    expect
      .soft(
        -20 + nearest(ts, [-19, -20, 20], [0, 1, 0], true),
        f.name + ' closed occupied floor underside',
      )
      .toBeCloseTo(far ? 0.3 : -8, 2);
    if (!flat) {
      expect
        .soft(
          70 - nearest(ts, [-19, 4, 70], [0, 0, -1], true),
          f.name + ' real closed frontdoor recess',
        )
        .toBeCloseTo(54.915, 2);
      expect
        .soft(
          50 - nearest(ts, [25, 7, 25], [1, 0, 0], true),
          f.name + ' actual courtyard arcade opensinto passage',
        )
        .not.toBe(37.354);
    }
  }
}, 60000);
it('uses the production viewer to replace thewhole cathedral andgreattower and preserve all independent native neighbors', async () => {
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
    point = ([x, z]) => [(c * x + s * z + 2000) / 4000, (-s * x + c * z + 2000) / 4000],
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
  const owned = layout.nativeMap.ownedParts,
    target = owned.map((i) => all[i]),
    neighbor = all.filter((_, i) => !owned.includes(i));
  expect(all).toHaveLength((await read(source + '/mapped-parts.json')).parts.length);
  expect(target).toHaveLength(2);
  expect(neighbor).toHaveLength(412);
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
  const field = heightfieldFromPng(
      await read(source + '/terrain-review.terrain.json'),
      await readFile(source + '/terrain-review.height.png'),
    ),
    objects = new StructureModelLibrary(async () => model),
    seen = [],
    seenPolygons = [],
    pack = await loadDefaultPack(),
    renderers = createWorldgenSemanticRenderers(pack, {
      sampleStructureTerrain: (coordinate) => {
        const [e, S] = wgs84ToWorld(1, ...coordinate);
        return field.sampleHeight(e * c - S * s, e * s + S * c);
      },
      structures: createStructureIndex({
        format: 'molen/structure-placements@1',
        title: 'Segovia Cathedral actual map replacement',
        entries: [
          {
            ...placed,
            anchor: [0, 0],
            ...(placed.terrainReference
              ? {
                  terrainReference: {
                    ...placed.terrainReference,
                    anchor: [
                      (placed.terrainReference.anchor[0] - frame.anchor[0]) *
                        Math.cos((frame.anchor[1] * Math.PI) / 180),
                      placed.terrainReference.anchor[1] - frame.anchor[1],
                    ],
                  },
                }
              : {}),
            bounds: placed.bounds.map((v, i) =>
              i % 2 === 0
                ? (v - frame.anchor[0]) * Math.cos((frame.anchor[1] * Math.PI) / 180)
                : v - frame.anchor[1],
            ),
            minLevel: 0,
          },
        ],
      }),
      structureObjects: objects,
      roads: { renderTransportation: false },
      generator: {
        generate: async (request) => {
          if (request.features?.buildings) {
            seen.push(request.tile.buildings.map((b) => b.id));
            seenPolygons.push(
              request.tile.buildings.map((b) => ({ id: b.id, polygons: b.polygons })),
            );
          }
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
    root = await renderers.humanFeatures.createTile(tile, {
      address: { level: 14, x: 0, z: 0 },
      tileSize: 4000,
      origin: [-2000, -2000],
      pyramid: {
        name: 'segovia_cathedral-native-replacement',
        origin: [-2000, -2000],
        rootSize: 65536000,
        minLevel: 0,
        maxLevel: 14,
        tileResolution: 257,
        height: { min: -10, max: 300 },
        layers: [],
        skirts: false,
      },
      descriptor: {},
      heightfield: field,
      signal: new AbortController().signal,
    });
    const landmark = root?.getObjectByName('structure:' + placed.id);
    expect(landmark).toBeDefined();
    expect(
      landmark.position.y,
      'production renderer uses the single shared native terrain datum',
    ).toBeCloseTo(field.sampleHeight(-19, 58), 2);
    expect(seen.length).toBeGreaterThan(0);
    expect(
      seen.at(-1).sort(),
      JSON.stringify({ remaining: seen.at(-1), owned: target.map((p) => p.id) }),
    ).toEqual(neighbor.map((b) => b.id).sort());
    for (const i of layout.nativeMap.preservedNeighbors)
      expect(neighbor.map((b) => b.id)).toContain('native-' + i);
  } finally {
    if (root) renderers.humanFeatures.disposeTile?.(root);
    renderers.dispose();
    objects.dispose();
  }
}, 30000);
it('rebuilds four exact budgeted tiers with existing shared graphs, no image copies and separate GPU streams', async () => {
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
      for (const graph of [
        'stone_limestone_raw',
        'tile_ceramic',
        'slate',
        'wood_plain',
        'metal_painted',
        'window_punched',
      ])
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
