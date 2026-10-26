/** 'volkonsky_house_yasnaya_polyana': source-local deterministic generator. */
import { signatureTowers } from '../../../../../../../../packages/worldgen/scripts/signature-tower-models.mjs';
import { volkonskyStudy } from './volkonsky-house-yasnaya-polyana-model.mjs';

signatureTowers.push(volkonskyStudy);
if (!process.argv.some((a) => a.startsWith('--ids=')))
  process.argv.push('--ids=volkonsky_house_yasnaya_polyana');
await import('../../../../../../../../packages/worldgen/scripts/generate-signature-towers.mjs');
