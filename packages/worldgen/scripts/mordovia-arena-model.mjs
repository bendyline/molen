/** Mordovia Arena: executed lattice consoles and a true perforated cassette shell, not a stock bowl. */
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { transformed } from './lighthouse-models.mjs';
import { mordoviaPlan } from './mordovia-plan.mjs';
import { chair, face, soccerPitch } from './stadium-models.mjs';
import { box, tube } from './structure-mesh.mjs';

const TAU = Math.PI * 2,
  white = [0.93, 0.935, 0.92],
  pale = [0.71, 0.74, 0.71],
  concrete = [0.52, 0.55, 0.53],
  steel = [0.85, 0.88, 0.86],
  dark = [0.035, 0.045, 0.05];
const colors = [[0.78, 0.055, 0.006], [1, 0.17, 0.004], [1, 0.32, 0.025], white];
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t),
  radial = (a, r, y) => [r * Math.sin(a), y, r * Math.cos(a)],
  clamp = (x, a, b) => Math.min(b, Math.max(a, x));
function random(a, b) {
  let h = Math.imul(a + 701, 2654435761) ^ Math.imul(b + 337, 1597334677);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function ray(poly, a) {
  const d = [Math.sin(a), Math.cos(a)];
  let hit = 0;
  for (let i = 1; i < poly.length; i++) {
    const p = poly[i - 1],
      q = poly[i],
      e = [q[0] - p[0], q[1] - p[1]],
      den = d[0] * e[1] - d[1] * e[0];
    if (Math.abs(den) < 1e-9) continue;
    const t = (p[0] * e[1] - p[1] * e[0]) / den,
      u = (p[0] * d[1] - p[1] * d[0]) / den;
    if (t > 0 && u >= 0 && u <= 1) hit = Math.max(hit, t);
  }
  if (!hit) throw Error('Mordovia ray missed');
  return hit;
}
const outer = (a) => ray(mordoviaPlan.outer, a),
  inner = (a) => ray(mordoviaPlan.inner, a);
function rounded(a, hx, hz, r, y = 0) {
  const dx = Math.abs(Math.sin(a)),
    dz = Math.abs(Math.cos(a));
  let t = Math.min(hx / (dx || 1e-9), hz / (dz || 1e-9));
  if (t * dx > hx - r && t * dz > hz - r) {
    const x = hx - r,
      z = hz - r,
      d = x * dx + z * dz;
    t = d + Math.sqrt(Math.max(0, d * d - x * x - z * z + r * r));
  }
  return radial(a, t, y);
}
function curve(out, ps, r = 0.035, col = steel, slot = 'metal', sides = 8) {
  for (let i = 1; i < ps.length; i++)
    if (Math.hypot(...ps[i].map((v, k) => v - ps[i - 1][k])) > 0.0001)
      tube(out, slot, ps[i - 1], ps[i], r, col, sides);
}
function rail(out, ps) {
  for (const y of [0.55, 1.1])
    curve(
      out,
      ps.map((p) => [p[0], p[1] + y, p[2]]),
      0.025,
    );
  for (const p of ps) tube(out, 'metal', p, [p[0], p[1] + 1.1, p[2]], 0.025, steel, 8);
}
const outline = Array.from({ length: 1761 }, (_, i) =>
    radial((i * TAU) / 1760, outer((i * TAU) / 1760), 0),
  ),
  cumulative = [0];
for (let i = 1; i < outline.length; i++)
  cumulative.push(
    cumulative[i - 1] + Math.hypot(...outline[i].map((v, k) => v - outline[i - 1][k])),
  );
const perimeter = cumulative.at(-1);
function angleAt(u) {
  const distance = (((u % 1) + 1) % 1) * perimeter;
  let i = 1;
  while (cumulative[i] < distance) i++;
  const p = mix(
    outline[i - 1],
    outline[i],
    (distance - cumulative[i - 1]) / (cumulative[i] - cumulative[i - 1]),
  );
  return Math.atan2(p[0], p[2]);
}
function skin(u, v) {
  const a = angleAt(u),
    q = ((-70 + 140 * v) * Math.PI) / 180;
  return radial(a, outer(a) - 14 * (1 - Math.cos(q)), 28.5 + 21.2 * Math.sin(q));
}
function roof(u, t) {
  const a = angleAt(u),
    p = skin(u, 1),
    R = Math.hypot(p[0], p[2]),
    r = inner(a);
  return radial(a, R + (r - R) * t, p[1] + (38.5 - p[1]) * t + 0.6 * Math.sin(Math.PI * t));
}
function panelColor(i, j) {
  const v = j / 33,
    pWhite = clamp(0.82 * (1 - v / 0.77), 0, 0.8),
    n = random(i, j);
  return n < pWhite ? white : colors[Math.floor(random(i + 19, j) * 3)];
}
function panel(out, ps, uv, col, slot) {
  let p = ps,
    n = normalFor(...p.slice(0, 3));
  const center = p.reduce((s, v) => s.map((x, k) => x + v[k] / 4), [0, 0, 0]);
  if (n[0] * center[0] + n[2] * center[2] < 0) {
    p = [...p].reverse();
    uv = [...uv].reverse();
    n = n.map((x) => -x);
  }
  out.addQuad(slot, 'metric:uv', p, n, uv, col);
  out.addQuad(
    slot,
    'metric:uv',
    [...p].reverse(),
    n.map((x) => -x),
    [...uv].reverse(),
    col,
  );
}
function shell(out) {
  const n = 264,
    m = 33;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < m; j++) {
      const a = (i + 0.012) / n,
        b = (i + 0.988) / n,
        c = (j + 0.012) / m,
        d = (j + 0.988) / m,
        p = skin(a, c),
        q = skin(b, c),
        r = skin(b, d),
        s = skin(a, d),
        width = Math.hypot(...q.map((v, k) => v - p[k])),
        height = Math.hypot(...s.map((v, k) => v - p[k])),
        col = panelColor(i, j),
        slot = j < 25 ? 'perforated' : 'metal';
      panel(
        out,
        [p, q, r, s],
        [
          [0, 0],
          [width, 0],
          [width, height],
          [0, height],
        ],
        col,
        slot,
      );
      // The50mm folded cassette returns are opaque geometry, separate from the65.5mm cutouts.
      for (const [x, y] of [
        [p, q],
        [p, s],
      ]) {
        const a0 = Math.atan2(x[0], x[2]),
          b0 = Math.atan2(y[0], y[2]);
        face(
          out,
          'metal',
          [
            x,
            y,
            [y[0] - 0.05 * Math.sin(b0), y[1], y[2] - 0.05 * Math.cos(b0)],
            [x[0] - 0.05 * Math.sin(a0), x[1], x[2] - 0.05 * Math.cos(a0)],
          ],
          col,
        );
      }
    }
  for (let i = 0; i < 528; i++)
    for (let j = 0; j < 24; j++) {
      const a = i / 528,
        b = (i + 1) / 528,
        c = j / 24,
        d = (j + 1) / 24,
        ps = [roof(a, c), roof(b, c), roof(b, d), roof(a, d)],
        col = j < 5 ? colors[Math.floor(random(Math.floor(i / 2), j + 34) * 3)] : white,
        slot = j < 5 ? 'metal' : j >= 20 ? 'translucentRoof' : 'membrane';
      face(out, slot, ps, col, [0, 1, 0]);
      if (slot !== 'translucentRoof') face(out, slot, [...ps].reverse(), col, [0, -1, 0]);
    }
  for (let i = 0; i < 88; i++) {
    const u = i / 88;
    curve(
      out,
      Array.from({ length: 33 }, (_, j) => {
        const p = roof(u, j / 32);
        return [p[0], p[1] + 0.04, p[2]];
      }),
      0.035,
      white,
    );
  }
  rail(
    out,
    Array.from({ length: 529 }, (_, i) => skin(i / 528, 1)),
  );
}
function trussPoint(u, t, inside = false) {
  let p = t < 0.5 ? skin(u, t * 2) : roof(u, (t - 0.5) * 2);
  const a = angleAt(u),
    d = inside ? 3.25 : 1.1;
  if (t < 0.5) p = [p[0] - d * Math.sin(a), p[1], p[2] - d * Math.cos(a)];
  else p = [p[0], p[1] - d, p[2]];
  return p;
}
function structure(out) {
  for (let i = 0; i < 88; i++) {
    const u = i / 88,
      v = (i + 1) / 88;
    for (const inside of [false, true])
      curve(
        out,
        Array.from({ length: 25 }, (_, j) => trussPoint(u, j / 24, inside)),
        inside ? 0.19 : 0.23,
        steel,
        'metal',
        12,
      );
    for (let j = 0; j < 24; j++) {
      const a = trussPoint(u, j / 24),
        b = trussPoint(u, (j + 1) / 24),
        c = trussPoint(u, j / 24, true),
        d = trussPoint(u, (j + 1) / 24, true);
      tube(out, 'metal', a, c, 0.11, steel, 10);
      tube(out, 'metal', j % 2 ? a : c, j % 2 ? d : b, 0.11, steel, 10);
      tube(out, 'metal', a, trussPoint(v, j / 24), 0.11, steel, 10);
      if (j % 3 === 0) {
        const q = trussPoint(v, (j + 1) / 24);
        tube(out, 'metal', a, q, 0.024, steel, 8);
        const c0 = mix(a, q, 0.5),
          c1 = mix(a, q, 0.5 + 0.42 / Math.hypot(...q.map((x, k) => x - a[k])));
        tube(out, 'metal', c0, c1, 0.055, pale, 10);
      }
    }
    const base = trussPoint(u, 0);
    box(
      out,
      'concrete',
      [base[0] - 0.7, 7.2, base[2] - 0.7],
      [base[0] + 0.7, 8.6, base[2] + 0.7],
      pale,
    );
    const a = angleAt(u),
      p = roof(u, 0.95),
      o = transformed(out, a, [p[0], p[1] - 1.8, p[2]]);
    for (const x of [-1.1, 0, 1.1]) {
      box(o, 'metal', [x - 0.34, -0.45, -0.25], [x + 0.34, 0.2, 0.25], dark);
      box(o, 'plastic', [x - 0.29, -0.39, -0.27], [x + 0.29, 0.14, -0.26], [0.95, 0.96, 0.88]);
    }
  }
  for (const t of [0.18, 0.5, 0.83])
    curve(
      out,
      Array.from({ length: 353 }, (_, i) => trussPoint(i / 352, t)),
      0.15,
      steel,
      'metal',
      12,
    );
  for (let i = 0; i < 352; i++) {
    const u = i / 352,
      v = (i + 1) / 352,
      p = roof(u, 0.97),
      q = roof(v, 0.97),
      r = roof(v, 0.94),
      s = roof(u, 0.94);
    face(out, 'metal', [p, q, r, s], pale, [0, 1, 0]);
    face(
      out,
      'metal',
      [s, r, q, p].map((x) => [x[0], x[1] - 0.15, x[2]]),
      pale,
      [0, -1, 0],
    );
  }
  rail(
    out,
    Array.from({ length: 353 }, (_, i) => {
      const p = roof(i / 352, 0.98);
      return [p[0], p[1] + 0.1, p[2]];
    }),
  );
}
function seat(a, row) {
  const p = rounded(a, 42, 61, 8),
    r0 = Math.hypot(p[0], p[2]),
    r1 = outer(a) - 13.5,
    t = row / 65;
  return radial(
    a,
    r0 + (r1 - r0 - 3.3) * t + (row >= 29 ? 3.3 : 0),
    0.65 + 29.5 * t + (row >= 29 ? 2.1 : 0),
  );
}
const glyphs = {
  S: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  R: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  N: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
};
function seatColor(p, row, index) {
  if (row > 46 && p[0] < -55) {
    const c = Math.floor((43 - p[2]) * 0.48),
      r = 6 - Math.floor((row - 48) / 2),
      letter = 'SARANSK'[Math.floor(c / 6)];
    if (letter && c >= 0 && r >= 0 && r < 7 && glyphs[letter][r]?.[c % 6] === '1') return white;
    return colors[1];
  }
  const n = random(index, row);
  return n < 0.3 ? white : n < 0.77 ? colors[1] : n < 0.9 ? colors[0] : dark;
}
function bowl(out) {
  const n = 528;
  for (let row = 0; row < 65; row++) {
    for (let i = 0; i < n; i++) {
      const a = (i * TAU) / n,
        b = ((i + 1) * TAU) / n,
        p = seat(a, row),
        q = seat(b, row),
        r = seat(b, row + 1),
        s = seat(a, row + 1);
      face(out, 'concrete', [p, q, [r[0], q[1], r[2]], [s[0], p[1], s[2]]], pale, [0, 1, 0]);
      face(out, 'concrete', [[s[0], p[1], s[2]], [r[0], q[1], r[2]], r, s], concrete, [
        -Math.sin(a),
        0,
        -Math.cos(a),
      ]);
    }
    let carry = 0,
      count = 0;
    for (let i = 1; i <= n; i++) {
      const a = ((i - 1) * TAU) / n,
        b = (i * TAU) / n,
        p = seat(a, row + 0.35),
        q = seat(b, row + 0.35),
        L = Math.hypot(q[0] - p[0], q[2] - p[2]);
      for (let d = 0.515 - carry; d < L; d += 0.515) {
        const v = mix(p, q, d / L),
          angle = Math.atan2(v[0], v[2]),
          f = ((((angle / TAU) * 44) % 1) + 1) % 1;
        if (f < 0.065 || f > 0.935 || (row >= 29 && row < 33)) continue;
        chair(out, Math.atan2(-(q[2] - p[2]), q[0] - p[0]), v, seatColor(v, row, count++));
      }
      carry = (carry + L) % 0.515;
    }
  }
  for (let k = 0; k < 44; k++) {
    const a = (k * TAU) / 44;
    rail(
      out,
      Array.from({ length: 66 }, (_, j) => seat(a, j)),
    );
    for (const row of [13, 43]) {
      const p = seat(a, row),
        o = transformed(out, a, p);
      box(o, 'concrete', [-1.25, 0, -0.1], [1.25, 2.65, 2.8], colors[1]);
      box(o, 'glass', [-1.06, 0.07, -0.13], [1.06, 2.45, -0.11], dark);
    }
  }
  for (let i = 0; i < 352; i++) {
    const a = (i * TAU) / 352,
      b = ((i + 1) * TAU) / 352,
      p = seat(a, 29),
      q = seat(b, 29);
    face(
      out,
      'glass',
      [p, q, [q[0], q[1] + 2.4, q[2]], [p[0], p[1] + 2.4, p[2]]],
      [0.16, 0.22, 0.24],
      [-Math.sin(a), 0, -Math.cos(a)],
    );
    if (i % 2 === 0) beam(out, 'metal', p, [p[0], p[1] + 2.4, p[2]], 0.06, 0.09, white);
    const r = rounded(a, 39, 58, 3),
      s = rounded(b, 39, 58, 3),
      t = seat(a, 0),
      v = seat(b, 0);
    face(out, 'concrete', [[t[0], 0, t[2]], [v[0], 0, v[2]], s, r], pale, [0, 1, 0]);
  }
  for (const a of [0, Math.PI]) {
    const p = roof(a / TAU, 0.86),
      o = transformed(out, a, [p[0], p[1] - 7.2, p[2]]);
    box(o, 'metal', [-7.3, 0, -0.4], [7.3, 7.5, 0.4], steel);
    box(o, 'glass', [-7, 0.23, -0.43], [7, 7.25, -0.41], dark);
  }
  soccerPitch(out, { length: 105, width: 68, y: 0.035 });
}
function podium(out) {
  const n = 352;
  for (let i = 0; i < n; i++) {
    const a = (i * TAU) / n,
      b = ((i + 1) * TAU) / n,
      R = outer(a),
      S = outer(b);
    for (const y of [0, 4, 8]) {
      if (y > 0) {
        face(
          out,
          'concrete',
          [radial(a, R - 10, y), radial(b, S - 10, y), radial(b, S + 8, y), radial(a, R + 8, y)],
          pale,
          [0, 1, 0],
        );
        face(
          out,
          'concrete',
          [
            radial(a, R + 8, y - 0.4),
            radial(b, S + 8, y - 0.4),
            radial(b, S + 8, y),
            radial(a, R + 8, y),
          ],
          pale,
          [Math.sin(a), 0, Math.cos(a)],
        );
        face(
          out,
          'concrete',
          [
            radial(a, R - 10, y - 0.4),
            radial(b, S - 10, y - 0.4),
            radial(b, S + 8, y - 0.4),
            radial(a, R + 8, y - 0.4),
          ],
          concrete,
          [0, -1, 0],
        );
      }
      if (y < 8)
        face(
          out,
          'glass',
          [
            radial(a, R - 7, y),
            radial(b, S - 7, y),
            radial(b, S - 7, y + 3.6),
            radial(a, R - 7, y + 3.6),
          ],
          [0.15, 0.21, 0.24],
          [Math.sin(a), 0, Math.cos(a)],
        );
    }
    if (i % 4 === 0) {
      const o = transformed(out, a, radial(a, R + 4, 0));
      box(o, 'concrete', [-0.32, 0, -0.4], [0.32, 8, 0.4], white);
    }
    if (i % 2 === 0)
      tube(out, 'metal', radial(a, R - 6.95, 0), radial(a, R - 6.95, 7.7), 0.04, white, 6);
  }
  rail(
    out,
    Array.from({ length: 353 }, (_, i) => radial((i * TAU) / 352, outer((i * TAU) / 352) + 7.3, 8)),
  );
}
function stairs(out) {
  for (const feature of mordoviaPlan.stairs) {
    const ps = [...feature.outline];
    if (Math.hypot(...ps[0]) > Math.hypot(...ps.at(-1))) ps.reverse();
    for (let j = 1; j < ps.length; j++) {
      const p = ps[j - 1],
        q = ps[j],
        L = Math.hypot(q[0] - p[0], q[1] - p[1]),
        angle = Math.atan2(q[0] - p[0], q[1] - p[1]),
        o = transformed(out, angle, [p[0], 0, p[1]]),
        y0 = j === 1 ? 8 : j === 2 ? 8 : 0,
        y1 = j === 1 ? 8 : 0;
      if (y0 === y1) box(o, 'concrete', [-6, y0 - 0.45, 0], [6, y0, L], pale);
      else {
        const steps = 44;
        for (let k = 0; k < steps; k++) {
          const y = y0 + ((y1 - y0) * k) / steps,
            z = (k * L) / steps;
          box(o, 'concrete', [-6, y - 0.3, z], [6, y, L / steps + z], pale);
        }
        beam(o, 'concrete', [-4, 7.2, 0], [-4, -0.4, L], 0.65, 0.5, pale);
        beam(o, 'concrete', [4, 7.2, 0], [4, -0.4, L], 0.65, 0.5, pale);
      }
      for (const x of [-6, 0, 6])
        rail(
          o,
          Array.from({ length: Math.ceil(L / 2) + 1 }, (_, k) => [
            x,
            y0 + ((y1 - y0) * k) / Math.ceil(L / 2),
            (L * k) / Math.ceil(L / 2),
          ]),
        );
      if (y0 > 0) {
        box(o, 'concrete', [-4.6, 0, -0.45], [-3.8, 7.6, 0.45], pale);
        box(o, 'concrete', [3.8, 0, -0.45], [4.6, 7.6, 0.45], pale);
      }
    }
  }
}
export function buildMordovia(out) {
  bowl(out);
  podium(out);
  structure(out);
  shell(out);
  stairs(out);
}
export const mordoviaStudy = {
  id: 'N0695',
  key: 'mordovia_arena',
  wikidataId: 'Q4533552',
  title: 'Mordovia Arena',
  build: buildMordovia,
  metricTriangleUv: true,
  embeddedCanonicalGraphs: ['metal_perforated_square'],
  size: [270, 50, 290],
  nativeAxes: {
    up: '+Y',
    front: '+Z',
    origin:
      'Mapped stadium pitch center; +Z near true north, +X west. Y0 is playing field and outer ground, with the two-storey raised terrace atY8.',
  },
  previewCamera: { position: [215, 125, 220], lookAt: [0, 23, 0] },
  visualBrief:
    'Executed Saransk stadium with orange/red/white perforated aluminum cassette shell,88 exposed L-shaped tubular consoles, inward-sloping roof and translucent inner rim. Two concrete podium storeys, mapped kinked access stairways, orange/white patterned seating, east Cyrillic city lettering, hospitality ribbon, orange vomitory heads, screens and roof floodlights define the individual exterior.',
  sourceFacts: {
    published:
      'Structural engineer specifies88 L-shaped tubular lattice consoles40m high with49m cantilevers. Facade fabricator specifies8712 cassettes, typical2900x1345mm panels50mm deep,65.5mm square holes,2/3mm aluminum, RAL2001/2003/2009/9003 colors; it separately cites an approximate51m highest point. Operator confirms42839 seats and105x68m field. Macalloy supplies M48 tension bars.',
    reconstructed:
      'Mapped stadium outer/inner roof rings and enclosed pitch establish exact plan and directed north axis. The88-frame structural count takes precedence over the facade supplier’s84-frame prose. Raised podium level, shell profile, roof slopes, chair layout and individual panel colors are photo reconstructions; current source height is~49m including railing. Perforation spacing85mm is estimated from fabricator photographs; opening size65.5mm is published. The physical8712-cell shell arrangement represents the published inventory at a common nominal layout, not fabrication drawings.',
  },
  referencePages: [
    'https://steel-project.ru/project/stadion-mordoviya-arena',
    'https://met-form.ru/projects/facade/stadiona-mordoviya-arena/',
    'https://arenamordovia.ru/stadium/about/',
    'https://arenamordovia.ru/stadium/field-view-from-stands/',
    'https://macalloy.com/project/fifa-world-cup-arenas-in-russia-2018/',
    'https://www.openstreetmap.org/relation/7718715',
    'https://www.openstreetmap.org/way/590956380',
  ],
  referenceRights:
    'Original component-authored geometry and canonical shared procedural surfaces. Reference photographs are research only; none is embedded as artwork. OSM coordinates are OpenStreetMap contributors, ODbL1.0.',
  geographicProposal: {
    status: 'preview-proposal',
    anchor: mordoviaPlan.anchor,
    heading: mordoviaPlan.heading,
    elevationMode: 'terrain-contact',
    groundModelY: 0,
    groundContactReviewed: true,
    groundContactBasis:
      'NativeY0 is the field and surrounding entry ground. Upper arrival terrace isY8; shallow stair undersides may extend below ground.',
    source: 'https://www.openstreetmap.org/way/590956380',
    featureIds: [
      'relation/7718715',
      'way/376045510',
      'way/539237708',
      'way/590956380',
      ...mordoviaPlan.stairs.map((s) => `way/${s.id}`),
    ],
    notes:
      'Exact pitch long edge directs+Z north and+X west. Roof multipolygon and six mapped approach stair centerlines establish plan; the Wikidata point lies northwest outside the actual stadium and is not used as origin.',
  },
  limitations: [
    'Completed stadium exterior; panel-color layout, construction sections, chair inventory and exact local terrace grades are reconstructed from primary photographs. No changing event graphics, surrounding retail district or enclosed rooms. Real square-hole alpha cutouts are baked from the canonical shared graph and also embedded for portable glTF fallback; cassette returns and structural frames remain geometry.',
  ],
  importOptions: { optimize: false },
  qaCameras: [
    { name: 'near-perforated-shell', position: [122, 20, 14], lookAt: [109, 23, 14] },
    { name: 'near-cassette-folds', position: [113, 23, 10], lookAt: [108, 24, 10] },
    { name: 'near-console-lattice', position: [73, 25, 12], lookAt: [98, 35, 15] },
    { name: 'near-roof-cantilevers', position: [10, 20, 0], lookAt: [65, 35, 20] },
    { name: 'near-podium', position: [125, 5, 24], lookAt: [108, 5, 24] },
    { name: 'near-entry-stairs', position: [148, 10, 137], lookAt: [109, 6, 117] },
    { name: 'near-seating', position: [0, 7, 0], lookAt: [-73, 22, 8] },
    { name: 'near-vomitory', position: [31, 8, -30], lookAt: [63, 13, -49] },
    { name: 'near-north-screen', position: [0, 25, 0], lookAt: [0, 33, 75] },
    { name: 'near-roof-panels', position: [76, 62, 30], lookAt: [79, 46, 30] },
    { name: 'far-roof-envelope', position: [-175, 166, 190], lookAt: [0, 23, 0] },
  ],
};
