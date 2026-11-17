import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './montreal-museum-pavilion-for-peace-model.mjs';

await generateMotatBuilding(model, import.meta.url);
