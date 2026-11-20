import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './gibraltar-point-lighthouse-model.mjs';

await generateMotatBuilding(model, import.meta.url);
