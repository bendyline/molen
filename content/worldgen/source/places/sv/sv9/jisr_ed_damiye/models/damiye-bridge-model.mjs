/** The closed Bailey span at Damiyah, with paired steel panels and a timber deck. */
import { readFileSync } from 'node:fs';
import {
  beam,
  chamferedRectangle,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box, tube } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const surfaces = {
  concrete: { slot: 'foundation', graph: 'concrete_boardformed', roughness: 0.91 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.78 },
  wood: { slot: 'wall', graph: 'wood_plain', roughness: 0.92 },
  galvanized: { slot: 'trim', graph: 'metal_stainless_beadblasted', roughness: 0.7 },
};
const paint = {
  green: [0.184, 0.278, 0.12],
  lightGreen: [0.231, 0.319, 0.139],
  joint: [0.156, 0.209, 0.103],
  rust: [0.33, 0.157, 0.079],
  deck: [0.39, 0.224, 0.142],
  concrete: [0.57, 0.53, 0.41],
  zinc: [0.43, 0.421, 0.357],
  pale: [0.75, 0.722, 0.622],
  blue: [0.27, 0.46, 0.58],
};
const tint = (id, m = 1) => paint[id].map((x) => x * m);
const blend = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
const phase = (i) => ((i * 97 + 131) % 149) / 149;
const { a, b, rows, halfWidth, roadHalf, abutments } = layout;
const modules = rows.length - 1;

function deckPoint(t) {
  const i = Math.min(modules - 1, Math.max(0, Math.floor(t * modules)));
  return blend(rows[i], rows[i + 1], t * modules - i);
}
function at(t, dy = 0, dz = 0) {
  const [x, y, z] = deckPoint(t);
  return [x, y + dy, z + dz];
}
function panel(out, slot, p, c, up) {
  let n = normalFor(...p);
  if (up && n[1] < 0) {
    p = p.toReversed();
    n = n.map((x) => -x);
  }
  out.addQuad(slot, '', p, n, undefined, c);
}

function deck(out, detail) {
  const segments = detail === 0 ? 4 : detail === 1 ? 13 : modules;
  for (let i = 0; i < segments; i++) {
    const u = i / segments,
      v = (i + 1) / segments;
    const top = [at(u, 0, -roadHalf), at(v, 0, -roadHalf), at(v, 0, roadHalf), at(u, 0, roadHalf)];
    panel(out, 'wood', top, tint('deck'), true);
    panel(
      out,
      'steel',
      [
        at(u, -0.23, roadHalf),
        at(v, -0.23, roadHalf),
        at(v, -0.23, -roadHalf),
        at(u, -0.23, -roadHalf),
      ],
      tint('joint'),
    );
    for (const side of [-1, 1]) {
      const z = side * roadHalf;
      panel(
        out,
        'wood',
        side > 0
          ? [at(v, 0, z), at(u, 0, z), at(u, -0.23, z), at(v, -0.23, z)]
          : [at(u, 0, z), at(v, 0, z), at(v, -0.23, z), at(u, -0.23, z)],
        tint('deck', 0.81),
      );
    }
  }
  if (detail === 0) return;
  for (let i = 0; i <= modules; i++) {
    if (detail === 1 && i % 2) continue;
    beam(
      out,
      'steel',
      at(i / modules, -0.27, -halfWidth),
      at(i / modules, -0.27, halfWidth),
      detail === 1 ? 0.23 : 0.18,
      0.23,
      tint('joint'),
    );
  }
  if (detail < 2) return;
  const planks = detail >= 3 ? 265 : 150;
  for (let i = 0; i < planks; i++) {
    const u = (i + 0.035) / planks,
      v = (i + 0.954) / planks;
    panel(
      out,
      'wood',
      [
        at(u, 0.014, -roadHalf + 0.052),
        at(v, 0.014, -roadHalf + 0.052),
        at(v, 0.014, roadHalf - 0.052),
        at(u, 0.014, roadHalf - 0.052),
      ],
      tint('deck', 0.71 + phase(i) * 0.47),
      true,
    );
  }
}

function trusses(out, detail) {
  for (const side of [-1, 1]) {
    const main = side * (roadHalf + 0.16),
      depth = detail < 2 ? 1 : 2;
    for (let layer = 0; layer < depth; layer++) {
      const z = main + side * 0.26 * layer;
      const columns = detail === 0 ? 10 : detail === 1 ? 17 : modules;
      if (detail === 0)
        for (const y of [0.015, 1.57])
          for (let i = 0; i < 4; i++)
            beam(out, 'steel', at(i / 4, y, z), at((i + 1) / 4, y, z), 0.14, 0.19, tint('green'));
      for (let i = 0; i < columns; i++) {
        const u = i / columns,
          v = (i + 1) / columns,
          m = (u + v) / 2;
        const height = 1.57,
          low = 0.015;
        if (detail > 0) {
          for (const y of [low, height])
            beam(
              out,
              'steel',
              at(u, y, z),
              at(v, y, z),
              0.116,
              detail === 1 ? 0.24 : 0.12,
              tint('green', 0.94 + phase(i) * 0.12),
            );
          beam(out, 'steel', at(u, low, z), at(u, height, z), 0.102, 0.098, tint('green'));
        }
        if (detail === 0)
          beam(out, 'steel', at(u, low, z), at(v, height, z), 0.07, 0.072, tint('green'));
        else {
          for (const t of [u, v]) {
            beam(
              out,
              'steel',
              at(t, low, z),
              at(m, height, z),
              0.073,
              0.059,
              tint('lightGreen', 0.93 + phase(i + layer) * 0.17),
            );
            beam(out, 'steel', at(t, height, z), at(m, low, z), 0.066, 0.057, tint('green'));
          }
          if (detail >= 2) {
            beam(out, 'steel', at(m, low, z), at(m, height, z), 0.073, 0.082, tint('green', 0.96));
            for (const t of detail === 2 ? [u] : [u, v])
              for (const y of [0.09, 1.49]) {
                const [X, Y, Z] = at(t, y, z);
                box(
                  out,
                  'steel',
                  [X - 0.125, Y - 0.096, Z - 0.07],
                  [X + 0.125, Y + 0.096, Z + 0.07],
                  tint('joint', 0.86 + phase(i + layer) * 0.28),
                );
                if (detail >= 3 && i % 2 === 0) {
                  const [p, q, r] = at(t, y, z + side * 0.09);
                  tube(
                    out,
                    'galvanized',
                    [p, q, r],
                    [p, q, r + side * 0.047],
                    0.037,
                    tint('zinc', 0.77),
                    6,
                  );
                }
              }
          }
        }
      }
      beam(out, 'steel', at(1, 0.015, z), at(1, 1.57, z), 0.113, 0.104, tint('green'));
    }
    if (detail >= 2)
      for (let i = 0; i <= modules; i++) {
        const t = i / modules;
        beam(
          out,
          'steel',
          at(t, 1.58, main),
          at(t, 1.58, main + side * 0.26),
          0.08,
          0.09,
          tint('lightGreen'),
        );
        if (detail >= 3 && i % 3 === 0)
          beam(
            out,
            'steel',
            at(t, 0.38, main + side * 0.34),
            at(t, 0.67, main + side * 0.34),
            0.043,
            0.037,
            tint('rust'),
          );
      }
  }
}

function support(out, detail) {
  for (const [index, [x, bottom, z]] of abutments.entries()) {
    const t = (x - a) / (b - a),
      top = deckPoint(t)[1] - 0.26;
    const ring = (cy, w, l) => chamferedRectangle(x, cy, z, l, w, detail > 0 ? 0.14 : 0.07);
    loft(
      out,
      'concrete',
      [ring(bottom, 5.3, 2.75), ring(top - 0.31, 4.95, 2.35), ring(top, 5.16, 2.48)],
      tint('concrete'),
    );
    if (detail === 0) continue;
    for (const side of [-1, 1]) {
      const x0 = x + (index === 0 ? -1 : 1) * 1.25;
      const cx = Math.min(x, x0),
        ex = Math.max(x, x0);
      const Z = z + side * (halfWidth + 0.075);
      box(
        out,
        'concrete',
        [cx - 0.18, bottom - 0.28, Z - 0.2],
        [ex + 0.18, top + 0.31, Z + 0.2],
        tint('concrete', 0.94),
      );
      if (detail >= 2) {
        const P = at(t, -0.25, side * 1.73);
        box(
          out,
          'steel',
          P.map((v, i) => v - [0.25, 0.11, 0.23][i]),
          P.map((v, i) => v + [0.25, 0.039, 0.23][i]),
          tint('joint'),
        );
      }
    }
  }
}

function closures(out, detail) {
  for (const end of [0, 1]) {
    const inward = end === 0 ? 1 : -1,
      t = end + inward * 0.01;
    const edge = roadHalf + 0.4;
    for (const side of [-1, 1]) {
      beam(
        out,
        'galvanized',
        at(t, -0.2, side * edge),
        at(t, 1.82, side * edge),
        0.12,
        0.119,
        tint('zinc'),
      );
      beam(
        out,
        'steel',
        at(t, 0.44, side * edge),
        at(t, 0.41, side * (edge + 0.65)),
        0.076,
        0.083,
        tint('rust'),
      );
    }
    for (const y of [0.2, 1.52])
      beam(out, 'galvanized', at(t, y, -edge), at(t, y, edge), 0.097, 0.099, tint('zinc'));
    const bars = detail === 0 ? 3 : detail === 1 ? 11 : 19;
    for (let i = 1; i <= bars; i++) {
      const z = -edge + (2 * edge * i) / (bars + 1);
      beam(
        out,
        'galvanized',
        at(t, 0.19, z),
        at(t, 1.5, z),
        detail === 0 ? 0.07 : 0.041,
        0.043,
        tint('zinc', 0.79 + phase(i) * 0.29),
      );
    }
    if (detail === 0) continue;
    for (const side of [-1, 1]) {
      const z = side * 1.53,
        c = at(end - inward * 0.016, -0.15, z),
        [x, y, Z] = c;
      const ring = (h, w, l) => chamferedRectangle(x, y + h, Z, l, w, 0.09);
      loft(
        out,
        'concrete',
        [ring(0, 1.28, 0.68), ring(0.31, 1.28, 0.68), ring(0.75, 0.97, 0.45)],
        tint(side > 0 ? 'blue' : 'pale'),
      );
      if (detail >= 2 && end === 0) {
        const N = detail >= 3 ? 26 : 11;
        let last;
        for (let i = 0; i <= N; i++) {
          const u = i / N,
            ang = 2 * Math.PI * u * (detail >= 3 ? 4 : 2);
          const p = at(
            t - inward * (0.002 + 0.004 * Math.cos(ang)),
            1.08 + 0.27 * Math.sin(ang),
            side * 2.08 * (1 - u),
          );
          if (last) beam(out, 'galvanized', last, p, 0.026, 0.024, tint('zinc', 0.83));
          last = p;
        }
      }
    }
    if (detail >= 2) {
      const pin = at(t - inward * 0.003, 0.93, 0);
      box(
        out,
        'steel',
        pin.map((v, i) => v - [0.049, 0.14, 0.135][i]),
        pin.map((v, i) => v + [0.049, 0.14, 0.135][i]),
        tint('rust'),
      );
    }
  }
}

function build(out, detail) {
  deck(out, detail);
  trusses(out, detail);
  support(out, detail);
  closures(out, detail);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = (out) => build(out, 4);
