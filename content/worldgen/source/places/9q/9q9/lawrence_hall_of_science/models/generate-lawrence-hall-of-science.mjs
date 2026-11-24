import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './lawrence-hall-of-science-model.mjs';

await generateMotatBuilding(model, import.meta.url);
