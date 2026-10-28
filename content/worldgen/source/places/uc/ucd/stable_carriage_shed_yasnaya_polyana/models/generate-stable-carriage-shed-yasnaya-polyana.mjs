/** 'stable_carriage_shed_yasnaya_polyana': source-local deterministic generator. */
import { signatureTowers } from '../../../../../../../../packages/worldgen/scripts/signature-tower-models.mjs';
import { stableStudy } from './stable-carriage-shed-yasnaya-polyana-model.mjs';

signatureTowers.push(stableStudy);
if (!process.argv.some((a) => a.startsWith('--ids=')))
  process.argv.push('--ids=stable_carriage_shed_yasnaya_polyana');
await import('../../../../../../../../packages/worldgen/scripts/generate-signature-towers.mjs');
