/// <reference lib="webworker" />
import { startKernelWorker } from '@bendyline/molen-kernel';
import { scene } from './scene';

startKernelWorker({ scene: scene() });
