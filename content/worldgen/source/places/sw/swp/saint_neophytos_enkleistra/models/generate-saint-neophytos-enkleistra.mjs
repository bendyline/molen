import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './saint-neophytos-enkleistra-model.mjs';

await generateMotatBuilding(model, import.meta.url);
