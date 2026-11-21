import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { transform } from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { lettering } from '../../../../../../../../packages/worldgen/scripts/stadium-lettering.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import { surfaces } from './ben-gurion-exhibit-model.mjs';

export { surfaces };

const layout = JSON.parse(readFileSync(new URL('../archive-apron-layout.json', import.meta.url)));
const ref = 'palette:#ffffff';
const concrete = [0.44, 0.455, 0.45];
const grayWing = [0.62, 0.64, 0.65];
const rubber = [0.087, 0.091, 0.095];
const linen = [0.83, 0.84, 0.8];
const blue = [0.083, 0.217, 0.29];
const red = [0.65, 0.08, 0.049];
const yellow = [0.85, 0.62, 0.11];
const livery = {
  blue: {
    upper: [0.57, 0.68, 0.7],
    lower: blue,
    fin: [0.086, 0.32, 0.41],
    accent: [0.64, 0.31, 0.095],
  },
  dhl: { upper: yellow, lower: [0.74, 0.49, 0.06], fin: yellow, accent: red },
  'red-blue': { upper: [0.76, 0.75, 0.72], lower: [0.068, 0.117, 0.28], fin: red, accent: red },
  'white-wide': { upper: linen, lower: [0.59, 0.63, 0.64], fin: [0.18, 0.24, 0.28] },
  silver: { upper: [0.6, 0.63, 0.65], lower: [0.41, 0.45, 0.47], fin: [0.55, 0.58, 0.58] },
  'rear-white': { upper: linen, lower: [0.53, 0.56, 0.56], fin: linen },
  'rear-grey': { upper: [0.67, 0.69, 0.68], lower: [0.26, 0.31, 0.33], fin: blue },
};
const profile = {
  'wide-twin': { body: 0.059, span: 0.48, sweep: 0.25, nacelle: 0.031, tTail: false },
  freighter: { body: 0.062, span: 0.46, sweep: 0.27, nacelle: 0.033, tTail: false },
  'narrow-twin': { body: 0.048, span: 0.41, sweep: 0.2, nacelle: 0.025, tTail: false },
  regional: { body: 0.049, span: 0.42, sweep: 0.16, nacelle: 0.023, tTail: true },
};
const settings = {
  skyline: { sides: 4, engines: false, markings: false, windows: 0, rails: false },
  district: { sides: 8, engines: true, markings: true, windows: 0, rails: false },
  street: { sides: 12, engines: true, markings: true, windows: 18, rails: true },
  closeup: { sides: 18, engines: true, markings: true, windows: 28, rails: true },
  master: { sides: 24, engines: true, markings: true, windows: 36, rails: true },
};
const shade = (rgb, value) => rgb.map((n) => n * value);
const vertex = ([x, z], y = 0) => [x, y, z];
function face(out, slot, vertices, color) {
  const normal = normalFor(...vertices);
  const uv = ([x, y, z]) => [x + 0.4 * y, z + 0.4 * y];
  out.addConvexPolygon(slot, ref, vertices, normal, uv, color);
}
function topFace(out, slot, vertices, color) {
  if (normalFor(...vertices)[1] < 0) vertices.reverse();
  face(out, slot, vertices, color);
}
function paintLine(out, [ax, az], [bx, bz], width, color) {
  const dx = bx - ax,
    dz = bz - az;
  const offset = width / (2 * Math.hypot(dx, dz));
  const ox = offset * dz,
    oz = -offset * dx;
  topFace(
    out,
    'marking',
    [
      [ax - ox, 0.004, az - oz],
      [bx - ox, 0.004, bz - oz],
      [bx + ox, 0.004, bz + oz],
      [ax + ox, 0.004, az + oz],
    ],
    color,
  );
}
function apron(out, detail) {
  const center = layout.outline.reduce(
    (mean, point) => mean.map((v, i) => v + point[i] / layout.outline.length),
    [0, 0],
  );
  for (const [i, point] of layout.outline.entries()) {
    const next = layout.outline[(i + 1) % layout.outline.length];
    const material = shade(concrete, [0.988, 1.015, 1.003, 0.975][i % 4]);
    topFace(out, 'apron', [vertex(center), vertex(point), vertex(next)], material);
    face(
      out,
      'apron',
      [vertex(next), vertex(point), vertex(point, -0.49), vertex(next, -0.49)],
      shade(material, 0.78),
    );
  }
  if (!detail.markings) return;
  for (const { center: point, radii } of layout.pads) {
    const vertices = radialRing(0.003, ...radii, detail.rails ? 20 : 8, point);
    topFace(out, 'marking', vertices, [0.62, 0.63, 0.6]);
  }
  for (const { points, kind } of layout.lines) {
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1],
        b = points[i];
      if (kind === 'rail') {
        if (!detail.rails) continue;
        for (const y of [0.24, 0.39])
          beam(out, 'paint', vertex(a, y), vertex(b, y), 0.012, 0.012, [0.27, 0.3, 0.29]);
        const posts = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 1.5);
        for (let count = 0; count <= posts; count++) {
          const t = count / posts;
          const p = a.map((value, j) => value + (b[j] - value) * t);
          beam(out, 'paint', vertex(p), vertex(p, 0.4), 0.022, 0.022, [0.24, 0.26, 0.23]);
        }
      } else {
        paintLine(
          out,
          a,
          b,
          kind === 'track' ? 0.046 : 0.037,
          kind === 'track' ? [0.16, 0.17, 0.16] : [0.75, 0.64, 0.3],
        );
      }
    }
  }
}
function shell(out, profile, colors, detail) {
  const stations = [
    [-0.5, 0.12, 0.09],
    [-0.38, 0.7, 0.04],
    [-0.26, 1, 0],
    [0.29, 1, 0],
    [0.405, 0.83, 0.01],
    [0.475, 0.51, 0.005],
    [0.5, 0.11, 0],
  ];
  const rings = stations.map(([z, scale, y]) =>
    Array.from({ length: detail.sides }, (_, i) => {
      const angle = (2 * Math.PI * i) / detail.sides;
      return [
        profile.body * scale * Math.cos(angle),
        profile.body * (y + scale * Math.sin(angle)),
        z,
      ];
    }),
  );
  for (let row = 1; row < rings.length; row++)
    for (let i = 0; i < detail.sides; i++) {
      const next = (i + 1) % detail.sides;
      const color = i < detail.sides / 2 ? colors.upper : colors.lower;
      face(
        out,
        'paint',
        [rings[row - 1][i], rings[row - 1][next], rings[row][next], rings[row][i]],
        color,
      );
    }
  face(out, 'paint', rings[0].toReversed(), colors.lower);
  face(out, 'paint', rings.at(-1), colors.upper);
  if (!detail.windows) return;
  for (const side of [-1, 1]) {
    // Reuse the ring facets to put the printed windows flush with the shell.
    const y = profile.body * 0.38;
    const step = (2 * Math.PI) / detail.sides;
    const xAt = (height) => {
      const t = Math.floor(Math.asin(height / profile.body) / step) * step;
      const u = t + step;
      return (
        profile.body *
          (Math.cos(t) +
            ((Math.cos(u) - Math.cos(t)) * (height / profile.body - Math.sin(t))) /
              (Math.sin(u) - Math.sin(t))) +
        0.0008
      );
    };
    if (colors === livery.dhl) {
      const print = (slot, _ref, points, _normal, _uv, color) => {
        face(
          out,
          slot,
          points.map(([u, height, depth]) => [
            side * (xAt(height) + depth),
            height,
            0.11 - side * u,
          ]),
          color,
        );
      };
      lettering({ addQuad: print, addConvexPolygon: print }, 'DHL', {
        slot: 'marking',
        width: 0.24,
        height: 0.027,
        y: 0.01,
        stroke: 0.004,
        color: red,
      });
    } else {
      const dx = xAt(y);
      for (let i = 0; i < detail.windows; i++) {
        const z = -0.245 + (0.535 * (i + 0.5)) / detail.windows;
        const p = [
          [side * dx, y - 0.0037, z - 0.003],
          [side * dx, y + 0.0037, z - 0.003],
          [side * dx, y + 0.0037, z + 0.003],
          [side * dx, y - 0.0037, z + 0.003],
        ];
        face(out, 'paint', side > 0 ? p : p.reverse(), rubber);
      }
    }
    const r = profile.body;
    const screen = [
      [side * r * 0.805, r * 0.41, 0.405],
      [side * r * 0.522, r * 0.24, 0.475],
      [side * r * 0.49, r * 0.41, 0.465],
      [side * r * 0.72, r * 0.61, 0.398],
    ];
    face(out, 'paint', side > 0 ? screen : screen.toReversed(), rubber);
  }
}
function vane(out, points, color, quick) {
  if (quick) {
    face(out, 'paint', points, color);
    face(out, 'paint', points.toReversed(), color);
  } else {
    loft(out, 'paint', [points.map(([x, y, z]) => [x, y - 0.007, z]), points], color);
  }
}
function aircraft(out, plane, detail) {
  const colors = livery[plane.id],
    form = profile[plane.profile];
  const [x, z] = plane.position;
  const length = plane.length;
  // Build the airframe in length-relative dimensions and place it in apron meters.
  const turn = transform(out, plane.heading, [x, plane.fuselageHeight, z]);
  const size = (points) => points.map((p) => p.map((v) => v * length));
  const body = {
    addTriangle(slot, _ref, points, _normal, _uv, color) {
      face(turn, slot, size(points), color);
    },
    addQuad(slot, _ref, points, _normal, _uv, color) {
      face(turn, slot, size(points), color);
    },
    addConvexPolygon(slot, _ref, points, _normal, _uv, color) {
      face(turn, slot, size(points), color);
    },
  };
  shell(body, form, colors, detail);
  const fin = [
    [0, 0, -0.49],
    [0, 0.17, -0.46],
    [0, 0.168, -0.402],
    [0, 0, -0.22],
  ];
  face(body, 'paint', fin, colors.fin);
  face(body, 'paint', fin.toReversed(), colors.fin);
  if (colors.accent && detail.markings) {
    const stripe = [
      [0.0006, 0.09, -0.472],
      [0.0006, 0.111, -0.467],
      [0.0006, 0.111, -0.399],
      [0.0006, 0.09, -0.369],
    ];
    face(body, 'paint', stripe, colors.accent);
    face(body, 'paint', stripe.map(([x, y, z]) => [-x, y, z]).reverse(), colors.accent);
  }
  for (const side of [-1, 1]) {
    const wing = [
      [side * 0.036, -0.018, 0.15],
      [side * form.span, 0.015, -form.sweep],
      [side * form.span, 0.012, -form.sweep - 0.05],
      [side * 0.039, -0.025, -0.18],
    ];
    const tailY = form.tTail ? 0.133 : 0.022;
    const tail = [
      [side * 0.007, tailY, -0.337],
      [side * 0.17, tailY + 0.01, -0.452],
      [side * 0.17, tailY + 0.01, -0.485],
      [side * 0.006, tailY, -0.465],
    ];
    vane(body, side > 0 ? wing : wing.reverse(), grayWing, !detail.engines);
    vane(body, side > 0 ? tail : tail.reverse(), grayWing, !detail.engines);
    if (detail.engines) {
      const offset = form.tTail ? form.body + 0.021 : form.span * 0.38;
      const center = form.tTail ? -0.323 : -0.028;
      const y = form.tTail ? 0.004 : -0.041,
        radii = [0.82, 1, 0.64];
      const rings = radii.map((radius, j) =>
        Array.from({ length: detail.sides }, (_, i) => {
          const a = (2 * Math.PI * i) / detail.sides;
          return [
            side * offset + form.nacelle * radius * Math.cos(a),
            y + form.nacelle * radius * Math.sin(a),
            center + 0.054 - 0.058 * j,
          ];
        }),
      );
      loft(body, 'paint', rings, shade(colors.upper, 0.88));
      const intake = rings[0].map(([x, y, z]) => [
        side * offset + (x - side * offset) * 0.72,
        y + (y - (form.tTail ? 0.004 : -0.041)) * -0.28,
        z + 0.001,
      ]);
      face(body, 'paint', intake, rubber);
    }
  }
  if (plane.id === 'dhl' || plane.id === 'rear-white') {
    beam(
      out,
      'paint',
      [x, 0, z],
      [x, plane.fuselageHeight * 0.94, z],
      0.032,
      0.032,
      [0.36, 0.36, 0.33],
    );
  } else if (detail.engines) {
    const angle = plane.heading,
      c = Math.cos(angle),
      s = Math.sin(angle);
    const mount = transform(out, angle, [x, 0, z]);
    for (const [u, v] of [
      [0, 0.34],
      [-0.062, -0.096],
      [0.062, -0.096],
    ]) {
      beam(
        mount,
        'paint',
        [u * length, 0.024, v * length],
        [u * length, plane.fuselageHeight * 0.94, v * length],
        0.016,
        0.016,
        grayWing,
      );
      box(
        mount,
        'paint',
        [u * length - 0.012, 0, v * length - 0.023],
        [u * length + 0.012, 0.045, v * length + 0.023],
        rubber,
      );
    }
  }
}
export function buildAirportExhibit(out, level) {
  const detail = settings[level];
  apron(out, detail);
  for (const plane of layout.aircraft) aircraft(out, plane, detail);
}
export const buildSkyline = (out) => buildAirportExhibit(out, 'skyline');
export const buildDistrict = (out) => buildAirportExhibit(out, 'district');
export const buildStreet = (out) => buildAirportExhibit(out, 'street');
export const buildCloseup = (out) => buildAirportExhibit(out, 'closeup');
