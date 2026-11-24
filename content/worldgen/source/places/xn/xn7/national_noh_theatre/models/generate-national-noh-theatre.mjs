import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './national-noh-theatre-model.mjs';

await generateMotatBuilding(model, import.meta.url);
