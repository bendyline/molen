import { expect, it } from 'vitest';
import { hashEvidenceText } from '../../worldgen/scripts/evidence-text-hash.mjs';
import { categoryRuleHash, reviewedCategoryRules } from '../scripts/reviewed-category-rules.mjs';

function fixture(edit = () => {}) {
  const pixels = Buffer.from('current inspected category pixels');
  const rules = [
    {
      id: 'map.type',
      asset: 'model.type',
      match: { classes: ['tower'] },
      dimensions: [5, 23, 5],
      source: 'https://example.com',
    },
  ];
  const spec = { assetId: 'model.type', usage: { kind: 'map-category', rules: ['map.type'] } };
  const qa = {
    inputHash: 'inputs',
    sourceHash: 'source',
    runtimeHash: 'runtime',
    categoryReview: { status: 'passed', ruleHash: categoryRuleHash(rules) },
  };
  const sidecar = {
    runtimeLods: {
      levels: ['skyline', 'district', 'street', 'closeup'].map((name) => ({ name, hash: name })),
    },
  };
  const exampleBytes = Buffer.from(
    JSON.stringify({ feature: { id: 1, properties: { kind: 'attraction' } } }),
  );
  const report = {
    assetId: spec.assetId,
    inputHash: qa.inputHash,
    sourceHash: qa.sourceHash,
    runtimeHash: qa.runtimeHash,
    ruleHash: qa.categoryReview.ruleHash,
    mapExampleHash: hashEvidenceText(exampleBytes),
    productionDecoderVerified: true,
    decodeProof: { poi: { id: 1, class: 'attraction' } },
    orientationLimit: 'Footprint axis is undirected; entrance facing is approximate.',
    modelHashes: [
      { name: 'source', hash: 'source' },
      { name: 'runtime', hash: 'runtime' },
      ...sidecar.runtimeLods.levels.map((level) => ({ ...level })),
    ],
    reports: ['skyline', 'district', 'street', 'closeup', 'failure'].map((level) => ({
      level,
      state: {
        matched: [{ id: 'map.map.type.1', asset: spec.assetId }],
        sourceBuildings: 5,
        independentBuildings: 4,
        remainingBuildings: level === 'failure' ? 5 : 4,
        changedIndependent: [],
        modelLoaded: level !== 'failure',
        sourceGridModified: false,
        groundCutoutActive: false,
        waterCutoutActive: false,
        nativeWaterUnchanged: true,
        sourceWaterArea: 10,
        remainingWaterArea: 10,
        negatives: { outsideRegion: 0, hotel: 0, partialName: 0 },
      },
      unloaded: { groundRestored: true, waterRestored: true, liveGeometries: 0 },
      frames: [{ path: 'shots/current.png', hash: hashEvidenceText(pixels) }],
      errors: [],
    })),
  };
  const f = {
    spec,
    qa,
    sidecar,
    rules,
    placements: [],
    sourceEntry: { role: 'reusable' },
    sourceManifest: {
      files: { documents: ['category-integration-report.json', 'map-example.json'] },
    },
    exampleBytes,
    readImage: async () => pixels,
  };
  edit(f, report);
  f.reportBytes = Buffer.from(JSON.stringify(report));
  qa.categoryReview.reportHash = hashEvidenceText(f.reportBytes);
  return f;
}
it('accepts a reusable type with current rules, inspected native levels and negative matches', async () => {
  const result = await reviewedCategoryRules(fixture());
  expect(result?.rules).toEqual(['map.type']);
  expect(result?.example).toBe(1);
});
it.each([
  [
    'unique source',
    (f) => {
      f.sourceEntry.role = 'place';
    },
  ],
  [
    'fabricated centroid',
    (f) => {
      f.spec.geographicProposal = { anchor: [42, 43] };
    },
  ],
  [
    'unique placement',
    (f) => {
      f.placements.push({ asset: 'model.type', status: 'preview' });
    },
  ],
  [
    'changed rules',
    (f) => {
      f.rules[0].match.classes = ['hotel'];
    },
  ],
  [
    'changed LOD',
    (f) => {
      f.sidecar.runtimeLods.levels[0].hash = 'new-skyline';
    },
  ],
  [
    'unverified decoder',
    (_f, r) => {
      r.productionDecoderVerified = false;
    },
  ],
  [
    'business false positive',
    (_f, r) => {
      r.reports[0].state.negatives.hotel = 1;
    },
  ],
  [
    'changed neighbor',
    (_f, r) => {
      r.reports[1].state.changedIndependent = [99];
    },
  ],
  [
    'missing failure fallback',
    (_f, r) => {
      r.reports[4].state.remainingBuildings = 4;
    },
  ],
  [
    'leaked geometry',
    (_f, r) => {
      r.reports[2].unloaded.liveGeometries = 1;
    },
  ],
  [
    'changed water',
    (_f, r) => {
      r.reports[0].state.remainingWaterArea = 9;
    },
  ],
  [
    'missing pixels',
    (f) => {
      f.readImage = async () => undefined;
    },
  ],
])('rejects %s', async (_name, edit) => {
  expect(await reviewedCategoryRules(fixture(edit))).toBeUndefined();
});
