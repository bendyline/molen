import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './hans-christian-andersen-birthplace-model.mjs';

await generateMotatBuilding(model, import.meta.url);
