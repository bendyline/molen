import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './katsura-imperial-villa-model.mjs';

await generateMotatBuilding(model, import.meta.url);
