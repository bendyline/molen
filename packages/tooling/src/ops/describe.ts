export interface OpParam {
  name: string;
  type: string;
  required: boolean;
  description: string;
  /**
   * True for a parameter that exists only on the CLI — the MCP tool derives it (for example an
   * output directory the tool allocates and returns images from). test/catalog.test.ts requires
   * every other param to match the MCP tool's input schema exactly.
   */
  cliOnly?: boolean;
}

export interface OpDescriptor {
  /** Stable op name (matches the MCP tool name where one exists). */
  name: string;
  summary: string;
  /** CLI invocation form, if exposed on the CLI. */
  cli?: string;
  /** MCP tool name, if exposed over MCP. */
  mcpTool?: string;
  params: OpParam[];
}

const p = (name: string, type: string, required: boolean, description: string): OpParam => ({
  name,
  type,
  required,
  description,
});

/** A CLI-only parameter: the MCP tool derives this one instead of accepting it. */
const cliOnly = (name: string, type: string, description: string): OpParam => ({
  name,
  type,
  required: false,
  description,
  cliOnly: true,
});

/** The two context parameters every project-aware op accepts (CLI: --project). */
const projectPathParam = (): OpParam =>
  p('projectPath', 'string', false, 'Explicit project.json (default: walk up from cwd).');
const cwdParam = (): OpParam =>
  p('cwd', 'string', false, 'Directory to discover the project from (default: process.cwd()).');
const scenePathParam = (): OpParam =>
  p(
    'scenePath',
    'string',
    false,
    'A scene manifest whose custom components extend the vocabulary.',
  );

/**
 * Machine-readable contract for every agent-facing operation. The CLI help and the MCP
 * `describe_op` tool both render this, so an agent can discover I/O without reading source.
 */
export const OPS_CATALOG: OpDescriptor[] = [
  {
    name: 'validate_asset',
    summary: 'Validate a JSON asset against its schema (kind auto-detected from the envelope).',
    cli: 'molen validate <path> [--kind <kind>] [--project <project.json>] [--verify-files]',
    mcpTool: 'validate_asset',
    params: [
      p('path', 'string', false, 'Path to a JSON document (or pass inline over MCP).'),
      p(
        'inline',
        'object',
        false,
        'Validate this inline document instead of reading a path (MCP).',
      ),
      p('kind', 'string', false, 'Force a schema kind; otherwise detected from "format".'),
      p(
        'projectPath',
        'string',
        false,
        'Project manifest for scene `type` references (default: discovered from the scene path).',
      ),
      p(
        'verifyFiles',
        'boolean',
        false,
        'For terrain-package manifests, stream-check file containment, size, and SHA-256.',
      ),
    ],
  },
  {
    name: 'run_simulation',
    summary: 'Run a scene headlessly for N ticks; returns tick, state hash, events, assertions.',
    cli: 'molen sim run <scene> --ticks <N> [--commands <f>] [--assert <f>] [--setup <m>] [--project <project.json>] [--hash]',
    mcpTool: 'run_simulation',
    params: [
      p('scenePath', 'string', true, 'Path to a scene manifest JSON.'),
      p('ticks', 'int>0', true, 'Number of ticks to simulate.'),
      p('commandsPath', 'string', false, 'JSON array (or {commands:[...]}) of command envelopes.'),
      p('assertPath', 'string', false, 'A molen/assert@1 document to evaluate after the run.'),
      p('setupModule', 'string', false, 'ESM module exporting setup(world, manifest).'),
      projectPathParam(),
    ],
  },
  {
    name: 'screenshot_scene',
    summary: 'Render one deterministic headless PNG of a scene; returns render stats.',
    cli: 'molen shot <scene> --out <png> [--ticks N] [--setup <m>] [--project <project.json>] [--camera x,y,z] [--look x,y,z] [--size WxH] [--clear-color <css>] [--terrain d.json --heightmap h.png] [--variant ktx2]',
    mcpTool: 'screenshot_scene',
    params: [
      p('scenePath', 'string', true, 'Path to a scene manifest JSON.'),
      p('outPath', 'string', true, 'Output PNG path.'),
      p('ticks', 'int>=0', false, 'Tick to simulate to before snapshotting (default 0).'),
      p('setupModule', 'string', false, 'ESM module exporting setup(world, manifest).'),
      p('camera', '{position,lookAt}', false, 'Camera position and optional look-at target.'),
      p('size', '[w,h]', false, 'Image size (default 1280x720).'),
      p('clearColor', 'string', false, 'Background colour (CSS/hex) instead of the scene default.'),
      projectPathParam(),
      p(
        'assetVariant',
        'string',
        false,
        'Render packed asset variants (e.g. "ktx2" from asset pack) where present.',
      ),
      p(
        'terrain',
        '{descriptorPath,heightmapPath}',
        false,
        'Render a terrain descriptor + heightmap.',
      ),
    ],
  },
  {
    name: 'run_replay',
    summary: 'Replay a fixture and compare the state hash; localizes divergence on mismatch.',
    cli: 'molen replay <fixture> [--setup <m>] [--project <project.json>] [--record]',
    mcpTool: 'run_replay',
    params: [
      p('path', 'string', true, 'Path to a *.replay.json fixture.'),
      p('setupModule', 'string', false, 'ESM module exporting setup(world, manifest).'),
      projectPathParam(),
      p('record', 'boolean', false, 'Regenerate expected hashes from the current build.'),
    ],
  },
  {
    name: 'diff_snapshots',
    summary: 'Component-level diff between two keyframe JSON files.',
    cli: 'molen diff <a.keyframe.json> <b.keyframe.json>',
    mcpTool: 'diff_snapshots',
    params: [
      p('a', 'string', true, 'Before keyframe path.'),
      p('b', 'string', true, 'After keyframe path.'),
    ],
  },
  {
    name: 'rasterize_material',
    summary: 'Bake a material graph / palette ref to a PNG texture.',
    cli: 'molen material bake <matgraph.json> -o <png>  [--ref palette:#rrggbb]',
    mcpTool: 'rasterize_material',
    params: [
      p('path', 'string', false, 'Material graph JSON path.'),
      p('inline', 'object', false, 'An inline molen/matgraph@1 document (MCP).'),
      p('ref', 'string', false, 'A material ref, e.g. palette:#rrggbb.'),
      p('outPath', 'string', true, 'Output PNG path.'),
    ],
  },
  {
    name: 'list_schemas',
    summary: 'List all registered asset schema kinds.',
    cli: 'molen schema list',
    mcpTool: 'list_schemas',
    params: [],
  },
  {
    name: 'get_schema',
    summary: 'Get a schema kind: JSON Schema + examples + docs reference.',
    cli: 'molen schema get <kind>',
    mcpTool: 'get_schema',
    params: [p('kind', 'string', true, 'Schema kind, e.g. scene, command, assert.')],
  },
  {
    name: 'list_components',
    summary: 'List the known component vocabulary (name, description, owning layer).',
    cli: 'molen components [--project <project.json>] [--scene <scene.json>]',
    mcpTool: 'list_components',
    params: [projectPathParam(), scenePathParam()],
  },
  {
    name: 'get_component',
    summary: 'Get one component schema + examples.',
    cli: 'molen component <name> [--project <project.json>] [--scene <scene.json>]',
    mcpTool: 'get_component',
    params: [
      p('name', 'string', true, 'Component name, e.g. transform, collider.'),
      projectPathParam(),
      scenePathParam(),
    ],
  },
  {
    name: 'search_docs',
    summary: 'Lexical search over the shipped engine docs (docs-src bundle).',
    cli: 'molen docs search <query> [-k N] [--design]',
    mcpTool: 'search_docs',
    params: [
      p('query', 'string', true, 'Search terms.'),
      p('k', 'int>0', false, 'Max results (default 5).'),
      p('includeDesign', 'boolean', false, 'Also search the docs/ design plan (tagged).'),
    ],
  },
  {
    name: 'export_frames',
    summary: 'Render a tick range to a PNG sequence, optionally following a camera track.',
    cli: 'molen frames <scene> --out-dir <d> --from <N> --to <M> [--step S] [--track f] [--setup m] [--project <project.json>] [--camera x,y,z] [--look x,y,z] [--size WxH]',
    mcpTool: 'export_frames',
    params: [
      p('scenePath', 'string', true, 'Scene manifest path.'),
      p('outDir', 'string', true, 'Output directory.'),
      p('from', 'int>=0', true, 'First tick.'),
      p('to', 'int>=0', true, 'Last tick.'),
      p('step', 'int>0', false, 'Tick stride between frames (default 1).'),
      p('setupModule', 'string', false, 'ESM module exporting setup(world, manifest).'),
      p('trackPath', 'string', false, 'Camera track JSON followed across the range.'),
      p('camera', '{position,lookAt}', false, 'Fixed camera when no track is given.'),
      p('size', '[w,h]', false, 'Image size (default 1280x720).'),
      projectPathParam(),
    ],
  },
  {
    name: 'apply_uv_paint',
    summary: 'Import a painted UV template: mask to the island map and dilate the gutters.',
    cli: 'molen uvpaint apply <painted.png> --islands <map.png> -o <out.png> [--no-mask] [--dilate N]',
    mcpTool: 'apply_uv_paint',
    params: [
      p('paintedPath', 'string', true, 'Painted texture (from an image model).'),
      p('islandMapPath', 'string', true, 'Island map (flat-filled islands on a dark background).'),
      p('outPath', 'string', true, 'Output PNG path.'),
      p('maskToIslands', 'boolean', false, 'Mask paint to the islands (default true).'),
      p('dilationPx', 'int>=0', false, 'Gutter dilation in pixels.'),
    ],
  },
  {
    name: 'describe_op',
    summary: 'Machine-readable contracts for every molen operation (CLI + MCP).',
    cli: 'molen describe [op]',
    mcpTool: 'describe_op',
    params: [
      p('name', 'string', false, 'Op/tool name or CLI fragment; omit for the full catalog.'),
    ],
  },
  {
    name: 'new_experience',
    summary: 'Scaffold a new experience (scene + scripts + commands + checks) ready for the loop.',
    cli: 'molen new <name> [--dir <path>] [--force]',
    mcpTool: 'new_experience',
    params: [
      p('name', 'string', true, 'Experience name (also the output folder name).'),
      p('dir', 'string', false, 'Parent directory (default: cwd).'),
      p('force', 'boolean', false, 'Replace existing scaffold-owned files (default false).'),
    ],
  },
  {
    name: 'drive_scene',
    summary:
      'PLAY a scene deterministically: commands in at chosen ticks, screenshot frames out — a repeatable scenario the agent can look at.',
    cli: 'molen drive <scene|name> --actions <actions.json> --out-dir <d> [--setup m] [--until N] [--assert f] [--project <project.json>]',
    mcpTool: 'drive_scene',
    params: [
      p('scenePath', 'string', true, 'Scene file path or project scene name.'),
      p(
        'actions',
        '[{at, command?, screenshot?, camera?}]',
        true,
        'Tick-ordered actions: submit a command and/or capture a named frame.',
      ),
      p('until', 'int>=0', false, 'Step to this tick after the last action.'),
      p('assertPath', 'string', false, 'molen/assert@1 doc evaluated at the end.'),
      p('setupModule', 'string', false, 'ESM module exporting setup(world, manifest).'),
      p('size', '[w,h]', false, 'Frame size (default 1280x720).'),
      cliOnly('outDir', 'string', 'Output directory for the frames (MCP returns them as images).'),
      projectPathParam(),
    ],
  },
  {
    name: 'play_experience',
    summary:
      'PLAY a built browser experience: timed inputs in, screenshots/probes/diagnostics out.',
    cli: 'molen play <built-app-dir> --scenario <experience-play.json> --out-dir <d> [--headed]',
    mcpTool: 'play_experience',
    params: [
      p('appDir', 'string', true, 'Built browser app directory containing index.html.'),
      p(
        'scenario',
        'molen/experience-play@1',
        true,
        'Declarative waits, keyboard input, drags, UI actions, probes, and screenshots.',
      ),
      cliOnly(
        'outDir',
        'string',
        'Output directory for frames and experience-run.json (MCP uses a temp dir).',
      ),
    ],
  },
  {
    name: 'screenshot_asset',
    summary: 'Render an imported asset from N turntable angles (framed from its sidecar bounds).',
    cli: 'molen asset shot <asset-id|sidecar> --out-dir <d> [--angles N] [--clip name --time s] [--variant ktx2]',
    mcpTool: 'screenshot_asset',
    params: [
      p('ref', 'string', true, 'Project asset id or sidecar path.'),
      p('angles', 'int>0', false, 'Turntable angle count (default 4).'),
      p('size', '[w,h]', false, 'Frame size (default 1280x720).'),
      projectPathParam(),
      p('clip', 'string', false, 'Pose this animation clip.'),
      p('clipTime', 'number>=0', false, 'Clip time in seconds (default 0).'),
      p(
        'assetVariant',
        'string',
        false,
        'Render this packed variant (e.g. "ktx2") instead of the canonical GLB.',
      ),
    ],
  },
  {
    name: 'pack_asset',
    summary:
      'Derive a RUNTIME GLB variant: textures re-encoded as KTX2 (Basis) with mipmaps, power-of-two sized, so the GPU gets ASTC/BC7 instead of RGBA8 (4-8x less texture memory). Recorded as files.variants.<variant>.',
    cli: 'molen asset pack <asset-id|sidecar> | --all [--variant ktx2] [--mode auto|etc1s|uastc] [--max-size N] [--no-pot] [--etc1s-quality N] [--uastc-quality N]',
    mcpTool: 'pack_asset',
    params: [
      p('ref', 'string', false, 'Project asset id or sidecar path (or pass all: true).'),
      p('all', 'boolean', false, 'Pack every asset registered in the project.'),
      p('variant', 'string', false, 'Variant name / file suffix (default "ktx2").'),
      p(
        'mode',
        'auto|etc1s|uastc',
        false,
        'Codec: auto = ETC1S for sRGB color maps, UASTC for normal/roughness/metal/AO (default).',
      ),
      p('maxSize', 'int>=4', false, 'Longest texture side after resizing (default 2048).'),
      p('powerOfTwo', 'boolean', false, 'Snap sides to a power of two (default true).'),
      p('etc1sQuality', 'int 1..255', false, 'ETC1S quality (default 128).'),
      p('uastcQuality', 'int 0..4', false, 'UASTC pack quality (default 2).'),
      projectPathParam(),
    ],
  },
  {
    name: 'stage_assets',
    summary:
      "Copy registered assets' runtime files (packed variant when requested) into a browser-servable directory and write assets.index.json (id -> URL). Fails on stale assets.",
    cli: 'molen asset stage --out-dir <d> [--variant ktx2] [--require-variant] [--clean] [--project <path>]',
    mcpTool: 'stage_assets',
    params: [
      p('outDir', 'string', true, 'Output directory (created).'),
      p('variant', 'string', false, 'Stage this packed variant instead of the main GLB.'),
      p(
        'requireVariant',
        'boolean',
        false,
        'Fail when an asset lacks the variant (default: warn).',
      ),
      p('clean', 'boolean', false, 'Remove a previous staging output first (default false).'),
      p('projectPath', 'string', false, 'Explicit project.json (default: walk up from cwd).'),
    ],
  },
  {
    name: 'build_pack',
    summary:
      'Build a content pack (molen/pack@1 zip) from a source directory holding molen-pack.source.json. Writes <id>-<hash>.zip and updates index.json in outDir.',
    cli: 'molen pack build <sourceDir> --out-dir <d> [--no-solid]',
    mcpTool: 'build_pack',
    params: [
      p('sourceDir', 'string', true, 'Pack source directory (holds molen-pack.source.json).'),
      p('outDir', 'string', true, 'Output directory for the pack file and index.json.'),
      p(
        'solid',
        'boolean',
        false,
        "Group small text files into compressed solid blocks (default: the source's setting).",
      ),
    ],
  },
  {
    name: 'inspect_pack',
    summary:
      'Summarize a content pack: id, version, contentHash, sizes, solid blocks, asset ids, roles and the largest files.',
    cli: 'molen pack inspect <source>',
    mcpTool: 'inspect_pack',
    params: [
      p('source', 'string', true, 'Built pack file, pack source directory, or http(s) URL.'),
    ],
  },
  {
    name: 'verify_pack',
    summary:
      'Read every file of a content pack checking CRC and sha256, validate each JSON document against its registered schema, and check asset sidecar hashes against their models.',
    cli: 'molen pack verify <source>',
    mcpTool: 'verify_pack',
    params: [
      p('source', 'string', true, 'Built pack file, pack source directory, or http(s) URL.'),
    ],
  },
  {
    name: 'extract_pack',
    summary:
      'Write every file of a content pack into a directory, with a molen-pack.source.json that builds it back to the same content.',
    cli: 'molen pack extract <source> --out-dir <d>',
    mcpTool: 'extract_pack',
    params: [
      p('source', 'string', true, 'Built pack file or http(s) URL.'),
      p('outDir', 'string', true, 'Directory to write the files into.'),
    ],
  },
  {
    name: 'fetch_pack',
    summary:
      'Download content packs (a pack URL, or a molen/pack-index@1 URL) into the project and pin them in project.json `packs` with their contentHash, so the project runs offline.',
    cli: 'molen pack fetch <url> [ids…] [--out-dir <d>] [--project <path>]',
    mcpTool: 'fetch_pack',
    params: [
      p('url', 'string', true, 'URL of a pack file, or of a pack index.'),
      p('ids', 'string[]', false, 'With an index URL, fetch only these pack ids (default: all).'),
      p('outDir', 'string', false, 'Download directory (default: packs/ beside project.json).'),
      projectPathParam(),
      cwdParam(),
    ],
  },
  {
    name: 'test_types',
    summary:
      'Smoke-test every registry type standalone: resolved shape validates, spawns, and survives N simulated ticks.',
    cli: 'molen types test [ids…] [--ticks N]',
    mcpTool: 'test_types',
    params: [
      p('ticks', 'int>0', false, 'Ticks to simulate each type (default 30).'),
      p('only', 'string[]', false, 'Restrict to these type ids.'),
      projectPathParam(),
      cwdParam(),
    ],
  },
  {
    name: 'sim_watch',
    summary: 'Rerun the simulation + assertions on every input-file change, reporting what moved.',
    cli: 'molen sim watch <scene> --ticks <N> [--commands f] [--assert f] [--setup m] [--project <project.json>]',
    params: [
      p('scenePath', 'string', true, 'Scene manifest path.'),
      p('ticks', 'int>0', true, 'Ticks per run.'),
      p('commandsPath', 'string', false, 'JSON array (or {commands:[...]}) of command envelopes.'),
      p('assertPath', 'string', false, 'A molen/assert@1 document evaluated after every run.'),
      p('setupModule', 'string', false, 'ESM module exporting setup(world, manifest).'),
      projectPathParam(),
    ],
  },
  {
    name: 'import_asset',
    summary:
      'Import a glTF/GLB: normalize, extract bounds + collision (hulls/trimesh), write the asset sidecar, register in project.json.',
    cli: 'molen asset import <file.glb> [--id <asset-id>] [--trimesh] [--no-optimize] [--out-dir <d>] [--project <project.json>] [--force]',
    mcpTool: 'import_asset',
    params: [
      p('path', 'string', true, 'Source .glb/.gltf file.'),
      p(
        'id',
        'string',
        false,
        'Asset id (default: slugged filename; dotted ids join a namespace).',
      ),
      p(
        'trimesh',
        'boolean',
        false,
        'Also extract a whole-asset collision trimesh (collision.bin).',
      ),
      p('optimize', 'boolean', false, 'Normalize pass dedup/prune/weld/quantize (default true).'),
      p('outDir', 'string', false, 'Assets root override (default: <project dir>/assets).'),
      p(
        'projectPath',
        'string',
        false,
        'project.json to register into. Required when the source file sits in a different project than the cwd.',
      ),
      cwdParam(),
      p('force', 'boolean', false, 'Replace an existing asset directory (default false).'),
    ],
  },
  {
    name: 'inspect_asset',
    summary:
      'Read + validate an asset sidecar (by path or project asset id); --verify re-hashes files.',
    cli: 'molen asset inspect <sidecar.json | asset-id> [--verify]',
    mcpTool: 'inspect_asset',
    params: [
      p('ref', 'string', true, 'Sidecar path or registered asset id.'),
      p('verify', 'boolean', false, 'Re-hash model.glb / collision.bin against the sidecar.'),
      projectPathParam(),
    ],
  },
  {
    name: 'list_assets',
    summary: 'List the assets registered in the surrounding project.',
    cli: 'molen asset list [--project <path>]',
    mcpTool: 'list_assets',
    params: [
      p('projectPath', 'string', false, 'Explicit project.json (default: walk up from cwd).'),
      cwdParam(),
    ],
  },
  {
    name: 'get_project',
    summary: 'Show the surrounding project.json: scenes, types, assets, reservations.',
    cli: 'molen project info [--project <path>]',
    mcpTool: 'get_project',
    params: [
      p('projectPath', 'string', false, 'Explicit project.json (default: walk up from cwd).'),
      cwdParam(),
    ],
  },
  {
    name: 'list_types',
    summary: 'List the entity types registered in the project type registry.',
    cli: 'molen types list [--project <path>]',
    mcpTool: 'list_types',
    params: [
      p('projectPath', 'string', false, 'Explicit project.json (default: walk up from cwd).'),
      cwdParam(),
    ],
  },
  {
    name: 'check_types',
    summary:
      'Validate the type registry: duplicates, cycles, namespace ownership, asset refs, codegen staleness.',
    cli: 'molen types check [--project <path>]',
    mcpTool: 'check_types',
    params: [
      p('projectPath', 'string', false, 'Explicit project.json (default: walk up from cwd).'),
      cwdParam(),
    ],
  },
  {
    name: 'reserve_type',
    summary:
      'Reserve a type/asset id namespace for an owner (multi-agent vocabulary partitioning).',
    cli: 'molen types reserve <namespace> --owner <owner> [--note <s>]',
    mcpTool: 'reserve_type',
    params: [
      p('namespace', 'string', true, 'Dotted namespace, e.g. "train".'),
      p('owner', 'string', true, 'Owner identity, e.g. "agent:layout".'),
      p('note', 'string', false, 'Free-form note recorded with the reservation.'),
      projectPathParam(),
      cwdParam(),
    ],
  },
  {
    name: 'generate_types',
    summary:
      'Generate (or verify) the typed component/type-id module plus the ambient types beside each scripts directory.',
    cli: 'molen types gen [--check] [--out <path>]',
    mcpTool: 'generate_types',
    params: [
      p('check', 'boolean', false, 'Compare only; fail when a committed artifact is stale.'),
      p('out', 'string', false, 'Output path override (default: project codegen.out).'),
      projectPathParam(),
      cwdParam(),
    ],
  },
  {
    name: 'check_scripts',
    summary:
      "Type-check the scene's scripts against their generated declarations: component typos, bad command payloads, unguarded reads.",
    cli: 'molen scripts check [--project <path>]',
    mcpTool: 'check_scripts',
    params: [
      p('projectPath', 'string', false, 'Explicit project.json (default: walk up from cwd).'),
      cwdParam(),
    ],
  },
  {
    name: 'figure_preview',
    summary:
      'Render figure presets, a molen/figure@1 descriptor, or a built-in lineup headlessly from turntable angles or the art-review view set (PNGs).',
    cli: 'molen figure preview [descriptor.figure.json] [--preset id[,id]] [--lineup humans|bodies|species|all] [--mode idle|walk|run|sit|jump|fall] [--tick N] [--tier 0|1|2] [--angles N|review] [--size WxH] --out <png>',
    mcpTool: 'figure_preview',
    params: [
      p('preset', 'string|string[]', false, 'Preset id(s) to render (default human.adult).'),
      p('descriptorPath', 'string', false, 'A molen/figure@1 document to render.'),
      p('descriptor', 'object', false, 'An inline descriptor (the figure component shape).'),
      p('lineup', "'humans'|'bodies'|'species'|'all'", false, 'A built-in lineup.'),
      p('mode', "'idle'|'walk'|'run'|'sit'|'jump'|'fall'", false, 'Pose mode (default idle).'),
      p('tick', 'int>=0', false, 'Simulation tick to pose at (default 15).'),
      p('tier', '0|1|2', false, 'Body detail tier (default 0 = near).'),
      p(
        'angles',
        "int>0|'review'",
        false,
        "Turntable angle count, or 'review' (front, three-quarter, rear, gameplay distance).",
      ),
      p('size', '[w,h]', false, 'Viewport in pixels (default 1280x720).'),
      cliOnly('outPath', 'string', 'PNG path (CLI: --out); MCP returns the images directly.'),
    ],
  },
  {
    name: 'list_figure_presets',
    summary: 'List the shipped figure presets with their resolved descriptors.',
    cli: 'molen figure presets [--archetype biped|quadruped] [--json]',
    mcpTool: 'list_figure_presets',
    params: [p('archetype', "'biped'|'quadruped'", false, 'Only presets of this archetype.')],
  },
  {
    name: 'worldgen_preview',
    summary:
      'Generate buildings from a style pack in Node and render them headlessly (turntable PNGs). Default batch: one building of every footprint class.',
    cli: 'molen worldgen preview [style.archstyle.json] [--pack p] [--style id] [--batch f] [--scatter id] [--ground flat|slope] [--angles N] [--size WxH] --out <png>',
    mcpTool: 'worldgen_preview',
    params: [
      p('stylePath', 'string', false, 'A standalone molen/archstyle@1 document to preview.'),
      p(
        'packPath',
        'string',
        false,
        "Style pack: a stylepack.json or its directory, or a content pack file, URL or source directory (default: the project's content packs).",
      ),
      p('styleId', 'string', false, 'Force every building onto this style id.'),
      p('batchPath', 'string', false, 'A molen/worldgen-batch@1 document (default: the lineup).'),
      p('scatterId', 'string', false, 'Scatter rule set for the batch scatter request.'),
      p('ground', "'flat'|'slope'", false, 'Override the batch ground.'),
      p('angles', 'int>0', false, 'Turntable angles (default 1).'),
      p('size', '[w,h]', false, 'Viewport in pixels (default 1280x720).'),
      cliOnly('outPath', 'string', 'PNG path (CLI: --out); MCP returns the images directly.'),
    ],
  },
  {
    name: 'worldgen_bake',
    summary:
      'Generate buildings from a batch document or one outline and bake them to a glTF asset with a molen/asset@1 sidecar.',
    cli: 'molen worldgen bake [batch.json] [--outline "x,z;x,z;..."] [--style id] [--pack p] --out <assets-dir> [--id id] [--ground flat|slope] [--project <project.json>] [--force]',
    mcpTool: 'worldgen_bake',
    params: [
      p('batchPath', 'string', false, 'A molen/worldgen-batch@1 document.'),
      p('outline', 'string', false, 'One building outline "x,z;x,z;..." in meters (with styleId).'),
      p('styleId', 'string', false, 'Style id for the outline, or forced onto every building.'),
      p(
        'packPath',
        'string',
        false,
        "Style pack: a stylepack.json or its directory, or a content pack file, URL or source directory (default: the project's content packs).",
      ),
      p('outDir', 'string', true, 'Assets root; the asset lands in <outDir>/<id>/.'),
      p('id', 'string', false, 'Asset id (default: the batch name).'),
      p('ground', "'flat'|'slope'", false, 'Override the batch ground.'),
      projectPathParam(),
      p('force', 'boolean', false, 'Replace an existing asset directory.'),
    ],
  },
  {
    name: 'worldgen_stats',
    summary:
      'Generate one real terrain-package tile in Node and report counts, histograms, sizes, timings, and determinism; optionally dump the adapted batch.',
    cli: 'molen worldgen stats <terrain-package.json> [--tile z/x/y | --auto] [--pack p] [--atlas a] [--style id] [--quality q] [--dump batch.json] [--json]',
    mcpTool: 'worldgen_stats',
    params: [
      p('packagePath', 'string', true, 'terrain-package.json path.'),
      p('tile', 'string', false, '"z/x/y" tile address (default: the package center).'),
      p('auto', 'boolean', false, 'Search the tiles around the center for the most buildings.'),
      p(
        'packPath',
        'string',
        false,
        "Style pack: a stylepack.json or its directory, or a content pack file, URL or source directory (default: the project's content packs).",
      ),
      p(
        'atlasPath',
        'string',
        false,
        "Region atlas: a world.atlas.json, or a content pack that provides one (default: the project's content packs).",
      ),
      p('styleId', 'string', false, 'Force every building onto this style id.'),
      p('quality', "'economy'|'balanced'|'high'", false, 'Tile budget preset (default balanced).'),
      p('dumpPath', 'string', false, 'Write the adapted molen/worldgen-batch@1 here.'),
    ],
  },
  {
    name: 'mcp_server',
    summary: 'Start the MCP server over stdio (exposes every mcpTool in this catalog).',
    cli: 'molen mcp',
    params: [],
  },
];

/** Return the full catalog, or just the entry whose name/cli/mcpTool matches `name`. */
export function describeOps(name?: string): OpDescriptor[] {
  if (name === undefined || name.length === 0) return OPS_CATALOG;
  const n = name.toLowerCase();
  return OPS_CATALOG.filter(
    (o) =>
      o.name.toLowerCase() === n ||
      o.mcpTool?.toLowerCase() === n ||
      o.cli?.toLowerCase().includes(n),
  );
}

/** Render one descriptor as agent-facing help text. */
export function formatOp(op: OpDescriptor): string {
  const lines = [`${op.name} — ${op.summary}`];
  if (op.cli !== undefined) lines.push(`  cli: ${op.cli}`);
  if (op.mcpTool !== undefined) lines.push(`  mcp: ${op.mcpTool}`);
  for (const param of op.params) {
    lines.push(
      `  · ${param.name} (${param.type}${param.required ? ', required' : ''}) — ${param.description}`,
    );
  }
  return lines.join('\n');
}
