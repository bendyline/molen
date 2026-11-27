/**
 * OV-10 Bronco liveries: USAF, USMC, Luftwaffe, Venezuelan and Colombian schemes with their
 * national markings, serials and unit lettering redrawn as original vector art.
 *
 * Model frame: +Z nose, +X the aircraft's left, +Y up. The pod runs z 4.6 (nose) to -3.4, the
 * booms sit at x ±2.2 from the nacelles (z 1.6) to the fins (z -6 .. -8), the wing at y 2.78
 * spans z 0.6 (leading edge) to -1.62 and the tailplane sits on the fins at y 4.53.
 */
import * as art from '../art-twins.mjs';

const SHELL = 'body-Bronco-shell-Bronco-gray';
const sides = ['1', '-1'];

// Anchors span several meshes (fin + rudder), so they bind to every gray skin at once.
export function slots(existing) {
  return { ...existing, skin: { materials: ['Bronco-gray'] } };
}

export default function design({ kit: k, space, slots: all, bounds }) {
  const s = (side) => Number(side);
  const anchors = {};
  const at = (name, slot, o) => (anchors[name] = space.anchor(slot, o));
  for (const side of sides) {
    const x = s(side);
    // Fin and rudder outer face: serials, tail codes, flags. A green formation light strip
    // runs up the fin at y 3.2-3.6 (z -7.0), so lettering sits above or below it.
    at(`fin-upper-${side}`, 'skin', {
      center: [x * 2.26, 3.98, -7.35],
      facing: [x, 0, 0],
      width: 1.2,
      height: 0.6,
      depth: 0.3,
    });
    at(`fin-mid-${side}`, 'skin', {
      center: [x * 2.26, 3.85, -7.3],
      facing: [x, 0, 0],
      width: 1.2,
      height: 0.36,
      depth: 0.3,
    });
    at(`fin-lower-${side}`, 'skin', {
      center: [x * 2.26, 2.95, -7.15],
      facing: [x, 0, 0],
      width: 1.2,
      height: 0.4,
      depth: 0.3,
    });
    at(`fin-top-${side}`, 'skin', {
      center: [x * 2.25, 4.3, -7.4],
      facing: [x, 0, 0],
      width: 1.1,
      height: 0.3,
      depth: 0.3,
    });
    // Pod side behind the rear cockpit: national insignia.
    at(`pod-insignia-${side}`, SHELL, {
      center: [x * 0.57, 1.63, 0.3],
      facing: [x, 0, 0],
      width: 0.8,
      height: 0.5,
      depth: 0.5,
    });
    // Boom side aft of the wing: insignia, flags, service titles.
    at(`boom-fore-${side}`, SHELL, {
      center: [x * 2.5, 2.33, -2.2],
      facing: [x, 0, 0],
      width: 1.0,
      height: 0.42,
      depth: 0.4,
    });
    at(`boom-aft-${side}`, SHELL, {
      center: [x * 2.4, 2.4, -4.1],
      facing: [x, 0, 0],
      width: 1.6,
      height: 0.3,
      depth: 0.4,
    });
    // Propeller plane warning stripe, read bottom to top on the pod side.
    at(`prop-stripe-${side}`, SHELL, {
      center: [x * 0.53, 1.6, 1.65],
      facing: [x, 0, 0],
      up: [0, 0, -x],
      width: 0.62,
      height: 0.07,
      depth: 0.4,
    });
    // Ejection seat triangles below the sill, one per seat.
    at(`eject-front-${side}`, SHELL, {
      center: [x * 0.5, 1.7, 2.75],
      facing: [x, 0, 0],
      width: 0.15,
      height: 0.135,
      depth: 0.4,
    });
    at(`eject-rear-${side}`, SHELL, {
      center: [x * 0.56, 1.72, 1.35],
      facing: [x, 0, 0],
      width: 0.15,
      height: 0.135,
      depth: 0.4,
    });
    // Nose: shark mouths, unit badges, nose numbers.
    at(`nose-${side}`, SHELL, {
      center: [x * 0.42, 1.43, 3.85],
      facing: [x, 0, 0.3],
      width: 1.3,
      height: 0.7,
      depth: 0.5,
    });
    // Under the nose, on the nose gear bay fairing.
    at(`nose-number-${side}`, SHELL, {
      center: [x * 0.36, 1.16, 3.3],
      facing: [x, -0.7, 0],
      width: 0.55,
      height: 0.2,
      depth: 0.4,
    });
    // High on the nose ahead of the windshield.
    at(`nose-high-${side}`, SHELL, {
      center: [x * 0.38, 1.76, 3.9],
      facing: [x, 0.2, 0.3],
      width: 0.4,
      height: 0.18,
      depth: 0.4,
    });
    at(`nose-badge-${side}`, SHELL, {
      center: [x * 0.52, 1.6, 2.95],
      facing: [x, 0, 0],
      width: 0.3,
      height: 0.3,
      depth: 0.5,
    });
  }
  // Wing insignia: upper left, lower right; the star's point faces forward.
  at('wing-upper-left', SHELL, {
    center: [4.2, 2.9, -0.25],
    facing: [0, 1, 0],
    up: [0, 0, 1],
    width: 1.5,
    height: 1.0,
    depth: 0.3,
  });
  at('wing-lower-right', SHELL, {
    center: [-4.2, 2.69, -0.25],
    facing: [0, -1, 0],
    up: [0, 0, 1],
    width: 1.5,
    height: 1.0,
    depth: 0.3,
  });
  at('wing-upper-right', SHELL, {
    center: [-4.2, 2.9, -0.25],
    facing: [0, 1, 0],
    up: [0, 0, 1],
    width: 1.5,
    height: 1.0,
    depth: 0.3,
  });
  at('wing-lower-left', SHELL, {
    center: [4.2, 2.69, -0.25],
    facing: [0, -1, 0],
    up: [0, 0, 1],
    width: 1.5,
    height: 1.0,
    depth: 0.3,
  });
  // NO STEP over the flaps inboard of the booms.
  for (const side of sides)
    at(`no-step-${side}`, SHELL, {
      center: [s(side) * 1.2, 2.86, -0.85],
      facing: [0, 1, 0],
      up: [0, 0, 1],
      width: 0.5,
      height: 0.12,
      depth: 0.2,
    });

  // ---------------------------------------------------------------- graphics ----
  const BLACK = '#1a1c1d',
    WHITE = '#f1efe8';
  const g = {};
  g['prop-stripe'] = art.propellerStripe(k, 0.62, 0.07);
  g.eject = art.ejectionTriangle(k, 0.15);
  g['no-step'] = art.noStep(k, 0.5, 0.12);
  const usFull = (w, h, r) =>
    k
      .usInsignia(new k.Canvas(w, h), w / 2, h / 2, r, { style: 'full' })
      .graphic('US national insignia');
  const usLow = (w, h, r, color) =>
    k
      .usInsignia(new k.Canvas(w, h), w / 2, h / 2, r, { style: 'lowvis', color })
      .graphic('US national insignia (subdued)');
  g['us-pod'] = usFull(0.8, 0.5, 0.17);
  g['us-wing'] = usFull(1.5, 1.0, 0.33);
  g['us-pod-black'] = usLow(0.8, 0.5, 0.17, BLACK);
  g['us-wing-black'] = usLow(1.5, 1.0, 0.33, BLACK);

  // ------------------------------------------------------------------ paints ----
  const bodySlots = Object.keys(all).filter((n) => n.startsWith('body-'));
  const flat = (color, extra = {}) => art.paintAll(bodySlots, { color, ...extra });
  const camoBody = (colors, period, seed, style, extra = {}) =>
    art.paintAll(bodySlots, (n) => ({
      color: colors[0],
      camouflage: art.camo(bounds, n, colors, period, seed, style),
      ...extra,
    }));
  const both = (anchor, graphic, flipRight = false) =>
    sides.map((side) => ({
      anchor: `${anchor}-${side}`,
      graphic,
      ...(flipRight && side === '-1' ? { flip: true } : {}),
    }));
  const stencils = (noStep = 'no-step') => [
    ...both('prop-stripe', 'prop-stripe'),
    ...both('eject-front', 'eject'),
    ...both('eject-rear', 'eject'),
    ...both('no-step', noStep),
  ];
  // Underside zones for wraparound-free schemes: pod belly, boom bellies, wing and tail undersides.
  const under = (color) => [
    {
      color,
      planes: [
        space.below(SHELL, 1.42),
        space.plane(SHELL, [-1, 0, 0], [0.9, 0, 0]),
        space.plane(SHELL, [1, 0, 0], [-0.9, 0, 0]),
      ],
    },
    // Boom bellies: a line from the nacelle chin (y 1.98) to the slim tail boom (y 2.3).
    {
      color,
      planes: [
        space.sideLine(SHELL, [1.6, 1.98], [-6.2, 2.3], -1),
        space.plane(SHELL, [1, 0, 0], [1.6, 0, 0]),
      ],
    },
    {
      color,
      planes: [
        space.sideLine(SHELL, [1.6, 1.98], [-6.2, 2.3], -1),
        space.plane(SHELL, [-1, 0, 0], [-1.6, 0, 0]),
      ],
    },
    {
      color,
      planes: [
        space.below(SHELL, 2.8),
        space.above(SHELL, 2.62),
        space.ahead(SHELL, -1.7),
        space.behind(SHELL, 0.8),
      ],
    },
    { color, planes: [space.below(SHELL, 4.55), space.above(SHELL, 4.4)] },
    // Sponson undersides, below each stub wing's mid-plane (root y 1.17 at x 0.45, tip 1.03).
    ...[1, -1].map((x) => ({
      color,
      planes: [
        space.plane(SHELL, [-x * 0.126, -1, 0], [x * 0.45, 1.17, 0]),
        space.plane(SHELL, [x, 0, 0], [x * 0.4, 0, 0]),
        space.plane(SHELL, [-x, 0, 0], [x * 1.7, 0, 0]),
      ],
    })),
    {
      color,
      planes: [space.below(SHELL, 2.68), space.above(SHELL, 2.5), space.behind(SHELL, -6.7)],
    },
  ];

  const references = {
    sea: {
      title: 'OV-10A over the Mekong delta, USAF (public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:OV-10A_USAF_over_Mekong_delta.jpg',
    },
    rtaf: {
      title: 'OV-10C of the Royal Thai Air Force, 1987 (US DoD, public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:OV-10A_RThaiAF_1987.JPEG',
    },
    tasw601: {
      title: 'OV-10As of the 601st TASW over Germany, 1982 (USAF, public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:OV-10As_601st_TASW_over_Germany_1982.JPEG',
    },
    vmo4: {
      title: 'OV-10As of VMO-4, 1990 (USMC, public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:OV-10As_VMO-4_1990.JPEG',
    },
    ven: {
      title: 'OV-10E 2641 of the Venezuelan Air Force (CC BY-SA 3.0)',
      url: 'https://commons.wikimedia.org/wiki/File:2641_Rockwell_OV-10E_Bronco_Venezuela_Airforce_(7453147600).jpg',
    },
    luft: {
      title: 'OV-10B 99+18 in Luftwaffe target-tug colors (CC0)',
      url: 'https://commons.wikimedia.org/wiki/File:North_American_Rockwell_OV-10B_Bronco_Luftwaffe_99%2B18,_pic1.JPG',
    },
    fac: {
      title: 'OV-10A FAC 2223 of the Colombian Air Force (CC BY-SA 3.0)',
      url: 'https://commons.wikimedia.org/wiki/File:FAC2223_North_American_OV-10A_Bronco_Colombian_Air_Force_(7501643166).jpg',
    },
  };

  // ------------------------------------------------- USAF Southeast Asia camouflage ----
  const SEA = ['#9b7f5c', '#55613a', '#38432c'],
    SEA_GRAY = '#c3c6c0';
  g['usaf-14650'] = art.stacked(k, 1.2, 0.6, [
    ['USAF', 0.2, BLACK],
    ['14650', 0.2, BLACK],
  ]);
  const seaPaints = (() => {
    const p = camoBody(SEA, 5.5, 1971, 'blotch');
    p[SHELL] = { ...p[SHELL], zones: under(SEA_GRAY) };
    for (const n of bodySlots)
      if (/flap|aileron/.test(n))
        p[n] = { ...p[n], zones: [{ color: SEA_GRAY, planes: [space.below(n, 2.8)] }] };
    p['body-Bronco-elevator-skin-Bronco-gray'] = {
      ...p['body-Bronco-elevator-skin-Bronco-gray'],
      zones: [
        { color: SEA_GRAY, planes: [space.below('body-Bronco-elevator-skin-Bronco-gray', 4.535)] },
      ],
    };
    for (const n of [
      'body-Bronco-bay-door-1-inner-Bronco-gray',
      'body-Bronco-bay-door-1-outer-Bronco-gray',
      'body-Bronco-bay-door-2-inner-Bronco-gray',
      'body-Bronco-bay-door-2-outer-Bronco-gray',
      'body-Bronco-gear-0-Bronco-gray',
    ])
      p[n] = { color: SEA_GRAY };
    return p;
  })();

  // ------------------------------------------------------------ 601st TASW Europe ----
  const EURO = ['#2f3b30', '#4f5a3a', '#3b3e3f'];
  g['usaf-13556'] = art.stacked(k, 1.2, 0.6, [
    ['USAF', 0.16, BLACK],
    ['13556', 0.16, BLACK],
  ]);

  // --------------------------------------------------------------- USMC VMO-4 gray ----
  const TPS = '#8e979c';
  g['marines-black'] = art.lettering(k, 'MARINES', 1.6, 0.3, '#3d4246', {
    height: 0.2,
    tracking: 0.08,
  });
  g['usmc-155443'] = art.lettering(k, '155443', 1.1, 0.3, '#3d4246', { height: 0.14 });
  g['usmc-code'] = art.lettering(k, 'MU', 1.2, 0.6, '#3d4246', { height: 0.42 });
  g['us-pod-gray'] = usLow(0.8, 0.5, 0.17, '#4a5156');
  g['us-wing-gray'] = usLow(1.5, 1.0, 0.33, '#4a5156');

  // ------------------------------------------------------------- Venezuela OV-10E ----
  const VEN = ['#8f9890', '#c9ab9f'];
  g['ven-flag'] = (() => {
    const c = new k.Canvas(1.0, 0.42);
    art.venezuelaFlag(c, 0.34, 0.07, 0.42, 0.28);
    return c.graphic('Venezuelan flag');
  })();
  g['ven-2641'] = art.lettering(k, '2641', 1.2, 0.36, BLACK, { height: 0.18 });
  g['ven-pennant'] = (() => {
    const c = new k.Canvas(1.1, 0.3);
    c.add('#f1efe8', [
      [0.3, 0.01],
      [0.3, 0.29],
      [0.84, 0.15],
    ]);
    c.add('#c4122f', [
      [0.325, 0.04],
      [0.325, 0.26],
      [0.73, 0.15],
    ]);
    c.circle('#f1efe8', 0.42, 0.15, 0.075, 24);
    art.text(c, '#c4122f', 'XI', { x: 0.42, y: 0.15, height: 0.075 });
    return c.graphic('Unit pennant');
  })();
  g['ven-roundel-wing'] = (() => {
    const c = new k.Canvas(1.5, 1.0);
    art.venezuelaRoundel(c, 0.75, 0.5, 0.36);
    return c.graphic('Venezuelan roundel');
  })();

  // ------------------------------------------------------------ Luftwaffe OV-10B ----
  const OLIVE = '#575438',
    DAYGLO = '#f2561d';
  g['balken-boom'] = k.balkenkreuz(new k.Canvas(1.0, 0.42), 0.5, 0.21, 0.4).graphic('Balkenkreuz');
  g['balken-wing'] = k.balkenkreuz(new k.Canvas(1.5, 1.0), 0.75, 0.5, 0.8).graphic('Balkenkreuz');
  g['de-9918-boom'] = art.lettering(k, '99+18', 1.6, 0.3, BLACK, { height: 0.2 });
  g['de-18-nose'] = art.lettering(k, '18', 0.4, 0.18, WHITE, { height: 0.14 });
  g['de-flag'] = (() => {
    const c = new k.Canvas(1.1, 0.3);
    art.bandFlag(c, 0.45, 0.06, 0.3, 0.18, ['#141414', '#d00000', '#ffce00']);
    return c.graphic('German flag');
  })();

  // ------------------------------------------------------------- Colombia OV-10A ----
  const FAC_GRAY = '#5d6366';
  g['fac-roundel'] = (() => {
    const c = new k.Canvas(1.0, 0.42);
    art.colombiaRoundel(c, 0.5, 0.21, 0.19);
    return c.graphic('Colombian Air Force roundel');
  })();
  g['fac-roundel-wing'] = (() => {
    const c = new k.Canvas(1.5, 1.0);
    art.colombiaRoundel(c, 0.75, 0.5, 0.38);
    return c.graphic('Colombian Air Force roundel');
  })();
  g['fac-serial'] = art.stacked(k, 1.2, 0.6, [
    ['FAC', 0.17, BLACK],
    ['2223', 0.17, BLACK],
  ]);
  g['fac-flag'] = (() => {
    const c = new k.Canvas(1.1, 0.3);
    art.bandFlag(c, 0.42, 0.07, 0.26, 0.16, ['#f4c400', '#1f3f93', '#c8102e'], [0.5, 0.25, 0.25]);
    return c.graphic('Colombian flag');
  })();
  g['fac-band'] = (() => {
    const c = new k.Canvas(1.2, 0.4);
    c.add('#1b1c1d', [
      [0, 0.02],
      [1.2, 0.16],
      [1.2, 0.38],
      [0, 0.24],
    ]);
    c.add('#f0c419', [
      [0, 0.045],
      [1.2, 0.185],
      [1.2, 0.355],
      [0, 0.215],
    ]);
    art.text(c, '#1b1c1d', 'BRONCO', { x: 0.6, y: 0.2, height: 0.1, maxWidth: 1.0 });
    return c.graphic('Fin band');
  })();
  g['fac-2223-nose'] = art.lettering(k, '2223', 0.55, 0.2, BLACK, { height: 0.13 });
  g.shark = art.sharkMouth(k, 1.3, 0.7);

  return {
    selected: 'usaf-sea-camouflage',
    anchors,
    graphics: g,
    variants: [
      {
        id: 'usaf-sea-camouflage',
        label: 'USAF Southeast Asia camouflage',
        provenance: {
          kind: 'inspired',
          note: 'USAF OV-10A in the T.O. 1-1-4 Southeast Asia scheme: FS 30219 tan, FS 34102 medium green and FS 34079 dark green over FS 36622 light gray, the pattern generated as organic patches rather than the factory pattern drawing. Pattern and underside split follow the SEA-camouflaged Thai OV-10C photograph; USAF and the serial on the fins and the national insignia on the pod and wings (upper left, lower right) follow the USAF Mekong photograph of 67-14650, which shows that aircraft in its earlier gray. Red PROPELLER stripes, ejection-seat triangles and NO STEP stencils. Colors and the patch pattern are approximations.',
          references: [references.sea, references.rtaf],
        },
        paints: { ...seaPaints, 'accent-Bronco-shell-Bronco-antiglare': { color: '#22261f' } },
        markings: [
          ...both('fin-upper', 'usaf-14650'),
          ...both('pod-insignia', 'us-pod'),
          { anchor: 'wing-upper-left', graphic: 'us-wing' },
          { anchor: 'wing-lower-right', graphic: 'us-wing' },
          ...stencils(),
        ],
      },
      {
        id: 'venezuelan-desert-camouflage',
        label: 'Venezuelan Air Force desert camouflage',
        provenance: {
          kind: 'inspired',
          note: 'OV-10E 2641 of the Venezuelan Air Force as preserved: sand-pink and gray-green wraparound camouflage (generated patches), the serial on the fins, the unit pennant redrawn as a plain original triangle, Venezuelan flag on the booms and roundels on the wings. Faded colors are approximated; small stencils are omitted.',
          references: [references.ven],
        },
        paints: {
          ...camoBody(VEN, 5.5, 1973, 'blotch'),
          'accent-Bronco-shell-Bronco-antiglare': { color: '#2b2f2c' },
        },
        markings: [
          ...both('fin-mid', 'ven-2641'),
          ...both('fin-top', 'ven-pennant'),
          ...both('boom-fore', 'ven-flag'),
          { anchor: 'wing-upper-left', graphic: 'ven-roundel-wing' },
          { anchor: 'wing-lower-right', graphic: 'ven-roundel-wing' },
          { anchor: 'wing-upper-right', graphic: 'ven-roundel-wing' },
          { anchor: 'wing-lower-left', graphic: 'ven-roundel-wing' },
          ...both('prop-stripe', 'prop-stripe'),
          ...both('eject-front', 'eject'),
          ...both('eject-rear', 'eject'),
        ],
      },
      {
        id: 'usaf-601st-tasw-european-one',
        label: 'USAF 601st TASW European One, 1982',
        provenance: {
          kind: 'inspired',
          note: 'OV-10A of the 601st Tactical Air Support Wing over Germany in 1982: wraparound European One camouflage (FS 34092 and FS 34102 greens, FS 36081 gunship gray) as generated patches, black USAF and serial on the fins, subdued black national insignia, PROPELLER and ejection-seat stencils. Pattern and colors are approximations.',
          references: [references.tasw601],
        },
        paints: {
          ...camoBody(EURO, 6.0, 1982, 'blotch'),
          'accent-Bronco-shell-Bronco-antiglare': { color: '#202422' },
        },
        markings: [
          ...both('fin-upper', 'usaf-13556'),
          ...both('pod-insignia', 'us-pod-black'),
          { anchor: 'wing-upper-left', graphic: 'us-wing-black' },
          { anchor: 'wing-lower-right', graphic: 'us-wing-black' },
          ...stencils(),
        ],
      },
      {
        id: 'usmc-vmo-4-gray',
        label: 'USMC VMO-4 tactical gray, 1990',
        provenance: {
          kind: 'inspired',
          note: 'USMC OV-10A of VMO-4 in 1990: overall tactical gray (about FS 36320), MARINES on the booms, the MU tail code and serial on the fins in darker gray, low-visibility national insignia, PROPELLER and ejection-seat stencils. Serial chosen from the squadron range; colors approximate.',
          references: [references.vmo4],
        },
        paints: { ...flat(TPS), 'accent-Bronco-shell-Bronco-antiglare': { color: '#2b3033' } },
        markings: [
          ...both('fin-upper', 'usmc-code'),
          ...both('fin-top', 'usmc-155443'),
          ...both('boom-aft', 'marines-black'),
          ...both('pod-insignia', 'us-pod-gray'),
          { anchor: 'wing-upper-left', graphic: 'us-wing-gray' },
          { anchor: 'wing-lower-right', graphic: 'us-wing-gray' },
          ...stencils(),
        ],
      },
      {
        id: 'luftwaffe-target-tug',
        label: 'Luftwaffe OV-10B target tug 99+18',
        provenance: {
          kind: 'inspired',
          note: 'OV-10B 99+18 in Luftwaffe target-towing colors as restored: olive drab with Day-Glo orange nose panel and nacelle fronts, Balkenkreuz on the booms and wings, 99+18 on the booms, 18 on the nose, German flag on the fins. Colors and panel shapes are approximations.',
          references: [references.luft],
        },
        paints: (() => {
          const p = flat(OLIVE);
          p[SHELL] = {
            color: OLIVE,
            zones: [
              // Nacelle fronts ahead of the wing leading edge.
              {
                color: DAYGLO,
                planes: [space.ahead(SHELL, 0.9), space.plane(SHELL, [1, 0, 0], [1.75, 0, 0])],
              },
              {
                color: DAYGLO,
                planes: [space.ahead(SHELL, 0.9), space.plane(SHELL, [-1, 0, 0], [-1.75, 0, 0])],
              },
              // Lower nose panel.
              {
                color: DAYGLO,
                planes: [
                  space.ahead(SHELL, 3.55),
                  space.below(SHELL, 1.72),
                  space.behind(SHELL, 4.45),
                ],
              },
            ],
          };
          p['body-Bronco-cowl-0-Bronco-gray'] = { color: DAYGLO };
          p['body-Bronco-cowl-1-Bronco-gray'] = { color: DAYGLO };
          return { ...p, 'accent-Bronco-shell-Bronco-antiglare': { color: '#2a2a20' } };
        })(),
        markings: [
          ...both('fin-top', 'de-flag'),
          ...both('boom-fore', 'balken-boom'),
          ...both('boom-aft', 'de-9918-boom'),
          ...both('nose-high', 'de-18-nose'),
          { anchor: 'wing-upper-left', graphic: 'balken-wing' },
          { anchor: 'wing-upper-right', graphic: 'balken-wing' },
          { anchor: 'wing-lower-left', graphic: 'balken-wing' },
          { anchor: 'wing-lower-right', graphic: 'balken-wing' },
          ...both('eject-front', 'eject'),
          ...both('eject-rear', 'eject'),
        ],
      },
      {
        id: 'colombian-shark-gray',
        label: 'Colombian Air Force shark mouth, FAC 2223',
        provenance: {
          kind: 'inspired',
          note: 'OV-10A FAC 2223 of the Colombian Air Force as preserved: overall dark gray with a shark mouth and eyes on the nose (original drawing), FAC 2223 and the national flag on the fins, the yellow BRONCO fin band, the Air Force roundel on the booms and wings, 2223 under the nose, PROPELLER stripes and ejection-seat triangles. The squadron badge is omitted; colors approximate.',
          references: [references.fac],
        },
        paints: { ...flat(FAC_GRAY), 'accent-Bronco-shell-Bronco-antiglare': { color: '#26292b' } },
        markings: [
          ...both('fin-upper', 'fac-serial'),
          ...both('fin-lower', 'fac-band'),
          ...both('fin-top', 'fac-flag'),
          ...both('boom-fore', 'fac-roundel'),
          ...both('nose', 'shark', true),
          ...both('nose-number', 'fac-2223-nose'),
          { anchor: 'wing-upper-left', graphic: 'fac-roundel-wing' },
          { anchor: 'wing-lower-right', graphic: 'fac-roundel-wing' },
          ...stencils(),
        ],
      },
    ],
  };
}
