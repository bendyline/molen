/** Final northern lighthouse ensembles, reconstructed from operator photographs and mapped parts. */
import { beam, loft, normalFor, sphere } from './authored-structure-mesh.mjs';
import { lighthouseStudy, ring, shell } from './lighthouse-expansion-models.mjs';
import { lathe, panel, piercedFacade, transformed } from './lighthouse-models.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

const TAU = Math.PI * 2,
  white = [0.87, 0.88, 0.84],
  dark = [0.065, 0.075, 0.071];
const P = (r, y, a) => [r * Math.sin(a), y, r * Math.cos(a)];
function line(out, points, slot, color, radius = 0.018) {
  for (let i = 1; i < points.length; i++)
    tube(out, slot, points[i - 1], points[i], radius, color, 8);
}
function circularRail(out, r, y, h, n, color = white) {
  for (let i = 0; i < n; i++)
    tube(out, 'metal', P(r, y, (i * TAU) / n), P(r, y + h, (i * TAU) / n), 0.023, color, 10);
  for (const dy of [h * 0.5, h])
    ring(out, 'metal', y + dy - 0.017, r - 0.024, r + 0.024, 0.034, color, 128);
}
function roofSeams(out, profile, n, color) {
  for (let i = 0; i < n; i++)
    line(
      out,
      profile.map(([y, r]) => P(r + 0.012, y, (i * TAU) / n)),
      'metal',
      color,
      0.018,
    );
}
function simpleGlass(out, r, y0, y1, n, color = white) {
  for (let i = 0; i < n; i++) {
    const a = (i * TAU) / n,
      b = ((i + 1) * TAU) / n;
    quad(
      out,
      'glassClear',
      [P(r, y0, a), P(r, y0, b), P(r, y1, b), P(r, y1, a)],
      [Math.sin((a + b) / 2), 0, Math.cos((a + b) / 2)],
      [0.78, 0.86, 0.83],
    );
    tube(out, 'metal', P(r + 0.018, y0, a), P(r + 0.018, y1, a), 0.035, color, 10);
  }
}
function roofFace(out, slot, ps, c) {
  quad(out, slot, ps, normalFor(...ps.slice(0, 3)), c);
}
function hipRoof(
  out,
  { x0, x1, z0, z1, y, rise, slot = 'tiles', color = [0.4, 0.23, 0.13], seams = false },
) {
  const dx = (x1 - x0) / 2,
    dz = (z1 - z0) / 2,
    cz = (z0 + z1) / 2;
  if (dx >= dz) {
    const a = [x0 + dz, y + rise, cz],
      b = [x1 - dz, y + rise, cz];
    roofFace(out, slot, [a, b, [x1, y, z0], [x0, y, z0]], color);
    roofFace(out, slot, [b, a, [x0, y, z1], [x1, y, z1]], color);
    out.addTriangle(
      slot,
      'palette:#fff',
      [[x0, y, z0], [x0, y, z1], a],
      normalFor([x0, y, z0], [x0, y, z1], a),
      [
        [0, 0],
        [2 * dz, 0],
        [dz, Math.hypot(dz, rise)],
      ],
      color,
    );
    out.addTriangle(
      slot,
      'palette:#fff',
      [[x1, y, z1], [x1, y, z0], b],
      normalFor([x1, y, z1], [x1, y, z0], b),
      [
        [0, 0],
        [2 * dz, 0],
        [dz, Math.hypot(dz, rise)],
      ],
      color,
    );
    if (seams)
      for (let x = x0 + 0.2; x < x1; x += 0.42)
        for (const z of [z0, z1]) {
          const X = Math.max(x0 + dz, Math.min(x1 - dz, x));
          line(
            out,
            [
              [x, y + 0.016, z],
              [X, y + rise + 0.016, cz],
            ],
            'metal',
            color,
            0.014,
          );
        }
    line(out, [a, b], 'metal', color, 0.045);
  } else
    hipRoof(transformed(out, Math.PI / 2), {
      x0: -z1,
      x1: -z0,
      z0: x0,
      z1: x1,
      y,
      rise,
      slot,
      color,
      seams,
    });
}
function framedWindow(out, h, z, color = white, { hood = false, greenSill = false } = {}) {
  const { x = 0, y, w, h: height, depth = 0.22 } = h,
    t = 0.045;
  for (const X of [x - w / 2, x + w / 2])
    box(out, 'metal', [X - t, y, z - depth + 0.01], [X + t, y + height, z - depth + 0.08], color);
  for (const Y of [y, y + height * 0.58, y + height])
    box(
      out,
      'metal',
      [x - w / 2, Y - t, z - depth + 0.015],
      [x + w / 2, Y + t, z - depth + 0.075],
      color,
    );
  box(out, 'metal', [x - t, y, z - depth + 0.018], [x + t, y + height, z - depth + 0.08], color);
  if (hood) {
    box(
      out,
      'plaster',
      [x - w / 2 - 0.2, y + height + 0.12, z - 0.06],
      [x + w / 2 + 0.2, y + height + 0.26, z + 0.15],
      white,
    );
    for (const X of [x - w / 2 - 0.13, x + w / 2 + 0.13])
      box(
        out,
        'plaster',
        [X - 0.06, y + height - 0.05, z - 0.06],
        [X + 0.06, y + height + 0.23, z + 0.15],
        white,
      );
  }
  if (greenSill)
    box(
      out,
      'metal',
      [x - w / 2 - 0.1, y - 0.09, z - 0.12],
      [x + w / 2 + 0.1, y + 0.015, z + 0.12],
      [0.075, 0.34, 0.22],
    );
}

const kStone = [0.41, 0.405, 0.345],
  kTrim = [0.59, 0.55, 0.455],
  kRoof = [0.37, 0.225, 0.13];
export function buildKullen(out) {
  lathe(
    out,
    'granite',
    [
      [0, 3.3],
      [0.34, 3.3],
      [0.41, 3.19],
    ],
    kTrim,
    160,
  );
  shell(out, {
    profile: [
      [0.41, 3.19],
      [7.75, 3.1],
    ],
    slot: 'ashlar',
    color: kStone,
    segments: 160,
    holes: [
      ...[-1, -0.5, 0, 0.5, 1].map((a) => ({
        angle: Math.PI + a,
        y: 6.05,
        w: 0.68,
        h: 1.18,
        depth: 0.25,
        trimColor: kTrim,
      })),
      { angle: Math.PI + 0.8, y: 3.05, w: 0.37, h: 0.75, depth: 0.3, trimColor: kTrim },
      { angle: -Math.PI / 2, y: 1.2, w: 0.48, h: 0.75, depth: 0.3, trimColor: kTrim },
    ],
  });
  // The broad rubble parapet has an inset deck rather than a solid disk over the lantern foot.
  lathe(
    out,
    'granite',
    [
      [7.73, 3.11],
      [7.82, 3.26],
      [8.08, 3.26],
      [8.14, 3.13],
    ],
    kTrim,
    160,
  );
  ring(out, 'ashlar', 8.14, 2.79, 3.15, 0.57, kStone, 160);
  ring(out, 'granite', 8.71, 2.76, 3.26, 0.18, kTrim, 160);
  lathe(
    out,
    'concrete',
    [
      [8.07, 2.77],
      [8.14, 2.77],
    ],
    kTrim,
    128,
  );
  for (let i = 0; i < 8; i++) {
    const o = transformed(out, (i * TAU) / 8);
    box(o, 'granite', [-0.17, 7.96, 3.01], [0.17, 8.31, 3.48], kTrim);
    box(o, 'metal', [-0.095, 8.15, 3.49], [0.095, 8.25, 3.63], dark);
  }
  lathe(
    out,
    'metal',
    [
      [8.13, 1.92],
      [9.47, 1.92],
      [9.53, 2.14],
    ],
    white,
    160,
  );
  for (let i = 0; i < 6; i++) {
    const o = transformed(out, (i * TAU) / 6);
    sphere(o, 'glass', [0, 8.91, 1.925], [0.125, 0.125, 0.02], [0.1, 0.18, 0.2], 24, 12);
    line(
      o,
      Array.from({ length: 33 }, (_, j) => [
        0.17 * Math.cos((j * TAU) / 32),
        8.91 + 0.17 * Math.sin((j * TAU) / 32),
        1.95,
      ]),
      'metal',
      white,
      0.036,
    );
  }
  ring(out, 'metal', 9.46, 1.82, 2.18, 0.12, white, 160);
  circularRail(out, 2.28, 9.58, 0.95, 18, [0.46, 0.47, 0.4]);
  simpleGlass(out, 1.86, 9.58, 12.55, 18, white);
  for (const y of [10.93, 12.53]) ring(out, 'metal', y, 1.83, 1.9, 0.045, [0.48, 0.49, 0.44], 160);
  const dome = [
    [12.55, 2.01],
    [12.62, 2.01],
    [12.81, 1.92],
    [13.15, 1.69],
    [13.49, 1.31],
    [13.7, 0.82],
    [13.81, 0.36],
  ];
  lathe(out, 'metal', dome, dark, 192);
  roofSeams(out, dome, 12, [0.11, 0.12, 0.11]);
  lathe(
    out,
    'metal',
    [
      [13.8, 0.28],
      [13.97, 0.25],
    ],
    dark,
    64,
  );
  sphere(out, 'metal', [0, 14.21, 0], [0.31, 0.31, 0.31], dark, 48, 24);
  // Three original radial lens panels: concentric annular surfaces and steel support cheeks.
  lathe(
    out,
    'metal',
    [
      [9.5, 0.38],
      [10.16, 0.38],
    ],
    white,
    64,
  );
  for (let f = 0; f < 3; f++) {
    const o = transformed(out, (f * TAU) / 3);
    for (let band = 0; band < 18; band++) {
      const ri = 0.07 + band * 0.066,
        ro = ri + 0.065;
      for (let i = 0; i < 72; i++) {
        const a = (i * TAU) / 72,
          b = ((i + 1) * TAU) / 72,
          pt = (r, t) => [
            r * Math.cos(t),
            11.13 + r * Math.sin(t),
            0.9 + 0.28 * Math.sqrt(Math.max(0, 1 - (r / 1.29) ** 2)),
          ];
        const ps = [pt(ri, a), pt(ro, a), pt(ro, b), pt(ri, b)];
        roofFace(o, 'glassClear', ps, [0.58, 0.77, 0.62]);
      }
      line(
        o,
        Array.from({ length: 65 }, (_, i) => [
          ro * Math.cos((i * TAU) / 64),
          11.13 + ro * Math.sin((i * TAU) / 64),
          0.906 + 0.28 * Math.sqrt(Math.max(0, 1 - (ro / 1.29) ** 2)),
        ]),
        'metal',
        [0.49, 0.62, 0.48],
        0.009,
      );
    }
    line(
      o,
      Array.from({ length: 73 }, (_, i) => [
        1.29 * Math.cos((i * TAU) / 72),
        11.13 + 1.29 * Math.sin((i * TAU) / 72),
        0.9,
      ]),
      'metal',
      [0.25, 0.29, 0.23],
      0.025,
    );
    for (const x of [-1.3, 1.3]) tube(o, 'metal', [x, 9.7, 0.86], [x, 12.5, 0.86], 0.032, dark, 10);
  }
  const mast = transformed(out, 0, [0.93, 0, -1.48]);
  tube(mast, 'metal', [0, 10, 0], [0, 15, 0], 0.025, white, 10);
  for (let y = 10.1; y < 14.8; y += 0.22)
    tube(mast, 'metal', [-0.16, y, 0], [0.16, y, 0], 0.016, white, 8);
  tube(mast, 'metal', [-0.16, 10, 0], [-0.16, 14.85, 0], 0.018, white, 8);
  tube(mast, 'metal', [0.16, 10, 0], [0.16, 14.85, 0], 0.018, white, 8);
  for (let i = 0; i < 3; i++) {
    const a = (i * TAU) / 3;
    tube(mast, 'metal', [0, 14.72, 0], P(0.48, 14.72, a), 0.02, white, 8);
    lathe(
      transformed(mast, 0, P(0.48, 0, a)),
      'metal',
      [
        [14.72, 0.13],
        [14.91, 0.03],
      ],
      white,
      32,
    );
  }
  // Attached single-storey stone house follows the surveyed ensemble footprint.
  const house = transformed(out, 0, [7.87, 0, 5.93]),
    rx = 7.5,
    rz = 4.33,
    eave = 3.42;
  box(house, 'plaster', [-rx, 0, -rz], [rx, 0.36, rz], white);
  for (let f = 0; f < 4; f++) {
    const o = transformed(house, (f * Math.PI) / 2),
      half = f % 2 ? rz : rx,
      z = f % 2 ? rx : rz;
    const hs = (
      f === 0 ? [-5.7, -3.2, -0.7, 2.1, 5.0] : f === 2 ? [-5, -1.9, 1.3] : [-1.75, 1.75]
    ).map((x) => ({ x, y: 1.25, w: 1.21, h: 1.18, depth: 0.23, trim: 0.09 }));
    if (f === 2)
      hs.push({ x: 3.63, y: 0.65, w: 1.17, h: 1.97, depth: 0.22, trim: 0.08, door: true });
    piercedFacade(o, { half, y0: 0.36, y1: eave, z, holes: hs, slot: 'ashlar', color: kStone });
    for (const h of hs) if (!h.door) framedWindow(o, h, z, [0.5, 0.32, 0.16]);
    box(
      o,
      'granite',
      [-half - 0.08, eave - 0.09, z - 0.13],
      [half + 0.08, eave + 0.14, z + 0.14],
      kTrim,
    );
    tube(
      o,
      'metal',
      [-half - 0.14, eave + 0.16, z + 0.23],
      [half + 0.14, eave + 0.16, z + 0.23],
      0.07,
      dark,
      10,
    );
  }
  hipRoof(house, {
    x0: -rx - 0.31,
    x1: rx + 0.31,
    z0: -rz - 0.3,
    z1: rz + 0.3,
    y: 3.58,
    rise: 0.66,
    color: kRoof,
  });
  for (const x of [-7.24, 7.24])
    tube(house, 'metal', [x, 0.3, 4.45], [x, 3.6, 4.45], 0.055, dark, 10);
  // Recessed northeast corner entrance with rusticated return and carved granite column.
  box(out, 'ashlar', [3.12, 0.1, -1.01], [6.4, 0.62, 1.66], kStone);
  for (let i = 0; i < 4; i++)
    box(
      out,
      'granite',
      [3.16, 0.02 + i * 0.15, -2.5 + i * 0.37],
      [5.01, 0.17 + i * 0.15, -1.01],
      kTrim,
    );
  const porch = transformed(out, 0, [6.15, 0, -0.77]);
  loft(
    porch,
    'granite',
    [
      [
        [-0.48, 0.6, -0.48],
        [-0.48, 0.6, 0.48],
        [0.48, 0.6, 0.48],
        [0.48, 0.6, -0.48],
      ],
      [
        [-0.28, 1.04, -0.28],
        [-0.28, 1.04, 0.28],
        [0.28, 1.04, 0.28],
        [0.28, 1.04, -0.28],
      ],
      [
        [-0.28, 1.2, -0.28],
        [-0.28, 1.2, 0.28],
        [0.28, 1.2, 0.28],
        [0.28, 1.2, -0.28],
      ],
    ],
    kTrim,
  );
  lathe(
    porch,
    'granite',
    [
      [1.2, 0.29],
      [1.33, 0.25],
      [2.67, 0.22],
      [2.78, 0.32],
      [2.94, 0.38],
    ],
    kTrim,
    64,
  );
  for (let i = 0; i < 4; i++)
    sphere(
      transformed(porch, (i * Math.PI) / 2),
      'granite',
      [0, 2.77, 0.29],
      [0.18, 0.13, 0.13],
      kTrim,
      24,
      12,
    );
  box(out, 'granite', [3, 2.97, -1.15], [6.58, 3.18, 1.73], kTrim);
  hipRoof(out, { x0: 2.99, x1: 6.59, z0: -1.16, z1: 1.74, y: 3.2, rise: 0.45, color: kRoof });
  roofFace(
    out,
    'wood',
    [
      [4.84, 0.65, 1.71],
      [3.67, 0.65, 1.71],
      [3.67, 2.62, 1.71],
      [4.84, 2.62, 1.71],
    ],
    [0.36, 0.21, 0.115],
  );
  for (let y = 0.79; y < 2.6; y += 0.19)
    box(out, 'wood', [3.68, y, 1.68], [4.83, y + 0.014, 1.705], [0.23, 0.13, 0.08]);
  for (const y of [0.94, 2.29]) box(out, 'metal', [3.7, y, 1.72], [4.78, y + 0.045, 1.76], dark);
  sphere(out, 'metal', [4.61, 1.58, 1.77], [0.065, 0.065, 0.07], dark, 24, 12);
}

export const lighthouseKullenLizardStudies = [
  lighthouseStudy({
    id: 'N0679',
    key: 'kullen_lighthouse',
    title: 'Kullen Lighthouse',
    wikidataId: 'Q1518751',
    build: buildKullen,
    metricTriangleUv: true,
    size: [19, 15, 16],
    visualBrief:
      'Short rough-granite cylindrical tower with five broad seaward watchroom windows, masonry parapet/scuppers, white ventilated drum, tall clear lantern and visible three-panel first-order optic, black domed roof and weather mast; attached low stone service house and carved granite-column entrance porch.',
    sourceFacts: {
      heightMeters: 15,
      focalElevationMeters: 78.5,
      mappedTowerDiameterMeters: 6.5,
      attachedHousePlanMeters: [15, 8.66],
      basis:
        'Sjöfartsverket identifies the1900 granite/gneiss tower and its78.5m focal elevation. The authority-linked Swedish Lighthouse Society gives15m structural height and credited close photographs of the watchroom, first-order lens and carved entrance. The exact-QID tower and current mapped building parts fix the attached house footprint; component heights and small relief are photo-proportioned.',
    },
    referencePages: [
      'https://www.sjofartsverket.se/sv/om-oss/fyrar-och-kulturfastigheter/visningsfyrar/kullen--sveriges-kap-horn/',
      'https://wiki.fyr.org/index.php/Kullen',
      'https://wiki.fyr.org/images/9/9a/KullenFyr143EsbjHillberg.jpg',
      'https://wiki.fyr.org/images/5/55/KullenLins142EsbjHillberg.jpg',
      'https://wiki.fyr.org/images/f/f0/714600DT01.jpg',
      'https://wiki.fyr.org/images/1/15/714600DT02.jpg',
      'https://www.openstreetmap.org/way/1197717521',
      'https://www.openstreetmap.org/way/1483946313',
      'https://www.openstreetmap.org/way/1483946315',
    ],
    geographicProposal: {
      anchor: [12.451522111, 56.301025985],
      heading: -0.123,
      elevationMode: 'terrain-contact',
      groundModelY: 0,
      status: 'preview-proposal',
      source: 'https://www.openstreetmap.org/way/1483946313',
      notes:
        'Mapped house long axis resolves native+X east/slightly south; native+Z runs into the attached house south of the tower. The seaward watchroom faces native-Z, and mapped small roof identifies the northeast columned porch. Origin is the tower center at local site grade, not focal elevation.',
    },
    limitations: [
      'The granite and gneiss use shared metric mineral surfaces; individual historic stones are not surveyed. The broad watchroom, porch carving and lens silhouette follow credited photographs; fine casting and optical prisms are original geometric reconstructions. The detached downhill fog-signal building, keeper homes and hill terrain remain map context. The15m extent includes weather instrumentation.',
    ],
    previewCamera: { position: [-22, 17, -29], lookAt: [4, 6, 3], fov: 46 },
    qaCameras: [
      { name: 'near-watchroom', position: [-7, 7, -9], lookAt: [0, 6.6, 0] },
      { name: 'near-optic', position: [5, 12, -7], lookAt: [0, 11.2, 0] },
      { name: 'near-carved-porch', position: [9, 3.4, -6], lookAt: [4.9, 1.8, 0.3] },
      { name: 'near-service-house', position: [20, 8, 18], lookAt: [8, 2.5, 5] },
      { name: 'far-ensemble', position: [-25, 23, -35], lookAt: [4, 6, 3] },
    ],
  }),
];

// Lizard is authored about the working eastern tower, with the older western tower offset68m.
const lWall = [0.91, 0.915, 0.87],
  lSlate = [0.235, 0.27, 0.28];
function lizardHouse(out, { x0, x1, z0, z1, eave = 7.8, rise = 1.4, windows = [], gable = false }) {
  const cx = (x0 + x1) / 2,
    cz = (z0 + z1) / 2,
    rx = (x1 - x0) / 2,
    rz = (z1 - z0) / 2,
    o = transformed(out, 0, [cx, 0, cz]);
  box(o, 'plaster', [-rx, 0, -rz], [rx, 0.22, rz], lWall);
  for (let f = 0; f < 4; f++) {
    const h = windows.filter((h) => h.face === f).map((h) => ({ ...h, trim: 0 })),
      b = transformed(o, (f * Math.PI) / 2),
      half = f % 2 ? rz : rx,
      z = f % 2 ? rx : rz;
    piercedFacade(b, { half, y0: 0.22, y1: eave, z, holes: h, slot: 'plaster', color: lWall });
    for (const win of h) {
      framedWindow(b, win, z, white, { hood: true, greenSill: true });
      if (win.door)
        panel(
          b,
          'wood',
          win.x - win.w / 2 + 0.04,
          win.x + win.w / 2 - 0.04,
          win.y,
          win.y + win.h * 0.73,
          z - (win.depth ?? 0.22) + 0.09,
          [0.15, 0.245, 0.21],
        );
    }
    box(
      b,
      'plaster',
      [-half - 0.045, eave - 0.11, z - 0.12],
      [half + 0.045, eave + 0.19, z + 0.14],
      lWall,
    );
    for (const X of [-half + 0.13, half - 0.13])
      box(b, 'plaster', [X - 0.085, 0.22, z - 0.02], [X + 0.085, eave + 0.12, z + 0.11], white);
    tube(
      b,
      'metal',
      [-half - 0.05, eave + 0.07, z + 0.13],
      [half + 0.05, eave + 0.07, z + 0.13],
      0.055,
      dark,
      8,
    );
  }
  if (gable) {
    const X = rx + 0.13,
      Z = rz + 0.15,
      Y = eave + 0.16,
      R = Y + rise;
    roofFace(
      o,
      'slate',
      [
        [-X, Y, Z],
        [X, Y, Z],
        [X, R, 0],
        [-X, R, 0],
      ],
      lSlate,
    );
    roofFace(
      o,
      'slate',
      [
        [X, Y, -Z],
        [-X, Y, -Z],
        [-X, R, 0],
        [X, R, 0],
      ],
      lSlate,
    );
    for (const s of [-1, 1]) {
      const ps =
        s > 0
          ? [
              [rx, eave, -rz],
              [rx, eave, rz],
              [rx, R, 0],
            ]
          : [
              [-rx, eave, rz],
              [-rx, eave, -rz],
              [-rx, R, 0],
            ];
      o.addTriangle(
        'plaster',
        'palette:#fff',
        ps,
        [s, 0, 0],
        [
          [0, 0],
          [2 * rz, 0],
          [rz, rise],
        ],
        lWall,
      );
      line(
        o,
        [
          [s * (rx + 0.04), eave + 0.15, -rz],
          [s * (rx + 0.04), R + 0.05, 0],
          [s * (rx + 0.04), eave + 0.15, rz],
        ],
        'plaster',
        lWall,
        0.105,
      );
    }
    line(
      o,
      [
        [-X, R + 0.04, 0],
        [X, R + 0.04, 0],
      ],
      'metal',
      lSlate,
      0.06,
    );
  } else
    hipRoof(o, {
      x0: -rx - 0.15,
      x1: rx + 0.15,
      z0: -rz - 0.15,
      z1: rz + 0.15,
      y: eave + 0.16,
      rise,
      slot: 'slate',
      color: lSlate,
    });
  for (const x of [-rx + 0.2, rx - 0.2])
    tube(o, 'metal', [x, 0.28, rz + 0.15], [x, eave + 0.1, rz + 0.15], 0.044, dark, 8);
}
function lizardTower(out, active) {
  const r = 3.37,
    h = 14.03,
    half = r * Math.tan(Math.PI / 8);
  lathe(
    transformed(out, Math.PI / 8),
    'plaster',
    [
      [0, r / Math.cos(Math.PI / 8) + 0.08],
      [0.32, r / Math.cos(Math.PI / 8) + 0.08],
    ],
    lWall,
    8,
  );
  for (let f = 0; f < 8; f++) {
    const o = transformed(out, (f * TAU) / 8);
    const hs = (
      f % 2 === 0
        ? [
            { x: 0, y: 6.6, w: 0.74, h: 1.3 },
            { x: 0, y: 11.18, w: 1.03, h: 1.27 },
          ]
        : []
    ).map((h) => ({ ...h, depth: 0.31, trim: 0 }));
    if (f === 4) hs.push({ x: 0, y: 0.33, w: 1.11, h: 2.29, depth: 0.29, trim: 0, door: true });
    piercedFacade(o, { half, y0: 0.31, y1: h, z: r, holes: hs, slot: 'plaster', color: lWall });
    for (const w of hs) {
      framedWindow(o, w, r, white, { hood: true });
      if (w.door) panel(o, 'wood', -0.51, 0.51, 0.34, 1.93, r - 0.19, [0.12, 0.18, 0.15]);
    }
    box(o, 'plaster', [-half - 0.025, 13.9, r - 0.07], [half + 0.025, 14.1, r + 0.19], white);
    box(o, 'plaster', [-half - 0.075, 14.1, r - 0.08], [half + 0.075, 14.26, r + 0.28], lWall);
  }
  lathe(
    transformed(out, Math.PI / 8),
    'plaster',
    [
      [14.26, 3.69 / Math.cos(Math.PI / 8)],
      [14.39, 3.69 / Math.cos(Math.PI / 8)],
    ],
    lWall,
    8,
  );
  const rr = 3.48;
  for (let f = 0; f < 8; f++) {
    const o = transformed(out, (f * TAU) / 8),
      w = rr * Math.tan(Math.PI / 8);
    for (const y of [14.75, 15.21]) tube(o, 'metal', [-w, y, rr], [w, y, rr], 0.025, white, 10);
    for (let x = -w; x <= w + 0.01; x += w / 2) {
      tube(o, 'metal', [x, 14.4, rr], [x, 15.28, rr], 0.031, white, 10);
      sphere(o, 'metal', [x, 15.29, rr], [0.061, 0.077, 0.061], white, 20, 10);
    }
    for (const x of [-w * 0.65, 0, w * 0.65])
      line(
        o,
        Array.from({ length: 25 }, (_, i) => [
          x + 0.14 * Math.cos((i * TAU) / 24),
          14.87 + 0.14 * Math.sin((i * TAU) / 24),
          rr,
        ]),
        'metal',
        white,
        0.014,
      );
  }
  if (!active) {
    lathe(
      out,
      'metal',
      [
        [14.4, 0.34],
        [14.49, 0.34],
      ],
      dark,
      64,
    );
    return;
  }
  lathe(
    out,
    'metal',
    [
      [14.39, 2.49],
      [14.58, 2.49],
    ],
    white,
    128,
  );
  simpleGlass(out, 2.33, 14.6, 17.17, 32, white);
  // Diamond glazing, two diagonal directions, follows the cylinder rather than straight chords.
  for (let i = 0; i < 16; i++)
    for (const sign of [-1, 1])
      line(
        out,
        Array.from({ length: 25 }, (_, j) =>
          P(2.366, 14.6 + (2.57 * j) / 24, (i * TAU) / 16 + (((sign * TAU) / 8) * j) / 24),
        ),
        'metal',
        white,
        0.028,
      );
  const dome = [
    [17.17, 2.49],
    [17.28, 2.49],
    [17.6, 1.68],
    [17.85, 0.79],
    [17.99, 0.22],
  ];
  lathe(out, 'metal', dome, white, 160);
  roofSeams(out, dome, 16, [0.72, 0.75, 0.71]);
  lathe(
    out,
    'metal',
    [
      [17.99, 0.19],
      [18.16, 0.16],
    ],
    white,
    64,
  );
  sphere(out, 'metal', [0, 18.36, 0], [0.26, 0.26, 0.26], white, 48, 24);
  tube(out, 'metal', [0, 18.52, 0], [0, 19, 0], 0.024, [0.64, 0.55, 0.3], 10);
  beam(out, 'metal', [-0.76, 18.8, 0], [0.74, 18.8, 0], 0.035, 0.035, [0.64, 0.55, 0.3]);
  const vane = [
    [-0.76, 18.8, 0],
    [-0.47, 18.95, 0],
    [-0.47, 18.65, 0],
  ];
  out.addTriangle(
    'metal',
    'palette:#fff',
    vane,
    [0, 0, 1],
    [
      [0, 0],
      [1, 1],
      [1, 0],
    ],
    [0.64, 0.55, 0.3],
  );
  out.addTriangle(
    'metal',
    'palette:#fff',
    [...vane].reverse(),
    [0, 0, -1],
    [
      [0, 0],
      [1, 1],
      [1, 0],
    ],
    [0.64, 0.55, 0.3],
  );
  box(out, 'metal', [0.3, 18.63, -0.013], [0.77, 18.99, 0.013], [0.64, 0.55, 0.3]);
  lathe(
    out,
    'metal',
    [
      [14.58, 0.42],
      [15.0, 0.42],
    ],
    white,
    64,
  );
  lathe(
    out,
    'glassClear',
    [
      [15.0, 0.39],
      [15.16, 0.69],
      [15.5, 0.83],
      [16.08, 0.83],
      [16.53, 0.47],
      [16.76, 0.24],
    ],
    [0.59, 0.79, 0.65],
    96,
  );
  for (let y = 15.11; y < 16.65; y += 0.105) {
    const r = y < 15.5 ? 0.65 + (y - 15.16) * 0.53 : y < 16.08 ? 0.84 : 0.84 - (y - 16.08) * 0.69;
    ring(out, 'metal', y, r - 0.022, r + 0.012, 0.014, [0.44, 0.56, 0.43], 96);
  }
  const antenna = transformed(out, 0.6);
  for (let y = 14.52; y < 15.82; y += 0.3)
    box(antenna, 'metal', [-0.14, y, 3.4], [0.14, y + 0.17, 3.56], white);
  beam(antenna, 'metal', [0.8, 14.49, 3.45], [1.8, 15.1, 4.4], 0.045, 0.045, white);
}
function lizardChimney(out, x, z, y = 9.14) {
  box(out, 'metal', [x - 0.56, y, z - 0.42], [x + 0.56, y + 2.29, z + 0.42], dark);
  box(out, 'metal', [x - 0.64, y + 2.13, z - 0.5], [x + 0.64, y + 2.3, z + 0.5], dark);
  for (const dx of [-0.33, 0, 0.33])
    lathe(
      out,
      'metal',
      [
        [y + 2.29, 0.095],
        [y + 2.8, 0.092],
        [y + 2.85, 0.12],
      ],
      dark,
      32,
      [x + dx, z],
    );
}
export function buildLizard(out) {
  lizardTower(out, true);
  lizardTower(transformed(out, 0, [-67.95, 0, 2.82]), false);
  const windows = [];
  for (const face of [0, 2])
    for (const y of [1.05, 4.69])
      for (let i = 0; i < 11; i++)
        windows.push({ face, x: -25.2 + i * 5.1, y, w: 1.36, h: 1.56, depth: 0.26 });
  lizardHouse(out, { x0: -63.9, x1: -3.37, z0: 0.18, z1: 9.16, eave: 7.43, rise: 1.52, windows });
  // Projecting end bays of the keeper range have street-facing gables and hooded paired windows.
  for (const [cx, z] of [
    [-59.18, 10.77],
    [-8.2, 10.32],
  ]) {
    const o = transformed(out, Math.PI / 2, [cx, 0, z]);
    lizardHouse(o, {
      x0: -2.82,
      x1: 2.82,
      z0: -2.7,
      z1: 2.7,
      eave: 7.83,
      rise: 1.13,
      gable: true,
      windows: [
        { face: 3, x: 0, y: 1.0, w: 1.3, h: 1.64 },
        { face: 3, x: 0, y: 4.77, w: 1.3, h: 1.5 },
        { face: 0, x: 0, y: 4.72, w: 1.16, h: 1.45 },
        { face: 2, x: 0, y: 4.72, w: 1.16, h: 1.45 },
      ],
    });
  }
  for (const x of [-58, -48, -38, -28, -18, -8]) lizardChimney(out, x, 4.67, 9.14);
  // Individually mapped rear outshuts and hipped service wings.
  for (const [x0, x1, z0, z1] of [
    [-60.02, -55.87, -7.63, 1.75],
    [-53.97, -49.6, -7.87, 1.97],
    [-48.05, -43.73, -9.96, 0.04],
    [-39.58, -34.77, -11.05, 0.11],
    [-30.05, -25.47, -7.83, 0.25],
    [-16.43, -12.93, -8.54, 0.22],
    [-8.86, -4.61, -8.9, 0.21],
  ]) {
    const half = (z1 - z0) / 2;
    lizardHouse(out, {
      x0,
      x1,
      z0,
      z1,
      eave: 3.24,
      rise: 1.25,
      windows: [
        { face: 2, x: 0, y: 0.55, w: 0.98, h: 1.62, door: true },
        ...[1, 3].flatMap((face) =>
          [-half * 0.52, half * 0.52].map((x) => ({ face, x, y: 0.87, w: 0.83, h: 1.27 })),
        ),
      ],
    });
  }
  lizardHouse(out, {
    x0: -51.89,
    x1: -41.2,
    z0: -15.48,
    z1: -9.96,
    eave: 3.4,
    rise: 1.42,
    windows: [
      ...[-3.5, 0, 3.5].map((x) => ({ face: 2, x, y: 0.8, w: 1.05, h: 1.45 })),
      { face: 1, x: 0, y: 0.36, w: 1.17, h: 2.19, door: true },
    ],
  });
  // Covered center passage reaches the engine house without inventing a filled courtyard.
  lizardHouse(out, {
    x0: -34.77,
    x1: -32.66,
    z0: 9.16,
    z1: 23.12,
    eave: 3.28,
    rise: 0.54,
    windows: [
      ...[1, 3].flatMap((face) => [-4, 0, 4].map((x) => ({ face, x, y: 0.84, w: 0.84, h: 1.53 }))),
    ],
  });
  const ew = [];
  for (const face of [0, 2])
    for (const x of [-11.4, -7.7, -3.85, 0, 3.85, 7.7, 11.4])
      ew.push({ face, x, y: 0.74, w: 1.29, h: 1.88 });
  for (const face of [1, 3])
    for (const x of [-2.7, 0, 2.7])
      ew.push({ face, x, y: x === 0 ? 0.3 : 0.84, w: 1.1, h: x === 0 ? 2.55 : 1.8, door: x === 0 });
  lizardHouse(out, {
    x0: -47.42,
    x1: -18.88,
    z0: 23.12,
    z1: 33.1,
    eave: 4.89,
    rise: 2.59,
    gable: true,
    windows: ew,
  });
  for (const x of [-41, -26]) lizardChimney(out, x, 28.11, 7.65);
  // South semicircular fog-signal bay, with the black flared trumpet visible in operator views.
  const bay = transformed(out, 0, [-33.01, 0, 33.1]);
  const bayHoles = [-0.88, 0, 0.88].map((angle) => ({
    angle,
    y: 0.84,
    w: 1.2,
    h: 1.79,
    depth: 0.2,
    trimSlot: 'plaster',
    trimColor: white,
  }));
  shell(bay, {
    profile: [
      [0.02, 3.46],
      [3.64, 3.46],
    ],
    holes: bayHoles,
    slot: 'plaster',
    color: lWall,
    segments: 128,
  });
  for (const h of bayHoles)
    framedWindow(transformed(bay, h.angle), h, Math.sqrt(3.46 ** 2 - 0.6 ** 2), white, {
      hood: true,
      greenSill: true,
    });
  for (let i = 0; i < 48; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 48,
      b = -Math.PI / 2 + ((i + 1) * Math.PI) / 48;
    roofFace(
      bay,
      'plaster',
      [P(3.55, 3.38, a), P(3.55, 3.38, b), P(3.55, 3.64, b), P(3.55, 3.64, a)],
      white,
    );
    roofFace(
      bay,
      'plaster',
      [P(3.46, 3.64, a), P(3.55, 3.64, a), P(3.55, 3.64, b), P(3.46, 3.64, b)],
      white,
    );
    bay.addTriangle(
      'metal',
      'palette:#fff',
      [P(3.48, 3.65, a), P(3.48, 3.65, b), [0, 3.65, 0]],
      [0, 1, 0],
      [
        [3.48 * Math.sin(a), 3.48 * Math.cos(a)],
        [3.48 * Math.sin(b), 3.48 * Math.cos(b)],
        [0, 0],
      ],
      lSlate,
    );
  }
  for (const x of [-1.15, 1.15])
    beam(bay, 'metal', [x, 3.62, -0.1], [0, 7.09, 0.14], 0.12, 0.12, dark);
  beam(bay, 'metal', [-1.08, 3.63, -0.8], [0, 7.09, 0.14], 0.12, 0.12, dark);
  // Axial loft along+Z, with open black horn mouth and visible annular rim.
  const hornRings = [
    [0.02, 0.3],
    [0.55, 0.31],
    [0.95, 0.47],
    [1.32, 0.79],
    [1.5, 0.95],
  ].map(([z, r]) =>
    Array.from({ length: 64 }, (_, i) => [
      r * Math.cos((i * TAU) / 64),
      7.12 + r * Math.sin((i * TAU) / 64),
      z,
    ]),
  );
  for (let j = 1; j < hornRings.length; j++)
    for (let i = 0; i < 64; i++) {
      const k = (i + 1) % 64;
      roofFace(
        bay,
        'metal',
        [hornRings[j - 1][i], hornRings[j - 1][k], hornRings[j][k], hornRings[j][i]],
        dark,
      );
    }
  const circle = Array.from({ length: 65 }, (_, i) => [
    0.95 * Math.cos((i * TAU) / 64),
    7.12 + 0.95 * Math.sin((i * TAU) / 64),
    1.5,
  ]);
  line(bay, circle, 'metal', [0.045, 0.05, 0.048], 0.055);
  sphere(bay, 'metal', [0, 7.12, 1.2], [0.84, 0.84, 0.07], [0.01, 0.012, 0.012], 64, 24);
  // Finite site wall sections and gated entrances; the cliff itself is supplied by terrain.
  box(out, 'plaster', [-72, 0.03, 42.2], [7, 1.15, 42.65], white);
  box(out, 'plaster', [-72, 0.03, 4.5], [-71.55, 1.15, 42.65], white);
  box(out, 'plaster', [6.55, 0.03, -10], [7, 1.15, 42.65], white);
  for (const x of [-72, 6.55])
    for (let z = 6; z < 43; z += 7.3)
      box(out, 'plaster', [x - 0.09, 0.02, z - 0.2], [x + 0.53, 1.35, z + 0.2], white);
}
lighthouseKullenLizardStudies.push(
  lighthouseStudy({
    id: 'N0680',
    key: 'lizard_lighthouse',
    title: 'Lizard Lighthouse',
    wikidataId: 'Q1866643',
    build: buildLizard,
    metricTriangleUv: true,
    size: [82, 19, 59],
    visualBrief:
      'Twin white octagonal towers with only the eastern tower carrying a diamond-glazed lantern, active optic and weather vane; hooded windows, long two-storey keeper range, projecting gable bays, six tall black chimney stacks, individual rear outshuts, covered engine-room corridor, gabled engine house and semicircular foghorn bay.',
    sourceFacts: {
      activeHeightMeters: 19,
      towerCenterSeparationMeters: 68.01,
      focalElevationMeters: 70,
      keeperRangeLengthMeters: 60.53,
      engineHousePlanMeters: [28.54, 9.98],
      basis:
        'Trinity House publishes19m tower height and identifies the active eastern lantern, twin1752towers and engine house. Historic England listing1328497 describes octagonal towers, hooded windows, projecting end gables, six tall black chimneys, slate roofs and rear service wings. Exact OSM building parts fix tower centers, active diameter, keeper range/outshut and engine-room footprints; remaining vertical dimensions and small detail are photo-proportioned.',
    },
    referencePages: [
      'https://www.trinityhouse.co.uk/lighthouses-and-lightvessels/lizard-lighthouse',
      'https://www.trinityhouse.co.uk/lighthouse-cottage-rental/lizard-holiday-cottages',
      'https://historicengland.org.uk/listing/the-list/list-entry/1328497',
      'https://www.trinityhouse.co.uk/asset/970/view/1400',
      'https://www.trinityhouse.co.uk/asset/1624/view/1400',
      'https://www.trinityhouse.co.uk/asset/4418/view/1400',
      'https://www.openstreetmap.org/way/65369068',
      'https://www.openstreetmap.org/way/814270620',
      'https://www.openstreetmap.org/way/814270621',
      'https://www.openstreetmap.org/way/846164579',
      'https://www.openstreetmap.org/way/846164580',
    ],
    geographicProposal: {
      anchor: [-5.20211360017, 49.96020745193],
      heading: 0.162,
      elevationMode: 'terrain-contact',
      groundModelY: 0,
      status: 'preview-proposal',
      source: 'https://www.openstreetmap.org/way/814270621',
      notes:
        'Origin is the mapped active eastern-tower polygon centroid. Native+X runs along the long keeper range east/slightly north; native+Z faces the southern engine room and coast. Exact tower and engine-house parts remove the180degree ambiguity. The western tower is offset[-67.95,0,2.82]m; the source uses ordinary common station-grade contact and does not mistake70m focal elevation for model height.',
    },
    limitations: [
      'The current exterior is reconstructed from operator photographs and heritage description. Service-wing roof ridges, small joinery and chimney pots are photograph-based dimensions. Fine lens prisms and weather-vane contours are original geometric approximations. Garden walls use the published station layout rather than cadastral wall surveys; detached hostel, coastal terrain and temporary furniture remain map context.',
    ],
    previewCamera: { position: [57, 38, 80], lookAt: [-30, 7, 12], fov: 45 },
    qaCameras: [
      { name: 'near-active-lantern', position: [10, 17, 11], lookAt: [0, 16, 0] },
      { name: 'near-east-tower', position: [16, 8, 18], lookAt: [-3, 7, 1] },
      { name: 'near-keeper-range', position: [-28, 13, 30], lookAt: [-34, 5, 5] },
      { name: 'near-engine-foghorn', position: [-16, 10, 53], lookAt: [-33, 5, 30] },
      { name: 'near-west-tower', position: [-80, 14, 21], lookAt: [-63, 9, 5] },
      { name: 'far-ensemble', position: [58, 70, 112], lookAt: [-33, 5, 11] },
    ],
  }),
);
