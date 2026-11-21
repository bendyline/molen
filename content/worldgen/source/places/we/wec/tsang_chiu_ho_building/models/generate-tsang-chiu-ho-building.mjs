import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './tsang-chiu-ho-building-model.mjs';

await generateMotatBuilding(model, import.meta.url);
