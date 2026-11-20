import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './birdsville-courthouse-model.mjs';

await generateMotatBuilding(model, import.meta.url);
