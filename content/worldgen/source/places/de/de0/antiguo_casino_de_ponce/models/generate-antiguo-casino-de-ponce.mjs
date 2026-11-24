import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './antiguo-casino-de-ponce-model.mjs';

await generateMotatBuilding(model, import.meta.url);
