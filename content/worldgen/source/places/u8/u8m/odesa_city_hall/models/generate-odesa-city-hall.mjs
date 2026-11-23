import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './odesa-city-hall-model.mjs';

await generateMotatBuilding(model, import.meta.url);
