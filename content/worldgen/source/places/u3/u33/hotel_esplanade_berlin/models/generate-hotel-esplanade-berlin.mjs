import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './hotel-esplanade-berlin-model.mjs';

await generateMotatBuilding(model, import.meta.url);
