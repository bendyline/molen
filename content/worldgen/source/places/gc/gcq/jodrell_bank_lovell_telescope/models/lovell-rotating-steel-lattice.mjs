import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { withFootprintCaps } from '../../../../../../../../packages/worldgen/scripts/place-footprint-caps.mjs';
import {
  facade,
  fbox,
  lathe,
  opening,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import {
  concrete,
  darkSteel,
  lightSteel,
  reflector,
  reflectorFrame,
  reflectorSurfaces,
  rimTrack,
  steel,
} from '../../../../../../../../packages/worldgen/scripts/telescope-reflector-geometry.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = reflectorSurfaces;
const { mount, point, onDish } = reflectorFrame(site.dish);
const origin = mount(0, 0, 0),
  unit = mount(1, 0, 0);
const frame = facade([origin[0], origin[2]], [unit[0], unit[2]]);
const painted = rgb('c5c6bc'),
  glass = rgb('586360');
const shell = {
  sections: [14, 30, 52, 76],
  rim: 0.91,
  backDepth: 8.46,
  feedAngles: [-Math.PI * 0.5],
  feedFoot: 0.64,
};
const pipe = (o, a, b, w, tone = steel, depth = w) => beam(o, 'steel', a, b, w, depth, tone);
const worldBeam = (o, a, b, w, tone = steel) => pipe(o, mount(...a), mount(...b), w, tone);
const box = (o, s, x, X, y, Y, z, Z, c) => fbox(o, s, frame, x, X, y, Y, z, Z, c);
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

function railBase(out, detail) {
  const n = detail === 0 ? 12 : detail === 1 ? 26 : detail === 2 ? 44 : 72;
  const outer = site.dish.radius - 1.22;
  for (const r of [outer, outer - 5.28]) {
    rimTrack(out, 'concrete', r, 1.68, -0.33, 0.57, n, concrete);
    if (detail) {
      rimTrack(out, 'steel', r - 0.53, 0.155, 0.245, 0.125, n, darkSteel);
      rimTrack(out, 'steel', r + 0.53, 0.155, 0.245, 0.125, n, darkSteel);
    }
  }
  for (const d of [-9.35, 8.65]) {
    box(out, 'steel', -48.9, 48.9, 1.55, 3.17, d - 0.34, d + 0.34, lightSteel);
    if (detail) {
      const n = detail < 2 ? 8 : detail === 2 ? 15 : 19;
      for (let i = 0; i < n; i++) {
        const x = -48.6 + i * (97.2 / n),
          next = x + 97.2 / n;
        worldBeam(out, [x, 0.69, d], [x, 2.11, d], 0.32);
        worldBeam(out, [x, 0.69, d], [next, 2.09, d], 0.34);
      }
      box(out, 'steel', -48.9, 48.9, 0.67, 1.03, d - 0.26, d + 0.26, steel);
    }
  }
  box(out, 'housing', -4.43, 5.49, -0.42, 4.55, -4.5, 4.1, painted);
  if (detail) {
    box(out, 'steel', -4.68, 5.69, 4.48, 4.71, -4.71, 4.26, darkSteel);
    for (const d of [-7.73, 7.83])
      for (const u of [-43, 43]) {
        box(out, 'concrete', u - 1.16, u + 1.16, -0.51, 0.37, d - 1.35, d + 1.35, concrete);
        const p = mount(u, 0, d);
        lathe(
          out,
          'steel',
          [p[0], p[2]],
          [
            [0.14, 0.91, 0.91],
            [0.88, 0.96, 0.96],
            [1.37, 0.83, 0.83],
          ],
          detail === 3 ? 10 : 6,
          darkSteel,
        );
      }
  }
}
function towers(out, detail) {
  for (const side of [-1, 1]) {
    const base = [
      [41.3, 1.38, 8.1],
      [49.9, 1.4, 13.14],
      [49.7, 1.46, -12.4],
    ].map(([x, y, d]) => mount(side * x, y, d));
    const crown = [
      [35.9, 43.21, 6.92],
      [42.4, 43.16, 5.5],
      [41, 43.1, 0.08],
    ].map(([x, y, d]) => mount(side * x, y, d));
    const n = detail === 0 ? 2 : detail === 1 ? 4 : detail === 2 ? 7 : 10;
    for (let i = 0; i < 3; i++) {
      pipe(out, base[i], crown[i], detail ? 1.04 : 1.48, lightSteel, 0.87);
      const k = (i + 1) % 3;
      for (let j = 0; j < n; j++) {
        const a = j / n,
          b = (j + 1) / n;
        const s = mix(base[i], crown[i], a),
          t = mix(base[k], crown[k], a);
        pipe(out, s, t, detail ? 0.57 : 0.74, steel);
        if (detail || i === 1) {
          const end = mix(base[k], crown[k], b);
          if (j % 2) pipe(out, t, mix(base[i], crown[i], b), detail ? 0.53 : 0.62, lightSteel);
          else pipe(out, s, end, detail ? 0.53 : 0.62, lightSteel);
        }
        if (detail === 3 && j % 2 === 0) pipe(out, t, mix(base[i], crown[i], b), 0.31, darkSteel);
      }
    }
    const [x, X] = side === 1 ? [35.64, 42.56] : [-42.56, -35.64];
    box(out, 'housing', x, X, 42.97, 53.1, -0.3, 7.38, painted);
    box(out, 'steel', x - 0.24, X + 0.24, 52.91, 53.24, -0.49, 7.56, lightSteel);
    const angle = side === 1 ? 0 : Math.PI;
    pipe(
      out,
      onDish(0.95, angle, -0.75),
      mount(side * 38.6, 43.38, 6.22),
      detail ? 2.24 : 2.68,
      lightSteel,
      2.15,
    );
    if (detail) {
      const fa = facade([mount(0, 0, 7.4)[0], mount(0, 0, 7.4)[2]], frame.along);
      for (const z of [44.88, 48.17, 51.21])
        for (const k of [x + 1.78, x + 3.44, x + 5.21])
          opening(out, fa, k, z, detail > 1 ? 0.91 : 0.78, 0.65, {
            glassSlot: 'steel',
            frameSlot: 'steel',
            glass,
            frameWidth: 0,
            sill: false,
            d: 0.025,
          });
      worldBeam(out, [side * 42.2, 49.67, 4.44], [side * 47.74, 49.67, 4.44], 0.48, lightSteel);
      worldBeam(out, [side * 50.1, 0.61, 12.3], [side * 42.35, 46.47, 6.55], 0.67, steel);
    }
  }
  for (const [u, d] of [
    [-18.5, -8.64],
    [18.5, -8.64],
    [-15.2, 8.44],
    [15.2, 8.44],
  ]) {
    pipe(out, mount(u, 2.93, d), point(u * 0.58, 0, -9.4), 1.36, steel);
  }
  if (detail) {
    for (const u of [-26.8, 26.8]) {
      const a = mount(u, 17.1, -6.23),
        b = point(u * 0.94, 6.2, -6.54);
      pipe(out, a, b, 0.88, lightSteel);
      pipe(out, a, point(u * 0.89, -15.05, -0.28), 0.68, steel);
      if (detail > 1) pipe(out, mount(u * 1.39, 2.4, 8.24), b, 0.63, steel);
    }
  }
}
function build(mesh, detail) {
  const out = withFootprintCaps(mesh);
  railBase(out, detail);
  towers(out, detail);
  reflector(out, site.dish, detail, shell);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
