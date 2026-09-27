/** Original Pont de Normandie geometry reconstructed from the operator's technical sheet. */

import { beam, chamferedRectangle, loft } from './authored-structure-mesh.mjs';
import { box, colors, quad, tube } from './structure-mesh.mjs';

export const normandieStudy = {
  id: 'N0002',
  key: 'pont_de_normandie',
  size: [2141.25, 214, 47],
  brief:
    'The asymmetric full crossing: inverted-Y concrete pylons, 184 paired stays, aerodynamic box deck, curved vertical alignment, blue cornices, narrow cycle and pedestrian margins, pier viaducts and modeled cable anchor hardware',
  refs: [
    'https://www.pontsnormandietancarville.fr/lhistoire/pont-de-normandie/le-pont-en-details/',
    'https://www.pontsnormandietancarville.fr/wp-content/uploads/2020/04/fiche-technique-pontdenormandie-01.pdf',
    'https://www.pontsnormandietancarville.fr/lhistoire/pont-de-normandie/lorigine-du-projet/',
  ],
  nativeAxes: {
    up: '+Y',
    longitudinal: '+X south',
    transverse: '+Z',
    origin: 'Main-span midpoint horizontally; Y=0 is CMH low-water chart datum, not mean sea level',
  },
  sourceFacts: {
    overallLengthMeters: 2141.25,
    mainSpanMeters: 856,
    publishedOverallWidthMeters: 23.6,
    deckSteelBoxWidthMeters: 21.2,
    deckSteelBoxDepthMeters: 3,
    steelCenterLengthMeters: 624,
    pylonTopCmhMeters: 214,
    pylonFootingCmhMeters: 12,
    pylonJunctionCmhMeters: 139,
    pylonDeckCmhMeters: 59,
    pylonBaseLegSpacingMeters: 30,
    stays: 184,
    maximumStayDiameterMeters: 0.168,
    viaductPiersNorth: 15,
    viaductPiersSouth: 11,
    maximumApproachGrade: 0.06,
  },
  limitations: [
    'The operator technical sheet has dated/rounded dimensions. Main dimensions and cable count are sourced; approach endpoint allocation, exact vertical road curvature, pier stationing and local fittings are reconstructed.',
    'CMH is the Carte Marine Havraise tidal datum. Geographic placement requires a checked vertical conversion; interpreting Y=0 as a generic terrain elevation would be incorrect.',
    'No toll plaza, embankments, submerged piles, maintenance interiors, traffic or navigation lights are included.',
    'Original vertex-color PBR geometry is detailed, but texture weathering, site-fit verification and collision refinement are pending. This is not a survey reconstruction or a maximum-fidelity completion claim.',
  ],
};

const concrete = [0.66, 0.68, 0.66],
  concreteLight = [0.74, 0.75, 0.71];
const blue = [0.075, 0.32, 0.5],
  rail = [0.76, 0.8, 0.79],
  cable = [0.62, 0.66, 0.65];
const xNorth = -1165.625,
  xSouth = 975.625;
const deckY = (x) =>
  Math.abs(x) <= 428 ? 59 + 12.84 * (1 - (x / 428) ** 2) : 59 - (Math.abs(x) - 428) * 0.06;

function deckRing(x, width = 21.2, depth = 3) {
  const y = deckY(x),
    half = width / 2;
  // The technical drawing shows a shallow winged box with a flat central soffit.
  return [
    [x, y, -half],
    [x, y, half],
    [x, y - 0.91, half],
    [x, y - depth, 4.7],
    [x, y - depth, -4.7],
    [x, y - 0.91, -half],
  ];
}

function strip(out, x0, x1, z0, z1, offset, color, slot = 'trim') {
  const a = [x0, deckY(x0) + offset, z0],
    b = [x1, deckY(x1) + offset, z0];
  const c = [x1, deckY(x1) + offset, z1],
    d = [x0, deckY(x0) + offset, z1];
  quad(out, slot, [a, b, c, d], [0, 1, 0], color);
}

function pylon(out, x) {
  box(out, 'foundation', [x - 9, 9.8, -23.5], [x + 9, 12, 23.5], concrete);
  for (const sign of [-1, 1]) {
    const layers = [
      [12, 15, 9.07, 5.47],
      [59, 9.6, 8.8, 5.47],
      [110, 3.65, 8.35, 5.47],
      [139, 0.1, 8, 5.47],
    ];
    loft(
      out,
      'wall',
      layers.map(([y, z, w, d]) => chamferedRectangle(x, y, sign * z, w, d, 0.5)),
      concreteLight,
    );
    // Narrow longitudinal ribs and regularly spaced formwork joints survive close inspection.
    for (let y = 15.4; y < 137; y += 3.4) {
      const z = sign * Math.max(0.1, (15 * (139 - y)) / 127);
      const width = 9.07 - ((y - 12) / 127) * 1.07;
      for (const side of [-1, 1])
        box(
          out,
          'trim',
          [x - width / 2 - 0.012, y - 0.016, z + side * 2.3 - 0.06],
          [x + width / 2 + 0.012, y + 0.016, z + side * 2.3 + 0.06],
          concrete,
        );
    }
  }
  loft(
    out,
    'wall',
    [
      [139, 8],
      [180, 7.6],
      [214, 7.1],
    ].map(([y, w]) => chamferedRectangle(x, y, 0, w, 5.47, 0.48)),
    concreteLight,
  );
  // Dark recessed cable anchorage strip on each longitudinal pylon face.
  for (const face of [-1, 1]) {
    box(
      out,
      'trim',
      [x + face * 3.84 - 0.04, 142, -1.6],
      [x + face * 3.84 + 0.04, 211, 1.6],
      [0.38, 0.42, 0.43],
    );
    for (let i = 0; i < 23; i++)
      for (const z of [-1.05, 1.05]) {
        const y = 145 + i * 2.85;
        tube(out, 'trim', [x + face * 3.94, y, z], [x + face * 4.12, y, z], 0.14, colors.dark, 12);
      }
  }
  box(out, 'wall', [x - 4.5, 55.5, -10.8], [x + 4.5, 58.85, 10.8], concrete);
  box(out, 'trim', [x - 4.6, 213.7, -2.9], [x + 4.6, 214, 2.9], concrete);
}

function pier(out, x) {
  const h = deckY(x) - 3.3;
  const bottom = 8;
  box(out, 'foundation', [x - 4, bottom - 2, -8], [x + 4, bottom, 8], concrete);
  loft(
    out,
    'wall',
    [
      chamferedRectangle(x, bottom, 0, 3.7, 9.2, 0.6),
      chamferedRectangle(x, h - 3.5, 0, 3.15, 9.2, 0.6),
      chamferedRectangle(x, h - 0.6, 0, 3.5, 14.6, 0.5),
    ],
    concreteLight,
  );
  for (const z of [-5.4, 5.4])
    box(out, 'trim', [x - 1.5, h - 0.6, z - 1.1], [x + 1.5, h, z + 1.1], colors.dark);
}

function stays(out, x, intoSpanSign) {
  for (const direction of [-1, 1])
    for (const side of [-1, 1]) {
      const anchors = [];
      for (let i = 0; i < 23; i++) {
        const distance = 20 + (i / 22) * 398;
        const tx = x + direction * distance;
        const ty = 145 + (i / 22) * 63;
        const start = [x + direction * 3.75, ty, side * 1.0];
        const end = [tx, deckY(tx) + 0.36, side * 10.0];
        const radius = 0.055 + 0.029 * (i / 22);
        tube(out, 'trim', start, end, radius, cable, 12);
        // Anti-vandal sleeve, clevis plate and spherical bearing at every lower anchorage.
        const axis = end.map((v, k) => start[k] - v),
          length = Math.hypot(...axis);
        const sleeve = end.map((v, k) => v + (axis[k] / length) * 2.75);
        tube(out, 'trim', end, sleeve, radius * 1.8, rail, 12);
        box(
          out,
          'trim',
          [tx - 0.6, deckY(tx) + 0.06, side * 10 - 0.26],
          [tx + 0.6, deckY(tx) + 0.45, side * 10 + 0.26],
          blue,
        );
        tube(
          out,
          'trim',
          [tx, deckY(tx) + 0.38, side * 10 - 0.33],
          [tx, deckY(tx) + 0.38, side * 10 + 0.33],
          0.22,
          colors.steel,
          12,
        );
        // Anchor bolts are visible at pedestrian-scale; keep the number bounded.
        for (const dx of [-0.42, 0.42])
          for (const dz of [-0.19, 0.19])
            tube(
              out,
              'trim',
              [tx + dx, deckY(tx) + 0.45, side * 10 + dz],
              [tx + dx, deckY(tx) + 0.5, side * 10 + dz],
              0.035,
              rail,
              6,
            );
        anchors.push({ start, end });
      }
      // Six vertical anti-vibration cross ties per main-span cable fan.
      if (direction === intoSpanSign)
        for (let j = 1; j <= 6; j++) {
          const station = x + direction * (45 + j * 48);
          const hit = [];
          for (const { start, end } of anchors) {
            const t = (station - start[0]) / (end[0] - start[0]);
            if (t > 0 && t < 1) hit.push(start.map((v, k) => v + (end[k] - v) * t));
          }
          if (hit.length > 1) tube(out, 'trim', hit[0], hit.at(-1), 0.035, colors.steel, 6);
        }
    }
}

export function buildNormandie(out) {
  const sectionLength = 5.8;
  const segments = Math.ceil((xSouth - xNorth) / sectionLength);
  for (let i = 0; i < segments; i++) {
    const a = xNorth + ((xSouth - xNorth) * i) / segments,
      b = xNorth + ((xSouth - xNorth) * (i + 1)) / segments;
    loft(
      out,
      'foundation',
      [deckRing(a), deckRing(b)],
      Math.abs((a + b) / 2) < 312 ? [0.52, 0.57, 0.58] : concrete,
      { cap: i === 0 || i === segments - 1 },
    );
    strip(out, a, b, -10.6, 10.6, 0.025, colors.road, 'roof');
    for (const side of [-1, 1]) {
      // The blue aerofoil edge is separate from the dark road deck.
      loft(
        out,
        'trim',
        [
          [
            [a, deckY(a) - 0.05, side * 10.6],
            [a, deckY(a) - 0.05, side * 11.8],
            [a, deckY(a) - 0.5, side * 11.5],
            [a, deckY(a) - 0.9, side * 10.6],
          ],
          [
            [b, deckY(b) - 0.05, side * 10.6],
            [b, deckY(b) - 0.05, side * 11.8],
            [b, deckY(b) - 0.5, side * 11.5],
            [b, deckY(b) - 0.9, side * 10.6],
          ],
        ],
        blue,
      );
      strip(
        out,
        a,
        b,
        side < 0 ? -10.6 : 9.3,
        side < 0 ? -9.3 : 10.6,
        0.08,
        [0.54, 0.57, 0.56],
        'roof',
      );
      for (const y of [0.48, 0.92, 1.35])
        tube(
          out,
          'trim',
          [a, deckY(a) + y, side * 10.62],
          [b, deckY(b) + y, side * 10.62],
          y === 1.35 ? 0.075 : 0.045,
          y === 1.35 ? blue : rail,
          8,
        );
      tube(
        out,
        'trim',
        [a, deckY(a) + 0.58, side * 0.4],
        [b, deckY(b) + 0.58, side * 0.4],
        0.09,
        rail,
        8,
      );
    }
    strip(out, a, b, -0.4, 0.4, 0.06, [0.53, 0.56, 0.55], 'trim');
    for (const z of [-9.2, -7.95, 7.95, 9.2])
      strip(out, a, b, z - 0.065, z + 0.065, 0.06, [0.84, 0.85, 0.8]);
  }
  for (let x = xNorth + 2; x < xSouth; x += 4)
    for (const side of [-1, 1]) {
      beam(
        out,
        'trim',
        [x, deckY(x) + 0.09, side * 10.62],
        [x, deckY(x) + 1.36, side * 10.62],
        0.08,
        0.085,
        rail,
      );
      if (Math.round((x - xNorth) / 4) % 2 === 0)
        beam(
          out,
          'trim',
          [x, deckY(x) + 0.09, side * 0.4],
          [x, deckY(x) + 0.62, side * 0.4],
          0.1,
          0.1,
          rail,
        );
    }
  for (let x = xNorth + 3; x < xSouth - 3; x += 13)
    for (const z of [-4.15, 4.15])
      strip(out, x, x + 5, z - 0.065, z + 0.065, 0.063, [0.87, 0.87, 0.81]);
  // Published pier counts; spacing reconstructed across the approach spans.
  for (const [sign, count, end] of [
    [-1, 15, xNorth],
    [1, 11, xSouth],
  ])
    for (let i = 1; i <= count; i++) {
      const start = sign * 428;
      pier(out, start + ((end - start) * i) / (count + 1));
    }
  for (const x of [-428, 428]) {
    pylon(out, x);
    stays(out, x, x < 0 ? 1 : -1);
  }
  // Segmented expansion-joint plates at the main concrete/steel transitions.
  for (const x of [-524, -312, 312, 524])
    for (let k = -35; k <= 35; k++) {
      const z = k * 0.29;
      strip(
        out,
        x - 0.19 + (k % 2) * 0.05,
        x + 0.19 + (k % 2) * 0.05,
        z - 0.095,
        z + 0.095,
        0.085,
        colors.steel,
      );
    }
}
