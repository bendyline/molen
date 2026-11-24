import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './ciyou-temple-model.mjs';

await generateMotatBuilding(model, import.meta.url);
