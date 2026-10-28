/** 'greenhouse_yasnaya_polyana': source-local deterministic generator. */
import { signatureTowers } from '../../../../../../../../packages/worldgen/scripts/signature-tower-models.mjs';
import { greenhouseStudy } from './greenhouse-yasnaya-polyana-model.mjs';

signatureTowers.push(greenhouseStudy);
if (!process.argv.some((a) => a.startsWith('--ids=')))
  process.argv.push('--ids=greenhouse_yasnaya_polyana');
await import('../../../../../../../../packages/worldgen/scripts/generate-signature-towers.mjs');
