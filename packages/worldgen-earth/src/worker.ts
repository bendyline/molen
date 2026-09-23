/**
 * Worker entry: `installWorldgenWorker(self)` binds the protocol handler to a Worker scope. A
 * bundler-friendly host wraps it in its own worker file:
 *
 *   // worldgen-worker.ts
 *   import { installWorldgenWorker } from '@bendyline/molen-worldgen-earth/worker';
 *   installWorldgenWorker(self);
 *
 * and talks to it through `createWorldgenWorkerBridge` from the client half. No three.js here.
 */

import '@bendyline/molen-worldgen/kernel';
import {
  createWorldgenWorkerHandler,
  type WorldgenWorkerHandler,
  type WorldgenWorkerRequest,
} from './kernel/worker-protocol';
import './kernel';

export type {
  WorldgenWorkerCancel,
  WorldgenWorkerConfigure,
  WorldgenWorkerGenerate,
  WorldgenWorkerHandler,
  WorldgenWorkerPort,
  WorldgenWorkerRequest,
  WorldgenWorkerResult,
} from './kernel/worker-protocol';
export { createWorldgenWorkerHandler } from './kernel/worker-protocol';

export interface WorkerScopeLike {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
}

/** Bind the generation protocol to a worker scope (or any message port). */
export function installWorldgenWorker(scope: WorkerScopeLike): WorldgenWorkerHandler {
  const handler = createWorldgenWorkerHandler(scope);
  scope.addEventListener('message', (event) => {
    const message = event.data as WorldgenWorkerRequest | undefined;
    if (message === undefined || typeof message !== 'object' || !('kind' in message)) return;
    void handler.handle(message);
  });
  return handler;
}
