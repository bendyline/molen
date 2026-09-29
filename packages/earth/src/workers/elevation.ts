// Worker entry: a module worker that is just `import '@bendyline/molen-earth/workers/elevation';`,
// created with `new Worker(new URL('./elevation.worker.ts', import.meta.url), { type: 'module' })` and
// passed to mountEarthView as `workers.elevation`.
import { installTerrainElevationWorker } from '@bendyline/molen-terrain/client';

// Install only inside a worker; importing the entry anywhere else (a bundler scan, Node) is a no-op.
if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  installTerrainElevationWorker(
    self as unknown as Parameters<typeof installTerrainElevationWorker>[0],
  );
}
