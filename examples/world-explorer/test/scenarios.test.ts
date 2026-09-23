/// <reference types="node" />
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { parseExperiencePlayScenario } from '@bendyline/molen-tooling';
import { describe, expect, it } from 'vitest';

// The visual scenarios are a documented surface: guides and READMEs tell an agent to run
// `molen play ... --scenario test/visual/<name>.play.json`, and most of them are not executed by
// any test. This is the cheap half of that coverage — it cannot prove a scenario still produces
// the right picture, but it does prove every scenario parses under the current
// `molen/experience-play@1` schema and that nothing documents a file that no longer exists.
// Running them for real is the expensive half; see test:scenarios.

const ROOT = resolve(process.cwd());
const REPO = resolve(ROOT, '..', '..');
const VISUAL = join(ROOT, 'test', 'visual');

async function scenarioFiles(): Promise<string[]> {
  return (await readdir(VISUAL)).filter((name) => name.endsWith('.play.json')).sort();
}

/** Every text file that could name a scenario: shipped guides, example prose, package scripts. */
async function proseFiles(): Promise<string[]> {
  const roots = [join(REPO, 'docs-src'), join(REPO, 'examples'), join(REPO, 'packages')];
  const out: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    let entries: Awaited<ReturnType<typeof readdir>>;
    try {
      entries = await readdir(dir, { withFileTypes: true } as never);
    } catch {
      return;
    }
    for (const entry of entries as unknown as { name: string; isDirectory(): boolean }[]) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.'))
        continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (/\.(md|json|mjs|ts)$/.test(entry.name) && !entry.name.endsWith('.play.json'))
        out.push(full);
    }
  };
  for (const root of roots) await walk(root);
  return out;
}

describe('world explorer visual scenarios', () => {
  it('every scenario parses under the current experience-play schema', async () => {
    const files = await scenarioFiles();
    expect(files.length).toBeGreaterThan(0);
    for (const name of files) {
      const raw = JSON.parse(await readFile(join(VISUAL, name), 'utf8'));
      // Throws with a formatted issue list when a scenario drifts from the action schema.
      const scenario = parseExperiencePlayScenario(raw);
      expect(scenario.format, name).toBe('molen/experience-play@1');
      expect(scenario.actions.length, `${name} has no actions`).toBeGreaterThan(0);
      // A scenario that never captures anything cannot be a visual check.
      expect(
        scenario.actions.some((action) => action.type === 'screenshot'),
        `${name} captures no frames`,
      ).toBe(true);
    }
  });

  it('nothing documents a scenario file that does not exist', async () => {
    const present = new Set(await scenarioFiles());
    const referenced = new Map<string, string[]>();
    for (const file of await proseFiles()) {
      const text = await readFile(file, 'utf8');
      // Only references into this directory. A one-off scenario written under .artifacts/ during
      // a manual review is not a documented surface and must not fail the build.
      for (const match of text.matchAll(/test\/visual\/([\w-]+\.play\.json)/g)) {
        const name = match[1] as string;
        referenced.set(name, [...(referenced.get(name) ?? []), relative(REPO, file)]);
      }
    }
    // The check is only meaningful if it actually found references to verify.
    expect(
      referenced.size,
      'no documented scenario references found — is the scan broken?',
    ).toBeGreaterThan(3);
    const dangling = [...referenced.entries()]
      .filter(([name]) => !present.has(name))
      .map(([name, where]) => `${name} (referenced by ${where.join(', ')})`);
    expect(dangling, 'documented scenarios must exist on disk').toEqual([]);
  });
});
