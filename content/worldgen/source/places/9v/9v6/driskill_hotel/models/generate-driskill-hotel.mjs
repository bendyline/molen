import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './driskill-hotel-model.mjs';

await generateMotatBuilding(model, import.meta.url);
