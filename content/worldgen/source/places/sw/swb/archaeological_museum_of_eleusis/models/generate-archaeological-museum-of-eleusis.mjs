import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './archaeological-museum-of-eleusis-model.mjs';

await generateMotatBuilding(model, import.meta.url);
