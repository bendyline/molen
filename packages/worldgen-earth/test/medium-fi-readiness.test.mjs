import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { hashEvidenceText } from '../../worldgen/scripts/evidence-text-hash.mjs';
import { reviewedMediumFi } from '../scripts/medium-fi-readiness.mjs';

const image = Buffer.from('fixture pixels');
const imageHash = `sha256:${createHash('sha256').update(image).digest('hex')}`;
function fixture(edit = () => {}) {
  const levels = ['skyline', 'district', 'street', 'closeup'].map((name) => ({
    name,
    hash: name,
    triangles: 500,
    drawCalls: 4,
  }));
  const frames = [];
  for (const distance of ['street', 'block', 'skyline'])
    for (const time of ['noon', 'late'])
      for (const mode of ['economy', 'high'])
        frames.push({
          path: `medium-fi/${distance}-${time}-${mode}.png`,
          hash: imageHash,
          state: { distance, time, mode },
        });
  for (const name of ['silhouette', ...levels.map((l) => `transition-${l.name}`)])
    frames.push({ path: `medium-fi/${name}.png`, hash: imageHash });
  const report = {
    assetId: 'model',
    sourceHash: 'source',
    runtimeHash: 'runtime',
    rig: { toneMapping: 'neutral', exposure: 1 },
    errors: [],
    runtimeLods: levels,
    frames,
  };
  edit(report);
  const reportBytes = Buffer.from(JSON.stringify(report));
  return {
    qa: {
      sourceHash: 'source',
      mediumFiReview: {
        status: 'passed',
        captureReportHash: hashEvidenceText(reportBytes),
        inspectedFrames: report.frames.map((f) => f.path),
      },
    },
    reportBytes,
    sidecar: { id: 'model', hash: 'runtime', runtimeLods: { levels } },
    readImage: async () => image,
  };
}
it('accepts inspected, current medium-fi evidence', async () => {
  expect(await reviewedMediumFi(fixture())).toBe(true);
});
it('rejects stale shipped LODs and changed image bytes', async () => {
  const input = fixture();
  input.sidecar.runtimeLods.levels = structuredClone(input.sidecar.runtimeLods.levels);
  input.sidecar.runtimeLods.levels[1].hash = 'changed';
  expect(await reviewedMediumFi(input)).toBe(false);
  expect(
    await reviewedMediumFi({ ...fixture(), readImage: async () => Buffer.from('changed pixels') }),
  ).toBe(false);
});
it('rejects missing mode coverage, over-budget levels and wrong tone mapping', async () => {
  for (const edit of [
    (r) => r.frames.shift(),
    (r) => {
      r.runtimeLods[0].triangles = 1001;
    },
    (r) => {
      r.rig.toneMapping = 'aces';
    },
  ])
    expect(await reviewedMediumFi(fixture(edit))).toBe(false);
});
it('rejects unreviewed reports and traversal paths', async () => {
  const input = fixture();
  input.qa.mediumFiReview.status = 'pending';
  expect(await reviewedMediumFi(input)).toBe(false);
  expect(
    await reviewedMediumFi(
      fixture((r) => r.frames.push({ path: '../outside.png', hash: imageHash })),
    ),
  ).toBe(false);
});
