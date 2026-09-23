import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ENGINE_VERSION } from '@bendyline/molen-kernel';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { listFigurePresets } from './ops/figure-presets';
import { previewFigure } from './ops/figure-preview';
import {
  applyUvPaintOp,
  bakeWorldgen,
  buildContentPack,
  checkScripts,
  checkTypesOp,
  describeOps,
  diffSnapshots,
  driveScene,
  exportFrames,
  extractContentPack,
  fetchContentPack,
  formatOp,
  formatPacked,
  generateTypes,
  getComponentOp,
  getSchemaOp,
  importAsset,
  inspectAsset,
  inspectContentPack,
  listAssets,
  listComponentsOp,
  listSchemasOp,
  listTypes,
  packAsset,
  playExperience,
  previewWorldgen,
  projectInfo,
  rasterizeMaterial,
  reserveNamespace,
  runReplayFile,
  runSimulation,
  scaffoldExperience,
  screenshotAsset,
  screenshotScene,
  searchDocs,
  stageAssets,
  testTypes,
  validateAsset,
  verifyContentPack,
  worldgenStats,
} from './ops/index';
import { loadComponentRegistry } from './ops/schema';

interface TextResult {
  [x: string]: unknown;
  content: { type: 'text'; text: string }[];
  isError?: boolean;
}

function text(s: string, isError = false): TextResult {
  return { content: [{ type: 'text', text: s }], ...(isError ? { isError } : {}) };
}

/** Build the molen MCP server (stdio). Mirrors the CLI ops; inputs use the ops' contracts. */
export function createMcpServer(): McpServer {
  const server = new McpServer({ name: 'molen', version: ENGINE_VERSION });

  server.registerTool(
    'list_schemas',
    {
      title: 'List schemas',
      description: 'List all registered asset schema kinds.',
      inputSchema: {},
    },
    async () =>
      text(
        listSchemasOp()
          .map((s) => `${s.kind} — ${s.title}: ${s.description}`)
          .join('\n'),
      ),
  );

  server.registerTool(
    'get_schema',
    {
      title: 'Get schema',
      description: 'Get a schema kind: JSON Schema + examples + docs reference.',
      inputSchema: { kind: z.string() },
    },
    async ({ kind }) => {
      const r = getSchemaOp(kind);
      if (!r.ok) return text(r.error ?? 'unknown kind', true);
      return text(
        JSON.stringify(
          { id: r.id, docsRef: r.docsRef, examples: r.examples, jsonSchema: r.jsonSchema },
          null,
          2,
        ),
      );
    },
  );

  server.registerTool(
    'list_components',
    {
      title: 'List components',
      description:
        'List component vocabulary from the current project or an explicit project/scene.',
      inputSchema: { projectPath: z.string().optional(), scenePath: z.string().optional() },
    },
    async (args) =>
      text(
        listComponentsOp(await loadComponentRegistry(args))
          .map((c) => `${c.name} — ${c.description}${c.owner ? ` [${c.owner}]` : ''}`)
          .join('\n'),
      ),
  );

  server.registerTool(
    'get_component',
    {
      title: 'Get component',
      description: 'Get one component schema + examples (the authoring contract for a component).',
      inputSchema: {
        name: z.string(),
        projectPath: z.string().optional(),
        scenePath: z.string().optional(),
      },
    },
    async ({ name, ...context }) => {
      const r = getComponentOp(name, await loadComponentRegistry(context));
      if (!r.ok) return text(r.error ?? 'unknown component', true);
      return text(JSON.stringify(r, null, 2));
    },
  );

  server.registerTool(
    'describe_op',
    {
      title: 'Describe op',
      description: 'Machine-readable contracts for the molen operations (CLI + MCP).',
      inputSchema: { name: z.string().optional() },
    },
    async ({ name }) => {
      const ops = describeOps(name);
      if (ops.length === 0) return text(`no op matching "${name}"`, true);
      return text(ops.map(formatOp).join('\n\n'));
    },
  );

  server.registerTool(
    'validate_asset',
    {
      title: 'Validate asset',
      description: 'Validate a JSON asset document against its schema (kind auto-detected).',
      inputSchema: {
        path: z.string().optional(),
        inline: z.unknown().optional(),
        kind: z.string().optional(),
        verifyFiles: z.boolean().optional(),
        projectPath: z.string().optional(),
      },
    },
    async (args) => {
      const r = await validateAsset(args);
      return r.ok
        ? text(
            `✓ valid ${r.kind}${r.verifiedFiles !== undefined ? `; verified ${r.verifiedFiles} package files` : ''}`,
          )
        : text(r.formatted ?? 'invalid', true);
    },
  );

  server.registerTool(
    'run_simulation',
    {
      title: 'Run simulation',
      description:
        'Run a scene headlessly for N ticks; returns tick, state hash, events, assertions.',
      inputSchema: {
        scenePath: z.string(),
        ticks: z.number().int().positive(),
        setupModule: z.string().optional(),
        commandsPath: z.string().optional(),
        assertPath: z.string().optional(),
        projectPath: z.string().optional(),
      },
    },
    async (args) => {
      const r = await runSimulation(args);
      if (r.error !== undefined) return text(r.error, true);
      const lines = [`tick: ${r.tick}`, `hash: ${r.stateHash}`, `events: ${r.eventCount}`];
      if (r.assertionsFormatted !== undefined) lines.push(r.assertionsFormatted);
      return text(lines.join('\n'), !r.ok);
    },
  );

  server.registerTool(
    'screenshot_scene',
    {
      title: 'Screenshot scene',
      description: 'Render a deterministic headless screenshot of a scene to a PNG; returns stats.',
      inputSchema: {
        scenePath: z.string(),
        outPath: z.string(),
        ticks: z.number().int().nonnegative().default(0),
        setupModule: z.string().optional(),
        projectPath: z.string().optional(),
        camera: z
          .object({
            position: z.tuple([z.number(), z.number(), z.number()]),
            lookAt: z.tuple([z.number(), z.number(), z.number()]).optional(),
          })
          .optional(),
        size: z.tuple([z.number(), z.number()]).optional(),
        terrain: z.object({ descriptorPath: z.string(), heightmapPath: z.string() }).optional(),
        clearColor: z.string().optional(),
        assetVariant: z.string().optional(),
      },
    },
    async (args) => {
      const r = await screenshotScene(args);
      if (!r.ok) return text(r.error ?? 'screenshot failed', true);
      const s = r.renderStats;
      return text(
        `wrote ${r.imagePath}\ntick ${r.tick}, hash ${r.stateHash}\n` +
          `rendered ${s?.entitiesRendered ?? 0} entities, ${s?.drawCalls ?? 0} draw calls, ${s?.triangles ?? 0} triangles`,
      );
    },
  );

  server.registerTool(
    'rasterize_material',
    {
      title: 'Rasterize material',
      description: 'Bake a material graph or palette ref to a PNG texture.',
      inputSchema: {
        path: z.string().optional(),
        inline: z.unknown().optional(),
        ref: z.string().optional(),
        outPath: z.string(),
      },
    },
    async (args) => {
      const r = await rasterizeMaterial(args);
      return r.ok
        ? text(`wrote ${r.imagePath} (${r.width}x${r.height}, slots: ${r.slots?.join(', ')})`)
        : text(r.error ?? 'bake failed', true);
    },
  );

  server.registerTool(
    'run_replay',
    {
      title: 'Run replay',
      description:
        'Replay a recorded fixture and compare the state hash; localizes divergence on mismatch.',
      inputSchema: {
        path: z.string(),
        setupModule: z.string().optional(),
        projectPath: z.string().optional(),
        record: z.boolean().optional(),
      },
    },
    async (args) => {
      const r = await runReplayFile(args);
      if (r.error !== undefined) return text(r.error, true);
      return text(r.report ?? (r.ok ? '✓ replay matches' : '✖ replay diverged'), !r.ok);
    },
  );

  server.registerTool(
    'apply_uv_paint',
    {
      title: 'Apply UV paint',
      description:
        'Import a painted UV template: mask it to the island map and dilate the gutters.',
      inputSchema: {
        paintedPath: z.string(),
        islandMapPath: z.string(),
        outPath: z.string(),
        maskToIslands: z.boolean().optional(),
        dilationPx: z.number().int().nonnegative().optional(),
      },
    },
    async (args) => {
      const r = await applyUvPaintOp(args);
      return r.ok
        ? text(`wrote ${r.imagePath} (${r.width}x${r.height})`)
        : text(r.error ?? 'failed', true);
    },
  );

  server.registerTool(
    'export_frames',
    {
      title: 'Export frames',
      description:
        'Render a tick range of a scene to a PNG sequence, optionally following a camera track.',
      inputSchema: {
        scenePath: z.string(),
        outDir: z.string(),
        from: z.number().int().nonnegative(),
        to: z.number().int().nonnegative(),
        step: z.number().int().positive().optional(),
        setupModule: z.string().optional(),
        projectPath: z.string().optional(),
        trackPath: z.string().optional(),
        camera: z
          .object({
            position: z.tuple([z.number(), z.number(), z.number()]),
            lookAt: z.tuple([z.number(), z.number(), z.number()]).optional(),
          })
          .optional(),
        size: z.tuple([z.number(), z.number()]).optional(),
      },
    },
    async (args) => {
      const r = await exportFrames(args);
      if (!r.ok) return text(r.error ?? 'export failed', true);
      return text(`wrote ${r.frameCount} frames to ${r.dir}`);
    },
  );

  server.registerTool(
    'diff_snapshots',
    {
      title: 'Diff snapshots',
      description: 'Component-level diff between two keyframe JSON files.',
      inputSchema: { a: z.string(), b: z.string() },
    },
    async (args) => {
      const r = await diffSnapshots(args);
      if (!r.ok) return text(r.error ?? 'diff failed', true);
      const diffs = r.diffs ?? [];
      if (diffs.length === 0) return text('no differences');
      return text(
        diffs
          .map(
            (d) =>
              `${d.kind} ${d.entity}.${d.component}` +
              (d.kind === 'changed'
                ? `: ${JSON.stringify(d.before)} -> ${JSON.stringify(d.after)}`
                : ''),
          )
          .join('\n'),
      );
    },
  );

  server.registerTool(
    'search_docs',
    {
      title: 'Search docs',
      description: 'Lexical search over the shipped engine docs (docs-src bundle).',
      inputSchema: {
        query: z.string(),
        k: z.number().int().positive().default(5),
        includeDesign: z.boolean().optional(),
      },
    },
    async ({ query, k, includeDesign }) =>
      text((await searchDocs({ query, k, includeDesign })).formatted),
  );

  const imageItem = async (
    path: string,
  ): Promise<{ type: 'image'; data: string; mimeType: string }> => ({
    type: 'image',
    data: (await readFile(path)).toString('base64'),
    mimeType: 'image/png',
  });

  server.registerTool(
    'drive_scene',
    {
      title: 'Drive scene',
      description:
        'PLAY a scene deterministically: submit commands at chosen ticks and capture screenshots at chosen ticks in one pass. Returns the frames as images plus events/hash — same actions always produce the same frames.',
      inputSchema: {
        scenePath: z.string(),
        projectPath: z.string().optional(),
        setupModule: z.string().optional(),
        actions: z.array(
          z.object({
            at: z.number().int().nonnegative(),
            command: z.object({ type: z.string(), payload: z.unknown().optional() }).optional(),
            screenshot: z.string().optional(),
            camera: z
              .object({
                position: z.tuple([z.number(), z.number(), z.number()]),
                lookAt: z.tuple([z.number(), z.number(), z.number()]).optional(),
              })
              .optional(),
          }),
        ),
        until: z.number().int().nonnegative().optional(),
        assertPath: z.string().optional(),
        size: z.tuple([z.number(), z.number()]).optional(),
      },
    },
    async (args) => {
      const outDir = await mkdtemp(join(tmpdir(), 'molen-drive-'));
      try {
        const r = await driveScene(Object.assign({}, args, { outDir }) as never);
        if (r.error !== undefined) return text(r.error, true);
        const lines = [
          `tick: ${r.tick}  hash: ${r.stateHash}`,
          `events (${r.events?.length ?? 0}): ${(r.events ?? [])
            .slice(0, 40)
            .map((e) => `t${e.tick}:${e.type}`)
            .join(' ')}`,
          ...(r.frames ?? []).map((f) => `frame "${f.name}" @ tick ${f.tick}`),
          ...(r.assertionsFormatted !== undefined ? [r.assertionsFormatted] : []),
        ];
        const images = await Promise.all((r.frames ?? []).map((f) => imageItem(f.path)));
        return {
          content: [{ type: 'text' as const, text: lines.join('\n') }, ...images],
          ...(r.ok ? {} : { isError: true }),
        };
      } finally {
        await rm(outDir, { recursive: true, force: true });
      }
    },
  );

  server.registerTool(
    'play_experience',
    {
      title: 'Play browser experience',
      description:
        'Host a built browser experience, execute declarative keyboard/pointer/UI actions, and return screenshots plus diagnostics.',
      inputSchema: {
        appDir: z.string(),
        scenario: z.record(z.string(), z.unknown()),
      },
    },
    async ({ appDir, scenario }) => {
      const outDir = await mkdtemp(join(tmpdir(), 'molen-play-'));
      try {
        const result = await playExperience({ appDir, scenario, outDir });
        if (result.error !== undefined) return text(result.error, true);
        const lines = [
          `scenario: ${result.scenario}`,
          ...(result.frames ?? []).map(
            (frame) =>
              `frame "${frame.name}" @ action ${frame.actionIndex}${Object.keys(frame.probes).length === 0 ? '' : ` — ${JSON.stringify(frame.probes)}`}`,
          ),
          ...(result.diagnostics ?? []).map(
            (diagnostic) =>
              `${diagnostic.kind} @ action ${diagnostic.actionIndex}: ${diagnostic.text}`,
          ),
        ];
        const images = await Promise.all(
          (result.frames ?? []).map((frame) => imageItem(frame.path)),
        );
        return {
          content: [{ type: 'text' as const, text: lines.join('\n') }, ...images],
          ...(result.ok ? {} : { isError: true }),
        };
      } finally {
        await rm(outDir, { recursive: true, force: true });
      }
    },
  );

  server.registerTool(
    'screenshot_asset',
    {
      title: 'Screenshot asset',
      description:
        'Render an imported asset from N turntable angles (framed from its sidecar bounds). Returns the frames as images — look at what you imported.',
      inputSchema: {
        ref: z.string(),
        projectPath: z.string().optional(),
        angles: z.number().int().positive().optional(),
        clip: z.string().optional(),
        clipTime: z.number().nonnegative().optional(),
        size: z.tuple([z.number(), z.number()]).optional(),
        assetVariant: z.string().optional(),
      },
    },
    async (args) => {
      const outDir = await mkdtemp(join(tmpdir(), 'molen-asset-shot-'));
      try {
        const r = await screenshotAsset(Object.assign({}, args, { outDir }) as never);
        if (!r.ok) return text(r.error ?? 'asset shot failed', true);
        const images = await Promise.all((r.frames ?? []).map((f) => imageItem(f.path)));
        return {
          content: [
            {
              type: 'text' as const,
              text: `${r.frames?.length ?? 0} angles, ${r.triangles} triangles`,
            },
            ...images,
          ],
        };
      } finally {
        await rm(outDir, { recursive: true, force: true });
      }
    },
  );

  server.registerTool(
    'figure_preview',
    {
      title: 'Preview figures',
      description:
        'Render figure presets, an inline molen/figure@1 descriptor, or a built-in lineup headlessly from turntable angles or the art-review view set. Returns the frames as images.',
      inputSchema: {
        preset: z.union([z.string(), z.array(z.string())]).optional(),
        descriptor: z.record(z.string(), z.unknown()).optional(),
        descriptorPath: z.string().optional(),
        lineup: z.enum(['humans', 'bodies', 'species', 'all']).optional(),
        mode: z.enum(['idle', 'walk', 'run', 'sit', 'jump', 'fall']).optional(),
        tick: z.number().int().nonnegative().optional(),
        tier: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
        angles: z.union([z.number().int().positive(), z.literal('review')]).optional(),
        size: z.tuple([z.number(), z.number()]).optional(),
      },
    },
    async (args) => {
      const outDir = await mkdtemp(join(tmpdir(), 'molen-figure-preview-'));
      try {
        const r = await previewFigure(
          Object.assign({}, args, { outPath: join(outDir, 'figure.png') }) as never,
        );
        if (!r.ok) return text(r.error ?? 'figure preview failed', true);
        const images = await Promise.all((r.frames ?? []).map((f) => imageItem(f.path)));
        return {
          content: [
            {
              type: 'text' as const,
              text: `${r.stats?.figures ?? 0} figures, ${r.stats?.triangles ?? 0} triangles, ${r.stats?.joints ?? 0} joints, hash ${r.hash ?? ''}`,
            },
            ...images,
          ],
        };
      } finally {
        await rm(outDir, { recursive: true, force: true });
      }
    },
  );

  server.registerTool(
    'list_figure_presets',
    {
      title: 'List figure presets',
      description: 'List the shipped figure presets with their resolved descriptors.',
      inputSchema: { archetype: z.enum(['biped', 'quadruped']).optional() },
    },
    async (args) => text(JSON.stringify(listFigurePresets(args as never).presets, null, 2)),
  );

  server.registerTool(
    'worldgen_preview',
    {
      title: 'Preview generated buildings',
      description:
        'Generate buildings from a style pack (default: one of every footprint class) and render them headlessly from N turntable angles. Returns the frames as images.',
      inputSchema: {
        stylePath: z.string().optional(),
        packPath: z.string().optional(),
        styleId: z.string().optional(),
        batchPath: z.string().optional(),
        scatterId: z.string().optional(),
        ground: z.enum(['flat', 'slope']).optional(),
        angles: z.number().int().positive().optional(),
        size: z.tuple([z.number(), z.number()]).optional(),
      },
    },
    async (args) => {
      const outDir = await mkdtemp(join(tmpdir(), 'molen-worldgen-preview-'));
      try {
        const r = await previewWorldgen(
          Object.assign({}, args, { outPath: join(outDir, 'preview.png') }) as never,
        );
        if (!r.ok) return text(r.error ?? 'worldgen preview failed', true);
        const images = await Promise.all((r.frames ?? []).map((f) => imageItem(f.path)));
        return {
          content: [
            {
              type: 'text' as const,
              text: `${r.stats?.buildingsRendered ?? 0} buildings (${r.stats?.buildingsBoxed ?? 0} boxed), ${r.renderStats?.drawCalls ?? 0} draws, ${r.renderStats?.triangles ?? 0} triangles, hash ${r.hash ?? ''}`,
            },
            ...images,
          ],
        };
      } finally {
        await rm(outDir, { recursive: true, force: true });
      }
    },
  );

  server.registerTool(
    'worldgen_bake',
    {
      title: 'Bake generated buildings',
      description:
        'Generate buildings from a batch document or one outline and bake them to a glTF asset with a molen/asset@1 sidecar under outDir.',
      inputSchema: {
        batchPath: z.string().optional(),
        outline: z.string().optional(),
        styleId: z.string().optional(),
        packPath: z.string().optional(),
        outDir: z.string(),
        id: z.string().optional(),
        ground: z.enum(['flat', 'slope']).optional(),
        force: z.boolean().optional(),
        projectPath: z.string().optional(),
      },
    },
    async (args) => {
      const r = await bakeWorldgen(args as never);
      if (!r.ok) return text(r.error ?? 'worldgen bake failed', true);
      return text(JSON.stringify(r, null, 2));
    },
  );

  server.registerTool(
    'worldgen_stats',
    {
      title: 'Worldgen tile stats',
      description:
        'Generate one real terrain-package tile in Node and report counts, footprint and roof histograms, sizes, timings, and determinism; optionally dump the adapted batch document.',
      inputSchema: {
        packagePath: z.string(),
        tile: z.string().optional(),
        auto: z.boolean().optional(),
        packPath: z.string().optional(),
        atlasPath: z.string().optional(),
        styleId: z.string().optional(),
        quality: z.enum(['economy', 'balanced', 'high']).optional(),
        dumpPath: z.string().optional(),
      },
    },
    async (args) => {
      const r = await worldgenStats(args as never);
      if (!r.ok) return text(r.error ?? 'worldgen stats failed', true);
      return text(JSON.stringify(r, null, 2));
    },
  );

  server.registerTool(
    'test_types',
    {
      title: 'Test types',
      description:
        'Smoke-test every registry type standalone: resolved components validate, the entity spawns, and the world simulates N ticks.',
      inputSchema: {
        projectPath: z.string().optional(),
        cwd: z.string().optional(),
        ticks: z.number().int().positive().optional(),
        only: z.array(z.string()).optional(),
      },
    },
    async (args) => {
      const r = await testTypes(args);
      if (r.error !== undefined) return text(r.error, true);
      const lines = (r.results ?? []).map(
        (t) =>
          `${t.ok ? '✓' : '✖'} ${t.id}${t.error !== undefined ? ` — ${t.error}` : ''}${
            t.issues !== undefined ? ` — ${t.issues.map((i) => i.message).join('; ')}` : ''
          }`,
      );
      return text(lines.join('\n') || '(no types registered)', !r.ok);
    },
  );

  server.registerTool(
    'import_asset',
    {
      title: 'Import asset',
      description:
        'Import a glTF/GLB into the project asset store: normalize, extract bounds + collision (hulls/trimesh), write the molen/asset@1 sidecar, register in project.json.',
      inputSchema: {
        path: z.string(),
        id: z.string().optional(),
        outDir: z.string().optional(),
        trimesh: z.boolean().optional(),
        optimize: z.boolean().optional(),
        projectPath: z.string().optional(),
        cwd: z.string().optional(),
        force: z.boolean().optional(),
      },
    },
    async (args) => {
      const r = await importAsset(args);
      if (!r.ok) return text(r.error ?? 'import failed', true);
      const s = r.sidecar as NonNullable<typeof r.sidecar>;
      return text(
        [
          `imported "${r.id}" -> ${r.dir}`,
          `${s.stats.triangles} tris, ${s.stats.meshes} meshes, ${s.stats.animations} clips, ${s.collision.hulls.length} hulls${s.collision.trimesh !== undefined ? ' + trimesh' : ''}`,
          r.registered === true
            ? `registered in ${r.projectPath}`
            : 'NOT registered (no project.json found)',
          ...(r.warnings ?? []),
        ].join('\n'),
      );
    },
  );

  server.registerTool(
    'inspect_asset',
    {
      title: 'Inspect asset',
      description:
        'Read + validate an asset sidecar (by path or project asset id); optionally verify file hashes.',
      inputSchema: {
        ref: z.string(),
        verify: z.boolean().optional(),
        projectPath: z.string().optional(),
      },
    },
    async (args) => {
      const r = await inspectAsset(args);
      if (!r.ok) return text(r.error ?? (r.verifyErrors ?? []).join('\n'), true);
      return text(JSON.stringify(r.sidecar, null, 2));
    },
  );

  server.registerTool(
    'pack_asset',
    {
      title: 'Pack asset (KTX2 runtime variant)',
      description:
        'Derive a RUNTIME GLB next to the canonical one: every texture re-encoded as KTX2 (Basis Universal) with a full mip chain, resized to a power of two, so the GPU gets ASTC/BC7 instead of RGBA8 (4-8x less texture memory; decisive on iOS/Android webviews). Records files.variants.<variant> in the sidecar. Pass ref (asset id / sidecar) or all: true.',
      inputSchema: {
        ref: z.string().optional(),
        all: z.boolean().optional(),
        projectPath: z.string().optional(),
        variant: z.string().optional(),
        mode: z.enum(['auto', 'etc1s', 'uastc']).optional(),
        maxSize: z.number().int().positive().optional(),
        powerOfTwo: z.boolean().optional(),
        etc1sQuality: z.number().int().min(1).max(255).optional(),
        uastcQuality: z.number().int().min(0).max(4).optional(),
      },
    },
    async (args) => {
      const r = await packAsset(args);
      if (!r.ok) return text(r.error ?? 'pack failed', true);
      return text([...formatPacked(r.assets ?? []), ...(r.warnings ?? [])].join('\n'));
    },
  );

  server.registerTool(
    'stage_assets',
    {
      title: 'Stage assets for the browser',
      description:
        'Copy every registered asset\'s runtime files into outDir (same relative layout) and write assets.index.json (id -> URL) for the client\'s assets.index option. With variant (e.g. "ktx2"), the packed GLB replaces the design-time one and the staged sidecar is rewritten to match. Fails on stale (hash-mismatched) assets.',
      inputSchema: {
        outDir: z.string(),
        projectPath: z.string().optional(),
        variant: z.string().optional(),
        requireVariant: z.boolean().optional(),
        clean: z.boolean().optional(),
      },
    },
    async (args) => {
      const r = await stageAssets(args);
      if (!r.ok) return text(r.error ?? 'stage failed', true);
      return text(
        [
          ...(r.assets ?? []).map(
            (a) =>
              `${a.id} -> ${a.file}${a.variant !== undefined ? ` [${a.variant}]` : ''} (${a.bytes} bytes)`,
          ),
          `index: ${r.indexPath}`,
          ...(r.warnings ?? []),
        ].join('\n'),
      );
    },
  );

  server.registerTool(
    'build_pack',
    {
      title: 'Build a content pack',
      description:
        'Build a molen/pack@1 zip from a source directory holding molen-pack.source.json. Writes <id>-<hash>.zip into outDir and records it in outDir/index.json. Small text files are grouped into compressed solid blocks unless solid is false.',
      inputSchema: {
        sourceDir: z.string(),
        outDir: z.string(),
        solid: z.boolean().optional(),
      },
    },
    async (args) => {
      const r = await buildContentPack(args);
      if (!r.ok) return text(r.error ?? 'pack build failed', true);
      return text(
        `${r.id}@${r.version}: ${r.files} files -> ${r.path} (${r.size} bytes)\ncontentHash ${r.contentHash}\nindex ${r.indexPath}`,
      );
    },
  );

  server.registerTool(
    'inspect_pack',
    {
      title: 'Inspect a content pack',
      description:
        'Summarize a content pack (built file, source directory, or http(s) URL): id, version, contentHash, sizes, solid blocks, asset ids, roles and the largest files, as JSON.',
      inputSchema: { source: z.string() },
    },
    async (args) => {
      const r = await inspectContentPack(args);
      if (!r.ok) return text(r.error ?? 'pack inspect failed', true);
      const { ok: _ok, ...summary } = r;
      return text(JSON.stringify(summary, null, 2));
    },
  );

  server.registerTool(
    'verify_pack',
    {
      title: 'Verify a content pack',
      description:
        'Read every file of a content pack checking CRC and sha256, validate each JSON document against its registered schema, and check asset sidecar hashes against their models. Returns the problems found.',
      inputSchema: { source: z.string() },
    },
    async (args) => {
      const r = await verifyContentPack(args);
      if (r.error !== undefined) return text(r.error, true);
      const summary = `${r.id}: ${r.checked} files checked, ${r.validated} documents validated`;
      if (!r.ok) {
        return text(
          [summary, ...(r.issues ?? []).map((issue) => `${issue.path}: ${issue.message}`)].join(
            '\n',
          ),
          true,
        );
      }
      return text(`ok — ${summary}`);
    },
  );

  server.registerTool(
    'extract_pack',
    {
      title: 'Extract a content pack',
      description:
        'Write every file of a content pack into outDir, with a molen-pack.source.json that builds it back to the same content.',
      inputSchema: { source: z.string(), outDir: z.string() },
    },
    async (args) => {
      const r = await extractContentPack(args);
      if (!r.ok) return text(r.error ?? 'pack extract failed', true);
      return text(`${r.id}: ${r.files} files -> ${r.outDir}`);
    },
  );

  server.registerTool(
    'fetch_pack',
    {
      title: 'Fetch content packs into a project',
      description:
        'Download a pack (or the packs listed by a molen/pack-index@1 URL, optionally only ids) into outDir (default packs/ beside project.json) and pin each in project.json `packs` with its contentHash, so the project runs offline.',
      inputSchema: {
        url: z.string(),
        ids: z.array(z.string()).optional(),
        outDir: z.string().optional(),
        projectPath: z.string().optional(),
        cwd: z.string().optional(),
      },
    },
    async (args) => {
      const r = await fetchContentPack(args);
      if (!r.ok) return text(r.error ?? 'pack fetch failed', true);
      return text(
        [
          ...(r.packs ?? []).map(
            (pack) => `${pack.id}@${pack.version} -> ${r.outDir}/${pack.file} (${pack.size} bytes)`,
          ),
          r.projectPath !== undefined ? `pinned in ${r.projectPath}` : 'no project.json to pin in',
        ].join('\n'),
      );
    },
  );

  server.registerTool(
    'list_assets',
    {
      title: 'List assets',
      description: 'List the assets registered in the surrounding project.',
      inputSchema: { projectPath: z.string().optional(), cwd: z.string().optional() },
    },
    async (args) => {
      const r = await listAssets(args);
      if (!r.ok) return text(r.error ?? 'failed', true);
      return text(
        (r.assets ?? [])
          .map((a) => `${a.id} (${a.kind ?? '?'}, ${a.triangles ?? '?'} tris) — ${a.sidecar}`)
          .join('\n') || '(no assets registered)',
      );
    },
  );

  server.registerTool(
    'get_project',
    {
      title: 'Get project',
      description: 'Show the surrounding project.json: scenes, types, assets, reservations.',
      inputSchema: { projectPath: z.string().optional(), cwd: z.string().optional() },
    },
    async (args) => {
      const r = await projectInfo(args);
      if (r.error !== undefined) return text(r.error, true);
      return text(JSON.stringify(r, null, 2), !r.ok);
    },
  );

  server.registerTool(
    'list_types',
    {
      title: 'List types',
      description: 'List the entity types registered in the project type registry.',
      inputSchema: { projectPath: z.string().optional(), cwd: z.string().optional() },
    },
    async (args) => {
      const r = await listTypes(args);
      if (!r.ok) return text(r.error ?? 'failed', true);
      return text(
        (r.types ?? [])
          .map(
            (t) =>
              `${t.id}${t.extends !== undefined ? ` extends ${t.extends}` : ''}${t.doc !== undefined ? ` — ${t.doc}` : ''} [${t.source}]`,
          )
          .join('\n') || '(no types registered)',
      );
    },
  );

  server.registerTool(
    'check_types',
    {
      title: 'Check types',
      description:
        'Validate the type registry: duplicates, extends cycles, namespace ownership, asset refs, codegen staleness.',
      inputSchema: { projectPath: z.string().optional(), cwd: z.string().optional() },
    },
    async (args) => {
      const r = await checkTypesOp(args);
      if (r.error !== undefined) return text(r.error, true);
      const lines = (r.issues ?? []).map((i) => `${i.path}: ${i.message}`);
      if (r.codegenStale === true) lines.push('codegen is stale — run generate_types');
      return text(r.ok ? '✓ types check passed' : lines.join('\n'), !r.ok);
    },
  );

  server.registerTool(
    'check_scripts',
    {
      title: 'Check scripts',
      description:
        "Type-check the scene's scripts against their generated ambient declarations (component names, command payloads, frozen reads).",
      inputSchema: { projectPath: z.string().optional(), cwd: z.string().optional() },
    },
    async (args) => {
      const r = await checkScripts(args);
      if (r.error !== undefined) {
        return text([r.error, ...(r.stale ?? []), ...(r.ungenerated ?? [])].join('\n'), true);
      }
      const lines = (r.diagnostics ?? []).map(
        (d) => `${d.file}:${d.line}:${d.column} ${d.code}: ${d.message}`,
      );
      return text(
        r.ok ? `✓ ${r.checked ?? 0} script(s) type-check clean` : lines.join('\n'),
        !r.ok,
      );
    },
  );

  server.registerTool(
    'reserve_type',
    {
      title: 'Reserve namespace',
      description:
        'Reserve a type/asset id namespace for an owner in project.json (idempotent per owner; conflicts name the holder).',
      inputSchema: {
        namespace: z.string(),
        owner: z.string(),
        note: z.string().optional(),
        projectPath: z.string().optional(),
        cwd: z.string().optional(),
      },
    },
    async (args) => {
      const r = await reserveNamespace(args);
      if (!r.ok) return text(r.error ?? 'reserve failed', true);
      return text(
        r.alreadyReserved === true
          ? `already reserved by ${args.owner}`
          : `reserved "${args.namespace}" for ${args.owner}`,
      );
    },
  );

  server.registerTool(
    'generate_types',
    {
      title: 'Generate types',
      description:
        'Generate (or verify with check) the typed component/type-id module from the registry.',
      inputSchema: {
        projectPath: z.string().optional(),
        cwd: z.string().optional(),
        out: z.string().optional(),
        check: z.boolean().optional(),
      },
    },
    async (args) => {
      const r = await generateTypes(args);
      if (r.error !== undefined && r.stale !== true) return text(r.error, true);
      if (args.check === true) {
        return text(r.stale === true ? `stale: ${r.outPath}` : 'codegen up to date', !r.ok);
      }
      return text(`wrote ${r.outPath} (${r.componentCount} components, ${r.typeCount} types)`);
    },
  );

  server.registerTool(
    'new_experience',
    {
      title: 'New experience',
      description:
        'Scaffold a runnable experience (scene + scripts + setup + commands + checks) on disk.',
      inputSchema: {
        name: z.string(),
        dir: z.string().optional(),
        force: z.boolean().optional(),
      },
    },
    async (args) => {
      const r = await scaffoldExperience(args);
      if (!r.ok) return text(r.error ?? 'scaffold failed', true);
      return text(
        `created ${r.dir}\n${(r.files ?? []).join('\n')}\n\nnext:\n${(r.nextSteps ?? []).join('\n')}`,
      );
    },
  );

  return server;
}

/**
 * Under stdio MCP, stdout **is** the JSON-RPC transport: one stray `console.log` from any
 * dependency (gltf-transform's logger, an Emscripten print hook, a diagnostic left in a library)
 * makes the client fail to parse a frame. Route every stdout-bound console method to stderr for
 * the life of the process; returns a restore function for tests.
 */
export function guardMcpStdout(): () => void {
  const saved = {
    log: console.log,
    info: console.info,
    debug: console.debug,
    dir: console.dir,
    trace: console.trace,
  };
  const toStderr = (...args: unknown[]): void => {
    console.error(...args);
  };
  console.log = toStderr;
  console.info = toStderr;
  console.debug = toStderr;
  console.dir = toStderr;
  console.trace = toStderr;
  return () => {
    console.log = saved.log;
    console.info = saved.info;
    console.debug = saved.debug;
    console.dir = saved.dir;
    console.trace = saved.trace;
  };
}

/** Start the MCP server over stdio (used by `molen mcp`). */
export async function startMcpServer(): Promise<void> {
  guardMcpStdout();
  const server = createMcpServer();
  await server.connect(new StdioServerTransport());
}
