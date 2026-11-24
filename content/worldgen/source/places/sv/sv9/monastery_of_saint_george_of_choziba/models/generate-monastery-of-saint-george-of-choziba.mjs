import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './monastery-of-saint-george-of-choziba-model.mjs';

await generateMotatBuilding(model, import.meta.url);
