// Worker entry: a module worker that is just `import '@bendyline/molen-earth/workers/surface';`,
// created with `new Worker(new URL('./surface.worker.ts', import.meta.url), { type: 'module' })` and
// passed to mountEarthView as `workers.surface`.
import { installTerrainSurfaceWorker } from '@bendyline/molen-terrain/client';

// Install only inside a worker; importing the entry anywhere else (a bundler scan, Node) is a no-op.
if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  installTerrainSurfaceWorker(self as unknown as Parameters<typeof installTerrainSurfaceWorker>[0]);
}
