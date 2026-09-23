import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { generateTypes } from './generate-types';

export interface ScaffoldInput {
  /** Experience name; also the output folder name and the type namespace. */
  name: string;
  /** Parent directory (default: cwd). */
  dir?: string;
  /** Replace scaffold-owned files that already exist. Default false. */
  force?: boolean;
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
  build: { target: 'es2022' },
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
      '@bendyline/molen-client': '*',
      '@bendyline/molen-figures': '*',
      '@bendyline/molen-kernel': '*',
      '@bendyline/molen-schema': '*',
    },
    devDependencies: { typescript: '^6.0.3', vite: '^6.0.7' },
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

\`molen scripts check\` type-checks with **this project's** TypeScript, so install the
devDependencies before running it (everything else works without an install):

\`\`\`
pnpm install   # or npm install
\`\`\`

## The headless loop (copy-paste; \`molen\` = \`node <repo>/packages/tooling/dist/cli.mjs\`)

\`\`\`
# 1. validate (the cheap inner loop)
molen validate scenes/main.scene.json
molen types check

# 2. simulate + assert (scene names from project.json work; setup.mjs loads automatically)
molen sim run main --ticks 30 --commands cmds.json --assert checks.json --hash

# 3. screenshot (camera comes from the scene's own camera block)
molen shot main --ticks 30 --out shot.png

# 4. play it: commands in, frames out
molen drive main --actions actions.json --out-dir shots

# 5. regenerate the typed handles + the scripts' ambient declarations
molen types gen

# 6. type-check the scene's scripts (needs the install above)
molen scripts check
\`\`\`

## In the browser

\`\`\`
pnpm dev       # Vite: kernel in a Worker, client mounted with mountExperience
\`\`\`

See docs-src/guide/agent-loop.md, scripting.md, and browser-mount.md.
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

/** Scaffold a complete, runnable project (manifest + scene + types + scripts + setup + browser app). */
export async function scaffoldExperience(input: ScaffoldInput): Promise<ScaffoldOutput> {
  if (!/^[a-zA-Z][\w-]*$/.test(input.name)) {
    return { ok: false, error: `invalid name "${input.name}" (use letters, digits, - and _)` };
  }
  const dir = resolve(input.dir ?? process.cwd(), input.name);
  try {
    const files: [string, string][] = [
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
    if (input.force !== true) {
      const existing: string[] = [];
      for (const [rel] of files) {
        try {
          await stat(join(dir, rel));
          existing.push(rel);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
      }
      if (existing.length > 0) {
        return {
          ok: false,
          error: `${dir} already contains scaffold files: ${existing.join(', ')} (pass force: true to replace them)`,
        };
      }
    }
    for (const [rel, content] of files) {
      const abs = join(dir, rel);
      await mkdir(dirname(abs), { recursive: true });
      await writeFile(abs, content, input.force === true ? undefined : { flag: 'wx' });
    }
    // Generate the typed handles and the scripts' ambient declarations, so a fresh project is
    // type-checked from its first tick instead of after someone discovers the command.
    const generated = await generateTypes({ projectPath: join(dir, 'project.json') });
    if (!generated.ok) {
      return {
        ok: false,
        error: generated.error ?? 'failed to generate types for the new project',
      };
    }
    const generatedFiles = [
      relative(dir, generated.outPath as string),
      ...(generated.scriptArtifacts ?? []).map((a) => relative(dir, a.path)),
    ];
    return {
      ok: true,
      dir,
      files: [...files.map(([rel]) => rel), ...generatedFiles],
      // `molen scripts check` compiles with the PROJECT's TypeScript (an optional peer dependency
      // of the tooling package), so the install has to come before it — the old order printed the
      // check first and only worked inside this repo, where TypeScript happens to be hoisted.
      nextSteps: [
        `cd ${dir}`,
        'npm install                       # or pnpm install (installs TypeScript for the checks below)',
        'molen validate scenes/main.scene.json',
        'molen types check',
        'molen scripts check',
        'molen sim run main --ticks 30 --commands cmds.json --assert checks.json --hash',
        'molen shot main --ticks 30 --out shot.png',
        'molen drive main --actions actions.json --out-dir shots',
      ],
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
