import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './iwatsuki-castle-model.mjs';

await generateMotatBuilding(model, import.meta.url);
