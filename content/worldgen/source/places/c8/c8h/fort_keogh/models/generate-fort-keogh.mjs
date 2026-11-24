import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './fort-keogh-model.mjs';

await generateMotatBuilding(model, import.meta.url);
