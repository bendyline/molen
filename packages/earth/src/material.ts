// Worker entry: `new Worker(new URL('./material.worker.ts', import.meta.url), { type: 'module' })`
// where that file is just `import '@bendyline/molen-earth/workers/material';`, then pass the
// factory as `workers.material` to mountEarthView (it starts two).
import { installMaterialBakeWorker } from '@bendyline/molen-materials';

installMaterialBakeWorker(self as unknown as Parameters<typeof installMaterialBakeWorker>[0]);
