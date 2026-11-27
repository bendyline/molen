/**
 * Cessna 208B Grand Caravan EX liveries: the Textron Aviation factory demonstrator scheme, the
 * Iraqi Air Force C-208B trainer and AC-208 Combat Caravan, and the Honduran Air Force EX.
 *
 * Military schemes carry their real titles, serials, flags and roundels redrawn as original
 * vector art; the civil scheme has a fictional registration and no logos. Paint regions are
 * authored in model metres and applied to every paint slot (shell and cargo pod, the baked belt
 * strip, flaps, ailerons, elevators and the rudder skin).
 */
import {
  above,
  ahead,
  behind,
  below,
  front,
  half,
  inboard,
  leftOf,
  lettering,
  over,
  paintSlots,
  rightOf,
  SideArt,
  taper,
  under,
} from '../art-ga-a.mjs';

const SHELL = 'body-Caravan-shell-Caravan-white',
  ACCENT = 'accent-Caravan-shell-Caravan-blue',
  RUDDER = 'accent-Caravan-rudder-Caravan-blue';

const WHITE = '#f2f2ef',
  BROWN = '#2a1f1d',
  BLACK = '#141517',
  SILVER = '#9fa4a8',
  IRAQ_LIGHT = '#a7b1ba',
  GUNSHIP = '#50565b',
  HONDURAS = '#949ca2',
  HN_BLUE = '#0b3fa6';

/** Black de-ice boots: wing, stabilizer and fin leading edges. */
const boots = [
  {
    color: BLACK,
    roughness: 0.85,
    planes: [half([0.034, 0, 1], [1, 0, 0.47]), above(2.55), leftOf(0.95)],
  },
  {
    color: BLACK,
    roughness: 0.85,
    planes: [half([-0.034, 0, 1], [-1, 0, 0.47]), above(2.55), rightOf(-0.95)],
  },
  {
    color: BLACK,
    roughness: 0.85,
    planes: [behind(-5.95), ahead(-6.25), above(2.15), below(2.45), leftOf(0.33)],
  },
  {
    color: BLACK,
    roughness: 0.85,
    planes: [behind(-5.95), ahead(-6.25), above(2.15), below(2.45), rightOf(-0.33)],
  },
  {
    color: BLACK,
    roughness: 0.85,
    planes: [front([-6.12, 3.05], [-7.05, 4.57]), above(3.15), ...inboard(0.2)],
  },
];

/** Iraqi flag (2008 pattern); the green takbir is drawn as simplified strokes. */
function iraqFlag(k, w, h) {
  const c = new k.Canvas(w, h);
  c.rect('#ce1126', 0, (2 * h) / 3, w, h / 3);
  c.rect('#ffffff', 0, h / 3, w, h / 3);
  c.rect('#141414', 0, 0, w, h / 3);
  const g = '#007a3d',
    y = h / 2,
    sw = h * 0.05;
  c.rect(g, w * 0.2, y - sw * 1.6, w * 0.6, sw);
  for (const x of [0.28, 0.46, 0.62, 0.74]) c.rect(g, w * x, y - sw * 1.6, sw, h * 0.2);
  c.box(g, w * 0.36, y + h * 0.02, w * 0.12, sw, 0.6);
  return c.graphic('Iraqi flag');
}

/** Honduran flag: blue, white, blue with five blue stars in the white band. */
function hondurasFlag(k, w, h) {
  const c = new k.Canvas(w, h);
  c.rect(HN_BLUE, 0, 0, w, h);
  c.rect('#ffffff', 0, h / 3, w, h / 3);
  const r = h * 0.045;
  for (const [dx, dy] of [
    [0, 0],
    [-0.09, 0.05],
    [-0.09, -0.05],
    [0.09, 0.05],
    [0.09, -0.05],
  ])
    c.star(HN_BLUE, w / 2 + dx * w, h / 2 + dy * h, r);
  return c.graphic('Honduran flag');
}

/** Honduran Air Force roundel: blue, white and blue vertical bands in a disc, a blue star. */
function hondurasRoundel(c, cx, cy, r) {
  c.circle('#ffffff', cx, cy, r * 1.06, 48);
  // The disc clipped to a vertical band x0..x1.
  const disc = (x0, x1) => {
    let pts = Array.from({ length: 48 }, (_, i) => {
      const a = (i * Math.PI * 2) / 48;
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    });
    for (const [limit, keep] of [
      [x0, 1],
      [x1, -1],
    ]) {
      const out = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i],
          b = pts[(i + 1) % pts.length];
        const ina = (a[0] - limit) * keep >= 0,
          inb = (b[0] - limit) * keep >= 0;
        if (ina) out.push(a);
        if (ina !== inb) {
          const t = (limit - a[0]) / (b[0] - a[0]);
          out.push([limit, a[1] + (b[1] - a[1]) * t]);
        }
      }
      pts = out;
    }
    return pts;
  };
  c.add(HN_BLUE, disc(cx - r, cx - r / 3));
  c.add(HN_BLUE, disc(cx + r / 3, cx + r));
  c.star(HN_BLUE, cx, cy, r * 0.28);
  return c;
}

export default function design({ kit: k, space, slots: all }) {
  const painted = Object.keys(all).filter((n) => space.bounds[n]);
  const paint = (base, regions, finish) => paintSlots(space, painted, base, regions, finish);
  const anchors = {},
    graphics = {};
  const sideArt = (name, art, { reach = 0.95, layers = [SHELL], mirror = true } = {}) => {
    layers.forEach((slot, i) => {
      Object.assign(anchors, art.anchors(space, slot, `${name}.${i}`, { reach }));
    });
    graphics[name] = art.graphic(name);
    return layers.flatMap((_, i) => [
      { anchor: `${name}.${i}-l`, graphic: name },
      { anchor: `${name}.${i}-r`, graphic: name, ...(mirror ? { flip: true } : {}) },
    ]);
  };
  const text = (
    name,
    label,
    { z, y, width, height, color, layers = [SHELL], reach = 0.95, ...opts },
  ) => {
    const art = new SideArt(k, {
      zFront: z + width / 2,
      zRear: z - width / 2,
      yBottom: y - height / 2,
      yTop: y + height / 2,
    });
    layers.forEach((slot, i) => {
      Object.assign(anchors, art.anchors(space, slot, `${name}.${i}`, { reach }));
    });
    graphics[name] = lettering(k, label, { width, height, color, ...opts });
    return layers.flatMap((_, i) => [
      { anchor: `${name}.${i}-l`, graphic: name },
      { anchor: `${name}.${i}-r`, graphic: name },
    ]);
  };
  /** A flag or roundel graphic (already in `graphics`) on both sides; flags fly hoist forward. */
  const mark = (name, graphic, box, { reach = 0.95, layers = [SHELL], mirror = true } = {}) => {
    const art = new SideArt(k, box);
    layers.forEach((slot, i) => {
      Object.assign(anchors, art.anchors(space, slot, `${name}.${i}`, { reach }));
    });
    return layers.flatMap((_, i) => [
      { anchor: `${name}.${i}-l`, graphic },
      { anchor: `${name}.${i}-r`, graphic, ...(mirror ? { flip: true } : {}) },
    ]);
  };

  /* ---------------------------------------------------- Textron factory EX ---- */
  // Dark brown lower fuselage and cargo pod under fine pinstripes; black fin with white
  // pinstripes at its root.
  const belly = (z) =>
    z >= -2.6 ? 1.4 + ((z + 2.6) / 7.35) * 0.22 : 1.4 + ((-2.6 - z) / 4.8) * 0.38;
  const textron = [
    {
      color: BROWN,
      planes: [ahead(-2.6), under([4.75, 1.62], [-2.6, 1.4]), above(0.3), ...inboard(0.95)],
    },
    { color: BROWN, planes: [behind(-2.6), under([-2.6, 1.4], [-7.4, 1.78]), ...inboard(0.95)] },
    { color: BLACK, planes: [behind(-3.7), over([-3.7, 2.74], [-7.7, 3.1]), ...inboard(0.3)] },
  ];
  const pins = new SideArt(k, { zFront: 4.7, zRear: -7.2, yBottom: 1.4, yTop: 2.1 });
  const along = (from, to, dy, step = 0.6) => {
    const pts = [];
    for (let z = from; z > to; z -= step) pts.push([z, belly(z) + dy]);
    pts.push([to, belly(to) + dy]);
    return pts;
  };
  for (const [from, to, dy, w, color] of [
    [4.6, -7.1, 0.055, 0.03, BROWN],
    [3.9, -6.4, 0.11, 0.024, BROWN],
    [2.8, -5.2, 0.16, 0.018, SILVER],
    [1.4, -3.9, 0.205, 0.014, BROWN],
  ])
    pins.between(color, ...taper(along(from, to, dy), w, { lead: 0.12, trail: 0.25 }));
  const textronPins = sideArt('ex-pins', pins, { layers: [SHELL, ACCENT] });
  const finPins = new SideArt(k, { zFront: -3.8, zRear: -7.7, yBottom: 2.7, yTop: 3.4 });
  for (const [dy, w] of [
    [0.1, 0.035],
    [0.17, 0.02],
    [0.225, 0.012],
  ])
    finPins.between(
      WHITE,
      ...taper(
        [
          [-3.9, 2.74 + dy],
          [-5.8, 2.92 + dy],
          [-7.7, 3.1 + dy],
        ],
        w,
        { lead: 0.25, trail: 0 },
      ),
    );
  const textronFin = sideArt('ex-fin-pins', finPins, { reach: 0.35, layers: [SHELL, RUDDER] });
  const textronReg = text('reg-n563ex', 'N563EX', {
    z: -4.75,
    y: 2.15,
    width: 2.1,
    height: 0.42,
    cap: 0.36,
    color: BLACK,
  });

  /* ---------------------------------------------------- Iraqi Air Force ---- */
  graphics['iraq-flag'] = iraqFlag(k, 0.42, 0.28);
  const iraqFlagMarks = mark(
    'iraq-flag',
    'iraq-flag',
    { zFront: -6.82, zRear: -7.24, yBottom: 4.09, yTop: 4.37 },
    { reach: 0.3 },
  );
  const iraqTitle = text('iraq-title', 'IRAQI AIR FORCE', {
    z: -2.85,
    y: 1.76,
    width: 2.0,
    height: 0.2,
    color: BLACK,
  });
  const iraqSerial = text('iraq-serial', 'YI-116', {
    z: -4.55,
    y: 2.42,
    width: 0.85,
    height: 0.2,
    color: BLACK,
  });
  const acTitle = text('ac-title', 'IRAQI AIR FORCE', {
    z: -1.25,
    y: 1.78,
    width: 2.0,
    height: 0.2,
    color: '#26292c',
  });
  const acSerial = text('ac-serial', 'YI-112', {
    z: -6.84,
    y: 3.4,
    width: 0.98,
    height: 0.3,
    cap: 0.22,
    color: '#c9cdd0',
    layers: [SHELL, RUDDER],
    reach: 0.3,
  });

  /* ---------------------------------------------------- Honduran Air Force ---- */
  graphics['hn-flag'] = hondurasFlag(k, 0.5, 0.3);
  const hnFlag = mark(
    'hn-flag',
    'hn-flag',
    { zFront: -6.74, zRear: -7.22, yBottom: 3.95, yTop: 4.24 },
    { reach: 0.3 },
  );
  const hnTitle = text('hn-title', 'FUERZA AEREA HONDUREÑA', {
    z: -1.2,
    y: 1.74,
    width: 3.7,
    height: 0.3,
    cap: 0.17,
    color: BLACK,
  });
  const hnSerial = text('hn-serial', 'FAH 021', {
    z: -6.84,
    y: 3.42,
    width: 0.98,
    height: 0.26,
    cap: 0.2,
    color: '#25282b',
    layers: [SHELL, RUDDER],
    reach: 0.3,
  });
  graphics['hn-roundel'] = hondurasRoundel(new k.Canvas(0.5, 0.5), 0.25, 0.25, 0.22).graphic(
    'Honduran Air Force roundel',
  );
  const hnRoundel = mark(
    'hn-roundel',
    'hn-roundel',
    { zFront: -4.05, zRear: -4.55, yBottom: 1.75, yTop: 2.25 },
    { mirror: false },
  );

  const references = {
    textron: {
      title: 'Cessna 208B Grand Caravan EX N727EX at Oshkosh (Wikimedia Commons, CC BY-SA 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Cessna_208B_Grand_Caravan_EX_(N727EX,_cn_208B5727)_(7-29-2023).jpg',
    },
    iraq: {
      title: 'Iraqi Air Force C-208 in flight (US Air Force photo, public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:Iraqi_Air_Force_C-208.jpg',
    },
    ac208: {
      title: 'Iraqi Cessna AC-208 YI-112 (US Air Force photo, public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:Iraqi_Cessna_AC-208.jpg',
    },
    honduras: {
      title:
        'Honduras Air Force FAH-021 Cessna 208B Grand Caravan EX at Toncontín (Wikimedia Commons, GFDL 1.2)',
      url: 'https://commons.wikimedia.org/wiki/File:Honduras_Air_Force_(FAH-021)_Cessna_208B_Grand_Caravan_EX_at_Toncont%C3%ADn_International_Airport.jpg',
    },
  };

  return {
    selected: 'textron-ex-2023',
    anchors,
    graphics,
    variants: [
      {
        id: 'textron-ex-2023',
        label: 'Grand Caravan EX factory scheme, 2023',
        provenance: {
          kind: 'inspired',
          note: 'Textron Aviation’s Grand Caravan EX demonstrator scheme from the referenced photograph: white over a near-black brown lower fuselage and cargo pod, fine brown and silver pinstripes along the split, a black fin and rudder with white pinstripes at the root and a large black registration. The Grand Caravan EX fin logo is omitted; registration N563EX is fictional. Approximate colors.',
          references: [references.textron],
        },
        paints: paint(WHITE, textron),
        markings: [...textronPins, ...textronFin, ...textronReg],
      },
      {
        id: 'iraqi-air-force-c-208b',
        label: 'Iraqi Air Force C-208B, 2009',
        provenance: {
          kind: 'inspired',
          note: 'Iraqi Air Force C-208B trainer from the referenced USAF photograph: light blue-gray overall with black de-ice boots on the wing, stabilizer and fin leading edges, IRAQI AIR FORCE on the rear cabin, serial YI-116 ahead of the fin and the national flag near the fin tip (original vector art; the flag’s green takbir is simplified). Approximate colors and sizes.',
          references: [references.iraq],
        },
        paints: paint(IRAQ_LIGHT, boots, { roughness: 0.55 }),
        markings: [...iraqTitle, ...iraqSerial, ...iraqFlagMarks],
      },
      {
        id: 'iraqi-ac-208',
        label: 'Iraqi Air Force AC-208 Combat Caravan',
        provenance: {
          kind: 'inspired',
          note: 'Iraqi Air Force AC-208 from the referenced USAF photograph: dark gunship gray overall with black de-ice boots, a low-contrast IRAQI AIR FORCE title under the cabin windows, serial YI-112 in light gray on the fin and the national flag near the fin tip (original vector art; the flag’s takbir is simplified). The sensor turret and weapon rails are not modeled. Approximate colors.',
          references: [references.ac208],
        },
        paints: paint(GUNSHIP, boots, { roughness: 0.6 }),
        markings: [...acTitle, ...acSerial, ...iraqFlagMarks],
      },
      {
        id: 'honduran-air-force',
        label: 'Honduran Air Force Grand Caravan EX',
        provenance: {
          kind: 'inspired',
          note: 'Fuerza Aérea Hondureña Grand Caravan EX FAH 021 from the referenced photograph: medium gray overall with FUERZA AEREA HONDUREÑA along the cabin, the blue and white roundel with its star on the rear fuselage, the national flag and FAH 021 on the fin (original vector art). Approximate colors and sizes.',
          references: [references.honduras],
        },
        paints: paint(HONDURAS, [], { roughness: 0.55 }),
        markings: [...hnTitle, ...hnRoundel, ...hnFlag, ...hnSerial],
      },
    ],
  };
}
