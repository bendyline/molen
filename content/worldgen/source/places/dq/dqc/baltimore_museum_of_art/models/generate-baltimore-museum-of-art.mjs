import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './baltimore-museum-of-art-model.mjs';

await generateMotatBuilding(model, import.meta.url);
