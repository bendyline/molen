import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './aeg-turbine-factory-model.mjs';

await generateMotatBuilding(model, import.meta.url);
