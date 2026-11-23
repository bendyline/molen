import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './historic-mill-of-sanssouci-model.mjs';
await generateMotatBuilding(model, import.meta.url);
