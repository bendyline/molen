import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './his-majesty-s-theatre-london-model.mjs';

await generateMotatBuilding(model, import.meta.url);
