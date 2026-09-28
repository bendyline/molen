/** 200 Park Avenue: octagonal precast tower and renewed north colonnade. */
import { ShapeUtils, Vector2 } from 'three';
import { loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import {
  clockwise,
  face,
  grid,
  mappedCap,
  mappedSolid,
  partPlan,
  partsEvidence,
  tri,
} from './signature-tower-expansion-models.mjs';
import { box, tube } from './structure-mesh.mjs';

const concrete = [0.69, 0.675, 0.625],
  glass = [0.105, 0.19, 0.235],
  bronze = [0.19, 0.155, 0.105],
  pale = [0.79, 0.755, 0.67];

function clean(p) {
  for (let k = 0; k < 4; k++)
    p = p.filter((b, i) => {
      const a = p[(i + p.length - 1) % p.length],
        c = p[(i + 1) % p.length],
        l = Math.hypot(c[0] - a[0], c[1] - a[1]);
      return (
        l < 0.05 ||
        Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / l > 0.08
      );
    });
  return clockwise(p);
}
function edges(plan) {
  return plan
    .map((a, i) => {
      const b = plan[(i + 1) % plan.length],
        length = Math.hypot(b[0] - a[0], b[1] - a[1]),
        u = [(b[0] - a[0]) / length, 0, (b[1] - a[1]) / length],
        n = [-u[2], 0, u[0]];
      return {
        a,
        b,
        length,
        n,
        at: (x, y, d = 0) => [a[0] + u[0] * x + n[0] * d, y, a[1] + u[2] * x + n[2] * d],
      };
    })
    .filter((e) => e.length > 0.04);
}
function pane(out, at, x0, x1, y0, y1, slot, color, depth = 0) {
  if (x1 - x0 < 0.01 || y1 - y0 < 0.01) return;
  face(
    out,
    slot,
    [at(x0, y0, depth), at(x1, y0, depth), at(x1, y1, depth), at(x0, y1, depth)],
    color,
  );
}
function relief(out, at, x0, x1, y0, y1, depth, color = concrete, slot = 'concrete') {
  const p = [at(x0, y0, depth), at(x1, y0, depth), at(x1, y1, depth), at(x0, y1, depth)],
    q = [at(x0, y0, -0.25), at(x1, y0, -0.25), at(x1, y1, -0.25), at(x0, y1, -0.25)];
  face(out, slot, p, color);
  for (let i = 0; i < 4; i++) face(out, slot, [p[i], q[i], q[(i + 1) % 4], p[(i + 1) % 4]], color);
}

/** Independently glazed precast units, with real projecting fins and deep returns. */
function precast(out, plan, lo, hi, floors, base = false) {
  for (const { length, at } of edges(plan)) {
    const count = Math.max(1, Math.round(length / 1.8288)),
      pitch = length / count,
      dy = (hi - lo) / floors;
    for (let row = 0; row < floors; row++)
      for (let col = 0; col < count; col++) {
        const x0 = col * pitch + 0.013,
          x1 = (col + 1) * pitch - 0.013,
          y0 = lo + row * dy + 0.015,
          y1 = lo + (row + 1) * dy - 0.015,
          wx0 = x0 + 0.235,
          wx1 = x1 - 0.235,
          wy0 = y0 + (base ? 0.96 : 1.17),
          wy1 = y1 - 0.42,
          tint = concrete.map((v) => v * (1 + 0.012 * Math.sin(col * 4.13 + row * 2.41)));
        relief(out, at, x0, x1, y0, wy0, 0, tint);
        relief(out, at, x0, x1, wy1, y1, 0, tint);
        relief(out, at, x0, wx0, wy0, wy1, 0, tint);
        relief(out, at, wx1, x1, wy0, wy1, 0, tint);
        // Thin cast fin on the left jamb. Four sloped return faces give it depth.
        const fx = x0 + 0.065,
          fw = 0.135;
        const low = [at(fx, y0, 0), at(fx + fw, y0, 0.33), at(fx + fw + 0.1, y0, 0)],
          high = low.map(([x, _y, z]) => [x, y1, z]);
        for (let i = 0; i < 3; i++)
          face(out, 'concrete', [low[i], low[(i + 1) % 3], high[(i + 1) % 3], high[i]], tint);
        tri(out, 'concrete', [...high].toReversed(), tint);
        tri(out, 'concrete', low, tint);
        grid(
          out,
          [at(wx0, wy0, -0.245), at(wx1, wy0, -0.245), at(wx1, wy1, -0.245), at(wx0, wy1, -0.245)],
          glass.map((v) => v * (0.95 + 0.09 * Math.sin(col * 2.7 + row * 1.9))),
          3,
          4,
          0.045,
          [0.24, 0.265, 0.26],
        );
        // Horizontal upper ventilator/transom follows the present restoration photos.
        pane(out, at, wx0, wx1, wy1 - 0.56, wy1 - 0.52, 'metal', [0.31, 0.34, 0.33], -0.19);
      }
  }
}

function recess(out, plan, lo, hi) {
  const center = plan.reduce(
      (s, p) => [s[0] + p[0] / plan.length, s[1] + p[1] / plan.length],
      [0, 0],
    ),
    inner = plan.map(([x, z]) => [
      center[0] + (x - center[0]) * 0.91,
      center[1] + (z - center[1]) * 0.96,
    ]);
  mappedCap(out, 'concrete', plan, lo, concrete, [inner]);
  mappedCap(out, 'concrete', plan, hi, concrete, [inner], true);
  for (const { length, at } of edges(inner))
    grid(
      out,
      [at(0, lo), at(length, lo), at(length, hi), at(0, hi)],
      [0.09, 0.13, 0.14],
      2.1,
      6,
      0.06,
      bronze,
    );
  for (const { length, at } of edges(plan)) {
    const n = Math.max(1, Math.round(length / 4.8768));
    for (let i = 0; i <= n; i++)
      relief(
        out,
        at,
        Math.max(0, (i * length) / n - 0.3),
        Math.min(length, (i * length) / n + 0.3),
        lo,
        hi,
        0.025,
        concrete,
      );
    pane(out, at, 0, length, lo, lo + 0.18, 'concrete', concrete, 0.03);
  }
}

/** Original polygonal letter outlines; no copied font or per-model texture. */
function extrudedLetter(out, outline, holes, at, x, y, scale) {
  const orient = (ring, reverse = false) => {
    const area = ring.reduce((sum, p, i) => {
      const q = ring[(i + 1) % ring.length];
      return sum + p[0] * q[1] - q[0] * p[1];
    }, 0);
    return area < 0 !== reverse ? ring.toReversed() : ring;
  };
  outline = orient(outline);
  holes = holes.map((r) => orient(r, true));
  const all = [outline, ...holes],
    flat = all.flat(),
    points = flat.map((p) => at(x + p[0] * scale, y + p[1] * scale, 0.65));
  for (const ix of ShapeUtils.triangulateShape(
    outline.map((p) => new Vector2(...p)),
    holes.map((h) => h.map((p) => new Vector2(...p))),
  )) {
    let p = ix.map((i) => points[i]);
    const normal = normalFor(...p),
      target = normalFor(at(0, 0), at(1, 0), at(0, 1));
    if (normal.reduce((s, v, i) => s + v * target[i], 0) < 0) p = p.toReversed();
    tri(out, 'metal', p, [0.94, 0.95, 0.93]);
  }
  for (const ring of all)
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length];
      face(
        out,
        'metal',
        [
          at(x + a[0] * scale, y + a[1] * scale, 0.65),
          at(x + a[0] * scale, y + a[1] * scale, 0.25),
          at(x + b[0] * scale, y + b[1] * scale, 0.25),
          at(x + b[0] * scale, y + b[1] * scale, 0.65),
        ],
        [0.83, 0.85, 0.82],
      );
    }
}
function sign(out, at) {
  const rect = (x0, y0, x1, y1) => [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
    ],
    glyph = (p, x, w, holes = []) => {
      extrudedLetter(out, p, holes, at, x, 237, 5.5);
      return x + w * 5.5 + 0.48;
    },
    e = [
      [0.72, 0.1],
      [0.63, 0.22],
      [0.56, 0.15],
      [0.36, 0.14],
      [0.22, 0.2],
      [0.16, 0.31],
      [0.74, 0.31],
      [0.74, 0.46],
      [0.69, 0.6],
      [0.58, 0.69],
      [0.41, 0.72],
      [0.22, 0.68],
      [0.09, 0.56],
      [0.035, 0.39],
      [0.065, 0.2],
      [0.2, 0.05],
      [0.39, 0],
      [0.59, 0.025],
    ],
    counter = [
      [0.2, 0.45],
      [0.56, 0.45],
      [0.54, 0.53],
      [0.46, 0.58],
      [0.33, 0.58],
      [0.24, 0.53],
    ];
  let x = -13.5675;
  x = glyph(
    [
      [0, 0],
      [0, 1],
      [0.19, 1],
      [0.47, 0.38],
      [0.74, 1],
      [0.93, 1],
      [0.93, 0],
      [0.75, 0],
      [0.75, 0.66],
      [0.52, 0.14],
      [0.4, 0.14],
      [0.18, 0.66],
      [0.18, 0],
    ],
    x,
    0.93,
  );
  x = glyph(e, x, 0.74, [counter]);
  x = glyph(
    [
      [0.16, 0.7],
      [0.16, 0.95],
      [0.32, 0.95],
      [0.32, 0.7],
      [0.56, 0.7],
      [0.56, 0.55],
      [0.32, 0.55],
      [0.32, 0.19],
      [0.37, 0.14],
      [0.55, 0.14],
      [0.55, 0],
      [0.29, 0],
      [0.16, 0.1],
      [0.16, 0.55],
      [0, 0.55],
      [0, 0.7],
    ],
    x,
    0.56,
  );
  x = glyph(
    [
      [0, 0],
      [0, 1],
      [0.18, 1],
      [0.18, 0.17],
      [0.7, 0.17],
      [0.7, 0],
    ],
    x,
    0.7,
  );
  extrudedLetter(out, rect(0, 0.79, 0.17, 0.98), [], at, x, 237, 5.5);
  x = glyph(rect(0, 0, 0.17, 0.7), x, 0.17);
  x = glyph(
    [
      [0.15, 0],
      [0.15, 0.55],
      [0, 0.55],
      [0, 0.7],
      [0.15, 0.7],
      [0.15, 0.83],
      [0.23, 0.97],
      [0.35, 1.02],
      [0.57, 1.02],
      [0.57, 0.86],
      [0.37, 0.86],
      [0.32, 0.8],
      [0.32, 0.7],
      [0.53, 0.7],
      [0.53, 0.55],
      [0.32, 0.55],
      [0.32, 0],
    ],
    x,
    0.57,
  );
  glyph(e, x, 0.74, [counter]);
}

function crown(out, plan) {
  const inner = plan.map(([x, z]) => [-11 + (x + 11) * 0.985, z * 0.985]);
  for (const { length, at } of edges(inner)) {
    pane(out, at, 0, length, 232, 245.6, 'metal', [0.16, 0.175, 0.175]);
    for (let y = 232.4; y < 245.4; y += 0.42)
      pane(out, at, 0, length, y, y + 0.065, 'metal', [0.34, 0.35, 0.33], 0.05);
  }
  for (const { length, at } of edges(plan)) {
    const n = Math.max(1, Math.round(length / 1.8288));
    for (let i = 0; i <= n; i++)
      relief(
        out,
        at,
        Math.max(0, (i * length) / n - 0.13),
        Math.min(length, (i * length) / n + 0.13),
        232,
        245.3,
        0.33,
        concrete,
      );
    relief(out, at, 0, length, 245.3, 246.3, 0.42, [0.34, 0.35, 0.33], 'metal');
  }
  mappedCap(out, 'concrete', plan, 246.3, [0.33, 0.35, 0.34]);
  // Current wordmarks face north and south, centered on the wide flat walls.
  for (const side of [-1, 1])
    sign(out, (x, y, d = 0) => [side > 0 ? 9.95 + d : -32.35 - d, y, -side * x]);
}

function revolvingDoor(out, x, z) {
  for (const y of [0.06, 3.45])
    loft(
      out,
      'metal',
      [radialRing(y, 1.1, 1.1, 48, [x, z]), radialRing(y + 0.12, 1.1, 1.1, 48, [x, z])],
      bronze,
    );
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2,
      b = ((i + 1) / 48) * Math.PI * 2;
    if (Math.abs(Math.cos((a + b) / 2)) > 0.78) continue;
    face(
      out,
      'clear_glass',
      [
        [x + Math.cos(a) * 1.08, 0.18, z + Math.sin(a) * 1.08],
        [x + Math.cos(b) * 1.08, 0.18, z + Math.sin(b) * 1.08],
        [x + Math.cos(b) * 1.08, 3.43, z + Math.sin(b) * 1.08],
        [x + Math.cos(a) * 1.08, 3.43, z + Math.sin(a) * 1.08],
      ].toReversed(),
      [0.62, 0.71, 0.7],
    );
  }
  tube(out, 'metal', [x, 0.1, z], [x, 3.5, z], 0.055, bronze, 8);
  for (let i = 0; i < 3; i++) {
    const a = 0.2 + (i * Math.PI * 2) / 3,
      p = [x + Math.cos(a) * 1.04, 0.2, z + Math.sin(a) * 1.04];
    face(out, 'clear_glass', [[x, 0.2, z], p, [p[0], 3.4, p[2]], [x, 3.4, z]], [0.57, 0.67, 0.68]);
    tube(out, 'metal', p, [p[0], 3.4, p[2]], 0.035, bronze, 8);
  }
}

function base(out, plan) {
  mappedCap(out, 'concrete', plan, 0, [0.47, 0.47, 0.44], [], true);
  mappedCap(out, 'concrete', plan, 30, [0.47, 0.47, 0.44]);
  precast(out, plan, 10, 30, 5, true);
  for (const { a, b, length, at, n } of edges(plan)) {
    const isNorth = a[0] > 55 && b[0] > 55;
    if (isNorth) {
      // Recess the entire frontage behind the current travertine arcade.
      grid(
        out,
        [at(0, 0, -5.3), at(length, 0, -5.3), at(length, 9.7, -5.3), at(0, 9.7, -5.3)],
        glass,
        3,
        5,
        0.1,
        bronze,
      );
      face(
        out,
        'travertine',
        [at(0, 9.9), at(length, 9.9), at(length, 9.9, -5.5), at(0, 9.9, -5.5)].toReversed(),
        pale,
      );
      const count = Math.max(1, Math.round(length / 8.1));
      for (let i = 0; i <= count; i++)
        relief(
          out,
          at,
          Math.max(0, (i * length) / count - 0.58),
          Math.min(length, (i * length) / count + 0.58),
          0,
          10,
          0.35,
          pale,
          'travertine',
        );
    } else {
      grid(
        out,
        [at(0, 0.35, -0.5), at(length, 0.35, -0.5), at(length, 9.85, -0.5), at(0, 9.85, -0.5)],
        glass,
        3.4,
        5,
        0.105,
        bronze,
      );
      const count = Math.max(1, Math.round(length / 7.3));
      for (let i = 0; i <= count; i++)
        relief(
          out,
          at,
          Math.max(0, (i * length) / count - 0.45),
          Math.min(length, (i * length) / count + 0.45),
          0,
          10,
          0.3,
          pale,
          'travertine',
        );
    }
    // Continuous pale fascia above the arcade; no solid wall across the entrance recess.
    pane(out, at, 0, length, 9.65, 10.02, 'travertine', pale, 0.35);
    if (Math.abs(n[2]) > 0.9 && length > 10) {
      for (let u = 3; u < length - 2; u += 9) {
        const p = at(u, 0, 0.7);
        box(out, 'metal', [p[0] - 0.8, 0, p[2] - 0.8], [p[0] + 0.8, 0.6, p[2] + 0.8], bronze);
      }
    }
  }
  for (const z of [-4.7, 0, 4.7]) revolvingDoor(out, 52.1, z);
  // North entrance plaque and understated physical canopy lighting.
  box(out, 'metal', [51.35, 3.7, -10.2], [51.75, 4.25, 10.2], bronze);
  for (let z = -39; z <= 39; z += 3.25)
    box(out, 'metal', [53.8, 9.52, z - 0.045], [54.12, 9.57, z + 0.045], [0.9, 0.82, 0.61]);
}

export function buildMetlife(out, mapped) {
  const parts = partsEvidence('n0192_metlife_building'),
    get = (id) =>
      clean(
        partPlan(
          mapped,
          parts.find((p) => p.id === id),
        ),
      ),
    shaft = get(137564641),
    lower = get(1487962793),
    upper = get(137565295);
  base(out, lower);
  mappedSolid(out, 'metal', upper, 30, 38, [0.3, 0.315, 0.31]);
  for (const { length, at } of edges(upper))
    grid(
      out,
      [at(0, 30.2, 0.03), at(length, 30.2, 0.03), at(length, 37.8, 0.03), at(0, 37.8, 0.03)],
      glass,
      2.1,
      3.8,
      0.1,
      [0.43, 0.44, 0.4],
    );
  for (const p of parts.filter((p) => p.id >= 1487962789 && p.id <= 1487962792))
    mappedSolid(out, 'concrete', clean(partPlan(mapped, p)), 30, 38, concrete);
  precast(out, shaft, 38, 84, 11);
  recess(out, shaft, 84, 88.2);
  precast(out, shaft, 88.2, 188.5, 24);
  recess(out, shaft, 188.5, 192.7);
  precast(out, shaft, 192.7, 232, 10);
  crown(out, shaft);
  // Separate terrace guard around the mapped podium roof; no giant tower bbox shell.
  for (const { a, b, length, at } of edges(lower)) {
    if (length < 3) continue;
    grid(
      out,
      [at(0, 30.05, -0.35), at(length, 30.05, -0.35), at(length, 31.3, -0.35), at(0, 31.3, -0.35)],
      [0.36, 0.46, 0.46],
      2.8,
      2,
      0.055,
      bronze,
    );
    if (Math.abs(a[1]) > 40 && Math.abs(b[1]) > 40)
      for (let u = 3; u < length - 3; u += 7) {
        const p = at(u, 30, -1.6);
        box(out, 'metal', [p[0] - 1.6, 30, p[2] - 0.55], [p[0] + 1.6, 30.7, p[2] + 0.55], bronze);
        box(
          out,
          'foliage',
          [p[0] - 1.5, 30.7, p[2] - 0.48],
          [p[0] + 1.5, 31.15, p[2] + 0.48],
          [0.16, 0.24, 0.125],
        );
      }
  }
}
