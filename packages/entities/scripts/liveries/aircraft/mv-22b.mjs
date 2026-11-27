/**
 * V-22 Osprey liveries on the MV-22B model: Marine Corps tiltrotor squadron and HMX-1 schemes,
 * the Air Force Special Operations CV-22B and the Japan Ground Self-Defense Force V-22, with
 * their national insignia, titles, squadron codes, modex and serial numbers redrawn as original
 * vector art. Colors are approximate.
 *
 * The fins are flat slabs whose outer faces sit at |x| 2.845, from y 2.0 to 5.38, leading edge
 * z -6.5 (bottom) to -7.5 (top), rudder trailing edge z -8.69.
 */
import * as A from '../art-transports.mjs';

const EXT = 'body-MV22-exterior-MV22-airframe';

export function slots(existing) {
  return {
    ...existing,
    // Markings only (never painted): every airframe surface, fins and rudders together.
    all: { materials: ['MV22-airframe'] },
  };
}

const USMC_GRAY = '#a3aaae',
  USMC_INK = '#687076',
  CV_GRAY = '#4e565c',
  CV_INK = '#9fa7ad',
  HMX_GREEN = '#3c472d',
  JP_GRAY = '#b1b7ba',
  JP_INK = '#545b60',
  WHITE = '#f2f2ee';

/** The Golden Eagles' emblem in low-visibility gray: an eagle with spread wings (original). */
function eagle(k, w, h, color) {
  const c = new k.Canvas(w, h),
    cx = w / 2;
  // Wings: two swept polygons with feathered trailing edges.
  for (const s of [-1, 1]) {
    const pts = [
      [cx + s * 0.04 * w, 0.62 * h],
      [cx + s * 0.22 * w, 0.8 * h],
      [cx + s * 0.48 * w, 0.92 * h],
      [cx + s * 0.44 * w, 0.74 * h],
      [cx + s * 0.4 * w, 0.66 * h],
      [cx + s * 0.34 * w, 0.6 * h],
      [cx + s * 0.28 * w, 0.54 * h],
      [cx + s * 0.08 * w, 0.46 * h],
    ];
    c.add(color, s > 0 ? pts : [...pts].reverse());
  }
  // Body, head and tail.
  c.add(color, [
    [cx - 0.08 * w, 0.66 * h],
    [cx + 0.08 * w, 0.66 * h],
    [cx + 0.1 * w, 0.3 * h],
    [cx + 0.16 * w, 0.12 * h],
    [cx - 0.16 * w, 0.12 * h],
    [cx - 0.1 * w, 0.3 * h],
  ]);
  c.circle(color, cx, 0.74 * h, 0.07 * w, 16);
  c.add(color, [
    [cx + 0.05 * w, 0.76 * h],
    [cx + 0.14 * w, 0.72 * h],
    [cx + 0.05 * w, 0.69 * h],
  ]);
  // The vertical bar above the emblem.
  c.rect(color, cx - 0.02 * w, 0.95 * h, 0.04 * w, 0.05 * h);
  return A.finish(c, 'Golden Eagles emblem');
}

export default function design({ kit: k, space, slots: all }) {
  const anchors = {};
  const pair = (name, make) => {
    anchors[`${name}-l`] = make(1);
    anchors[`${name}-r`] = make(-1);
  };
  const on = (center, s, width, height, depth = 0.6) =>
    space.anchor('all', { center, facing: [s, 0, 0], width, height, depth });
  // Outer fin faces: thin slabs, so a shallow projector.
  const fin = (z, y, width, height) => (s) => on([s * 2.845, y, z], s, width, height, 0.12);
  pair('fin-emblem', fin(-8.0, 4.42, 0.8, 0.8));
  pair('fin-buno', fin(-8.0, 3.5, 1.0, 0.3));
  pair('fin-y', fin(-7.82, 2.98, 0.3, 0.32));
  pair('fin-s', fin(-7.62, 2.7, 0.3, 0.32));
  pair('fin-modex', fin(-8.35, 2.35, 0.5, 0.32));
  pair('fin-flag', fin(-8.0, 4.6, 0.8, 0.43));
  pair('fin-upper', fin(-7.95, 4.0, 1.1, 0.34));
  pair('fin-lower', fin(-7.85, 3.45, 1.2, 0.34));
  pair('boom-title', (s) => on([s * 1.15, 2.66, -3.3], s, 2.7, 0.36));
  pair('boom-unit', (s) => on([s * 1.2, 2.33, -3.1], s, 1.0, 0.18));
  pair('insignia', (s) => on([s * 1.24, 2.45, -0.7], s, 1.2, 0.62));
  pair('roundel', (s) => on([s * 1.24, 2.2, -1.2], s, 0.85, 0.85));
  pair('side-modex', (s) => on([s * 1.27, 1.95, 3.35], s, 0.75, 0.46));
  pair('side-serial', (s) => on([s * 1.24, 1.92, 6.0], s, 1.3, 0.32));
  pair('hmx-title', (s) => on([s * 1.24, 2.25, -2.2], s, 4.4, 0.26));

  // ------------------------------------------------------------------ artwork
  const insignia = (color) =>
    A.finish(
      k.usInsignia(new k.Canvas(1.2, 0.62), 0.6, 0.31, 0.28, { style: 'lowvis', color }),
      'US national insignia',
    );
  const graphics = {
    // VMM-162 Golden Eagles
    'golden-eagle': eagle(k, 0.8, 0.8, USMC_INK),
    'buno-6688': A.label(k, '6688', 1.0, 0.3, USMC_INK),
    'code-y': A.label(k, 'Y', 0.3, 0.32, '#2c3134'),
    'code-s': A.label(k, 'S', 0.3, 0.32, '#2c3134'),
    'modex-02': A.label(k, '02', 0.5, 0.32, '#2c3134'),
    'side-02': A.label(k, '02', 0.75, 0.46, USMC_INK),
    marines: A.label(k, 'MARINES', 2.7, 0.36, USMC_INK, { tracking: 0.06 }),
    'vmm-162': A.label(k, 'VMM-162', 1.0, 0.18, '#2c3134'),
    'insignia-usmc': insignia(USMC_INK),
    // HMX-1
    'hmx-title': A.label(k, 'UNITED STATES MARINE CORPS', 4.4, 0.26, WHITE, {
      face: 'regular',
      tracking: 0.04,
    }),
    'us-flag': A.usFlag(k, 0.8, 0.43),
    // CV-22B
    'cv-usaf': A.label(k, 'USAF', 1.1, 0.34, CV_INK),
    'cv-0058': A.label(k, '0058', 1.2, 0.34, CV_INK),
    'insignia-cv': insignia(CV_INK),
    // JGSDF
    hinomaru: A.finish(k.hinomaru(new k.Canvas(0.85, 0.85), 0.425, 0.425, 0.42), 'Hinomaru'),
    'jp-serial': A.label(k, '91716', 1.3, 0.32, JP_INK),
    'jp-fin': A.label(k, '91716', 1.2, 0.34, JP_INK),
  };

  // ------------------------------------------------------------------ paint
  const bodySlots = Object.keys(all).filter((n) => n.startsWith('body-'));
  const paintAll = (color, extra = {}, finish = {}) => ({
    ...Object.fromEntries(bodySlots.map((n) => [n, { color, ...finish }])),
    ...extra,
  });
  const fuselage = [
    space.plane(EXT, [-1, 0, 0], [1.5, 0, 0]),
    space.plane(EXT, [1, 0, 0], [-1.5, 0, 0]),
  ];
  const pinstripe = (y0, y1) => ({
    color: WHITE,
    planes: [space.above(EXT, y0), space.below(EXT, y1), space.ahead(EXT, -5.7), ...fuselage],
  });
  const nacelleBand = (slot) => ({
    color: CV_GRAY,
    zones: [{ color: '#b3262d', planes: [space.above(slot, 5.5), space.below(slot, 5.72)] }],
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
    vmm162: {
      title: 'MV-22 of VMM-162 Golden Eagles at Guantanamo Bay, 2010 (US Navy, public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:US_Navy_100124-N-7456N-034_An_MV-22_Osprey_assigned_to_the_Golden_Eagles_of_Marine_Medium_Tiltrotor_Squadron_(VMM)_162,_is_on_the_tarmac_at_Naval_Station_Guantanamo_Bay.jpg',
    },
    vmm162b: {
      title: 'VMM-162 Osprey in Iraq, 2008 (US Marine Corps, public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:VMM-162_Osprey_on_the_tarmac_in_Iraq_on_April_1-2008.JPG',
    },
    hmx: {
      title: 'MV-22B 168339 of HMX-1 at Frederick, by Acroterion (CC BY-SA 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Bell-Boeing_MV-22B_168339_HMX-1_FDK_MD4.jpg',
    },
    cv: {
      title: 'USAF CV-22B 11-0058 at RIAT 2023 (CC BY 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:USAF_CV-22B_Osprey_11-0058_RIAT_2023_04.jpg',
    },
    cv2: {
      title: 'USAF CV-22B 10-0050 at ILA 2018 (CC BY-SA 3.0)',
      url: 'https://commons.wikimedia.org/wiki/File:USAF_CV-22B_10-0050_ILA-2018.jpg',
    },
    jp: {
      title:
        'JGSDF V-22 91716 at MCAS Futenma, Resolute Dragon 26 (US Marine Corps, public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:Japanese_V-22_Ospreys_arrive_at_MCAS_Futenma_for_Resolute_Dragon_26_(9785388).jpg',
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
    selected: 'vmm-162-golden-eagles',
    anchors,
    graphics,
    variants: [
      variant(
        'vmm-162-golden-eagles',
        'VMM-162 Golden Eagles YS-02',
        'Marine Medium Tiltrotor Squadron 162 MV-22B from the referenced photographs: light gray overall with low-visibility markings, the squadron eagle (original drawing), BuNo 6688, the staggered YS tail code and modex 02 on the outer fin faces, 02 on the fuselage, MARINES and VMM-162 on the tail boom, low-visibility national insignia. Approximate colors.',
        [refs.vmm162, refs.vmm162b],
        paintAll(USMC_GRAY),
        [
          ...both('fin-emblem', 'golden-eagle'),
          ...both('fin-buno', 'buno-6688'),
          ...both('fin-y', 'code-y'),
          ...both('fin-s', 'code-s'),
          ...both('fin-modex', 'modex-02'),
          ...both('side-modex', 'side-02'),
          ...both('boom-title', 'marines'),
          ...both('boom-unit', 'vmm-162'),
          ...both('insignia', 'insignia-usmc'),
        ],
      ),
      variant(
        'hmx-1-green',
        'HMX-1 Nighthawks, green',
        'Marine Helicopter Squadron One MV-22B 168339 from the referenced photograph: gloss dark green overall with the white double pinstripe along the fuselage, UNITED STATES MARINE CORPS on the aft fuselage (set in a sans face; the original is a serif) and the US flag on the fins. Approximate colors.',
        [refs.hmx],
        paintAll(
          HMX_GREEN,
          {
            [EXT]: {
              color: HMX_GREEN,
              roughness: 0.35,
              zones: [pinstripe(2.72, 2.78), pinstripe(2.55, 2.61)],
            },
          },
          { roughness: 0.35 },
        ),
        [...both('hmx-title', 'hmx-title'), ...leading('fin-flag', 'us-flag')],
      ),
      variant(
        'usaf-cv-22b-7-sos',
        'USAF CV-22B 11-0058, 352nd SOW',
        'Air Force Special Operations Command CV-22B 11-0058 (352nd Special Operations Wing, Mildenhall) from the referenced photographs, on the MV-22B airframe: FS 36118 gunship gray, USAF and 0058 on the outer fin faces and low-visibility national insignia in light gray, red bands at the top of the nacelles. The CV-22 nose radome and refuelling probe are not modelled; unit emblems are omitted. Approximate colors.',
        [refs.cv, refs.cv2],
        paintAll(CV_GRAY, {
          'body-MV22-nacelle-1-MV22-airframe': nacelleBand('body-MV22-nacelle-1-MV22-airframe'),
          'body-MV22-nacelle-2-MV22-airframe': nacelleBand('body-MV22-nacelle-2-MV22-airframe'),
        }),
        [
          ...both('fin-upper', 'cv-usaf'),
          ...both('fin-lower', 'cv-0058'),
          ...both('insignia', 'insignia-cv'),
        ],
      ),
      variant(
        'jgsdf-v-22-91716',
        'JGSDF V-22 91716',
        'Japan Ground Self-Defense Force V-22 91716 from the referenced photograph: light gray, hinomaru with its white border on the aft fuselage, 91716 on the forward fuselage and the fins. The 陸上自衛隊 title is omitted (no Japanese lettering face). Approximate colors.',
        [refs.jp],
        paintAll(JP_GRAY),
        [
          ...both('roundel', 'hinomaru'),
          ...both('side-serial', 'jp-serial'),
          ...both('fin-lower', 'jp-fin'),
        ],
      ),
    ],
  };
}
