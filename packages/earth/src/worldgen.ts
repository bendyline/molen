// Worker entry: `new Worker(new URL('./worldgen.worker.ts', import.meta.url), { type: 'module' })`
// where that file is just `import '@bendyline/molen-earth/workers/worldgen';`, then pass the
// factory as `workers.worldgen` to mountEarthView. It is three-free.
import { installWorldgenWorker } from '@bendyline/molen-worldgen-earth/worker';

installWorldgenWorker(self as unknown as Parameters<typeof installWorldgenWorker>[0]);
