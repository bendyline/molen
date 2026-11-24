import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './cascade-brewery-model.mjs';

await generateMotatBuilding(model, import.meta.url);
