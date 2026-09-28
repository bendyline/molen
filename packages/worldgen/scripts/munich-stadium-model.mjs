/** Munich Olympic Stadium: mapped eight-mast tent, asymmetric green bowl and athletics apron. */
import { beam, cross, loft, normalFor, normalize } from './authored-structure-mesh.mjs';
import { transformed } from './lighthouse-models.mjs';
import { munichPlan } from './munich-plan.mjs';
import { chair, face, soccerPitch } from './stadium-models.mjs';
import { box, tube } from './structure-mesh.mjs';

const TAU = Math.PI * 2;
const concrete = [0.59, 0.58, 0.53],
  pale = [0.8, 0.79, 0.73],
  steel = [0.66, 0.69, 0.67],
  cable = [0.34, 0.38, 0.36],
  dark = [0.027, 0.038, 0.04],
  green = [0.42, 0.56, 0.075],
  fieldY = -18;
const radial = (a, r, y) => [r * Math.sin(a), y, r * Math.cos(a)];
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
function rayHits(poly, a) {
  const d = [Math.sin(a), Math.cos(a)],
    hits = [];
  for (let i = 1; i < poly.length; i++) {
    const p = poly[i - 1],
      q = poly[i],
      e = [q[0] - p[0], q[1] - p[1]],
      den = d[0] * e[1] - d[1] * e[0];
    if (Math.abs(den) < 1e-10) continue;
    const t = (p[0] * e[1] - p[1] * e[0]) / den,
      u = (p[0] * d[1] - p[1] * d[0]) / den;
    if (t > 0 && u >= 0 && u <= 1) hits.push(t);
  }
  return hits;
}
const outer = (a) => Math.max(...rayHits(munichPlan.outline, a));
const inner = (a) => Math.min(...munichPlan.stands.flatMap((s) => rayHits(s.outline, a)));
const topY = (a) => 16 * Math.max(0, Math.sin(a)) ** 3;
function rowPoint(a, t) {
  return radial(a, inner(a) + (outer(a) - inner(a)) * t, fieldY + 1 + (17 + topY(a)) * t);
}
function pathSampler(ps) {
  const ds = [0];
  for (let i = 1; i < ps.length; i++)
    ds.push(ds.at(-1) + Math.hypot(ps[i][0] - ps[i - 1][0], ps[i][1] - ps[i - 1][1]));
  const length = ds.at(-1);
  return (t) => {
    const v = Math.max(0, Math.min(1, t)) * length;
    let i = 1;
    while (i < ds.length - 1 && ds[i] < v) i++;
    return mix(ps[i - 1], ps[i], (v - ds[i - 1]) / (ds[i] - ds[i - 1]));
  };
}
const inside = pathSampler(munichPlan.roof.slice(75, 100));
const outside = pathSampler([
  ...munichPlan.roof.slice(0, 76).reverse(),
  ...munichPlan.roof.slice(99, -1).reverse(),
]);
const mastData = munichPlan.masts.map((m, i) => {
  let nearest = { distance: Infinity, u: 0 };
  for (let n = 0; n <= 1200; n++) {
    const u = n / 1200,
      p = outside(u),
      distance = Math.hypot(p[0] - m.point[0], p[1] - m.point[1]);
    if (distance < nearest.distance) nearest = { distance, u };
  }
  return {
    ...m,
    u: nearest.u,
    height: [47, 57, 65, 70, 70, 63, 54, 44][i],
    peak: [22, 26, 30, 32, 32, 28, 24, 20][i],
  };
});
function roofPoint(u, v) {
  const p = mix(inside(u), outside(u), v),
    end = Math.sin(Math.PI * u) ** 0.26;
  let y = (28 - 20 * v ** 5) * end + 1.6;
  for (const m of mastData) {
    const d = Math.hypot((u - m.u) / 0.039, (v - 0.87) / 0.2);
    y += m.peak * Math.exp(-d * 1.45) * end;
  }
  return [p[0], y, p[1]];
}
function continuous(out, points, r, color = steel, sides = 8, slot = 'metal') {
  if (points.length < 2) return;
  const rings = points.map((p, i) => {
    const a = points[Math.max(0, i - 1)],
      b = points[Math.min(points.length - 1, i + 1)],
      axis = normalize(b.map((v, j) => v - a[j])),
      u = normalize(cross(axis, [0, 1, 0])),
      v = cross(axis, u);
    return Array.from({ length: sides }, (_, j) =>
      p.map(
        (x, k) => x + r * (u[k] * Math.cos((j * TAU) / sides) + v[k] * Math.sin((j * TAU) / sides)),
      ),
    );
  });
  loft(out, slot, rings, color);
}
function rail(out, points, height = 1.05) {
  for (const h of [0.5, height])
    continuous(
      out,
      points.map((p) => [p[0], p[1] + h, p[2]]),
      0.024,
      steel,
      6,
    );
  for (let i = 0; i < points.length; i += 4)
    beam(
      out,
      'metal',
      points[i],
      [points[i][0], points[i][1] + height, points[i][2]],
      0.035,
      0.035,
      steel,
    );
}
function track(out) {
  const o = transformed(out, 0, [0, fieldY, 0]);
  const trackRadius = (a) => {
    const dx = Math.abs(Math.sin(a)),
      dz = Math.abs(Math.cos(a)),
      r = 46.5,
      half = 42.195;
    if (dx > 1e-10 && (r * dz) / dx <= half) return r / dx;
    return half * dz + Math.sqrt(Math.max(0, r * r - half * half * dx * dx));
  };
  for (let i = 0; i < 720; i++) {
    const a = (i * TAU) / 720,
      b = ((i + 1) * TAU) / 720;
    face(
      o,
      'concrete',
      [
        radial(a, trackRadius(a), -0.035),
        radial(b, trackRadius(b), -0.035),
        radial(b, inner(b), -0.035),
        radial(a, inner(a), -0.035),
      ],
      pale,
      [0, 1, 0],
    );
    face(
      o,
      'concrete',
      [
        radial(a, inner(a), -0.035),
        radial(b, inner(b), -0.035),
        radial(b, inner(b), 1),
        radial(a, inner(a), 1),
      ],
      concrete,
      [-Math.sin(a), 0, -Math.cos(a)],
    );
  }
  // The 400m athletics oval has two straight 84.39m runs and semicircular ends.
  const point = (a, r, y = 0) => [
    r * Math.sin(a),
    y,
    (Math.cos(a) >= 0 ? 42.195 : -42.195) + r * Math.cos(a),
  ];
  for (let i = 0; i < 384; i++) {
    const a = (i * TAU) / 384,
      b = ((i + 1) * TAU) / 384;
    face(
      o,
      'plastic',
      [point(a, 36.5), point(b, 36.5), point(b, 46.35), point(a, 46.35)],
      [0.43, 0.065, 0.042],
      [0, 1, 0],
    );
    for (let lane = 0; lane <= 8; lane++)
      face(
        o,
        'plastic',
        [
          point(a, 36.5 + lane * 1.22, 0.012),
          point(b, 36.5 + lane * 1.22, 0.012),
          point(b, 36.55 + lane * 1.22, 0.012),
          point(a, 36.55 + lane * 1.22, 0.012),
        ],
        pale,
        [0, 1, 0],
      );
    const p = [[0, -0.03, 0], point(a, 36.5, -0.03), point(b, 36.5, -0.03)];
    if (normalFor(...p)[1] < 0) p.reverse();
    o.addTriangle(
      'turf',
      'palette:#ffffff',
      p,
      [0, 1, 0],
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      [0.18, 0.34, 0.09],
    );
  }
  // Straight portions are explicit; the circular parameter jumps only at the two tangencies.
  for (const side of [-1, 1]) {
    box(
      o,
      'plastic',
      [side < 0 ? -46.35 : 36.5, -0.02, -42.195],
      [side < 0 ? -36.5 : 46.35, 0, 42.195],
      [0.43, 0.065, 0.042],
    );
    for (let lane = 0; lane <= 8; lane++)
      box(
        o,
        'plastic',
        [side * (36.5 + lane * 1.22) - 0.025, 0.008, -42.195],
        [side * (36.5 + lane * 1.22) + 0.025, 0.018, 42.195],
        pale,
      );
  }
  soccerPitch({
    ...o,
    addQuad(slot, ref, ps, n, uv, color) {
      if (slot === 'turf' && ps.some((p) => Math.abs(p[0]) === 42)) return;
      o.addQuad(slot, ref, ps, n, uv, color);
    },
  });
  // The pitch apron has a pair of long-jump runways and sand pits, separate from the running oval.
  for (const side of [-1, 1]) {
    box(
      o,
      'plastic',
      [side * 52 - 1.6, -0.03, -34],
      [side * 52 + 1.6, 0.01, 29],
      [0.43, 0.065, 0.042],
    );
    box(
      o,
      'ground',
      [side * 52 - 1.45, 0.02, 29],
      [side * 52 + 1.45, 0.05, 37],
      [0.73, 0.65, 0.44],
    );
  }
}
const portalAngles = munichPlan.stands
  .filter((s) => s.name !== 'LOGE')
  .map((s) => {
    const ps = s.outline.slice(0, -1),
      p = [0, 0];
    for (const v of ps) {
      p[0] += v[0] / ps.length;
      p[1] += v[1] / ps.length;
    }
    return Math.atan2(p[0], p[1]);
  });
const angleDistance = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
function bowl(out) {
  const n = 720,
    rows = 72;
  for (let row = 0; row < rows; row++) {
    const t = row / rows,
      t1 = (row + 1) / rows;
    for (let i = 0; i < n; i++) {
      const a = (i * TAU) / n,
        b = ((i + 1) * TAU) / n,
        mid = (a + b) / 2,
        p = rowPoint(mid, t),
        r = Math.hypot(p[0], p[2]);
      const portal =
        portalAngles.some((v) => angleDistance(mid, v) * r < 1.4) && row >= 38 && row <= 44;
      if (portal) continue;
      const p0 = rowPoint(a, t),
        p1 = rowPoint(b, t),
        q0 = rowPoint(a, t1),
        q1 = rowPoint(b, t1);
      const h0 = [q0[0], p0[1], q0[2]],
        h1 = [q1[0], p1[1], q1[2]];
      face(out, 'concrete', [p0, p1, h1, h0], concrete, [0, 1, 0]);
      face(out, 'concrete', [h0, h1, q1, q0], pale, [-Math.sin(mid), 0, -Math.cos(mid)]);
    }
    const ps = Array.from({ length: n + 1 }, (_, i) => rowPoint((i * TAU) / n, t + 0.42 / rows));
    let carry = 0;
    for (let i = 1; i < ps.length; i++) {
      const a = ps[i - 1],
        b = ps[i],
        L = Math.hypot(b[0] - a[0], b[2] - a[2]);
      for (let d = 0.52 - carry; d < L; d += 0.52) {
        const p = mix(a, b, d / L),
          angle = Math.atan2(p[0], p[2]),
          r = Math.hypot(p[0], p[2]);
        if (portalAngles.some((v) => angleDistance(angle, v) * r < 1.1)) continue;
        if (p[0] > 66 && p[0] < 90 && p[2] > -16.4 && p[2] < 9) continue;
        const c = green.map((v) => v * (0.91 + ((i * 3 + row * 7) % 9) * 0.015));
        chair(out, Math.atan2(-(b[2] - a[2]), b[0] - a[0]), p, c);
      }
      carry = (carry + L) % 0.52;
    }
  }
  for (const a of portalAngles) {
    const ps = Array.from({ length: 145 }, (_, i) => rowPoint(a, i / 144));
    // Aisles split each seating block, with half-rise stair treads and central handrails.
    for (let i = 1; i < ps.length; i++) {
      const p = ps[i],
        o = transformed(out, a, p);
      box(o, 'concrete', [-0.85, -0.14, -0.45], [0.85, 0, 0.02], pale);
    }
    rail(
      out,
      ps.filter((_, i) => i % 2 === 0),
      0.85,
    );
    const p = rowPoint(a, 38 / 72),
      o = transformed(out, a, p);
    box(o, 'concrete', [-1.6, -0.15, -0.12], [-1.4, 2.35, 4.8], pale);
    box(o, 'concrete', [1.4, -0.15, -0.12], [1.6, 2.35, 4.8], pale);
    box(o, 'concrete', [-1.6, 2.2, -0.12], [1.6, 2.45, 4.8], pale);
    box(o, 'glass', [-1.4, -0.05, 4.7], [1.4, 2.2, 4.75], dark);
  }
  rail(
    out,
    Array.from({ length: 361 }, (_, i) => rowPoint((i * TAU) / 360, 0)),
  );
  // Close circulation deck sits above the eastern earth bank and behind the higher western frame.
  for (let i = 0; i < 720; i++) {
    const a = (i * TAU) / 720,
      b = ((i + 1) * TAU) / 720,
      R = outer(a),
      S = outer(b),
      h = topY(a),
      j = topY(b);
    face(
      out,
      'concrete',
      [radial(a, R, h), radial(b, S, j), radial(b, S + 4.5, j), radial(a, R + 4.5, h)],
      pale,
      [0, 1, 0],
    );
    if (Math.sin((a + b) / 2) > 0.38) {
      face(
        out,
        'concrete',
        [
          radial(a, R + 4.5, 0),
          radial(b, S + 4.5, 0),
          radial(b, S + 4.5, j),
          radial(a, R + 4.5, h),
        ],
        concrete,
        [Math.sin(a), 0, Math.cos(a)],
      );
      if (i % 6 === 0) {
        const o = transformed(out, a, radial(a, R + 4.6, 0));
        for (let y = 1; y < h - 1; y += 3.5) {
          box(o, 'glass', [-1, y, -0.02], [1, y + 2, 0.05], [0.17, 0.24, 0.24]);
          box(o, 'metal', [-1.1, y + 2.05, -0.1], [1.1, y + 2.18, 0.22], steel);
        }
      }
    } else {
      face(
        out,
        'turf',
        [radial(a, R + 4.5, h), radial(b, S + 4.5, j), radial(b, S + 8, 0), radial(a, R + 8, 0)],
        [0.23, 0.37, 0.11],
        [0, 1, 0],
      );
    }
  }
  rail(
    out,
    Array.from({ length: 361 }, (_, i) => {
      const a = (i * TAU) / 360;
      return radial(a, outer(a) + 1, topY(a));
    }),
  );
  // Long director/press gallery over the west upper rows, with a visible glazed front and thin roof.
  box(out, 'concrete', [106, 10, -27], [116, 13, 27], concrete);
  box(out, 'glass', [105.94, 10.45, -26.5], [106, 12.6, 26.5], [0.17, 0.25, 0.25]);
  box(out, 'metal', [104.7, 12.9, -28], [117, 13.3, 28], steel);
  for (let z = -26; z <= 26; z += 2.6)
    beam(out, 'metal', [105.9, 10.4, z], [105.9, 12.8, z], 0.07, 0.07, steel);
  // Mapped central honorary box interrupts the green seats.
  for (let row = 0; row < 18; row++)
    for (let z = -15; z < 8; z += 0.65) {
      const x = 68 + row * 1.04,
        y = -15 + (x - 67) * 0.55;
      chair(out, Math.PI / 2, [x, y, z], [0.84, 0.39, 0.16]);
    }
  track(out);
}
function tent(out) {
  // Metric average spacing is0.75m; this ruled net follows the surveyed plan and reconstructed sag.
  const nu = 640,
    nv = 128,
    umin = 0.002,
    umax = 0.998,
    grid = Array.from({ length: nu + 1 }, (_, i) =>
      Array.from({ length: nv + 1 }, (_, j) => roofPoint(umin + ((umax - umin) * i) / nu, j / nv)),
    );
  for (let i = 0; i < nu; i++)
    for (let j = 0; j < nv; j++) {
      const ps = [grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]];
      face(out, 'acrylic', ps, [0.77, 0.82, 0.79], [0, 1, 0]);
    }
  // Every direction contains paired, separate strands. Continuous lofts have no internal cap seams.
  const strand = (ps, offset) => ps.map((p) => [p[0] + offset, p[1] - 0.04, p[2]]);
  for (let i = 0; i <= nu; i++)
    for (const d of [-0.019, 0.019]) continuous(out, strand(grid[i], d), 0.00825, cable, 4);
  for (let j = 0; j <= nv; j++)
    for (const d of [-0.019, 0.019])
      continuous(
        out,
        grid.map((row) => [row[j][0], row[j][1] - 0.065, row[j][2] + d]),
        0.00825,
        cable,
        4,
      );
  // Flexible dark panel seals identify the3m acrylic sheets independently of the finer net.
  for (let i = 0; i <= nu; i += 4)
    continuous(
      out,
      grid[i].map((p) => [p[0], p[1] + 0.025, p[2]]),
      0.04,
      [0.11, 0.14, 0.13],
      4,
      'plastic',
    );
  for (let j = 0; j <= nv; j += 4)
    continuous(
      out,
      grid.map((row) => [row[j][0], row[j][1] + 0.026, row[j][2]]),
      0.04,
      [0.11, 0.14, 0.13],
      4,
      'plastic',
    );
  for (let i = 4; i < nu; i += 8)
    for (let j = 4; j < nv; j += 8) {
      const p = grid[i][j];
      box(
        out,
        'metal',
        [p[0] - 0.04, p[1] - 0.09, p[2] - 0.04],
        [p[0] + 0.04, p[1] + 0.018, p[2] + 0.04],
        steel,
      );
    }
  const edge = Array.from({ length: 481 }, (_, i) => roofPoint(0.002 + (0.996 * i) / 480, 0));
  // The ten parallel bundles at the principal inner edge remain individually legible.
  for (let k = 0; k < 10; k++)
    continuous(
      out,
      edge.map((p) => [p[0] + ((k % 5) - 2) * 0.16, p[1] - 0.15 - Math.floor(k / 5) * 0.16, p[2]]),
      0.065,
      steel,
      8,
    );
  continuous(
    out,
    Array.from({ length: 641 }, (_, i) => roofPoint(0.002 + (0.996 * i) / 640, 1)),
    0.082,
    steel,
    8,
  );
  for (const m of mastData) {
    const [x, z] = m.point,
      r = Math.hypot(x, z),
      d = [x / r, z / r],
      tip = [x + d[0] * 5, m.height, z + d[1] * 5];
    box(out, 'concrete', [x - 2, -0.08, z - 2], [x + 2, 0.72, z + 2], concrete);
    const rings = Array.from({ length: 25 }, (_, j) => {
      const t = j / 24,
        center = mix([x, 0.8, z], tip, t),
        radius = 0.35 + 1.05 * Math.sin(Math.PI * t) ** 0.65;
      return Array.from({ length: 40 }, (_, k) => [
        center[0] + radius * Math.cos((k * TAU) / 40),
        center[1],
        center[2] + radius * Math.sin((k * TAU) / 40),
      ]);
    });
    loft(out, 'metal', rings, steel);
    // Eight short suspension pairs connect each independent mast head to the lifted cable-net node.
    for (let k = 0; k < 8; k++) {
      const a = (k * TAU) / 8,
        p = roofPoint(m.u + Math.cos(a) * 0.003, 0.87 + Math.sin(a) * 0.017);
      tube(out, 'metal', tip, p, 0.055, steel, 8);
      box(
        out,
        'metal',
        [p[0] - 0.13, p[1] - 0.1, p[2] - 0.13],
        [p[0] + 0.13, p[1] + 0.1, p[2] + 0.13],
        steel,
      );
    }
    for (const off of [-0.12, 0.12]) {
      const anchor = [x + d[0] * 28 - d[1] * off, 0.1, z + d[1] * 28 + d[0] * off];
      tube(out, 'metal', tip, anchor, 0.1, steel, 10);
      box(
        out,
        'concrete',
        [anchor[0] - 1.4, -0.08, anchor[2] - 1.4],
        [anchor[0] + 1.4, 0.65, anchor[2] + 1.4],
        concrete,
      );
    }
    // Main seams and inner-node suspension distinguish the nine consecutive saddle bays.
    const ps = Array.from({ length: 97 }, (_, j) => roofPoint(m.u, j / 96));
    continuous(out, ps, 0.082, steel, 8);
    const node = roofPoint(m.u, 0.06),
      high = [node[0], node[1] + 7, node[2]];
    tube(out, 'metal', tip, high, 0.11, steel, 12);
    tube(out, 'metal', high, node, 0.17, steel, 16);
    for (const du of [-0.014, 0.014])
      tube(out, 'metal', high, roofPoint(m.u + du, 0), 0.075, steel, 8);
  }
  // Both principal edge-cable ends terminate in visible ball-bearing anchor blocks.
  for (const u of [0.002, 0.998]) {
    const p = roofPoint(u, 0),
      r = Math.hypot(p[0], p[2]),
      anchorRadius = Math.max(r + 9, outer(Math.atan2(p[0], p[2])) + 8),
      a = [(p[0] * anchorRadius) / r, 0, (p[2] * anchorRadius) / r];
    continuous(out, [p, [a[0], 0.55, a[2]]], 0.32, steel, 16);
    box(out, 'concrete', [a[0] - 2.1, -0.08, a[2] - 2.1], [a[0] + 2.1, 1.2, a[2] + 2.1], concrete);
  }
  // Six suspended floodlight batteries hang beneath the tent in the present exterior arrangement.
  for (let i = 0; i < 6; i++) {
    const u = 0.16 + i * 0.126,
      p = roofPoint(u, 0.08),
      a = Math.atan2(p[0], p[2]),
      o = transformed(out, a, [p[0], p[1] - 3.5, p[2]]);
    for (const x of [-1.35, 1.35]) tube(o, 'metal', [x, 0, 0], [x, 3.5, 0], 0.055, steel, 8);
    for (let j = 0; j < 4; j++) {
      box(o, 'metal', [-1.6, j * 0.62, -0.25], [1.6, j * 0.62 + 0.48, 0.35], steel);
      for (let k = 0; k < 6; k++)
        box(
          o,
          'plastic',
          [-1.4 + k * 0.49, j * 0.62 + 0.06, -0.3],
          [-1.02 + k * 0.49, j * 0.62 + 0.39, -0.26],
          [0.88, 0.9, 0.84],
        );
    }
  }
}
function floodlights(out) {
  for (const m of munichPlan.floodlights) {
    const [x, z] = m.point,
      a = Math.atan2(x, z),
      o = transformed(out, a, [x, 0, z]);
    const legs = [
      [-1.8, -1.8],
      [1.8, -1.8],
      [1.8, 1.8],
      [-1.8, 1.8],
    ];
    for (const p of legs)
      tube(o, 'metal', [p[0], 0, p[1]], [p[0] * 0.7, 47, p[1] * 0.7], 0.19, steel, 12);
    for (let j = 0; j < 12; j++)
      for (let k = 0; k < 4; k++) {
        const p = legs[k],
          q = legs[(k + 1) % 4],
          s = 1 - j * 0.025,
          t = 1 - (j + 1) * 0.025;
        tube(
          o,
          'metal',
          [p[0] * s, j * 3.9, p[1] * s],
          [q[0] * t, (j + 1) * 3.9, q[1] * t],
          0.055,
          steel,
          8,
        );
        tube(
          o,
          'metal',
          [p[0] * s, j * 3.9, p[1] * s],
          [q[0] * s, j * 3.9, q[1] * s],
          0.06,
          steel,
          8,
        );
      }
    for (let j = 0; j < 7; j++)
      for (let k = 0; k < 14; k++) {
        const xx = -6.2 + k * 0.95,
          y = 45 + j * 0.88,
          zz = 0.026 * xx * xx;
        box(o, 'metal', [xx - 0.42, y, zz], [xx + 0.42, y + 0.72, zz + 0.65], steel);
        box(
          o,
          'plastic',
          [xx - 0.31, y + 0.1, zz - 0.015],
          [xx + 0.31, y + 0.62, zz],
          [0.89, 0.91, 0.85],
        );
      }
    for (const y of [44.8, 51]) beam(o, 'metal', [-6.7, y, 1.4], [6.7, y, 1.4], 0.2, 0.2, steel);
  }
  for (const a of [0, Math.PI]) {
    const r = outer(a) - 2,
      y = topY(a) + 1,
      p = radial(a, r, y),
      o = transformed(out, a, p);
    box(o, 'metal', [-10, 0, -0.8], [10, 8.8, 0.5], steel);
    box(o, 'glass', [-9.6, 0.4, -0.87], [9.6, 8.4, -0.82], dark);
    for (const x of [-7, 7]) beam(o, 'metal', [x, -2, 0], [x, 8.8, 0], 0.25, 0.25, steel);
  }
}
export function buildMunich(out) {
  bowl(out);
  tent(out);
  floodlights(out);
}
export const munichStudy = {
  id: 'N0692',
  key: 'munich_olympic_stadium',
  wikidataId: 'Q131610',
  title: 'Munich Olympic Stadium',
  build: buildMunich,
  metricTriangleUv: true,
  previewGroundless: true,
  smoothNormalSlots: ['trim'],
  size: [348, 93, 388],
  nativeAxes: {
    up: '+Y',
    front: '+Z',
    origin:
      'Mapped pitch center; +Z north-northwest, +X west. Y0 is upper public circulation around the open eastern bowl, with the field18m lower.',
  },
  previewCamera: { position: [-205, 155, 218], lookAt: [28, 14, 12] },
  visualBrief:
    'Munich’s distinctive west-side tent uses the mapped scalloped acrylic envelope and eight main mast bases, a paired cable net, sheet seals, suspended inner nodes, long principal edge bundles and outward guys. Green molded seats follow the irregular asymmetric bowl with a high west frame, glazed press box, honorary seats, red athletics oval, apron equipment and two lattice floodlight towers. The eastern stands remain open.',
  sourceFacts: {
    published:
      'The original Olympic construction report describes the eight-mast, nine-saddle stadium canopy, nominal75cm paired cable mesh and3m acrylic sheets. It establishes the34m western frame and18m earth bank. SBP confirms the transparent cable-net structural system. The City’s1997 stadium account supplies the105x68m pitch and lighting arrangement.',
    reconstructed:
      'Exact OSM mast bases, stand blocks, pitch direction and roof perimeter control plan geometry. Mast heights, leaning offsets, sag surfaces, anchorage extents, portal sections and chair inventory are reconstructed from the primary engineering photographs and original sections; this is a detailed exterior, not a structural-analysis model.',
  },
  referencePages: [
    'https://www.sbp.de/en/project/roof-for-munich-olympic-stadium-1972/',
    'https://d.rsms.me/stuff/1972%20Munich%20s2.pdf',
    'https://mstatistik.muenchen.de/archivierung_historische_berichte/MuenchenerStatistik/1997/ms970901.pdf',
    'https://www.olympiapark.de/en/the-olympic-park/park-overview/olympic-stadium',
    'https://www.openstreetmap.org/way/25001469',
    'https://www.openstreetmap.org/way/419656920',
    'https://www.openstreetmap.org/way/15805167',
  ],
  referenceRights:
    'Original authored geometry and shared procedural materials. Reference photographs and construction illustrations retain their rights and are evidence only; no pixels or external mesh are embedded. Mapped plan coordinates derive from OpenStreetMap contributors under ODbL1.0.',
  geographicProposal: {
    status: 'preview-proposal',
    anchor: munichPlan.anchor,
    heading: munichPlan.heading,
    elevationMode: 'terrain-contact',
    groundModelY: 0,
    groundContactReviewed: true,
    groundContactBasis:
      'Y0 follows the eastern upper pedestrian circulation. The original section describes18m earthwork above the field and34m western framing; the authored field is-18m and highest west rim+16m. The native below-ground bowl therefore requires its terrain opening.',
    source: 'https://www.openstreetmap.org/way/15805167',
    featureIds: ['way/419656920', 'way/25001469', 'way/15805167'],
    groundCutout: {
      outline: munichPlan.outline.slice(0, -1).map((p) => {
        const r = Math.hypot(...p);
        return p.map((v) => v * (1 + 7.7 / r));
      }),
      basis:
        'The close bowl and perimeter deck preserve the depressed track/field; outer grass and paving cover the boundary.',
    },
    notes:
      'The pitch determines +Z north-northwest; the west roof is+X, with eight exact mapped mast bases and the independently traced roof boundary. Native ground follows upper circulation, not the field. The larger Olympic park, adjacent hall/swimming-pool canopies and temporary event staging are outside this single stadium asset.',
  },
  limitations: [
    'The intact pre-restoration exterior is depicted. The operator reports closure from September2025 for renovation; future alterations are not invented. Three-dimensional sag, members, cables and seat counts are photographic reconstruction over exact map plan evidence. Enclosed service rooms and surrounding Olympic park landscaping are outside this stadium envelope.',
  ],
  portableReviewBasis:
    'Portable inspection is ground-free so the faithful recessed athletics bowl is visible. Geographic inspection applies the native terrain cutout.',
  importOptions: { optimize: false },
  qaCameras: [
    { name: 'near-acrylic-net', position: [70, 35, 13], lookAt: [112, 41, 17] },
    { name: 'near-mast-neck', position: [165, 47, 35], lookAt: [146, 52, 17] },
    { name: 'near-edge-bundles', position: [52, 23, 20], lookAt: [68, 29, 17] },
    { name: 'near-green-seating', position: [16, -12, 8], lookAt: [88, 1, 0] },
    { name: 'near-press-gallery', position: [74, 8, -21], lookAt: [107, 11, 0] },
    { name: 'near-track', position: [-61, -11, -40], lookAt: [-43, -17, 5] },
    { name: 'near-outside-gallery', position: [158, 10, -18], lookAt: [122, 8, 0] },
    { name: 'near-floodlights', position: [-62, 47, 65], lookAt: [-85, 48, 94] },
    { name: 'near-south-anchor', position: [-33, 7, -147], lookAt: [-10, 2, -137] },
    { name: 'far-west-tent', position: [223, 137, 172], lookAt: [32, 18, 0] },
  ],
};
