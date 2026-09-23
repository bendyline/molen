import { registerArchStyleSchema } from './archstyle-schema';
import { registerWorldgenBatchSchema } from './batch-schema';
import { registerInteriorSchema } from './interior-catalog';
import { registerLandmarkSchemas } from './landmark-schema';
import { registerScatterSchema } from './scatter-schema';
import { registerStylePackSchema } from './stylepack-schema';

/** Register every worldgen format into the shared registry (idempotent). */
export function registerWorldgenSchemas(): void {
  registerLandmarkSchemas();
  registerInteriorSchema();
  registerArchStyleSchema();
  registerScatterSchema();
  registerStylePackSchema();
  registerWorldgenBatchSchema();
}
