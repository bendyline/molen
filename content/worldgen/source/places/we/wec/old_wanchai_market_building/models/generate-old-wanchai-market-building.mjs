import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './old-wanchai-market-building-model.mjs';

await generateMotatBuilding(model, import.meta.url);
