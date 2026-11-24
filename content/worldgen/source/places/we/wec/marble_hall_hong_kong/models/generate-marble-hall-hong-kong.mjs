import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './marble-hall-hong-kong-model.mjs';

await generateMotatBuilding(model, import.meta.url);
