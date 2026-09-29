import { describe, expect, it } from 'vitest';
import { validateFolderLocationEvidence } from '../scripts/folder-location-evidence.mjs';

const key = 'b01_empire_state_building_new_york';
const assetId = `molen.worldgen.structure.${key}`;
const anchor = [-73.98555555555555, 40.748333333333335];
const record = {
  key,
  assetId,
  title: 'Empire State Building, New York',
  anchor,
  source: { url: 'https://www.wikidata.org/wiki/Q9188', entityId: 'Q9188' },
};
const document = (entries = [record]) => ({
  format: 'molen/structure-folder-locations@1',
  scope: 'organizational-reference-only',
  entries,
});
const indexed = (changes = {}) => [
  { key, assetId, anchor, anchorBasis: `folder-location-evidence:${key}`, ...changes },
];

describe('organizational folder location evidence', () => {
  it('binds referenced exact identities and coordinates without mutating the index', () => {
    const entries = indexed();
    const before = structuredClone(entries);
    expect(() => validateFolderLocationEvidence(document(), entries)).not.toThrow();
    expect(entries).toEqual(before);
    expect(() => validateFolderLocationEvidence(document(), [])).not.toThrow();
    expect(() => validateFolderLocationEvidence(undefined, [])).not.toThrow();
    expect(() => validateFolderLocationEvidence(undefined, indexed())).toThrow('missing');
  });

  it('rejects missing, mismatched or cross-identity references', () => {
    expect(() => validateFolderLocationEvidence(document([]), indexed())).toThrow('missing');
    expect(() =>
      validateFolderLocationEvidence(document(), indexed({ assetId: `${assetId}_other` })),
    ).toThrow('asset ID differs');
    expect(() =>
      validateFolderLocationEvidence(document(), indexed({ anchor: [-73.98, 40.74] })),
    ).toThrow('anchor differs');
    expect(() =>
      validateFolderLocationEvidence(document(), indexed({ anchor: undefined })),
    ).toThrow('anchor differs');
    expect(() =>
      validateFolderLocationEvidence(
        document(),
        indexed({ anchorBasis: 'folder-location-evidence:other_identity' }),
      ),
    ).toThrow('must use its source key');
  });

  it('rejects unsupported evidence, duplicate keys and unusable provenance', () => {
    for (const changed of [
      { format: 'molen/structure-folder-locations@2' },
      { scope: 'placement-approved' },
      { entries: null },
    ])
      expect(() => validateFolderLocationEvidence({ ...document(), ...changed }, [])).toThrow(
        'format or scope',
      );
    expect(() => validateFolderLocationEvidence(document([record, record]), [])).toThrow(
      'Duplicate',
    );
    for (const changed of [
      { key: '../other' },
      { assetId: 'molen.worldgen.prop.other' },
      { title: '' },
      { anchor: [181, 0] },
      { anchor: [0, 91] },
      { anchor: [NaN, 0] },
      { anchor: [0] },
      { source: { url: '../local.json' } },
      { source: { url: 'file:///local.json' } },
    ])
      expect(() =>
        validateFolderLocationEvidence(document([{ ...record, ...changed }]), []),
      ).toThrow();
  });
});
