import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './abbey-of-our-lady-of-atlas-model.mjs';

await generateMotatBuilding(model, import.meta.url);
