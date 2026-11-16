import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './temple-of-athena-polias-priene-model.mjs';

await generateMotatBuilding(model, import.meta.url);
