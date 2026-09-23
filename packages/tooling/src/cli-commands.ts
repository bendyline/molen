import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FigureMode } from '@bendyline/molen-figures/kernel';
import { formatIssues, type Vec3 } from '@bendyline/molen-schema';
import { listFigurePresets } from './ops/figure-presets';
import { type FigureLineup, previewFigure } from './ops/figure-preview';
import {
  applyUvPaintOp,
  bakeWorldgen,
  checkScripts,
  checkTypesOp,
  describeOps,
  diffSnapshots,
  driveScene,
  exportFrames,
  formatBytes,
  formatOp,
  formatPacked,
  formatWorldgenStats,
  generateTypes,
  getComponentOp,
  getSchemaOp,
  importAsset,
  inspectAsset,
  listAssets,
  listComponentsOp,
  listSchemasOp,
  listTypes,
  OPS_CATALOG,
  type OpDescriptor,
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
  simWatch,
  stageAssets,
  testTypes,
  validateAsset,
  worldgenStats,
} from './ops/index';
import { loadComponentRegistry } from './ops/schema';

export interface ParsedArgs {
  positionals: string[];
  flags: Record<string, string | boolean>;
  /** Flags the command does not declare (empty unless a FlagSpec was supplied). */
  unknownFlags?: string[];
  /** Malformed flag usage, e.g. a value given to a valueless flag. */
  flagErrors?: string[];
}

/** What one command accepts: `value` flags take an argument, `boolean` flags never do. */
export interface FlagSpec {
  value: Set<string>;
  boolean: Set<string>;
}

/**
 * Second spellings the usage strings deliberately don't advertise. Everything else is derived
 * from OPS_CATALOG, so a flag cannot exist on the CLI without being documented.
 */
const EXTRA_CLI_FLAGS: Record<string, { value?: string[]; boolean?: string[] }> = {
  frames: { value: ['outDir'] },
  drive: { value: ['out'] },
  play: { value: ['out', 'actions'] },
  asset: { value: ['out'] },
  material: { value: ['out'] },
  uvpaint: { value: ['out'] },
  worldgen: { value: ['out-dir'] },
};

const FLAG_TOKEN = /^(--[A-Za-z][\w-]*|-[A-Za-z])(=.*)?$/s;

function stripUsageBrackets(token: string): string {
  return token.replace(/^[[(]+/, '').replace(/[\])]+$/, '');
}

/**
 * Derive a command's flags from its documented usage forms: a `--flag` followed by anything that
 * is not another flag takes a value, otherwise it is valueless. Deriving instead of duplicating
 * is what keeps `molen describe`, the generated CLI reference, and the parser in step.
 */
function flagsFromUsage(cliForms: string[], verb: string): FlagSpec {
  const spec: FlagSpec = { value: new Set(), boolean: new Set() };
  for (const form of cliForms) {
    const tokens = form.split(/\s+/).filter((t) => t.length > 0);
    for (let i = 0; i < tokens.length; i++) {
      const token = stripUsageBrackets(tokens[i] as string);
      if (!FLAG_TOKEN.test(token)) continue;
      const name = token.replace(/^--?/, '');
      const next = tokens[i + 1] === undefined ? '' : stripUsageBrackets(tokens[i + 1] as string);
      const takesValue = next.length > 0 && next !== '|' && !FLAG_TOKEN.test(next);
      (takesValue ? spec.value : spec.boolean).add(name);
    }
  }
  const extra = EXTRA_CLI_FLAGS[verb];
  for (const name of extra?.value ?? []) spec.value.add(name);
  for (const name of extra?.boolean ?? []) spec.boolean.add(name);
  // A flag documented both ways somewhere is treated as taking a value (the safer reading).
  for (const name of spec.value) spec.boolean.delete(name);
  return spec;
}

function cliVerb(op: OpDescriptor): string | undefined {
  return op.cli?.split(/\s+/)[1];
}

let flagSpecCache: Map<string, FlagSpec> | undefined;

/** Declared flags per CLI verb, derived from the ops catalog (built once). */
export function cliFlagSpecs(): Map<string, FlagSpec> {
  if (flagSpecCache !== undefined) return flagSpecCache;
  const byVerb = new Map<string, string[]>();
  for (const op of OPS_CATALOG) {
    const verb = cliVerb(op);
    if (verb === undefined || op.cli === undefined) continue;
    byVerb.set(verb, [...(byVerb.get(verb) ?? []), op.cli]);
  }
  flagSpecCache = new Map(
    [...byVerb].map(([verb, forms]) => [verb, flagsFromUsage(forms, verb)] as const),
  );
  return flagSpecCache;
}

function levenshtein(a: string, b: string): number {
  const rows: number[][] = [Array.from({ length: b.length + 1 }, (_, j) => j)];
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row.push(
        Math.min(
          (rows[i - 1]?.[j] as number) + 1,
          (row[j - 1] as number) + 1,
          (rows[i - 1]?.[j - 1] as number) + cost,
        ),
      );
    }
    rows.push(row);
  }
  return rows[a.length]?.[b.length] as number;
}

/** " (did you mean --ticks?)" — empty when nothing is close enough to be worth guessing. */
export function didYouMean(name: string, candidates: Iterable<string>, prefix = ''): string {
  let best: string | undefined;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const score = levenshtein(name.toLowerCase(), candidate.toLowerCase());
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  if (best === undefined || bestScore > Math.max(2, Math.floor(name.length / 3))) return '';
  return ` (did you mean ${prefix}${best}?)`;
}

/**
 * Parse `argv` for one command. With a FlagSpec: `--key=value` is understood, declared valueless
 * flags never swallow the following positional, and undeclared flags are reported instead of
 * silently ignored. Without one the legacy permissive behaviour is kept.
 */
export function parseArgs(argv: string[], spec?: FlagSpec): ParsedArgs {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};
  const unknownFlags: string[] = [];
  const flagErrors: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string;
    if (a === '--') {
      positionals.push(...argv.slice(i + 1));
      break;
    }
    if (!FLAG_TOKEN.test(a)) {
      positionals.push(a);
      continue;
    }
    const eq = a.indexOf('=');
    const token = eq === -1 ? a : a.slice(0, eq);
    const inlineValue = eq === -1 ? undefined : a.slice(eq + 1);
    const key = token.replace(/^--?/, '');
    const isBoolean = spec?.boolean.has(key) === true;
    if (spec !== undefined && !isBoolean && !spec.value.has(key)) unknownFlags.push(token);
    if (inlineValue !== undefined) {
      if (isBoolean) {
        if (inlineValue === 'true' || inlineValue === '') flags[key] = true;
        else if (inlineValue === 'false') flags[key] = false;
        else flagErrors.push(`${token} takes no value (got "${inlineValue}")`);
      } else {
        flags[key] = inlineValue;
      }
      continue;
    }
    if (isBoolean) {
      flags[key] = true;
      continue;
    }
    // Unknown flags keep the permissive reading so the error message can still name them.
    const next = argv[i + 1];
    const nextIsFlag =
      next !== undefined &&
      (next.startsWith('--') || (spec !== undefined && FLAG_TOKEN.test(next)));
    if (next !== undefined && !nextIsFlag) {
      flags[key] = next;
      i++;
    } else {
      flags[key] = true;
    }
  }
  return {
    positionals,
    flags,
    ...(unknownFlags.length > 0 ? { unknownFlags } : {}),
    ...(flagErrors.length > 0 ? { flagErrors } : {}),
  };
}

function out(s: string): void {
  process.stdout.write(`${s}\n`);
}
function err(s: string): void {
  process.stderr.write(`${s}\n`);
}

function str(v: string | boolean | undefined): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

/** Parse "x,y,z"; returns undefined if absent, null if present-but-malformed (a real error). */
function parseVec3(v: string | boolean | undefined): Vec3 | null | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== 'string') return null;
  const parts = v.split(',').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  return [parts[0] as number, parts[1] as number, parts[2] as number];
}

async function cmdValidate(args: ParsedArgs): Promise<number> {
  const path = args.positionals[0];
  if (path === undefined) {
    err('usage: molen validate <path> [--kind <kind>] [--project <project.json>] [--verify-files]');
    return 2;
  }
  const result = await validateAsset({
    path,
    kind: str(args.flags.kind),
    verifyFiles: args.flags['verify-files'] === true,
    ...(str(args.flags.project) !== undefined ? { projectPath: str(args.flags.project) } : {}),
  });
  if (result.ok) {
    out(`✓ ${path} is a valid ${result.kind}`);
    if (result.verifiedFiles !== undefined) {
      out(`✓ verified ${result.verifiedFiles} package files (size + SHA-256)`);
    }
    return 0;
  }
  err(result.formatted ?? 'validation failed');
  return 1;
}

async function cmdSim(args: ParsedArgs): Promise<number> {
  if (args.positionals[0] === 'watch' && args.positionals[1] !== undefined) {
    const ticks = typeof args.flags.ticks === 'string' ? Number(args.flags.ticks) : 0;
    if (!Number.isInteger(ticks) || ticks <= 0) {
      err('--ticks <N> is required and must be a positive integer');
      return 2;
    }
    await simWatch({
      scenePath: args.positionals[1],
      ticks,
      commandsPath: str(args.flags.commands),
      assertPath: str(args.flags.assert),
      setupModule: str(args.flags.setup),
      projectPath: str(args.flags.project),
      onRun: (result, diff) => {
        const stamp = `— tick ${result.tick}, ${result.eventCount} events`;
        if (result.error !== undefined) err(`✖ ${result.error}`);
        else out(`${result.ok ? '✓' : '✖'} ${stamp}  [${diff}]`);
        if (result.assertionsFormatted !== undefined) out(result.assertionsFormatted);
      },
    });
    out('watching for changes (ctrl-c to stop)…');
    return await new Promise<number>(() => {}); // run until interrupted
  }
  if (args.positionals[0] !== 'run' || args.positionals[1] === undefined) {
    err(
      'usage: molen sim run <scene> --ticks <N> [--commands f] [--assert f] [--setup m] [--project p] [--hash]\n' +
        '       molen sim watch <scene> --ticks <N> [--commands f] [--assert f] [--setup m] [--project p]',
    );
    return 2;
  }
  const scenePath = args.positionals[1];
  const ticks = typeof args.flags.ticks === 'string' ? Number(args.flags.ticks) : 0;
  if (!Number.isInteger(ticks) || ticks <= 0) {
    err('--ticks <N> is required and must be a positive integer');
    return 2;
  }
  const result = await runSimulation({
    scenePath,
    ticks,
    commandsPath: str(args.flags.commands),
    assertPath: str(args.flags.assert),
    setupModule: str(args.flags.setup),
    projectPath: str(args.flags.project),
  });
  if (result.error !== undefined) {
    err(result.error);
    return 1;
  }
  out(`tick: ${result.tick}`);
  if (args.flags.hash === true) out(`hash: ${result.stateHash}`);
  out(`events: ${result.eventCount}`);
  if (result.physics !== undefined && result.physics !== 'none') {
    out(
      result.physics === 'rapier'
        ? 'physics: rapier (deterministic same-build/same-platform only)'
        : `physics: ${result.physics} (cross-platform deterministic)`,
    );
  }
  if (result.assertionsFormatted !== undefined) out(result.assertionsFormatted);
  return result.ok ? 0 : 1;
}

async function cmdShot(args: ParsedArgs): Promise<number> {
  const scenePath = args.positionals[0];
  const outPath = str(args.flags.out);
  if (scenePath === undefined || outPath === undefined) {
    err(
      'usage: molen shot <scene> --out <png> [--ticks N] [--setup m] [--project p] [--camera x,y,z] [--look x,y,z] [--size WxH] [--clear-color css] [--terrain d.json --heightmap h.png] [--variant ktx2]',
    );
    return 2;
  }
  const ticksRaw = typeof args.flags.ticks === 'string' ? Number(args.flags.ticks) : 0;
  const position = parseVec3(args.flags.camera);
  if (position === null) {
    err(`--camera "${String(args.flags.camera)}" must be three numbers, e.g. --camera 0,6,16`);
    return 2;
  }
  const lookAt = parseVec3(args.flags.look);
  if (lookAt === null) {
    err(`--look "${String(args.flags.look)}" must be three numbers, e.g. --look 0,0,0`);
    return 2;
  }
  let size: [number, number] | undefined;
  if (args.flags.size !== undefined) {
    const s = str(args.flags.size);
    const [w, h] = (s ?? '').split('x').map(Number);
    if (w === undefined || h === undefined || Number.isNaN(w) || Number.isNaN(h)) {
      err(`--size "${String(args.flags.size)}" must be WxH, e.g. --size 1280x720`);
      return 2;
    }
    size = [w, h];
  }
  const terrainPath = str(args.flags.terrain);
  const heightmapPath = str(args.flags.heightmap);
  if (terrainPath !== undefined && heightmapPath === undefined) {
    err('--terrain requires --heightmap <png>');
    return 2;
  }
  const result = await screenshotScene({
    scenePath,
    outPath,
    ticks: Number.isInteger(ticksRaw) && ticksRaw > 0 ? ticksRaw : 0,
    setupModule: str(args.flags.setup),
    projectPath: str(args.flags.project),
    ...(position !== undefined ? { camera: { position, ...(lookAt ? { lookAt } : {}) } } : {}),
    ...(size !== undefined ? { size } : {}),
    ...(terrainPath !== undefined && heightmapPath !== undefined
      ? { terrain: { descriptorPath: terrainPath, heightmapPath } }
      : {}),
    ...(str(args.flags['clear-color']) !== undefined
      ? { clearColor: str(args.flags['clear-color']) }
      : {}),
    ...(str(args.flags.variant) !== undefined ? { assetVariant: str(args.flags.variant) } : {}),
  });
  if (!result.ok) {
    err(result.error ?? 'screenshot failed');
    return 1;
  }
  out(`wrote ${result.imagePath}`);
  out(`tick: ${result.tick}  hash: ${result.stateHash}`);
  const s = result.renderStats;
  if (s !== undefined) {
    out(
      `rendered: ${s.entitiesRendered} entities, ${s.drawCalls} draw calls, ${s.triangles} triangles`,
    );
  }
  return 0;
}

async function cmdMaterial(args: ParsedArgs): Promise<number> {
  if (args.positionals[0] !== 'bake') {
    err('usage: molen material bake <matgraph.json> -o <png>  [or --ref palette:#rrggbb -o <png>]');
    return 2;
  }
  const outPath = str(args.flags.o) ?? str(args.flags.out);
  if (outPath === undefined) {
    err('material bake requires -o <png>');
    return 2;
  }
  const ref = str(args.flags.ref);
  const path = args.positionals[1];
  if (ref === undefined && path === undefined) {
    err('material bake requires a <matgraph.json> path or --ref');
    return 2;
  }
  const result = await rasterizeMaterial({
    outPath,
    ...(ref !== undefined ? { ref } : {}),
    ...(path !== undefined ? { path } : {}),
  });
  if (!result.ok) {
    err(result.error ?? 'bake failed');
    return 1;
  }
  out(
    `wrote ${result.imagePath} (${result.width}x${result.height}, slots: ${result.slots?.join(', ')})`,
  );
  return 0;
}

async function cmdUvPaint(args: ParsedArgs): Promise<number> {
  const painted = args.positionals[0] === 'apply' ? args.positionals[1] : undefined;
  const islands = str(args.flags.islands);
  const outPath = str(args.flags.o) ?? str(args.flags.out);
  if (painted === undefined || islands === undefined || outPath === undefined) {
    err(
      'usage: molen uvpaint apply <painted.png> --islands <map.png> -o <out.png> [--no-mask] [--dilate N]',
    );
    return 2;
  }
  const dilateRaw = str(args.flags.dilate);
  const dilationPx = dilateRaw !== undefined ? Number(dilateRaw) : undefined;
  if (dilationPx !== undefined && (!Number.isInteger(dilationPx) || dilationPx < 0)) {
    err(`--dilate "${String(dilateRaw)}" must be a non-negative integer`);
    return 2;
  }
  const result = await applyUvPaintOp({
    paintedPath: painted,
    islandMapPath: islands,
    outPath,
    ...(args.flags['no-mask'] === true ? { maskToIslands: false } : {}),
    ...(dilationPx !== undefined ? { dilationPx } : {}),
  });
  if (!result.ok) {
    err(result.error ?? 'uvpaint failed');
    return 1;
  }
  out(`wrote ${result.imagePath} (${result.width}x${result.height})`);
  return 0;
}

async function cmdFrames(args: ParsedArgs): Promise<number> {
  const scenePath = args.positionals[0];
  const outDir = str(args.flags['out-dir']) ?? str(args.flags.outDir);
  const from = Number(str(args.flags.from));
  const to = Number(str(args.flags.to));
  if (scenePath === undefined || outDir === undefined || Number.isNaN(from) || Number.isNaN(to)) {
    err(
      'usage: molen frames <scene> --out-dir <d> --from <N> --to <M> [--step S] [--setup m] [--project p] [--track f] [--camera x,y,z] [--look x,y,z] [--size WxH]',
    );
    return 2;
  }
  const position = parseVec3(args.flags.camera);
  const lookAt = parseVec3(args.flags.look);
  if (position === null || lookAt === null) {
    err('--camera/--look must be three numbers, e.g. --camera 0,6,16');
    return 2;
  }
  let size: [number, number] | undefined;
  if (args.flags.size !== undefined) {
    const [w, h] = (str(args.flags.size) ?? '').split('x').map(Number);
    if (w === undefined || h === undefined || Number.isNaN(w) || Number.isNaN(h)) {
      err('--size must be WxH, e.g. --size 1280x720');
      return 2;
    }
    size = [w, h];
  }
  const stepRaw = str(args.flags.step);
  const result = await exportFrames({
    scenePath,
    outDir,
    from,
    to,
    ...(stepRaw !== undefined ? { step: Number(stepRaw) } : {}),
    setupModule: str(args.flags.setup),
    projectPath: str(args.flags.project),
    trackPath: str(args.flags.track),
    ...(position !== undefined ? { camera: { position, ...(lookAt ? { lookAt } : {}) } } : {}),
    ...(size !== undefined ? { size } : {}),
  });
  if (!result.ok) {
    err(result.error ?? 'export failed');
    return 1;
  }
  out(`wrote ${result.frameCount} frames to ${result.dir}`);
  return 0;
}

async function cmdReplay(args: ParsedArgs): Promise<number> {
  const path = args.positionals[0];
  if (path === undefined) {
    err('usage: molen replay <fixture.replay.json> [--setup <m>] [--project <p>] [--record]');
    return 2;
  }
  const result = await runReplayFile({
    path,
    setupModule: str(args.flags.setup),
    projectPath: str(args.flags.project),
    record: args.flags.record === true,
  });
  if (result.error !== undefined) {
    err(result.error);
    return 1;
  }
  out(result.report ?? (result.ok ? '✓ replay matches' : '✖ replay diverged'));
  return result.ok ? 0 : 1;
}

async function cmdDiff(args: ParsedArgs): Promise<number> {
  const [a, b] = args.positionals;
  if (a === undefined || b === undefined) {
    err('usage: molen diff <a.keyframe.json> <b.keyframe.json>');
    return 2;
  }
  const result = await diffSnapshots({ a, b });
  if (!result.ok) {
    err(result.error ?? 'diff failed');
    return 1;
  }
  const diffs = result.diffs ?? [];
  if (diffs.length === 0) {
    out('no differences');
    return 0;
  }
  for (const d of diffs) {
    out(
      `${d.kind} ${d.entity}.${d.component}` +
        (d.kind === 'changed' ? `: ${JSON.stringify(d.before)} -> ${JSON.stringify(d.after)}` : ''),
    );
  }
  return 0;
}

async function cmdDocs(args: ParsedArgs): Promise<number> {
  if (args.positionals[0] !== 'search' || args.positionals[1] === undefined) {
    err('usage: molen docs search <query> [-k N] [--design]');
    return 2;
  }
  const query = args.positionals.slice(1).join(' ');
  const kRaw = str(args.flags.k);
  const result = await searchDocs({
    query,
    ...(kRaw !== undefined ? { k: Number(kRaw) } : {}),
    includeDesign: args.flags.design === true,
  });
  out(result.formatted);
  return 0;
}

function cmdSchema(args: ParsedArgs): number {
  const sub = args.positionals[0];
  if (sub === 'list' || sub === undefined) {
    for (const s of listSchemasOp()) out(`${s.kind.padEnd(10)} ${s.id.padEnd(20)} ${s.title}`);
    return 0;
  }
  if (sub === 'get') {
    const kind = args.positionals[1];
    if (kind === undefined) {
      err('usage: molen schema get <kind>');
      return 2;
    }
    const r = getSchemaOp(kind);
    if (!r.ok) {
      err(r.error ?? 'unknown kind');
      return 1;
    }
    out(
      JSON.stringify(
        { id: r.id, docsRef: r.docsRef, examples: r.examples, jsonSchema: r.jsonSchema },
        null,
        2,
      ),
    );
    return 0;
  }
  err('usage: molen schema list | molen schema get <kind>');
  return 2;
}

async function cmdComponents(args: ParsedArgs): Promise<number> {
  const registry = await loadComponentRegistry({
    projectPath: str(args.flags.project),
    scenePath: str(args.flags.scene),
  });
  for (const c of listComponentsOp(registry)) {
    out(`${c.name.padEnd(15)} ${(c.owner ?? '').padEnd(18)} ${c.description}`);
  }
  return 0;
}

async function cmdComponent(args: ParsedArgs): Promise<number> {
  const name = args.positionals[0];
  if (name === undefined) {
    err('usage: molen component <name>');
    return 2;
  }
  const registry = await loadComponentRegistry({
    projectPath: str(args.flags.project),
    scenePath: str(args.flags.scene),
  });
  const r = getComponentOp(name, registry);
  if (!r.ok) {
    err(r.error ?? 'unknown component');
    return 1;
  }
  out(JSON.stringify(r, null, 2));
  return 0;
}

function cmdDescribe(args: ParsedArgs): number {
  const ops = describeOps(args.positionals[0]);
  if (ops.length === 0) {
    err(`no op matching "${args.positionals[0]}". Try: molen describe`);
    return 1;
  }
  out(ops.map(formatOp).join('\n\n'));
  return 0;
}

async function cmdNew(args: ParsedArgs): Promise<number> {
  const name = args.positionals[0];
  if (name === undefined) {
    err('usage: molen new <name> [--dir <path>] [--force]');
    return 2;
  }
  const result = await scaffoldExperience({
    name,
    dir: str(args.flags.dir),
    force: args.flags.force === true,
  });
  if (!result.ok) {
    err(result.error ?? 'scaffold failed');
    return 1;
  }
  out(`created ${result.dir}`);
  for (const f of result.files ?? []) out(`  ${f}`);
  out('\nnext:');
  for (const step of result.nextSteps ?? []) out(`  ${step}`);
  return 0;
}

async function cmdAsset(args: ParsedArgs): Promise<number> {
  const sub = args.positionals[0];
  if (sub === 'import') {
    const path = args.positionals[1];
    if (path === undefined) {
      err(
        'usage: molen asset import <file.glb> [--id <asset-id>] [--trimesh] [--no-optimize] [--out-dir <d>] [--project <project.json>] [--force]',
      );
      return 2;
    }
    const r = await importAsset({
      path,
      id: str(args.flags.id),
      outDir: str(args.flags['out-dir']),
      trimesh: args.flags.trimesh === true,
      ...(args.flags['no-optimize'] === true ? { optimize: false } : {}),
      projectPath: str(args.flags.project),
      force: args.flags.force === true,
    });
    if (!r.ok) {
      err(r.error ?? 'import failed');
      return 1;
    }
    const s = r.sidecar as NonNullable<typeof r.sidecar>;
    out(`imported "${r.id}" -> ${r.dir}`);
    out(
      `  ${s.stats.triangles} tris, ${s.stats.meshes} meshes, ${s.stats.animations} clips, ${s.collision.hulls.length} hulls${s.collision.trimesh !== undefined ? ' + trimesh' : ''}`,
    );
    out(
      `  ${r.registered === true ? `registered in ${r.projectPath}` : 'NOT registered (no project.json found)'}`,
    );
    for (const w of r.warnings ?? []) out(`  ! ${w}`);
    return 0;
  }
  if (sub === 'inspect') {
    const ref = args.positionals[1];
    if (ref === undefined) {
      err('usage: molen asset inspect <sidecar.json | asset-id> [--verify]');
      return 2;
    }
    const r = await inspectAsset({
      ref,
      verify: args.flags.verify === true,
      projectPath: str(args.flags.project),
    });
    if (!r.ok) {
      err(r.error ?? (r.verifyErrors ?? []).join('\n'));
      return 1;
    }
    out(JSON.stringify(r.sidecar, null, 2));
    if (r.verified === true) out('✓ file hashes verified');
    return 0;
  }
  if (sub === 'list') {
    const r = await listAssets({ projectPath: str(args.flags.project) });
    if (!r.ok) {
      err(r.error ?? 'failed');
      return 1;
    }
    for (const a of r.assets ?? []) {
      out(
        `${a.id.padEnd(24)} ${(a.kind ?? '?').padEnd(6)} ${a.triangles ?? '?'} tris  ${a.sidecar}`,
      );
    }
    if ((r.assets ?? []).length === 0) out('(no assets registered)');
    return 0;
  }
  if (sub === 'shot') {
    const ref = args.positionals[1];
    const outDir = str(args.flags['out-dir']) ?? str(args.flags.out);
    if (ref === undefined || outDir === undefined) {
      err(
        'usage: molen asset shot <asset-id|sidecar> --out-dir <d> [--angles N] [--clip name --time s] [--variant ktx2]',
      );
      return 2;
    }
    const anglesRaw = str(args.flags.angles);
    const timeRaw = str(args.flags.time);
    const r = await screenshotAsset({
      ref,
      outDir,
      projectPath: str(args.flags.project),
      ...(anglesRaw !== undefined ? { angles: Number(anglesRaw) } : {}),
      ...(str(args.flags.clip) !== undefined ? { clip: str(args.flags.clip) } : {}),
      ...(timeRaw !== undefined ? { clipTime: Number(timeRaw) } : {}),
      ...(str(args.flags.variant) !== undefined ? { assetVariant: str(args.flags.variant) } : {}),
    });
    if (!r.ok) {
      err(r.error ?? 'asset shot failed');
      return 1;
    }
    for (const f of r.frames ?? []) out(`wrote ${f.path}`);
    out(`triangles: ${r.triangles}`);
    return 0;
  }
  if (sub === 'pack') {
    const ref = args.positionals[1];
    const all = args.flags.all === true;
    if (ref === undefined && !all) {
      err(
        'usage: molen asset pack <asset-id|sidecar> | --all [--variant ktx2] [--mode auto|etc1s|uastc] [--max-size N] [--no-pot] [--etc1s-quality N] [--uastc-quality N]',
      );
      return 2;
    }
    const mode = str(args.flags.mode);
    if (mode !== undefined && mode !== 'auto' && mode !== 'etc1s' && mode !== 'uastc') {
      err(`--mode "${mode}" must be auto, etc1s, or uastc`);
      return 2;
    }
    const num = (flag: string): number | undefined => {
      const raw = str(args.flags[flag]);
      return raw === undefined ? undefined : Number(raw);
    };
    const r = await packAsset({
      ...(ref !== undefined ? { ref } : {}),
      ...(all ? { all: true } : {}),
      projectPath: str(args.flags.project),
      ...(str(args.flags.variant) !== undefined ? { variant: str(args.flags.variant) } : {}),
      ...(mode !== undefined ? { mode } : {}),
      ...(num('max-size') !== undefined ? { maxSize: num('max-size') } : {}),
      ...(args.flags['no-pot'] === true ? { powerOfTwo: false } : {}),
      ...(num('etc1s-quality') !== undefined ? { etc1sQuality: num('etc1s-quality') } : {}),
      ...(num('uastc-quality') !== undefined ? { uastcQuality: num('uastc-quality') } : {}),
    });
    if (!r.ok) {
      err(r.error ?? 'pack failed');
      return 1;
    }
    for (const line of formatPacked(r.assets ?? [])) out(line);
    for (const w of r.warnings ?? []) out(`  ! ${w}`);
    return 0;
  }
  if (sub === 'stage') {
    const outDir = str(args.flags['out-dir']) ?? str(args.flags.out);
    if (outDir === undefined) {
      err(
        'usage: molen asset stage --out-dir <d> [--variant ktx2] [--require-variant] [--clean] [--project <path>]',
      );
      return 2;
    }
    const r = await stageAssets({
      outDir,
      projectPath: str(args.flags.project),
      ...(str(args.flags.variant) !== undefined ? { variant: str(args.flags.variant) } : {}),
      ...(args.flags['require-variant'] === true ? { requireVariant: true } : {}),
      ...(args.flags.clean === true ? { clean: true } : {}),
    });
    if (!r.ok) {
      err(r.error ?? 'stage failed');
      return 1;
    }
    for (const a of r.assets ?? []) {
      out(
        `${a.id.padEnd(24)} ${a.file}${a.variant !== undefined ? ` [${a.variant}]` : ''}  ${formatBytes(a.bytes)}`,
      );
    }
    out(`wrote ${r.indexPath} (${(r.assets ?? []).length} assets)`);
    for (const w of r.warnings ?? []) out(`  ! ${w}`);
    return 0;
  }
  err(
    'usage: molen asset import <file> | inspect <ref> [--verify] | list | shot <ref> --out-dir <d> | pack <ref>|--all | stage --out-dir <d>',
  );
  return 2;
}

async function cmdDrive(args: ParsedArgs): Promise<number> {
  const scenePath = args.positionals[0];
  const actionsPath = str(args.flags.actions);
  const outDir = str(args.flags['out-dir']) ?? str(args.flags.out);
  if (scenePath === undefined || actionsPath === undefined || outDir === undefined) {
    err(
      'usage: molen drive <scene|name> --actions <actions.json> --out-dir <d> [--setup m] [--until N] [--assert f]',
    );
    return 2;
  }
  const { readFile } = await import('node:fs/promises');
  let actions: unknown;
  try {
    actions = JSON.parse(await readFile(actionsPath, 'utf8'));
  } catch (e) {
    err(`${actionsPath}: ${(e as Error).message}`);
    return 1;
  }
  if (!Array.isArray(actions)) {
    err(`${actionsPath}: expected a JSON array of actions [{at, command?, screenshot?}]`);
    return 1;
  }
  const untilRaw = str(args.flags.until);
  const r = await driveScene({
    scenePath,
    actions: actions as never,
    outDir,
    setupModule: str(args.flags.setup),
    assertPath: str(args.flags.assert),
    projectPath: str(args.flags.project),
    ...(untilRaw !== undefined ? { until: Number(untilRaw) } : {}),
  });
  if (r.error !== undefined) {
    err(r.error);
    return 1;
  }
  for (const f of r.frames ?? []) out(`frame "${f.name}" @ tick ${f.tick} -> ${f.path}`);
  out(`tick: ${r.tick}  hash: ${r.stateHash}  events: ${r.events?.length ?? 0}`);
  if (r.assertionsFormatted !== undefined) out(r.assertionsFormatted);
  return r.ok ? 0 : 1;
}

async function cmdPlay(args: ParsedArgs): Promise<number> {
  const appDir = args.positionals[0];
  const scenarioPath = str(args.flags.scenario) ?? str(args.flags.actions);
  const outDir = str(args.flags['out-dir']) ?? str(args.flags.out);
  if (appDir === undefined || scenarioPath === undefined || outDir === undefined) {
    err(
      'usage: molen play <built-app-dir> --scenario <experience-play.json> --out-dir <d> [--headed]',
    );
    return 2;
  }
  const { readFile } = await import('node:fs/promises');
  let scenario: Record<string, unknown>;
  try {
    scenario = JSON.parse(await readFile(scenarioPath, 'utf8')) as Record<string, unknown>;
  } catch (error) {
    err(`${scenarioPath}: ${(error as Error).message}`);
    return 1;
  }
  const result = await playExperience({
    appDir,
    scenario,
    outDir,
    headed: args.flags.headed === true,
  });
  if (result.error !== undefined) {
    err(result.error);
    if (result.manifestPath !== undefined) out(`failed run manifest: ${result.manifestPath}`);
    return 1;
  }
  for (const frame of result.frames ?? []) {
    out(`frame "${frame.name}" @ action ${frame.actionIndex} -> ${frame.path}`);
  }
  for (const diagnostic of result.diagnostics ?? []) {
    err(`${diagnostic.kind} @ action ${diagnostic.actionIndex}: ${diagnostic.text}`);
  }
  if (result.manifestPath !== undefined) out(`run manifest: ${result.manifestPath}`);
  return result.ok ? 0 : 1;
}

async function cmdProject(args: ParsedArgs): Promise<number> {
  if (args.positionals[0] !== 'info' && args.positionals[0] !== undefined) {
    err('usage: molen project info [--project <path>]');
    return 2;
  }
  const r = await projectInfo({ projectPath: str(args.flags.project) });
  if (r.error !== undefined) {
    err(r.error);
    return 1;
  }
  out(`project: ${r.name}  (${r.path})`);
  out(`scenes: ${Object.keys(r.scenes ?? {}).join(', ') || '(none)'}`);
  if (r.defaultScene !== undefined) out(`default scene: ${r.defaultScene}`);
  out(`types: ${(r.typeIds ?? []).join(', ') || '(none)'}`);
  out(`assets: ${Object.keys(r.assets ?? {}).join(', ') || '(none)'}`);
  for (const res of r.reservations ?? []) {
    out(
      `reserved: ${res.namespace} -> ${res.owner}${res.note !== undefined ? ` (${res.note})` : ''}`,
    );
  }
  if (r.issues !== undefined && r.issues.length > 0) {
    err(formatIssues('project types', r.issues));
    return 1;
  }
  return 0;
}

async function cmdScripts(args: ParsedArgs): Promise<number> {
  const sub = args.positionals[0];
  if (sub !== undefined && sub !== 'check') {
    err('usage: molen scripts check [--project <path>]');
    return 2;
  }
  const r = await checkScripts({ projectPath: str(args.flags.project) });
  if (r.error !== undefined) {
    err(r.error);
    for (const path of [...(r.stale ?? []), ...(r.ungenerated ?? [])]) err(`  ${path}`);
    return 1;
  }
  for (const d of r.diagnostics ?? []) {
    err(`${d.file}:${d.line}:${d.column} ${d.code}: ${d.message}`);
  }
  out(
    r.ok
      ? `✓ ${r.checked ?? 0} script${r.checked === 1 ? '' : 's'} type-check clean`
      : `✖ ${(r.diagnostics ?? []).length} problem(s) in ${r.checked ?? 0} script(s)`,
  );
  return r.ok ? 0 : 1;
}

async function cmdTypes(args: ParsedArgs): Promise<number> {
  const sub = args.positionals[0];
  const projectPath = str(args.flags.project);
  if (sub === 'list' || sub === undefined) {
    const r = await listTypes({ projectPath });
    if (!r.ok) {
      err(r.error ?? 'failed');
      return 1;
    }
    for (const t of r.types ?? []) {
      out(
        `${t.id.padEnd(28)} ${(t.extends !== undefined ? `extends ${t.extends}` : '').padEnd(30)} ${t.doc ?? ''}`,
      );
    }
    return 0;
  }
  if (sub === 'check') {
    const r = await checkTypesOp({ projectPath });
    if (r.error !== undefined) {
      err(r.error);
      return 1;
    }
    if ((r.issues ?? []).length > 0) err(formatIssues('project types', r.issues ?? []));
    if (r.codegenStale === true) err('codegen is stale — run: molen types gen');
    out(r.ok ? '✓ types check passed' : '✖ types check failed');
    return r.ok ? 0 : 1;
  }
  if (sub === 'reserve') {
    const namespace = args.positionals[1];
    const owner = str(args.flags.owner);
    if (namespace === undefined || owner === undefined) {
      err('usage: molen types reserve <namespace> --owner <owner> [--note <s>]');
      return 2;
    }
    const r = await reserveNamespace({
      namespace,
      owner,
      note: str(args.flags.note),
      projectPath,
    });
    if (!r.ok) {
      err(r.error ?? 'reserve failed');
      return 1;
    }
    out(
      r.alreadyReserved === true
        ? `✓ "${namespace}" already reserved by ${owner}`
        : `✓ reserved "${namespace}" for ${owner}`,
    );
    return 0;
  }
  if (sub === 'gen') {
    const r = await generateTypes({
      projectPath,
      out: str(args.flags.out),
      check: args.flags.check === true,
    });
    if (r.error !== undefined && r.stale !== true) {
      err(r.error);
      return 1;
    }
    if (args.flags.check === true) {
      out(
        r.stale === true
          ? `✖ ${r.outPath} is stale — run: molen types gen`
          : '✓ codegen up to date',
      );
      return r.ok ? 0 : 1;
    }
    out(`wrote ${r.outPath} (${r.componentCount} components, ${r.typeCount} types)`);
    return 0;
  }
  if (sub === 'test') {
    const ticksRaw = str(args.flags.ticks);
    const r = await testTypes({
      projectPath,
      ...(ticksRaw !== undefined ? { ticks: Number(ticksRaw) } : {}),
      ...(args.positionals[1] !== undefined ? { only: args.positionals.slice(1) } : {}),
    });
    if (r.error !== undefined) {
      err(r.error);
      return 1;
    }
    for (const t of r.results ?? []) {
      out(`${t.ok ? '✓' : '✖'} ${t.id}${t.error !== undefined ? ` — ${t.error}` : ''}`);
      for (const issue of t.issues ?? []) out(`    ${issue.path}: ${issue.message}`);
    }
    return r.ok ? 0 : 1;
  }
  err('usage: molen types list | check | reserve <ns> --owner <o> | gen [--check] | test [ids…]');
  return 2;
}

function parseSize(v: string | boolean | undefined): [number, number] | undefined {
  if (typeof v !== 'string') return undefined;
  const parts = v.toLowerCase().split('x').map(Number);
  if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n) || n <= 0)) return undefined;
  return [parts[0] as number, parts[1] as number];
}

async function cmdFigure(args: ParsedArgs): Promise<number> {
  const sub = args.positionals[0];
  if (sub === 'presets') {
    const archetype = str(args.flags.archetype);
    if (archetype !== undefined && archetype !== 'biped' && archetype !== 'quadruped') {
      err('--archetype must be biped or quadruped');
      return 2;
    }
    const r = listFigurePresets(archetype !== undefined ? { archetype } : {});
    if (args.flags.json === true) {
      out(JSON.stringify(r.presets, null, 2));
      return 0;
    }
    for (const preset of r.presets) {
      out(
        `${preset.id.padEnd(14)} ${preset.archetype.padEnd(10)} ${preset.species.padEnd(6)} ${preset.height} m`,
      );
    }
    return 0;
  }
  if (sub === 'preview') {
    const usage =
      'usage: molen figure preview [descriptor.figure.json] [--preset id[,id]] [--lineup humans|bodies|species|all] [--mode idle|walk|run|sit|jump|fall] [--tick N] [--tier 0|1|2] [--angles N|review] [--size WxH] --out <png>';
    const outPath = str(args.flags.out);
    if (outPath === undefined) {
      err(usage);
      return 2;
    }
    const lineup = str(args.flags.lineup);
    if (lineup !== undefined && !['humans', 'bodies', 'species', 'all'].includes(lineup)) {
      err('--lineup must be humans, bodies, species or all');
      return 2;
    }
    const mode = str(args.flags.mode);
    if (mode !== undefined && !['idle', 'walk', 'run', 'sit', 'jump', 'fall'].includes(mode)) {
      err('--mode must be idle, walk, run, sit, jump or fall');
      return 2;
    }
    const anglesFlag = str(args.flags.angles);
    const angles =
      anglesFlag === undefined
        ? undefined
        : anglesFlag === 'review'
          ? 'review'
          : Number(anglesFlag);
    const tick = args.flags.tick !== undefined ? Number(args.flags.tick) : undefined;
    const tierRaw = args.flags.tier !== undefined ? Number(args.flags.tier) : undefined;
    const size = parseSize(args.flags.size);
    const presetFlag = str(args.flags.preset);
    const r = await previewFigure({
      ...(presetFlag !== undefined
        ? {
            preset: presetFlag
              .split(',')
              .map((s) => s.trim())
              .filter((s) => s.length > 0),
          }
        : {}),
      descriptorPath: args.positionals[1],
      ...(lineup !== undefined ? { lineup: lineup as FigureLineup } : {}),
      ...(mode !== undefined ? { mode: mode as FigureMode } : {}),
      ...(tick !== undefined && Number.isFinite(tick) ? { tick } : {}),
      ...(tierRaw === 0 || tierRaw === 1 || tierRaw === 2 ? { tier: tierRaw } : {}),
      ...(angles !== undefined && (angles === 'review' || Number.isFinite(angles))
        ? { angles }
        : {}),
      ...(size !== undefined ? { size } : {}),
      outPath,
    });
    if (!r.ok) {
      err(r.error ?? 'figure preview failed');
      return 1;
    }
    out(
      `rendered ${r.stats?.figures ?? 0} figures - ${r.stats?.triangles ?? 0} triangles, ${r.stats?.joints ?? 0} joints - ${r.hash ?? ''}`,
    );
    for (const frame of r.frames ?? []) out(`  ${frame.path} (${frame.name}, yaw ${frame.yawDeg})`);
    return 0;
  }
  err(
    'usage: molen figure preview ... --out <png> | molen figure presets [--archetype biped|quadruped] [--json]',
  );
  return 2;
}

async function cmdWorldgen(args: ParsedArgs): Promise<number> {
  const sub = args.positionals[0];
  const ground = str(args.flags.ground);
  if (ground !== undefined && ground !== 'flat' && ground !== 'slope') {
    err('--ground must be flat or slope');
    return 2;
  }
  if (sub === 'preview') {
    const outPath = str(args.flags.out);
    if (outPath === undefined) {
      err(
        'usage: molen worldgen preview [style.archstyle.json] [--pack p] [--style id] [--batch f] [--scatter id] [--ground flat|slope] [--angles N] [--size WxH] --out <png>',
      );
      return 2;
    }
    const angles = args.flags.angles !== undefined ? Number(args.flags.angles) : undefined;
    const size = parseSize(args.flags.size);
    const r = await previewWorldgen({
      stylePath: args.positionals[1],
      packPath: str(args.flags.pack),
      styleId: str(args.flags.style),
      batchPath: str(args.flags.batch),
      scatterId: str(args.flags.scatter),
      ...(ground !== undefined ? { ground } : {}),
      ...(angles !== undefined && Number.isFinite(angles) ? { angles } : {}),
      ...(size !== undefined ? { size } : {}),
      outPath,
    });
    if (!r.ok) {
      err(r.error ?? 'worldgen preview failed');
      return 1;
    }
    const s = r.stats;
    out(
      `generated ${s?.buildingsRendered ?? 0} buildings (${s?.buildingsBoxed ?? 0} boxed, ${s?.buildingsSkipped ?? 0} skipped) · ${s?.triangles ?? 0} triangles · ${r.hash ?? ''}`,
    );
    if (r.renderStats !== undefined) {
      out(
        `rendered ${r.renderStats.drawCalls} draws · ${r.renderStats.triangles} triangles · ${r.renderStats.instances} instances`,
      );
    }
    for (const failure of r.materialFailures ?? []) out(`  ! material ${failure} rendered flat`);
    for (const frame of r.frames ?? []) out(`  ${frame.path} (yaw ${frame.yawDeg}°)`);
    return 0;
  }
  if (sub === 'bake') {
    const outDir = str(args.flags.out) ?? str(args.flags['out-dir']);
    const batchPath = args.positionals[1];
    const outline = str(args.flags.outline);
    if (outDir === undefined || (batchPath === undefined && outline === undefined)) {
      err(
        'usage: molen worldgen bake [batch.json] [--outline "x,z;x,z;..."] [--style id] [--pack p] --out <assets-dir> [--id id] [--ground flat|slope] [--force]',
      );
      return 2;
    }
    const r = await bakeWorldgen({
      batchPath,
      outline,
      styleId: str(args.flags.style),
      packPath: str(args.flags.pack),
      outDir,
      id: str(args.flags.id),
      ...(ground !== undefined ? { ground } : {}),
      force: args.flags.force === true,
      projectPath: str(args.flags.project),
    });
    if (!r.ok) {
      err(r.error ?? 'worldgen bake failed');
      return 1;
    }
    out(`baked "${r.id}" -> ${r.dir}`);
    out(
      `  ${r.sidecar?.stats.triangles ?? 0} tris, ${r.sidecar?.stats.primitives ?? 0} material groups, ${r.glbBytes ?? 0} bytes · ${r.stats?.buildingsRendered ?? 0} buildings`,
    );
    for (const set of r.placements ?? []) {
      out(`  not baked: ${set.count} x ${set.modelRef} (instanced placements)`);
    }
    for (const w of r.warnings ?? []) out(`  ! ${w}`);
    return 0;
  }
  if (sub === 'stats') {
    const packagePath = args.positionals[1];
    if (packagePath === undefined) {
      err(
        'usage: molen worldgen stats <terrain-package.json> [--tile z/x/y | --auto] [--pack p] [--atlas a] [--style id] [--quality q] [--dump batch.json] [--json]',
      );
      return 2;
    }
    const quality = str(args.flags.quality);
    if (quality !== undefined && !['economy', 'balanced', 'high'].includes(quality)) {
      err('--quality must be economy, balanced, or high');
      return 2;
    }
    const r = await worldgenStats({
      packagePath,
      tile: str(args.flags.tile),
      auto: args.flags.auto === true,
      packPath: str(args.flags.pack),
      atlasPath: str(args.flags.atlas),
      styleId: str(args.flags.style),
      ...(quality !== undefined ? { quality: quality as 'economy' | 'balanced' | 'high' } : {}),
      dumpPath: str(args.flags.dump),
    });
    if (!r.ok) {
      err(r.error ?? 'worldgen stats failed');
      return 1;
    }
    out(args.flags.json === true ? JSON.stringify(r, null, 2) : formatWorldgenStats(r));
    return 0;
  }
  err('usage: molen worldgen preview | bake | stats');
  return 2;
}

async function cmdMcp(): Promise<number> {
  const { startMcpServer } = await import('./mcp');
  await startMcpServer();
  return 0;
}

/** The published package version, for `molen --version` (dist/ and src/ both walk up to it). */
export function cliVersion(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (;;) {
    try {
      const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
        name?: string;
        version?: string;
      };
      if (pkg.name === '@bendyline/molen-tooling' && pkg.version !== undefined) return pkg.version;
    } catch {
      // no package.json here — keep walking up
    }
    const parent = dirname(dir);
    if (parent === dir) return '0.0.0';
    dir = parent;
  }
}

/** The mandatory part of a usage form: everything before the first optional `[...]` group. */
function requiredForm(cli: string): string {
  const withoutMolen = cli.replace(/^molen\s+/, '');
  const optional = withoutMolen.indexOf(' [');
  return (optional === -1 ? withoutMolen : withoutMolen.slice(0, optional)).trim();
}

function firstSentence(summary: string, width: number): string {
  const sentence = /^(.*?[.!?])(\s|$)/.exec(summary)?.[1] ?? summary;
  return sentence.length <= width ? sentence : `${sentence.slice(0, width - 1).trimEnd()}…`;
}

const HELP_COLUMN = 44;
const HELP_WIDTH = 98;

/**
 * Generated from OPS_CATALOG, so a command cannot exist without appearing here — the hand-written
 * version silently omitted the whole `figure` and `scripts` groups.
 */
export function printHelp(): void {
  out('molen <command> [options]   — headless tooling for Molen experiences');
  out('');
  for (const op of OPS_CATALOG) {
    if (op.cli === undefined) continue;
    const form = requiredForm(op.cli);
    if (form.length > HELP_COLUMN - 2) {
      out(`  ${form}`);
      out(
        `${' '.repeat(HELP_COLUMN + 2)}${firstSentence(op.summary, HELP_WIDTH - HELP_COLUMN - 2)}`,
      );
    } else {
      out(
        `  ${form.padEnd(HELP_COLUMN)}${firstSentence(op.summary, HELP_WIDTH - HELP_COLUMN - 2)}`,
      );
    }
  }
  out('');
  out('  help <command>                              full usage + parameters for one command');
  out('  describe [op]                               machine-readable contracts (CLI + MCP)');
  out('  --version, -v                               print the molen version');
}

/** `molen help <command>` / `molen <command> --help`: every op of that verb, in full. */
export function printCommandHelp(verb: string): number {
  const ops = OPS_CATALOG.filter((op) => cliVerb(op) === verb);
  if (ops.length === 0) {
    err(
      `unknown command "${verb}"${didYouMean(verb, Object.keys(CLI_COMMANDS))} (try: molen help)`,
    );
    return 2;
  }
  out(ops.map(formatOp).join('\n\n'));
  return 0;
}

/**
 * The CLI entry point: version/help handling, command lookup with did-you-mean, then a parse
 * against the command's declared flags (an unknown or malformed flag is an error, not a shrug).
 */
export async function runCli(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;
  if (command === undefined) {
    printHelp();
    return 2;
  }
  if (command === '--version' || command === '-v') {
    out(cliVersion());
    return 0;
  }
  if (command === '--help' || command === '-h' || command === 'help') {
    const topic = rest.find((token) => !token.startsWith('-'));
    if (topic === undefined) {
      printHelp();
      return 0;
    }
    return printCommandHelp(topic);
  }
  const handler = CLI_COMMANDS[command];
  if (handler === undefined) {
    err(
      `unknown command "${command}"${didYouMean(command, Object.keys(CLI_COMMANDS))} (try: molen help)`,
    );
    return 2;
  }
  if (rest.includes('--help') || rest.includes('-h')) return printCommandHelp(command);
  const spec = cliFlagSpecs().get(command);
  const args = parseArgs(rest, spec);
  for (const message of args.flagErrors ?? []) err(`molen ${command}: ${message}`);
  for (const flag of args.unknownFlags ?? []) {
    const known = spec === undefined ? [] : [...spec.value, ...spec.boolean].sort();
    err(
      `molen ${command}: unknown flag ${flag}${didYouMean(flag.replace(/^--?/, ''), known, '--')}`,
    );
  }
  if ((args.unknownFlags ?? []).length > 0 || (args.flagErrors ?? []).length > 0) {
    err(`try: molen help ${command}`);
    return 2;
  }
  return handler(args);
}

/**
 * Every CLI verb, keyed by its first token. The `describe` catalog (ops/describe.ts), the MCP
 * server, and this table are cross-checked by test/catalog.test.ts — a new op must land on all
 * three surfaces or that test fails.
 */
export const CLI_COMMANDS: Record<string, (args: ParsedArgs) => number | Promise<number>> = {
  validate: cmdValidate,
  sim: cmdSim,
  shot: cmdShot,
  frames: cmdFrames,
  material: cmdMaterial,
  uvpaint: cmdUvPaint,
  replay: cmdReplay,
  diff: cmdDiff,
  docs: cmdDocs,
  schema: cmdSchema,
  components: cmdComponents,
  component: cmdComponent,
  describe: cmdDescribe,
  asset: cmdAsset,
  drive: cmdDrive,
  play: cmdPlay,
  project: cmdProject,
  types: cmdTypes,
  scripts: cmdScripts,
  new: cmdNew,
  figure: cmdFigure,
  worldgen: cmdWorldgen,
  mcp: cmdMcp,
};
