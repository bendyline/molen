import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './chateau-d-amboise-model.mjs';

await generateMotatBuilding(model, import.meta.url);
