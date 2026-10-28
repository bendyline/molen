/** 'leo_tolstoy_house_yasnaya_polyana': source-local deterministic generator. */
import { signatureTowers } from '../../../../../../../../packages/worldgen/scripts/signature-tower-models.mjs';
import { tolstoyStudy } from './leo-tolstoy-house-yasnaya-polyana-model.mjs';

signatureTowers.push(tolstoyStudy);
if (!process.argv.some((a) => a.startsWith('--ids=')))
  process.argv.push('--ids=leo_tolstoy_house_yasnaya_polyana');
await import('../../../../../../../../packages/worldgen/scripts/generate-signature-towers.mjs');
