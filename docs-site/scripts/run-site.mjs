// Keep generation and its consumers under one lock, including the gap between commands.
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { generateAll } from './generate-all.mjs';
import { siteDir } from './packages.mjs';
import { withSiteLock } from './site-lock.mjs';

function run(script, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], { cwd: siteDir, stdio: 'inherit' });
    // Let the child shut down before finally releases the lock when this runner is interrupted.
    const interrupt = () => child.kill('SIGINT');
    const terminate = () => child.kill('SIGTERM');
    process.on('SIGINT', interrupt);
    process.on('SIGTERM', terminate);
    const cleanup = () => {
      process.off('SIGINT', interrupt);
      process.off('SIGTERM', terminate);
    };
    child.on('error', (error) => {
      cleanup();
      reject(error);
    });
    child.on('close', (code, signal) => {
      cleanup();
      if (code === 0) resolve();
      else reject(new Error(`${script} failed (${signal ?? `exit ${code}`})`));
    });
  });
}

async function main() {
  const mode = process.argv[2];
  if (!['gen', 'check', 'build', 'dev', 'stage'].includes(mode) || process.argv.length !== 3)
    throw new Error('Usage: node scripts/run-site.mjs gen|check|build|dev|stage');
  const vitepress = join(siteDir, 'node_modules/vitepress/bin/vitepress.js');
  const stage = join(siteDir, 'scripts/stage-hosted.mjs');
  await withSiteLock(siteDir, async () => {
    if (mode === 'stage') return run(stage);
    await generateAll({ check: mode === 'check' });
    if (mode === 'build') {
      await run(vitepress, ['build']);
      await run(stage);
    }
  });
  // The dev server watches regenerated pages; release the build lock before serving indefinitely.
  if (mode === 'dev') await run(vitepress, ['dev']);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
