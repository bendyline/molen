import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './royal-museum-of-fine-arts-antwerp-model.mjs';

await generateMotatBuilding(model, import.meta.url);
