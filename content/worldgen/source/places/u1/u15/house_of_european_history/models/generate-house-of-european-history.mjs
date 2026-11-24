import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './house-of-european-history-model.mjs';

await generateMotatBuilding(model, import.meta.url);
