/**
 * Render figures headlessly: resolve descriptors (presets, a molen/figure@1 document, or a
 * lineup), generate their bodies in Node for the stats, then draw them through the normal
 * capture page (the `figure` renderable kind) from turntable angles or the art-review set.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  deriveRig,
  descriptorKey,
  FIGURE_PRESET_IDS,
  type FigureDescriptor,
  type FigureMode,
  type FigurePresetId,
  type FigureStateData,
  type FigureTier,
  generateFigureBody,
  type ResolvedFigureDescriptor,
  resolveFigureDescriptor,
  strideRateFor,
} from '@bendyline/molen-figures/kernel';
import { hashJson } from '@bendyline/molen-kernel/determinism';
import { type Keyframe, validateByKind } from '@bendyline/molen-schema';
import { startCaptureResources } from '../capture-server';
import { guardOp } from './errors';
import { parseJson } from './parse';
import type { RenderStats } from './screenshot';

export type FigureLineup = 'humans' | 'bodies' | 'species' | 'all';

export interface FigurePreviewInput {
  /** Preset id(s) to render (default: human.adult). */
  preset?: string | string[];
  /** A molen/figure@1 document path. */
  descriptorPath?: string;
  /** An inline descriptor (the `figure` component shape). */
  descriptor?: FigureDescriptor;
  /** A built-in lineup instead of explicit descriptors. */
  lineup?: FigureLineup;
  /** Pose mode (default idle). */
  mode?: FigureMode;
  /** Simulation tick to pose at (default 15). */
  tick?: number;
  /** Body detail tier (default 0). */
  tier?: FigureTier;
  /** Turntable angle count, or 'review' for front / three-quarter / rear / gameplay distance. */
  angles?: number | 'review';
  size?: [number, number];
  /** PNG path; with several frames the frame name is appended before the extension. */
  outPath: string;
  clearColor?: string;
}

export interface FigurePreviewFrame {
  name: string;
  path: string;
  yawDeg: number;
  renderStats?: RenderStats;
}

export interface FigurePreviewStats {
  figures: number;
  triangles: number;
  joints: number;
  descriptorKeys: string[];
}

export interface FigurePreviewOutput {
  ok: boolean;
  frames?: FigurePreviewFrame[];
  stats?: FigurePreviewStats;
  hash?: string;
  error?: string;
}

function captureRootDir(): string {
  return fileURLToPath(new URL('./capture/', import.meta.url));
}

function isPresetId(id: string): id is FigurePresetId {
  return (FIGURE_PRESET_IDS as readonly string[]).includes(id);
}

const LINEUPS: Record<FigureLineup, FigureDescriptor[]> = {
  humans: [
    { preset: 'human.child' },
    { preset: 'human.adult' },
    {
      preset: 'human.adult',
      height: 1.62,
      build: -0.5,
      palette: { top: '#8c3b5a', hair: '#e6c27a' },
    },
    {
      preset: 'human.adult',
      height: 1.9,
      build: 0.7,
      palette: { top: '#2f5f3a', bottom: '#4b4b52' },
    },
    { preset: 'human.elder' },
  ],
  bodies: [-0.8, -0.4, 0, 0.4, 0.8].map((build) => ({
    preset: 'human.adult' as const,
    build,
    height: 1.55 + 0.1 * (build + 0.8),
  })),
  species: [
    { preset: 'cat' },
    { preset: 'dog' },
    { preset: 'sheep' },
    { preset: 'deer' },
    { preset: 'cow' },
    { preset: 'horse' },
  ],
  all: [],
};
LINEUPS.all = [...LINEUPS.humans, ...LINEUPS.species];

async function resolveDescriptors(input: FigurePreviewInput): Promise<FigureDescriptor[]> {
  const out: FigureDescriptor[] = [];
  if (input.lineup !== undefined) out.push(...LINEUPS[input.lineup]);
  const presets =
    input.preset === undefined ? [] : Array.isArray(input.preset) ? input.preset : [input.preset];
  for (const id of presets) {
    if (!isPresetId(id))
      throw new Error(`unknown figure preset "${id}" (known: ${FIGURE_PRESET_IDS.join(', ')})`);
    out.push({ preset: id });
  }
  if (input.descriptorPath !== undefined) {
    const raw = parseJson(await readFile(input.descriptorPath, 'utf8'));
    const v = validateByKind('figure', raw);
    if (!v.ok) throw new Error(v.formatted);
    const { format: _format, ...descriptor } = v.value as FigureDescriptor & { format: string };
    out.push(descriptor);
  }
  if (input.descriptor !== undefined) out.push(input.descriptor);
  if (out.length === 0) out.push({ preset: 'human.adult' });
  return out;
}

/** Footprint width of a figure for lineup spacing. */
function widthOf(d: ResolvedFigureDescriptor): number {
  if (d.archetype === 'biped') return 0.5 * d.height + 0.4;
  return Math.max(0.9, 0.55 * d.height + 0.5);
}

/** The state a figure carries for a pose mode at a steady reference speed. */
function stateFor(mode: FigureMode, d: ResolvedFigureDescriptor): FigureStateData {
  const rig = deriveRig(d);
  const speed = mode === 'run' ? (d.archetype === 'biped' ? 4 : 8) : mode === 'walk' ? 1.4 : 0;
  return {
    mode,
    speed,
    strideRate: strideRateFor(speed, rig.legLength),
    phaseAt: 0,
    phaseAtTick: 0,
    modeAtTick: 0,
    ...(d.archetype === 'quadruped' && mode === 'run' ? { gait: 'gallop' as const } : {}),
  };
}

export function previewFigure(input: FigurePreviewInput): Promise<FigurePreviewOutput> {
  return guardOp(
    (error) => ({ ok: false, error }),
    () => previewFigureImpl(input),
  );
}

async function previewFigureImpl(input: FigurePreviewInput): Promise<FigurePreviewOutput> {
  const descriptors = await resolveDescriptors(input);
  const resolved = descriptors.map((d) => resolveFigureDescriptor(d));
  const tier = input.tier ?? 0;
  const mode = input.mode ?? 'idle';
  const tick = input.tick ?? 15;
  const tickRate = 60;

  // Stats from the same generator the page runs.
  let triangles = 0;
  let joints = 0;
  const keys: string[] = [];
  for (const d of resolved) {
    const body = generateFigureBody(d, tier);
    triangles += body.buffers.triangleCount;
    joints += body.rig.joints.length;
    keys.push(descriptorKey(d));
  }

  // Lineup along +X, centered.
  const widths = resolved.map(widthOf);
  const total = widths.reduce((a, b) => a + b, 0);
  let x = -total / 2;
  const entities: Keyframe['entities'] = {
    ground: {
      transform: { pos: [0, -0.05, 0], rot: [0, 0, 0, 1] },
      renderable: {
        kind: 'primitive',
        ref: 'box',
        materialRef: 'palette:#6b7f5a',
        primitive: { size: [Math.max(12, total + 6), 0.1, 12] },
      },
    },
  };
  let maxHeight = 0;
  resolved.forEach((d, i) => {
    const w = widths[i] as number;
    x += w / 2;
    entities[`figure${i}`] = {
      transform: { pos: [x, 0, 0], rot: [0, 0, 0, 1] },
      renderable: { kind: 'figure', ref: 'procedural', lod: tier },
      figure: descriptors[i] as FigureDescriptor,
      figureState: stateFor(mode, d),
    };
    x += w / 2;
    maxHeight = Math.max(maxHeight, d.archetype === 'biped' ? d.height : 1.3 * d.height);
  });
  const keyframe: Keyframe = {
    kind: 'keyframe',
    v: 1,
    engine: '',
    tick,
    tickRate,
    seed: '',
    nextEntitySeq: 1,
    rng: { algo: 'sfc32', state: [0, 0, 0, 0] },
    entities,
    plugins: {},
  };

  const size = input.size ?? [1280, 720];
  const center: [number, number, number] = [0, 0.5 * maxHeight, 0];
  const span = Math.max(total, maxHeight * 1.4);
  const distance = Math.max(2.5, span * 0.9 + 1.5);
  const views: { name: string; yawDeg: number; distance: number; elevation: number }[] = [];
  if (input.angles === 'review') {
    views.push(
      { name: 'front', yawDeg: 0, distance, elevation: 0.12 },
      { name: 'three-quarter', yawDeg: 45, distance, elevation: 0.2 },
      { name: 'rear', yawDeg: 180, distance, elevation: 0.12 },
      { name: 'gameplay', yawDeg: 20, distance: Math.max(distance, 12), elevation: 0.45 },
    );
  } else {
    const count = Math.max(1, Math.floor(input.angles ?? 1));
    for (let i = 0; i < count; i++) {
      views.push({ name: `angle_${i}`, yawDeg: (360 * i) / count, distance, elevation: 0.18 });
    }
  }

  const outDir = dirname(input.outPath);
  await mkdir(outDir, { recursive: true });
  const { chromium } = await import('playwright');
  const { browser, server } = await startCaptureResources(
    () =>
      chromium.launch({
        args: [
          '--use-gl=angle',
          '--use-angle=swiftshader',
          '--enable-unsafe-swiftshader',
          '--disable-gpu-sandbox',
        ],
      }),
    captureRootDir(),
    outDir,
  );
  try {
    const page = await browser.newPage({ viewport: { width: size[0], height: size[1] } });
    await page.goto(`${server.url}/capture.html`);
    const frames: FigurePreviewFrame[] = [];
    const ext = extname(input.outPath) || '.png';
    const stem = input.outPath.slice(
      0,
      input.outPath.length - (extname(input.outPath) ? ext.length : 0),
    );
    for (const view of views) {
      const theta = (view.yawDeg * Math.PI) / 180;
      const camera = {
        position: [
          center[0] + Math.sin(theta) * view.distance,
          center[1] + view.distance * view.elevation,
          center[2] + Math.cos(theta) * view.distance,
        ] as [number, number, number],
        lookAt: center,
      };
      const req = {
        keyframe,
        camera,
        size,
        terrain: null,
        clearColor: input.clearColor ?? '#1b2130',
      };
      const stats = (await page.evaluate(
        (r: unknown) =>
          (
            globalThis as unknown as { __molenCapture: (x: unknown) => Promise<unknown> }
          ).__molenCapture(r),
        req as unknown,
      )) as RenderStats;
      const path = views.length === 1 ? input.outPath : `${stem}.${view.name}${ext}`;
      await writeFile(
        path,
        await page.screenshot({ clip: { x: 0, y: 0, width: size[0], height: size[1] } }),
      );
      frames.push({ name: view.name, path, yawDeg: view.yawDeg, renderStats: stats });
    }
    return {
      ok: true,
      frames,
      stats: { figures: resolved.length, triangles, joints, descriptorKeys: keys },
      hash: hashJson({ keys, tier, mode, tick }),
    };
  } finally {
    await Promise.allSettled([browser.close(), server.close()]);
  }
}
