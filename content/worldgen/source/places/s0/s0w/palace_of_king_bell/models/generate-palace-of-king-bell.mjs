import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './palace-of-king-bell-model.mjs';

await generateMotatBuilding(model, import.meta.url);
