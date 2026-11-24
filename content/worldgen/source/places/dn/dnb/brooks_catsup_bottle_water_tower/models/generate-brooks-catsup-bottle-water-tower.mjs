import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './brooks-catsup-bottle-water-tower-model.mjs';

await generateMotatBuilding(model, import.meta.url);
