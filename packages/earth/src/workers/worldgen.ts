// Worker entry: a module worker that is just `import '@bendyline/molen-earth/workers/worldgen';`,
// created with `new Worker(new URL('./worldgen.worker.ts', import.meta.url), { type: 'module' })` and
// passed to mountEarthView as `workers.worldgen`.
import { installWorldgenWorker } from '@bendyline/molen-worldgen-earth/worker';

// Install only inside a worker; importing the entry anywhere else (a bundler scan, Node) is a no-op.
if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  installWorldgenWorker(self as unknown as Parameters<typeof installWorldgenWorker>[0]);
}
