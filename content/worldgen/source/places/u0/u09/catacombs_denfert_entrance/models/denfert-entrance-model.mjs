import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import { surfaces } from '../../catacombs_of_paris/models/catacombs-of-paris-model.mjs';
import { buildDenfertEntrance } from '../../catacombs_of_paris/models/catacombs-surface.mjs';
import { site } from '../../catacombs_of_paris/models/site-controls.mjs';

export { surfaces };

function build(out, name, romans, joinery) {
  buildDenfertEntrance(out, { name, romans, joinery });
  const { width, depth } = site.entrance;
  const x = width / 2;
  const z = depth / 2;
  const stone = [0.69, 0.63, 0.51];
  const weathered = [0.56, 0.52, 0.43];
  const zinc = [0.39, 0.39, 0.36];
  box(out, 'foundation', [-x, -0.63, -z], [x, 0.11, z], weathered);
  box(out, 'ashlar', [-11.76, -0.47, -7.34], [-x + 0.05, 4.03, 5.01], stone);
  box(out, 'slate', [-11.83, 4.03, -7.41], [-x + 0.08, 4.17, 5.1], zinc);
  box(out, 'ashlar', [x + 5.52, -0.44, -0.98], [15.59, 4.15, 5.17], stone);
  box(out, 'foundation', [x + 0.02, -0.47, -0.94], [15.59, 0.031, 5.41], weathered);
  box(out, 'slate', [x + 5.76, 4.15, -1.02], [15.66, 4.3, 5.26], zinc);
  if (joinery) {
    for (const y of [0.43, 1.27, 2.1, 2.94, 3.77]) {
      box(out, 'ashlar', [-11.86, y, -7.31], [-11.71, y + 0.08, 5.04], stone);
      box(out, 'ashlar', [x + 5.63, y, 5.08], [15.67, y + 0.08, 5.22], stone);
    }
  }
}

export const buildMaster = (out) => build(out, 'master', 18, true);
export const buildCloseup = (out) => build(out, 'closeup', 14, true);
export const buildStreet = (out) => build(out, 'street', 10, true);
export const buildDistrict = (out) => build(out, 'district', 6, false);
export const buildSkyline = (out) => build(out, 'skyline', 5, false);
