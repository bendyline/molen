/** Budgeted full exterior; unchanged original restoration recipe remains reproducible. */
import { beam, loft } from './authored-structure-mesh.mjs';
import { deform, facade, face, frame, transform, triangle } from './heritage-tower-detail-mesh.mjs';
import { box } from './structure-mesh.mjs';

function detail(out, mode) {
  const far = mode === 'skyline',
    district = mode === 'district',
    low = far || district;
  const brick = [0.56, 0.29, 0.19],
    wood = [0.18, 0.125, 0.09],
    white = [0.82, 0.8, 0.7],
    iron = [0.29, 0.32, 0.31],
    dark = [0.04, 0.05, 0.045];
  const heading = -0.178170601621,
    street = 4;
  const lean = [(1.46 * Math.sin(heading)) / 15, (-1.46 * Math.cos(heading)) / 15];
  const point = ([x, y, z]) => [
    x + lean[0] * (y - street) + 0.022 * z,
    y,
    z + lean[1] * (y - street),
  ];
  const ring = (x0, x1, z0, z1, y) => [
    [x0, y, z0],
    [x0, y, z1],
    [x1, y, z1],
    [x1, y, z0],
  ];

  function disk(out, slot, x, y, z, r, color, n = 12) {
    for (let i = 0; i < n; i++) {
      if (mode === 'street') n = 4;
      const a = (i / n) * Math.PI * 2,
        b = ((i + 1) / n) * Math.PI * 2;
      triangle(
        out,
        slot,
        [
          [x, y, z],
          [x + r * Math.cos(a), y + r * Math.sin(a), z],
          [x + r * Math.cos(b), y + r * Math.sin(b), z],
        ],
        color,
      );
    }
  }
  function paintedBand(out, width, y, z) {
    if (low) {
      face(
        out,
        'plaster',
        [
          [-width / 2, y, z + 0.03],
          [width / 2, y, z + 0.03],
          [width / 2, y + 0.38, z + 0.03],
          [-width / 2, y + 0.38, z + 0.03],
        ],
        [0.7, 0.65, 0.56],
      );
      return;
    }
    box(
      out,
      'brick',
      [-width / 2, y - 0.03, z - 0.02],
      [width / 2, y + 0.38, z + 0.025],
      [0.63, 0.35, 0.24],
    );
    for (let x = -width / 2 + 0.25; x < width / 2 - 0.15; x += 0.36) {
      for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5])
        disk(
          out,
          'plaster',
          x + 0.067 * Math.cos(a),
          y + 0.17 + 0.067 * Math.sin(a),
          z + 0.03,
          0.073,
          white,
        );
      disk(out, 'brick', x, y + 0.17, z + 0.035, 0.047, [0.63, 0.35, 0.24], 10);
    }
    for (const yy of [y - 0.04, y + 0.38])
      box(out, 'brick', [-width / 2, yy, z], [width / 2, yy + 0.052, z + 0.09], [0.62, 0.35, 0.24]);
  }
  function reliefBand(out, width, y, z) {
    if (low) {
      face(
        out,
        'shadow',
        [
          [-width / 2, y, z + 0.002],
          [width / 2, y, z + 0.002],
          [width / 2, y + 0.55, z + 0.002],
          [-width / 2, y + 0.55, z + 0.002],
        ],
        dark,
      );
      if (district)
        for (let x = -width / 2 + 0.23; x < width / 2 - 0.16; x += 0.47) {
          const points = [];
          for (let i = 0; i < 8; i++) {
            const a = (i * Math.PI) / 4,
              r = i % 2 ? 0.15 : 0.275;
            points.push([x + r * Math.cos(a), y + 0.27 + r * Math.sin(a), z + 0.01]);
          }
          out.addConvexPolygon(
            'brick',
            'palette:#ffffff',
            points,
            [0, 0, 1],
            (p) => [p[0], p[1]],
            [0.64, 0.35, 0.235],
          );
        }
      return;
    }
    const segments = mode === 'street' ? 6 : 32;
    box(out, 'shadow', [-width / 2, y, z - 0.035], [width / 2, y + 0.55, z], dark);
    for (let x = -width / 2 + 0.23; x < width / 2 - 0.16; x += 0.47) {
      // Four curled lobes form the visible openwork Gothic frieze.
      const paths = [];
      for (let i = 0; i <= segments; i++) {
        const a = (i / segments) * Math.PI * 2,
          r = 0.215 + 0.061 * Math.cos(a * 4);
        paths.push([x + r * Math.cos(a), y + 0.27 + r * Math.sin(a), z + 0.045]);
      }
      for (let i = 1; i < paths.length; i++)
        beam(out, 'brick', paths[i - 1], paths[i], 0.066, 0.065, [0.64, 0.35, 0.235]);
    }
    for (const yy of [y - 0.1, y + 0.54])
      box(
        out,
        'brick',
        [-width / 2, yy, z - 0.03],
        [width / 2, yy + 0.1, z + 0.11],
        [0.64, 0.34, 0.23],
      );
  }
  function wall(out, width, z, slits, side = false) {
    const holes = [];
    for (const y of [5.1, 8.2, 11.35, 14.45])
      for (const x of side ? [-2.0, 1.85] : [-3.0, 0, 3.0])
        holes.push({
          x,
          y,
          w: 0.12,
          spring: y + 0.54,
          rise: 0,
          top: y + 0.54,
          depth: 0.26,
          trim: 0,
        });
    for (const x of side ? [-2.3, 0, 2.3] : [-3.3, -1.1, 1.1, 3.3])
      holes.push({
        x,
        y: 17.65,
        w: 0.43,
        spring: 18.32,
        rise: 0.17,
        top: 18.5,
        depth: 0.36,
        trim: 0,
      });
    holes.push(...slits);
    if (far) {
      face(
        out,
        'brick',
        [
          [-width / 2, 0, z],
          [width / 2, 0, z],
          [width / 2, 19, z],
          [-width / 2, 19, z],
        ],
        brick,
      );
      for (const w of holes)
        face(
          out,
          'shadow',
          [
            [w.x - w.w / 2, w.y, z + 0.005],
            [w.x + w.w / 2, w.y, z + 0.005],
            [w.x + w.w / 2, w.top, z + 0.005],
            [w.x - w.w / 2, w.top, z + 0.005],
          ],
          dark,
        );
    } else budgetFacade(out, 'brick', width, 0, 19, z, holes, brick);
    // Both faces of the parapet are visible above the sloping shed roof.
    // The dark aperture backing belongs inside a masonry thickness, not in air.
    budgetFacade(
      transform(out, Math.PI),
      'brick',
      width,
      low ? 15.55 : 0,
      19,
      -z + 0.42,
      holes.map((w) => ({ ...w, x: -w.x, back: false, depth: 0.08 })),
      [0.53, 0.3, 0.21],
    );
    box(out, 'brick', [-width / 2, 18.93, z - 0.42], [width / 2, 19, z], brick);
    for (const w of holes) {
      // Each narrow slit has an actual dark reveal; upper apertures retain their arch.
      if (!low && w.w < 0.2)
        box(
          out,
          'brick',
          [w.x - w.w / 2 - 0.035, w.y - 0.04, z - 0.01],
          [w.x + w.w / 2 + 0.035, w.y, z + 0.035],
          [0.42, 0.23, 0.17],
        );
    }
    for (const y of [9.1, 12.35]) paintedBand(out, width, y, z + 0.015);
    box(out, 'plaster', [-width / 2, 6.45, z], [width / 2, 6.7, z + 0.055], [0.77, 0.76, 0.66]);
    reliefBand(out, width - 0.35, 16.72, z + 0.045);
    box(
      out,
      'metal',
      [-width / 2 - 0.06, 18.96, z - 0.16],
      [width / 2 + 0.06, 19.015, z + 0.055],
      iron,
    );
    // Broad restoration patches and occasional dark fired-brick headers are
    // encoded in vertex tints; metric masonry remains supplied by the shared graph.
    if (!low && mode !== 'street')
      for (let row = 0; row < 53; row++)
        for (let col = 0; col < Math.floor(width / 0.58); col++) {
          if ((row * 17 + col * 31) % 17 > 3) continue;
          const x = -width / 2 + 0.23 + col * 0.58 + (row % 2) * 0.14,
            y = 0.2 + row * 0.35;
          if (
            y > 16.5 ||
            holes.some(
              (w) => Math.abs(x - w.x) < w.w / 2 + 0.22 && y > w.y - 0.2 && y < w.top + 0.2,
            ) ||
            [6.5, 9.2, 12.5].some((a) => Math.abs(y - a) < 0.4)
          )
            continue;
          face(
            out,
            'brick',
            [
              [x - 0.13, y, z + 0.002],
              [x + 0.13, y, z + 0.002],
              [x + 0.13, y + 0.105, z + 0.002],
              [x - 0.13, y + 0.105, z + 0.002],
            ],
            [0.43, 0.27, 0.215],
          );
        }
  }
  function glazed(out, x, y, w, h, z) {
    box(out, 'glass', [x - w / 2, y, z - 0.075], [x + w / 2, y + h, z - 0.048], [0.19, 0.28, 0.29]);
    frame(out, 'wood', x, y, w, h, z, 0.08, wood);
    for (const u of [x - w / 6, x + w / 6])
      box(out, 'wood', [u - 0.015, y, z], [u + 0.015, y + h, z + 0.035], wood);
    for (const v of [y + h / 3, y + (2 * h) / 3])
      box(out, 'wood', [x - w / 2, v - 0.017, z], [x + w / 2, v + 0.017, z + 0.035], wood);
  }
  function timberNorth(out) {
    if (low) {
      timberLow(out);
      return;
    }
    const f = transform(out, Math.PI),
      width = 7.1;
    // This basement is below the raised northern street in situ. Retain its
    // closure when inspected in isolation or against low-resolution terrain.
    box(f, 'brick', [-5, 0, 3.7], [5, 4, 4.08], brick);
    for (const [y0, y1, z, upper] of [
      [4, 9.58, 4.08, false],
      [9.58, 12.69, 4.33, true],
      [12.69, 15.62, 4.56, true],
    ]) {
      box(f, 'plaster', [-width / 2, y0, -0.1 + z], [width / 2, y1, z], white);
      const posts = upper
        ? [-3.5, -2.5, -1.45, 0, 1.45, 2.5, 3.5]
        : [-3.5, -2.35, -1.18, 0, 1.18, 2.35, 3.5];
      for (const x of posts) box(f, 'wood', [x - 0.105, y0, z], [x + 0.105, y1, z + 0.15], wood);
      for (const y of upper ? [y0 + 0.13, y0 + 0.86, y1 - 0.76, y1 - 0.1] : [4.1, 6.55, 7.13, 9.47])
        box(f, 'wood', [-width / 2, y - 0.095, z], [width / 2, y + 0.095, z + 0.15], wood);
      box(
        f,
        'wood',
        [-width / 2 - 0.12, y0 - 0.1, z - 0.06],
        [width / 2 + 0.12, y0 + 0.11, z + 0.4],
        wood,
      );
      for (let x = -3.2; x < 3.3; x += 0.64)
        box(f, 'wood', [x - 0.11, y0 - 0.25, z - 0.05], [x + 0.11, y0 - 0.1, z + 0.45], wood);
      if (upper) {
        for (const x of [-1.55, 1.55]) glazed(f, x, y0 + 0.94, 0.86, 1.12, z + 0.17);
      } else {
        for (const x of [-2.93, -1.77, -0.59, 0.59, 1.77, 2.93])
          glazed(f, x, 7.18, 0.64, 1.36, z + 0.17);
        // Double timber entry and the lower flanking windows visible from the street.
        box(f, 'wood', [-1.08, 4, z + 0.16], [1.08, 6.45, z + 0.24], [0.23, 0.15, 0.095]);
        for (const x of [-0.72, -0.25, 0.25, 0.72]) {
          box(f, 'wood', [x - 0.17, 4.3, z + 0.24], [x + 0.17, 5.2, z + 0.275], [0.29, 0.2, 0.13]);
          box(
            f,
            'wood',
            [x - 0.17, 5.48, z + 0.24],
            [x + 0.17, 6.16, z + 0.275],
            [0.29, 0.2, 0.13],
          );
        }
        for (const x of [-2.83, 2.83]) glazed(f, x, 5.13, 0.53, 0.97, z + 0.17);
        box(f, 'metal', [-0.028, 4.3, z + 0.28], [0.028, 6.4, z + 0.31], iron);
      }
    }
    // Narrow brick returns close the side walls around the open-backed historic tower.
    for (const x of [-4.05, 4.05])
      box(f, 'brick', [x - 0.78, 4, 3.93], [x + 0.78, 15.78, 4.1], brick);
    box(f, 'metal', [-3.83, 15.6, 4.3], [3.83, 15.77, 4.94], iron);
    beam(f, 'metal', [3.78, 15.62, 4.85], [3.78, 15.05, 4.84], 0.105, 0.105, iron);
    beam(f, 'metal', [3.78, 15.05, 4.84], [3.9, 14.8, 4.7], 0.105, 0.105, iron);
    beam(f, 'metal', [3.9, 14.8, 4.7], [3.9, 4.1, 4.7], 0.105, 0.105, iron);
  }
  function buildTorun(out) {
    const t = deform(out, point);
    wall(t, 10, 4.09, []);
    wall(
      transform(t, Math.PI / 2),
      8.18,
      5,
      [{ x: 2.45, y: 6.8, w: 0.87, spring: 8.75, rise: 0.2, top: 8.95, depth: 0.4, trim: 0.055 }],
      true,
    );
    wall(
      transform(t, -Math.PI / 2),
      8.18,
      5,
      [{ x: -2.6, y: 6.8, w: 0.8, spring: 8.58, rise: 0.2, top: 8.78, depth: 0.4, trim: 0.045 }],
      true,
    );
    timberNorth(t);
    // Lead/zinc shed roof drains toward the timber north facade, behind three parapets.
    const roofY = (z) => 15.72 + ((z + 4.3) / 8.12) * 2.95;
    face(
      t,
      'metal',
      [
        [-4.8, roofY(-4.3), -4.3],
        [-4.8, roofY(3.82), 3.82],
        [4.8, roofY(3.82), 3.82],
        [4.8, roofY(-4.3), -4.3],
      ],
      [0.56, 0.6, 0.59],
    );
    if (!low)
      for (let x = -4.67; x < 4.8; x += 0.58)
        beam(
          t,
          'metal',
          [x, roofY(-4.3) + 0.024, -4.3],
          [x, roofY(3.82) + 0.024, 3.82],
          0.023,
          0.03,
          [0.39, 0.43, 0.42],
        );
    box(t, 'brick', [-4.7, 18.25, 2.9], [-3.95, 19.55, 3.6], brick);
    box(t, 'metal', [-4.76, 19.53, 2.84], [-3.89, 19.6, 3.66], iron);
    // Two deep masonry buttresses support the south face at the slope.
    for (const x of [-3.62, 3.62])
      loft(
        t,
        'brick',
        [
          ring(x - 0.72, x + 0.72, 4.02, 6.94, 0),
          ring(x - 0.61, x + 0.61, 4.03, 6.55, 1.0),
          ring(x - 0.46, x + 0.46, 4.04, 4.3, 5.35),
        ],
        brick,
      );
    // West quarter-round garderobe, documented in the heritage register and photos.
    const latrine = transform(t, -Math.PI / 2, [-5, 0, -1.9]);
    const lr = [];
    for (let i = 0; i <= (low ? 4 : 24); i++) {
      const a = ((i / (low ? 4 : 24)) * Math.PI) / 2;
      lr.push([Math.sin(a) * 1.22, 6.3, Math.cos(a) * 1.22]);
    }
    lr.push([0, 6.3, 0]);
    if (
      lr.reduce(
        (s, p, i) => s + p[0] * lr[(i + 1) % lr.length][2] - lr[(i + 1) % lr.length][0] * p[2],
        0,
      ) > 0
    )
      lr.reverse();
    loft(latrine, 'brick', [lr, lr.map(([x, _y, z]) => [x, 8.73, z])], brick);
    for (let i = 0; i < (low ? 4 : 24); i++) {
      const a = ((i / 24) * Math.PI) / 2,
        b = (((i + 1) / (low ? 4 : 24)) * Math.PI) / 2;
      face(
        latrine,
        'brick',
        [
          [Math.sin(a) * 1.26, 8.74, Math.cos(a) * 1.26],
          [Math.sin(b) * 1.26, 8.74, Math.cos(b) * 1.26],
          [Math.sin(b) * 0.25, 9.45, Math.cos(b) * 0.25],
          [Math.sin(a) * 0.25, 9.45, Math.cos(a) * 0.25],
        ],
        [0.6, 0.32, 0.22],
      );
    }
    // East access: 83 cm wide wooden treads and a tile-roofed first-floor landing.
    const landing = [5.78, 6.8, -2.6],
      lx = point(landing)[0],
      lz = point(landing)[2];
    box(out, 'wood', [lx - 0.63, 6.67, lz - 0.73], [lx + 0.63, 6.8, lz + 0.73], wood);
    const stairStart = [lx + 4.03, 4.05, lz],
      stairEnd = [lx + 0.48, 6.8, lz];
    for (const z of [lz - 0.52, lz + 0.52]) {
      beam(out, 'wood', [stairStart[0], 4.02, z], [stairEnd[0], 6.73, z], 0.13, 0.24, wood);
      beam(out, 'wood', [stairStart[0], 5.02, z], [stairEnd[0], 7.82, z], 0.11, 0.11, wood);
      if (!far)
        for (let i = 0; i <= 4; i++) {
          const f = i / 4,
            x = stairStart[0] + (stairEnd[0] - stairStart[0]) * f,
            y = 4.05 + 2.75 * f;
          beam(out, 'wood', [x, y, z], [x, y + 1.02, z], 0.09, 0.09, wood);
        }
    }
    if (far)
      loft(
        out,
        'wood',
        [
          ring(stairEnd[0] - 0.1, stairEnd[0] + 0.1, lz - 0.415, lz + 0.415, 6.8),
          ring(stairStart[0] - 0.1, stairStart[0] + 0.1, lz - 0.415, lz + 0.415, 4.05),
        ],
        wood,
      );
    else
      for (let i = 0; i < 16; i++) {
        const f = i / 16,
          x = stairStart[0] + (stairEnd[0] - stairStart[0]) * f,
          y = 4.05 + 2.75 * f;
        box(
          out,
          'wood',
          [x - 0.2, y - 0.045, lz - 0.415],
          [x + 0.035, y, lz + 0.415],
          [0.28, 0.235, 0.175],
        );
      }
    for (const z of [lz - 0.6, lz + 0.6]) {
      beam(out, 'wood', [lx + 0.58, 6.8, z], [lx + 0.58, 8.95, z], 0.14, 0.14, wood);
      beam(out, 'wood', [lx - 0.6, 6.8, z], [lx - 0.6, 8.95, z], 0.14, 0.14, wood);
      beam(out, 'wood', [lx - 0.58, 7.85, z], [lx + 0.56, 7.85, z], 0.11, 0.11, wood);
    }
    for (const s of [-1, 1]) {
      const panel = [
        [lx - 0.88, 9.39, lz],
        [lx + 0.86, 9.39, lz],
        [lx + 0.86, 8.9, lz + s * 0.99],
        [lx - 0.88, 8.9, lz + s * 0.99],
      ];
      face(out, 'brickroof', s > 0 ? panel.reverse() : panel, [0.39, 0.28, 0.2]);
      if (!low)
        for (let i = 0; i < 8; i++) {
          const x = lx - 0.83 + i * 0.23;
          beam(
            out,
            'brickroof',
            [x, 9.415, lz],
            [x, 8.925, lz + s * 0.99],
            0.025,
            0.025,
            [0.48, 0.32, 0.22],
          );
        }
    }
    for (const [i, x] of [lx - 0.86, lx + 0.84].entries()) {
      const p = [
        [x, 8.9, lz - 0.95],
        [x, 9.39, lz],
        [x, 8.9, lz + 0.95],
      ];
      triangle(out, 'wood', i === 0 ? p.reverse() : p, wood);
    }
    // Short attached gallery includes its measured bend. The extended city wall
    // remains a separate mapped feature beyond the terminal return.
    const path = [
      [-5.3, 6.8, -2.95],
      [-9.4, 6.8, -3.02],
      [-15.1, 6.8, -10.65],
    ];
    for (let j = 1; j < path.length; j++) {
      const a = path[j - 1],
        b = path[j],
        dx = b[0] - a[0],
        dz = b[2] - a[2],
        length = Math.hypot(dx, dz),
        nx = -dz / length,
        nz = dx / length;
      const edges = (p, s, y) => [p[0] + s * nx, y, p[2] + s * nz];
      // Timber walkway has independent floor boards, supports, two rail courses.
      const count = low
        ? 1
        : mode === 'street'
          ? Math.ceil(length / 0.54)
          : Math.ceil(length / 0.18);
      for (let i = 0; i < count; i++) {
        const f = (i + 0.5) / count,
          p = [a[0] + dx * f, 6.8, a[2] + dz * f];
        beam(
          out,
          'wood',
          edges(p, -0.9, 6.75),
          edges(p, 0.9, 6.75),
          (length / count) * 0.96,
          0.1,
          [0.29, 0.2, 0.13],
        );
      }
      for (const side of [-0.89, 0.89])
        for (const y of [7.3, 7.83])
          beam(out, 'wood', edges(a, side, y), edges(b, side, y), 0.13, 0.15, wood);
      const supports = Math.ceil(length / (far ? length : district ? 3 : 1.3));
      for (let i = 0; i <= supports; i++) {
        const f = i / supports,
          p = [a[0] + dx * f, 0, a[2] + dz * f];
        for (const s of [-0.89, 0.89])
          beam(out, 'wood', edges(p, s, 6.55), edges(p, s, 7.95), 0.14, 0.16, wood);
        beam(out, 'wood', edges(p, -1.02, 6.6), edges(p, 1.02, 6.6), 0.18, 0.18, wood);
        if (!far) beam(out, 'wood', edges(p, 0.95, 6.55), edges(p, -0.93, 5.0), 0.16, 0.16, wood);
      }
      // Masonry bearing wall lies behind the gallery, with a flat coping.
      const f = transform(out, Math.atan2(dx, dz), [(a[0] + b[0]) / 2, 0, (a[2] + b[2]) / 2]);
      box(f, 'brick', [0.98, 0, -length / 2], [1.35, 7.55, length / 2], brick);
      box(f, 'brick', [0.94, 7.55, -length / 2], [1.39, 7.68, length / 2], [0.48, 0.27, 0.2]);
    }
  }

  const archY = (x, r, rise, pointed) =>
    rise * (pointed ? 1 - Math.abs(x) / r : Math.sqrt(Math.max(0, 1 - (x / r) ** 2)));
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
      n = rise === 0 ? 1 : district ? 4 : mode === 'street' ? 8 : 32;
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
  function reducedFacade(out, slot, width, y0, y1, z, windows, color = stone) {
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
    for (const w of windows.filter((w) => w.top > y0 && w.y < y1))
      archBay(out, slot, w.x, w.w, w.y, w.spring, w.rise, w.top, z, w.depth ?? 0.45, color, w);
  }
  function budgetFacade(out, slot, width, y0, y1, z, windows, color) {
    if (far) {
      face(
        out,
        slot,
        [
          [-width / 2, y0, z],
          [width / 2, y0, z],
          [width / 2, y1, z],
          [-width / 2, y1, z],
        ],
        color,
      );
      return;
    }
    if (!low && mode !== 'street') {
      facade(out, slot, width, y0, y1, z, windows, color);
      return;
    }
    const selected = windows.filter((w) => w.top > y0 && w.y < y1);
    reducedFacade(out, slot, width, y0, y1, z, selected, color);
  }
  function timberLow(out) {
    const f = transform(out, Math.PI),
      width = 7.1;
    box(f, 'brick', [-5, 0, 3.7], [5, 4, 4.08], brick);
    for (const [y0, y1, z, upper] of [
      [4, 9.58, 4.08, false],
      [9.58, 12.69, 4.33, true],
      [12.69, 15.62, 4.56, true],
    ]) {
      box(f, 'plaster', [-width / 2, y0, z - 0.1], [width / 2, y1, z], white);
      for (const x of [-3.5, -2.35, -1.18, 0, 1.18, 2.35, 3.5])
        face(
          f,
          'wood',
          [
            [x - 0.1, y0, z + 0.003],
            [x + 0.1, y0, z + 0.003],
            [x + 0.1, y1, z + 0.003],
            [x - 0.1, y1, z + 0.003],
          ],
          wood,
        );
      for (const y of upper ? [y0 + 0.13, y0 + 0.86, y1 - 0.76, y1 - 0.1] : [4.1, 6.55, 7.13, 9.47])
        face(
          f,
          'wood',
          [
            [-width / 2, y - 0.095, z + 0.006],
            [width / 2, y - 0.095, z + 0.006],
            [width / 2, y + 0.095, z + 0.006],
            [-width / 2, y + 0.095, z + 0.006],
          ],
          wood,
        );
      box(
        f,
        'wood',
        [-width / 2 - 0.12, y0 - 0.1, z - 0.06],
        [width / 2 + 0.12, y0 + 0.11, z + 0.4],
        wood,
      );
      const holes = upper
        ? [
            [-1.55, y0 + 0.94, 0.86, 1.12],
            [1.55, y0 + 0.94, 0.86, 1.12],
          ]
        : [
            ...[-2.93, -1.77, -0.59, 0.59, 1.77, 2.93].map((x) => [x, 7.18, 0.64, 1.36]),
            [-2.83, 5.13, 0.53, 0.97],
            [2.83, 5.13, 0.53, 0.97],
            [0, 4, 2.16, 2.45],
          ];
      for (const [x, y, w, h] of holes) {
        face(
          f,
          x === 0 && !upper ? 'wood' : 'glass',
          [
            [x - w / 2, y, z + 0.011],
            [x + w / 2, y, z + 0.011],
            [x + w / 2, y + h, z + 0.011],
            [x - w / 2, y + h, z + 0.011],
          ],
          x === 0 && !upper ? [0.23, 0.15, 0.095] : [0.19, 0.28, 0.29],
        );
      }
    }
    for (const x of [-4.05, 4.05])
      box(f, 'brick', [x - 0.78, 4, 3.93], [x + 0.78, 15.78, 4.1], brick);
    box(f, 'metal', [-3.83, 15.6, 4.3], [3.83, 15.77, 4.94], iron);
    if (district) beam(f, 'metal', [3.9, 15.6, 4.7], [3.9, 4.1, 4.7], 0.105, 0.105, iron);
  }
  buildTorun(out);
}

export function buildTorunReviewed(out) {
  detail(out, 'master');
}
export function buildTorunCloseup(out) {
  detail(out, 'closeup');
}
export function buildTorunStreet(out) {
  detail(out, 'street');
}
export function buildTorunDistrict(out) {
  detail(out, 'district');
}
const means = {
  brick: [0.620345, 0.549823, 0.504963],
  brickroof: [0.620345, 0.549823, 0.504963],
  wood: [0.825128, 0.825128, 0.825128],
  plaster: [0.856015, 0.827728, 0.727643],
  metal: [0.908889, 0.908889, 0.908889],
  glass: [1, 1, 1],
  shadow: [1, 1, 1],
};
export function buildTorunSkyline(destination) {
  detail(
    {
      addQuad: (s, _r, p, n, u, c) =>
        destination.addQuad(
          'body',
          'palette:#ffffff',
          p,
          n,
          u,
          c.map((v, i) => v * means[s][i]),
        ),
      addTriangle: (s, _r, p, n, u, c) =>
        destination.addTriangle(
          'body',
          'palette:#ffffff',
          p,
          n,
          u,
          c.map((v, i) => v * means[s][i]),
        ),
      addConvexPolygon: (s, _r, p, n, u, c) =>
        destination.addConvexPolygon(
          'body',
          'palette:#ffffff',
          p,
          n,
          u,
          c.map((v, i) => v * means[s][i]),
        ),
    },
    'skyline',
  );
}
export const torunLean = [
  (1.46 * Math.sin(-0.178170601621)) / 15,
  (-1.46 * Math.cos(-0.178170601621)) / 15,
];
