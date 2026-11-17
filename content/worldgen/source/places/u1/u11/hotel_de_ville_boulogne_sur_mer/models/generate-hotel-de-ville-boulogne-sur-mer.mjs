import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './hotel-de-ville-boulogne-sur-mer-model.mjs';

await generateMotatBuilding(model, import.meta.url);
