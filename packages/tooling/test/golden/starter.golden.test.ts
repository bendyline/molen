import { mkdtemp, realpath, symlink } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { expect, it } from 'vitest';
import { scaffoldExperience } from '../../src/ops/index';

// The generated project is built with its own Vite config and opened in Chromium. Workspace
// dependencies replace an npm install; no edits are made to the generated scene or Worker.
it('F01/F08: the generated starter boots its Worker and responds to input', async () => {
  // realpath: on macOS tmpdir() sits under the /var -> /private/var symlink, and Vite emits
  // chunk names relative to the resolved root.
  const parent = await realpath(await mkdtemp(join(tmpdir(), 'molen-browser-starter-')));
  const result = await scaffoldExperience({ name: 'browserdemo', dir: parent });
  expect(result.ok).toBe(true);
  if (result.dir === undefined) throw new Error(result.error ?? 'scaffold produced no directory');
  const root = result.dir;
  // The gallery example carries the starter's full dependency set (client, kernel, schema, figures).
  const example = resolve('../../examples/figures-gallery');
  await symlink(
    join(example, 'node_modules'),
    join(root, 'node_modules'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  const require = createRequire(join(example, 'package.json'));
  const vite = await import(
    pathToFileURL(join(dirname(require.resolve('vite/package.json')), 'dist/node/index.js')).href
  );
  await vite.build({ root, logLevel: 'error' });
  const server = await vite.preview({
    root,
    logLevel: 'error',
    preview: { host: '127.0.0.1', port: 0 },
  });
  const address = server.httpServer.address();
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--no-sandbox',
    ],
  });
  try {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${address.port}`);
    await page.waitForFunction(() => document.body.innerText.includes('3 entities'));
    await page.keyboard.press('Space');
    await page.waitForFunction(() => document.body.innerText.includes('4 entities'));
    await page.keyboard.down('KeyD');
    await page.waitForFunction(() => /hero [1-9]/.test(document.body.innerText));
    await page.keyboard.up('KeyD');
    expect(errors).toEqual([]);
  } finally {
    await browser.close();
    await new Promise<void>((done, reject) =>
      server.httpServer.close((error: Error | undefined) => (error ? reject(error) : done())),
    );
  }
});
