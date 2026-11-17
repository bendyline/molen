/**
 * Seattle Central Library (OMA with LMN, 2004): five shifted platforms (staff, meeting, books
 * spiral, headquarters) and the in-between spaces (living room, mixing chamber, reading room)
 * wrapped in one faceted skin of glass under a diamond steel grid. Each skin plane spans
 * between two platform edges, so the model is a loft of plan sections, one per platform edge,
 * on the mapped block in footprint.json: +X runs along Fifth Avenue from Spring Street to
 * Madison Street, +Z faces Fourth Avenue, y = 0 is the Fourth Avenue sidewalk.
 */

import { readFileSync } from 'node:fs';
import { emitPlaceMaster } from '../../../../../../../../packages/worldgen/scripts/place-master-emitter.mjs';
import {
  abox,
  extrude,
  facade,
  fbox,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const col = {
  steel: rgb('d6dad9'),
  frame: rgb('e4e6e3'),
  frosted: rgb('b9c4c9'),
  clear: rgb('6d8797'),
  under: rgb('51677a'),
  books: rgb('7f97a4'),
  storefront: rgb('5b7280'),
  mullion: rgb('c4c9ca'),
  panel: rgb('a9afb1'),
  penthouse: rgb('b2b6b4'),
  concrete: rgb('aeaba3'),
  portal: rgb('e2e2dc'),
  paving: rgb('a7a49c'),
  door: rgb('3a4248'),
};
const surfaces = {
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.45, metallic: 0.4 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.12, metallic: 0.35 },
  panel: { slot: 'roof', graph: 'metal_painted', roughness: 0.6, metallic: 0.3 },
  penthouse: { slot: 'wall', graph: 'metal_standing_seam', roughness: 0.55, metallic: 0.3 },
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.85, metallic: 0 },
  paving: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.9, metallic: 0 },
  door: { slot: 'door', localRef: 'palette:#ffffff', roughness: 0.4, metallic: 0.2 },
};

const REF = 'palette:#ffffff';
const UV3 = [
  [0, 0],
  [1, 0],
  [1, 1],
];
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul3 = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit = (a) => mul3(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));

/** Newell normal: counterclockwise seen from the side it points to. */
function newell(poly) {
  const n = [0, 0, 0];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length];
    n[0] += (a[1] - b[1]) * (a[2] + b[2]);
    n[1] += (a[2] - b[2]) * (a[0] + b[0]);
    n[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return n;
}

function dedupe(poly) {
  const out = [];
  for (const p of poly) if (!out.length || Math.hypot(...sub3(p, out.at(-1))) > 1e-4) out.push(p);
  while (out.length > 1 && Math.hypot(...sub3(out[0], out.at(-1))) < 1e-4) out.pop();
  return out;
}

/** Fan a convex planar polygon facing `n`, dropping slivers that collapse in Float32. */
function polyFan(out, slot, poly, color, n) {
  const p = dedupe(poly);
  if (p.length < 3) return;
  const normal = unit(n ?? newell(p));
  for (let i = 1; i + 1 < p.length; i++) {
    const t = [p[0], p[i], p[i + 1]].map((q) => q.map(Math.fround));
    if (Math.hypot(...cross3(sub3(t[1], t[0]), sub3(t[2], t[0]))) < 2e-5) continue;
    out.addTriangle(slot, REF, t, normal, UV3, color);
  }
}

/** Keep the part of a convex polygon where (f(p) - c) * sign >= 0 (f linear). */
function clip(poly, f, c, sign) {
  const result = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length];
    const da = (f(a) - c) * sign,
      db = (f(b) - c) * sign;
    if (da >= 0) result.push(a);
    if ((da > 0 && db < 0) || (da < 0 && db > 0))
      result.push(add3(a, mul3(sub3(b, a), da / (da - db))));
  }
  return result;
}
const band = (poly, f, lo, hi) => clip(clip(poly, f, lo, 1), f, hi, -1);

// The steel grid: diamonds 4 ft wide and 7 ft tall (1.22 m by 2.13 m), the 7 ft diagonal up the
// slope of each plane. Each diagonal line is one strip across the whole face.
const DIAMOND_W = 1.22,
  DIAMOND_H = 2.13,
  MEMBER = 0.2,
  DEPTH = 0.2,
  EDGE = 0.34;

/** A grid member: the strip's face `depth` proud of the glass, with its two long sides. */
function member(out, strip, n, depth, color) {
  const P = dedupe(strip);
  if (P.length < 3) return;
  const lift = (q) => add3(q, mul3(n, depth));
  polyFan(out, 'steel', P.map(lift), color, n);
  for (let i = 0; i < P.length; i++) {
    const a = P[i],
      b = P[(i + 1) % P.length];
    if (Math.hypot(...sub3(b, a)) < 0.6) continue;
    polyFan(out, 'steel', [a, b, lift(b), lift(a)], color, cross3(sub3(b, a), n));
  }
}

/**
 * One skin plane: a single glass face, its diagonal grid members (one per line across the
 * face) and a frame at the folds. `scale` enlarges the diamond (the living-room wall's grid).
 */
function skinFace(out, poly, fill, { slot = 'glass', grid = true, edges = true, scale = 1 } = {}) {
  const P = dedupe(poly);
  if (P.length < 3) return;
  const raw = newell(P);
  if (Math.hypot(...raw) < 0.05) return;
  const n = unit(raw);
  polyFan(out, slot, P, fill, n);
  const v = Math.abs(n[1]) > 0.995 ? [1, 0, 0] : unit(sub3([0, 1, 0], mul3(n, n[1])));
  const u = cross3(v, n);
  if (grid) {
    const w = DIAMOND_W * scale,
      h = DIAMOND_H * scale;
    const half = (MEMBER / 2) * 2 * Math.hypot(1 / w, 1 / h);
    for (const sign of [1, -1]) {
      const f = (p) => (2 * dot3(u, p)) / w + (sign * 2 * dot3(v, p)) / h;
      const values = P.map(f);
      const lo = Math.min(...values),
        hi = Math.max(...values);
      for (let k = 2 * Math.ceil((lo - half - 1) / 2) + 1; k <= hi + half; k += 2) {
        const strip = band(P, f, k - half, k + half);
        if (strip.length >= 3) member(out, strip, n, DEPTH, col.steel);
      }
    }
  }
  if (edges)
    for (let i = 0; i < P.length; i++) {
      const a = P[i],
        b = P[(i + 1) % P.length];
      if (Math.hypot(...sub3(b, a)) < 0.5) continue;
      const inward = unit(cross3(n, sub3(b, a)));
      const strip = clip(P, (p) => dot3(inward, sub3(p, a)), EDGE, -1);
      if (strip.length >= 3) member(out, strip, n, DEPTH + 0.04, col.frame);
    }
}

/** Fourth Avenue and Madison Street storefront: tall mullions, two transoms, a sill. */
function storefront(out, poly) {
  const P = dedupe(poly);
  if (P.length < 3) return;
  const n = unit(newell(P));
  const u = unit(cross3([0, 1, 0], n));
  polyFan(out, 'glass', P, col.storefront, n);
  const lift = (q) => add3(q, mul3(n, 0.05));
  const along = (p) => dot3(u, p);
  const values = P.map(along);
  const start = Math.ceil(Math.min(...values) / 1.55) * 1.55;
  for (let s = start; s <= Math.max(...values); s += 1.55) {
    const strip = band(P, along, s - 0.07, s + 0.07);
    if (strip.length >= 3) polyFan(out, 'steel', strip.map(lift), col.mullion, n);
  }
  for (const [y0, y1] of [
    [0, 0.45],
    [4.2, 4.42],
    [8.25, 8.6],
  ]) {
    const strip = band(P, (p) => p[1], y0, y1);
    if (strip.length >= 3) polyFan(out, 'steel', strip.map(lift), col.mullion, n);
  }
}

const frame = JSON.parse(readFileSync(new URL('../footprint.json', import.meta.url), 'utf8'));
const block = frame.features.find((f) => f.id === '35184409145274').pieces;
const vertex = (piece, x, z) =>
  block[piece].outline.find((p) => Math.abs(p[0] - x) < 0.05 && Math.abs(p[1] - z) < 0.05) ??
  (() => {
    throw new Error(`footprint vertex ${x},${z} moved`);
  })();
// Chamfered corners of the mapped block (outward normal and offset of each corner line).
function line(a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    len = Math.hypot(dx, dz);
  const n = [-dz / len, dx / len];
  return [n, n[0] * a[0] + n[1] * a[1]];
}
const NE = line(vertex(1, -16.37, -64.91), vertex(1, -25.77, -56.79)); // Fifth and Spring
const NW = line(vertex(0, -26.17, 5.05), vertex(0, -22.05, 9.07)); // Fourth and Spring
const SWa = line(vertex(0, 14.1, 9.47), vertex(0, 29.2, 5.9)); // Fourth and Madison
const SWb = line(vertex(0, 29.2, 5.9), vertex(0, 45.77, -3.41));

/**
 * A plan section at height y: the rectangle x0..x1 (Spring..Madison) by z0..z1 (Fifth..Fourth)
 * cut by the mapped corner chamfers, as 8 vertices in outward order (an edge per line, some of
 * zero length), so consecutive sections loft into planar trapezoids.
 */
function section(y, x0, x1, z0, z1) {
  const lines = [[[-1, 0], -x0], NW, [[0, 1], z1], SWa, SWb, [[1, 0], x1], [[0, -1], -z0], NE];
  let poly = [
    [x0, 0, z0],
    [x0, 0, z1],
    [x1, 0, z1],
    [x1, 0, z0],
  ];
  for (const k of [1, 3, 4, 7]) {
    const [n, d] = lines[k];
    poly = clip(poly, (p) => n[0] * p[0] + n[1] * p[2], d, -1);
  }
  const tight = lines.map(([n]) => [n, Math.max(...poly.map((p) => n[0] * p[0] + n[1] * p[2]))]);
  return tight.map(([n1, d1], k) => {
    const [n2, d2] = tight[(k + 1) % tight.length];
    const det = n1[0] * n2[1] - n1[1] * n2[0];
    return [(d1 * n2[1] - n1[1] * d2) / det, y, (n1[0] * d2 - d1 * n2[0]) / det];
  });
}

// Edge indices in a section.
const SPRING = 0,
  CNW = 1,
  FOURTH = 2,
  CSWA = 3,
  CSWB = 4,
  MADISON = 5,
  FIFTH = 6,
  CNE = 7;

// Heights above the Fourth Avenue sidewalk. Fifth Avenue meets level 3 at 9.3 m; the Fifth Avenue
// elevation reads living room 9.3-18.6, books platform 27.5-41.5, reading room to 50.6 and the
// headquarters to the 56.4 m (185 ft) roof.
const Y = {
  base: -7,
  storefront: 8.6,
  box: 12.5,
  boxTop: 18.6,
  books: 27.5,
  booksTop: 41.5,
  hq: 50.6,
  hqMid: 54.0,
  roof: 56.7,
};
// Plan extents in the footprint frame: mapped block x -26.0..45.9, z -64.9..9.3.
const sections = [
  section(Y.base, -25.5, 44.5, -63.5, 0.5), // staff platform behind the storefront
  section(Y.storefront, -25.5, 44.5, -63.5, 0.5),
  section(Y.box, -26.0, 42.2, -63.5, 9.3), // living room and meeting platform over the plaza
  section(Y.boxTop, -26.0, 38.6, -63.5, 9.3),
  section(Y.books, -26.0, 33.4, -52.0, 5.5), // books spiral, cantilevered over Spring Street
  section(Y.booksTop, -26.0, 33.4, -52.0, 5.5),
  section(Y.hq, -7.3, 45.9, -64.9, -8.1), // headquarters, out over Fifth Avenue and Madison
  section(Y.hqMid, -7.3, 45.9, -64.9, -8.1),
  section(Y.roof, -7.3, 36.4, -64.9, -8.1),
];

/** Which glass each skin plane carries: clear, mesh-laminated (frosted) or seen from below. */
function treatment(pair, edge) {
  if (pair === 0) return edge === FIFTH || edge === CNE ? 'concrete' : 'storefront';
  if (pair === 1) {
    if (edge === MADISON) return col.frosted;
    if (edge === FIFTH || edge === CNE || edge === SPRING) return col.clear;
    return col.under; // underside of the meeting platform over the Fourth Avenue plaza
  }
  if (pair === 2) return edge === FIFTH || edge === CNE ? col.clear : col.frosted;
  if (pair === 3) return edge === SPRING ? col.clear : col.frosted; // living-room roof, Madison slope
  if (pair === 4) return col.books;
  if (pair === 5)
    return edge === FIFTH || edge === MADISON || edge === CSWB ? col.under : col.frosted;
  return col.frosted;
}

function skin(out) {
  for (let pair = 0; pair + 1 < sections.length; pair++) {
    const A = sections[pair],
      B = sections[pair + 1];
    for (let k = 0; k < 8; k++) {
      const j = (k + 7) % 8;
      const poly = [A[j], A[k], B[k], B[j]];
      const kind = treatment(pair, k);
      if (kind === 'concrete') polyFan(out, 'concrete', poly, col.concrete, newell(dedupe(poly)));
      else if (kind === 'storefront') {
        polyFan(
          out,
          'concrete',
          clip(poly, (p) => p[1], 0, -1),
          col.concrete,
          newell(dedupe(poly)),
        );
        storefront(
          out,
          clip(poly, (p) => p[1], 0, 1),
        );
      } else {
        // The living-room wall and the Fifth and Spring corner carry the grid at twice the size.
        const big = (pair === 1 || pair === 2) && (k === FIFTH || k === CNE);
        skinFace(out, poly, kind, { scale: big ? 2 : 1 });
      }
    }
  }
  // Roof: the grid carries on over opaque panels.
  // Sections run counterclockwise seen from above, so the top cap faces up as listed.
  skinFace(out, sections.at(-1), col.panel, { slot: 'panel' });
}

function ground(out) {
  // Fourth Avenue plaza under the overhang, from the storefront to the property line.
  extrude(
    out,
    'paving',
    [
      [-26.1, 0.5],
      [-26.17, 5.05],
      [-22.05, 9.07],
      [14.1, 9.47],
      [29.2, 5.9],
      [38.81, 0.5],
    ],
    Y.base,
    0.05,
    col.paving,
  );
  // Fourth Avenue entrance (1000 Fourth Avenue): a white portal in the storefront.
  const F4 = facade([0, 0.5], [1, 0]);
  fbox(out, 'concrete', F4, 23.6, 24.2, 0, 5.4, 0, 0.9, col.portal);
  fbox(out, 'concrete', F4, 29.8, 30.4, 0, 5.4, 0, 0.9, col.portal);
  fbox(out, 'concrete', F4, 23.6, 30.4, 3.6, 5.4, 0, 0.9, col.portal);
  fbox(out, 'door', F4, 24.6, 29.4, 0, 3.0, 0, 0.08, col.door);
  // Fifth Avenue entrance into the living room at level 3.
  const F5 = facade([0, -63.5], [-1, 0]);
  fbox(out, 'door', F5, -9.4, -2.6, 9.3, 12.4, 0, 0.3, col.door);
  for (const u of [-9.8, -6.15, -2.6])
    fbox(out, 'steel', F5, u, u + 0.4, 9.3, 12.4, 0, 0.4, col.frame);
  fbox(out, 'steel', F5, -9.8, -2.2, 12.4, 12.8, 0, 0.6, col.frame);
  // Rooftop: the concrete core's mechanical penthouse in the southwest quadrant.
  abox(out, 'penthouse', [14, Y.roof - 0.2, -24], [34, 61.6, -10.5], col.penthouse, {
    bottom: false,
  });
}

await emitPlaceMaster({
  generator: import.meta.url,
  planId: 'A04',
  title: 'Seattle Central Library',
  wikidataId: 'Q2531939',
  brief:
    'The 2004 OMA/LMN Central Library on the block between Fourth and Fifth Avenues, Madison and Spring Streets: a stack of shifted platforms wrapped in one faceted skin of glass under a light diamond steel grid. Two-storey storefront and a covered plaza under the cantilevered meeting platform on Fourth Avenue, the sloping living-room roof falling to Fifth Avenue, the books-spiral box cantilevered over Spring Street, the reading-room slopes, and the headquarters platform cantilevered over Fifth Avenue and Madison Street, with the core penthouse on the roof.',
  surfaces,
  build(out) {
    skin(out);
    ground(out);
  },
  dimensions: [
    {
      fact: 'Plan: the mapped OSM building 35184409145274 (the block outline, with its chamfered corners) and its roof parts 35184830292122/26/28/31, which show the flat headquarters roof and the reading-room slopes toward Spring Street, Fourth Avenue and Madison Street',
      source: 'footprint.json',
    },
    {
      fact: '11 storeys, 185 ft (56.4 m) to the roof, 362,987 sq ft; address 1000 Fourth Avenue on the block bounded by Fourth and Fifth Avenues and Madison and Spring Streets; level 1 faces Fourth Avenue, level 3 faces Fifth Avenue',
      source: 'https://en.wikipedia.org/wiki/Seattle_Central_Library',
    },
    {
      fact: 'Diamond grid 4 ft wide by 7 ft tall (4 ft on a side); nearly 10,000 diamonds over about 130,000 sq ft of curtain wall; platforms from bottom to top: staff, living room, meeting, mixing chamber, four-level books platform, reading room, one-storey headquarters cantilevering up to 28 ft; 213 ft concrete core in the southwest quadrant',
      source:
        'https://enr.com/articles/29464-seattle-146-s-eccentric-145-book-behemoth-146-shatters-stereotypes',
    },
    {
      fact: 'Diamonds 7 ft tall at their tallest and 4 ft wide at their widest; the Fourth Avenue entrance sits beneath a large cantilevered section; the grade change between the entrances fits a staff level between the two public floors',
      source:
        'https://homepages.bluffton.edu/~SULLIVANM/washington/seattle/library/northandwest.html',
    },
    {
      fact: 'Platforms cantilever up to 52 ft; a diamond steel grid ties the platform trusses together and carries the curtain wall',
      source: 'https://www.mka.com/projects/seattle-central-library/',
    },
    {
      fact: 'Level 3 living room along Fifth Avenue reaches 50 ft in height; Books Spiral on levels 6 through 9',
      source:
        'https://spl.org/hours-and-locations/central-library/central-library-highlights/central-library-architecture',
    },
  ],
  limitations: [
    'Platform heights and plan offsets are read from street photographs (the Fifth Avenue elevation and the views from Fourth and Madison and Fifth and Spring) and the mapped roof parts; they are estimates, not survey levels.',
    'Every skin plane spans straight between two platform edges, so the folds are simplified: the V-shaped plane under the books platform at Fourth and Madison, the sloped columns at the Fifth and Spring corner and the headquarters bevel toward Madison Street are approximations.',
    'Glass is clear, mesh-laminated (light) or seen from below per plane; the scattered opaque diamonds and the interior (red floor, yellow escalators, books spiral) are not modelled.',
    'The explorer terrain has a 5-9 m pit over this block that reaches about 25 m east of Fifth Avenue, so the level 3 Fifth Avenue entrance (modelled at real grade, 9.3 m above Fourth Avenue) can stand above the drawn street there.',
  ],
});
