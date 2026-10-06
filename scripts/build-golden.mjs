import { spawn } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packHooks = new Set([
  'node scripts/build-content-packs.mjs',
  'node ../world-explorer/scripts/build-content-packs.mjs',
]);

export async function goldenBuildPlan(repo = root) {
  const examples = [];
  for (const entry of await readdir(join(repo, 'examples'), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    let pkg;
    try {
      pkg = JSON.parse(await readFile(join(repo, 'examples', entry.name, 'package.json'), 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    if (pkg.scripts?.['test:golden']) examples.push(pkg);
  }
  examples.sort((a, b) => a.name.localeCompare(b.name, 'en'));
  const plan = [{ command: 'pnpm', args: ['-r', '--filter', './packages/**', 'build'] }];
  // Both Earth View and World Explorer use these packs. Build them once before either Vite
  // build, then invoke Vite directly rather than repeating their identical prebuild hooks.
  if (examples.some((pkg) => packHooks.has(pkg.scripts.prebuild))) {
    plan.push({
      command: process.execPath,
      args: ['examples/world-explorer/scripts/build-content-packs.mjs'],
    });
  }
  for (const pkg of examples) {
    const sharedPacks = packHooks.has(pkg.scripts.prebuild);
    const directVite =
      pkg.scripts.build === 'vite build' &&
      !pkg.scripts.postbuild &&
      (!pkg.scripts.prebuild || sharedPacks);
    plan.push({
      command: 'pnpm',
      args: ['--filter', pkg.name, ...(directVite ? ['exec', 'vite', 'build'] : ['run', 'build'])],
    });
  }
  return plan;
}

async function build() {
  for (const { command, args } of await goldenBuildPlan()) {
    console.log(`[golden:build] ${command} ${args.join(' ')}`);
    // Reuse the pnpm which launched this script, including the repository's pinned version.
    const pnpmEntry = command === 'pnpm' && process.env.npm_execpath;
    const child = spawn(
      pnpmEntry ? process.execPath : command,
      pnpmEntry ? [pnpmEntry, ...args] : args,
      { cwd: root, stdio: 'inherit' },
    );
    const code = await new Promise((done, reject) => {
      child.once('error', reject);
      child.once('close', (status) => done(status ?? 1));
    });
    if (code !== 0) return code;
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = await build();
}
