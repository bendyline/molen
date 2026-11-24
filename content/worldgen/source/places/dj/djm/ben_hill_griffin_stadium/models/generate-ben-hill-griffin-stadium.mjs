import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './ben-hill-griffin-stadium-model.mjs';

await generateMotatBuilding(model, import.meta.url);
