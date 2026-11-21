import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './san-francisco-transbay-terminal-model.mjs';

await generateMotatBuilding(model, import.meta.url);
