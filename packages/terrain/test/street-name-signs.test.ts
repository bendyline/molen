import { readFileSync } from 'node:fs';
import { loadFontLibrary } from '@bendyline/molen-materials/text';
import type * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Heightfield } from '../src/heightfield';
import type { TerrainPyramidTileLayerContext } from '../src/pyramid-stream';
import { TERRAIN_ROAD_SIGN_PATTERNS } from '../src/road-sign-patterns';
import {
  streetSignName,
  type TerrainRoadSignProfile,
  terrainRoadSignCatalogSchema,
  terrainRoadSignProfilesSchema,
} from '../src/road-sign-styles';
import { createTerrainRoadSignObject } from '../src/road-signs';
import { createEmptyTerrainSemanticTile, type TerrainSemanticTile } from '../src/semantic-types';
import {
  createTerrainSurfaceObject,
  disposeTerrainSurfaceObject,
  type TerrainSurfaceStats,
} from '../src/surface-client';
import { updateTerrainStreetLights } from '../src/surface-lights';
import { STREET_NAME_MAST, type SurfaceSign, streetNamePanelWidth } from '../src/surface-sign-mesh';
import { type TerrainSignalHead, updateTerrainSurfaceSignals } from '../src/surface-signals';
import type { TerrainSurfaceOptions } from '../src/surface-styles';

const json = (path: string) =>
  JSON.parse(readFileSync(new URL(`../../../content/earth/${path}`, import.meta.url), 'utf8'));
const catalog = terrainRoadSignCatalogSchema.parse(json('signs/catalog.json')).profiles;
const states = terrainRoadSignProfilesSchema.parse(json('signs/us-states.json')).profiles;
const fonts = await loadFontLibrary(json('fonts/catalog.json'), async (path) =>
  json(`fonts/${path}`),
);
function profile(id: string): TerrainRoadSignProfile {
  const found = [...catalog, ...states].find((p) => p.id === id);
  if (!found) throw new Error(id);
  return found;
}
const us = profile('us');
const names = us.streetNames;
if (!names) throw new Error('The U.S. profile posts street names');

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

/** Two local streets (no inferred signal): 45th along X (z = 200), University Way along Z (x = 200). */
function crossing(): TerrainSemanticTile {
  const tile = createEmptyTerrainSemanticTile();
  tile.transportation = [
    {
      id: '45th',
      name: 'Northeast 45th Street',
      class: 'minor_road',
      subclass: 'residential',
      width: 9,
      lines: [
        [
          [0, 0.5],
          [1, 0.5],
        ],
      ],
    },
    {
      id: 'ave',
      name: 'University Way Northeast',
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

function surface(tile: TerrainSemanticTile, options: TerrainSurfaceOptions = {}) {
  const object = createTerrainSurfaceObject(tile, context(), { signProfile: us, ...options });
  const signs = object.userData.roadSigns as SurfaceSign[];
  const heads = object.userData.trafficSignalHeads as TerrainSignalHead[] | undefined;
  const stats = object.userData.surfaceStats as TerrainSurfaceStats;
  const names = object.getObjectByName('surface:street-names') as THREE.Mesh | undefined;
  const boards = object.getObjectByName('surface:road-signs') as THREE.Mesh | undefined;
  const result = {
    signs,
    heads: heads ?? [],
    stats,
    nameDistance: names?.userData.detailDistance as number | undefined,
    boardDistance: boards?.userData.detailDistance as number | undefined,
    nameTriangles: names ? (names.geometry.index?.count ?? 0) / 3 : 0,
  };
  disposeTerrainSurfaceObject(object);
  return result;
}

describe('street-name signs', () => {
  it('abbreviates mapped names as signs post them, leaving a lone direction or type spelled out', () => {
    for (const [name, posted] of [
      ['Northeast 45th Street', 'NE 45th St'],
      ['University Way Northeast', 'University Way NE'],
      ['Brooklyn Avenue Northeast', 'Brooklyn Ave NE'],
      ['Martin Luther King Junior Way South', 'Martin Luther King Jr Way S'],
      ['West Lake Sammamish Parkway Northeast', 'W Lake Sammamish Pkwy NE'],
      ['Saint Andrews Court', 'St Andrews Ct'],
      ['North Street', 'North St'],
      ['Avenue South', 'Avenue S'],
      ['Broadway East', 'Broadway E'],
      ['Broadway', 'Broadway'],
      ['Avenue of the Americas', 'Avenue of the Americas'],
    ] as const)
      expect(streetSignName(names, name)).toBe(posted);
  });

  it('hangs the cross street from each signal mast arm, facing arriving traffic beside the heads', () => {
    const tile = crossing();
    tile.pois = [{ class: 'traffic_signals', point: [0.5, 0.5] }];
    const { signs, heads, stats } = surface(tile);
    const masts = signs.filter((s) => s.pattern === 'street-name-mast');
    expect(masts).toHaveLength(4);
    expect(signs.some((s) => s.pattern === 'street-name-blade')).toBe(false);
    expect(stats.streetNameSigns).toBe(4);
    for (const sign of masts) {
      // An approach along 45th (an X-facing arm) crosses University Way, and the reverse.
      expect(sign.lines).toEqual([Math.abs(sign.dx) > 0.9 ? 'University Way NE' : 'NE 45th St']);
      expect(sign).toMatchObject({ kind: 'street-name', source: 'mapped' });
      expect(sign.evidence).toEqual(['name', 'traffic_signals']);
      const bottom = (sign.hang as number) - STREET_NAME_MAST.height / 2;
      expect(bottom).toBeGreaterThan(6);
      const width = streetNamePanelWidth(sign.lines[0] as string, STREET_NAME_MAST);
      const own = heads.filter((h) => h.direction[0] === sign.dx && h.direction[1] === sign.dz);
      expect(own.length).toBeGreaterThan(0);
      for (const head of own) {
        const across = (head.x - sign.x) * sign.dz - (head.z - sign.z) * sign.dx;
        // Clear of every head's 0.9 m backplate along the arm.
        expect(Math.abs(across)).toBeGreaterThan(width / 2 + 0.45);
        // On the same arm line as the heads.
        expect(Math.abs((head.x - sign.x) * sign.dx + (head.z - sign.z) * sign.dz)).toBeLessThan(
          1e-6,
        );
      }
    }
  });

  it('puts two blades on one corner post where no signal carries the names', () => {
    const { signs, stats, nameDistance, boardDistance } = surface(crossing());
    const blades = signs.filter((s) => s.pattern === 'street-name-blade');
    expect(blades).toHaveLength(1);
    const post = blades[0] as SurfaceSign;
    expect([...post.lines].sort()).toEqual(['NE 45th St', 'University Way NE']);
    // The lower blade runs along its street, so its face looks across it; the upper turns square.
    const along = post.lines[0] === 'NE 45th St' ? [1, 0] : [0, 1];
    expect(Math.abs(post.dx * (along[0] as number) + post.dz * (along[1] as number))).toBeLessThan(
      1e-9,
    );
    expect(Math.abs(Math.cos(post.bladeTurn as number))).toBeLessThan(1e-9);
    // On a corner, outside both carriageways (half-widths 4.5 and 4 m).
    expect(Math.abs(post.z - 200)).toBeGreaterThan(4.5);
    expect(Math.abs(post.x - 200)).toBeGreaterThan(4);
    expect(stats.streetNameSigns).toBe(1);
    // The board signs are unchanged beside it; the names draw nearer in.
    expect(signs.filter((s) => s.kind === 'stop').length).toBeGreaterThan(0);
    expect(nameDistance).toBeLessThan(boardDistance as number);
  });

  it('letters both faces of a blade and only the front of a mast panel', () => {
    const blade = surface(crossing()).signs.find((s) => s.pattern === 'street-name-blade');
    const tile = crossing();
    tile.pois = [{ class: 'traffic_signals', point: [0.5, 0.5] }];
    const mast = surface(tile).signs.find((s) => s.pattern === 'street-name-mast');
    if (!blade || !mast) throw new Error('Missing street-name signs');
    const normals = (sign: SurfaceSign, withFonts: boolean): Set<string> => {
      const object = createTerrainRoadSignObject(sign, context(), withFonts ? { fonts } : {});
      const mesh = object.getObjectByName('surface:street-names') as THREE.Mesh;
      const geometry = mesh.geometry.toNonIndexed();
      const normal = geometry.getAttribute('normal');
      const found = new Set<string>();
      for (let i = 0; i < normal.count; i++)
        found.add(
          [normal.getX(i), normal.getY(i), normal.getZ(i)].map((v) => Math.round(v)).join(','),
        );
      const triangles = geometry.getAttribute('position').count / 3;
      disposeTerrainSurfaceObject(object);
      found.add(`triangles:${triangles}`);
      return found;
    };
    const count = (set: Set<string>): number =>
      Number([...set].find((v) => v.startsWith('triangles:'))?.slice(10));
    // Four facing directions: two blades, each read from both sides.
    const bladeNormals = normals(blade, false);
    expect(
      [...bladeNormals].filter((v) => !v.startsWith('t') && v.split(',')[1] === '0'),
    ).toHaveLength(4);
    // Lettering doubles on a blade (two faces) but not on the panel (one).
    const bladeLetters = count(normals(blade, true)) - count(bladeNormals);
    const mastLetters = count(normals(mast, true)) - count(normals(mast, false));
    expect(bladeLetters).toBeGreaterThan(200);
    expect(mastLetters).toBeGreaterThan(100);
    const glyphs = (sign: SurfaceSign) => sign.lines.join('').replace(/\s/g, '').length;
    expect(bladeLetters / glyphs(blade)).toBeGreaterThan((1.5 * mastLetters) / glyphs(mast));
  });

  it('names nothing without a mapped name, a street-name style, or signs at all', () => {
    const unnamed = crossing();
    for (const road of unnamed.transportation) delete road.name;
    expect(surface(unnamed).stats.streetNameSigns).toBe(0);
    // A compound connector label and a ramp are not street names.
    const compound = crossing();
    (compound.transportation[1] as { name?: string }).name =
      'University Way Northeast & Northeast 45th Street';
    expect(surface(compound).stats.streetNameSigns).toBe(0);
    const signal = crossing();
    signal.pois = [{ class: 'traffic_signals', point: [0.5, 0.5] }];
    const unstyled: TerrainRoadSignProfile = { ...us };
    delete unstyled.streetNames;
    for (const options of [
      { signProfile: unstyled },
      { details: { roadSigns: false } },
      { style: '1910' },
    ] as TerrainSurfaceOptions[]) {
      expect(surface(crossing(), options).stats.streetNameSigns ?? 0).toBe(0);
      expect(surface(signal, options).stats.streetNameSigns ?? 0).toBe(0);
    }
    // Every U.S. state inherits the national style.
    expect(surface(signal, { signProfile: profile('us-wa') }).stats.streetNameSigns).toBe(4);
  });

  it('registers both patterns with the cues they used', () => {
    const signal = crossing();
    signal.pois = [{ class: 'traffic_signals', point: [0.5, 0.5] }];
    const found = [...surface(crossing()).signs, ...surface(signal).signs].filter(
      (s) => s.kind === 'street-name',
    );
    expect(new Set(found.map((s) => s.pattern))).toEqual(
      new Set(['street-name-mast', 'street-name-blade']),
    );
    for (const sign of found) {
      expect(TERRAIN_ROAD_SIGN_PATTERNS.some((p) => p.id === sign.pattern)).toBe(true);
      expect(sign.evidence).toContain('name');
      expect(['45th', 'ave']).toContain(sign.roadId);
    }
  });

  it('keeps one post where a divided road meets the same street at neighboring nodes', () => {
    const tile = crossing();
    // A second, parallel carriageway of 45th, 12 m north.
    tile.transportation.push({
      ...(tile.transportation[0] as (typeof tile.transportation)[number]),
      id: '45th-north',
      width: 7,
      lines: [
        [
          [0, 0.53],
          [1, 0.53],
        ],
      ],
    });
    const blades = surface(tile).signs.filter((s) => s.pattern === 'street-name-blade');
    expect(blades.length).toBeLessThanOrEqual(1);
  });
});

describe('street-name panel width', () => {
  it('fits typical names and bounds long ones', () => {
    const mast = (legend: string) => streetNamePanelWidth(legend, STREET_NAME_MAST);
    expect(mast('NE 45th St')).toBeGreaterThan(1.8);
    expect(mast('NE 45th St')).toBeLessThan(2.3);
    expect(mast('University Way NE')).toBeGreaterThan(mast('NE 45th St'));
    expect(mast('A very long street name that a city would never post overhead')).toBe(4);
    expect(mast('Oak')).toBe(STREET_NAME_MAST.minWidth);
  });
});

describe('regional street-name conventions', () => {
  /** A 12 m building on each corner, its walls 2 m behind the footways' outer edges. */
  function built(): TerrainSemanticTile {
    const tile = crossing();
    const box = (x0: number, z0: number, x1: number, z1: number) => ({
      class: 'building',
      height: 12,
      polygons: [
        {
          outer: [
            [x0 / 400, z0 / 400],
            [x1 / 400, z0 / 400],
            [x1 / 400, z1 / 400],
            [x0 / 400, z1 / 400],
          ] as [number, number][],
        },
      ],
    });
    tile.buildings = [
      box(207.5, 208, 240, 240),
      box(160, 208, 192.5, 240),
      box(207.5, 160, 240, 192),
      box(160, 160, 192.5, 192),
    ];
    return tile;
  }
  const named = (signs: readonly SurfaceSign[]) => signs.filter((s) => s.kind === 'street-name');

  it('fixes a capitalized plate for each street to the corner wall that faces it', () => {
    const { signs } = surface(built(), { signProfile: profile('gb') });
    const plates = named(signs);
    expect(plates).toHaveLength(2);
    for (const plate of plates) {
      expect(plate).toMatchObject({ pattern: 'street-name-wall', mount: 'wall' });
      expect(plate.evidence).toContain('facade');
      // Spelled out, in capitals, facing the street it names from a wall 2 m behind the footway.
      if (plate.lines[0] === 'NORTHEAST 45TH STREET') {
        expect(Math.abs(plate.dz)).toBeGreaterThan(0.99);
        expect((200 - plate.z) * plate.dz).toBeGreaterThan(0);
        expect(Math.abs(Math.abs(plate.z - 200) - 7.94)).toBeLessThan(1e-6);
      } else {
        expect(plate.lines).toEqual(['UNIVERSITY WAY NORTHEAST']);
        expect(Math.abs(plate.dx)).toBeGreaterThan(0.99);
        expect((200 - plate.x) * plate.dx).toBeGreaterThan(0);
        expect(Math.abs(Math.abs(plate.x - 200) - 7.44)).toBeLessThan(1e-6);
      }
    }
    // Both on the same corner building's two walls.
    const [first, second] = plates as [SurfaceSign, SurfaceSign];
    expect(Math.sign(first.x - 200)).toBe(Math.sign(second.x - 200));
    expect(Math.sign(first.z - 200)).toBe(Math.sign(second.z - 200));
  });

  it('stands a plate on a low frame where no wall is near, signals or not', () => {
    const signal = crossing();
    signal.pois = [{ class: 'traffic_signals', point: [0.5, 0.5] }];
    for (const tile of [crossing(), signal]) {
      const plates = named(surface(tile, { signProfile: profile('fr') }).signs);
      expect(plates).toHaveLength(2);
      expect(plates.every((p) => p.mount === 'frame' && p.pattern === 'street-name-wall')).toBe(
        true,
      );
      // At the back of the footway (outer edge 6 m from 45th's centerline, 5.5 m from the
      // avenue's), running along the street it names.
      const street = plates.find((p) => p.lines[0] === 'NORTHEAST 45TH STREET');
      const avenue = plates.find((p) => p.lines[0] === 'UNIVERSITY WAY NORTHEAST');
      expect(Math.abs(Math.abs((street as SurfaceSign).z - 200) - 6)).toBeLessThan(1e-6);
      expect(Math.abs(Math.abs((avenue as SurfaceSign).x - 200) - 5.5)).toBeLessThan(1e-6);
    }
  });

  it('puts taller plates on a corner post, mixed case and unabbreviated, at signals too', () => {
    const signal = crossing();
    signal.pois = [{ class: 'traffic_signals', point: [0.5, 0.5] }];
    for (const tile of [crossing(), signal]) {
      const { signs } = surface(tile, { signProfile: profile('de') });
      expect(signs.some((s) => s.pattern === 'street-name-mast')).toBe(false);
      const posts = named(signs);
      expect(posts).toHaveLength(1);
      expect(posts[0]).toMatchObject({ pattern: 'street-name-blade', mount: 'post' });
      expect([...(posts[0] as SurfaceSign).lines].sort()).toEqual([
        'Northeast 45th Street',
        'University Way Northeast',
      ]);
    }
    // Plates stand taller than blades: compare the two assemblies' lettered faces.
    const span = (id: string): number => {
      const sign = named(surface(crossing(), { signProfile: profile(id) }).signs)[0];
      const object = createTerrainRoadSignObject(sign as SurfaceSign, context());
      const mesh = object.getObjectByName('surface:street-names') as THREE.Mesh;
      mesh.geometry.computeBoundingBox();
      const box = mesh.geometry.boundingBox as THREE.Box3;
      disposeTerrainSurfaceObject(object);
      return box.max.y - box.min.y;
    };
    expect(span('de')).toBeGreaterThan(span('us') * 1.3);
  });

  it('leaves unposted a name its sign font cannot letter', () => {
    const tile = crossing();
    (tile.transportation[0] as { name?: string }).name = '四条通';
    (tile.transportation[1] as { name?: string }).name = '烏丸通';
    const left = profile('generic-left');
    expect(named(surface(tile, { signProfile: left, fonts }).signs)).toEqual([]);
    // Latin names in the same region are posted.
    expect(named(surface(crossing(), { signProfile: left, fonts }).signs)).toHaveLength(1);
  });
});

describe('street signs at night', () => {
  it('lights the lettered faces after dark, sharing their geometry, never the blank backs', () => {
    const object = createTerrainSurfaceObject(crossing(), context(), { signProfile: us, fonts });
    for (const [faces, strength] of [
      ['street-names', 0.85],
      ['road-signs', 0.6],
    ] as const) {
      const mesh = object.getObjectByName(`surface:${faces}`) as THREE.Mesh;
      const glow = object.getObjectByName(`surface:night-${faces}`) as THREE.Mesh;
      const material = glow.material as THREE.MeshBasicMaterial;
      expect(glow.geometry).toBe(mesh.geometry);
      expect(glow.userData.detailDistance).toBe(mesh.userData.detailDistance);
      expect(material.visible).toBe(false);
      updateTerrainStreetLights(object, 1);
      expect(material.visible).toBe(true);
      expect(material.opacity).toBeCloseTo(strength, 6);
      updateTerrainStreetLights(object, 0);
      expect(material.visible).toBe(false);
    }
    const backs = object.getObjectByName('surface:sign-backs') as THREE.Mesh;
    expect(backs).toBeDefined();
    expect(
      object.children.some(
        (child) => child !== backs && (child as THREE.Mesh).geometry === backs.geometry,
      ),
    ).toBe(false);
    disposeTerrainSurfaceObject(object);
  });

  it('rings each lit signal lens with a glow in its color, after dark only', () => {
    const tile = crossing();
    tile.pois = [{ class: 'traffic_signals', point: [0.5, 0.5] }];
    const object = createTerrainSurfaceObject(tile, context(), { signProfile: us });
    const lit = object.getObjectByName('surface:signal-lit') as THREE.InstancedMesh;
    const glow = object.getObjectByName('surface:night-signal-glow') as THREE.InstancedMesh;
    const material = glow.material as THREE.MeshBasicMaterial;
    expect(glow.count).toBe(lit.count);
    expect(material.blending).toBe(2); // THREE.AdditiveBlending
    expect(material.visible).toBe(false);
    updateTerrainStreetLights(object, 1);
    expect(material.visible).toBe(true);
    expect(material.opacity).toBe(1);
    for (const color of ['red', 'green'] as const) {
      updateTerrainSurfaceSignals(object, 0, () => color);
      for (let i = 0; i < lit.count; i++) {
        const litMatrix = lit.instanceMatrix.array.slice(i * 16, i * 16 + 16);
        const glowMatrix = glow.instanceMatrix.array.slice(i * 16, i * 16 + 16);
        // The same lens height, a few millimeters further out toward traffic.
        expect(glowMatrix[13]).toBeCloseTo(litMatrix[13] as number, 6);
        expect(
          Math.hypot(
            (glowMatrix[12] as number) - (litMatrix[12] as number),
            (glowMatrix[14] as number) - (litMatrix[14] as number),
          ),
        ).toBeCloseTo(0.008, 4);
        const shade = glow.instanceColor?.array.slice(i * 3, i * 3 + 3) ?? [];
        const lens = lit.instanceColor?.array.slice(i * 3, i * 3 + 3) ?? [];
        expect([...shade]).toEqual([...lens]);
      }
    }
    disposeTerrainSurfaceObject(object);
  });
});
