import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { registerComponent } from '@bendyline/molen-schema';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { renderTypesModule } from '../src/ops/generate-types';
import {
  checkTypesOp,
  generateTypes,
  getComponentOp,
  listComponentsOp,
  projectInfo,
  runSimulation,
  scaffoldExperience,
  searchDocs,
  validateAsset,
} from '../src/ops/index';
import { loadProject } from '../src/project';

// The canonical from-disk agent loop, end to end: scaffold -> validate -> types check ->
// simulate + assert. This is the regression test for `molen new` (a full project scaffold)
// and for registry types + scene-data scripts running through the tools.
describe('canonical headless loop (scaffold -> validate -> simulate -> assert)', () => {
  it('scaffolds a runnable project and runs its documented loop', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'molen-new-'));
    const s = await scaffoldExperience({ name: 'demo', dir: parent });
    expect(s.ok).toBe(true);
    const dir = s.dir as string;
    const projectPath = join(dir, 'project.json');

    // The printed next-step sim command must be runnable as-is (sim run requires --ticks).
    const simStep = (s.nextSteps ?? []).find((c) => c.includes('sim run'));
    expect(simStep, 'scaffold prints a sim run step').toBeDefined();
    expect(simStep).toContain('--ticks');

    const packageJson = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8')) as {
      scripts: { dev: string };
    };
    expect(packageJson.scripts.dev).toBe('vite --port 5225');

    // 1. validate: project + scene + checks; the type registry cross-checks pass.
    const p = await validateAsset({ path: projectPath });
    expect(p.ok, p.formatted).toBe(true);
    expect(p.kind).toBe('project');

    const v = await validateAsset({ path: join(dir, 'scenes', 'main.scene.json') });
    expect(v.ok, v.formatted).toBe(true);
    expect(v.kind).toBe('scene');

    const checks = await validateAsset({ path: join(dir, 'checks.json') });
    expect(checks.ok, checks.formatted).toBe(true);

    const info = await projectInfo({ projectPath });
    expect(info.ok, info.error).toBe(true);
    expect(info.typeIds).toContain('demo.cube');

    // Codegen: generate then verify (check mode must report up-to-date).
    const gen = await generateTypes({ projectPath });
    expect(gen.ok, gen.error).toBe(true);
    const check = await checkTypesOp({ projectPath });
    expect(check.ok, JSON.stringify(check)).toBe(true);

    // 2+3. simulate BY SCENE NAME through the project, with setup + commands + assertions.
    const r = await runSimulation({
      scenePath: 'main',
      projectPath,
      setupModule: join(dir, 'setup.mjs'),
      commandsPath: join(dir, 'cmds.json'),
      assertPath: join(dir, 'checks.json'),
      ticks: 30,
    });
    expect(r.error).toBeUndefined();
    expect(r.ok, r.assertionsFormatted).toBe(true);
    expect(r.tick).toBe(30);

    // Determinism: same scene + setup -> identical hash
    const again = await runSimulation({
      scenePath: 'main',
      projectPath,
      setupModule: join(dir, 'setup.mjs'),
      commandsPath: join(dir, 'cmds.json'),
      ticks: 30,
    });
    expect(again.stateHash).toBe(r.stateHash);
  });

  it('exposes the component vocabulary to agents', async () => {
    const names = listComponentsOp().map((c) => c.name);
    expect(names).toContain('transform');
    const t = getComponentOp('transform');
    expect(t.ok).toBe(true);
    expect(t.jsonSchema).toBeDefined();
  });

  it('refuses to overwrite an existing scaffold unless force is explicit', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'molen-new-safe-'));
    expect((await scaffoldExperience({ name: 'demo', dir: parent })).ok).toBe(true);
    const refused = await scaffoldExperience({ name: 'demo', dir: parent });
    expect(refused.ok).toBe(false);
    expect(refused.error).toContain('already contains');
    expect((await scaffoldExperience({ name: 'demo', dir: parent, force: true })).ok).toBe(true);
  });

  it('search_docs finds the agent loop in the shipped bundle', async () => {
    const r = await searchDocs({ query: 'headless loop validate simulate', k: 3 });
    expect(r.hits.length).toBeGreaterThan(0);
    expect(r.hits.every((h) => !h.path.startsWith('docs/'))).toBe(true);
  });

  it('generates syntactically valid TypeScript for non-identifier component names', async () => {
    registerComponent('foo-bar', z.strictObject({ value: z.number() }), {
      description: 'Custom punctuation regression',
      examples: [{ value: 1 }],
    });
    const parent = await mkdtemp(join(tmpdir(), 'molen-codegen-safe-'));
    const scaffold = await scaffoldExperience({ name: 'demo', dir: parent });
    const project = await loadProject(join(scaffold.dir as string, 'project.json'));
    const source = renderTypesModule(project);
    const result = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      reportDiagnostics: true,
    });
    expect(
      result.diagnostics
        ?.filter((d) => d.category === ts.DiagnosticCategory.Error)
        .map((d) => `${d.code}: ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`),
    ).toEqual([]);
    expect(source).toContain(`'foo-bar': defineComponent`);
  });
});
