import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { readStructurePlacements } from '../../worldgen-earth/scripts/placement-sources.mjs';
import {
  structureKeyFromTitle,
  structurePlacementId,
  validateStructureCandidateIds,
} from '../scripts/structure-identity.mjs';
import { knownSourceEntries, structureSourcePath } from '../scripts/structure-source-paths.mjs';
import { validateStructureIdentities } from '../scripts/validate-structure-identities.mjs';

describe('stable named structure identities', () => {
  it('checks the complete catalog, collection and placement graph without model binaries', async () => {
    expect(await validateStructureIdentities()).toEqual({
      candidates: 1000,
      sources: 1065,
      placements: 975,
    });
  }, 30_000); // Reads over 1,000 source specs; filesystem contention can exceed 5 s.
  it('uses readable names while preserving numeric building names and diacritics in display titles', () => {
    expect(structureKeyFromTitle('Edifício Altino Arantes')).toBe('edificio_altino_arantes');
    expect(structureKeyFromTitle("St. Mary's Cathedral, Tokyo")).toBe('st_marys_cathedral_tokyo');
    expect(structureKeyFromTitle('11 Foot 8 Bridge')).toBe('11_foot_8_bridge');
    expect(structurePlacementId('molen.worldgen.structure.edificio_altino_arantes')).toBe(
      'edificio.altino.arantes',
    );
    expect(() => structurePlacementId('unrelated.asset')).toThrow();
  });
  it('rejects ambiguous or batch-derived catalog identities', () => {
    expect(() =>
      validateStructureCandidateIds([{ id: 'aon_center' }, { id: 'aon_center' }]),
    ).toThrow('Duplicate');
    expect(() => validateStructureCandidateIds([{ id: 'n' + '0148_building' }])).toThrow('invalid');
    expect(() => validateStructureCandidateIds([{ id: '../escape' }])).toThrow('invalid');
    expect(() =>
      validateStructureCandidateIds([
        { id: 'aon_center_chicago' },
        { id: 'aon_center_los_angeles' },
      ]),
    ).not.toThrow();
  });
  it('resolves every placement and named catalog model through the migrated registries', async () => {
    const entries = knownSourceEntries();
    const project = JSON.parse(
      await readFile(new URL('../../../content/worldgen/project.json', import.meta.url)),
    );
    const catalog = JSON.parse(
      await readFile(
        new URL(
          '../../../content/worldgen/source/structure-catalog/candidates.json',
          import.meta.url,
        ),
      ),
    );
    validateStructureCandidateIds(catalog.candidates);
    const placements = (await readStructurePlacements()).entries;
    for (const placement of placements)
      expect(project.assets[placement.asset], placement.id).toBeDefined();
    for (const candidate of catalog.candidates)
      if (candidate.modelRef)
        expect(project.assets[candidate.modelRef], candidate.id).toBeDefined();
    const altino = entries.find((e) => e.key === 'edificio_altino_arantes');
    expect(altino.assetId).toBe('molen.worldgen.structure.edificio_altino_arantes');
    const spec = JSON.parse(await readFile(structureSourcePath(altino.key, 'spec.json')));
    expect(spec.id).toBe(altino.key);
    expect(placements.find((e) => e.asset === spec.assetId).id).toBe('edificio.altino.arantes');
    expect(
      entries
        .filter((e) => /^aon_center_/.test(e.key))
        .map((e) => e.key)
        .sort(),
    ).toEqual(['aon_center_chicago', 'aon_center_los_angeles']);
  });
});
