import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './burns-philp-building-normanton-model.mjs';

await generateMotatBuilding(model, import.meta.url);
