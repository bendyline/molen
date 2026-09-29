/// <reference lib="webworker" />
import { ambientCapability } from '@bendyline/molen-ambient/kernel';
import { startKernelWorker } from '@bendyline/molen-kernel';
import { scene } from './scene';

// The scene's `ambient` block (traffic on the street grid) needs the ambient capability.
startKernelWorker({ scene: scene(), capabilities: [ambientCapability()] });
