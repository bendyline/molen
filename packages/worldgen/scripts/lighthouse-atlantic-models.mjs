/** Distinct lighthouse exteriors from primary photographs, published dimensions and mapped plans. */
import { beam, loft, normalFor, radialRing, sphere } from './authored-structure-mesh.mjs';
import {
  facadeBlock,
  hipRoof,
  lighthouseStudy,
  ring,
  shell,
} from './lighthouse-expansion-models.mjs';
import { lathe, panel, piercedFacade, railRing, transformed } from './lighthouse-models.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

const pale = [0.86, 0.85, 0.78],
  dark = [0.085, 0.105, 0.11],
  ochre = [0.66, 0.49, 0.28];
const polar = (r, y, a) => [Math.sin(a) * r, y, Math.cos(a) * r];
/** Fill the upper corners of a rectangular recess to form a true semicircular head. */
function archedHead(out, { x = 0, y, w, h, z, slot = 'ashlar', color = ochre, frame = pale }) {
  const r = w / 2,
    cy = y + h - r;
  for (let i = 0; i < 24; i++) {
    const a = (i * Math.PI) / 24,
      b = ((i + 1) * Math.PI) / 24;
    const p = [x + r * Math.cos(a), cy + r * Math.sin(a), z],
      q = [x + r * Math.cos(b), cy + r * Math.sin(b), z];
    const ps = [p, [p[0], y + h + 0.001, z], [q[0], y + h + 0.001, z], q];
    quad(out, slot, ps, [0, 0, 1], color);
    tube(out, 'wood', p, q, 0.042, frame, 8);
  }
  for (const xx of [x - r, x + r]) tube(out, 'wood', [xx, y, z], [xx, cy, z], 0.042, frame, 8);
  for (const yy of [y, y + h * 0.32, y + h * 0.64])
    beam(out, 'wood', [x - r, yy, z - 0.08], [x + r, yy, z - 0.08], 0.055, 0.045, frame);
  beam(out, 'wood', [x, y, z - 0.08], [x, y + h, z - 0.08], 0.06, 0.045, frame);
}
function glazedLantern(out, { y, r, h, frame = dark, n = 16 }) {
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI * 2) / n,
      b = ((i + 1) * Math.PI * 2) / n;
    const ps = [polar(r, y, a), polar(r, y, b), polar(r, y + h, b), polar(r, y + h, a)];
    quad(out, 'glass', ps, normalFor(...ps.slice(0, 3)), [0.25, 0.32, 0.33]);
    tube(out, 'metal', ps[0], ps[3], 0.027, frame, 8);
  }
  for (const yy of [y, y + h * 0.52, y + h])
    ring(out, 'metal', yy, r - 0.04, r + 0.04, 0.05, frame, 96);
}

export function buildChipiona(out) {
  // Exact mapped western plinth and east keeper wings; vertical subdivisions follow municipal photographs.
  const cream = [0.84, 0.79, 0.65],
    trim = [0.92, 0.88, 0.75];
  facadeBlock(out, {
    rx: 5.28,
    rz: 4.99,
    y0: 0,
    y1: 10.8,
    slot: 'ashlar',
    color: ochre,
    windows: [
      { face: 3, x: 0, y: 0.45, w: 1.65, h: 3.1, trim: 0.22 },
      { face: 0, x: 0, y: 4.8, w: 0.85, h: 1.75, trim: 0.12 },
      { face: 2, x: 0, y: 4.8, w: 0.85, h: 1.75, trim: 0.12 },
    ],
  });
  for (const [y, rx, rz, h] of [
    [0, 5.43, 5.14, 0.45],
    [10.5, 5.45, 5.16, 0.32],
    [10.82, 5.7, 5.4, 0.28],
    [11.1, 5.4, 5.1, 0.3],
  ])
    box(out, 'ashlar', [-rx, y, -rz], [rx, y + h, rz], ochre);
  for (const z of [-7.81, 7.81]) {
    facadeBlock(out, {
      cx: 9.49,
      cz: z,
      rx: 10.32,
      rz: 2.78,
      y0: 0,
      y1: 6.65,
      slot: 'plaster',
      color: cream,
      windows: [
        ...[-7.5, -3.75, 0, 3.75, 7.5].map((x) => ({
          face: z > 0 ? 0 : 2,
          x,
          y: 2.25,
          w: 0.95,
          h: 2.15,
          trim: 0.15,
        })),
        { face: 1, x: 0, y: 2.3, w: 1, h: 2.1, trim: 0.15 },
      ],
    });
    box(out, 'limestone', [-0.99, 6.62, z - 2.95], [19.98, 6.9, z + 2.95], trim);
    for (const zz of [z - 2.71, z + 2.71])
      box(out, 'plaster', [-0.84, 6.9, zz - 0.11], [19.83, 7.4, zz + 0.11], cream);
    for (const xx of [-0.65, 3.6, 7.7, 11.8, 15.9, 19.6])
      box(
        out,
        'limestone',
        [xx - 0.13, 0.45, z + (z > 0 ? 2.8 : -2.95)],
        [xx + 0.13, 6.65, z + (z > 0 ? 2.96 : -2.79)],
        trim,
      );
  }
  // Eastern connecting block and recessed central roof-light: distinct from the lower western tower plinth.
  facadeBlock(out, {
    cx: 17.23,
    cz: -0.01,
    rx: 3.38,
    rz: 5.91,
    y0: 0,
    y1: 6.65,
    slot: 'plaster',
    color: cream,
    windows: [
      ...[-3.9, 0, 3.9].map((x) => ({ face: 1, x, y: 2.1, w: 1.05, h: 2.35, trim: 0.15 })),
      { face: 3, x: 0, y: 0.4, w: 1.4, h: 2.5, trim: 0.2 },
    ],
  });
  box(out, 'limestone', [13.7, 6.62, -6.07], [20.8, 6.94, 6.05], trim);
  facadeBlock(out, {
    cx: 10.07,
    cz: 0.02,
    rx: 3.51,
    rz: 3.52,
    y0: 0,
    y1: 4.75,
    slot: 'plaster',
    color: cream,
    windows: [],
  });
  hipRoof(out, 10.07, 0.02, 3.65, 3.66, 4.75, 1.7, [0.3, 0.36, 0.35], 'glass');
  for (let i = -3; i <= 3; i++) {
    beam(
      out,
      'metal',
      [10.07 + i, 4.8, -3.64],
      [10.07 + i * 0.025, 6.44, 0.02],
      0.043,
      0.045,
      trim,
    );
    beam(out, 'metal', [10.07 + i, 4.8, 3.68], [10.07 + i * 0.025, 6.44, 0.02], 0.043, 0.045, trim);
  }
  lathe(
    out,
    'ashlar',
    [
      [11.4, 4.58],
      [11.67, 4.58],
      [11.84, 4.35],
    ],
    ochre,
    144,
  );
  const holes = [17.1, 27.7, 38.3, 48.9].map((y) => ({
    angle: Math.PI / 2,
    y,
    w: 0.88,
    h: 2.35,
    depth: 0.34,
    trimSlot: 'ashlar',
    trimColor: ochre,
  }));
  // Keep each masonry course continuous across the separate bands cut by windows.
  // Constant wrap circumference avoids a visible jump when the shell's band-average radius changes.
  const shaft = Object.create(out);
  shaft.addQuad = (slot, ref, points, normal, uv, color) => {
    const r = (Math.hypot(points[0][0], points[0][2]) + Math.hypot(points[2][0], points[2][2])) / 2;
    out.addQuad(
      slot,
      ref,
      points,
      normal,
      ref === 'metric:uv' ? uv.map(([u, v]) => [(u * 4) / r, v]) : uv,
      color,
    );
  };
  shell(shaft, {
    profile: [
      [11.84, 4.35],
      [53.35, 3.25],
    ],
    holes,
    slot: 'ashlar',
    color: ochre,
    segments: 160,
  });
  for (const h of holes)
    archedHead(transformed(out, Math.PI / 2), {
      ...h,
      z: 4.35 - ((h.y + 1.17 - 11.84) / 41.51) * 1.1 + 0.025,
    });
  lathe(
    out,
    'ashlar',
    [
      [52.9, 3.27],
      [53.05, 3.52],
      [53.35, 3.55],
      [53.52, 3.29],
      [55.85, 3.29],
      [56.65, 3.97],
      [57.0, 4.05],
      [57.18, 4.05],
    ],
    ochre,
    144,
  );
  for (let i = 0; i < 20; i++) {
    const o = transformed(out, (i * Math.PI) / 10);
    for (const [y, z, d, w, h] of [
      [54.45, 3.32, 0.31, 0.43, 0.45],
      [54.9, 3.48, 0.42, 0.51, 0.46],
      [55.36, 3.65, 0.58, 0.6, 0.62],
    ])
      box(o, 'ashlar', [-w / 2, y, z - d / 2], [w / 2, y + h, z + d / 2], ochre);
  }
  railRing(out, 57.2, 3.88, 0.9, dark, 48);
  // 1964 aero-maritime lantern: intersecting diagonal astragals over glazed cylindrical/domed envelope.
  lathe(
    out,
    'metal',
    [
      [57.2, 1.88],
      [57.42, 1.88],
      [57.58, 1.75],
    ],
    dark,
    96,
  );
  const profile = [
    [57.58, 1.75],
    [59.65, 1.75],
    [60.05, 1.69],
    [60.4, 1.5],
    [60.74, 1.1],
    [60.98, 0.45],
    [61.03, 0.12],
  ];
  lathe(out, 'glass', profile, [0.28, 0.37, 0.39], 96);
  const rad = (y) => {
    let j = 1;
    while (j < profile.length - 1 && profile[j][0] < y) j++;
    const [a, r] = profile[j - 1],
      [b, s] = profile[j];
    return r + ((s - r) * (y - a)) / (b - a);
  };
  for (const sign of [-1, 1])
    for (let k = 0; k < 12; k++)
      for (let j = 0; j < 35; j++) {
        const y = 57.6 + j * 0.097,
          Y = y + 0.097,
          a = (k * Math.PI) / 6 + sign * (y - 57.6) * 0.54,
          b = (k * Math.PI) / 6 + sign * (Y - 57.6) * 0.54;
        tube(
          out,
          'metal',
          polar(rad(y) + 0.027, y, a),
          polar(rad(Y) + 0.027, Y, b),
          0.026,
          trim,
          8,
        );
      }
  sphere(out, 'metal', [0, 61.12, 0], [0.26, 0.23, 0.26], trim, 32, 12);
  tube(out, 'metal', [0, 61.3, 0], [0, 62.6, 0], 0.027, dark, 10);
  // Roof vents and aerials visible on the service ensemble.
  for (const x of [4.4, 15.9]) {
    tube(out, 'metal', [x, 6.92, -8.7], [x, 9.6, -8.7], 0.025, dark, 8);
    tube(out, 'metal', [x - 0.38, 9.2, -8.7], [x + 0.38, 9.2, -8.7], 0.021, dark, 8);
  }
}

export function buildShabla(out) {
  const red = [0.61, 0.19, 0.135],
    white = [0.87, 0.86, 0.8],
    roof = [0.45, 0.35, 0.22];
  // The mapped attached service house extends north of the tower, rather than centering on the catalog point.
  facadeBlock(out, {
    cx: 0.48,
    cz: -8.36,
    rx: 5.3,
    rz: 5.96,
    y0: 0,
    y1: 3.8,
    slot: 'plaster',
    color: white,
    windows: [
      { face: 0, x: -3, y: 1, w: 1.15, h: 1.25, trim: 0.06 },
      { face: 3, x: 0, y: 1, w: 1.2, h: 1.3, trim: 0.06 },
      { face: 2, x: -2.4, y: 0.1, w: 1.05, h: 2.1, trim: 0.04 },
      { face: 2, x: 2.7, y: 1, w: 1.1, h: 1.25, trim: 0.05 },
    ],
  });
  hipRoof(out, 0.48, -8.36, 5.47, 6.12, 3.8, 1.15, roof);
  facadeBlock(out, {
    rx: 4.25,
    rz: 4.25,
    y0: 0,
    y1: 8.05,
    slot: 'ashlar',
    color: white,
    windows: [
      { face: 0, x: 0, y: 1.15, w: 0.95, h: 1.75, trim: 0.11 },
      { face: 0, x: 0, y: 4.8, w: 0.95, h: 1.75, trim: 0.11 },
      { face: 1, x: 0, y: 1.2, w: 0.9, h: 1.6, trim: 0.1 },
      { face: 3, x: 0, y: 4.8, w: 0.9, h: 1.6, trim: 0.1 },
    ],
  });
  facadeBlock(out, {
    rx: 4.25,
    rz: 4.25,
    y0: 8.05,
    y1: 12.05,
    slot: 'ashlar',
    color: red,
    windows: [],
  });
  box(out, 'limestone', [-4.32, 12.02, -4.32], [4.32, 12.23, 4.32], white);
  // Eight planar faces, projecting stone edges and the characteristic broad red/white bands.
  const levels = [12.23, 14.3, 17.7, 20.6, 23.7, 26.4, 29.4],
    colors = [white, red, white, red, white, red];
  const apothem = (y) => 2.94 - ((y - 12.23) * 1.02) / 17.17;
  for (let j = 0; j < levels.length - 1; j++)
    for (let f = 0; f < 8; f++) {
      const lo = levels[j],
        hi = levels[j + 1],
        a = apothem(lo),
        b = apothem(hi),
        o = transformed(out, (f * Math.PI) / 4);
      const taper = {
        addQuad(s, r, p, _n, uv, c) {
          const ps = p.map(([x, y, z]) => [(x * apothem(y)) / a, y, (z * apothem(y)) / a]);
          o.addQuad(s, r, ps, normalFor(...ps.slice(0, 3)), uv, c);
        },
      };
      const holes =
        f === 0 && [0, 2, 4].includes(j)
          ? [
              {
                x: 0,
                y: lo + 0.38,
                w: 0.53,
                h: Math.min(1.5, hi - lo - 0.64),
                depth: 0.28,
                trim: 0.055,
              },
            ]
          : [];
      piercedFacade(taper, {
        half: a * Math.tan(Math.PI / 8),
        z: a,
        y0: lo,
        y1: hi,
        holes,
        slot: 'ashlar',
        color: colors[j],
      });
      if (j === 0 && f === 0)
        archedHead(o, {
          x: 0,
          y: lo + 0.38,
          w: 0.53,
          h: 1.43,
          z: apothem(lo + 1) + 0.04,
          color: colors[j],
          frame: [0.35, 0.21, 0.12],
        });
      const edge0 = polar(a / Math.cos(Math.PI / 8), lo, (f * Math.PI) / 4 + Math.PI / 8),
        edge1 = polar(b / Math.cos(Math.PI / 8), hi, (f * Math.PI) / 4 + Math.PI / 8);
      beam(out, 'ashlar', edge0, edge1, 0.08, 0.08, colors[j]);
    }
  loft(
    out,
    'limestone',
    [
      radialRing(29.4, 2.17, 2.17, 8, [0, 0], Math.PI / 8),
      radialRing(29.62, 2.29, 2.29, 8, [0, 0], Math.PI / 8),
    ],
    white,
  );
  railRing(out, 29.63, 2.09, 0.76, dark, 16);
  lathe(
    out,
    'metal',
    [
      [29.64, 1.15],
      [29.95, 1.15],
    ],
    white,
    64,
  );
  glazedLantern(out, { y: 29.95, r: 0.98, h: 1.12, frame: dark, n: 12 });
  lathe(
    out,
    'metal',
    [
      [31.08, 1.13],
      [31.18, 1.14],
      [31.45, 0.7],
      [31.62, 0.14],
    ],
    dark,
    64,
  );
  sphere(out, 'metal', [0, 31.69, 0], [0.13, 0.12, 0.13], dark, 24, 10);
  tube(out, 'metal', [0, 31.8, 0], [0, 32, 0], 0.027, dark, 8);
  // Ground door/steps on the inland face and small vents; local southern elevation stays as photographed.
  for (let i = 0; i < 3; i++)
    box(
      out,
      'concrete',
      [4.25, 0.18 * i, -1.5],
      [5.2 - 0.25 * i, 0.18 * (i + 1), -0.25],
      [0.55, 0.54, 0.49],
    );
  panel(transformed(out, Math.PI / 2), 'wood', -0.65, 0.65, 0.55, 2.8, 4.27, [0.25, 0.19, 0.13]);
  for (const z of [-6.5, -10.5])
    box(out, 'plaster', [-3.4, 4.4, z - 0.3], [-2.8, 5.6, z + 0.3], white);
}

export function buildEclaireurs(out) {
  const red = [0.64, 0.17, 0.105],
    white = [0.88, 0.87, 0.8],
    black = [0.075, 0.085, 0.08];
  shell(out, {
    profile: [
      [0, 1.51],
      [0.18, 1.53],
      [3.15, 1.43],
      [6.28, 1.31],
      [8.8, 1.22],
    ],
    holes: [
      { angle: 0, y: 0.1, w: 0.72, h: 1.91, depth: 0.24, trimSlot: 'plaster', trimColor: red },
    ],
    slot: 'plaster',
    color: (y) => (y < 3.15 || y >= 6.28 ? red : white),
    segments: 128,
  });
  panel(out, 'wood', -0.31, 0.31, 0.14, 1.96, 1.22, [0.27, 0.105, 0.06]);
  for (let x = -0.26; x < 0.32; x += 0.105)
    beam(out, 'wood', [x, 0.16, 1.245], [x, 1.93, 1.245], 0.015, 0.017, [0.33, 0.14, 0.075]);
  sphere(out, 'metal', [0.24, 1.04, 1.29], [0.035, 0.045, 0.035], black, 12, 8);
  lathe(
    out,
    'plaster',
    [
      [8.75, 1.22],
      [8.87, 1.34],
      [9.03, 1.34],
      [9.11, 1.26],
    ],
    red,
    128,
  );
  railRing(out, 9.12, 1.14, 0.77, black, 12);
  lathe(
    out,
    'metal',
    [
      [9.1, 0.73],
      [9.85, 0.73],
    ],
    black,
    96,
  );
  glazedLantern(out, { y: 9.85, r: 0.69, h: 0.65, frame: [0.25, 0.27, 0.26], n: 8 });
  lathe(
    out,
    'metal',
    [
      [10.5, 0.79],
      [10.58, 0.82],
      [10.69, 0.68],
      [10.81, 0.41],
      [10.86, 0.11],
    ],
    black,
    96,
  );
  tube(out, 'metal', [0, 10.85, 0], [0, 10.93, 0], 0.05, black, 12);
  sphere(out, 'metal', [0, 10.94, 0], [0.075, 0.06, 0.075], black, 24, 10);
  // Small paired inclined photovoltaic panels on the north-facing gallery rail, visible in the official photo.
  for (const x of [-0.54, 0.54]) {
    const a = [x - 0.22, 9.23, -0.94],
      b = [x + 0.22, 9.23, -0.94],
      c = [x + 0.22, 9.76, -0.69],
      d = [x - 0.22, 9.76, -0.69],
      ps = [a, d, c, b];
    quad(out, 'glass', ps, normalFor(...ps.slice(0, 3)), [0.08, 0.14, 0.19]);
    for (const [p, q] of [
      [a, b],
      [b, c],
      [c, d],
      [d, a],
    ])
      beam(out, 'metal', p, q, 0.025, 0.028, black);
    beam(out, 'metal', [x, 9.23, -0.94], [x, 9.76, -0.69], 0.02, 0.021, [0.5, 0.52, 0.5]);
  }
}

export const lighthouseAtlanticStudies = [
  lighthouseStudy({
    id: 'N0655',
    key: 'chipiona_lighthouse',
    title: 'Chipiona Lighthouse',
    wikidataId: 'Q1190267',
    build: buildChipiona,
    size: [26, 62.6, 21.4],
    smoothNormalSlots: ['trim', 'foundation', 'wall'],
    visualBrief:
      'Ochre stone commemorative-column shaft with four tall arched windows; square rusticated plinth, deeply bracketed capital and circular iron gallery, glass aero-maritime dome with crossing white astragals, and the asymmetric cream keeper complex with central pyramidal roof light.',
    sourceFacts: {
      heightMeters: 62.6,
      seaElevationMeters: 69,
      lanternDiameterMeters: 3.5,
      year: 1867,
      basis:
        'IAPH primary heritage study explicitly distinguishes62.6m above ground from69m above mean sea level, and describes four shaft openings. Port of Seville2013 report gives3.5m lantern diameter. OSM tower part841109947 and mapped base153047246 establish shaft center and stepped plan; other elevations are municipal-photo proportions.',
    },
    referencePages: [
      'https://www.iaph.es/revistaph/index.php/revistaph/article/download/1952/1952',
      'https://www.turismodechipiona.com/destinations/faro',
      'https://www.turismodechipiona.com/wp-content/uploads/2018/05/faro-2.jpg',
      'https://www.turismodechipiona.com/wp-content/uploads/2018/04/aolfaro01.jpg',
      'https://www.puertos.es/sites/default/files/2025-02/Memoria%20AP%20Sevilla%202013.pdf',
      'https://www.openstreetmap.org/way/841109947',
      'https://www.openstreetmap.org/way/153047246',
    ],
    geographicProposal: {
      anchor: [-6.442194584211, 36.737914042105],
      heading: -0.183905284578,
      elevationMode: 'terrain-contact',
      status: 'preview-proposal',
      source: 'https://www.openstreetmap.org/way/841109947',
      notes:
        'Origin is the exact mapped round tower centroid. Mapped keeper complex extends authored+X east-southeast, fixing the quadrant. Shaft window azimuth is photo reconstructed on the keeper side. Host terrain supplies coastal ground;69m sea elevation is not applied as tower height.',
    },
    limitations: [
      'Keeper block heights and window rhythm are reconstructed from municipal exterior photographs over the mapped plan; the simplified OSM12m whole-base tag is not imposed on the lower wings. Neighboring restaurant, palms and coastal embankment are separate features. Glazing is a static optical envelope.',
    ],
    qaCameras: [
      { name: 'near-lantern', position: [10, 61, 13], lookAt: [0, 58, 0] },
      { name: 'near-arched-windows', position: [15, 42, 5], lookAt: [3.6, 39.5, 0] },
      { name: 'near-keeper-house', position: [32, 16, 31], lookAt: [9, 5, 0] },
      { name: 'far-ensemble', position: [67, 37, 85], lookAt: [5, 29, 0] },
    ],
  }),
  lighthouseStudy({
    id: 'N0656',
    key: 'shabla_lighthouse',
    title: 'Shabla Lighthouse',
    wikidataId: 'Q21014964',
    build: buildShabla,
    size: [11, 32, 18.6],
    visualBrief:
      'Tall red and white tapering octagon with real recessed narrow openings, crisp corner ribs and a small dark lantern. Broad square striped masonry base with stacked southern windows and attached low hipped keeper house to the north.',
    sourceFacts: {
      heightMeters: 32,
      basis:
        'Municipality publishes32m and an exterior photograph showing the square base, six shaft bands and octagonal taper. Exact-QID OSM lighthouse node9031362149 identifies the tower19m south of the old catalog point; attached service building262498736 fixes northward extent and axis. Cross sections and storey elevations are photograph proportions.',
    },
    referencePages: [
      'https://shabla.bg/directory/shablenski-far/',
      'https://shabla.bg/wp-content/uploads/2024/02/shabla-lightghouse-slide-1.jpg',
      'https://www.openstreetmap.org/node/9031362149',
      'https://www.openstreetmap.org/way/262498736',
    ],
    geographicProposal: {
      anchor: [28.6069834, 43.5401767],
      heading: -0.047379,
      elevationMode: 'terrain-contact',
      status: 'preview-proposal',
      source: 'https://www.openstreetmap.org/node/9031362149',
      notes:
        'Exact-QID lighthouse node replaces older point19m north. Mapped attached service building262498736 extends north (-Z); its east-west wall axis sets heading. Tower footprint dimensions are primary-photo proportions, not a mapped tower polygon.',
    },
    limitations: [
      'Paint wear and individual repairs are represented by shared masonry; the official image has no precise capture date. Tower plan is photograph-scaled against32m height; neighboring detached station houses remain separate map features.',
    ],
    qaCameras: [
      { name: 'near-lantern', position: [8, 31, 11], lookAt: [0, 29.9, 0] },
      { name: 'near-octagon', position: [11, 22, 16], lookAt: [0, 20, 0] },
      { name: 'near-base', position: [18, 11, 19], lookAt: [0, 5, -3] },
      { name: 'far-ensemble', position: [39, 22, 47], lookAt: [0, 15, -2] },
    ],
  }),
  lighthouseStudy({
    id: 'N0657',
    key: 'les_eclaireurs_lighthouse',
    title: 'Les Éclaireurs Lighthouse',
    wikidataId: 'Q3378140',
    build: buildEclaireurs,
    size: [3.06, 11, 3.06],
    smoothNormalSlots: ['trim', 'foundation', 'wall'],
    visualBrief:
      'Small isolated rough-masonry lighthouse with a red-white-red taper, low recessed wooden door, projecting red gallery lip, delicate black two-rail gallery, black lantern pedestal and domed roof, metal astragals and paired tilted solar panels.',
    sourceFacts: {
      heightMeters: 11,
      baseDiameterApproxMeters: 3,
      year: 1920,
      basis:
        'Provincial tourism publishes11m height. National Argentina tourism photograph supplies the three bands, door, gallery, lantern and small inclined panels. Base diameter and component dimensions are photograph-scaled; mapped exact-QID node8127284556 fixes position.',
    },
    referencePages: [
      'https://tierradelfuego.tur.ar/es/actividades/s/7',
      'https://turismoushuaia.com/actividad/faro-les-eclaireurs/',
      'https://www.argentina.gob.ar/jefatura/turismo/viaja-por-argentina/navegar-por-el-canal-de-beagle',
      'https://www.argentina.gob.ar/sites/default/files/ushuaia_108.jpg',
      'https://www.openstreetmap.org/node/8127284556',
    ],
    geographicProposal: {
      anchor: [-68.0832452, -54.8715452],
      heading: 0,
      elevationMode: 'terrain-contact',
      status: 'preview-proposal',
      source: 'https://www.openstreetmap.org/node/8127284556',
      notes:
        'Mapped exact-QID node fixes the island tower position. Circular exterior has no footprint heading; small entry is reconstructed on southern face, gallery panels on northern face. Host terrain provides the rocky islet;23m light elevation is not used as structure height.',
    },
    limitations: [
      "Painted masonry uses the shared lime-plaster surface to preserve the primary photograph's fine rough finish, rather than exposed stone joints. Door and solar-panel compass positions are photograph reconstructed; no measured azimuth is claimed. Natural rocky island and seabirds are host environment features.",
    ],
    qaCameras: [
      { name: 'near-lantern', position: [3.5, 11.7, 4.7], lookAt: [0, 10.1, 0] },
      { name: 'near-panels', position: [3.5, 10.7, -4.8], lookAt: [0, 9.5, -0.3] },
      { name: 'near-door', position: [4, 2.3, 6], lookAt: [0, 1.2, 0.7] },
      { name: 'far-silhouette', position: [14, 8, 19], lookAt: [0, 5.2, 0] },
    ],
  }),
];
