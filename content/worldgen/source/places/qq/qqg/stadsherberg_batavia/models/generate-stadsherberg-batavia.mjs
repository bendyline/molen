import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './stadsherberg-batavia-model.mjs';

await generateMotatBuilding(model, import.meta.url);
