import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './sita-ramachandraswamy-temple-bhadrachalam-model.mjs';

await generateMotatBuilding(model, import.meta.url);
