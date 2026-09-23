/**
 * Shared loading for the worldgen ops: style packs and region atlases from disk (defaulting to
 * the packs shipped with the worldgen packages), batch documents, and the built-in lineup batch
 * (one building of every footprint class) used when a preview has no batch of its own.
 */

import { readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { formatIssues, validateByKind } from '@bendyline/molen-schema';
import {
  type ArchStyleDoc,
  type BuildingRequest,
  groundSamplerForBatch,
  type ResolvedStylePack,
  resolveStylePackDocuments,
  type StyleRule,
  type Vec2,
  validateStylePackBundle,
  type WorldgenBatchDoc,
  type WorldgenBatchInput,
} from '@bendyline/molen-worldgen/kernel';
import type { RegionAtlasDoc } from '@bendyline/molen-worldgen-earth/kernel';
import { parseJson } from './build';

const require = createRequire(import.meta.url);

/** The default style pack shipped with `@bendyline/molen-worldgen`. */
export function defaultStylePackPath(): string {
  return require.resolve('@bendyline/molen-worldgen/packs/default/stylepack.json');
}

/** The default region atlas shipped with `@bendyline/molen-worldgen-earth`. */
export function defaultRegionAtlasPath(): string {
  return require.resolve('@bendyline/molen-worldgen-earth/packs/default/world.atlas.json');
}

export interface LoadedStylePackFiles {
  pack: ResolvedStylePack;
  /** Directory every pack path resolves against. */
  dir: string;
  path: string;
}

/** Load a pack from `stylepack.json` (or its directory); default: the shipped default pack. */
export async function loadStylePackFromDisk(packPath?: string): Promise<LoadedStylePackFiles> {
  let path = packPath !== undefined ? resolve(packPath) : defaultStylePackPath();
  if ((await stat(path)).isDirectory()) path = resolve(path, 'stylepack.json');
  const dir = dirname(path);
  const root = parseJson(await readFile(path, 'utf8'));
  const pack = await resolveStylePackDocuments(root, async (relative) =>
    parseJson(await readFile(resolve(dir, relative), 'utf8')),
  );
  return { pack, dir, path };
}

export async function loadRegionAtlasFromDisk(atlasPath?: string): Promise<RegionAtlasDoc> {
  const path = atlasPath !== undefined ? resolve(atlasPath) : defaultRegionAtlasPath();
  const parsed = validateByKind('region-atlas' as never, parseJson(await readFile(path, 'utf8')));
  if (!parsed.ok) throw new Error(parsed.formatted);
  return parsed.value as RegionAtlasDoc;
}

export async function loadArchStyleFromDisk(stylePath: string): Promise<ArchStyleDoc> {
  const parsed = validateByKind(
    'archstyle' as never,
    parseJson(await readFile(resolve(stylePath), 'utf8')),
  );
  if (!parsed.ok) throw new Error(parsed.formatted);
  return parsed.value as ArchStyleDoc;
}

export async function loadBatchDoc(batchPath: string): Promise<WorldgenBatchDoc> {
  const parsed = validateByKind(
    'worldgen-batch' as never,
    parseJson(await readFile(resolve(batchPath), 'utf8')),
  );
  if (!parsed.ok) throw new Error(parsed.formatted);
  return parsed.value as WorldgenBatchDoc;
}

/** A pack copy with one extra (or replaced) style; its material and model refs must resolve. */
export function withArchStyle(pack: ResolvedStylePack, style: ArchStyleDoc): ResolvedStylePack {
  const next: ResolvedStylePack = {
    ...pack,
    archstyles: { ...pack.archstyles, [style.id]: style },
    root: { ...pack.root, styles: { ...pack.root.styles, [style.id]: `${style.id}.json` } },
  };
  const blocking = validateStylePackBundle(next).filter((issue) => issue.severity !== 'notice');
  if (blocking.length > 0) throw new Error(formatIssues(`style "${style.id}"`, blocking));
  return next;
}

export type LineupShape =
  | 'rect'
  | 'rotated-rect'
  | 'L'
  | 'U'
  | 'H'
  | 'T'
  | 'Z'
  | 'plus'
  | 'courtyard'
  | 'irregular';

export const LINEUP_SHAPES: readonly LineupShape[] = [
  'rect',
  'rotated-rect',
  'L',
  'U',
  'H',
  'T',
  'Z',
  'plus',
  'courtyard',
  'irregular',
];

const LINEUP_LABELS: Readonly<Record<LineupShape, string[]>> = {
  rect: ['house', 'building'],
  'rotated-rect': ['house', 'building'],
  L: ['house', 'building'],
  U: ['house', 'building'],
  H: ['school', 'building'],
  T: ['house', 'building'],
  Z: ['house', 'building'],
  plus: ['church', 'building'],
  courtyard: ['apartments', 'building'],
  irregular: ['commercial', 'building'],
};

/** Unit shapes in [-1, 1]²; `w` is the wing thickness fraction. */
function unitShape(shape: LineupShape, w = 0.4): Vec2[][] {
  switch (shape) {
    case 'rect':
    case 'rotated-rect':
      return [
        [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ],
      ];
    case 'L':
      return [
        [
          [-1, -1],
          [1, -1],
          [1, -1 + 2 * w],
          [-1 + 2 * w, -1 + 2 * w],
          [-1 + 2 * w, 1],
          [-1, 1],
        ],
      ];
    case 'U':
      return [
        [
          [-1, -1],
          [1, -1],
          [1, 1],
          [1 - 2 * w, 1],
          [1 - 2 * w, -1 + 2 * w],
          [-1 + 2 * w, -1 + 2 * w],
          [-1 + 2 * w, 1],
          [-1, 1],
        ],
      ];
    case 'H':
      return [
        [
          [-1, -1],
          [-1 + 2 * w, -1],
          [-1 + 2 * w, -w],
          [1 - 2 * w, -w],
          [1 - 2 * w, -1],
          [1, -1],
          [1, 1],
          [1 - 2 * w, 1],
          [1 - 2 * w, w],
          [-1 + 2 * w, w],
          [-1 + 2 * w, 1],
          [-1, 1],
        ],
      ];
    case 'T':
      return [
        [
          [-1, -1],
          [1, -1],
          [1, -1 + 2 * w],
          [w, -1 + 2 * w],
          [w, 1],
          [-w, 1],
          [-w, -1 + 2 * w],
          [-1, -1 + 2 * w],
        ],
      ];
    case 'Z':
      return [
        [
          [-1, -1],
          [2 * w - 0.2, -1],
          [2 * w - 0.2, -w],
          [1, -w],
          [1, 1],
          [-2 * w + 0.2, 1],
          [-2 * w + 0.2, w],
          [-1, w],
        ],
      ];
    case 'plus':
      return [
        [
          [-w, -1],
          [w, -1],
          [w, -w],
          [1, -w],
          [1, w],
          [w, w],
          [w, 1],
          [-w, 1],
          [-w, w],
          [-1, w],
          [-1, -w],
          [-w, -w],
        ],
      ];
    case 'courtyard':
      return [
        [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ],
        [
          [-1 + 2 * w, -1 + 2 * w],
          [-1 + 2 * w, 1 - 2 * w],
          [1 - 2 * w, 1 - 2 * w],
          [1 - 2 * w, -1 + 2 * w],
        ],
      ];
    default:
      return [
        [
          [-1, -0.6],
          [-0.2, -1],
          [1, -0.7],
          [0.8, 0.6],
          [0.1, 1],
          [-0.7, 0.8],
        ],
      ];
  }
}

/** One of each footprint class in a row along +x (40 m apart), generic labels, flat ground. */
export function lineupBatchDoc(spacing = 40): WorldgenBatchDoc {
  const buildings: BuildingRequest[] = LINEUP_SHAPES.map((shape, index) => {
    const half = shape === 'courtyard' || shape === 'H' || shape === 'irregular' ? 15 : 10;
    const angle = shape === 'rotated-rect' ? 0.6 : 0;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const cx = (index - (LINEUP_SHAPES.length - 1) / 2) * spacing;
    const rings = unitShape(shape).map((ring) =>
      ring.map(([x, z]): Vec2 => {
        const sx = x * half;
        const sz = z * half * (shape === 'rect' ? 0.7 : 1);
        return [
          Math.round((cx + sx * c - sz * s) * 1000) / 1000,
          Math.round((sx * s + sz * c) * 1000) / 1000,
        ];
      }),
    );
    const [outline, ...holes] = rings as [Vec2[], ...Vec2[][]];
    return {
      identity: `lineup:${shape}`,
      labels: LINEUP_LABELS[shape],
      outline,
      ...(holes.length > 0 ? { holes } : {}),
      ...(shape === 'irregular' ? { height: 14 } : {}),
    };
  });
  return {
    format: 'molen/worldgen-batch@1',
    name: 'lineup',
    ground: { kind: 'flat', height: 0, dx: 0, dz: 0 },
    buildings,
    tier: 0,
  };
}

export interface BatchInputOptions {
  /** Force every building onto one style id. */
  styleId?: string;
  scatterId?: string;
  ground?: 'flat' | 'slope';
}

/** Turn a batch document into generator input against a pack. */
export function batchInputFromDoc(
  doc: WorldgenBatchDoc,
  pack: ResolvedStylePack,
  options: BatchInputOptions = {},
): WorldgenBatchInput {
  if (options.styleId !== undefined && pack.archstyles[options.styleId] === undefined) {
    throw new Error(
      `style "${options.styleId}" is not in the pack (styles: ${Object.keys(pack.archstyles).join(', ')})`,
    );
  }
  const ground =
    options.ground === 'slope'
      ? { kind: 'slope' as const, height: 0, dx: 0.12, dz: 0.05 }
      : options.ground === 'flat'
        ? { kind: 'flat' as const, height: 0, dx: 0, dz: 0 }
        : doc.ground;
  const rules: StyleRule[] = doc.rules ?? [];
  return {
    buildings: doc.buildings.map((building) =>
      options.styleId !== undefined ? { ...building, style: options.styleId } : building,
    ),
    ...(doc.scatter !== undefined ? { scatter: doc.scatter } : {}),
    ...(doc.props !== undefined ? { props: doc.props } : {}),
    ground: groundSamplerForBatch(ground),
    pack,
    rules,
    ...(doc.fallbackStyle !== undefined ? { fallbackStyle: doc.fallbackStyle } : {}),
    ...(options.scatterId !== undefined
      ? { scatterId: options.scatterId }
      : doc.scatterId !== undefined
        ? { scatterId: doc.scatterId }
        : {}),
    tier: doc.tier,
    ...(doc.interiors !== undefined ? { interiors: doc.interiors } : {}),
  };
}

/** Parse "x,z;x,z;..." into an outline (meters). */
export function parseOutline(text: string): Vec2[] {
  const points = text
    .split(';')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry): Vec2 => {
      const parts = entry.split(',').map(Number);
      if (parts.length !== 2 || parts.some((value) => !Number.isFinite(value))) {
        throw new Error(`outline point "${entry}" must be "x,z"`);
      }
      return [parts[0] as number, parts[1] as number];
    });
  if (points.length < 3) throw new Error('an outline needs at least three "x,z" points');
  return points;
}
