import { mkdir, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import { ENGINE_VERSION } from '@bendyline/molen-kernel';
import { describe, expect, it, vi } from 'vitest';
import { runCli } from '../src/cli-commands';
import {
  checkScripts,
  generateTypes,
  listTemplates,
  runReplayFile,
  runSimulation,
  scaffoldExperience,
  validateAsset,
} from '../src/ops/index';
import { loadTemplateBundle } from '../src/ops/templates';

// `molen new <name> --template <id>` copies a shipped sample as a standalone npm project. These
// tests scaffold every template the built bundle (dist/templates, from scripts/build-templates.mjs)
// carries and run the headless loop the scaffold prints, through the same ops the CLI maps onto.

const gate = await import(resolve(__dirname, '../../../scripts/check-package-contents.mjs'));
const PACKAGES = resolve(__dirname, '../..');

const TEMPLATE_IDS = [
  'cubes',
  'data-viz',
  'top-down-arena',
  'terrain-flyover',
  'figures-gallery',
  'city-courier',
  'skybound',
];

interface Manifest {
  name: string;
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

/** Stand in for `npm install` of the engine: link the workspace packages the manifest names. */
async function linkEngine(dir: string, manifest: Manifest): Promise<void> {
  await mkdir(join(dir, 'node_modules', '@bendyline'), { recursive: true });
  for (const name of Object.keys({ ...manifest.dependencies, ...manifest.devDependencies })) {
    if (!name.startsWith('@bendyline/molen-')) continue;
    const target = join(PACKAGES, name.slice('@bendyline/molen-'.length));
    await symlink(target, join(dir, 'node_modules', name), 'dir');
  }
}

/** The value after `flag` in a printed `npx molen …` step. */
function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
}

async function cli(...argv: string[]): Promise<{ code: number; out: string; err: string }> {
  const out: string[] = [];
  const errors: string[] = [];
  const stdout = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    out.push(String(chunk));
    return true;
  });
  const stderr = vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
    errors.push(String(chunk));
    return true;
  });
  try {
    const code = await runCli(argv);
    return { code, out: out.join(''), err: errors.join('') };
  } finally {
    stdout.mockRestore();
    stderr.mockRestore();
  }
}

describe('template listing', () => {
  it('lists the shipped samples, each with a one-line description', async () => {
    const r = await listTemplates();
    expect(r.ok, r.error).toBe(true);
    expect(r.templates.map((t) => t.id)).toEqual(TEMPLATE_IDS);
    for (const t of r.templates) {
      expect(t.description, t.id).toMatch(/^[A-Z]/);
      expect(t.description, t.id).not.toMatch(/\n/);
      expect(Object.keys(t).sort()).toEqual(['description', 'id']);
    }
  });

  it('prints the list on the CLI, as a table or as JSON', async () => {
    const table = await cli('templates');
    expect(table.code).toBe(0);
    expect(table.out).toMatch(/^cubes\s+The smallest complete experience/m);
    expect(table.out).toContain('molen new <name> --template <id>');
    const json = await cli('templates', '--json');
    expect(json.code).toBe(0);
    expect((JSON.parse(json.out) as { id: string }[]).map((t) => t.id)).toEqual(TEMPLATE_IDS);
  });

  it('ships no content, no repository-only files, and nothing that reaches out of the sample', async () => {
    const bundle = await loadTemplateBundle();
    for (const template of bundle.templates) {
      const dir = join(bundle.root, template.id);
      for (const file of template.files) {
        expect(gate.checkPackedFile(`dist/templates/${template.id}/${file}`, 0), file).toEqual([]);
        expect(file, template.id).not.toMatch(/^(test\/golden\/|vitest\.golden|public\/)/);
        if (['.ts', '.js', '.mjs', '.html', '.css'].includes(extname(file))) {
          expect(await readFile(join(dir, file), 'utf8'), `${template.id}/${file}`).not.toMatch(
            /['"]\.\.\/\.\.\//,
          );
        }
      }
      const pkg = await readFile(join(dir, 'package.json'), 'utf8');
      expect(pkg, template.id).not.toMatch(/catalog:|pnpm|biome|test:golden/);
      const tsconfig = JSON.parse(await readFile(join(dir, 'tsconfig.json'), 'utf8'));
      expect(tsconfig.extends, template.id).toBeUndefined();
      expect(tsconfig.compilerOptions.noEmit, template.id).toBe(true);
    }
  });
});

describe.each(TEMPLATE_IDS)('template %s', (id) => {
  it('scaffolds a standalone project whose printed headless loop passes', async () => {
    const parent = await mkdtemp(join(tmpdir(), `molen-template-${id}-`));
    const s = await scaffoldExperience({ name: 'my-app', dir: parent, template: id });
    expect(s.ok, s.error).toBe(true);
    const dir = s.dir as string;
    expect(s.files).toContain('AGENTS.md');
    expect(s.files).toContain('package.json');
    expect(s.files).not.toContain('preview.png');

    // A standalone npm project on this CLI's version line.
    const manifest = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8')) as Manifest;
    expect(manifest.name).toBe('my-app');
    const deps = { ...manifest.dependencies, ...manifest.devDependencies };
    expect(deps['@bendyline/molen-kernel']).toBe(`^${ENGINE_VERSION}`);
    expect(manifest.devDependencies['@bendyline/molen-tooling']).toBe(`^${ENGINE_VERSION}`);
    expect(Object.values(deps).filter((spec) => /^(workspace|catalog):/.test(spec))).toEqual([]);
    expect(Object.keys(manifest.scripts)).toEqual(
      expect.arrayContaining(['dev', 'build', 'preview', 'typecheck', 'test']),
    );
    const source = await readFile(join(dir, 'src', 'main.ts'), 'utf8');
    if (source.includes('game-shell.css')) {
      expect(source).toContain("import './game-shell.css';");
      expect(s.files).toContain('src/game-shell.css');
    }

    // Prose is wrapped at 100 columns; compare it with the line breaks folded.
    const agents = (await readFile(join(dir, 'AGENTS.md'), 'utf8')).replace(/\s+/g, ' ');
    expect(agents).toContain('node_modules/@bendyline/molen-tooling/dist/docs-src/llms.txt');
    expect(agents).toContain('npx molen docs search');
    expect(agents).toContain(`\`${id}\` sample`);

    // Generated files are fresh against this registry.
    const hasProject = s.files?.includes('project.json') === true;
    if (hasProject) {
      const gen = await generateTypes({ projectPath: join(dir, 'project.json'), check: true });
      expect(gen.ok, gen.error).toBe(true);
    }

    await linkEngine(dir, manifest);
    const steps = s.nextSteps ?? [];
    expect(steps[0]).toBe(`cd ${dir}`);
    expect(steps).toContain('npm run dev');
    const loop = steps
      .filter((step) => step.startsWith('npx molen '))
      .map((step) => step.slice('npx molen '.length).split(/\s+/));
    expect(loop.length, 'the scaffold prints a headless loop').toBeGreaterThan(0);
    const ran = new Set<string>();
    for (const args of loop) {
      const at = (p: string): string => join(dir, p);
      if (args[0] === 'validate') {
        const v = await validateAsset({ path: at(args[1] as string) });
        expect(v.ok, v.formatted).toBe(true);
      } else if (args[0] === 'scripts' && args[1] === 'check') {
        const c = await checkScripts({ projectPath: at('project.json') });
        expect(c.ok, JSON.stringify(c.diagnostics ?? c.error)).toBe(true);
        expect(c.checked ?? 0).toBeGreaterThan(0);
      } else if (args[0] === 'sim' && args[1] === 'run') {
        const setup = flag(args, '--setup');
        const commands = flag(args, '--commands');
        const checks = flag(args, '--assert');
        const r = await runSimulation({
          scenePath: at(args[2] as string),
          ticks: Number(flag(args, '--ticks')),
          ...(setup !== undefined ? { setupModule: at(setup) } : {}),
          ...(commands !== undefined ? { commandsPath: at(commands) } : {}),
          ...(checks !== undefined ? { assertPath: at(checks) } : {}),
        });
        expect(r.error).toBeUndefined();
        expect(r.ok, r.assertionsFormatted).toBe(true);
        if (setup !== undefined) {
          // The setup module really loaded: without it the world is a different one.
          const bare = await runSimulation({
            scenePath: at(args[2] as string),
            ticks: Number(flag(args, '--ticks')),
          });
          expect(bare.stateHash).not.toBe(r.stateHash);
        }
      } else if (args[0] === 'replay') {
        const r = await runReplayFile({ path: at(args[1] as string) });
        expect(r.error).toBeUndefined();
        expect(r.ok, r.report).toBe(true);
      } else {
        throw new Error(`unexpected loop step: npx molen ${args.join(' ')}`);
      }
      ran.add(args[0] === 'sim' || args[0] === 'scripts' ? `${args[0]} ${args[1]}` : args[0]);
    }

    // Each artifact the sample ships appears in its loop.
    expect(ran.has('validate')).toBe(true);
    if (s.files?.some((f) => f.endsWith('molen-scripts.d.ts'))) {
      expect(ran.has('scripts check')).toBe(true);
    }
    if (s.files?.includes('commands.json') || s.files?.includes('checks.json')) {
      const sim = steps.find((step) => step.includes('sim run'));
      expect(sim).toContain('--commands commands.json');
      expect(sim).toContain('--assert checks.json');
    }
    for (const fixture of (s.files ?? []).filter((f) => f.endsWith('.replay.json'))) {
      expect(steps).toContain(`npx molen replay ${fixture}`);
    }
    if (s.files?.some((f) => f.startsWith('test/'))) expect(steps).toContain('npm test');
  }, 60_000);
});

describe('template scaffolding', () => {
  it('names every valid id when the template is unknown', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'molen-template-unknown-'));
    const r = await scaffoldExperience({ name: 'x', dir: parent, template: 'lantern-dungeon' });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('unknown template "lantern-dungeon"');
    for (const id of TEMPLATE_IDS) expect(r.error).toContain(id);
    const viaCli = await cli('new', 'x', '--dir', parent, '--template', 'nope');
    expect(viaCli.code).toBe(1);
    expect(viaCli.err).toContain('available templates: cubes, data-viz');
    const bare = await cli('new', 'x', '--dir', parent, '--template');
    expect(bare.code).toBe(2);
    expect(bare.err).toContain('--template needs a template id');
  });

  it('refuses to overwrite an existing project unless force is explicit', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'molen-template-force-'));
    const first = await scaffoldExperience({ name: 'app', dir: parent, template: 'skybound' });
    expect(first.ok, first.error).toBe(true);
    const scene = join(first.dir as string, 'scene.json');
    await writeFile(scene, '{"edited": true}\n');

    const refused = await scaffoldExperience({ name: 'app', dir: parent, template: 'skybound' });
    expect(refused.ok).toBe(false);
    expect(refused.error).toContain('already contains scaffold files');
    expect(refused.error).toContain('scene.json');
    expect(refused.error).toContain('AGENTS.md');
    expect(await readFile(scene, 'utf8')).toBe('{"edited": true}\n');

    // An unrelated file does not block a scaffold; one scaffold-owned file does.
    const other = await mkdtemp(join(tmpdir(), 'molen-template-partial-'));
    await mkdir(join(other, 'app'));
    await writeFile(join(other, 'app', 'notes.txt'), 'mine\n');
    expect((await scaffoldExperience({ name: 'app', dir: other, template: 'cubes' })).ok).toBe(
      true,
    );
    expect(await readFile(join(other, 'app', 'notes.txt'), 'utf8')).toBe('mine\n');
    await mkdir(join(other, 'agents'));
    await writeFile(join(other, 'agents', 'AGENTS.md'), 'mine\n');
    const onAgents = await scaffoldExperience({ name: 'agents', dir: other, template: 'data-viz' });
    expect(onAgents.ok).toBe(false);
    expect(onAgents.error).toMatch(/already contains scaffold files: AGENTS\.md \(/);
    expect(await readFile(join(other, 'agents', 'AGENTS.md'), 'utf8')).toBe('mine\n');

    const forced = await scaffoldExperience({
      name: 'app',
      dir: parent,
      template: 'skybound',
      force: true,
    });
    expect(forced.ok, forced.error).toBe(true);
    expect(JSON.parse(await readFile(scene, 'utf8')).format).toBe('molen/scene@3');
  });

  it('gives the built-in starter an AGENTS.md too, and leaves the rest of it unchanged', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'molen-starter-agents-'));
    const s = await scaffoldExperience({ name: 'demo', dir: parent });
    expect(s.ok, s.error).toBe(true);
    expect(s.files).toContain('AGENTS.md');
    expect(s.files).toContain('scenes/main.scene.json');
    const text = await readFile(join(s.dir as string, 'AGENTS.md'), 'utf8');
    expect(text.split('\n').every((line) => line.length <= 100)).toBe(true);
    const agents = text.replace(/\s+/g, ' ');
    expect(agents).toContain('the `molen new` starter');
    expect(agents).toContain('node_modules/@bendyline/molen-tooling/dist/docs-src/llms.txt');
    expect(agents).toContain('npx molen describe');
    expect(agents).toContain('npx molen mcp');
    expect(agents).toContain(
      'npx molen sim run main --ticks 30 --commands cmds.json --assert checks.json --hash',
    );
    expect(agents).toContain('`scenes/scripts/molen-scripts.d.ts`');
    expect(agents).toContain('molen.rng');
    // No template files leak into the starter.
    expect(s.files).not.toContain('scene.json');
    expect(s.nextSteps?.at(-1)).toBe('npx molen drive main --actions actions.json --out-dir shots');
  });
});
