import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { describe, expect, it } from 'vitest';

// `three/webgpu` is a second three build: bundled, it is about 530 KB on top of the WebGL core
// (measured with esbuild over the published entry — aliasing the specifier to a stub removes
// 532 KB and one chunk). That is fine as a lazily loaded chunk, because a page only fetches it
// when the device actually has a WebGPU adapter. It is NOT fine eagerly: one static import
// anywhere in the reachable graph makes every app pay for a backend most of them never select,
// and nothing else in the suite would notice. These tests pin the laziness.
//
// The rule: WebGPU value imports live in leaf modules, and nothing reaches those leaves except
// through `await import(...)`. Type-only imports are free — they erase.

const WEBGPU_LEAVES = ['webgpu-driver.ts', 'webgpu-scene-optimizer.ts'];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(ts|mts)$/.test(name)) out.push(path);
  }
  return out;
}

describe('the WebGPU backend stays lazy', () => {
  const srcDir = new URL('../src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
  const files = walk(srcDir);

  it('takes runtime values from three/webgpu only in the lazily imported leaves', () => {
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      // `import type { … } from 'three/webgpu'` erases; a value import does not.
      const valueImport = /^import\s+(?!type\b)[^;]*?from\s+['"]three\/webgpu['"]/m.test(text);
      if (!valueImport) continue;
      expect(
        WEBGPU_LEAVES.includes(basename(file)),
        `${basename(file)} imports runtime values from three/webgpu. Only ${WEBGPU_LEAVES.join(
          ' and ',
        )} may, because only they are reached through await import().`,
      ).toBe(true);
    }
  });

  it('never reaches those leaves through a static import', () => {
    for (const file of files) {
      if (WEBGPU_LEAVES.includes(basename(file))) continue;
      const text = readFileSync(file, 'utf8');
      for (const leaf of WEBGPU_LEAVES) {
        const specifier = leaf.replace(/\.ts$/, '');
        // A static `from './webgpu-driver'` pulls three/webgpu into the eager graph; a
        // `import type` does not, and neither does `await import('./webgpu-driver')`.
        const staticValueImport = new RegExp(
          `^import\\s+(?!type\\b)[^;]*?from\\s+['"][^'"]*${specifier}['"]`,
          'm',
        );
        expect(
          staticValueImport.test(text),
          `${basename(file)} statically imports ${leaf}, which makes the WebGPU build eager for ` +
            'every consumer. Load it with await import() instead.',
        ).toBe(false);
      }
    }
  });

  it('loads each leaf through await import() in the backend factory', () => {
    const renderer = readFileSync(join(srcDir, 'three', 'renderer.ts'), 'utf8');
    for (const leaf of WEBGPU_LEAVES) {
      const specifier = leaf.replace(/\.ts$/, '');
      expect(
        renderer.includes(`await import('./${specifier}')`),
        `renderer.ts should reach ${leaf} with await import('./${specifier}')`,
      ).toBe(true);
    }
  });

  it('asks for an adapter before loading the driver, so a WebGL device never fetches it', () => {
    const renderer = readFileSync(join(srcDir, 'three', 'renderer.ts'), 'utf8');
    const adapterAt = renderer.indexOf('requestAdapter');
    const driverAt = renderer.indexOf("await import('./webgpu-driver')");
    expect(adapterAt, 'renderer.ts should request an adapter').toBeGreaterThan(-1);
    expect(driverAt, 'renderer.ts should import the driver lazily').toBeGreaterThan(-1);
    expect(
      adapterAt,
      'the adapter request must come first: a device with no adapter should never pay to download ' +
        'the WebGPU build',
    ).toBeLessThan(driverAt);
  });
});
