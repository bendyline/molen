import { z } from 'zod';
import {
  type ModelSignalBinding,
  type ModelSignalSpec,
  modelSignalBindingsSchema,
  modelSignalSourcesSchema,
} from './model-signals';

export type VehicleInteriorBinding = ModelSignalBinding;

/** Cabin geometry in the main GLB, shared by every camera view. */
export interface VehicleInteriorSpec extends ModelSignalSpec {
  /** Informational: never hidden on boarding or in chase view. */
  nodes: string[];
}

export const vehicleInteriorSchema: z.ZodType<VehicleInteriorSpec> = z.strictObject({
  nodes: z
    .array(z.string().min(1))
    .min(1)
    .describe('Cabin nodes in the same exterior/interior GLB.'),
  sources: modelSignalSourcesSchema
    .optional()
    .describe('Optional component fields overriding or extending host telemetry.'),
  bindings: modelSignalBindingsSchema,
});
