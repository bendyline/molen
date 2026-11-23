import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './ventspils-castle-model.mjs';

await generateMotatBuilding(model, import.meta.url);
