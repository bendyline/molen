import assert from 'node:assert/strict';
import { test } from 'node:test';
import { structureCatalogMatches } from './work-ownership.mjs';

test('independently resolved identity reserves catalog synonyms regardless of status', () => {
  const stadium = {
    name: 'Arena da Amazônia',
    modelIdentity: 'arena_da_amazonia',
    wikidataId: 'Q641527',
    coordinate: [-60.028056, -3.083056],
  };
  const existing = {
    id: 'arena_amazonia',
    title: 'Arena Amazônia',
    wikidataId: 'Q641527',
  };
  for (const status of ['queued', 'modeled', 'deferred', 'completed']) {
    const candidate = { ...existing, status };
    assert.deepEqual(structureCatalogMatches(stadium, [candidate], stadium.modelIdentity), [
      candidate,
    ]);
  }
  assert.deepEqual(structureCatalogMatches(stadium, [{ ...existing, wikidataId: 'Q6415271' }]), []);
});
