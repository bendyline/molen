/**
 * @bendyline/molen-ambient/client — rendering for ambient NPCs: instanced vehicle proxies with
 * pooled full models near the camera, procedural pedestrians and aircraft for main-thread worlds
 * (`createAmbientRenderer`), and the `ambient-vehicle` renderable kind for Worker hosts.
 */

import { registerAmbientSchema } from './kernel/schema';

export type { AmbientAircraftModels } from './client/aircraft';
export { ProxyBatches, type ProxyInstance } from './client/batches';
export type { AmbientVehicleModels, DetailCandidate } from './client/detail';
export type { FigureBudget, WalkerView } from './client/figures';
export { AmbientFigures } from './client/figures';
export type { AmbientVehicleKindOptions } from './client/kind';
export { ambientVehicleKind } from './client/kind';
export type { ProxyDimensions, ProxyShape } from './client/proxies';
export { proxyGeometry, proxyHeight, proxyShapeFor } from './client/proxies';
export type {
  AmbientRenderBudget,
  AmbientRenderer,
  AmbientRendererOptions,
  AmbientRenderStats,
} from './client/renderer';
export { createAmbientRenderer } from './client/renderer';

// A page validates scenes before it mounts: importing the client half alone registers the
// ambient components and format.
registerAmbientSchema();
