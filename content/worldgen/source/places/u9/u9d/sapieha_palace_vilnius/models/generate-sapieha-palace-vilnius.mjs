import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './sapieha-palace-vilnius-model.mjs';

await generateMotatBuilding(model, import.meta.url);
