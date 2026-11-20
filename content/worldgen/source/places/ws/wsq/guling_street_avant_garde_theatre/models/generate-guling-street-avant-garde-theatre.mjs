import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './guling-street-avant-garde-theatre-model.mjs';

await generateMotatBuilding(model, import.meta.url);
