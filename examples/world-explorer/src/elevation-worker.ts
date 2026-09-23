import { installTerrainElevationWorker } from '@bendyline/molen-terrain/client';

// This Vite entry executes only in a Worker; the app's DOM lib types self as Window.
installTerrainElevationWorker(
  self as unknown as Parameters<typeof installTerrainElevationWorker>[0],
);
