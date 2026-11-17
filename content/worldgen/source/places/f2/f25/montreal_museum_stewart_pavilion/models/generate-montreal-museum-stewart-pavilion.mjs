import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './montreal-museum-stewart-pavilion-model.mjs';

await generateMotatBuilding(model, import.meta.url);
