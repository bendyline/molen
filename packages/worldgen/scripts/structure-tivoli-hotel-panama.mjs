/** Photo-guided full Tivoli Hotel, explicitly dated to the cleared1923NARA aerial. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { box, quad } from './structure-mesh.mjs';

const plan = JSON.parse(
  fs.readFileSync(
    new URL(
      '../../../content/worldgen/source/places/d1/d1x/tivoli_hotel_panama/plan-controls.json',
      import.meta.url,
    ),
  ),
);
const colors = {
  wall: rgb('e2e0cc'),
  trim: rgb('ece8d4'),
  base: rgb('a5a390'),
  roof: rgb('76796e'),
  dark: rgb('39483f'),
  metal: rgb('a3a393'),
};
const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.97, metallic: 0 },
  trim: { slot: 'trim', graph: 'wood_plain', roughness: 0.92, metallic: 0 },
  base: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.99, metallic: 0 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.95, metallic: 0 },
  dark: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.96, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.88, metallic: 0.12 },
};
function frame(a, b) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    n = [-u[1], u[0]];
  return {
    len,
    u,
    n,
    p: (x, y, z = 0) => [a[0] + u[0] * x + n[0] * z, y, a[1] + u[1] * x + n[1] * z],
  };
}
function panel(o, f, s, x, y, w, h, depth = 0, col = colors[s]) {
  const ps = [
    f.p(x - w / 2, y, depth),
    f.p(x + w / 2, y, depth),
    f.p(x + w / 2, y + h, depth),
    f.p(x - w / 2, y + h, depth),
  ];
  quad(o, s, ps, [f.n[0], 0, f.n[1]], col);
}
function B(o, s, lo, hi, col = colors[s]) {
  box(o, s, lo, hi, col);
}
function localBox(o, f, s, x, y, z, w, h, deep, col = colors[s]) {
  const q = new Proxy(o, {
    get(t, k) {
      if (k === 'addQuad')
        return (slot, mat, ps, n, uv, c) =>
          t.addQuad(
            slot,
            mat,
            ps.map((p) => f.p(...p)),
            [f.u[0] * n[0] + f.n[0] * n[2], n[1], f.u[1] * n[0] + f.n[1] * n[2]],
            uv,
            c,
          );
      const v = t[k];
      return typeof v === 'function' ? v.bind(t) : v;
    },
  });
  box(q, s, [x - w / 2, y, z - deep / 2], [x + w / 2, y + h, z + deep / 2], col);
}
function Q(o, s, ps, n, col = colors[s]) {
  if (normalFor(...ps).reduce((v, a, i) => v + a * n[i], 0) < 0) ps = [...ps].reverse();
  quad(o, s, ps, normalFor(...ps), col);
}
function triangle(o, s, ps, n, col = colors[s]) {
  if (normalFor(...ps).reduce((v, a, i) => v + a * n[i], 0) < 0) ps = [ps[0], ps[2], ps[1]];
  o.addTriangle(
    s,
    'palette:#ffffff',
    ps,
    normalFor(...ps),
    ps.map((p) => [p[0], p[2]]),
    col,
  );
}
function window(o, f, d, x, y, w, h) {
  panel(o, f, 'dark', x, y, w, h, -0.14);
  if (d === 0) return;
  if (d < 3) {
    panel(o, f, 'trim', x, y, w + 0.16, 0.09, 0.02);
    panel(o, f, 'trim', x, y + h - 0.08, w + 0.16, 0.09, 0.02);
    for (const xx of [x - w / 2, x + w / 2]) panel(o, f, 'trim', xx, y, 0.08, h, 0.02);
    if (d === 2) {
      localBox(o, f, 'trim', x, y, 0.05, 0.065, h, 0.08);
      panel(o, f, 'trim', x, y + h * 0.6, w, 0.065, 0.04);
    }
    return;
  }
  for (const xx of [x - w / 2, x, x + w / 2]) localBox(o, f, 'trim', xx, y, 0.055, 0.075, h, 0.11);
  for (const yy of [y, y + h * 0.36, y + h * 0.68, y + h - 0.07])
    localBox(o, f, 'trim', x, yy, 0.055, w, 0.075, 0.11);
  // Fine screening is geometry, not photo pixels; broad panes stay restrained and dark.
  for (const xx of [x - w * 0.25, x + w * 0.25])
    panel(o, f, 'metal', xx, y + 0.08, 0.022, h - 0.16, -0.1);
}
function facade(o, a, b, h, d, levels = 3, screened = false) {
  const f = frame(a, b),
    step = (h - 2.3) / levels;
  panel(o, f, 'wall', f.len / 2, 2.3, f.len, h - 2.3, -0.24);
  if (d === 0) {
    for (let i = 0; i < levels; i++) {
      if (screened)
        panel(o, f, 'dark', f.len / 2, 2.58 + i * step, f.len - 0.4, step - 0.65, 0.005);
      else {
        const count = Math.max(1, Math.round(f.len / 10));
        for (let j = 0; j < count; j++)
          panel(
            o,
            f,
            'dark',
            ((j + 0.5) * f.len) / count,
            2.58 + i * step,
            Math.min(2.0, (f.len / count) * 0.6),
            step - 0.65,
            0.005,
          );
      }
    }
    for (let i = 0; i <= levels; i++)
      panel(o, f, 'trim', f.len / 2, 2.23 + i * step, f.len + 0.15, 0.18, 0.02);
    return;
  }
  const count = Math.max(1, Math.round(f.len / (d === 1 ? 5.4 : 3.8))),
    pitch = f.len / count;
  for (let j = 0; j < count; j++)
    for (let i = 0; i < levels; i++)
      window(
        o,
        f,
        d,
        (j + 0.5) * pitch,
        2.55 + i * step,
        screened ? Math.min(pitch - 0.65, 3) : Math.min(2.1, pitch * 0.58),
        step - 0.6,
      );
  for (let i = 0; i <= levels; i++) {
    const y = 2.23 + i * step;
    if (d === 1) panel(o, f, 'trim', f.len / 2, y, f.len + 0.15, 0.2, 0.03);
    else localBox(o, f, 'trim', f.len / 2, y, 0.06, f.len + 0.15, 0.2, 0.25);
  }
  for (let j = 0; j <= count; j++) {
    if (d === 1) panel(o, f, 'trim', j * pitch, 2.3, 0.19, h - 2.3, 0.045);
    else localBox(o, f, 'trim', j * pitch, 2.3, 0.03, 0.2, h - 2.3, 0.28);
  }
  if (d > 1)
    for (let x = pitch / 2; x < f.len; x += pitch * 2) {
      panel(o, f, 'dark', x, 0.7, 0.9, 0.9, 0.018);
      if (d === 3)
        for (const xx of [x - 0.22, x, x + 0.22]) panel(o, f, 'metal', xx, 0.7, 0.035, 0.9, 0.025);
    }
}
function hip(o, lo, hi, y, rise, axis = 'x') {
  B(o, 'trim', [lo[0] - 0.7, y - 0.13, lo[1] - 0.7], [hi[0] + 0.7, y - 0.03, hi[1] + 0.7]);
  const cx = (lo[0] + hi[0]) / 2,
    cz = (lo[1] + hi[1]) / 2,
    a = axis === 'x' ? [lo[0], cz] : [cx, lo[1]],
    b = axis === 'x' ? [hi[0], cz] : [cx, hi[1]],
    f = frame(a, b),
    w = (axis === 'x' ? hi[1] - lo[1] : hi[0] - lo[0]) + 1.4,
    run = Math.min(w / 2, f.len * 0.35),
    p = f.p;
  for (const s of [-1, 1])
    Q(
      o,
      'roof',
      [
        p(-0.7, y, (s * w) / 2),
        p(f.len + 0.7, y, (s * w) / 2),
        p(f.len - run, y + rise, 0),
        p(run, y + rise, 0),
      ],
      [0, 1, 0],
    );
  triangle(o, 'roof', [p(-0.7, y, -w / 2), p(-0.7, y, w / 2), p(run, y + rise, 0)], [0, 1, 0]);
  triangle(
    o,
    'roof',
    [p(f.len + 0.7, y, w / 2), p(f.len + 0.7, y, -w / 2), p(f.len - run, y + rise, 0)],
    [0, 1, 0],
  );
}
function bodies(o, d) {
  for (const m of plan.estimatedModules) {
    const [x0, z0] = m.lo,
      [x1, z1] = m.hi;
    B(o, 'base', [x0, -0.45, z0], [x1, 2.3, z1]);
    const coreLo = [x0 + 1.1, 2.3, z0 + 1.1],
      coreHi = [x1 - 1.1, m.eaves, z1 - 1.1];
    if (m.name === '1911-rear-wing') coreHi[2] = -10.8;
    if (m.name === 'central-front') coreLo[2] = 2.9;
    if (m.name === 'visible-low-side-block') coreHi[0] = -36.8;
    B(o, 'wall', coreLo, coreHi);
  }
  const face = (a, b, h = 13.6, levels = 3, screened = false) =>
    facade(o, a, b, h, d, levels, screened);
  // All exposed front/side/rear runs; internal intersections are not invented facades.
  face([-24, 5], [-8, 5], 13.6, 3, true);
  face([8, 5], [24, 5], 13.6, 3, true);
  face([-12, -12], [-38, -12]);
  face([38, -12], [12, -12]);
  face([-38, 23], [-24, 23]);
  face([24, 23], [38, 23]);
  face([-38, -12], [-38, 23]);
  face([38, 23], [38, -12]);
  face([-24, 23], [-24, 5], 13.6, 3, true);
  face([24, 5], [24, 23], 13.6, 3, true);
  face([12, -42], [-12, -42], 15.6);
  face([-12, -42], [-12, -12], 15.6);
  face([12, -12], [12, -42], 15.6);
  face([-8, 10], [8, 10], 15.6);
  face([-8, 5], [-8, 10], 15.6);
  face([8, 10], [8, 5], 15.6);
  face([-54, 18], [-38, 18], 7.2, 2);
  face([-54, 1], [-54, 18], 7.2, 2);
  face([-38, 1], [-54, 1], 7.2, 2);
  hip(o, [-38, -12], [38, 5], 13.62, 3.7, 'x');
  hip(o, [-38, -12], [-24, 23], 13.64, 3.7, 'z');
  hip(o, [24, -12], [38, 23], 13.64, 3.7, 'z');
  hip(o, [-12, -42], [12, -12], 15.63, 4.0, 'z');
  hip(o, [-8, 3], [8, 10], 15.65, 3.5, 'x');
  // Low flat-roof attached side block visible in the dated aerial.
  B(o, 'trim', [-54.2, 7.15, 0.8], [-37.8, 7.45, 18.2]);
  if (d > 1)
    for (const [x, z] of [
      [-31, 8],
      [31, 8],
      [-20, -3],
      [20, -3],
      [0, -31],
    ]) {
      const y = Math.abs(x) > 25 ? 17.8 : Math.abs(z) > 20 ? 20.1 : 17.6;
      B(o, 'trim', [x - 0.52, y - 0.6, z - 0.65], [x + 0.52, y + 0.25, z + 0.65]);
      B(o, 'metal', [x - 0.68, y + 0.25, z - 0.78], [x + 0.68, y + 0.4, z + 0.78]);
    }
}
function cupola(o, d) {
  const n = d === 0 ? 4 : 8,
    x = 0,
    z = 6,
    y0 = 18.65,
    y1 = 21.9,
    r = 3.5;
  loft(
    o,
    'wall',
    [
      radialRing(y0, r, r, n, [x, z], Math.PI / 8),
      radialRing(y0 + 0.55, r, r, n, [x, z], Math.PI / 8),
    ],
    colors.wall,
  );
  loft(
    o,
    'dark',
    [
      radialRing(y0 + 0.55, r - 0.18, r - 0.18, n, [x, z], Math.PI / 8),
      radialRing(y1, r - 0.18, r - 0.18, n, [x, z], Math.PI / 8),
    ],
    colors.dark,
  );
  const ring = radialRing(y0 + 0.55, r, r, n, [x, z], Math.PI / 8),
    top = radialRing(y1, r, r, n, [x, z], Math.PI / 8);
  for (let i = 0; i < n; i++) {
    const a = ring[i],
      b = ring[(i + 1) % n];
    beam(o, 'trim', a, top[i], 0.2, 0.2, colors.trim);
    beam(o, 'trim', top[i], top[(i + 1) % n], 0.18, 0.23, colors.trim);
    if (d > 1)
      beam(o, 'trim', [a[0], y0 + 0.8, a[2]], [b[0], y0 + 0.8, b[2]], 0.1, 0.15, colors.trim);
  }
  loft(
    o,
    'roof',
    [
      radialRing(y1 + 0.12, r + 0.45, r + 0.45, n, [x, z], Math.PI / 8),
      radialRing(24.2, 0.08, 0.08, n, [x, z], Math.PI / 8),
    ],
    colors.roof,
  );
  if (d > 0) {
    beam(o, 'trim', [x, 24.2, z], [x, 25.3, z], 0.085, 0.085, colors.trim);
  }
}
function porch(o, d) {
  for (const x of [-3.2, 3.2])
    for (const z of [10.7, 17.4])
      B(o, 'trim', [x - 0.18, -0.4, z - 0.18], [x + 0.18, 4.4, z + 0.18]);
  hip(o, [-3.6, 10.2], [3.6, 17.9], 4.4, 1.35, 'z');
  if (d > 0) {
    for (let j = 0; j < 9; j++)
      B(o, 'base', [-2.4, j * 0.255, 10.2 - j * 0.32], [2.4, (j + 1) * 0.255, 10.65 - j * 0.32]);
  }
}
function build(o, _f, d = 3) {
  bodies(o, d);
  cupola(o, d);
  porch(o, d);
}
export const tivoliSkyline = (o, f) => build(o, f, 0);
export const tivoliDistrict = (o, f) => build(o, f, 1);
export const tivoliStreet = (o, f) => build(o, f, 2);
export const tivoliHotelModel = {
  id: 'tivoli_hotel_panama',
  key: 'tivoli_hotel_panama',
  recipe: 'structure-tivoli-hotel-panama.mjs',
  cell: 'd1/d1x',
  title: 'Tivoli Hotel, Panama (1923)',
  category: 'hotel',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  appearance: plan.appearance,
  brief:
    'Dated1923whole main TivoliHotel: broad white timber/plaster frame with repeated dark screened verandah/window bays above a raised masonry base, two projecting front crosswings/open forecourt, central higher front/cupola, connected1911rear wing and visible low attached side block. Separate overhanging hipped roofs, small white roof vents, eight-post cupola/hipped cap and intrinsic1913-era entrance porch/porte-cochere/steps. Full plan/metric scale/bearing are photographic estimates at the former-site story coordinate. Historical-only1923-06-16appearance; no default current-world hotel.',
  camera: [110, 57, 124],
  lookAt: [-4, 8, -7],
  portableGroundY: -0.18,
  mediumFiContext: { scale: 3.1 },
  qaCameras: [
    {
      name: 'front-crosswings-screened-verandahs-and-cupola',
      position: [10, 18, 69],
      lookAt: [0, 10, 3],
    },
    { name: 'white-frames-raised-base-and-entry', position: [40, 9, 44], lookAt: [23, 7, 15] },
    {
      name: 'rear-1911-wing-and-independent-hipped-roofs',
      position: [-72, 46, -71],
      lookAt: [-3, 13, -14],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  groundContactBasis:
    plan.geometryBasis +
    ' Fixed open former forecourt approach defines approximate datum before terrain acquisition; modern relief is not a1923survey.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-tivoli-hotel-panama.mjs',
    level: 'skyline',
    export: 'tivoliSkyline',
    errorMeters: 1.5,
    surfaces,
    authoredLevels: {
      district: { export: 'tivoliDistrict', errorMeters: 0.5, surfaces },
      street: { export: 'tivoliStreet', errorMeters: 0.12, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'Historical-only1923-06-16appearance from the exact Qualla-published dated NARAaerial. A one-day explicit appearance interval is used rather than inferring unobserved years. The former hotel no longer stands; default current-world placement is excluded. Modern TupperLaboratory/TivoliBLDG/Smithsoniancampus are not adopted as its footprint or modeled as the hotel.',
    'The complete estimated92mwide/65mdeephotel envelope includes front crosswings, main crossbar, central front/cupola,1911rear addition and visible low attached side block. Dimensions, bearing, eaves13.6/15.6m, cupola24.2m, hidden window rhythms and small engineering sections are photographic medium-fi estimates; no historical measured survey exists in the local evidence. Current source context provides location only.',
    'Exact3663x2929NARA/USmilitary1923aerial governs represented appearance. Earlier781x641ErnestHallen/FMIBfront view guides persistent white frame/dark screened verandah/cupola character; its older covered stair is excluded after the documented1913porte-cocherereplacement. The later porch footprint/section remains bounded, not claimed as a measured design.',
    'Dark screened bays are closed visual surfaces with white timber framing over opaque body, not traversable room interiors. Thin frame grid, roof vent sections/finish, neutral warm-white/grey palette and less-visible elevations are original approximations; monochrome prints do not establish exact paint color. No photographic texture, furnishings, detached camp buildings, road/driveway/garden, people or vehicles.',
    'Fixed open front approach selected before terrain sampling controls approximate groundY0. Hotel plinth/porch footings extend.45m beneath it. Exact1923hill grade/foundation/steps and contact with modern host terrain remain unverified; current relief is preserved without a whole-estate platform or terrain flattening. Fine screened window grids, posts, basal vents and roof fixtures simplify with distance.',
  ],
};
