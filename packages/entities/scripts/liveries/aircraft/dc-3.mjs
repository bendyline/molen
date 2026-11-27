/**
 * DC-3 / C-47 liveries: a USAAF C-47A and an RAF Dakota in their June 1944 invasion stripes,
 * and two 1950s airline schemes in their real colors and layouts (fictional registrations, no
 * names or logos).
 *
 * The model stands in its three-point attitude: pitched 11.5 degrees nose-up and lowered
 * 0.821 m (dc-3.mjs). Everything is authored in the flight datum (dc-3.mjs stations: nose at
 * z 9.82, tail at -9.8; cabin windows centred on y 3.40 from z 4.6 to -1.3; fuselage between
 * y 1.82 and 4.78 at the cabin; wing root chord plane y 2.37 with 5 degrees of dihedral beyond
 * x 3.6; fin from z -3.7 to the rudder hinge at -7.56, rudder to -9.7, top y 7.2; tailplane at
 * y 3.77) and posed here, so stripes and lettering follow the fuselage.
 */
import * as art from '../art-twins.mjs';

const SHELL = 'body-DC3-shell-DC3-aluminium',
  RUDDER = 'body-DC3-rudder-DC3-fabric-controls',
  WINDOWS = 'accent-DC3-shell-DC3-blue',
  TRIM = 'orangeTrim';
const frame = art.posedFrame(11.5, -0.821);
const T5 = Math.tan((5 * Math.PI) / 180);

// The baked "DOUGLAS DC-3" type labels are gone from the model; drop their slots and add one
// region spanning fin (aluminium) and rudder (fabric) for tail lettering.
export function slots(existing) {
  const out = {};
  for (const [name, binding] of Object.entries(existing))
    if (!name.includes('label')) out[name] = binding;
  return { ...out, tail: { materials: ['DC3-aluminium', 'DC3-fabric-controls'] } };
}

export default function design({ kit: k, space, slots: all }) {
  const { pose, up: UP, fwd: FWD } = frame;
  const sides = ['1', '-1'];
  const anchors = {};
  const side = (name, slot, x, y, z, w, h, depth = 0.6) =>
    sides.forEach((s) => {
      const p = pose([Number(s) * x, y, z]);
      anchors[`${name}-${s}`] = space.anchor(slot, {
        center: p,
        facing: [Number(s), 0, 0],
        up: UP,
        width: w,
        height: h,
        depth,
      });
    });
  side('fus-insignia', SHELL, 1.0, 3.45, -4.15, 2.4, 1.2);
  side('nose', SHELL, 1.18, 3.4, 6.4, 1.8, 0.7);
  side('fin', 'tail', 0.08, 5.6, -7.2, 3.6, 2.8, 0.3);
  side('reg-rear', SHELL, 1.05, 3.5, -2.6, 2.6, 0.5);
  const wingAt = (x, top) => {
    const xs = Math.abs(x),
      y = 2.37 + T5 * Math.max(0, xs - 3.6) + (top ? 0.13 : -0.12);
    return space.anchor(SHELL, {
      center: pose([x, y, 2.35]),
      facing: top ? UP : frame.down,
      up: FWD,
      width: 3.0,
      height: 1.8,
      depth: 0.45,
    });
  };
  // Invasion stripes over the outer wing panels, outboard of the nacelles (x 3.95 to 7.0).
  for (const [name, x, top] of [
    ['stripes-upper-left', 5.475, true],
    ['stripes-upper-right', -5.475, true],
    ['stripes-lower-left', 5.475, false],
    ['stripes-lower-right', -5.475, false],
  ])
    anchors[name] = space.anchor(SHELL, {
      center: pose([x, 2.37 + T5 * (5.475 - 3.6) + (top ? 0.1 : -0.1), 2.7]),
      facing: top ? UP : frame.down,
      up: FWD,
      width: 3.05,
      height: 4.4,
      depth: 0.7,
    });
  anchors['wing-upper-left'] = wingAt(9.0, true);
  anchors['wing-lower-right'] = wingAt(-9.0, false);
  anchors['wing-upper-right'] = wingAt(-9.0, true);
  anchors['wing-lower-left'] = wingAt(9.0, false);

  // ---------------------------------------------------------------- zones ----
  const fuselageOnly = (slot = SHELL) => [
    space.plane(slot, [-1, 0, 0], [1.3, 0, 0]),
    space.plane(slot, [1, 0, 0], [-1.3, 0, 0]),
  ];
  const posedNormal = ([x, y, z]) => [
    x,
    y * Math.cos(0.2007) + z * Math.sin(0.2007),
    -y * Math.sin(0.2007) + z * Math.cos(0.2007),
  ];
  // Below the wing's mid-plane: the flat centre section (|x| < 3.6) and each dihedral panel.
  const underWings = (color) => [
    {
      color,
      planes: [
        space.plane(SHELL, [-1, 0, 0], [3.6, 0, 0]),
        space.plane(SHELL, [1, 0, 0], [-3.6, 0, 0]),
        space.plane(SHELL, posedNormal([0, -1, 0]), pose([0, 2.37, 0])),
      ],
    },
    ...[1, -1].map((s) => ({
      color,
      planes: [
        space.plane(SHELL, [s, 0, 0], [s * 3.6, 0, 0]),
        space.plane(SHELL, posedNormal([s * T5, -1, 0]), pose([s * 3.6, 2.37, 0])),
      ],
    })),
    // Tailplane underside (y 3.77), behind the fin leading edge.
    {
      color,
      planes: [
        frame.station(space, SHELL, -6.0, false),
        space.plane(SHELL, posedNormal([0, -1, 0]), pose([0, 3.77, 0])),
        frame.line(space, SHELL, [-6, 3.4], [-10, 3.4], 1),
      ],
    },
  ];
  const STRIPE = 0.61;
  const stripeColors = ['#ecebe3', '#17191b', '#ecebe3', '#17191b', '#ecebe3'];
  const fuselageStripes = (from) =>
    stripeColors.map((color, i) => ({
      color,
      roughness: 0.75,
      planes: [
        ...fuselageOnly(),
        // Stop at the crown so the dorsal fin root stays olive drab.
        frame.line(space, SHELL, [-2.6, 4.74], [-5.7, 4.36], -1),
        frame.station(space, SHELL, from - i * STRIPE, false),
        frame.station(space, SHELL, from - (i + 1) * STRIPE, true),
      ],
    }));
  const wingStripes = (slot, inner) =>
    [1, -1].flatMap((s) =>
      stripeColors.map((color, i) => ({
        color,
        roughness: 0.75,
        planes: [
          space.plane(slot, [s, 0, 0], [s * (inner + i * STRIPE), 0, 0]),
          space.plane(slot, [-s, 0, 0], [s * (inner + (i + 1) * STRIPE), 0, 0]),
        ],
      })),
    );
  // Fuselage window band and white crown (airline schemes).
  const band = (color, a0, b0, a1, b1, from = 9.9, to = -9.9) => ({
    color,
    planes: [
      ...fuselageOnly(),
      frame.line(space, SHELL, [from, a0], [to, a1], 1),
      frame.line(space, SHELL, [from, b0], [to, b1], -1),
    ],
  });
  const crown = (color, y0, y1) => ({
    color,
    planes: [...fuselageOnly(), frame.line(space, SHELL, [9.9, y0], [-9.9, y1], 1)],
  });
  const finAbove = (color, slot, y) => ({
    color,
    planes: [
      space.plane(slot, [-1, 0, 0], [0.4, 0, 0]),
      space.plane(slot, [1, 0, 0], [-0.4, 0, 0]),
      frame.station(space, slot, -3.6, false),
      frame.line(space, slot, [-3.6, y], [-10, y], 1),
    ],
  });

  // ------------------------------------------------------------- slot groups ----
  const fabric = Object.keys(all).filter((n) => n.includes('fabric-controls'));
  const elevatorMetal = Object.keys(all).filter((n) => /elevator.*aluminium/.test(n));
  const engines = Object.keys(all).filter((n) => /DC3-engine-(-?1)-DC3-aluminium/.test(n));
  const engineTrim = Object.keys(all).filter((n) => /DC3-engine-(-?1)-DC3-orange/.test(n));
  const flaps = fabric.filter((n) => n.includes('flap'));
  const NMF = { color: '#b9c2c6', metalness: 0.7, roughness: 0.34 };
  const paint = (color, extra = {}) => ({ color, metalness: 0.03, roughness: 0.75, ...extra });
  const OD = '#535236',
    NGRAY = '#7f817d',
    WHITE = '#f1f0ea',
    NAVY = '#1c2b52',
    YELLOW = '#e2b33a';

  // ---------------------------------------------------------------- graphics ----
  const g = {};
  g['us-fuselage'] = (() => {
    const c = new k.Canvas(2.4, 1.2);
    art.starAndBar(c, 1.2, 0.6, 0.5);
    return c.graphic('US star-and-bar (1943)');
  })();
  g['us-wing'] = (() => {
    const c = new k.Canvas(3.0, 1.8);
    art.starAndBar(c, 1.5, 0.9, 0.66);
    return c.graphic('US star-and-bar (1943)');
  })();
  g['c47-nose'] = art.lettering(k, 'T', 1.8, 0.7, '#f1f0ea', { height: 0.55 });
  g['c47-fin'] = (() => {
    const c = new k.Canvas(3.6, 2.8);
    art.text(c, '#f1f0ea', 'T', { x: 1.55, y: 1.65, height: 0.75 });
    art.text(c, YELLOW, '292879', { x: 1.55, y: 0.92, height: 0.3 });
    return c.graphic('Tail letter and serial');
  })();
  g['wing-stripes'] = (() => {
    const c = new k.Canvas(3.05, 4.4);
    for (const [i, color] of stripeColors.entries())
      c.rect(color, i * STRIPE, 0, STRIPE + (i < 4 ? 0.004 : 0), 4.4);
    return c.graphic('Invasion stripes');
  })();
  const typeC = (w, h, r) =>
    k
      .roundel(
        new k.Canvas(w, h),
        w / 2,
        h / 2,
        r,
        ['#2a3f87', '#f1f0ea', '#c8102e'],
        [0.44, 0.11, 0.45],
      )
      .graphic('RAF type C roundel');
  g['raf-fuselage'] = typeC(2.4, 1.2, 0.56);
  g['raf-wing'] = k
    .roundel(new k.Canvas(3.0, 1.8), 1.5, 0.9, 0.7, ['#2a3f87', '#c8102e'], [0.6, 0.4])
    .graphic('RAF type B roundel');
  g['raf-fin'] = (() => {
    const c = new k.Canvas(3.6, 2.8);
    art.finFlash(c, 1.15, 0.95, 0.7, 0.85, ['#c8102e', '#f1f0ea', '#2a3f87'], [0.42, 0.16, 0.42]);
    return c.graphic('RAF fin flash');
  })();
  g['raf-nose'] = art.stacked(
    k,
    1.8,
    0.7,
    [
      ['KWICHERBICHEN', 0.14, '#f1f0ea'],
      ['UK', 0.22, '#f1f0ea'],
    ],
    0.6,
  );
  g['sas-fin'] = (() => {
    const c = new k.Canvas(3.6, 2.8);
    c.add(NAVY, [
      [0.15, 1.15],
      [3.3, 1.8],
      [3.3, 2.18],
      [0.15, 1.53],
    ]);
    return c.graphic('Fin band');
  })();
  g['sas-reg'] = (() => {
    const c = new k.Canvas(3.6, 2.8);
    art.text(c, '#17191b', 'OY-DMZ', { x: 1.75, y: 0.95, height: 0.22 });
    return c.graphic('OY-DMZ');
  })();
  g['piedmont-fin'] = (() => {
    const c = new k.Canvas(3.6, 2.8);
    for (const [y, t] of [
      [1.62, 0.08],
      [1.42, 0.08],
    ])
      c.add(NAVY, [
        [0.25, y],
        [3.4, y + 0.25],
        [3.4, y + 0.25 + t],
        [0.25, y + t],
      ]);
    return c.graphic('Fin pinstripes');
  })();
  g['piedmont-reg'] = (() => {
    const c = new k.Canvas(3.6, 2.8);
    art.text(c, '#17191b', 'N58217', { x: 1.8, y: 1.05, height: 0.16 });
    return c.graphic('N58217');
  })();

  const references = {
    c47: {
      title: 'C-47A 42-92879 of the 442nd Troop Carrier Group, 1944 (USAF, public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:442d_Troop_Carrier_Group_Douglas_C-47A-15-DK_Skytrain_42-92879.jpg',
    },
    raf: {
      title:
        'Dakota III of No. 233 Squadron RAF returning from Normandy, 1944 (IWM, public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:Dakota_C.III_233_Sqn_RAF_returning_from_Normandy_1944.JPG',
    },
    sas: {
      title: 'SAS DC-3 OY-DDA on the ground, 1950s (public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:SAS_DC-3_Sven_Viking_OY-DDA,_on_the_ground,_at_the_airport.jpg',
    },
    piedmont: {
      title: 'Piedmont Airlines DC-3 boarding, 1950s (no known restrictions)',
      url: 'https://commons.wikimedia.org/wiki/File:A_Piedmont_Airlines_plane_and_seen_at_an_airport,_1950s_PhC_180_19_001.jpg',
    },
  };

  // D-Day finish shared by the C-47 and the Dakota: olive drab over neutral gray with stripes.
  const invasion = () => {
    const p = {
      [SHELL]: {
        ...paint(OD),
        zones: [
          {
            ...paint(NGRAY),
            planes: [...fuselageOnly(), frame.line(space, SHELL, [9.9, 2.55], [-9.9, 3.1], -1)],
          },
          ...underWings(NGRAY),
          ...fuselageStripes(-2.62),
        ],
      },
    };
    for (const n of [...fabric, ...elevatorMetal]) p[n] = paint(OD);
    for (const n of flaps) p[n] = { ...paint(OD), zones: wingStripes(n, 3.95) };
    for (const n of engines) p[n] = paint(OD);
    for (const n of engineTrim) p[n] = paint(OD);
    p[WINDOWS] = paint('#2a2d2b');
    p[TRIM] = paint(OD);
    return p;
  };
  const airline = (zones, finZones = [], extra = {}) => {
    const p = { [SHELL]: { ...NMF, zones } };
    for (const n of [...fabric, ...elevatorMetal]) p[n] = paint('#c4cbce', { roughness: 0.5 });
    for (const n of engines) p[n] = NMF;
    p[WINDOWS] = paint('#24282b');
    p[RUDDER] = { ...paint(WHITE, { roughness: 0.4 }), zones: finZones };
    return { ...p, ...extra };
  };

  return {
    selected: 'usaaf-c-47a-d-day',
    anchors,
    graphics: g,
    variants: [
      {
        id: 'usaaf-c-47a-d-day',
        label: 'USAAF C-47A 442nd TCG, D-Day 1944',
        provenance: {
          kind: 'inspired',
          note: 'C-47A 42-92879 of the 442nd Troop Carrier Group, June 1944: olive drab over neutral gray, five 24-inch invasion stripes round the rear fuselage and the outer wings, the 1943 star-and-bar on the stripes and on the upper left and lower right wing, the white call letter T behind the cockpit and on the fin, and the serial 292879 in yellow. The DC-3 model keeps its airliner door and windows; colors and stripe stations approximate.',
          references: [references.c47],
        },
        paints: invasion(),
        markings: [
          { anchor: 'fus-insignia-1', graphic: 'us-fuselage' },
          { anchor: 'fus-insignia--1', graphic: 'us-fuselage' },
          { anchor: 'nose-1', graphic: 'c47-nose' },
          { anchor: 'nose--1', graphic: 'c47-nose' },
          { anchor: 'fin-1', graphic: 'c47-fin' },
          { anchor: 'fin--1', graphic: 'c47-fin' },
          { anchor: 'wing-upper-left', graphic: 'us-wing' },
          { anchor: 'wing-lower-right', graphic: 'us-wing' },
          { anchor: 'stripes-upper-left', graphic: 'wing-stripes' },
          { anchor: 'stripes-upper-right', graphic: 'wing-stripes' },
          { anchor: 'stripes-lower-left', graphic: 'wing-stripes' },
          { anchor: 'stripes-lower-right', graphic: 'wing-stripes' },
        ],
      },
      {
        id: 'raf-dakota-233-squadron',
        label: 'RAF Dakota III, 233 Squadron, Normandy 1944',
        provenance: {
          kind: 'inspired',
          note: 'Dakota III of No. 233 Squadron RAF returning from Normandy in 1944: olive drab over neutral gray as delivered, invasion stripes round the rear fuselage and outer wings, the type C roundel over the fuselage stripes, type B roundels on the upper wings, the fin flash, and the UK code with the plain name KWICHERBICHEN behind the cockpit. Serial omitted (not legible in the photograph); colors approximate.',
          references: [references.raf],
        },
        paints: invasion(),
        markings: [
          { anchor: 'fus-insignia-1', graphic: 'raf-fuselage' },
          { anchor: 'fus-insignia--1', graphic: 'raf-fuselage' },
          { anchor: 'nose-1', graphic: 'raf-nose' },
          { anchor: 'nose--1', graphic: 'raf-nose' },
          { anchor: 'fin-1', graphic: 'raf-fin' },
          { anchor: 'fin--1', graphic: 'raf-fin', flip: true },
          { anchor: 'wing-upper-left', graphic: 'raf-wing' },
          { anchor: 'wing-upper-right', graphic: 'raf-wing' },
          { anchor: 'stripes-upper-left', graphic: 'wing-stripes' },
          { anchor: 'stripes-upper-right', graphic: 'wing-stripes' },
          { anchor: 'stripes-lower-left', graphic: 'wing-stripes' },
          { anchor: 'stripes-lower-right', graphic: 'wing-stripes' },
        ],
      },
      {
        id: 'scandinavian-1950s',
        label: 'Scandinavian airline 1950s, natural metal (OY-DMZ)',
        provenance: {
          kind: 'inspired',
          note: 'DC-3 in the 1950s colors of the referenced SAS OY-DDA: natural metal with a white cabin roof, a dark blue window cheatline from nose to tail, and a white fin with a slanted dark blue band. Fictional Danish registration OY-DMZ on the fin; airline titles, flags and emblem omitted. Colors approximate.',
          references: [references.sas],
        },
        paints: airline(
          [
            crown(WHITE, 3.75, 3.75),
            band(NAVY, 3.12, 3.68, 3.2, 3.62),
            finAbove(WHITE, SHELL, 4.3),
          ],
          [],
          { [TRIM]: paint(NAVY, { roughness: 0.4 }) },
        ),
        markings: [
          // The band rises toward the leading edge on both sides.
          { anchor: 'fin-1', graphic: 'sas-fin', flip: true },
          { anchor: 'fin--1', graphic: 'sas-fin' },
          { anchor: 'fin-1', graphic: 'sas-reg' },
          { anchor: 'fin--1', graphic: 'sas-reg' },
        ],
      },
      {
        id: 'local-service-1950s',
        label: 'US local service airline 1950s (N58217)',
        provenance: {
          kind: 'inspired',
          note: 'DC-3 in the 1950s colors of the referenced Piedmont Airlines aircraft: white cabin roof and fin, natural metal lower fuselage and wings, a dark blue window cheatline with a thin pinstripe below it, and two dark blue pinstripes across the fin. Fictional registration N58217 on the fin; airline titles and the emblem omitted. Colors approximate (the photograph is black and white).',
          references: [references.piedmont],
        },
        paints: airline(
          [
            crown(WHITE, 3.66, 3.7),
            band(NAVY, 3.18, 3.62, 3.2, 3.64),
            band(NAVY, 3.06, 3.1, 3.08, 3.12),
            finAbove(WHITE, SHELL, 4.3),
          ],
          [],
          { [TRIM]: paint(NAVY, { roughness: 0.4 }) },
        ),
        markings: [
          { anchor: 'fin-1', graphic: 'piedmont-fin' },
          { anchor: 'fin--1', graphic: 'piedmont-fin', flip: true },
          { anchor: 'fin-1', graphic: 'piedmont-reg' },
          { anchor: 'fin--1', graphic: 'piedmont-reg' },
        ],
      },
    ],
  };
}
