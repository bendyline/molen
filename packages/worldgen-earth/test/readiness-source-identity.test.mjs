import { describe, expect, it } from 'vitest';
import { readinessSourceIdentity } from '../scripts/readiness-source-identity.mjs';

describe('readiness source identity', () => {
  it.each([
    ['vieille_lighthouse', 'vieille_light', 'vieille_lighthouse'],
    ['maracana', 'maracana_stadium', 'maracana'],
    ['santiago_bernabeu_stadium', 'bernabeu', 'santiago_bernabeu_stadium'],
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
      id: 'msu_main_building',
      assetId: 'molen.worldgen.structure.msu_main_building',
    };
    const other = {
      candidateId: 'foreign_ministry',
      assetId: 'molen.worldgen.structure.foreign_ministry',
    };
    expect(
      readinessSourceIdentity(candidate, { asset: 'molen.worldgen.structure.seven_sisters' }, [
        other,
      ]),
    ).toEqual({ asset: candidate.assetId, key: 'msu_main_building', sourcePath: undefined });
  });

  it('leaves an unauthored candidate missing and rejects ambiguous registered sources', () => {
    const candidate = { id: 'pivnichnyi_bridge' },
      geo = { asset: 'molen.worldgen.structure.pivnichnyi_bridge' };
    expect(readinessSourceIdentity(candidate, geo, [])).toEqual({
      asset: geo.asset,
      key: 'pivnichnyi_bridge',
      sourcePath: undefined,
    });
    const entry = {
      candidateId: candidate.id,
      assetId: geo.asset,
      key: 'pivnichnyi_bridge',
      sourcePath: 'draft',
    };
    expect(() =>
      readinessSourceIdentity(candidate, geo, [entry, { ...entry, sourcePath: 'duplicate' }]),
    ).toThrow('multiple source bundles');
  });
});
