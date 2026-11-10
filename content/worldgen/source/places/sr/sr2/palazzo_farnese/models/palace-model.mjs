import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const palaceSurfaces = {
  brick: { slot: 'wall', graph: 'brick_longformat' },
  stone: { slot: 'trim', graph: 'stone_travertine' },
  roof: { slot: 'roof', graph: 'tile_flat' },
  frame: { slot: 'door', graph: 'wood_plain' },
  glass: { slot: 'window', graph: 'window_punched' },
  paving: { slot: 'foundation', graph: 'stone_limestone' },
};

const tones = {
  brick: '#c5a87d',
  stone: '#e2d6bd',
  low: '#afa392',
  roof: '#a16b53',
  frame: '#493d32',
  glass: '#657785',
  door: '#515e60',
  paving: '#aaa196',
  roofLight: '#b68065',
  innerBrick: '#d0b799',
};
const colors = Object.fromEntries(
  Object.entries(tones).map(([name, hex]) => [
    name,
    [...hex.slice(1).matchAll(/../g)].map(([pair]) => {
      const v = Number.parseInt(pair, 16) / 255;
      return v < 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }),
  ]),
);
export const outer = [
  [-38.772, -30.457],
  [38.772, -30.684],
  [38.476, 30.696],
  [-38.592, 30.696],
];
export const court = [
  [-13.145, -11.906],
  [12.033, -12.269],
  [12.394, 12.925],
  [-12.784, 13.288],
];
export const baseY = 1.7;
const eave = 24.7;
const steps = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const ref = 'palette:#ffffff';

function face(out, slot, points, direction, tone = slot) {
  const normal = normalFor(...points);
  const correct = normal.reduce((sum, v, i) => sum + v * direction[i], 0) > 0;
  const vertices = correct ? points : points.toReversed();
  out.addConvexPolygon(
    slot,
    ref,
    vertices,
    correct ? normal : normal.map((v) => -v),
    (p) => [p[0], p[2]],
    colors[tone],
  );
}

function frame(a, b, inward = false) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dx = (b[0] - a[0]) / length;
  const dz = (b[1] - a[1]) / length;
  const side = inward ? -1 : 1;
  return {
    length,
    point: (u, y, w) => [a[0] + u * dx + w * dz * side, y, a[1] + u * dz - w * dx * side],
    front: [dz * side, 0, -dx * side],
    right: [dx, 0, dz],
  };
}

function panel(out, f, slot, u0, u1, y0, y1, w, tone) {
  face(
    out,
    slot,
    [
      [u0, y0],
      [u1, y0],
      [u1, y1],
      [u0, y1],
    ].map(([u, y]) => f.point(u, y, w)),
    f.front,
    tone,
  );
}

function block(out, f, slot, u0, u1, y0, y1, w0, w1, tone) {
  const a = f.point(u0, y0, w0),
    b = f.point(u1, y0, w0),
    c = f.point(u1, y0, w1),
    d = f.point(u0, y0, w1);
  const e = f.point(u0, y1, w0),
    g = f.point(u1, y1, w0),
    h = f.point(u1, y1, w1),
    i = f.point(u0, y1, w1);
  face(
    out,
    slot,
    [a, b, g, e],
    f.front.map((x) => -x),
    tone,
  );
  face(out, slot, [d, c, h, i], f.front, tone);
  face(
    out,
    slot,
    [a, d, i, e],
    f.right.map((x) => -x),
    tone,
  );
  face(out, slot, [c, b, g, h], f.right, tone);
  face(out, slot, [a, b, c, d], [0, -1, 0], tone);
  face(out, slot, [e, g, h, i], [0, 1, 0], tone);
}

function archPoints(u, spring, radius, rise, count) {
  return Array.from({ length: count + 1 }, (_, i) => {
    const a = (Math.PI * i) / count;
    return [u - radius * Math.cos(a), spring + rise * Math.sin(a)];
  });
}

function archRing(out, f, u, spring, radius, rise, depth, w, n) {
  const inner = archPoints(u, spring, radius, rise, n);
  const outer = archPoints(u, spring, radius + depth, rise + depth, n);
  for (let i = 0; i < n; i++) {
    const [a, b, c, d] = [inner[i], inner[i + 1], outer[i + 1], outer[i]];
    face(
      out,
      'stone',
      [a, b, c, d].map((p) => f.point(...p, w)),
      f.front,
    );
  }
}

function arcade(out, f, starts, radius, spring, rise, top, back, detail, openingBase = baseY) {
  let previous = 0;
  for (const u of starts) {
    panel(out, f, 'brick', previous, u - radius, openingBase, top, 0);
    const points = archPoints(u, spring, radius, rise, [4, 6, 8, 12, 16][detail]);
    for (let i = 1; i < points.length; i++) {
      const [a, b] = [points[i - 1], points[i]];
      face(
        out,
        'brick',
        [a, b, [b[0], top], [a[0], top]].map((p) => f.point(...p, 0)),
        f.front,
      );
      const segment = [
        f.point(...a, 0),
        f.point(...b, 0),
        f.point(...b, back),
        f.point(...a, back),
      ];
      face(out, 'stone', segment, [0, -1, 0], 'low');
    }
    for (const sign of [-1, 1]) {
      const v = u + sign * radius;
      face(
        out,
        'stone',
        [
          f.point(v, openingBase, 0),
          f.point(v, spring, 0),
          f.point(v, spring, back),
          f.point(v, openingBase, back),
        ],
        f.right.map((x) => -sign * x),
        'low',
      );
    }
    if (detail) {
      archRing(out, f, u, spring, radius, rise, 0.29, 0.12, detail >= 3 ? 12 : 6);
      for (const sign of [-1, 1]) {
        const v = u + sign * (radius + 0.14);
        block(out, f, 'stone', v - 0.14, v + 0.14, openingBase, spring, -0.03, 0.16);
        if (detail >= 2)
          block(out, f, 'stone', v - 0.23, v + 0.23, spring - 0.11, spring + 0.05, -0.03, 0.21);
      }
    }
    previous = u + radius;
  }
  panel(out, f, 'brick', previous, f.length, openingBase, top, 0);
}

function window(out, f, u, y, width, height, ornament, detail) {
  const l = u - width / 2,
    r = u + width / 2,
    top = y + height;
  if (detail < 2) {
    panel(out, f, 'frame', l, r, y, top, 0.025);
    panel(out, f, 'glass', l + 0.1, r - 0.1, y + 0.12, top - 0.12, 0.04);
    if (detail) panel(out, f, 'stone', l - 0.19, r + 0.19, y - 0.18, y, 0.045);
    return;
  }
  const arched = ornament === 'arched' && detail >= 3;
  const spring = top - (arched ? 0.56 : 0);
  panel(out, f, 'frame', l, r, y, spring, 0.045);
  panel(out, f, 'glass', l + 0.1, r - 0.1, y + 0.12, spring - 0.025, 0.062);
  if (arched) {
    face(
      out,
      'frame',
      archPoints(u, spring, width / 2, 0.56, 8).map((p) => f.point(...p, 0.045)),
      f.front,
    );
    face(
      out,
      'glass',
      archPoints(u, spring - 0.025, width / 2 - 0.1, 0.51, 8).map((p) => f.point(...p, 0.062)),
      f.front,
    );
    archRing(out, f, u, spring, width / 2, 0.56, 0.1, 0.22, 8);
  }
  for (const v of [l, r]) {
    if (detail >= 3) block(out, f, 'stone', v - 0.11, v + 0.11, y - 0.04, spring + 0.07, 0, 0.21);
    else panel(out, f, 'stone', v - 0.11, v + 0.11, y - 0.04, spring + 0.07, 0.1);
  }
  block(out, f, 'stone', l - 0.22, r + 0.22, y - 0.16, y - 0.04, 0, 0.29);
  block(out, f, 'stone', l - 0.2, r + 0.2, top, top + 0.17, 0, 0.27);
  if (ornament === 'point' || ornament === 'arched') {
    face(
      out,
      'stone',
      [
        [l - 0.24, top + 0.17],
        [r + 0.24, top + 0.17],
        [u, top + 0.75],
      ].map((p) => f.point(...p, 0.27)),
      f.front,
    );
    if (detail >= 3)
      for (const sign of [-1, 1]) {
        const a = [u + sign * (width / 2 + 0.31), top + 0.17],
          b = [u, top + 0.82];
        face(
          out,
          'stone',
          [a, b, [b[0], b[1] - 0.1], [a[0], a[1] - 0.1]].map((p) => f.point(...p, 0.34)),
          f.front,
        );
      }
  }
  if (ornament === 'curve') {
    const curve = archPoints(u, top + 0.14, width / 2 + 0.22, 0.53, detail >= 3 ? 8 : 4);
    face(
      out,
      'stone',
      curve.map((p) => f.point(...p, 0.26)),
      f.front,
    );
  }
  if (detail >= 3) {
    panel(out, f, 'frame', u - 0.04, u + 0.04, y + 0.12, spring - 0.025, 0.073);
    panel(
      out,
      f,
      'frame',
      l + 0.1,
      r - 0.1,
      y + height * 0.53 - 0.035,
      y + height * 0.53 + 0.035,
      0.073,
    );
  }
}

function frontPortal(out, f, u, detail) {
  const radius = 2.04,
    spring = baseY + 4.1,
    rise = 1.85;
  panel(out, f, 'frame', u - radius, u + radius, baseY, spring, -0.62, 'door');
  face(
    out,
    'frame',
    archPoints(u, spring, radius, rise, 12).map((p) => f.point(...p, -0.62)),
    f.front,
    'door',
  );
  const left = u - radius - 0.68,
    right = u + radius + 0.68;
  block(out, f, 'stone', left, right, baseY + 7.06, baseY + 7.36, -0.1, 1.1);
  if (detail < 2) panel(out, f, 'stone', left, right, baseY + 7.36, baseY + 8.15, 1.06);
  else {
    block(out, f, 'stone', left, right, baseY + 8.08, baseY + 8.22, 0.91, 1.15);
    for (let i = 0; i < 13; i++) {
      const x = left + 0.13 + ((right - left - 0.26) * i) / 12;
      block(out, f, 'stone', x - 0.065, x + 0.065, baseY + 7.36, baseY + 8.08, 0.93, 1.1);
    }
  }
  face(
    out,
    'stone',
    [
      [u - 0.8, baseY + 13.68],
      [u + 0.8, baseY + 13.68],
      [u + 0.55, baseY + 12.79],
      [u, baseY + 12.27],
      [u - 0.55, baseY + 12.79],
    ].map((p) => f.point(...p, 0.42)),
    f.front,
  );
  if (detail >= 3) {
    for (const sign of [-1, 1]) {
      const x = u + sign * 0.87;
      block(out, f, 'stone', x - 0.13, x + 0.13, baseY + 12.61, baseY + 13.45, 0.04, 0.35);
    }
    for (const sign of [-1, 1])
      for (let i = 0; i < 9; i++) {
        const x = u + sign * (radius + 0.38 + (i % 2) * 0.14);
        block(
          out,
          f,
          'stone',
          x - 0.26,
          x + 0.26,
          baseY + i * 0.47,
          baseY + i * 0.47 + 0.42,
          0.02,
          0.22,
        );
      }
  }
}

function exterior(out, detail) {
  for (let i = 0; i < 4; i++) {
    const f = frame(outer[i], outer[(i + 1) % 4]);
    const middle = f.length / 2,
      front = i === 1,
      rear = i === 3;
    const rearBays = [-1, 0, 1].map((x) => middle + x * 5.03);
    const floor = rear ? -1.5 : baseY;
    panel(out, f, 'paving', 0, f.length, -4, floor, 0, 'low');
    if (front) arcade(out, f, [middle], 2.04, baseY + 4.1, 1.85, baseY + 7.12, -0.62, detail);
    else if (rear) {
      arcade(out, f, rearBays, 1.78, baseY + 3.89, 1.66, baseY + 7.12, -1.35, detail, floor);
      for (const u of [rearBays[0], rearBays[2]]) {
        panel(out, f, 'frame', u - 1.78, u + 1.78, floor, baseY + 3.89, -1.35);
        face(
          out,
          'frame',
          archPoints(u, baseY + 3.89, 1.78, 1.66, 8).map((p) => f.point(...p, -1.35)),
          f.front,
        );
      }
    } else panel(out, f, 'brick', 0, f.length, baseY, baseY + 7.12, 0);
    panel(out, f, 'brick', 0, f.length, baseY + 7.12, baseY + 14.33, 0);
    if (rear) {
      arcade(out, f, rearBays, 1.85, baseY + 19.25, 1.62, eave, -1.95, detail, baseY + 14.33);
      for (const u of rearBays) {
        panel(
          out,
          f,
          'brick',
          u - 1.85,
          u + 1.85,
          baseY + 14.33,
          baseY + 19.25,
          -1.95,
          'innerBrick',
        );
        face(
          out,
          'brick',
          archPoints(u, baseY + 19.25, 1.85, 1.62, 8).map((p) => f.point(...p, -1.95)),
          f.front,
          'innerBrick',
        );
        block(out, f, 'stone', u - 1.85, u + 1.85, baseY + 14.33, baseY + 15.11, -0.16, 0.15);
      }
    } else panel(out, f, 'brick', 0, f.length, baseY + 14.33, eave, 0);
    for (const [y, w, h] of [
      [baseY + 0.42, 0.23, 0.25],
      [baseY + 6.37, 0.25, 0.16],
      [baseY + 7.0, 0.3, 0.22],
      [baseY + 14.31, 0.3, 0.19],
      [baseY + 14.57, 0.18, 0.11],
      [23.65, 0.46, 0.22],
      [24.09, 0.76, 0.23],
      [24.51, 1.02, 0.24],
    ]) {
      const skip = y < baseY + 1 ? (front ? [middle] : rear ? rearBays : []) : [];
      const gap = front ? 2.04 : 1.78;
      const ranges = skip.length
        ? [
            [-0.22, skip[0] - gap],
            ...skip.slice(1).map((u, i) => [skip[i] + gap, u - gap]),
            [skip.at(-1) + gap, f.length + 0.22],
          ]
        : [[-0.22, f.length + 0.22]];
      for (const [l, r] of ranges) {
        if (detail || y >= 24.5) block(out, f, 'stone', l, r, y, y + h, -0.06, w);
        else panel(out, f, 'stone', l, r, y, y + h, 0.023);
      }
    }
    const bays = front || rear ? 13 : 15;
    if (detail)
      for (let j = 0; j < bays; j++) {
        const x = ((j - (bays - 1) / 2) * (f.length - 3.4)) / bays + middle;
        const loggia = rear && Math.abs(j - 6) <= 1;
        if ((!front || j !== 6) && !loggia)
          window(out, f, x, baseY + 1.24, 1.54, 3.18, 'flat', detail);
        window(out, f, x, baseY + 8.0, 1.68, 3.7, j % 2 === 0 ? 'curve' : 'point', detail);
        if (!loggia)
          window(out, f, x, baseY + 15.27, 1.52, 3.56, front ? 'arched' : 'point', detail);
      }
    if (front) frontPortal(out, f, middle, detail);
    if (detail >= 2)
      for (const sign of [0, 1]) {
        for (let j = 0; j < 27; j++) {
          const span = j % 2 ? 0.76 : 1.05,
            u = sign * f.length;
          const l = sign ? u - span : u,
            r = sign ? u : u + span,
            y = baseY + j * 0.81;
          if (detail >= 3) block(out, f, 'stone', l, r, y, y + 0.76, -0.015, 0.14);
          else panel(out, f, 'stone', l, r, y, y + 0.76, 0.08);
        }
      }
    if (detail >= 3)
      for (let j = 0; j < Math.floor(f.length / 0.8); j++) {
        const x = 0.4 + j * 0.8;
        block(out, f, 'stone', x - 0.1, x + 0.1, 23.91, 24.49, 0.13, 0.82);
      }
  }
}

function courtyard(out, detail) {
  const floor = baseY + 0.08;
  face(
    out,
    'paving',
    court.map(([x, z]) => [x, floor, z]),
    [0, 1, 0],
  );
  if (detail >= 2) {
    const center = court.reduce((sum, p) => sum.map((v, i) => v + p[i] / 4), [0, 0]);
    for (let i = 0; i < 4; i++) {
      const a = court[i],
        b = court[(i + 1) % 4];
      const p = [center, a, b].map(([x, z]) => [x, floor + 0.018, z]);
      face(out, 'paving', p, [0, 1, 0], i % 2 ? 'paving' : 'stone');
    }
  }
  for (let i = 0; i < 4; i++) {
    const f = frame(court[i], court[(i + 1) % 4], true);
    const bays = Array.from({ length: 5 }, (_, j) => (f.length * (j + 0.5)) / 5);
    arcade(out, f, bays, 1.75, baseY + 3.61, 1.58, baseY + 6.1, -1.8, detail);
    panel(out, f, 'brick', 0, f.length, baseY + 6.1, eave - 0.38, 0, 'innerBrick');
    for (const [y, h] of [
      [baseY + 5.7, 0.19],
      [baseY + 6.04, 0.3],
      [baseY + 6.44, 0.2],
      [baseY + 13.28, 0.22],
      [baseY + 13.63, 0.3],
      [eave - 0.7, 0.26],
      [eave - 0.43, 0.17],
    ]) {
      if (detail) block(out, f, 'stone', 0, f.length, y, y + h, -0.03, 0.34);
      else panel(out, f, 'stone', 0, f.length, y, y + h, 0.025);
    }
    for (const [j, u] of bays.entries()) {
      if (i === 3 && j === 2) {
        continueRearPassage(out, f, u, floor);
      } else if (i !== 1 || j !== 2) {
        panel(out, f, 'brick', u - 2.08, u + 2.08, baseY, baseY + 5.45, -1.8, 'innerBrick');
      } else {
        panel(out, f, 'frame', u - 1.28, u + 1.28, baseY, baseY + 4.78, -2.45, 'door');
      }
      if (detail) {
        window(out, f, u, baseY + 7.63, 1.57, 3.52, 'point', detail);
        window(out, f, u, baseY + 15.0, 1.6, 3.25, 'curve', detail);
      }
      if (detail >= 2) {
        archRing(out, f, u, baseY + 10.53, 1.95, 1.56, 0.21, 0.11, detail >= 3 ? 10 : 6);
        for (const y of [baseY + 6.72, baseY + 14.24]) {
          const v = u + f.length / 10 - 0.2;
          block(out, f, 'stone', v - 0.17, v + 0.17, y, y + 5.32, -0.025, 0.2);
          block(out, f, 'stone', v - 0.25, v + 0.25, y + 5.17, y + 5.36, -0.025, 0.3);
        }
      }
    }
  }
}

function continueRearPassage(out, courtFrame, u, floor) {
  const back = frame(outer[3], outer[0]);
  const v = back.length / 2,
    rearY = -1.5;
  const a = courtFrame.point(u - 1.75, floor, 0),
    b = courtFrame.point(u + 1.75, floor, 0);
  const c = back.point(v + 1.78, rearY, 0),
    d = back.point(v - 1.78, rearY, 0);
  face(out, 'paving', [a, b, c, d], [0, 1, 0]);
  for (const [p, q, side] of [
    [a, d, 1],
    [b, c, -1],
  ]) {
    face(
      out,
      'stone',
      [p, q, [q[0], baseY + 4.15, q[2]], [p[0], baseY + 4.15, p[2]]],
      courtFrame.right.map((x) => x * side),
      'low',
    );
  }
  face(
    out,
    'stone',
    [a, b, c, d].map(([x, , z]) => [x, baseY + 4.15, z]),
    [0, -1, 0],
    'low',
  );
}

function roof(out, detail) {
  const ridge = outer.map((p, i) => p.map((x, j) => (x + court[i][j]) / 2));
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    const toY = ([x, z], y) => [x, y, z];
    face(
      out,
      'roof',
      [
        toY(outer[i], eave - 0.07),
        toY(outer[j], eave - 0.07),
        toY(ridge[j], 29.7),
        toY(ridge[i], 29.7),
      ],
      [0, 1, 0],
      i === 1 ? 'roofLight' : 'roof',
    );
    face(
      out,
      'roof',
      [
        toY(ridge[i], 29.7),
        toY(ridge[j], 29.7),
        toY(court[j], eave - 0.45),
        toY(court[i], eave - 0.45),
      ],
      [0, 1, 0],
    );
    if (detail >= 2) {
      const f = frame(ridge[i], ridge[j]);
      block(out, f, 'roof', 0, f.length, 29.65, 29.84, -0.13, 0.13);
      if (i !== 1)
        for (const u of [0.26, 0.72].map((k) => k * f.length)) {
          block(out, f, 'brick', u - 0.5, u + 0.5, 29.43, 31.21, -0.41, 0.41);
          if (detail === 4) {
            for (const offset of [-0.28, 0.28])
              block(out, f, 'roof', u + offset - 0.17, u + offset + 0.17, 31.19, 31.51, -0.2, 0.2);
            block(out, f, 'stone', u - 0.62, u + 0.62, 31.46, 31.62, -0.49, 0.49);
          } else block(out, f, 'stone', u - 0.62, u + 0.62, 31.19, 31.39, -0.49, 0.49);
        }
    }
  }
}

export function buildPalaceLevel(out, level) {
  const detail = steps[level];
  if (detail === undefined) throw Error('Unknown Palazzo Farnese LOD: ' + level);
  exterior(out, detail);
  courtyard(out, detail);
  roof(out, detail);
}
export const buildPalaceSkyline = (out) => buildPalaceLevel(out, 'skyline');
export const buildPalaceDistrict = (out) => buildPalaceLevel(out, 'district');
export const buildPalaceStreet = (out) => buildPalaceLevel(out, 'street');
export const buildPalaceCloseup = (out) => buildPalaceLevel(out, 'closeup');
