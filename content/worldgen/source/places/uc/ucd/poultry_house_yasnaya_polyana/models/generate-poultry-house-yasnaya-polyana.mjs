/** 'poultry_house_yasnaya_polyana': source-local deterministic generator. */
import { signatureTowers } from '../../../../../../../../packages/worldgen/scripts/signature-tower-models.mjs';
import { poultryStudy } from './poultry-house-yasnaya-polyana-model.mjs';

signatureTowers.push(poultryStudy);
if (!process.argv.some((a) => a.startsWith('--ids=')))
  process.argv.push('--ids=poultry_house_yasnaya_polyana');
await import('../../../../../../../../packages/worldgen/scripts/generate-signature-towers.mjs');
