import { readFileSync } from 'node:fs';
import {
  beamPath,
  chamferedRectangle,
  loft,
  normalFor,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const matignonSurfaces = {
  ashlar: { slot: 'wall', graph: 'stone_limestone', roughness: 0.86 },
  trim: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.81 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.83 },
  painted: { slot: 'trim', graph: 'metal_painted', roughness: 0.54 },
};
const palette = {
  cream: 'e1d2b6',
  lime: 'e8dbbf',
  soft: 'cfc0a8',
  cap: 'dacdb6',
  bright: 'f0e6d1',
  edge: 'b4a48d',
  slate: '5a6470',
  slateLight: '626c76',
  pane: '415460',
  paneBlue: '4b5f6d',
  reveal: '363d40',
  panel: '444b4b',
  rail: '373c39',
  frame: 'd6d2c0',
};
const colors = Object.fromEntries(
  Object.entries(palette).map(([k, hex]) => [
    k,
    hex.match(/../g).map((part) => {
      const srgb = Number.parseInt(part, 16) / 255;
      return srgb <= 0.04045 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
    }),
  ]),
);
const levels = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const ref = 'palette:#ffffff',
  up = [0, 1, 0];
const raised = ([x, z], y) => [x, y, z];
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);

function surface(out, slot, color, points, towards) {
  let n = normalFor(...points);
  if (dot(n, towards) < 0) {
    points = points.toReversed();
    n = normalFor(...points);
  }
  if (points.length === 3) out.addTriangle(slot, ref, points, n, undefined, colors[color]);
  else if (points.length === 4) out.addQuad(slot, ref, points, n, undefined, colors[color]);
  else out.addConvexPolygon(slot, ref, points, n, (p) => [p[0], p[1]], colors[color]);
}
function block(out, slot, tint, x, z, bottom, width, depth, height, corner = 0) {
  const ring = (y) =>
    corner
      ? chamferedRectangle(x, y, z, width, depth, corner)
      : [
          [x - width / 2, y, z - depth / 2],
          [x - width / 2, y, z + depth / 2],
          [x + width / 2, y, z + depth / 2],
          [x + width / 2, y, z - depth / 2],
        ];
  loft(out, slot, [ring(bottom), ring(bottom + height)], colors[tint]);
}
function mainShell(out) {
  for (const { regions, bottom, top, roof, name } of layout.forms) {
    for (const { rings, vertices, triangles, foot } of regions) {
      if (name !== 'low gallery roofs') {
        for (let ri = 0; ri < rings.length; ri++) {
          const ring = rings[ri];
          for (let i = 0; i < ring.length; i++) {
            const j = (i + 1) % ring.length,
              a = ring[i],
              b = ring[j];
            if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.015) continue;
            const n = [b[1] - a[1], 0, a[0] - b[0]];
            const tint = name === 'main pavilion' ? 'lime' : 'cream';
            const points = [
              raised(a, bottom ?? foot[ri][i]),
              raised(b, bottom ?? foot[ri][j]),
              raised(b, top),
              raised(a, top),
            ];
            surface(out, 'ashlar', tint, points, n);
          }
        }
      }
      if (roof)
        for (const ids of triangles) {
          const points = ids.map((i) => raised(vertices[i], top));
          if (Math.hypot(...normalFor(...points)) > 0) surface(out, 'slate', 'slate', points, up);
        }
    }
  }
}
function frame(w) {
  const dir = [(w.b[0] - w.a[0]) / w.length, (w.b[1] - w.a[1]) / w.length];
  return (u, y, offset = 0) => [
    w.p[0] + dir[0] * u + w.n[0] * offset,
    y,
    w.p[1] + dir[1] * u + w.n[2] * offset,
  ];
}
function field(out, w, slot, tint, p, u0, u1, y0, y1, offset) {
  surface(
    out,
    slot,
    tint,
    [p(u0, y0, offset), p(u1, y0, offset), p(u1, y1, offset), p(u0, y1, offset)],
    w.n,
  );
}
function ledge(out, w, p, y, h, reach, tint) {
  const d = w.length / 2 + 0.018;
  field(out, w, 'trim', tint, p, -d, d, y, y + h, reach);
  surface(
    out,
    'trim',
    tint,
    [p(-d, y + h, -0.025), p(d, y + h, -0.025), p(d, y + h, reach), p(-d, y + h, reach)],
    up,
  );
  surface(
    out,
    'trim',
    tint,
    [p(-d, y, -0.02), p(d, y, -0.02), p(d, y, reach), p(-d, y, reach)],
    [0, -1, 0],
  );
}
function aperture(out, w, p, u, y, width, height, arch, detail, tint, door = false) {
  const h = width / 2,
    top = y + height,
    spring = top - arch;
  const curve = Array.from({ length: detail >= 2 ? 9 : 5 }, (_, i) => i);
  const steps = curve.length - 1;
  const upper = curve.map((i) => [
    u + h * Math.cos((Math.PI * i) / steps),
    spring + arch * Math.sin((Math.PI * i) / steps),
  ]);
  const at = (points, s) => points.map(([x, y]) => p(x, y, s));
  const ring = [[u - h, y], [u + h, y], ...upper];
  if (detail === 0) {
    field(out, w, 'painted', tint, p, u - h, u + h, y, top, 0.026);
    return;
  }
  if (detail === 1) {
    surface(out, 'painted', tint, at(ring, 0.032), w.n);
    return;
  }
  surface(out, 'painted', 'reveal', at(ring, 0.028), w.n);
  const inner = ring.map(([x, t]) => [u + (x - u) * 0.902, y + 0.067 + (t - y) * 0.963]);
  surface(out, 'painted', tint, at(inner, 0.044), w.n);
  const sillColor = door ? 'soft' : 'cap';
  const sill = width * 0.59;
  field(out, w, 'trim', sillColor, p, u - sill, u + sill, y - 0.09, y + 0.035, 0.105);
  if (detail < 2) return;
  const surround = [
    ...upper.map(([x, t]) => [u + (x - u) * 1.135, spring + (t - spring) * 1.18 + 0.045]),
  ];
  const count = detail >= 3 ? steps : 4;
  for (let j = 0; j < count; j++) {
    const a = (j * steps) / count,
      b = ((j + 1) * steps) / count;
    const q = at([upper[a], upper[b], surround[b], surround[a]], 0.074);
    surface(out, 'trim', j === Math.floor(count / 2) ? 'bright' : 'cap', q, w.n);
  }
  for (const side of [-1, 1]) {
    const x = u + side * h;
    field(out, w, 'trim', 'cap', p, x - 0.066, x + 0.066, y + 0.04, spring, 0.074);
  }
  const mullionWidth = detail >= 3 ? 0.037 : 0.052;
  field(
    out,
    w,
    'painted',
    'frame',
    p,
    u - mullionWidth,
    u + mullionWidth,
    y + 0.1,
    top - 0.06,
    0.059,
  );
  for (const fraction of door ? [0.43, 0.69] : [0.34, 0.66]) {
    const t = y + height * fraction;
    field(out, w, 'painted', 'frame', p, u - h * 0.9, u + h * 0.9, t - 0.031, t + 0.031, 0.06);
  }
  if (detail >= 3 && arch > 0.34) {
    for (const side of [-1, 1])
      beamPath(
        out,
        'painted',
        [p(u, spring - 0.12, 0.064), p(u + side * h * 0.53, top - arch * 0.21, 0.064)],
        0.041,
        0.031,
        colors.frame,
      );
  }
}
function ornament(out, p, u, y, w, detail) {
  const scale = w * 0.48;
  const c = p(u, y, 0.13);
  sphere(
    out,
    'trim',
    c,
    [scale * 0.46, scale * 0.62, 0.19],
    colors.bright,
    detail >= 3 ? 12 : 8,
    detail >= 3 ? 7 : 5,
  );
  if (detail < 3) return;
  for (const side of [-1, 1]) {
    beamPath(
      out,
      'trim',
      [
        p(u, y - 0.28, 0.15),
        p(u + side * 0.31, y - 0.16, 0.24),
        p(u + side * 0.42, y + 0.12, 0.21),
        p(u + side * 0.23, y + 0.33, 0.18),
        p(u + side * 0.12, y + 0.17, 0.21),
      ],
      0.1,
      0.1,
      colors.cap,
    );
  }
}
function elevations(out, detail) {
  for (const w of layout.walls) {
    if (w.length < 1.0) continue;
    if (!detail && !(w.garden || w.court)) continue;
    const p = frame(w),
      high = w.top > 9,
      primary = w.garden || w.court;
    if (detail >= 1 && w.length >= (detail === 1 ? 2.25 : 1.2) && (detail > 1 || primary)) {
      ledge(out, w, p, w.top - 0.21, 0.17, 0.18, 'cap');
      if (high && primary) ledge(out, w, p, 6.25, 0.13, 0.11, 'cap');
      if (detail >= 2 && primary) {
        ledge(out, w, p, w.top - 0.47, 0.13, 0.11, 'lime');
        ledge(out, w, p, w.garden ? 1.53 : 0.18, 0.2, 0.08, 'soft');
      }
    }
    if (w.length < 1.53 || (!primary && w.length < 2.0)) continue;
    const centralBay = (w.bay || w.courtBay) && w.length > 3.8;
    const mainGate = w.court && w.p[0] > 25.7 && w.p[1] > 7.6 && w.p[1] < 10.0 && w.length > 2.0;
    const count =
      centralBay || mainGate ? 1 : Math.max(1, Math.round(w.length / (primary ? 2.65 : 3.75)));
    for (let i = 0; i < count; i++) {
      const u = ((i + 0.5) * w.length) / count - w.length / 2;
      const visibleDetail = primary ? detail : detail >= 3 ? 2 : detail >= 2 ? 1 : 0;
      const width = Math.min(
        (w.length / count) * 0.67,
        mainGate ? 2.6 : centralBay ? 2.15 : primary ? 1.65 : 1.3,
      );
      const center = centralBay || mainGate;
      const floor = w.garden ? 1.56 : Math.max(0.13, w.bottom + 0.12);
      const door = center;
      const lowBase = floor + (door ? 0 : primary ? 0.21 : 0.7);
      const highBase = 6.83;
      aperture(
        out,
        w,
        p,
        u,
        lowBase,
        width,
        high ? 3.72 : mainGate ? 5.43 : 4.75,
        mainGate ? 0.76 : 0.42,
        visibleDetail,
        door ? 'panel' : 'pane',
        door,
      );
      if (high)
        aperture(
          out,
          w,
          p,
          u,
          highBase,
          width,
          w.top - highBase - (primary ? 0.66 : 0.78),
          primary ? 0.43 : 0.22,
          visibleDetail,
          'paneBlue',
        );
      if (detail >= 3 && primary) {
        const top = high ? lowBase + 3.72 : lowBase + (mainGate ? 5.43 : 4.75);
        ornament(out, p, u, top + 0.22, center ? 1.02 : 0.67, detail);
        if (high) ornament(out, p, u, w.top - 0.42, center ? 0.9 : 0.55, detail);
      }
    }
    if (detail >= 2 && primary && w.length > 2.5) {
      const posts =
        w.garden || w.courtBay ? [-w.length * 0.45, w.length * 0.45] : [-w.length * 0.46];
      for (const u of posts) {
        field(
          out,
          w,
          'trim',
          'lime',
          p,
          u - 0.095,
          u + 0.095,
          w.garden ? 1.73 : 0.38,
          w.top - 0.51,
          0.058,
        );
        if (detail >= 3)
          for (let y = w.garden ? 2.0 : 0.64; y < w.top - 0.49; y += 0.57) {
            field(out, w, 'trim', 'edge', p, u - 0.12, u + 0.12, y, y + 0.023, 0.063);
          }
      }
    }
  }
}
function buildRoofs(out, detail) {
  for (const roof of layout.roofs) {
    const edges = new Map();
    for (const [section, { vertices, triangles }] of roof.panels.entries()) {
      for (const ids of triangles) {
        const [a, b, c] = ids.map((i) => vertices[i]);
        if (!Math.hypot(...normalFor(a, b, c))) continue;
        surface(out, 'slate', section % 2 ? 'slate' : 'slateLight', [a, b, c], up);
        for (const [v, w] of [
          [a, b],
          [b, c],
          [c, a],
        ]) {
          const key = [v.join(','), w.join(',')].sort().join(':');
          if (edges.has(key)) edges.delete(key);
          else edges.set(key, [v, w]);
        }
      }
    }
    for (const [a, b] of edges.values()) {
      const closeSkylineGable =
        roof.x === -26.3 &&
        Math.abs(a[2] - b[2]) < 0.0001 &&
        Math.abs(Math.abs(a[2] - roof.z) - roof.d / 2) < 0.001;
      if (detail === 0 && !closeSkylineGable) continue;
      if (Math.max(a[1], b[1]) < roof.y + 0.024) continue;
      const bottomA = [a[0], roof.y - 0.022, a[2]],
        bottomB = [b[0], roof.y - 0.022, b[2]];
      const n = [(a[0] + b[0]) / 2 - roof.x, 0, (a[2] + b[2]) / 2 - roof.z];
      surface(out, 'slate', 'slate', [bottomA, bottomB, b, a], n);
    }
    if (detail === 0) continue;
    for (let i = 0; i < roof.dormers; i++) {
      const along = (i + 0.5) / roof.dormers - 0.5,
        onX = roof.cross === 'z';
      const x = roof.x + (onX ? along * roof.w * 0.91 : -roof.w * 0.365),
        z = roof.z + (onX ? -roof.d * 0.365 : along * roof.d * 0.91);
      const point = roof.panels.some((p) =>
        p.triangles.some((ids) => {
          const pts = ids.map((i) => p.vertices[i]);
          const sides = pts.map((a, j) => {
            const b = pts[(j + 1) % 3];
            return (b[0] - a[0]) * (z - a[2]) - (b[2] - a[2]) * (x - a[0]);
          });
          return sides.every((v) => v >= 0) || sides.every((v) => v <= 0);
        }),
      );
      if (!point) continue;
      const y = roof.y + roof.high * 0.48;
      block(out, 'slate', 'slate', x, z, y, onX ? 1.33 : 0.85, onX ? 0.85 : 1.33, 1.48, 0.04);
      block(
        out,
        'trim',
        'cap',
        x + (onX ? 0 : -0.45),
        z + (onX ? -0.45 : 0),
        y + 0.13,
        onX ? 1.13 : 0.13,
        onX ? 0.13 : 1.13,
        1.13,
      );
      const n = onX ? [0, 0, -1] : [-1, 0, 0];
      const p = (u, v, o) => (onX ? [x + u, v, z - 0.52 - o] : [x - 0.52 - o, v, z + u]);
      aperture(out, { n }, p, 0, y + 0.19, 0.84, 0.93, 0.13, detail, 'paneBlue');
      const skirt = [
        p(-0.77, y + 1.27, -0.64),
        p(0.77, y + 1.27, -0.64),
        p(0.77, y + 1.27, 0.08),
        p(-0.77, y + 1.27, 0.08),
      ];
      const ridge = [
        p(-0.15, y + 1.6, -0.61),
        p(0.15, y + 1.6, -0.61),
        p(0.15, y + 1.6, 0.01),
        p(-0.15, y + 1.6, 0.01),
      ];
      const rev = !onX;
      loft(
        out,
        'slate',
        rev ? [skirt.toReversed(), ridge.toReversed()] : [skirt, ridge],
        colors.slateLight,
      );
    }
  }
  for (const [x, z, y] of [
    [-21.7, -11.0, 14.24],
    [-29.4, 17.3, 14.15],
    [-8.5, -27.5, 13.04],
    [13, -27.5, 13.13],
    [29.7, -23.7, 13.0],
    [28.8, 20.7, 12.5],
  ]) {
    block(
      out,
      'trim',
      'cap',
      x,
      z,
      y - 0.48,
      1.02,
      0.65,
      detail === 0 ? 1.41 : 1.7,
      detail === 0 ? 0 : 0.04,
    );
    if (detail >= 2) block(out, 'trim', 'soft', x, z, y + 1.2, 1.16, 0.78, 0.13, 0.03);
  }
}
function rails(out, p, spans, y, detail, iron = false) {
  const slot = iron ? 'painted' : 'trim',
    tint = iron ? 'rail' : 'cap',
    h = iron ? 0.75 : 0.63;
  for (const [a, b] of spans) {
    const cross = iron ? 0.068 : 0.105;
    if (!iron)
      beamPath(out, slot, [p(a, y + 0.05, 0), p(b, y + 0.05, 0)], cross, 0.23, colors[tint]);
    beamPath(out, slot, [p(a, y + h, 0), p(b, y + h, 0)], cross, iron ? 0.1 : 0.24, colors[tint]);
    if (detail === 0) continue;
    const num = Math.ceil((b - a) / (detail === 1 ? 0.57 : iron ? 0.22 : 0.39));
    for (let i = 0; i <= num; i++) {
      const u = a + ((b - a) * i) / num;
      const q = p(u, y, 0),
        r = iron ? 0.028 : detail >= 3 ? 0.082 : 0.068;
      if (detail === 1) {
        const points = [p(u - r, y, 0), p(u + r, y, 0), p(u + r, y + h, 0), p(u - r, y + h, 0)];
        surface(out, slot, tint, points, [1, 0, 0]);
        surface(out, slot, tint, points, [-1, 0, 0]);
      } else if (iron || detail === 2) block(out, slot, tint, q[0], q[2], q[1], r * 2, r * 2, h);
      else
        loft(
          out,
          slot,
          [0.07, 0.15, 0.28, 0.43, 0.54].map((v, j) =>
            radialRing(y + v, [1, 0.58, 1.26, 0.63, 1][j] * r, [1, 0.58, 1.26, 0.63, 1][j] * r, 6, [
              q[0],
              q[2],
            ]),
          ),
          colors[tint],
        );
    }
  }
}
function architecturalDetails(out, detail) {
  for (const s of layout.steps)
    block(
      out,
      'trim',
      'cap',
      (s.x0 + s.x1) / 2,
      s.z,
      s.base,
      s.x1 - s.x0 + 0.008,
      s.w,
      s.y - s.base,
    );
  block(out, 'trim', 'lime', -37.56, 3.48, -0.65, 2.57, 38.6, 2.03, 0.1);
  const garden = (u, y, o) => [-37.27 - o, y, 3.57 + u];
  const court = (u, y, o) => [-14.54 + o, y, 11.14 - u];
  for (const [p, visible] of [
    [garden, true],
    [court, false],
  ]) {
    const n = visible ? [-1, 0, 0] : [1, 0, 0],
      height = visible ? 12.04 : 12.15;
    if (visible) {
      const g = (u, y, o) => p(u, y, o - 0.27);
      const front = [g(-4.2, height, 0), g(4.2, height, 0), g(0, height + 1.87, 0)];
      const back = front.map((p) => [p[0] + 1.94, p[1], p[2]]);
      surface(out, 'trim', 'lime', front, n);
      surface(out, 'trim', 'cap', back, [1, 0, 0]);
      for (const i of [0, 1])
        surface(out, 'trim', 'cap', [front[i], front[2], back[2], back[i]], up);
      if (detail) surface(out, 'trim', 'soft', [front[0], front[1], back[1], back[0]], [0, -1, 0]);
      beamPath(
        out,
        'trim',
        [g(-4.3, height + 0.03, 0.09), g(0, height + 1.93, 0.09), g(4.3, height + 0.03, 0.09)],
        0.21,
        0.14,
        colors.cap,
      );
      if (detail >= 2) ornament(out, g, 0, height + 0.67, 1.76, detail);
    }
    if (detail >= 1) {
      const q = p(0, 0, 0.53);
      block(out, 'trim', 'cap', q[0], q[2], 6.33, 1.35, 5.58, 0.25, 0.08);
      rails(out, (u, y, o) => p(u, y, 0.92 + o), [[-2.56, 2.56]], 6.59, detail, true);
      if (detail >= 2)
        for (const u of [-2.17, -1.17, 1.17, 2.17]) {
          const q = p(u, 0, 0.3);
          block(out, 'trim', 'soft', q[0], q[2], 5.95, 0.55, 0.34, 0.45, 0.045);
        }
    }
  }
  const terrace = (u, y, o) => [-38.7 - o, y, 3.48 + u];
  rails(
    out,
    terrace,
    [
      [-18.66, -8.33],
      [8.33, 18.66],
    ],
    1.39,
    detail,
  );
  const mainRoof = (u, y, o) => [-34.96 - o, y, 3.55 + u];
  if (detail >= 1)
    rails(
      out,
      mainRoof,
      [
        [-18.75, -10.5],
        [-9.6, -4.4],
        [4.4, 10.9],
        [11.8, 18.55],
      ],
      12.16,
      detail,
    );
  if (detail >= 2) {
    for (const [x, z] of [
      [-38.48, -4.76],
      [-38.48, 11.8],
    ]) {
      block(out, 'trim', 'soft', x, z, 1.42, 0.93, 0.93, 0.75, 0.047);
      const ring = [
        [2.16, 0.26],
        [2.23, 0.32],
        [2.31, 0.22],
        [2.47, 0.39],
        [2.65, 0.43],
        [2.82, 0.36],
        [2.87, 0.45],
      ];
      loft(
        out,
        'trim',
        ring.map(([y, r]) => radialRing(y, r, r, 12, [x, z])),
        colors.bright,
      );
    }
  }
}
export function buildMatignonLevel(out, level) {
  const detail = levels[level];
  mainShell(out);
  buildRoofs(out, detail);
  elevations(out, detail);
  architecturalDetails(out, detail);
}
export const buildMatignonSkyline = (out) => buildMatignonLevel(out, 'skyline');
export const buildMatignonDistrict = (out) => buildMatignonLevel(out, 'district');
export const buildMatignonStreet = (out) => buildMatignonLevel(out, 'street');
export const buildMatignonCloseup = (out) => buildMatignonLevel(out, 'closeup');
