import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './monastery-of-the-holy-trinity-vilnius-model.mjs';

await generateMotatBuilding(model, import.meta.url);
