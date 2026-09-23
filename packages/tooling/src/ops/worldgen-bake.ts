/**
 * Bake generated buildings to a static asset: run the worldgen batch generator in Node, encode
 * the mesh as a core glTF binary, and import it through the regular asset pipeline so the
 * result gets a `molen/asset@1` sidecar (bounds, hulls, stats) any scene can reference as a
 * `gltf` renderable. Props and scatter placements are reported, not baked (they are instanced
 * models, not part of the building mesh).
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AssetSidecar } from '@bendyline/molen-schema';
import {
  encodeGlb,
  type GlbMaterialMeta,
  generateWorldgenBatch,
  type MaterialSlot,
  type MeshBuffers,
  type WorldgenBatchDoc,
  type WorldgenStats,
} from '@bendyline/molen-worldgen/kernel';
import { importAsset } from './asset-import';
import { guardOp } from './errors';
import {
  batchInputFromDoc,
  loadBatchDoc,
  loadStylePackFromDisk,
  parseOutline,
} from './worldgen-pack';

export interface WorldgenBakeInput {
  /** A `molen/worldgen-batch@1` document; or give `outline` (+ `styleId`) for one building. */
  batchPath?: string;
  /** "x,z;x,z;..." in meters, one building. */
  outline?: string;
  /** Force every building onto this style id (required with `outline`). */
  styleId?: string;
  /** Style pack manifest or directory (default: the shipped default pack). */
  packPath?: string;
  /** Assets root the baked asset directory is created under. */
  outDir: string;
  /** Asset id (default: the batch name, slugged). */
  id?: string;
  ground?: 'flat' | 'slope';
  /** Replace an existing asset directory. */
  force?: boolean;
  projectPath?: string;
}

export interface WorldgenBakeOutput {
  ok: boolean;
  id?: string;
  dir?: string;
  sidecarPath?: string;
  sidecar?: AssetSidecar;
  stats?: WorldgenStats;
  /** Instanced placements the mesh does not contain (roof props, scatter). */
  placements?: { modelRef: string; count: number }[];
  hash?: string;
  glbBytes?: number;
  warnings?: string[];
  error?: string;
}

const SLOT_ROUGHNESS: Readonly<Record<MaterialSlot, number>> = {
  wall: 0.86,
  roof: 0.92,
  trim: 0.7,
  foundation: 0.95,
  window: 0.25,
  door: 0.75,
};

/** glTF material metadata per mesh group (colors ride in COLOR_0). */
export function glbMaterialsForBuffers(buffers: MeshBuffers): GlbMaterialMeta[] {
  return buffers.groups.map((group) => ({
    name: `${group.slot}:${group.materialRef}`,
    roughness: SLOT_ROUGHNESS[group.slot],
    metallic: 0,
  }));
}

function slug(name: string): string {
  return name
    .toLowerCase()
    .replaceAll(/[^a-z0-9_.]+/g, '_')
    .replaceAll(/^_+|_+$/g, '')
    .replaceAll(/_{2,}/g, '_');
}

export function bakeWorldgen(input: WorldgenBakeInput): Promise<WorldgenBakeOutput> {
  return guardOp(
    (error) => ({ ok: false, error }),
    () => bakeWorldgenImpl(input),
  );
}

async function bakeWorldgenImpl(input: WorldgenBakeInput): Promise<WorldgenBakeOutput> {
  const { pack } = await loadStylePackFromDisk(input.packPath);
  let doc: WorldgenBatchDoc;
  if (input.batchPath !== undefined) {
    doc = await loadBatchDoc(input.batchPath);
  } else if (input.outline !== undefined) {
    if (input.styleId === undefined) {
      return { ok: false, error: 'baking an outline needs --style <style id>' };
    }
    doc = {
      format: 'molen/worldgen-batch@1',
      name: input.id ?? 'worldgen-building',
      ground: { kind: 'flat', height: 0, dx: 0, dz: 0 },
      buildings: [
        {
          identity: `bake:${input.id ?? 'building'}`,
          labels: ['building'],
          outline: parseOutline(input.outline),
          style: input.styleId,
        },
      ],
      tier: 0,
    };
  } else {
    return { ok: false, error: 'provide a batch document or an outline' };
  }
  const batch = batchInputFromDoc(doc, pack, {
    ...(input.styleId !== undefined ? { styleId: input.styleId } : {}),
    ...(input.ground !== undefined ? { ground: input.ground } : {}),
  });
  const output = generateWorldgenBatch(batch);
  if (output.buildings === undefined) {
    return {
      ok: false,
      error: `no building geometry was generated (${output.stats.buildingsSkipped} skipped, ${output.stats.buildingsBoxed} boxed)`,
      stats: output.stats,
    };
  }
  const glb = encodeGlb(output.buildings, glbMaterialsForBuffers(output.buildings));
  const id = slug(input.id ?? doc.name);
  const scratch = await mkdtemp(join(tmpdir(), 'molen-worldgen-bake-'));
  try {
    const glbPath = join(scratch, `${id}.glb`);
    await writeFile(glbPath, glb);
    const imported = await importAsset({
      path: glbPath,
      id,
      outDir: input.outDir,
      optimize: false,
      force: input.force === true,
      ...(input.projectPath !== undefined ? { projectPath: input.projectPath } : {}),
    });
    if (!imported.ok) return { ok: false, error: imported.error ?? 'asset import failed' };
    return {
      ok: true,
      ...(imported.id !== undefined ? { id: imported.id } : {}),
      ...(imported.dir !== undefined ? { dir: imported.dir } : {}),
      ...(imported.sidecarPath !== undefined ? { sidecarPath: imported.sidecarPath } : {}),
      ...(imported.sidecar !== undefined ? { sidecar: imported.sidecar } : {}),
      stats: output.stats,
      placements: output.placements.map((set) => ({ modelRef: set.modelRef, count: set.count })),
      hash: output.hash,
      glbBytes: glb.byteLength,
      ...(imported.warnings !== undefined ? { warnings: imported.warnings } : {}),
    };
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}
