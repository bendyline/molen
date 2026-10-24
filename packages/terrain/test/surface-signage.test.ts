import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Heightfield } from '../src/heightfield';
import { joinTerrainLines } from '../src/line-path';
import type { TerrainPyramidTileLayerContext } from '../src/pyramid-stream';
import { TERRAIN_ROAD_SIGN_PATTERNS } from '../src/road-sign-patterns';
import { terrainRoadSignCatalogSchema } from '../src/road-sign-styles';
import { createTerrainRoadSignObject } from '../src/road-signs';
import { assertTerrainSemanticTile, createEmptyTerrainSemanticTile } from '../src/semantic-types';
import { createTerrainSurfaceObject, disposeTerrainSurfaceObject } from '../src/surface-client';
import { SurfaceNetwork } from '../src/surface-network';
import type { SurfaceSign } from '../src/surface-sign-mesh';
import { postedSpeed } from '../src/surface-signage';
import type { TerrainSignalHead } from '../src/surface-signals';
import { resolveTerrainSurfaceStyle } from '../src/surface-styles';

function context(): TerrainPyramidTileLayerContext {
  return {
    tileSize: 400,
    origin: [0, 0],
    address: { level: 3, x: 0, z: 0 },
    pyramid: { maxLevel: 3 },
    heightfield: new Heightfield(new Float32Array(4), 2, 2, {
      origin: [0, 0],
      worldSize: [400, 400],
      height: { min: 0, max: 1 },
    }),
    signal: new AbortController().signal,
  } as TerrainPyramidTileLayerContext;
}
function road(tile: ReturnType<typeof createEmptyTerrainSemanticTile>, index: number) {
  const feature = tile.transportation[index];
  if (!feature) throw new Error('Missing fixture road');
  return feature;
}

function cross() {
  const tile = createEmptyTerrainSemanticTile();
  tile.transportation = [
    {
      class: 'major_road',
      subclass: 'residential',
      width: 8,
      lines: [
        [
          [0, 0.5],
          [1, 0.5],
        ],
      ],
    },
    {
      class: 'minor_road',
      subclass: 'residential',
      width: 8,
      lines: [
        [
          [0.5, 0],
          [0.5, 1],
        ],
      ],
    },
  ];
  return tile;
}
function freeway() {
  const tile = createEmptyTerrainSemanticTile();
  tile.transportation = [
    {
      class: 'highway',
      subclass: 'motorway',
      oneway: true,
      ref: 'I 90',
      maxspeed: '60 mph',
      lanes: 3,
      width: 11,
      lines: [
        [
          [0.05, 0.4],
          [0.95, 0.4],
        ],
      ],
    },
    {
      class: 'highway',
      subclass: 'motorway_link',
      oneway: true,
      link: true,
      width: 4.5,
      junctionRef: '17B',
      destination: 'Lake City;Downtown',
      lines: [
        [
          [0.6, 0.4],
          [0.75, 0.55],
          [0.95, 0.65],
        ],
      ],
    },
  ];
  return tile;
}
function signs(tile = cross(), options = {}) {
  const object = createTerrainSurfaceObject(tile, context(), options);
  const list = object.userData.roadSigns as SurfaceSign[];
  const stats = object.userData.surfaceStats;
  const mesh = object.getObjectByName('surface:road-signs');
  disposeTerrainSurfaceObject(object);
  return { list, stats, mesh };
}

const profiles = terrainRoadSignCatalogSchema.parse(
  JSON.parse(
    readFileSync(new URL('../../../content/earth/signs/catalog.json', import.meta.url), 'utf8'),
  ),
).profiles;
function profile(id: string) {
  const found = profiles.find((p) => p.id === id);
  if (!found) throw new Error(id);
  return found;
}
describe('road signage', () => {
  it.each([
    'right',
    'left',
  ] as const)('aligns %s-driving stop lines, signal heads and signs with approaching lanes', (drivingSide) => {
    const tile = cross();
    tile.pois = [{ class: 'traffic_signals', point: [0.5, 0.5] }];
    const object = createTerrainSurfaceObject(tile, context(), { drivingSide });
    const side = drivingSide === 'right' ? 1 : -1;
    const heads = object.userData.trafficSignalHeads as TerrainSignalHead[];
    expect(heads).toHaveLength(4);
    for (const head of heads) {
      const [dx, dz] = head.direction;
      expect(((head.x - 200) * dz - (head.z - 200) * dx) * side).toBeGreaterThan(0.5);
    }
    const network = new SurfaceNetwork(tile, 400, resolveTerrainSurfaceStyle());
    const positions = (
      object.getObjectByName('surface:markings') as THREE.Mesh
    ).geometry.getAttribute('position');
    for (const arm of network.junctions.flatMap((j) => j.arms)) {
      const offsets: number[] = [];
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i) - arm.x,
          z = positions.getZ(i) - arm.z;
        const along = x * arm.dx + z * arm.dz;
        const across = x * arm.dz - z * arm.dx;
        if (along > 2.1 && along < 2.5 && Math.abs(across) < 4) offsets.push(across * side);
      }
      expect(offsets.length).toBeGreaterThan(0);
      expect(Math.min(...offsets)).toBeGreaterThan(0.3);
    }
    disposeTerrainSurfaceObject(object);
    tile.pois = [{ class: 'stop', stop: 'all', point: [0.5, 0.5] }];
    const stops = signs(tile, { drivingSide }).list.filter((s) => s.kind === 'stop');
    expect(stops).toHaveLength(4);
    for (const sign of stops) {
      expect(((sign.x - 200) * sign.dz - (sign.z - 200) * sign.dx) * side).toBeGreaterThan(4);
      expect(sign.appearance.drivingSide).toBe(drivingSide);
    }
  });

  it('mirrors the inner motorway edge while preserving mapped one-way sign direction', () => {
    const tile = freeway();
    tile.transportation.length = 1;
    for (const drivingSide of ['right', 'left'] as const) {
      const object = createTerrainSurfaceObject(tile, context(), { drivingSide });
      const mesh = object.getObjectByName('surface:markings') as THREE.Mesh;
      const positions = mesh.geometry.getAttribute('position');
      const colors = mesh.geometry.getAttribute('color');
      const yellowZ: number[] = [];
      for (let i = 0; i < positions.count; i++)
        if (colors.getX(i) > colors.getZ(i) * 2) yellowZ.push(positions.getZ(i));
      expect(yellowZ.length).toBeGreaterThan(0);
      expect(yellowZ.every((z) => (drivingSide === 'left' ? z > 160 : z < 160))).toBe(true);
      for (const sign of object.userData.roadSigns as SurfaceSign[])
        expect(sign.dx).toBeLessThan(-0.99);
      disposeTerrainSurfaceObject(object);
    }
  });
  it('keeps global pattern identities while localizing labels, shapes, driving side and conservative controls', () => {
    const tile = freeway();
    const us = signs(tile, { signProfile: profile('us') }).list;
    const gb = signs(tile, { signProfile: profile('gb') }).list;
    const de = signs(tile, { signProfile: profile('de') }).list;
    expect(gb.map((s) => s.pattern)).toEqual(us.map((s) => s.pattern));
    expect(de.find((s) => s.pattern === 'highway-exit')?.lines[0]).toBe('Ausfahrt 17B');
    expect(gb.find((s) => s.pattern === 'highway-exit')?.lines[0]).toBe('17B');
    const usSpeed = us.find((s) => s.kind === 'speed'),
      gbSpeed = gb.find((s) => s.kind === 'speed');
    if (!usSpeed || !gbSpeed) throw new Error('Missing speed signs');
    expect(usSpeed.z).toBeGreaterThan(160);
    expect(gbSpeed.z).toBeLessThan(160);
    expect(gbSpeed.lines).toEqual(['60', 'MPH']);
    expect(de.find((s) => s.kind === 'speed')?.lines).toEqual(['60', 'MPH']); // No silent unit conversion.
    expect(gbSpeed.appearance.speedSign).toBe('circle');
    expect(signs(cross(), { signProfile: profile('de') }).list).toEqual([]);
    const mapped = cross();
    mapped.pois = [{ class: 'stop', stop: 'all', point: [0.5, 0.5] }];
    const stops = signs(mapped, { signProfile: profile('de') }).list;
    expect(stops).toHaveLength(4);
    expect(stops.every((s) => s.source === 'mapped' && !s.appearance.allWayLabel)).toBe(true);
    expect(
      signs(cross(), { signProfile: profile('de'), details: { inferStopSigns: true } }).list,
    ).toHaveLength(4);
  });
  it('retains uniform mapped panel colours and draws round speed signs rather than rectangle silhouettes', () => {
    const tile = freeway();
    road(tile, 1).destinationColour = 'green';
    const planned = signs(tile, { signProfile: profile('fr') }).list;
    expect(planned.find((s) => s.pattern === 'highway-exit')?.panelColor).toBe('#236346');
    const speed = planned.find((s) => s.kind === 'speed');
    if (!speed) throw new Error('Missing speed sign');
    const circle = createTerrainRoadSignObject(speed, context());
    const face = circle.getObjectByName('surface:road-signs');
    if (!face) throw new Error('Missing sign face');
    const bounds = new THREE.Box3().setFromObject(face);
    const size = bounds.getSize(new THREE.Vector3());
    expect(size.z).toBeCloseTo(size.y, 4); // This sign faces -X, so its face width is Z.
    disposeTerrainSurfaceObject(circle);
    road(tile, 1).destinationColour = 'green;white';
    expect(
      signs(tile, { signProfile: profile('fr') }).list.find((s) => s.kind === 'exit')?.panelColor,
    ).toBeUndefined();
  });
  it('uses four stop signs on a local crossroads despite broad major_road tags', () => {
    const { list, stats, mesh } = signs();
    expect(stats).toMatchObject({ trafficSignals: 0, roadSigns: 4 });
    expect(mesh).toBeDefined();
    for (const sign of list) {
      expect(sign).toMatchObject({ kind: 'stop', allWay: true, source: 'inferred' });
      expect((sign.x - 200) * sign.dx + (sign.z - 200) * sign.dz).toBeGreaterThan(8);
      // Right side of incoming travel, outside the carriageway.
      expect(-(sign.x - 200) * sign.dz + (sign.z - 200) * sign.dx).toBeLessThan(-4);
    }
  });
  it('stops only side streets at an arterial and reserves inferred lights for two arterials', () => {
    const tile = cross();
    Object.assign(road(tile, 0), { subclass: 'primary', width: 12 });
    const side = signs(tile);
    expect(side.stats.trafficSignals).toBe(0);
    expect(side.list).toHaveLength(2);
    expect(side.list.every((s) => !s.allWay && Math.abs(s.dz) > 0.9)).toBe(true);
    Object.assign(road(tile, 1), { subclass: 'secondary', width: 10 });
    expect(signs(tile).stats.trafficSignals).toBe(4);
  });
  it('honors explicit lights, all-way stops, approach stops and yields without inferring extra controls', () => {
    const tile = cross();
    tile.pois = [{ class: 'traffic_signals', point: [0.5, 0.5] }];
    expect(signs(tile).stats).toMatchObject({ trafficSignals: 4, roadSigns: 0 });
    tile.pois = [{ class: 'stop', stop: 'all', point: [0.5, 0.5] }];
    expect(signs(tile).list.every((s) => s.source === 'mapped' && s.allWay)).toBe(true);
    tile.pois = [{ class: 'stop', stop: 'minor', point: [0.5, 0.465] }];
    expect(signs(tile).list).toMatchObject([
      { kind: 'stop', allWay: false, source: 'mapped', dz: -1 },
    ]);
    tile.pois = [{ class: 'give_way', point: [0.465, 0.5] }];
    expect(signs(tile).list).toMatchObject([{ kind: 'yield', dx: -1 }]);
    tile.pois = [{ class: 'traffic_signals', point: [0.5, 0.5], layer: 1 }];
    expect(signs(tile).stats.trafficSignals).toBe(0);
  });
  it('omits outward one-way approaches and grade-separated junctions', () => {
    const tile = cross();
    road(tile, 0).oneway = true;
    const list = signs(tile).list;
    expect(list).toHaveLength(3);
    expect(list.some((s) => s.dx > 0.9)).toBe(false);
    road(tile, 0).bridge = true;
    expect(signs(tile).list).toEqual([]);
  });
  it('places source-backed exit boards before the divergence, and posted speeds with units', () => {
    const { list } = signs(freeway());
    const board = list.find((s) => s.span);
    expect(board).toMatchObject({
      kind: 'guide',
      lines: ['EXIT 17B', 'Lake City', 'Downtown'],
      source: 'mapped',
      dx: -1,
    });
    if (!board) throw new Error('Missing overhead board');
    expect(board.x).toBeLessThan(240);
    expect(board.ground + 7.5 - 1.3).toBeGreaterThan(6);
    expect(list.find((s) => s.kind === 'exit')?.lines[0]).toBe('EXIT 17B');
    expect(list.find((s) => s.kind === 'speed')).toMatchObject({ lines: ['60', 'MPH'], dx: -1 });
  });
  it('never turns a route number into an exit number or fabricates a speed', () => {
    const tile = freeway();
    delete road(tile, 0).maxspeed;
    delete road(tile, 1).junctionRef;
    delete road(tile, 1).destination;
    road(tile, 1).ref = 'I 90';
    const list = signs(tile).list;
    expect(list.find((s) => s.kind === 'exit')).toMatchObject({
      lines: ['EXIT'],
      source: 'inferred',
    });
    expect(list.some((s) => s.kind === 'speed')).toBe(false);
    tile.pois = [
      { class: 'motorway_junction', point: [0.6, 0.4], ref: '42A', exitTo: 'Riverside' },
    ];
    expect(signs(tile).list.find((s) => s.kind === 'exit')?.lines).toEqual([
      'EXIT 42A',
      'Riverside',
    ]);
  });
  it('does not infer exits from on-ramps, neighboring roads or grade-separated crossings', () => {
    const tile = freeway(),
      ramp = road(tile, 1);
    delete ramp.junctionRef;
    delete ramp.destination;
    ramp.lines[0]?.reverse();
    expect(signs(tile).list.some((s) => s.kind === 'exit')).toBe(false);
    ramp.lines[0]?.reverse();
    ramp.layer = 1;
    expect(signs(tile).list.some((s) => s.kind === 'exit')).toBe(false);
  });
  it('obeys style, inference, detail-level and shared fixture limits', () => {
    for (const options of [
      { style: '1910' },
      { style: 'minimal' },
      { details: { roadSigns: false } },
      { details: { maxFixturesPerTile: 0 } },
      { details: { inferStopSigns: false } },
    ])
      expect(signs(cross(), options).list).toEqual([]);
    expect(signs(cross(), { details: { maxFixturesPerTile: 2 } }).list).toHaveLength(2);
    const ctx = context();
    ctx.address.level = 2;
    const object = createTerrainSurfaceObject(freeway(), ctx);
    expect(object.userData.roadSigns).toEqual([]);
    disposeTerrainSurfaceObject(object);
  });
  it('rejects unsupported speed tags and validates signage metadata', () => {
    expect(postedSpeed('50')).toEqual(['50', 'KM/H']);
    expect(postedSpeed('65 mph')).toEqual(['65', 'MPH']);
    for (const value of ['none', 'signals', 'US:urban', '50;70', '50 @ (wet)', '0', 'NaN'])
      expect(postedSpeed(value)).toBeUndefined();
    const tile = freeway();
    assertTerrainSemanticTile(tile);
    Object.assign(road(tile, 0), { maxspeed: 60 });
    expect(() => assertTerrainSemanticTile(tile)).toThrow();
  });
  it('registers every detected pattern, its actual cues and the source road identity', () => {
    const tile = freeway();
    road(tile, 0).id = 'interstate';
    road(tile, 1).id = 'ramp';
    const list = signs(tile).list;
    for (const sign of [...list, ...signs().list]) {
      expect(TERRAIN_ROAD_SIGN_PATTERNS.some((p) => p.id === sign.pattern)).toBe(true);
      expect(sign.evidence.length).toBeGreaterThan(0);
    }
    expect(list.find((s) => s.pattern === 'highway-overhead')).toMatchObject({
      arrow: 'right',
      roadId: 'ramp',
      evidence: expect.arrayContaining(['junction:ref', 'destination', 'connected-departure']),
    });
    expect(list.find((s) => s.pattern === 'freeway-speed')).toMatchObject({
      roadId: 'interstate',
      evidence: ['maxspeed'],
    });
  });
  it('separates only mapped brown destinations, retaining semicolon alignment and known exit numbers', () => {
    const tile = freeway();
    Object.assign(road(tile, 1), {
      destination: 'Lake City;;State Park',
      destinationColour: 'green;;brown',
    });
    const list = signs(tile).list;
    const attraction = list.find((s) => s.pattern === 'attraction');
    expect(attraction).toMatchObject({
      kind: 'attraction',
      lines: ['State Park', 'EXIT 17B'],
      source: 'mapped',
      evidence: expect.arrayContaining(['destination:colour=brown']),
    });
    expect(attraction?.x).toBeLessThan(240);
    expect(list.find((s) => s.pattern === 'highway-exit')?.lines).toEqual([
      'EXIT 17B',
      'Lake City',
    ]);
    delete road(tile, 1).junctionRef;
    expect(signs(tile).list.find((s) => s.pattern === 'attraction')?.lines).toEqual(['State Park']);
    delete road(tile, 1).destinationColour;
    tile.pois = [
      { class: 'tourism', subclass: 'museum', name: 'Nearby Museum', point: [0.5, 0.4] },
    ];
    expect(signs(tile).list.some((s) => s.pattern === 'attraction')).toBe(false);
    road(tile, 1).destinationColour = 'brown';
    delete road(tile, 1).destination;
    expect(signs(tile).list.some((s) => s.pattern === 'attraction')).toBe(false);
  });
  it('renders freeway speed panels larger and shares the batched face geometry with the single-sign API', () => {
    const tile = freeway();
    const sign = signs(tile).list.find((s) => s.pattern === 'freeway-speed');
    if (!sign) throw new Error('Missing speed sign');
    const full = createTerrainSurfaceObject(tile, context());
    const standalone = createTerrainRoadSignObject(sign, context());
    const street = createTerrainRoadSignObject({ ...sign, pattern: 'street-speed' }, context());
    const face = standalone.getObjectByName('surface:road-signs') as THREE.Mesh;
    const streetFace = street.getObjectByName('surface:road-signs') as THREE.Mesh;
    const size = new THREE.Box3().setFromObject(face).getSize(new THREE.Vector3());
    const streetSize = new THREE.Box3().setFromObject(streetFace).getSize(new THREE.Vector3());
    expect(size.y / streetSize.y).toBeCloseTo(1.4, 4);
    const vertices = Array.from(face.geometry.getAttribute('position').array);
    const batch = Array.from(
      (full.getObjectByName('surface:road-signs') as THREE.Mesh).geometry.getAttribute('position')
        .array,
    );
    expect(batch.slice(-vertices.length)).toEqual(vertices);
    for (const object of [full, standalone, street]) disposeTerrainSurfaceObject(object);
  });
  it('never reverses a directed fragment while joining a one-way route', () => {
    expect(
      joinTerrainLines(
        [
          [
            [0, 0],
            [0.5, 0],
          ],
          [
            [1, 0],
            [0.5, 0],
          ],
        ],
        true,
      ),
    ).toHaveLength(2);
    expect(
      joinTerrainLines(
        [
          [
            [0.5, 0],
            [1, 0],
          ],
          [
            [0, 0],
            [0.5, 0],
          ],
        ],
        true,
      ),
    ).toEqual([
      [
        [0, 0],
        [0.5, 0],
        [1, 0],
      ],
    ]);
  });
});
