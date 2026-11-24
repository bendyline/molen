import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './padise-abbey-model.mjs';

await generateMotatBuilding(model, import.meta.url);
