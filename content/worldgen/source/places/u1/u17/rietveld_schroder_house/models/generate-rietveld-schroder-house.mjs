import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './rietveld-schroder-house-model.mjs';

await generateMotatBuilding(model, import.meta.url);
