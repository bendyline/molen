import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './saynatsalo-town-hall-model.mjs';
await generateMotatBuilding(model, import.meta.url);
