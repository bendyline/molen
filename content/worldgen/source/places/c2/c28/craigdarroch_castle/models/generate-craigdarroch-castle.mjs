import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './craigdarroch-castle-model.mjs';

await generateMotatBuilding(model, import.meta.url);
