import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './national-archaeological-museum-athens-model.mjs';

await generateMotatBuilding(model, import.meta.url);
