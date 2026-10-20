import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mediumFiAsset, verifyMediumFiRender } from './medium-fi-asset.mjs';

test('an exact structure identity wins over a longer name with the same suffix', () => {
  const old = 'molen.worldgen.structure.old_parliament_house_canberra';
  const current = 'molen.worldgen.structure.parliament_house_canberra';
  for (const entries of [
    [
      [old, 'old/asset.json'],
      [current, 'current/asset.json'],
    ],
    [
      [current, 'current/asset.json'],
      [old, 'old/asset.json'],
    ],
  ]) {
    const assets = Object.fromEntries(entries);
    assert.deepEqual(mediumFiAsset(assets, 'parliament_house_canberra'), {
      assetId: current,
      path: 'current/asset.json',
    });
    assert.equal(mediumFiAsset(assets, current).assetId, current);
    assert.equal(mediumFiAsset(assets, 'old_parliament_house_canberra').assetId, old);
  }
  assert.throws(
    () => mediumFiAsset({ [old]: 'old/asset.json' }, 'parliament_house_canberra'),
    /Unknown/,
  );
  assert.throws(() => mediumFiAsset({}, null), /Missing/);
});

test('capture rejects a browser that loaded a different model, runtime or detail level', () => {
  const sidecar = {
    id: 'expected',
    hash: 'runtime',
    runtimeLods: { levels: [{ name: 'street', hash: 'street-bytes' }] },
  };
  const state = {
    assetId: 'expected',
    runtimeHash: 'runtime',
    level: 'street',
    lodHash: 'street-bytes',
  };
  verifyMediumFiRender(sidecar, state);
  for (const changed of [
    { assetId: 'other' },
    { runtimeHash: 'stale' },
    { level: 'unknown' },
    { lodHash: 'stale' },
  ])
    assert.throws(
      () => verifyMediumFiRender(sidecar, { ...state, ...changed }),
      /wrong asset or bytes/,
    );
});
