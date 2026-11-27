/**
 * A400M Atlas liveries: Luftwaffe, Royal Air Force, Spanish, Turkish and French Air Force
 * aircraft with their national insignia, titles, fin flags and flashes, codes and serials
 * redrawn as original vector art. All share the Airbus military gray, the black radome (model
 * trim) and the yellow propeller danger line around the fuselage in line with the inboard
 * propellers. Colors are approximate.
 */
import * as A from '../art-transports.mjs';

const EXT = 'body-A400-exterior-A400-airframe';

export function slots(existing) {
  return {
    ...existing,
    // Markings only (never painted): every airframe surface, fin and rudder together.
    all: { materials: ['A400-airframe'] },
  };
}

const GRAY = '#8d979c',
  RAF_GRAY = '#8a959c',
  FR_GRAY = '#6f7a82',
  ES_GRAY = '#949da2',
  TR_GRAY = '#89939a',
  INK = '#1f2326',
  YELLOW = '#f0c419';

// Fin chord centre and skin half-thickness at height y (probed on the runtime model).
const finZ = (y) => -12.7 - 0.643 * (y - 7),
  finX = (y) => 0.23 - 0.0136 * (y - 7);

export default function design({ kit: k, space, slots: all }) {
  const anchors = {};
  const pair = (name, make) => {
    anchors[`${name}-l`] = make(1);
    anchors[`${name}-r`] = make(-1);
  };
  const on = (center, s, width, height, depth = 1.0, facing = [s, 0, 0], up = [0, 1, 0]) =>
    space.anchor('all', { center, facing, up, width, height, depth });
  const fin =
    (y, width, height, dz = 0) =>
    (s) =>
      on([s * finX(y), y, finZ(y) + dz], s, width, height, 0.3);

  pair('title', (s) => on([s * 2.52, 4.9, 14.6], s, 5.0, 0.52, 0.9, [s, 0.28, 0]));
  pair('nose-number', (s) => on([s * 2.3, 3.45, 17.95], s, 0.7, 0.24, 0.9));
  pair('crew-flag', (s) => on([s * 2.6, 4.55, 15.9], s, 0.55, 0.33, 0.9, [s, 0.15, 0]));
  pair('aft-mark', (s) => on([s * 2.66, 4.45, -4.6], s, 1.3, 1.3));
  pair('aft-serial', (s) => on([s * 2.5, 4.55, -6.9], s, 2.0, 0.5));
  pair('aft-code', (s) => on([s * 2.66, 4.45, -4.6], s, 3.6, 1.0));
  pair('fin-flag', fin(11.0, 1.2, 0.72));
  pair('fin-flash', fin(12.3, 0.6, 0.9, 0.6));
  pair('fin-serial', fin(10.15, 2.4, 0.5));
  pair('fin-title', fin(9.55, 2.6, 0.24));
  pair('fin-emblem', fin(8.45, 1.2, 1.2));
  pair('fin-small', fin(7.6, 2.0, 0.22));
  // Unit lettering along the fin's leading edge, read downward on both sides.
  // The artwork's +X runs down the leading edge, (0, -0.84, 0.54); its up follows from the side.
  const le = (s) => {
    const y = 10.6,
      up = s > 0 ? [0, -0.54, -0.84] : [0, 0.54, 0.84];
    return on([s * finX(y), y, finZ(y) + 2.35], s, 5.2, 0.62, 0.3, [s, 0, 0], up);
  };
  pair('fin-le', le);

  // ------------------------------------------------------------------ artwork
  const graphics = {
    // Luftwaffe
    'lw-title': A.label(k, 'LUFTWAFFE', 5.0, 0.52, INK, { tracking: 0.1 }),
    'lw-cross': A.finish(k.balkenkreuz(new k.Canvas(1.3, 1.3), 0.65, 0.65, 1.28), 'Balkenkreuz'),
    'lw-serial': A.label(k, '54+28', 2.0, 0.5, INK),
    'de-flag': A.flagH(k, 1.2, 0.72, ['#000000', '#dd0000', '#ffce00'], 'German flag'),
    // Royal Air Force
    'raf-title': A.label(k, 'ROYAL AIR FORCE', 5.0, 0.52, INK, { fill: 0.62, tracking: 0.08 }),
    'raf-roundel': A.finish(
      k.roundel(new k.Canvas(1.3, 1.3), 0.65, 0.65, 0.5, ['#2b4485', '#c02b36'], [0.6, 0.4]),
      'RAF roundel',
    ),
    'raf-serial': A.label(k, 'ZM404', 2.0, 0.5, INK, { fill: 0.62 }),
    'raf-404': A.label(k, '404', 0.7, 0.24, INK),
    'raf-flash': A.flash(k, 0.6, 0.9, ['#c02b36', '#2b4485'], 'RAF fin flash'),
    'uk-flag': A.unionFlag(k, 0.55, 0.33),
    // Spain
    'es-title': A.label(k, 'EJÉRCITO DEL AIRE', 5.0, 0.52, INK, { fill: 0.62, tracking: 0.06 }),
    'es-code': (() => {
      const c = new k.Canvas(3.6, 1.0);
      c.text(INK, '31', { x: 1.15, y: 0.5, height: 0.6, align: 'right' });
      k.roundel(c, 1.8, 0.5, 0.48, k.ROUNDELS.spain, [0.3, 0.4, 0.3]);
      c.text(INK, '21', { x: 2.45, y: 0.5, height: 0.6, align: 'left' });
      return A.finish(c, '31-21 with the Spanish roundel');
    })(),
    'es-serial': A.label(k, 'T.23-01', 2.0, 0.22, INK),
    // Turkey
    'tr-title': A.label(k, 'TÜRK HAVA KUVVETLERİ', 5.0, 0.52, INK, { fill: 0.6, tracking: 0.05 }),
    'tr-flag': A.turkishFlag(k, 1.2, 0.8),
    'tr-serial': A.label(k, '13-0009', 2.4, 0.5, INK, { fill: 0.7 }),
    'tr-fin-title': A.label(k, 'TURKISH AIR FORCE', 2.6, 0.24, INK, { fill: 0.7 }),
    'tr-roundel': A.finish(
      k.roundel(new k.Canvas(1.3, 1.3), 0.65, 0.65, 0.62, k.ROUNDELS.turkey, [0.22, 0.2, 0.58]),
      'Turkish roundel',
    ),
    // France
    'fr-roundel': A.finish(
      k.roundel(new k.Canvas(1.3, 1.3), 0.65, 0.65, 0.62, k.ROUNDELS.france),
      'French roundel',
    ),
    'fr-flash': A.flash(k, 0.6, 0.9, ['#1e3a8a', '#ffffff', '#c8102e'], 'French fin flash'),
    'fr-reg': A.label(k, 'F-RBAO', 2.0, 0.5, INK, { fill: 0.6 }),
    'fr-unit': (() => {
      const c = new k.Canvas(5.2, 0.62);
      c.text('#f2b705', '4/61', { x: 0.05, y: 0.31, height: 0.5, align: 'left', slant: 0.12 });
      c.text('#c62828', 'BÉARN', {
        x: 1.75,
        y: 0.31,
        height: 0.5,
        align: 'left',
        slant: 0.12,
        tracking: 0.06,
      });
      return A.finish(c, '4/61 BÉARN');
    })(),
  };

  // ------------------------------------------------------------------ paint
  const bodySlots = Object.keys(all).filter((n) => n.startsWith('body-'));
  // The yellow propeller danger line around the fuselage at the inboard propeller plane.
  const propLine = {
    color: YELLOW,
    planes: [
      space.ahead(EXT, 10.94),
      space.behind(EXT, 11.18),
      space.below(EXT, 5.85),
      space.plane(EXT, [-1, 0, 0], [3.1, 0, 0]),
      space.plane(EXT, [1, 0, 0], [-3.1, 0, 0]),
    ],
  };
  const paintAll = (color) => ({
    ...Object.fromEntries(bodySlots.map((n) => [n, { color }])),
    [EXT]: { color, zones: [propLine] },
  });
  const both = (anchor, graphic) => [
    { anchor: `${anchor}-l`, graphic },
    { anchor: `${anchor}-r`, graphic },
  ];
  const leading = (anchor, graphic) => [
    { anchor: `${anchor}-l`, graphic },
    { anchor: `${anchor}-r`, graphic, flip: true },
  ];
  const refs = {
    lw: {
      title: 'Luftwaffe A400M 54+28 at RIAT 2019 (CC BY-SA)',
      url: 'https://commons.wikimedia.org/wiki/File:A400M_Luftwaffe_54%2B28_at_RIAT_2019.jpg',
    },
    lw2: {
      title: 'German Air Force A400M 54+18 (CC BY)',
      url: 'https://commons.wikimedia.org/wiki/File:German_Air_Force_Airbus_A400M_-_54%2B18.jpg',
    },
    raf: {
      title: 'RAF Atlas C1 ZM404 at Brize Norton (CC BY-SA 2.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Airbus_A400M_Atlas_C1_-_Royal_Air_Force_-_ZM404_404_(48990266088).jpg',
    },
    es: {
      title: 'Spanish Air Force A400M T.23-01 (31-21) (CC BY-SA)',
      url: 'https://commons.wikimedia.org/wiki/File:Fuerza_A%C3%A9rea_Espa%C3%B1ola_(Spanish_Air_Force)_Airbus_A400M-180_(T.23-01).jpg',
    },
    tr: {
      title: 'Turkish Air Force A400M 13-0009 (CC BY-SA 2.0)',
      url: 'https://commons.wikimedia.org/wiki/File:13-0009_A400M_TURKISH_AIR_FORCE_(53330076748).jpg',
    },
    fr: {
      title: "A400M of ET 4/61 Béarn, Armée de l'Air et de l'Espace (CC BY-SA)",
      url: "https://commons.wikimedia.org/wiki/File:A400M_Arm%C3%A9e_de_l'Air_et_de_l'Espace_-_Escadron_de_Transport_164,_le_B%C3%A9arn.jpg",
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
    selected: 'luftwaffe-ltg-62',
    anchors,
    graphics,
    variants: [
      variant(
        'luftwaffe-ltg-62',
        'Luftwaffe LTG 62, 54+28',
        'Luftwaffe A400M 54+28 of Lufttransportgeschwader 62 (Wunstorf) from the referenced photographs: gray overall, LUFTWAFFE title above the crew door, Balkenkreuz and 54+28 on the rear fuselage, German flag on the fin, yellow propeller line. The red rescue markings and the wing emblem by the nose are omitted. Approximate colors.',
        [refs.lw, refs.lw2],
        paintAll(GRAY),
        [
          ...both('title', 'lw-title'),
          ...both('aft-mark', 'lw-cross'),
          ...both('aft-serial', 'lw-serial'),
          ...leading('fin-flag', 'de-flag'),
        ],
      ),
      variant(
        'raf-atlas-c1-zm404',
        'RAF Atlas C1 ZM404',
        'Royal Air Force Atlas C1 ZM404 (Brize Norton) from the referenced photograph: gray overall, ROYAL AIR FORCE title, 404 on the nose, the Union flag by the crew door, red and blue roundel with ZM404 on the rear fuselage, red and blue fin flash, yellow propeller line. Union flag simplified (centred red saltire). Approximate colors.',
        [refs.raf],
        paintAll(RAF_GRAY),
        [
          ...both('title', 'raf-title'),
          ...both('nose-number', 'raf-404'),
          ...leading('crew-flag', 'uk-flag'),
          ...both('aft-mark', 'raf-roundel'),
          ...both('aft-serial', 'raf-serial'),
          ...leading('fin-flash', 'raf-flash'),
        ],
      ),
      variant(
        'spanish-ala-31-t23-01',
        'Spanish Air Force Ala 31, T.23-01',
        'Spanish Air Force A400M T.23-01 of Ala 31 (Zaragoza) from the referenced photograph: gray overall, EJÉRCITO DEL AIRE title, code 31-21 either side of the red and yellow roundel on the rear fuselage, T.23-01 on the fin, yellow propeller line. Approximate colors.',
        [refs.es],
        paintAll(ES_GRAY),
        [
          ...both('title', 'es-title'),
          ...both('aft-code', 'es-code'),
          ...both('fin-small', 'es-serial'),
        ],
      ),
      variant(
        'turkish-air-force-221-filo',
        'Turkish Air Force 13-0009',
        'Turkish Air Force A400M 13-0009 (221 Filo, Kayseri) from the referenced photograph: gray overall, TÜRK HAVA KUVVETLERİ title, Turkish flag, 13-0009 and TURKISH AIR FORCE on the fin, roundel on the rear fuselage, yellow propeller line. The squadron badge under the fin lettering is omitted. Approximate colors.',
        [refs.tr],
        paintAll(TR_GRAY),
        [
          ...both('title', 'tr-title'),
          ...leading('fin-flag', 'tr-flag'),
          ...both('fin-serial', 'tr-serial'),
          ...both('fin-title', 'tr-fin-title'),
          ...both('aft-mark', 'tr-roundel'),
        ],
      ),
      variant(
        'french-et-4-61-bearn',
        'French Air and Space Force, ET 4/61 Béarn',
        "French Air and Space Force A400M F-RBAO of Escadron de Transport 4/61 Béarn from the referenced photograph: darker gray, 4/61 BÉARN in yellow and red along the fin's leading edge, tricolor fin flash, roundel with F-RBAO on the rear fuselage, yellow propeller line. The red fuselage art of that photograph is omitted. Approximate colors.",
        [refs.fr],
        paintAll(FR_GRAY),
        [
          ...both('fin-le', 'fr-unit'),
          ...leading('fin-flash', 'fr-flash'),
          ...both('aft-mark', 'fr-roundel'),
          ...both('aft-serial', 'fr-reg'),
        ],
      ),
    ],
  };
}
