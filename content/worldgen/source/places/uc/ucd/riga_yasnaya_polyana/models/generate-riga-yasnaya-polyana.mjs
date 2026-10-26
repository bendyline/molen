/** 'riga_yasnaya_polyana': source-local deterministic generator. */
import { signatureTowers } from '../../../../../../../../packages/worldgen/scripts/signature-tower-models.mjs';
import { rigaStudy } from './riga-yasnaya-polyana-model.mjs';

signatureTowers.push(rigaStudy);
if (!process.argv.some((a) => a.startsWith('--ids=')))
  process.argv.push('--ids=riga_yasnaya_polyana');
await import('../../../../../../../../packages/worldgen/scripts/generate-signature-towers.mjs');
