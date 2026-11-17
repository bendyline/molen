import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './broken-hill-hospital-model.mjs';

await generateMotatBuilding(model, import.meta.url);
