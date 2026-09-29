/** Detailed individual exteriors for the next skyline candidates. Meter units. */
import { ShapeUtils, Vector2 } from 'three';
import { beam, loft, normalFor, radialRing, torus } from './authored-structure-mesh.mjs';
import {
  axes,
  bandPlan,
  cap,
  clockwise,
  commonLimit,
  face,
  glazedOutline,
  grid,
  guardrail,
  lerp,
  localOutline,
  mappedCap,
  mappedSolid,
  panel,
  partPlan,
  partsEvidence,
  rectangularPlan,
  ringAt,
  shift,
  tri,
} from './signature-tower-expansion-models.mjs';
import { box, tube } from './structure-mesh.mjs';

const metal = [0.67, 0.72, 0.75],
  glass = [0.34, 0.46, 0.52];
const part = (key, id) => {
  const p = partsEvidence(key).find((p) => p.id === id);
  if (!p) throw Error(`Missing mapped part ${id}`);
  return p;
};
function edgeFrames(plan) {
  return plan
    .map((a, i) => {
      const b = plan[(i + 1) % plan.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return { a, b, len, n: [-(b[1] - a[1]) / len, 0, (b[0] - a[0]) / len] };
    })
    .filter((e) => e.len > 0.05);
}
function floorCurtain(out, plan, y0, y1, floors, body = glass, trim = metal, spandrel = 0.55) {
  for (const { a, b, n } of edgeFrames(plan)) {
    for (let floor = 0; floor < floors; floor++) {
      const lo = y0 + ((y1 - y0) * floor) / floors,
        hi = y0 + ((y1 - y0) * (floor + 1)) / floors;
      grid(
        out,
        [
          [a[0], lo, a[1]],
          [b[0], lo, b[1]],
          [b[0], hi - spandrel, b[1]],
          [a[0], hi - spandrel, a[1]],
        ],
        body,
        1.45,
        hi - lo,
        0.035,
        trim,
      );
      // Concave metal spandrels reflect both the sky and the glazing below.
      const levels = [
        [hi - spandrel, 0],
        [hi - spandrel * 0.7, -0.12],
        [hi - 0.09, -0.06],
        [hi, 0.01],
      ];
      for (let j = 1; j < levels.length; j++)
        face(
          out,
          'metal',
          [
            shift([a[0], levels[j - 1][0], a[1]], n, levels[j - 1][1]),
            shift([b[0], levels[j - 1][0], b[1]], n, levels[j - 1][1]),
            shift([b[0], levels[j][0], b[1]], n, levels[j][1]),
            shift([a[0], levels[j][0], a[1]], n, levels[j][1]),
          ],
          trim,
        );
    }
  }
}
function roofService(out, plan, y) {
  mappedSolid(out, 'metal', plan, y, y + 2, [0.42, 0.47, 0.49]);
  bandPlan(out, plan, y + 2, 0.18, 0.2, metal, 'metal');
}
function buildSevenWtc(out, m) {
  const key = 'n0153_7_world_trade_center',
    plan = partPlan(m, part(key, 1530740418));
  mappedSolid(out, 'stone', plan, 0, 0.3, [0.49, 0.51, 0.51]);
  glazedOutline(out, plan, 0.3, 8, 4, [0.24, 0.36, 0.41], metal, 0.045);
  for (const { a, b, n } of edgeFrames(plan)) {
    // Layered triangular-prism scrim above the transparent street lobby.
    face(
      out,
      'recess',
      [
        [a[0], 8, a[1]],
        [b[0], 8, b[1]],
        [b[0], 24.3, b[1]],
        [a[0], 24.3, a[1]],
      ],
      [0.16, 0.25, 0.32],
    );
    for (let y = 8.05; y < 24.2; y += 0.18) {
      const q = [
        shift([a[0], y, a[1]], n, 0.1),
        shift([b[0], y, b[1]], n, 0.1),
        shift([b[0], y + 0.065, b[1]], n, 0.24),
        shift([a[0], y + 0.065, a[1]], n, 0.24),
      ];
      face(out, 'metal', q, [0.53, 0.61, 0.68]);
      face(
        out,
        'metal',
        [
          q[3],
          q[2],
          shift([b[0], y + 0.13, b[1]], n, 0.08),
          shift([a[0], y + 0.13, a[1]], n, 0.08),
        ],
        [0.7, 0.75, 0.78],
      );
    }
    for (let u = 0; u <= 1; u += 1 / Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 4.57)) {
      const p = lerp(a, b, u);
      beam(out, 'metal', [p[0], 8, p[1]], [p[0], 24.3, p[1]], 0.08, 0.3, [0.44, 0.49, 0.51]);
    }
  }
  floorCurtain(out, plan, 24.3, 221.2, 47, glass, metal, 0.46);
  glazedOutline(out, plan, 221.2, 223, 1.8, [0.23, 0.33, 0.37], [0.5, 0.55, 0.58], 0.05);
  mappedCap(out, 'concrete', plan, 223, [0.63, 0.65, 0.64]);
  bandPlan(out, plan, 223, 0.4, 0.55, [0.68, 0.71, 0.72], 'metal');
  const service = partPlan(m, part(key, 1530740417));
  roofService(out, service, 223.85); // Published SOM741 ft datum =225.8568 m.
  for (let x = -16; x < 5; x += 5)
    box(out, 'metal', [x, 223.05, -8], [x + 3.4, 224.1, 1], [0.46, 0.51, 0.53]);
}
function buildTrump(out, m) {
  const key = 'n0152_trump_tower';
  const tiers = [
    [265345374, 0, 20],
    [159831423, 20, 25],
    [159831419, 25, 30],
    [159831422, 30, 35],
    [159831420, 35, 40],
    [159831421, 40, 45],
    [159831418, 45, 202.4],
  ];
  const bronze = [0.2, 0.18, 0.145],
    window = [0.14, 0.135, 0.12];
  for (const [id, lo, hi] of tiers) {
    const plan = partPlan(m, part(key, id));
    if (lo === 0) mappedSolid(out, 'stone', plan, 0, 0.25, [0.3, 0.28, 0.23]);
    floorCurtain(
      out,
      plan,
      Math.max(0.25, lo),
      hi,
      Math.max(1, Math.round((hi - lo) / 3.26)),
      window,
      bronze,
      0.78,
    );
    mappedCap(out, 'concrete', plan, hi, [0.3, 0.31, 0.28]);
    bandPlan(out, plan, hi - 0.15, 0.15, 0.25, bronze, 'metal');
    if (hi < 50 && hi >= 25) {
      // Narrow planted ledges follow the surveyed southeast sawtooth setbacks.
      const step = (hi - 25) / 5,
        x = -24.3 + step * 4.01,
        z = 15.3;
      box(out, 'stone', [x - 0.7, hi, z - 1.15], [x + 2.2, hi + 0.65, z + 0.1], [0.28, 0.29, 0.25]);
      for (let i = 0; i < 4; i++)
        loft(
          out,
          'recess',
          [
            radialRing(hi + 0.6, 0.55, 0.5, 10, [x - 0.2 + i * 0.55, z - 0.52]),
            radialRing(hi + 1.2, 0.72, 0.58, 10, [x - 0.2 + i * 0.55, z - 0.52]),
            radialRing(hi + 1.6, 0.13, 0.12, 10, [x - 0.2 + i * 0.55, z - 0.52]),
          ],
          [0.16, 0.25, 0.12],
        );
    }
  }
  // Recessed Fifth Avenue storefront, gold transoms and bronze entrance canopy.
  for (let z = -13; z < 13; z += 4.35) {
    beam(out, 'metal', [-26.3, 0.25, z], [-26.3, 5.1, z], 0.12, 0.12, [0.67, 0.48, 0.19]);
    box(out, 'metal', [-27.4, 5.1, z - 1.85], [-26.1, 5.45, z + 1.85], [0.57, 0.4, 0.16]);
  }
  const roof = rectangularPlan(11, 7, 1, -7);
  roofService(out, roof, 199.9);
}
function buildNyt(out, m) {
  const key = 'n0155_new_york_times_building',
    base = localOutline(m);
  const holes = (m.geometry.holes ?? []).slice(0, 1).map((r) => clockwise(r.slice(0, -1)));
  mappedSolid(out, 'stone', base, 0, 0.25, [0.64, 0.64, 0.61], holes);
  const podium = partPlan(m, part(key, 260282083));
  glazedOutline(out, podium, 0.25, 24.6, 4.88, [0.28, 0.38, 0.41], metal, 0.055);
  mappedCap(out, 'concrete', podium, 24.6, [0.58, 0.6, 0.57]);
  const plan = partPlan(m, part(key, 138152327));
  floorCurtain(out, plan, 0.25, 228, 52, [0.33, 0.43, 0.46], [0.59, 0.63, 0.65], 0.65);
  mappedCap(out, 'concrete', plan, 228, [0.64, 0.66, 0.63]);
  const core = partPlan(m, part(key, 260282082));
  roofService(out, core, 230);
  // Ceramic baguettes: round76 mm sections at metric pitch, continuous within
  // each facade run. Minute butt joints do not duplicate collinear cylinders.
  for (const id of [260282084, 260282085, 260282086, 260282088]) {
    const p = partPlan(m, part(key, id));
    let edge = null;
    for (const e of edgeFrames(p)) if (!edge || e.len > edge.len) edge = e;
    const { a, b, n } = edge;
    const columns = Math.ceil(edge.len / 3);
    for (let i = 0; i <= columns; i++) {
      const q = lerp(a, b, i / columns);
      beam(out, 'metal', [q[0], 6, q[1]], [q[0], 259.8, q[1]], 0.15, 0.2, [0.67, 0.7, 0.69]);
      for (let y = 9; y < 228; y += 4.4)
        beam(out, 'metal', shift([q[0], y, q[1]], n, -0.8), [q[0], y, q[1]], 0.1, 0.1, metal);
    }
    let row = 0;
    for (let y = 6.2; y < 259.7; y += 0.325, row++) {
      if (y > 228 && row % Math.max(1, Math.floor((y - 224) / 6))) continue;
      tube(out, 'cladding', [a[0], y, a[1]], [b[0], y, b[1]], 0.0381, [0.88, 0.88, 0.82], 8);
    }
  }
  // External corner columns and diagonal ties are the tower's visible steel frame.
  for (const { a, b, len, n } of edgeFrames(plan)) {
    if (len < 6) continue;
    for (const p of [a, b])
      beam(
        out,
        'metal',
        shift([p[0], 0.3, p[1]], n, 0.22),
        shift([p[0], 230, p[1]], n, 0.22),
        0.48,
        0.48,
        [0.7, 0.72, 0.71],
      );
    if (len < 17)
      for (let y = 18; y < 208; y += 17.6) {
        beam(
          out,
          'metal',
          shift([a[0], y, a[1]], n, 0.2),
          shift([b[0], y + 17.6, b[1]], n, 0.2),
          0.22,
          0.25,
          [0.69, 0.71, 0.7],
        );
        beam(
          out,
          'metal',
          shift([b[0], y, b[1]], n, 0.2),
          shift([a[0], y + 17.6, a[1]], n, 0.2),
          0.22,
          0.25,
          [0.69, 0.71, 0.7],
        );
      }
  }
  const center = [-36.38, 0.32];
  loft(
    out,
    'metal',
    [
      [232, 1.1],
      [274, 0.75],
      [300, 0.34],
      [319, 0.04],
    ].map(([y, r]) => radialRing(y, r, r, 12, center)),
    [0.7, 0.72, 0.71],
  );
  for (const y of [243, 256, 271, 288, 303]) {
    const r = 1.4 * (1 - (y - 232) / 105);
    tube(
      out,
      'metal',
      [center[0] - r, y, center[1]],
      [center[0] + r, y, center[1]],
      0.07,
      [0.6, 0.64, 0.65],
      6,
    );
  }
  guardrail(out, ringAt(podium, 24.7), 1.1, [0.56, 0.61, 0.6]);
}

export const skylineNext = [
  {
    id: 'N0153',
    key: '7_world_trade_center',
    wikidataId: 'Q270066',
    title: '7 World Trade Center',
    height: 225.85,
    build: buildSevenWtc,
    brief:
      'The current2006 tower: a mapped oblique parallelogram of pale reflective glazing, concave stainless-steel spandrels, detailed triangular metal scrim above the ground lobby, and mapped rooftop service volumes.',
    sourceFacts: {
      completion: 2006,
      floors: 52,
      heightFeet: 741,
      heightMeters: 225.8568,
      facade: 'Low-iron glass, concave316 stainless steel spandrels, triangular metal scrim',
    },
    reconstruction: {
      plan: 'Exact current-building way277890516; roof parts1530740417/418; source map-parts.json',
      heightDatum: 'SOM741 ft preferred to rounded228 m OSM roof value',
      podiumScrimHeightMeters: [8, 24.3],
    },
    refs: [
      'https://www.som.com/projects/7-world-trade-center/',
      'https://wtc.com/work-place/7wtc/',
      'https://www.imoa.info/molybdenum-uses/molybdenum-grade-stainless-steels/architecture/world-trade-center.php',
      'https://www.openstreetmap.org/way/277890516',
    ],
    nativeAxes: axes,
    geographic: (m) => ({
      heading: m.heading,
      notes:
        'Signed mapped oblique footprint is the completed2006 building, with exact-QID start_date2006 and independently mapped roof service part. Ground datumY0; no historical destroyed building substituted.',
    }),
    limitations: [
      commonLimit,
      'Static daylight facade. The scrim uses continuous modeled triangular strips with panel seams; the individual micro-prism orientation field and nighttime LED art are not reconstructed. Roof services are simplified within mapped extents.',
    ],
    camera: { position: [220, 166, 360], lookAt: [0, 107, 0], fov: 44 },
    qaCameras: [
      { name: 'steel-scrim', position: [-68, 24, 97], lookAt: [-8, 17, 24] },
      { name: 'concave-spandrels', position: [-34, 110, 69], lookAt: [0, 105, 24] },
      { name: 'roof-plant', position: [78, 265, 118], lookAt: [6, 223, 0] },
      { name: 'ground-lobby', position: [-45, 7, 86], lookAt: [-8, 4, 24] },
      { name: 'far-silhouette', position: [-354, 202, 529], lookAt: [0, 112, 0] },
    ],
  },
  {
    id: 'N0152',
    key: 'trump_tower',
    wikidataId: 'Q868772',
    title: 'Trump Tower',
    height: 202.4,
    build: buildTrump,
    brief:
      'The Fifth Avenue bronze-glass tower with its exact distinctive sawtooth shaft, five sequential planted lower terraces, dark horizontal bronze spandrels, gold storefront transoms and bronze entrance canopy.',
    sourceFacts: {
      heightMeters: 202.4,
      occupiedFloors: 58,
      marketedFloors: 68,
      architect: 'Der Scutt',
      lowerSetbackHeightsMeters: [20, 25, 30, 35, 40, 45],
    },
    reconstruction: {
      plan: 'Separate202 m tower part159831418 and five successive mapped lower setback parts, anchored in exact-QID ground part265345374',
      facade:
        'Bronze tinted glass with three-dimensional concave spandrel courses and modeled terrace planting',
    },
    refs: [
      'https://www.trumptowerny.com/',
      'https://www.skyscrapercenter.com/building/trump-tower/1611',
      'https://www.openstreetmap.org/way/159831418',
      'https://www.openstreetmap.org/way/265345374',
    ],
    nativeAxes: axes,
    geographic: (m) => ({
      heading: m.heading,
      notes:
        'Exact mapped sawtooth shaft and all five lower setback parts preserve their signed frame relative to Fifth Avenue. Main shaft is not inferred from the20 m exact-QID ground part. Ground datumY0.',
    }),
    limitations: [
      commonLimit,
      'Terrace planting and storefront bays are reconstructed. Building height202.4 m and58 physical stories follow CTBUH; the owner markets68 floors. Fine storefront signage and tenant interiors are omitted.',
    ],
    camera: { position: [-163, 137, 282], lookAt: [-3, 92, 0], fov: 44 },
    qaCameras: [
      { name: 'sawtooth-facade', position: [-80, 113, 109], lookAt: [-9, 104, 5] },
      { name: 'planted-terraces', position: [-74, 61, 78], lookAt: [-11, 33, 10] },
      { name: 'bronze-spandrels', position: [-48, 127, 45], lookAt: [-11, 125, 4] },
      { name: 'fifth-avenue', position: [-64, 8, 34], lookAt: [-25, 4, 2] },
      { name: 'far-silhouette', position: [-305, 175, 424], lookAt: [-3, 102, 0] },
    ],
  },
  {
    id: 'N0155',
    key: 'new_york_times_building',
    wikidataId: 'Q192680',
    title: 'New York Times Building',
    height: 319,
    build: buildNyt,
    brief:
      'The Renzo Piano tower with the mapped cruciform glazed shaft, a round ceramic-baguette second skin fading above the roof, exposed corner steel bracing, slender319 m mast and low courtyard-preserving eastern podium.',
    sourceFacts: {
      floors: 52,
      roofMeters: 228,
      ceramicFacadeMeters: 260,
      antennaMeters: 319,
      ceramicRodDiameterMeters: 0.0762,
      publishedRodCount: 175000,
    },
    reconstruction: {
      geometry:
        'Mapped tower part138152327, four facade screens260282084/085/086/088, core260282082, podium260282083 and antenna260282087. Ceramic butt joints consolidated into continuous collinear cylindrical runs.',
      heightDatum:
        'Renzo Piano Foundation228/260/319 m published datums preferred to older OSM227/244 m estimates',
    },
    refs: [
      'https://www.fondazionerenzopiano.org/en/project/the-new-york-times-building/',
      'https://www.thorntontomasetti.com/project/new-york-times-building',
      'https://www.hmwhitesa.com/site/assets/files/1212/the_new_york_times_building.pdf',
      'https://www.openstreetmap.org/relation/1860567',
    ],
    nativeAxes: axes,
    geographic: (m) => ({
      heading: m.heading,
      notes:
        'Whole-complex frame retains the courtyard and podium; independent western tower and screen parts supply the actual shaft location and signed facade orientation. Mast center comes from mapped part260282087. GroundY0.',
    }),
    limitations: [
      commonLimit,
      'Rod rows, supports, round sections and fading roof screen are modeled. Tiny ceramic butt joints are consolidated; individual bracket engineering and tenant signage are simplified. The primary designer260 m facade datum differs from older mapped244 m screen tags.',
    ],
    camera: { position: [-275, 225, 451], lookAt: [-23, 144, 0], fov: 44 },
    qaCameras: [
      { name: 'ceramic-rods', position: [-87, 110, 83], lookAt: [-38, 105, 29] },
      { name: 'exposed-bracing', position: [-96, 64, 64], lookAt: [-55, 62, 23] },
      { name: 'fading-crown', position: [-137, 286, 148], lookAt: [-36, 248, 0] },
      { name: 'courtyard-podium', position: [79, 63, 115], lookAt: [14, 18, 0] },
      { name: 'far-silhouette', position: [-441, 261, 653], lookAt: [-22, 156, 0] },
    ],
  },
];

function partRoof(m, p, plan, offset = 0) {
  const bearing = (+(p.tags['roof:direction'] ?? 0) * Math.PI) / 180;
  const east = Math.sin(bearing),
    south = -Math.cos(bearing),
    dir = [
      east * Math.cos(m.heading) - south * Math.sin(m.heading),
      east * Math.sin(m.heading) + south * Math.cos(m.heading),
    ];
  const projection = plan.map((q) => q[0] * dir[0] + q[1] * dir[1]),
    lo = Math.min(...projection),
    hi = Math.max(...projection);
  return (q) =>
    +p.tags.height +
    offset -
    (+(p.tags['roof:height'] ?? 0) * (q[0] * dir[0] + q[1] * dir[1] - lo)) / (hi - lo || 1);
}
function slopedGlass(
  out,
  plan,
  roof,
  bottom = 0,
  color = glass,
  megaFrame = false,
  closeRoof = true,
  glassSlot = 'glass',
) {
  for (const { a, b, n, len } of edgeFrames(plan)) {
    const nx = Math.ceil(len / 1.55),
      top = Math.max(roof(a), roof(b));
    for (let i = 0; i < nx; i++)
      for (let y = bottom; y < top - 0.01; y += 4.15) {
        const pa = lerp(a, b, i / nx),
          pb = lerp(a, b, (i + 1) / nx);
        let poly = [
            [0, y],
            [1, y],
            [1, y + 4.15],
            [0, y + 4.15],
          ],
          clipped = [];
        const limit = (q) => q[1] - roof(lerp(pa, pb, q[0]));
        for (let j = 0; j < poly.length; j++) {
          const p = poly[j],
            q = poly[(j + 1) % poly.length],
            f = limit(p),
            g = limit(q);
          if (f <= 0) clipped.push(p);
          if ((f < 0 && g > 0) || (f > 0 && g < 0)) clipped.push(lerp(p, q, f / (f - g)));
        }
        clipped = clipped.filter(
          (p, j, arr) => j === 0 || Math.hypot(...p.map((v, k) => v - arr[j - 1][k])) > 0.0001,
        );
        if (clipped.length < 3) continue;
        const points = clipped.map(([t, y]) => {
          const q = lerp(pa, pb, t);
          return [q[0], y, q[1]];
        });
        const center = points.reduce(
          (s, p) => s.map((v, k) => v + p[k] / points.length),
          [0, 0, 0],
        );
        const inset = points.map((p) => lerp(p, center, 0.035));
        for (let j = 1; j < inset.length - 1; j++)
          if (Math.hypot(...normalFor(inset[0], inset[j], inset[j + 1])) > 0.5)
            tri(out, glassSlot, [inset[0], inset[j], inset[j + 1]], color);
        for (let j = 0; j < points.length; j++)
          face(
            out,
            'metal',
            [points[j], points[(j + 1) % points.length], inset[(j + 1) % points.length], inset[j]],
            [0.69, 0.74, 0.76],
          );
      }
    beam(
      out,
      'metal',
      [a[0], bottom, a[1]],
      [a[0], roof(a), a[1]],
      megaFrame ? 0.95 : 0.16,
      megaFrame ? 1.1 : 0.18,
      [0.72, 0.76, 0.77],
    );
    beam(
      out,
      'metal',
      [a[0], roof(a), a[1]],
      [b[0], roof(b), b[1]],
      megaFrame ? 0.9 : 0.14,
      megaFrame ? 1 : 0.17,
      [0.75, 0.79, 0.79],
    );
    if (megaFrame) {
      const clippedDiagonal = (p, q) => {
        const f = p[1] - roof([p[0], p[2]]) + 0.4,
          g = q[1] - roof([q[0], q[2]]) + 0.4;
        if (f >= 0 && g >= 0) return;
        if (f > 0) p = lerp(p, q, f / (f - g));
        else if (g > 0) q = lerp(q, p, g / (g - f));
        if (Math.hypot(...q.map((v, k) => v - p[k])) > 0.5)
          beam(out, 'metal', shift(p, n, 0.18), shift(q, n, 0.18), 0.72, 0.9, [0.76, 0.8, 0.81]);
      };
      for (let y = 8; y < top; y += 52) {
        clippedDiagonal([a[0], y, a[1]], [b[0], y + 52, b[1]]);
        clippedDiagonal([b[0], y, b[1]], [a[0], y + 52, a[1]]);
      }
    }
  }
  if (!closeRoof) return;
  for (const t of ShapeUtils.triangulateShape(
    plan.map((p) => new Vector2(...p)),
    [],
  )) {
    let points = t.map((i) => [plan[i][0], roof(plan[i]), plan[i][1]]);
    if (normalFor(...points)[1] < 0) points = points.toReversed();
    tri(
      out,
      'glass',
      points,
      color.map((v) => v * 1.08),
    );
  }
  // Project real mullion lines onto the inclined roof, clipped to its polygon.
  // A plain cap loses the glass scale completely on the large ICC splays.
  for (let axis = 0; axis < 2; axis++) {
    const other = 1 - axis;
    const low = Math.min(...plan.map((p) => p[axis]));
    const high = Math.max(...plan.map((p) => p[axis]));
    const step = axis ? 3.3 : 1.65;
    for (let a = low + step; a < high - 0.1; a += step) {
      const hits = [];
      for (let j = 0; j < plan.length; j++) {
        const p = plan[j],
          q = plan[(j + 1) % plan.length];
        if ((p[axis] <= a && q[axis] > a) || (q[axis] <= a && p[axis] > a))
          hits.push(lerp(p, q, (a - p[axis]) / (q[axis] - p[axis])));
      }
      hits.sort((p, q) => p[other] - q[other]);
      for (let j = 1; j < hits.length; j += 2) {
        const p = hits[j - 1],
          q = hits[j];
        if (Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.15)
          beam(
            out,
            'metal',
            [p[0], roof(p) + 0.035, p[1]],
            [q[0], roof(q) + 0.035, q[1]],
            0.075,
            0.095,
            metal,
          );
      }
    }
  }
}
function buildBoc(out, m) {
  const key = 'n0156_bank_of_china_tower',
    plan = localOutline(m);
  mappedSolid(out, 'stone', plan, 0, 0.35, [0.47, 0.49, 0.48]);
  for (const id of [279949066, 279949067, 279949068, 279949069]) {
    const p = part(key, id),
      q = partPlan(m, p),
      roof = partRoof(m, p, q, 5);
    slopedGlass(out, q, roof, 0.35, [0.31, 0.42, 0.47], true);
  }
  for (const id of [279949064, 279949065]) {
    const q = partPlan(m, part(key, id)),
      cx = q.reduce((s, p) => s + p[0], 0) / q.length,
      cz = q.reduce((s, p) => s + p[1], 0) / q.length;
    const highest = part(key, 279949067);
    const foot = partRoof(m, highest, partPlan(m, highest), 5)([cx, cz]) - 0.3;
    loft(
      out,
      'metal',
      [
        [foot, 0.91],
        [337, 0.66],
        [359, 0.3],
        [367.4, 0.025],
      ].map(([y, r]) => radialRing(y, r, r, 16, [cx, cz])),
      [0.71, 0.76, 0.78],
    );
    for (let y = 316; y < 359; y += 7)
      torus(out, 'metal', [cx, y, cz], 0.81 - (y - 316) * 0.011, 0.06, [0.56, 0.63, 0.66], 16, 5);
  }
  // Four stout corner columns and the lifted glazed banking-hall base.
  for (const [x, z] of plan)
    box(out, 'metal', [x - 0.47, 0.35, z - 0.47], [x + 0.47, 12, z + 0.47], [0.65, 0.69, 0.7]);
  bandPlan(out, plan, 8, 0.7, 0.9, [0.63, 0.69, 0.71], 'metal');
}
function buildIcc(out, m) {
  const key = 'n0154_international_commerce_centre',
    plan = localOutline(m);
  mappedSolid(out, 'stone', plan, 0, 0.35, [0.45, 0.48, 0.49]);
  floorCurtain(out, plan, 0.35, 20, 4, [0.26, 0.37, 0.44], [0.54, 0.61, 0.66], 0.65);
  // The re-entrant corners sharpen gently with height while the broad faces
  // remain almost vertical. Four face fins terminate independently at the crown.
  const stages = [
    20,
    50,
    85,
    110,
    ...Array.from({ length: 88 }, (_, i) => 114 + i * 4.1),
    475,
    480,
    484,
  ];
  const upper = (p, y) => {
    const f = 1 - (0.035 * Math.max(0, y - 110)) / 374;
    return [p[0] * f, y, p[1] * f];
  };
  for (let j = 1; j < stages.length; j++) {
    const y0 = stages[j - 1],
      y1 = stages[j];
    if (y1 <= y0) continue;
    for (let i = 0; i < plan.length; i++) {
      const a = plan[i],
        b = plan[(i + 1) % plan.length];
      grid(
        out,
        [upper(a, y0), upper(b, y0), upper(b, y1), upper(a, y1)],
        [0.34, 0.45, 0.51],
        1.52,
        4.1,
        0.065,
        [0.66, 0.71, 0.73],
      );
    }
  }
  mappedCap(
    out,
    'concrete',
    plan.map((p) => {
      const q = upper(p, 484);
      return [q[0], q[2]];
    }),
    484,
    [0.6, 0.63, 0.64],
  );
  for (const { a, b, len } of edgeFrames(plan))
    if (len > 40) {
      for (let i = 0; i <= Math.ceil(len / 3); i++) {
        const p = lerp(a, b, i / Math.ceil(len / 3));
        beam(out, 'metal', upper(p, 30), upper(p, 483.7), 0.14, 0.22, [0.72, 0.77, 0.79]);
      }
      for (const y of [199, 303, 388, 430])
        beam(out, 'metal', upper(a, y), upper(b, y), 0.45, 0.65, [0.62, 0.68, 0.71]);
    }
  // Exact mapped glass splay/atrium strips preserve the pronounced long north
  // entrance rather than choosing a quarter-turn from a nearly square plan.
  for (const p of partsEvidence(key).filter((p) => p.id !== 25590249)) {
    const q = partPlan(m, p),
      roof = partRoof(m, p, q);
    // These roofs sit on the elevated retail podium. Include the local support
    // beneath each mapped strip so the standalone landmark remains grounded.
    mappedCap(out, 'concrete', q, 0, [0.54, 0.56, 0.55], [], true);
    mappedCap(out, 'concrete', q, 20, [0.54, 0.56, 0.55]);
    floorCurtain(out, q, 0, 20, 4, [0.27, 0.36, 0.4], [0.5, 0.57, 0.6], 0.7);
    slopedGlass(out, q, roof, 20, [0.31, 0.44, 0.49]);
  }
}
function gothicWall(out, plan, y0, y1, dy = 3.8, color = [0.83, 0.8, 0.7]) {
  mappedSolid(out, 'cladding', plan, y0, y1, color);
  for (const { a, b, n, len } of edgeFrames(plan)) {
    const count = Math.max(1, Math.round(len / 2.8));
    for (let i = 0; i < count; i++) {
      const c = lerp(a, b, (i + 0.5) / count),
        t = [(b[0] - a[0]) / len, 0, (b[1] - a[1]) / len];
      const at = (x, y, d = 0.065) => [c[0] + t[0] * x + n[0] * d, y, c[1] + t[2] * x + n[2] * d];
      for (let y = y0 + 1; y < y1 - 2; y += dy) {
        const h = Math.min(2.25, y1 - y - 0.4),
          w = Math.min(1.36, (len / count) * 0.58),
          pointed = y > y1 - dy * 2;
        if (pointed) {
          const q = [
            at(-w / 2, y),
            at(w / 2, y),
            at(w / 2, y + h * 0.64),
            at(0, y + h),
            at(-w / 2, y + h * 0.64),
          ];
          for (let k = 1; k < 4; k++) tri(out, 'glass', [q[0], q[k], q[k + 1]], [0.19, 0.23, 0.22]);
          for (let k = 0; k < q.length; k++)
            beam(out, 'cladding', q[k], q[(k + 1) % q.length], 0.11, 0.15, [0.9, 0.86, 0.75]);
          beam(out, 'cladding', at(0, y), at(0, y + h * 0.75), 0.07, 0.1, [0.87, 0.83, 0.73]);
        } else
          panel(
            out,
            [at(-w / 2, y), at(w / 2, y), at(w / 2, y + h), at(-w / 2, y + h)],
            [0.2, 0.235, 0.23],
            0.105,
            [0.87, 0.835, 0.74],
            'cladding',
          );
        beam(
          out,
          'cladding',
          at(-w * 0.65, y - 0.14, 0.17),
          at(w * 0.65, y - 0.14, 0.17),
          0.18,
          0.28,
          [0.88, 0.85, 0.76],
        );
      }
      const c2 = lerp(a, b, i / count);
      beam(
        out,
        'cladding',
        shift([c2[0], y0, c2[1]], n, 0.15),
        shift([c2[0], y1, c2[1]], n, 0.15),
        0.18,
        0.31,
        [0.87, 0.84, 0.76],
      );
    }
  }
  for (const y of [y0 + 0.35, y1 - 0.5])
    bandPlan(out, plan, y, 0.34, 0.44, [0.86, 0.82, 0.72], 'cladding');
}
function gothicFinial(out, x, z, y, h = 5, r = 0.65) {
  loft(
    out,
    'cladding',
    [
      [y, r],
      [y + h * 0.25, r],
      [y + h * 0.32, r * 1.15],
      [y + h * 0.85, r * 0.15],
      [y + h, 0.025],
    ].map(([yy, rr]) => radialRing(yy, rr, rr, 8, [x, z])),
    [0.88, 0.84, 0.74],
  );
}
function buildWoolworth(out, m) {
  const key = 'n0157_woolworth_building',
    base = localOutline(m);
  gothicWall(out, base, 0, 17.6, 4.2, [0.69, 0.67, 0.59]);
  gothicWall(out, base, 17.6, 120, 3.77);
  for (const { a, b, len } of edgeFrames(base))
    for (let i = 0; i <= Math.floor(len / 8); i++) {
      const q = lerp(a, b, i / Math.max(1, Math.floor(len / 8)));
      gothicFinial(out, q[0], q[1], 120, 4.3, 0.58);
    }
  for (const id of [274782323, 274782344]) {
    const p = part(key, id),
      plan = partPlan(m, p);
    gothicWall(out, plan, +p.tags.min_height, +p.tags.height, 3.7);
  }
  for (const id of [
    274782327, 274782330, 274782332, 274782336, 274782325, 274782329, 274782334, 274782339,
  ]) {
    const p = part(key, id),
      plan = partPlan(m, p),
      top = +p.tags.height,
      roof = +p.tags['roof:height'];
    gothicWall(out, plan, +p.tags.min_height, top - roof, 3.8, [0.83, 0.8, 0.7]);
    const center = plan.reduce((s, q) => s.map((v, i) => v + q[i] / plan.length), [0, 0]);
    loft(
      out,
      'metal',
      [
        ringAt(plan, top - roof),
        ringAt(
          plan.map((q) => lerp(q, center, 0.99)),
          top,
        ),
      ],
      [0.27, 0.43, 0.37],
    );
    gothicFinial(out, center[0], center[1], top, 0.9, 0.18);
  }
  const pinnacle = partPlan(m, part(key, 274782341)),
    center = [14.25, 0.1];
  gothicWall(out, pinnacle, 194, 202.8, 3.85);
  loft(
    out,
    'metal',
    [
      ringAt(pinnacle, 202.8),
      ringAt(
        pinnacle.map((p) => lerp(p, center, 0.985)),
        237.8,
      ),
    ],
    [0.25, 0.43, 0.36],
  );
  for (const p of pinnacle)
    beam(
      out,
      'metal',
      [p[0], 202.8, p[1]],
      [center[0] + (p[0] - center[0]) * 0.015, 237.8, center[1] + (p[1] - center[1]) * 0.015],
      0.22,
      0.25,
      [0.4, 0.55, 0.46],
    );
  for (const y of [208, 215, 222, 229]) {
    const f = (y - 202.8) / 35;
    bandPlan(
      out,
      pinnacle.map((p) => lerp(p, center, f * 0.985)),
      y,
      0.12,
      0.12,
      [0.44, 0.57, 0.49],
      'metal',
    );
  }
  gothicFinial(out, center[0], center[1], 237.8, 3.6016, 0.3);
  // Broad pointed Broadway portal, with nested archivolts and paired doors.
  for (const z of [-2, 2])
    box(out, 'recess', [29.19, 0.2, z - 1.75], [29.24, 6.8, z + 1.75], [0.17, 0.14, 0.09]);
  for (let layer = 0; layer < 3; layer++) {
    const w = 4.1 + layer * 0.35,
      y = 6.4 + layer * 0.18,
      x = 29.3 + layer * 0.12;
    beam(out, 'cladding', [x, 0.3, -w], [x, y, -w], 0.3, 0.33, [0.82, 0.79, 0.68]);
    beam(out, 'cladding', [x, y, -w], [x, 11 + layer * 0.35, 0], 0.3, 0.33, [0.82, 0.79, 0.68]);
    beam(out, 'cladding', [x, 11 + layer * 0.35, 0], [x, y, w], 0.3, 0.33, [0.82, 0.79, 0.68]);
    beam(out, 'cladding', [x, y, w], [x, 0.3, w], 0.3, 0.33, [0.82, 0.79, 0.68]);
  }
}

skylineNext.push(
  {
    id: 'N0154',
    key: 'international_commerce_centre',
    wikidataId: 'Q317034',
    title: 'International Commerce Centre',
    height: 484,
    build: buildIcc,
    brief:
      'KPF’s484 m glazed tower with re-entrant corners, a gently tapered silver facade, continuous fine projecting vertical fins, mechanical bands, and separately mapped splayed glass canopies and long northern entrance atrium.',
    sourceFacts: {
      heightMeters: 484,
      marketedStories: 118,
      form: 'Re-entrant corners, three sheltered canopies and north-side atrium',
    },
    reconstruction: {
      frame:
        'Exact-QID tower plus ten mapped glass-splay strips1047822855–1047822864; surveyed atrium extension fixes the otherwise ambiguous square phase',
      groundDatum: 'Main podium base authored atY0; mapped splay roofs use20 m podium floor datum',
    },
    refs: [
      'https://www.kpf.com/project/international-commerce-centre',
      'https://www.skyscrapercenter.com/building/international-commerce-centre/137',
      'https://www.shkp.com/Content/Uploads/en-US/annual-reports/2009-2010/14_329_en.pdf',
      'https://www.openstreetmap.org/way/25590249',
    ],
    nativeAxes: axes,
    geographic: (m) => ({
      heading: m.heading,
      notes:
        'Signed tower frame plus ten individually mapped entrance/canopy strips resolve facade orientation and the long north atrium. Canopies extend outside the main tower footprint, intentionally preserving source part geometry. Lower site podium connections remain reconstructed; groundY0.',
    }),
    limitations: [
      commonLimit,
      'Subtle facade taper and pane schedule are reconstructed. The tower-area podium has a local ground-contact base; the surrounding Elements complex is excluded. Static daylight facade omits programmable light-show content.',
    ],
    camera: { position: [390, 340, 674], lookAt: [10, 237, 0], fov: 44 },
    qaCameras: [
      { name: 're-entrant-corners', position: [82, 237, 98], lookAt: [20, 222, 24] },
      { name: 'glazed-splays', position: [-110, 74, 125], lookAt: [-15, 56, 0] },
      { name: 'north-atrium', position: [158, 67, 76], lookAt: [55, 35, 0] },
      { name: 'crown-fins', position: [103, 516, 118], lookAt: [0, 472, 0] },
      { name: 'far-silhouette', position: [-570, 406, 875], lookAt: [10, 240, 0] },
    ],
  },
  {
    id: 'N0156',
    key: 'bank_of_china_tower',
    wikidataId: 'Q214855',
    title: 'Bank of China Tower',
    height: 367.4,
    build: buildBoc,
    brief:
      'I.M.Pei’s four triangular glass shafts cut down successively into diagonal roof planes, a bold silver triangular mega-frame and paired slender masts at the precisely mapped highest quadrant.',
    sourceFacts: {
      heightToRoofMeters: 315,
      heightToMastsMeters: 367.4,
      primarySquareMeters: 52,
      shafts: 4,
      architect: 'I.M.Pei',
    },
    reconstruction: {
      plans:
        'Four independently mapped triangular parts279949066–069; actual roof compass bearings retained, top datum shifted5 m to match operator315 m roof height',
      masts: 'Mapped distinct centers from279949064/065, normalized367.4 m top',
    },
    refs: [
      'https://www.pcf-p.com/projects/bank-of-china-tower/',
      'https://bocgroup.com/en/aboutus/corpprofile/boctower.html',
      'https://www.openstreetmap.org/way/25604760',
    ],
    nativeAxes: axes,
    geographic: (m) => ({
      heading: m.heading,
      notes:
        'All four signed triangular part footprints and compass roof directions are retained. Paired mast centers locate the high quadrant, resolving square-frame rotational ambiguity. GroundY0 and published367.4 m top.',
    }),
    limitations: [
      commonLimit,
      'Diagonal mega-frame geometry is explicit; exact connection plates and individual spandrel junctions are reconstructed. Mapped53 m envelope includes the facade around the architect52 m structural square. Surrounding sloped water gardens are outside the asset.',
    ],
    camera: { position: [-285, 261, 502], lookAt: [-4, 169, 0], fov: 44 },
    qaCameras: [
      { name: 'triangular-frames', position: [70, 136, 116], lookAt: [15, 120, 20] },
      { name: 'diagonal-roofs', position: [149, 279, 172], lookAt: [0, 193, 0] },
      { name: 'paired-masts', position: [64, 360, 101], lookAt: [-14, 333, 1] },
      { name: 'banking-base', position: [98, 17, 105], lookAt: [0, 8, 0] },
      { name: 'far-silhouette', position: [-440, 325, 695], lookAt: [-2, 170, 0] },
    ],
  },
  {
    id: 'N0157',
    key: 'woolworth_building',
    wikidataId: 'Q217652',
    title: 'Woolworth Building',
    height: 241.4016,
    build: buildWoolworth,
    brief:
      'Cass Gilbert’s neo-Gothic terra-cotta skyscraper: mapped U-shaped base, offset Broadway tower, recessed individual windows, projecting mullions and sill courses, pointed openings, nested entrance archivolts, corner tourelles, copper pyramid and numerous small pinnacles.',
    sourceFacts: {
      heightFeet: 792,
      heightMeters: 241.4016,
      completion: 1913,
      architect: 'Cass Gilbert',
      facade: 'Limestone lower four stories, architectural terra cotta above',
    },
    reconstruction: {
      plans:
        'Exact U-shaped base75363809 and eleven independent upper tower/tourelle parts274782323–344',
      pinnacle: 'Mapped octagonal237.8 m copper roof with3.6016 m finial to published792 ft total',
    },
    refs: [
      'https://nylandmarks.org/explore-ny/the-woolworth-building/',
      'https://www.nypl.org/blog/2013/04/22/woolworth-building-cathedral-commerce',
      'https://s-media.nyc.gov/agencies/lpc/lp/1273.pdf',
      'https://www.nicholsonandgalloway.com/news/nicholson-and-galloway-awarded-woolworth/',
      'https://www.openstreetmap.org/way/75363809',
    ],
    nativeAxes: axes,
    geographic: (m) => ({
      heading: m.heading,
      notes:
        'Exact U-shaped base retains the west light court. All upper tower, corner tourelle and copper-roof footprints use their own mapped parts, placing the taller mass on Broadway at local+X. Main portal faces Broadway; groundY0.',
    }),
    limitations: [
      commonLimit,
      'Gothic windows, projecting trim, pointed openings and finials are modeled; individual sculptural faces, heraldic carving and polychrome tile motifs are simplified. Roof reflects the recognizable copper pyramid, not an unbuilt restoration proposal.',
    ],
    camera: { position: [247, 173, 355], lookAt: [8, 111, 0], fov: 44 },
    qaCameras: [
      { name: 'gothic-windows', position: [63, 154, 81], lookAt: [18, 142, 12] },
      { name: 'copper-pinnacle', position: [75, 256, 83], lookAt: [14, 214, 0] },
      { name: 'light-court', position: [-96, 138, 17], lookAt: [-10, 93, 0] },
      { name: 'broadway-portal', position: [78, 9, 22], lookAt: [29, 7, 0] },
      { name: 'far-silhouette', position: [-333, 218, 523], lookAt: [8, 112, 0] },
    ],
  },
);

function buildQ1(out, m) {
  const key = 'n0162_q1_tower',
    plan = localOutline(m),
    podium = partPlan(m, part(key, 492716887));
  const white = [0.79, 0.81, 0.78],
    blue = [0.24, 0.36, 0.42];
  mappedSolid(out, 'stone', podium, 0, 0.3, [0.58, 0.57, 0.52]);
  floorCurtain(out, podium, 0.3, 6.2, 2, [0.28, 0.36, 0.39], white, 0.75);
  mappedCap(out, 'concrete', podium, 6.2, [0.72, 0.72, 0.67]);
  bandPlan(out, podium, 6.2, 0.2, 0.3, white, 'metal');
  floorCurtain(out, plan, 6.2, 232.5, 76, blue, white, 0.56);
  // Curved apartment balcony edges on the broad rear faces. Each slab projects
  // only locally, preserving the sharp seaward end of the mapped floor plate.
  for (const { a, b, n, len } of edgeFrames(plan)) {
    if ((a[0] + b[0]) / 2 > -8 || len < 1) continue;
    const aa = shift([a[0], 0, a[1]], n, 0.65),
      bb = shift([b[0], 0, b[1]], n, 0.65);
    for (let f = 1; f < 74; f++) {
      const y = 6.2 + f * (226.3 / 76);
      face(
        out,
        'concrete',
        [
          [a[0], y, a[1]],
          [b[0], y, b[1]],
          [bb[0], y, bb[2]],
          [aa[0], y, aa[2]],
        ],
        white,
      );
      beam(out, 'metal', [aa[0], y + 0.98, aa[2]], [bb[0], y + 0.98, bb[2]], 0.065, 0.065, white);
      const count = Math.max(1, Math.round(len / 1.5));
      for (let j = 0; j <= count; j++) {
        const p = lerp(aa, bb, j / count);
        beam(out, 'metal', [p[0], y, p[2]], [p[0], y + 1, p[2]], 0.045, 0.055, white);
      }
    }
  }
  const roofPlan = plan.map((p) => [p[0] * 0.93, p[1] * 0.93]);
  floorCurtain(out, roofPlan, 232.5, 245, 3, [0.21, 0.34, 0.41], white, 0.3);
  mappedCap(out, 'metal', roofPlan, 245, [0.54, 0.62, 0.66]);
  // The crown is an open steel-and-glass sail, not a solid slanted roof.
  const crown = plan.map((p) => [p[0] * 0.98, p[1] * 0.98]);
  const crownHeight = (p) => 245 + 34 * Math.max(0, Math.min(1, (p[0] + 22.7) / 45.4));
  slopedGlass(out, crown, crownHeight, 245, [0.72, 0.82, 0.85], false, false, 'clear_glass');
  for (const { a, b, len } of edgeFrames(crown)) {
    const count = Math.max(1, Math.round(len / 3.6));
    for (let j = 0; j < count; j++) {
      const p = lerp(a, b, j / count),
        h = crownHeight(p);
      tube(out, 'metal', [p[0], 233, p[1]], [p[0], h + 7.5, p[1]], 0.14, white, 12);
    }
    beam(
      out,
      'metal',
      [a[0], crownHeight(a) + 0.12, a[1]],
      [b[0], crownHeight(b) + 0.12, b[1]],
      0.18,
      0.22,
      white,
    );
  }
  const mast = [20.9, -0.9];
  turnedProfile(
    out,
    'metal',
    [
      [232.5, 0.7],
      [285, 0.58],
      [309, 0.34],
      [322.5, 0.05],
    ],
    mast,
    [0.84, 0.86, 0.83],
    32,
  );
  for (const y of [270, 285, 300])
    torus(out, 'metal', [mast[0], y, mast[1]], 0.65 - (y - 270) * 0.009, 0.055, white, 24, 6);
  // The operator's climb follows the outside of the northern sail, rising from
  // the240 m launch to a270 m summit. Photo-informed intermediate bends retain
  // the mapped curved envelope; model the actual treads, stringers and rail.
  const route = [
    [-19.5, -13.8],
    [-10, -19.3],
    [0, -18.1],
    [9, -15.2],
    [19, -8.4],
    [23.1, -2.2],
  ];
  const lengths = [0];
  for (let i = 1; i < route.length; i++)
    lengths.push(
      lengths.at(-1) + Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]),
    );
  const length = lengths.at(-1),
    atDistance = (d) => {
      let i = 1;
      while (i < lengths.length - 1 && d > lengths[i]) i++;
      const a = route[i - 1],
        b = route[i],
        span = lengths[i] - lengths[i - 1],
        t = (d - lengths[i - 1]) / span;
      const p = lerp(a, b, t),
        normal = [-(b[1] - a[1]) / span, 0, (b[0] - a[0]) / span];
      return { p: [p[0], 240 + (d / length) * 30, p[1]], normal };
    };
  const steps = 172;
  for (let i = 0; i < steps; i++) {
    const d = ((i + 0.5) / steps) * length,
      { p, normal } = atDistance(d);
    p[1] = 240 + ((i + 1) * 30) / steps;
    beam(
      out,
      'metal',
      shift(p, normal, -0.72),
      shift(p, normal, 0.72),
      (length / steps) * 0.91,
      0.06,
      [0.65, 0.7, 0.7],
    );
    if (i % 5 === 0 || i === steps - 1)
      for (const side of [-1, 1]) {
        const q = shift(p, normal, side * 0.74);
        tube(out, 'metal', q, shift(q, [0, 1, 0], 1.05), 0.035, [0.66, 0.71, 0.72], 8);
      }
  }
  for (let i = 1; i < lengths.length; i++)
    for (const side of [-1, 1]) {
      const a = atDistance(lengths[i - 1] + 0.00001),
        b = atDistance(lengths[i] - 0.00001);
      for (const rise of [-0.22, 0.52, 1.05])
        beam(
          out,
          'metal',
          shift(shift(a.p, a.normal, side * 0.74), [0, 1, 0], rise),
          shift(shift(b.p, b.normal, side * 0.74), [0, 1, 0], rise),
          rise < 0 ? 0.19 : 0.045,
          rise < 0 ? 0.26 : 0.055,
          [0.66, 0.71, 0.72],
        );
    }
  // Summit landing joins the climb to the mast-side structure.
  box(out, 'metal', [20.2, 269.85, -3.8], [23.9, 270, -0.2], [0.61, 0.67, 0.68]);
  for (const x of [20.3, 23.8]) {
    beam(out, 'metal', [x, 271.08, -3.7], [x, 271.08, -0.3], 0.05, 0.05, white);
    for (const z of [-3.7, -2, -0.3])
      tube(out, 'metal', [x, 270, z], [x, 271.08, z], 0.035, white, 8);
  }
  // Separate low maintenance rail stays inside the occupied roof boundary.
  const inner = roofPlan.map((p) => [p[0] * 0.8, p[1] * 0.8]);
  guardrail(out, ringAt(inner, 245), 1.1, [0.65, 0.7, 0.7]);
  for (const { a, b } of edgeFrames(roofPlan))
    if (a[0] > 8 && b[0] > 8)
      beam(out, 'metal', [a[0], 245, a[1]], [b[0], 245, b[1]], 0.24, 0.28, white);
}

function buildLandmark81(out, m) {
  const key = 'n0163_landmark_81',
    podium = localOutline(m);
  const low = partPlan(m, part(key, 622296616)),
    top = partPlan(m, part(key, 622296618));
  const center = low.reduce((s, p) => s.map((v, i) => v + p[i] / low.length), [0, 0]);
  // The mapped upper shaft fixes the actual orthogonal grid direction.
  const edge = edgeFrames(top).sort((a, b) => b.len - a.len)[0];
  let u = [(edge.b[0] - edge.a[0]) / edge.len, (edge.b[1] - edge.a[1]) / edge.len];
  if (u[0] < 0) u = u.map((v) => -v);
  const v = [-u[1], u[0]],
    at = (x, z) => [center[0] + u[0] * x + v[0] * z, center[1] + u[1] * x + v[1] * z];
  const white = [0.74, 0.78, 0.77],
    blue = [0.3, 0.42, 0.46];
  mappedSolid(out, 'stone', podium, 0, 0.3, [0.54, 0.55, 0.51]);
  floorCurtain(out, podium, 0.3, 14.4, 3, [0.3, 0.37, 0.36], [0.7, 0.72, 0.67], 0.9);
  mappedCap(out, 'concrete', podium, 14.4, [0.67, 0.68, 0.61]);
  bandPlan(out, podium, 14.4, 0.3, 0.4, white, 'metal');
  // Explicitly authored setbacks follow the architect's six-by-six9 m grid.
  // The occupied central2x2 group remains continuous through the sky gallery.
  const heights = [
    [60, 120, 170, 140, 89, 65],
    [105, 265, 300, 257, 192, 102],
    [183, 396, 396, 310, 223, 134],
    [210, 396, 396, 320, 238, 148],
    [170, 280, 305, 269, 185, 90],
    [18, 18, 86, 130, 93, 62],
  ];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 6; col++) {
      const x = (col - 2.5) * 9,
        z = (row - 2.5) * 9,
        high = heights[row][col];
      const p = clockwise([
        at(x - 4.45, z - 4.45),
        at(x + 4.45, z - 4.45),
        at(x + 4.45, z + 4.45),
        at(x - 4.45, z + 4.45),
      ]);
      floorCurtain(
        out,
        p,
        14.4,
        high,
        Math.max(1, Math.round((high - 14.4) / 4.05)),
        blue,
        white,
        0.45,
      );
      mappedCap(out, 'concrete', p, high, [0.67, 0.72, 0.66]);
      for (const q of p)
        beam(
          out,
          'metal',
          [q[0], 14.4, q[1]],
          [q[0], high + 0.25, q[1]],
          0.23,
          0.3,
          [0.76, 0.81, 0.81],
        );
      bandPlan(out, p, high, 0.22, 0.25, [0.76, 0.81, 0.81], 'metal');
      if (high < 250) {
        guardrail(out, ringAt(p, high), 1.1, [0.58, 0.66, 0.66]);
        const c = at(x, z);
        box(
          out,
          'concrete',
          [c[0] - 1.4, high, c[1] - 0.8],
          [c[0] + 1.4, high + 0.5, c[1] + 0.8],
          [0.57, 0.62, 0.54],
        );
        gardenTree(out, c[0], high + 0.5, c[1], 2.5);
      }
    }
  // The separately surveyed mast retains its real offset within the high group.
  const mastCenter = top.reduce((s, p) => s.map((v, i) => v + p[i] / top.length), [0, 0]);
  const mast = top.map((p) => lerp(p, mastCenter, 0.12));
  for (let level = 0; level < 16; level++) {
    const y = 396 + (65.2 * level) / 16;
    const high = 396 + (65.2 * (level + 1)) / 16;
    for (const { a, b } of edgeFrames(mast)) {
      grid(
        out,
        [
          [a[0], y, a[1]],
          [b[0], y, b[1]],
          [b[0], high, b[1]],
          [a[0], high, a[1]],
        ],
        [0.54, 0.63, 0.66],
        2,
        high - y,
        0.12,
        [0.81, 0.84, 0.83],
      );
    }
  }
  for (const q of mast)
    beam(out, 'metal', [q[0], 395.5, q[1]], [q[0], 461.2, q[1]], 0.3, 0.38, [0.84, 0.87, 0.86]);
  mappedCap(out, 'metal', mast, 461.2, [0.77, 0.82, 0.83]);
  // Public podium planting follows the surrounding plaza, outside the tower.
  for (const [x, z] of [
    [-40, -6],
    [-28, 17],
    [-12, 32],
    [14, 41],
    [32, 31],
    [43, 15],
  ]) {
    box(out, 'concrete', [x - 3.5, 14.4, z - 1.3], [x + 3.5, 15, z + 1.3], [0.57, 0.62, 0.53]);
    for (let j = -1; j <= 1; j++) gardenTree(out, x + j * 2.3, 15, z, 2.8);
  }
}

skylineNext.push(
  {
    id: 'N0162',
    key: 'q1_tower',
    wikidataId: 'Q125846',
    title: 'Q1 Tower',
    height: 322.5,
    build: buildQ1,
    brief:
      'Q1’s curved asymmetric apartment shaft with closely spaced white floor bands, individual blue-glass panes and projecting rear balcony edges, topped by its open sloping glass-and-steel sail and322.5 m offset mast.',
    sourceFacts: {
      heightMeters: 322.5,
      roofDatumMeters: 245,
      crownAssemblyMeters: 90,
      climbLaunchMeters: 240,
      climbSummitMeters: 270,
      floors: 78,
      architects: ['Sunland Design Group', 'Innovarchi'],
      steelFabricator: 'Sun Engineering with Orrcon Steel hollow sections',
    },
    reconstruction: {
      plan: 'Actual asymmetric mapped tower floor plate plus independent low podium footprint',
      crown:
        'Open steel sail and exposed vertical ribs reconstructed from Orrcon Steel construction and completed-building photographs; mast toward the pointed coastal end',
    },
    refs: [
      'https://dxp1416ihlpln.cloudfront.net/s3fs-public/2019-07/2015-Project-Bulletin-Q1-Low-Res.pdf',
      'https://www.skypoint.com.au/about-us',
      'https://www.skypoint.com.au/climb',
      'https://www.q1.com.au/',
      'https://www.openstreetmap.org/way/188325694',
    ],
    nativeAxes: axes,
    geographic: (m) => ({
      heading: m.heading,
      notes:
        'Signed asymmetric tower and separate two-storey podium preserve the mapped site layout. The mast resolves18.60 m east and9.58 m south of the anchor, on the pointed coastal end. Orrcon’s aerial and the operator’s climb photograph with northward coastline/ocean on the right corroborate this seaward phase. Exact mast offset and intermediate stair bends remain photo reconstruction. BaseY0.',
    }),
    limitations: [
      commonLimit,
      'Crown ribs, transparent sail, external climb treads and rails, local balconies and individual pane grids are explicit. Exact intermediate climb bends and detailed balcony variations remain photo reconstruction. Main shaft and podium footprints are mapped separately.',
    ],
    camera: { position: [242, 218, 390], lookAt: [-3, 145, 3], fov: 44 },
    qaCameras: [
      { name: 'crown-sail', position: [88, 298, 98], lookAt: [6, 265, 0] },
      { name: 'steel-mast', position: [49, 333, 64], lookAt: [17, 292, 0] },
      { name: 'external-climb', position: [10, 274, -66], lookAt: [0, 256, -14] },
      { name: 'apartment-balconies', position: [-79, 94, 64], lookAt: [-17, 86, 8] },
      { name: 'podium', position: [-110, 38, 115], lookAt: [-11, 12, 17] },
      { name: 'far-silhouette', position: [-359, 272, 552], lookAt: [-3, 152, 5] },
    ],
  },
  {
    id: 'N0163',
    key: 'landmark_81',
    wikidataId: 'Q18640924',
    title: 'Landmark 81',
    height: 461.2,
    build: buildLandmark81,
    brief:
      'The bamboo-cluster skyscraper with a six-by-six nine-metre grid of individually stepped glazed tubes, vertical silver edges, planted rooftop terraces, four high observation volumes and the mapped offset rectangular spire above its retail podium.',
    sourceFacts: {
      heightMeters: 461.2,
      observationLevel81Meters: 389.2,
      planningGridMeters: 9,
      planningBays: [6, 6],
      architect: 'Atkins',
      concept: 'Bundle of bamboo stems',
    },
    reconstruction: {
      grid: 'Six-by-six9 m layout follows architect case study; individual setback heights reconstructed from published elevations and residential plans',
      mapping:
        'Independent mapped lower tower, upper hotel and mast footprints resolve center and grid direction within the separate retail footprint',
    },
    refs: [
      'https://www.atkinsrealis.com/~/media/Files/A/atkinsrealis/download-centre/en/case-study/landmark-case-study.pdf',
      'https://group.schindler.com/en/media/stories/landmark-81.html',
      'https://www.openstreetmap.org/way/622296615',
    ],
    nativeAxes: axes,
    geographic: (m) => ({
      heading: m.heading,
      notes:
        'Exact signed retail podium remains at ground. Separately mapped lower shaft fixes tower center; highest mapped rectangular part fixes the actual grid orientation and spire offset. Reconstructed9 m grid fits within the coarse lower envelope; groundY0.',
    }),
    limitations: [
      commonLimit,
      'Primary case study records the design-development scheme; detailed exterior construction is reconstructed with that published9 m grid. Individual as-built setback heights, terrace planting and spire skin need additional close reference refinement.',
    ],
    camera: { position: [343, 332, 560], lookAt: [5, 214, -9], fov: 44 },
    qaCameras: [
      { name: 'stepped-tubes', position: [122, 218, 124], lookAt: [7, 192, -12] },
      { name: 'roof-terraces', position: [-82, 149, 103], lookAt: [2, 109, -8] },
      { name: 'sky-gallery-spire', position: [85, 469, 114], lookAt: [0, 415, -20] },
      { name: 'retail-podium', position: [179, 58, 183], lookAt: [4, 18, 8] },
      { name: 'far-silhouette', position: [-521, 394, 809], lookAt: [4, 222, -8] },
    ],
  },
);

function buildLakhta(out, m) {
  const plan = localOutline(m);
  // Five petal extremities fix the actual core, independently of the enclosing
  // rectangle center used by the geographic index.
  const tips = plan.filter((_, i) => i % 2 === 0);
  const center = tips.reduce((s, p) => s.map((v, i) => v + p[i] / tips.length), [0, 0]);
  const profile = [
    [0, 1],
    [75, 1.07],
    [150, 0.98],
    [231, 0.82],
    [300, 0.63],
    [347, 0.46],
    [404, 0.25],
    [433, 0.105],
    [449, 0.031],
  ];
  const scale = (y) => {
    let i = 1;
    while (i < profile.length - 1 && profile[i][0] < y) i++;
    const a = profile[i - 1],
      b = profile[i];
    // Shape-preserving cubic interpolation removes artificial straight-section
    // knuckles without introducing bulges beyond the authored radial envelope.
    const slope = (k) => {
      const delta = (j) =>
        (profile[j + 1][1] - profile[j][1]) / (profile[j + 1][0] - profile[j][0]);
      if (k === 0) return delta(0);
      if (k === profile.length - 1) return delta(k - 1);
      const left = delta(k - 1),
        right = delta(k);
      if (left * right <= 0) return 0;
      const h0 = profile[k][0] - profile[k - 1][0],
        h1 = profile[k + 1][0] - profile[k][0],
        w0 = 2 * h1 + h0,
        w1 = h1 + 2 * h0;
      return (w0 + w1) / (w0 / left + w1 / right);
    };
    const h = b[0] - a[0],
      t = (y - a[0]) / h;
    return (
      (2 * t * t * t - 3 * t * t + 1) * a[1] +
      (t * t * t - 2 * t * t + t) * h * slope(i - 1) +
      (-2 * t * t * t + 3 * t * t) * b[1] +
      (t * t * t - t * t) * h * slope(i)
    );
  };
  const point = (edge, t, y) => {
    const a = plan[edge],
      b = plan[(edge + 1) % plan.length],
      q = lerp(a, b, t);
    const f = scale(y),
      angle = (-Math.PI * 0.5 * y) / 462,
      c = Math.cos(angle),
      s = Math.sin(angle);
    const x = (q[0] - center[0]) * f,
      z = (q[1] - center[1]) * f;
    return [center[0] + x * c - z * s, y, center[1] + x * s + z * c];
  };
  mappedSolid(out, 'stone', plan, 0, 0.25, [0.42, 0.46, 0.48]);
  const floors = 117,
    cols = 14;
  for (let floor = 0; floor < floors; floor++) {
    const y0 = 0.25 + ((449 - 0.25) * floor) / floors,
      y1 = 0.25 + ((449 - 0.25) * (floor + 1)) / floors;
    for (let e = 0; e < plan.length; e++)
      for (let j = 0; j < cols; j++) {
        const q = [
          point(e, j / cols, y0),
          point(e, (j + 1) / cols, y0),
          point(e, (j + 1) / cols, y1),
          point(e, j / cols, y1),
        ];
        panel(
          out,
          q,
          [0.32, 0.46, 0.53],
          Math.max(0.012, 0.055 * scale((y0 + y1) / 2)),
          [0.61, 0.7, 0.75],
        );
      }
  }
  // Ten continuous helical arrises distinguish the five-petal flame profile.
  for (let e = 0; e < plan.length; e++)
    for (let j = 0; j < 117; j++) {
      const y0 = 0.25 + ((449 - 0.25) * j) / 117,
        y1 = 0.25 + ((449 - 0.25) * (j + 1)) / 117;
      tube(
        out,
        'metal',
        point(e, 0, y0),
        point(e, 0, y1),
        Math.max(0.025, 0.11 * scale(y0)),
        [0.66, 0.74, 0.79],
        8,
      );
    }
  for (const y of [78, 153, 228, 303, 357, 404]) {
    const p = plan.map((_, e) => point(e, 0, y));
    for (let i = 0; i < p.length; i++)
      beam(out, 'metal', p[i], p[(i + 1) % p.length], 0.15, 0.22, [0.62, 0.69, 0.72]);
  }
  const roof = plan.map((_, e) => point(e, 0, 449));
  cap(out, 'metal', roof, [0.67, 0.72, 0.75]);
  loft(
    out,
    'metal',
    [
      [448.8, 1.08],
      [452, 0.79],
      [458, 0.32],
      [462, 0.025],
    ].map(([y, r]) => radialRing(y, r, r, 30, center)),
    [0.73, 0.77, 0.79],
  );
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5;
    tube(
      out,
      'metal',
      [center[0] + Math.cos(a) * 1.04, 449, center[1] + Math.sin(a) * 1.04],
      [center[0], 461.8, center[1]],
      0.035,
      [0.8, 0.83, 0.84],
      6,
    );
  }
}

function turnedProfile(out, slot, profile, center, color, sides = 96) {
  loft(
    out,
    slot,
    profile.map(([y, r]) => radialRing(y, r, r, sides, center)),
    color,
  );
}
function buildKlTower(out, m) {
  const key = 'n0161_kuala_lumpur_tower',
    base = localOutline(m),
    pale = [0.8, 0.8, 0.76];
  const core = partPlan(m, part(key, 546282150));
  const cx = (Math.min(...core.map((p) => p[0])) + Math.max(...core.map((p) => p[0]))) / 2;
  const cz = (Math.min(...core.map((p) => p[1])) + Math.max(...core.map((p) => p[1]))) / 2;
  const center = [cx, cz];
  // First-hand exterior photos identify the Suria box toward Petronas (ENE)
  // and the second toward Merdeka (SSW). These are photo-reconstructed outward
  // normals, not surveyed bearings or the exact landmark centerline bearings.
  const boxAngles = [64, 196].map((bearing) => ((bearing - 90) * Math.PI) / 180 + m.heading);
  mappedSolid(out, 'stone', base, 0, 0.4, [0.62, 0.6, 0.54]);
  glazedOutline(out, base, 0.4, 8.7, 2.5, [0.25, 0.32, 0.34], pale, 0.12);
  mappedCap(out, 'concrete', base, 8.7, pale);
  const upperBase = partPlan(m, part(key, 589740577));
  bandPlan(out, base, 8.7, 0.35, 0.5, pale, 'concrete');
  mappedSolid(out, 'concrete', upperBase, 8.7, 10, pale);
  // CIDB gives a parabolic24.5→13.6 m shaft, reaching its minimum at261.6 m.
  const radius = (y) => 6.8 + 5.45 * (1 - Math.min(y, 261.6) / 261.6) ** 2;
  for (let y = 10; y < 261.6; y += 4.2) {
    const hi = Math.min(y + 4.2, 261.6),
      t = y / 261.6;
    turnedProfile(
      out,
      'concrete',
      [
        [y, radius(y)],
        [hi, radius(hi)],
      ],
      center,
      [0.75 + t * 0.07, 0.76 - t * 0.025, 0.74 - t * 0.035],
      120,
    );
  }
  for (let i = 0; i < 24; i++) {
    const angle = (i * Math.PI) / 12;
    for (let y = 10; y < 261.6; y += 8.4) {
      const hi = Math.min(y + 8.4, 261.6);
      const at = (yy) => [
        cx + Math.cos(angle) * (radius(yy) + 0.08),
        yy,
        cz + Math.sin(angle) * (radius(yy) + 0.08),
      ];
      tube(out, 'concrete', at(y), at(hi), 0.085, pale, 8);
    }
  }
  turnedProfile(
    out,
    'concrete',
    [
      [261.4, 6.8],
      [317.16, 6.8],
    ],
    center,
    pale,
  );
  // Reconstructed muqarnas frieze below the expanding observation head.
  for (let row = 0; row < 5; row++) {
    const low = 261.6 + row * 1.8,
      high = low + 1.8,
      r0 = 6.8 + row * 1.35,
      r1 = r0 + 1.35;
    for (let i = 0; i < 48; i++) {
      const a = (i * Math.PI) / 24,
        b = ((i + 1) * Math.PI) / 24,
        mid = (a + b) / 2;
      const p = [cx + Math.cos(a) * r1, high, cz + Math.sin(a) * r1],
        q = [cx + Math.cos(b) * r1, high, cz + Math.sin(b) * r1],
        bottom = [cx + Math.cos(mid) * r0, low, cz + Math.sin(mid) * r0];
      tri(out, 'pink', [bottom, q, p], [0.7, 0.48, 0.42]);
      tube(out, 'pink', p, bottom, 0.09, [0.83, 0.65, 0.55], 6);
      tube(out, 'pink', bottom, q, 0.09, [0.83, 0.65, 0.55], 6);
    }
  }
  // Published276 m public deck fixes the head. Coarse OSM head heights place
  // observation glass too high and are not used as measured vertical datums.
  const head = [
    [270.6, 13.55],
    [276, 17.3],
    [282, 19.1],
    [288, 21],
    [294, 22.9],
    [300, 24.9],
  ];
  for (let j = 1; j < head.length; j++) {
    const [y0, r0] = head[j - 1],
      [y1, r1] = head[j];
    const lo = radialRing(y0, r0, r0, 96, center),
      hi = radialRing(y1 - 0.7, r1 - 0.2, r1 - 0.2, 96, center);
    for (let i = 0; i < 96; i++)
      panel(
        out,
        [lo[i], lo[(i + 1) % 96], hi[(i + 1) % 96], hi[i]],
        [0.2, 0.26, 0.31],
        0.1,
        [0.77, 0.78, 0.75],
      );
    turnedProfile(
      out,
      'concrete',
      [
        [y1 - 0.7, r1 - 0.2],
        [y1, r1],
      ],
      center,
      pale,
    );
    torus(out, 'concrete', [cx, y1, cz], r1, 0.16, pale, 96, 6);
  }
  // Open sky deck, rail and stepped white roof cap.
  turnedProfile(
    out,
    'concrete',
    [
      [300, 24.9],
      [301, 24.9],
    ],
    center,
    pale,
  );
  const rail = radialRing(301, 24.4, 24.4, 144, center);
  for (let i = 0; i < rail.length; i++) {
    const p = rail[i],
      q = rail[(i + 1) % rail.length];
    const a = Math.atan2((p[2] + q[2]) / 2 - cz, (p[0] + q[0]) / 2 - cx);
    if (boxAngles.some((b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) < 0.07))
      continue;
    face(
      out,
      'clear_glass',
      [p, q, shift(q, [0, 1, 0], 1.35), shift(p, [0, 1, 0], 1.35)],
      [0.75, 0.86, 0.86],
    );
    beam(out, 'metal', p, shift(p, [0, 1, 0], 1.4), 0.055, 0.055, metal);
    beam(out, 'metal', shift(p, [0, 1, 0], 1.4), shift(q, [0, 1, 0], 1.4), 0.07, 0.07, metal);
  }
  turnedProfile(
    out,
    'concrete',
    [
      [303, 23],
      [307, 20.1],
      [309, 17.5],
      [311, 12.1],
      [315, 10.3],
    ],
    center,
    [0.83, 0.83, 0.79],
  );
  for (let i = 0; i < 48; i++) {
    const a = (i * Math.PI) / 24;
    beam(
      out,
      'metal',
      [cx + Math.cos(a) * 23.3, 301, cz + Math.sin(a) * 23.3],
      [cx + Math.cos(a) * 22.5, 303.1, cz + Math.sin(a) * 22.5],
      0.14,
      0.18,
      [0.76, 0.79, 0.79],
    );
  }
  // Exposed circular transmitter decks and the86 m antenna assembly.
  turnedProfile(
    out,
    'concrete',
    [
      [314, 7.3],
      [335, 5.3],
    ],
    center,
    pale,
  );
  for (const [y, r] of [
    [319, 9.4],
    [326, 9.7],
    [333, 8],
  ]) {
    turnedProfile(
      out,
      'metal',
      [
        [y - 0.3, r],
        [y + 0.3, r],
      ],
      center,
      [0.64, 0.69, 0.68],
    );
    guardrail(out, radialRing(y, r, r, 48, center), 1.25, [0.58, 0.62, 0.61]);
  }
  const at = (a, y, r) => [cx + Math.cos(a) * r, y, cz + Math.sin(a) * r];
  for (let y = 335; y < 393; y += 4) {
    const hi = Math.min(y + 4, 393),
      r = 4.8 - (y - 335) * 0.065,
      rh = 4.8 - (hi - 335) * 0.065;
    for (let j = 0; j < 4; j++) {
      const a = Math.PI / 4 + (j * Math.PI) / 2,
        b = a + Math.PI / 2;
      tube(out, 'metal', at(a, y, r), at(a, hi, rh), 0.19, [0.65, 0.69, 0.68], 10);
      tube(out, 'metal', at(a, y, r), at(b, hi, rh), 0.08, [0.7, 0.74, 0.73], 6);
      tube(out, 'metal', at(a, hi, rh), at(b, hi, rh), 0.09, [0.73, 0.75, 0.73], 6);
    }
  }
  for (let y = 389; y < 421; y += 4) {
    const hi = Math.min(y + 4, 421),
      r = Math.max(0.12, 0.98 - (y - 389) * 0.026);
    turnedProfile(
      out,
      'metal',
      [
        [y, r],
        [hi, Math.max(0.045, r - 0.1)],
      ],
      center,
      Math.floor((y - 389) / 4) % 2 ? [0.74, 0.22, 0.19] : [0.86, 0.86, 0.82],
      32,
    );
  }
  // Elevated suspended glass boxes. The visible upper I beams, diagonal rods,
  // stair flights and violet glazing frames follow the on-site photographs.
  for (const a of boxAngles) {
    const p = at(a, 302.2, 24),
      q = at(a, 302.2, 27.3);
    const tangent = [-Math.sin(a), 0, Math.cos(a)];
    const violet = [0.24, 0.105, 0.32],
      steel = [0.79, 0.8, 0.77];
    const corners = [
      shift(p, tangent, -1.1),
      shift(q, tangent, -1.1),
      shift(q, tangent, 1.1),
      shift(p, tangent, 1.1),
    ];
    // Thin perimeter shoes support the actual glass floor; no opaque slab.
    face(out, 'clear_glass', corners, [0.79, 0.89, 0.91]);
    face(
      out,
      'clear_glass',
      corners.map((p) => shift(p, [0, 1, 0], 2.5)),
      [0.79, 0.89, 0.91],
    );
    for (let j = 0; j < 4; j++) {
      const next = corners[(j + 1) % 4];
      beam(
        out,
        'metal',
        shift(corners[j], [0, 1, 0], -0.09),
        shift(next, [0, 1, 0], -0.09),
        0.13,
        0.18,
        violet,
      );
      if (j !== 3) {
        face(
          out,
          'clear_glass',
          [corners[j], next, shift(next, [0, 1, 0], 2.5), shift(corners[j], [0, 1, 0], 2.5)],
          [0.79, 0.89, 0.91],
        );
        const count = j === 1 ? 3 : 5;
        for (let k = 1; k < count; k++) {
          const v = lerp(corners[j], next, k / count);
          beam(out, 'metal', v, shift(v, [0, 1, 0], 2.5), 0.045, 0.065, violet);
        }
        tube(
          out,
          'stainless',
          shift(corners[j], [0, 1, 0], 1.05),
          shift(next, [0, 1, 0], 1.05),
          0.025,
          steel,
          8,
        );
      }
      beam(out, 'metal', corners[j], shift(corners[j], [0, 1, 0], 2.5), 0.09, 0.09, violet);
      beam(
        out,
        'metal',
        shift(corners[j], [0, 1, 0], 2.5),
        shift(corners[(j + 1) % 4], [0, 1, 0], 2.5),
        0.09,
        0.09,
        violet,
      );
    }
    for (const side of [-1, 1]) {
      const upperInner = shift(at(a, 305, 21), tangent, side * 1.14),
        upperOuter = shift(at(a, 305, 27.7), tangent, side * 1.14);
      beam(out, 'metal', upperInner, upperOuter, 0.035, 0.42, steel);
      for (const y of [-0.21, 0.21])
        beam(
          out,
          'metal',
          shift(upperInner, [0, 1, 0], y),
          shift(upperOuter, [0, 1, 0], y),
          0.36,
          0.045,
          steel,
        );
      tube(
        out,
        'stainless',
        shift(at(a, 307.4, 19.4), tangent, side * 1.14),
        shift(upperOuter, [0, 1, 0], 0.25),
        0.03,
        steel,
        8,
      );
      for (let k = 0; k < 6; k++) {
        const v = shift(at(a, 305.03, 24 + k * 0.62), tangent, side * 1.18);
        tube(out, 'metal', v, shift(v, tangent, side * 0.045), 0.065, [0.4, 0.43, 0.42], 10);
      }
      const stairLo = shift(at(a, 301.12, 21.6), tangent, side * 0.94),
        stairHi = shift(p, tangent, side * 0.94);
      beam(out, 'metal', stairLo, stairHi, 0.1, 0.14, steel);
      tube(
        out,
        'stainless',
        shift(stairLo, [0, 1, 0], 1.1),
        shift(stairHi, [0, 1, 0], 1.1),
        0.025,
        steel,
        8,
      );
      for (let k = 0; k <= 6; k++) {
        const v = lerp(stairLo, stairHi, k / 6);
        tube(out, 'stainless', v, shift(v, [0, 1, 0], 1.1), 0.02, steel, 8);
      }
    }
    for (let k = 1; k <= 6; k++) {
      const v = at(a, 301 + k * 0.2, 21.6 + k * 0.4);
      beam(out, 'metal', shift(v, tangent, -1), shift(v, tangent, 1), 0.42, 0.08, steel);
    }
  }
}

skylineNext.push(
  {
    id: 'N0160',
    key: 'lakhta_centre',
    wikidataId: 'Q4255374',
    title: 'Lakhta Centre',
    height: 462,
    build: buildLakhta,
    brief:
      'The462 m five-petal glass flame with a continuous90-degree helical sweep, widening lower profile, tapering upper observation/spire section, individually framed parallelogram glazing and ten fine spiral arrises.',
    sourceFacts: {
      heightMeters: 462,
      abovegroundFloors: 87,
      petals: 5,
      rotationDegrees: 90,
      facadeModules: 16505,
      finalSteelTipMeters: 13,
    },
    reconstruction: {
      plan: 'Signed exact-QID five-pointed mapped footprint; independent upper star parts establish core location and twist handedness',
      profile:
        'Shape-preserving cubic taper and lower bulge reconstructed through published geometry and mapped upper envelopes; continuous tangents replace artificial linear-section knuckles',
    },
    refs: [
      'https://gorproject.ru/en/projects/lakhta-center/',
      'https://www.mignat.com/en/unternehmenskommunikation-en/tallest-european-skyscraper-in-saint-petersburg-reached-its-final-height-of-462-meters/',
      'https://europe.arcelormittal.com/newsandmedia/europenews/news-2019/Lakhta',
      'https://www.openstreetmap.org/relation/18102137',
    ],
    nativeAxes: axes,
    geographic: (m) => ({
      heading: m.heading,
      notes:
        'Exact signed five-petal ground outline and independently mapped upper stars determine core and clockwise-to-counterclockwise convention; rotation proceeds counterclockwise in geographic east/north space. Tower baseY0. Adjacent wings are excluded.',
    }),
    limitations: [
      commonLimit,
      'Individual glazing panels and helical arrises are explicit. Exact curved pane sag and floor-specific petal bulge are reconstructed. Only the main tower is included; adjacent long low complex and entrance arch are excluded.',
    ],
    camera: { position: [341, 325, 576], lookAt: [0, 214, 4], fov: 44 },
    qaCameras: [
      { name: 'helical-facade', position: [82, 173, 102], lookAt: [0, 152, 5] },
      { name: 'five-petal-crown', position: [89, 432, 115], lookAt: [0, 393, 4] },
      { name: 'spire', position: [40, 470, 61], lookAt: [0, 442, 4] },
      { name: 'ground-petals', position: [111, 29, 121], lookAt: [0, 12, 2] },
      { name: 'far-silhouette', position: [-521, 389, 811], lookAt: [0, 221, 3] },
    ],
  },
  {
    id: 'N0161',
    key: 'kuala_lumpur_tower',
    wikidataId: 'Q745016',
    title: 'Kuala Lumpur Tower',
    height: 421,
    build: buildKlTower,
    brief:
      'KL Tower’s parabolically tapered ribbed concrete shaft, rose muqarnas transition, widening bands of observation glazing, open sky deck, white stepped roof, transmitter galleries and red-white antenna above its mapped star-shaped lobby.',
    sourceFacts: {
      heightMeters: 421,
      observationDeckMeters: 276,
      shaftBaseDiameterMeters: 24.5,
      shaftUpperDiameterMeters: 13.6,
      shaftTaperEndMeters: 261.6,
      concreteShaftEndMeters: 317.16,
      antennaMeters: 86,
    },
    reconstruction: {
      datum:
        'CIDB construction account and photographs override coarse mapped head/shaft height tags; exact mapped circular core fixes axis',
      head: 'Widening circular profile and roof/deck proportions reconstructed from CIDB exterior photograph; muqarnas cells modeled as original geometric approximation',
      skyBoxes:
        'First-hand 2026 visitor and on-site photographer images identify the violet-framed Suria box toward Petronas and the second toward Merdeka. Outward bearings64° and196° are photo-correlated approximations, not surveyed axes; actual landmark centerlines are about57.5° and195.4°. Raised access steps, upper I beams and tension rods are reconstructed from those images.',
    },
    refs: [
      'https://www.cidb.gov.my/wp-content/uploads/2022/11/CIDB-full-layout-12.54pm-lowres_compressed.pdf',
      'https://storage.ebrochures.malaysia.travel/storage/IDB_PDF_MTG_EN.pdf',
      'https://www.menarakl.com.my/',
      'https://girleatworld.net/kl-tower-review/',
      'https://thetravelauthor.com/kl-tower-kuala-lumpur-your-complete-guide/',
      'https://www.openstreetmap.org/way/589740576',
    ],
    nativeAxes: axes,
    geographic: (m) => ({
      heading: m.heading,
      notes:
        'Exact star-shaped ground lobby fixes the signed site orientation; independently mapped cylindrical shaft supplies its center. Published tower heights replace coarse OSM head datums. The Suria box faces ENE toward Petronas, corroborated by its front-window skyline in first-hand photos; the second faces SSW toward Merdeka. Outward bearings64°/196° remain photo reconstruction with several-degree uncertainty, not surveyed centerlines. BaseY0.',
    }),
    limitations: [
      commonLimit,
      'Muqarnas cells, steel antenna bracing, individual glass bands and suspended transparent sky boxes with stairs, I beams and ties are explicit. Exact antenna equipment, box bearings within their verified ENE/SSW sectors, support dimensions and ornament pattern remain reconstructed; nearby pedestrian mall and forest are excluded.',
    ],
    camera: { position: [300, 275, 522], lookAt: [0, 199, 0], fov: 44 },
    qaCameras: [
      { name: 'muqarnas-and-glazing', position: [76, 284, 102], lookAt: [0, 285, 0] },
      { name: 'sky-deck', position: [69, 331, 78], lookAt: [0, 303, 0] },
      { name: 'suria-glass-box', position: [32, 307, -27], lookAt: [21, 303.4, -17] },
      { name: 'merdeka-glass-box', position: [-10, 307, 42], lookAt: [-1, 303.4, 26] },
      { name: 'antenna', position: [70, 403, 92], lookAt: [0, 366, 0] },
      { name: 'star-lobby', position: [86, 32, 99], lookAt: [0, 12, 0] },
      { name: 'far-silhouette', position: [-424, 327, 698], lookAt: [0, 202, 0] },
    ],
  },
);

function rotatePlan(plan, center, angle) {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  return plan.map(([x, z]) => [
    center[0] + (x - center[0]) * c - (z - center[1]) * s,
    center[1] + (x - center[0]) * s + (z - center[1]) * c,
  ]);
}
function buildTurningTorso(out, m) {
  const key = 'n0158_turning_torso',
    base = localOutline(m);
  const core = partPlan(m, part(key, 940786326));
  const center = core.reduce((s, p) => s.map((v, i) => v + p[i] / core.length), [0, 0]);
  const white = [0.86, 0.87, 0.84],
    darkGlass = [0.19, 0.28, 0.3];
  const at = (p, y) => {
    const q = rotatePlan([p], center, (Math.max(0, Math.min(1, (y - 4) / 186)) * Math.PI) / 2)[0];
    return [q[0], y, q[1]];
  };
  const planAt = (y) =>
    base.map((p) => {
      const q = at(p, y);
      return [q[0], q[2]];
    });
  mappedSolid(out, 'stone', base, 0, 0.25, [0.2, 0.21, 0.2]);
  glazedOutline(out, base, 0.25, 4, 2.2, darkGlass, white, 0.1);
  loft(
    out,
    'concrete',
    [radialRing(0.25, 7.8, 7.8, 64, center), radialRing(190, 5.7, 5.7, 64, center)],
    [0.78, 0.79, 0.76],
  );
  const tip = base.reduce((a, b) =>
    Math.hypot(a[0] - center[0], a[1] - center[1]) > Math.hypot(b[0] - center[0], b[1] - center[1])
      ? a
      : b,
  );
  const ti = base.indexOf(tip),
    left = base[(ti + base.length - 1) % base.length],
    right = base[(ti + 1) % base.length];
  const spinePoint = (y) => {
    const p = at(tip, y),
      v = [p[0] - center[0], p[2] - center[1]],
      l = Math.hypot(...v);
    return [p[0] + (v[0] * 2.4) / l, y, p[2] + (v[1] * 2.4) / l];
  };
  for (let unit = 0; unit < 9; unit++) {
    const cycle = 186 / 9,
      low = 4 + unit * cycle,
      high = low + cycle - 2;
    for (let floor = 0; floor < 5; floor++) {
      const y0 = low + (floor * (cycle - 2)) / 5,
        y1 = y0 + (cycle - 2) / 5;
      for (const { a, b, len } of edgeFrames(base)) {
        const count = Math.max(1, Math.round(len / 2.7));
        for (let j = 0; j < count; j++) {
          const pa = lerp(a, b, j / count),
            pb = lerp(a, b, (j + 1) / count);
          // Substantial white aluminum surrounds each discrete flat window.
          const p = [at(pa, y0), at(pb, y0), at(pb, y1), at(pa, y1)];
          const inset = [
            lerp(p[0], p[1], 0.17),
            lerp(p[0], p[1], 0.83),
            lerp(p[3], p[2], 0.83),
            lerp(p[3], p[2], 0.17),
          ];
          const q = [
            lerp(inset[0], inset[3], 0.19),
            lerp(inset[1], inset[2], 0.19),
            lerp(inset[1], inset[2], 0.8),
            lerp(inset[0], inset[3], 0.8),
          ];
          panel(out, q, darkGlass, 0.07, [0.63, 0.69, 0.69]);
          for (let k = 0; k < 4; k++)
            face(out, 'metal', [p[k], p[(k + 1) % 4], q[(k + 1) % 4], q[k]], white);
          beam(out, 'metal', at(pa, y0), at(pa, y1), 0.025, 0.035, [0.62, 0.65, 0.64]);
        }
      }
      const sp = spinePoint(y1);
      for (const side of [left, right])
        tube(out, 'metal', sp, at(lerp(tip, side, 0.82), y1), 0.12, white, 10);
    }
    mappedCap(out, 'metal', planAt(low), low, white, [], true);
    mappedCap(out, 'metal', planAt(high), high, white);
    // Recessed interstitial floor separates the nine five-storey cubes.
    const small = base.map((p) => lerp(p, center, 0.12));
    for (const { a, b } of edgeFrames(small))
      grid(
        out,
        [at(a, high), at(b, high), at(b, low + cycle), at(a, low + cycle)],
        darkGlass,
        2.2,
        2,
        0.06,
        white,
      );
    for (const y of [low, high]) bandPlan(out, planAt(y), y, 0.16, 0.2, white, 'metal');
    // Major diagonal struts terminate at the unit roof structural wall.
    for (const side of [left, right])
      tube(out, 'metal', spinePoint(low), at(lerp(tip, side, 0.94), high), 0.34, white, 16);
    const sections = 10;
    for (let j = 0; j < sections; j++)
      tube(
        out,
        'metal',
        spinePoint(low + (j * cycle) / sections),
        spinePoint(low + ((j + 1) * cycle) / sections),
        0.63 - unit * 0.035,
        white,
        16,
      );
  }
  mappedCap(out, 'metal', planAt(190), 190, white);
  const foot = spinePoint(4);
  tube(out, 'metal', [foot[0], 0.1, foot[2]], foot, 0.68, white, 16);
  turnedProfile(
    out,
    'concrete',
    [
      [0, 0.95],
      [0.2, 0.95],
    ],
    [foot[0], foot[2]],
    white,
    24,
  );
  bandPlan(out, core, 189.85, 0.15, 0.18, white, 'metal');
}

function gardenTree(out, x, y, z, height = 5) {
  tube(out, 'metal', [x, y, z], [x, y + height * 0.6, z], 0.14, [0.28, 0.23, 0.17], 8);
  loft(
    out,
    'recess',
    [
      radialRing(y + height * 0.25, height * 0.22, height * 0.21, 12, [x, z]),
      radialRing(y + height * 0.65, height * 0.35, height * 0.32, 12, [x, z]),
      radialRing(y + height, 0.1, 0.1, 12, [x, z]),
    ],
    [0.2, 0.29, 0.13],
  );
}
function buildCommerzbank(out, m) {
  const key = 'n0159_commerzbank_tower',
    base = localOutline(m);
  const silver = [0.72, 0.75, 0.72],
    greenGlass = [0.35, 0.44, 0.39];
  mappedSolid(out, 'stone', base, 0, 0.4, [0.47, 0.46, 0.42]);
  const wings = [
    { id: 279967645, high: 190, gardens: [70, 110, 150] },
    { id: 279967660, high: 180, gardens: [40, 80, 120] },
    { id: 279967663, high: 200, gardens: [60, 100, 140] },
  ];
  for (const { id, high, gardens } of wings) {
    const p = partPlan(m, part(key, id));
    let y = 0.4;
    for (const level of [...gardens, high]) {
      floorCurtain(
        out,
        p,
        y,
        level,
        Math.max(1, Math.round((level - y) / 3.65)),
        greenGlass,
        silver,
        0.9,
      );
      mappedCap(out, 'concrete', p, level, [0.62, 0.64, 0.59]);
      if (level === high) break;
      const top = level + 14.5;
      // Nine four-storey sky gardens recess behind the broad outer facade.
      // Glazing is an opaque PBR approximation; greenery lies behind open bays.
      const c = p.reduce((s, q) => s.map((v, i) => v + q[i] / p.length), [0, 0]);
      for (const { a, b, len } of edgeFrames(p)) {
        const mid = lerp(a, b, 0.5);
        if (Math.hypot(mid[0], mid[1] - 7) < 17) {
          grid(
            out,
            [
              [a[0], level, a[1]],
              [b[0], level, b[1]],
              [b[0], top, b[1]],
              [a[0], top, a[1]],
            ],
            greenGlass,
            2.5,
            3.6,
            0.07,
            silver,
          );
          continue;
        }
        const count = Math.max(1, Math.round(len / 4.5));
        for (let i = 0; i <= count; i++) {
          const q = lerp(a, b, i / count);
          beam(out, 'metal', [q[0], level, q[1]], [q[0], top, q[1]], 0.16, 0.22, silver);
        }
        for (const yy of [level + 4.8, level + 9.6])
          beam(out, 'metal', [a[0], yy, a[1]], [b[0], yy, b[1]], 0.13, 0.18, silver);
        if (len > 6) {
          const t = lerp(mid, c, 0.55);
          gardenTree(out, t[0], level + 0.3, t[1], 5.3);
        }
      }
      mappedCap(out, 'concrete', p, top, [0.67, 0.69, 0.65], [], true);
      y = top;
    }
  }
  // Three rounded service cores have independently mapped upper datums.
  for (const id of [127956225, 183060775, 279967650]) {
    const p = part(key, id),
      plan = partPlan(m, p),
      high = +p.tags.height;
    floorCurtain(out, plan, 0.4, high, Math.round(high / 3.65), [0.43, 0.48, 0.43], silver, 1.2);
    mappedCap(out, 'metal', plan, high, silver);
    bandPlan(out, plan, high, 0.3, 0.45, silver, 'metal');
  }
  const head = partPlan(m, part(key, 183060773)),
    apex = [-11.25, 12.4];
  const roof = (p) => 220 + (259 - 220) * Math.max(0, Math.min(1, (p[0] + 30.3) / 19));
  slopedGlass(out, head, roof, 215, [0.43, 0.49, 0.46]);
  for (let y = 221; y < 252; y += 1.3) {
    for (const { a, b } of edgeFrames(head))
      if (roof(a) > y && roof(b) > y)
        beam(out, 'metal', [a[0], y, a[1]], [b[0], y, b[1]], 0.17, 0.25, silver);
  }
  const topPart = partPlan(m, part(key, 183060776));
  mappedSolid(out, 'metal', topPart, 215, 265, [0.74, 0.76, 0.7]);
  loft(
    out,
    'metal',
    [
      [257, 0.92],
      [277, 0.6],
      [291, 0.37],
      [300, 0.045],
    ].map(([y, r]) => radialRing(y, r, r, 16, apex)),
    [0.7, 0.73, 0.73],
  );
  for (let y = 269; y < 295; y += 4)
    torus(out, 'metal', [...apex.slice(0, 1), y, apex[1]], 0.6, 0.065, silver, 16, 5);
}

skylineNext.push(
  {
    id: 'N0158',
    key: 'turning_torso',
    wikidataId: 'Q206435',
    title: 'Turning Torso',
    height: 190,
    build: buildTurningTorso,
    brief:
      'Calatrava’s nine twisting five-storey units with discrete blue-gray windows in white aluminum cladding, recessed interstitial floors, circular concrete core and a separate spiraling steel spine with major diagonal and minor floor struts.',
    sourceFacts: {
      heightMeters: 190,
      floors: 54,
      units: 9,
      floorsPerUnit: 5,
      twistDegrees: 90,
      coreInnerDiameterMeters: 10.6,
      coreBaseWallMeters: 2.5,
      facade: 'Curved aluminum panels with flat glass windows',
    },
    reconstruction: {
      plan: 'Exact asymmetric ground footprint and mapped circular core establish the center and signed 90-degree sweep; independent mapped units confirm rotation handedness',
      unitDatums:
        'Nine equal cycles from4 m to190 m; five occupied floors and a recessed2 m interstitial band per unit. Published190 m exterior datum replaces the coarse184 m mapped top unit.',
    },
    refs: [
      'https://calatrava.com/projects/turning-torso-malmoe.html',
      'https://www.hsb.se/turningtorso/',
      'https://www.hsb.se/omhsb/goda-exempel/hsb-malmo---turning-torso-certifierad-med-miljobyggnad-idrift-silver/',
      'https://www.openstreetmap.org/way/30926877',
    ],
    nativeAxes: axes,
    geographic: (m) => ({
      heading: m.heading,
      notes:
        'Signed asymmetric ground footprint, independent circular core and nine mapped upper units resolve rotation center and handedness. Upper floor overhang beyond the ground outline is intentional. BaseY0.',
    }),
    limitations: [
      commonLimit,
      'Window schedules and exact aluminum-panel curvature are reconstructed. The external truss is detailed but its connections are simplified. The separate gallery/parking building and reflecting pool are excluded.',
    ],
    camera: { position: [178, 139, 283], lookAt: [-3, 92, 4], fov: 44 },
    qaCameras: [
      { name: 'twisted-windows', position: [68, 90, 73], lookAt: [0, 76, 0] },
      { name: 'external-spine', position: [63, 137, 77], lookAt: [7, 113, 13] },
      { name: 'crown-core', position: [48, 211, 77], lookAt: [-3, 179, 1] },
      { name: 'ground-lobby', position: [69, 11, 51], lookAt: [-2, 8, 0] },
      { name: 'far-silhouette', position: [-249, 176, 385], lookAt: [-3, 94, 4] },
    ],
  },
  {
    id: 'N0159',
    key: 'commerzbank_tower',
    wikidataId: 'Q151765',
    title: 'Commerzbank Tower',
    height: 300,
    build: buildCommerzbank,
    brief:
      'Foster’s rounded triangular tower with three corner service cores, a central atrium, nine staggered four-storey sky gardens, dense silver-green curtain wall and asymmetrical sloping mechanical crown with a300 m antenna.',
    sourceFacts: {
      architecturalHeightMeters: 259,
      tipHeightMeters: 300,
      occupiedHeightMeters: 190,
      skyGardens: 9,
      gardenStories: 4,
      architect: 'Foster + Partners',
    },
    reconstruction: {
      plans:
        'Signed exact footprint with independent mapped office wings, core heights and highest crown/mast parts',
      gardens:
        'Mapped coarse garden levels retained; depth14.5 m reconstructed for four actual storeys rather than literal10 m coarse gaps',
    },
    refs: [
      'https://find-an-architect.architecture.com/foster-partners/london/commerzbank-headquarters',
      'https://www.commerzbank.de/konzern/newsroom/pressemitteilungen/buerogebaeude.html',
      'https://www.skyscrapercenter.com/frankfurt-am-main/commerzbank-tower/780/',
      'https://www.openstreetmap.org/way/183060777',
    ],
    nativeAxes: axes,
    geographic: (m) => ({
      heading: m.heading,
      notes:
        'Three signed rounded corner cores, staggered mapped garden-wing plans and northwest crown/mast retain their surveyed positions. Ground baseY0; the surrounding historic block is excluded.',
    }),
    limitations: [
      commonLimit,
      'Garden frames and representative planting are explicit; outer garden glass is represented by open framed bays to retain visibility with opaque daylight materials. Exact tree species, louvre construction and top mechanical-wall slope are reconstructed.',
    ],
    camera: { position: [230, 203, 359], lookAt: [0, 132, 2], fov: 44 },
    qaCameras: [
      { name: 'sky-gardens', position: [74, 117, 92], lookAt: [0, 105, 20] },
      { name: 'atrium-and-cores', position: [96, 246, 81], lookAt: [0, 157, 4] },
      { name: 'sloped-crown', position: [-75, 280, 101], lookAt: [-18, 245, 18] },
      { name: 'ground-frontage', position: [86, 17, 77], lookAt: [0, 10, 12] },
      { name: 'far-silhouette', position: [-326, 253, 491], lookAt: [0, 139, 3] },
    ],
  },
);
