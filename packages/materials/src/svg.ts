import { assertImageDimensions, type BakedMaterial, createImage, type RGBAImage } from './types';

// SVG → raster rung (rung 3, docs/06 §3). Single rasterizer (resvg-wasm) for byte-identical
// output in Node, the browser and CI. Text must be outlined to paths (no fonts ship with the
// engine).
//
// The resvg JS glue is a plain import and *is* bundled — only its .wasm has to be supplied at
// runtime. A browser (or worker, or Deno) caller hands initSvg the bytes or a URL; in Node,
// initSvg() with no argument finds the .wasm beside the resvg package. That Node path builds its
// `node:` specifiers at runtime on purpose: a literal import('node:fs/promises') is statically
// analysable, so esbuild refuses to bundle this package for platform:'browser', webpack 5 errors
// on the unresolved builtin and Vite substitutes a throwing stub — all for a branch a browser
// never reaches. Keep the specifiers computed.

export interface SvgMeta {
  /** Output raster size; defaults to 512×512 (POT). */
  rasterSize?: [number, number];
}

/**
 * Structural stand-in for the global `URL` — this package declares no DOM or Node lib types, so a
 * real `URL` (or anything else carrying an `href`) matches it.
 */
export interface SvgWasmUrl {
  readonly href: string;
}

/**
 * Where the resvg WASM module comes from: raw bytes (`Uint8Array`/`ArrayBuffer`) or a URL —
 * a `URL` object or a plain string — that is fetched. Browsers and other non-Node runtimes must
 * supply one; Node loads its own by default.
 */
export type SvgWasmSource = ArrayBuffer | ArrayBufferView | SvgWasmUrl | string;

interface ResvgModule {
  initWasm(source: ArrayBuffer | ArrayBufferView | string): Promise<void>;
  Resvg: new (
    svg: string,
    opts: { fitTo: { mode: 'width'; value: number } },
  ) => { render(): { width: number; height: number; pixels: Uint8Array } };
}

// Assembled at runtime (Array#join is not constant-folded), so no bundler ever sees a `node:`
// specifier it would try — and fail — to resolve.
const NODE_SCHEME = ['node', ':'].join('');

/** Import a Node builtin through a specifier no bundler can resolve at build time. */
async function importNodeBuiltin<T>(name: string): Promise<T> {
  const specifier = `${NODE_SCHEME}${name}`;
  return (await import(/* @vite-ignore */ /* webpackIgnore: true */ specifier)) as T;
}

function isNode(): boolean {
  const proc = (globalThis as { process?: { versions?: { node?: unknown } } }).process;
  return typeof proc?.versions?.node === 'string';
}

/** Node fallback: read the .wasm shipped inside @resvg/resvg-wasm, wherever it was installed. */
async function nodeWasmBytes(): Promise<ArrayBufferView> {
  const { createRequire } = await importNodeBuiltin<{
    createRequire: (url: string) => { resolve: (id: string) => string };
  }>('module');
  const require = createRequire((import.meta as { url: string }).url);
  const wasmPath = require.resolve('@resvg/resvg-wasm/index_bg.wasm');
  const { readFile } = await importNodeBuiltin<{
    readFile: (path: string) => Promise<ArrayBufferView>;
  }>('fs/promises');
  return readFile(wasmPath);
}

async function resolveWasm(
  source: SvgWasmSource | undefined,
): Promise<ArrayBuffer | ArrayBufferView | string> {
  if (typeof source === 'string') return source;
  // A URL (or any href-carrying stand-in) is normalized to its string form: resvg fetches it.
  if (source !== undefined && 'href' in source) return source.href;
  if (source !== undefined) return source;
  if (!isNode()) {
    throw new Error(
      'initSvg() needs the resvg WASM outside Node — pass it explicitly, e.g. ' +
        "initSvg(new URL('@resvg/resvg-wasm/index_bg.wasm', import.meta.url)) or " +
        'initSvg(await (await fetch(wasmUrl)).arrayBuffer())',
    );
  }
  return nodeWasmBytes();
}

let initPromise: Promise<ResvgModule> | undefined;

async function loadResvg(source?: SvgWasmSource): Promise<ResvgModule> {
  if (initPromise === undefined) {
    const pending = (async () => {
      const mod = (await import('@resvg/resvg-wasm')) as unknown as ResvgModule;
      await mod.initWasm(await resolveWasm(source));
      return mod;
    })();
    initPromise = pending;
    // A failed init must not poison the cache: a browser that called bakeSvg before initSvg has
    // to be able to retry once it has the bytes.
    pending.catch(() => {
      if (initPromise === pending) initPromise = undefined;
    });
  }
  return initPromise;
}

/**
 * Initialize the resvg WASM runtime. Idempotent: the first successful call wins and later calls
 * (with or without a source) resolve against it.
 *
 * @param wasm Explicit WASM source — bytes (`Uint8Array`/`ArrayBuffer`) or a URL to fetch
 * (a `URL` or a string). Required in the browser and in any other non-Node runtime; omit it in
 * Node to load the copy shipped with `@resvg/resvg-wasm`.
 */
export async function initSvg(wasm?: SvgWasmSource): Promise<void> {
  await loadResvg(wasm);
}

/** Rasterize an SVG document to a baseColor texture. Requires initSvg() first outside Node. */
export async function bakeSvg(svgText: string, meta: SvgMeta = {}): Promise<BakedMaterial> {
  const { Resvg } = await loadResvg();
  if (/<text[\s/>]/.test(svgText)) {
    throw new Error(
      'SVG <text> is unsupported — convert text to paths before import (no fonts ship with the engine)',
    );
  }
  const width = meta.rasterSize?.[0] ?? 512;
  const height = meta.rasterSize?.[1] ?? 512;
  assertImageDimensions(width, height);
  // Give resvg an explicit target aspect ratio. Its fitTo API accepts one axis, so leaving the
  // source root untouched would silently ignore rasterSize[1].
  const sizedSvg = svgText.replace(/<svg\b([^>]*)>/i, (_match, attrs: string) => {
    const clean = attrs.replace(
      /\s(?:width|height|preserveAspectRatio)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,
      '',
    );
    return `<svg${clean} width="${width}" height="${height}" preserveAspectRatio="none">`;
  });
  const resvg = new Resvg(sizedSvg, { fitTo: { mode: 'width', value: width } });
  const rendered = resvg.render();
  const source = new Uint8ClampedArray(rendered.pixels);
  const img =
    rendered.width === width && rendered.height === height
      ? { width, height, data: source }
      : resizeRgba(source, rendered.width, rendered.height, width, height);
  const data = img.data;
  let hasAlpha = false;
  for (let i = 3; i < data.length; i += 4) {
    if ((data[i] as number) < 255) {
      hasAlpha = true;
      break;
    }
  }
  return {
    slots: { baseColor: img },
    meta: { filter: 'linear', ...(hasAlpha ? { alphaTest: 0.5 } : {}) },
  };
}

function resizeRgba(
  source: Uint8ClampedArray,
  sourceWidth: number,
  sourceHeight: number,
  width: number,
  height: number,
): RGBAImage {
  assertImageDimensions(sourceWidth, sourceHeight);
  if (source.length !== sourceWidth * sourceHeight * 4) {
    throw new Error('SVG rasterizer returned an invalid pixel buffer');
  }
  const out = createImage(width, height);
  for (let y = 0; y < height; y++) {
    const sy = Math.min(sourceHeight - 1, Math.floor(((y + 0.5) * sourceHeight) / height));
    for (let x = 0; x < width; x++) {
      const sx = Math.min(sourceWidth - 1, Math.floor(((x + 0.5) * sourceWidth) / width));
      const from = (sy * sourceWidth + sx) * 4;
      const to = (y * width + x) * 4;
      out.data[to] = source[from] as number;
      out.data[to + 1] = source[from + 1] as number;
      out.data[to + 2] = source[from + 2] as number;
      out.data[to + 3] = source[from + 3] as number;
    }
  }
  return out;
}
