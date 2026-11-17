import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './shilin-official-residence-model.mjs';

await generateMotatBuilding(model, import.meta.url);
