import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import type { AssetHull, AssetSidecar } from '@bendyline/molen-schema';
import { encodeCollisionTrimesh, validate } from '@bendyline/molen-schema';
import type { Document, ILogger, Mesh } from '@gltf-transform/core';
import { getBounds, Node, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, quantize, weld } from '@gltf-transform/functions';
import { findProjectFile, updateProjectFile } from '../project';

export interface ImportAssetInput {
  /** Source model file (.glb / .gltf). */
  path: string;
  /** Asset id (default: slugged filename). Dotted ids fall under namespace reservations. */
  id?: string;
  /** Output assets root (default: <project dir>/assets, else ./assets). */
  outDir?: string;
  /** Also extract a whole-asset collision trimesh into collision.bin. */
  trimesh?: boolean;
  /** Skip the normalize pass (dedup/prune/weld/quantize). */
  optimize?: boolean;
  /** Explicit project.json (default: discovered; import still works without one). */
  projectPath?: string;
  /** Directory the discovery starts from (default: process.cwd()). */
  cwd?: string;
  /** Replace files in an existing asset directory. Default false. */
  force?: boolean;
}

export interface ImportAssetOutput {
  ok: boolean;
  id?: string;
  dir?: string;
  sidecarPath?: string;
  sidecar?: AssetSidecar;
  /** True when the asset was registered into a project manifest. */
  registered?: boolean;
  /** The project.json that was (or would have been) updated — always report it. */
  projectPath?: string;
  warnings?: string[];
  error?: string;
}

function sha256(data: Uint8Array | string): string {
  return `sha256:${createHash('sha256').update(data).digest('hex')}`;
}

function slug(name: string): string {
  return name
    .toLowerCase()
    .replaceAll(/[^a-z0-9_.]+/g, '_')
    .replaceAll(/^_+|_+$/g, '')
    .replaceAll(/_{2,}/g, '_');
}

function round4(v: number): number {
  return Math.round(v * 10_000) / 10_000;
}

function transformPoint(m: number[], p: [number, number, number]): [number, number, number] {
  const [x, y, z] = p;
  const w = (m[3] as number) * x + (m[7] as number) * y + (m[11] as number) * z + (m[15] as number);
  const iw = w === 0 ? 1 : 1 / w;
  return [
    ((m[0] as number) * x + (m[4] as number) * y + (m[8] as number) * z + (m[12] as number)) * iw,
    ((m[1] as number) * x + (m[5] as number) * y + (m[9] as number) * z + (m[13] as number)) * iw,
    ((m[2] as number) * x + (m[6] as number) * y + (m[10] as number) * z + (m[14] as number)) * iw,
  ];
}

interface NodeGeometry {
  positions: [number, number, number][];
  indices: number[];
}

/** World-space triangle geometry under a node, preserving each primitive's index accessor. */
function nodeWorldGeometry(node: Node, mesh: Mesh): NodeGeometry {
  const matrix = node.getWorldMatrix() as unknown as number[];
  const positions: [number, number, number][] = [];
  const indices: number[] = [];
  const element: number[] = [0, 0, 0];
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION');
    if (pos === null) continue;
    const base = positions.length;
    const count = pos.getCount();
    for (let i = 0; i < count; i++) {
      // getElement denormalizes quantized (normalized-int) attributes; getArray would not.
      pos.getElement(i, element);
      positions.push(
        transformPoint(matrix, [element[0] as number, element[1] as number, element[2] as number]),
      );
    }
    // Collision trimeshes support triangle-list primitives. Other modes still contribute to
    // bounds/hulls, but are not silently reinterpreted as triangles.
    if (prim.getMode() !== 4) continue;
    const accessor = prim.getIndices();
    if (accessor !== null) {
      for (let i = 0; i < accessor.getCount(); i++) indices.push(base + accessor.getScalar(i));
    } else {
      for (let i = 0; i < count; i++) indices.push(base + i);
    }
  }
  return { positions, indices };
}

function primTriangleCount(mesh: Mesh): number {
  let triangles = 0;
  for (const prim of mesh.listPrimitives()) {
    const indices = prim.getIndices();
    const count =
      indices !== null ? indices.getCount() : (prim.getAttribute('POSITION')?.getCount() ?? 0);
    triangles += Math.floor(count / 3);
  }
  return triangles;
}

const HULL_VERTEX_CAP = 64;

/** Convex hull of a node's world-space vertices; AABB-corner fallback above the vertex cap. */
async function nodeHull(points: [number, number, number][]): Promise<number[]> {
  const aabbHull = (): number[] => {
    const min: [number, number, number] = [Infinity, Infinity, Infinity];
    const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
    for (const p of points) {
      for (let a = 0; a < 3; a++) {
        if ((p[a] as number) < (min[a] as number)) min[a] = p[a] as number;
        if ((p[a] as number) > (max[a] as number)) max[a] = p[a] as number;
      }
    }
    const corners: number[] = [];
    for (const x of [min[0], max[0]]) {
      for (const y of [min[1], max[1]]) {
        for (const z of [min[2], max[2]]) corners.push(round4(x), round4(y), round4(z));
      }
    }
    return corners;
  };
  if (points.length < 4) return aabbHull();
  try {
    const { default: quickhull } = (await import('quickhull3d')) as unknown as {
      default: (pts: number[][]) => number[][];
    };
    const faces = quickhull(points.map((p) => [p[0], p[1], p[2]]));
    const used = new Set<number>();
    for (const face of faces) for (const idx of face) used.add(idx);
    if (used.size > HULL_VERTEX_CAP) return aabbHull();
    const out: number[] = [];
    for (const idx of [...used].sort((a, b) => a - b)) {
      const p = points[idx] as [number, number, number];
      out.push(round4(p[0]), round4(p[1]), round4(p[2]));
    }
    return out;
  } catch {
    return aabbHull(); // degenerate geometry — conservative box
  }
}

/**
 * gltf-transform's default logger narrates through `console.info`/`console.debug`, which land on
 * **stdout** — and under `molen mcp` stdout is the JSON-RPC transport, so one `prune: Removed
 * types...` line corrupts the protocol. Route every level to stderr and drop info/debug: the
 * pass-by-pass narration is noise, warnings and errors are worth keeping.
 */
export const gltfLogger: ILogger = {
  debug: () => {},
  info: () => {},
  warn: (text: string) => {
    process.stderr.write(`${text}\n`);
  },
  error: (text: string) => {
    process.stderr.write(`${text}\n`);
  },
};

/** NodeIO with every extension + decoders registered (shared by import/pack). */
export async function createAssetIO(): Promise<NodeIO> {
  const io = new NodeIO().setLogger(gltfLogger).registerExtensions(ALL_EXTENSIONS);
  const [draco3d, { MeshoptDecoder, MeshoptEncoder }] = await Promise.all([
    import('draco3dgltf'),
    import('meshoptimizer'),
  ]);
  await MeshoptDecoder.ready;
  await MeshoptEncoder.ready;
  io.registerDependencies({
    'draco3d.decoder': await draco3d.default.createDecoderModule(),
    'meshopt.decoder': MeshoptDecoder,
    'meshopt.encoder': MeshoptEncoder,
  });
  return io;
}

function buildStats(doc: Document, sizeBytes: number): AssetSidecar['stats'] {
  const root = doc.getRoot();
  let triangles = 0;
  let vertices = 0;
  let primitives = 0;
  for (const mesh of root.listMeshes()) {
    triangles += primTriangleCount(mesh);
    for (const prim of mesh.listPrimitives()) {
      primitives++;
      vertices += prim.getAttribute('POSITION')?.getCount() ?? 0;
    }
  }
  return {
    triangles,
    vertices,
    meshes: root.listMeshes().length,
    primitives,
    materials: root.listMaterials().length,
    textures: root.listTextures().length,
    animations: root.listAnimations().length,
    sizeBytes,
  };
}

const NODE_CAP = 128;

interface ResolvedImportProject {
  projectPath?: string;
  warning?: string;
  error?: string;
}

/**
 * Pick the project.json an import registers into. The source file's surrounding project is NOT a
 * safe default: `molen asset import ../otherproj/models/key.glb` used to write the asset into
 * `otherproj/` and edit its manifest, leaving the project you were standing in untouched. The
 * current project wins; when the source sits in a *different* project the choice is ambiguous and
 * has to be made explicitly with `--project`.
 */
async function resolveImportProject(
  input: ImportAssetInput,
  sourcePath: string,
): Promise<ResolvedImportProject> {
  if (input.projectPath !== undefined) return { projectPath: resolve(input.projectPath) };
  const cwdProject = await findProjectFile(input.cwd ?? process.cwd());
  const sourceProject = await findProjectFile(dirname(sourcePath));
  if (cwdProject !== undefined) {
    if (sourceProject !== undefined && sourceProject !== cwdProject) {
      return {
        error:
          `ambiguous project: the source file belongs to ${sourceProject} but the current project is ${cwdProject}. ` +
          'Pass --project <project.json> (MCP: projectPath) to say which one to register into.',
      };
    }
    return { projectPath: cwdProject };
  }
  if (sourceProject !== undefined) {
    return {
      projectPath: sourceProject,
      warning: `no project.json above the current directory — registering into the source file's project ${sourceProject}`,
    };
  }
  return {};
}

/**
 * Import a glTF/GLB into the project's asset store: validate + normalize (dedup/prune/weld/
 * quantize; Draco always decoded, never re-encoded — the canonical GLB needs no external
 * decoders), extract bounds + per-node convex hulls (+ optional whole-asset trimesh) for
 * headless physics, write the molen/asset@1 sidecar, and register into project.json.
 */
export async function importAsset(input: ImportAssetInput): Promise<ImportAssetOutput> {
  const warnings: string[] = [];
  try {
    const sourcePath = resolve(input.path);
    // Decide where this import lands before doing any expensive work, so an ambiguous project
    // fails in milliseconds rather than after a full normalize pass.
    const resolved = await resolveImportProject(input, sourcePath);
    if (resolved.error !== undefined) return { ok: false, error: resolved.error };
    const projectPath = resolved.projectPath;
    if (resolved.warning !== undefined) warnings.push(resolved.warning);
    const sourceBytes = new Uint8Array(await readFile(sourcePath));
    const io = await createAssetIO();
    let doc: Document;
    try {
      doc = await io.readBinary(sourceBytes);
    } catch (eBinary) {
      if (extname(sourcePath).toLowerCase() === '.gltf') {
        doc = await io.read(sourcePath);
      } else {
        return {
          ok: false,
          error: `${input.path}: not a readable glTF/GLB — ${(eBinary as Error).message}`,
        };
      }
    }

    // The reader copies the IO's logger onto the Document; set it again so a transform pass can
    // never fall back to the console.log-backed default (see gltfLogger).
    doc.setLogger(gltfLogger);
    if (input.optimize !== false) {
      await doc.transform(dedup(), prune(), weld(), quantize());
    }

    const root = doc.getRoot();
    const extensionsUsed = root.listExtensionsUsed().map((e) => e.extensionName);

    // Collision + node summaries from the post-normalize document (world-space, bind pose).
    // Normalization (quantize) may re-parent a mesh under an unnamed scale node — resolve the
    // author-facing name by walking up to the nearest named ancestor.
    const nodeName = (node: Node, i: number): string => {
      let current: Node | null = node;
      while (current !== null) {
        const name = current.getName();
        if (name.length > 0) return name;
        current =
          (current.listParents().find((parent) => parent instanceof Node) as Node | undefined) ??
          null;
      }
      return `node_${i}`;
    };
    const meshNodes = root
      .listNodes()
      .map((node, i) => ({ node, name: nodeName(node, i) }))
      .filter(({ node }) => node.getMesh() !== null);
    const nodesTruncated = meshNodes.length > NODE_CAP;
    const hulls: AssetHull[] = [];
    const allPoints: [number, number, number][] = [];
    const allIndices: number[] = [];
    const nodeSummaries: { name: string; triangles: number }[] = [];
    for (let nodeIndex = 0; nodeIndex < meshNodes.length; nodeIndex++) {
      const { node, name } = meshNodes[nodeIndex] as (typeof meshNodes)[number];
      const mesh = node.getMesh() as Mesh;
      const geometry = nodeWorldGeometry(node, mesh);
      const base = allPoints.length;
      // Detailed procedural meshes can exceed the engine's function-argument limit.
      for (const point of geometry.positions) allPoints.push(point);
      for (const index of geometry.indices) allIndices.push(base + index);
      if (nodeIndex < NODE_CAP) {
        nodeSummaries.push({ name, triangles: primTriangleCount(mesh) });
        if (geometry.positions.length >= 3) {
          hulls.push({ node: name, points: await nodeHull(geometry.positions) });
        }
      }
    }
    if (meshNodes.length === 0) {
      return { ok: false, error: `${input.path}: no mesh-bearing nodes (nothing to import)` };
    }

    // Bounds: gltf-transform's scene bounds (post-normalize).
    const scene = root.getDefaultScene() ?? root.listScenes()[0];
    if (scene === undefined) return { ok: false, error: `${input.path}: no scene` };
    const { min, max } = getBounds(scene);
    const center: [number, number, number] = [
      (min[0] + max[0]) / 2,
      (min[1] + max[1]) / 2,
      (min[2] + max[2]) / 2,
    ];
    let radiusSq = 0;
    for (const p of allPoints) {
      const dx = p[0] - center[0];
      const dy = p[1] - center[1];
      const dz = p[2] - center[2];
      const d = dx * dx + dy * dy + dz * dz;
      if (d > radiusSq) radiusSq = d;
    }

    const animations = root.listAnimations().map((anim) => {
      let durationSec = 0;
      for (const sampler of anim.listSamplers()) {
        const inputAccessor = sampler.getInput();
        if (inputAccessor === null) continue;
        const inputMax = inputAccessor.getMax([0])[0] ?? 0;
        if (inputMax > durationSec) durationSec = inputMax;
      }
      return {
        name: anim.getName() || 'animation',
        durationSec: round4(durationSec),
        channels: anim.listChannels().length,
      };
    });

    const materials = root.listMaterials().map((m) => {
      const slots: AssetSidecar['materials'][number]['slots'] = [];
      if (m.getBaseColorTexture() !== null || m.getBaseColorFactor() !== null)
        slots.push('baseColor');
      if (m.getMetallicRoughnessTexture() !== null) slots.push('roughness', 'metalness');
      if (m.getNormalTexture() !== null) slots.push('normal');
      if (m.getEmissiveTexture() !== null) slots.push('emissive');
      if (m.getOcclusionTexture() !== null) slots.push('ao');
      return {
        name: m.getName() || 'material',
        slots,
        doubleSided: m.getDoubleSided(),
        alphaMode: m.getAlphaMode() as 'OPAQUE' | 'MASK' | 'BLEND',
      };
    });

    // Layout: assets/<id>/{model.glb, asset.json, collision.bin?}
    const id = slug(input.id ?? basename(sourcePath, extname(sourcePath)));
    if (id.length === 0) return { ok: false, error: 'asset id is empty after slugging' };
    const assetsRoot =
      input.outDir ??
      (projectPath !== undefined
        ? join(dirname(projectPath), 'assets')
        : resolve(input.cwd ?? process.cwd(), 'assets'));
    const dir = join(assetsRoot, id.replaceAll('.', '/'));
    try {
      await stat(dir);
      if (input.force !== true) {
        return {
          ok: false,
          error: `${dir} already exists; choose another id or pass force: true to replace it`,
        };
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    await mkdir(dir, { recursive: true });

    const glb = await io.writeBinary(doc);
    await writeFile(join(dir, 'model.glb'), glb);

    // Optional whole-asset trimesh -> external binary.
    let trimeshHeader: AssetSidecar['collision']['trimesh'];
    let collisionFile: string | undefined;
    if (input.trimesh === true) {
      if (allIndices.length === 0 || allIndices.length % 3 !== 0) {
        return { ok: false, error: `${input.path}: no triangle-list geometry for trimesh` };
      }
      const positions = new Float32Array(allPoints.length * 3);
      allPoints.forEach((p, i) => {
        positions[i * 3] = p[0];
        positions[i * 3 + 1] = p[1];
        positions[i * 3 + 2] = p[2];
      });
      const indices = new Uint32Array(allIndices);
      const encoded = encodeCollisionTrimesh(positions, indices);
      collisionFile = 'collision.bin';
      await writeFile(join(dir, collisionFile), encoded.bin);
      trimeshHeader = {
        bin: collisionFile,
        positions: encoded.positions,
        indices: encoded.indices,
        hash: sha256(encoded.bin),
      };
    }

    const sidecar: AssetSidecar = {
      format: 'molen/asset@1',
      id,
      kind: 'model',
      files: {
        main: 'model.glb',
        ...(collisionFile !== undefined ? { collision: collisionFile } : {}),
        variants: {},
      },
      hash: sha256(glb),
      sourceHash: sha256(sourceBytes),
      bounds: {
        aabb: {
          min: min.map(round4) as [number, number, number],
          max: max.map(round4) as [number, number, number],
        },
        sphere: {
          center: center.map(round4) as [number, number, number],
          radius: round4(Math.sqrt(radiusSq)),
        },
      },
      stats: buildStats(doc, glb.byteLength),
      nodes: nodeSummaries,
      nodesTruncated,
      animations,
      materials,
      collision: { hulls, ...(trimeshHeader !== undefined ? { trimesh: trimeshHeader } : {}) },
      extensionsUsed,
    };
    const checked = validate('asset', sidecar);
    if (!checked.ok)
      return { ok: false, error: `sidecar failed self-validation:\n${checked.formatted}` };
    const sidecarPath = join(dir, 'asset.json');
    await writeFile(sidecarPath, `${JSON.stringify(checked.value, null, 2)}\n`);
    try {
      await stat(sidecarPath);
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }

    // Register into the project manifest when one is present.
    let registered = false;
    if (projectPath !== undefined) {
      const rel = relative(dirname(projectPath), sidecarPath).replaceAll('\\', '/');
      await updateProjectFile(projectPath, (manifest) => {
        manifest.assets[id] = rel;
        return manifest;
      });
      registered = true;
    } else {
      warnings.push(
        `no project.json found — add manually: "assets": { "${id}": "<path-to>/asset.json" }`,
      );
    }

    return {
      ok: true,
      id,
      dir,
      sidecarPath,
      sidecar: checked.value,
      registered,
      ...(projectPath !== undefined ? { projectPath } : {}),
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message, ...(warnings.length > 0 ? { warnings } : {}) };
  }
}
