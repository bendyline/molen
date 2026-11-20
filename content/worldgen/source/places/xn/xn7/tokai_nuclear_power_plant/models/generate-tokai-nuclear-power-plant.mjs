import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './tokai-nuclear-power-plant-model.mjs';

await generateMotatBuilding(model, import.meta.url);
