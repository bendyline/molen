import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './sunda-kelapa-lighthouse-model.mjs';

await generateMotatBuilding(model, import.meta.url);
