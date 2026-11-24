import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  structureCatalogEntries,
  structureCatalogMatches,
  workAssignment,
} from './work-ownership.mjs';

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

test('queued important landmarks reserve alternate names for the catalog workstream', () => {
  const entries = structureCatalogEntries(
    { candidates: [] },
    { collections: [] },
    {
      entries: [
        {
          id: 'pyramid_of_khafre',
          title: 'Pyramid of Khafre',
          aliases: ['Pyramid of Chephren'],
          wikidataId: 'Q208358',
          referenceCoordinate: { longitude: 31.130972, latitude: 29.976 },
          status: 'queued',
        },
      ],
    },
  );
  const assignment = workAssignment(
    { name: 'Pyramid of Chephren', wikidataId: 'Q208358' },
    entries,
  );
  assert.equal(assignment.localAuthoringAllowed, false);
  assert.deepEqual(assignment.structureCatalogIds, ['pyramid_of_khafre']);
  assert.equal(
    workAssignment({ name: 'Pyramid of Chephren', coordinate: [31.131, 29.976] }, entries)
      .localAuthoringAllowed,
    false,
  );
  assert.equal(
    workAssignment({ name: 'Pyramid of Chephren', coordinate: [2.3, 48.8] }, entries)
      .localAuthoringAllowed,
    true,
  );
});

test('an important landmark collection reserves each member identity', () => {
  const entries = structureCatalogEntries(
    { candidates: [] },
    { collections: [] },
    {
      entries: [{ id: 'churches_of_peace', title: 'Churches of Peace', wikidataId: 'Q589634' }],
      collections: [
        {
          id: 'churches_of_peace',
          members: [
            {
              id: 'church_of_peace_jawor',
              title: 'Church of Peace in Jawor',
              wikidataId: 'Q13586340',
            },
            {
              id: 'church_of_peace_swidnica',
              title: 'Church of Peace in Świdnica',
              wikidataId: 'Q1456840',
            },
          ],
        },
      ],
    },
  );
  for (const [wikidataId, id] of [
    ['Q13586340', 'church_of_peace_jawor'],
    ['Q1456840', 'church_of_peace_swidnica'],
  ]) {
    const assignment = workAssignment({ name: 'Church of Peace', wikidataId }, entries);
    assert.equal(assignment.localAuthoringAllowed, false);
    assert.deepEqual(assignment.structureCatalogIds, [id]);
  }
});
