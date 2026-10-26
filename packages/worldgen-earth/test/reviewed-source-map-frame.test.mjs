import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  nativePointSourcePath,
  reviewedSourceMapFrame,
} from '../scripts/reviewed-source-map-frame.mjs';

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
  it('binds a named monitoring structure without a Wikidata item to its exact native record', () => {
    const node = {
        type: 'node',
        id: 35925144,
        lon: frame.anchor[0],
        lat: frame.anchor[1],
        tags: { name: 'Named summit weather station', man_made: 'tower' },
      },
      file = 'native-map/station-point.json',
      make = (record = node, patch = {}) => {
        const nativeNodeBytes = Buffer.from(
            JSON.stringify({
              sourceUrl: 'https://api.openstreetmap.org/api/0.6/map.json?bbox=113,23,114,24',
              elements: [record],
            }),
          ),
          evidence = {
            ...frame,
            sourceUrl: 'https://www.openstreetmap.org/node/35925144',
            coordinateSpace: 'model-local-xz',
            geometry: { point: [0, 0] },
            mappedIdentity: {
              name: node.tags.name,
              featureIds: ['node/35925144'],
              nativeSource: {
                path: file,
                hash: `sha256:${createHash('sha256').update(nativeNodeBytes).digest('hex')}`,
              },
              primaryReview: {
                status: 'reviewed-named-structure',
                reviewedOn: '2026-10-25',
                basis:
                  'Named native structure matched to operator text and current cleared exterior references.',
                referencePages: ['https://example.org/operator'],
              },
            },
            orientationControl: {
              status: 'reviewed-approximation',
              reviewedOn: '2026-10-25',
              headingRadians: frame.heading,
              uncertaintyDegrees: 180,
              basis:
                'Original unsurveyed facing from cleared views; native point establishes no bearing.',
              referencePages: ['https://example.org/exterior'],
            },
            ...patch,
          },
          data = fixture(evidence);
        data.sourceManifest.files.documents.push(file);
        data.spec.geographicProposal.orientationPolicy = 'approximate-visualization';
        return { ...data, nativeNodeBytes };
      };
    const data = make();
    expect(reviewedSourceMapFrame(data)).toEqual(JSON.parse(data.frameBytes));
    expect(reviewedSourceMapFrame({ ...data, nativeNodeBytes: undefined })).toBeUndefined();
    expect(reviewedSourceMapFrame({ ...data, nativeNodeBytes: Buffer.from('{}') })).toBeUndefined();
    expect(reviewedSourceMapFrame({ ...data, geographicReviewed: false })).toBeUndefined();
    for (const record of [
      { ...node, id: 35925145 },
      { ...node, type: 'way' },
      { ...node, lon: node.lon + 0.001 },
      { ...node, tags: { ...node.tags, name: 'Different station' } },
      { ...node, tags: { ...node.tags, man_made: 'survey_point' } },
      { ...node, tags: { ...node.tags, wikidata: 'Q123' } },
    ])
      expect(reviewedSourceMapFrame(make(record))).toBeUndefined();
    const noRecord = make();
    noRecord.sourceManifest.files.documents = ['map-frame.json'];
    expect(reviewedSourceMapFrame(noRecord)).toBeUndefined();
    const wrongQ = make();
    wrongQ.spec.wikidataId = 'Q123';
    expect(reviewedSourceMapFrame(wrongQ)).toBeUndefined();
    const unreviewed = make(node, {
      mappedIdentity: {
        ...JSON.parse(data.frameBytes).mappedIdentity,
        primaryReview: { status: 'draft' },
      },
    });
    expect(reviewedSourceMapFrame(unreviewed)).toBeUndefined();
    for (const path of [
      '../station.json',
      '/private/station.json',
      'native-map/../../station.json',
      'C:\\station.json',
    ])
      expect(
        nativePointSourcePath(
          Buffer.from(JSON.stringify({ mappedIdentity: { nativeSource: { path } } })),
        ),
      ).toBeUndefined();
  });
  it('accepts two separately reviewed wings without an invented courtyard polygon', () => {
    const evidence = {
      ...frame,
      geometry: {
        polygons: [
          [
            [-20, 0],
            [-10, 0],
            [-10, 40],
            [-20, 40],
          ],
          [
            [10, -10],
            [20, -10],
            [20, 30],
            [10, 30],
          ],
        ],
      },
    };
    expect(reviewedSourceMapFrame(fixture(evidence))).toEqual(evidence);
    expect(
      reviewedSourceMapFrame({ ...fixture(evidence), geographicReviewed: false }),
    ).toBeUndefined();
    for (const polygons of [
      [],
      [
        [
          [0, 0],
          [1, 0],
          [2, 0],
        ],
      ],
      [
        [
          [0, 0],
          [1, null],
          [1, 1],
        ],
      ],
    ])
      expect(reviewedSourceMapFrame(fixture({ ...frame, geometry: { polygons } }))).toBeUndefined();
    const changed = fixture(evidence);
    changed.placement.heading += Math.PI;
    expect(reviewedSourceMapFrame(changed)).toBeUndefined();
  });
  it('accepts explicitly approximate visualization facing only with current placement review', () => {
    const evidence = {
      ...frame,
      sourceUrl: 'https://www.openstreetmap.org/node/8127284556',
      coordinateSpace: 'model-local-xz',
      mappedIdentity: { wikidataId: 'Q3378140', featureIds: ['node/8127284556'] },
      geometry: { point: [0, 0] },
      orientationControl: {
        status: 'reviewed-approximation',
        reviewedOn: '2026-10-12',
        headingRadians: frame.heading,
        uncertaintyDegrees: 180,
        basis:
          'Picture and PMTiles fit; chosen doorway facing is approximate, not a measured bearing.',
        referencePages: ['https://www.argentina.gob.ar/sites/default/files/ushuaia_108.jpg'],
      },
    };
    const data = fixture(evidence);
    data.spec.wikidataId = 'Q3378140';
    data.spec.geographicProposal.orientationPolicy = 'approximate-visualization';
    expect(reviewedSourceMapFrame(data)).toEqual(evidence);
    expect(reviewedSourceMapFrame({ ...data, geographicReviewed: false })).toBeUndefined();
    delete data.spec.geographicProposal.orientationPolicy;
    expect(reviewedSourceMapFrame(data)).toBeUndefined();
  });
  it('accepts an exact mapped node only with a separately reviewed referenced bearing', () => {
    const evidence = {
      ...frame,
      sourceUrl: 'https://www.openstreetmap.org/node/5316362054',
      coordinateSpace: 'model-local-xz',
      mappedIdentity: { wikidataId: 'Q3378451', featureIds: ['node/5316362054'] },
      geometry: { point: [0, 0] },
      orientationControl: {
        status: 'reviewed-reconstruction',
        reviewedOn: '2026-10-09',
        headingRadians: frame.heading,
        uncertaintyDegrees: 20,
        basis:
          'North-northeast projecting canopy and parallel steps inspected in satellite and operator photographs; image parallax limits precision.',
        referencePages: ['https://apmf.mg/review-reference', 'https://www.google.com/maps'],
      },
    };
    const check = (e) => {
      const data = fixture(e);
      data.spec.wikidataId = 'Q3378451';
      return reviewedSourceMapFrame(data);
    };
    expect(check(evidence)).toEqual(evidence);
    for (const patch of [
      { status: 'draft' },
      { reviewedOn: undefined },
      { basis: '' },
      { headingRadians: frame.heading + Math.PI },
      { uncertaintyDegrees: -1 },
      { uncertaintyDegrees: NaN },
      { uncertaintyDegrees: 90 },
      { referencePages: [] },
      { referencePages: ['./unattributed'] },
    ])
      expect(
        check({ ...evidence, orientationControl: { ...evidence.orientationControl, ...patch } }),
      ).toBeUndefined();
    for (const patch of [
      { coordinateSpace: undefined },
      { geometry: { point: [1, 0] } },
      { sourceUrl: 'https://www.openstreetmap.org/node/123' },
      { mappedIdentity: { wikidataId: 'Q123', featureIds: ['node/5316362054'] } },
      { mappedIdentity: { wikidataId: 'Q3378451', featureIds: [] } },
      { orientationControl: undefined },
    ])
      expect(check({ ...evidence, ...patch })).toBeUndefined();
    const data = fixture(evidence);
    data.spec.wikidataId = 'Q3378451';
    data.geographicReviewed = false;
    expect(reviewedSourceMapFrame(data)).toBeUndefined();
  });
  it('accepts a signed reviewed access line without inventing a building footprint', () => {
    const access = {
      ...frame,
      geometry: {
        centerlines: [
          [
            [0, -40],
            [0, -3.64],
          ],
        ],
      },
    };
    expect(reviewedSourceMapFrame(fixture(access))).toEqual(access);
    for (const centerlines of [
      [],
      [[]],
      [[[0, 0]]],
      [
        [
          [0, 0],
          [0, 0],
        ],
      ],
      [
        [
          [0, 0],
          [1, NaN],
        ],
      ],
    ])
      expect(
        reviewedSourceMapFrame(fixture({ ...access, geometry: { centerlines } })),
      ).toBeUndefined();
    expect(
      reviewedSourceMapFrame({ ...fixture(access), geographicReviewed: false }),
    ).toBeUndefined();
    expect(
      reviewedSourceMapFrame({
        ...fixture(access),
        placement: { anchor: frame.anchor, heading: frame.heading + Math.PI },
      }),
    ).toBeUndefined();
  });
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
