/** Surviving Bent Pyramid: two measured slopes, retained limestone casing and exposed crown. */
import './install-deterministic-math.mjs';
import { normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const pale = rgb('c2b397'),
  worn = rgb('a9977a'),
  core = rgb('99866e'),
  joint = rgb('83745f'),
  dark = rgb('34332e');
const H = 104.71,
  BEND = 47.04,
  half = (y) => (y <= BEND ? 94 - (34 * y) / BEND : 60 - (59.55 * (y - BEND)) / (H - BEND));
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.96, metallic: 0 },
  raw: { slot: 'trim', graph: 'stone_limestone_weathered', roughness: 0.97, metallic: 0 },
  opening: { slot: 'window', localRef: 'palette:#ffffff', roughness: 1, metallic: 0 },
};
function build(out, _frame, d = 3) {
  const rows = [8, 23, 58, 105][d],
    maxCols = [5, 12, 28, 56][d];
  const ys = [
    ...new Set([
      -1,
      0,
      12.2,
      13.6,
      33,
      34.3,
      BEND,
      H - 1,
      H,
      ...Array.from({ length: rows - 1 }, (_, i) => ((i + 1) * H) / rows),
    ]),
  ].sort((a, b) => a - b);
  for (let side = 0; side < 4; side++)
    for (let row = 0; row < ys.length - 1; row++) {
      const y0 = ys[row],
        y1 = ys[row + 1],
        mid = (y0 + y1) / 2,
        r = half(Math.max(0, mid)),
        cols = Math.max(1, Math.ceil((maxCols * r) / 94));
      const hole =
        (side === 0 && y0 >= 12.2 && y1 <= 13.6) || (side === 3 && y0 >= 33 && y1 <= 34.3);
      const us = [
        ...new Set([
          -1,
          1,
          ...Array.from({ length: cols - 1 }, (_, i) => -1 + (2 * (i + 1)) / cols),
          ...(hole ? [-0.6 / r, 0.6 / r] : []),
        ]),
      ].sort((a, b) => a - b);
      const point = (u, y, depth = 0) => {
        const rr = half(Math.max(0, y)),
          wave = d < 2 ? 0 : (1 - u * u) * 0.17 * Math.sin(y * 2.47 + u * 13 + side * 0.71),
          p = [u * rr, y, -rr - wave + depth];
        return side === 0
          ? p
          : side === 1
            ? [-p[2], y, p[0]]
            : side === 2
              ? [-p[0], y, -p[2]]
              : [p[2], y, -p[0]];
      };
      for (let col = 0; col < us.length - 1; col++) {
        const u0 = us[col],
          u1 = us[col + 1],
          center = ((u0 + u1) * r) / 2,
          p = [point(u0, y0), point(u1, y0), point(u1, y1), point(u0, y1)];
        if (hole && Math.abs(center) < 0.6) {
          const inset = p.map((p, i) => point(i === 0 || i === 3 ? u0 : u1, p[1], 0.65));
          inset.reverse();
          quad(out, 'opening', inset, normalFor(...inset), dark);
          inset.reverse();
          for (const k of [0, 2]) {
            const q = [p[k], inset[k], inset[(k + 1) % 4], p[(k + 1) % 4]];
            quad(out, 'raw', q, normalFor(...q), joint);
          }
          continue;
        }
        const noise = Math.sin(row * 17.3 + col * 8.13 + side * 6.7),
          lost =
            mid > 94 ||
            mid < 4 ||
            (mid > 73 && mid < 79 && Math.sin(center / 9 + side * 4) > 0.25) ||
            (Math.abs(center) > r * 0.92 && Math.sin(mid / 10 + side) > 0.1),
          color = lost ? (noise > 0.3 ? core : worn) : pale;
        p.reverse();
        quad(out, lost ? 'raw' : 'stone', p, normalFor(...p), color);
      }
    }
  // Small surviving irregular summit; no reconstructed pristine capstone.
  const r = half(H),
    p = [
      [-r, H, -r],
      [r, H, -r],
      [r, H, r],
      [-r, H, r],
    ];
  quad(out, 'raw', p.reverse(), [0, 1, 0], worn);
}
export const bentPyramidSkyline = (out, frame) => build(out, frame, 0);
export const bentPyramidDistrict = (out, frame) => build(out, frame, 1);
export const bentPyramidStreet = (out, frame) => build(out, frame, 2);
export const bentPyramidModel = {
  id: 'bent_pyramid',
  key: 'bent_pyramid',
  recipe: 'structure-bent-pyramid.mjs',
  cell: 'st/stq',
  title: 'Bent Pyramid',
  category: 'archaeological',
  build,
  surfaces,
  brief:
    'Surviving Dahshur Bent Pyramid:188m square lower footprint, steep pale limestone casing to47.04m, abrupt shallower upper slope to104.71m, weathered/exposed stone patches and ragged dark crown, small north/west passage mouths. Main pyramid only; satellite pyramid, enclosure, temples, causeway, access stairs and interior chambers excluded.',
  portableGroundY: 0,
  camera: [245, 146, -275],
  lookAt: [0, 44, 0],
  qaCameras: [
    { name: 'north-casing-and-passage', position: [85, 40, -140], lookAt: [0, 28, -65] },
    { name: 'slope-change-and-crown', position: [140, 114, -140], lookAt: [0, 72, 0] },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundCutout: {
    outline: [
      [-89.13925311151829, -90.04619318113356],
      [89.13925311151829, -90.04619318113356],
      [89.13925311151829, 90.04619318113356],
      [-89.13925311151829, 90.04619318113356],
    ],
    basis:
      'Native main-pyramid ring only, fully beneath the physical188m masonry shell; removes pyramid DEM returns without changing original source heights.',
  },
  groundContactBasis:
    'Native cardinal pyramid footprint centroid; standard unmodified Terrarium source heights referenced to dry desert160m east. Native footprint cutout removes pyramid returns only beneath actual masonry. Coarse DEM retains artificial pyramid-return mounds outside that ring; geographic placement is approximate and does not certify excavation-level contact. Portable asset stage uses a flat floor for geometry inspection.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-bent-pyramid.mjs',
    level: 'skyline',
    export: 'bentPyramidSkyline',
    errorMeters: 1.3,
    surfaces,
    authoredLevels: {
      district: { export: 'bentPyramidDistrict', errorMeters: 0.5, surfaces },
      street: { export: 'bentPyramidStreet', errorMeters: 0.15, surfaces },
    },
  },
  limitations: [
    'Approximate surviving188m base and104.71m overall height; native mapped plan is coarser/narrower and remains the geographic control. Native building-part47.04m breakpoint adopted; article rounds this to49m. No survey claim.',
    'One inspected clear public-domain Qualla panorama controls identifying pale casing, bend and dark weathered crown. Stone loss/color patch positions, hidden faces and exact portal depths are medium-fi interpretations; original pixels are not textures.',
    'The coarse source DEM has artificial pyramid returns outside the native cutout and may obscure lower casing in geographic views. This is a recorded host-terrain limitation; pyramid geometry is not fitted to it.',
    'Main pyramid exterior only. Satellite pyramid and detached structures, enclosure/causeway, modern visitor stair and interior are excluded. Footing extends1m below visualization datum; no fitted terrain platform or reshaped elevation field.',
  ],
};
