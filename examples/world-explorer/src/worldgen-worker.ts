// Default worldgen worker entry; `?worker=0` enables in-thread diagnostics. Vite bundles this file
// (three-free) when main.ts does `new Worker(new URL('./worldgen-worker.ts', import.meta.url))`.
import { installWorldgenWorker } from '@bendyline/molen-worldgen-earth/worker';

// The DOM lib types `self` as a Window; at runtime this file only ever runs in a Worker.
installWorldgenWorker(self as unknown as Parameters<typeof installWorldgenWorker>[0]);
