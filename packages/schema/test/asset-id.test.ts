import { describe, expect, it } from 'vitest';
import { validate } from '../src/index';

function assetReferences(id: string): boolean[] {
  const file = 'models/tower.glb';
  return [
    validate('project', {
      format: 'molen/project@1',
      name: 'landmarks',
      assets: { [id]: 'models/asset.json' },
    }).ok,
    validate('types', {
      format: 'molen/types@1',
      namespace: 'landmark',
      types: { 'landmark.tower': { assets: [id] } },
    }).ok,
    validate('pack-source', {
      format: 'molen/pack-source@1',
      id: 'landmarks',
      version: '1',
      ids: { [id]: file },
    }).ok,
    validate('pack', {
      format: 'molen/pack@1',
      id: 'landmarks',
      version: '1',
      contentHash: `sha256:${'0'.repeat(64)}`,
      ids: { [id]: file },
      entries: {
        [file]: { size: 0, sha256: `sha256:${'0'.repeat(64)}`, mediaType: 'model/gltf-binary' },
      },
    }).ok,
  ];
}

describe('asset ids across project, type and pack documents', () => {
  it.each([
    'crate',
    'train.rolling_stock',
    'molen.worldgen.structure.30_st_mary_axe',
    'molen.worldgen.structure.7_world_trade_center',
    'molen.worldgen.structure.875_north_michigan_avenue',
    'landmark.30.tower',
  ])('accepts %s', (id) => {
    expect(assetReferences(id)).toEqual([true, true, true, true]);
  });

  it.each([
    '',
    '30_st_mary_axe',
    '.landmark',
    'landmark.',
    'landmark..tower',
    'landmark._tower',
    'landmark.Tower',
    'landmark.30-st-mary',
    'landmark/30_st_mary',
    'landmark\\30_st_mary',
    'landmark.30 st mary',
  ])('rejects malformed or path-like id %s', (id) => {
    expect(assetReferences(id)).toEqual([false, false, false, false]);
  });

  it('keeps type, reservation and pack namespaces alphabetic', () => {
    expect(
      validate('types', {
        format: 'molen/types@1',
        namespace: 'landmark',
        types: { 'landmark.30_st_mary_axe': {} },
      }).ok,
    ).toBe(false);
    expect(
      validate('project', {
        format: 'molen/project@1',
        name: 'landmarks',
        reservations: [{ namespace: 'landmark.30', owner: 'author' }],
      }).ok,
    ).toBe(false);
    expect(
      validate('pack-source', {
        format: 'molen/pack-source@1',
        id: 'landmark.30',
        version: '1',
      }).ok,
    ).toBe(false);
  });
});
