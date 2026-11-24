import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './tang-ancestral-hall-ha-tsuen-model.mjs';

await generateMotatBuilding(model, import.meta.url);
