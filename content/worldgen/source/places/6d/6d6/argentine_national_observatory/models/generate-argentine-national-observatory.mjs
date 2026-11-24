import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './argentine-national-observatory-model.mjs';

await generateMotatBuilding(model, import.meta.url);
