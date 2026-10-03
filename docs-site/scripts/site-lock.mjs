// Generators remove and recreate the site's pages. Hold this lock until VitePress has finished
// reading them, so a second build or navigation check cannot delete a live build's entry points.
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readdir, rename, rm, rmdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { setTimeout } from 'node:timers/promises';

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error.code === 'ESRCH') return false;
    if (error.code === 'EPERM') return true;
    throw error;
  }
}

async function release(directory, owner) {
  // Remove only this owner's file. Another waiter may already have recovered this dead owner
  // and installed a new lock; its different owner file keeps rmdir from removing the live lock.
  try {
    await unlink(join(directory, owner));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  try {
    await rmdir(directory);
  } catch (error) {
    if (!['ENOENT', 'ENOTEMPTY', 'EEXIST'].includes(error.code)) throw error;
  }
}

export async function withSiteLock(siteDir, work, { log = console.log } = {}) {
  const parent = join(dirname(siteDir), '.artifacts');
  const directory = join(parent, 'docs-site.lock');
  await mkdir(parent, { recursive: true });
  const prepared = await mkdtemp(join(parent, 'docs-site-lock-'));
  const owner = `${process.pid}-${randomUUID()}.owner`;
  let acquired = false;
  let announced = false;
  try {
    // Publish a nonempty directory atomically: no waiter can see a half-written owner, and a
    // stale-lock cleanup can never remove a replacement lock (rmdir rejects nonempty folders).
    await writeFile(join(prepared, owner), '');
    for (;;) {
      try {
        await rename(prepared, directory);
        acquired = true;
        break;
      } catch (error) {
        if (!['EEXIST', 'ENOTEMPTY', 'EPERM'].includes(error.code)) throw error;
      }
      let owners;
      try {
        owners = await readdir(directory);
      } catch (error) {
        if (error.code === 'ENOENT') continue;
        throw error;
      }
      if (owners.length > 1 || (owners.length === 1 && !/^\d+-[\w-]+\.owner$/.test(owners[0])))
        throw new Error(`Unrecognized documentation build lock: ${directory}`);
      if (owners.length === 1 && !alive(Number(owners[0].split('-')[0]))) {
        await release(directory, owners[0]);
        continue;
      }
      if (!announced) {
        log('docs site: waiting for another documentation command to finish');
        announced = true;
      }
      await setTimeout(250);
    }
    return await work();
  } finally {
    if (acquired) await release(directory, owner);
    else await rm(prepared, { recursive: true, force: true });
  }
}
