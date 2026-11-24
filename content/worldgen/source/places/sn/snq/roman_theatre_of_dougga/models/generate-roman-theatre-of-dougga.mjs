import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './roman-theatre-of-dougga-model.mjs';

await generateMotatBuilding(model, import.meta.url);
