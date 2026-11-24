import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './saint-sophia-cathedral-vologda-model.mjs';

await generateMotatBuilding(model, import.meta.url);
