import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './snake-temple-model.mjs';

await generateMotatBuilding(model, import.meta.url);
