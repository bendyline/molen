import { spawn } from 'node:child_process';
import { copyFile, link, mkdir, readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packHooks = new Set([
  'node scripts/build-content-packs.mjs',
  'node ../world-explorer/scripts/build-content-packs.mjs',
]);
// Where those hooks write the packs: the explorer's public/, which the Earth view also serves.
const sharedPublic = 'examples/world-explorer/public';

/**
 * Hard-links every file under `from` into the same place under `to`, which is what Vite's
 * public-directory copy produces without a second copy of the bytes. A file the bundle already
 * wrote is kept, as Vite's own build lets bundle output replace a copied public file.
 */
export async function linkTree(from, to) {
  await mkdir(to, { recursive: true });
  for (const entry of await readdir(from, { withFileTypes: true })) {
    const source = join(from, entry.name);
    const target = join(to, entry.name);
    if (entry.isDirectory()) {
      await linkTree(source, target);
      continue;
    }
    try {
      await link(source, target);
    } catch (error) {
      if (error.code === 'EEXIST') continue;
      // Another volume, or a filesystem without hard links: copy, as Vite would have.
      if (!['EXDEV', 'EPERM', 'ENOTSUP', 'ENOSYS'].includes(error.code)) throw error;
      await copyFile(source, target);
    }
  }
}

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
    if (pkg.scripts?.['test:golden']) examples.push({ ...pkg, dir: `examples/${entry.name}` });
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
    const step = {
      command: 'pnpm',
      args: ['--filter', pkg.name, ...(directVite ? ['exec', 'vite', 'build'] : ['run', 'build'])],
    };
    // Each of these dists would otherwise hold its own copy of the shared packs (~20 GB apiece),
    // which ran the CI runner out of disk. The vite configs honour MOLEN_SKIP_PUBLIC_COPY.
    if (sharedPacks && directVite) {
      step.env = { MOLEN_SKIP_PUBLIC_COPY: '1' };
      step.linkPublic = { from: sharedPublic, to: `${pkg.dir}/dist` };
    }
    plan.push(step);
  }
  return plan;
}

async function build() {
  for (const { command, args, env, linkPublic } of await goldenBuildPlan()) {
    console.log(`[golden:build] ${command} ${args.join(' ')}`);
    // Reuse the pnpm which launched this script, including the repository's pinned version.
    const pnpmEntry = command === 'pnpm' && process.env.npm_execpath;
    const child = spawn(
      pnpmEntry ? process.execPath : command,
      pnpmEntry ? [pnpmEntry, ...args] : args,
      { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } },
    );
    const code = await new Promise((done, reject) => {
      child.once('error', reject);
      child.once('close', (status) => done(status ?? 1));
    });
    if (code !== 0) return code;
    if (linkPublic) {
      console.log(`[golden:build] link ${linkPublic.from} into ${linkPublic.to}`);
      await linkTree(resolve(root, linkPublic.from), resolve(root, linkPublic.to));
    }
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = await build();
}
