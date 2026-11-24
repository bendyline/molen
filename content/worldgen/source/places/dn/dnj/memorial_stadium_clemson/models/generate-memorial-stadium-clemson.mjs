import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './memorial-stadium-clemson-model.mjs';

await generateMotatBuilding(model, import.meta.url);
