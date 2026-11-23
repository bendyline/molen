import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './de-zeeland-model.mjs';

await generateMotatBuilding(model, import.meta.url);
