/**
 * Pilatus PC-12 NGX liveries: the US Air Force's U-28A Draco and the Finnish Air Force's grey
 * PC-12, the Royal Flying Doctor Service's red, white and blue (colors only), the Pilatus
 * factory NGX scheme and a Swiss operator's silver and graphite corporate scheme. Military
 * markings are redrawn as original vector art; civil operators carry their colors and stripe
 * layouts only, with fictional registrations in the right national format.
 */
import { helpers, lettering, swoosh } from '../art-ga-b.mjs';

export function slots() {
  const pearl = (node) => ({ materials: ['PC12-pearl'], node });
  return {
    shell: pearl('PC12-shell-PC12-pearl'),
    // The lower side panels (and the ventral strakes), skin of their own material.
    lower: { materials: ['PC12-blue'], node: 'PC12-shell-PC12-blue' },
    'flap-1': pearl('PC12-flap-1-PC12-pearl'),
    'flap--1': pearl('PC12-flap--1-PC12-pearl'),
    'aileron-1': pearl('PC12-aileron-1-PC12-pearl'),
    'aileron--1': pearl('PC12-aileron--1-PC12-pearl'),
    'elevator-1': pearl('PC12-elevator-1-PC12-pearl'),
    'elevator--1': pearl('PC12-elevator--1-PC12-pearl'),
    rudder: pearl('PC12-rudder-PC12-pearl'),
    'gear-0': pearl('PC12-gear-0-PC12-pearl'),
    'gear-1': pearl('PC12-gear-1-PC12-pearl'),
    'gear-2': pearl('PC12-gear-2-PC12-pearl'),
  };
}

const SURFACES = ['flap-1', 'flap--1', 'aileron-1', 'aileron--1', 'elevator-1', 'elevator--1'];
const GEAR = ['gear-0', 'gear-1', 'gear-2'];

const INK = '#15181b',
  WHITE = '#f2f2ef',
  U28_GREY = '#70777c',
  U28_LIGHT = '#c4c9cc',
  FINNISH_GREY = '#a2a7aa',
  FINNISH_DARK = '#4b5155',
  RFDS_RED = '#d2202c',
  RFDS_BLUE = '#1f4fa8',
  NGX_RED = '#c5182a',
  NGX_GREY = '#7d848a',
  SILVER = '#b9bdc1',
  GRAPHITE = '#2e3236';

// The paint line of the two-tone schemes: low on the cowl, along the cabin under the windows
// and sweeping up the tail cone to the fin root (RFDS and HB-FWO photographs).
const LINE = [
  [5.4, 1.62],
  [2.4, 1.42],
  [-2.7, 1.45],
  [-7.2, 2.3],
];
const raise = (line, dy) => line.map(([z, y]) => [z, y + dy]);
// The fin color behind a diagonal from the dorsal (z -5.5) to the fin tip's leading edge.
const FIN_LINE = [
  [-5.5, 2.45],
  [-6.95, 4.3],
];

export default function design({ kit: k, space }) {
  const h = helpers(space);
  const SIDES = [1, -1];
  const anchors = {};
  for (const s of SIDES) {
    // Aft fuselage: the section narrows about 0.14 m per metre toward the tail.
    const aft = (z, y, w, hh) => h.side('shell', s, z, y, w, hh, { reach: 1.2, toe: 0.14 });
    anchors[`reg-${s}`] = aft(-4.35, 2.06, 1.75, 0.3);
    anchors[`reg-high-${s}`] = aft(-5.15, 2.32, 1.3, 0.2);
    anchors[`roundel-${s}`] = aft(-4.05, 1.98, 0.42, 0.42);
    anchors[`serial-${s}`] = aft(-4.6, 1.98, 0.62, 0.16);
    anchors[`title-${s}`] = h.side('shell', s, -1.15, 2.58, 2.2, 0.13, { reach: 1.2 });
    // Fin (mid height, fixed part) and its top.
    anchors[`fin-${s}`] = h.side('shell', s, -7.05, 3.45, 0.8, 0.62, { reach: 0.12 });
    anchors[`fin-top-${s}`] = h.side('shell', s, -7.55, 3.9, 0.36, 0.24, { reach: 0.12 });
    // Long side swooshes (z 5.2 .. -7.6, y 1.1 .. 3.1).
    anchors[`swoosh-${s}`] = h.side('shell', s, -1.2, 2.1, 12.8, 2.0, { reach: 1.2 });
  }

  /* ---------------------------------------------------------------- artwork ---- */
  const graphics = {
    'reg-vh-fxq': lettering(k, 'VH-FXQ', 1.3, 0.2, INK, { fill: 0.86 }),
    'reg-hb-fqx': lettering(k, 'HB-FQX', 1.75, 0.3, GRAPHITE, { fill: 0.8 }),
    'reg-n68gx': lettering(k, 'N68GX', 1.3, 0.2, '#3a3f44', { fill: 0.86 }),
    'finnish-title': lettering(k, 'FINNISH AIR FORCE', 2.2, 0.13, FINNISH_DARK, { fill: 0.78 }),
    'pi-02': lettering(k, 'PI-02', 0.62, 0.16, FINNISH_DARK, { fill: 0.82 }),
  };
  {
    const c = new k.Canvas(0.42, 0.42);
    graphics['finland-roundel'] = k.finlandRoundel(c, 0.21, 0.21, 0.2).graphic('Finnish roundel');
    // U-28A fin: a small US flag over the serial in light grey.
    const f = new k.Canvas(0.8, 0.62);
    const fx = 0.16,
      fy = 0.38,
      fw = 0.46,
      fh = 0.24;
    for (let i = 0; i < 13; i++)
      f.rect(i % 2 ? '#f4f4f4' : '#b22234', fx, fy + (fh * i) / 13, fw, fh / 13);
    f.rect('#3c3b6e', fx, fy + (fh * 6) / 13, fw * 0.4, (fh * 7) / 13);
    f.text(U28_LIGHT, '60581', { x: 0.4, y: 0.17, height: 0.14 });
    graphics['u28-fin'] = f.graphic('US flag and serial 60581');
    // Swiss flag (square, white cross on red).
    const sf = new k.Canvas(0.36, 0.24);
    sf.rect('#d52b1e', 0.06, 0, 0.24, 0.24);
    sf.rect('#ffffff', 0.155, 0.04, 0.05, 0.16).rect('#ffffff', 0.1, 0.095, 0.16, 0.05);
    graphics['flag-swiss'] = sf.graphic('Swiss flag');
  }
  {
    // Factory NGX: a red line over a grey one from the chin sweeping up along the cabin, and a
    // second pair rising over the rear fuselage to the fin (canvas z 5.2 .. -7.6, y 1.1 .. 3.1).
    const W = 12.8,
      H = 2.0,
      z = (zz) => 5.2 - zz,
      y = (yy) => yy - 1.1;
    const c = new k.Canvas(W, H);
    const pair = (pts, red, grey, gap) => {
      const p = pts.map(([a, b]) => [z(a), y(b)]);
      const shift = (d) => p.map(([a, b]) => [a, b + d]);
      swoosh(
        c,
        NGX_GREY,
        shift(-gap),
        shift(-gap - grey).map(([a, b], i) => (i === 0 || i === 3 ? [a, b + grey] : [a, b])),
      );
      swoosh(
        c,
        NGX_RED,
        p,
        shift(-red).map(([a, b], i) => (i === 0 || i === 3 ? [a, b + red] : [a, b])),
      );
    };
    pair(
      [
        [4.9, 1.45],
        [3.0, 1.5],
        [0.5, 1.8],
        [-2.6, 1.98],
      ],
      0.09,
      0.05,
      0.12,
    );
    pair(
      [
        [-2.3, 1.62],
        [-4.2, 1.76],
        [-5.8, 2.2],
        [-7.3, 3.0],
      ],
      0.08,
      0.045,
      0.11,
    );
    graphics['ngx-swoosh'] = c.graphic('Factory swooshes');
  }

  /* ---------------------------------------------------------------- zones ---- */
  /** Between (or below, with high = null) datum polylines, one zone per segment. */
  const band = (slot, color, low, high, extra = []) =>
    (low ?? high).slice(0, -1).map((_, i) => {
      const line = low ?? high;
      return {
        color,
        planes: [
          h.ahead(slot, line[i + 1][0]),
          h.behind(slot, line[i][0]),
          ...(low ? [h.line(slot, low[i], low[i + 1], 1)] : []),
          ...(high ? [h.line(slot, high[i], high[i + 1], -1)] : []),
          ...h.within(slot, 0.87),
          ...extra,
        ],
      };
    });
  const finZone = (slot, color, line = FIN_LINE) => ({
    color,
    planes: [h.line(slot, ...line, -1), h.above(slot, 2.3), ...h.within(slot, 0.2)],
  });
  const stabZone = (slot, color) => ({ color, planes: [h.above(slot, 4.08)] });
  // RFDS: red below the line, a white gap, a blue stripe sweeping up into the blue fin and
  // tailplane.
  const rfdsZones = (slot) => [
    ...band(slot, RFDS_RED, null, LINE),
    ...band(slot, RFDS_BLUE, raise(LINE, 0.05), raise(LINE, 0.13)),
    finZone(slot, RFDS_BLUE),
    stabZone(slot, RFDS_BLUE),
  ];
  // HB-FWO: graphite below the line, a red pinstripe on it, graphite fin behind a red-edged
  // diagonal and a graphite fin tip.
  const finRed = FIN_LINE.map(([z, y]) => [z + 0.06, y]);
  const silverZones = (slot) => [
    ...band(slot, GRAPHITE, null, LINE),
    ...band(slot, '#c0202d', raise(LINE, 0.0), raise(LINE, 0.035)),
    { ...finZone(slot, '#c0202d', finRed) },
    finZone(slot, GRAPHITE),
    stabZone(slot, GRAPHITE),
  ];

  /* ---------------------------------------------------------------- paints ---- */
  const solid = (color, extra = {}) => ({ color, ...extra });
  const uniform = (color, extra = {}) =>
    Object.fromEntries(
      ['shell', 'lower', 'rudder', ...SURFACES, ...GEAR].map((slot) => [slot, solid(color, extra)]),
    );
  const both = (anchor, graphic) => SIDES.map((s) => ({ anchor: `${anchor}-${s}`, graphic }));
  const swept = (anchor, graphic) =>
    SIDES.map((s) => ({ anchor: `${anchor}-${s}`, graphic, ...(s < 0 ? { flip: true } : {}) }));
  const METAL = { roughness: 0.32, metalness: 0.4 };

  const references = {
    u28: {
      title: 'U-28A Draco landing at Hurlburt Field (US Air Force photograph, public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:U-28_Draco.jpg',
    },
    u28b: {
      title:
        'U-28A Draco at Hurlburt Field, September 2, 2022 (US Air Force photograph, public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:A_U-28A_Draco_at_Hurlburt_Field,_Florida,_September_2,_2022.jpg',
    },
    finland: {
      title:
        'Finnish Air Force PC-12 PI-02 at Turku Airshow 2015 (Wikimedia Commons, public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:Pilatus_PC-12_PI-02_Turku_Airshow_2015_01.JPG',
    },
    rfds: {
      title:
        'Royal Flying Doctor Service PC-12 NG VH-OWR at Esperance (Wikimedia Commons, CC BY-SA 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Royal_Flying_Doctor_Service_of_Australia_(VH-OWR)_Pilatus_PC-12_NG_at_Esperance_Airport.jpg',
    },
    ngx: {
      title: 'Pilatus PC-12 NGX N49GX (Wikimedia Commons, CC BY-SA 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Pilatus_PC-12-47E_NGX_(N49GX,_cn_2149)_(10-20-2022).jpg',
    },
    hbfwo: {
      title: "Pilatus PC-12 NGX 'HB-FWO' (Wikimedia Commons, CC BY-SA 2.0)",
      url: 'https://commons.wikimedia.org/wiki/File:Pilatus_PC-12_NGX_%E2%80%98HB-FWO%E2%80%99_(52644871206).jpg',
    },
  };

  return {
    selected: 'factory-ngx-white-red',
    anchors,
    graphics,
    variants: [
      {
        id: 'factory-ngx-white-red',
        label: 'Pilatus NGX factory scheme',
        provenance: {
          kind: 'inspired',
          note: 'Pilatus NGX demonstrator layout from the referenced photograph of N49GX: pearl white overall with paired red and grey swooshes, one sweeping up from the chin along the cabin and one rising over the rear fuselage toward the fin, and a small grey registration. The manufacturer titles are omitted, the registration N68GX is fictional and the swoosh curves are redrawn freehand.',
          references: [references.ngx],
        },
        paints: uniform(WHITE),
        markings: [...swept('swoosh', 'ngx-swoosh'), ...both('reg-high', 'reg-n68gx')],
      },
      {
        id: 'usaf-u-28a-draco',
        label: 'US Air Force U-28A Draco',
        provenance: {
          kind: 'inspired',
          note: 'US Air Force Special Operations U-28A Draco from the referenced photographs: medium grey overall with the small US flag over the serial 60581 in light grey on the fin, redrawn as original vector art. Sensor turrets, antennas and the low-visibility stencils are not modelled; the grey is an approximation.',
          references: [references.u28, references.u28b],
        },
        paints: uniform(U28_GREY, { roughness: 0.75 }),
        markings: [...both('fin', 'u28-fin')],
      },
      {
        id: 'finnish-air-force-pi-02',
        label: 'Finnish Air Force PI-02',
        provenance: {
          kind: 'inspired',
          note: 'Finnish Air Force PC-12/47E PI-02 from the referenced photograph: light grey overall, FINNISH AIR FORCE above the rear cabin windows, the Finnish roundel and the code PI-02 on the rear fuselage, redrawn as original vector art. Applied to the NGX model; the yellow rescue corners around an exit window are omitted; approximate colors and sizes.',
          references: [references.finland],
        },
        paints: uniform(FINNISH_GREY, { roughness: 0.6 }),
        markings: [
          ...both('title', 'finnish-title'),
          ...both('roundel', 'finland-roundel'),
          ...both('serial', 'pi-02'),
        ],
      },
      {
        id: 'flying-doctor-red-white-blue',
        label: 'Flying doctor air ambulance, red, white and blue',
        provenance: {
          kind: 'inspired',
          note: "Colors and layout of the Royal Flying Doctor Service from the referenced photograph of VH-OWR: white upper fuselage, red lower fuselage and cowl, a blue stripe sweeping up the tail cone into a blue fin, tailplane and rudder, and a black registration on the rear fuselage. The service's name, RFDS fin letters and emblems are omitted; the registration VH-FXQ is fictional and the paint lines are straight-segment approximations.",
          references: [references.rfds],
        },
        paints: {
          ...uniform(WHITE),
          shell: { color: WHITE, zones: rfdsZones('shell') },
          lower: { color: WHITE, zones: rfdsZones('lower') },
          rudder: solid(RFDS_BLUE),
          'elevator-1': solid(RFDS_BLUE),
          'elevator--1': solid(RFDS_BLUE),
          'gear-0': solid(RFDS_RED),
          'gear-1': solid(RFDS_RED),
          'gear-2': solid(RFDS_RED),
        },
        markings: [...both('reg-high', 'reg-vh-fxq')],
      },
      {
        id: 'swiss-silver-graphite',
        label: 'Swiss operator, silver and graphite',
        provenance: {
          kind: 'inspired',
          note: 'Corporate scheme of the referenced photograph of HB-FWO: silver metallic upper fuselage and wings, graphite lower fuselage under a red pinstripe that sweeps up the tail cone and along a diagonal across the fin, graphite rear fin, rudder and tailplane with the Swiss flag at the fin tip, and the registration on the rear fuselage. The registration HB-FQX is fictional; the red rescue marks are omitted.',
          references: [references.hbfwo],
        },
        paints: {
          ...uniform(SILVER, METAL),
          shell: { color: SILVER, ...METAL, zones: silverZones('shell') },
          lower: { color: SILVER, ...METAL, zones: silverZones('lower') },
          rudder: solid(GRAPHITE),
          'elevator-1': solid(GRAPHITE),
          'elevator--1': solid(GRAPHITE),
          'gear-0': solid(GRAPHITE),
          'gear-1': solid(GRAPHITE),
          'gear-2': solid(GRAPHITE),
        },
        markings: [...both('reg', 'reg-hb-fqx'), ...both('fin-top', 'flag-swiss')],
      },
    ],
  };
}
