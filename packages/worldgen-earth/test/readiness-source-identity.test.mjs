import { describe, expect, it } from 'vitest';
import { readinessSourceIdentity } from '../scripts/readiness-source-identity.mjs';

describe('readiness source identity', () => {
  it.each([
    ['N0654', 'n0654_vieille_light', 'n0654_vieille_lighthouse'],
    ['N0681', 'n0681_maracana_stadium', 'n0681_maracana'],
    ['N0682', 'n0682_bernabeu', 'n0682_santiago_bernabeu_stadium'],
  ])('finds %s by declared candidate ID when a geographic slug is stale', (id, stale, actual) => {
    const assetId = `molen.worldgen.structure.${actual}`;
    const sourcePath = `content/worldgen/source/places/ez/ezj/${actual}`;
    const entry = { candidateId: id, assetId, key: actual, sourcePath };
    expect(
      readinessSourceIdentity(
        { id, modelRef: `molen.worldgen.structure.${stale}` },
        { asset: `molen.worldgen.structure.${stale}` },
        [entry],
      ),
    ).toEqual({ asset: assetId, key: actual, sourcePath });
  });

  it('retains explicit collection-member identity without using the collection centroid or a neighbor', () => {
    const candidate = {
      id: 'N0208_MSU',
      assetId: 'molen.worldgen.structure.n0208_msu_main_building',
    };
    const other = {
      candidateId: 'N0208_MFA',
      assetId: 'molen.worldgen.structure.n0208_foreign_ministry',
    };
    expect(
      readinessSourceIdentity(candidate, { asset: 'molen.worldgen.structure.n0208' }, [other]),
    ).toEqual({ asset: candidate.assetId, key: 'n0208_msu_main_building', sourcePath: undefined });
  });

  it('leaves an unauthored candidate missing and rejects ambiguous registered sources', () => {
    const candidate = { id: 'N0030' },
      geo = { asset: 'molen.worldgen.structure.n0030_pivnichnyi_bridge' };
    expect(readinessSourceIdentity(candidate, geo, [])).toEqual({
      asset: geo.asset,
      key: 'n0030_pivnichnyi_bridge',
      sourcePath: undefined,
    });
    const entry = {
      candidateId: candidate.id,
      assetId: geo.asset,
      key: 'n0030_pivnichnyi_bridge',
      sourcePath: 'draft',
    };
    expect(() =>
      readinessSourceIdentity(candidate, geo, [entry, { ...entry, sourcePath: 'duplicate' }]),
    ).toThrow('multiple source bundles');
  });
});
