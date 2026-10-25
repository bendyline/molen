import { expect, test } from 'vitest';
import { MeshBufferBuilder } from '../dist/kernel.mjs';
import { validateAuthoredMesh } from '../scripts/authored-structure-mesh.mjs';
import {
  louisvilleDistrict,
  louisvilleSkyline,
  louisvilleStreet,
} from '../scripts/structure-louisville-water-tower.mjs';
import {
  josephineDistrict,
  josephineSkyline,
  josephineStreet,
} from '../scripts/structure-statue-of-the-empress-josephine.mjs';
import {
  treviFountainDistrict,
  treviFountainSkyline,
  treviFountainStreet,
} from '../scripts/structure-trevi-fountain.mjs';

// Figure-kernel changes also affect these static sculptures. Exercise the complete
// authored levels so a valid body cannot silently exhaust the landmark's budget.
for (const [name, levels] of [
  ['Louisville Water Tower', [louisvilleSkyline, louisvilleDistrict, louisvilleStreet]],
  ['Joséphine monument', [josephineSkyline, josephineDistrict, josephineStreet]],
  ['Trevi Fountain', [treviFountainSkyline, treviFountainDistrict, treviFountainStreet]],
]) {
  for (const [index, build] of levels.entries()) {
    const level = ['skyline', 'district', 'street'][index];
    test(`${name} ${level} has valid geometry within its runtime budget`, () => {
      const builder = new MeshBufferBuilder();
      build(builder);
      const mesh = builder.finalize();
      validateAuthoredMesh(mesh, `${name}/${level}`);
      expect(mesh.triangleCount).toBeGreaterThan(0);
      expect(mesh.triangleCount).toBeLessThanOrEqual([1000, 4000, 16000][index]);
    });
  }
}
