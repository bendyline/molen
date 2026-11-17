import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './sidi-yahya-mosque-model.mjs';

await generateMotatBuilding(model, import.meta.url);
