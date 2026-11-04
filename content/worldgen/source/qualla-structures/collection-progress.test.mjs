import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { inspectLocalCollection } from './collection-progress.mjs';

const hash = (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`;
function fixture() {
  const repository = fs.mkdtempSync(path.join(os.tmpdir(), 'molen-collection-'));
  const put = (relative, value) => {
    const file = path.join(repository, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));
  };
  const entry = {
    modelIdentity: 'market_site',
    structureId: 'QS-site',
    name: 'Market site',
    collectionSourcePath: 'site',
    collectionManifest: 'site/collection.json',
    workOwner: 'batch',
    stories: [],
  };
  entry.requiredMembers = ['east_market', 'west_market'].map((modelIdentity) => ({
    modelIdentity,
    structureId: entry.structureId,
    parentModelIdentity: entry.modelIdentity,
    sourcePath: `members/${modelIdentity}`,
    modelState: 'completed',
    workOwner: 'batch',
    stories: [],
  }));
  const members = entry.requiredMembers.map((member, i) => ({
    id: member.modelIdentity,
    wikidataId: 'Q123',
    title: member.modelIdentity,
    sourceKey: member.modelIdentity,
    assetId: `molen.worldgen.structure.${member.modelIdentity}`,
    featureId: `way/${i + 1}`,
    sourcePath: member.sourcePath,
    sourceHash: 'source-v1',
    referenceCoordinate: { longitude: i, latitude: 0 },
  }));
  const collection = {
    id: entry.modelIdentity,
    wikidataId: 'Q123',
    title: entry.name,
    identityKind: 'site-members',
    requiredCount: 2,
    members,
    membershipEvidence: {
      source: 'https://example.org/original-map',
      inventoryStatus: 'complete',
      outstanding: [],
      memberIds: members.map((m) => m.id),
      featureIds: members.map((m) => m.featureId),
    },
  };
  put('site/collection.json', {
    format: 'molen/structure-collections@1',
    collections: [collection],
  });
  put('site/collection-assembly.json', { members });
  put('site/route-coverage.json', {
    independentModels: 2,
    uncoveredLocal: [],
    remainingLocalNativeFeatures: [],
    tests: [{ coordinate: [0, 0], coveredBy: ['east_market'] }],
  });
  for (const file of [
    'collection-frame.json',
    'scene.json',
    'terrain-grid.json',
    'terrain-review.terrain.json',
    'terrain-review.height.png',
  ])
    put(`site/${file}`, 'unchanged');
  for (const member of entry.requiredMembers) {
    put(`${member.sourcePath}/qa.json`, { status: 'completed' });
    put(`${member.sourcePath}/spec.json`, { mesh: { sha256: 'source-v1' } });
  }
  const inputs = [
    'collection.json',
    'collection-frame.json',
    'collection-assembly.json',
    'scene.json',
    'route-coverage.json',
    'terrain-grid.json',
    'terrain-review.terrain.json',
    'terrain-review.height.png',
  ];
  const review = {
    format: 'molen/structure-collection-review@1',
    status: 'completed',
    parentCompleted: true,
    memberGeometryFramesFieldsFloorsAndQaChanged: false,
    inputFiles: Object.fromEntries(
      inputs.map((file) => [file, hash(fs.readFileSync(path.join(repository, 'site', file)))]),
    ),
    memberReviews: entry.requiredMembers.map((m) => ({
      modelIdentity: m.modelIdentity,
      inputHash: 'input-v1',
      qaHash: hash(fs.readFileSync(path.join(repository, m.sourcePath, 'qa.json'))),
    })),
    currentImagesPersonallyInspected: ['oblique', 'north-up'].map((view) => {
      put(`captures/${view}.png`, view);
      return { view, localCapturePath: `captures/${view}.png`, sha256: hash(view) };
    }),
  };
  const saveReview = () => put('site/collection-review.json', review);
  saveReview();
  const inspectMember = async (m) => ({
    readiness: 'ready',
    inputHash: 'input-v1',
    asset: `molen.worldgen.structure.${m.modelIdentity}`,
    geographic: { activePlacement: m.modelIdentity },
  });
  return {
    repository,
    put,
    entry,
    review,
    collection,
    inspectMember,
    saveReview,
    close: () => fs.rmSync(repository, { recursive: true, force: true }),
  };
}

test('a complete site retains independent assets and existing bound member approvals', async () => {
  const f = fixture();
  try {
    const row = await inspectLocalCollection(f.entry, f, f.inspectMember);
    assert.equal(row.readiness, 'ready');
    assert.equal(row.asset, null);
    assert.equal(row.assets.length, 2);
    assert.equal(row.geographic.activePlacements.length, 2);
  } finally {
    f.close();
  }
});

test('site completion rejects missing views, changed assembly, and stale member approvals', async () => {
  const f = fixture();
  try {
    const views = f.review.currentImagesPersonallyInspected;
    delete f.review.currentImagesPersonallyInspected;
    f.saveReview();
    assert.match(
      (await inspectLocalCollection(f.entry, f, f.inspectMember)).blockers[0],
      /views missing/,
    );
    f.review.currentImagesPersonallyInspected = views;
    f.saveReview();
    assert.match(
      (
        await inspectLocalCollection(f.entry, f, async (m) => ({
          ...(await f.inspectMember(m)),
          inputHash: 'changed',
        }))
      ).blockers[0],
      /member review changed/,
    );
    f.put('members/east_market/qa.json', { status: 'pending' });
    assert.match(
      (await inspectLocalCollection(f.entry, f, f.inspectMember)).blockers[0],
      /member review changed/,
    );
    f.put('site/scene.json', 'changed');
    assert.match(
      (await inspectLocalCollection(f.entry, f, f.inspectMember)).blockers[0],
      /input changed/,
    );
  } finally {
    f.close();
  }
});

test('partial inventory and mismatched ownership cannot qualify a whole collection', async () => {
  const f = fixture();
  try {
    f.collection.membershipEvidence.inventoryStatus = 'needs-review';
    f.collection.membershipEvidence.outstanding = ['Missing market'];
    f.put('site/collection.json', {
      format: 'molen/structure-collections@1',
      collections: [f.collection],
    });
    assert.match(
      (await inspectLocalCollection(f.entry, f, f.inspectMember)).blockers[0],
      /inventory remains incomplete/,
    );
    f.collection.membershipEvidence.inventoryStatus = 'complete';
    f.collection.membershipEvidence.outstanding = [];
    f.put('site/collection.json', {
      format: 'molen/structure-collections@1',
      collections: [f.collection],
    });
    f.entry.requiredMembers[0].workOwner = 'other-device';
    assert.match(
      (await inspectLocalCollection(f.entry, f, f.inspectMember)).blockers[0],
      /member identity incomplete/,
    );
  } finally {
    f.close();
  }
});
