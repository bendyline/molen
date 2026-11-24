import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './hofilena-ancestral-house-model.mjs';

await generateMotatBuilding(model, import.meta.url);
