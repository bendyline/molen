import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './huntington-museum-of-art-model.mjs';
await generateMotatBuilding(model, import.meta.url);
