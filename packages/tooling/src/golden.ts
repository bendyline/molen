import { access, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
// pixelmatch + pngjs are pure-JS (no native binary) so golden diffing works portably in CI.
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function readPng(path: string): Promise<PNG> {
  return PNG.sync.read(await readFile(path));
}

export interface ImageDiff {
  match: boolean;
  diffPixels: number;
  diffRatio: number;
  reason?: string;
}

/** Pixel-diff two PNGs; writes a diff image. Per-pixel threshold 0.1. */
export async function diffImages(
  aPath: string,
  bPath: string,
  diffPath: string,
  maxDiffRatio = 0.003,
): Promise<ImageDiff> {
  const a = await readPng(aPath);
  const b = await readPng(bPath);
  if (a.width !== b.width || a.height !== b.height) {
    return {
      match: false,
      diffPixels: a.width * a.height,
      diffRatio: 1,
      reason: `size mismatch: ${a.width}x${a.height} vs ${b.width}x${b.height}`,
    };
  }
  const diff = new PNG({ width: a.width, height: a.height });
  const diffPixels = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1 });
  await mkdir(dirname(diffPath), { recursive: true });
  await writeFile(diffPath, PNG.sync.write(diff));
  const diffRatio = diffPixels / (a.width * a.height);
  return { match: diffRatio <= maxDiffRatio, diffPixels, diffRatio };
}

export interface GoldenResult {
  ok: boolean;
  created: boolean;
  reason?: string;
  diffRatio?: number;
}

export interface GoldenOptions {
  /** Maximum fraction of differing pixels tolerated (default 0.003). */
  maxDiffRatio?: number;
}

/**
 * Compare a freshly rendered candidate PNG against a committed golden. Records the golden only
 * when UPDATE_GOLDENS=1. Tolerance: per-pixel threshold 0.1, max `maxDiffRatio` differing
 * pixels (default 0.3%).
 *
 * A missing golden **fails**. Silently adopting the candidate would make "this test has no
 * reference image" indistinguishable from "this test passed" — and in a fresh CI checkout every
 * uncommitted golden would take that branch, so a suite could report green while comparing
 * nothing.
 */
export async function compareGolden(
  candidatePath: string,
  goldenPath: string,
  diffPath: string,
  opts: GoldenOptions = {},
): Promise<GoldenResult> {
  const update = process.env.UPDATE_GOLDENS === '1';
  if (update) {
    await mkdir(dirname(goldenPath), { recursive: true });
    await copyFile(candidatePath, goldenPath);
    return { ok: true, created: true };
  }
  if (!(await exists(goldenPath))) {
    return {
      ok: false,
      created: false,
      reason: `no committed golden at ${goldenPath}; the candidate is at ${candidatePath}. Record one with UPDATE_GOLDENS=1 (locally that produces a candidate only — the authoritative refresh is the "Update goldens" workflow, which records in the pinned CI container).`,
    };
  }
  const result = await diffImages(goldenPath, candidatePath, diffPath, opts.maxDiffRatio);
  return {
    ok: result.match,
    created: false,
    ...(result.reason !== undefined ? { reason: result.reason } : {}),
    diffRatio: result.diffRatio,
  };
}
