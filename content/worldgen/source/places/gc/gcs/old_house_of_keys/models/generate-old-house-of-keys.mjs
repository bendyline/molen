import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './old-house-of-keys-model.mjs';

await generateMotatBuilding(model, import.meta.url);
