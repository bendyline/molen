import { z } from 'zod';
import type { ValidationIssue } from './issues';
import { registerSchema } from './registry';

// molen/asset@1 — the per-asset metadata sidecar written by `molen asset import`. The GLB
// itself is opaque binary; the sidecar is the ENGINE-facing contract: bounds + collision
// geometry for headless simulation/physics, and name-level summaries (nodes, clips, materials)
// so agents can reason about an asset without a 3D viewer. Unbounded data (trimesh) lives in
// an external binary; the sidecar stays small (< 16KB typical, 64KB budgeted).

const num = z.number();
const vec3 = z.array(num).length(3);
const containedPath = z
  .string()
  .min(1)
  .regex(/^(?![A-Za-z]:|[/\\])(?!.*\\)(?!.*(?:^|\/)\.\.(?:\/|$)).+$/);
const sha256 = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const MAX_TRIMESH_VERTICES = 1_000_000;
const MAX_TRIMESH_INDICES = 3_000_000;
const MAX_TRIMESH_BYTES = 64 * 1024 * 1024;

export interface AssetBounds {
  aabb: { min: [number, number, number]; max: [number, number, number] };
  sphere: { center: [number, number, number]; radius: number };
}

export interface AssetStats {
  triangles: number;
  vertices: number;
  meshes: number;
  primitives: number;
  materials: number;
  textures: number;
  animations: number;
  sizeBytes: number;
}

export interface AssetHull {
  /** Mesh-bearing node the hull was computed from. */
  node: string;
  /** Flat xyz triples, ≤ 64 vertices, rounded to 1e-4. */
  points: number[];
}

export interface AssetTrimeshHeader {
  /** Sidecar-relative filename of the collision binary. */
  bin: string;
  /** f32le xyz triples. */
  positions: { byteOffset: number; count: number };
  /** u32le triangle indices. */
  indices: { byteOffset: number; count: number };
  /** sha256 of the binary file. */
  hash: string;
}

export interface AssetCollision {
  hulls: AssetHull[];
  trimesh?: AssetTrimeshHeader;
}

export interface AssetSidecar {
  format: 'molen/asset@1';
  id: string;
  kind: 'model' | 'audio';
  files: { main: string; collision?: string; variants: Record<string, string> };
  /** sha256 of files.main. */
  hash: string;
  /** sha256 of the pre-import source file. */
  sourceHash?: string;
  bounds: AssetBounds;
  stats: AssetStats;
  /** Named mesh-bearing nodes (capped; see nodesTruncated). */
  nodes: { name: string; triangles: number }[];
  nodesTruncated: boolean;
  animations: { name: string; durationSec: number; channels: number }[];
  materials: {
    name: string;
    slots: ('baseColor' | 'roughness' | 'metalness' | 'normal' | 'emissive' | 'ao')[];
    doubleSided: boolean;
    alphaMode: 'OPAQUE' | 'MASK' | 'BLEND';
  }[];
  collision: AssetCollision;
  extensionsUsed: string[];
}

// Every field carries a `.describe()` so the emitted JSON Schema documents units: geometry is in
// the asset's own model space (meters, Y-up, as authored in the glTF).
const assetSchema = z.strictObject({
  format: z.literal('molen/asset@1').describe("Format envelope; always 'molen/asset@1'."),
  id: z
    .string()
    .min(1)
    .describe("Asset id referenced by renderable.ref / collider3d.shape.assetId, e.g. 'crate'."),
  kind: z.enum(['model', 'audio']).describe('Asset kind: model (glTF/GLB) or audio.'),
  files: z
    .strictObject({
      main: containedPath.describe('Sidecar-relative path of the main file (the GLB).'),
      collision: containedPath
        .describe('Sidecar-relative path of the collision trimesh binary, if any.')
        .optional(),
      variants: z
        .record(z.string(), containedPath)
        .describe('Variant name to sidecar-relative file path (e.g. LOD or compressed variants).')
        .default({}),
    })
    .describe('Files that make up the asset, relative to the sidecar directory.'),
  hash: sha256.describe("'sha256:<hex>' of files.main."),
  sourceHash: sha256.describe("'sha256:<hex>' of the pre-import source file.").optional(),
  bounds: z
    .strictObject({
      aabb: z
        .strictObject({
          min: vec3.describe('Minimum corner [x, y, z] in meters.'),
          max: vec3.describe('Maximum corner [x, y, z] in meters.'),
        })
        .describe('Axis-aligned bounding box in model space.'),
      sphere: z
        .strictObject({
          center: vec3.describe('Sphere center [x, y, z] in meters.'),
          radius: num.nonnegative().describe('Sphere radius in meters.'),
        })
        .describe('Bounding sphere in model space.'),
    })
    .describe('Model-space bounds (meters, Y-up) for placement, culling, and headless reasoning.'),
  stats: z
    .strictObject({
      triangles: z.int().nonnegative().describe('Total triangle count.'),
      vertices: z.int().nonnegative().describe('Total vertex count.'),
      meshes: z.int().nonnegative().describe('Number of glTF meshes.'),
      primitives: z.int().nonnegative().describe('Number of mesh primitives (draw calls).'),
      materials: z.int().nonnegative().describe('Number of materials.'),
      textures: z.int().nonnegative().describe('Number of textures.'),
      animations: z.int().nonnegative().describe('Number of animation clips.'),
      sizeBytes: z.int().nonnegative().describe('Size of files.main in bytes.'),
    })
    .describe('Size and complexity summary of the asset.'),
  nodes: z
    .array(
      z.strictObject({
        name: z.string().describe('glTF node name (usable as renderable.node).'),
        triangles: z.int().nonnegative().describe('Triangles under this node.'),
      }),
    )
    .describe('Named mesh-bearing nodes (capped; see nodesTruncated).')
    .default([]),
  nodesTruncated: z
    .boolean()
    .describe('True when the nodes list was capped and omits some nodes.')
    .default(false),
  animations: z
    .array(
      z.strictObject({
        name: z.string().describe('Clip name (usable as renderable.animation.clip).'),
        durationSec: num.nonnegative().describe('Clip duration in seconds at speed 1.'),
        channels: z.int().nonnegative().describe('Number of animated channels in the clip.'),
      }),
    )
    .describe('Animation clips in the asset.')
    .default([]),
  materials: z
    .array(
      z.strictObject({
        name: z.string().describe('Material name.'),
        slots: z
          .array(z.enum(['baseColor', 'roughness', 'metalness', 'normal', 'emissive', 'ao']))
          .describe('Texture slots the material binds.')
          .default([]),
        doubleSided: z
          .boolean()
          .describe('Whether the material renders both faces.')
          .default(false),
        alphaMode: z
          .enum(['OPAQUE', 'MASK', 'BLEND'])
          .describe('glTF alpha mode.')
          .default('OPAQUE'),
      }),
    )
    .describe('Materials in the asset (name-level summary).')
    .default([]),
  collision: z
    .strictObject({
      hulls: z
        .array(
          z.strictObject({
            node: z.string().describe('Mesh-bearing node the hull was computed from.'),
            points: z
              .array(num)
              .min(12)
              .max(192)
              .describe(
                'Flat [x, y, z, ...] hull vertices in meters (4..64 points, rounded to 1e-4).',
              ),
          }),
        )
        .describe(
          'Convex hulls, one per mesh-bearing node (used by collider3d shape.type = asset).',
        )
        .default([]),
      trimesh: z
        .strictObject({
          bin: containedPath.describe('Sidecar-relative filename of the collision binary.'),
          positions: z
            .strictObject({
              byteOffset: z
                .int()
                .nonnegative()
                .multipleOf(4)
                .describe('Byte offset of the position block in the binary (4-byte aligned).'),
              count: z
                .int()
                .positive()
                .max(MAX_TRIMESH_VERTICES)
                .describe('Number of vertices (f32le [x, y, z] triples in meters).'),
            })
            .describe('Vertex position block: f32le xyz triples.'),
          indices: z
            .strictObject({
              byteOffset: z
                .int()
                .nonnegative()
                .multipleOf(4)
                .describe('Byte offset of the index block in the binary (4-byte aligned).'),
              count: z
                .int()
                .positive()
                .max(MAX_TRIMESH_INDICES)
                .multipleOf(3)
                .describe('Number of u32le indices (a multiple of 3; three per triangle).'),
            })
            .describe('Triangle index block: u32le indices.'),
          hash: sha256.describe("'sha256:<hex>' of the collision binary."),
        })
        .describe('Exact triangle-mesh collision geometry stored in an external binary.')
        .optional(),
    })
    .describe('Collision geometry for headless physics.'),
  extensionsUsed: z
    .array(z.string())
    .describe('glTF extensions the asset uses (e.g. KHR_draco_mesh_compression).')
    .default([]),
});

function validateAsset(data: unknown): ValidationIssue[] {
  const asset = data as { collision: { hulls: Array<{ points: number[] }> } };
  const issues: ValidationIssue[] = [];
  asset.collision.hulls.forEach((hull, i) => {
    if (hull.points.length % 3 !== 0) {
      issues.push({
        path: `/collision/hulls/${i}/points`,
        code: 'hull_arity',
        message: 'collision hull points must contain complete xyz triples',
      });
    }
  });
  return issues;
}

registerSchema('asset', assetSchema, {
  id: 'molen/asset@1',
  title: 'Asset sidecar',
  description:
    'Per-asset metadata written by `molen asset import`: bounds + collision geometry for headless physics, and name-level node/animation/material summaries for agents.',
  examples: [
    {
      format: 'molen/asset@1',
      id: 'crate',
      kind: 'model',
      files: { main: 'model.glb', variants: {} },
      hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
      bounds: {
        aabb: { min: [-0.5, 0, -0.5], max: [0.5, 1, 0.5] },
        sphere: { center: [0, 0.5, 0], radius: 0.87 },
      },
      stats: {
        triangles: 12,
        vertices: 24,
        meshes: 1,
        primitives: 1,
        materials: 1,
        textures: 0,
        animations: 0,
        sizeBytes: 1024,
      },
      nodes: [{ name: 'Crate', triangles: 12 }],
      nodesTruncated: false,
      animations: [],
      materials: [{ name: 'wood', slots: ['baseColor'], doubleSided: false, alphaMode: 'OPAQUE' }],
      collision: {
        hulls: [
          {
            node: 'Crate',
            points: [
              -0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5, -0.5, 1, -0.5, 0.5, 1, -0.5,
              0.5, 1, 0.5, -0.5, 1, 0.5,
            ],
          },
        ],
      },
      extensionsUsed: [],
    },
  ],
  docsRef: 'schemas/asset.md',
  validate: validateAsset,
});

/**
 * Decode a collision trimesh from its sidecar header + binary bytes. Pure (no fs/WASM) so the
 * kernel/physics side can consume asset collision headlessly.
 */
export function decodeCollisionTrimesh(
  header: AssetTrimeshHeader,
  bin: Uint8Array,
): { positions: Float32Array; indices: Uint32Array } {
  if (bin.byteLength > MAX_TRIMESH_BYTES) {
    throw new Error(`collision binary exceeds the ${MAX_TRIMESH_BYTES}-byte limit`);
  }
  const vertexCount = checkedCount('positions.count', header.positions.count, MAX_TRIMESH_VERTICES);
  if (vertexCount < 3) throw new Error('collision positions must contain at least three vertices');
  const indexCount = checkedCount('indices.count', header.indices.count, MAX_TRIMESH_INDICES);
  if (indexCount % 3 !== 0) throw new Error('collision index count must be a multiple of 3');
  const positionBytes = vertexCount * 3 * 4;
  const indexBytes = indexCount * 4;
  const positionRange = checkedRange(
    'positions',
    header.positions.byteOffset,
    positionBytes,
    bin.byteLength,
  );
  const indexRange = checkedRange('indices', header.indices.byteOffset, indexBytes, bin.byteLength);
  if (positionRange.start < indexRange.end && indexRange.start < positionRange.end) {
    throw new Error('collision positions and indices ranges overlap');
  }
  const view = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  const positions = new Float32Array(vertexCount * 3);
  for (let i = 0; i < positions.length; i++) {
    const value = view.getFloat32(positionRange.start + i * 4, true);
    if (!Number.isFinite(value)) throw new Error(`collision position ${i} is not finite`);
    positions[i] = value;
  }
  const indices = new Uint32Array(indexCount);
  for (let i = 0; i < indices.length; i++) {
    const value = view.getUint32(indexRange.start + i * 4, true);
    if (value >= vertexCount) {
      throw new Error(
        `collision index ${i} references vertex ${value}, but count is ${vertexCount}`,
      );
    }
    indices[i] = value;
  }
  return { positions, indices };
}

function checkedCount(name: string, value: number, max: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > max) {
    throw new Error(`${name} must be a safe integer in 1..${max}, got ${value}`);
  }
  return value;
}

function checkedRange(
  name: string,
  offset: number,
  byteLength: number,
  total: number,
): { start: number; end: number } {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset % 4 !== 0) {
    throw new Error(`${name}.byteOffset must be a nonnegative 4-byte-aligned safe integer`);
  }
  const end = offset + byteLength;
  if (!Number.isSafeInteger(end) || end > total) {
    throw new Error(`${name} range ${offset}..${end} exceeds collision binary length ${total}`);
  }
  return { start: offset, end };
}

/** Encode a collision trimesh to binary + header fields (the writer used by asset import). */
export function encodeCollisionTrimesh(
  positions: Float32Array,
  indices: Uint32Array,
): {
  bin: Uint8Array;
  positions: { byteOffset: number; count: number };
  indices: { byteOffset: number; count: number };
} {
  if (positions.length % 3 !== 0 || positions.length < 9) {
    throw new Error('collision positions must contain at least three complete xyz vertices');
  }
  if (indices.length % 3 !== 0 || indices.length < 3) {
    throw new Error('collision indices must contain complete triangles');
  }
  const vertexCount = checkedCount('positions.count', positions.length / 3, MAX_TRIMESH_VERTICES);
  checkedCount('indices.count', indices.length, MAX_TRIMESH_INDICES);
  for (let i = 0; i < positions.length; i++) {
    if (!Number.isFinite(positions[i])) throw new Error(`collision position ${i} is not finite`);
  }
  for (let i = 0; i < indices.length; i++) {
    if ((indices[i] as number) >= vertexCount) {
      throw new Error(`collision index ${i} is out of bounds: ${indices[i]} >= ${vertexCount}`);
    }
  }
  const posBytes = positions.length * 4;
  if (posBytes + indices.length * 4 > MAX_TRIMESH_BYTES) {
    throw new Error(`collision binary exceeds the ${MAX_TRIMESH_BYTES}-byte limit`);
  }
  const bin = new Uint8Array(posBytes + indices.length * 4);
  const view = new DataView(bin.buffer);
  positions.forEach((v, i) => {
    view.setFloat32(i * 4, v, true);
  });
  indices.forEach((v, i) => {
    view.setUint32(posBytes + i * 4, v, true);
  });
  return {
    bin,
    positions: { byteOffset: 0, count: positions.length / 3 },
    indices: { byteOffset: posBytes, count: indices.length },
  };
}
