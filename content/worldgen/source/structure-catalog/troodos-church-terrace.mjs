import { rgb, tri } from '../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const paving = rgb('a4a69a');
const slope = rgb('a0a092');

/** Keep the small court level and join it to the sampled ground at the modeled boundary. */
export function churchTerrace(recipe, { inner, outer, floor }) {
  const surface = { slot: 'foundation', graph: 'stone_limestone_weathered', roughness: 0.96 };
  function addTerrace(out) {
    const [x, z] = inner.reduce(
      ([X, Z], [a, b]) => [X + a / inner.length, Z + b / inner.length],
      [0, 0],
    );
    const center = [x, floor, z];
    for (let i = 0; i < inner.length; i++) {
      const j = (i + 1) % inner.length;
      const a = [inner[i][0], floor, inner[i][1]];
      const b = [inner[j][0], floor, inner[j][1]];
      tri(out, 'court', a, b, center, paving);
      tri(out, 'masonry', outer[i], outer[j], b, slope);
      tri(out, 'masonry', outer[i], b, a, slope);
    }
  }
  const wrap = (build) => (out) => {
    addTerrace(out);
    build(out);
  };
  return {
    surfaces: { ...recipe.surfaces, court: surface },
    buildSkyline: wrap(recipe.buildSkyline),
    buildDistrict: wrap(recipe.buildDistrict),
    buildStreet: wrap(recipe.buildStreet),
    buildCloseup: wrap(recipe.buildCloseup),
    buildMaster: wrap(recipe.buildMaster),
  };
}
