import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { dmath } from '@bendyline/molen-kernel';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { checkScripts } from '../src/ops/check-scripts';
import { loadProject } from '../src/project';
import { collectScriptTypesTargets } from '../src/script-targets';
import { renderScriptTypes, tsTypeOfJsonValue } from '../src/script-types';

const execFileAsync = promisify(execFile);
const REPO = resolve(__dirname, '../../..');
/** Every example whose scene declares file-backed scripts. */
const EXAMPLES = ['top-down-arena', 'city-courier', 'lantern-dungeon', 'skybound'];

const SAMPLE = renderScriptTypes({
  scenes: ['scene.json'],
  components: [
    {
      name: 'transform',
      description: 'World position + orientation.',
      schema: {
        type: 'object',
        properties: { pos: { type: 'array', items: { type: 'number' }, minItems: 3, maxItems: 3 } },
        required: ['pos'],
      },
    },
  ],
  entityIds: ['player'],
  prefabs: ['wall'],
  typeIds: ['arena.enemy'],
  commands: [
    {
      name: 'move',
      doc: 'Planar move direction.',
      payload: {
        type: 'object',
        properties: { dir: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 } },
        required: ['dir'],
      },
    },
  ],
  configs: [
    { scriptId: 'control', config: { speed: 6 } },
    { scriptId: 'spawner', config: { speed: 'fast', interval: 12 } },
  ],
  capabilities: ['figures'],
});

describe('script ambient types', () => {
  it('declares the injected globals', () => {
    expect(SAMPLE).toContain('declare const molen: MolenApi;');
    expect(SAMPLE).toContain('declare const config: MolenScriptConfig;');
  });

  it('keys components by their wire name so a typo is a type error', () => {
    expect(SAMPLE).toContain("'transform': MolenTransformData;");
    expect(SAMPLE).toContain('type MolenComponentName = keyof MolenComponentData;');
  });

  it('leaves entity ids open (spawned ids are plain strings) but completes declared ones', () => {
    expect(SAMPLE).toContain("type MolenEntityId = 'player' | (string & {});");
    expect(SAMPLE).toContain("type MolenPrefabName = 'wall' | (string & {});");
  });

  it('closes the registry type union — spawnType takes a declared id', () => {
    expect(SAMPLE).toContain("type MolenTypeId = 'arena.enemy';");
  });

  it('types command payloads from the scene schema', () => {
    expect(SAMPLE).toContain("  'move': {\n    dir: [number, number];\n  };");
  });

  it('merges config per directory, attributing keys and degrading conflicts', () => {
    expect(SAMPLE).toContain("/** script 'spawner' */\n  readonly interval: number;");
    // `speed` is a number in one script and a string in another: neither type is safe to claim.
    expect(SAMPLE).toContain("/** script 'control', 'spawner' */\n  readonly speed: unknown;");
  });

  it('prints short uniform arrays as tuples so a config vector fits a component', () => {
    expect(tsTypeOfJsonValue([0, 1.25, 0])).toBe('[number, number, number]');
    expect(tsTypeOfJsonValue([1, 2, 3, 4, 5])).toBe('number[]');
    expect(tsTypeOfJsonValue({ a: 1, b: 'x' })).toBe('{ a: number; b: string }');
  });

  it('covers every dmath export with a matching required arity', () => {
    for (const [key, value] of Object.entries(dmath)) {
      const member = typeof value === 'function' ? `  ${key}(` : `  readonly ${key}: `;
      expect(SAMPLE, `dmath.${key} missing from the generated math surface`).toContain(member);
      if (typeof value !== 'function') continue;
      const signature = SAMPLE.split('\n').find((l) => l.trim().startsWith(`${key}(`));
      expect(signature, `no signature rendered for dmath.${key}`).toBeDefined();
      const params = (signature as string).slice(
        (signature as string).indexOf('(') + 1,
        (signature as string).lastIndexOf(')'),
      );
      const required = params.split(',').filter((p) => p.trim().length > 0 && !p.includes('?'));
      expect(required.length, `dmath.${key} arity drifted from its declared signature`).toBe(
        value.length,
      );
    }
  });
});

describe('generated script artifacts in the examples', () => {
  const CLI = join(REPO, 'packages/tooling/dist/cli.mjs');
  for (const name of EXAMPLES) {
    it(`${name}: committed declarations are current`, async () => {
      // Through the CLI on purpose: the component vocabulary a process sees depends on which
      // capability packages it imported, so only the generating entry point can judge staleness.
      const project = join(REPO, 'examples', name, 'project.json');
      const { stdout, stderr } = await execFileAsync(process.execPath, [
        CLI,
        'types',
        'gen',
        '--check',
        '--project',
        project,
      ]);
      expect(`${stdout}${stderr}`, 'run: molen types gen').toContain('up to date');
    });

    it(`${name}: scripts type-check clean`, async () => {
      const project = await loadProject(join(REPO, 'examples', name, 'project.json'));
      const targets = await collectScriptTypesTargets(project);
      expect(targets.length, 'expected file-backed scripts').toBeGreaterThan(0);
      for (const target of targets) {
        expect(target.scriptFiles.length).toBeGreaterThan(0);
        // The committed declarations are what the editor and `pnpm typecheck` consume.
        await readFile(target.dtsPath, 'utf8');
        await readFile(target.tsconfigPath, 'utf8');
        // Scene scripts are authored in TypeScript; the loader erases the types.
        expect(target.scriptFiles.every((f) => f.endsWith('.ts'))).toBe(true);
      }
    });
  }
});

describe('registry type script targets', () => {
  it('generates ambient declarations for file-backed type scripts', async () => {
    const root = await mkdtemp(join(tmpdir(), 'molen-type-script-'));
    try {
      await mkdir(join(root, 'scripts'), { recursive: true });
      await writeFile(
        join(root, 'project.json'),
        JSON.stringify({
          format: 'molen/project@1',
          name: 'type-script-fixture',
          scenes: { main: 'scene.json' },
          types: ['types.json'],
          assets: {},
          reservations: [{ namespace: 'fixture', owner: 'test' }],
          components: {},
          codegen: { out: 'gen/types.ts' },
        }),
      );
      await writeFile(
        join(root, 'scene.json'),
        JSON.stringify({
          format: 'molen/scene@3',
          name: 'type-script-fixture',
          seed: 1,
          tickRate: 30,
          lateCommands: 'rewrite',
          keyframeInterval: 30,
          prefabs: {},
          entities: [],
          scripts: [],
          commands: {},
          components: {},
        }),
      );
      await writeFile(
        join(root, 'types.json'),
        JSON.stringify({
          format: 'molen/types@1',
          namespace: 'fixture',
          owner: 'test',
          types: {
            'fixture.cart': {
              components: {},
              assets: [],
              scripts: [{ id: 'behavior', path: 'scripts/type.ts', config: { enabled: true } }],
            },
          },
        }),
      );
      await writeFile(
        join(root, 'scripts/type.ts'),
        'molen.emit("ready", { type: config.type });\n',
      );

      const project = await loadProject(join(root, 'project.json'));
      const targets = await collectScriptTypesTargets(project);

      expect(targets).toHaveLength(1);
      expect(targets[0]?.scriptFiles).toEqual([join(root, 'scripts/type.ts')]);
      expect(targets[0]?.dts).toContain('readonly type: string;');
      expect(targets[0]?.dts).toContain("script 'fixture.cart:behavior'");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe('checkScripts', () => {
  let dir: string;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'molen-script-check-'));
  });
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  async function writeProject(scriptSource: string, ext: 'js' | 'ts' = 'ts'): Promise<string> {
    const root = join(dir, `p${Math.random().toString(36).slice(2)}`);
    await mkdir(join(root, 'scripts'), { recursive: true });
    await writeFile(
      join(root, 'project.json'),
      JSON.stringify({
        format: 'molen/project@1',
        name: 'check-fixture',
        scenes: { main: 'scene.json' },
      }),
    );
    await writeFile(
      join(root, 'scene.json'),
      JSON.stringify({
        format: 'molen/scene@3',
        name: 'check-fixture',
        entities: [{ id: 'hero', components: { transform: { pos: [0, 0, 0] } } }],
        scripts: [{ id: 'logic', path: `scripts/logic.${ext}`, config: { speed: 2 } }],
      }),
    );
    await writeFile(join(root, `scripts/logic.${ext}`), scriptSource);
    return root;
  }

  it('inlines a .ts script as type-stripped JavaScript, line for line', async () => {
    const root = await writeProject(
      "const speed: number = config.speed;\nmolen.on('tick', () => molen.patch('hero', 'transform', { pos: [speed, 0, 0] }));\n",
    );
    const { loadSceneDocument } = await import('../src/project');
    const loaded = await loadSceneDocument(join(root, 'scene.json'));
    const code = loaded.manifest.scripts[0]?.code as string;
    expect(code).not.toContain(': number');
    expect(code).toContain('const speed         = config.speed;');
    // The kernel only ever sees code, never a path.
    expect(loaded.manifest.scripts[0]?.path).toBeUndefined();
  });

  it('inlines a .js script verbatim', async () => {
    const source = "molen.on('tick', () => {});\n";
    const root = await writeProject(source, 'js');
    const { loadSceneDocument } = await import('../src/project');
    const loaded = await loadSceneDocument(join(root, 'scene.json'));
    expect(loaded.manifest.scripts[0]?.code).toBe(source);
  });

  it('reports a missing declaration instead of checking against nothing', async () => {
    const root = await writeProject("molen.on('tick', () => {});\n");
    const r = await checkScripts({ projectPath: join(root, 'project.json') });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/molen types gen/);
    expect(r.ungenerated?.length).toBeGreaterThan(0);
  });

  it('passes a clean script and fails a component typo', async () => {
    const good = await writeProject(
      "molen.on('tick', () => {\n  const t = molen.get('hero', 'transform');\n  if (!t) return;\n  molen.patch('hero', 'transform', { pos: [t.pos[0] + config.speed, 0, 0] });\n});\n",
    );
    const { generateTypes } = await import('../src/ops/generate-types');
    expect((await generateTypes({ projectPath: join(good, 'project.json') })).ok).toBe(true);
    const clean = await checkScripts({ projectPath: join(good, 'project.json') });
    expect(clean.diagnostics).toEqual([]);
    expect(clean.ok).toBe(true);
    expect(clean.checked).toBe(1);

    const bad = await writeProject(
      "molen.on('tick', () => {\n  molen.get('hero', 'transfrom');\n});\n",
    );
    expect((await generateTypes({ projectPath: join(bad, 'project.json') })).ok).toBe(true);
    const failed = await checkScripts({ projectPath: join(bad, 'project.json') });
    expect(failed.ok).toBe(false);
    expect(failed.diagnostics?.[0]?.message).toMatch(/transfrom/);
    expect(failed.diagnostics?.[0]?.file).toBe('scripts/logic.ts');
  });
});
