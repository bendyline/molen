import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './st-nicholas-cathedral-da-lat-model.mjs';
await generateMotatBuilding(model, import.meta.url);
