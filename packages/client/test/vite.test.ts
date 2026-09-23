import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { molenScripts, stripScriptTypes } from '../src/vite';

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'molen-vite-'));
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('stripScriptTypes', () => {
  it('erases types without moving any line or column', () => {
    const source = [
      'const speed: number = config.speed;',
      'function step(dir: readonly number[]): [number, number, number] {',
      '  return [dir[0] * speed, 0, dir[1] * speed];',
      '}',
      'molen.on(TICK, () => step([1, 0]));',
    ].join('\n');
    const stripped = stripScriptTypes(source, 'logic.ts');

    expect(stripped).not.toContain(': number');
    expect(stripped.split('\n')).toHaveLength(source.split('\n').length);
    // Column-for-column: a stack frame in the sandbox points at the authored position.
    const lines = source.split('\n');
    const strippedLines = stripped.split('\n');
    for (const [i, line] of lines.entries()) {
      expect(strippedLines[i]).toHaveLength(line.length);
    }
    expect(strippedLines[4]).toBe(lines[4]);
  });

  it('rejects syntax the loader cannot erase, naming the rule', () => {
    expect(() => stripScriptTypes('enum Mode { Idle, Run }\n', 'logic.ts')).toThrow(
      /erasable syntax only/,
    );
  });

  it('leaves plain JavaScript alone', () => {
    const source =
      "molen.on('tick', () => molen.patch('hero', 'transform', { pos: [0, 0, 0] }));\n";
    expect(stripScriptTypes(source, 'logic.ts')).toBe(source);
  });
});

describe('molenScripts plugin', () => {
  it('serves a .ts script imported with ?raw as stripped source', async () => {
    const file = join(dir, 'game.ts');
    await writeFile(file, 'const n: number = 1;\nmolen.emit("ready", n);\n');
    const plugin = molenScripts();
    const loaded = await plugin.load(`${file}?raw`);
    expect(loaded).toBeDefined();
    const code = JSON.parse((loaded as string).replace('export default ', '').replace(/;$/, ''));
    expect(code).toContain('const n         = 1;');
    expect(code).not.toContain(': number');
  });

  it('ignores everything else (plain imports, .js, other queries)', async () => {
    const file = join(dir, 'game.ts');
    expect(await molenScripts().load(file)).toBeUndefined();
    expect(await molenScripts().load(`${join(dir, 'game.js')}?raw`)).toBeUndefined();
    expect(await molenScripts().load(`${file}?url`)).toBeUndefined();
    expect(await molenScripts({ include: /scripts\// }).load(`${file}?raw`)).toBeUndefined();
  });
});
