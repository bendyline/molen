/// <reference lib="webworker" />
import { startKernelWorker } from '@bendyline/molen-kernel';
import { arenaProject } from './arena';

// The kernel Worker: kinematics from `physics`, the declared `move` command, and the scene's
// scripts all install from data; startKernelWorker builds the world and hosts it on this port.
startKernelWorker({ ...arenaProject() });
