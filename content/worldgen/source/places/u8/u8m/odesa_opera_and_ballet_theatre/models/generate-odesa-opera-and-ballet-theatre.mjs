import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './odesa-opera-and-ballet-theatre-model.mjs';

await generateMotatBuilding(model, import.meta.url);
