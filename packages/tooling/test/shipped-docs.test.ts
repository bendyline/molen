import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const gate = await import(resolve(__dirname, '../../../scripts/check-shipped-docs.mjs'));
const root = resolve(__dirname, '../../..');
const bundle = resolve(root, 'docs-src');
const guide = resolve(bundle, 'guide/example.md');

describe('shipped docs gate', () => {
  it('passes the docs bundle as it stands', () => {
    expect(gate.checkShippedDocs()).toEqual([]);
  });

  it('allows links inside the bundle and absolute links out of it', () => {
    const text = [
      'See [scripting](scripting.md#script-trust) and [the schemas](../schemas/README.md).',
      'Read [the index](../llms.txt), [molen.dev](https://molen.dev/play/) and [a section](#top).',
      'The [source](https://github.com/bendyline/molen/tree/main/content/worldgen).',
    ].join('\n');
    expect(gate.checkShippedDoc(guide, bundle, text)).toEqual([]);
  });

  it('rejects relative links that climb out of the bundle', () => {
    const problems = gate.checkShippedDoc(
      guide,
      bundle,
      'Intro.\nThe [catalog](../../content/worldgen/materials/README.md "materials").',
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/guide\/example\.md:2: links to \.\.\/\.\.\/content\/worldgen/);
  });

  it('rejects the CLI as only a clone can run it', () => {
    const problems = gate.checkShippedDoc(
      guide,
      bundle,
      'node packages/tooling/dist/cli.mjs validate scene.json',
    );
    expect(problems[0]).toMatch(/runs the CLI from a clone/);
    expect(gate.checkShippedDoc(guide, bundle, 'npx molen validate scene.json')).toEqual([]);
  });

  it('keeps template READMEs inside the files a template copy ships', () => {
    const sample = resolve(root, 'examples/example');
    const readme = resolve(sample, 'README.md');
    const ok = [
      '![Preview](https://raw.githubusercontent.com/bendyline/molen/main/examples/example/preview.png)',
      'The [rules](scripts/game.ts) and [a guide](https://molen.dev/guide/scripting).',
    ].join('\n');
    expect(gate.checkTemplateReadme(readme, sample, ok)).toEqual([]);
    const bad = gate.checkTemplateReadme(
      readme,
      sample,
      [
        '![Preview](preview.png)',
        'See [the arena](../top-down-arena/README.md) and [a golden](test/golden/a.golden.test.ts).',
        'node ../../packages/tooling/dist/cli.mjs validate scene.json',
      ].join('\n'),
    );
    expect(bad).toHaveLength(4);
    expect(bad[0]).toMatch(/:3: runs the CLI from a clone/);
    expect(bad[1]).toMatch(/:1: links to preview\.png, which template copies leave out/);
    expect(bad[2]).toMatch(/:2: links to \.\.\/top-down-arena\/README\.md, outside the sample/);
    expect(bad[3]).toMatch(/:2: links to test\/golden\/a\.golden\.test\.ts, which template copies/);
  });
});
