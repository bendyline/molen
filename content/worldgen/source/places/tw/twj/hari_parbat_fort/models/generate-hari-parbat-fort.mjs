import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './hari-parbat-fort-model.mjs';

await generateMotatBuilding(model, import.meta.url);
