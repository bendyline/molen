import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { ENGINE_VERSION } from '@bendyline/molen-kernel';
import { generateTypes } from './generate-types';
import { loadTemplateBundle, type TemplateManifest } from './templates';

export interface ScaffoldInput {
  /** Experience name; also the output folder name and the type namespace. */
  name: string;
  /** Parent directory (default: cwd). */
  dir?: string;
  /** Replace scaffold-owned files that already exist. Default false. */
  force?: boolean;
  /**
   * Copy a shipped sample instead of the built-in starter: a template id from `listTemplates()`
   * (`molen templates`), e.g. `cubes` or `top-down-arena`.
   */
  template?: string;
}

export interface ScaffoldOutput {
  ok: boolean;
  dir?: string;
  files?: string[];
  nextSteps?: string[];
  error?: string;
}

/** Scene names must be lower_snake; the scaffold namespace doubles as the types namespace. */
function slug(name: string): string {
  return name.toLowerCase().replaceAll('-', '_');
}

function projectJson(name: string): string {
  const project = {
    format: 'molen/project@1',
    name,
    scenes: { main: 'scenes/main.scene.json' },
    defaultScene: 'main',
    types: ['types/main.types.json'],
    assets: {},
    reservations: [{ namespace: slug(name), owner: 'you', note: 'scaffold default' }],
    setup: 'setup.mjs',
    codegen: { out: 'src/gen/molen-types.ts' },
  };
  return `${JSON.stringify(project, null, 2)}\n`;
}

function typesJson(name: string): string {
  const ns = slug(name);
  const types = {
    format: 'molen/types@1',
    namespace: ns,
    owner: 'you',
    doc: `Entity types for ${name}. Add new types under the "${ns}." namespace.`,
    types: {
      [`${ns}.hero`]: {
        doc: 'The player-controlled cube: a kinematic circle driven by the move command.',
        components: {
          transform: { pos: [0, 0.5, 0], rot: [0, 0, 0, 1] },
          collider: { shape: 'circle', radius: 0.5, layer: 1, mask: 1 },
          kinematicBody: { vel: [0, 0, 0], slide: true },
          renderable: { kind: 'primitive', ref: 'box', materialRef: 'palette:#4363d8' },
        },
      },
      [`${ns}.cube`]: {
        doc: 'A spinning demo cube (spawned by the spawn_cube command).',
        components: {
          transform: { pos: [0, 0.5, 0], rot: [0, 0, 0, 1] },
          renderable: { kind: 'primitive', ref: 'box', materialRef: 'palette:#e6194b' },
        },
      },
    },
  };
  return `${JSON.stringify(types, null, 2)}\n`;
}

function sceneJson(name: string): string {
  const ns = slug(name);
  const scene = {
    format: 'molen/scene@3',
    name,
    seed: `${name}-1`,
    tickRate: 30,
    // Logic as scene data — TypeScript, type-erased at load, evaluated in a per-script SES
    // Compartment (determinism, not isolation: see the scripting guide's "Script trust").
    // `molen` is the verb set, `config` is each script's config object.
    physics: { engine: 'kinematics' },
    camera: { mode: 'fixed', position: [0, 9, 14], lookAt: [0, 0, 0] },
    input: {
      bindings: { KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right', Space: 'spawn' },
      emit: [
        {
          kind: 'axis2d',
          xNeg: 'left',
          xPos: 'right',
          yNeg: 'up',
          yPos: 'down',
          command: 'move',
          field: 'dir',
        },
        { kind: 'press', action: 'spawn', command: 'spawn_cube' },
      ],
    },
    commands: {
      move: {
        doc: 'Set the hero planar move direction: dir = [x, z], each in -1..1.',
        payload: {
          type: 'object',
          properties: {
            dir: {
              type: 'array',
              items: { type: 'number', minimum: -1, maximum: 1 },
              minItems: 2,
              maxItems: 2,
            },
          },
          required: ['dir'],
          additionalProperties: false,
        },
      },
      spawn_cube: { doc: 'Spawn one more spinning cube (handled in setup.mjs).' },
    },
    // Custom vocabulary this scene introduces (documented + known to validation).
    components: {
      spinner: {
        description: 'Marks an entity the spin script rotates.',
        examples: [{ on: true }],
      },
    },
    entities: [
      { id: 'hero', type: `${ns}.hero` },
      {
        id: 'ground',
        components: {
          // A plane lies in XY; this quaternion tips it flat (-90° about X) so it is a floor.
          transform: { pos: [0, 0, 0], rot: [-Math.SQRT1_2, 0, 0, Math.SQRT1_2] },
          renderable: {
            kind: 'primitive',
            ref: 'plane',
            materialRef: 'palette:#2b3140',
            primitive: { size: [24, 1, 24] },
            shadows: { receive: true },
          },
        },
      },
      {
        id: 'sky',
        components: {
          environment: {
            background: '#11131a',
            sun: { direction: [5, 10, 7], intensity: 1.4, castShadow: true },
            shadows: 'medium',
          },
        },
      },
    ],
    scripts: [
      { id: 'control', checkpoint: 'state', path: 'scripts/control.ts', config: { speed: 6 } },
      { id: 'spin', checkpoint: 'state', path: 'scripts/spin.ts', config: { radPerTick: 0.05 } },
    ],
  };
  return `${JSON.stringify(scene, null, 2)}\n`;
}

const CONTROL_SCRIPT = `// Player control: the scene declares the \`move\` command (and its payload schema); the
// input block turns WASD into it; this script turns it into velocity.
molen.onCommand('move', (p) => {
  const speed = config.speed;
  molen.patch('hero', 'kinematicBody', { vel: [p.dir[0] * speed, 0, p.dir[1] * speed] });
});
`;

const SPIN_SCRIPT = `// Spin every entity tagged "spinner" around Y. Reads are immutable: write with molen.patch.
molen.on('tick', () => {
  const a = (molen.tick + 1) * config.radPerTick;
  const rot: [number, number, number, number] = [0, molen.math.sin(a / 2), 0, molen.math.cos(a / 2)];
  for (const [id] of molen.query('spinner')) molen.patch(id, 'transform', { rot });
});
`;

const SETUP_MJS = `// Optional code setup: ECS systems in other phases and command handlers that need code.
// Loaded automatically (project.json "setup"), or with: molen sim run main --setup ./setup.mjs
export function setup(world) {
  // spawn_cube is declared in the scene; scripts and setup modules can both handle it.
  world.registerCommand('spawn_cube', (w, _cmd, ctx) => {
    w.spawnRaw({
      transform: { pos: [ctx.rng.range(-6, 6), 0.5, ctx.rng.range(-6, 6)], rot: [0, 0, 0, 1] },
      renderable: { kind: 'primitive', ref: 'box', materialRef: 'palette:#e6194b' },
      spinner: { on: true },
    });
  });
}

export default setup;
`;

function cmdsJson(): string {
  const cmds = [
    { kind: 'command', seq: 0, source: 'local', tick: 5, type: 'move', payload: { dir: [1, 0] } },
    { kind: 'command', seq: 1, source: 'local', tick: 10, type: 'spawn_cube', payload: {} },
    { kind: 'command', seq: 2, source: 'local', tick: 12, type: 'spawn_cube', payload: {} },
  ];
  return `${JSON.stringify(cmds, null, 2)}\n`;
}

function checksJson(): string {
  const checks = {
    format: 'molen/assert@1',
    assertions: [
      // hero + ground + 2 spawned cubes
      { select: 'has:renderable', op: 'count', value: 4 },
      { select: 'has:spinner', op: 'count', value: 2 },
      // the move command carried the hero east (speed 6 for 25 ticks at 30 Hz ≈ 5 m)
      { select: '#hero .transform.pos[0]', op: 'gt', value: 3 },
      { select: '#hero .transform.pos[1]', op: 'approx', value: 0.5, tol: 0.001 },
    ],
  };
  return `${JSON.stringify(checks, null, 2)}\n`;
}

const INDEX_HTML = (name: string): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name}</title>
    <style>
      html, body { margin: 0; height: 100%; overflow: hidden; background: #11131a; }
      #view { display: block; width: 100vw; height: 100vh; }
    </style>
  </head>
  <body>
    <canvas id="view"></canvas>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`;

const PROJECT_TS = `import { loadProject } from '@bendyline/molen-kernel';
import sceneDoc from '../scenes/main.scene.json';
import typesDoc from '../types/main.types.json';

// The tooling loader inlines the scene's scripts/*.ts from disk (erasing types); Vite does the
// same through molenScripts() in vite.config.ts with raw imports, so the browser builds the
// identical manifest the headless loop validated. loadProject matches each source to the script
// path the scene declares, so this glob's prefix does not have to be stripped by hand.
const scripts = import.meta.glob('../scenes/scripts/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** The validated scene (scripts inlined) and the resolved entity type registry. */
export function project() {
  return loadProject({ scene: sceneDoc, types: typesDoc, scripts });
}
`;

const WORKER_TS = `/// <reference lib="webworker" />
import { figuresScriptApi, installFigures } from '@bendyline/molen-figures/kernel';
import { startKernelWorker } from '@bendyline/molen-kernel';
// import { hardenScripts } from '@bendyline/molen-kernel';
import { project } from './project';
import { setup } from '../setup.mjs';

// Scene scripts run with this Worker's authority; the SES Compartment around them buys
// determinism, not isolation. If this Worker will ever run a scene you did not write, uncomment
// the hardenScripts import above and the call below: it freezes this realm's intrinsics (SES
// lockdown) so a script cannot reach the host global. It is safe here because the Worker runs
// only kernel code — never do it in a process that also runs bundlers or other tooling.
// See the "Script trust" section of the scripting guide (molen docs search "script trust").
// hardenScripts();

// The kernel Worker: kinematics, the declared commands, and the scene's scripts all install
// from data; setup.mjs adds the spawn_cube handler.
startKernelWorker({
  ...project(),
  setup,
  // Figures (people and animals) are available to every scene: molen.figures.* in scripts.
  capabilities: [(w) => ({ figures: figuresScriptApi(installFigures(w)) })],
});
`;

const MAIN_TS = `import { mountExperience } from '@bendyline/molen-client';
import { figureKind } from '@bendyline/molen-figures/client';
import { project } from './project';

// Browser entry: the scene's camera and input blocks are applied by mountExperience, so WASD
// moves the hero and Space spawns a cube without any input code here. The mount is asynchronous
// because it picks a graphics backend: WebGPU when the browser has it, WebGL otherwise.
const canvas = document.getElementById('view') as HTMLCanvasElement;
const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
const { client } = await mountExperience({
  link: worker,
  scene: project().scene,
  canvas,
  clearColor: '#11131a',
  kinds: [figureKind()],
});

// A HUD from mirrored state: no wire-protocol parsing.
const hud = document.createElement('div');
hud.style.cssText =
  'position:fixed;left:12px;top:10px;font:14px system-ui;color:#dfe6ee;pointer-events:none';
document.body.appendChild(hud);
setInterval(() => {
  const pos = (client.get('hero', 'transform') as { pos?: number[] } | undefined)?.pos;
  hud.textContent = \`hero \${pos ? pos.map((v) => v.toFixed(1)).join(', ') : '–'} · \${client.entities().length} entities · WASD move, Space spawn\`;
}, 100);
`;

const VITE_ENV_DTS = `/// <reference types="vite/client" />
`;

const VITE_CONFIG = `import { molenScripts } from '@bendyline/molen-client/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  // Scene scripts are TypeScript; strip their types where Vite reads them as raw text.
  plugins: [molenScripts()],
  // Worker bundles get their own plugin pipeline in Vite, and the kernel runs in the Worker.
  worker: { format: 'es', plugins: () => [molenScripts()] },
  build: {
    target: 'es2022',
    // src/main.ts mounts with a top-level \`await\`, and the client lazy-loads its WebGPU driver.
    // Left in the entry chunk, three.js and the client would make that lazy chunk import the entry
    // while the entry is still suspended at the \`await\`, and the built page would stay blank in
    // every browser with WebGPU. Their own chunk breaks the cycle.
    rollupOptions: { output: { manualChunks: { vendor: ['three', '@bendyline/molen-client'] } } },
  },
});
`;

const TSCONFIG = `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2023", "DOM", "DOM.Iterable", "WebWorker"],
    "strict": true,
    "allowJs": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src", "setup.mjs"]
}
`;

function packageJson(name: string): string {
  // The engine packages move on one version line, and on 0.x a minor bump may break: pin the
  // scaffold to the line it was generated from, as the caret does for 0.x versions.
  const engine = `^${ENGINE_VERSION}`;
  const pkg = {
    name,
    private: true,
    type: 'module',
    scripts: {
      dev: 'vite --port 5225',
      build: 'vite build',
      // The scene's scripts are checked against their generated declarations (molen types gen).
      typecheck: 'tsc -p tsconfig.json && tsc -p scenes/scripts/tsconfig.json',
    },
    dependencies: {
      '@bendyline/molen-client': engine,
      '@bendyline/molen-figures': engine,
      '@bendyline/molen-kernel': engine,
      '@bendyline/molen-schema': engine,
      // three.js is a peer of the client; the app owns the one copy both share.
      three: '^0.184.0',
    },
    // The CLI is a dev dependency so `npx molen` runs this line's CLI (the unscoped `molen` on
    // npm is an unrelated package), and TypeScript is the one `molen scripts check` uses.
    devDependencies: {
      '@bendyline/molen-tooling': engine,
      '@types/three': '^0.184.0',
      typescript: '^6.0.3',
      vite: '^6.0.7',
    },
  };
  return `${JSON.stringify(pkg, null, 2)}\n`;
}

function readme(name: string): string {
  const ns = slug(name);
  return `# ${name}

A molen experience project. \`project.json\` binds it together: scenes by name, the
\`${ns}.*\` entity type registry (types/main.types.json), and the default setup module.

The game is **data + scripts**: scenes/main.scene.json declares the world, the \`move\` and
\`spawn_cube\` commands, the WASD/Space input rules, the camera, and its scripts
(scripts/control.ts handles \`move\`; scripts/spin.ts spins spawned cubes). setup.mjs adds the
\`spawn_cube\` handler in code.

## Install first

\`\`\`
npm install                       # the engine, the molen CLI, TypeScript and Vite
npx playwright install chromium   # once per machine, for shot and drive
\`\`\`

## The headless loop (copy-paste)

\`\`\`
# 1. validate (the cheap inner loop)
npx molen validate scenes/main.scene.json
npx molen types check

# 2. simulate + assert (scene names from project.json work; setup.mjs loads automatically)
npx molen sim run main --ticks 30 --commands cmds.json --assert checks.json --hash

# 3. screenshot (camera comes from the scene's own camera block)
npx molen shot main --ticks 30 --out shot.png

# 4. play it: commands in, frames out
npx molen drive main --actions actions.json --out-dir shots

# 5. regenerate the typed handles + the scripts' ambient declarations
npx molen types gen

# 6. type-check the scene's scripts with this project's TypeScript
npx molen scripts check
\`\`\`

## In the browser

\`\`\`
npm run dev    # Vite: kernel in a Worker, client mounted with mountExperience
\`\`\`

Guides: https://molen.dev/guide/agent-loop, https://molen.dev/guide/scripting and
https://molen.dev/guide/browser-mount, or search them offline with \`npx molen docs search <topic>\`.
`;
}

function actionsJson(): string {
  const actions = [
    { at: 0, screenshot: 'start' },
    { at: 1, command: { type: 'move', payload: { dir: [1, 0] } } },
    { at: 20, command: { type: 'spawn_cube', payload: {} } },
    { at: 45, command: { type: 'move', payload: { dir: [0, 0] } } },
    { at: 60, screenshot: 'after' },
  ];
  return `${JSON.stringify(actions, null, 2)}\n`;
}

type ScaffoldFile = [path: string, content: string | Uint8Array];

const AGENTS_MD = 'AGENTS.md';

/** Project-relative, `/`-separated. */
function projectRelative(dir: string, path: string): string {
  return relative(dir, path).split(sep).join('/');
}

/** The scaffold-owned files already in `dir` (the force check). */
async function existingFiles(dir: string, paths: string[]): Promise<string[]> {
  const existing: string[] = [];
  for (const rel of paths) {
    try {
      await stat(join(dir, rel));
      existing.push(rel);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  return existing;
}

async function writeScaffoldFiles(
  dir: string,
  files: ScaffoldFile[],
  force: boolean,
): Promise<void> {
  for (const [rel, content] of files) {
    const abs = join(dir, rel);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, content, force ? undefined : { flag: 'wx' });
  }
}

/** Refresh the typed handles and the scripts' ambient declarations from the installed registry. */
async function refreshGeneratedTypes(dir: string): Promise<{ files?: string[]; error?: string }> {
  const generated = await generateTypes({ projectPath: join(dir, 'project.json') });
  if (!generated.ok)
    return { error: generated.error ?? 'failed to generate types for the new project' };
  return {
    files: [
      projectRelative(dir, generated.outPath as string),
      ...(generated.scriptArtifacts ?? []).map((a) => projectRelative(dir, a.path)),
    ],
  };
}

interface AgentsMdInput {
  name: string;
  template?: TemplateManifest;
  /** The project's headless loop, run from its directory. */
  loop: string[];
  /** Generated files, project-relative; empty when the project has no project.json. */
  generated: string[];
}

/**
 * Word-wrap Markdown prose at 100 columns without breaking an inline code span. `first` prefixes
 * the first line (a bullet's `- `); continuation lines are indented to match it.
 */
function wrap(text: string, first = ''): string {
  const indent = ' '.repeat(first.length);
  const lines: string[] = [];
  let line = '';
  for (const token of text.match(/(?:[^\s`]*`[^`]*`)+[^\s`]*|\S+/g) ?? []) {
    if (line.length === 0) {
      line = `${lines.length === 0 ? first : indent}${token}`;
    } else if (line.length + 1 + token.length > 100) {
      lines.push(line);
      line = `${indent}${token}`;
    } else {
      line = `${line} ${token}`;
    }
  }
  lines.push(line);
  return lines.join('\n');
}

/**
 * The signpost for a coding agent working in the new project: where the version-locked docs are,
 * how to discover the ops, this project's own loop, and the rules that are cheap to break.
 */
function agentsMd({ name, template, loop, generated }: AgentsMdInput): string {
  const origin =
    template === undefined ? 'the `molen new` starter' : `the \`${template.id}\` sample`;
  const generatedRule =
    generated.length > 0
      ? `Generated files are never hand-edited: ${generated.map((f) => `\`${f}\``).join(', ')}. Change the scene or its type documents, then run \`npx molen types gen\` (\`npx molen types gen --check\` reports staleness).`
      : "Generated files are never hand-edited. Once the project has a `project.json` (https://molen.dev/guide/project), `npx molen types gen` writes its typed handles and each scripts directory's `molen-scripts.d.ts`; regenerate them instead.";
  return [
    `# AGENTS.md — ${name}`,
    '',
    wrap(
      `${name} is a Molen experience built from npm packages (engine ${ENGINE_VERSION}), scaffolded from ${origin}. Run every command below from this directory.`,
    ),
    '',
    '## Docs for this exact engine version',
    '',
    wrap(
      'Start at `node_modules/@bendyline/molen-tooling/dist/docs-src/llms.txt`, then `guide/agent-loop.md` and `guide/scripting.md` beside it. They ship with the installed CLI, so they match the engine you are running; https://molen.dev/guide/agent-loop is the online copy.',
      '- ',
    ),
    wrap('`npx molen docs search <query>` searches that bundle offline.', '- '),
    wrap(
      "`npx molen describe [op]` prints every operation's contract; `npx molen mcp` serves the same operations as MCP tools over stdio. `npx molen schema get <kind>` and `npx molen component <name>` give exact document and component shapes.",
      '- ',
    ),
    '',
    '## The headless loop',
    '',
    wrap(
      'Install once with `npm install` (and `npx playwright install chromium` for `shot` and `drive`), then validate after every edit — a failure names the field and how to fix it:',
    ),
    '',
    '```sh',
    ...loop,
    '```',
    '',
    '## Rules',
    '',
    wrap(generatedRule, '- '),
    wrap(
      'Scene scripts run with the authority of the process that loads them; the CLI and the MCP server evaluate them in-process. Treat `scene.json` like source code and only run scenes you would run as a program.',
      '- ',
    ),
    wrap(
      'Determinism: randomness through `molen.rng` and math through `molen.math` (in setup code, the world RNG and `dmath`); never `Math.random`, `Date` or wall-clock time in simulation code.',
      '- ',
    ),
    wrap(
      'Reads are immutable: never mutate what `molen.get` / `world.get` returns; write with `set` / `patch`.',
      '- ',
    ),
    '',
  ].join('\n');
}

/** The built-in starter's loop, run from the project directory. */
const STARTER_LOOP = [
  'npx molen validate scenes/main.scene.json',
  'npx molen types check',
  'npx molen scripts check',
  'npx molen sim run main --ticks 30 --commands cmds.json --assert checks.json --hash',
  'npx molen shot main --ticks 30 --out shot.png',
  'npx molen drive main --actions actions.json --out-dir shots',
];

/** A template's loop: validate, check scripts, simulate (+ assert), replay, then its tests. */
function templateLoop(template: TemplateManifest, scriptsCheck: boolean): string[] {
  return [
    ...template.validate.map((doc) => `npx molen validate ${doc}`),
    ...(scriptsCheck ? ['npx molen scripts check'] : []),
    ...(template.sim !== null ? [`npx molen ${template.sim}`] : []),
    ...template.replays.map((fixture) => `npx molen replay ${fixture}`),
    ...(template.tests ? ['npm test'] : []),
  ];
}

/** The template's manifest as the new project's: its name, engine deps on this CLI's version line. */
function templatePackageJson(source: string, name: string): string {
  const { name: _name, ...manifest } = JSON.parse(source) as Record<string, unknown>;
  const onEngineLine = (deps: unknown): Record<string, string> | undefined =>
    deps === undefined
      ? undefined
      : Object.fromEntries(
          Object.entries(deps as Record<string, string>).map(([dep, spec]) => [
            dep,
            spec.startsWith('workspace:') ? `^${ENGINE_VERSION}` : spec,
          ]),
        );
  const pkg = {
    name,
    ...manifest,
    dependencies: onEngineLine(manifest.dependencies),
    devDependencies: onEngineLine(manifest.devDependencies),
  };
  return `${JSON.stringify(pkg, null, 2)}\n`;
}

async function scaffoldTemplate(
  input: ScaffoldInput & { template: string },
  dir: string,
): Promise<ScaffoldOutput> {
  const bundle = await loadTemplateBundle();
  const template = bundle.templates.find((t) => t.id === input.template);
  if (template === undefined) {
    return {
      ok: false,
      error: `unknown template "${input.template}"; available templates: ${bundle.templates
        .map((t) => t.id)
        .join(', ')} (molen templates describes them)`,
    };
  }
  const force = input.force === true;
  const files: ScaffoldFile[] = [];
  for (const rel of template.files) {
    const source = await readFile(join(bundle.root, template.id, rel));
    files.push([
      rel,
      rel === 'package.json' ? templatePackageJson(source.toString('utf8'), input.name) : source,
    ]);
  }
  if (!force) {
    const existing = await existingFiles(dir, [...files.map(([rel]) => rel), AGENTS_MD]);
    if (existing.length > 0) {
      return {
        ok: false,
        error: `${dir} already contains scaffold files: ${existing.join(', ')} (pass force: true to replace them)`,
      };
    }
  }
  await writeScaffoldFiles(dir, files, force);
  // A template ships the declarations its sample committed; regenerate them from the registry of
  // the CLI doing the scaffolding, so `molen types gen --check` is clean in the new project.
  let generated: string[] = [];
  if (template.project) {
    const refreshed = await refreshGeneratedTypes(dir);
    if (refreshed.error !== undefined) return { ok: false, error: refreshed.error };
    generated = refreshed.files ?? [];
  }
  const scriptsCheck = generated.some((f) => f.endsWith('molen-scripts.d.ts'));
  const loop = templateLoop(template, scriptsCheck);
  await writeScaffoldFiles(
    dir,
    [[AGENTS_MD, agentsMd({ name: input.name, template, loop, generated })]],
    force,
  );
  return {
    ok: true,
    dir,
    files: [...new Set([...files.map(([rel]) => rel), ...generated, AGENTS_MD])].sort(),
    nextSteps: [
      `cd ${dir}`,
      'npm install                       # the engine, the molen CLI, TypeScript and Vite',
      'npx playwright install chromium   # once per machine, for shot and drive',
      ...loop,
      'npm run dev',
    ],
  };
}

/**
 * Scaffold a complete, runnable project: the built-in starter (manifest + scene + types + scripts
 * + setup + browser app), or with `template` a copy of one of the shipped samples. Either way the
 * project gets an AGENTS.md pointing a coding agent at the version-locked docs and its loop.
 */
export async function scaffoldExperience(input: ScaffoldInput): Promise<ScaffoldOutput> {
  if (!/^[a-zA-Z][\w-]*$/.test(input.name)) {
    return { ok: false, error: `invalid name "${input.name}" (use letters, digits, - and _)` };
  }
  const dir = resolve(input.dir ?? process.cwd(), input.name);
  try {
    if (input.template !== undefined) {
      return await scaffoldTemplate({ ...input, template: input.template }, dir);
    }
    const files: ScaffoldFile[] = [
      ['project.json', projectJson(input.name)],
      ['scenes/main.scene.json', sceneJson(input.name)],
      ['types/main.types.json', typesJson(input.name)],
      ['scenes/scripts/control.ts', CONTROL_SCRIPT],
      ['scenes/scripts/spin.ts', SPIN_SCRIPT],
      ['setup.mjs', SETUP_MJS],
      ['cmds.json', cmdsJson()],
      ['checks.json', checksJson()],
      ['actions.json', actionsJson()],
      ['index.html', INDEX_HTML(input.name)],
      ['src/project.ts', PROJECT_TS],
      ['src/worker.ts', WORKER_TS],
      ['src/main.ts', MAIN_TS],
      ['src/vite-env.d.ts', VITE_ENV_DTS],
      ['vite.config.ts', VITE_CONFIG],
      ['tsconfig.json', TSCONFIG],
      ['package.json', packageJson(input.name)],
      ['README.md', readme(input.name)],
    ];
    const force = input.force === true;
    if (!force) {
      const existing = await existingFiles(dir, [...files.map(([rel]) => rel), AGENTS_MD]);
      if (existing.length > 0) {
        return {
          ok: false,
          error: `${dir} already contains scaffold files: ${existing.join(', ')} (pass force: true to replace them)`,
        };
      }
    }
    await writeScaffoldFiles(dir, files, force);
    // Generate the typed handles and the scripts' ambient declarations, so a fresh project is
    // type-checked from its first tick instead of after someone discovers the command.
    const generated = await refreshGeneratedTypes(dir);
    if (generated.error !== undefined) return { ok: false, error: generated.error };
    const generatedFiles = generated.files ?? [];
    await writeScaffoldFiles(
      dir,
      [[AGENTS_MD, agentsMd({ name: input.name, loop: STARTER_LOOP, generated: generatedFiles })]],
      force,
    );
    return {
      ok: true,
      dir,
      files: [...files.map(([rel]) => rel), ...generatedFiles, AGENTS_MD],
      // `molen scripts check` compiles with the PROJECT's TypeScript (an optional peer dependency
      // of the tooling package), so the install has to come before it — the old order printed the
      // check first and only worked inside this repo, where TypeScript happens to be hoisted.
      nextSteps: [
        `cd ${dir}`,
        'npm install                       # the engine, the molen CLI and TypeScript',
        'npx playwright install chromium   # once per machine, for shot and drive',
        ...STARTER_LOOP,
      ],
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
