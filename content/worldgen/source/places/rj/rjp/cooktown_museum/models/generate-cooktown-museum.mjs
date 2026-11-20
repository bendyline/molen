import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './cooktown-museum-model.mjs';

await generateMotatBuilding(model, import.meta.url);
