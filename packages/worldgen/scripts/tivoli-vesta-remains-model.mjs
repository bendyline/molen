/** 'N0554': Tivoli's roofless cella, surviving column arc and original simplified frieze. */
import { normalFor } from './authored-structure-mesh.mjs';
import { openingBuilder, openingReveals, prepareOpening } from './authored-wall-openings.mjs';
import { buildCorinthianColumn } from './corinthian-column-geometry.mjs';
import { box, loft, prism } from './khmer-structure-geometry.mjs';

export function buildTivoliVestaRemains(face, detail, r, sample) {
  const F = r.floorY,
    R = r.cellaRadius,
    n = [12, 24, 48, 64][detail],
    f = (role, ps, normal) => {
      if (detail === 0 && normal[1] < -0.5) return;
      face(
        role,
        ps.map(([x, y, z]) => [x + r.center[0], y, z + r.center[1]]),
        normal,
      );
    },
    grade = (x, z) => sample(x + r.center[0], z + r.center[1]),
    ring = (radius, count = n) =>
      Array.from({ length: count }, (_, i) => [
        Math.cos((i * 2 * Math.PI) / count) * radius,
        Math.sin((i * 2 * Math.PI) / count) * radius,
      ]),
    radial = (a, radius, y) => [Math.cos(a) * radius, y, Math.sin(a) * radius];
  // Only the occupied circular podium is authored; its bottom follows the native cliff ground.
  const rim = ring(r.podiumRadius, [16, 32, 48, 64][detail]);
  for (let i = 0; i < rim.length; i++) {
    const a = rim[i],
      b = rim[(i + 1) % rim.length],
      lo = (q) => [q[0], grade(...q) - 0.4, q[1]],
      hi = (q) => [q[0], F - 0.14, q[1]],
      mid = ((i + 0.5) * Math.PI * 2) / rim.length;
    f('base', [lo(a), lo(b), hi(b), hi(a)], [Math.cos(mid), 0, Math.sin(mid)]);
  }
  f(
    'base',
    rim.map(([x, z]) => [x, F - 0.14, z]),
    [0, 1, 0],
  );
  prism(f, 'stone', { outline: rim, holes: [] }, F - 0.14, F);
  const holes = [
      {
        center: [Math.cos(r.doorAngle) * (R - 0.3), Math.sin(r.doorAngle) * (R - 0.3)],
        axis: [-Math.sin(r.doorAngle), Math.cos(r.doorAngle)],
        shape: 'rect',
        width: 2.2,
        bottom: F + 0.05,
        height: 3.8,
        depth: 2.6,
      },
      {
        center: [Math.cos(r.windowAngle) * (R - 0.3), Math.sin(r.windowAngle) * (R - 0.3)],
        axis: [-Math.sin(r.windowAngle), Math.cos(r.windowAngle)],
        shape: 'rect',
        width: 1.1,
        bottom: F + 1.25,
        height: 1.9,
        depth: 2.6,
      },
    ].map((h) => prepareOpening(h, 0, detail)),
    adapter = { addTriangle: (_role, _ref, ps, normal) => f('wall', ps, normal) },
    out = openingBuilder(adapter, holes),
    cut = (role, ps, normal) => {
      for (let i = 1; i < ps.length - 1; i++)
        if (Math.hypot(...normalFor(ps[0], ps[i], ps[i + 1])) > 0.5)
          out.addTriangle(role, 'palette:#ffffff', [ps[0], ps[i], ps[i + 1]], normal, [], []);
    },
    outer = ring(R),
    inner = ring(R - r.wallThickness);
  prism(cut, 'wall', { outline: outer, holes: [inner] }, F, F + 6.6);
  if (detail >= 2) {
    const columns = detail === 3 ? 96 : 72,
      rows = detail === 3 ? 24 : 14,
      patch = openingBuilder(
        { addTriangle: (_role, _ref, ps, normal) => f('rubble', ps, normal) },
        holes,
      );
    for (let row = 0; row < rows; row++)
      for (let col = 0; col < columns; col++) {
        const a = ((col + (row % 2) * 0.5) * 2 * Math.PI) / columns,
          y = F + 0.35 + ((row + 0.5) * 6.1) / rows,
          da = ((2 * Math.PI) / columns) * 0.46,
          dy = (6.1 / rows) * 0.44,
          ps = [
            radial(a - da, R + 0.014, y),
            radial(a, R + 0.014, y + dy),
            radial(a + da, R + 0.014, y),
            radial(a, R + 0.014, y - dy),
          ],
          normal = [Math.cos(a), 0, Math.sin(a)];
        patch.addTriangle('rubble', 'palette:#ffffff', ps.slice(0, 3), normal, [], []);
        patch.addTriangle('rubble', 'palette:#ffffff', [ps[0], ps[2], ps[3]], normal, [], []);
      }
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n,
      a = (i * 2 * Math.PI) / n,
      b = ((i + 1) * 2 * Math.PI) / n,
      top = (t) =>
        F +
        (t <= r.arc[1] || t >= Math.PI * 1.5
          ? 7.13 + 0.035 * Math.cos(t * 9)
          : 6.86 + 0.18 * Math.cos(t * 7)),
      q = (ring, k, y) => [ring[k][0], y, ring[k][1]],
      mid = (a + b) / 2;
    f(
      'wall',
      [q(outer, i, F + 6.6), q(outer, j, F + 6.6), q(outer, j, top(b)), q(outer, i, top(a))],
      [Math.cos(mid), 0, Math.sin(mid)],
    );
    f(
      'wall',
      [q(inner, j, F + 6.6), q(inner, i, F + 6.6), q(inner, i, top(a)), q(inner, j, top(b))],
      [-Math.cos(mid), 0, -Math.sin(mid)],
    );
    f(
      'wall',
      [q(outer, i, top(a)), q(outer, j, top(b)), q(inner, j, top(b)), q(inner, i, top(a))],
      [0, 1, 0],
    );
    openingReveals(
      adapter,
      [outer[i], outer[j], inner[j], inner[i]],
      () => F,
      () => F + 6.6,
      holes,
      [],
    );
  }
  const facade = (angle) => {
    const c = Math.cos(angle),
      s = Math.sin(angle),
      P = ([u, y, v]) => [c * v - s * u, y, s * v + c * u];
    return (role, ps, normal) =>
      f(role, ps.map(P), [c * normal[2] - s * normal[0], normal[1], s * normal[2] + c * normal[0]]);
  };
  for (const [angle, width, bottom, height] of [
    [r.doorAngle, 2.2, F + 0.05, 3.8],
    [r.windowAngle, 1.1, F + 1.25, 1.9],
  ]) {
    const B = facade(angle),
      v = R + 0.015;
    for (const sign of [-1, 1])
      box(B, 'stone', sign * (width / 2 + 0.13), bottom, v, 0.24, height + 0.16, 0.48);
    box(B, 'stone', 0, bottom + height, v, width + 0.5, 0.22, 0.48);
    if (detail > 0) box(B, 'stone', 0, bottom - 0.06, v, width + 0.5, 0.12, 0.6);
  }
  // Blocked eastern relieving arch remains masonry; the real door/window are cut above.
  if (detail >= 1) {
    const B = facade(-0.12),
      segments = detail === 1 ? 8 : 16,
      depth = (u) => Math.sqrt(R * R - u * u) + 0.018;
    for (let i = 0; i < segments; i++) {
      const a = (i * Math.PI) / segments,
        b = ((i + 1) * Math.PI) / segments,
        p = (t, rad) => {
          const u = Math.cos(t) * rad;
          return [u, F + 2.15 + Math.sin(t) * rad, depth(u)];
        };
      B('brick', [p(a, 1.65), p(b, 1.65), p(b, 1.85), p(a, 1.85)], [0, 0, 1]);
    }
  }
  const arcCount = [8, 16, 32, 48][detail],
    arcOutline = (inner, outer, a = r.arc[0], b = r.arc[1], count = arcCount) => ({
      outline: [
        ...Array.from({ length: count + 1 }, (_, i) => {
          const t = a + ((b - a) * i) / count;
          return [Math.cos(t) * outer, Math.sin(t) * outer];
        }),
        ...Array.from({ length: count + 1 }, (_, i) => {
          const t = b - ((b - a) * i) / count;
          return [Math.cos(t) * inner, Math.sin(t) * inner];
        }),
      ],
      holes: [],
    }),
    band = (inner, outer, lo, hi) => prism(f, 'stone', arcOutline(inner, outer), F + lo, F + hi);
  if (detail === 0) band(5.95, 7.05, 6.8, 7.9);
  else {
    band(5.95, 6.85, 6.8, 7.12);
    band(6.13, 6.92, 7.12, 7.64);
    band(5.95, 7.07, 7.64, 7.77);
    band(5.98, 7.13, 7.77, 7.9);
  }
  prism(f, 'stone', arcOutline(R, 6.8), F + 6.94, F + 7.05);
  if (detail >= 2) {
    for (const [lo, hi] of [
      [R, R + 0.14],
      [5.6, 5.74],
      [6.65, 6.8],
    ])
      prism(f, 'stone', arcOutline(lo, hi), F + 6.8, F + 6.94);
    for (let i = 0; i <= 20; i++) {
      const a = r.arc[0] + ((r.arc[1] - r.arc[0]) * i) / 20;
      prism(f, 'stone', arcOutline(R, 6.8, a - 0.01, a + 0.01, 1), F + 6.8, F + 6.94);
    }
  }
  for (const angle of r.columnAngles) {
    const x = Math.cos(angle) * r.columnRadius,
      z = Math.sin(angle) * r.columnRadius;
    if (detail === 0) {
      box(f, 'column', x, F, z, 0.99, 0.18, 0.99);
      loft(
        f,
        'column',
        x,
        z,
        [
          [F + 0.18, 0.74],
          [F + 5.92, 0.63],
        ],
        false,
        (w) => ring(w / 2, 6),
      );
      box(f, 'column', x, F + 5.92, z, 1.08, 0.88, 1.08);
    } else {
      const scale = r.columnHeight / 15.2,
        c = Math.cos(angle + Math.PI / 2),
        s = Math.sin(angle + Math.PI / 2);
      buildCorinthianColumn(
        (_role, ps, normal) =>
          f(
            'column',
            ps.map(([u, y, v]) => [
              x + scale * (c * u - s * v),
              F + y * scale,
              z + scale * (s * u + c * v),
            ]),
            [c * normal[0] - s * normal[2], normal[1], s * normal[0] + c * normal[2]],
          ),
        0,
        0,
        [0, 0, 1, 3][detail],
        0,
      );
      if (detail >= 2)
        for (let side = 0; side < 4; side++) {
          const a = (side * Math.PI) / 2 + angle,
            n = [Math.cos(a), 0, Math.sin(a)],
            u = [-Math.sin(a), 0, Math.cos(a)],
            center = [x + n[0] * 0.55, F + 6.63, z + n[2] * 0.55],
            tip = center.map((v, k) => v + n[k] * 0.07),
            count = detail === 3 ? 18 : 8;
          for (let i = 0; i < count; i++) {
            const p = (k) => {
              const t = (k * 2 * Math.PI) / count,
                rad = 0.14 * (1 + 0.15 * Math.cos(t * 6));
              return center.map(
                (v, j) => v + u[j] * Math.cos(t) * rad + (j === 1 ? Math.sin(t) * rad : 0),
              );
            };
            f('stone', [p(i), p(i + 1), tip], n);
          }
        }
    }
  }
  if (detail >= 2) {
    // Original schematic horned motifs, hanging fruit beads and rosettes; no traced carving.
    const boss = (a, y, size, petals = 6) => {
      const center = radial(a, 6.94, y),
        tip = radial(a, 7.015, y),
        count = petals * 2,
        p = (i) => {
          const t = (i * 2 * Math.PI) / count,
            rr = size * (1 + 0.15 * Math.cos(t * petals));
          return [
            center[0] - Math.sin(a) * Math.cos(t) * rr,
            center[1] + Math.sin(t) * rr,
            center[2] + Math.cos(a) * Math.cos(t) * rr,
          ];
        };
      for (let i = 0; i < count; i++)
        f('stone', [p(i), p(i + 1), tip], [Math.cos(a), 0, Math.sin(a)]);
    };
    for (let i = 0; i < r.columnAngles.length; i++) {
      const a = r.columnAngles[i],
        B = facade(a);
      B(
        'stone',
        [
          [-0.12, F + 7.54, 6.94],
          [0.12, F + 7.54, 6.94],
          [0.08, F + 7.23, 6.99],
          [-0.08, F + 7.23, 6.99],
        ],
        [0, 0, 1],
      );
      for (const sign of [-1, 1])
        B(
          'stone',
          [
            [sign * 0.1, F + 7.47, 6.95],
            [sign * 0.34, F + 7.59, 6.99],
            [sign * 0.23, F + 7.35, 7.015],
          ],
          [0, 0, 1],
        );
      if (i === r.columnAngles.length - 1) continue;
      const next = r.columnAngles[i + 1],
        beads = detail === 3 ? 14 : 8;
      for (let k = 1; k < beads; k++) {
        const t = k / beads;
        boss(a + (next - a) * t, F + 7.48 - 0.22 * Math.sin(t * Math.PI), 0.045, 4);
      }
      boss((a + next) / 2, F + 7.56, 0.065);
    }
    for (const y of [2.9, 4.9])
      for (const i of [0, 1, 8]) {
        const a = radial(r.columnAngles[i], r.columnRadius, F + y),
          b = radial(r.columnAngles[i + 1], r.columnRadius, F + y),
          dx = b[0] - a[0],
          dz = b[2] - a[2],
          len = Math.hypot(dx, dz),
          nx = (-dz / len) * 0.018,
          nz = (dx / len) * 0.018;
        f(
          'metal',
          [
            [a[0] + nx, a[1] - 0.018, a[2] + nz],
            [b[0] + nx, b[1] - 0.018, b[2] + nz],
            [b[0] + nx, b[1] + 0.018, b[2] + nz],
            [a[0] + nx, a[1] + 0.018, a[2] + nz],
          ],
          [nx, 0, nz],
        );
        f(
          'metal',
          [
            [a[0] - nx, a[1] + 0.018, a[2] - nz],
            [b[0] - nx, b[1] + 0.018, b[2] - nz],
            [b[0] - nx, b[1] - 0.018, b[2] - nz],
            [a[0] - nx, a[1] - 0.018, a[2] - nz],
          ],
          [-nx, 0, -nz],
        );
      }
  }
  const B = facade(r.doorAngle),
    start = r.podiumRadius + 2.75,
    low = grade(Math.cos(r.doorAngle) * start, Math.sin(r.doorAngle) * start) + 0.04,
    bottom = Math.min(
      low - 0.35,
      ...Array.from({ length: 7 }, (_, i) => {
        const radius = start - (2.8 * i) / 6;
        return grade(Math.cos(r.doorAngle) * radius, Math.sin(r.doorAngle) * radius) - 0.4;
      }),
    ),
    count = detail === 0 ? 3 : 8;
  for (let i = 0; i < count; i++)
    box(
      B,
      'stone',
      0,
      bottom,
      start - (2.8 / count) * (i + 0.5),
      2.65,
      low + ((F - low) * (i + 1)) / count - bottom,
      2.8 / count + 0.025,
    );
}
