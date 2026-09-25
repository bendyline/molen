// Worker entry: a module worker that is just `import '@bendyline/molen-earth/workers/landcover';`,
// created with `new Worker(new URL('./landcover.worker.ts', import.meta.url), { type: 'module' })` and
// passed to mountEarthView as `workers.landcover`.
import { installTerrainLandcoverWorker } from '@bendyline/molen-terrain/client';

// Install only inside a worker; importing the entry anywhere else (a bundler scan, Node) is a no-op.
if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  installTerrainLandcoverWorker(
    self as unknown as Parameters<typeof installTerrainLandcoverWorker>[0],
  );
}
