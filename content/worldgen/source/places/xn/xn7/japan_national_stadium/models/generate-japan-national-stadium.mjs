import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './japan-national-stadium-model.mjs';

await generateMotatBuilding(model, import.meta.url);
