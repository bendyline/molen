import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './lapham-patterson-house-model.mjs';

await generateMotatBuilding(model, import.meta.url);
