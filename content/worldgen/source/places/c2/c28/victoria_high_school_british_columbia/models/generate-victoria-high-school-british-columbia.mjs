import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './victoria-high-school-british-columbia-model.mjs';

await generateMotatBuilding(model, import.meta.url);
