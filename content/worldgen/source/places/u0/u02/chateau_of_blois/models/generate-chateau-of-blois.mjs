import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './chateau-of-blois-model.mjs';

await generateMotatBuilding(model, import.meta.url);
