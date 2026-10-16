/** Grunewald source-local reviewed reconstruction. Original historic architectural draft remains unchanged. */
import { beam, loft, radialRing, sphere as sourceSphere } from './authored-structure-mesh.mjs';
import { deform, face, transform, triangle } from './heritage-tower-detail-mesh.mjs';
import { lathe as sourceLathe } from './lighthouse-models.mjs';
import { box, tube as sourceTube } from './structure-mesh.mjs';

function detail(out, mode) {
  const dark = [0.075, 0.085, 0.085],
    stone = [0.8, 0.76, 0.65],
    select = (master, close, street, district) =>
      mode === 'master'
        ? master
        : mode === 'closeup'
          ? close
          : mode === 'street'
            ? street
            : district,
    radialCount = select(160, 24, 16, 8),
    curveCount = select(64, 8, 12, 4),
    foilCount = select(64, 8, 8, 4),
    vaultCount = select(40, 12, 8, 3),
    archCount = select(32, 6, 8, 4);
  const lathe = (o, s, p, c, n) => sourceLathe(o, s, p, c, Math.min(n, radialCount)),
    tube = (o, s, a, b, r, c, n) => sourceTube(o, s, a, b, r, c, Math.min(n, select(n, 8, 6, 4))),
    sphere = (o, s, p, r, c, n, m) =>
      sourceSphere(
        o,
        s,
        p,
        r,
        c,
        Math.min(n, select(n, s === 'brick' ? 8 : 16, 8, 6)),
        Math.min(m, select(m, s === 'brick' ? 4 : 8, 4, 3)),
      );
  const archY = (x, radius, rise, pointed) =>
    rise *
    (pointed
      ? Math.sqrt(Math.max(0, 4 - (Math.abs(x) / radius + 1) ** 2)) / Math.sqrt(3)
      : Math.sqrt(Math.max(0, 1 - (x / radius) ** 2)));
  /** A true arch opening cut out of a rectangular wall, with jamb/soffit reveals. */
  function archBay(
    out,
    slot,
    x,
    width,
    y0,
    spring,
    rise,
    top,
    z,
    thickness,
    color = stone,
    { pointed = false, back = true, trim = 0.12 } = {},
  ) {
    const r = width / 2,
      n = archCount;
    if (back)
      box(
        out,
        'shadow',
        [x - r, y0, z - thickness - 0.1],
        [x + r, spring + rise, z - thickness],
        dark,
      );
    for (let i = 0; i < n; i++) {
      const a = -r + (width * i) / n,
        b = -r + (width * (i + 1)) / n;
      const ya = spring + archY(a, r, rise, pointed),
        yb = spring + archY(b, r, rise, pointed);
      if (top > Math.max(ya, yb))
        face(
          out,
          slot,
          [
            [x + a, ya, z],
            [x + b, yb, z],
            [x + b, top, z],
            [x + a, top, z],
          ],
          color,
        );
      face(
        out,
        slot,
        [
          [x + a, ya, z - thickness],
          [x + b, yb, z - thickness],
          [x + b, yb, z],
          [x + a, ya, z],
        ],
        color,
      );
      if (trim) beam(out, slot, [x + a, ya, z + 0.025], [x + b, yb, z + 0.025], trim, trim, color);
    }
    if (spring > y0) {
      face(
        out,
        slot,
        [
          [x - r, y0, z],
          [x - r, y0, z - thickness],
          [x - r, spring, z - thickness],
          [x - r, spring, z],
        ],
        color,
      );
      face(
        out,
        slot,
        [
          [x + r, y0, z - thickness],
          [x + r, y0, z],
          [x + r, spring, z],
          [x + r, spring, z - thickness],
        ],
        color,
      );
      if (trim)
        for (const sign of [-1, 1])
          box(
            out,
            slot,
            [x + sign * r - trim / 2, y0, z],
            [x + sign * r + trim / 2, spring, z + trim],
            color,
          );
    }
  }
  function facade(out, slot, width, y0, y1, z, windows, color = stone) {
    const xs = [
      ...new Set([
        -width / 2,
        width / 2,
        ...windows.flatMap((w) => [w.x - w.w / 2, w.x + w.w / 2]),
      ]),
    ].sort((a, b) => a - b);
    const ys = [...new Set([y0, y1, ...windows.flatMap((w) => [w.y, w.top])])].sort(
      (a, b) => a - b,
    );
    for (let j = 0; j < ys.length - 1; j++)
      for (let i = 0; i < xs.length - 1; i++) {
        const x = (xs[i] + xs[i + 1]) / 2,
          y = (ys[j] + ys[j + 1]) / 2;
        if (windows.some((w) => x > w.x - w.w / 2 && x < w.x + w.w / 2 && y > w.y && y < w.top))
          continue;
        face(
          out,
          slot,
          [
            [xs[i], ys[j], z],
            [xs[i + 1], ys[j], z],
            [xs[i + 1], ys[j + 1], z],
            [xs[i], ys[j + 1], z],
          ],
          color,
        );
      }
    for (const w of windows)
      archBay(out, slot, w.x, w.w, w.y, w.spring, w.rise, w.top, z, w.depth ?? 0.45, color, w);
  }

  // Reference-based medium-fi sculptures, not photographic reproductions or measured likenesses.
  function sideStairs(out) {
    for (const sign of [-1, 1]) {
      const t = transform(out, 0, [0, 0, 12.1]);
      for (let j = 0; j < 24; j++) {
        const x0 = 3.1 + j * 0.31,
          x1 = x0 + 0.32,
          y = 4 - j / 6;
        box(t, 'stone', [sign < 0 ? -x1 : x0, 0, 0.12], [sign < 0 ? -x0 : x1, y, 2.6], porphyry);
      }
      beam(t, 'stone', [sign * 3.1, 4.9, 2.7], [sign * 10.5, 0.9, 2.7], 0.3, 0.28, porphyry);
      for (let j = 0; j <= 8; j++) {
        const x = sign * (3.1 + j * 0.93),
          y = 4 - j * 0.5;
        box(t, 'stone', [x - 0.1, y, 2.59], [x + 0.1, y + 0.9, 2.79], porphyry);
      }
    }
  }
  function eagle(out, color) {
    const z = 3.515;
    const poly = (p) => {
      const q = p.map(([x, y]) => [x, y, z]);
      if (
        q.reduce(
          (n, v, i) => n + v[0] * q[(i + 1) % q.length][1] - v[1] * q[(i + 1) % q.length][0],
          0,
        ) < 0
      )
        q.reverse();
      for (let i = 1; i < q.length - 1; i++) triangle(out, 'metal', [q[0], q[i], q[i + 1]], color);
    };
    sphere(out, 'metal', [0, 32.7, z + 0.07], [0.2, 0.58, 0.055], color, 12, 8);
    for (const s of [-1, 1]) {
      poly([
        [s * 0.08, 32.95],
        [s * 0.75, 33.63],
        [s * 0.98, 33.59],
        [s * 0.91, 32.68],
        [s * 0.52, 32.1],
        [s * 0.23, 32.5],
      ]);
      for (let j = 0; j < 4; j++)
        beam(
          out,
          'metal',
          [s * (0.36 + j * 0.13), 32.95 + j * 0.12, z + 0.01],
          [s * (0.64 + j * 0.09), 32.28 + j * 0.14, z + 0.01],
          0.07,
          0.025,
          color,
        );
      beam(out, 'metal', [s * 0.08, 32.22, z], [s * 0.3, 31.73, z], 0.09, 0.04, color);
    }
    poly([
      [-0.18, 32.35],
      [0.18, 32.35],
      [0.32, 31.59],
      [0, 31.36],
      [-0.32, 31.59],
    ]);
    sphere(out, 'metal', [0, 33.36, z + 0.07], [0.15, 0.16, 0.045], color, 10, 6);
    poly([
      [0.07, 33.47],
      [0.3, 33.39],
      [0.13, 33.3],
    ]);
    box(out, 'metal', [-0.16, 33.57, z], [0.16, 33.68, z + 0.025], color);
  }
  function memorialVault(out) {
    const gold = [0.65, 0.46, 0.115],
      blue = [0.07, 0.12, 0.26],
      point = (r, a) => [
        Math.cos(a) * r,
        11.08 - (11.08 - 8.2) * Math.pow(r / 5.1, 2),
        Math.sin(a) * r,
      ];
    const rows = select(16, 10, 6, 2),
      sides = select(64, 32, 16, 8);
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < sides; i++) {
        const a = (i * tau) / sides,
          b = ((i + 1) * tau) / sides,
          r0 = (5.1 * j) / rows,
          r1 = (5.1 * (j + 1)) / rows;
        if (j === 0) triangle(out, 'mosaic', [point(r0, a), point(r1, a), point(r1, b)], gold);
        else face(out, 'mosaic', [point(r0, a), point(r1, a), point(r1, b), point(r0, b)], gold);
      }
    for (let i = 0; i < 8; i++) {
      const a = (i * tau) / 8;
      let previous;
      for (let j = 0; j <= vaultCount; j++) {
        const p = point((5.1 * j) / vaultCount, a);
        p[1] -= 0.06;
        if (previous) beam(out, 'brick', previous, p, 0.11, 0.13, trim);
        previous = p;
      }
      if (mode !== 'district') {
        let prior;
        for (let j = 0; j <= select(28, 14, 8, 4); j++) {
          const t = j / select(28, 14, 8, 4),
            angle = a + tau / 16 + Math.sin(t * Math.PI * 2) * 0.12,
            p = point(0.6 + 3.7 * t, angle);
          p[1] -= 0.015;
          if (prior) beam(out, 'mosaic', prior, p, 0.055, 0.025, blue);
          prior = p;
        }
      }
    }
    sphere(out, 'brick', [0, 10.93, 0], [0.27, 0.14, 0.27], trim, 16, 8);
  }
  function memorialArt(out) {
    const marble = [0.84, 0.82, 0.75],
      stone = [0.8, 0.79, 0.73];
    box(out, 'marble', [-0.77, 4.35, -0.77], [0.77, 4.56, 0.77], stone);
    loft(
      out,
      'marble',
      [rect(4.56, 0.72), rect(4.75, 0.59), rect(6.04, 0.59), rect(6.27, 0.76), rect(6.4, 0.76)],
      stone,
    );
    const t = transform(out, 0, [0, 6.4, 0]),
      scale = 1.25,
      art = deform(t, ([x, y, z]) => [x * scale, y * scale, z * scale]);
    for (const [x, z] of [
      [-0.17, 0.05],
      [0.18, -0.03],
    ]) {
      loft(
        art,
        'marble',
        [
          [0, 0.125, 0.15],
          [0.24, 0.13, 0.12],
          [0.77, 0.145, 0.14],
        ].map(([y, rx, rz]) => radialRing(y, rx, rz, select(20, 12, 8, 6), [x, z])),
        marble,
      );
      sphere(art, 'marble', [x, 0.08, z + 0.085], [0.14, 0.095, 0.24], marble, 16, 8);
    }
    loft(
      art,
      'marble',
      [
        [0.72, 0.36, 0.2],
        [0.95, 0.27, 0.17],
        [1.28, 0.3, 0.19],
        [1.57, 0.36, 0.17],
      ].map(([y, rx, rz]) => radialRing(y, rx, rz, select(24, 16, 8, 6))),
      marble,
    );
    sphere(art, 'marble', [0, 1.77, 0.015], [0.145, 0.205, 0.14], marble, 20, 12);
    sphere(art, 'marble', [0, 1.59, 0], [0.08, 0.12, 0.08], marble, 12, 8);
    sphere(art, 'marble', [0, 1.83, 0.13], [0.04, 0.06, 0.047], marble, 10, 6);
    for (const s of [-1, 1])
      sphere(art, 'marble', [s * 0.09, 1.67, 0.11], [0.066, 0.1, 0.055], marble, 12, 8);
    tube(art, 'marble', [-0.31, 1.5, 0], [-0.43, 1.16, 0.02], 0.115, marble, 12);
    tube(art, 'marble', [-0.43, 1.16, 0.02], [-0.13, 1.1, 0.24], 0.095, marble, 12);
    sphere(art, 'marble', [-0.12, 1.1, 0.245], [0.09, 0.06, 0.075], marble, 12, 6);
    tube(art, 'marble', [0.31, 1.5, 0], [0.43, 0.92, 0.025], 0.11, marble, 12);
    sphere(art, 'marble', [0.44, 0.9, 0.05], [0.08, 0.075, 0.06], marble, 12, 6);
    sphere(art, 'marble', [0.41, 0.74, 0.12], [0.19, 0.14, 0.16], marble, 12, 6);
    loft(
      art,
      'marble',
      [
        radialRing(0.72, 0.31, 0.08, select(24, 16, 8, 6), [0, -0.21]),
        radialRing(1.55, 0.39, 0.05, select(24, 16, 8, 6), [0, -0.2]),
      ],
      marble,
    );
    if (mode !== 'district') {
      for (const y of [1, 1.15, 1.3, 1.43])
        for (const x of [-0.075, 0.075])
          sphere(art, 'marble', [x, y, 0.204], [0.019, 0.018, 0.012], stone, 8, 4);
      beam(art, 'marble', [-0.25, 1.55, 0.12], [-0.08, 1.35, 0.23], 0.05, 0.025, stone);
      beam(art, 'marble', [0.25, 1.55, 0.12], [0.08, 1.35, 0.23], 0.05, 0.025, stone);
    }
    // Four full-length iron relief plates: low relief silhouettes, not oval portrait medallions.
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * tau) / 4,
        t = transform(out, a + Math.PI, [
          Math.sign(Math.sin(a)) * 3.65,
          0,
          Math.sign(Math.cos(a)) * 3.65,
        ]),
        dark = [0.16, 0.18, 0.16],
        lit = [0.19, 0.21, 0.185];
      box(t, 'brick', [-0.75, 4.35, -0.26], [0.75, 8.45, 0], brick);
      box(t, 'metal', [-0.5, 4.95, -0.04], [0.5, 8.1, 0.045], dark);
      for (const x of [-0.47, 0.47])
        box(t, 'metal', [x - 0.035, 4.95, 0.04], [x + 0.035, 8.1, 0.11], lit);
      for (const y of [4.98, 8.06])
        box(t, 'metal', [-0.48, y - 0.035, 0.04], [0.48, y + 0.035, 0.11], lit);
      const body = deform(t, ([x, y, z]) => [x, y, z * 0.32]);
      loft(
        body,
        'metal',
        [
          [5.8, 0.34, 0.19],
          [6.35, 0.22, 0.18],
          [7.12, 0.31, 0.19],
          [7.42, 0.34, 0.18],
        ].map(([y, rx, rz]) => radialRing(y, rx, rz, select(24, 12, 8, 6), [0, 0.23])),
        lit,
      );
      for (const x of [-0.16, 0.16]) {
        beam(t, 'metal', [x, 5.24, 0.09], [x, 5.93, 0.11], 0.13, 0.065, lit);
        sphere(t, 'metal', [x, 5.2, 0.13], [0.15, 0.075, 0.04], lit, 12, 6);
      }
      sphere(t, 'metal', [0, 7.66, 0.11], [0.15, 0.2, 0.055], lit, 16, 8);
      sphere(t, 'metal', [0, 7.48, 0.12], [0.075, 0.1, 0.035], lit, 12, 6);
      for (const s of [-1, 1]) {
        beam(t, 'metal', [s * 0.28, 7.34, 0.1], [s * 0.39, 6.43, 0.1], 0.115, 0.055, lit);
        sphere(t, 'metal', [s * 0.39, 6.4, 0.115], [0.055, 0.07, 0.035], lit, 10, 6);
      }
      if (i === 0 || i === 3) box(t, 'metal', [-0.2, 7.79, 0.08], [0.2, 7.88, 0.16], lit);
      else if (i === 2) sphere(t, 'metal', [0, 7.53, 0.16], [0.12, 0.13, 0.035], lit, 12, 6);
      if (mode !== 'district') {
        for (const y of [6.6, 6.85, 7.1])
          beam(t, 'metal', [-0.18, y, 0.14], [0.18, y, 0.14], 0.025, 0.024, dark);
        beam(t, 'metal', [0.33, 6.4, 0.14], [0.36, 5.26, 0.14], 0.035, 0.025, lit);
        for (const x of [-0.34, 0.34])
          tube(t, 'metal', [x, 5.17, 0.12], [x, 7.61, 0.12], 0.026, lit, 8);
      }
      // Trefoil-like canopy rim beneath the rectangular plate's top border.
      for (const [cx, cy, r] of [
        [0, 7.88, 0.23],
        [-0.24, 7.67, 0.13],
        [0.24, 7.67, 0.13],
      ]) {
        let prior;
        for (let j = 0; j <= select(24, 4, 6, 4); j++) {
          const angle = (j * Math.PI) / select(24, 4, 6, 4),
            p = [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, 0.13];
          if (prior) beam(t, 'metal', prior, p, 0.024, 0.02, lit);
          prior = p;
        }
      }
    }
    // Paired glazing seen behind the figure; no photograph is used as a material.
    const back = transform(out, 0, [0, 0, -4.05]);
    facade(
      back,
      'brick',
      4.3,
      4.35,
      10.4,
      0,
      [-1.05, 1.05].map((x) => ({
        x,
        w: 1.55,
        y: 4.8,
        spring: 8.3,
        rise: 0.85,
        top: 9.5,
        depth: 0.16,
        pointed: true,
        back: false,
        trim: 0.07,
      })),
      brick,
    );
    for (const x of [-1.05, 1.05]) {
      box(back, 'glass', [x - 0.73, 4.8, -0.18], [x + 0.73, 9.15, -0.16], [0.57, 0.61, 0.42]);
      for (const y of [6.1, 7.4])
        beam(back, 'metal', [x - 0.74, y, 0.03], [x + 0.74, y, 0.03], 0.035, 0.04, iron);
    }
  }
  function equipment(out) {
    if (mode === 'district') return;
    for (const s of [-1, 1]) {
      const t = transform(out, s > 0 ? Math.PI / 2 : -Math.PI / 2);
      sphere(
        t,
        'metal',
        [3.42, 37.4, 4.02],
        [0.6, 0.6, 0.12],
        [0.43, 0.44, 0.42],
        select(32, 16, 8, 6),
        select(16, 8, 4, 3),
      );
      beam(t, 'metal', [3.42, 37.4, 3.67], [3.42, 37.4, 4.02], 0.09, 0.09, [0.42, 0.44, 0.42]);
      for (const y of [38.1, 40.2])
        box(t, 'metal', [3.375, y, 3.64], [3.465, y + 1.2, 3.73], [0.42, 0.44, 0.42]);
      box(t, 'metal', [-0.045, 51.5, 0.91], [0.045, 52.7, 1], [0.42, 0.44, 0.42]);
    }
  }

  const tau = Math.PI * 2;
  const brick = [0.66, 0.33, 0.23],
    trim = [0.61, 0.29, 0.2];
  const porphyry = [0.55, 0.42, 0.37],
    pale = [0.87, 0.84, 0.72];
  const iron = [0.095, 0.105, 0.095];
  const rect = (y, r) => [
    [-r, y, -r],
    [-r, y, r],
    [r, y, r],
    [r, y, -r],
  ];

  function band(out, y, radius, height = 0.2, slot = 'brick', color = trim) {
    loft(
      out,
      slot,
      [rect(y, radius), rect(y + height * 0.42, radius + 0.12), rect(y + height, radius + 0.12)],
      color,
    );
  }

  /** Continuous open Gothic molding: no closed tube caps between segments. */
  function archMolding(out, x, spring, radius, rise, z, width, depth, color = trim) {
    const rings = [];
    for (let i = 0; i <= curveCount; i++) {
      const u = -1 + (i * 2) / curveCount;
      const curve = Math.sqrt(Math.max(0, 4 - (Math.abs(u) + 1) ** 2)) / Math.sqrt(3);
      // Nested profiles preserve a pointed cusp without a normal-offset self-intersection.
      const inner = [x + u * (radius - width / 2), spring + curve * (rise - width / 2)];
      const outer = [x + u * (radius + width / 2), spring + curve * (rise + width / 2)];
      rings.push([
        [...inner, z],
        [...inner, z - depth],
        [...outer, z - depth],
        [...outer, z],
      ]);
    }
    loft(out, 'brick', rings, color);
  }

  /** Pierced four-lobed panel. Each void has a real back-to-front reveal. */
  function quatrefoil(out, x, y, z, size, slot = 'brick', color = trim) {
    const n = foilCount,
      d = 0.18;
    const p = (i, outer, zz) => {
      const a = (-i * tau) / n;
      const r = outer
        ? (size * 0.5) / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)))
        : size * (0.29 + 0.075 * Math.cos(4 * a));
      return [x + Math.cos(a) * r, y + Math.sin(a) * r, zz];
    };
    for (let i = 0; i < n; i++) {
      face(
        out,
        slot,
        [p(i, true, z), p(i, false, z), p(i + 1, false, z), p(i + 1, true, z)],
        color,
      );
      face(
        out,
        slot,
        [p(i + 1, true, z - d), p(i + 1, false, z - d), p(i, false, z - d), p(i, true, z - d)],
        color,
      );
      face(
        out,
        slot,
        [p(i, false, z), p(i, false, z - d), p(i + 1, false, z - d), p(i + 1, false, z)],
        color,
      );
    }
  }

  function rail(out, width, y, z, slot = 'brick', color = trim) {
    const count = Math.floor(width / 0.7),
      step = width / count;
    box(out, slot, [-width / 2, y, z - 0.22], [width / 2, y + 0.17, z + 0.06], color);
    box(out, slot, [-width / 2, y + 0.94, z - 0.25], [width / 2, y + 1.12, z + 0.09], color);
    for (let i = 0; i < count; i++) {
      const x = -width / 2 + (i + 0.5) * step;
      if (mode === 'district')
        box(out, slot, [x - step * 0.36, y + 0.2, z - 0.18], [x + step * 0.36, y + 0.9, z], color);
      else {
        quatrefoil(out, x, y + 0.55, z, step, slot, color);
        if (slot === 'brick')
          box(
            out,
            'plaster',
            [x - step * 0.5, y + 0.2, z - 0.205],
            [x + step * 0.5, y + 0.9, z - 0.19],
            pale,
          );
      }
    }
  }

  function masonryCone(out, x, z, y0, y1, radius, sides = 96) {
    // Visible projecting fired-brick courses follow the cone rather than a planar roof texture.
    sides = Math.min(sides, radialCount);
    const courses =
      mode === 'master'
        ? Math.ceil((y1 - y0) / 0.135)
        : mode === 'closeup'
          ? Math.ceil((y1 - y0) / 0.65)
          : mode === 'street'
            ? Math.ceil((y1 - y0) / 1.2)
            : 1;
    for (let j = 0; j < courses; j++) {
      const a = y0 + ((y1 - y0) * j) / courses,
        b = y0 + ((y1 - y0) * (j + 1)) / courses;
      const r = Math.max(0.045, radius * (1 - j / courses));
      const s = Math.max(0.035, radius * (1 - (j + 1) / courses));
      loft(
        out,
        'brickroof',
        [
          radialRing(a, r + 0.022, r + 0.022, sides, [x, z]),
          radialRing(b - 0.019, s + 0.022, s + 0.022, sides, [x, z]),
          radialRing(b, s, s, sides, [x, z]),
          radialRing(b, s + 0.022, s + 0.022, sides, [x, z]),
        ],
        [0.62 - (j % 5) * 0.008, 0.31, 0.215],
        { cap: j === 0 },
      );
    }
    sphere(out, 'brick', [x, y1 + 0.06, z], [0.09, 0.12, 0.09], trim, 20, 12);
  }

  function turret(out, x, z) {
    const t = transform(out, 0, [x, 0, z]);
    lathe(
      transform(t, Math.PI / 8),
      'brick',
      [
        [11.35, 1.08],
        [11.7, 1.14],
        [12.05, 1.14],
      ],
      trim,
      8,
    );
    for (let i = 0; i < 8; i++) {
      const a = (i * tau) / 8,
        wall = transform(t, a);
      facade(
        wall,
        'brick',
        0.875,
        12.05,
        15.75,
        1.055,
        [
          {
            x: 0,
            w: 0.46,
            y: 12.5,
            spring: 14.5,
            rise: 0.45,
            top: 15.2,
            depth: 0.2,
            pointed: true,
            back: true,
            trim: 0.035,
          },
        ],
        brick,
      );
      archMolding(wall, 0, 14.5, 0.26, 0.5, 1.11, 0.09, 0.12);
      box(wall, 'brick', [-0.45, 12.05, 1.02], [-0.35, 15.95, 1.17], trim);
      box(wall, 'brick', [0.35, 12.05, 1.02], [0.45, 15.95, 1.17], trim);
      sphere(wall, 'brick', [0.4, 16.02, 1.1], [0.085, 0.15, 0.085], trim, 12, 8);
    }
    lathe(
      transform(t, Math.PI / 8),
      'brick',
      [
        [15.65, 1.15],
        [15.89, 1.25],
        [16.04, 1.23],
      ],
      trim,
      8,
    );
    for (let i = 0; i < 8; i++) rail(transform(t, (i * tau) / 8), 0.84, 11.8, 1.07);
    masonryCone(t, 0, 0, 16.04, 19.2, 1.19, 64);
    tube(t, 'metal', [0, 19.2, 0], [0, 19.7, 0], 0.035, iron, 12);
  }

  function vault(out, floor, spring, top, span, slot = 'brick') {
    // Four pointed intersecting vault ribs, with the section's central hanging boss.
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      let previous;
      for (let j = 0; j <= vaultCount; j++) {
        const t = j / vaultCount,
          r = span * (1 - t);
        const p = [
          Math.cos(a) * r,
          spring + (top - spring) * Math.sin((t * Math.PI) / 2),
          Math.sin(a) * r,
        ];
        if (previous) beam(out, slot, previous, p, 0.095, 0.13, pale);
        previous = p;
      }
      box(
        out,
        slot,
        [Math.cos(a) * span - 0.14, floor, Math.sin(a) * span - 0.14],
        [Math.cos(a) * span + 0.14, spring, Math.sin(a) * span + 0.14],
        pale,
      );
    }
    sphere(out, slot, [0, top - 0.05, 0], [0.25, 0.15, 0.25], pale, 24, 12);
  }

  const letters = {
    A: [
      [
        [0, 0],
        [0.5, 1],
        [1, 0],
      ],
      [
        [0.2, 0.4],
        [0.8, 0.4],
      ],
    ],
    B: [
      [
        [0, 0],
        [0, 1],
        [0.65, 1],
        [1, 0.8],
        [0.65, 0.52],
        [0, 0.52],
      ],
      [
        [0.65, 0.52],
        [1, 0.25],
        [0.65, 0],
        [0, 0],
      ],
    ],
    C: [
      [
        [1, 0.85],
        [0.7, 1],
        [0.2, 1],
        [0, 0.75],
        [0, 0.25],
        [0.2, 0],
        [0.8, 0],
        [1, 0.15],
      ],
    ],
    D: [
      [
        [0, 0],
        [0, 1],
        [0.6, 1],
        [1, 0.75],
        [1, 0.25],
        [0.6, 0],
        [0, 0],
      ],
    ],
    E: [
      [
        [1, 0],
        [0, 0],
        [0, 1],
        [1, 1],
      ],
      [
        [0, 0.5],
        [0.75, 0.5],
      ],
    ],
    G: [
      [
        [1, 0.8],
        [0.75, 1],
        [0.2, 1],
        [0, 0.75],
        [0, 0.25],
        [0.2, 0],
        [1, 0],
        [1, 0.5],
        [0.55, 0.5],
      ],
    ],
    H: [
      [
        [0, 0],
        [0, 1],
      ],
      [
        [1, 0],
        [1, 1],
      ],
      [
        [0, 0.5],
        [1, 0.5],
      ],
    ],
    I: [
      [
        [0.5, 0],
        [0.5, 1],
      ],
      [
        [0, 0],
        [1, 0],
      ],
      [
        [0, 1],
        [1, 1],
      ],
    ],
    K: [
      [
        [0, 0],
        [0, 1],
      ],
      [
        [1, 1],
        [0, 0.45],
        [1, 0],
      ],
    ],
    L: [
      [
        [0, 1],
        [0, 0],
        [1, 0],
      ],
    ],
    M: [
      [
        [0, 0],
        [0, 1],
        [0.5, 0.48],
        [1, 1],
        [1, 0],
      ],
    ],
    N: [
      [
        [0, 0],
        [0, 1],
        [1, 0],
        [1, 1],
      ],
    ],
    O: [
      [
        [0.2, 0],
        [0, 0.2],
        [0, 0.8],
        [0.2, 1],
        [0.8, 1],
        [1, 0.8],
        [1, 0.2],
        [0.8, 0],
        [0.2, 0],
      ],
    ],
    R: [
      [
        [0, 0],
        [0, 1],
        [0.7, 1],
        [1, 0.8],
        [1, 0.65],
        [0.7, 0.5],
        [0, 0.5],
      ],
      [
        [0.5, 0.5],
        [1, 0],
      ],
    ],
    S: [
      [
        [1, 0.85],
        [0.8, 1],
        [0.2, 1],
        [0, 0.8],
        [0.2, 0.55],
        [0.8, 0.45],
        [1, 0.2],
        [0.8, 0],
        [0.2, 0],
        [0, 0.15],
      ],
    ],
    T: [
      [
        [0.5, 0],
        [0.5, 1],
      ],
      [
        [0, 1],
        [1, 1],
      ],
    ],
    U: [
      [
        [0, 1],
        [0, 0.2],
        [0.2, 0],
        [0.8, 0],
        [1, 0.2],
        [1, 1],
      ],
    ],
    W: [
      [
        [0, 1],
        [0.2, 0],
        [0.5, 0.55],
        [0.8, 0],
        [1, 1],
      ],
    ],
    Z: [
      [
        [0, 1],
        [1, 1],
        [0, 0],
        [1, 0],
      ],
    ],
    1: [
      [
        [0.2, 0.8],
        [0.55, 1],
        [0.55, 0],
      ],
      [
        [0.2, 0],
        [0.85, 0],
      ],
    ],
    8: [
      [
        [0.2, 0],
        [0, 0.2],
        [0.2, 0.5],
        [0, 0.8],
        [0.2, 1],
        [0.8, 1],
        [1, 0.8],
        [0.8, 0.5],
        [1, 0.2],
        [0.8, 0],
        [0.2, 0],
      ],
      [
        [0.2, 0.5],
        [0.8, 0.5],
      ],
    ],
    9: [
      [
        [0.9, 0],
        [1, 0.8],
        [0.8, 1],
        [0.2, 1],
        [0, 0.8],
        [0, 0.6],
        [0.2, 0.45],
        [1, 0.45],
      ],
    ],
    7: [
      [
        [0, 1],
        [1, 1],
        [0.35, 0],
      ],
    ],
  };

  function inscription(out, text, y, z, width = 6.6) {
    if (mode === 'district') {
      box(out, 'metal', [-width / 2, y, z - 0.02], [width / 2, y + 0.4, z], iron);
      return;
    }
    const step = width / text.length,
      h = 0.58;
    for (const [i, c] of [...text].entries())
      for (const line of letters[c] ?? [])
        for (let j = 1; j < line.length; j++) {
          const at = ([u, v]) => [-width / 2 + (i + 0.12 + u * 0.72) * step, y + v * h, z];
          beam(out, 'metal', at(line[j - 1]), at(line[j]), 0.028, 0.024, iron);
        }
  }

  function terrace(out) {
    box(out, 'stone', [-12.05, 0, -12.05], [12.05, 3.85, 12.05], porphyry);
    box(out, 'stone', [-12.3, 3.85, -12.3], [12.3, 4, 12.3], porphyry);
    for (let side = 0; side < 4; side++) {
      const t = transform(out, (side * Math.PI) / 2);
      for (const s of [-1, 1]) {
        const w = transform(t, 0, [s * 7.8, 0, 0]);
        // Low terrace arcade, distinct from the Gothic tower's four-lobed gallery rail.
        for (let j = 0; j < 12; j++) {
          const x = -4.2 + j * 0.72;
          box(w, 'stone', [x - 0.06, 4, 11.93], [x + 0.06, 4.83, 12.18], porphyry);
          archBay(w, 'stone', x + 0.36, 0.6, 4, 4.53, 0.3, 4.96, 12.16, 0.2, porphyry, {
            back: false,
            trim: 0,
          });
        }
        box(w, 'stone', [-4.32, 4.96, 11.82], [4.32, 5.14, 12.28], porphyry);
      }
      if (side === 0) {
        // Main stair with independently modeled risers, treads and sloping balustrades.
        for (let j = 0; j < 24; j++) {
          const y = (j + 1) / 6,
            z = 19.6 - j * 0.32;
          box(t, 'stone', [-2.75, 0, z - 0.33], [2.75, y, z], porphyry);
        }
        for (const s of [-1, 1]) {
          beam(t, 'stone', [s * 3.03, 0.9, 19.6], [s * 3.03, 4.9, 12], 0.24, 0.34, porphyry);
          for (let j = 0; j <= 24; j++) {
            const y = j / 6,
              z = 19.6 - (j * 7.6) / 24;
            box(
              t,
              'stone',
              [s * 3.03 - 0.1, y, z - 0.1],
              [s * 3.03 + 0.1, y + 0.9, z + 0.1],
              porphyry,
            );
          }
        }
      } else {
        box(t, 'stone', [-3.5, 4, 11.93], [3.5, 4.25, 12.18], porphyry);
        rail(t, 7, 4.18, 12.14, 'stone', porphyry);
      }
      // Rock-faced plinth block courses, with varied but deterministic joints.
      for (let row = 0; mode !== 'district' && row < select(7, 4, 2, 0); row++)
        for (let j = 0; j < select(23, 12, 6, 0); j++) {
          const x = -11.96 + j * select(1.03, 1.97, 3.94, 1.03);
          box(
            t,
            'stone',
            [x, 0.12 + row * select(0.52, 0.91, 1.82, 0.52), 12.045],
            [
              x + select(0.985, 1.91, 3.86, 0.985),
              select(0.6, 0.95, 1.83, 0.6) + row * select(0.52, 0.91, 1.82, 0.52),
              12.075 + ((j * 7 + row) % 4) * 0.007,
            ],
            porphyry.map((v) => v * (0.91 + ((j * 3 + row * 5) % 7) * 0.02)),
          );
        }
    }
    for (const x of [-12, 12])
      for (const z of [-12, 12]) {
        loft(
          out,
          'stone',
          [
            [0, 1],
            [4, 0.73],
            [5.4, 0.6],
            [6, 0.74],
            [6.22, 0.81],
          ].map(([y, r]) => rect(y, r).map((p) => [p[0] + x, p[1], p[2] + z])),
          porphyry,
        );
        lathe(
          transform(out, 0, [x, 0, z]),
          'metal',
          [
            [6.22, 0.44],
            [6.42, 0.66],
            [6.62, 0.8],
            [6.72, 0.82],
          ],
          iron,
          48,
        );
      }
  }

  function buildGrunewaldTower(out) {
    terrace(out);
    sideStairs(out);
    box(out, 'brick', [-5.25, 4, -5.25], [5.25, 4.35, 5.25], trim);
    for (let side = 0; side < 4; side++) {
      const t = transform(out, (side * Math.PI) / 2);
      facade(
        t,
        'brick',
        10,
        4.35,
        11.5,
        5,
        [
          {
            x: 0,
            w: 4.3,
            y: 4.35,
            spring: 8.1,
            rise: 2.32,
            top: 11.5,
            depth: 1.0,
            pointed: true,
            back: false,
            trim: 0,
          },
        ],
        brick,
      );
      // Interior back face leaves the memorial hall open in all four directions.
      const inside = transform(t, Math.PI, [0, 0, 9]);
      facade(
        inside,
        'brick',
        8,
        4.35,
        11.5,
        5,
        [
          {
            x: 0,
            w: 4.3,
            y: 4.35,
            spring: 8.1,
            rise: 2.32,
            top: 11.5,
            depth: 0.02,
            pointed: true,
            back: false,
            trim: 0,
          },
        ],
        brick,
      );
      for (let k = 0; k < 5; k++) {
        archMolding(t, 0, 8.1, 2.15 + k * 0.13, 2.32 + k * 0.13, 5.06 + k * 0.07, 0.095, 0.12);
        for (const s of [-1, 1])
          box(
            t,
            'brick',
            [s * (2.15 + k * 0.13) - 0.047, 4.35, 5 + k * 0.07],
            [s * (2.15 + k * 0.13) + 0.047, 8.1, 5.14 + k * 0.07],
            trim,
          );
      }
      for (const x of [-4.15, 4.15]) {
        box(t, 'brick', [x - 0.39, 4.35, 4.93], [x + 0.39, 11.58, 5.03], trim);
        facade(
          transform(t, 0, [x, 0, 0]),
          'brick',
          0.78,
          4.35,
          11.58,
          5.45,
          [
            {
              x: 0,
              w: 0.36,
              y: 6.65,
              spring: 8.05,
              rise: 0.38,
              top: 8.8,
              depth: 0.24,
              pointed: true,
              trim: 0.04,
            },
          ],
          brick,
        );
        for (const s of [-1, 1])
          box(
            t,
            'brick',
            [x + s * 0.38 - 0.01, 4.35, 5.02],
            [x + s * 0.38 + 0.01, 11.58, 5.45],
            trim,
          );
        box(t, 'brick', [x - 0.39, 11.56, 5.02], [x + 0.39, 11.58, 5.45], trim);
      }
      rail(t, 8.7, 11.68, 5.38);
      // Recessed upper triplet behind the lower gallery.
      facade(
        t,
        'brick',
        7.2,
        11.7,
        18.05,
        3.6,
        [-0.85, 0, 0.85].map((x) => ({
          x,
          w: 0.52,
          y: 14.7,
          spring: 16.12,
          rise: 0.46,
          top: 16.7,
          depth: 0.3,
          pointed: true,
          trim: 0.06,
        })),
        brick,
      );
      box(t, 'brick', [-1.6, 12.15, 3.63], [1.6, 14.2, 3.65], trim);
      facade(
        t,
        'brick',
        3.2,
        12.15,
        14.35,
        4.22,
        [
          {
            x: 0,
            w: 2.2,
            y: 12.15,
            spring: 13.04,
            rise: 0.75,
            top: 14.35,
            depth: 0.45,
            pointed: true,
            back: true,
            trim: 0.08,
          },
        ],
        brick,
      );
      for (const s of [-1, 1])
        box(t, 'brick', [s * 1.59 - 0.01, 12.15, 3.64], [s * 1.59 + 0.01, 14.35, 4.22], trim);
      box(t, 'brick', [-1.68, 14.35, 3.62], [1.68, 14.56, 4.36], trim);
    }
    band(out, 11.3, 5.24, 0.38);
    box(out, 'brick', [-4.8, 11.45, -4.8], [4.8, 11.68, 4.8], trim);
    memorialVault(out);
    memorialArt(out);
    for (const x of [-4.35, 4.35]) for (const z of [-4.35, 4.35]) turret(out, x, z);
    band(out, 17.78, 3.62, 0.3);
    for (let side = 0; side < 4; side++) {
      const t = transform(out, (side * Math.PI) / 2);
      const tapered = deform(t, ([x, y, z]) => {
        const scale = 1 - ((y - 18.08) / 18) * 0.055;
        return [x * scale, y, z * scale];
      });
      const openings = (
        side % 2 === 0
          ? [{ x: 0, y: 24.2 }]
          : [
              { x: -0.35, y: 29.6 },
              { x: 0.35, y: 29.6 },
              { x: 0, y: 21.3 },
            ]
      ).map((w) => ({
        ...w,
        w: 0.24,
        spring: w.y + 1.05,
        rise: 0.22,
        top: w.y + 1.45,
        depth: 0.5,
        pointed: true,
        trim: 0.025,
      }));
      facade(tapered, 'brick', 7.2, 18.08, 35.45, 3.6, openings, brick);
      if (side === 0 || side === 2) {
        box(t, 'brick', [-3.5, 18.08, 3.55], [3.5, 19.65, 3.74], trim);
        inscription(t, side === 0 ? 'KOENIG WILHELM I' : 'DER KREIS TELTOW', 18.96, 3.77);
        inscription(t, side === 0 ? 'ZUM GEDAECHTNISS' : 'BAUTE MICH 1897', 18.21, 3.77);
      }
      // Published shield field retained for a separately reviewed heraldic relief.
      const shield = [
        [-1.15, 33.92, 3.5],
        [1.15, 33.92, 3.5],
        [0.96, 31.85, 3.5],
        [0, 31.12, 3.5],
        [-0.96, 31.85, 3.5],
      ];
      if (side % 2 === 0)
        for (let i = 1; i < shield.length - 1; i++)
          triangle(t, 'plaster', [shield[0], shield[i + 1], shield[i]], pale);
      if (side % 2 === 0) eagle(t, side === 0 ? iron : [0.54, 0.15, 0.085]);
      for (let i = 0; i < 7; i++) {
        const x = -3.35 + i * 1.12;
        loft(
          transform(t, 0, [x, 0, 0]),
          'brick',
          [
            [34.65, 0.17, 3.25],
            [35.18, 0.25, 3.7],
            [35.73, 0.28, 4.15],
          ].map(([y, w, z]) => [
            [-w, y, z - 0.43],
            [-w, y, z],
            [w, y, z],
            [w, y, z - 0.43],
          ]),
          trim,
        );
      }
    }
    band(out, 35.65, 4.12, 0.35);
    box(out, 'brick', [-4.23, 35.9, -4.23], [4.23, 36.05, 4.23], trim);
    for (let side = 0; side < 4; side++) {
      const t = transform(out, (side * Math.PI) / 2);
      rail(t, 7.8, 36.05, 4.11);
      facade(
        t,
        'brick',
        7.35,
        36.05,
        42.55,
        3.675,
        [
          {
            x: 0,
            w: 5.05,
            y: 36.05,
            spring: 39.25,
            rise: 2.26,
            top: 42.55,
            depth: 0.65,
            pointed: true,
            back: false,
            trim: 0,
          },
        ],
        brick,
      );
      for (let k = 0; k < 3; k++)
        archMolding(t, 0, 39.25, 2.525 + k * 0.12, 2.26 + k * 0.13, 3.74 + k * 0.08, 0.11, 0.18);
      // One corner per face: the four rotations supply four distinct pinnacles.
      {
        const s = 1;
        lathe(
          transform(t, 0, [s * 3.42, 0, 3.42]),
          'brick',
          [
            [36.05, 0.3],
            [36.32, 0.37],
            [41.75, 0.28],
            [42.1, 0.44],
            [42.8, 0.35],
            [44.5, 0.24],
          ],
          trim,
          24,
        );
        masonryCone(t, s * 3.42, 3.42, 44.5, 46, 0.32, 32);
      }
      // Four high ornamental gables, with true recessed blind lancets.
      const gable = transform(t, 0, [0, 0, 3.55]);
      for (let i = 0; i < 3; i++) {
        const x = (i - 1) * 0.82,
          height = i === 1 ? 3.9 : 2.25;
        box(gable, 'plaster', [x - 0.23, 42.88, 0], [x + 0.23, 42.88 + height, 0.05], pale);
        for (const s of [-1, 1])
          beam(
            gable,
            'brick',
            [x + s * 0.3, 42.55, 0.2],
            [x + s * 0.3, 42.88 + height, 0.2],
            0.12,
            0.14,
            trim,
          );
      }
      triangle(
        gable,
        'brick',
        [
          [-3.25, 42.55, -0.04],
          [3.25, 42.55, -0.04],
          [0, 47.6, -0.04],
        ],
        brick,
      );
      const front = [
        [-3.25, 42.55, -0.04],
        [3.25, 42.55, -0.04],
        [0, 47.6, -0.04],
      ];
      const back = front.map(([x, y]) => [x, y, -0.34]);
      triangle(gable, 'brick', back.toReversed(), brick);
      for (let i = 0; i < 3; i++) {
        const j = (i + 1) % 3;
        face(gable, 'brick', [front[i], back[i], back[j], front[j]], brick);
      }
      for (const s of [-1, 1])
        beam(gable, 'brick', [s * 3.3, 42.53, 0.1], [0, 47.7, 0.1], 0.25, 0.3, trim);
      box(gable, 'brick', [-3.55, 42.45, -0.1], [3.55, 42.69, 0.3], trim);
    }
    vault(out, 36.05, 39.25, 42.6, 4.15);
    masonryCone(out, 0, 0, 42.55, 54.72, 3.53, 160);
    tube(out, 'metal', [0, 54.7, 0], [0, 55, 0], 0.032, iron, 12);
  }

  buildGrunewaldTower(out);
  equipment(out);
}
export function buildGrunewaldReviewed(out) {
  detail(out, 'master');
}
export function buildGrunewaldCloseup(out) {
  detail(out, 'closeup');
}
export function buildGrunewaldStreet(out) {
  detail(out, 'street');
}
export function buildGrunewaldDistrict(out) {
  detail(out, 'district');
}
