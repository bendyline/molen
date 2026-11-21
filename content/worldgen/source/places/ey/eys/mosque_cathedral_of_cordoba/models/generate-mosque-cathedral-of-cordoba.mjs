import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './mosque-cathedral-of-cordoba-model.mjs';

await generateMotatBuilding(model, import.meta.url);
