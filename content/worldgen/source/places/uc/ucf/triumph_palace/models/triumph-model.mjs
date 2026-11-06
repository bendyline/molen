/** Original complete Triumph Palace exterior. Meters; +X NNE; +Z ESE. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const a = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url))),
  g = JSON.parse(readFileSync(new URL('../terrain-grid.json', import.meta.url)));
const linear = (h) =>
    h.match(/\w\w/g).map((v) => {
      const s = parseInt(v, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  C = {
    clad: linear('ece5d7'),
    infill: linear('c9aa91'),
    glass: linear('97a7ac'),
    roof: linear('a2afa3'),
    paving: linear('bcb9ab'),
    green: linear('8c9e72'),
  };
export const triumphSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.93, metallic: 0 },
  clad: { slot: 'wall', graph: 'stone_travertine', roughness: 0.88, metallic: 0 },
  infill: { slot: 'wall', graph: 'plaster_lime', roughness: 0.92, metallic: 0 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.23, metallic: 0.16 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.78, metallic: 0.16 },
  paving: { slot: 'foundation', graph: 'stone_granite', roughness: 0.94, metallic: 0 },
  land: { slot: 'door', localRef: 'palette:#ffffff', roughness: 1, metallic: 0 },
};
export const triumphControls = a;
export const triumphGroundY = (x, z) => {
  const u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters,
    i = Math.floor(u),
    j = Math.floor(v),
    p = u - i,
    q = v - j,
    n = g.size[0],
    h = g.elevationsMeters;
  return (
    (1 - p) * (1 - q) * h[j * n + i] +
    p * (1 - q) * h[j * n + i + 1] +
    (1 - p) * q * h[(j + 1) * n + i] +
    p * q * h[(j + 1) * n + i + 1] -
    a.originElevation
  );
};
const configs = {
  skyline: { far: true, aggregate: true, spire: 8 },
  district: { aggregate: true, pitch: 7.2, ribbons: true, flatPilasters: true, spire: 8 },
  street: { pitch: 4, ribbons: true, flatPilasters: true, columns: 1, cornice: 0, spire: 12 },
  closeup: {
    pitch: 4,
    panes: true,
    pilasters: true,
    columns: 2,
    cornice: 1,
    bands: 0,
    garden: true,
    spire: 16,
  },
  master: {
    pitch: 3.2,
    panes: true,
    pilasters: true,
    columns: 3,
    cornice: 3,
    bands: 3.5,
    sills: true,
    garden: true,
    spire: 20,
  },
};
const S = (c, n) => (c.far ? 'far' : n),
  ring = (r) =>
    r.length > 1 && r[0][0] === r.at(-1)[0] && r[0][1] === r.at(-1)[1] ? r.slice(0, -1) : r,
  area = (r) =>
    r.reduce((s, p, i) => {
      const q = r[(i + 1) % r.length];
      return s + p[0] * q[1] - q[0] * p[1];
    }, 0) / 2;
function cap(o, slot, polygons, y, color, down = false) {
  for (const poly of polygons) {
    const rs = poly.map(ring),
      ps = rs.flat(),
      holes = [];
    let n = rs[0].length;
    for (const r of rs.slice(1)) {
      holes.push(n);
      n += r.length;
    }
    const ids = earcut(ps.flat(), holes, 2);
    for (let i = 0; i < ids.length; i += 3) {
      let p = ids
        .slice(i, i + 3)
        .map((k) => [ps[k][0], typeof y === 'function' ? y(...ps[k]) : y, ps[k][1]]);
      const norm = normalFor(...p);
      if (Math.abs(norm[1]) < 0.1) continue;
      if (norm[1] < 0 !== down) p = p.toReversed();
      const cross =
        (p[1][0] - p[0][0]) * (p[2][2] - p[0][2]) - (p[1][2] - p[0][2]) * (p[2][0] - p[0][0]);
      if (Math.abs(cross) < 1e-7) continue;
      o.addTriangle(
        slot,
        'palette:#ffffff',
        p,
        normalFor(...p),
        p.map((p) => [p[0], p[2]]),
        color,
      );
    }
  }
}
function walls(o, slot, polys, lo, hi, color) {
  for (const poly of polys)
    for (const raw of poly) {
      let r = ring(raw);
      for (let i = 0; i < r.length; i++) {
        const p = r[i],
          q = r[(i + 1) % r.length],
          len = Math.hypot(q[0] - p[0], q[1] - p[1]);
        if (len < 0.015) continue;
        const low = (p) => (typeof lo === 'function' ? lo(...p) : lo),
          high = (p) => (typeof hi === 'function' ? hi(...p) : hi),
          ps = [
            [p[0], low(p), p[1]],
            [p[0], high(p), p[1]],
            [q[0], high(q), q[1]],
            [q[0], low(q), q[1]],
          ];
        quad(o, slot, ps, normalFor(...ps), color);
      }
    }
}
function oriented(polys) {
  return polys.map((poly) =>
    poly.map((raw, i) => {
      let r = ring(raw);
      if (area(r) > 0 !== (i === 0)) r = r.toReversed();
      return [...r, r[0]];
    }),
  );
}
const podium = oriented(a.podium),
  infill = oriented(a.podiumInfill),
  layers = a.layers.map((l) => ({
    ...l,
    polygons: oriented(l.polygons),
    roofs: oriented(l.roofs),
  }));
function foundation(o, c) {
  const slot = S(c, 'paving'),
    lo = (x, z) => Math.min(-0.45, triumphGroundY(x, z) - 0.65);
  walls(o, slot, podium, lo, 0.14, C.paving);
  cap(o, slot, podium, 0.14, C.paving);
  cap(o, slot, podium, lo, C.paving, true);
}
function panel(o, slot, p, q, lo, hi, normal, offset, color, uv) {
  const at = (r, y) => [r[0] + normal[0] * offset, y, r[1] + normal[2] * offset],
    ps = [at(p, lo), at(p, hi), at(q, hi), at(q, lo)];
  o.addQuad(
    slot,
    uv ? 'metric:uv' : 'palette:#ffffff',
    ps,
    normal,
    uv ?? [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 0],
    ],
    color,
  );
}
function facade(o, polys, lo, hi, c) {
  if (!c.pitch || hi - lo < 2) return;
  for (const poly of polys)
    for (const raw of poly) {
      const r = ring(raw);
      for (let i = 0; i < r.length; i++) {
        const p = r[i],
          q = r[(i + 1) % r.length],
          dx = q[0] - p[0],
          dz = q[1] - p[1],
          len = Math.hypot(dx, dz);
        if (len < 1.8) continue;
        const normal = [dz / len, 0, -dx / len],
          at = (t) => [p[0] + dx * t, p[1] + dz * t],
          start = (p[0] * dx + p[1] * dz) / len,
          centers = [];
        for (
          let u = Math.ceil((start + 0.8) / c.pitch) * c.pitch;
          u < start + len - 0.8;
          u += c.pitch
        )
          centers.push((u - start) / len);
        if (!centers.length) centers.push(0.5);
        for (const t of centers) {
          const w = Math.min(1.55, len * 0.62),
            u = at(t - w / (2 * len)),
            v = at(t + w / (2 * len)),
            lower = Math.max(lo + 0.025, c.baseGlazing ? lo + 0.025 : 10.8),
            upper = hi - 0.025;
          if (upper <= lower) continue;
          if (c.ribbons)
            panel(o, 'glass', u, v, lower, upper, normal, 0.018, C.glass, [
              [0, lower / 3.5],
              [0, upper / 3.5],
              [1, upper / 3.5],
              [1, lower / 3.5],
            ]);
          if (c.panes)
            for (let y = Math.floor((lower - 0.5) / 3.5) * 3.5 + 0.5; y < upper; y += 3.5) {
              const bottom = Math.max(lower, y),
                top = Math.min(upper, y + 2.35);
              if (top - bottom < 0.02) continue;
              panel(o, 'glass', u, v, bottom, top, normal, 0.03, C.glass, [
                [0, (bottom - y) / 2.35],
                [0, (top - y) / 2.35],
                [1, (top - y) / 2.35],
                [1, (bottom - y) / 2.35],
              ]);
              if (c.sills && y >= lower) {
                beam(
                  o,
                  'clad',
                  [u[0] + normal[0] * 0.2, y - 0.1, u[1] + normal[2] * 0.2],
                  [v[0] + normal[0] * 0.2, y - 0.1, v[1] + normal[2] * 0.2],
                  0.3,
                  0.13,
                  C.clad,
                );
              }
            }
          const pilaster = Math.max(0.02 / len, t - c.pitch / (2 * len)),
            mid = at(pilaster),
            left = at(Math.min(1, pilaster + 0.35 / len));
          if (c.flatPilasters) panel(o, 'clad', mid, left, lo + 0.1, hi, normal, 0.025, C.clad);
          if (c.pilasters) {
            const x = mid[0] + normal[0] * 0.1,
              z = mid[1] + normal[2] * 0.1;
            box(o, 'clad', [x - 0.16, lo + 0.05, z - 0.16], [x + 0.16, hi, z + 0.16], C.clad);
          }
        }
        if (c.bands)
          for (let y = Math.ceil((lo + 0.5) / c.bands) * c.bands; y < hi - 0.5; y += c.bands)
            beam(
              o,
              'clad',
              [p[0] + normal[0] * 0.1, y, p[1] + normal[2] * 0.1],
              [q[0] + normal[0] * 0.1, y, q[1] + normal[2] * 0.1],
              0.18,
              0.15,
              C.clad,
            );
      }
    }
}
function cornice(o, polys, y, c) {
  if (!c.cornice) return;
  for (const poly of polys)
    for (const raw of poly) {
      const r = ring(raw);
      for (let i = 0; i < r.length; i++) {
        const p = r[i],
          q = r[(i + 1) % r.length],
          len = Math.hypot(q[0] - p[0], q[1] - p[1]);
        if (len < 0.5) continue;
        const nx = (q[1] - p[1]) / len,
          nz = -(q[0] - p[0]) / len;
        for (let k = 0; k < c.cornice; k++) {
          const offset = 0.22 + k * 0.22,
            h = y - 0.75 + k * 0.32;
          beam(
            o,
            'clad',
            [p[0] + nx * offset, h, p[1] + nz * offset],
            [q[0] + nx * offset, h, q[1] + nz * offset],
            0.36 + k * 0.2,
            0.23,
            C.clad,
          );
        }
      }
    }
}
function column(o, x, z, c) {
  const top = 7.95;
  box(o, 'clad', [x - 0.51, 0.15, z - 0.51], [x + 0.51, top, z + 0.51], C.clad);
  if (c.columns >= 2) {
    box(o, 'clad', [x - 0.72, 0.15, z - 0.72], [x + 0.72, 0.5, z + 0.72], C.clad);
    box(o, 'clad', [x - 0.8, top - 0.32, z - 0.8], [x + 0.8, top + 0.05, z + 0.8], C.clad);
  }
  if (c.columns >= 3) {
    box(o, 'clad', [x - 0.64, 0.5, z - 0.64], [x + 0.64, 0.66, z + 0.64], C.clad);
    box(o, 'clad', [x - 0.7, top - 0.6, z - 0.7], [x + 0.7, top - 0.32, z + 0.7], C.clad);
  }
}
function podiumBody(o, c) {
  walls(o, 'infill', infill, 0.14, 8.0, C.infill);
  cap(o, 'clad', infill, 0.14, C.clad, true);
  for (const p of infill)
    facade(o, [p], 0.3, 7.95, {
      ...c,
      pitch: 4,
      ribbons: true,
      panes: false,
      pilasters: false,
      flatPilasters: false,
      sills: false,
      bands: 0,
      baseGlazing: true,
    });
  walls(o, 'clad', podium, 8, 10, C.clad);
  cap(o, 'clad', podium, 8, C.clad, true);
  cap(o, 'roof', podium, 10, C.roof);
  for (const [x, z] of a.columns) column(o, x, z, c);
  cornice(o, podium, 10, c);
  // Two projecting mapped porticoes retain a deep, genuinely open lower canopy.
  for (const portico of a.porticos) {
    const [x, z] = portico.center,
      side = portico.side,
      outer = z + side * 12,
      ground = triumphGroundY(x, outer) + 0.12,
      steps = 20;
    box(
      o,
      'paving',
      [x - 10.5, ground - 0.3, Math.min(z, z + side * 2)],
      [x + 10.5, 0.14, Math.max(z, z + side * 2)],
      C.paving,
    );
    for (let i = 0; i < steps; i++) {
      const za = z + side * (2 + ((i + 1) * 10) / steps),
        zb = z + side * (2 + (i * 10) / steps),
        top = ground + (1 - (i + 1) / steps) * (0.14 - ground);
      box(
        o,
        'paving',
        [x - 10.5, Math.min(ground - 0.3, top - 0.2), Math.min(za, zb)],
        [x + 10.5, top, Math.max(za, zb)],
        C.paving,
      );
    }
  }
}
function spire(o, c) {
  const [x, z] = a.spire.center,
    ys = [
      [220, 5.4],
      [223, 4.9],
      [228, 4.1],
      [264, 0.035],
    ],
    n = c.spire;
  const rings = ys.map(([y, r]) =>
    Array.from({ length: n }, (_, i) => {
      const t = (-i * 2 * Math.PI) / n;
      return [x + r * Math.cos(t), y, z + r * Math.sin(t)];
    }),
  );
  loft(o, S(c, 'clad'), rings, C.clad);
  if (!c.far) {
    for (const [y, r] of [
      [220, 5.5],
      [223, 5],
    ]) {
      const rings = [y, y + 0.2].map((y) =>
        Array.from({ length: n }, (_, i) => [
          x + r * Math.cos((-i * 2 * Math.PI) / n),
          y,
          z + r * Math.sin((-i * 2 * Math.PI) / n),
        ]),
      );
      loft(o, 'clad', rings, C.clad);
    }
  }
}
function garden(o, c) {
  if (!c.garden) return;
  for (const x of [-97, -76, -55, -34])
    for (const z of [-8, 8]) {
      box(o, 'clad', [x - 7, 10, z - 2.2], [x + 7, 10.55, z + 2.2], C.clad);
      box(o, 'land', [x - 6.65, 10.55, z - 1.85], [x + 6.65, 10.6, z + 1.85], C.green);
    }
  for (const x of [-108, -86, -64, -42])
    for (const z of [-15.5, 15.5])
      box(o, 'paving', [x - 5, 10.01, z - 0.8], [x + 5, 10.08, z + 0.8], C.paving);
}
export function buildTriumphLevel(o, level = 'master') {
  const c = configs[level];
  if (!c) throw Error('Unknown Triumph level ' + level);
  foundation(o, c);
  if (c.aggregate) {
    walls(o, S(c, 'clad'), podium, 0.14, 10, C.clad);
    cap(o, S(c, 'roof'), podium, 10, C.roof);
    for (const p of a.parts.filter((p) => p.maxY > 10)) {
      const [x0, z0, x1, z1] = p.bounds;
      box(o, S(c, 'infill'), [x0, p.minY || 10, z0], [x1, p.maxY, z1], C.infill);
      if (!c.far) {
        const poly = oriented([
          [
            [
              [x0, z0],
              [x1, z0],
              [x1, z1],
              [x0, z1],
              [x0, z0],
            ],
          ],
        ]);
        facade(o, poly, Math.max(10, p.minY), p.maxY, c);
        box(
          o,
          'clad',
          [x0 - 0.35, p.maxY - 0.65, z0 - 0.35],
          [x1 + 0.35, p.maxY + 0.12, z1 + 0.35],
          C.clad,
        );
      }
    }
  } else {
    podiumBody(o, c);
    for (const l of layers.filter((l) => l.minY >= 10)) {
      walls(o, 'infill', l.polygons, l.minY, l.maxY, C.infill);
      cap(o, 'roof', l.roofs, l.maxY, C.roof);
      facade(o, l.polygons, l.minY, l.maxY, c);
      cornice(o, l.roofs, l.maxY, c);
    }
    garden(o, c);
  }
  spire(o, c);
}
export const buildTriumphSkyline = (o) => buildTriumphLevel(o, 'skyline');
export const buildTriumphDistrict = (o) => buildTriumphLevel(o, 'district');
export const buildTriumphStreet = (o) => buildTriumphLevel(o, 'street');
export const buildTriumphCloseup = (o) => buildTriumphLevel(o, 'closeup');
