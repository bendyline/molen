/** 'garden_house_yasnaya_polyana': source-local deterministic generator. */
import { signatureTowers } from '../../../../../../../../packages/worldgen/scripts/signature-tower-models.mjs';
import { gardenHouseStudy } from './garden-house-yasnaya-polyana-model.mjs';

signatureTowers.push(gardenHouseStudy);
if (!process.argv.some((a) => a.startsWith('--ids=')))
  process.argv.push('--ids=garden_house_yasnaya_polyana');
await import('../../../../../../../../packages/worldgen/scripts/generate-signature-towers.mjs');
