import { describe, expect, it } from 'vitest';
import { hashEvidenceText } from '../../worldgen/scripts/evidence-text-hash.mjs';
import { hashBytes } from '../../worldgen/scripts/structure-model-files.mjs';
import { reviewedProposalPlacement } from '../scripts/reviewed-proposal-placement.mjs';

const placement = {
  id: 'plan.tower',
  status: 'proposal',
  asset: 'plan.tower',
  anchor: [10, 10],
  bounds: [9.99, 9.99, 10.01, 10.01],
  orientation: 'fixed',
  heading: 0.2,
};
const placementHash = hashBytes(JSON.stringify(placement));
const inputHash = hashBytes('design source');
const mapBytes = JSON.stringify({ anchor: placement.anchor, heading: placement.heading });
const sidecar = {
  hash: hashBytes('runtime master'),
  runtimeLods: {
    levels: ['skyline', 'district', 'street', 'closeup'].map((name) => ({
      name,
      hash: hashBytes(name),
    })),
  },
};
const image = Buffer.from('review frame');
const validReport = {
  format: 'molen/structure-proposal-review@1',
  inputHash,
  assetId: placement.asset,
  runtimeHash: sidecar.hash,
  placementHash,
  selectedProposal: placement.id,
  siteFrameHash: hashEvidenceText(mapBytes),
  defaultView: { proposalRequests: 0 },
  dateOnlyView: { proposalRequests: 0 },
  failedLoad: { fallbackRetained: true },
  levels: sidecar.runtimeLods.levels.map(({ name, hash }) => ({
    level: name,
    modelHash: hash,
    visibleDraws: 3,
    liveGeometriesAfterUnload: 0,
    groundRestored: true,
    surroundingsRetained: true,
    signedControlErrorsMeters: [0.001, 0.002, 0.003],
    inspectedFrames: [{ path: `shots/proposal/${name}.png`, hash: hashBytes(image) }],
  })),
};
const check = (report, readImage = async () => image) => {
  const reportBytes = JSON.stringify(report);
  return reviewedProposalPlacement({
    placement,
    placementHash,
    inputHash,
    sidecar,
    qa: { geographicReview: { proposalReportHash: hashEvidenceText(reportBytes) } },
    reportBytes,
    mapBytes,
    readImage,
  });
};

describe('reviewed proposal placements', () => {
  it('requires current site and model evidence in all four levels', async () => {
    expect(await check(validReport)).toBe(true);
    expect(await check({ ...validReport, selectedProposal: 'unrelated' })).toBe(false);
    expect(await check({ ...validReport, siteFrameHash: hashBytes('old map') })).toBe(false);
    expect(await check({ ...validReport, levels: validReport.levels.slice(1) })).toBe(false);
    expect(await check(validReport, async () => Buffer.from('changed image'))).toBe(false);
  });

  it('rejects default model requests and missing fallback on load failure', async () => {
    expect(await check({ ...validReport, defaultView: { proposalRequests: 1 } })).toBe(false);
    expect(await check({ ...validReport, dateOnlyView: { proposalRequests: 1 } })).toBe(false);
    expect(await check({ ...validReport, failedLoad: { fallbackRetained: false } })).toBe(false);
  });
});
