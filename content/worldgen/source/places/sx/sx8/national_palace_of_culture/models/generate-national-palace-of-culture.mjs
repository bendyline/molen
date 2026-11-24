import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './national-palace-of-culture-model.mjs';

await generateMotatBuilding(model, import.meta.url);
