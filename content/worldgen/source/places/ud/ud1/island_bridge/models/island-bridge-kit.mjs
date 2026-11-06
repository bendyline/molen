import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
export const componentControls = [
  {
    id: 'island_bridge_main_road',
    title: 'Island Bridge — main Daugava roadway',
    anchor: [24.123876366, 56.93517095],
    heading: 0.851669109885,
    datum: 5,
    foundationY: -5,
    crown: 0.32,
    boxDepth: 2.65,
    haunch: 0.58,
    pierTopOffset: 3.3,
    halfWidth: 13.7095,
    roadHalfWidth: 11.95,
    galleryInner: 10.35,
    galleryDrop: 3.55,
    deckHeights: [8.6, 8.6],
    piers: [-209, -125.4, -41.8, 41.8, 125.4, 209],
    ends: [-277.866, 277.866],
    center: [0, 0],
    part: 'road',
    maskHalfWidth: 7.4,
    originY: 0,
    maskEndInset: 2,
  },
  {
    id: 'island_bridge_main_gallery_nw',
    title: 'Island Bridge — main Daugava northwest lower gallery',
    anchor: [24.123876366, 56.93517095],
    heading: 0.851669109885,
    datum: 5,
    foundationY: -5,
    crown: 0.32,
    boxDepth: 2.65,
    haunch: 0.58,
    pierTopOffset: 3.3,
    halfWidth: 13.7095,
    roadHalfWidth: 11.95,
    galleryInner: 10.35,
    galleryDrop: 3.55,
    deckHeights: [8.6, 8.6],
    piers: [-209, -125.4, -41.8, 41.8, 125.4, 209],
    ends: [-271.22, 271.05],
    center: [-0.085, -12.005],
    part: 'gallery',
    side: -1,
    originY: 4.81,
  },
  {
    id: 'island_bridge_main_gallery_se',
    title: 'Island Bridge — main Daugava southeast lower gallery',
    anchor: [24.123876366, 56.93517095],
    heading: 0.851669109885,
    datum: 5,
    foundationY: -5,
    crown: 0.32,
    boxDepth: 2.65,
    haunch: 0.58,
    pierTopOffset: 3.3,
    halfWidth: 13.7095,
    roadHalfWidth: 11.95,
    galleryInner: 10.35,
    galleryDrop: 3.55,
    deckHeights: [8.6, 8.6],
    piers: [-209, -125.4, -41.8, 41.8, 125.4, 209],
    ends: [-271.22, 271.05],
    center: [-0.085, 12.005],
    part: 'gallery',
    side: 1,
    originY: 4.81,
  },
  {
    id: 'island_bridge_small_daugava_road',
    title: 'Island Bridge — Small Daugava roadway',
    anchor: [24.123876366, 56.93517095],
    heading: 0.851669109885,
    datum: 5,
    foundationY: -5,
    crown: 0.15,
    boxDepth: 2.55,
    haunch: 0.65,
    pierTopOffset: 3.3,
    halfWidth: 11.7,
    roadHalfWidth: 10.2,
    galleryInner: 8.9,
    galleryDrop: 3.55,
    deckHeights: [7.3, 7.6],
    piers: [-671.2, -542.9],
    ends: [-719.8, -494.4],
    center: [-607.1, 0],
    part: 'road',
    maskHalfWidth: 7.4,
    originY: 0,
    maskEndInset: 2,
  },
  {
    id: 'island_bridge_small_gallery_nw',
    title: 'Island Bridge — Small Daugava northwest lower gallery',
    anchor: [24.123876366, 56.93517095],
    heading: 0.851669109885,
    datum: 5,
    foundationY: -5,
    crown: 0.15,
    boxDepth: 2.55,
    haunch: 0.65,
    pierTopOffset: 3.3,
    halfWidth: 11.7,
    roadHalfWidth: 10.2,
    galleryInner: 8.9,
    galleryDrop: 3.55,
    deckHeights: [7.3, 7.6],
    piers: [-671.2, -542.9],
    ends: [-709.14, -501.32],
    center: [-605.23, -10.275],
    part: 'gallery',
    side: -1,
    originY: 3.51,
  },
  {
    id: 'island_bridge_small_gallery_se',
    title: 'Island Bridge — Small Daugava southeast lower gallery',
    anchor: [24.123876366, 56.93517095],
    heading: 0.851669109885,
    datum: 5,
    foundationY: -5,
    crown: 0.15,
    boxDepth: 2.55,
    haunch: 0.65,
    pierTopOffset: 3.3,
    halfWidth: 11.7,
    roadHalfWidth: 10.2,
    galleryInner: 8.9,
    galleryDrop: 3.55,
    deckHeights: [7.3, 7.6],
    piers: [-671.2, -542.9],
    ends: [-709.14, -501.32],
    center: [-605.23, 10.275],
    part: 'gallery',
    side: 1,
    originY: 3.51,
  },
  {
    id: 'island_bridge_biekengravis',
    title: 'Island Bridge — Biekengravis crossing',
    anchor: [24.123876366, 56.93517095],
    heading: 0.851669109885,
    datum: 5,
    foundationY: -5,
    crown: 0.07,
    boxDepth: 1.15,
    haunch: 0.15,
    pierTopOffset: 1.7,
    halfWidth: 13.7095,
    roadHalfWidth: 11.95,
    galleryInner: 10.35,
    galleryDrop: 3.55,
    deckHeights: [3.6, 3.5],
    piers: [-978.25, -956.56],
    ends: [-999.95, -934.87],
    center: [-967.41, 0],
    part: 'road',
    pierMaterial: 'concrete',
    upperWalks: false,
    extraWalks: [],
    originY: 0,
    maskHalfWidth: 7.4,
    maskEndInset: 2,
  },
  {
    id: 'island_bridge_left_bank_viaduct',
    title: 'Island Bridge — left-bank viaduct',
    anchor: [24.123876366, 56.93517095],
    heading: 0.851669109885,
    datum: 5,
    foundationY: -5,
    crown: 0.07,
    boxDepth: 1.15,
    haunch: 0.15,
    pierTopOffset: 1.7,
    halfWidth: 14.5,
    roadHalfWidth: 11.95,
    galleryInner: 10.35,
    galleryDrop: 3.55,
    deckHeights: [6.8, 6.3],
    piers: [
      -1920, -1880, -1847, -1800, -1760, -1720, -1669, -1636, -1600, -1560, -1520, -1480, -1440,
      -1400, -1366,
    ],
    ends: [-1958.35, -1315.27],
    center: [-1636.81, 0],
    part: 'road',
    pierMaterial: 'concrete',
    upperWalks: true,
    originY: 0,
    maskEndInset: 2,
    endLip: 0.5,
  },
  {
    id: 'island_bridge_right_bank_viaduct',
    title: 'Island Bridge — right-bank railway viaduct',
    anchor: [24.123876366, 56.93517095],
    heading: 0.851669109885,
    datum: 5,
    foundationY: -5,
    crown: 0.07,
    boxDepth: 1.15,
    haunch: 0.15,
    pierTopOffset: 1.7,
    halfWidth: 13.7095,
    roadHalfWidth: 11.95,
    galleryInner: 10.35,
    galleryDrop: 3.55,
    deckHeights: [7.5, 7.2],
    piers: [349, 396],
    ends: [342.6, 402.1],
    center: [372.35, -5.2],
    part: 'road',
    pierMaterial: 'concrete',
    upperWalks: false,
    extraWalks: [],
    curveZ: [
      [342.6, -5.2],
      [372.35, -5.9],
      [402.1, -5.8],
    ],
    originY: 0,
    maskHalfWidth: 9.4,
    maskEndInset: 2,
    edgeOpenings: [
      {
        side: -1,
        start: 390,
        end: 403,
      },
    ],
  },
  {
    id: 'island_bridge_right_bank_east_viaduct',
    title: 'Island Bridge — right-bank eastern crossing',
    anchor: [24.123876366, 56.93517095],
    heading: 0.851669109885,
    datum: 5,
    foundationY: -5,
    crown: 0.07,
    boxDepth: 1.15,
    haunch: 0.15,
    pierTopOffset: 1.7,
    halfWidth: 14.1,
    roadHalfWidth: 11.8,
    galleryInner: 10.35,
    galleryDrop: 3.55,
    deckHeights: [7, 6.9],
    piers: [],
    ends: [510.2, 537.8],
    center: [523.96, -33.7],
    part: 'road',
    pierMaterial: 'concrete',
    upperWalks: false,
    curveZ: [
      [510.2, -33.7],
      [537.8, -33.7],
    ],
    originY: 0,
    maskHalfWidth: 9.4,
    skew: 0.14,
    abutmentDepth: 0.6,
    maskEndInset: 2,
  },
  {
    id: 'island_bridge_biekengravis_walk_se',
    title: 'Island Bridge — Biekengravis crossing — southeast footbridge',
    anchor: [24.123876366, 56.93517095],
    heading: 0.851669109885,
    datum: 5,
    foundationY: -5,
    crown: 0.07,
    boxDepth: 1.15,
    haunch: 0.15,
    pierTopOffset: 1.7,
    halfWidth: 1.12,
    roadHalfWidth: 1.12,
    galleryInner: 10.35,
    galleryDrop: 3.55,
    deckHeights: [3.7406153034548426, 3.6399766550079176],
    piers: [-978.25, -956.56],
    ends: [-999.7263379162106, -934.8660020439033],
    center: [-967.2961699800569, 20.060883661086223],
    part: 'upper_walk',
    pierMaterial: 'concrete',
    upperWalks: false,
    extraWalks: [],
    originY: 0,
    curveZ: [
      [-999.7263379162106, 19.831663040070453],
      [-996.2931755041484, 20.290104282101993],
      [-934.8660020439033, 20.205120795133496],
    ],
    heightProfile: [
      [-999.7263379162106, 3.7406153034548426],
      [-995.6725669241914, 3.7506210730054637],
      [-991.6187959321721, 3.7584540845456114],
      [-987.565024940153, 3.7641143380752844],
      [-983.5112539481338, 3.767601833594484],
      [-979.4574829561145, 3.76891657110321],
      [-975.4037119640954, 3.7680585506014617],
      [-971.3499409720762, 3.76502777208924],
      [-967.2961699800569, 3.7598242355665437],
      [-963.2423989880377, 3.7524479410333744],
      [-959.1886279960186, 3.7428988884897305],
      [-955.1348570039994, 3.7311770779356133],
      [-951.0810860119801, 3.7172825093710213],
      [-947.027315019961, 3.701215182795956],
      [-942.9735440279418, 3.6829750982104175],
      [-938.9197730359225, 3.6625622556144037],
      [-934.8660020439033, 3.6399766550079176],
    ],
    maskHalfWidth: 1.14,
  },
  {
    id: 'island_bridge_biekengravis_walk_nw',
    title: 'Island Bridge — Biekengravis crossing — northwest footbridge',
    anchor: [24.123876366, 56.93517095],
    heading: 0.851669109885,
    datum: 5,
    foundationY: -5,
    crown: 0.07,
    boxDepth: 1.15,
    haunch: 0.15,
    pierTopOffset: 1.7,
    halfWidth: 1.12,
    roadHalfWidth: 1.12,
    galleryInner: 10.35,
    galleryDrop: 3.55,
    deckHeights: [3.740002160801816, 3.640384938198305],
    piers: [-978.25, -956.56],
    ends: [-999.9492187355099, -934.9359750131565],
    center: [-967.4425968743333, -20.341951775566542],
    part: 'upper_walk',
    pierMaterial: 'concrete',
    upperWalks: false,
    extraWalks: [],
    originY: 0,
    curveZ: [
      [-999.9492187355099, -20.24522705867315],
      [-934.9359750131565, -20.438676492459933],
    ],
    heightProfile: [
      [-999.9492187355099, 3.740002160801816],
      [-995.8858910028629, 3.7501486939937316],
      [-991.8225632702157, 3.758112212571697],
      [-987.7592355375687, 3.7638927165357106],
      [-983.6959078049216, 3.767490205885772],
      [-979.6325800722744, 3.768904680621883],
      [-975.5692523396274, 3.768136140744042],
      [-971.5059246069803, 3.7651845862522495],
      [-967.4425968743333, 3.760050017146506],
      [-963.3792691416861, 3.752732433426811],
      [-959.315941409039, 3.743231835093164],
      [-955.252613676392, 3.7315482221455665],
      [-951.1892859437448, 3.717681594584017],
      [-947.1259582110978, 3.701631952408516],
      [-943.0626304784507, 3.6833992956190635],
      [-938.9993027458036, 3.6629836242156597],
      [-934.9359750131565, 3.640384938198305],
    ],
    maskHalfWidth: 1.14,
  },
  {
    id: 'island_bridge_right_bank_walk_nw',
    title: 'Island Bridge — right-bank railway viaduct — northwest footbridge',
    anchor: [24.123876366, 56.93517095],
    heading: 0.851669109885,
    datum: 5,
    foundationY: -5,
    crown: 0.07,
    boxDepth: 1.15,
    haunch: 0.15,
    pierTopOffset: 1.7,
    halfWidth: 1.12,
    roadHalfWidth: 1.12,
    galleryInner: 10.35,
    galleryDrop: 3.55,
    deckHeights: [7.6400085107965, 7.442138815991946],
    piers: [349, 387],
    ends: [342.5745277127844, 390.53719102578145],
    center: [366.5558593692829, -22.350671256626768],
    part: 'upper_walk',
    pierMaterial: 'concrete',
    upperWalks: false,
    extraWalks: [],
    curveZ: [
      [342.5745277127844, -20.19133423003882],
      [390.53719102578145, -24.510008283214717],
    ],
    originY: 0,
    heightProfile: [
      [342.5745277127844, 7.6400085107965],
      [345.57219416984674, 7.638302262904192],
      [348.569860626909, 7.635174600607487],
      [351.56752708397136, 7.630625523906385],
      [354.56519354103364, 7.624655032800887],
      [357.562859998096, 7.617263127290991],
      [360.5605264551583, 7.608449807376699],
      [363.5581929122206, 7.598215073058009],
      [366.5558593692829, 7.586558924334923],
      [369.55352582634526, 7.57348136120744],
      [372.55119228340754, 7.55898238367556],
      [375.5488587404699, 7.543061991739283],
      [378.5465251975322, 7.525720185398609],
      [381.5441916545945, 7.506956964653539],
      [384.54185811165684, 7.486772329504071],
      [387.5395245687191, 7.465166279950208],
      [390.53719102578145, 7.442138815991946],
    ],
    maskHalfWidth: 1.14,
  },
  {
    id: 'island_bridge_right_bank_walk_se',
    title: 'Island Bridge — right-bank railway viaduct — southeast footbridge',
    anchor: [24.123876366, 56.93517095],
    heading: 0.851669109885,
    datum: 5,
    foundationY: -5,
    crown: 0.07,
    boxDepth: 1.15,
    haunch: 0.15,
    pierTopOffset: 1.7,
    halfWidth: 1.12,
    roadHalfWidth: 1.12,
    galleryInner: 10.35,
    galleryDrop: 3.55,
    deckHeights: [7.626079474141747, 7.340114199778905],
    piers: [357, 396],
    ends: [353.91089497652746, 402.0882835640616],
    center: [377.99958927029456, 13.964541749819787],
    part: 'upper_walk',
    pierMaterial: 'concrete',
    upperWalks: false,
    extraWalks: [],
    curveZ: [
      [353.91089497652746, 16.00136116128698],
      [402.0882835640616, 11.927722338352595],
    ],
    originY: 0,
    heightProfile: [
      [353.91089497652746, 7.626079474141747],
      [356.92198176324837, 7.61896291969387],
      [359.9330685499692, 7.610412195219353],
      [362.94415533669013, 7.600427300718196],
      [365.955242123411, 7.5890082361903985],
      [368.9663289101319, 7.576155001635962],
      [371.97741569685274, 7.561867597054883],
      [374.98850248357365, 7.546146022447165],
      [377.99958927029456, 7.528990277812808],
      [381.0106760570154, 7.510400363151811],
      [384.0217628437363, 7.490376278464173],
      [387.0328496304572, 7.468918023749896],
      [390.0439364171781, 7.446025599008977],
      [393.05502320389894, 7.42169900424142],
      [396.06610999061985, 7.395938239447221],
      [399.07719677734076, 7.368743304626383],
      [402.0882835640616, 7.340114199778905],
    ],
    maskHalfWidth: 1.14,
  },
];
const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const srgb = (hex) =>
  [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
const palette = {
  concrete: { slot: 'wall', graph: 'concrete_plain', rgb: srgb('#b2b0a1') },
  stone: { slot: 'wall', graph: 'stone_granite', rgb: srgb('#9c9a8d') },
  road: { slot: 'foundation', graph: 'concrete_plain', rgb: srgb('#727978') },
  walk: { slot: 'foundation', graph: 'concrete_plain', rgb: srgb('#a4a694') },
  paintWall: { slot: 'wall', graph: 'concrete_plain', rgb: srgb('#9b6c5e') },
  metal: { slot: 'trim', graph: 'metal_painted', rgb: srgb('#666e68') },
  mark: { slot: 'foundation', graph: 'concrete_plain', rgb: srgb('#dfdecb') },
};
export const bridgeSurfaces = Object.fromEntries(
  Object.entries(palette).map(([k, { rgb, ...s }]) => [k, s]),
);

export function buildIslandComponent(target, level, id) {
  const control = componentControls.find((c) => c.id === id);
  if (!control) throw Error('Unknown Island Bridge component ' + id);
  const C = control,
    t = tiers[level];
  const interpolate = (ps, x) => {
    for (let i = 1; i < ps.length; i++)
      if (x <= ps[i][0]) {
        const a = ps[i - 1],
          b = ps[i],
          u = Math.max(0, Math.min(1, (x - a[0]) / (b[0] - a[0])));
        return a[1] + u * (b[1] - a[1]);
      }
    return ps.at(-1)[1];
  };
  const bend = (x) => (C.curveZ ? interpolate(C.curveZ, x) : 0),
    transform = (p) => [
      p[0] + (C.skew ?? 0) * p[2] - C.center[0],
      p[1] - C.originY,
      p[2] + bend(p[0]) - C.center[1],
    ],
    o = {
      addConvexPolygon: (m, r, p, n, uv, c) =>
        target.addConvexPolygon(m, r, p.map(transform), normalFor(...p.map(transform)), uv, c),
      addQuad: (m, r, p, n, uv, c) =>
        target.addQuad(m, r, p.map(transform), normalFor(...p.map(transform)), uv, c),
      addTriangle: (m, r, p, n, uv, c) =>
        target.addTriangle(m, r, p.map(transform), normalFor(...p.map(transform)), uv, c),
    };
  const deckY = (x) => {
      if (C.heightProfile) return interpolate(C.heightProfile, x);
      const u = Math.max(0, Math.min(1, (x - C.ends[0]) / (C.ends[1] - C.ends[0])));
      return (
        C.deckHeights[0] + u * (C.deckHeights[1] - C.deckHeights[0]) + C.crown * 4 * u * (1 - u)
      );
    },
    galleryY = (x) => deckY(x) - C.galleryDrop;
  function face(o, m, p, n, tint = 1) {
    let N = normalFor(...p);
    if (N.reduce((s, v, i) => s + v * n[i], 0) < 0) {
      p = p.toReversed();
      N = normalFor(...p);
    }
    o[p.length === 3 ? 'addTriangle' : 'addQuad'](
      m,
      'palette:#ffffff',
      p,
      N,
      undefined,
      palette[m].rgb.map((c) => c * tint),
    );
  }
  const rod = (o, m, a, b, w, d = w) => beam(o, m, a, b, w, d, palette[m].rgb);
  function prism(o, m, x0, x1, z0, z1, y0, y1) {
    const a = [x0, y0, z0],
      b = [x1, y0, z0],
      c = [x1, y0, z1],
      d = [x0, y0, z1],
      A = [x0, y1, z0],
      B = [x1, y1, z0],
      C = [x1, y1, z1],
      D = [x0, y1, z1];
    for (const [p, n] of [
      [
        [a, b, c, d],
        [0, -1, 0],
      ],
      [
        [A, B, C, D],
        [0, 1, 0],
      ],
      [
        [a, A, B, b],
        [0, 0, -1],
      ],
      [
        [d, c, C, D],
        [0, 0, 1],
      ],
      [
        [a, d, D, A],
        [-1, 0, 0],
      ],
      [
        [b, B, C, c],
        [1, 0, 0],
      ],
    ])
      face(o, m, p, n);
  }
  function strip(o, m, a, b, z, Z, low, high) {
    const y = deckY(a),
      Y = deckY(b);
    face(
      o,
      m,
      [
        [a, y + high, z],
        [b, Y + high, z],
        [b, Y + high, Z],
        [a, y + high, Z],
      ],
      [0, 1, 0],
    );
    face(
      o,
      m,
      [
        [a, y + low, z],
        [b, Y + low, z],
        [b, Y + low, Z],
        [a, y + low, Z],
      ],
      [0, -1, 0],
    );
    for (const [q, n] of [
      [z, -1],
      [Z, 1],
    ])
      face(
        o,
        m,
        [
          [a, y + low, q],
          [b, Y + low, q],
          [b, Y + high, q],
          [a, y + high, q],
        ],
        [0, 0, n],
      );
    for (const [x, h, n] of [
      [a, y, -1],
      [b, Y, 1],
    ])
      face(
        o,
        m,
        [
          [x, h + low, z],
          [x, h + low, Z],
          [x, h + high, Z],
          [x, h + high, z],
        ],
        [n, 0, 0],
      );
  }
  function roadAndBox(o, t) {
    const C = control,
      xs = [
        ...new Set([
          ...C.ends,
          ...(t < 2 && C.boxDepth < 2 ? [] : C.piers),
          (C.ends[0] + C.ends[1]) / 2,
          ...Array.from(
            { length: [1, 4, 24, 40, 56][t] },
            (_, i) => C.ends[0] + ((i + 1) / ([1, 4, 24, 40, 56][t] + 1)) * (C.ends[1] - C.ends[0]),
          ),
        ]),
      ].sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) {
      const a = xs[i - 1],
        b = xs[i];
      strip(o, 'concrete', a, b, -C.halfWidth, C.halfWidth, -0.46, -0.08);
      strip(o, 'road', a, b, -C.roadHalfWidth, C.roadHalfWidth, -0.08, 0);
      if (t > 0) strip(o, 'concrete', a, b, -0.4, 0.4, 0, 0.26);
      for (const s of [-1, 1]) {
        if (C.edgeOpenings?.some((q) => q.side === s && a < q.end && b > q.start)) continue;
        const z = s * (C.upperWalks ? C.roadHalfWidth + 0.07 : C.halfWidth - 0.28),
          curb = C.upperWalks ? 0.07 : 0.14;
        strip(
          o,
          'concrete',
          a,
          b,
          Math.min(z - s * curb, z + s * curb),
          Math.max(z - s * curb, z + s * curb),
          -0.08,
          0.18,
        );
      }
      const bottom = (x) => {
        const d = Math.min(...C.piers.map((p) => Math.abs(p - x)));
        return -C.boxDepth - C.haunch * Math.max(0, 1 - d / 30);
      };
      for (const side of [-1, 1]) {
        const z = side * (C.galleryInner - 0.13);
        face(
          o,
          'concrete',
          [
            [a, deckY(a) - 0.45, z],
            [b, deckY(b) - 0.45, z],
            [b, deckY(b) + bottom(b), z],
            [a, deckY(a) + bottom(a), z],
          ],
          [0, 0, side],
        );
      }
      face(
        o,
        'concrete',
        [
          [a, deckY(a) + bottom(a), -(C.galleryInner - 0.13)],
          [b, deckY(b) + bottom(b), -(C.galleryInner - 0.13)],
          [b, deckY(b) + bottom(b), C.galleryInner - 0.13],
          [a, deckY(a) + bottom(a), C.galleryInner - 0.13],
        ],
        [0, -1, 0],
      );
    }
    for (const x of C.ends)
      face(
        o,
        'concrete',
        [
          [x, deckY(x) - 0.45, -(C.galleryInner - 0.13)],
          [x, deckY(x) - 0.45, C.galleryInner - 0.13],
          [x, deckY(x) - C.boxDepth, C.galleryInner - 0.13],
          [x, deckY(x) - C.boxDepth, -(C.galleryInner - 0.13)],
        ],
        [Math.sign(x), 0, 0],
      );
    if (C.endLip)
      for (const x of C.ends) {
        const a = x === C.ends[0] ? x - C.endLip : x,
          b = x === C.ends[0] ? x : x + C.endLip;
        strip(o, 'concrete', a, b, -C.halfWidth, C.halfWidth, -0.46, 0);
      }
    // Source-level bridge hardware is sparse and shared; no individual asphalt texture.
    if (t > 0) {
      for (let x = C.ends[0] + 3; x < C.ends[1] - 3; x += 9)
        for (const z of [-7.9, -3.9, 3.9, 7.9])
          face(
            o,
            'mark',
            [
              [x, deckY(x) + 0.006, z],
              [x + 3, deckY(x + 3) + 0.006, z],
              [x + 3, deckY(x + 3) + 0.006, z + 0.11],
              [x, deckY(x) + 0.006, z + 0.11],
            ],
            [0, 1, 0],
          );
    }
  }
  function portalPiers(o, t) {
    const C = control;
    for (const x of C.piers) {
      const top = deckY(x) - C.pierTopOffset,
        base = C.foundationY;
      if (t > 0)
        prism(o, C.pierMaterial ?? 'stone', x - 2.5, x + 2.5, -12.2, 12.2, base, base + 0.65);
      for (const s of [-1, 1]) {
        const za = s * 9.35,
          zb = s * 11.7,
          z0 = Math.min(za, zb),
          z1 = Math.max(za, zb);
        prism(o, C.pierMaterial ?? 'stone', x - 2, x + 2, z0, z1, base + 0.65, top - 0.8);
      }
      prism(o, 'concrete', x - 2, x + 2, -11.7, 11.7, top - 0.8, top + 0.25);
      // Broad battered exterior legs remain open across the central pier portal.
      for (const s of [-1, 1]) {
        const z = s * 11.75,
          p = [
            [x - 2.5, base + 0.65, z],
            [x + 2.5, base + 0.65, z],
            [x + 1.8, top - 0.8, s * 11.45],
            [x - 1.8, top - 0.8, s * 11.45],
          ];
        face(o, C.pierMaterial ?? 'stone', p, [0, 0, s]);
      }
      if (t > 1)
        for (let y = base + 1.2; y < top - 0.9; y += 0.72)
          for (const s of [-1, 1])
            rod(o, 'concrete', [x - 1.93, y, s * 11.71], [x + 1.93, y, s * 11.71], 0.022, 0.022);
      if (t > 0)
        for (const z of t === 1 ? [-8, 8] : [-8, -2, 2, 8])
          prism(o, 'metal', x - 0.8, x + 0.8, z - 0.4, z + 0.4, top + 0.25, top + 0.4);
    }
  }
  function gallery(o, t, side) {
    const C = control,
      w = C.halfWidth,
      z0 = side * C.galleryInner,
      z1 = side * (w - 0.05),
      inner = Math.min(z0, z1),
      outer = Math.max(z0, z1),
      n = [2, 4, 24, 40, 56][t];
    for (let i = 0; i < n; i++) {
      const a = C.ends[0] + (i / n) * (C.ends[1] - C.ends[0]),
        b = C.ends[0] + ((i + 1) / n) * (C.ends[1] - C.ends[0]);
      strip(o, 'walk', a, b, inner, outer, -C.galleryDrop - 0.24, -C.galleryDrop);
      strip(o, 'concrete', a, b, inner, outer, -0.48, -0.46);
      strip(
        o,
        'paintWall',
        a,
        b,
        side > 0 ? z0 : z0 - 0.12,
        side > 0 ? z0 + 0.12 : z0,
        -C.galleryDrop,
        -0.46,
      );
      const edge = side * (w - 0.18);
      strip(
        o,
        'concrete',
        a,
        b,
        Math.min(edge - 0.14, edge + 0.14),
        Math.max(edge - 0.14, edge + 0.14),
        -C.galleryDrop,
        -C.galleryDrop + 0.88,
      );
      rod(
        o,
        'metal',
        [a, galleryY(a) + 1.03, edge],
        [b, galleryY(b) + 1.03, edge],
        t > 1 ? 0.055 : 0.08,
        0.055,
      );
    }
    if (t > 0) {
      const step = [0, 32, 7, 4, 3][t];
      for (let x = C.ends[0] + 1; x < C.ends[1] - 1; x += step) {
        const z = side * (w - 0.18);
        rod(o, 'metal', [x, galleryY(x) + 0.88, z], [x, galleryY(x) + 1.03, z], 0.055, 0.055);
      }
    }
    if (t > 2)
      for (let x = C.ends[0] + 5; x < C.ends[1] - 3; x += 6) {
        const z = side * (C.galleryInner + 0.035),
          y = galleryY(x);
        rod(o, 'concrete', [x, y + 0.08, z], [x, y + 2.76, z], 0.018, 0.018);
      }
  }
  function upperRails(o, t) {
    const C = control;
    for (const s of [-1, 1]) {
      const z = s * (C.halfWidth - 0.81),
        n = [2, 8, 20, 40, 56][t];
      for (let i = 0; i < n; i++) {
        const a = C.ends[0] + (i / n) * (C.ends[1] - C.ends[0]),
          b = C.ends[0] + ((i + 1) / n) * (C.ends[1] - C.ends[0]);
        if (C.edgeOpenings?.some((q) => q.side === s && a < q.end && b > q.start)) continue;
        for (const y of [0.68, 1.13])
          rod(o, 'concrete', [a, deckY(a) + y, z], [b, deckY(b) + y, z], 0.14, 0.18);
      }
      if (t > 0) {
        const step = [0, 30, 7, 3.5, 2.8][t];
        for (let x = C.ends[0] + 0.4; x < C.ends[1] - 0.4; x += step)
          if (!C.edgeOpenings?.some((q) => q.side === s && x > q.start && x < q.end))
            rod(o, 'concrete', [x, deckY(x) + 0.18, z], [x, deckY(x) + 1.13, z], 0.17, 0.21);
      }
    }
  }
  function lamps(o, t) {
    if (t < 1) return;
    const C = control;
    for (let x = C.ends[0] + 18; x < C.ends[1] - 10; x += t === 1 ? 84 : 42) {
      const y = deckY(x),
        z = 0;
      rod(o, 'metal', [x, y + 0.35, z], [x, y + 9.6, z], t < 2 ? 0.18 : 0.13, 0.13);
      for (const side of [-1, 1]) {
        rod(o, 'metal', [x, y + 9.6, z], [x + 0.25, y + 9.9, side * 4.1], 0.095, 0.095);
        prism(
          o,
          'metal',
          x - 0.2,
          x + 0.6,
          side * 4.1 - 0.25,
          side * 4.1 + 0.25,
          y + 9.8,
          y + 9.95,
        );
      }
    }
  }

  if (C.part === 'gallery') {
    gallery(o, t, C.side);
    for (const x of C.ends) {
      const a = x - 1.4,
        b = x + 1.4,
        z0 = C.side * (C.galleryInner - 0.7),
        z1 = C.side * (C.halfWidth + 0.55);
      strip(
        o,
        'walk',
        a,
        b,
        Math.min(z0, z1),
        Math.max(z0, z1),
        -C.galleryDrop - 0.24,
        -C.galleryDrop,
      );
    }
    return;
  }
  if (C.part !== 'upper_walk') {
    roadAndBox(o, t);
    portalPiers(o, t);
    if (!C.upperWalks) upperRails(o, t);
    lamps(o, t);
    for (const x of C.ends)
      prism(
        o,
        C.pierMaterial ?? 'stone',
        x - (x === C.ends[0] ? 0 : (C.abutmentDepth ?? 2.2)),
        x + (x === C.ends[0] ? (C.abutmentDepth ?? 2.2) : 0),
        -C.halfWidth,
        C.halfWidth,
        C.foundationY,
        deckY(x) - 0.46,
      );
  }
  const walk = (z0, z1, both = true) => {
    const edges = both ? [z0, z1] : [Math.abs(z0) > Math.abs(z1) ? z0 : z1],
      n = [1, 3, 8, 12, 16][t],
      xs = [
        ...new Set([
          ...Array.from({ length: n + 1 }, (_, i) => C.ends[0] + (i / n) * (C.ends[1] - C.ends[0])),
          ...(C.curveZ ?? []).map((p) => p[0]),
        ]),
      ].sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) {
      const a = xs[i - 1],
        b = xs[i];
      strip(o, 'walk', a, b, z0, z1, -0.3, 0);
      for (const z of edges)
        rod(o, 'metal', [a, deckY(a) + 1.1, z], [b, deckY(b) + 1.1, z], 0.07, 0.07);
    }
    if (t > 0)
      for (let x = C.ends[0] + 1; x < C.ends[1] - 1; x += [0, 16, 7, 4, 3][t])
        for (const z of edges)
          rod(o, 'metal', [x, deckY(x) + 0.14, z], [x, deckY(x) + 1.1, z], 0.065, 0.065);
  };
  if (C.part === 'upper_walk') {
    walk(-C.halfWidth, C.halfWidth);
    for (const x of C.piers)
      prism(o, 'concrete', x - 0.8, x + 0.8, -0.5, 0.5, C.foundationY, deckY(x) - 0.3);
    return;
  }
  if (C.upperWalks)
    for (const s of [-1, 1]) {
      const a = s * (C.roadHalfWidth + 0.2),
        b = s * (C.halfWidth - 0.18);
      walk(Math.min(a, b), Math.max(a, b), false);
    }
  for (const z of C.extraWalks ?? []) {
    walk(z - 1.12, z + 1.12);
    for (const x of C.piers)
      prism(o, 'concrete', x - 0.8, x + 0.8, z - 0.5, z + 0.5, C.foundationY, deckY(x) - 0.3);
  }
}
