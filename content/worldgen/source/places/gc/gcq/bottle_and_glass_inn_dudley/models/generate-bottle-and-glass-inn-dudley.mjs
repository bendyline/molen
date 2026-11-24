import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './bottle-and-glass-inn-dudley-model.mjs';

await generateMotatBuilding(model, import.meta.url);
