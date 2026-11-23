import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './hikone-castle-model.mjs';

await generateMotatBuilding(model, import.meta.url);
