import { installGameplay, World } from '@bendyline/molen-kernel';
import type { ValidationIssue } from '@bendyline/molen-schema';
import { componentMapIssues } from '@bendyline/molen-schema';
import { findProjectFile, loadProject } from '../project';

// Entity automation for agents: every registry type gets a standalone smoke test — resolved
// components validate, the entity spawns, and the world simulates N ticks with the gameplay
// systems live. Catches broken defaults, bad extends chains, and components that crash systems
// WITHOUT authoring a scene per type.

export interface TestTypesInput {
  projectPath?: string;
  cwd?: string;
  /** Ticks to simulate each type for (default 30). */
  ticks?: number;
  /** Only test these type ids (default: all). */
  only?: string[];
}

export interface TypeTestResult {
  id: string;
  ok: boolean;
  issues?: ValidationIssue[];
  error?: string;
}

export interface TestTypesOutput {
  ok: boolean;
  results?: TypeTestResult[];
  error?: string;
}

/** Spawn + simulate every registry type in isolation; report per-type verdicts. */
export async function testTypes(input: TestTypesInput): Promise<TestTypesOutput> {
  try {
    const projectPath = input.projectPath ?? (await findProjectFile(input.cwd ?? process.cwd()));
    if (projectPath === undefined) return { ok: false, error: 'no project.json found' };
    const project = await loadProject(projectPath);
    const ticks = input.ticks ?? 30;
    const ids = [...project.resolvedTypes.keys()]
      .filter((id) => input.only === undefined || input.only.includes(id))
      .sort();

    const results: TypeTestResult[] = [];
    for (const id of ids) {
      const resolved = project.resolvedTypes.get(id);
      if (resolved === undefined) continue;
      const { components } = resolved;
      // 1. The RESOLVED component map must be shape-complete.
      const issues = componentMapIssues(components, '');
      if (issues.length > 0) {
        results.push({ id, ok: false, issues });
        continue;
      }
      // 2. Spawn standalone and simulate with the gameplay systems installed.
      try {
        const w = new World({ seed: `types-test:${id}` });
        installGameplay(w);
        w.spawn(components, { id: 'subject', validate: true });
        w.stepN(ticks);
        results.push({ id, ok: true });
      } catch (e) {
        results.push({ id, ok: false, error: (e as Error).message });
      }
    }
    return { ok: results.every((r) => r.ok), results };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
