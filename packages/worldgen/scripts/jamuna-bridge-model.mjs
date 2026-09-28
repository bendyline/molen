/** Jamuna's original concrete crossing: engineering sections, curved plan and exposed services. */
import { beam, loft, radialRing, sphere } from './authored-structure-mesh.mjs';
import { tube } from './structure-mesh.mjs';

const concrete = [0.69, 0.685, 0.635];
const pale = [0.77, 0.76, 0.7];
const metal = [0.52, 0.55, 0.54];
const dark = [0.16, 0.18, 0.18];
const radius = 12003.42057124;
const circleX = 2.943736527;
const circleZ = 11871.608378814 - 1.75;
const stationShift = -3.0105926;
const mainEnd = 2400;
const end = 2528;
const span = 99.375;
const supports = [-2400, ...Array.from({ length: 48 }, (_, i) => -2335.3125 + i * span), 2400];

// The raw map line is the road center, displaced south of the whole structural deck.
const plan = (s, z = 0, y = 0) => {
  const a = (s + stationShift) / radius;
  return [circleX + (radius - z) * Math.sin(a), y, circleZ - (radius - z) * Math.cos(a)];
};
// Local zero is the published +11m PWD pile-cap base; the sampled terrain datum is unverified.
const grade = (s) => 22.55 - 10.15 * (Math.abs(s) / end) ** 2;
const deck = (s, z = 0, h = 0) => plan(s, z, grade(s) - 0.025 * Math.abs(z - 1.7) + h);

function sectionLoft(out, slot, s0, s1, profile, color, steps = 1) {
  const rings = Array.from({ length: steps + 1 }, (_, i) => {
    const s = s0 + ((s1 - s0) * i) / steps;
    return profile(s).map(([z, h]) => deck(s, z, h));
  });
  loft(out, slot, rings, color, { cap: false });
}
function strip(out, slot, s0, s1, z0, z1, low, high, color, steps = 1) {
  sectionLoft(
    out,
    slot,
    s0,
    s1,
    () => [
      [z0, high],
      [z1, high],
      [z1, low],
      [z0, low],
    ],
    color,
    steps,
  );
  // Closed end plates are made separately so thin roadside hardware has no open ends.
  for (const [s, reverse] of [
    [s0, true],
    [s1, false],
  ]) {
    let p = [
      [z0, high],
      [z1, high],
      [z1, low],
      [z0, low],
    ].map(([z, h]) => deck(s, z, h));
    if (reverse) p = p.reverse();
    const a = (s + stationShift) / radius;
    out.addQuad(
      slot,
      'palette:#ffffff',
      p,
      [Math.cos(a) * (reverse ? -1 : 1), 0, Math.sin(a) * (reverse ? -1 : 1)],
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
      color,
    );
  }
}
function localBox(out, slot, s, z, y, width, depth, height, color) {
  const rings = [y, y + height].map((h) =>
    [
      [-width / 2, -depth / 2],
      [-width / 2, depth / 2],
      [width / 2, depth / 2],
      [width / 2, -depth / 2],
    ].map(([ds, dz]) => plan(s + ds, z + dz, h)),
  );
  loft(out, slot, rings, color);
}
function boxDepth(s) {
  let i = 0;
  while (i < supports.length - 2 && s > supports[i + 1]) i++;
  const t = (s - supports[i]) / (supports[i + 1] - supports[i]);
  return 3.3 + 2.9 * (2 * t - 1) ** 2;
}
function boxSection(out, s0, s1, tint) {
  sectionLoft(
    out,
    'concrete',
    s0,
    s1,
    (s) => {
      const d = boxDepth(s);
      return [
        [-9.25, 0],
        [9.25, 0],
        [9.25, -0.28],
        [5.3, -0.72],
        [3.2, -d],
        [-3.2, -d],
        [-5.3, -0.72],
        [-9.25, -0.28],
      ];
    },
    tint,
    3,
  );
  // Interior shell retained at open movement joints, never a solid filled trapezoid.
  sectionLoft(
    out,
    'concrete',
    s0,
    s1,
    (s) => {
      const d = boxDepth(s);
      return [
        [-4.55, -0.65],
        [-2.75, -d + 0.45],
        [2.75, -d + 0.45],
        [4.55, -0.65],
      ];
    },
    [0.48, 0.48, 0.445],
    3,
  );
}
function superstructure(out) {
  for (let i = 0; i < supports.length - 1; i++) {
    const a = supports[i],
      b = supports[i + 1],
      mid = (a + b) / 2;
    // Twelve standard 4m cantilever segments flank each regular midspan closure.
    const stations =
      i === 0 || i === 48
        ? Array.from({ length: 18 }, (_, k) => a + ((b - a) * k) / 17)
        : [
            a,
            a + 1,
            ...Array.from({ length: 12 }, (_, k) => a + 1 + 4 * (k + 1)),
            mid + 0.6875,
            ...Array.from({ length: 12 }, (_, k) => b - 49 + 4 * (k + 1)),
            b,
          ];
    const cuts = [...new Set(stations)].sort((x, y) => x - y);
    for (let j = 1; j < cuts.length; j++) {
      const s0 = cuts[j - 1] + 0.008,
        s1 = cuts[j] - 0.008;
      if (s1 <= s0) continue;
      const tint = concrete.map((n) => n * (0.986 + 0.007 * ((i + j) % 5)));
      boxSection(out, s0, s1, tint);
    }
  }
  for (const side of [-1, 1]) {
    for (let k = 0; k < 12; k++) {
      const s0 = side < 0 ? -end + k * 10 : mainEnd + 8 + k * 10,
        s1 = s0 + 10;
      strip(out, 'concrete', s0 + 0.012, s1 - 0.012, -9.25, 9.25, -0.4, 0, concrete, 2);
      for (const z of [-7.2, -3.6, 0, 3.6, 7.2])
        sectionLoft(
          out,
          'concrete',
          s0 + 0.04,
          s1 - 0.04,
          () => [
            [z - 0.32, -0.4],
            [z + 0.32, -0.4],
            [z + 0.13, -1.65],
            [z - 0.13, -1.65],
          ],
          concrete,
          2,
        );
    }
    strip(
      out,
      'concrete',
      side < 0 ? -2408 : 2400,
      side < 0 ? -2400 : 2408,
      -9.25,
      9.25,
      -1.5,
      0,
      concrete,
      2,
    );
  }
  for (let s = -end; s < end; s += 4) {
    const s1 = Math.min(end, s + 4);
    strip(out, 'road', s, s1, -5.35, 8.3, 0.025, 0.075, [0.235, 0.25, 0.255]);
    strip(out, 'concrete', s, s1, -8.9, -5.55, 0.025, 0.085, [0.57, 0.57, 0.535]);
    for (const z of [-5.44, 1.58]) {
      sectionLoft(
        out,
        'concrete',
        s + 0.014,
        s1 - 0.014,
        () => [
          [z - 0.28, 0.07],
          [z - 0.12, 0.7],
          [z - 0.075, 0.88],
          [z + 0.075, 0.88],
          [z + 0.12, 0.7],
          [z + 0.28, 0.07],
        ],
        pale,
      );
    }
    for (const side of [-1, 1]) {
      const z = side * 9.03;
      strip(out, 'concrete', s + 0.014, s1 - 0.014, z - 0.17, z + 0.17, -0.02, 0.32, pale);
      for (const h of [0.61, 1.05])
        tube(out, 'steel', deck(s, z, h), deck(s1, z, h), 0.045, metal, 12);
      for (const px of [s, s + 2])
        if (px < end) {
          localBox(out, 'steel', px, z, deck(px, z, 0.3)[1], 0.15, 0.15, 0.78, metal);
          localBox(out, 'steel', px, z, deck(px, z, 0.29)[1], 0.25, 0.23, 0.05, dark);
        }
    }
    for (const z of [-5.03, 1.19, 1.98, 8.06])
      strip(out, 'marking', s, s1, z - 0.05, z + 0.05, 0.079, 0.083, [0.84, 0.835, 0.73]);
  }
  for (let s = -end + 2; s < end - 3; s += 9)
    for (const z of [-1.92, 5.02])
      strip(out, 'marking', s, s + 3, z - 0.065, z + 0.065, 0.079, 0.084, [0.89, 0.89, 0.84]);
  // Six module hinges and the end bearings: full-depth joint shadows with comb plates.
  for (const s of [
    -2400, -1739.0625, -1043.4375, -347.8125, 347.8125, 1043.4375, 1739.0625, 2400,
  ]) {
    strip(out, 'iron', s - 0.11, s + 0.11, -9.24, 9.24, 0.084, 0.098, dark);
    for (let z = -9.1; z < 9.2; z += 0.18)
      strip(out, 'steel', s - 0.23, s + 0.23, z, z + 0.08, 0.1, 0.12, metal);
  }
}
function piers(out) {
  for (let i = 0; i < supports.length; i++) {
    const s = supports[i],
      top = grade(s) - boxDepth(s) - 0.55;
    // Main pier stems: 2.5m along the bridge, 6.4m across, from the 2005 section.
    const base = Math.min(7, top - 2.72);
    const ring = (y, wx, wz) => radialRing(y, wx, wz, 64).map((p) => plan(s + p[0], p[2], p[1]));
    loft(
      out,
      'concrete',
      [ring(0, 3.7, 5.5), ring(base - 0.3, 2.8, 3.8), ring(base, 2.5, 3.5)],
      concrete,
    );
    localBox(out, 'concrete', s, 0, base, 2.5, 6.4, top - base, pale);
    localBox(out, 'concrete', s, 0, top, 2.9, 6.8, 0.2, concrete);
    for (const z of [-2.1, 2.1]) {
      localBox(out, 'concrete', s, z, top + 0.2, 1.4, 1.4, 0.18, pale);
      localBox(out, 'iron', s, z, top + 0.38, 1.22, 1.22, 0.17, dark);
      for (const ds of [-0.49, 0.49])
        for (const dz of [-0.49, 0.49])
          tube(
            out,
            'steel',
            plan(s + ds, z + dz, top + 0.52),
            plan(s + ds, z + dz, top + 0.61),
            0.055,
            metal,
            8,
          );
    }
    // Pile-cap formwork bands remain visible above low water.
    for (let y = 0.8; y < base - 0.7; y += 1.2) {
      const q = y / base;
      loft(
        out,
        'concrete',
        [ring(y, 3.7 - 0.9 * q, 5.5 - 1.7 * q), ring(y + 0.025, 3.702 - 0.9 * q, 5.502 - 1.7 * q)],
        [0.58, 0.59, 0.545],
        { cap: false },
      );
    }
  }
  for (const side of [-1, 1])
    for (let k = 0; k <= 12; k++) {
      const s = side * (-end + k * 10),
        top = grade(s) - 1.67;
      for (const z of [-5.6, 0, 5.6])
        tube(out, 'concrete', plan(s, z, 0), plan(s, z, top - 0.55), 0.65, concrete, 40);
      localBox(out, 'concrete', s, 0, top - 0.55, 1.3, 14, 0.55, pale);
    }
  for (const side of [-1, 1])
    localBox(out, 'concrete', side * end, 0, 0, 2.2, 20, grade(side * end) - 0.4, concrete);
}
function services(out) {
  // South cantilever gas pipeline, suspended saddles, segment couplers and drains.
  for (let s = -end; s < end; s += 5) {
    const s1 = Math.min(end, s + 5);
    tube(out, 'iron', deck(s, 6.8, -1.25), deck(s1, 6.8, -1.25), 0.375, [0.46, 0.48, 0.44], 24);
    for (const z of [6.18, 7.42])
      tube(out, 'steel', deck(s, z, -0.28), deck(s, z, -1.78), 0.034, metal, 10);
    beam(out, 'steel', deck(s, 6.1, -1.78), deck(s, 7.5, -1.78), 0.09, 0.09, metal);
    // Curved bearing saddle fills the small gap between the round pipe and crossbar.
    const saddleRings = [-0.07, 0.07].map((ds) => {
      const outer = Array.from({ length: 19 }, (_, j) => {
        const angle = Math.PI + (j * Math.PI) / 18;
        return deck(s + ds, 6.8 + 0.4 * Math.cos(angle), -1.25 + 0.4 * Math.sin(angle));
      });
      const inner = Array.from({ length: 19 }, (_, j) => {
        const angle = 2 * Math.PI - (j * Math.PI) / 18;
        return deck(s + ds, 6.8 + 0.375 * Math.cos(angle), -1.25 + 0.375 * Math.sin(angle));
      });
      return [...outer, ...inner].reverse();
    });
    loft(out, 'steel', saddleRings, metal, { cap: false });
    localBox(out, 'steel', s, 6.8, deck(s, 6.8, -1.74)[1], 0.14, 0.22, 0.11, metal);
    if (Math.round(s) % 20 === 12)
      tube(
        out,
        'iron',
        deck(s, 6.8, -1.25),
        deck(s + 0.13, 6.8, -1.25),
        0.4,
        [0.35, 0.39, 0.37],
        24,
      );
  }
  // The 230kV line remains operational (August2026 owner maintenance tender).
  const poles = [];
  for (let i = 1; i < supports.length - 1; i += 2) {
    const s = supports[i],
      z = -10.3,
      y = grade(s);
    poles.push(s);
    localBox(out, 'concrete', s, -9.5, y - 1.1, 3.5, 4.1, 1.1, concrete);
    for (const ds of [-1.1, 1.1])
      beam(out, 'concrete', deck(s + ds, -4.8, -4.8), deck(s + ds, z, -0.65), 0.55, 0.8, concrete);
    const rings = [0, 10, 20, 29].map((h) =>
      radialRing(y + h, 0.56 - 0.012 * h, 0.56 - 0.012 * h, 16).map((p) =>
        plan(s + p[0], z + p[2], p[1]),
      ),
    );
    loft(out, 'steel', rings, metal);
    localBox(out, 'iron', s, z, y - 0.02, 1.7, 1.7, 0.17, dark);
    for (const ds of [-0.68, 0.68])
      for (const dz of [-0.68, 0.68])
        tube(
          out,
          'steel',
          plan(s + ds, z + dz, y + 0.12),
          plan(s + ds, z + dz, y + 0.28),
          0.065,
          metal,
          8,
        );
    for (const h of [16, 21, 26])
      for (const sign of [-1, 1]) {
        const armz = z + sign * 3.8;
        beam(out, 'steel', plan(s, z, y + h), plan(s, armz, y + h + 0.3), 0.25, 0.28, metal);
        beam(out, 'steel', plan(s, z, y + h - 1.2), plan(s, armz, y + h + 0.3), 0.12, 0.12, metal);
        tube(out, 'iron', plan(s, armz, y + h + 0.3), plan(s, armz, y + h - 1.7), 0.06, dark, 12);
        for (let j = 0; j < 13; j++)
          sphere(
            out,
            'glass',
            plan(s, armz, y + h + 0.2 - j * 0.145),
            [0.14, 0.035, 0.14],
            [0.36, 0.48, 0.44],
            12,
            6,
          );
      }
    tube(out, 'steel', plan(s, z, y + 29), plan(s, z, y + 30.2), 0.045, metal, 12);
    sphere(out, 'iron', plan(s, z, y + 29.1), [0.13, 0.16, 0.13], [0.65, 0.08, 0.035], 16, 8);
  }
  for (let i = 1; i < poles.length; i++)
    for (const h of [14.3, 19.3, 24.3, 30])
      for (const dz of h === 30 ? [0] : [-3.8, 3.8]) {
        const a = poles[i - 1],
          b = poles[i];
        for (let j = 0; j < 32; j++) {
          const point = (t) => {
            const s = a + (b - a) * t;
            return plan(s, -10.3 + dz, grade(s) + h - 3.5 * 4 * t * (1 - t));
          };
          tube(out, 'iron', point(j / 32), point((j + 1) / 32), 0.019, [0.22, 0.25, 0.25], 6);
        }
      }
  for (let s = -end + 13; s < end; s += 33.125) {
    const z = 1.58;
    tube(out, 'steel', deck(s, z, 0.87), deck(s, z, 9.8), 0.075, metal, 16);
    for (const sign of [-1, 1]) {
      const p = deck(s, z + sign * 2.2, 10.2);
      tube(out, 'steel', deck(s, z, 9.7), p, 0.042, metal, 12);
      sphere(out, 'iron', p, [0.19, 0.08, 0.48], [0.58, 0.6, 0.59], 16, 8);
      sphere(
        out,
        'marking',
        [p[0], p[1] - 0.06, p[2]],
        [0.14, 0.035, 0.36],
        [0.86, 0.87, 0.8],
        16,
        6,
      );
    }
    localBox(out, 'iron', s, z, grade(s) + 0.88, 0.23, 0.23, 0.2, dark);
  }
}
export function buildJamuna(out) {
  superstructure(out);
  piers(out);
  services(out);
}
const camera = (name, s, z, h, targetS = s, targetZ = 0, targetH = 10) => ({
  name,
  position: deck(s, z, h),
  lookAt: deck(targetS, targetZ, targetH),
});
export const jamunaStudy = {
  id: 'N0023',
  key: 'jamuna_bridge',
  title: 'Jamuna Bridge',
  wikidataId: 'Q10729282',
  mapFrameDocument: 'map-frame.json',
  build: buildJamuna,
  brief:
    'Curved4800m segmental concrete crossing with47 equal main spans,2 end spans,128m approach viaducts, varying-depth single-cell box, paired seismic bearings, north-side230kV pylons and suspended south gas pipeline.',
  refs: [
    'https://www.iabse-bd.org/old/proceedings2005RP1.pdf',
    'https://www.iabse-bd.org/session/52.pdf',
    'https://iabse-bd.org/2020/pdf/26.pdf',
    'https://bba.gov.bd/pages/projects/6922d980dbfbab28ce04d529',
    'https://bangla.bppa.gov.bd/upload/noa/2026-05-06-08-56-37-Signed-NOA_28.04.2026--Jamuna-Deck-Renovation.pdf',
    'https://www.eprocure.gov.bd/resources/common/ViewTender.jsp?TenderCancel=false&id=1319559',
    'https://www.openstreetmap.org/way/279534616',
  ],
  sourceFacts: {
    mainLengthMeters: 4800,
    spanCount: 49,
    mainSpanMeters: 99.375,
    endSpanMeters: 64.6875,
    approachEachMeters: 128,
    deckWidthMeters: 18.5,
    mainPierCount: 50,
    pierStemSectionMeters: [2.5, 6.4],
    boxDepthRangeMeters: [3.3, 6.2],
    boxSegmentMeters: 4,
    source:
      'IABSE2005 proceedings pp2–5 and2015 drawing. BBA owner independently confirms4800m,49spans,50piers,128m approaches,18.5m width. Later2015 box-depth drawing differs slightly from2005 section.',
  },
  reconstruction: {
    notes:
      'Smooth circle fitted to exact mapped road centerline (maximum2.83m map residual), with1.75m transverse road-to-deck offset. Published PWD pier-cap base+11m and central road level+33.55m establish local vertical dimensions; approach grade remains provisional. Pile-cap profiles, pole arms and service fixtures are photographic reconstructions. Former railway strip is bare pending documentation of2026 conversion completion.',
  },
  nativeAxes: {
    x: 'east along the chord toward Bhuapur',
    y: 'up from published+11mPWD pile-cap base',
    z: 'south; gas pipeline side',
  },
  geographic: (mapped) => ({
    anchor: mapped.anchor,
    heading: mapped.heading,
    elevationMode: 'terrain-contact',
    notes:
      'ExactQ10729282/way279534616 curved road centerline, original evidence retained. Published5056m total structure excludes about6m road transition at either mapped end. Current terrain/river datum and approach connection remain pending; localzero is+11mPWD, not a verified ground altitude.',
  }),
  limitations: [
    'Actual river, sandbar and embankment fit needs terrain-aware bridge placement.',
    'Pole profiles, pile-cap shape, exposed service supports and grade remain reconstructions requiring closer current-photo comparison.',
    '2026 rail-lane widening is awarded; completion is unconfirmed, so the former north railway strip is modeled bare without inventing a completed widened carriageway.',
    'Buried foundation piles and temporary construction equipment are omitted from exterior geometry.',
  ],
  camera: { position: deck(-520, 165, 74), lookAt: deck(-90, 0, -3), fov: 48 },
  qaCameras: [
    { name: 'south-elevation', position: [0, 210, 3900], lookAt: [0, 18, -90] },
    { name: 'plan-curve', position: [0, 4200, 1], lookAt: [0, 0, 0] },
    camera('typical-span', -120, 90, 12, -100, 0, -2),
    camera('box-soffit', -95, 19, -12, -72, 0, -5),
    camera('pier-bearing', -49.6875, 15, -6, -49.6875, 0, -8),
    camera('north-pylon', 49.6875, -42, 19, 49.6875, -10, 15),
    camera('insulator-arms', 38, -23, 25, 49.6875, -10.3, 22),
    camera('road-deck', -80, 4, 1.7, -45, 1, 1.7),
    camera('gas-suspension', -112, 15, -2, -100, 6.8, -1.3),
    camera('west-approach', -2478, 52, 15, -2460, 0, -4),
    camera('east-approach', 2478, 52, 15, 2460, 0, -4),
  ],
};
