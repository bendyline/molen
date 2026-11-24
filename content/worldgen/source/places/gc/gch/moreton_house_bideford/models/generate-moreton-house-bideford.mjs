import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './moreton-house-bideford-model.mjs';

await generateMotatBuilding(model, import.meta.url);
