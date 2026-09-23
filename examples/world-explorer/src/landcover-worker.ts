import { installTerrainLandcoverWorker } from '@bendyline/molen-terrain/client';

// The DOM lib types self as Window; Vite only runs this entry in a Worker.
installTerrainLandcoverWorker(
  self as unknown as Parameters<typeof installTerrainLandcoverWorker>[0],
);
