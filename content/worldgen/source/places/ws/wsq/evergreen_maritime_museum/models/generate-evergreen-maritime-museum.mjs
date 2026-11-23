import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './evergreen-maritime-museum-model.mjs';
await generateMotatBuilding(model, import.meta.url);
