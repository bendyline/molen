import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './kgb-prison-potsdam-model.mjs';

await generateMotatBuilding(model, import.meta.url);
