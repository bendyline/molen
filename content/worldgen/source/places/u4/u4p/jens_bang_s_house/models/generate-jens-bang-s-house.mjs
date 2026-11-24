import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './jens-bang-s-house-model.mjs';

await generateMotatBuilding(model, import.meta.url);
