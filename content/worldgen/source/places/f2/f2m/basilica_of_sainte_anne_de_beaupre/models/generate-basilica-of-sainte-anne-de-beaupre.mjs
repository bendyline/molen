import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './basilica-of-sainte-anne-de-beaupre-model.mjs';

await generateMotatBuilding(model, import.meta.url);
