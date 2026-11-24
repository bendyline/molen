import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './royal-theater-carre-model.mjs';

await generateMotatBuilding(model, import.meta.url);
