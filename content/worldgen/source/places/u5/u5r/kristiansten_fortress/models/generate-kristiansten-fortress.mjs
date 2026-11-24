import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './kristiansten-fortress-model.mjs';

await generateMotatBuilding(model, import.meta.url);
