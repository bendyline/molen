import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './old-church-of-our-lady-mary-of-zion-model.mjs';

await generateMotatBuilding(model, import.meta.url);
