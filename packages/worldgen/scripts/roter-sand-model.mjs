/** Roter Sand's offshore exterior, from the owner's 2019 engineering survey.
 * Metric geometry is original. References stay external; photographs are never textures.
 */
import { beam, normalFor, sphere } from './authored-structure-mesh.mjs';
import { ring, shell } from './lighthouse-expansion-models.mjs';
import { lathe, panel, transformed } from './lighthouse-models.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

const red = [0.65, 0.085, 0.045],
  white = [0.86, 0.85, 0.79];
const black = [0.035, 0.043, 0.043],
  glass = [0.075, 0.11, 0.13];
const tau = Math.PI * 2;
const point = (r, y, a) => [Math.sin(a) * r, y, Math.cos(a) * r];
const shaftRadius = (y) => 3.2 - ((Math.min(20.7, Math.max(8, y)) - 8) * 0.65) / 12.7;
const paint = (y) => (y < 12.3 ? white : y < 16.6 ? red : white);
const bays = [0, (-5 * Math.PI) / 8, (3 * Math.PI) / 4]; // south, WNW, NE in +X east/-Z north.

function rivet(out, center, color, radius = 0.021) {
  sphere(out, 'metal', center, [radius, radius, radius], color, 6, 4);
}
function circularWindow(out, angle, y, r, radius = 0.19) {
  const o = transformed(out, angle, point(r, y, angle));
  for (let i = 0; i < 48; i++) {
    const a = (i * tau) / 48,
      b = ((i + 1) * tau) / 48;
    const p = (t, size, z) => [Math.cos(t) * size, Math.sin(t) * size, z];
    quad(
      o,
      'metal',
      [
        p(a, radius, 0.03),
        p(a, radius + 0.047, 0.03),
        p(b, radius + 0.047, 0.03),
        p(b, radius, 0.03),
      ],
      [0, 0, 1],
      white,
    );
    o.addTriangle(
      'glass',
      'palette:#ffffff',
      [[0, 0, 0.012], p(a, radius, 0.012), p(b, radius, 0.012)],
      [0, 0, 1],
      [
        [0.5, 0.5],
        [0, 0],
        [1, 1],
      ],
      glass,
    );
  }
}
function dome(out, radius, y, rise, center = [0, 0]) {
  const profile = Array.from({ length: 25 }, (_, i) => {
    const a = (i * Math.PI) / 48;
    return [y + Math.sin(a) * rise, Math.max(0.025, Math.cos(a) * radius)];
  });
  lathe(out, 'metal', profile, black, 96, center);
  // Raised meridional seams remain fine geometry instead of per-model maps.
  for (let i = 0; i < 16; i++)
    for (let j = 0; j < 16; j++) {
      const a = (i * tau) / 16,
        u = (j * Math.PI) / 34,
        v = ((j + 1) * Math.PI) / 34;
      const p = (t) => [
        center[0] + Math.sin(a) * (radius + 0.013) * Math.cos(t),
        y + rise * Math.sin(t) + 0.012,
        center[1] + Math.cos(a) * (radius + 0.013) * Math.cos(t),
      ];
      tube(out, 'metal', p(u), p(v), 0.012, black, 6);
    }
}
function gallery(out, radius, y, center = [0, 0], start = 0, end = tau) {
  const n = Math.ceil(((end - start) / tau) * 96);
  const p = (r, h, a) => [center[0] + Math.sin(a) * r, h, center[1] + Math.cos(a) * r];
  for (let i = 0; i < n; i++) {
    const a = start + ((end - start) * i) / n,
      b = start + ((end - start) * (i + 1)) / n;
    for (const dy of [0.5, 1.06])
      tube(out, 'metal', p(radius, y + dy, a), p(radius, y + dy, b), 0.022, white, 8);
    if (i % 3 === 0) tube(out, 'metal', p(radius, y, a), p(radius, y + 1.09, a), 0.026, white, 8);
  }
}
export function buildRoterSand(target) {
  // Piecewise floor alignment to GMG II-2 / III-9: local datum NN - 2.05 m.
  const levels = [
    [0, 0],
    [1.8, 2.28],
    [8, 8.44],
    [12.3, 12.65],
    [16.6, 16.95],
    [20.7, 21.11],
    [24.1, 24.81],
    [30.7, 30.95],
  ];
  const height = (y) => {
    let i = 1;
    while (i < levels.length - 1 && y > levels[i][0]) i++;
    const [a, b] = levels[i - 1],
      [c, d] = levels[i];
    return b + ((y - a) * (d - b)) / (c - a);
  };
  const mapped = (points) => points.map(([x, y, z]) => [x, height(y), z]);
  const out = {
    addQuad(slot, ref, points, _normal, uv, color) {
      const p = mapped(points);
      target.addQuad(slot, ref, p, normalFor(...p.slice(0, 3)), uv, color);
    },
    addTriangle(slot, ref, points, _normal, uv, color) {
      const p = mapped(points);
      target.addTriangle(slot, ref, p, normalFor(...p), uv, color);
    },
    addConvexPolygon(slot, ref, points, _normal, uv, color) {
      const p = mapped(points);
      target.addConvexPolygon(slot, ref, p, normalFor(...p.slice(0, 3)), uv, color);
    },
  };
  // Lowest modeled datum is historic low water. Buried caisson is deliberately excluded.
  const base = transformed(out, -Math.PI / 8);
  const lens = [];
  for (let i = 0; i < 128; i++) {
    const a = (i * tau) / 128;
    lens.push([5.55 * Math.sin(a), 0, 7.1 * Math.cos(a)]);
  }
  for (let i = 0; i < 128; i++) {
    const a = lens[i],
      b = lens[(i + 1) % 128];
    const n = [(a[0] + b[0]) / 2, 0, (a[2] + b[2]) / 2],
      length = Math.hypot(...n);
    quad(
      base,
      'metal',
      [a, b, [b[0], 1.8, b[2]], [a[0], 1.8, a[2]]],
      n.map((v) => v / length),
      black,
    );
    base.addTriangle(
      'metal',
      'palette:#ffffff',
      [
        [0, 1.8, 0],
        [a[0], 1.8, a[2]],
        [b[0], 1.8, b[2]],
      ],
      [0, 1, 0],
      [
        [0, 0],
        [0, 1],
        [1, 1],
      ],
      black,
    );
  }
  lathe(
    out,
    'metal',
    [
      [1.8, 5.05],
      [2.1, 5.03],
      [7.9, 3.2],
      [8, 3.2],
    ],
    black,
    192,
  );
  for (const y of [2.2, 3.4, 4.6, 5.8, 7]) {
    const r = 5.05 - ((y - 1.8) * 1.85) / 6.1;
    ring(out, 'metal', y, r - 0.01, r + 0.016, 0.035, black, 192);
    for (let i = 0; i < 160; i++) rivet(out, point(r + 0.024, y + 0.06, (i * tau) / 160), black);
  }
  // The documented opposing 19-rung ladders follow the taper, ENE and WSW.
  for (const a of [(5 * Math.PI) / 8, (-3 * Math.PI) / 8]) {
    const o = transformed(out, a),
      bottom = 5.04,
      top = 3.26;
    for (const x of [-0.26, 0.26])
      beam(o, 'metal', [x, 1.85, bottom], [x, 8.2, top], 0.055, 0.06, black);
    for (let i = 0; i < 19; i++) {
      const t = i / 18;
      tube(
        o,
        'metal',
        [-0.26, 2.05 + 5.95 * t, bottom + (top - bottom) * t],
        [0.26, 2.05 + 5.95 * t, bottom + (top - bottom) * t],
        0.027,
        black,
        8,
      );
    }
  }
  const doors = [(5 * Math.PI) / 8, (-3 * Math.PI) / 8].map((angle) => ({
    angle,
    y: 8.05,
    h: 1.92,
    w: 0.73,
    depth: 0.13,
    trimSlot: 'metal',
    trimColor: white,
  }));
  shell(out, {
    profile: [
      [8, 3.2],
      [12.3, shaftRadius(12.3)],
      [16.6, shaftRadius(16.6)],
      [20.7, 2.55],
    ],
    holes: doors,
    slot: 'metal',
    color: paint,
    segments: 192,
  });
  for (const y of [9.55, 13.8, 18.05])
    for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2])
      circularWindow(out, a, y, shaftRadius(y) + 0.015);
  for (let y = 8.25; y < 20.7; y += 1.06) {
    const r = shaftRadius(y);
    ring(out, 'metal', y, r - 0.012, r + 0.012, 0.021, paint(y), 192);
    for (let i = 0; i < 112; i++)
      rivet(out, point(r + 0.018, y + 0.06, (i * tau) / 112), paint(y), 0.015);
  }
  for (let i = 0; i < 12; i++)
    for (let y = 8.15; y < 20.6; y += 0.24)
      rivet(out, point(shaftRadius(y) + 0.022, y, ((i + 0.5) * tau) / 12), paint(y), 0.016);
  // Service room: three 1.9 m projecting round bays, NE bay extends to the stair lantern.
  const serviceHoles = [Math.PI / 2, Math.PI, -Math.PI / 4].map((angle) => ({
    angle,
    y: 21.65,
    h: 1.35,
    w: 0.64,
    depth: 0.12,
    trimSlot: 'metal',
    trimColor: white,
    grid: true,
  }));
  shell(out, {
    profile: [
      [20.7, 2.55],
      [24.1, 2.55],
    ],
    holes: serviceHoles,
    slot: 'metal',
    color: red,
    segments: 192,
  });
  ring(out, 'metal', 20.63, 2.48, 2.7, 0.14, red, 192);
  for (const a of bays) {
    const c = point(2.55, 0, a),
      o = transformed(out, 0, c),
      stair = a === bays[2];
    lathe(
      o,
      'metal',
      [
        [18.65, 0.05],
        [19.05, 0.27],
        [20.45, 0.85],
        [20.7, 0.98],
      ],
      red,
      96,
    );
    const windowAngle = a,
      top = stair ? 27.5 : 24.1;
    shell(o, {
      profile: [[20.7, 0.95], [24.1, 0.95], ...(stair ? [[27.5, 0.95]] : [])],
      holes: [
        {
          angle: windowAngle,
          y: 21.6,
          h: 1.42,
          w: 0.62,
          trimSlot: 'metal',
          trimColor: white,
          depth: 0.11,
          grid: true,
        },
        ...(stair
          ? [
              {
                angle: windowAngle,
                y: 25.3,
                h: 1.15,
                w: 0.65,
                trimSlot: 'metal',
                trimColor: white,
                depth: 0.11,
                grid: true,
              },
            ]
          : []),
      ],
      slot: 'metal',
      color: (y) => (y < 24.1 ? red : white),
      segments: 96,
    });
    ring(o, 'metal', 20.63, 0.87, 1.01, 0.14, red, 96);
    if (stair) {
      ring(o, 'metal', top, 0.9, 1.04, 0.12, white, 96);
      dome(o, 1.06, top + 0.1, 0.75);
      lathe(
        o,
        'metal',
        [
          [28.35, 0.12],
          [28.65, 0.04],
        ],
        black,
        32,
      );
    } else {
      ring(o, 'metal', 24.1, 0.05, 1.05, 0.15, white, 96);
      gallery(out, 1.07, 24.26, [c[0], c[2]], a - (3 * Math.PI) / 4, a + (3 * Math.PI) / 4);
    }
    for (const y of [21, 22.9, 23.9])
      for (let i = 0; i < 64; i++) rivet(o, point(0.966, y, (i * tau) / 64), red, 0.016);
  }
  ring(out, 'metal', 24.1, 1.95, 2.68, 0.15, white, 192);
  // Gallery perimeter follows each projecting bay; avoid a railing through the access bay.
  for (let i = 0; i < 192; i++) {
    const a = (i * tau) / 192,
      b = ((i + 1) * tau) / 192,
      mid = (a + b) / 2;
    if (bays.some((t) => Math.abs(Math.atan2(Math.sin(mid - t), Math.cos(mid - t))) < 0.37))
      continue;
    for (const y of [24.75, 25.31])
      tube(out, 'metal', point(2.68, y, a), point(2.68, y, b), 0.022, white, 8);
    if (i % 4 === 0)
      tube(out, 'metal', point(2.68, 24.25, a), point(2.68, 25.33, a), 0.026, white, 8);
  }
  // White lantern drum, recessed separated glazing, dark copper dome and ventilation finial.
  lathe(
    out,
    'metal',
    [
      [24.25, 1.99],
      [25.85, 1.99],
    ],
    white,
    128,
  );
  for (let i = 0; i < 16; i++) {
    const a = (i * tau) / 16,
      b = ((i + 1) * tau) / 16;
    quad(
      out,
      'glass',
      [
        point(1.95, 25.85, a + 0.018),
        point(1.95, 25.85, b - 0.018),
        point(1.95, 27.38, b - 0.018),
        point(1.95, 27.38, a + 0.018),
      ],
      [Math.sin((a + b) / 2), 0, Math.cos((a + b) / 2)],
      glass,
    );
    tube(out, 'metal', point(1.99, 25.84, a), point(1.99, 27.45, a), 0.042, white, 8);
    tube(out, 'metal', point(1.985, 26.57, a), point(1.985, 26.57, b), 0.028, white, 8);
  }
  ring(out, 'metal', 27.4, 1.92, 2.13, 0.16, white, 128);
  dome(out, 2.13, 27.55, 1.75);
  lathe(
    out,
    'metal',
    [
      [29.29, 0.15],
      [29.48, 0.23],
      [29.72, 0.23],
      [29.86, 0.09],
      [30.2, 0.055],
      [30.7, 0.016],
    ],
    black,
    48,
  );
  // Connecting barrel and east-side battery cupboard, separately legible at gallery level.
  const connect = transformed(out, bays[2]);
  box(connect, 'metal', [-0.56, 24.25, 1.55], [0.56, 26.85, 2.55], white);
  for (let i = 0; i < 24; i++) {
    const a = (i * Math.PI) / 24,
      b = ((i + 1) * Math.PI) / 24;
    quad(
      connect,
      'metal',
      [
        [0.6 * Math.cos(a), 26.85 + 0.6 * Math.sin(a), 1.45],
        [0.6 * Math.cos(b), 26.85 + 0.6 * Math.sin(b), 1.45],
        [0.6 * Math.cos(b), 26.85 + 0.6 * Math.sin(b), 2.55],
        [0.6 * Math.cos(a), 26.85 + 0.6 * Math.sin(a), 2.55],
      ],
      [Math.cos((a + b) / 2), Math.sin((a + b) / 2), 0],
      black,
    );
  }
  box(out, 'metal', [1.75, 24.25, -0.6], [2.73, 26.05, 0.65], white);
  box(out, 'metal', [1.7, 26.05, -0.65], [2.8, 26.14, 0.7], black);
  panel(transformed(out, Math.PI / 2), 'glass', -0.35, 0.35, 24.5, 25.78, 2.745, glass);
  // Landing davit and two timber mooring dolphins from the maintained offshore appearance.
  const davit = transformed(out, (-3 * Math.PI) / 8);
  beam(davit, 'metal', [0, 18.1, 2.91], [0, 20.3, 2.91], 0.08, 0.1, black);
  beam(davit, 'metal', [0, 20.3, 2.91], [0, 20.85, 4.5], 0.08, 0.1, black);
  tube(davit, 'metal', [0, 20.85, 4.5], [0, 17.9, 4.5], 0.014, black, 6);
  for (const a of [(5 * Math.PI) / 8, (-3 * Math.PI) / 8]) {
    const p = point(6.35, 0, a);
    tube(out, 'wood', p, [p[0], 7.7, p[2]], 0.2, [0.22, 0.18, 0.14], 20);
    for (const y of [2, 4.4, 6.7])
      lathe(
        out,
        'metal',
        [
          [y, 0.22],
          [y + 0.1, 0.22],
        ],
        black,
        32,
        [p[0], p[2]],
      );
  }
}

export const roterSandStudies = [
  {
    id: 'N1007',
    key: 'roter_sand',
    title: 'Roter Sand',
    wikidataId: 'Q220034',
    build: buildRoterSand,
    authoringFile: 'roter-sand-model.mjs',
    size: [14.4, 30.95, 14.4],
    metricTriangleUv: true,
    nativeAxes: {
      up: '+Y',
      front: '+Z south; +X east',
      origin: 'Tower axis at historic low-water reference; no buried caisson geometry.',
    },
    visualBrief:
      'Offshore riveted taper with black plinth, white/red/white shaft, red service room and three unequal-height round bays; white lantern, black domes, scalloped gallery, portholes, rivets, ladders, davit and mooring dolphins.',
    sourceFacts: {
      survey:
        'GMG GA218014, 14 June 2019, section 1.02 pp I-5–7; field visits October 2018 and May 2019',
      plinthHeightMeters: 6.1,
      plinthDiametersMeters: [10.1, 6.4],
      shaftHeightMeters: 12.7,
      shaftDiametersMeters: [6.4, 5.1],
      bayDiameterMeters: 1.9,
      bayBearingsDegrees: [180, 292.5, 45],
      lanternDiameterMeters: 4,
      baseLadderRungs: 19,
      aboveLowWaterMeters: 30.95,
      verticalDatum: 'GMG III-9 uses low water = NN -2.05 m; tower tip NN +28.90 m',
    },
    referencePages: [
      'https://www.denkmalschutz.de/fileadmin/media/Bilder/Denkmal/Leuchtturm_Roter_Sand/Gutachten_Sanierung_Juni2019.pdf',
      'https://urn.dsm.museum/DSA/DSA08_1985_199216_Peters.pdf',
      'https://www.denkmalschutz.de/denkmale-erhalten/stiftungseigene-denkmale/leuchtturm-roter-sand/chronik-und-zukunft-des-leuchturms.html',
      'https://www.openstreetmap.org/node/635484478',
    ],
    referenceRights:
      'Original geometry uses published dimensional facts. Source photographs and drawings retain their rights and are not redistributed.',
    geographicProposal: {
      anchor: [8.0821686, 53.8531662],
      heading: 0,
      elevationMode: 'sea-level',
      elevationMeters: -2.05,
      status: 'preview-proposal',
      source: 'https://www.openstreetmap.org/node/635484478',
      notes:
        'Exact-identity OSM node 635484478 agrees within 0.1 m with the 2019 engineering report WGS84 coordinate 53°51′11.4″ N / 8°04′55.81″ E; the older DSD 2010 and candidate coordinates are about 207 m north. Survey compass directions fix bay orientation. GMG III-9 places historic low water at NN -2.05 m; sea-level preview assumes the viewer zero approximates NN, with tidal/water-datum review pending. Owner’s 2026 chronology describes a future relocation, not a completed move.',
    },
    limitations: [
      'Initial detailed offshore exterior study of the 2018–2019 surveyed appearance; not yet approved for maximum fidelity or geographic activation.',
      'Plinth plan, seam/rivet spacing, small fittings, porthole positions and battery cupboard are reconstructed within published principal dimensions; not a fabrication survey.',
      'Shaft portholes use recessed-looking disks; their wall apertures, bay-wall intersections and gallery junctions need close-up refinement. Hidden interiors, underwater foundations, exact corrosion patterns and working lamp optics are not modeled.',
      'Offshore anchor and compass orientation are evidence-backed; viewer NN/sea-level equivalence, tides, footprint fit and any later relocation still require geographic review.',
    ],
    qaCameras: [
      { name: 'service-bays', position: [12, 25, 17], lookAt: [0, 23.7, 0] },
      { name: 'stair-lantern', position: [13, 29, -15], lookAt: [0, 26, 0] },
      { name: 'landing-ladders', position: [12, 9, -10], lookAt: [0, 5, 0] },
      { name: 'shaft-rivets', position: [6, 16, 9], lookAt: [0, 14, 0] },
    ],
  },
];
