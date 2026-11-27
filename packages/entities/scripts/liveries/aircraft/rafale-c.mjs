/**
 * Rafale C liveries: the French Air and Space Force (a front-line squadron, the 2014 Tiger
 * Meet scheme and the Rafale Solo Display) and Rafale export operators, each studied from
 * photographs. National markings and unit art are original vector drawings; the model itself
 * carries no national markings.
 *
 * Model frame: +Z nose, +X the aircraft's left, +Y up. One fin in the x = 0 plane, 5 to 15 cm
 * thick: root y 2.64 (leading edge z -1.2) to the tip at y 4.95; the rudder behind the hinge
 * line (y 2.66, z -5.04) to (4.91, -6.25) is its own slot. Upper fuselage shoulder at the wing
 * root: x 1.3 to 1.6, y 2.0 to 2.2 (z -1 to 1); nose side x 0.68 (z 3.5 to 4).
 */
import { leanLivery, stripesH, textGraphic } from '../art-fighters-b.mjs';

// Paint slots: the existing ones without the catch-all 'body' slot (it overlaps them all).
export function slots(existing) {
  return Object.fromEntries(Object.entries(existing).filter(([name]) => name !== 'body'));
}

const GRAY = '#858e94', // Rafale gray (French Air Force)
  INK = '#3a4247', // dark gray stencil lettering
  WHITE = '#f2f3f1',
  BLUE = '#1f3e8f',
  NAVY = '#18264a',
  RED = '#cf1f2e',
  BLACK = '#141414';

const AIRFRAME = 'body-Rafale-airframe-Rafale-gray',
  RUDDER = 'body-Rafale-rudder-Rafale-gray';
// The fin's art canvas: z from -1.2 (root leading edge) aft to -6.5, y from 2.62 to 5.0.
const FIN = { z0: -1.2, z1: -6.5, y0: 2.62, y1: 5.0 };
const finW = FIN.z0 - FIN.z1,
  finH = FIN.y1 - FIN.y0;
/** Fin leading edge z at height y (the straight swept part above the root fillet). */
const leadingZ = (y) =>
  y < 3.3 ? -1.2 - ((y - 2.64) / 0.66) * 2.0 : -3.2 - ((y - 3.3) / 1.65) * 2.4;

/**
 * A canvas in fin coordinates (x aft from the root leading edge, y up from the root), mirrored
 * for the right side where the leading edge is on the reader's right; lettering stays readable.
 */
function finCanvas(k, right) {
  const c = new k.Canvas(finW, finH);
  const add = c.add.bind(c);
  let mirror = right;
  c.add = (color, points, holes = []) => {
    const m = (ring) => (mirror ? ring.map(([x, y]) => [finW - x, y]) : ring);
    return add(color, m(points), holes.map(m));
  };
  const text = c.text.bind(c);
  c.text = (color, label, opts) => {
    const saved = mirror;
    mirror = false;
    text(color, label, { ...opts, x: saved ? finW - opts.x : opts.x });
    mirror = saved;
    return c;
  };
  /** Fin point (model z, y) to canvas coordinates. */
  c.at = (z, y) => [FIN.z0 - z, y - FIN.y0];
  return c;
}

/** Original stylized tiger stripe: a tapered, slightly curved wedge from (x, y). */
function stripe(c, color, x, y, length, width, angle, bend = 0.25) {
  const pts = [];
  const n = 8;
  for (let i = 0; i <= n; i++) {
    const t = i / n,
      w = width * (1 - t) ** 0.8,
      a = angle + bend * t;
    const cx = x + Math.cos(angle) * length * t + Math.cos(a + Math.PI / 2) * bend * 0.1 * t,
      cy = y + Math.sin(angle) * length * t + Math.sin(a + Math.PI / 2) * bend * 0.1 * t;
    pts.push([cx + Math.cos(a + Math.PI / 2) * w * 0.5, cy + Math.sin(a + Math.PI / 2) * w * 0.5]);
    pts.unshift([
      cx - Math.cos(a + Math.PI / 2) * w * 0.5,
      cy - Math.sin(a + Math.PI / 2) * w * 0.5,
    ]);
  }
  return c.add(color, pts);
}

export default function design({ kit: k, space, slots: all, bounds }) {
  const anchors = {};
  const pair = (name, slot, x, y, z, w, h, facing = [1, 0, 0], depth = 0.4) => {
    for (const side of [1, -1])
      anchors[`${name}-${side}`] = space.anchor(slot, {
        center: [side * x, y, z],
        facing: [side * facing[0], facing[1], facing[2]],
        width: w,
        height: h,
        depth,
      });
  };
  // Fin: the whole fin (fixed part and rudder) as one canvas, plus lettering spots.
  const finCenter = [0.06, (FIN.y0 + FIN.y1) / 2, (FIN.z0 + FIN.z1) / 2];
  pair('fin-panel', AIRFRAME, ...finCenter, finW, finH, [1, 0, 0], 0.3);
  pair('rudder-panel', RUDDER, ...finCenter, finW, finH, [1, 0, 0], 0.3);
  pair('fin-badge', AIRFRAME, 0.06, 3.78, -4.55, 0.42, 0.46, [1, 0, 0], 0.3);
  pair('fin-title', AIRFRAME, 0.07, 2.95, -3.95, 1.5, 0.16, [1, 0, 0], 0.3);
  pair('fin-number', AIRFRAME, 0.06, 3.55, -4.55, 0.7, 0.26, [1, 0, 0], 0.3);
  pair('fin-flag', AIRFRAME, 0.05, 4.35, -5.15, 0.46, 0.3, [1, 0, 0], 0.3);
  pair('fin-top', AIRFRAME, 0.05, 4.72, -5.7, 0.7, 0.1, [1, 0, 0], 0.3);
  pair('fin-solo-title', AIRFRAME, 0.07, 2.88, -3.3, 1.3, 0.26, [1, 0, 0], 0.3);
  // Fuselage: code on the nose, national roundel on the shoulder above the wing root.
  pair('nose-code', AIRFRAME, 0.68, 1.95, 3.7, 1.15, 0.26, [1, 0, 0], 0.5);
  pair('roundel', AIRFRAME, 1.46, 2.1, 0.45, 0.5, 0.5, [0.85, 0.53, 0], 0.6);
  // Rear fuselage sides for long art (tiger stripes), aft of the wing root.
  pair('aft-side', AIRFRAME, 1.25, 2.2, -2.6, 5.0, 0.9, [1, 0, 0], 0.9);
  // Wings: roundels above and below, outboard.
  for (const side of [1, -1])
    for (const [face, y] of [
      ['upper', 1.8],
      ['lower', 1.74],
    ])
      anchors[`wing-${face}-${side}`] = space.anchor(AIRFRAME, {
        center: [side * 4.0, y, -3.05],
        facing: [0, face === 'upper' ? 1 : -1, 0],
        up: [0, 0, 1],
        width: 0.62,
        height: 0.62,
        depth: 0.25,
      });

  const text = (label, w, h, color, opts) => textGraphic(k, label, w, h, color, opts);
  const roundelArt = (rings, widths, size, label) => {
    const c = new k.Canvas(size, size);
    k.roundel(c, size / 2, size / 2, size / 2 - 0.005, rings, widths);
    return c.graphic(label);
  };
  const graphics = {};
  const both = (anchor, graphic, flipRight = false) => [
    { anchor: `${anchor}-1`, graphic },
    { anchor: `${anchor}--1`, graphic, ...(flipRight ? { flip: true } : {}) },
  ];
  const sidesOf = (anchor, left, right) => [
    { anchor: `${anchor}-1`, graphic: left },
    { anchor: `${anchor}--1`, graphic: right },
  ];
  /** Register a left/right pair of fin-panel graphics and mark both fin and rudder. */
  const finArt = (id, draw) => {
    for (const [suffix, right] of [
      ['left', false],
      ['right', true],
    ]) {
      const c = finCanvas(k, right);
      draw(c);
      graphics[`${id}-${suffix}`] = c.graphic(`${id} (${suffix})`);
    }
    return [
      ...sidesOf('fin-panel', `${id}-left`, `${id}-right`),
      ...sidesOf('rudder-panel', `${id}-left`, `${id}-right`),
    ];
  };
  // One graphic per roundel: art is normalized, so the same one serves both sizes.
  const nationalMarks = (roundel) => [
    ...both('roundel', roundel),
    ...['upper', 'lower'].flatMap((face) => both(`wing-${face}`, roundel)),
  ];

  // National roundels (outside in).
  const FRANCE = k.ROUNDELS.france;
  graphics['roundel-france'] = roundelArt(FRANCE, null, 0.5, 'French roundel');
  graphics['roundel-greece'] = roundelArt(k.ROUNDELS.greece, null, 0.5, 'Greek roundel');
  const QATAR = ['#ffffff', '#8a1538', '#e7c86a', '#ffffff'],
    qatarWidths = [0.06, 0.3, 0.24, 0.4];
  graphics['roundel-qatar'] = roundelArt(QATAR, qatarWidths, 0.5, 'Qatari roundel');

  // Lettering.
  graphics['title-armee'] = text("ARMÉE DE L'AIR", 1.5, 0.16, INK, { fill: 0.78 });
  graphics['code-30-GT'] = text('30-GT', 1.15, 0.26, INK, { fill: 0.82 });
  graphics['code-113-GU'] = text('113-GU', 1.15, 0.26, '#e07a1f', { fill: 0.82 });
  graphics['code-QA219'] = text('QA219', 1.15, 0.26, INK, { fill: 0.82 });
  graphics['fin-top-141'] = text('141', 0.7, 0.1, INK, { fill: 0.8 });
  graphics['number-412'] = text('412', 0.7, 0.26, INK, { fill: 0.84 });

  // Normandie-Niemen badge (low visibility): a shield with two passant leopards, simplified.
  graphics['badge-normandie'] = (() => {
    const c = new k.Canvas(0.42, 0.46);
    const shield = (i) => [
      [0.04 + i, 0.44 - i],
      [0.38 - i, 0.44 - i],
      [0.38 - i, 0.2],
      [0.21, 0.02 + i * 1.4],
      [0.04 + i, 0.2],
    ];
    c.add('#5f686e', shield(0), [[...shield(0.025)].reverse()]);
    c.add('#9aa2a7', shield(0.025));
    // Two heraldic leopards passant (heads to the left), original silhouettes.
    const leopard =
      'M8 18 C8 12 14 8 20 10 C24 6 28 8 29 13 L70 14 C78 14 82 10 84 4 C88 2 92 6 88 10 ' +
      'C86 14 82 18 78 21 L81 34 L85 44 L78 44 L72 33 L66 33 L68 44 L62 44 L59 31 L37 31 ' +
      'L35 43 L29 43 L30 29 L24 31 L18 39 L13 37 L20 26 C14 26 10 24 8 18 Z';
    for (const y of [0.25, 0.12])
      c.path('#5f686e', leopard, {
        viewBox: [0, 0, 100, 50],
        x: 0.075,
        y,
        w: 0.27,
        h: 0.135,
        segments: 4,
      });
    return c.graphic('Normandie-Niemen badge (simplified)');
  })();

  // Flags (hoist on the left: forward once mirrored for the right side).
  graphics['flag-qatar'] = (() => {
    const c = new k.Canvas(0.46, 0.3);
    c.rect('#8a1538', 0, 0, 0.46, 0.3);
    const x0 = 0.13,
      n = 9,
      h = 0.3 / n;
    c.rect('#ffffff', 0, 0, x0, 0.3);
    for (let i = 0; i < n; i++)
      c.add('#ffffff', [
        [x0, i * h],
        [x0 + 0.05, (i + 0.5) * h],
        [x0, (i + 1) * h],
      ]);
    return c.graphic('Flag of Qatar');
  })();
  graphics['flag-greece'] = (() => {
    const c = new k.Canvas(0.46, 0.3);
    stripesH(
      c,
      0,
      0,
      0.46,
      0.3,
      Array.from({ length: 9 }, (_, i) => (i % 2 ? WHITE : '#0d5eaf')),
    );
    const cw = 0.3 * (5 / 9);
    c.rect('#0d5eaf', 0, 0.3 - cw, cw, cw);
    c.rect(WHITE, cw / 2 - cw / 10, 0.3 - cw, cw / 5, cw);
    c.rect(WHITE, 0, 0.3 - cw / 2 - cw / 10, cw, cw / 5);
    return c.graphic('Flag of Greece');
  })();

  // QEAF Al-Adiyat squadron emblem: a leaping horse head, original simplified drawing.
  graphics['qatar-horse'] = (() => {
    const c = new k.Canvas(0.42, 0.46);
    // Head in profile facing the nose (right on the canvas), then the mane flames and the
    // curling swoosh beneath the neck.
    for (const d of [
      'M40 18 L46 4 L52 16 C62 18 72 26 80 38 L92 54 C95 59 92 64 86 64 L78 63 ' +
        'C74 66 70 67 66 66 C60 64 56 60 54 56 C50 62 46 72 44 84 C36 80 28 74 24 64 ' +
        'C22 46 28 28 40 18 Z',
      'M32 26 C22 24 13 30 8 40 C16 36 22 36 28 38 Z',
      'M27 42 C17 42 10 50 7 60 C15 54 21 53 26 54 Z',
      'M44 84 C34 90 26 95 16 98 C30 99 44 95 56 86 Z',
    ])
      c.path(BLACK, d, { viewBox: [0, 0, 100, 100], x: 0, y: 0, w: 0.42, h: 0.46, segments: 5 });
    return c.graphic('Al-Adiyat squadron horse (simplified)');
  })();

  const paints = (color = GRAY, extra = {}) => ({
    ...Object.fromEntries(Object.keys(all).map((name) => [name, { color }])),
    ...extra,
  });

  // 2014 Tiger Meet: red fin with black stripes and a white zigzag, orange tiger-striped
  // rear fuselage. Fin art in fin coordinates.
  const tigerFin = finArt('tiger-fin', (c) => {
    c.add('#c8261f', [
      [0, 0],
      [finW, 0],
      [finW, finH],
      [0, finH],
    ]);
    // Black stripes sweeping back from the leading edge.
    for (let i = 0; i < 8; i++) {
      const y = 0.3 + i * 0.27;
      const z = leadingZ(FIN.y0 + y) - 0.03;
      const [x] = c.at(z, 0);
      stripe(c, BLACK, x, y, 1.3 + (i % 3) * 0.35, 0.2, -0.32 - (i % 2) * 0.1, 0.22);
    }
    // Stripes rising from the root and in from the trailing edge.
    for (let i = 0; i < 4; i++) stripe(c, BLACK, 2.6 + i * 0.55, 0, 0.8, 0.18, 1.2, -0.3);
    for (let i = 0; i < 4; i++)
      stripe(c, BLACK, finW - 0.05, 0.5 + i * 0.4, 0.9, 0.18, Math.PI + 0.15, 0.25);
    // White zigzag across the lower fin.
    const zig = [];
    for (let i = 0; i <= 8; i++) zig.push([0.6 + i * 0.6, 0.35 + (i % 2) * 0.22]);
    for (let i = 0; i < zig.length - 1; i++) {
      const [a, b] = [zig[i], zig[i + 1]];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      c.box(
        WHITE,
        (a[0] + b[0]) / 2,
        (a[1] + b[1]) / 2,
        len + 0.04,
        0.045,
        Math.atan2(b[1] - a[1], b[0] - a[0]),
      );
    }
  });
  graphics['tiger-side'] = (() => {
    const c = new k.Canvas(5.0, 0.9);
    // Bold stripes raking down and aft from the spine.
    for (let i = 0; i < 9; i++)
      stripe(
        c,
        BLACK,
        0.2 + i * 0.55,
        0.9,
        0.85 + (i % 3) * 0.12,
        0.26,
        -1.0 - (i % 2) * 0.25,
        0.45,
      );
    // Short stripes rising from below, between the long ones.
    for (let i = 0; i < 8; i++)
      stripe(c, BLACK, 0.5 + i * 0.55, 0.15, 0.32 + (i % 2) * 0.1, 0.16, 2.0 + (i % 3) * 0.1, 0.3);
    return c.graphic('Tiger stripes (original)');
  })();

  // Solo Display 2025: diagonal blue, white and red bands parallel to the fin leading edge.
  // Bands are chord fractions that narrow toward the tip, as photographed: [root, tip].
  const soloFin = finArt('solo-fin', (c) => {
    const le = (y) => -3.2 - (y - 3.3) * (2.4 / 1.65),
      te = (y) => -5.8 - (y - 2.8) * 0.35;
    const at = (f, y) => c.at(le(y) + (te(y) - le(y)) * f, y)[0];
    const band = (color, [r0, t0], [r1, t1]) =>
      c.add(color, [
        [at(r0, FIN.y0), 0],
        [at(r1, FIN.y0), 0],
        [at(t1, FIN.y1), finH],
        [at(t0, FIN.y1), finH],
      ]);
    c.rect(BLUE, 0, 0, finW, finH);
    band(WHITE, [0.4, 0.14], [0.43, 0.16]);
    band(WHITE, [0.54, 0.25], [0.6, 0.33]);
    band(RED, [0.6, 0.33], [0.75, 0.55]);
    band(WHITE, [0.75, 0.55], [0.79, 0.62]);
    band('#a3192b', [0.79, 0.62], [1.4, 1.4]);
  });
  graphics['solo-title'] = (() => {
    const c = new k.Canvas(1.3, 0.26);
    c.text(WHITE, "ARMÉE DE L'AIR", { x: 0.65, y: 0.18, height: 0.085 });
    c.text(WHITE, "& DE L'ESPACE", { x: 0.62, y: 0.06, height: 0.07, face: 'regular' });
    return c.graphic("ARMÉE DE L'AIR & DE L'ESPACE");
  })();
  // Navy underside: the fuselage below 1.86 m, and each wing's lower skin below a plane
  // sloped with the wing between its upper (1.89 to 1.77 m) and lower (1.78 to 1.74 m) skins.
  const underside = (slot) => [
    {
      color: NAVY,
      planes: [
        space.below(slot, 1.86),
        space.plane(slot, [-1, 0, 0], [1.6, 0, 0]),
        space.plane(slot, [1, 0, 0], [-1.6, 0, 0]),
      ],
    },
    ...[1, -1].map((side) => ({
      color: NAVY,
      planes: [
        space.plane(slot, [side, 0, 0], [side * 1.6, 0, 0]),
        space.plane(slot, [side * -0.032, -1, 0], [side * 2, 1.835, 0]),
      ],
    })),
  ];
  const soloPaint = paints(WHITE, {
    [AIRFRAME]: {
      color: WHITE,
      zones: [
        ...underside(AIRFRAME),
        {
          color: RED,
          planes: [
            space.below(AIRFRAME, 1.86),
            space.above(AIRFRAME, 1.66),
            space.behind(AIRFRAME, 2.5),
            space.plane(AIRFRAME, [-1, 0, 0], [1.62, 0, 0]),
            space.plane(AIRFRAME, [1, 0, 0], [-1.62, 0, 0]),
          ],
        },
      ],
    },
  });

  // Qatar: the two-gray camouflage of the QEAF Rafales.
  const qatarPaint = paints('#b4babe', {
    [AIRFRAME]: {
      color: '#b4babe',
      camouflage: { colors: ['#b4babe', '#8d969c'], scale: 1.1, seed: 974, style: 'blotch' },
    },
  });

  const references = {
    normandie: {
      title: "Rafale C 141 '30-GT' of EC 2/30 Normandie-Niemen (Alan Wilson, CC BY-SA 2.0)",
      url: 'https://commons.wikimedia.org/wiki/File:Dassault_Rafale_C_%E2%80%98141_30-GT%E2%80%99_(49358510998).jpg',
    },
    tiger: {
      title: "Rafale C 142 '113-GU' in the 2014 NATO Tiger Meet scheme (CC BY-SA 2.0)",
      url: 'https://commons.wikimedia.org/wiki/File:Dassault_Rafale_C_%27142_-_113-GU%27_(14608203075).jpg',
    },
    solo: {
      title: 'Rafale Solo Display 2025 at Bricy (CC BY-SA 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Rafale_Solo_Display_2025_Bricy_(Denoised).jpg',
    },
    qatar: {
      title: 'Qatar Emiri Air Force Rafale EQ QA219 at Andravida, 2024 (CC BY-SA 2.0)',
      url: 'https://commons.wikimedia.org/wiki/File:QA219_Rafale_EQ_Qatar_Emiri_Air_Force_Andravida_17.4.24_(53696949762).jpg',
    },
    greece: {
      title: "Hellenic Air Force Rafale EG '412' (CC BY-SA 2.0)",
      url: 'https://commons.wikimedia.org/wiki/File:Dassault_Rafale_EG_%E2%80%98412%E2%80%99_(54017141290).jpg',
    },
  };

  const built = {
    selected: 'ec-2-30-normandie-niemen',
    anchors,
    graphics,
    variants: [
      {
        id: 'ec-2-30-normandie-niemen',
        label: 'EC 2/30 Normandie-Niemen (30-GT)',
        provenance: {
          kind: 'inspired',
          note: 'Rafale C 141 of Escadron de Chasse 2/30 Normandie-Niemen from the referenced photograph: overall Rafale gray, French roundels on the fuselage shoulders and above and below both wings, 30-GT on the nose, the squadron badge on the fin (simplified two-leopard shield in low-visibility grays), ARMÉE DE L’AIR on the lower fin and 141 at the fin top. Stencils are omitted.',
          references: [references.normandie],
        },
        paints: paints(),
        markings: [
          ...nationalMarks('roundel-france'),
          ...both('nose-code', 'code-30-GT'),
          ...both('fin-badge', 'badge-normandie'),
          ...both('fin-title', 'title-armee'),
          ...both('fin-top', 'fin-top-141'),
        ],
      },
      {
        id: 'tiger-meet-2014-113-gu',
        label: 'EC 1/7 Provence, Tiger Meet 2014 (113-GU)',
        provenance: {
          kind: 'inspired',
          note: 'Rafale C 142 in the NATO Tiger Meet 2014 scheme from the referenced photograph: red fin with sweeping black tiger stripes and a white zigzag, black tiger stripes on the rear fuselage over an orange band, 113-GU in orange on the nose and French roundels. The photographic tiger face on the fin, the event titles and the painted drop tanks are not reproduced; stripes are original vector art.',
          references: [references.tiger],
        },
        paints: paints(GRAY, {
          [AIRFRAME]: {
            color: '#6f7a80',
            zones: [
              {
                color: '#d9762a',
                planes: [space.behind(AIRFRAME, 0.6), space.above(AIRFRAME, 1.98)],
              },
            ],
          },
          [RUDDER]: { color: '#c8261f' },
        }),
        markings: [
          ...tigerFin,
          ...both('aft-side', 'tiger-side', true),
          ...nationalMarks('roundel-france'),
          ...both('nose-code', 'code-113-GU'),
        ],
      },
      {
        id: 'solo-display-2025',
        label: 'Rafale Solo Display, 2025',
        provenance: {
          kind: 'inspired',
          note: 'The 2025 Rafale Solo Display scheme from the referenced photograph: white upper surfaces, a dark navy underside with a red band along the lower rear fuselage (slats and elevons stay white), and blue, white and red bands parallel to the fin leading edge with ARMÉE DE L’AIR & DE L’ESPACE in white. Band widths and the underside pattern are approximations.',
          references: [references.solo],
        },
        paints: soloPaint,
        markings: [
          ...soloFin,
          ...both('fin-solo-title', 'solo-title'),
          ...nationalMarks('roundel-france'),
        ],
      },
      {
        id: 'qatar-qa219',
        label: 'Qatar Emiri Air Force (QA219)',
        provenance: {
          kind: 'inspired',
          note: 'Rafale EQ QA219 from the referenced 2024 photograph: the QEAF two-gray camouflage (a blotch pattern, not the exact patch outlines), the Qatari roundel (maroon, gold and white) on the fuselage and wings, the flag of Qatar near the fin top (hoist forward on both sides), the black Al-Adiyat horse emblem on the fin (original simplified drawing) and QA219 on the nose.',
          references: [references.qatar],
        },
        paints: qatarPaint,
        markings: [
          ...nationalMarks('roundel-qatar'),
          ...both('fin-flag', 'flag-qatar', true),
          ...both('fin-badge', 'qatar-horse', true),
          ...both('nose-code', 'code-QA219'),
        ],
      },
      {
        id: 'hellenic-332-mira-412',
        label: 'Hellenic Air Force, 332 Mira (412)',
        provenance: {
          kind: 'inspired',
          note: 'Rafale EG 412 of 332 Mira from the referenced photograph: overall gray, Greek roundels (blue, white, blue) on the fuselage and wings, the flag of Greece on the fin with the serial 412 beneath it.',
          references: [references.greece],
        },
        paints: paints('#7c868c'),
        markings: [
          ...nationalMarks('roundel-greece'),
          ...both('fin-flag', 'flag-greece', true),
          ...both('fin-number', 'number-412'),
        ],
      },
    ],
  };
  return leanLivery(built, bounds);
}
