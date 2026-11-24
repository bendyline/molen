import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './basilica-of-san-francisco-la-paz-model.mjs';

await generateMotatBuilding(model, import.meta.url);
