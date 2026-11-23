import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './palace-of-the-generalitat-valenciana-model.mjs';
await generateMotatBuilding(model, import.meta.url);
