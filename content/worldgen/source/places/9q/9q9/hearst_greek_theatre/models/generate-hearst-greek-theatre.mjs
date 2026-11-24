import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './hearst-greek-theatre-model.mjs';

await generateMotatBuilding(model, import.meta.url);
