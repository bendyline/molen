import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './williams-brice-stadium-model.mjs';

await generateMotatBuilding(model, import.meta.url);
