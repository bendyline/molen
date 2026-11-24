import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './kazan-cathedral-saint-petersburg-model.mjs';

await generateMotatBuilding(model, import.meta.url);
