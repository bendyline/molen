import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './australian-inland-mission-hospital-birdsville-model.mjs';

await generateMotatBuilding(model, import.meta.url);
