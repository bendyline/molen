/** Yi Sun-sin: twin aerodynamic boxes, inclined concrete H towers and unequal anchorages. */
import { beam, chamferedRectangle, loft, radialRing, sphere } from './authored-structure-mesh.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

const concrete = [0.76, 0.754, 0.706],
  steel = [0.69, 0.74, 0.727],
  dark = [0.25, 0.29, 0.28];
const halfSpan = 772.5,
  halfDeck = 1130,
  halfCable = 1272.5,
  cableZ = 14.55;
const deckY = (x) => 88.05 - 25 * (x / halfDeck) ** 2;
const mainY = (x) => 270.1 - (1545 / 9) * (1 - (x / halfSpan) ** 2);
const backY = (x) => {
  const t = (Math.abs(x) - halfSpan) / 500,
    end = x < 0 ? 37 : 31;
  return 270.1 * (1 - t) + end * t - 22 * 4 * t * (1 - t);
};
const cableY = (x) => (Math.abs(x) <= halfSpan ? mainY(x) : backY(x));
const line = (out, slot, a, b, radius, color = steel, sides = 12) =>
  tube(out, slot, a, b, radius, color, sides);

function tower(out, x) {
  loft(
    out,
    'concrete',
    [radialRing(0, 15.5, 37.5, 96, [x, 0]), radialRing(2.7, 15.5, 37.5, 96, [x, 0])],
    concrete,
  );
  // The leg separation and section taper independently. Lower flared feet remain separate.
  for (const side of [-1, 1]) {
    const levels = [
      [2.7, 22.6, 17, 13.2],
      [7, 21.5, 14.5, 11.5],
      [16, 20.5, 12.6, 10],
      [78, 18.6, 11.3, 9.5],
      [164, 16.35, 9.4, 8.7],
      [255, 14.65, 7.9, 8],
      [268.8, 14.55, 7.4, 7.8],
    ];
    loft(
      out,
      'concrete',
      levels.map(([y, z, w, d]) => chamferedRectangle(x, y, side * z, w, d, 0.55)),
      concrete,
    );
    // Fine continuous formwork courses: narrow strips, not a stack of bulky slabs.
    for (let y = 18; y < 268; y += 2) {
      let i = levels.findIndex((a) => a[0] > y);
      if (i < 0) i = levels.length - 1;
      const a = levels[i - 1],
        b = levels[i],
        t = (y - a[0]) / (b[0] - a[0]);
      const z = side * (a[1] + (b[1] - a[1]) * t),
        w = a[2] + (b[2] - a[2]) * t,
        d = a[3] + (b[3] - a[3]) * t;
      loft(
        out,
        'concrete',
        [
          chamferedRectangle(x, y, z, w + 0.012, d + 0.012, 0.55),
          chamferedRectangle(x, y + 0.018, z, w + 0.012, d + 0.012, 0.55),
        ],
        concrete.map((v) => v - 0.09),
      );
    }
    for (const dz of [-3.45, 3.45])
      box(
        out,
        'concrete',
        [x - 3.7, 268.8, side * cableZ + dz - 0.45],
        [x + 3.7, 272.4, side * cableZ + dz + 0.45],
        concrete,
      );
    box(
      out,
      'concrete',
      [x - 3.7, 272.4, side * cableZ - 3.9],
      [x + 3.7, 272.7, side * cableZ + 3.9],
      concrete,
    );
    box(
      out,
      'iron',
      [x - 3, 268.8, side * cableZ - 1.1],
      [x + 3, 269.5, side * cableZ + 1.1],
      dark,
    );
    // Saddle shroud follows the exposed cable curvature over each tower.
    for (const sign of [-1, 1]) {
      line(
        out,
        'steel',
        [x + sign * 3.3, 270.5, side * cableZ],
        [x + sign * 4.2, 268.8, side * cableZ],
        0.51,
        steel,
        32,
      );
    }
    for (const xx of [-3.7, 3.7]) {
      line(
        out,
        'steel',
        [x + xx, 272.8, side * cableZ - 4.2],
        [x + xx, 272.8, side * cableZ + 4.2],
        0.045,
      );
      for (let z = -4.2; z <= 4.21; z += 1.4)
        line(
          out,
          'steel',
          [x + xx, 271.6, side * cableZ + z],
          [x + xx, 272.8, side * cableZ + z],
          0.035,
        );
    }
    line(out, 'steel', [x, 272.7, side * cableZ], [x, 276.2, side * cableZ], 0.045);
    sphere(out, 'iron', [x, 275.3, side * cableZ], [0.2, 0.24, 0.2], [0.55, 0.035, 0.025], 20, 10);
    // Inspection doors in both outward tower faces, with recess and projecting frame.
    for (const sign of [-1, 1]) {
      const xx = x + sign * 6.28,
        zz = side * 20.2;
      box(out, 'iron', [xx - 0.045, 4.1, zz - 0.92], [xx + 0.045, 6.6, zz + 0.92], dark);
      for (const dz of [-0.95, 0.95])
        line(
          out,
          'steel',
          [xx + sign * 0.065, 4.05, zz + dz],
          [xx + sign * 0.065, 6.7, zz + dz],
          0.055,
        );
    }
  }
  // Two elevated concrete crossbeams; lower root opening has a rounded invert.
  for (const [y, span, depth] of [
    [164, 32.7, 8.8],
    [255, 29.3, 7.4],
  ]) {
    box(
      out,
      'concrete',
      [x - depth / 2, y - 4.3, -span / 2],
      [x + depth / 2, y + 4.3, span / 2],
      concrete,
    );
    for (const sign of [-1, 1]) {
      box(
        out,
        'concrete',
        [x + (sign * depth) / 2 - 0.035, y - 4.28, -span / 2],
        [x + (sign * depth) / 2 + 0.035, y - 3.95, span / 2],
        concrete.map((v) => v - 0.08),
      );
    }
  }
  for (let i = 0; i < 80; i++) {
    const z0 = -15.5 + (31 * i) / 80,
      z1 = -15.5 + (31 * (i + 1)) / 80;
    const high = (z) => 8 + 6 * (1 - Math.sqrt(Math.max(0, 1 - (z / 15.5) ** 2)));
    const rings = [z0, z1].map((z) => [
      [x - 6.4, 2.7, z],
      [x - 6.4, high(z), z],
      [x + 6.4, high(z), z],
      [x + 6.4, 2.7, z],
    ]);
    loft(out, 'concrete', rings, concrete);
  }
  // Permanent foundation perimeter rail, bollards, inspection walkway and access steps.
  for (let i = 0; i < 120; i++) {
    const a = (i * Math.PI) / 60,
      b = ((i + 1) * Math.PI) / 60;
    const p = (t, y) => [x + 15 * Math.cos(t), y, 36.9 * Math.sin(t)];
    for (const y of [3.25, 3.8]) line(out, 'iron', p(a, y), p(b, y), 0.028, [0.65, 0.57, 0.19]);
    if (i % 3 === 0) line(out, 'iron', p(a, 2.7), p(a, 3.8), 0.04, [0.65, 0.57, 0.19]);
  }
}

function deck(out) {
  // 29.1 m aerodynamic envelope; paved deck tops are 25.7 m across including the central slot.
  for (const side of [-1, 1]) {
    const section = [
      [3, 0],
      [12.85, 0],
      [14.55, -1.1],
      [12.55, -3],
      [4.5, -3],
      [3, -1.5],
    ];
    const rings = Array.from({ length: 754 }, (_, i) => {
      const x = -halfDeck + (2 * halfDeck * i) / 753,
        y = deckY(x);
      const ring = section.map(([z, h]) => [x, y + h, side * z]);
      return side < 0 ? ring.toReversed() : ring;
    });
    loft(out, 'iron', rings, steel);
    // Asphalt, shoulders and continuous/dashed traffic markings follow the vertical curve.
    for (let i = 0; i < 754; i++) {
      const a = -halfDeck + (2260 * i) / 754,
        b = -halfDeck + (2260 * (i + 1)) / 754;
      const patch = (slot, za, zb, raise, color) => {
        const p = [
          [a, deckY(a) + raise, za],
          [a, deckY(a) + raise, zb],
          [b, deckY(b) + raise, zb],
          [b, deckY(b) + raise, za],
        ];
        quad(out, slot, p, [0, 1, 0], color);
      };
      const zl = side < 0 ? -12.35 : 3.5,
        zr = side < 0 ? -3.5 : 12.35;
      patch('road', zl, zr, 0.025, [0.205, 0.221, 0.215]);
      for (const z of [side * 3.8, side * 11.9])
        patch('marking', z - 0.06, z + 0.06, 0.04, [0.85, 0.86, 0.8]);
      if (i % 4 < 2)
        patch('marking', side * 7.35 - 0.06, side * 7.35 + 0.06, 0.045, [0.86, 0.87, 0.82]);
      for (const z of [side * 3.22, side * 12.62]) {
        beam(
          out,
          'concrete',
          [a, deckY(a) + 0.16, z],
          [b, deckY(b) + 0.16, z],
          0.3,
          0.32,
          concrete,
        );
        for (const h of [0.55, 0.89, 1.15])
          beam(out, 'steel', [a, deckY(a) + h, z], [b, deckY(b) + h, z], 0.055, 0.105, steel);
      }
    }
    for (let x = -halfDeck; x <= halfDeck; x += 2.5)
      for (const z of [side * 3.22, side * 12.62]) {
        box(
          out,
          'steel',
          [x - 0.055, deckY(x) + 0.2, z - 0.05],
          [x + 0.055, deckY(x) + 1.21, z + 0.05],
          steel,
        );
        box(
          out,
          'steel',
          [x - 0.13, deckY(x) + 0.22, z - 0.11],
          [x + 0.13, deckY(x) + 0.25, z + 0.11],
          dark,
        );
      }
    // Visible six-metre field-splice lines and longitudinal underside inspection stringers.
    for (let x = -1128; x <= 1128; x += 6) {
      line(
        out,
        'iron',
        [x, deckY(x) - 3.012, side * 4.6],
        [x, deckY(x) - 3.012, side * 12.4],
        0.014,
        dark,
        6,
      );
      for (const z of [side * 4.65, side * 12.4])
        box(
          out,
          'iron',
          [x - 0.18, deckY(x) - 3.13, z - 0.13],
          [x + 0.18, deckY(x) - 3.03, z + 0.13],
          steel,
        );
    }
    for (const z of [side * 4.5, side * 11.9])
      for (let x = -halfDeck; x < halfDeck; x += 6)
        beam(
          out,
          'iron',
          [x, deckY(x) - 3.18, z],
          [Math.min(halfDeck, x + 6), deckY(Math.min(halfDeck, x + 6)) - 3.18, z],
          0.16,
          0.2,
          steel,
        );
  }
  // Open transverse ties link the boxes without filling the aerodynamic slot.
  for (let x = -1128; x <= 1128; x += 6) {
    beam(out, 'iron', [x, deckY(x) - 1.6, -4.3], [x, deckY(x) - 1.6, 4.3], 0.3, 1.25, steel);
    for (const y of [-2.26, -0.97])
      box(out, 'iron', [x - 0.3, deckY(x) + y, -4.3], [x + 0.3, deckY(x) + y + 0.07, 4.3], steel);
  }
}

function suspension(out) {
  for (const side of [-1, 1]) {
    const z = side * cableZ;
    for (let i = 0; i < 1696; i++) {
      const a = -halfCable + (2545 * i) / 1696,
        b = -halfCable + (2545 * (i + 1)) / 1696;
      line(out, 'iron', [a, cableY(a), z], [b, cableY(b), z], 0.34, [0.81, 0.83, 0.795], 32);
      for (const dz of [-0.3, 0.3])
        line(
          out,
          'steel',
          [a, cableY(a) + 1.2, z + dz],
          [b, cableY(b) + 1.2, z + dz],
          0.012,
          steel,
          6,
        );
    }
    for (let x = -1122; x <= 1122; x += 18) {
      if (Math.abs(Math.abs(x) - halfSpan) < 8) continue;
      const y = cableY(x),
        dy = cableY(x + 0.5) - cableY(x - 0.5);
      line(
        out,
        'iron',
        [x - 0.62, y - dy * 0.62, z],
        [x + 0.62, y + dy * 0.62, z],
        0.44,
        steel,
        32,
      );
      for (const dx of [-0.31, 0.31]) {
        line(out, 'steel', [x + dx, deckY(x) - 1.45, z], [x + dx, y - 0.1, z], 0.038, steel, 12);
        line(
          out,
          'iron',
          [x + dx, deckY(x) - 1.52, z],
          [x + dx, deckY(x) + 0.1, z],
          0.082,
          dark,
          16,
        );
        line(out, 'steel', [x + dx, y - 1.3, z], [x + dx, y - 0.2, z], 0.07, steel, 16);
      }
      box(
        out,
        'iron',
        [x - 0.58, deckY(x) - 1.7, z - 0.46],
        [x + 0.58, deckY(x) - 1.3, z + 0.46],
        dark,
      );
      for (const dz of [-0.45, 0.45])
        for (const dx of [-0.43, 0, 0.43])
          line(
            out,
            'steel',
            [x + dx, y - 0.36, z + dz],
            [x + dx, y + 0.36, z + dz],
            0.028,
            dark,
            8,
          );
    }
    for (let x = -1266; x <= 1266; x += 6) {
      if (Math.abs(Math.abs(x) - halfSpan) < 7) continue;
      for (const dz of [-0.3, 0.3])
        line(out, 'steel', [x, cableY(x) + 0.28, z + dz], [x, cableY(x) + 1.2, z + dz], 0.025);
    }
  }
}

function anchorages(out) {
  // North: large gravity block on a circular diaphragm-wall foundation.
  const x = halfCable + 11;
  loft(
    out,
    'concrete',
    [radialRing(0, 34, 34, 128, [x, 0]), radialRing(3, 34, 34, 128, [x, 0])],
    concrete,
  );
  loft(
    out,
    'concrete',
    [
      chamferedRectangle(x, 3, 0, 55, 56, 8),
      chamferedRectangle(x + 3, 18, 0, 49, 51, 8),
      chamferedRectangle(x + 9, 39, 0, 28, 43, 5),
    ],
    concrete,
  );
  // South: smaller paired splay-saddle housings feeding a rock anchorage.
  for (const side of [-1, 1]) {
    const z = side * cableZ;
    loft(
      out,
      'concrete',
      [
        chamferedRectangle(-halfCable - 8, 0, z, 29, 17, 2),
        chamferedRectangle(-halfCable - 8, 30, z, 27, 15, 2),
        chamferedRectangle(-halfCable - 10, 41, z, 18, 12, 1),
      ],
      concrete,
    );
    for (const sign of [-1, 1]) {
      const ax = sign * halfCable,
        y = sign < 0 ? 37 : 31;
      box(out, 'iron', [ax - 2.8, y - 0.8, z - 1.25], [ax + 2.8, y + 1.7, z + 1.25], steel);
      for (let dx = -2.5; dx < 2.6; dx += 1)
        for (const dz of [-1.3, 1.3])
          line(
            out,
            'steel',
            [ax + dx, y - 0.8, z + dz],
            [ax + dx, y + 1.25, z + dz],
            0.035,
            dark,
            8,
          );
      box(out, 'iron', [ax - 3.1, y - 1.1, z - 1.5], [ax + 3.1, y - 0.8, z + 1.5], dark);
    }
  }
  // End piers at the limits of the measured suspension deck, not at the cable anchorages.
  for (const sign of [-1, 1]) {
    const xx = sign * halfDeck,
      h = deckY(xx) - 3;
    loft(
      out,
      'concrete',
      [radialRing(0, 11, 25, 80, [xx, 0]), radialRing(2.3, 11, 25, 80, [xx, 0])],
      concrete,
    );
    for (const side of [-1, 1])
      loft(
        out,
        'concrete',
        [
          chamferedRectangle(xx, 2.3, side * 7.8, 6.8, 6.8, 0.7),
          chamferedRectangle(xx, h - 6.5, side * 7.8, 5.3, 5.3, 0.6),
          chamferedRectangle(xx, h - 1.2, side * 7.8, 7.2, 12.1, 0.6),
        ],
        concrete,
      );
    box(out, 'concrete', [xx - 4.1, h - 2.2, -14.2], [xx + 4.1, h - 0.7, 14.2], concrete);
    for (const z of [-9.2, -5.7, 5.7, 9.2])
      box(out, 'iron', [xx - 0.75, h - 0.7, z - 0.65], [xx + 0.75, h, z + 0.65], dark);
  }
}

function lights(out) {
  for (let x = -1116; x <= 1116; x += 36)
    for (const side of [-1, 1]) {
      const z = side * 12.6,
        y = deckY(x);
      line(out, 'steel', [x, y + 0.15, z], [x, y + 10.5, z], 0.071, steel, 16);
      const pts = Array.from({ length: 17 }, (_, i) => {
        const t = i / 16;
        return [x, y + 10.1 + 0.6 * Math.sin((t * Math.PI) / 2), z - side * 2.05 * t];
      });
      for (let i = 1; i < pts.length; i++) line(out, 'steel', pts[i - 1], pts[i], 0.045, steel, 12);
      sphere(out, 'iron', [x, y + 10.72, z - side * 2.06], [0.18, 0.085, 0.39], steel, 20, 10);
      sphere(
        out,
        'marking',
        [x, y + 10.65, z - side * 2.06],
        [0.14, 0.018, 0.31],
        [0.81, 0.85, 0.79],
        16,
        8,
      );
    }
}

export function buildYiSunSin(out) {
  deck(out);
  tower(out, -halfSpan);
  tower(out, halfSpan);
  suspension(out);
  anchorages(out);
  lights(out);
}
export const yiSunSinStudy = {
  id: 'N0025',
  key: 'yi_sun_sin_bridge',
  title: 'Yi Sun-sin Bridge',
  wikidataId: 'Q498235',
  mapFrameDocument: 'map-frame.json',
  build: buildYiSunSin,
  brief:
    'The 1,545 m Korean suspension crossing with inclined chamfered concrete H towers, twin streamlined box decks, open wind slot, cable bands and paired hangers, unequal rock/gravity anchorages and permanent maintenance hardware.',
  refs: [
    'https://yscms.yeosu.go.kr/tour/leisure/bridge/yisunsin_bridge',
    'https://www.lusas.com/case/bridge/yi_sun_sin.html',
    'https://m.dlenc.co.kr/m/pr/InfoView.do?cd_mnu=KM030&no_ntc_plte_sral=7111',
    'https://www.gleitbau.com/en/projects/yi-sun-sin-grand-bridge',
    'https://www.gleitbau.com/en/download/project/248',
    'https://trid.trb.org/View/1100291',
    'https://doi.org/10.2749/101686612X13216060213158',
    'https://doi.org/10.1016/j.engstruct.2015.06.031',
    'https://www.openstreetmap.org/way/165044187',
    'https://www.openstreetmap.org/way/643846203',
  ],
  sourceFacts: {
    spansMeters: [357.5, 1545, 357.5],
    deckLengthMeters: 2260,
    anchorSpacingMeters: 2545,
    ownerWidthMeters: 25.7,
    publishedAerodynamicWidthMeters: 29.1,
    boxDepthMeters: 3,
    contractorPylonHeightMeters: 272.7,
    crossbeamLevelsMeters: [164, 255],
    cableSagRatio: '1/9',
    openingDate: '2013-02-08',
  },
  reconstruction: {
    cableDiameterMeters: 0.68,
    hangerPitchMeters: 18,
    deckCenterRoadElevationMeters: 88.05,
    deckEndRoadElevationMeters: 63.05,
    notes:
      'Width references describe different sections; 25.7 m top platform and 29.1 m aerodynamic envelope are retained separately. Six-metre slot, precise tower sections, anchor housing profiles, hanger and lamp pitches and road vertical curve remain reconstructed pending as-built drawings.',
  },
  nativeAxes: {
    x: 'north toward Gwangyang gravity anchorage',
    y: 'up from sea-level reference plane',
    z: 'east toward industrial shoreline',
  },
  geographic: () => ({
    anchor: [127.7049660249937, 34.90595],
    heading: 1.5657951,
    elevationMode: 'sea-level',
    elevationMeters: 0,
    notes:
      'Published 2260 m suspension deck centered on aerial tower foundations, independently of the 3794.742 m approach-road map extent. +X points north to gravity anchorage, -X to Myodo rock anchorage. Absolute elevations are provisional until owner vertical datum and approaches are checked.',
  }),
  limitations: [
    'Exact as-built deck section and road vertical curve remain under review; published 25.7 m, 26.97 m and 29.1 m widths must not be treated as identical definitions.',
    'Tower ground positions were checked against aerial foundation pads, not displaced tower tops; expected horizontal uncertainty is several metres.',
    'Saddle housings, hanger pitch, pier sections, lamps and anchorage exterior proportions are photographic reconstructions.',
    'The mainland approach viaduct beyond the 2260 m suspension deck is separate from this asset; the viewer must supply its adjoining elevated road.',
  ],
  camera: { position: [1450, 590, 1520], lookAt: [0, 115, 0], fov: 45 },
  qaCameras: [
    { name: 'main-elevation', position: [0, 210, 3020], lookAt: [0, 130, 0] },
    { name: 'south-tower', position: [-860, 142, 164], lookAt: [-772.5, 139, 0] },
    { name: 'tower-head', position: [-820, 280, 48], lookAt: [-772.5, 263, 0] },
    { name: 'tower-foot', position: [-805, 22, 75], lookAt: [-772.5, 12, 0] },
    { name: 'twin-box-soffit', position: [85, 68, 37], lookAt: [60, 86, 0] },
    { name: 'open-wind-slot', position: [100, 95, 0], lookAt: [10, 88, 0] },
    { name: 'cable-band', position: [14, 109, 22], lookAt: [12, mainY(12), 14.55] },
    { name: 'hanger-socket', position: [14, 88, 20], lookAt: [12, deckY(12) - 0.5, 14.55] },
    { name: 'road-barriers', position: [45, 91, 10], lookAt: [-90, 88, 10] },
    { name: 'deck-end-pier', position: [1210, 44, 82], lookAt: [1130, 29, 0] },
    { name: 'north-gravity-anchorage', position: [1372, 70, 96], lookAt: [1283.5, 22, 0] },
    { name: 'south-rock-anchorage', position: [-1350, 70, 82], lookAt: [-1275, 28, 0] },
    { name: 'street-light', position: [43, 98, 20], lookAt: [36, 97.8, 12.6] },
  ],
};
