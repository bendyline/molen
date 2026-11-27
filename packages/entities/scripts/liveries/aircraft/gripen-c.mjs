/**
 * JAS 39C Gripen liveries: the Swedish Air Force and the Gripen's export operators, each from
 * photographs. All fly the same two-gray Saab scheme (medium gray upper, lighter gray belly);
 * they differ in national markings, serials and unit marks. National insignia are original
 * vector drawings (art-fighters-b.mjs); the model carries no baked markings of its own.
 *
 * Model frame: +Z nose, +X the aircraft's left, +Y up. Single fin in the x = 0 plane, 7 cm
 * thick: leading edge (y 2.43, z -2.75) to (4.5, -5.33), rudder hinge (2.27, -5.40) to
 * (3.72, -5.54), the fin-top fairing at y 4.0. Forward fuselage side at x 0.48 (z 3.5 to 5).
 */
import {
  czechRoundel,
  hungaryTriangle,
  leanLivery,
  swedenRoundel,
  textGraphic,
} from '../art-fighters-b.mjs';

const UPPER = '#7d878e', // Saab medium gray (about FS 36270)
  LOWER = '#979fa4', // lighter belly gray (about FS 36375)
  INK = '#363d43'; // dark gray tactical lettering

const AIRFRAME = 'body-Gripen-airframe-Gripen-gray';

export default function design({ kit: k, space, slots: all, bounds }) {
  const anchors = {};
  const sideAnchor = (name, x, y, z, w, h, depth = 0.4) => {
    for (const side of [1, -1])
      anchors[`${name}-${side}`] = space.anchor(AIRFRAME, {
        center: [side * x, y, z],
        facing: [side, 0, 0],
        width: w,
        height: h,
        depth,
      });
  };
  // Fin (ahead of the rudder hinge at z -5.4 to -5.55).
  sideAnchor('fin-number', 0.04, 3.1, -4.78, 1.0, 0.44, 0.3);
  sideAnchor('fin-mark', 0.04, 3.52, -5.1, 0.5, 0.5, 0.3);
  sideAnchor('fin-title', 0.04, 3.16, -5.1, 0.7, 0.07, 0.3);
  sideAnchor('fin-type', 0.04, 2.72, -4.6, 0.55, 0.1, 0.3);
  sideAnchor('fin-triangle', 0.04, 3.22, -5.08, 0.76, 0.48, 0.3);
  sideAnchor('fin-bird', 0.04, 3.66, -5.1, 0.26, 0.3, 0.3);
  sideAnchor('fin-unit', 0.04, 2.84, -4.62, 0.62, 0.22, 0.3);
  sideAnchor('fin-flag', 0.04, 3.67, -5.22, 0.46, 0.31, 0.3);
  sideAnchor('fin-badge', 0.04, 3.17, -5.2, 0.5, 0.5, 0.3);
  sideAnchor('fin-low-number', 0.04, 2.86, -4.36, 0.66, 0.4, 0.3);
  sideAnchor('fin-thai-flag', 0.04, 3.6, -5.3, 0.3, 0.2, 0.3);
  sideAnchor('fin-shark', 0.04, 3.15, -5.05, 0.46, 0.46, 0.3);
  sideAnchor('fin-serial', 0.04, 2.73, -4.55, 0.7, 0.2, 0.3);
  sideAnchor('aft-roundel', 0.7, 2.13, -2.5, 0.32, 0.32, 0.4);
  // Forward fuselage: roundel ahead of the intake, unit badge and nose numbers.
  sideAnchor('nose-roundel', 0.49, 1.72, 4.3, 0.46, 0.46, 0.5);
  sideAnchor('nose-big-number', 0.49, 1.68, 4.1, 0.75, 0.56, 0.5);
  sideAnchor('nose-badge', 0.44, 1.66, 5.25, 0.24, 0.24, 0.5);
  sideAnchor('nose-number', 0.46, 1.68, 4.95, 0.9, 0.34, 0.5);
  // Wings: roundels above and below, outboard at mid chord, both wings.
  for (const side of [1, -1])
    for (const [face, y] of [
      ['upper', 1.74],
      ['lower', 1.69],
    ])
      anchors[`wing-${face}-${side}`] = space.anchor(AIRFRAME, {
        center: [side * 2.95, y, -3.15],
        facing: [0, face === 'upper' ? 1 : -1, 0],
        up: [0, 0, 1],
        width: 0.8,
        height: 0.8,
        depth: 0.2,
      });

  const text = (label, w, h, color, opts) => textGraphic(k, label, w, h, color, opts);
  const disc = (draw, size, label) => {
    const c = new k.Canvas(size, size);
    draw(c, size / 2, size / 2, size / 2 - 0.004);
    return c.graphic(label);
  };
  // Normalized art: one graphic serves the fuselage and the larger wing projectors.
  const graphics = {
    'sweden-lowvis': disc(
      (c, x, y, r) => swedenRoundel(c, x, y, r, { lowvis: true, color: INK }),
      0.46,
      'Swedish roundel (low visibility)',
    ),
    'czech-lowvis': disc(
      (c, x, y, r) => czechRoundel(c, x, y, r, { lowvis: true, color: INK }),
      0.5,
      'Czech roundel (low visibility)',
    ),
    'hungary-lowvis': (() => {
      const c = new k.Canvas(0.76, 0.48);
      hungaryTriangle(c, 0.38, 0.24, 0.46, { lowvis: true });
      return c.graphic('Hungarian triangle (low visibility)');
    })(),
  };

  // Base paint: medium gray everywhere, the lower fuselage lighter below the chine line.
  const belly = [{ color: LOWER, planes: [space.below(AIRFRAME, 1.42)] }];
  const paints = (upper = UPPER, lower = belly) =>
    Object.fromEntries(
      Object.keys(all).map((name) => [
        name,
        name === AIRFRAME && lower ? { color: upper, zones: lower } : { color: upper },
      ]),
    );
  const both = (anchor, graphic, flipRight = false) => [
    { anchor: `${anchor}-1`, graphic },
    { anchor: `${anchor}--1`, graphic, ...(flipRight ? { flip: true } : {}) },
  ];
  const wings = (graphic) => ['upper', 'lower'].flatMap((face) => both(`wing-${face}`, graphic));

  // Lettering.
  graphics['number-228'] = text('228', 1.0, 0.44, INK, { fill: 0.84 });
  graphics['number-9241'] = text('9241', 0.9, 0.34, INK, { fill: 0.78 });
  graphics['czech-title'] = text('CZECH AIR FORCE', 0.7, 0.07, INK, { fill: 0.7 });
  graphics['type-jas39c'] = text('JAS 39C', 0.55, 0.1, INK, { fill: 0.8 });
  graphics['number-31'] = text('31', 0.75, 0.56, INK, { fill: 0.9 });
  graphics['number-20'] = text('20', 0.66, 0.4, '#555e64', { fill: 0.9 });
  graphics.hunaf = (() => {
    const c = new k.Canvas(0.62, 0.22);
    c.text(INK, 'HUNAF', { x: 0.31, y: 0.16, height: 0.09 });
    c.text(INK, '59th TFW', { x: 0.31, y: 0.045, height: 0.06 });
    return c.graphic('HUNAF 59th TFW');
  })();

  // Hungarian 59th wing bird badge: a stooping falcon in a ring, simplified.
  graphics['hungary-bird'] = (() => {
    const c = new k.Canvas(0.26, 0.3);
    c.path(
      INK,
      'M10 30 C20 18 34 16 46 26 L50 34 L54 26 C66 16 80 18 90 30 C78 28 66 32 58 42 ' +
        'L56 54 C60 60 58 68 50 72 C42 68 40 60 44 54 L42 42 C34 32 22 28 10 30 Z',
      { viewBox: [0, 0, 100, 100], x: 0, y: 0, w: 0.26, h: 0.3, segments: 4 },
    );
    c.ring(INK, 0.13, 0.08, 0.035, 0.05, 24);
    return c.graphic('59th Wing badge (simplified)');
  })();

  // South Africa: the flag, the low-visibility Castle roundel and the badge disc.
  graphics['flag-south-africa'] = (() => {
    const w = 0.46,
      h = 0.31,
      c = new k.Canvas(w, h);
    c.rect('#e03c31', 0, h / 2, w, h / 2);
    c.rect('#001489', 0, 0, w, h / 2);
    const jx = w * 0.42;
    const arm = (color, t) => {
      c.rect(color, jx, h / 2 - t / 2, w - jx, t);
      for (const sy of [1, -1]) {
        const ex = -0.02,
          ey = h / 2 + sy * (h / 2 + 0.03);
        const len = Math.hypot(jx - ex, h / 2 - ey);
        c.box(
          color,
          (jx + ex) / 2,
          (h / 2 + ey) / 2,
          len + t * 0.6,
          t,
          Math.atan2(h / 2 - ey, jx - ex),
        );
      }
    };
    arm('#ffffff', h * 0.34);
    arm('#007749', h * 0.2);
    c.add('#ffb81c', [
      [0, h * 0.14],
      [w * 0.36, h / 2],
      [0, h * 0.86],
    ]);
    c.add('#111111', [
      [0, h * 0.24],
      [w * 0.27, h / 2],
      [0, h * 0.76],
    ]);
    return c.graphic('Flag of South Africa');
  })();
  graphics['saaf-castle'] = (() => {
    const c = new k.Canvas(0.46, 0.46);
    // The Castle of Good Hope outline: a serrated ring of nine bastion points.
    const ring = (r0, r1) =>
      Array.from({ length: 36 }, (_, i) => {
        const a = (i * Math.PI * 2) / 36 + Math.PI / 2;
        const r = i % 4 === 0 ? r1 : i % 4 === 2 ? r0 : (r0 + r1) / 2;
        return [0.23 + Math.cos(a) * r, 0.23 + Math.sin(a) * r];
      });
    c.add('#5d666b', ring(0.17, 0.225), [[...ring(0.15, 0.2)].reverse()]);
    // Eagle with spread wings, simplified.
    c.path(
      '#5d666b',
      'M14 40 C24 34 36 34 46 42 L50 36 L54 42 C64 34 76 34 86 40 C74 44 64 48 56 54 ' +
        'L54 70 L50 66 L46 70 L44 54 C36 48 26 44 14 40 Z',
      { viewBox: [0, 0, 100, 100], x: 0, y: 0, w: 0.46, h: 0.46, segments: 4 },
    );
    return c.graphic('SAAF Castle roundel (low visibility)');
  })();
  graphics['saaf-badge'] = (() => {
    const c = new k.Canvas(0.5, 0.5);
    c.circle('#5d666b', 0.25, 0.25, 0.245, 40);
    // A stooping bird with raised wings above a scroll, in lighter gray (simplified).
    c.path(
      '#a7afb3',
      'M30 22 C34 34 40 42 48 48 L46 30 L52 46 C58 40 64 32 70 22 C70 38 62 52 52 58 ' +
        'L54 66 L46 66 L48 58 C38 52 30 38 30 22 Z',
      { viewBox: [0, 0, 100, 100], x: 0, y: 0, w: 0.5, h: 0.5, segments: 4 },
    );
    c.path('#a7afb3', 'M24 72 C40 66 60 66 76 72 L72 78 C58 74 42 74 28 78 Z', {
      viewBox: [0, 0, 100, 100],
      x: 0,
      y: 0,
      w: 0.5,
      h: 0.5,
      segments: 4,
    });
    return c.graphic('2 Squadron badge disc (simplified)');
  })();

  // Royal Thai Air Force 701 Squadron: the flag, the leaping shark, 70106 and the roundel
  // (red, white, navy, white, red).
  graphics['flag-thailand'] = (() => {
    const c = new k.Canvas(0.3, 0.2);
    const bands = [
      ['#a51931', 1],
      ['#f4f5f8', 1],
      ['#2d2a4a', 2],
      ['#f4f5f8', 1],
      ['#a51931', 1],
    ];
    let y = 0.2;
    for (const [color, n] of bands) {
      c.rect(color, 0, y - (0.2 * n) / 6, 0.3, (0.2 * n) / 6);
      y -= (0.2 * n) / 6;
    }
    return c.graphic('Flag of Thailand');
  })();
  graphics['roundel-thailand'] = (() => {
    const c = new k.Canvas(0.32, 0.32);
    k.roundel(
      c,
      0.16,
      0.16,
      0.155,
      ['#d2102c', '#f4f5f8', '#0f2a52', '#f4f5f8', '#d2102c'],
      [0.1, 0.23, 0.33, 0.17, 0.17],
    );
    return c.graphic('Royal Thai Air Force roundel');
  })();
  graphics['shark-701'] = (() => {
    const c = new k.Canvas(0.46, 0.46);
    // A shark leaping up and forward (canvas left), original silhouette: open jaw, dorsal
    // and pectoral fins, the tail flicked down aft.
    c.path(
      '#eef0ee',
      'M14 26 L24 18 L30 24 L26 30 L34 30 C44 30 54 34 62 42 L70 30 L72 46 C78 54 82 64 84 76 ' +
        'L96 84 L82 86 L88 98 L76 88 C70 78 62 70 52 64 L46 74 L42 60 C34 54 26 46 22 38 Z',
      { viewBox: [0, 0, 100, 100], x: 0, y: 0, w: 0.46, h: 0.46, segments: 4 },
    );
    return c.graphic('701 Squadron shark (simplified)');
  })();
  graphics['serial-70106'] = text('70106', 0.7, 0.2, INK, { fill: 0.84 });

  const references = {
    sweden: {
      title: 'JAS 39C Gripen 39228 of the Swedish Air Force (Hallstaspotter, CC BY-SA 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:JAS_39C_39228.jpg',
    },
    czech: {
      title: 'Czech Air Force JAS 39C Gripen 9241 taxiing (public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:Saab.jas39c.gripen.taxi.arp.jpg',
    },
    hungary: {
      title: 'Hungarian Air Force JAS 39C Gripen 31 (CC BY 2.0)',
      url: 'https://commons.wikimedia.org/wiki/File:HUNGARIAN_AIR_FORCE_SAAB_JAS-39C_GRIPEN_31_(52247155611).jpg',
    },
    thailand: {
      title: 'Royal Thai Air Force JAS 39C 70106 of 701 Squadron in Australia (CC BY 2.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Saab_JAS_39_Gripen_70106_(Royal_Thai_Air_Force)_in_Australia.jpg',
    },
    thaiCamo: {
      title: 'Royal Thai Air Force Gripen C from below, two-tone gray (CC BY-SA 3.0)',
      url: 'https://commons.wikimedia.org/wiki/File:RATF_GRIPEN_C.JPG',
    },
    roundelThai: {
      title: 'Roundel of Thailand (public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:Roundel_of_Thailand.svg',
    },
    southAfrica: {
      title: "SAAF JAS 39C Gripen '3920 - 20' of 2 Squadron (CC BY-SA 2.0)",
      url: "https://commons.wikimedia.org/wiki/File:Saab_JAS-39C_Gripen_'3920_-_20'_(16667130587).jpg",
    },
  };

  const built = {
    selected: 'sweden-f7-228',
    anchors,
    graphics,
    variants: [
      {
        id: 'sweden-f7-228',
        label: 'Swedish Air Force, F 7 Skaraborg (228)',
        provenance: {
          kind: 'inspired',
          note: 'JAS 39C 39228 from the referenced photograph: Saab medium gray with a lighter belly, the tactical number 228 in dark gray on the fin, the low-visibility Swedish roundel (dark ring and three crowns, original drawing) on the forward fuselage and above and below both wings. The F 7 wing badge on the nose and the small stencils are omitted.',
          references: [references.sweden],
        },
        paints: paints(),
        markings: [
          ...both('fin-number', 'number-228'),
          ...both('nose-roundel', 'sweden-lowvis'),
          ...wings('sweden-lowvis'),
        ],
      },
      {
        id: 'czech-211-tactical-squadron',
        label: 'Czech Air Force, 211th Tactical Squadron (9241)',
        provenance: {
          kind: 'inspired',
          note: 'JAS 39C 9241 of the 21st Tactical Air Force Base, Caslav, from the referenced photograph: Saab two-gray scheme, the low-visibility Czech roundel on the fin (outline, solid blue sector, hatched red sector, blue sector leading on both sides) with CZECH AIR FORCE beneath, JAS 39C on the lower fin, the serial 9241 on the nose and the same roundel on the wings. Stencils are omitted.',
          references: [references.czech],
        },
        paints: paints(),
        markings: [
          ...both('fin-mark', 'czech-lowvis', true),
          ...both('fin-title', 'czech-title'),
          ...both('fin-type', 'type-jas39c'),
          ...both('nose-number', 'number-9241'),
          ...wings('czech-lowvis'),
        ],
      },
      {
        id: 'hungary-59th-wing-31',
        label: 'Hungarian Air Force, 59th Tactical Fighter Wing (31)',
        provenance: {
          kind: 'inspired',
          note: 'JAS 39C 31 of the 59th Tactical Fighter Wing, Kecskemet, from the referenced photograph: Saab two-gray scheme, the large dark gray 31 on the forward fuselage, and on the fin the low-visibility national triangle (white outline round gray bands, apex forward), the wing falcon badge (simplified) and HUNAF 59th TFW. The small nose badge, stencils and wing markings are omitted (not visible in the reference).',
          references: [references.hungary],
        },
        paints: paints(),
        markings: [
          ...both('nose-big-number', 'number-31'),
          ...both('fin-triangle', 'hungary-lowvis', true),
          ...both('fin-bird', 'hungary-bird'),
          ...both('fin-unit', 'hunaf'),
        ],
      },
      {
        id: 'saaf-2-squadron-3920',
        label: 'South African Air Force, 2 Squadron (3920)',
        provenance: {
          kind: 'inspired',
          note: 'JAS 39C 3920 of 2 Squadron, AFB Makhado, from the referenced photograph: Saab two-gray scheme, the full-color South African flag at the top of the fin (hoist forward on both sides), the squadron badge disc (simplified bird and scroll) and the number 20 on the fin, and the low-visibility Castle roundel with its eagle (simplified) on the nose. Stencils and wing markings are omitted.',
          references: [references.southAfrica],
        },
        paints: paints(),
        markings: [
          ...both('fin-flag', 'flag-south-africa', true),
          ...both('fin-badge', 'saaf-badge'),
          ...both('fin-low-number', 'number-20'),
          ...both('nose-roundel', 'saaf-castle'),
        ],
      },
      {
        id: 'royal-thai-701-squadron-70106',
        label: 'Royal Thai Air Force, 701 Squadron (70106)',
        provenance: {
          kind: 'inspired',
          note: 'JAS 39C 70106 of 701 Squadron, Wing 7 Surat Thani, from the referenced photographs: the Saab two-gray scheme (the photographed underside is a uniform light gray without wing roundels), the flag of Thailand at the top of the fin, the white leaping shark of 701 Squadron (original silhouette, leaping forward on both sides) and 70106 in dark gray on the fin, and the RTAF roundel (red, white, navy, white, red) on the rear fuselage below the fin. Stencils are omitted.',
          references: [references.thailand, references.thaiCamo, references.roundelThai],
        },
        paints: paints(),
        markings: [
          ...both('fin-thai-flag', 'flag-thailand'),
          ...both('fin-shark', 'shark-701', true),
          ...both('fin-serial', 'serial-70106'),
          ...both('aft-roundel', 'roundel-thailand'),
        ],
      },
    ],
  };
  return leanLivery(built, bounds);
}
