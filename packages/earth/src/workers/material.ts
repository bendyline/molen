// Worker entry: a module worker that is just `import '@bendyline/molen-earth/workers/material';`,
// created with `new Worker(new URL('./material.worker.ts', import.meta.url), { type: 'module' })` and
// passed to mountEarthView as `workers.material`.
import { installMaterialBakeWorker } from '@bendyline/molen-materials';

// Install only inside a worker; importing the entry anywhere else (a bundler scan, Node) is a no-op.
if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  installMaterialBakeWorker(self as unknown as Parameters<typeof installMaterialBakeWorker>[0]);
}
