/** 'palazzo_dei_conservatori': source-local deterministic generator. */
import { signatureTowers } from '../../../../../../../../packages/worldgen/scripts/signature-tower-models.mjs';
import { conservatoriStudy } from './palazzo-dei-conservatori-model.mjs';

signatureTowers.push(conservatoriStudy);
if (!process.argv.some((a) => a.startsWith('--ids=')))
  process.argv.push('--ids=palazzo_dei_conservatori');
await import('../../../../../../../../packages/worldgen/scripts/generate-signature-towers.mjs');
