import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './lundsberg-school-main-building-model.mjs';

await generateMotatBuilding(model, import.meta.url);
