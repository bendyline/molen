/** Individual Aleppo citadel: mapped gates/bridge and picture-led upper compound. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { openingBuilder, openingReveals, prepareOpening } from './authored-wall-openings.mjs';

const source = new URL(
  '../../../content/worldgen/source/places/sy/sy6/n0314_citadel_of_aleppo/',
  import.meta.url,
);
const read = (name) => JSON.parse(readFileSync(new URL(name, source)));
const frame = read('map-frame.json'),
  fit = read('pmtiles-fit.json'),
  scope = read('review-scope.json'),
  means = read('surface-means.json');
const parts = frame.reconstruction.eastSouthParts;
const heading = frame.heading,
  cos = Math.cos(heading),
  sin = Math.sin(heading);
const localPoint = ([x, y, z]) => [x * cos - z * sin, y, x * sin + z * cos];
const cameraFrame = (c) => ({
  ...c,
  position: localPoint(c.position),
  lookAt: localPoint(c.lookAt),
});
const palette = { stone: '#cdc7b6', roof: '#a47876', dark: '#615c53', wood: '#74634e' };
const linear = (hex) =>
  hex
    .slice(1)
    .match(/../g)
    .map((s) => {
      const v = parseInt(s, 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
const colors = Object.fromEntries(Object.entries(palette).map(([k, v]) => [k, linear(v)]));
const norm = (v) => {
  const m = Math.hypot(...v);
  return v.map((n) => n / m);
};
const at = (p, y) => [p[0], typeof y === 'function' ? y(p) : y, p[1]];
const rect = (x, z, w, d) => [
  [x - w / 2, z - d / 2],
  [x + w / 2, z - d / 2],
  [x + w / 2, z + d / 2],
  [x - w / 2, z + d / 2],
];
export function aleppoGround(x, z) {
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Aleppo footing outside retained terrain');
  const i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    k = j * g.width + i,
    h = g.heights;
  return (
    (h[k] * (1 - a) + h[k + 1] * a) * (1 - b) +
    (h[k + g.width] * (1 - a) + h[k + g.width + 1] * a) * b -
    fit.datumMeters
  );
}
const base = (p) => aleppoGround(...p) - 0.3;
function adapter(out, surface = 'stone') {
  return {
    addTriangle(s, ref, p, n, uv, c) {
      out.addTriangle(s === 'rubble' ? surface : s, ref, p, n, uv, c);
    },
  };
}
function writer(out, detail) {
  return (s, poly, direction, tint = colors[s]) => {
    let p = poly.map((p) => p.map(Math.fround));
    if (direction && normalFor(...p.slice(0, 3)).reduce((v, n, i) => v + n * direction[i], 0) < 0)
      p = p.reverse();
    const color = detail === 0 ? tint.map((v, i) => v * means[s][i]) : tint;
    for (let i = 1; i < p.length - 1; i++) {
      const tri = [p[0], p[i], p[i + 1]],
        n = normalFor(...tri);
      if (
        Math.hypot(
          ...cross(
            tri[1].map((v, k) => v - tri[0][k]),
            tri[2].map((v, k) => v - tri[0][k]),
          ),
        ) < 1e-8
      )
        continue;
      out.addTriangle(
        s,
        'palette:#ffffff',
        tri,
        n,
        [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
        color,
      );
    }
  };
}
function cap(face, ring, y, s = 'stone') {
  const ids = earcut(ring.flat(), null, 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      s,
      ids.slice(i, i + 3).map((k) => at(ring[k], y)),
      [0, 1, 0],
    );
}
function solid(face, ring, b, t, s = 'stone') {
  const sign = Math.sign(
    ring.reduce((n, a, i) => {
      const c = ring[(i + 1) % ring.length];
      return n + a[0] * c[1] - c[0] * a[1];
    }, 0),
  );
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      c = ring[(i + 1) % ring.length];
    face(
      s,
      [at(a, b), at(c, b), at(c, t), at(a, t)],
      [(c[1] - a[1]) * sign, 0, (a[0] - c[0]) * sign],
    );
  }
  cap(face, ring, t, s);
}
const box = (face, x, z, w, d, b, t, s = 'stone') => solid(face, rect(x, z, w, d), b, t, s);
function beam(face, a, b, w, d, s = 'stone') {
  const n = norm(b.map((v, i) => v - a[i])),
    u = norm(cross(n, Math.abs(n[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0])),
    v = cross(n, u);
  const ring = (p) =>
    [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([x, z]) => p.map((q, i) => q + (u[i] * x * w + v[i] * z * d) / 2));
  const ra = ring(a),
    rb = ring(b);
  for (let i = 0; i < 4; i++)
    face(
      s,
      [ra[i], ra[(i + 1) % 4], rb[(i + 1) % 4], rb[i]],
      ra[i].map((q, j) => q - a[j]),
    );
  face(
    s,
    ra,
    n.map((v) => -v),
  );
  face(s, rb, n);
}
function aperture(h, detail) {
  const p = prepareOpening(h, 0, detail);
  if (h.shape !== 'circle') return p;
  p.ring = Array.from({ length: detail <= 1 ? 8 : 12 }, (_, i) => {
    const a = (i * Math.PI * 2) / (detail <= 1 ? 8 : 12);
    return [(Math.cos(a) * h.width) / 2, h.bottom + h.height / 2 + (Math.sin(a) * h.height) / 2];
  });
  p.planes = p.planes.slice(0, 2);
  for (let i = 0; i < p.ring.length; i++) {
    const a = p.ring[i],
      b = p.ring[(i + 1) % p.ring.length],
      du = b[0] - a[0],
      dv = b[1] - a[1];
    p.planes.push([
      -dv * p.axis[0],
      du,
      -dv * p.axis[1],
      dv * (h.center[0] * p.axis[0] + h.center[1] * p.axis[1] + a[0]) - du * a[1],
    ]);
  }
  return p;
}
/** A thick wall segment with genuine apertures and exposed jambs, not painted dark windows. */
function wall(out, detail, a, b, thickness, bottom, top, s = 'stone', holes = []) {
  const u = norm([b[0] - a[0], b[1] - a[1]]),
    n = [-u[1], u[0]],
    ring = [
      a.map((v, i) => v + (n[i] * thickness) / 2),
      b.map((v, i) => v + (n[i] * thickness) / 2),
      b.map((v, i) => v - (n[i] * thickness) / 2),
      a.map((v, i) => v - (n[i] * thickness) / 2),
    ];
  if (typeof top === 'function' && typeof bottom !== 'function') {
    for (const i of [2, 0]) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length];
      ring.splice(
        i + 1,
        0,
        a.map((v, k) => (v + b[k]) / 2),
      );
    }
  }
  const prepared = holes.map((h) =>
    aperture({ axis: u, depth: thickness + 1, shape: 'pointed', ...h }, detail),
  );
  const target = adapter(out, s),
    face = writer(openingBuilder(target, prepared), detail);
  solid(face, ring, bottom, top, s);
  openingReveals(
    target,
    ring,
    (p) => (typeof bottom === 'function' ? bottom(p) : bottom),
    (p) => (typeof top === 'function' ? top(p) : top),
    prepared,
    detail === 0 ? colors[s].map((v, i) => v * means[s][i]) : colors[s],
  );
  if (detail >= 2) {
    const trim = writer(target, detail);
    for (const h of prepared)
      for (let i = 0; i < h.ring.length; i++) {
        if (h.shape === 'circle' || i > 0) {
          const r = h.ring[i],
            q = h.ring[(i + 1) % h.ring.length];
          for (const sign of [-1, 1]) {
            if (detail === 2) {
              const du = q[0] - r[0],
                dv = q[1] - r[1],
                m = Math.hypot(du, dv),
                u = (-dv * 0.1) / m,
                v = (du * 0.1) / m,
                d = sign * (thickness / 2 + 0.12);
              trim(
                s,
                [
                  h.point(r[0] + u, r[1] + v, d),
                  h.point(q[0] + u, q[1] + v, d),
                  h.point(q[0] - u, q[1] - v, d),
                  h.point(r[0] - u, r[1] - v, d),
                ],
                [h.normal[0] * sign, 0, h.normal[1] * sign],
              );
            } else
              beam(
                trim,
                h.point(...r, sign * (thickness / 2 + 0.1)),
                h.point(...q, sign * (thickness / 2 + 0.1)),
                0.2,
                0.23,
                s,
              );
          }
        }
      }
  }
}
function roof(face, ring, eaves, ridge, s = 'roof', wallSurface = 'stone') {
  const a = ring[0],
    b = ring[1],
    c = ring[2],
    d = ring[3],
    r0 = [(a[0] + d[0]) / 2, ridge, (a[1] + d[1]) / 2],
    r1 = [(b[0] + c[0]) / 2, ridge, (b[1] + c[1]) / 2];
  face(s, [at(a, eaves), at(b, eaves), r1, r0], [0, 1, 0]);
  face(s, [r0, r1, at(c, eaves), at(d, eaves)], [0, 1, 0]);
  const u = norm([b[0] - a[0], b[1] - a[1]]);
  face(wallSurface, [at(d, eaves), at(a, eaves), r0], [-u[0], 0, -u[1]]);
  face(wallSurface, [at(b, eaves), at(c, eaves), r1], [u[0], 0, u[1]]);
}
function pyramid(face, x, z, w, d, y, top, s = 'stone') {
  const p = rect(x, z, w, d);
  for (let i = 0; i < 4; i++)
    face(s, [at(p[i], y), at(p[(i + 1) % 4], y), [x, top, z]], [p[i][0] - x, 1, p[i][1] - z]);
}

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const center = (r) => r.reduce((a, p) => a.map((v, i) => v + p[i] / r.length), [0, 0]);
const footing = (r) => Math.min(...r.map((p) => aleppoGround(...p))) - 0.3;
const circle = (x, z, r, n, phase = 0) =>
  Array.from({ length: n }, (_, i) => [
    x + r * Math.cos((i * Math.PI * 2) / n + phase),
    z + r * Math.sin((i * Math.PI * 2) / n + phase),
  ]);
function prism(face, r, b, t, s = 'stone') {
  solid(face, r, b, t, s);
}
function dome(face, x, z, r, y, rise, detail, s = 'stone') {
  const n = [6, 8, 12, 16, 24][detail],
    steps = [2, 3, 4, 5, 7][detail];
  for (let j = 0; j < steps; j++) {
    const a = ((j / steps) * Math.PI) / 2,
      b = (((j + 1) / steps) * Math.PI) / 2;
    const r0 = circle(x, z, r * Math.cos(a), n),
      r1 = circle(x, z, r * Math.cos(b), n);
    for (let i = 0; i < n; i++)
      face(
        s,
        [
          at(r0[i], y + rise * Math.sin(a)),
          at(r0[(i + 1) % n], y + rise * Math.sin(a)),
          at(r1[(i + 1) % n], y + rise * Math.sin(b)),
          at(r1[i], y + rise * Math.sin(b)),
        ],
        [r0[i][0] - x, 1, r0[i][1] - z],
      );
  }
}
function hip(face, r, y, rise, s = 'roof') {
  const c = center(r),
    inner = r.map((p) => mix(p, c, 0.55));
  for (let i = 0; i < r.length; i++)
    face(
      s,
      [
        at(r[i], y),
        at(r[(i + 1) % r.length], y),
        at(inner[(i + 1) % r.length], y + rise),
        at(inner[i], y + rise),
      ],
      [0, 1, 0],
    );
  cap(face, inner, y + rise, s);
}
function perimeter(out, detail, r, b, t, thickness = 0.8, s = 'stone', cut = () => []) {
  for (let i = 0; i < r.length; i++)
    wall(
      out,
      detail,
      r[i],
      r[(i + 1) % r.length],
      thickness,
      b,
      t,
      s,
      cut(r[i], r[(i + 1) % r.length], i),
    );
}
function parapet(out, detail, r, t, h = 0.75, step = 3, s = 'stone') {
  const face = writer(out, detail);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      n = Math.max(1, Math.round(len / step));
    if (detail === 0) continue;
    for (let j = 0; j < n; j++) {
      const p = mix(a, b, (j + 0.45) / n),
        y = typeof t === 'function' ? t(p) : t;
      box(face, ...p, Math.min(step * 0.48, 1.9), 0.8, y, y + h, s);
    }
  }
}
function gate(out, detail, name) {
  const face = writer(out, detail),
    r = parts[name].outline.filter((_, i) => name !== 'upperGate' || i !== 5),
    upper = name === 'upperGate',
    b = footing(r),
    top = upper ? b + 28 : b + 20;
  const front = upper ? [r[4], r[5]] : [r[0], r[1]],
    mid = center(front),
    u = norm([front[1][0] - front[0][0], front[1][1] - front[0][1]]),
    n = [u[1], -u[0]];
  // The bridge enters the lower storey through the south-facing wall, not a generic central door.
  const threshold = aleppoGround(...mid) + (upper ? 7.8 : 1.8);
  perimeter(out, detail, r, base, top, upper ? 1.5 : 0.95, 'stone', (a, c, i) => {
    const len = Math.hypot(c[0] - a[0], c[1] - a[1]),
      m = center([a, c]),
      holes = [];
    if (i === (upper ? 4 : 0))
      holes.push({
        center: m,
        shape: upper ? 'pointed' : 'rect',
        width: upper ? 5.8 : 2.2,
        bottom: threshold - 0.1,
        height: upper ? 10.5 : 4.5,
        spring: upper ? 8.0 : 4.5,
      });
    if (detail >= 1 && len > 6) {
      const count = detail === 1 ? 1 : Math.max(1, Math.round(len / (upper ? 5.7 : 4.3)));
      for (let j = 0; j < count; j++)
        holes.push({
          center: mix(a, c, (j + 0.5) / count),
          shape: 'rect',
          width: upper ? 1.1 : 0.65,
          bottom: top - (upper ? 9 : 5),
          height: upper ? 2.2 : 1.1,
        });
    }
    if (detail >= 2 && upper && len > 7)
      for (const t of [0.27, 0.73])
        holes.push({
          center: mix(a, c, t),
          shape: 'pointed',
          width: 0.7,
          bottom: top - 4.7,
          height: 1.6,
          spring: 1.1,
        });
    return holes;
  });
  // Gate passage stays open at floor height. Internal transverse walls retain the bent entry mass.
  if (detail >= 1 && upper) {
    const a = mix(r[0], r[5], 0.35),
      c = mix(r[1], r[3], 0.35),
      m = center([a, c]);
    wall(out, detail, a, c, 1.1, base, top - 2, 'stone', [
      { center: m, width: 4.1, bottom: threshold, height: 8, spring: 5.8 },
    ]);
  }
  if (!upper || detail > 0) cap(face, r, top - 0.35);
  if (upper) {
    hip(face, r, top - 0.15, 1.15);
    const [x, z] = center(r),
      lantern = circle(x, z, 2.6, detail === 0 ? 4 : 8, Math.PI / 8);
    prism(face, lantern, top + 0.8, top + 1.8);
    hip(face, lantern, top + 1.8, 1.1);
  } else parapet(out, detail, r, top, 1.15, 2.4);
  if (detail >= 1) {
    // Projecting ledges and brackets frame the large pointed portal; they do not close its void.
    for (const side of [-1, 1]) {
      const c = mid.map((v, i) => v + u[i] * side * (upper ? 4.6 : 2.3) + n[i] * 1.0);
      box(
        face,
        ...c,
        upper ? 1.5 : 0.8,
        upper ? 1.5 : 1.0,
        threshold + (upper ? 7.1 : 4.3),
        threshold + (upper ? 8.0 : 4.8),
      );
      if (detail >= 2)
        for (const d of [-0.4, 0, 0.4]) {
          const p = c.map((v, i) => v + u[i] * d);
          beam(
            face,
            [p[0], threshold + (upper ? 5.6 : 3.5), p[1]],
            [p[0] - n[0] * 0.4, threshold + (upper ? 7.1 : 4.3), p[1] - n[1] * 0.4],
            0.22,
            0.32,
          );
        }
    }
  }
  if (detail >= 2) {
    // Selective dark/light stone courses follow the photograph; no unique photo texture is shipped.
    for (const height of upper ? [top - 8.8, top - 8.1] : [threshold + 4.9])
      for (const t of [0.12, 0.23, 0.35, 0.66, 0.77, 0.88]) {
        const c = mix(...front, t).map((v, i) => v + n[i] * (upper ? 0.87 : 0.57));
        beam(
          face,
          [c[0] - u[0] * 0.35, height, c[1] - u[1] * 0.35],
          [c[0] + u[0] * 0.35, height, c[1] + u[1] * 0.35],
          0.25,
          0.2,
          'dark',
        );
      }
  }
  return { threshold, top, front, mid };
}
function approach(out, detail, upper, lower) {
  const face = writer(out, detail),
    line = frame.reconstruction.eastSouthBridge.centerline;
  const a = line[0],
    c = lower.mid,
    end = line.at(-1),
    axis = norm([c[0] - a[0], c[1] - a[1]]),
    normal = [-axis[1], axis[0]],
    len = Math.hypot(c[0] - a[0], c[1] - a[1]);
  const y = (p) =>
    upper.threshold +
    ((lower.threshold - upper.threshold) * ((p[0] - a[0]) * axis[0] + (p[1] - a[1]) * axis[1])) /
      len;
  const segments = [2, 4, 7, 8, 8][detail];
  // Broad masonry piers separate real arch voids. Each span follows the ascending deck.
  for (let i = 0; i < segments; i++) {
    const p = mix(a, c, i / segments),
      q = mix(a, c, (i + 1) / segments),
      m = center([p, q]);
    const bottom = aleppoGround(...m) - 6,
      span = len / segments,
      width = span - (detail === 0 ? 1.5 : 1.05),
      crown = Math.min(y(p), y(q)) - 0.8;
    const hole = {
      center: m,
      shape: 'round',
      width,
      bottom,
      height: crown - bottom,
      spring: crown - bottom - width * 0.46,
    };
    wall(out, detail, p, q, 4.1, base, y, 'stone', [hole]);
  }
  const steps = [2, 9, 24, 42, 58][detail];
  for (let j = 0; j < steps; j++) {
    const p = mix(a, c, j / steps),
      q = mix(a, c, (j + 1) / steps),
      height = y(q) + 0.11;
    const r = [
      p.map((v, k) => v + normal[k] * 1.8),
      q.map((v, k) => v + normal[k] * 1.8),
      q.map((v, k) => v - normal[k] * 1.8),
      p.map((v, k) => v - normal[k] * 1.8),
    ];
    prism(face, r, (p) => y(p) - 0.12, height);
  }
  for (const sign of [-1, 1])
    wall(
      out,
      detail,
      a.map((v, i) => v + normal[i] * sign * 1.9),
      c.map((v, i) => v + normal[i] * sign * 1.9),
      0.35,
      y,
      (p) => y(p) + 0.72,
    );
  // The mapped steps continue downhill from the lower gate to Qalaah Street.
  const uy = lower.threshold,
    ey = aleppoGround(...end) + 0.15;
  for (let i = 0; i < (detail <= 1 ? 4 : 14); i++) {
    const count = detail <= 1 ? 4 : 14,
      p = mix(c, end, i / count),
      q = mix(c, end, (i + 1) / count),
      r = [
        p.map((v, k) => v + normal[k] * 1.15),
        q.map((v, k) => v + normal[k] * 1.15),
        q.map((v, k) => v - normal[k] * 1.15),
        p.map((v, k) => v - normal[k] * 1.15),
      ];
    prism(face, r, base, uy + ((ey - uy) * i) / count);
  }
}
function hillAndCurtain(out, detail) {
  const face = writer(out, detail),
    foot = frame.reconstruction.eastSouthFoot,
    crest = frame.reconstruction.eastSouthCrest;
  // The stone-faced annulus follows the retained terrain, with subdivisions needed on the smooth slope.
  const n = detail === 0 ? 12 : foot.length,
    outer = detail === 0 ? foot.filter((_, i) => i % 2 === 0) : foot,
    inner = detail === 0 ? crest.filter((_, i) => i % 2 === 0) : crest,
    bands = [1, 3, 5, 7, 10][detail];
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n,
      length = Math.hypot(outer[next][0] - outer[i][0], outer[next][1] - outer[i][1]);
    const slices =
      detail === 0 ? 1 : detail === 1 ? 2 : Math.ceil(length / (detail === 2 ? 16 : 6));
    for (let k = 0; k < slices; k++)
      for (let j = 0; j < (detail === 1 ? 2 : bands); j++) {
        const band = detail === 1 ? 2 : bands;
        const start = mix(inner[i], outer[i], j / band),
          end = mix(inner[next], outer[next], j / band),
          start2 = mix(inner[i], outer[i], (j + 1) / band),
          end2 = mix(inner[next], outer[next], (j + 1) / band);
        const a = mix(start, end, k / slices),
          b = mix(start, end, (k + 1) / slices),
          c = mix(start2, end2, (k + 1) / slices),
          d = mix(start2, end2, k / slices);
        face(
          'stone',
          [a, b, c, d].map((p) =>
            at(
              p,
              aleppoGround(...p) +
                (detail === 0 ? 3.0 : detail === 1 ? 1.5 : detail === 2 ? 0.9 : 0.6),
            ),
          ),
          [0, 1, 0],
          colors.stone.map((v) => v * 0.94),
        );
      }
  }
  const r = detail === 0 ? crest.filter((_, i) => i % 2 === 0) : crest;
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      m = center([a, b]);
    // Southwest gate occupies the curtain's local break; the approach never crosses a filled wall.
    if (m[0] < -53 && m[0] > -115 && m[1] > 65) continue;
    wall(out, detail, a, b, 2.3, base, (p) => aleppoGround(...p) + 5.9);
  }
  const indices =
    detail === 0 ? [1, 4, 7, 10, 13, 16, 19, 22] : [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23];
  for (const i of indices) {
    const p = crest[i];
    if (p[0] < -50 && p[1] > 65) continue;
    const b = aleppoGround(...p) - 0.3,
      r = rect(...p, 9.3, 8.4);
    prism(face, r, base, b + 8.5);
    if (detail >= 2) {
      // Sparse slit recesses sit outside solid bastion walls, at useful street-scale width.
      for (const sign of [-1, 1])
        box(face, p[0] + sign * 4.7, p[1], 0.05, 0.8, b + 5.3, b + 6.7, 'dark');
    }
  }
  // The detached lower south bastion has its own mapped polygon, not the upper curtain envelope.
  const lower = parts.southBastion.outline,
    b = footing(lower);
  perimeter(out, detail, lower, base, b + 11, 1.15);
  if (detail >= 1) cap(face, lower, b + 2.0);
  parapet(out, detail, lower, b + 11, 0.9, 3.0);
}
function mosque(out, detail, key) {
  const face = writer(out, detail),
    r = detail === 0 && key === 'grandMosque' ? rect(-54.8, -56, 33, 29) : parts[key].outline,
    b = footing(r),
    large = key === 'grandMosque',
    top = b + (large ? 7.3 : 5.5);
  if (detail === 0 && !large) prism(face, r, base, top);
  else
    perimeter(out, detail, r, base, top, 0.72, 'stone', (a, c) => {
      const len = Math.hypot(c[0] - a[0], c[1] - a[1]),
        h = [];
      if (detail >= 1 && len > 9)
        for (const t of detail === 1 ? [0.5] : [0.22, 0.52, 0.82])
          h.push({
            center: mix(a, c, t),
            shape: 'pointed',
            width: 1.3,
            bottom: b + 1.0,
            height: 3.1,
            spring: 2.2,
          });
      return h;
    });
  if (large) {
    const hall = [
      [-68.4, -53.3],
      [-44, -54.4],
      [-42.3, -41.6],
      [-68.3, -41.4],
    ];
    cap(face, hall, top); // Open north court preserves the mosque courtyard, not a filled building lid.
    const c = center(hall);
    dome(face, ...c, 3.7, top, 2.8, detail);
    const mr = rect(-68.3, -65.8, 4.2, 4.2),
      y = aleppoGround(-68.3, -65.8);
    prism(face, mr, base, y + 26);
    if (detail >= 1) {
      prism(face, rect(-68.3, -65.8, 5.1, 5.1), y + 21.5, y + 22.15);
      prism(face, rect(-68.3, -65.8, 4.8, 4.8), y + 26, y + 26.6);
    }
    if (detail >= 2)
      for (const sign of [-1, 1])
        box(face, -68.3 + sign * 2.12, -65.8, 0.05, 0.75, y + 23.1, y + 25.2, 'dark');
  } else {
    cap(face, r, top);
    dome(face, -73, -3, 3.0, top, 2.8, detail);
    const p = [-54.7, 5.4],
      y = aleppoGround(...p),
      n = detail === 0 ? 6 : detail === 1 ? 8 : detail === 2 ? 12 : 16;
    prism(face, circle(...p, 1.65, n), base, y + 19);
    prism(face, circle(...p, 2.5, n), y + 15, y + 15.6);
    prism(face, circle(...p, 1.4, n), y + 19, y + 22);
    dome(face, ...p, 1.4, y + 22, 1.4, detail);
    if (detail >= 2)
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4,
          c = [p[0] + Math.cos(a) * 2.3, p[1] + Math.sin(a) * 2.3];
        box(face, ...c, 0.2, 0.2, y + 15.5, y + 16.5);
      }
  }
}
function interior(out, detail) {
  const face = writer(out, detail);
  for (const key of ['northHall', 'northAnnex', 'gateRear']) {
    const r = parts[key].outline,
      b = footing(r),
      h = key === 'northHall' ? 6.5 : 4.5;
    if (detail <= 1) prism(face, r, base, b + h);
    else
      perimeter(out, detail, r, base, b + h, 0.7, 'stone', (a, c) => {
        const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
        if (detail === 0 || len < 12) return [];
        const count = detail === 1 ? 2 : Math.round(len / 6.5);
        return Array.from({ length: count }, (_, i) => ({
          center: mix(a, c, (i + 0.5) / count),
          shape: 'pointed',
          width: 1.7,
          bottom: b + 0.4,
          height: 3.4,
          spring: 2.3,
        }));
      });
    cap(face, r, b + h);
    hip(face, r, b + h, 0.9, 'stone');
    if (detail >= 2 && key === 'northHall')
      for (const t of [0.25, 0.75]) {
        const p = mix(r[2], r[3], t);
        box(face, ...p, 1.35, 0.14, b + 0.12, b + 2.6, 'wood');
      }
  }
  const r = parts.bath.outline,
    b = footing(r);
  if (detail <= 1) prism(face, r, base, b + 3.3);
  else perimeter(out, detail, r, base, b + 3.3, 0.65);
  cap(face, r, b + 3.3);
  for (const [x, z, rad] of detail === 0
    ? [[-4, 50, 3]]
    : [
        [-4, 45, 3],
        [-4, 59, 3],
        [-19, 65, 2.6],
        [-29, 65, 2.2],
      ])
    dome(face, x, z, rad, b + 3.3, rad * 0.65, detail);
  if (detail >= 1) {
    // An open theatre/excavation enclosure remains a low mass at its PMTiles polygon.
    const r = parts.theatre.outline;
    perimeter(out, detail, r, base, (p) => aleppoGround(...p) + 1.1, 0.5);
    const x = -2,
      z = -18,
      y = aleppoGround(x, z),
      levels = detail === 1 ? 1 : detail === 2 ? 6 : 8,
      n = detail === 1 ? 6 : 16;
    for (let j = 0; j < levels; j++)
      for (let i = 0; i < n; i++) {
        const a = Math.PI * 0.04 + (i * Math.PI * 0.92) / n,
          c = Math.PI * 0.04 + ((i + 1) * Math.PI * 0.92) / n,
          r0 = 8 + j * 1.8,
          r1 = r0 + 1.8;
        const p = (rad, angle) => [x + Math.cos(angle) * rad, z - Math.sin(angle) * rad];
        face(
          'stone',
          [
            at(p(r0, a), y + j * 0.45),
            at(p(r1, a), y + j * 0.45),
            at(p(r1, c), y + j * 0.45),
            at(p(r0, c), y + j * 0.45),
          ],
          [0, 1, 0],
        );
        face(
          'stone',
          [
            at(p(r0, a), y + (j - 1) * 0.45),
            at(p(r0, c), y + (j - 1) * 0.45),
            at(p(r0, c), y + j * 0.45),
            at(p(r0, a), y + j * 0.45),
          ],
          [0, 0, 1],
        );
      }
  }
  // Picture-led roofless room groups. Larger empty courts and paths are retained between them.
  const groups = [
    [-112, -34, 24, 20],
    [-97, 25, 25, 30],
    [-53, 45, 30, 29],
    [33, 38, 29, 31],
    [71, 0, 34, 30],
    [96, -35, 28, 28],
    [58, -80, 32, 17],
    [-124, 62, 18, 25],
    [-142, -5, 20, 26, 0.15],
    [-112, -67, 23, 19, 0.12],
    [-77, -92, 18, 16, 0.16],
    [-127, 28, 18, 23, 0.08],
    [-72, 28, 13, 16, -0.12],
    [-43, 4, 15, 17, -0.07],
    [26, 13, 16, 17, 0.11],
    [19, 75, 20, 16, -0.13],
    [52, 74, 24, 15, -0.18],
    [112, 48, 16, 20, -0.21],
    [126, 10, 15, 23, -0.1],
    [82, -64, 19, 21, 0.2],
  ];
  const count = detail === 0 ? 1 : detail === 1 ? 8 : groups.length;
  for (const [x, z, w, d, angle = 0] of groups.slice(0, count)) {
    const rotate = ([a, b]) => [
      x + (a - x) * Math.cos(angle) - (b - z) * Math.sin(angle),
      z + (a - x) * Math.sin(angle) + (b - z) * Math.cos(angle),
    ];
    const rr = rect(x, z, w, d).map(rotate),
      h = detail === 0 ? 1.8 : 2.2;
    perimeter(out, detail, rr, base, (p) => aleppoGround(...p) + h, 0.75);
    if (detail >= 2) {
      wall(
        out,
        detail,
        rotate([x, z - d / 2]),
        rotate([x, z + d / 2]),
        0.55,
        base,
        (p) => aleppoGround(...p) + h,
        'stone',
        detail >= 2
          ? [{ center: [x, z], shape: 'rect', width: 1.6, bottom: aleppoGround(x, z), height: 2.0 }]
          : [],
      );
      wall(
        out,
        detail,
        rotate([x - w / 2, z]),
        rotate([x + w / 2, z]),
        0.55,
        base,
        (p) => aleppoGround(...p) + h,
      );
    }
    if (detail >= 3)
      for (const a of [0, 1, 2])
        wall(
          out,
          detail,
          rotate([x - w / 2 + (a * w) / 3, z + d / 4]),
          rotate([x - w / 2 + ((a + 1) * w) / 3, z + d / 4]),
          0.5,
          base,
          (p) => aleppoGround(...p) + 1.5,
        );
  }
}
function build(target, detail) {
  const out = {
    addTriangle: (s, ref, points, normal, uv, color) =>
      target.addTriangle(s, ref, points.map(localPoint), localPoint(normal), uv, color),
  };
  hillAndCurtain(out, detail);
  const upper = gate(out, detail, 'upperGate'),
    lower = gate(out, detail, 'lowerGate');
  approach(out, detail, upper, lower);
  mosque(out, detail, 'grandMosque');
  mosque(out, detail, 'ibrahimMosque');
  interior(out, detail);
}
export const buildAleppoSkyline = (out) => build(out, 0);
export const buildAleppoDistrict = (out) => build(out, 1);
export const buildAleppoStreet = (out) => build(out, 2);
export const buildAleppoCloseup = (out) => build(out, 3);
export const aleppoStudy = {
  id: 'N0314',
  key: 'citadel_of_aleppo',
  title: 'Citadel of Aleppo',
  category: 'castle',
  wikidataId: 'Q206231',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  importReason:
    'Individual mapped southwest gate/arch bridge, hill-facing curtain and distinct surviving compound with mosque minarets, roofed hall, bath and roofless rooms; four authored levels share central textures.',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (out) => build(out, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief:
    'Citadel of Aleppo: oval stone-faced hill, inset irregular curtain/bastions, mapped ascending arch bridge, lower entry tower and broad upper gate/throne hall with pointed portal and muted red raised roof, two separate mosques/minarets, bath domes, low open theatre and selected roofless palace/room groups.',
  sourceFacts: {
    horizontalBasis:
      'Current standard viewer PMTiles components, named controls and bridge-tagged steps; retained Q206231 hill-foot envelope.',
    architecturalHeights:
      'Picture-led estimates scaled to mapped gate footprints. No bespoke survey, archival reconstruction or measured moat section.',
  },
  reconstruction: frame.reconstruction,
  scaleBasis:
    'Mapped411x277m hill foot, approximately65m entrance steps, mapped gate polygons and20m mapped gate-height hints; upper curtain uses a stated picture-led inset.',
  refs: read('reference-metadata.json').currentRoundInspection.pictures,
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license. Map controls © OpenStreetMap contributors, ODbL-1.0. Linked photos remain external references and are not redistributed.',
  dataAttribution: '© OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Four existing shared256-square graphs provide limestone, ceramic tile, basalt trim and plain wood. No photograph, unique bitmap or embedded image.',
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: palette,
    colorEncoding: 'sRGB converted to linear COLOR_0',
    identityFeatures: [
      'Oval sloped masonry hill and irregular upper curtain with bastions',
      'Ascending real-void arch bridge and distinct lower/upper gates, pointed entrance and muted red gate roof',
      'Square and slender faceted minarets, mosque/bath domes, low theatre and open room ruins',
    ],
  },
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    'Upper curtain location, bastion cadence, heights, roof geometry, internal rooms and ornament are picture-led approximations, not a measured conservation plan.',
    'The retained standard terrain smooths the moat, hill top and terraces. Underarch clearance, wall contact and exact visitor-path joins remain approximate; there is no terrain carving at runtime.',
    'Selected room grids preserve open ruins but do not inventory every room or temple excavation. Modern service huts, war-damage inventories, furnishings, inscriptions and certified walkable collision are excluded.',
    'Physical laptop and phone frame-rate measurements remain pending.',
  ],
  camera: cameraFrame({ position: [-300, 185, 360], lookAt: [0, -8, 10], fov: 44 }),
  qaCameras: [
    { name: 'southwest-entry-arches', position: [-153, 3, 169], lookAt: [-98, -12, 130], fov: 53 },
    { name: 'upper-pointed-gate', position: [-104, 11, 159], lookAt: [-87, -3, 100], fov: 46 },
    { name: 'mosques-and-minarets', position: [-144, 54, -132], lookAt: [-53, 7, -32], fov: 47 },
    { name: 'bath-and-palace-ruins', position: [51, 53, 88], lookAt: [-3, -4, 41], fov: 48 },
    { name: 'north-up-compound-plan', position: [0, 650, 0.1], lookAt: [0, -10, 10], fov: 43 },
    { name: 'east-curtain-and-bastion', position: [229, 41, 101], lookAt: [139, -8, 37], fov: 48 },
  ].map(cameraFrame),
};
