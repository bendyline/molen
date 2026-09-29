/** Torre Moeve: independent end cores, three suspended office blocks and a curved crown. */
import { ShapeUtils, Vector2 } from 'three';
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import {
  clockwise,
  commonLimit,
  face,
  grid,
  mappedCap,
  mappedSolid,
  tri,
} from './signature-tower-expansion-models.mjs';
import { box } from './structure-mesh.mjs';

const silver = [0.72, 0.75, 0.77],
  black = [0.055, 0.069, 0.076],
  glass = [0.15, 0.23, 0.26];
const top = 248.3,
  halfOffice = 16,
  halfDepth = 21.25,
  coreOuter = 26.5,
  coreDepth = 11.75;
const rect = (x0, z0, x1, z1) =>
  clockwise([
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ]);
const edges = (plan) =>
  plan.map((a, i) => {
    const b = plan[(i + 1) % plan.length],
      length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const u = [(b[0] - a[0]) / length, (b[1] - a[1]) / length],
      n = [-u[1], u[0]];
    return {
      length,
      at: (x, y, d = 0) => [a[0] + u[0] * x + n[0] * d, y, a[1] + u[1] * x + n[1] * d],
    };
  });
function patch(out, slot, at, x0, x1, y0, y1, color, d = 0) {
  face(out, slot, [at(x0, y0, d), at(x1, y0, d), at(x1, y1, d), at(x0, y1, d)], color);
}
function plate(out, at, x0, x1, y0, y1, color, slot = 'stainless', depth = 0.03) {
  const p = [at(x0, y0, depth), at(x1, y0, depth), at(x1, y1, depth), at(x0, y1, depth)],
    q = [at(x0, y0, -0.028), at(x1, y0, -0.028), at(x1, y1, -0.028), at(x0, y1, -0.028)];
  face(out, slot, p, color);
  for (let i = 0; i < 4; i++) face(out, slot, [p[i], q[i], q[(i + 1) % 4], p[(i + 1) % 4]], color);
}
const coreRadius = 2.1;
function innerEdge(z) {
  const t = Math.max(0, Math.abs(z) - (coreDepth - coreRadius));
  return 16 + coreRadius - Math.sqrt(Math.max(0, coreRadius ** 2 - t ** 2));
}
function corePlan(side) {
  const p = [
    [coreOuter, -coreDepth],
    [coreOuter, coreDepth],
  ];
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 24;
    p.push([
      16 + coreRadius + coreRadius * Math.cos(a),
      coreDepth - coreRadius + coreRadius * Math.sin(a),
    ]);
  }
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI + (i * Math.PI) / 24;
    p.push([
      16 + coreRadius + coreRadius * Math.cos(a),
      -coreDepth + coreRadius + coreRadius * Math.sin(a),
    ]);
  }
  return clockwise(p.map(([x, z]) => [side * x, z]));
}
function cores(out) {
  for (const s of [-1, 1]) {
    const plan = corePlan(s);
    mappedCap(out, 'stainless', plan, 0, silver, [], true);
    mappedCap(out, 'stainless', plan, top, silver);
    for (const { length, at } of edges(plan)) {
      const a = at(0, 0),
        b = at(length, 0),
        outer = Math.abs(a[0] - s * coreOuter) < 0.001 && Math.abs(b[0] - s * coreOuter) < 0.001;
      if (outer) {
        // The central panoramic lift strip is dark glass; the two end cheeks are steel.
        for (const [lo, hi] of [
          [0, 4.55],
          [length - 4.55, length],
        ])
          panelField(out, at, lo, hi, 0, top);
        grid(
          out,
          [at(4.55, 0), at(length - 4.55, 0), at(length - 4.55, top), at(4.55, top)],
          glass.map((v) => v * 0.72),
          1.8,
          4.7,
          0.065,
          black,
        );
        for (let y = 4.7; y < top; y += 4.7)
          beam(out, 'metal', at(4.55, y, 0.035), at(length - 4.55, y, 0.035), 0.06, 0.14, silver);
      } else panelField(out, at, 0, length, 0, top);
    }
  }
}
function panelField(out, at, x0, x1, y0, y1) {
  patch(out, 'metal', at, x0, x1, y0, y1, [0.25, 0.28, 0.29], -0.03);
  const nx = Math.ceil((x1 - x0) / 1.12),
    ny = Math.ceil((y1 - y0) / 1.35);
  for (let row = 0; row < ny; row++)
    for (let col = 0; col < nx; col++) {
      const lo = x0 + ((x1 - x0) * col) / nx + 0.009,
        hi = x0 + ((x1 - x0) * (col + 1)) / nx - 0.009,
        bottom = y0 + ((y1 - y0) * row) / ny + 0.009,
        upper = y0 + ((y1 - y0) * (row + 1)) / ny - 0.009;
      plate(
        out,
        at,
        lo,
        hi,
        bottom,
        upper,
        silver.map((v) => v * (0.987 + 0.015 * Math.sin(col * 0.93 + row * 1.7))),
      );
    }
}
function officeBlock(out, y0, rows) {
  const y1 = y0 + rows * 4.7,
    plan = rect(-halfOffice, -halfDepth, halfOffice, halfDepth);
  mappedCap(out, 'metal', plan, y0, black, [], true);
  mappedCap(out, 'metal', plan, y1, black);
  for (const { length, at } of edges(plan)) {
    const count = Math.round(length / 1.5);
    for (let row = 0; row < rows; row++) {
      const y = y0 + row * 4.7;
      // The visually heavy dark horizontal spandrel contains the perimeter Vierendeel beam.
      plate(out, at, 0, length, y, y + 1.13, black, 'metal', 0.08);
      for (let col = 0; col < count; col++) {
        const a = (col * length) / count,
          b = ((col + 1) * length) / count,
          tint = glass.map((v) => v * (0.95 + 0.055 * Math.sin(col * 0.87 + row * 1.31)));
        patch(out, 'glass', at, a + 0.045, b - 0.045, y + 1.13, y + 4.7, tint, -0.08);
        plate(out, at, a, a + 0.045, y + 1.13, y + 4.7, black, 'metal', 0.02);
        plate(out, at, b - 0.045, b, y + 1.13, y + 4.7, black, 'metal', 0.02);
        // Pane-edge return and small horizontal glazing gasket are actual geometry.
        face(
          out,
          'metal',
          [
            at(a + 0.045, y + 1.13, -0.08),
            at(b - 0.045, y + 1.13, -0.08),
            at(b - 0.045, y + 1.13, 0.08),
            at(a + 0.045, y + 1.13, 0.08),
          ],
          black,
        );
        beam(
          out,
          'metal',
          at(a + 0.045, y + 4.62, -0.04),
          at(b - 0.045, y + 4.62, -0.04),
          0.03,
          0.04,
          black,
        );
      }
    }
    plate(out, at, 0, length, y1 - 0.27, y1, black, 'metal', 0.1);
  }
}
function mechanical(out, y0, y1) {
  const plan = rect(-16, -18.55, 16, 18.55);
  mappedCap(out, 'metal', plan, y0, black, [], true);
  mappedCap(out, 'metal', plan, y1, black);
  for (const { length, at } of edges(plan)) {
    patch(out, 'recess', at, 0, length, y0, y1, [0.035, 0.043, 0.047], -0.18);
    for (let y = y0 + 0.18; y < y1; y += 0.23) {
      const p = [
        at(0, y, -0.05),
        at(length, y, -0.05),
        at(length, y + 0.09, 0.045),
        at(0, y + 0.09, 0.045),
      ];
      face(out, 'metal', p, [0.15, 0.17, 0.18]);
      beam(out, 'metal', p[3], p[2], 0.045, 0.055, [0.13, 0.15, 0.16]);
    }
    for (let x = 0; x <= length + 0.001; x += length / Math.round(length / 3.2))
      beam(out, 'metal', at(x, y0, 0.07), at(x, y1, 0.07), 0.075, 0.09, black);
  }
}
function crown(out) {
  // A curved suspended machine-room bridge joins the cores above a real open void.
  // Its belly retreats towards the middle of its north/south depth.
  const n = 56,
    rings = [];
  for (let i = 0; i <= n; i++) {
    const a = (i * Math.PI) / n;
    rings.push([coreDepth * Math.cos(a), top - 9.3 * Math.sin(a)]);
  }
  for (let i = 0; i < n; i++) {
    const [za, ya] = rings[i],
      [zb, yb] = rings[i + 1];
    const at = (x, t, d = 0) => {
      const z = za + (zb - za) * t,
        y = ya + (yb - ya) * t,
        l = Math.hypot(zb - za, yb - ya);
      return [(x * innerEdge(z)) / 16, y + ((zb - za) / l) * d, z - ((yb - ya) / l) * d];
    };
    for (let x = -16; x < 15.999; x += 1.142857) {
      const end = Math.min(16, x + 1.142857);
      face(out, 'stainless', [at(x, 1), at(end, 1), at(end, 0), at(x, 0)], silver);
      beam(
        out,
        'metal',
        at(x + 0.009, 0, 0.018),
        at(x + 0.009, 1, 0.018),
        0.018,
        0.018,
        [0.24, 0.27, 0.28],
      );
    }
    beam(out, 'metal', at(-16, 0, 0.018), at(16, 0, 0.018), 0.017, 0.02, [0.24, 0.27, 0.28]);
  }
  // The flat top closes the curved bridge; inner end walls belong to the full-height cores.
  mappedCap(
    out,
    'stainless',
    clockwise([
      ...rings.map(([z]) => [-innerEdge(z), z]),
      ...rings.toReversed().map(([z]) => [innerEdge(z), z]),
    ]),
    top,
    silver,
  );
  // End faces meet the matching curved inner core wall, which already closes this interface.
  // Modest roof maintenance rail, equipment and lightning rods fit entirely below the architectural rim.
  for (const x of [-24, 24])
    box(out, 'metal', [x - 1, top - 0.55, -3], [x + 1, top - 0.04, 3], black);
  for (const z of [-7, 7])
    beam(out, 'metal', [-14, top - 0.015, z], [14, top - 0.015, z], 0.04, 0.06, black);
  wordmark(out, 1);
  wordmark(out, -1);
}
function glyph(out, outline, holes, x0, y0, scale, side) {
  const area = (p) =>
    p.reduce((a, v, i) => a + v[0] * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * v[1], 0);
  if (area(outline) < 0) outline = outline.toReversed();
  holes = holes.map((h) => (area(h) > 0 ? h.toReversed() : h));
  const flat = [outline, ...holes].flat();
  // Letters stand on the curved north/south skin using brackets, not coplanar decals.
  const at = (p, d) => [side * (x0 + p[0] * scale), y0 + p[1] * scale, side * (11.6 + d)];
  for (const ix of ShapeUtils.triangulateShape(
    outline.map((p) => new Vector2(...p)),
    holes.map((h) => h.map((p) => new Vector2(...p))),
  )) {
    const p = ix.map((i) => at(flat[i], 0.35));
    if (normalFor(...p)[2] * side < 0) p.reverse();
    tri(out, 'metal', p, [0.015, 0.35, 0.54]);
    tri(
      out,
      'metal',
      p.map((q) => [q[0], q[1], q[2] - side * 0.5]).toReversed(),
      [0.015, 0.26, 0.38],
    );
  }
  for (const ring of [outline, ...holes])
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length];
      face(
        out,
        'metal',
        [at(a, 0.35), at(a, -0.15), at(b, -0.15), at(b, 0.35)],
        [0.012, 0.27, 0.4],
      );
    }
}
function wordmark(out, side) {
  const ellipse = (cx, cy, rx, ry, n = 48) =>
    Array.from({ length: n }, (_, i) => [
      cx + rx * Math.cos((i * 2 * Math.PI) / n),
      cy + ry * Math.sin((i * 2 * Math.PI) / n),
    ]);
  const m = [
    [0, 0],
    [0.19, 0],
    [0.19, 0.64],
    [0.26, 0.78],
    [0.4, 0.79],
    [0.48, 0.66],
    [0.48, 0],
    [0.67, 0],
    [0.67, 0.65],
    [0.74, 0.78],
    [0.87, 0.79],
    [0.95, 0.65],
    [0.95, 0],
    [1.14, 0],
    [1.14, 0.73],
    [1.1, 0.88],
    [0.99, 0.99],
    [0.78, 1],
    [0.61, 0.88],
    [0.49, 1],
    [0.26, 1],
    [0.12, 0.93],
    [0, 0.93],
  ];
  const e = [
    [0.87, 0.49],
    [0.21, 0.49],
    [0.25, 0.32],
    [0.35, 0.22],
    [0.5, 0.19],
    [0.66, 0.24],
    [0.75, 0.32],
    [0.88, 0.19],
    [0.73, 0.06],
    [0.53, 0],
    [0.32, 0.025],
    [0.15, 0.12],
    [0.05, 0.28],
    [0, 0.48],
    [0.025, 0.7],
    [0.12, 0.88],
    [0.29, 0.98],
    [0.49, 1],
    [0.69, 0.92],
    [0.82, 0.77],
    [0.88, 0.61],
  ];
  const counter = [
    [0.22, 0.65],
    [0.29, 0.79],
    [0.45, 0.84],
    [0.61, 0.79],
    [0.68, 0.65],
  ];
  let x = -13.8;
  const s = 5;
  glyph(out, m, [], x, 242.1, s, side);
  x += 1.3 * s;
  glyph(out, ellipse(0.43, 0.5, 0.43, 0.5), [ellipse(0.43, 0.5, 0.235, 0.3)], x, 242.1, s, side);
  x += 1.02 * s;
  for (const which of ['e', 'v', 'e']) {
    if (which === 'v')
      glyph(
        out,
        [
          [0, 1],
          [0.23, 1],
          [0.46, 0.23],
          [0.69, 1],
          [0.91, 1],
          [0.58, 0],
          [0.33, 0],
        ],
        [],
        x,
        242.1,
        s,
        side,
      );
    else glyph(out, e, [counter], x, 242.1, s, side);
    x += 1.02 * s;
  }
  // Ties land inside solid letter strokes; none terminate in an open counter or a gap between letters.
  for (const [x, y] of [
    [-13.3, 244],
    [-10.9, 244],
    [-8.6, 244],
    [-7.02, 245],
    [-3.3, 245],
    [-1, 245],
    [1, 245],
    [4.15, 245],
    [6.2, 245],
    [9, 245],
    [11, 245],
  ])
    beam(
      out,
      'metal',
      [side * x, y, side * (11.75 * Math.sqrt(1 - ((248.3 - y) / 9.3) ** 2) - 0.05)],
      [side * x, y, side * 11.52],
      0.08,
      0.08,
      black,
    );
}
function lobby(out) {
  const plan = rect(-16, -18.7, 16, 18.7);
  mappedSolid(out, 'stone', plan, 0, 0.15, [0.53, 0.53, 0.51]);
  mappedCap(out, 'metal', plan, 13.85, black);
  for (const { length, at } of edges(plan)) {
    const frontage = Math.abs(at(0, 0)[2]) > 18 && Math.abs(at(length, 0)[2]) > 18;
    grid(
      out,
      [
        at(0, frontage ? 3.8 : 0.15),
        at(length, frontage ? 3.8 : 0.15),
        at(length, 13.85),
        at(0, 13.85),
      ],
      [0.24, 0.32, 0.34],
      3.2,
      4.6,
      0.09,
      black,
    );
    if (frontage)
      for (const [a, b] of [
        [0, 6.3],
        [9.7, 22.3],
        [25.7, 32],
      ])
        grid(
          out,
          [at(a, 0.15), at(b, 0.15), at(b, 3.8), at(a, 3.8)],
          [0.24, 0.32, 0.34],
          3.2,
          3.65,
          0.09,
          black,
        );
    beam(out, 'metal', at(0, 3.8, 0.1), at(length, 3.8, 0.1), 0.3, 0.18, black);
  }
  // The small suspended auditorium is recessed behind the north/south office projection.
  const auditorium = rect(-16, -15.2, 16, 15.2);
  mappedSolid(out, 'metal', auditorium, 13.85, 25.6, black);
  for (const { length, at } of edges(auditorium))
    grid(
      out,
      [at(0, 14, 0.04), at(length, 14, 0.04), at(length, 25.5, 0.04), at(0, 25.5, 0.04)],
      glass,
      2.3,
      3.85,
      0.065,
      black,
    );
  mechanical(out, 25.6, 39);
  // Two recessed, glazed revolving-door drums on each lobby frontage.
  for (const side of [-1, 1])
    for (const x of [-8, 8]) {
      const z = side * 19.1,
        r = 1.65;
      loft(
        out,
        'stone',
        [
          radialRing(0, r + 0.17, r + 0.17, 48, [x, z]),
          radialRing(0.15, r + 0.17, r + 0.17, 48, [x, z]),
        ],
        [0.53, 0.53, 0.51],
      );
      // A recessed vestibule closes the doorway interior while leaving the wall opening unobstructed.
      for (const dx of [-1.7, 1.7]) {
        const jamb = [
          [x + dx, 0.15, side * 18.7],
          [x + dx, 0.15, side * 16.5],
          [x + dx, 3.8, side * 16.5],
          [x + dx, 3.8, side * 18.7],
        ];
        face(out, 'metal', dx * side > 0 ? jamb.toReversed() : jamb, black);
      }
      box(
        out,
        'recess',
        [x - 1.7, 0.15, side > 0 ? 16.4 : -16.6],
        [x + 1.7, 3.8, side > 0 ? 16.6 : -16.4],
        [0.045, 0.055, 0.06],
      );
      loft(
        out,
        'clear_glass',
        [radialRing(0.15, r, r, 48, [x, z]), radialRing(3.55, r, r, 48, [x, z])],
        [0.59, 0.67, 0.7],
        { cap: false },
      );
      loft(
        out,
        'metal',
        [
          radialRing(3.52, r + 0.12, r + 0.12, 48, [x, z]),
          radialRing(3.83, r + 0.12, r + 0.12, 48, [x, z]),
        ],
        black,
      );
      for (let k = 0; k < 3; k++) {
        const a = (k * Math.PI * 2) / 3,
          dx = Math.cos(a) * r,
          dz = Math.sin(a) * r;
        face(
          out,
          'clear_glass',
          [
            [x, 0.15, z],
            [x + dx, 0.15, z + dz],
            [x + dx, 3.5, z + dz],
            [x, 3.5, z],
          ],
          [0.62, 0.7, 0.72],
        );
        beam(out, 'metal', [x + dx, 0.15, z + dz], [x + dx, 3.52, z + dz], 0.045, 0.045, silver);
      }
      beam(out, 'metal', [x, 0.15, z], [x, 3.52, z], 0.055, 0.055, silver);
    }
}
export function buildMoeve(out) {
  cores(out);
  lobby(out);
  officeBlock(out, 39, 11);
  mechanical(out, 90.7, 102);
  officeBlock(out, 102, 12);
  mechanical(out, 158.4, 168);
  officeBlock(out, 168, 11);
  crown(out);
  const plan = rect(-16, -halfDepth, 16, halfDepth);
  // Low continuous parapet and service grating close the office roof below the crown void.
  for (const { length, at } of edges(plan)) {
    patch(out, 'metal', at, 0, length, 219.7, 220.15, black, 0.015);
    beam(out, 'metal', at(0, 220.15, 0.015), at(length, 220.15, 0.015), 0.08, 0.12, black);
  }
  for (let x = -14; x <= 14; x += 1.5)
    beam(out, 'metal', [x, 219.76, -19], [x, 219.76, 19], 0.065, 0.035, [0.19, 0.21, 0.22]);
}
export const moeveStudy = {
  id: 'N0203',
  key: 'torre_moeve',
  title: 'Torre Moeve',
  wikidataId: 'Q519568',
  height: top,
  build: buildMoeve,
  brief:
    'Foster twin stainless-clad cores bracket three suspended black-framed glass office blocks, with recessed louver belts, panoramic end lifts, a13.85m glazed lobby and an open20m crown below a curved metal bridge bearing current blue Moeve lettering.',
  sourceFacts: {
    heightMeters: 248.3,
    architect: 'Foster + Partners',
    structuralEngineer: 'Halvorson and Partners with Gilsanz Murray Steficek',
    officePlanMeters: [32, 42.5],
    corePlanMeters: [10.5, 23.5],
    typicalFloorPitchMeters: 4.7,
    officeBlockFloorCounts: [11, 12, 11],
    lobbyClearMeters: 13.85,
    constructionTransferDatums: [39, 102, 168],
    primaryRoundedHeightMeters: 250,
  },
  reconstruction: {
    geometry:
      'Burgos and original structural/construction engineers in Hormigon y Acero59/249 establish floor plan, three11/12/11-floor groups,4.70m pitch and construction transfer datums. Completed GMS/Foster photos constrain the cladding and genuinely open crown. The as-built248.3m architectural height replaces the early250m figure; the early215m cornice differs from construction/modelled219.7m roof.',
    facade:
      'Individual steel sheets, black Vierendeel spandrels, fine curtain-wall mullions, dense recessed ventilation, panoramic glass strips and curved crown panel seams are explicit exterior geometry. Current blue lowercase roof lettering is an original polygonal reconstruction from the owner2025 report.',
  },
  refs: [
    'http://e-ache.com/modules/ache/ficheros/Realizaciones/Obra125.pdf',
    'https://www.gmsllp.com/portfolio/torre-caja-madrid/',
    'https://www.moeveglobal.com/stfls/corporativo/FICHEROS/informe-gestion-consolidado2025.pdf',
    'https://www.multivu.com/players/uk/7703451-cepsa-new-headquarters-new-company/docs/cepsa-headquarters-cepsa-tower-1046753785.pdf',
    'https://www.esmadrid.com/en/tourist-information/torre-moeve',
    'https://www.skyscrapercenter.com/building/wd/878',
    'https://www.openstreetmap.org/way/188396764',
  ],
  nativeAxes: {
    up: '+Y',
    longAxis: '+X east-southeast between cores',
    shortAxis: '+Z south-southwest glass office frontage',
  },
  geographic: (m) => ({
    heading: m.heading,
    notes:
      'Exact-QID cross-shaped envelope and independent east/west cores retain their signed axis. The original engineer plan puts full-height cores east/west and broad office fronts north/south, confirming the mapped phase. GroundY0 is the lobby entrance datum. Published53x42.5m plan supersedes submeter map tracing variation; the mapped upper office datums are not accepted over primary construction elevations.',
  }),
  limitations: [
    commonLimit,
    'Exact stainless sheet schedule, louver pitch, fine glazing divisions, curved crown section and original lowercase letter strokes are exterior photographic reconstruction. Early250m/215m roof figures differ from current248.3m and the later construction elevations, explicitly retained in sourceFacts. Office floors, core circulation and the underground garage are excluded; surrounding plaza, neighboring towers and active lifts are not modeled.',
  ],
  camera: { position: [300, 180, 310], lookAt: [0, 125, 0], fov: 42 },
  qaCameras: [
    { name: 'three-suspended-blocks', position: [-260, 170, -310], lookAt: [0, 125, 0] },
    { name: 'panoramic-core-strip', position: [83, 143, 15], lookAt: [26, 140, 0] },
    { name: 'stainless-core-panels', position: [43, 68, 35], lookAt: [22, 63, 11.75] },
    { name: 'black-curtain-wall', position: [8, 124, 44], lookAt: [2, 122, 21.25] },
    { name: 'recessed-mechanical', position: [43, 100, 51], lookAt: [5, 97, 19] },
    { name: 'open-crown', position: [46, 240, 66], lookAt: [0, 233, 0] },
    { name: 'curved-crown-skin', position: [4, 231, 35], lookAt: [1, 242, 8] },
    { name: 'moeve-lettering', position: [26, 248, 42], lookAt: [0, 245, 11] },
    { name: 'roof-below-void', position: [35, 252, -42], lookAt: [0, 220, 0] },
    { name: 'glazed-lobby', position: [36, 12, 54], lookAt: [0, 8, 18] },
    { name: 'revolving-entrance', position: [11, 5.5, 29], lookAt: [8, 2, 19] },
    { name: 'far-open-frame', position: [-590, 208, 560], lookAt: [0, 122, 0] },
  ],
};
