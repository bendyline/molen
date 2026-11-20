import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './state-library-of-queensland-model.mjs';

await generateMotatBuilding(model, import.meta.url);
