import { installTerrainSurfaceWorker } from '@bendyline/molen-terrain/client';

// The DOM lib types self as Window; Vite only runs this entry in a Worker.
installTerrainSurfaceWorker(self as unknown as Parameters<typeof installTerrainSurfaceWorker>[0]);
