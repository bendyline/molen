/** Exact Lindesnes master plus independently reviewed exterior/browser derivatives. */
import { beam, loft, normalFor, sphere as originalSphere } from './authored-structure-mesh.mjs';
import {
  hipRoof,
  facadeBlock as originalFacadeBlock,
  ring as originalRing,
  shell as originalShell,
} from './lighthouse-expansion-models.mjs';
import { lathe as originalLathe, panel, transformed } from './lighthouse-models.mjs';
import { box, tube as originalTube, quad } from './structure-mesh.mjs';

const white = [0.87, 0.86, 0.8],
  black = [0.085, 0.105, 0.11],
  red = [0.64, 0.11, 0.07],
  p = (r, y, a) => [Math.sin(a) * r, y, Math.cos(a) * r];
function buildLindesnesDetail(out, mode = 'master') {
  const n = (high, near, middle) =>
    mode === 'master' || mode === 'reviewed' ? high : mode === 'street' ? near : middle;
  const facadeBlock = (o, opt) =>
    originalFacadeBlock(o, {
      ...opt,
      windows: (opt.windows ?? []).map((h) => ({ ...h, trim: mode === 'district' ? 0 : h.trim })),
    });
  const lathe = (o, s, p, c, count, center) => originalLathe(o, s, p, c, n(count, 32, 8), center);
  const ring = (o, s, y, a, b, h, c, count) => originalRing(o, s, y, a, b, h, c, n(count, 24, 8));
  const tube = (o, s, a, b, r, c, count = 8) => originalTube(o, s, a, b, r, c, count===64&&r>.5?n(count,16,8):n(count,4,3));
  const sphere = (o, s, p, r, c, count, rows) =>
    originalSphere(o, s, p, r, c, n(count, 12, r[0]===.37?8:6), n(rows, 6, r[0]===.37?4:3));
  const shell = (o, opt) =>
    originalShell(o, {
      ...opt,
      segments: n(opt.segments, 64, 16),
      holes: opt.holes.map((h) => ({ ...h, grid: mode === 'district' ? false : h.grid })),
    });
  function railRing(out, y, r, height, color = dark, segments = 32) {
    segments = n(segments, 24, 8);
    if (mode !== 'master' && mode !== 'reviewed' && height < 0.05) {
      for (let i = 0; i < segments; i++) {
        const a = (i * Math.PI * 2) / segments,
          b = ((i + 1) * Math.PI * 2) / segments;
        tube(
          out,
          'metal',
          [Math.cos(a) * r, y, Math.sin(a) * r],
          [Math.cos(b) * r, y, Math.sin(b) * r],
          0.025,
          color,
          8,
        );
      }
      return;
    }
    for (const yy of [y + height * 0.48, y + height])
      for (let i = 0; i < segments; i++) {
        const a = (i * Math.PI * 2) / segments,
          b = ((i + 1) * Math.PI * 2) / segments;
        tube(
          out,
          'metal',
          [Math.cos(a) * r, yy, Math.sin(a) * r],
          [Math.cos(b) * r, yy, Math.sin(b) * r],
          0.025,
          color,
          8,
        );
      }
    for (let i = 0; i < segments; i++) {
      const a = (i * Math.PI * 2) / segments;
      tube(
        out,
        'metal',
        [Math.cos(a) * r, y, Math.sin(a) * r],
        [Math.cos(a) * r, y + height, Math.sin(a) * r],
        0.029,
        color,
        8,
      );
    }
  }

  function lanternGlass(out, y0, y1, r, frame, count = 16, diagonal = false) {
    const segments = n(count, 16, 8);
    for (let i = 0; i < segments; i++) {
      const a = (i * Math.PI * 2) / segments,
        b = ((i + 1) * Math.PI * 2) / segments,
        ps = [p(r, y0, a), p(r, y0, b), p(r, y1, b), p(r, y1, a)];
      quad(out, 'glass', ps, normalFor(...ps.slice(0, 3)), [0.23, 0.32, 0.34]);
      tube(out, 'metal', ps[0], ps[3], 0.027, frame, 8);
      if (diagonal) {
        const m = p(r, (y0 + y1) / 2, (a + b) / 2);
        tube(out, 'metal', ps[0], m, 0.023, frame, 8);
        tube(out, 'metal', m, ps[2], 0.023, frame, 8);
        tube(out, 'metal', ps[1], m, 0.023, frame, 8);
        tube(out, 'metal', m, ps[3], 0.023, frame, 8);
      }
    }
    for (const y of [y0, (y0 + y1) / 2, y1])
      ring(out, 'metal', y, r - 0.04, r + 0.04, 0.06, frame, 96);
  }
  function steps(
    out,
    { count = 7, height = 1.4, run = 2.8, z = 3, width = 1.8, color = white, rail = red },
  ) {
    for (let i = 0; i < count; i++)
      box(
        out,
        'concrete',
        [-width / 2, 0, z + (i * run) / count],
        [width / 2, height * (1 - i / count), z + ((i + 1) * run) / count],
        color,
      );
    for (const x of [-width / 2 - 0.08, width / 2 + 0.08]) {
      tube(out, 'metal', [x, height + 0.9, z], [x, 0.9, z + run], 0.027, rail, 8);
      for (let i = 0; i <= count; i += Math.ceil(count / 3))
        tube(
          out,
          'metal',
          [x, height * (1 - i / count), z + (i * run) / count],
          [x, height * (1 - i / count) + 0.9, z + (i * run) / count],
          0.03,
          rail,
          8,
        );
    }
  }
  function gable(out, rx, rz, y, rise, wall = white) {
    for (const s of [-1, 1]) {
      const ps =
        s > 0
          ? [
              [-rx, y, rz],
              [rx, y, rz],
              [rx, y + rise, 0],
              [-rx, y + rise, 0],
            ]
          : [
              [rx, y, -rz],
              [-rx, y, -rz],
              [-rx, y + rise, 0],
              [rx, y + rise, 0],
            ];
      quad(out, 'slate', ps, normalFor(...ps.slice(0, 3)), [0.13, 0.17, 0.2]);
      const points =
        s > 0
          ? [
              [rx, y, rz],
              [rx, y, -rz],
              [rx, y + rise, 0],
            ]
          : [
              [-rx, y, -rz],
              [-rx, y, rz],
              [-rx, y + rise, 0],
            ];
      out.addTriangle(
        'lap',
        'palette:#fff',
        points,
        normalFor(...points),
        points.map((q) => [q[2], q[1]]),
        wall,
      );
      for (const z of [-rz, rz])
        beam(out, 'wood', [s * rx, y, z], [s * rx, y + rise, 0], 0.13, 0.16, wall);
    }
  }

  function build(out) {
    const iron = [0.72, 0.09, 0.065],
      whiteMetal = [0.9, 0.89, 0.83];
    lathe(
      out,
      'concrete',
      [
        [0, 3.14],
        [0.92, 3.14],
        [1.05, 2.94],
      ],
      white,
      128,
    );
    lathe(
      out,
      'metal',
      [
        [1.03, 2.94],
        [1.15, 2.84],
        [1.24, 2.7],
      ],
      whiteMetal,
      128,
    );
    const profile = [
      [1.24, 2.7],
      [8.53, 2.1],
    ];
    shell(out, {
      profile,
      slot: 'metal',
      color: whiteMetal,
      segments: 160,
      holes: [
        {
          angle: 0,
          y: 1.45,
          w: 0.96,
          h: 2.02,
          depth: 0.16,
          trimSlot: 'metal',
          trimColor: whiteMetal,
          pediment: true,
        },
        ...[Math.PI / 2, Math.PI, -Math.PI / 2].flatMap((a) => [
          {
            angle: a,
            y: 4.2,
            w: 0.46,
            h: 0.88,
            depth: 0.12,
            trimSlot: 'metal',
            trimColor: whiteMetal,
            grid: true,
            pediment: true,
          },
          {
            angle: a,
            y: 7.02,
            w: 0.46,
            h: 0.88,
            depth: 0.12,
            trimSlot: 'metal',
            trimColor: whiteMetal,
            grid: true,
            pediment: true,
          },
        ]),
      ],
    });
    panel(out, 'wood', -0.43, 0.43, 1.45, 3.47, 2.48, [0.31, 0.16, 0.07]);
    steps(out, { height: 1.45, count: 8, run: 3.2, z: 2.83, width: 1.75, rail: iron });
    for (const y of [2.87, 4.74, 6.61, 8.47])
      ring(
        out,
        'metal',
        y,
        2.7 - ((y - 1.24) * 0.6) / 7.29 - 0.012,
        2.7 - ((y - 1.24) * 0.6) / 7.29 + 0.013,
        0.019,
        whiteMetal,
        128,
      );
    // March1913 drawing: pierced cast brackets support the lower gallery. Open circles survive near views.
    for (let i = 0; i < n(16, 16, 8); i++) {
      const o = transformed(out, (i * Math.PI * 2) / n(16, 16, 8));
      beam(o, 'metal', [0, 7.68, 2.16], [0, 8.48, 3.08], 0.11, 0.11, whiteMetal);
      beam(o, 'metal', [0, 8.5, 2.08], [0, 8.5, 3.18], 0.12, 0.15, whiteMetal);
      tube(o, 'metal', [0, 7.7, 2.16], [0, 8.5, 2.13], 0.052, whiteMetal, 10);
      const c = [0, 8.23, 2.54],
        r = 0.135;
      for (let j = 0; j < n(24, 12, 4); j++)
        tube(
          o,
          'metal',
          [
            0,
            c[1] + r * Math.sin((j * Math.PI * 2) / n(24, 12, 4)),
            c[2] + r * Math.cos((j * Math.PI * 2) / n(24, 12, 4)),
          ],
          [
            0,
            c[1] + r * Math.sin(((j + 1) * Math.PI * 2) / n(24, 12, 4)),
            c[2] + r * Math.cos(((j + 1) * Math.PI * 2) / n(24, 12, 4)),
          ],
          0.032,
          whiteMetal,
          8,
        );
    }
    ring(out, 'metal', 8.53, 2.02, 3.22, 0.16, iron, 128);
    railRing(out, 8.7, 3.08, 0.94, iron, 80);
    for (let i = 0; i < n(80, 32, 6); i++)
      tube(
        out,
        'metal',
        p(3.08, 8.73, (i * Math.PI * 2) / n(80, 32, 6) + 0.021),
        p(3.08, 9.6, (i * Math.PI * 2) / n(80, 32, 6) + 0.021),
        0.02,
        iron,
        8,
      );
    lathe(
      out,
      'metal',
      [
        [8.69, 2.04],
        [10.48, 2.04],
        [10.57, 2.31],
        [10.71, 2.34],
      ],
      iron,
      128,
    );
    lanternGlass(out, 10.72, 14.15, 2.18, iron, 16);
    // External cleaning cage and four tall antenna panels follow the current museum/2020 operator views.
    for (const y of [10.8, 11.9, 13.0, 14.15, 15.0]) railRing(out, y, 2.45, 0.015, iron, 32);
    for (let i = 0; i < n(16, 16, 8); i++)
      tube(
        out,
        'metal',
        p(2.45, 10.77, (i * Math.PI) / 8),
        p(2.45, 15.12, (i * Math.PI) / 8),
        0.025,
        iron,
        8,
      );
    for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2])
      box(transformed(out, a), 'metal', [-0.085, 14.18, 2.49], [0.085, 15.72, 2.65], iron);
    lathe(
      out,
      'metal',
      [
        [14.15, 2.34],
        [14.26, 2.36],
        [15.27, 0.37],
        [15.34, 0.26],
        [15.59, 0.25],
      ],
      iron,
      128,
    );
    sphere(out, 'metal', [0, 15.66, 0], [0.19, 0.14, 0.19], iron, 24, 10);
    tube(out, 'metal', [0, 15.8, 0], [0, 16.1, 0], 0.025, black, 8);
    // Connected machine house: operator measured10.4x6m plan, aligned independently to mapped walls.
    const house = transformed(out, 0.157, [-1.22, 0, -7.66]);
    facadeBlock(house, {
      rx: 5.2,
      rz: 3,
      y0: 0,
      y1: 3.36,
      slot: 'lap',
      color: white,
      windows: [
        { face: 0, x: -4.25, y: 0.1, w: 1.4, h: 2.18, trim: 0.1 },
        { face: 0, x: -1.6, y: 1.1, w: 1.25, h: 1.2, trim: 0.09 },
        { face: 0, x: 2.3, y: 1.1, w: 1.25, h: 1.2, trim: 0.09 },
        { face: 2, x: -2.3, y: 1.1, w: 1.25, h: 1.2, trim: 0.09 },
        { face: 2, x: 2.6, y: 1.1, w: 1.25, h: 1.2, trim: 0.09 },
        { face: 1, x: 0, y: 1.1, w: 1.3, h: 1.35, trim: 0.09 },
        { face: 3, x: 0, y: 1.1, w: 1.3, h: 1.35, trim: 0.09 },
      ],
    });
    if (mode !== 'master') {
      const porch = transformed(house, 0, [-4.25, 0, 3.5]);
      facadeBlock(porch, {
        rx: 0.98,
        rz: 0.6,
        y0: 0,
        y1: 2.65,
        slot: 'lap',
        color: white,
        windows: [{ face: 0, x: 0, y: 0.1, w: 1.1, h: 2.18, trim: 0.08 }],
      });
      panel(porch, 'wood', -0.49, 0.49, 0.1, 2.28, 0.51, [0.81, 0.8, 0.74]);
      gable(porch, 1.08, 0.68, 2.65, 0.32);
    }
    gable(house, 5.37, 3.15, 3.36, 1.65);
    for (const [face, xs, width, height] of [
      [0, [-1.6, 2.3], 1.25, 1.2],
      [2, [-2.3, 2.6], 1.25, 1.2],
      [1, [0], 1.3, 1.35],
      [3, [0], 1.3, 1.35],
    ]) {
      const facade = transformed(house, (face * Math.PI) / 2);
      const z = (face % 2 ? 5.2 : 3) - 0.04;
      for (const x of xs) {
        beam(facade, 'wood', [x, 1.1, z], [x, 1.1 + height, z], 0.055, 0.05, white);
        beam(
          facade,
          'wood',
          [x - width / 2, 1.1 + height * 0.76, z],
          [x + width / 2, 1.1 + height * 0.76, z],
          0.04,
          0.05,
          white,
        );
      }
    }
    const horn = transformed(house, 0, [3.9, 0, 0]);
    facadeBlock(horn, {
      rx: 1.3,
      rz: 1.28,
      y0: 4.12,
      y1: 6.0,
      slot: 'lap',
      color: white,
      windows: [{ face: 1, x: 0, y: 5.25, w: 0.5, h: 0.35, trim: 0.035 }],
    });
    hipRoof(horn, 0, 0, 1.43, 1.4, 6.0, 0.38, black, 'metal');
    const hornFront = transformed(horn, Math.PI);
    panel(hornFront, 'wood', -1.29, 1.29, 4.28, 5.97, 1.29, [0.18, 0.19, 0.17]);
    // Hollow flare on the southern machinery-house ventilator/foghorn opening.
    const rings = [];
    for (const [z, r] of [
      [1.28, 0.2],
      [1.45, 0.23],
      [1.72, 0.48],
    ])
      rings.push(
        Array.from({ length: n(48, 24, 12) }, (_, i) => [
          Math.cos((-i * Math.PI * 2) / n(48, 24, 12)) * r,
          5.12 + Math.sin((-i * Math.PI * 2) / n(48, 24, 12)) * r,
          z,
        ]),
      );
    loft(hornFront, 'metal', rings, black, { cap: false });
    const innerrings = rings
      .map((q) => q.map(([x, y, z]) => [x * 0.9, 5.12 + (y - 5.12) * 0.9, z]))
      .map((q) => q.reverse());
    loft(hornFront, 'metal', innerrings, [0.025, 0.03, 0.03], { cap: false });
    // Separate paired white pressure tanks, depicted on operator south facade and attached pipes.
    for (const x of [-2.7, 2.7]) {
      tube(house, 'metal', [x - 1.6, 1.6, -4.6], [x + 1.6, 1.6, -4.6], 0.87, whiteMetal, 64);
      for (const s of [-1, 1])
        sphere(house, 'metal', [x + s * 1.6, 1.6, -4.6], [0.37, 0.87, 0.87], whiteMetal, 32, 20);
      for (const xx of [x - 1.1, x + 1.1])
        box(house, 'concrete', [xx - 0.19, 0, -5.15], [xx + 0.19, 0.95, -4.05], white);
      tube(house, 'metal', [x, 2.44, -4.6], [x, 3.2, -4.6], 0.09, whiteMetal, 16);
      tube(house, 'metal', [x, 3.2, -4.6], [x, 3.2, -2.9], 0.09, whiteMetal, 16);
    }
  }

  build(out);
}
export function buildLindesnesMaster(out) {
  buildLindesnesDetail(out);
}
export function buildLindesnesReviewedMaster(out) {
  buildLindesnesDetail(out, 'reviewed');
}
export function buildLindesnesStreet(out) {
  buildLindesnesDetail(out, 'street');
}
export function buildLindesnesDistrict(out) {
  buildLindesnesDetail(out, 'district');
}
