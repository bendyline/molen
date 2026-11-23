import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  ashlar: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.96 },
  dressed: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.95 },
  vault: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 1 },
  deck: { slot: 'foundation', graph: 'stone_sandstone', roughness: 0.96 },
};
const faceStone = rgb('adaf9f'),
  coping = rgb('bfc0b0'),
  deckStone = rgb('a7a394');
const wet = rgb('847e67'),
  vaultStone = rgb('8f9487'),
  light = rgb('d0c4a7');
const blocks = ['b1b2a2', 'a7ac9c', 'b6b7a8', 'adafa0', 'a5aa9d', 'b4b5a4'].map(rgb);
const {
  origin: [ox, oz],
  along: [a, b],
  across: [c, d],
} = site.frame;

function interpolate(stations, x, column = 1) {
  const n = stations.findIndex((p) => p[0] >= x);
  if (n === 0) return stations[0][column];
  if (n < 0) return stations.at(-1)[column];
  const p = stations[n - 1],
    q = stations[n];
  return p[column] + ((q[column] - p[column]) * (x - p[0])) / (q[0] - p[0]);
}

const mainLevel = (x) => interpolate(site.main.deckStations, x);
const mainWidth = () => site.main.width;
const rampLevel = (x) => interpolate(site.ramp.stations, x, 3);
const rampWidth = (x) => interpolate(site.ramp.stations, x, 2);

function world(x, y, z) {
  return [ox + a * x + c * z, y, oz + b * x + d * z];
}

function writer(out, axis) {
  const point =
    axis === 'main'
      ? ([x, y, z]) => world(x, y, z + interpolate(site.main.centerStations, x))
      : ([x, y, z]) => world(interpolate(site.ramp.stations, x) + z, y, -x);
  const vector =
    axis === 'main'
      ? ([x, y, z]) => [a * x + c * z, y, b * x + d * z]
      : ([x, y, z]) => [a * z - c * x, y, b * z - d * x];
  return (slot, points, color, target) => {
    let p = points.map((q) => point(q).map(Math.fround));
    const axis = vector(target);
    if (normalFor(...p).reduce((sum, v, i) => sum + v * axis[i], 0) < 0) p = p.toReversed();
    for (let i = 1; i < p.length - 1; i++) {
      const tri = [p[0], p[i], p[i + 1]],
        n = normalFor(...tri);
      if (Math.hypot(...n) > 0.9) out.addTriangle(slot, '', tri, n, [], color);
    }
  };
}

function prism(send, slot, x0, x1, z0, z1, y0, y1, color) {
  const p = [
    [x0, y0, z0],
    [x0, y0, z1],
    [x1, y0, z1],
    [x1, y0, z0],
  ];
  const q = p.map(([x, , z]) => [x, typeof y1 === 'function' ? y1(x) : y1, z]);
  for (const [i, dir] of [
    [0, [-1, 0, 0]],
    [1, [0, 0, 1]],
    [2, [1, 0, 0]],
    [3, [0, 0, -1]],
  ]) {
    const j = (i + 1) % 4;
    send(slot, [p[i], p[j], q[j], q[i]], color, dir);
  }
  send(slot, q, color, [0, 1, 0]);
}

function section(send, x0, x1, level, width, base, roofColor = deckStone) {
  if (x1 - x0 < 0.018) return;
  const a = width(x0) / 2,
    b = width(x1) / 2;
  const p = level(x0),
    q = level(x1);
  for (const s of [-1, 1]) {
    send(
      'ashlar',
      [
        [x0, base, s * a],
        [x1, base, s * b],
        [x1, q, s * b],
        [x0, p, s * a],
      ],
      faceStone,
      [0, 0, s],
    );
  }
  send(
    'deck',
    [
      [x0, p, -a],
      [x1, q, -b],
      [x1, q, b],
      [x0, p, a],
    ],
    roofColor,
    [0, 1, 0],
  );
}

function arch(send, l, r, rise, level, width, detail) {
  const count = [4, 10, 18, 26][detail];
  const center = (l + r) / 2,
    span = r - l;
  const spring = level(center) - rise - 1.1;
  const height = (t, margin = 0) => {
    const u = Math.abs(t - 0.5);
    return (
      spring +
      ((rise + margin) * Math.sqrt(Math.max(0, 1 - ((u + 0.17) / 0.67) ** 2))) /
        Math.sqrt(1 - (0.17 / 0.67) ** 2)
    );
  };
  const x = (t) => l + span * t;
  for (let i = 0; i < count; i++) {
    const a = i / count,
      b = (i + 1) / count,
      x0 = x(a),
      x1 = x(b),
      y0 = height(a),
      y1 = height(b);
    const w = width(x0) / 2,
      v = width(x1) / 2,
      t0 = level(x0),
      t1 = level(x1);
    for (const sign of [-1, 1]) {
      send(
        'ashlar',
        [
          [x0, y0, sign * w],
          [x1, y1, sign * v],
          [x1, t1, sign * v],
          [x0, t0, sign * w],
        ],
        faceStone,
        [0, 0, sign],
      );
      if (detail === 0) continue;
      const m = (i + 0.018) / count,
        n = (i + 0.982) / count;
      const arched = (t, shift) => [
        x(t) + (t - 0.5) * shift * 1.75,
        height(t, shift) + shift * 0.13,
        sign * (width(x(t)) / 2 + 0.038),
      ];
      send(
        'dressed',
        [arched(m, 0), arched(n, 0), arched(n, 0.44), arched(m, 0.44)],
        blocks[i % blocks.length],
        [0, 0, sign],
      );
    }
    send(
      'vault',
      [
        [x0, y0, -w],
        [x1, y1, -v],
        [x1, y1, v],
        [x0, y0, w],
      ],
      vaultStone,
      [0, -1, 0],
    );
    send(
      'deck',
      [
        [x0, t0, -w],
        [x1, t1, -v],
        [x1, t1, v],
        [x0, t0, w],
      ],
      deckStone,
      [0, 1, 0],
    );
  }
}

function interiorJambs(send, span, level, width, base) {
  const { left, right, rise } = span,
    y = level((left + right) / 2) - rise - 1.1;
  for (const [x, sign] of [
    [left, 1],
    [right, -1],
  ]) {
    const w = width(x) / 2;
    send(
      'vault',
      [
        [x, base, -w],
        [x, base, w],
        [x, y, w],
        [x, y, -w],
      ],
      vaultStone,
      [sign, 0, 0],
    );
  }
}

function end(send, x, base, level, width, sign) {
  const w = width(x) / 2,
    y = level(x);
  send(
    'ashlar',
    [
      [x, base, -w],
      [x, base, w],
      [x, y, w],
      [x, y, -w],
    ],
    faceStone,
    [sign, 0, 0],
  );
}

function masonryRun(send, spans, length, level, width, base, detail) {
  let cursor = 0;
  for (const p of spans) {
    section(send, cursor, p.left, level, width, base);
    arch(send, p.left, p.right, p.rise, level, width, detail);
    interiorJambs(send, p, level, width, base);
    cursor = p.right;
  }
  section(send, cursor, length, level, width, base);
  end(send, 0, base, level, width, -1);
  end(send, length, base, level, width, 1);
}

function cutwater(send, pier, detail) {
  const { distance: x, width } = pier,
    leg = width * 0.48;
  const h = Math.min(7.3, mainLevel(x) - 6.55),
    w = site.main.width / 2;
  for (const side of [-1, 1]) {
    const tip = side * (w + (side < 0 ? 1.76 : 1.27));
    const heel = side * (w - 0.02);
    const p = [
      [x - leg, -5.5, heel],
      [x + leg, -5.5, heel],
      [x, -5.5, tip],
    ];
    const band = p.map(([x, , z]) => [x, 1.05, z]);
    const crown = [
      [x - leg * 0.93, h, heel],
      [x + leg * 0.93, h, heel],
      [x, h - 1.83, tip * 0.967],
    ];
    for (let i = 1; i < 3; i++) {
      const j = (i + 1) % 3;
      const dir = [i === 1 ? 1 : -1, 0, side];
      send('ashlar', [p[i], p[j], band[j], band[i]], wet, dir);
      send('ashlar', [band[i], band[j], crown[j], crown[i]], faceStone, dir);
      if (detail >= 2) {
        const lip = [band[i], band[j]].map(([x, y, z]) => [x, y + 0.22, z + side * 0.083]);
        send('dressed', [band[i], band[j], lip[1], lip[0]], coping, dir);
      }
    }
    send('dressed', crown, coping, [0, 1, 0]);
  }
}

function rail(send, stations, level, width, detail) {
  for (let i = 1; i < stations.length; i++) {
    const x0 = stations[i - 1],
      x1 = stations[i],
      a = width(x0) / 2,
      b = width(x1) / 2;
    const y0 = level(x0),
      y1 = level(x1),
      h = 0.93;
    for (const s of [-1, 1]) {
      const p = [x0, y0, s * a],
        q = [x1, y1, s * b],
        r = [x1, y1, s * (b - 0.53)],
        t = [x0, y0, s * (a - 0.53)];
      const up = ([x, y, z]) => [x, y + h, z];
      const down = ([x, y, z]) => [x, y - 0.12, z];
      send('ashlar', [down(p), down(q), up(q), up(p)], faceStone, [0, 0, s]);
      send('ashlar', [r, t, up(t), up(r)], faceStone, [0, 0, -s]);
      send('dressed', [up(p), up(q), up(r), up(t)], coping, [0, 1, 0]);
      if (detail >= 2) {
        const n = Math.ceil((x1 - x0) / 1.74);
        for (let j = 1; j < n; j++) {
          const f = j / n,
            x = x0 + (x1 - x0) * f,
            y = y0 + (y1 - y0) * f,
            z = s * (a + (b - a) * f + 0.027);
          send(
            'dressed',
            [
              [x, y + 0.045, z],
              [x + 0.025, y + 0.045, z],
              [x + 0.025, y + h - 0.068, z],
              [x, y + h - 0.068, z],
            ],
            wet,
            [0, 0, s],
          );
        }
      }
    }
  }
}

function pavilion(send, detail) {
  const x = 101.27,
    y = mainLevel(x),
    w = mainWidth(x) / 2;
  for (const s of [-1, 1]) {
    const extension = s < 0 ? 2.58 : 3.52;
    const z0 = Math.min(s * (w - 0.06), s * (w + extension)),
      z1 = Math.max(s * (w - 0.06), s * (w + extension));
    prism(send, 'ashlar', x - 2.51, x + 2.61, z0, z1, y - 2.4, y, coping);
    const lip = s * (w + extension - 0.25);
    prism(send, 'dressed', x - 2.51, x + 2.61, lip - 0.24, lip + 0.24, y, y + 1.02, coping);
    if (detail === 0) continue;
    for (const edge of [-1, 1]) {
      prism(
        send,
        'ashlar',
        x + edge * 2.38 - 0.24,
        x + edge * 2.38 + 0.24,
        z0,
        z1,
        y,
        y + 0.86,
        faceStone,
      );
    }
  }
  const v = -w - 1.34;
  prism(send, 'dressed', x - 1.03, x + 1.03, v - 0.28, v + 0.28, y, y + 3.32, light);
  prism(send, 'ashlar', x - 1.2, x + 1.2, v - 0.4, v + 0.4, y + 3.25, y + 3.57, coping);
  if (detail >= 2) {
    send(
      'dressed',
      [
        [x - 0.75, y + 1.7, v + 0.304],
        [x + 0.75, y + 1.7, v + 0.304],
        [x + 0.75, y + 2.88, v + 0.304],
        [x - 0.75, y + 2.88, v + 0.304],
      ],
      vaultStone,
      [0, 0, 1],
    );
    for (let i = 0; i < 4; i++)
      send(
        'dressed',
        [
          [x - 0.51, y + 1.94 + 0.2 * i, v + 0.322],
          [x + 0.52, y + 1.94 + 0.2 * i, v + 0.322],
          [x + 0.52, y + 2.018 + 0.2 * i, v + 0.322],
          [x - 0.51, y + 2.018 + 0.2 * i, v + 0.322],
        ],
        coping,
        [0, 0, 1],
      );
  }
}

function bridge(out, detail) {
  const main = writer(out, 'main'),
    ramp = writer(out, 'ramp');
  masonryRun(main, site.main.spans, site.main.length, mainLevel, mainWidth, -7.5, detail);
  masonryRun(
    ramp,
    site.ramp.spans.map(([left, right]) => ({ left, right, rise: (right - left) * 0.41 })),
    site.ramp.length,
    rampLevel,
    rampWidth,
    site.ramp.spanFloor,
    detail,
  );
  section(ramp, 0, site.ramp.length, () => site.ramp.spanFloor, rampWidth, -7.5, wet);
  if (detail > 0) for (const p of site.main.piers.slice(1, -1)) cutwater(main, p, detail);
  rail(
    main,
    site.main.deckStations.map((p) => p[0]),
    mainLevel,
    mainWidth,
    detail,
  );
  rail(
    ramp,
    site.ramp.stations.map((p) => p[0]),
    rampLevel,
    rampWidth,
    detail,
  );
  pavilion(main, detail);
}

export const buildSkyline = (out) => bridge(out, 0);
export const buildDistrict = (out) => bridge(out, 1);
export const buildStreet = (out) => bridge(out, 2);
export const buildCloseup = (out) => bridge(out, 3);
export const buildMaster = buildCloseup;
