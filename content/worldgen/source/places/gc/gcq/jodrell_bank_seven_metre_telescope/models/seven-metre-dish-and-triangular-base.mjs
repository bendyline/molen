import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { withFootprintCaps } from '../../../../../../../../packages/worldgen/scripts/place-footprint-caps.mjs';
import {
  facade,
  fbox,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import {
  collar,
  concrete,
  darkSteel,
  lightSteel,
  reflector,
  reflectorFrame,
  reflectorSurfaces,
  steel,
} from '../../../../../../../../packages/worldgen/scripts/telescope-reflector-geometry.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = reflectorSurfaces;
const { mount, point } = reflectorFrame(site.dish);
const u = mount(1, 0, 0),
  frame = facade([0, 0], [u[0], u[2]]);
const pale = rgb('babbad');
const bowl = {
  sections: [14, 24, 36, 50],
  rim: 0.102,
  backDepth: 0.74,
  feedAngles: [-0.96, 1.46, 3.31],
  feedFoot: 0.74,
};
function base(out, detail) {
  const a = site.dish.radius;
  fbox(out, 'concrete', frame, -a, a, -0.35, 0.166, -a * 0.76, a * 0.77, concrete);
  const joint = (p, q, w, c = steel) =>
    beam(out, 'steel', mount(...p), mount(...q), w, w * 0.75, c);
  const corners = [
    [-2.62, 0.15, -1.83],
    [2.58, 0.15, -1.79],
    [0.06, 0.16, 1.8],
  ];
  const top = [
    [-0.92, 2.39, -1.45],
    [0.97, 2.34, -1.41],
    [0.05, 2.28, -0.06],
  ];
  for (let j = 0; j < 3; j++) {
    const k = (j + 1) % 3,
      a = corners[j],
      b = corners[k],
      m = top[j],
      n = top[k];
    joint(a, m, 0.155, lightSteel);
    joint(a, n, 0.115);
    joint(a, b, 0.124, lightSteel);
    joint(m, n, 0.154, steel);
    if (detail) {
      const center = a.map((v, i) => (v + b[i]) * 0.5);
      joint(center, m, 0.087, darkSteel);
      joint(center, n, 0.087, darkSteel);
    }
  }
  const [, , z] = mount(0, 0, -0.92);
  collar(out, [mount(0, 0, -0.92)[0], z], 2.14, 0.38, 0.63, detail, darkSteel);
  fbox(out, 'housing', frame, -0.56, 0.62, 2.45, 3.11, -1.45, -0.45, pale);
  beam(out, 'steel', mount(0, 2.91, -0.95), point(0, 0, -0.75), 0.38, 0.32, steel);
}
function build(mesh, detail) {
  const out = withFootprintCaps(mesh);
  base(out, detail);
  reflector(out, site.dish, detail, bowl);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
