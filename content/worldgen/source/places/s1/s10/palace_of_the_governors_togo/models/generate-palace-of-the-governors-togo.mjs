import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './palace-of-the-governors-togo-model.mjs';

await generateMotatBuilding(model, import.meta.url);
