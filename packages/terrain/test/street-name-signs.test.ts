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
import { STREET_NAME_MAST, type SurfaceSign, streetNamePanelWidth } from '../src/surface-sign-mesh';
import type { TerrainSignalHead } from '../src/surface-signals';
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

  it('names nothing without a mapped name, a regional style, or signs at all', () => {
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
    for (const options of [
      { signProfile: profile('de') },
      { signProfile: profile('generic') },
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
