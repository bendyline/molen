/** 'temple_of_mars_ultor': Mars Ultor's mapped standing columns, broad stair and pierced rear firewall. */
import { normalFor } from './authored-structure-mesh.mjs';
import { openingBuilder, openingReveals, prepareOpening } from './authored-wall-openings.mjs';
import { buildCorinthianColumn } from './corinthian-column-geometry.mjs';
import { box, loft, prism } from './khmer-structure-geometry.mjs';

export function buildMarsUltorRemains(emit, detail, r, sample) {
  const c = Math.cos(r.architecturalAngleRadians),
    s = Math.sin(r.architecturalAngleRadians),
    F = r.floorY,
    pose = ([x, y, z]) => [r.center[0] + c * x - s * z, y, r.center[1] + s * x + c * z],
    grade = (x, z) => {
      const p = pose([x, 0, z]);
      return sample(p[0], p[2]);
    },
    f = (role, ps, n) => {
      if (detail === 0 && n[1] < -0.5) return;
      emit(role, ps.map(pose), [c * n[0] - s * n[2], n[1], s * n[0] + c * n[2]]);
    };
  const round = (role, x, z, profile, n, flutes = false) =>
    loft(f, role, x, z, profile, false, (w) =>
      Array.from({ length: n }, (_, i) => {
        const a = (i * Math.PI * 2) / n,
          q = flutes && detail >= 2 ? (i % 3 === 0 ? 0.88 : 1) : 1;
        return [Math.cos(a) * w * 0.5 * q, Math.sin(a) * w * 0.5 * q];
      }),
    );
  prism(f, 'wall', r.podium, r.baseY, F - (detail >= 1 ? 0.17 : 0));
  if (detail >= 1) prism(f, 'trim', r.podium, F - 0.17, F);
  // Vegetated portions of the occupied podium use the shared continuous stone noise,
  // softly tinted as ground cover; no per-model terrain image is introduced.
  for (const outline of [
    [
      [-9, -6],
      [7, -6],
      [10, -10],
      [9, -23],
      [4, -28],
      [-7, -26],
      [-9, -17],
    ],
    [
      [-8, -29],
      [5, -29],
      [7, -33],
      [2, -35],
      [-6, -33],
    ],
  ])
    prism(f, 'moss', { outline, holes: [] }, F + 0.002, F + 0.018);
  const run = 11,
    steps = [4, 9, 18, 18][detail],
    lower = Math.max(...[-15.4, 0, 15.4].map((x) => grade(x, 12.5))) + 0.08,
    stairBase = Math.min(r.baseY, ...[-15.4, 0, 15.4].map((x) => grade(x, 12.5) - 0.5));
  for (let i = 0; i < steps; i++)
    box(
      f,
      'trim',
      0,
      stairBase,
      12.5 - ((i + 0.5) * run) / steps,
      30.8,
      lower + ((F - lower) * (i + 1)) / steps - stairBase,
      run / steps,
    );
  const altar = r.controls.find((b) => b.id === 35185369511704).polygons[0],
    inv = ([x, z]) => [
      c * (x - r.center[0]) + s * (z - r.center[1]),
      -s * (x - r.center[0]) + c * (z - r.center[1]),
    ],
    altarPoly = { outline: altar.outline.map(inv), holes: [] };
  prism(f, 'brick', altarPoly, r.baseY, F + 0.26);
  if (detail >= 1) prism(f, 'wall', altarPoly, F + 0.26, F + 0.42);
  for (const p of r.frontStumps) {
    const [x, z] = p.center,
      n = [4, 8, 24, 48][detail];
    box(f, 'trim', x, F, z, 2.5, 0.28, 2.5);
    round(
      'trim',
      x,
      z,
      [
        [F + 0.28, 2.22],
        [F + 0.52, 1.88],
        [F + p.height, 1.7],
      ],
      n,
      true,
    );
    if (detail >= 2)
      for (let i = 1; i < Math.ceil(p.height); i++)
        round(
          'trim',
          x,
          z,
          [
            [F + i - 0.025, 1.89],
            [F + i + 0.025, 1.88],
          ],
          n,
          false,
        );
  }
  for (const p of r.standingColumns) {
    const [x, z] = p.center;
    if (detail <= 1) {
      box(f, 'trim', x, F, z, 2.6, 0.28, 2.6);
      round(
        'trim',
        x,
        z,
        [
          [F + 0.28, 2.1],
          [F + 0.75, 1.8],
          [F + 13.2, 1.48],
          [F + 15.02, 2.4],
        ],
        detail === 0 ? 6 : 12,
      );
      box(f, 'trim', x, F + 15.02, z, 2.8, 0.18, 2.8);
    } else
      buildCorinthianColumn(
        (_role, ps, n) =>
          f(
            'trim',
            ps.map(([u, y, v]) => [x + u * 1.12, F + y, z + v * 1.12]),
            [n[0] / 1.12, n[1], n[2] / 1.12],
          ),
        0,
        0,
        detail,
        0,
      );
  }
  const [px, pz] = r.pilaster;
  box(f, 'trim', px, F, pz, 2.55, 15.2, 2.25);
  if (detail >= 1)
    for (const y of [0.22, 0.5, 13.3, 14.8, 15.1]) box(f, 'trim', px, F + y, pz, 2.9, 0.16, 2.5);
  if (detail >= 2)
    for (let i = 0; i < 8; i++)
      box(f, 'trim', px + 1.29, F + 0.8, pz + (i - 3.5) * 0.235, 0.13, 12.4, 0.1);
  for (const p of r.entablature) {
    prism(f, 'trim', p, F + 15.15, F + 16.05);
    if (detail >= 1) prism(f, 'trim', p, F + 16.05, F + 16.35);
  }
  if (detail >= 2) {
    const a = r.standingColumns[0].center,
      b = r.pilaster,
      n = detail === 3 ? 36 : 18;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      box(
        f,
        'trim',
        a[0] + (b[0] - a[0]) * t + 1.35,
        F + 15.76,
        a[1] + (b[1] - a[1]) * t,
        0.22,
        0.22,
        0.28,
      );
    }
  }
  for (const p of r.leftCella) prism(f, 'brick', p, F, F + 4.4);
  box(f, 'wall', r.smallInterior[0], F, r.smallInterior[1], 1.6, 1.15, 1.8);
  // Low, broken apsidal masonry only; the cella stays unroofed.
  const n = detail === 0 ? 6 : detail === 1 ? 10 : 20,
    outer = [],
    inner = [];
  for (let i = 0; i <= n; i++) {
    const a = (i * Math.PI) / n;
    outer.push([Math.cos(a) * 10.4, -26.2 - Math.sin(a) * 10.4]);
    inner.push([Math.cos(a) * 9.3, -26.2 - Math.sin(a) * 9.3]);
  }
  prism(f, 'wall', { outline: [...outer, ...inner.toReversed()], holes: [] }, F, F + 1.1);
  const beamHoles = [];
  if (detail >= 2) {
    const p = r.wallSections[0].polygons[0].outline;
    for (const x of [-22, -18, -14, -10, -6, -2, 2, 6]) {
      const zs = [];
      for (let i = 0; i < p.length; i++) {
        const a = p[i],
          b = p[(i + 1) % p.length];
        if ((a[0] <= x && b[0] > x) || (b[0] <= x && a[0] > x))
          zs.push(a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]));
      }
      if (zs.length < 2) continue;
      const z = Math.max(...zs);
      for (const y of [5.6, 9.7, 17.3, 23.2])
        if ((Math.round(x) + Math.round(y)) % 5 !== 0)
          beamHoles.push(
            prepareOpening(
              {
                center: [x, z - 0.12],
                axis: [1, 0],
                width: 0.36,
                bottom: y,
                height: 0.4,
                shape: 'rect',
                depth: 0.6,
              },
              0,
              detail,
            ),
          );
    }
  }
  const holes = [prepareOpening(r.arch, 0, detail), ...beamHoles],
    cut = openingBuilder({ addTriangle: (role, _ref, ps, n) => f(role, ps, n) }, holes),
    wall = (role, ps, n) => {
      for (let i = 1; i < ps.length - 1; i++)
        if (Math.hypot(...normalFor(ps[0], ps[i], ps[i + 1])) > 0.5)
          cut.addTriangle(role, 'palette:#ffffff', [ps[0], ps[i], ps[i + 1]], n, [], []);
    };
  for (const section of r.wallSections)
    for (const p of section.polygons) {
      const base = Math.min(...p.outline.map((q) => grade(...q))) - 0.5,
        split = section.top > 20 ? 12.2 : 9.9;
      for (const [lo, hi, role] of detail === 0
        ? [[base, section.top, 'wall']]
        : [
            [base, split, 'wall'],
            [split, split + 0.35, 'trim'],
            [split + 0.35, section.top, 'wall'],
          ])
        prism(wall, role, p, lo, hi);
      openingReveals(
        { addTriangle: (_slot, _ref, ps, n) => f('wall', ps, n) },
        p.outline,
        () => base,
        () => section.top,
        holes,
        [],
      );
    }
  for (const h of beamHoles)
    f(
      'wall',
      h.ring.map(([u, y]) => h.point(u, y, -h.depth / 2)),
      [0, 0, 1],
    );
}
