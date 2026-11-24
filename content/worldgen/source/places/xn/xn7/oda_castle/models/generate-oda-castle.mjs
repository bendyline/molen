import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './oda-castle-model.mjs';

await generateMotatBuilding(model, import.meta.url);
