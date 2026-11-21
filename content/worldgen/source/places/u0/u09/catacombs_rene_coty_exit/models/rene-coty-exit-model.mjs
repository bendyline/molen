import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import { surfaces as commonSurfaces } from '../../catacombs_of_paris/models/catacombs-of-paris-model.mjs';
import { buildReneCotyExit } from '../../catacombs_of_paris/models/catacombs-surface.mjs';

export const surfaces = {
  ...commonSurfaces,
  faceStone: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.93, metallic: 0 },
  canopy: {
    slot: 'roof',
    localRef: 'palette:#e2f2f3',
    name: 'clear canopy glazing',
    roughness: 0.34,
    metallic: 0,
    alphaMode: 'BLEND',
    baseColorFactor: [1, 1, 1, 0.44],
  },
};

function build(out, name, joinery) {
  buildReneCotyExit(out, { name, joinery, facingSurface: 'faceStone' }, 'canopy');
  const stone = [0.55, 0.51, 0.43];
  const roof = [0.48, 0.48, 0.452];
  const foundation = [0.51, 0.49, 0.44];
  // The flanking masonry and the recessed opening use their own footprints.
  const volumes = [
    [-5.28, -1.83, -8.78, 3.99],
    [1.83, 5.74, -10.65, 3.99],
    [-5.12, 5.63, -8.8, -4.53],
  ];
  for (const [a, b, tail, front] of volumes) {
    box(out, 'rough', [a, -0.45, tail], [b, 4.62, front], stone);
    if (name !== 'skyline')
      box(out, 'ashlar', [a - 0.047, 4.62, tail - 0.033], [b + 0.047, 4.74, front + 0.018], roof);
  }
  box(out, 'foundation', [-6.17, -0.48, 3.96], [-1.83, 0.12, 4.53], foundation);
  box(out, 'foundation', [1.83, -0.48, 3.96], [6.17, 0.12, 4.53], foundation);
  box(out, 'foundation', [-1.83, -0.48, -4.48], [1.83, 0.012, 4.97], foundation);
  if (name === 'master' || name === 'closeup') {
    for (const x of [-1.92, 1.92])
      for (const z of [-2.68, -0.36, 1.97, 4.3]) {
        box(out, 'iron', [x - 0.041, 5.55, z - 0.04], [x + 0.041, 5.81, z + 0.04], roof);
      }
  }
}

export const buildMaster = (out) => build(out, 'master', true);
export const buildCloseup = (out) => build(out, 'closeup', true);
export const buildStreet = (out) => build(out, 'street', true);
export const buildDistrict = (out) => build(out, 'district', false);
export const buildSkyline = (out) => build(out, 'skyline', false);
