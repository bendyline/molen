/** N0519: eroded mapped foundations, pale fragments and shallow gated recesses. */
import earcut from 'earcut';
export const concordCandidateId = 'N0519';
const area = (p) =>
  p.reduce((n, a, i) => {
    const b = p[(i + 1) % p.length];
    return n + a[0] * b[1] - a[1] * b[0];
  }, 0) / 2;
function ruin(f, role, poly, below, above, detail, seed = 0) {
  const ps = [],
    spacing = [Infinity, 3, 1.4, 0.65][detail];
  for (let i = 0; i < poly.outline.length; i++) {
    const a = poly.outline[i],
      b = poly.outline[(i + 1) % poly.outline.length],
      n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / spacing));
    for (let j = 0; j < n; j++)
      ps.push([a[0] + ((b[0] - a[0]) * j) / n, a[1] + ((b[1] - a[1]) * j) / n]);
  }
  const ctr = ps.reduce((a, p) => a.map((v, i) => v + p[i] / ps.length), [0, 0]),
    low = ps.map(([x, z]) => [x, typeof below === 'function' ? below(x, z) : below, z]),
    high = ps.map(([x, z], i) => {
      const t = detail ? 0.008 + 0.003 * Math.sin(i * 2.1 + seed) : 0;
      return [
        x + (ctr[0] - x) * t,
        (typeof above === 'function' ? above(x, z) : above) +
          (detail ? 0.07 * Math.sin(i * 2.1 + seed) : 0),
        z + (ctr[1] - z) * t,
      ];
    }),
    sgn = Math.sign(area(ps)),
    ix = earcut(high.flatMap((p) => [p[0], p[2]]));
  for (let i = 0; i < ps.length; i++) {
    const j = (i + 1) % ps.length,
      n = [(ps[j][1] - ps[i][1]) * sgn, 0, (ps[i][0] - ps[j][0]) * sgn];
    f(role, [low[i], low[j], high[j], high[i]], n);
    if (detail > 1 && role === 'core' && (i + seed) % 9 === 0) {
      const mid = (a, b, t) => a.map((v, i) => v * (1 - t) + b[i] * t),
        a = mid(low[i], high[i], 0.3),
        b = mid(low[j], high[j], 0.3),
        c = mid(low[j], high[j], 0.5),
        d = mid(low[i], high[i], 0.5),
        normal = n.map((v) => (v / Math.hypot(...n)) * 0.006);
      f(
        'brick',
        [a, b, c, d].map((p) => p.map((v, i) => v + normal[i])),
        n,
      );
    }
  }
  for (let i = 0; i < ix.length; i += 3) {
    f(
      role,
      ix.slice(i, i + 3).map((k) => low[k]),
      [0, -1, 0],
    );
    f(
      role,
      ix.slice(i, i + 3).map((k) => high[k]),
      [0, 1, 0],
    );
  }
}
function solid(f, role, p, lo, hi) {
  const ix = earcut(p.flat()),
    a = p.map(([x, z]) => [x, lo, z]),
    b = p.map(([x, z]) => [x, hi, z]),
    sgn = Math.sign(area(p));
  for (let i = 0; i < ix.length; i += 3) {
    f(
      role,
      ix.slice(i, i + 3).map((i) => a[i]),
      [0, -1, 0],
    );
    f(
      role,
      ix.slice(i, i + 3).map((i) => b[i]),
      [0, 1, 0],
    );
  }
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length;
    f(role, [a[i], a[j], b[j], b[i]], [(p[j][1] - p[i][1]) * sgn, 0, (p[i][0] - p[j][0]) * sgn]);
  }
}
const rectangle = (x, z, w, d) => [
  [x - w / 2, z - d / 2],
  [x + w / 2, z - d / 2],
  [x + w / 2, z + d / 2],
  [x - w / 2, z + d / 2],
];
export function buildConcordRuins(face, detail, r, sample) {
  const c = Math.cos(r.architecturalAngleRadians),
    s = Math.sin(r.architecturalAngleRadians),
    pose = ([u, v]) => [c * u - s * v, s * u + c * v],
    f = (role, ps, n) =>
      face(
        role,
        ps.map(([u, y, v]) => {
          const p = pose([u, v]);
          return [p[0], y, p[1]];
        }),
        [c * n[0] - s * n[2], n[1], s * n[0] + c * n[2]],
      ),
    grade = (x, z) => sample(...pose([x, z])),
    box = (role, x, y, z, w, h, d) => solid(f, role, rectangle(x, z, w, d), y, y + h);
  for (let k = 0; k < r.controls.length; k++) {
    const part = r.controls[k];
    if (part.id === r.gates.wallId) continue;
    for (const p of part.localPolygons) {
      const fragment = part.kind === 'fragment',
        y = Math.max(...p.outline.map((p) => grade(...p))) + part.height;
      ruin(
        f,
        fragment ? 'stone' : 'core',
        p,
        (x, z) => grade(x, z) - 0.65,
        fragment ? y : (x, z) => grade(x, z) + part.height,
        detail,
        k,
      );
      if (fragment && detail > 0) {
        const center = p.outline.reduce(
            (a, q) => a.map((v, i) => v + q[i] / p.outline.length),
            [0, 0],
          ),
          xs = p.outline.map((p) => p[0]),
          zs = p.outline.map((p) => p[1]),
          w = Math.max(...xs) - Math.min(...xs),
          d = Math.max(...zs) - Math.min(...zs);
        if (k % 5 === 0)
          for (let j = 0; j < 3; j++)
            box(
              'stone',
              center[0],
              y - 0.12 + j * 0.09,
              center[1],
              w * (0.75 + j * 0.08),
              0.1,
              d * (0.75 + j * 0.08),
            );
        else if (k % 5 === 1 && detail >= 2) {
          const n = detail === 2 ? 8 : 12,
            rad = Math.min(w, d) * 0.32,
            ring = Array.from({ length: n }, (_, i) => [
              center[0] + rad * Math.cos((i * Math.PI * 2) / n),
              center[1] + rad * Math.sin((i * Math.PI * 2) / n),
            ]);
          solid(f, 'stone', ring, y - 0.1, y + 0.24);
        }
      }
    }
  }
  const g = r.gates,
    top = g.floorY + g.top;
  for (const p of g.body) ruin(f, 'core', p, (x, z) => grade(x, z) - 0.65, top, detail, 83);
  for (const [recessIndex, u] of g.positions.entries()) {
    const arched = g.shapes[recessIndex] === 'arch';
    const floor = rectangle(u, (g.frontV + g.backV) / 2, g.halfWidth * 2, g.frontV - g.backV);
    solid(f, 'core', floor, Math.min(...floor.map((p) => grade(...p))) - 0.7, g.floorY);
    const n = arched ? (detail ? 12 : 5) : 1,
      arch = Array.from({ length: n + 1 }, (_, i) => {
        const a = (i * Math.PI) / n;
        return [
          u + g.halfWidth * Math.cos(a),
          g.floorY + g.spring + (arched ? g.halfWidth * Math.sin(a) : 0.4),
        ];
      }),
      head = [[u - g.halfWidth, top], [u + g.halfWidth, top], ...arch],
      ix = earcut(head.flat()),
      front = head.map(([x, y]) => [x, y, g.frontV]),
      back = head.map(([x, y]) => [x, y, g.backV]),
      sgn = Math.sign(area(head));
    for (let i = 0; i < ix.length; i += 3) {
      f(
        'core',
        ix.slice(i, i + 3).map((i) => front[i]),
        [0, 0, -1],
      );
      f(
        'core',
        ix.slice(i, i + 3).map((i) => back[i]),
        [0, 0, 1],
      );
    }
    for (let i = 0; i < head.length; i++) {
      const j = (i + 1) % head.length;
      f(
        'core',
        [front[i], front[j], back[j], back[i]],
        [(head[j][1] - head[i][1]) * sgn, (head[i][0] - head[j][0]) * sgn, 0],
      );
    }
    // Solid back, sealed floor and actual depth: the grilles do not conceal a ground hole.
    box('core', u, g.floorY, g.backV - 0.07, g.halfWidth * 2, g.spring + g.halfWidth, 0.14);
    if (detail && !arched) {
      for (let x = -0.5; x <= 0.51; x += 0.25) {
        const h = g.spring + 0.4;
        box('metal', u + x, g.floorY + 0.02, g.frontV + 0.28, 0.038, h - 0.04, 0.038);
      }
      for (const h of [0.65, 1.4])
        box('metal', u - 0.01, g.floorY + h, g.frontV + 0.28, 1.16, 0.04, 0.04);
    }
  }
}
