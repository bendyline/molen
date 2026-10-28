/** Original surviving Valens Aqueduct masonry; measured native XZ, estimated sections/census. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import {
  cross,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const p = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url))),
  F = p.parameters.floorY,
  A = p.parameters.architecturalSections;
const axis = [0.8191520442889918, 0.573576436351046],
  side = [-axis[1], axis[0]],
  dot = (p, a) => p[0] * a[0] + p[1] * a[1],
  sub = (a, b) => a.map((x, i) => x - b[i]),
  C = { stone: rgb('b8b6ad'), trim: rgb('aaa89d'), brick: rgb('8c7064') };
export const surfaces = {
  stone: { slot: 'wall', graph: 'stone_granite', roughness: 0.97, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_granite', roughness: 0.96, metallic: 0 },
  brick: { slot: 'trim', graph: 'brick', roughness: 0.96, metallic: 0 },
};
export const archEvidence = [],
  nativeEvidence = [];
const rings = frame.features.map((f) => f.outline.slice(0, -1)),
  parts = rings.map((ring, index) => {
    const local = ring.map((q) => [dot(q, axis), dot(q, side)]);
    return {
      index,
      ring,
      local,
      min: Math.min(...local.map((q) => q[0])),
      max: Math.max(...local.map((q) => q[0])),
    };
  });
function edges(part, s) {
  const values = [];
  for (let i = 0; i < part.local.length; i++) {
    const a = part.local[i],
      b = part.local[(i + 1) % part.local.length];
    if (
      s >= Math.min(a[0], b[0]) - 1e-8 &&
      s <= Math.max(a[0], b[0]) + 1e-8 &&
      Math.abs(a[0] - b[0]) > 1e-8
    )
      values.push(a[1] + ((b[1] - a[1]) * (s - a[0])) / (b[0] - a[0]));
  }
  if (values.length < 2) throw Error(`No native width at ${s}`);
  return [Math.min(...values), Math.max(...values)];
}
function P(part, s, y, t) {
  const e = edges(part, s),
    v = e[0] + (e[1] - e[0]) * t;
  return [axis[0] * s + side[0] * v, F + y, axis[1] * s + side[1] * v];
}
function T(o, k, q, n, col = C[k]) {
  q = q.map((p) => p.map(Math.fround));
  const c = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...c) < 1e-8) throw Error('Collapsed face');
  if (n && c.reduce((v, x, i) => v + x * n[i], 0) < 0) [q[1], q[2]] = [q[2], q[1]];
  const N = normalFor(...q);
  o.addTriangle(
    k,
    'palette:#ffffff',
    q,
    N,
    q.map((p) => (Math.abs(N[1]) > 0.8 ? [p[0], p[2]] : [dot([p[0], p[2]], axis), p[1]])),
    col,
  );
}
function Q(o, k, q, n, col) {
  T(o, k, q.slice(0, 3), n, col);
  T(o, k, [q[0], q[2], q[3]], n, col);
}
function prism(o, k, part, sa, sb, y0, y1, ta = 0, tb = 1, col) {
  const M = (s, y, t) => P(part, s, y, t),
    u = [axis[0], 0, axis[1]],
    v = [side[0], 0, side[1]];
  for (const [q, n] of [
    [
      [M(sa, y0, ta), M(sb, y0, ta), M(sb, y0, tb), M(sa, y0, tb)],
      [0, -1, 0],
    ],
    [
      [M(sa, y1, ta), M(sb, y1, ta), M(sb, y1, tb), M(sa, y1, tb)],
      [0, 1, 0],
    ],
    [[M(sa, y0, ta), M(sa, y1, ta), M(sa, y1, tb), M(sa, y0, tb)], u.map((x) => -x)],
    [[M(sb, y0, ta), M(sb, y1, ta), M(sb, y1, tb), M(sb, y0, tb)], u],
    [[M(sa, y0, ta), M(sb, y0, ta), M(sb, y1, ta), M(sa, y1, ta)], v.map((x) => -x)],
    [[M(sa, y0, tb), M(sb, y0, tb), M(sb, y1, tb), M(sa, y1, tb)], v],
  ])
    Q(o, k, q, n, col);
}
const area = (r) =>
  r.reduce((s, a, i) => {
    const b = r[(i + 1) % r.length];
    return s + a[0] * b[1] - b[0] * a[1];
  }, 0);
function triangulate(r) {
  const cr = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]),
    ids = r.map((_, i) => i),
    tri = [];
  if (area(r) < 0) ids.reverse();
  while (ids.length > 3) {
    let ok = false;
    for (let j = 0; j < ids.length; j++) {
      const a = ids[(j + ids.length - 1) % ids.length],
        b = ids[j],
        c = ids[(j + 1) % ids.length];
      if (cr(r[a], r[b], r[c]) < 1e-10) continue;
      if (
        ids.some(
          (k) =>
            k !== a &&
            k !== b &&
            k !== c &&
            cr(r[a], r[b], r[k]) >= -1e-10 &&
            cr(r[b], r[c], r[k]) >= -1e-10 &&
            cr(r[c], r[a], r[k]) >= -1e-10,
        )
      )
        continue;
      tri.push([a, b, c]);
      ids.splice(j, 1);
      ok = true;
      break;
    }
    if (!ok) throw Error('Invalid native ring');
  }
  tri.push(ids);
  return tri;
}

function band(o, part, y0, y1) {
  const ring = part.ring;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    Q(
      o,
      'stone',
      [
        [a[0], F + y0, a[1]],
        [b[0], F + y0, b[1]],
        [b[0], F + y1, b[1]],
        [a[0], F + y1, a[1]],
      ],
      [b[1] - a[1], 0, a[0] - b[0]].map((v) => v * Math.sign(area(ring))),
    );
    nativeEvidence.push([part.index, ...a]);
  }
  for (const [y, n] of [
    [y0, [0, -1, 0]],
    [y1, [0, 1, 0]],
  ])
    for (const ids of triangulate(ring))
      T(
        o,
        'stone',
        ids.map((i) => [ring[i][0], F + y, ring[i][1]]),
        n,
      );
}
function profile(a, x) {
  const t = (x - a.left) / (a.right - a.left),
    h = a.pointed
      ? Math.sqrt(Math.max(0, 1 - (1 - Math.min(t, 1 - t)) * (1 - Math.min(t, 1 - t)))) /
        Math.sqrt(0.75)
      : Math.sqrt(Math.max(0, 1 - 4 * (t - 0.5) * (t - 0.5)));
  return a.shoulder + a.rise * h;
}
function arch(o, part, sa, sb, base, top, i, lod, tier) {
  const width = sb - sa,
    ratio = 0.59 + 0.035 * Math.sin(i * 1.74),
    left = sa + (width * (1 - ratio)) / 2,
    right = sb - (width * (1 - ratio)) / 2,
    shoulder = base + (tier === 'lower' ? A.lowerShoulderHeight : A.upperShoulderHeight),
    height = tier === 'lower' ? A.lowerOpeningHeight : A.upperOpeningHeight,
    N = [2, 2, 8, 14][lod],
    a = {
      part: part.index,
      tier,
      sa,
      sb,
      left,
      right,
      base,
      top,
      shoulder,
      rise: height - (shoulder - base),
      pointed: i % 13 === 4,
      lod,
    };
  archEvidence.push(a);
  prism(o, 'stone', part, sa, left, base, top);
  prism(o, 'stone', part, right, sb, base, top);
  for (let j = 0; j < N; j++) {
    const x = left + ((right - left) * j) / N,
      X = left + ((right - left) * (j + 1)) / N,
      y = profile(a, x),
      Y = profile(a, X),
      pts = (t) => [P(part, x, y, t), P(part, X, Y, t), P(part, X, top, t), P(part, x, top, t)];
    for (const t of [0, 1])
      Q(o, 'stone', pts(t), [side[0] * (2 * t - 1), 0, side[1] * (2 * t - 1)]);
    Q(
      o,
      'stone',
      [P(part, x, y, 0), P(part, X, Y, 0), P(part, X, Y, 1), P(part, x, y, 1)],
      [axis[0] * (Y - y), -(X - x), axis[1] * (Y - y)],
    );
    Q(
      o,
      'stone',
      [P(part, x, top, 0), P(part, X, top, 0), P(part, X, top, 1), P(part, x, top, 1)],
      [0, 1, 0],
    );
    if (lod >= 2) {
      const k = i % 13 === 4 ? 'brick' : 'trim',
        thick = 0.49;
      for (const t of [0, 1]) {
        const e = edges(part, (x + X) / 2),
          delta = [2, 3][lod - 2] / 100 / (e[1] - e[0]),
          s = t === 0 ? -1 : 1,
          ta = t + s * delta,
          tb = t + s * (delta + 0.12 / (e[1] - e[0])),
          q = [
            P(part, x, y, ta),
            P(part, X, Y, ta),
            P(part, X, Y + thick, ta),
            P(part, x, y + thick, ta),
          ];
        Q(o, k, q, [side[0] * s, 0, side[1] * s]);
        if (lod === 3) {
          Q(
            o,
            k,
            [
              P(part, x, y, tb),
              P(part, X, Y, tb),
              P(part, X, Y + thick, tb),
              P(part, x, y + thick, tb),
            ],
            [side[0] * s, 0, side[1] * s],
          );
          Q(
            o,
            k,
            [P(part, x, y, ta), P(part, X, Y, ta), P(part, X, Y, tb), P(part, x, y, tb)],
            [axis[0] * (Y - y), -(X - x), axis[1] * (Y - y)],
          );
          Q(
            o,
            k,
            [
              P(part, x, y + thick, ta),
              P(part, X, Y + thick, ta),
              P(part, X, Y + thick, tb),
              P(part, x, y + thick, tb),
            ],
            [0, 1, 0],
          );
        }
      }
    }
  }
  // Opening jambs are faces of the piers; there is deliberately no surface across the aperture.
}
function courses(o, part, lod, arches) {
  if (lod < 3) return;
  const stride = lod === 3 ? 3.2 : 8.2,
    H = 0.42;
  let i = 0;
  for (let s = part.min + 1; s < part.max - 1; s += stride) {
    for (
      let y = (part.index === 0 && s > A.twoTierStart && s < A.twoTierEnd ? 0 : 14) + 0.6;
      y < 27.4;
      y += lod === 3 ? 3.8 : 5.8
    ) {
      i++;
      const Y = y + H,
        w = 0.85 + (i % 5) * 0.11,
        sa = s,
        sb = Math.min(s + w, part.max - 0.01),
        blocked = arches.some(
          (a) =>
            sa < a.right &&
            sb > a.left &&
            y < a.shoulder + a.rise &&
            Y > a.base &&
            y < profile(a, Math.min(a.right, Math.max(a.left, (sa + sb) / 2))) + 0.6,
        );
      if (blocked) continue;
      const col = C.stone.map((v) => v * (0.94 + (i % 5) * 0.018));
      for (const t of [0, 1]) {
        const e = edges(part, s),
          d = 0.045 / (e[1] - e[0]),
          sign = t ? 1 : -1;
        prism(o, 'stone', part, sa, sb, y, Y, t + sign * 0.001, t + sign * d, col);
      }
    }
  }
}
export function buildValensAqueduct(o, _frame, lod = 3) {
  archEvidence.length = 0;
  nativeEvidence.length = 0;
  for (const part of parts) {
    band(o, part, A.topHeight - A.channelBand, A.topHeight - 0.52);
    const margin = 0.025,
      lo = part.min + margin,
      hi = part.max - margin,
      pitch = [74, 13.8, A.nearPitch, A.nearPitch][lod],
      count = Math.ceil((hi - lo) / pitch),
      step = (hi - lo) / count;
    for (let i = 0; i < count; i++)
      arch(
        o,
        part,
        lo + i * step,
        lo + (i + 1) * step,
        14,
        A.topHeight - A.channelBand,
        i,
        lod,
        'upper',
      );
    if (part.index === 0) {
      const start = A.twoTierStart,
        end = A.twoTierEnd,
        n = lod === 0 ? 4 : Math.round((end - start) / (lod === 1 ? 13.8 : A.nearPitch)),
        step = (end - start) / n;
      for (let i = 0; i < n; i++)
        arch(o, part, start + i * step, start + (i + 1) * step, 0, 14, i + 3, lod, 'lower');
    }
    if (lod >= 2) {
      for (let i = 0; i < count; i++) {
        const s = lo + i * step,
          S = lo + (i + 1) * step;
        for (const t of [0, 1])
          prism(o, 'trim', part, s, S, A.topHeight - 0.52, A.topHeight, t ? 0.87 : 0, t ? 1 : 0.13);
        prism(o, 'trim', part, s, S, 13.85, 14.12, -0.018, 1.018);
      }
      courses(
        o,
        part,
        lod,
        archEvidence.filter((a) => a.part === part.index),
      );
    }
  }
}
export const valensSkyline = (o) => buildValensAqueduct(o, null, 0),
  valensDistrict = (o) => buildValensAqueduct(o, null, 1),
  valensStreet = (o) => buildValensAqueduct(o, null, 2),
  valensCloseup = (o) => buildValensAqueduct(o, null, 3);
export const valensAqueductModel = {
  id: 'aqueduct_of_valens',
  key: 'aqueduct_of_valens',
  cell: 'sx/sxk',
  wikidataId: 'Q952924',
  title: 'Aqueduct of Valens',
  category: 'infrastructure',
  recipe: 'aqueduct-of-valens-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  surfaces,
  build: buildValensAqueduct,
  brief:
    'Both surviving Valens Aqueduct masonry components in Istanbul: actual deep open arches and thick piers, central two-tier arcade with semicircular/occasional pointed arch profiles, single-tier end remains, continuous high channel and low parapets, thin tier ledge, pale stone and occasional brick voussoir repairs. Exact native outlines/all61XZcontrols and missing gap retained. No reconstructed lost connecting section, road/property slab, whole water network, traffic/mosque/neighbors/vegetation/signs or interiors.',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'native-map-frame',
  groundContactBasis: p.sectionBasis,
  camera: [330, 250, -1000],
  lookAt: [-15, F + 18, -18],
  portableGroundY: F - 0.3,
  mediumFiContext: { scale: '1.25', groundY: F - 0.3 },
  qaCameras: [
    {
      name: 'opposite-whole-both-surviving-parts-and-gap',
      position: [-360, 230, 920],
      lookAt: [0, F + 20, 0],
    },
    {
      name: 'central-deep-two-tier-open-arches',
      position: [5, F + 12, -58],
      lookAt: [-40, F + 14, -28],
    },
    {
      name: 'semicircular-pointed-vaults-and-pier-masonry',
      position: [-24, F + 15, -36],
      lookAt: [-48, F + 19, -34],
    },
    {
      name: 'single-tier-west-remains-and-channel',
      position: [-270, F + 38, -230],
      lookAt: [-270, F + 23, -190],
    },
    {
      name: 'separate-eastern-native-remains',
      position: [305, F + 25, 170],
      lookAt: [290, F + 23, 205],
    },
    {
      name: 'native-north-up-both-complete-outlines',
      position: [0, 1100, 3],
      lookAt: [0, F + 16, 0],
    },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/valens-aqueduct-runtime-overlay.mjs',
    level: 'skyline',
    export: 'valensSkyline',
    errorMeters: 10,
    surfaces,
    authoredLevels: {
      district: { export: 'valensDistrict', errorMeters: 3, surfaces },
      street: { export: 'valensStreet', errorMeters: 0.4, surfaces },
      closeup: { export: 'valensCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.sectionBasis,
    'Qualla-first40families/zero conflicts; published missing/assumed creator or unbound release originals remain unselected. Three independent exact Gryffindor own/explicitPD-self July2007 exteriors individually inspected/nativeSHA1 matched establish central two-tier masonry/real deep arch vaults and upper channel. No copied pixels/textures, protected imagery, article/media/rightsmetadata repairs or questionable sources. Exact hidden end profiles/current masonry census/grade/spacing are bounded original estimates; distant skyline and district simplify arch census and omit near masonry blocks/voussoirs.',
    'Independent1600m513x513263169sample original terrain/nine rawtiles frozen before all floors/sections/geometry; no fitting/flattening/reacquisition or subsequent raising. Fixed SW21.5521m provider datum and original estimated absolute34/63m section are not a surveyed grade. All geographic placement remains preview/replaceFootprint=false; exact grade/contact unresolved. Flat stage and neighborhood are synthetic review fixtures.',
  ],
};
