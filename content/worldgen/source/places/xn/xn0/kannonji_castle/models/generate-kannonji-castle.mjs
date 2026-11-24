import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './kannonji-castle-model.mjs';

await generateMotatBuilding(model, import.meta.url);
