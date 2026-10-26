/** 'palazzo_nuovo_capitoline': source-local deterministic generator. */
import { signatureTowers } from '../../../../../../../../packages/worldgen/scripts/signature-tower-models.mjs';
import { nuovoStudy } from './palazzo-nuovo-capitoline-model.mjs';

signatureTowers.push(nuovoStudy);
if (!process.argv.some((a) => a.startsWith('--ids=')))
  process.argv.push('--ids=palazzo_nuovo_capitoline');
await import('../../../../../../../../packages/worldgen/scripts/generate-signature-towers.mjs');
