import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './church-of-the-acheiropoietos-model.mjs';
await generateMotatBuilding(model, import.meta.url);
