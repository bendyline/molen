import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './old-synagogue-essen-model.mjs';

await generateMotatBuilding(model, import.meta.url);
