import { readFile } from 'node:fs/promises';
import { dirname, join, posix } from 'node:path';
import { figuresScriptApi, installFigures } from '@bendyline/molen-figures/kernel';
import {
  type BuildWorldOptions,
  buildWorld,
  type ResolvedTypes,
  type World,
  type WorldSetup,
} from '@bendyline/molen-kernel';
import { installTerrain, terrainScriptApi } from '@bendyline/molen-kernel/terrain';
import type { ShapeResolvers } from '@bendyline/molen-physics-rapier';
import type { ComponentRegistry, ContentIdentity, SceneManifest } from '@bendyline/molen-schema';
import { decodeCollisionTrimesh, validate, validateByKind } from '@bendyline/molen-schema';
import {
  type Heightfield,
  heightfieldFromPng,
  type TerrainDescriptor,
} from '@bendyline/molen-terrain/kernel';
import type { LoadedScene, ProjectContext } from '../project';
import { parseJson as parse } from './parse';

export { parseJson } from './parse';

/** The scene's terrain, loaded from its `terrain` block: descriptor + heightmap bytes + field. */
export interface SceneTerrain {
  descriptor: TerrainDescriptor;
  /** The raw 16-bit heightmap PNG (what the capture page decodes on its side). */
  png: Uint8Array;
  heightfield: Heightfield;
}

/**
 * Load the terrain a scene references (`scene.terrain`), scene-file-relative: validate the
 * descriptor, read the heightmap, decode it into a Heightfield in Node. Undefined when the scene
 * has no terrain block or no heightmap (a runtime-generated heightmap has no ground service).
 * Throws with a formatted message on an invalid descriptor.
 */
export async function loadSceneTerrain(
  sceneDir: string,
  manifest: SceneManifest,
): Promise<SceneTerrain | undefined> {
  const ref = manifest.terrain;
  if (ref === undefined || ref.heightmap === undefined) return undefined;
  const descriptorRaw = parse(await readFile(join(sceneDir, ref.descriptor), 'utf8'));
  const dv = validateByKind('terrain', descriptorRaw);
  if (!dv.ok) throw new Error(dv.formatted);
  const descriptor = dv.value as TerrainDescriptor;
  const png = new Uint8Array(await readFile(join(sceneDir, ref.heightmap)));
  return { descriptor, png, heightfield: heightfieldFromPng(descriptor, png) };
}

export interface SceneBuildOptions {
  registry?: ComponentRegistry;
  types?: ResolvedTypes;
  /** Physics shape resolvers (asset hulls/trimesh from sidecars); see collisionResolvers. */
  resolvers?: ShapeResolvers;
  /** The scene's terrain (see loadSceneTerrain); becomes the world's ground field. */
  terrain?: SceneTerrain;
  /** Which pack content the world is built from, recorded in keyframes and replays. */
  content?: ContentIdentity;
}

/**
 * Everything a loaded scene needs to build its world: registry types, physics shape resolvers
 * (rapier scenes in a project), and the terrain ground field. The one preamble every scene op
 * shares (sim run, shot, drive, frames).
 */
export async function sceneBuildOptionsFor(loaded: LoadedScene): Promise<SceneBuildOptions> {
  const opts: SceneBuildOptions = { registry: loaded.project?.componentRegistry };
  if (loaded.project?.resolvedTypes !== undefined) opts.types = loaded.project.resolvedTypes;
  if (loaded.project !== undefined && Object.keys(loaded.project.content).length > 0) {
    opts.content = loaded.project.content;
  }
  if (loaded.project !== undefined && loaded.manifest.physics?.engine === 'rapier') {
    opts.resolvers = await collisionResolvers(loaded.project);
  }
  const terrain = await loadSceneTerrain(dirname(loaded.scenePath), loaded.manifest);
  if (terrain !== undefined) opts.terrain = terrain;
  return opts;
}

/** The rapier heightfield resolver convention: `collider3d.shape = { type: 'heightfield', ref: 'scene' }`. */
const SCENE_HEIGHTFIELD_REF = 'scene';

/**
 * The builder every tool uses: `buildWorld` (the kernel's one documented order: data-declared
 * systems → physics hook → terrain hook → setup → the manifest's scripts), async-aware of the
 * scene's `physics` block. Rapier scenes await the WASM init once, then return a SYNC factory
 * (replay/headless runs build worlds repeatedly).
 */
export async function prepareSceneBuilder(
  manifest: SceneManifest,
  setup?: WorldSetup,
  opts?: SceneBuildOptions,
): Promise<() => World> {
  const terrain = opts?.terrain;
  const buildOpts: BuildWorldOptions = {
    registry: opts?.registry,
    ...(opts?.types !== undefined ? { types: opts.types } : {}),
    ...(opts?.content !== undefined ? { content: opts.content } : {}),
    // Figures are always available (an empty query costs nothing): molen.figures.* in scripts.
    capabilities: [(world) => ({ figures: figuresScriptApi(installFigures(world)) })],
    ...(terrain !== undefined
      ? {
          terrain: (world) => ({
            terrain: terrainScriptApi(installTerrain(world, terrain.heightfield)),
          }),
        }
      : {}),
  };
  if (manifest.physics?.engine !== 'rapier') {
    return () => buildWorld(manifest, setup, buildOpts);
  }
  const { initRapier, installScenePhysics, rapierScriptApi } = await import(
    '@bendyline/molen-physics-rapier'
  );
  await initRapier();
  const resolvers: ShapeResolvers = {
    ...(opts?.resolvers ?? {}),
    ...(terrain !== undefined
      ? {
          heightfield: (ref: string) =>
            ref === SCENE_HEIGHTFIELD_REF ? terrain.heightfield.toRapierHeightfield() : undefined,
        }
      : {}),
  };
  return () =>
    buildWorld(manifest, setup, {
      ...buildOpts,
      physics: (world, m) => {
        const handle = installScenePhysics(world, m, resolvers);
        return handle !== undefined ? { physics: rapierScriptApi(handle) } : undefined;
      },
    });
}

/**
 * Preload every registered asset's collision geometry from its sidecar (+ collision.bin) into
 * sync ShapeResolvers for the rapier plugin. Unknown ids resolve to undefined (plugin errors
 * with a pointed message).
 */
export async function collisionResolvers(project: ProjectContext): Promise<ShapeResolvers> {
  const hulls = new Map<string, Float32Array[]>();
  const trimeshes = new Map<string, { vertices: Float32Array; indices: Uint32Array }>();
  for (const [id, rel] of Object.entries(project.manifest.assets)) {
    try {
      const sidecarPath = join(project.dir, rel);
      const parsed = validate('asset', parse(await readFile(sidecarPath, 'utf8')));
      if (!parsed.ok) continue;
      const sidecar = parsed.value;
      hulls.set(
        id,
        sidecar.collision.hulls.map((h) => new Float32Array(h.points)),
      );
      if (sidecar.collision.trimesh !== undefined) {
        const bin = new Uint8Array(
          await readFile(join(dirname(sidecarPath), sidecar.collision.trimesh.bin)),
        );
        const decoded = decodeCollisionTrimesh(sidecar.collision.trimesh, bin);
        trimeshes.set(id, { vertices: decoded.positions, indices: decoded.indices });
      }
    } catch {
      // unreadable sidecar — the plugin reports unresolved shapes with the asset id
    }
  }
  return {
    asset: (assetId, kind, index) => {
      if (kind === 'trimesh') return trimeshes.get(assetId);
      const assetHulls = hulls.get(assetId);
      const points = assetHulls?.[index ?? 0];
      return points !== undefined ? { points } : undefined;
    },
  };
}

/**
 * Resolve asset ids to their sidecar-declared primary files for browser renderers. With
 * `variant`, a packed variant (molen asset pack) replaces the main file where present.
 */
export async function assetFileIndex(
  project: ProjectContext,
  opts: { variant?: string } = {},
): Promise<Record<string, string>> {
  const index: Record<string, string> = Object.create(null) as Record<string, string>;
  for (const [id, rel] of Object.entries(project.manifest.assets)) {
    const sidecarPath = join(project.dir, rel);
    const parsed = validate('asset', parse(await readFile(sidecarPath, 'utf8')));
    if (!parsed.ok) throw new Error(`${sidecarPath}: ${parsed.formatted}`);
    const sidecarDir = posix.dirname(rel.replaceAll('\\', '/'));
    const variantFile =
      opts.variant !== undefined ? parsed.value.files.variants[opts.variant] : undefined;
    index[id] = posix.join(sidecarDir, variantFile ?? parsed.value.files.main);
  }
  return index;
}
