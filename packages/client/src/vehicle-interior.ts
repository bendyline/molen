import type { VehicleInteriorSpec } from '@bendyline/molen-schema';
import type { Object3D } from 'three';
import {
  createModelSignalVisual,
  type ModelSignals,
  type ModelSignalVisual,
} from './model-signals';

export type VehicleInteriorSignals = ModelSignals;
export type VehicleInteriorVisual = ModelSignalVisual;

/** Vehicle convenience wrapper around the platform's model-signal binding system. */
export function createVehicleInteriorVisual(
  model: Object3D,
  spec: VehicleInteriorSpec,
): VehicleInteriorVisual {
  const visual = createModelSignalVisual(model, spec);
  return {
    ...visual,
    missingNodes: [
      ...new Set([
        ...spec.nodes.filter((name) => !model.getObjectByName(name)),
        ...visual.missingNodes,
      ]),
    ],
  };
}
