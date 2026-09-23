import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import type { AssetSidecar } from '@bendyline/molen-schema';
import { validate } from '@bendyline/molen-schema';
import type { Texture } from '@gltf-transform/core';
import { KHRTextureBasisu } from '@gltf-transform/extensions';
import { getTextureColorSpace, listTextureSlots } from '@gltf-transform/functions';
import { findProjectFile, loadProject } from '../project';
import { createAssetIO } from './asset-import';
import { inspectAsset } from './asset-inspect';
import { guardOp } from './errors';
import { parseJson } from './parse';

// Runtime GLB packing. `molen asset import` writes the design-time canonical GLB (PNG/JPEG
// textures, no decoders needed). This op derives a RUNTIME variant next to it: every texture
// re-encoded as KTX2 (Basis Universal) with a full mip chain, so the GPU receives a compressed
// format (ASTC on iOS/Android, BC7/BC1 on desktop) instead of RGBA8 — 4–8x less texture memory,
// which is what decides whether a scene fits inside a mobile webview's memory budget.
// Color textures (sRGB: baseColor/emissive) use ETC1S (smallest download); data textures
// (normal/roughness/metalness/occlusion) use UASTC (near-lossless, mandatory for normal maps).

export type PackTextureMode = 'etc1s' | 'uastc';

export interface PackAssetInput {
  /** Project asset id, or a sidecar path. Omit with `all: true` to pack every project asset. */
  ref?: string;
  /** Pack every asset registered in the project manifest. */
  all?: boolean;
  projectPath?: string;
  cwd?: string;
  /** Variant name recorded in the sidecar (default "ktx2"); the file is model.<variant>.glb. */
  variant?: string;
  /** Force one codec for every texture; "auto" (default) picks per slot / color space. */
  mode?: 'auto' | PackTextureMode;
  /** Longest texture side after resizing (default 2048). */
  maxSize?: number;
  /** Snap each texture side to the nearest power of two (default true; mip-friendly). */
  powerOfTwo?: boolean;
  /** ETC1S quality 1..255 (default 128). */
  etc1sQuality?: number;
  /** UASTC pack quality 0..4 (default 2; higher is slower and slightly better). */
  uastcQuality?: number;
}

export interface PackedTexture {
  name: string;
  /** Material slots the texture feeds (e.g. baseColorTexture, normalTexture). */
  slots: string[];
  mode: PackTextureMode;
  colorSpace: 'srgb' | 'linear';
  source: { width: number; height: number; bytes: number; mimeType: string };
  packed: { width: number; height: number; bytes: number; levels: number };
}

export interface PackedAsset {
  id: string;
  sidecarPath: string;
  variant: string;
  /** Absolute path of the written variant GLB. */
  path: string;
  textures: PackedTexture[];
  /** File sizes of the canonical main GLB and the packed variant. */
  bytes: { main: number; variant: number };
  /**
   * Estimated GPU texture memory (with mips) before/after: RGBA8 source vs. 8 bits per texel
   * (ASTC 4x4 / BC7). Real ETC1S transcode targets (BC1/ETC1) are half that on some GPUs.
   */
  gpuBytesEstimate: { rgba8: number; compressed: number };
}

export interface PackAssetOutput {
  ok: boolean;
  assets?: PackedAsset[];
  warnings?: string[];
  error?: string;
}

const DEFAULT_VARIANT = 'ktx2';
const DEFAULT_MAX_SIZE = 2048;
const MIN_SIZE = 4;
const NORMAL_SLOT = /normalTexture$/i;
const RASTER_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);
/** Mip chain overhead (sum of 1/4^n). */
const MIP_FACTOR = 4 / 3;

function sha256(data: Uint8Array): string {
  return `sha256:${createHash('sha256').update(data).digest('hex')}`;
}

function nearestPowerOfTwo(v: number): number {
  return 2 ** Math.round(Math.log2(Math.max(1, v)));
}

/** Target dimensions: clamp to maxSize, snap to a power of two (or a multiple of 4). */
export function packedTextureSize(
  width: number,
  height: number,
  opts: { maxSize: number; powerOfTwo: boolean },
): [number, number] {
  const scale = Math.min(1, opts.maxSize / Math.max(width, height));
  let w = Math.max(MIN_SIZE, Math.round(width * scale));
  let h = Math.max(MIN_SIZE, Math.round(height * scale));
  if (opts.powerOfTwo) {
    w = Math.min(opts.maxSize, nearestPowerOfTwo(w));
    h = Math.min(opts.maxSize, nearestPowerOfTwo(h));
  } else {
    w -= w % 4;
    h -= h % 4;
  }
  return [w, h];
}

/** KTX2 container header fields the report needs (identifier 12 bytes, then u32 LE fields). */
export function readKtx2Header(bytes: Uint8Array): {
  width: number;
  height: number;
  levels: number;
} {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    width: view.getUint32(20, true),
    height: view.getUint32(24, true),
    levels: view.getUint32(40, true),
  };
}

interface TextureClass {
  slots: string[];
  mode: PackTextureMode;
  srgb: boolean;
  normal: boolean;
}

function classifyTexture(texture: Texture, mode: PackAssetInput['mode']): TextureClass {
  const slots = listTextureSlots(texture);
  const normal = slots.some((slot) => NORMAL_SLOT.test(slot));
  const srgb = getTextureColorSpace(texture) === 'srgb';
  const chosen: PackTextureMode =
    mode !== undefined && mode !== 'auto' ? mode : srgb && !normal ? 'etc1s' : 'uastc';
  return { slots, mode: chosen, srgb, normal };
}

/**
 * The Basis WASM module narrates every slice through Emscripten's print hook with no option to
 * disable it. Mute every stdout-bound console method for the duration of one encode call: under
 * `molen mcp` stdout is the JSON-RPC transport, so one narrated line corrupts a frame.
 */
async function quietly<T>(fn: () => Promise<T>): Promise<T> {
  const saved = { log: console.log, info: console.info, debug: console.debug };
  console.log = () => {};
  console.info = () => {};
  console.debug = () => {};
  try {
    return await fn();
  } finally {
    console.log = saved.log;
    console.info = saved.info;
    console.debug = saved.debug;
  }
}

function variantFileName(main: string, variant: string): string {
  const ext = extname(main);
  return `${basename(main, ext)}.${variant}${ext}`;
}

/** Pack one or every project asset into a KTX2 runtime variant (see module comment). */
export function packAsset(input: PackAssetInput): Promise<PackAssetOutput> {
  return guardOp(
    (error) => ({ ok: false, error }),
    () => packAssetImpl(input),
  );
}

async function packAssetImpl(input: PackAssetInput): Promise<PackAssetOutput> {
  const warnings: string[] = [];
  const refs: string[] = [];
  const projectPath = input.projectPath ?? (await findProjectFile(input.cwd ?? process.cwd()));
  if (input.all === true) {
    if (projectPath === undefined) return { ok: false, error: 'all: true needs a project.json' };
    const project = await loadProject(projectPath);
    for (const rel of Object.values(project.manifest.assets)) refs.push(join(project.dir, rel));
    if (refs.length === 0) return { ok: false, error: 'the project registers no assets' };
  } else if (input.ref !== undefined) {
    refs.push(input.ref);
  } else {
    return { ok: false, error: 'provide ref (asset id or sidecar path) or all: true' };
  }

  const assets: PackedAsset[] = [];
  for (const ref of refs) {
    const inspected = await inspectAsset({
      ref,
      ...(projectPath !== undefined ? { projectPath } : {}),
    });
    if (!inspected.ok || inspected.sidecar === undefined || inspected.sidecarPath === undefined) {
      return { ok: false, error: inspected.error ?? `asset "${ref}" not found`, warnings };
    }
    if (inspected.sidecar.kind !== 'model') {
      warnings.push(`${inspected.sidecar.id}: kind "${inspected.sidecar.kind}" is not packable`);
      continue;
    }
    const packed = await packOne(inspected.sidecarPath, inspected.sidecar, input, warnings);
    assets.push(packed);
  }
  return { ok: true, assets, ...(warnings.length > 0 ? { warnings } : {}) };
}

async function packOne(
  sidecarPath: string,
  sidecar: AssetSidecar,
  input: PackAssetInput,
  warnings: string[],
): Promise<PackedAsset> {
  const variant = input.variant ?? DEFAULT_VARIANT;
  if (!/^[a-z][a-z0-9_]*$/.test(variant)) {
    throw new Error(`variant "${variant}" must be lower_snake (it becomes a file-name segment)`);
  }
  const sizing = {
    maxSize: input.maxSize ?? DEFAULT_MAX_SIZE,
    powerOfTwo: input.powerOfTwo ?? true,
  };
  if (!Number.isInteger(sizing.maxSize) || sizing.maxSize < MIN_SIZE) {
    throw new Error(`maxSize must be an integer >= ${MIN_SIZE}`);
  }

  const dir = dirname(sidecarPath);
  const mainBytes = new Uint8Array(await readFile(join(dir, sidecar.files.main)));
  const io = await createAssetIO();
  const doc = await io.readBinary(mainBytes);

  // Heavy deps are loaded lazily: sharp is native, the Basis encoder is WASM.
  const [{ default: sharp }, { encodeToKTX2 }] = await Promise.all([
    import('sharp'),
    import('ktx2-encoder'),
  ]);

  const textures: PackedTexture[] = [];
  let rgba8 = 0;
  let compressed = 0;
  let converted = false;
  const list = doc.getRoot().listTextures();
  for (let i = 0; i < list.length; i++) {
    const texture = list[i] as Texture;
    const label = texture.getName() || texture.getURI() || `texture_${i}`;
    const mimeType = texture.getMimeType();
    const image = texture.getImage();
    if (image === null) {
      warnings.push(`${sidecar.id}/${label}: no image data, skipped`);
      continue;
    }
    if (mimeType === 'image/ktx2') continue;
    if (!RASTER_MIME.has(mimeType)) {
      warnings.push(`${sidecar.id}/${label}: mime type "${mimeType}" not packable, skipped`);
      continue;
    }
    const cls = classifyTexture(texture, input.mode);
    let sourceSize: [number, number] = [0, 0];
    const ktx2 = await quietly(() =>
      encodeToKTX2(image, {
        isUASTC: cls.mode === 'uastc',
        isKTX2File: true,
        generateMipmap: true,
        isPerceptual: cls.srgb,
        isSetKTX2SRGBTransferFunc: cls.srgb,
        isNormalMap: cls.normal,
        qualityLevel: input.etc1sQuality ?? 128,
        compressionLevel: 2,
        uastcLDRQualityLevel: input.uastcQuality ?? 2,
        // Zstd supercompression shrinks UASTC downloads ~2x; three's KTX2Loader inflates it.
        needSupercompression: cls.mode === 'uastc',
        imageDecoder: async (buffer: Uint8Array) => {
          const meta = await sharp(buffer).metadata();
          sourceSize = [meta.width ?? 0, meta.height ?? 0];
          const [w, h] = packedTextureSize(sourceSize[0], sourceSize[1], sizing);
          const { data, info } = await sharp(buffer)
            .resize(w, h, { fit: 'fill', kernel: 'lanczos3' })
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });
          return {
            width: info.width,
            height: info.height,
            data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
          };
        },
      }),
    );
    const header = readKtx2Header(ktx2);
    texture.setImage(ktx2).setMimeType('image/ktx2');
    if (texture.getURI() !== '') texture.setURI(texture.getURI().replace(/\.[^.]+$/, '.ktx2'));
    converted = true;
    rgba8 += sourceSize[0] * sourceSize[1] * 4 * MIP_FACTOR;
    compressed += header.width * header.height * MIP_FACTOR;
    textures.push({
      name: label,
      slots: cls.slots,
      mode: cls.mode,
      colorSpace: cls.srgb ? 'srgb' : 'linear',
      source: { width: sourceSize[0], height: sourceSize[1], bytes: image.byteLength, mimeType },
      packed: {
        width: header.width,
        height: header.height,
        bytes: ktx2.byteLength,
        levels: header.levels,
      },
    });
  }
  if (converted) doc.createExtension(KHRTextureBasisu).setRequired(true);
  else warnings.push(`${sidecar.id}: no raster textures to pack (variant written unchanged)`);

  const variantFile = variantFileName(sidecar.files.main, variant);
  const glb = await io.writeBinary(doc);
  const path = join(dir, variantFile);
  await writeFile(path, glb);

  // Record the variant in the sidecar; the canonical main + its hash are untouched.
  const raw = parseJson(await readFile(sidecarPath, 'utf8')) as AssetSidecar;
  raw.files.variants = { ...raw.files.variants, [variant]: variantFile };
  const checked = validate('asset', raw);
  if (!checked.ok) throw new Error(`sidecar failed self-validation:\n${checked.formatted}`);
  await writeFile(sidecarPath, `${JSON.stringify(checked.value, null, 2)}\n`);

  return {
    id: sidecar.id,
    sidecarPath,
    variant,
    path,
    textures,
    bytes: { main: mainBytes.byteLength, variant: glb.byteLength },
    gpuBytesEstimate: { rgba8: Math.round(rgba8), compressed: Math.round(compressed) },
  };
}

/** sha256 of a file — exported for the staging op's rewritten sidecars. */
export async function hashFile(path: string): Promise<string> {
  return sha256(new Uint8Array(await readFile(path)));
}

/** Human-readable byte count for CLI/MCP summaries. */
export function formatBytes(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

/** Human summary of a pack run: per asset, then per texture. */
export function formatPacked(assets: PackedAsset[]): string[] {
  const lines: string[] = [];
  for (const a of assets) {
    lines.push(
      `packed "${a.id}" -> ${a.path}  ${formatBytes(a.bytes.main)} -> ${formatBytes(a.bytes.variant)} on disk, ~${formatBytes(a.gpuBytesEstimate.rgba8)} -> ~${formatBytes(a.gpuBytesEstimate.compressed)} on the GPU`,
    );
    for (const t of a.textures) {
      lines.push(
        `  ${t.name} [${t.slots.join(', ') || 'unused'}] ${t.mode} ${t.colorSpace} ${t.source.width}x${t.source.height} -> ${t.packed.width}x${t.packed.height}, ${t.packed.levels} mips, ${formatBytes(t.source.bytes)} -> ${formatBytes(t.packed.bytes)}`,
      );
    }
  }
  return lines;
}
