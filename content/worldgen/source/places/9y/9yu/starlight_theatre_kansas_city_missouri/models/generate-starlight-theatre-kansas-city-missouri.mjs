import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './starlight-theatre-kansas-city-missouri-model.mjs';

await generateMotatBuilding(model, import.meta.url);
