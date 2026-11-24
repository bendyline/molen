import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './halfweg-sugar-factory-model.mjs';

await generateMotatBuilding(model, import.meta.url);
