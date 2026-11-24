import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './pazaislis-monastery-model.mjs';

await generateMotatBuilding(model, import.meta.url);
