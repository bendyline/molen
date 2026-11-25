import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './n-seoul-tower-model.mjs';

await generateMotatBuilding(model, import.meta.url);
