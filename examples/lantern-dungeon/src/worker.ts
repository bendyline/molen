/// <reference lib="webworker" />
import { startKernelWorker } from '@bendyline/molen-kernel';
import { scene } from './scene';

// Start paused: the vault has 28 models to fetch and sentinels that strike on contact, so a
// free-running world spends the loading screen killing a player who cannot act yet. The page
// resumes once `client.ready()` settles (src/main.ts).
startKernelWorker({ scene: scene(), host: { startPaused: true } });
