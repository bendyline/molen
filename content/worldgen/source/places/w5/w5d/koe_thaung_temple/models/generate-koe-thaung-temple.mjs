import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './koe-thaung-temple-model.mjs';

await generateMotatBuilding(model, import.meta.url);
