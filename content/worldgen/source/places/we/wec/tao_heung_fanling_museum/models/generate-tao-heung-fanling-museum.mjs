import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './tao-heung-fanling-museum-model.mjs';

await generateMotatBuilding(model, import.meta.url);
