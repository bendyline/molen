import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './motat-aviation-hall-auckland-model.mjs';

await generateMotatBuilding(model, import.meta.url);
