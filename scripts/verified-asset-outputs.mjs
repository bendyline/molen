// A generator may reuse byte-verified outputs without rewriting them. Include those files in
// its normal dependency trace so the next incremental build retains their ownership.
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { dependencyPath } from './asset-job-cache.mjs';

export async function traceVerifiedAssetOutputs(
  paths,
  {
    root = process.env.MOLEN_ASSET_TRACE_ROOT,
    directory = process.env.MOLEN_ASSET_TRACE_DIRECTORY,
  } = {},
) {
  if (!root || !directory || paths.length === 0) return;
  const writes = [...new Set(paths.map((path) => dependencyPath(root, path)))];
  if (writes.some((path) => !path || !/^(content|assets|examples)\/.*\.glb$/.test(path)))
    throw new Error('Verified asset outputs must be repository GLBs.');
  await writeFile(
    join(directory, `verified-outputs-${randomUUID()}.json`),
    JSON.stringify({ dependencies: [], writes }),
  );
}
