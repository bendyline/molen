/**
 * Shared loading for the worldgen ops: style packs and region atlases (from a path, or from the
 * content packs a project uses; nothing is built in), batch documents, and the built-in lineup batch
 * (one building of every footprint class) used when a preview has no batch of its own.
 */

import { readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { Pack, PackSet } from '@bendyline/molen-pack';
import { extractPack, PACK_SOURCE_FILE } from '@bendyline/molen-pack/node';
import {
  formatIssues,
  type ProjectManifest,
  validate,
  validateByKind,
} from '@bendyline/molen-schema';
import {
  type ArchStyleDoc,
  type BuildingRequest,
  groundSamplerForBatch,
  type LandmarkDocs,
  type ResolvedStylePack,
  resolveStylePackDocuments,
  type StyleRule,
  type Vec2,
  validateStylePackBundle,
  type WorldgenBatchDoc,
  type WorldgenBatchInput,
} from '@bendyline/molen-worldgen/kernel';
import {
  createPlacesContent,
  type PlacesContent,
  type RegionAtlasDoc,
} from '@bendyline/molen-worldgen-earth/kernel';
import { openContentPack, openProjectPacks, packCacheDir } from '../content';
import { findProjectFile } from '../project';
import { parseJson } from './build';

const MISSING_STYLE_PACK =
  'no style pack: pass --pack <pack.zip | pack directory | stylepack.json>, or list a pack that provides "stylepack" in project.json `packs` or MOLEN_PACKS';
const MISSING_ATLAS =
  'no region atlas: pass --atlas <pack.zip | pack directory | world.atlas.json>, or list a pack that provides "atlas" in project.json `packs` or MOLEN_PACKS';

/** The content packs a worldgen op can draw on: the project's (found from `cwd`) and MOLEN_PACKS. */
export async function contentPacksFor(
  options: { projectPath?: string; cwd?: string } = {},
): Promise<PackSet> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const projectPath =
    options.projectPath !== undefined
      ? resolve(cwd, options.projectPath)
      : await findProjectFile(cwd);
  let project: { dir: string; packs: ProjectManifest['packs'] } | undefined;
  if (projectPath !== undefined) {
    const parsed = validate('project', parseJson(await readFile(projectPath, 'utf8')));
    if (!parsed.ok) throw new Error(parsed.formatted);
    project = { dir: dirname(projectPath), packs: parsed.value.packs };
  }
  return openProjectPacks(project, { cwd });
}

/**
 * A directory holding a pack's files: a pack source directory is used as it is; a built or
 * downloaded pack is extracted once into the cache, keyed by its content hash.
 */
export async function packDirectory(pack: Pack): Promise<string> {
  try {
    if ((await stat(pack.label)).isDirectory()) return pack.label;
  } catch {}
  const dir = join(packCacheDir(), 'extracted', pack.manifest.contentHash.replace('sha256:', ''));
  const done = join(dir, PACK_SOURCE_FILE);
  try {
    await stat(done);
  } catch {
    await extractPack(pack, dir);
  }
  return dir;
}

const isUrl = (path: string): boolean => /^https?:\/\//.test(path);

/** A path that names a content pack (built file, URL, or source directory) rather than a document. */
async function asContentPack(path: string): Promise<Pack | undefined> {
  if (isUrl(path) || path.endsWith('.zip')) return openContentPack(path, process.cwd());
  try {
    if ((await stat(join(path, PACK_SOURCE_FILE))).isFile())
      return openContentPack(path, process.cwd());
  } catch {}
  return undefined;
}

export interface LoadedStylePackFiles {
  pack: ResolvedStylePack;
  /** Directory every pack path resolves against. */
  dir: string;
  path: string;
  /** Landmark models (signs, street furniture) from the pack that provides them, if any. */
  landmarks?: LandmarkDocs;
}

type PackOptions = { projectPath?: string; cwd?: string };

/** Where `role` comes from: the named pack when it provides it, else the project's packs. */
async function providedBy(
  role: string,
  own: Pack | undefined,
  options: PackOptions,
): Promise<{ pack: Pack; path: string } | undefined> {
  const path = own?.manifest.provides[role]?.[0];
  if (own !== undefined && path !== undefined) return { pack: own, path };
  return (await contentPacksFor(options)).provided(role).at(-1);
}

/** A landmark catalog and its model documents, read from a pack. */
async function landmarkDocs(source: { pack: Pack; path: string }): Promise<LandmarkDocs> {
  const base = source.path.slice(0, source.path.lastIndexOf('/') + 1);
  const catalog = await source.pack.readJson<{ models?: Record<string, string> }>(source.path);
  const models: Record<string, unknown> = {};
  for (const [id, path] of Object.entries(catalog.models ?? {})) {
    models[id] = await source.pack.readJson(`${base}${path}`);
  }
  return { catalog, models };
}

async function withLandmarks(
  loaded: LoadedStylePackFiles,
  own: Pack | undefined,
  options: PackOptions,
): Promise<LoadedStylePackFiles> {
  const source = await providedBy('landmarks', own, options);
  return source === undefined ? loaded : { ...loaded, landmarks: await landmarkDocs(source) };
}

async function stylePackAt(path: string): Promise<LoadedStylePackFiles> {
  const dir = dirname(path);
  const root = parseJson(await readFile(path, 'utf8'));
  const pack = await resolveStylePackDocuments(root, async (relative) =>
    parseJson(await readFile(resolve(dir, relative), 'utf8')),
  );
  return { pack, dir, path };
}

async function stylePackIn(content: Pack): Promise<LoadedStylePackFiles> {
  const entry = content.manifest.provides.stylepack?.[0];
  if (entry === undefined) {
    throw new Error(`pack ${content.manifest.id} does not provide a "stylepack"`);
  }
  return stylePackAt(join(await packDirectory(content), ...entry.split('/')));
}

/**
 * Load a style pack from `packPath` (a stylepack.json, a directory holding one, a content pack
 * file, URL or source directory) or, without one, from the content packs the project uses.
 */
export async function loadStylePackFromDisk(
  packPath?: string,
  options: PackOptions = {},
): Promise<LoadedStylePackFiles> {
  if (packPath !== undefined) {
    const content = await asContentPack(packPath);
    if (content !== undefined) return withLandmarks(await stylePackIn(content), content, options);
    let path = resolve(packPath);
    if ((await stat(path)).isDirectory()) path = resolve(path, 'stylepack.json');
    return withLandmarks(await stylePackAt(path), undefined, options);
  }
  const hits = (await contentPacksFor(options)).provided('stylepack');
  const hit = hits[hits.length - 1];
  if (hit === undefined) throw new Error(MISSING_STYLE_PACK);
  return withLandmarks(await stylePackIn(hit.pack), hit.pack, options);
}

/**
 * Landmarks plus the business catalog for mapped places: the catalog from the atlas's content pack
 * when `atlasPath` names one, else from the project's packs. Undefined when either is missing.
 */
export async function loadPlacesFromDisk(
  landmarks: LandmarkDocs | undefined,
  atlasPath?: string,
  options: PackOptions = {},
): Promise<PlacesContent | undefined> {
  if (landmarks === undefined) return undefined;
  const atlasPack = atlasPath !== undefined ? await asContentPack(atlasPath) : undefined;
  const source = await providedBy('businesses', atlasPack, options);
  if (source === undefined) return undefined;
  return createPlacesContent({ landmarks, businesses: await source.pack.readJson(source.path) });
}

async function regionAtlasDoc(raw: unknown): Promise<RegionAtlasDoc> {
  const parsed = validateByKind('region-atlas' as never, raw);
  if (!parsed.ok) throw new Error(parsed.formatted);
  return parsed.value as RegionAtlasDoc;
}

/** Load a region atlas from a file or content pack, or from the project's content packs. */
export async function loadRegionAtlasFromDisk(
  atlasPath?: string,
  options: PackOptions = {},
): Promise<RegionAtlasDoc> {
  if (atlasPath !== undefined) {
    const content = await asContentPack(atlasPath);
    if (content === undefined) {
      return regionAtlasDoc(parseJson(await readFile(resolve(atlasPath), 'utf8')));
    }
    const entry = content.manifest.provides.atlas?.[0];
    if (entry === undefined)
      throw new Error(`pack ${content.manifest.id} does not provide an "atlas"`);
    return regionAtlasDoc(await content.readJson(entry));
  }
  const hits = (await contentPacksFor(options)).provided('atlas');
  const hit = hits[hits.length - 1];
  if (hit === undefined) throw new Error(MISSING_ATLAS);
  return regionAtlasDoc(await hit.pack.readJson(hit.path));
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
