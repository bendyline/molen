import {
  quad4,
  rgb,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  scoria: { slot: 'wall', graph: 'stone_basalt_raw', roughness: 0.98 },
  cut: { slot: 'trim', graph: 'stone_sandstone_raw', roughness: 0.98 },
};

const colors = ['6d5147', '704b43', '624e49', '6b554f', '75534a', '78554b'].map(rgb);
const seam = ['79574f', '805950', '6d5149', '7c665e'].map(rgb);
const cut = rgb('865d52');
const outline = [
  [-0.5, 0.61],
  [-0.483, 0.79],
  [-0.408, 0.966],
  [-0.256, 1.006],
  [0.039, 1.0],
  [0.299, 0.982],
  [0.45, 0.85],
  [0.49, 0.63],
  [0.462, 0.42],
  [0.44, 0.175],
];

function pukao(out, stone, index, detail) {
  const n = [6, 9, 15, 23][detail];
  const [x, z] = stone.center;
  const sl = Math.sin(stone.tilt),
    cl = Math.cos(stone.tilt);
  const sh = Math.sin(stone.heading),
    ch = Math.cos(stone.heading);
  const u = [ch * cl, -sl, sh * cl],
    v = [-sh, 0, ch],
    a = [ch * sl, cl, sh * sl];
  const profile =
    detail === 0
      ? [outline[0], outline[3], outline[6], outline[8], outline[9]]
      : detail === 1
        ? [outline[0], outline[2], outline[4], outline[6], outline[7], outline[9]]
        : outline;
  const center = (length) => [x + a[0] * length, a[1] * length, z + a[2] * length];
  const seamAngle = (index + 1) * 0.912;
  const points = profile.map(([t, r], row) => {
    const at = center(t * stone.length);
    return Array.from({ length: n }, (_, i) => {
      const angle = (i * 2 * Math.PI) / n;
      const marks =
        1 +
        (detail ? 0.091 : 0.055) * Math.cos(3 * angle + seamAngle) +
        0.048 * Math.sin(5 * angle - 0.61 * row);
      const px = stone.radius * r * marks * Math.cos(angle),
        pz = stone.radius * r * marks * Math.sin(angle);
      return at.map((v0, k) => v0 + u[k] * px + v[k] * pz);
    });
  });
  // Bury the last few centimetres so the scoria meets the sampled ground even on a slope.
  const floor = Math.min(...points.flat().map((p) => p[1]));
  const raise = stone.base - floor - 0.16;
  const P = (p) => [p[0], p[1] + raise, p[2]];
  const c = colors[index % colors.length];
  for (let row = 0; row < points.length - 1; row++) {
    const lower = points[row],
      upper = points[row + 1];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const tint =
        detail > 1 && (index + row * 3 + i * 5) % 11 < 2 ? seam[(i + row) % seam.length] : c;
      quad4(out, 'scoria', P(lower[i]), P(upper[i]), P(upper[j]), P(lower[j]), tint);
    }
  }
  const bottom = P(center(profile[0][0] * stone.length));
  const top = P(center(profile.at(-1)[0] * stone.length));
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    tri(out, 'scoria', bottom, P(points[0][i]), P(points[0][j]), c);
    tri(out, 'cut', top, P(points.at(-1)[j]), P(points.at(-1)[i]), cut);
  }
}

function build(out, detail) {
  for (const [index, stone] of site.stones.entries()) pukao(out, stone, index, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
