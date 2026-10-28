/** 'birch_bridge_yasnaya_polyana': source-local deterministic generator. */
import { signatureTowers } from '../../../../../../../../packages/worldgen/scripts/signature-tower-models.mjs';
import { birchBridgeStudy } from './birch-bridge-yasnaya-polyana-model.mjs';

signatureTowers.push(birchBridgeStudy);
if (!process.argv.some((a) => a.startsWith('--ids=')))
  process.argv.push('--ids=birch_bridge_yasnaya_polyana');
await import('../../../../../../../../packages/worldgen/scripts/generate-signature-towers.mjs');
