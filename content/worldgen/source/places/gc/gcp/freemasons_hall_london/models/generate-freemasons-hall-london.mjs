import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './freemasons-hall-london-model.mjs';
await generateMotatBuilding(model, import.meta.url);
