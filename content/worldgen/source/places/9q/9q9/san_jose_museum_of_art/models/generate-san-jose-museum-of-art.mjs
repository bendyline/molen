import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './san-jose-museum-of-art-model.mjs';

await generateMotatBuilding(model, import.meta.url);
