import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './roman-theater-zaragoza-model.mjs';

await generateMotatBuilding(model, import.meta.url);
