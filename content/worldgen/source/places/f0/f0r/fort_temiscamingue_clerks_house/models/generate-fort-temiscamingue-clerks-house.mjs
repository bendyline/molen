import { generateFortTemiscamingueOutbuilding } from '../../../../../../../../packages/worldgen/scripts/generate-fort-temiscamingue-outbuilding.mjs';
import { model } from './fort-temiscamingue-clerks-house-model.mjs';

await generateFortTemiscamingueOutbuilding(model, import.meta.url);
