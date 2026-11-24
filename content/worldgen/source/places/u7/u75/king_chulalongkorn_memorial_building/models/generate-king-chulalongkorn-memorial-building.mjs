import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './king-chulalongkorn-memorial-building-model.mjs';

await generateMotatBuilding(model, import.meta.url);
