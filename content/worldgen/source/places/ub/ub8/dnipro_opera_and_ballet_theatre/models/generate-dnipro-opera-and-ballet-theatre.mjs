import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './dnipro-opera-and-ballet-theatre-model.mjs';

await generateMotatBuilding(model, import.meta.url);
