import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { reviewedSourceMapFrame } from '../scripts/reviewed-source-map-frame.mjs';

const frame = {
  source: 'OpenStreetMap / ODbL; architect site plan',
  sourceUrl: 'https://www.openstreetmap.org/way/123',
  axis: '+X east, +Z south; facade phase independently reviewed',
  identityStatus: 'Name and unique component geometry reviewed',
  anchor: [113.3, 23.14],
  heading: 0.17,
  geometry: {
    outline: [
      [-1, -1],
      [-1, 1],
      [1, 1],
      [1, -1],
      [-1, -1],
    ],
  },
};
const fixture = (evidence = frame) => {
  const frameBytes = Buffer.from(JSON.stringify(evidence));
  return {
    frameBytes,
    sourceManifest: { files: { documents: ['map-frame.json'] } },
    spec: {
      geographicProposal: {
        mapGeometrySource: 'map-frame.json',
        mapGeometryHash: `sha256:${createHash('sha256').update(frameBytes).digest('hex')}`,
      },
    },
    placement: { anchor: frame.anchor, heading: frame.heading },
    geographicReviewed: true,
  };
};
describe('reviewed source-local geographic frame', () => {
  it('accepts durable attributed evidence bound to the reviewed placement', () => {
    expect(reviewedSourceMapFrame(fixture())).toEqual(frame);
    const data = fixture();
    data.placement.heading += 2 * Math.PI;
    expect(reviewedSourceMapFrame(data)).toEqual(frame);
  });
  it('does not substitute unreviewed, stale, or missing evidence', () => {
    expect(reviewedSourceMapFrame({ ...fixture(), geographicReviewed: false })).toBeUndefined();
    expect(
      reviewedSourceMapFrame({
        ...fixture(),
        frameBytes: Buffer.from(JSON.stringify({ ...frame, heading: 0.2 })),
      }),
    ).toBeUndefined();
    expect(
      reviewedSourceMapFrame({ ...fixture(), sourceManifest: { files: { documents: [] } } }),
    ).toBeUndefined();
    expect(reviewedSourceMapFrame({ ...fixture(), frameBytes: undefined })).toBeUndefined();
  });
  it('retains a reviewed frame when checkout changes only line endings', () => {
    const data = fixture();
    const lf = JSON.stringify(frame, null, 2);
    data.spec.geographicProposal.mapGeometryHash = `sha256:${createHash('sha256').update(lf).digest('hex')}`;
    data.frameBytes = Buffer.from(lf.replaceAll('\n', '\r\n'));
    expect(reviewedSourceMapFrame(data)).toEqual(frame);
    data.frameBytes = Buffer.from(data.frameBytes.toString().replace('0.17', '0.18'));
    expect(reviewedSourceMapFrame(data)).toBeUndefined();
  });
  it('accepts the earlier signed ensemble basis field without accepting generic provenance prose', () => {
    const prior = {
      ...frame,
      axis: undefined,
      basis: 'Canonical native +X east and +Z south; each component keeps its own phase.',
    };
    expect(reviewedSourceMapFrame(fixture(prior))).toEqual(prior);
    for (const basis of ['Mapped outline evidence', '+X east only', '+Z south only'])
      expect(reviewedSourceMapFrame(fixture({ ...prior, basis }))).toBeUndefined();
    expect(reviewedSourceMapFrame(fixture({ ...prior, axis: '' }))).toBeUndefined();
  });
  it('preserves unresolved orientation when attribution, signed axes, or geographic fit are missing', () => {
    for (const patch of [
      { source: '' },
      { sourceUrl: '' },
      { axis: '' },
      { identityStatus: '' },
      { heading: NaN },
      { geometry: { outline: [] } },
    ])
      expect(reviewedSourceMapFrame(fixture({ ...frame, ...patch }))).toBeUndefined();
    for (const placement of [
      { anchor: [113.31, 23.14], heading: 0.17 },
      { anchor: frame.anchor, heading: 0.17 + Math.PI },
    ])
      expect(reviewedSourceMapFrame({ ...fixture(), placement })).toBeUndefined();
  });
});
