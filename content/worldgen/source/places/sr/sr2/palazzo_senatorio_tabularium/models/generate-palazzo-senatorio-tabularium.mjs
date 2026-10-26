/** 'palazzo_senatorio_tabularium': source-local deterministic generator. */
import { signatureTowers } from '../../../../../../../../packages/worldgen/scripts/signature-tower-models.mjs';
import { senatorioStudy } from './palazzo-senatorio-tabularium-model.mjs';

signatureTowers.push(senatorioStudy);
if (!process.argv.some((a) => a.startsWith('--ids=')))
  process.argv.push('--ids=palazzo_senatorio_tabularium');
await import('../../../../../../../../packages/worldgen/scripts/generate-signature-towers.mjs');
