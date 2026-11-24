import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './bishop-museum-main-building-model.mjs';

await generateMotatBuilding(model, import.meta.url);
