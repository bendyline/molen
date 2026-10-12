/** Reviewed Nina complex. The original instanced study remains a reproducible master. */
import { readFileSync } from 'node:fs';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { box, tube } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const frame = JSON.parse(readFileSync(structureSourcePath('n0230_nina_tower', 'map-frame.json')));
const rings = frame.orientationControl.nativeRings;
const silver = [0.68, 0.71, 0.7],
  blue = [0.29, 0.43, 0.49],
  pale = [0.69, 0.7, 0.65],
  dark = [0.13, 0.17, 0.18];
const cross2 = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const area = (p) =>
  p.reduce((s, a, i) => {
    const b = p[(i + 1) % p.length];
    return s + a[0] * b[1] - b[0] * a[1];
  }, 0);
function clockwise(p) {
  return area(p) > 0 ? p.toReversed() : [...p];
}
function simplify(p, tolerance) {
  p = clockwise(p);
  let changed = true;
  while (changed && p.length > 4) {
    changed = false;
    for (let i = 0; i < p.length; i++) {
      const a = p[(i + p.length - 1) % p.length],
        b = p[i],
        c = p[(i + 1) % p.length],
        len = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (
        Math.abs(cross2(a, c, b)) / len < tolerance &&
        (b[0] - a[0]) * (b[0] - c[0]) + (b[1] - a[1]) * (b[1] - c[1]) <= 0
      ) {
        p.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return p;
}
/** Ear clipping retains the crescent hotel and stepped podium concavities. */
function triangles(plan) {
  const p = clockwise(plan),
    ids = p.map((_, i) => i),
    out = [];
  while (ids.length > 3) {
    let found = false;
    for (let j = 0; j < ids.length; j++) {
      const a = ids[(j + ids.length - 1) % ids.length],
        b = ids[j],
        c = ids[(j + 1) % ids.length];
      if (cross2(p[a], p[b], p[c]) >= -1e-8) continue;
      if (
        ids.some(
          (k) =>
            k !== a &&
            k !== b &&
            k !== c &&
            cross2(p[a], p[b], p[k]) <= 1e-8 &&
            cross2(p[b], p[c], p[k]) <= 1e-8 &&
            cross2(p[c], p[a], p[k]) <= 1e-8,
        )
      )
        continue;
      out.push([p[a], p[b], p[c]]);
      ids.splice(j, 1);
      found = true;
      break;
    }
    if (!found) throw new Error('Nina concave cap could not be triangulated');
  }
  out.push(ids.map((i) => p[i]));
  return out;
}
function face(o, s, p, c) {
  for (let i = 1; i + 1 < p.length; i++) {
    const t = [p[0], p[i], p[i + 1]];
    o.addTriangle(
      s,
      null,
      t,
      normalFor(...t),
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      c,
    );
  }
}
function cap(o, plan, y, s = 'concrete', c = pale, down = false) {
  for (let p of triangles(plan)) {
    p = p.map(([x, z]) => [x, typeof y === 'function' ? y(x, z) : y, z]);
    if (down) p.reverse();
    face(o, s, p, c);
  }
}
function edgePoint(a, b, t, y, offset = 0) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    len = Math.hypot(dx, dz);
  return [a[0] + dx * t - (dz * offset) / len, y, a[1] + dz * t + (dx * offset) / len];
}
function panel(o, s, a, b, x0, x1, y0, y1, c, offset = 0) {
  face(
    o,
    s,
    [
      edgePoint(a, b, x0, y0, offset),
      edgePoint(a, b, x1, y0, offset),
      edgePoint(a, b, x1, y1, offset),
      edgePoint(a, b, x0, y1, offset),
    ],
    c,
  );
}
function wall(o, p, y0, y1, s, c) {
  p = clockwise(p);
  for (let i = 0; i < p.length; i++) panel(o, s, p[i], p[(i + 1) % p.length], 0, 1, y0, y1, c);
}
function slab(o, p, y, t = 0.22) {
  cap(o, p, y + t);
  cap(o, p, y, 'concrete', pale, true);
  wall(o, p, y, y + t, 'concrete', pale);
}

function facade(o, plan, bottom, top, rows, refuge, detail, podium = false) {
  plan = clockwise(plan);
  const h = (top - bottom) / rows,
    step = detail === 0 ? 4 : 1;
  for (let k = 0; k < plan.length; k++) {
    const a = plan[k],
      b = plan[(k + 1) % plan.length],
      length = Math.hypot(b[0] - a[0], b[1] - a[1]),
      bays =
        detail === 2
          ? Math.max(1, Math.round(length / (podium ? 4 : 3)))
          : detail === 1
            ? Math.max(1, Math.round(length / 9))
            : 1;
    for (let row = 0, end; row < rows; row = end) {
      end = Math.min(rows, row + step, ...refuge.flatMap((r) => [r, r + 2]).filter((r) => r > row));
      const y = bottom + row * h,
        yt = bottom + end * h,
        louver = refuge.includes(row) || refuge.includes(row - 1);
      panel(o, louver ? 'recess' : 'glass', a, b, 0, 1, y, yt, louver ? dark : blue);
      if (louver && detail > 0) {
        for (let v = y + 0.16; v < yt - 0.15; v += detail === 2 ? 0.4 : 0.8)
          panel(o, 'metal', a, b, 0, 1, v, v + 0.1, silver, 0.13);
      } else {
        panel(o, 'metal', a, b, 0, 1, yt - 0.14, yt, silver, 0.09);
        if (detail === 2)
          for (let j = 0; j < bays; j++) {
            panel(
              o,
              'metal',
              a,
              b,
              j / bays,
              Math.min(1, j / bays + 0.055 / length),
              y,
              yt,
              silver,
              0.06,
            );
            if (detail === 2)
              panel(
                o,
                'glass',
                a,
                b,
                j / bays + 0.055 / length,
                (j + 1) / bays,
                y + 0.08,
                y + h * 0.26,
                [0.36, 0.44, 0.46],
                0.012,
              );
          }
      }
    }
  }
}

function sail(o, plan, occupied, top, short, detail) {
  plan = clockwise(plan);
  const axis = short ? 1 : 0,
    lo = Math.min(...plan.map((p) => p[axis])) - 1,
    hi = Math.max(...plan.map((p) => p[axis])) + 1;
  const height = (x, z) =>
    occupied +
    (top - occupied) * Math.sqrt(Math.max(0, 1 - Math.pow(((short ? z : x) - lo) / (hi - lo), 2)));
  // Adaptive triangular roof strips follow the concave plan rather than filling its inner arc.
  const roofTriangle = (p, depth) => {
    const mid = p.map((a, i) => a.map((v, k) => (v + p[(i + 1) % 3][k]) / 2)),
      errors = mid.map((q, i) =>
        Math.abs(height(...q) - (height(...p[i]) + height(...p[(i + 1) % 3])) / 2),
      ),
      error = Math.max(...errors),
      i = errors.indexOf(error);
    if (
      error > (detail === 2 ? 0.08 : detail === 1 ? 0.2 : detail === 0 ? 0.5 : 0.8) &&
      depth < 12
    ) {
      roofTriangle([p[i], mid[i], p[(i + 2) % 3]], depth + 1);
      roofTriangle([mid[i], p[(i + 1) % 3], p[(i + 2) % 3]], depth + 1);
      return;
    }
    face(
      o,
      'metal',
      p.map(([x, z]) => [x, height(x, z), z]),
      silver,
    );
    face(
      o,
      'metal',
      p.toReversed().map(([x, z]) => [x, height(x, z) - 0.3, z]),
      pale,
    );
  };
  for (const p of triangles(plan)) roofTriangle(p, 0);
  for (let i = 0; i < plan.length; i++) {
    const a = plan[i],
      b = plan[(i + 1) % plan.length];
    face(
      o,
      'metal',
      [
        [...a.slice(0, 1), height(...a) - 0.3, a[1]],
        [b[0], height(...b) - 0.3, b[1]],
        [b[0], height(...b), b[1]],
        [a[0], height(...a), a[1]],
      ],
      silver,
    );
    if (i % (detail === 2 ? 2 : detail === 1 ? 4 : 8) === 0) {
      const y = height(...a) - 0.3;
      if (y > occupied + 0.5)
        tube(
          o,
          'metal',
          [a[0], occupied, a[1]],
          [a[0], y, a[1]],
          detail > 0 ? 0.18 : 0.15,
          silver,
          4,
        );
    }
  }
  slab(o, plan, occupied - 0.22);
  // A limited service core preserves visible open crown space around it.
  if (detail > 0) {
    const q = short ? [48, 44] : [0, 0];
    box(o, 'recess', [q[0] - 3, occupied, q[1] - 3], [q[0] + 3, occupied + 3, q[1] + 3], dark);
  }
}

function tower(o, short, detail, sky = false) {
  const p = simplify(short ? rings.short : rings.tall, sky ? 0.35 : detail === 0 ? 0.1 : 0.005),
    occupied = short ? 153 : 301.1,
    top = short ? 170 : 320.4,
    rows = short ? 36 : 72,
    refuge = short ? [13] : [22, 32, 53],
    h = (occupied - 42) / rows;
  if (sky) {
    const breaks = [42, ...refuge.flatMap((row) => [42 + row * h, 42 + (row + 2) * h]), occupied];
    for (let i = 0; i + 1 < breaks.length; i++)
      wall(o, p, breaks[i], breaks[i + 1], i % 2 ? 'recess' : 'glass', i % 2 ? dark : blue);
  } else facade(o, p, 42, occupied, rows, refuge, detail);
  sail(o, p, occupied, top, short, detail);
  if (detail > 0) {
    for (const row of refuge) slab(o, p, 42 + row * h - 0.22);
    // The full-height silver fins on straight end walls remain separate from glazing.
    const cw = clockwise(p);
    for (let i = 0; i < cw.length; i++) {
      const a = cw[i],
        b = cw[(i + 1) % cw.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 9) continue;
      for (let t = 0.2; t < 0.95; t += 0.3)
        panel(o, 'metal', a, b, t, t + 0.16 / len, 42, occupied, silver, 0.14);
    }
  }
}

function podium(o, detail, sky) {
  const main = simplify(rings.podium, sky ? 0.3 : detail === 0 ? 0.1 : 0.005),
    low = simplify(rings.low, sky ? 0.3 : detail === 0 ? 0.1 : 0.005);
  for (const [p, height, rows] of [
    [main, 42, 8],
    [low, 8, 1],
  ]) {
    if (sky) wall(o, p, 0, height, 'glass', blue);
    else facade(o, p, 0.3, height, rows, [], detail, true);
    if (sky) {
      cap(o, p, 0, 'concrete', pale, true);
      cap(o, p, height);
    } else {
      slab(o, p, 0, 0.3);
      slab(o, p, height - 0.22);
    }
    if (detail > 0) {
      const cw = clockwise(p);
      for (let i = 0; i < cw.length; i++) {
        const a = cw[i],
          b = cw[(i + 1) % cw.length],
          len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (len > 4) {
          panel(o, 'cladding', a, b, 0, 0.22 / len, 0.3, height, pale, 0.15);
          panel(o, 'metal', a, b, 0, 1, height + 1.03, height + 1.1, silver, 0.02);
        }
      }
    }
  }
  if (detail > 0) {
    // Northwest public frontage is signed; four leaves and exact offset are illustrative.
    const plan = clockwise(main),
      a = plan.find((p) => Math.abs(p[0] + 28.84) < 0.03),
      index = plan.indexOf(a),
      b = plan[(index + 1) % plan.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let j = 0; j < 4; j++) {
      const t = (j + 0.06) / 4,
        u = (j + 0.94) / 4;
      panel(o, 'clear_glass', a, b, t, u, 0.3, 3.3, [0.62, 0.72, 0.72], 0.25);
      panel(o, 'metal', a, b, t, t + 0.055 / len, 0.3, 3.4, silver, 0.28);
      if (detail === 2) {
        const p = edgePoint(a, b, u - 0.13 / len, 1.05, 0.36),
          q = edgePoint(a, b, u - 0.13 / len, 1.95, 0.36);
        tube(o, 'metal', p, q, 0.025, silver, 4);
      }
    }
    beam(o, 'metal', edgePoint(a, b, 0, 3.6, 1.8), edgePoint(a, b, 1, 3.6, 1.8), 1.8, 0.18, silver);
  }
}

export function ninaBridgePoint(t, y, side = 0) {
  const x = 18 + 25 * t,
    z = 17 + 15 * t + 2 * Math.sin(Math.PI * t),
    dx = 25,
    dz = 15 + 2 * Math.PI * Math.cos(Math.PI * t),
    len = Math.hypot(dx, dz);
  return [x - (dz * side) / len, y, z + (dx * side) / len];
}
function bridge(o, detail, sky = false) {
  const count = sky ? 4 : detail === 0 ? 6 : detail === 1 ? 10 : 16;
  for (let i = 0; i < count; i++) {
    const t = i / count,
      u = (i + 1) / count,
      point = ninaBridgePoint;
    face(
      o,
      'concrete',
      [point(t, 151.7, -2.1), point(t, 151.7, 2.1), point(u, 151.7, 2.1), point(u, 151.7, -2.1)],
      pale,
    );
    face(
      o,
      'metal',
      [point(t, 155.3, -2.1), point(t, 155.3, 2.1), point(u, 155.3, 2.1), point(u, 155.3, -2.1)],
      silver,
    );
    for (const s of [-2.1, 2.1]) {
      const p = [point(t, 151.7, s), point(u, 151.7, s), point(u, 155.3, s), point(t, 155.3, s)];
      if (s > 0) p.reverse();
      face(o, detail > 0 ? 'clear_glass' : 'glass', p, blue);
      if (detail > 0) {
        beam(o, 'metal', point(t, 151.7, s), point(t, 155.3, s), 0.07, 0.09, silver);
        for (const y of [148.7, 151.7])
          beam(o, 'metal', point(t, y, s), point(u, y, s), 0.18, 0.18, silver);
        if (i % 2 === 0) {
          const v = Math.min(1, t + 2 / count);
          beam(o, 'metal', point(t, 148.7, s), point(v, 151.7, s), 0.14, 0.14, silver);
          beam(o, 'metal', point(t, 151.7, s), point(v, 148.7, s), 0.14, 0.14, silver);
        }
      }
    }
  }
}
function build(o, detail, sky = false) {
  podium(o, detail, sky);
  tower(o, false, detail, sky);
  tower(o, true, detail, sky);
  bridge(o, detail, sky);
}
export function buildNinaReviewedSkyline(o) {
  const means = {
      metal: [0.818960257808076, 0.8228885700850488, 0.8228885700850488],
      concrete: [0.7108161524542215, 0.7108161524542215, 0.6819278525713045],
      cladding: [0.7011092892788303, 0.7011092892788303, 0.7011092892788303],
    },
    flat = {};
  for (const method of ['addQuad', 'addTriangle', 'addConvexPolygon'])
    flat[method] = (s, _r, p, n, u, c) =>
      o[method](
        'wall',
        'palette:#ffffff',
        p,
        n,
        u,
        c.map((v, i) => v * (means[s]?.[i] ?? 1)),
      );
  build(flat, -1, true);
}
export function buildNinaDistrict(o) {
  build(o, 0);
}
export function buildNinaStreet(o) {
  build(o, 1);
}
export function buildNinaCloseup(o) {
  build(o, 2);
}
