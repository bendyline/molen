/** 'N0537': Eight mapped Baidicheng core envelopes, open courts and the decorated arched gateway. */
import { buildChineseHipRoof } from './chinese-roof-geometry.mjs';
import { box, loft, prism, rect } from './khmer-structure-geometry.mjs';

export function buildBaidichengTemple(emit, detail, r, sampleTerrain) {
  const c = Math.cos(r.architecturalAngleRadians),
    s = Math.sin(r.architecturalAngleRadians),
    f = (role, ps, n) => {
      if (detail === 0 && (n[1] < -0.5 || (role === 'wall' && n[1] > 0.5))) return;
      emit(
        role,
        ps.map(([x, y, z]) => [c * x - s * z, y, s * x + c * z]),
        [c * n[0] - s * n[2], n[1], s * n[0] + c * n[2]],
      );
    },
    grade = (x, z) => sampleTerrain(c * x - s * z, s * x + c * z);
  const pose = (x, y, z, angle = 0) => {
    const co = Math.cos(angle),
      si = Math.sin(angle);
    return (role, ps, n) =>
      f(
        role,
        ps.map(([u, v, w]) => [x + co * u - si * w, y + v, z + si * u + co * w]),
        [co * n[0] - si * n[2], n[1], si * n[0] + co * n[2]],
      );
  };
  // Sample long boundaries, whose native DEM can dip between mapped corner vertices.
  const buriedBase = (p) => {
    let low = Infinity;
    for (let i = 0; i < p.outline.length; i++) {
      const a = p.outline[i],
        b = p.outline[(i + 1) % p.outline.length],
        steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2));
      for (let k = 0; k <= steps; k++)
        low = Math.min(
          low,
          grade(a[0] + ((b[0] - a[0]) * k) / steps, a[1] + ((b[1] - a[1]) * k) / steps),
        );
    }
    return low - 0.65;
  };
  for (const part of r.sections) {
    const Y = part.floorY,
      H = part.height;
    for (const p of part.polygons) {
      prism(f, 'stone', p, buriedBase(p), Y);
      prism(f, 'wall', p, Y, Y + H);
      if (detail === 0) continue;
      // Façade panels sit on the actual clipped polygon edges, including concave range returns.
      const ring = p.outline,
        area = ring.reduce((sum, a, i) => {
          const b = ring[(i + 1) % ring.length];
          return sum + a[0] * b[1] - a[1] * b[0];
        }, 0),
        sign = Math.sign(area);
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i],
          b = ring[(i + 1) % ring.length],
          dx = b[0] - a[0],
          dz = b[1] - a[1],
          len = Math.hypot(dx, dz);
        if (len < 3) continue;
        const tx = dx / len,
          tz = dz / len,
          nx = tz * sign,
          nz = -tx * sign;
        const at = (role, ps, n) =>
            f(
              role,
              ps.map(([u, y, d]) => [a[0] + tx * u + nx * d, y, a[1] + tz * u + nz * d]),
              [tx * n[0] + nx * n[2], n[1], tz * n[0] + nz * n[2]],
            ),
          count = Math.min(detail === 1 ? 2 : 4, Math.floor(len / 3.5));
        for (let k = 0; k < count; k++) {
          const u = ((k + 0.5) * len) / count,
            w = Math.min(1.8, (len / count) * 0.6),
            rows = H > 6 ? [1.3, 4.8] : [1.2];
          for (const lo of rows) {
            at(
              'door',
              [
                [u - w / 2, Y + lo, 0.025],
                [u + w / 2, Y + lo, 0.025],
                [u + w / 2, Y + lo + 1.65, 0.025],
                [u - w / 2, Y + lo + 1.65, 0.025],
              ],
              [0, 0, 1],
            );
            if (detail >= 2)
              for (const v of [-w / 2, w / 2])
                at(
                  'wood',
                  [
                    [u + v - 0.06, Y + lo, 0.045],
                    [u + v + 0.06, Y + lo, 0.045],
                    [u + v + 0.06, Y + lo + 1.65, 0.045],
                    [u + v - 0.06, Y + lo + 1.65, 0.045],
                  ],
                  [0, 0, 1],
                );
            at(
              'paint',
              [
                [u - w / 2, Y + lo + 1.53, 0.05],
                [u + w / 2, Y + lo + 1.53, 0.05],
                [u + w / 2, Y + lo + 1.65, 0.05],
                [u - w / 2, Y + lo + 1.65, 0.05],
              ],
              [0, 0, 1],
            );
            if (detail >= 2)
              for (const q of [-0.25, 0, 0.25])
                at(
                  'wood',
                  [
                    [u + q * w - 0.025, Y + lo, 0.055],
                    [u + q * w + 0.025, Y + lo, 0.055],
                    [u + q * w + 0.025, Y + lo + 1.53, 0.055],
                    [u + q * w - 0.025, Y + lo + 1.53, 0.055],
                  ],
                  [0, 0, 1],
                );
          }
        }
        if (detail >= 2) {
          // Thin painted eave beam; the broad plaster wall remains the dominant surface.
          at(
            'wood',
            [
              [0, Y + H - 0.3, 0.04],
              [len, Y + H - 0.3, 0.04],
              [len, Y + H - 0.06, 0.04],
              [0, Y + H - 0.06, 0.04],
            ],
            [0, 0, 1],
          );
          if (H > 6)
            at(
              'wall',
              [
                [0, Y + 3.7, 0.07],
                [len, Y + 3.7, 0.07],
                [len, Y + 3.92, 0.07],
                [0, Y + 3.92, 0.07],
              ],
              [0, 0, 1],
            );
        }
      }
    }
    buildChineseHipRoof(f, { ...part.roof, low: Y + H, rise: part.rise }, detail);
  }
  const [gx, gz] = r.gate.center,
    Y = r.gate.floorY,
    at = pose(gx, Y, gz),
    archRadius = 1.5,
    outer = 1.94,
    spring = 2.35;
  // The threshold is confined to the gateway passage rather than flattening the court.
  prism(
    (role, ps, n) =>
      f(
        role,
        ps.map(([x, y, z]) => [x, y === 0 ? grade(x, z) - 0.4 : Y + 0.03, z]),
        n,
      ),
    'stone',
    rect(gx, 29.1, 3.4, 8.5),
    0,
    1,
  );
  for (const side of [-1, 1]) {
    box(at, 'ochre', side * 2.65, 0, 0, 1.42, 7.25, 0.7);
    box(at, 'stone', side * 1.72, 0, -0.07, 0.44, spring, 0.8);
    box(at, 'wood', side * 3.85, 0, 0.02, 1.05, 5.25, 0.55);
    if (detail > 0) {
      box(at, 'paint', side * 2.65, 0.18, -0.41, 1.1, 0.15, 0.06);
      for (const x of [-0.58, 0.58]) box(at, 'paint', side * 2.65 + x, 0.3, -0.4, 0.1, 6.64, 0.06);
      box(at, 'wall', side * 2.65, 6.3, -0.42, 1.14, 0.3, 0.07);
      box(at, 'paint', side * 2.65, 6.85, -0.42, 1.2, 0.15, 0.07);
      loft(
        at,
        'wood',
        side * 4.48,
        0,
        [
          [0, 0.65],
          [5.2, 0.65],
          [5.48, 0.45],
        ],
        false,
        (w) =>
          Array.from({ length: 8 }, (_, i) => [
            (Math.cos((i * Math.PI) / 4) * w) / 2,
            (Math.sin((i * Math.PI) / 4) * w) / 2,
          ]),
      );
      loft(
        at,
        'stone',
        side * 4.48,
        0,
        [
          [5.45, 0.55],
          [5.85, 0.75],
          [6.15, 0.2],
        ],
        true,
      );
    }
  }
  const n = detail === 0 ? 6 : detail === 1 ? 10 : 18;
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI) / n,
      b = ((i + 1) * Math.PI) / n,
      p = (radius, angle, z) => [Math.cos(angle) * radius, spring + Math.sin(angle) * radius, z];
    for (const z of [-0.48, 0.32])
      at(
        'stone',
        [p(archRadius, a, z), p(outer, a, z), p(outer, b, z), p(archRadius, b, z)],
        [0, 0, z < 0 ? -1 : 1],
      );
    const mid = (a + b) / 2;
    at(
      'stone',
      [
        p(archRadius, a, -0.48),
        p(archRadius, b, -0.48),
        p(archRadius, b, 0.32),
        p(archRadius, a, 0.32),
      ],
      [-Math.cos(mid), -Math.sin(mid), 0],
    );
    at(
      'stone',
      [p(outer, a, -0.48), p(outer, a, 0.32), p(outer, b, 0.32), p(outer, b, -0.48)],
      [Math.cos(mid), Math.sin(mid), 0],
    );
  }
  box(at, 'ochre', 0, 4.22, 0, 3.88, 3.03, 0.7);
  if (detail > 0) {
    box(at, 'wall', 0, 4.35, -0.39, 3.3, 2.5, 0.06);
    box(at, 'ochre', 0, 4.65, -0.44, 1.0, 2.0, 0.07); // A blank plaque; no invented or copied writing.
    for (const x of [-0.65, 0.65]) box(at, 'paint', x, 4.5, -0.45, 0.1, 2.23, 0.07);
    for (const y of [4.43, 6.68]) box(at, 'paint', 0, y, -0.45, 1.4, 0.1, 0.07);
    box(at, 'wood', 0, 7.0, -0.09, 6.8, 0.2, 0.9);
    if (detail >= 2)
      for (const side of [-1, 1])
        for (const cy of [4.9, 5.9]) {
          const count = 12,
            cx = side * 1.22,
            rad = 0.37;
          for (let k = 0; k < count; k++) {
            const a = (k * Math.PI * 2) / count,
              b = ((k + 1) * Math.PI * 2) / count;
            at(
              'paint',
              [
                [cx + Math.cos(a) * rad, cy + Math.sin(a) * rad, -0.48],
                [cx + Math.cos(a) * (rad - 0.065), cy + Math.sin(a) * (rad - 0.065), -0.48],
                [cx + Math.cos(b) * (rad - 0.065), cy + Math.sin(b) * (rad - 0.065), -0.48],
                [cx + Math.cos(b) * rad, cy + Math.sin(b) * rad, -0.48],
              ],
              [0, 0, -1],
            );
          }
        }
  }
  buildChineseHipRoof(at, { x: 0, z: 0, width: 6.9, depth: 1.25, low: 7.25, rise: 1.04 }, detail);
  for (const side of [-1, 1])
    buildChineseHipRoof(
      at,
      { x: side * 4.02, z: 0.06, width: 2.5, depth: 1.0, low: 5.72, rise: 0.62 },
      detail,
    );
  const steps = detail === 0 ? 2 : 6;
  for (let i = 0; i < steps; i++) {
    const z = gz - 2.7 + ((i + 0.5) * 2.6) / steps,
      ground = grade(gx, z),
      top = ground + ((Y - ground) * (i + 1)) / steps,
      base = Math.min(ground - 0.3, top - 0.08);
    box(f, 'stone', gx, base, z, 4.5, top - base, 2.6 / steps + 0.025);
  }
  if (detail >= 2)
    for (const side of [-1, 1]) {
      // Original simplified crouching stone guardians; not a copied sculpture inventory.
      const x = gx + side * 3.9,
        z = gz - 2.0,
        B = grade(x, z),
        basePose = pose(x, B, z),
        g = (role, ps, n) =>
          basePose(
            role,
            ps.map((p) => p.map((v) => v * 0.72)),
            n,
          );
      box(g, 'stone', 0, -0.35, 0, 1.25, 0.6, 1.65);
      for (const u of [-0.35, 0.35]) box(g, 'stone', u, 0.25, -0.5, 0.3, 0.25, 0.68);
      loft(
        g,
        'stone',
        0,
        0.15,
        [
          [0.2, 1.05],
          [0.78, 1.0],
          [1.15, 0.65],
        ],
        true,
      );
      loft(
        g,
        'stone',
        0,
        -0.43,
        [
          [0.8, 0.6],
          [1.1, 0.92],
          [1.65, 0.88],
          [1.92, 0.45],
        ],
        true,
      );
      box(g, 'stone', 0, 1.22, -0.9, 0.7, 0.36, 0.35);
      for (const u of [-0.38, 0.38])
        loft(
          g,
          'stone',
          u,
          -0.36,
          [
            [1.6, 0.27],
            [1.95, 0.25],
            [2.07, 0.07],
          ],
          true,
        );
      box(g, 'stone', 0, 0.55, 0.78, 0.28, 0.35, 0.25);
    }
}
