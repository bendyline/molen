// Worker entry: a module worker that is just `import '@bendyline/molen-earth/workers/semantic';`,
// created with `new Worker(new URL('./semantic.worker.ts', import.meta.url), { type: 'module' })` and
// passed to mountEarthView as `workers.semantic`.
import { installTerrainSemanticDecoderWorker } from '@bendyline/molen-terrain/client';

// Install only inside a worker; importing the entry anywhere else (a bundler scan, Node) is a no-op.
if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  installTerrainSemanticDecoderWorker(
    self as unknown as Parameters<typeof installTerrainSemanticDecoderWorker>[0],
  );
}
