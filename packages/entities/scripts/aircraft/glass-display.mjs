/** Original vector-like glass-cockpit symbology. Layout is supplied by each aircraft.
 * These diagrammatic displays do not simulate certified avionics or use vendor imagery.
 */
import { mat } from './mesh-kit.mjs';
export function glassDisplay(d, x, y, z, w, h, kind) {
  const black = mat('avionics-black', '#142025'),
    blue = mat('avionics-sky', '#3486ad'),
    earth = mat('avionics-earth', '#827147'),
    green = mat('avionics-terrain', '#507254'),
    river = mat('avionics-water', '#2a6c93'),
    pink = mat('avionics-route', '#bd629b');
  d.box([w + 0.045, h + 0.055, 0.027], [x, y, z + 0.008], d.dark);
  d.box([w, h, 0.006], [x, y, z - 0.009], black);
  const zz = z - 0.016,
    p = (u, v, layer = 0.008) => [x - u * w, y + v * h, zz - layer],
    rect = (u, v, a, b, m, layer = 0.006) => d.box([a * w, b * h, 0.002], p(u, v, layer), m);
  if (kind === 'attitude') {
    rect(-0.035, 0.185, 0.65, 0.5, blue, 0);
    rect(-0.035, -0.08, 0.65, 0.25, earth, 0);
    for (let i = 0; i < 5; i++)
      rect(-0.035, (i - 2) * 0.055 + 0.13, i % 2 === 0 ? 0.19 : 0.1, 0.006, d.ivory);
    for (const u of [-0.425, 0.345]) {
      rect(u, 0.1, 0.11, 0.68, black, 0.003);
      for (let i = 0; i < 9; i++) rect(u + 0.02, (i - 4) * 0.07 + 0.11, 0.06, 0.005, d.ivory);
    }
    for (const [u, label] of [
      [-0.425, '100'],
      [0.345, '1200'],
    ])
      d.text(label, p(u, 0.1), h * 0.055, Math.PI, d.ivory, 'display');
    const c = p(-0.035, -0.29),
      r = h * 0.17;
    d.ring(r, 0.0015, c, d.ivory);
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      d.rod(
        [c[0] + Math.cos(a) * r * 0.82, c[1] + Math.sin(a) * r * 0.82, c[2]],
        [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, c[2]],
        0.0009,
        d.ivory,
      );
    }
    d.rod([c[0], c[1] - r * 0.7, c[2] - 0.002], [c[0], c[1] + r * 0.8, c[2] - 0.002], 0.0012, pink);
    rect(0.46, 0.0, 0.045, 0.62, black, 0.003);
    for (let i = 0; i < 4; i++) rect(0.46, 0.22 - i * 0.12, 0.026, 0.08, d.green);
  } else {
    rect(0.05, 0, 0.86, 0.92, green, 0);
    for (const points of [
      [
        [-0.29, -0.45],
        [-0.18, -0.1],
        [-0.03, 0.06],
        [0.07, 0.45],
      ],
      [
        [0.07, -0.45],
        [0.22, -0.2],
        [0.33, 0.04],
        [0.48, 0.2],
      ],
    ])
      d.path(
        points.map((q) => p(...q)),
        0.0024,
        river,
      );
    for (const points of [
      [
        [-0.35, -0.18],
        [0.12, 0.12],
        [0.48, 0.24],
      ],
      [
        [-0.2, 0.45],
        [0.0, 0.12],
        [0.29, -0.45],
      ],
    ])
      d.path(
        points.map((q) => p(...q)),
        0.0012,
        d.ivory,
      );
    for (const points of [
      [
        [-0.2, -0.4],
        [0.05, 0.02],
        [0.32, 0.36],
      ],
    ])
      d.path(
        points.map((q) => p(...q)),
        0.0018,
        pink,
      );
    rect(-0.425, 0, 0.13, 0.92, black, 0.003);
    for (let i = 0; i < 4; i++) {
      rect(-0.425, 0.31 - i * 0.21, 0.032, 0.15, d.green);
      d.text(
        String(80 - i * 8),
        p(-0.425, 0.22 - i * 0.21),
        h * 0.045,
        Math.PI,
        d.ivory,
        'display',
      );
    }
    d.rod(p(-0.02, -0.02), p(0.08, 0.0), 0.0016, d.ivory);
    d.rod(p(0.03, -0.06), p(0.03, 0.07), 0.0016, d.ivory);
  }
  d.text(
    kind === 'attitude' ? 'HDG 000' : 'NAV',
    p(0, 0.46),
    h * 0.045,
    Math.PI,
    d.ivory,
    'display',
  );
}
