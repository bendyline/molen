import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './broken-hill-trades-hall-model.mjs';

await generateMotatBuilding(model, import.meta.url);
