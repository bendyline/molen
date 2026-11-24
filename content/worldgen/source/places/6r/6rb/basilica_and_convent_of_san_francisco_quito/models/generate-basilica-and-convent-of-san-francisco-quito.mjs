import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './basilica-and-convent-of-san-francisco-quito-model.mjs';

await generateMotatBuilding(model, import.meta.url);
