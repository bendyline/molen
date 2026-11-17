import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './birch-memorial-clock-tower-model.mjs';

await generateMotatBuilding(model, import.meta.url);
