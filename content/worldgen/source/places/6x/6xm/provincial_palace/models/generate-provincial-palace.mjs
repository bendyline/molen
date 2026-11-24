import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './provincial-palace-model.mjs';

await generateMotatBuilding(model, import.meta.url);
