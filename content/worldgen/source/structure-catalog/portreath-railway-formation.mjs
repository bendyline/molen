import { quad4, rgb } from '../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const verge = rgb('86915f');
const wornGround = rgb('84836a');
const soil = rgb('7a735c');

function build(out, sections, stride) {
  const selected = sections.filter((_, i) => i % stride === 0 || i === sections.length - 1);
  for (let i = 1; i < selected.length; i++) {
    const a = selected[i - 1];
    const b = selected[i];
    for (let lane = 0; lane + 1 < a.length; lane++) {
      const isBed = lane === 1 || lane === 2;
      quad4(
        out,
        isBed ? 'trackbed' : 'verge',
        a[lane],
        b[lane],
        b[lane + 1],
        a[lane + 1],
        isBed ? wornGround : verge,
      );
    }
    for (const edge of [0, a.length - 1]) {
      const floor = ([x, y, z]) => [x, y - 0.63, z];
      const face = [floor(a[edge]), floor(b[edge]), b[edge], a[edge]];
      if (edge === 0) face.reverse();
      quad4(out, 'verge', ...face, soil);
    }
  }
}

export function portreathRailwayFormation(sections) {
  const surfaces = {
    trackbed: { slot: 'foundation', graph: 'gravel', roughness: 0.98 },
    verge: { slot: 'foundation', graph: 'earth_rammed', roughness: 0.98 },
  };
  const buildSkyline = (out) => build(out, sections, 5);
  const buildDistrict = (out) => build(out, sections, 3);
  const buildStreet = (out) => build(out, sections, 2);
  const buildCloseup = (out) => build(out, sections, 1);
  return {
    surfaces,
    buildSkyline,
    buildDistrict,
    buildStreet,
    buildCloseup,
    buildMaster: buildCloseup,
  };
}
