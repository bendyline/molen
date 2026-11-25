import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './phu-cam-cathedral-model.mjs';

await generateMotatBuilding(model, import.meta.url);
