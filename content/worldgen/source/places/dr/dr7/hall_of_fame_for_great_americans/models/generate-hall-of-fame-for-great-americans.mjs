import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './hall-of-fame-for-great-americans-model.mjs';
await generateMotatBuilding(model, import.meta.url);
