import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './menara-kudus-mosque-model.mjs';

await generateMotatBuilding(model, import.meta.url);
