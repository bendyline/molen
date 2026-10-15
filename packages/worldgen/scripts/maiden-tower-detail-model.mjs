/** N0638 source-local reviewed restoration; historical buildMaiden remains unchanged. */
import { beam, loft, radialRing } from './authored-structure-mesh.mjs';
import { archBay, triangle } from './heritage-tower-detail-mesh.mjs';
import { hipRoof } from './lighthouse-expansion-models.mjs';
import {
  lathe as originalLathe,
  railRing as originalRailRing,
  piercedFacade,
  transformed,
} from './lighthouse-models.mjs';
import { box, tube as originalTube } from './structure-mesh.mjs';

const pale = [0.76, 0.74, 0.66],
  cream = [0.83, 0.81, 0.72],
  dark = [0.11, 0.135, 0.14],
  red = [0.43, 0.15, 0.1];
const rect = (y, rx, rz) => [
  [-rx, y, -rz],
  [-rx, y, rz],
  [rx, y, rz],
  [rx, y, -rz],
];
function facadeBlock(
  out,
  { cx = 0, cz = 0, rx, rz, y0, y1, slot = 'rubble', color = pale, windows = [] },
) {
  const o = transformed(out, 0, [cx, 0, cz]);
  for (let f = 0; f < 4; f++) {
    piercedFacade(transformed(o, (f * Math.PI) / 2), {
      half: f % 2 ? rz : rx,
      z: f % 2 ? rx : rz,
      y0,
      y1,
      slot,
      color,
      holes: windows.filter((h) => h.face === undefined || h.face === f),
    });
    for (const h of windows.filter((h) => (h.face === undefined || h.face === f) && h.arch)) {
      const w = transformed(o, (f * Math.PI) / 2),
        rise = h.w / 2;
      archBay(
        w,
        slot,
        h.x,
        h.w,
        h.y,
        h.y + h.h - rise,
        rise,
        h.y + h.h,
        f % 2 ? rx : rz,
        h.depth ?? 0.32,
        color,
        { back: false, trim: 0 },
      );
    }
  }
  box(o, slot, [-rx, y1 - 0.1, -rz], [rx, y1, rz], color);
}

function detail(out, mode) {
  const segmentsFor = (close, street, district) =>
    mode === 'master' || mode === 'closeup' ? close : mode === 'street' ? street : district;
  const lathe = (o, s, p, c, n, center) =>
    originalLathe(o, s, p, c, segmentsFor(n, Math.min(n, 64), Math.min(n, 16)), center);
  const tube = (o, s, a, b, r, c, n) =>
    originalTube(o, s, a, b, r, c, segmentsFor(n, Math.min(n, 6), Math.min(n, 4)));
  const railRing = (o, y, r, h, c, n) => {
    if (mode === 'master' || mode === 'closeup') return originalRailRing(o, y, r, h, c, n);
    const count = mode === 'street' ? 24 : 8;
    for (let i = 0; i < count; i++) {
      const a = (i * Math.PI * 2) / count,
        b = ((i + 1) * Math.PI * 2) / count;
      for (const yy of [y + h * 0.48, y + h])
        beam(
          o,
          'metal',
          [Math.cos(a) * r, yy, Math.sin(a) * r],
          [Math.cos(b) * r, yy, Math.sin(b) * r],
          0.05,
          0.05,
          c,
        );
      beam(
        o,
        'metal',
        [Math.cos(a) * r, y, Math.sin(a) * r],
        [Math.cos(a) * r, y + h, Math.sin(a) * r],
        0.055,
        0.055,
        c,
      );
    }
  };
  function build(target) {
    const out = transformed(target, 0, [5, 0, -2.2]);
    // Restored 2023 ensemble: open castle courtyard, single western pavilion and bulbous upper room.
    loft(
      transformed(out, 0, [1, 0, 2.2]),
      'ashlar',
      [rect(0, 10, 11.5), rect(0.8, 10, 11.5)],
      pale,
    );
    box(out, 'granite', [-9, 0.8, -9.3], [11, 0.95, 13.7], cream);
    const rawTower = transformed(out, 0, [-5, 0, 2.2]),
      factor = 6.4 / 7.6;
    const tower = Object.fromEntries(
      ['addQuad', 'addTriangle', 'addConvexPolygon'].map((method) => [
        method,
        (slot, ref, p, n, uv, color) => {
          const q = p.map(([x, y, z]) => [x * factor, y, z * factor]),
            normal = [n[0] / factor, n[1], n[2] / factor],
            len = Math.hypot(...normal);
          rawTower[method](
            slot,
            ref,
            q,
            normal.map((v) => v / len),
            uv,
            color,
          );
        },
      ]),
    );
    facadeBlock(tower, {
      rx: 3.8,
      rz: 3.8,
      y0: 0.95,
      y1: 15.6,
      slot: 'ashlar',
      color: [0.67, 0.65, 0.55],
      windows: [
        { x: 0, y: 3.1, w: 1.05, h: 2.4, depth: 0.4, trim: 0, face: 1, arch: true },
        { x: 0, y: 1.15, w: 1.45, h: 2.5, depth: 0.45, trim: 0, face: 0, arch: true },
        { x: 0, y: 7.5, w: 0.25, h: 1.05, trim: 0 },
        { x: 0, y: 11.3, w: 0.25, h: 1.05, trim: 0 },
        { x: 0, y: 13.35, w: 0.75, h: 1.15, trim: 0 },
      ],
    });
    // Projecting octagonal platform and chamfered plaster bracket undersides.
    loft(
      tower,
      'plaster',
      [
        radialRing(14.4, 3.8, 3.8, 8, [0, 0], Math.PI / 8),
        radialRing(15.7, 5.02, 5.02, 8, [0, 0], Math.PI / 8),
        radialRing(16.04, 5.12, 5.12, 8, [0, 0], Math.PI / 8),
      ],
      cream,
    );
    const radius = 3.85,
      apothem = radius * Math.cos(Math.PI / 8),
      half = radius * Math.sin(Math.PI / 8);
    for (let f = 0; f < 8; f++) {
      const o = transformed(tower, (f * Math.PI) / 4);
      piercedFacade(o, {
        half,
        z: apothem,
        y0: 16.04,
        y1: 19.55,
        slot: 'plaster',
        color: [0.91, 0.87, 0.78],
        holes: [
          { x: 0, y: 16.7, w: 0.96, h: 2.35, depth: 0.22, trim: mode === 'district' ? 0 : 0.12 },
        ],
      });
      for (const x of [-half + 0.1, half - 0.1])
        box(o, 'plaster', [x - 0.1, 16.05, apothem - 0.01], [x + 0.1, 19.5, apothem + 0.12], cream);
      for (const y of mode === 'district' ? [18.05] : [17.37, 18.05, 18.75])
        beam(o, 'wood', [-0.48, y, apothem - 0.2], [0.48, y, apothem - 0.2], 0.055, 0.055, cream);
      beam(o, 'wood', [0, 16.7, apothem - 0.18], [0, 19.05, apothem - 0.18], 0.06, 0.06, cream);
    }
    railRing(tower, 16.07, 4.85, 0.92, [0.26, 0.24, 0.2], 48);
    for (let f = 0; f < 8; f++) {
      if (mode === 'district') break;
      const o = transformed(tower, (f * Math.PI) / 4);
      for (let j = -segmentsFor(2, 2, 1); j <= segmentsFor(2, 2, 1); j++) {
        const x = j * 0.48;
        beam(o, 'metal', [x - 0.23, 16.24, 4.49], [x + 0.23, 16.87, 4.49], 0.035, 0.035, dark);
        beam(o, 'metal', [x + 0.23, 16.24, 4.49], [x - 0.23, 16.87, 4.49], 0.035, 0.035, dark);
      }
    }
    const dome = [
      [19.55, 4.1],
      [19.75, 4.24],
      [20.05, 3.95],
      [20.7, 3.73],
      [21.6, 3.15],
      [22.5, 2.44],
      [23.35, 2.16],
      [23.7, 2.15],
      [23.9, 2.35],
    ];
    lathe(tower, 'metal', dome, [0.24, 0.245, 0.22], 96);
    for (let i = 0; i < segmentsFor(16, 16, 0); i++) {
      const a = (i * Math.PI * 2) / 16;
      for (let j = 1; j < dome.length; j++)
        tube(
          tower,
          'metal',
          [
            Math.sin(a) * (dome[j - 1][1] + 0.025),
            dome[j - 1][0],
            Math.cos(a) * (dome[j - 1][1] + 0.025),
          ],
          [Math.sin(a) * (dome[j][1] + 0.025), dome[j][0], Math.cos(a) * (dome[j][1] + 0.025)],
          0.022,
          [0.37, 0.36, 0.31],
          8,
        );
    }
    railRing(tower, 23.93, 2.18, 0.7, [0.32, 0.29, 0.23], 32);
    lathe(
      tower,
      'metal',
      [
        [23.9, 0.38],
        [25.0, 0.2],
        [31.2, 0.13],
        [31.5, 0.25],
        [31.8, 0.09],
        [32.5, 0.045],
      ],
      [0.81, 0.79, 0.68],
      32,
    );
    // Courtyard walls and tiled crenel coping are distinct from the post-2000 restaurant additions.
    for (const [cx, cz, rx, rz] of [
      [1, -8.7, 9.25, 0.4],
      [1, 12.55, 9.25, 0.4],
      [10.3, 1.95, 0.4, 10.75],
      [-8.2, 1.95, 0.4, 10.75],
    ]) {
      box(out, 'ashlar', [cx - rx, 0.95, cz - rz], [cx + rx, 5.35, cz + rz], [0.7, 0.68, 0.58]);
      const alongX = rx > rz,
        len = alongX ? rx : rz;
      for (let v = -len + 0.7; v < len; v += 2.25) {
        const x = alongX ? cx + v : cx,
          z = alongX ? cz : cz + v;
        box(out, 'ashlar', [x - 0.63, 5.35, z - 0.63], [x + 0.63, 6.13, z + 0.63], pale);
        if (mode === 'district') {
          const ring = [
            [x - 0.71, 6.13, z - 0.71],
            [x - 0.71, 6.13, z + 0.71],
            [x + 0.71, 6.13, z + 0.71],
            [x + 0.71, 6.13, z - 0.71],
          ];
          for (let side = 0; side < 4; side++)
            triangle(out, 'tiles', [ring[side], ring[(side + 1) % 4], [x, 6.43, z]], red);
        } else hipRoof(out, x, z, 0.71, 0.71, 6.13, 0.3, red);
      }
    }
    // West pavilion retained by the official restoration, with repeated tall windows and central pediment.
    facadeBlock(out, {
      cx: 0.9,
      cz: -6.29,
      rx: 9.16,
      rz: 2.45,
      y0: 0.95,
      y1: 4.95,
      slot: 'plaster',
      color: [0.88, 0.87, 0.79],
      windows: [-6.6, -4.4, -2.2, 2.2, 4.4, 6.6]
        .map((x) => ({ x, y: 2, w: 1.2, h: 2.2, trim: mode === 'district' ? 0 : 0.12, face: 2 }))
        .concat([{ x: 0, y: 1.15, w: 1.5, h: 3.3, trim: mode === 'district' ? 0 : 0.15, face: 2 }]),
    });
    hipRoof(out, 0.9, -6.29, 9.4, 2.7, 4.95, 1.22, red);
    const o = transformed(out, Math.PI, [0.9, 0, -8.86]);
    beam(o, 'plaster', [-2.2, 4.8, 0], [0, 6.15, 0], 0.28, 0.34, cream);
    beam(o, 'plaster', [0, 6.15, 0], [2.2, 4.8, 0], 0.28, 0.34, cream);
    // The upper entry opens toward the north courtyard; its stair joins the court floor.
    for (let i = 0; i < 11; i++)
      box(
        out,
        'granite',
        [-1.8 + i * 0.28, 0.95, 1.4],
        [-1.52 + i * 0.28, 3.15 - i * 0.2, 3],
        cream,
      );
    for (const z of [1.35, 3.05])
      beam(out, 'metal', [-1.8, 4.05, z], [1.28, 1.85, z], 0.055, 0.055, [0.56, 0.51, 0.39]);
    for (let i = 0; i < 14; i++)
      box(out, 'metal', [-8.3 + i * 1.36, 0.95, 13], [-8.18 + i * 1.36, 1.22, 13.2], dark);
  }

  build(out);
  // Reconstructed timber covertways at the restored court wall-walk level. Native coordinates
  // follow the mapped historic fort rectangle; this is a visual exterior, not visitor navigation.
  for (const [a, b] of [
    [
      [3.8, 4.1, 8.5],
      [14.3, 4.1, 8.5],
    ],
    [
      [14.3, 4.1, -4.7],
      [14.3, 4.1, 8.5],
    ],
    [
      [3.8, 4.1, -4.7],
      [14.3, 4.1, -4.7],
    ],
  ]) {
    const x0 = Math.min(a[0], b[0]),
      x1 = Math.max(a[0], b[0]),
      z0 = Math.min(a[2], b[2]),
      z1 = Math.max(a[2], b[2]),
      along = x1 > x0;
    box(
      out,
      'wood',
      [x0 - (along ? 0 : 0.7), 3.96, z0 - (along ? 0.7 : 0)],
      [x1 + (along ? 0 : 0.7), 4.1, z1 + (along ? 0.7 : 0)],
      [0.64, 0.57, 0.44],
    );
    const n = segmentsFor(Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.65), 10, 4);
    for (const side of [-1, 1]) {
      const start = [a[0] + (along ? 0 : side * 0.7), 4.95, a[2] + (along ? side * 0.7 : 0)],
        end = [b[0] + (along ? 0 : side * 0.7), 4.95, b[2] + (along ? side * 0.7 : 0)];
      beam(out, 'metal', start, end, 0.045, 0.045, dark);
      for (let i = 0; i <= n; i++) {
        const p = start.map((v, k) => v + ((end[k] - v) * i) / n);
        beam(out, 'metal', [p[0], 4.1, p[2]], p, 0.035, 0.035, dark);
      }
    }
  }
  // Twelve rising treads join the court floor to the north walkway; tread count survives all near levels.
  for (let i = 0; i < 12; i++)
    box(
      out,
      'wood',
      [8.7, 0.95, 4.9 + i * 0.3],
      [10.1, 0.95 + (i + 1) * 0.2625, 4.9 + (i + 1) * 0.3],
      [0.64, 0.57, 0.44],
    );
}
export function buildMaidenReviewed(out) {
  detail(out, 'master');
}
export function buildMaidenCloseup(out) {
  detail(out, 'closeup');
}
export function buildMaidenStreet(out) {
  detail(out, 'street');
}
export function buildMaidenDistrict(out) {
  detail(out, 'district');
}
