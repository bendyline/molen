import { generateMotatBuilding } from '../../../../../../../../packages/worldgen/scripts/generate-motat-building.mjs';
import { model } from './tai-tam-tuk-raw-water-pumping-station-senior-staff-quarters-model.mjs';

await generateMotatBuilding(model, import.meta.url);
