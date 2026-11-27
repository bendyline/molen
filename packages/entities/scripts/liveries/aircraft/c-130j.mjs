/**
 * C-130J Super Hercules liveries: US Air Force (Air National Guard and Reserve weather
 * reconnaissance), US Coast Guard, Royal Air Force and Royal Australian Air Force schemes, with
 * national insignia, titles, fin flashes, tail bands and serials redrawn as original vector art.
 *
 * The model is the short-fuselage C-130J. Kentucky's and Australia's aircraft are C-130J-30s;
 * their schemes are laid out on the short fuselage at the photographed positions relative to
 * the cockpit, wing and fin. Colors are approximate paint shades.
 */
import * as A from '../art-transports.mjs';

const EXT = 'body-C130J-exterior-C130J-airframe',
  FORE = 'body-C130J-forebody-C130J-airframe',
  RUDDER = 'body-C130J-rudder-C130J-airframe';

export function slots(existing) {
  return {
    ...existing,
    [FORE]: { materials: ['C130J-airframe'], node: 'C130J-forebody-C130J-airframe' },
    // Markings only (never painted): every airframe surface, so lettering can run across the
    // fin and rudder or onto the forebody.
    all: { materials: ['C130J-airframe'] },
  };
}

const USAF_GRAY = '#858d93', // FS 36173 neutral gray
  WC_GRAY = '#7f8890',
  INK = '#25292c',
  WHITE = '#f4f4f0',
  CG_WHITE = '#eef0ee',
  CG_RED = '#d8492b',
  CG_BLUE = '#1f3f7a',
  RAF_GREEN = '#565a4c',
  RAAF_GRAY = '#a3aaaf',
  RAAF_INK = '#6a7278',
  BLACK = '#1b1d1f';

// The fin: chord centre, skin half-thickness and chord at height y (probed on the runtime model).
const finZ = (y) => -11.175 - 0.175 * (y - 7),
  finX = (y) => 0.151 - 0.015 * (y - 7);

/** The red hurricane symbol (a ring with two curling arms), drawn from arcs. */
function hurricane(c, cx, cy, r, color) {
  c.ring(color, cx, cy, r * 0.28, r * 0.56, 28);
  for (const start of [Math.PI / 2, -Math.PI / 2]) {
    const outer = [],
      inner = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10,
        a = start + t * 1.9,
        R = r * (0.5 + 0.55 * t),
        w = r * 0.3 * (1 - t) + r * 0.02;
      outer.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]);
      inner.push([cx + Math.cos(a) * (R - w), cy + Math.sin(a) * (R - w)]);
    }
    c.add(color, [...outer, ...inner.reverse()]);
  }
  return c;
}

/** The US Coast Guard emblem: a white disc in a blue ring around a shield and crossed anchors. */
function coastGuardEmblem(k, d) {
  const c = new k.Canvas(d, d),
    r = d / 2;
  c.circle(WHITE, r, r, r, 36);
  c.ring(CG_BLUE, r, r, r * 0.82, r * 0.96, 36);
  // Crossed anchors behind the shield: two shanks with flukes.
  for (const angle of [0.75, -0.75]) {
    c.box(CG_BLUE, r, r, r * 1.3, r * 0.07, angle);
    const fx = r + Math.cos(angle) * r * 0.62,
      fy = r + Math.sin(angle) * r * 0.62;
    c.box(CG_BLUE, fx, fy, r * 0.32, r * 0.08, angle + Math.PI / 2);
  }
  const sw = r * 0.7,
    top = r + r * 0.42,
    mid = r - r * 0.08,
    tip = r - r * 0.6;
  c.add(CG_BLUE, [
    [r - sw / 2, top],
    [r + sw / 2, top],
    [r + sw / 2, mid],
    [r, tip],
    [r - sw / 2, mid],
  ]);
  for (let i = 0; i < 5; i++)
    c.add(i % 2 ? WHITE : '#c8102e', [
      [r - sw / 2 + (i * sw) / 5 + r * 0.015, top - r * 0.26],
      [r - sw / 2 + ((i + 1) * sw) / 5 - r * 0.015, top - r * 0.26],
      [r - sw / 2 + ((i + 1) * sw) / 5 - r * 0.015, mid + r * 0.04],
      [r - sw / 2 + (i * sw) / 5 + r * 0.015, mid + r * 0.04],
    ]);
  return A.finish(c, 'US Coast Guard emblem');
}

export default function design({ kit: k, space, slots: all }) {
  const anchors = {};
  const pair = (name, make) => {
    anchors[`${name}-l`] = make(1);
    anchors[`${name}-r`] = make(-1);
  };
  const on = (center, s, width, height, depth = 0.8, facing = [s, 0, 0]) =>
    space.anchor('all', { center, facing, width, height, depth });
  const fin =
    (y, width, height, dz = 0) =>
    (s) =>
      on([s * finX(y), y, finZ(y) + dz], s, width, height, 0.22);

  // Fuselage sides.
  pair('title', (s) => on([s * 2.06, 3.52, 8.75], s, 3.6, 0.38));
  pair('title-long', (s) => on([s * 2.06, 3.55, 8.6], s, 4.4, 0.26));
  pair('title-aft', (s) => on([s * 2.03, 3.5, -3.15], s, 6.4, 0.52));
  pair('nose-number', (s) => on([s * 1.96, 2.55, 11.25], s, 0.62, 0.2));
  pair('nose-big', (s) => on([s * 1.86, 2.45, 11.75], s, 1.5, 0.5));
  pair('nose-unit', (s) => on([s * 1.88, 1.65, 11.4], s, 0.7, 0.16));
  pair('insignia', (s) => on([s * 2.03, 3.25, -4.6], s, 1.5, 0.84));
  pair('roundel', (s) => on([s * 2.03, 3.0, -4.6], s, 1.0, 1.0));
  pair('aft-serial', (s) => on([s * 1.6, 3.9, -7.6], s, 1.3, 0.26));
  pair('emblem', (s) => on([s * 2.05, 2.7, 8.6], s, 0.8, 0.8));
  pair('crew-title', (s) => on([s * 1.9, 4.18, 10.6], s, 1.6, 0.16, 0.6, [s, 0.35, 0]));
  // Fin (both faces).
  pair('fin-flag', fin(9.25, 1.1, 0.6));
  pair('fin-code', fin(8.55, 1.2, 0.27));
  pair('fin-band', fin(7.94, 4.2, 0.38));
  pair('fin-serial', fin(7.32, 1.8, 0.42));
  pair('fin-insignia', fin(7.55, 2.1, 1.05, 0.1));
  pair('fin-flash', fin(6.95, 0.42, 0.62, -1.15));
  pair('fin-roundel', fin(9.6, 0.7, 0.7));
  pair('fin-small', fin(6.55, 1.5, 0.18, -0.2));
  // Wings between the engines: upper and lower surfaces follow the airfoil slope.
  for (const [name, x, y, facing] of [
    ['wing-upper-l', 7.7, 4.94, [0, 1, -0.0815]],
    ['wing-upper-r', -7.7, 4.94, [0, 1, -0.0815]],
    ['wing-lower-l', 7.7, 4.6, [0, -1, -0.0525]],
    ['wing-lower-r', -7.7, 4.6, [0, -1, -0.0525]],
  ])
    anchors[name] = space.anchor('all', {
      center: [x, y, 1.75],
      facing,
      up: [0, 0, 1],
      width: 3.2,
      height: 1.45,
      depth: 0.18,
    });

  // ------------------------------------------------------------------ artwork
  const insignia = (style, color) =>
    A.finish(
      k.usInsignia(new k.Canvas(1.5, 0.84), 0.75, 0.42, 0.35, { style, color }),
      'US national insignia',
    );
  const graphics = {
    'us-air-force': A.label(k, 'U.S. AIR FORCE', 3.6, 0.38, INK, { tracking: 0.1 }),
    'us-flag': A.usFlag(k, 1.1, 0.6),
    'insignia-full': insignia('full'),
    'insignia-dark': insignia('lowvis', '#3a4046'),
    'wing-insignia': A.finish(
      k.usInsignia(new k.Canvas(3.2, 1.45), 1.6, 0.725, 0.62, {
        style: 'lowvis',
        color: '#3a4046',
      }),
      'US national insignia (wing)',
    ),
    'wing-usaf': A.label(k, 'USAF', 3.2, 1.45, INK, { fill: 0.72, tracking: 0.12 }),
  };
  // Kentucky ANG: blue band with white KENTUCKY and a star.
  {
    const c = new k.Canvas(4.2, 0.38);
    c.text(WHITE, 'KENTUCKY', { x: 1.9, y: 0.19, height: 0.24, tracking: 0.1 });
    c.star(WHITE, 3.25, 0.19, 0.1);
    graphics['band-kentucky'] = A.finish(c, 'KENTUCKY tail band');
  }
  graphics['code-ang'] = A.label(k, 'ANG', 1.2, 0.27, INK);
  graphics['serial-95945'] = A.label(k, '95945', 1.8, 0.42, INK);
  graphics['nose-5945'] = A.label(k, '5945', 0.62, 0.2, INK);
  graphics['unit-123aw'] = A.label(k, '123 AW', 0.7, 0.16, INK);
  // 53rd WRS Hurricane Hunters: black band with white script and the red storm symbol.
  {
    const c = new k.Canvas(4.2, 0.38);
    c.text(WHITE, 'Hurricane', {
      x: 1.98,
      y: 0.19,
      height: 0.22,
      align: 'right',
      face: 'regular',
      slant: 0.22,
    });
    hurricane(c, 2.1, 0.19, 0.13, '#d32f2f');
    c.text(WHITE, 'Hunters', {
      x: 2.24,
      y: 0.19,
      height: 0.22,
      align: 'left',
      face: 'regular',
      slant: 0.22,
    });
    graphics['band-hurricane'] = A.finish(c, 'Hurricane Hunters tail band');
  }
  graphics['code-afrc'] = A.label(k, 'AFRC', 1.2, 0.27, INK);
  graphics['serial-85307'] = A.label(k, '85307', 1.8, 0.42, INK);
  graphics['nose-5307'] = A.label(k, '5307', 0.62, 0.2, INK);
  graphics['unit-403wg'] = A.label(k, '403 WG', 0.7, 0.16, INK);
  // US Coast Guard.
  graphics['cg-title'] = A.label(k, 'U.S. COAST GUARD', 6.4, 0.52, BLACK, { tracking: 0.06 });
  graphics['cg-number'] = A.lines(k, 1.5, 0.5, BLACK, [
    ['2015', 0.34, 0.31],
    ['ELIZABETH CITY', 0.06, 0.05],
  ]);
  graphics['cg-emblem'] = coastGuardEmblem(k, 0.8);
  graphics['cg-wing-title'] = A.label(k, 'USCG', 3.2, 1.45, BLACK, { fill: 0.72, tracking: 0.12 });
  graphics['cg-wing-insignia'] = A.finish(
    k.usInsignia(new k.Canvas(3.2, 1.45), 1.6, 0.725, 0.62, { style: 'full' }),
    'US national insignia (wing)',
  );
  graphics['cg-fin-insignia'] = A.finish(
    k.usInsignia(new k.Canvas(2.1, 1.05), 1.05, 0.525, 0.45, { style: 'full' }),
    'US national insignia (fin)',
  );
  graphics['cg-stencil'] = A.label(k, 'HC-130J 2015', 1.3, 0.26, BLACK);
  // Royal Air Force.
  graphics['raf-roundel'] = A.finish(
    k.roundel(new k.Canvas(1, 1), 0.5, 0.5, 0.49, k.ROUNDELS.rafLowVis, [0.5, 0.5]),
    'RAF low-visibility roundel',
  );
  graphics['raf-flash'] = A.flash(
    k,
    0.42,
    0.62,
    ['#c97a83', '#5b7aa6'],
    'RAF low-visibility fin flash',
  );
  graphics['raf-title'] = A.label(k, 'ROYAL AIR FORCE', 1.6, 0.16, '#b9bcb3', { tracking: 0.08 });
  graphics['raf-889'] = A.label(k, '889', 0.62, 0.2, BLACK);
  graphics['raf-serial'] = A.label(k, 'ZH889', 1.3, 0.26, BLACK);
  // Royal Australian Air Force.
  graphics['raaf-title'] = A.label(k, 'ROYAL AUSTRALIAN AIR FORCE', 4.4, 0.26, RAAF_INK, {
    fill: 0.8,
    tracking: 0.06,
  });
  graphics['raaf-roundel'] = A.finish(
    k.australiaRoundel(new k.Canvas(1, 1), 0.5, 0.5, 0.49, { lowvis: true }),
    'RAAF low-visibility roundel',
  );
  graphics['raaf-serial'] = A.label(k, 'A97-448', 1.5, 0.18, RAAF_INK);
  graphics['raaf-nose'] = A.label(k, '448', 0.62, 0.2, RAAF_INK);

  // ------------------------------------------------------------------ paint helpers
  const bodySlots = Object.keys(all).filter((n) => n.startsWith('body-'));
  const paintAll = (color, extra = {}) => ({
    ...Object.fromEntries(bodySlots.map((n) => [n, { color }])),
    ...extra,
  });
  const band = (slot, y0, y1) => [space.above(slot, y0), space.below(slot, y1)];
  // The dark antenna fairing at the root of the fin's leading edge.
  const fairing = {
    color: '#2a2e31',
    planes: [space.above(EXT, 5.78), space.below(EXT, 7.05), space.ahead(EXT, -8.85)],
  };
  const usafFin = (base, bandColor) => ({
    [EXT]: { color: base, zones: [fairing, { color: bandColor, planes: band(EXT, 7.75, 8.13) }] },
    [RUDDER]: { color: base, zones: [{ color: bandColor, planes: band(RUDDER, 7.75, 8.13) }] },
  });
  const both = (anchor, graphic) => [
    { anchor: `${anchor}-l`, graphic },
    { anchor: `${anchor}-r`, graphic },
  ];
  // Flags and flashes lead with the hoist (or first color) toward the nose on both sides.
  const leading = (anchor, graphic) => [
    { anchor: `${anchor}-l`, graphic },
    { anchor: `${anchor}-r`, graphic, flip: true },
  ];
  const usafWings = [
    { anchor: 'wing-upper-l', graphic: 'wing-insignia' },
    { anchor: 'wing-upper-r', graphic: 'wing-usaf' },
    { anchor: 'wing-lower-l', graphic: 'wing-usaf' },
    { anchor: 'wing-lower-r', graphic: 'wing-insignia' },
  ];

  // The Coast Guard stripe leans forward at 64 degrees; z at the bottom of the fuselage.
  const lean = 1 / Math.tan((64 * Math.PI) / 180);
  const slant = (slot, z0, side) => space.sideLine(slot, [z0, 0.7], [z0 + lean * 4.2, 4.9], side);
  const fuselageOnly = (slot) => [
    space.plane(slot, [-1, 0, 0], [2.25, 0, 0]),
    space.plane(slot, [1, 0, 0], [-2.25, 0, 0]),
  ];
  const cgStripe = (slot) => [
    { color: CG_RED, planes: [slant(slot, 6.6, -1), slant(slot, 8.6, 1), ...fuselageOnly(slot)] },
    { color: CG_BLUE, planes: [slant(slot, 5.95, -1), slant(slot, 6.4, 1), ...fuselageOnly(slot)] },
  ];
  // Fin: red-orange panel and base band (not on the rudder), aft of a white leading edge.
  const finLE = space.sideLine(EXT, [-8.95, 7], [-11.05, 11], -1);
  const finOnly = [
    space.plane(EXT, [-1, 0, 0], [0.45, 0, 0]),
    space.plane(EXT, [1, 0, 0], [-0.45, 0, 0]),
  ];
  const cgFin = [
    { color: CG_RED, planes: [...band(EXT, 8.15, 11.45), finLE, ...finOnly] },
    { color: CG_RED, planes: [...band(EXT, 6.2, 6.98), finLE, ...finOnly] },
  ];
  // Stabilizers and elevators: a diagonal red-orange band from mid-chord at the root to the
  // trailing edge near the tip.
  const stabBand = (slot, s) => {
    const n = [s * 0.258, 0, 0.966],
      c = [s * 4.5, 0, -13.0],
      w = 0.45;
    return {
      color: CG_RED,
      planes: [
        space.plane(
          slot,
          n,
          c.map((v, i) => v - w * n[i]),
        ),
        space.plane(
          slot,
          n.map((v) => -v),
          c.map((v, i) => v + w * n[i]),
        ),
        space.below(slot, 5.3),
        space.behind(slot, -11.0),
        space.plane(slot, [s, 0, 0], [s * 1.2, 0, 0]),
      ],
    };
  };
  const cgStab = [stabBand(EXT, 1), stabBand(EXT, -1)];
  const cgTips = [
    {
      color: CG_RED,
      planes: [
        space.plane(EXT, [1, 0, 0], [16.9, 0, 0]),
        space.plane(EXT, [-1, 0, 0], [19.4, 0, 0]),
      ],
    },
    {
      color: CG_RED,
      planes: [
        space.plane(EXT, [-1, 0, 0], [-16.9, 0, 0]),
        space.plane(EXT, [1, 0, 0], [-19.4, 0, 0]),
      ],
    },
  ];
  const aileronTip = (slot, s) => ({
    color: CG_WHITE,
    zones: [
      {
        color: CG_RED,
        planes: [
          space.plane(slot, [s, 0, 0], [s * 16.9, 0, 0]),
          space.plane(slot, [-s, 0, 0], [s * 19.4, 0, 0]),
        ],
      },
    ],
  });

  // ------------------------------------------------------------------ references
  const refs = {
    kentucky: {
      title:
        'C-130J-30 19-5945 of the Kentucky Air National Guard at ILA 2024, by Matti Blume (CC BY-SA 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Lockheed_C-130J,_ILA_2024,_Schoenefeld_(ILA43898).jpg',
    },
    wc: {
      title: 'WC-130J 98-5307 Hurricane Hunters (CC BY-SA 2.0)',
      url: 'https://commons.wikimedia.org/wiki/File:98-5307_WC-130J_HURRICANE_HUNTERS_(28865254758).jpg',
    },
    wc2: {
      title: 'WC-130J of the 53rd Weather Reconnaissance Squadron (US Air Force, public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:WC-130J_Hercules_of_the_53rd_Weather_Reconnaissance_Squadron.jpg',
    },
    cg: {
      title: 'Coast Guard HC-130J 2015 in flight (CC BY-SA 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Coast_Guard_HC-130J.jpg',
    },
    cg2: {
      title: 'HC-130J 2012 at Air Station Barbers Point (US Coast Guard, public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:HC-130J_sits_on_the_tarmac_at_Air_Station_Barbers_Point.jpg',
    },
    raf: {
      title: 'RAF Hercules C5 ZH889 at Brize Norton (CC BY-SA 2.0)',
      url: 'https://commons.wikimedia.org/wiki/File:EGVN_-_Lockheed_C-130J_Hercules_C5_-_Royal_Air_Force_-_ZH889_(33295282688).jpg',
    },
    raf2: {
      title: 'RAF Hercules C5 ZH887 at Brize Norton (CC BY-SA 2.0)',
      url: 'https://commons.wikimedia.org/wiki/File:EGVN_-_Lockheed_C-130J_Hercules_C5_-_Royal_Air_Force_-_ZH887_(46246445655).jpg',
    },
    raaf: {
      title: 'RAAF C-130J-30 A97-448 at Wagga Wagga (CC BY-SA)',
      url: 'https://commons.wikimedia.org/wiki/File:Royal_Australian_Air_Force_(A97-448)_Lockheed_Martin_C-130J_Hercules_at_Wagga_Wagga_Airport.jpg',
    },
  };
  const variant = (id, label, note, references, paints, markings) => ({
    id,
    label,
    provenance: { kind: 'inspired', note, references },
    paints,
    markings,
  });

  return {
    selected: 'kentucky-ang-123aw',
    anchors,
    graphics,
    variants: [
      variant(
        'kentucky-ang-123aw',
        'Kentucky ANG 123rd AW, 2024',
        'Kentucky Air National Guard C-130J-30 19-5945 from the referenced ILA 2024 photograph, laid out on the short C-130J: FS 36173 neutral gray, U.S. AIR FORCE title, US flag, ANG, the blue KENTUCKY tail band with its star and tail number 95945 on the fin, full-color national insignia aft, nose number and unit code, USAF and the national insignia on the wings. The ANG shield under the tail number and the KENTUCKY AIR GUARD sponson title are omitted. Approximate colors.',
        [refs.kentucky],
        paintAll(USAF_GRAY, usafFin(USAF_GRAY, '#1f4fa8')),
        [
          ...both('title', 'us-air-force'),
          ...both('nose-number', 'nose-5945'),
          ...both('nose-unit', 'unit-123aw'),
          ...both('insignia', 'insignia-full'),
          ...leading('fin-flag', 'us-flag'),
          ...both('fin-code', 'code-ang'),
          ...both('fin-band', 'band-kentucky'),
          ...both('fin-serial', 'serial-95945'),
          ...usafWings,
        ],
      ),
      variant(
        'wc-130j-hurricane-hunters',
        '53rd WRS Hurricane Hunters WC-130J',
        "Air Force Reserve WC-130J 98-5307 of the 53rd Weather Reconnaissance Squadron (403rd Wing, Keesler) from the referenced photographs: gray overall, U.S. AIR FORCE title, US flag, AFRC, the black Hurricane Hunters tail band with the red storm symbol and tail number 85307, dark low-visibility national insignia, nose number and 403 WG. The WC-130J's pylon fuel tanks are not modelled. Approximate colors; the band's script lettering is set in an italic sans.",
        [refs.wc, refs.wc2],
        paintAll(WC_GRAY, usafFin(WC_GRAY, '#141618')),
        [
          ...both('title', 'us-air-force'),
          ...both('nose-number', 'nose-5307'),
          ...both('nose-unit', 'unit-403wg'),
          ...both('insignia', 'insignia-dark'),
          ...leading('fin-flag', 'us-flag'),
          ...both('fin-code', 'code-afrc'),
          ...both('fin-band', 'band-hurricane'),
          ...both('fin-serial', 'serial-85307'),
          ...usafWings,
        ],
      ),
      variant(
        'uscg-hc-130j',
        'US Coast Guard HC-130J 2015',
        'US Coast Guard HC-130J 2015 (Air Station Elizabeth City) from the referenced photographs: Coast Guard white with the red-orange and blue racing stripe and service emblem (redrawn), black radome is the model default, number 2015 on the nose, U.S. COAST GUARD title, red-orange fin panel and base band around the full-color national insignia, diagonal stabilizer bands and red-orange outer wings, USCG and the insignia under the wings. Approximate stripe geometry and colors.',
        [refs.cg, refs.cg2],
        paintAll(CG_WHITE, {
          [EXT]: {
            color: CG_WHITE,
            zones: [
              ...cgStripe(EXT),
              ...cgFin,
              ...cgStab,
              ...cgTips,
              { ...fairing, color: '#1d2023' },
            ],
          },
          [FORE]: { color: CG_WHITE },
          'body-C130J-aileron-1-C130J-airframe': aileronTip(
            'body-C130J-aileron-1-C130J-airframe',
            1,
          ),
          'body-C130J-aileron--1-C130J-airframe': aileronTip(
            'body-C130J-aileron--1-C130J-airframe',
            -1,
          ),
          'body-C130J-elevator-1-C130J-airframe': {
            color: CG_WHITE,
            zones: [stabBand('body-C130J-elevator-1-C130J-airframe', 1)],
          },
          'body-C130J-elevator--1-C130J-airframe': {
            color: CG_WHITE,
            zones: [stabBand('body-C130J-elevator--1-C130J-airframe', -1)],
          },
        }),
        [
          ...both('emblem', 'cg-emblem'),
          ...both('nose-big', 'cg-number'),
          ...both('title-aft', 'cg-title'),
          ...both('fin-insignia', 'cg-fin-insignia'),
          ...both('aft-serial', 'cg-stencil'),
          { anchor: 'wing-upper-l', graphic: 'cg-wing-insignia' },
          { anchor: 'wing-upper-r', graphic: 'cg-wing-title' },
          { anchor: 'wing-lower-l', graphic: 'cg-wing-title' },
          { anchor: 'wing-lower-r', graphic: 'cg-wing-insignia' },
        ],
      ),
      variant(
        'raf-47-sqn-hercules-c5',
        'RAF Hercules C5 ZH889, 47 Sqn',
        'Royal Air Force Hercules C5 ZH889 (Brize Norton) from the referenced photographs: overall dark tactical green-gray, low-visibility red and blue roundels aft and fin flash, small ROYAL AIR FORCE title, 889 on the nose and the ZH889 serial on the tail cone. Approximate colors; the white and red propeller tip rings are not painted (blades are a separate material).',
        [refs.raf, refs.raf2],
        paintAll(RAF_GREEN, {
          [EXT]: { color: RAF_GREEN, zones: [{ ...fairing, color: '#2c2e29' }] },
        }),
        [
          ...both('crew-title', 'raf-title'),
          ...both('nose-number', 'raf-889'),
          ...both('roundel', 'raf-roundel'),
          ...leading('fin-flash', 'raf-flash'),
          ...both('aft-serial', 'raf-serial'),
        ],
      ),
      variant(
        'raaf-37-sqn',
        'RAAF 37 Squadron A97-448',
        'Royal Australian Air Force C-130J-30 A97-448 (No. 37 Squadron, Richmond) from the referenced photograph, laid out on the short C-130J: light gray, ROYAL AUSTRALIAN AIR FORCE title and A97-448 in darker gray, low-visibility kangaroo roundels aft and on the fin, 448 on the nose, dark fin-root fairing. Yellow primer patches are omitted. Approximate colors.',
        [refs.raaf],
        paintAll(RAAF_GRAY, { [EXT]: { color: RAAF_GRAY, zones: [fairing] } }),
        [
          ...both('title-long', 'raaf-title'),
          ...both('nose-number', 'raaf-nose'),
          ...both('roundel', 'raaf-roundel'),
          ...both('fin-roundel', 'raaf-roundel'),
          ...both('fin-small', 'raaf-serial'),
        ],
      ),
    ],
  };
}
