/**
 * Gulfstream G650ER liveries. Government users carry their real markings (the Zambia Air Force
 * G650 and the United States Air Force C-37B scheme); corporate schemes reproduce colours,
 * cheatlines and tail patterns only, with no names, logos or emblems. Civil registrations are
 * fictional in the right national format.
 *
 * Model frame: +Z nose, +X the aircraft's left, +Y up. The cabin is level: axis y 2.92, half
 * width 1.35, top 4.25, belly 1.55, the belly paint break near y 2.2. Oval windows centre at
 * y 3.23 from z 8.8 aft to -0.3 (1.3 m pitch); the nacelles centre on x 2.55, y 3.83.
 */
import {
  bothSides,
  bothSidesText,
  lettering,
  paintAll,
  sideAnchors,
  sideCanvas,
  spline,
  usFlag,
} from '../art-regional.mjs';

const P = 'GLF6';
export function slots() {
  const s = (materials, node) => ({ materials: materials.map((m) => `${P}-${m}`), node });
  return {
    skin: s(['paint'], 'fuselage-skin'),
    belly: s(['belly'], 'fuselage-belly'),
    fairing: s(['belly'], 'belly-fairing'),
    'nose-door-l': s(['belly'], 'gear-0-door-left'),
    'nose-door-r': s(['belly'], 'gear-0-door-right'),
    fin: s(['paint'], 'fin'),
    'fin-top': s(['paint'], 'fin-top-fairing'),
    rudder: s(['paint'], 'rudder'),
    'tailplane-l': s(['paint'], 'tailplane-1'),
    'tailplane-r': s(['paint'], 'tailplane--1'),
    'elevator-l': s(['paint'], 'elevator-1'),
    'elevator-r': s(['paint'], 'elevator--1'),
    'nacelle-l': s(['paint'], 'engine-1'),
    'nacelle-r': s(['paint'], 'engine-2'),
    'pylon-l': s(['paint'], 'pylon-1'),
    'pylon-r': s(['paint'], 'pylon-2'),
    'wing-l': s(['wing'], 'wing-1'),
    'wing-r': s(['wing'], 'wing--1'),
    'winglet-l': s(['wing'], 'winglet-1'),
    'winglet-r': s(['wing'], 'winglet--1'),
    controls: s(['controls']),
    // Projection only (never painted): the painted airframe for side-view artwork.
    hull: s(['paint', 'belly'], 'airframe'),
  };
}

const HALF = 1.35;
const BODY = ['skin', 'belly', 'fairing', 'nose-door-l', 'nose-door-r'];
const TAIL = ['fin', 'fin-top', 'rudder'];
const STAB = ['tailplane-l', 'tailplane-r', 'elevator-l', 'elevator-r'];
const ENGINES = ['nacelle-l', 'nacelle-r', 'pylon-l', 'pylon-r'];
// The wing slots carry their cut-out speed brakes too.
const WINGS = ['wing-l', 'wing-r'];
const WINGLETS = ['winglet-l', 'winglet-r'];

export default function design({ kit: k, space }) {
  const anchors = {},
    graphics = {};
  const side = (name, box, outer = HALF + 0.15, slot = 'hull') =>
    Object.assign(anchors, sideAnchors(space, slot, name, box, { outer }));
  /** Lettering projectors on both sides at station z, height y (reads forward each side). */
  const text = (name, slot, z, y, width, height, { x = HALF, depth = 0.8 } = {}) => {
    for (const s of [1, -1])
      anchors[`${name}-${s > 0 ? 'l' : 'r'}`] = space.anchor(slot, {
        center: [s * (x + 0.1 - depth / 2), y, z],
        facing: [s, 0, 0],
        width,
        height,
        depth,
      });
  };
  /** Lettering on the outboard face of each nacelle. */
  const nacelleText = (name, z, y, width, height) => {
    anchors[`${name}-l`] = space.anchor('nacelle-l', {
      center: [3.2, y, z],
      facing: [1, 0, 0],
      width,
      height,
      depth: 0.6,
    });
    anchors[`${name}-r`] = space.anchor('nacelle-r', {
      center: [-3.2, y, z],
      facing: [-1, 0, 0],
      width,
      height,
      depth: 0.6,
    });
  };
  const plain = (list, color, extra = {}) =>
    Object.fromEntries(list.map((s) => [s, { color, ...extra }]));

  /* ------------------------------------------------ Zambia Air Force G650 ---- */
  const ZM_SILVER = '#c3c7ca',
    ZM_NAVY = '#1b2232',
    ZM_INK = '#121416';
  {
    // Forward: a dark sweep under the nose that thins into a pinline at window height.
    const box = { aft: -0.5, fore: 15.3, low: 1.9, high: 3.4 };
    const v = sideCanvas(k, box);
    const top = spline([
      [-0.5, 3.12],
      [8.5, 3.12],
      [9.6, 3.01],
      [10.8, 2.85],
      [12.7, 2.67],
      [14.0, 2.52],
      [15.2, 2.33],
    ]);
    const bottom = spline([
      [-0.5, 3.04],
      [8.5, 3.04],
      [9.6, 2.94],
      [10.8, 2.72],
      [11.6, 2.38],
      [12.5, 2.0],
      [13.5, 1.88],
      [14.5, 2.02],
      [15.2, 2.27],
    ]);
    v.band(ZM_NAVY, top, bottom, -0.5, 15.25, 60);
    graphics['zm-fore'] = v.graphic('Zambia Air Force forward sweep');
    side('zm-fore', box);
  }
  {
    // Aft: the pinline runs on under the engines and climbs the tail cone; the rear of the
    // fin and rudder is dark, bounded by a curve from the fin root to the trailing edge.
    const box = { aft: -10.7, fore: -0.4, low: 2.6, high: 7.9 };
    const v = sideCanvas(k, box);
    const mid = spline([
      [-10.0, 3.6],
      [-8.6, 3.2],
      [-6.5, 2.96],
      [-3.0, 3.0],
      [-0.4, 3.08],
    ]);
    v.band(
      ZM_NAVY,
      (z) => mid(z) + 0.04,
      (z) => mid(z) - 0.04,
      -10.0,
      -0.4,
      40,
    );
    const edge = spline([
      [-12.4, 7.25],
      [-11.0, 6.3],
      [-9.6, 5.1],
      [-8.3, 4.15],
      [-7.6, 3.86],
    ]);
    // Everything aft of and below the curve, down to the tail cone's top.
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const z = -7.6 - (4.8 * i) / 24;
      pts.push([z, edge(z)]);
    }
    pts.push([-12.6, 7.9], [-13.2, 7.9], [-13.2, 3.45], [-10.4, 3.45], [-9.0, 3.72], [-7.6, 3.72]);
    v.poly(ZM_NAVY, pts);
    graphics['zm-aft'] = v.graphic('Zambia Air Force tail sweep');
  }
  // The aft art spans the fin, rudder and tail cone (the fin-top fairing stays silver).
  Object.assign(
    anchors,
    sideAnchors(
      space,
      'skin',
      'zm-aft-skin',
      { aft: -10.7, fore: -0.4, low: 2.6, high: 7.9 },
      { outer: HALF + 0.15 },
    ),
    sideAnchors(
      space,
      'belly',
      'zm-aft-belly',
      { aft: -10.7, fore: -0.4, low: 2.6, high: 7.9 },
      { outer: HALF + 0.15 },
    ),
    sideAnchors(
      space,
      'fin',
      'zm-aft-fin',
      { aft: -13.3, fore: -2.9, low: 2.6, high: 7.9 },
      { outer: 0.45 },
    ),
    sideAnchors(
      space,
      'rudder',
      'zm-aft-rudder',
      { aft: -13.3, fore: -2.9, low: 2.6, high: 7.9 },
      { outer: 0.45 },
    ),
  );
  // The fin and rudder projectors are offset (wider box); give them their own crop of the art.
  {
    const box = { aft: -13.3, fore: -2.9, low: 2.6, high: 7.9 };
    const v = sideCanvas(k, box);
    const edge = spline([
      [-12.4, 7.25],
      [-11.0, 6.3],
      [-9.6, 5.1],
      [-8.3, 4.15],
      [-7.6, 3.86],
    ]);
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const z = -7.6 - (4.8 * i) / 24;
      pts.push([z, edge(z)]);
    }
    pts.push([-12.6, 7.9], [-13.25, 7.9], [-13.25, 3.45], [-7.6, 3.45]);
    v.poly(ZM_NAVY, pts);
    graphics['zm-fin'] = v.graphic('Zambia Air Force fin sweep');
  }
  // The flag: green, with red, black and orange stripes at the lower fly and an orange eagle
  // over them (a simplified original silhouette).
  const zambiaFlag = (w) => {
    const h = (w * 2) / 3,
      c = new k.Canvas(w, h);
    c.rect('#198a00', 0, 0, w, h);
    const sw = w * 0.1;
    ['#de2010', '#111111', '#ef7d00'].forEach((color, i) => {
      c.rect(color, w * 0.7 + i * sw, 0, sw, h * 0.62);
    });
    const ex = w * 0.85,
      ey = h * 0.8,
      s = w * 0.12;
    c.add('#ef7d00', [
      [ex - s, ey + s * 0.35],
      [ex - s * 0.35, ey + s * 0.05],
      [ex - s * 0.12, ey + s * 0.3],
      [ex, ey + s * 0.12],
      [ex + s * 0.12, ey + s * 0.3],
      [ex + s * 0.35, ey + s * 0.05],
      [ex + s, ey + s * 0.35],
      [ex + s * 0.25, ey - s * 0.25],
      [ex, ey - s * 0.4],
      [ex - s * 0.25, ey - s * 0.25],
    ]);
    return c.graphic('Flag of Zambia');
  };
  graphics['zm-flag'] = zambiaFlag(0.45);
  text('zm-flag', 'skin', 11.2, 3.5, 0.45, 0.3, { depth: 0.9 });
  graphics['zm-fin-flag'] = (() => {
    const c = new k.Canvas(0.3, 0.45);
    ['#de2010', '#111111', '#ef7d00'].forEach((color, i) => {
      c.rect(color, i * 0.1, 0.13, 0.1, 0.32);
    });
    c.rect('#198a00', 0, 0, 0.3, 0.13);
    return c.graphic('Zambian fin flash');
  })();
  text('zm-fin-flag', 'fin', -10.0, 6.95, 0.3, 0.45, { x: 0.15, depth: 0.3 });
  graphics['zm-titles'] = lettering(k, 'ZAMBIA AIR FORCE', 3.6, 0.36, ZM_INK, {
    face: 'technical',
    scale: 0.8,
  });
  text('zm-titles', 'skin', 7.0, 3.78, 3.6, 0.36, { depth: 0.9 });
  graphics['zm-serial'] = lettering(k, 'AF001', 1.6, 0.5, ZM_INK, {
    face: 'technical',
    scale: 0.82,
  });
  nacelleText('zm-serial', -4.9, 3.9, 1.6, 0.5);
  graphics['zm-serial-fin'] = lettering(k, 'AF001', 0.8, 0.24, ZM_INK, {
    face: 'technical',
    scale: 0.82,
  });
  text('zm-serial-fin', 'fin', -10.0, 6.5, 0.8, 0.24, { x: 0.15, depth: 0.3 });

  /* ------------------------------------------------ USAF C-37B scheme ---- */
  // White over a medium blue lower body behind a dark blue pinline just under the windows, the
  // break running down to the nose tip and up the tail cone; UNITED STATES OF AMERICA titles,
  // the flag and serial on the fin, national insignia on the engines.
  const US_BLUE = '#4672bf',
    US_NAVY = '#1d2f63';
  const usBreak = 2.9;
  const fore = [
      [12.0, usBreak],
      [15.25, 2.3],
    ],
    aftLine = [
      [-6.0, usBreak],
      [-10.6, 3.62],
    ];
  const lift = ([[z0, y0], [z1, y1]], dy) => [
    [z0, y0 + dy],
    [z1, y1 + dy],
  ];
  const usZones = [
    {
      color: US_BLUE,
      steps: [
        ['below', usBreak],
        ['behind', 12.0],
        ['ahead', -6.0],
      ],
    },
    {
      color: US_BLUE,
      steps: [
        ['line', ...fore, -1],
        ['ahead', 12.0],
      ],
    },
    {
      color: US_BLUE,
      steps: [
        ['line', ...aftLine, -1],
        ['behind', -6.0],
      ],
    },
    {
      color: US_NAVY,
      steps: [
        ['below', usBreak + 0.05],
        ['above', usBreak],
        ['behind', 12.0],
        ['ahead', -6.0],
      ],
    },
    {
      color: US_NAVY,
      steps: [
        ['line', ...lift(fore, 0.05), -1],
        ['line', ...fore, 1],
        ['ahead', 12.0],
      ],
    },
    {
      color: US_NAVY,
      steps: [
        ['line', ...lift(aftLine, 0.05), -1],
        ['line', ...aftLine, 1],
        ['behind', -6.0],
      ],
    },
  ];
  graphics['us-titles'] = lettering(k, 'UNITED STATES OF AMERICA', 6.4, 0.34, US_NAVY, {
    face: 'regular',
    scale: 0.8,
    tracking: 0.12,
  });
  text('us-titles', 'skin', 4.6, 3.8, 6.4, 0.34, { depth: 0.9 });
  graphics['us-flag'] = usFlag(new k.Canvas(0.95, 0.5), 0, 0, 0.95).graphic(
    'Flag of the United States',
  );
  text('us-flag', 'fin', -9.7, 6.55, 0.95, 0.5, { x: 0.15, depth: 0.3 });
  graphics['us-serial'] = lettering(k, '90525', 1.0, 0.3, '#1b1d22', {
    face: 'technical',
    scale: 0.82,
  });
  text('us-serial', 'fin', -9.6, 5.95, 1.0, 0.3, { x: 0.16, depth: 0.32 });
  graphics['us-insignia'] = k
    .usInsignia(new k.Canvas(1.2, 0.6), 0.6, 0.3, 0.28, { style: 'full' })
    .graphic('US national insignia');
  nacelleText('us-insignia', -4.8, 3.95, 1.2, 0.6);

  /* ------------------------------------------------ white with black accents ---- */
  // N780RW: white, a navy pinline along the windows that curves down to the nose tip, a black
  // crescent at the wing root, gloss black engines, pylons, lower tail cone, fin cap, fin-top
  // fairing and tailplane, and a black crescent at the fin's root.
  const BK = '#121417',
    BK_NAVY = '#1f2e5c';
  {
    const box = { aft: -10.7, fore: 15.3, low: 1.5, high: 4.4 };
    const v = sideCanvas(k, box);
    const pin = spline([
      [-10.0, 3.55],
      [-7.5, 3.22],
      [-5.0, 3.15],
      [9.5, 3.15],
      [12.0, 3.05],
      [13.8, 2.7],
      [15.2, 2.34],
    ]);
    v.band(
      BK_NAVY,
      (z) => pin(z) + 0.035,
      (z) => pin(z) - 0.035,
      -10.0,
      15.2,
      90,
    );
    // The wing-root crescent: a sweep that rises forward from under the wing to the first
    // window, thick in the middle.
    const top = spline([
      [4.6, 2.2],
      [6.2, 2.55],
      [7.6, 2.9],
      [8.4, 3.05],
    ]);
    const bottom = spline([
      [4.6, 2.18],
      [6.2, 2.28],
      [7.6, 2.62],
      [8.4, 3.0],
    ]);
    v.band(BK, top, bottom, 4.6, 8.4, 30);
    // The lower tail cone behind the engines.
    v.band(
      BK,
      spline([
        [-10.6, 3.62],
        [-8.4, 3.3],
        [-6.6, 2.95],
        [-5.2, 2.6],
      ]),
      () => 1.5,
      -10.6,
      -5.2,
      30,
    );
    graphics['bk-body'] = v.graphic('Navy pinline and black accents');
    side('bk-body', box);
  }
  // Fin: a black cap above a line rising aft, and a crescent along the root's trailing half.
  const bkFin = [
    { color: BK, steps: [['line', [-8.5, 6.35], [-12.6, 6.95], 1]] },
    {
      color: BK,
      steps: [
        ['line', [-8.2, 4.3], [-12.4, 5.6], -1],
        ['behind', -8.6],
      ],
    },
  ];
  graphics['reg-n651qt'] = lettering(k, 'N651QT', 1.6, 0.45, '#f2f3f3', {
    face: 'technical',
    scale: 0.82,
  });

  /* ------------------------------------------------ white with navy and red pinstripes ---- */
  // N1895T: white, a navy and a red stripe and a navy pinline running under the windows from
  // the nose, sweeping down the tail cone; navy and red bands across the fin.
  const PN_NAVY = '#1e2a5a',
    PN_RED = '#b3232c';
  {
    const box = { aft: -10.7, fore: 15.3, low: 1.8, high: 3.4 };
    const v = sideCanvas(k, box);
    const mid = spline([
      [-10.4, 3.5],
      [-8.4, 3.1],
      [-6.0, 2.9],
      [-2.0, 2.92],
      [9.0, 2.95],
      [12.5, 2.82],
      [14.3, 2.55],
      [15.2, 2.35],
    ]);
    const span = [-10.4, 15.2];
    v.band(
      PN_NAVY,
      (z) => mid(z) + 0.12,
      (z) => mid(z) + 0.045,
      ...span,
      90,
    );
    v.band(
      PN_RED,
      (z) => mid(z) + 0.025,
      (z) => mid(z) - 0.035,
      ...span,
      90,
    );
    v.band(
      PN_NAVY,
      (z) => mid(z) - 0.055,
      (z) => mid(z) - 0.08,
      ...span,
      90,
    );
    graphics['pn-body'] = v.graphic('Navy and red pinstripes');
    side('pn-body', box);
  }
  const pnFin = [
    {
      color: PN_NAVY,
      steps: [
        ['line', [-8.0, 5.35], [-12.5, 5.7], 1],
        ['line', [-8.0, 5.55], [-12.5, 5.9], -1],
      ],
    },
    {
      color: PN_RED,
      steps: [
        ['line', [-8.0, 5.08], [-12.5, 5.43], 1],
        ['line', [-8.0, 5.24], [-12.5, 5.59], -1],
      ],
    },
  ];
  graphics['reg-n2286m'] = lettering(k, 'N2286M', 1.6, 0.4, PN_NAVY, {
    face: 'technical',
    scale: 0.82,
  });

  const references = {
    zambia: {
      title: 'Gulfstream G650 AF001, Zambia Air Force (CC BY-SA 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Gulfstream_Aerospace_G-VI_(G650)-_AF001_-_Zambia_Air_Force.jpg',
    },
    c37b: {
      title: 'U.S. Air Force Gulfstream C-37B 09-0525 (CC BY-SA 2.0)',
      url: 'https://commons.wikimedia.org/wiki/File:U.S._Air_Force,_09-0525,_Gulfstream_Aerospace_C-37B_(27878765353).jpg',
    },
    n780rw: {
      title: 'Gulfstream G650ER N780RW at Baltimore (CC BY-SA 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Gulfstream_G650ER_N780RW_BWI_MD1.jpg',
    },
    n1895t: {
      title: 'Gulfstream G650ER N1895T, serial 6346 (CC BY-SA 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Gulfstream_G650ER_-_N1895T_-_Serial_6346_-_VGHS.jpg',
    },
  };
  const WHITE = '#eff0ef',
    WING = '#d3d6d8';
  const whiteJet = {
    ...plain([...BODY, ...TAIL, ...STAB, ...ENGINES], WHITE),
    ...plain([...WINGS, ...WINGLETS], WING),
    controls: { color: '#c5c9cc' },
  };
  nacelleText('nacelle-reg', -4.9, 3.9, 1.6, 0.45);

  return {
    selected: 'zambia-air-force',
    anchors,
    graphics,
    variants: [
      {
        id: 'zambia-air-force',
        label: 'Zambia Air Force AF001',
        provenance: {
          kind: 'inspired',
          note: 'Zambia Air Force VIP G650 AF001 as photographed, applied to the G650ER model: silver overall, a dark navy sweep under the nose that thins into a pinline along the windows and runs on under the engines, dark rear fin and rudder, ZAMBIA AIR FORCE titles, the flag of Zambia behind the flight deck and as a fin flash, AF001 on the engines and fin (original vector drawings; the flag eagle is simplified). The small fuselage roundel is not resolvable in the reference and is omitted. Colours are approximate.',
          references: [references.zambia],
        },
        paints: {
          ...plain([...BODY, ...TAIL, ...STAB, ...ENGINES], ZM_SILVER, {
            metalness: 0.35,
            roughness: 0.32,
          }),
          ...plain([...WINGS, ...WINGLETS], '#b9bec2', { metalness: 0.3, roughness: 0.38 }),
          controls: { color: '#b0b5b9' },
        },
        markings: [
          ...bothSides('zm-fore', 'zm-fore'),
          ...bothSides('zm-aft-skin', 'zm-aft'),
          ...bothSides('zm-aft-belly', 'zm-aft'),
          ...bothSides('zm-aft-fin', 'zm-fin'),
          ...bothSides('zm-aft-rudder', 'zm-fin'),
          ...bothSides('zm-flag', 'zm-flag'),
          ...bothSidesText('zm-fin-flag', 'zm-fin-flag'),
          ...bothSidesText('zm-titles', 'zm-titles'),
          ...bothSidesText('zm-serial', 'zm-serial'),
          ...bothSidesText('zm-serial-fin', 'zm-serial-fin'),
        ],
      },
      {
        id: 'usaf-c-37b',
        label: 'U.S. Air Force C-37B scheme',
        provenance: {
          kind: 'inspired',
          note: 'The 89th Airlift Wing VIP scheme as photographed on C-37B 09-0525, applied to the G650ER model (the C-37B is the G550): white over medium blue behind a dark blue pinline under the windows, the break running down to the nose tip and up the tail cone, UNITED STATES OF AMERICA titles, the flag and serial 90525 on the fin and the national insignia on the engines (original vector drawings; the titles are set in a sans serif rather than the serif face). Colours and line heights are approximate.',
          references: [references.c37b],
        },
        paints: {
          ...whiteJet,
          ...paintAll(space, BODY, WHITE, usZones),
        },
        markings: [
          ...bothSidesText('us-titles', 'us-titles'),
          ...bothSides('us-flag', 'us-flag'),
          ...bothSidesText('us-serial', 'us-serial'),
          ...bothSidesText('us-insignia', 'us-insignia'),
        ],
      },
      {
        id: 'white-black-accents',
        label: 'White with black accents',
        provenance: {
          kind: 'inspired',
          note: "Private scheme as photographed on N780RW: white with a navy pinline along the windows curving down to the nose tip, a black crescent at the wing root, gloss black engines, pylons, lower tail cone, fin cap, fin-top fairing and tailplane, a black crescent along the fin's root and white registration on the engines. Registration N651QT is fictional; curve shapes are approximate and the black surround of the flight deck windows is left off.",
          references: [references.n780rw],
        },
        paints: {
          ...whiteJet,
          ...paintAll(space, ['fin', 'rudder'], WHITE, bkFin),
          ...plain([...STAB, 'fin-top', ...ENGINES], BK, { roughness: 0.22 }),
        },
        markings: [
          ...bothSides('bk-body', 'bk-body'),
          ...bothSidesText('nacelle-reg', 'reg-n651qt'),
        ],
      },
      {
        id: 'navy-red-pinstripes',
        label: 'White with navy and red pinstripes',
        provenance: {
          kind: 'inspired',
          note: 'Private scheme as photographed on N1895T: white with a navy stripe, a red stripe and a navy pinline under the windows from the nose to the tail cone, and navy and red bands across the fin; navy registration on the engines. Registration N2286M is fictional; stripe heights are approximate.',
          references: [references.n1895t],
        },
        paints: {
          ...whiteJet,
          ...paintAll(space, ['fin', 'rudder'], WHITE, pnFin),
        },
        markings: [
          ...bothSides('pn-body', 'pn-body'),
          ...bothSidesText('nacelle-reg', 'reg-n2286m'),
        ],
      },
    ],
  };
}
