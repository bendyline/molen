/**
 * Beechcraft G36 Bonanza liveries: the 2022 75th-anniversary edition, the 2015 and 2007 factory
 * schemes, Beech's late-1980s A36 paint, an owner's stars-and-stripes custom scheme and the
 * Indonesian Navy G36 trainer.
 *
 * Civil schemes take the photographed colors and layout with fictional US registrations and no
 * Beechcraft or Bonanza logos; the Indonesian Navy scheme carries its real title, serial and flag
 * as original vector art. Paint regions are authored in model metres and applied to every paint
 * slot (shell, the baked belt bands, gear doors, flaps, ailerons, elevators and rudder skin).
 */
import {
  above,
  ahead,
  behind,
  below,
  front,
  inboard,
  over,
  paintSlots,
  SideArt,
  spline,
  taper,
  under,
} from '../art-ga-a.mjs';

const SHELL = 'body-Bonanza-shell-Bonanza-ivory',
  BANDS = 'accent-Bonanza-shell-Bonanza-navy',
  RUDDER = 'accent-Bonanza-rudder-Bonanza-navy';

// Paint slots: the existing regions without the old cabin-top overlay, which overlapped the
// shell and its bands.
export function slots(existing) {
  const { topPaint: _, ...rest } = existing;
  return rest;
}

const WHITE = '#f2f2ee',
  CREAM = '#efe8d4',
  FLAG_CREAM = '#f1e7c9',
  BURGUNDY = '#76162a',
  NAVY = '#17203d',
  STEEL = '#8e959c',
  CHARCOAL = '#2c2d30',
  WINE = '#7c1f2c',
  FLAG_RED = '#b8202e',
  FLAG_NAVY = '#1c2552',
  NAVY_GRAY = '#a4abb1',
  BLACK = '#17181b';

export default function design({ kit: k, space, slots: all }) {
  const painted = Object.keys(all).filter((n) => space.bounds[n]);
  const paint = (base, regions, finish) => paintSlots(space, painted, base, regions, finish);
  const anchors = {},
    graphics = {};
  const place = (name, art, layers, reach, mirror) => {
    layers.forEach((slot, i) => {
      Object.assign(anchors, art.anchors(space, slot, `${name}.${i}`, { reach }));
    });
    return layers.flatMap((_, i) => [
      { anchor: `${name}.${i}-l`, graphic: name },
      { anchor: `${name}.${i}-r`, graphic: name, ...(mirror ? { flip: true } : {}) },
    ]);
  };
  /** Side art on each listed slot, mirrored on the right so it flows nose to tail. */
  const sideArt = (name, art, { reach = 0.72, layers = [SHELL, BANDS], mirror = true } = {}) => {
    graphics[name] = art.graphic(name);
    return place(name, art, layers, reach, mirror);
  };
  /** Lettering centred at (z, y); `shadow` draws an offset copy behind it, `halo` an edge. */
  const text = (
    name,
    label,
    {
      z,
      y,
      width,
      height,
      color,
      cap = height * 0.8,
      layers = [SHELL],
      reach = 0.72,
      face = 'technical',
      slant = 0,
      shadow,
      halo,
    },
  ) => {
    const art = new SideArt(k, {
      zFront: z + width / 2,
      zRear: z - width / 2,
      yBottom: y - height / 2,
      yTop: y + height / 2,
    });
    const c = art.canvas,
      opts = { height: cap, face, slant, maxWidth: width * 0.96 - Math.abs(slant) * cap };
    if (halo)
      for (const [dx, dy] of [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ])
        c.text(halo, label, {
          x: width / 2 + dx * cap * 0.06,
          y: height / 2 + dy * cap * 0.06,
          ...opts,
        });
    if (shadow)
      c.text(shadow, label, { x: width / 2 + cap * 0.05, y: height / 2 - cap * 0.05, ...opts });
    c.text(color, label, { x: width / 2, y: height / 2, ...opts });
    graphics[name] = c.graphic(label);
    return place(name, art, layers, reach, false);
  };
  // Fuselage colors: full width ahead of the stabilizer, only the tail cone behind its leading
  // edge, so stabilizer roots and the low wing's root stay in the base color.
  const body = (color, planes, finish = {}) => [
    { color, ...finish, planes: [...planes, above(0.45), ahead(-4.2), ...inboard(0.645)] },
    { color, ...finish, planes: [...planes, behind(-4.2), ...inboard(0.22)] },
  ];
  const fin = (color, planes) => ({ color, planes: [...planes, behind(-3.95), ...inboard(0.2)] });

  /* ---------------------------------------------------- 75th anniversary, 2022 ---- */
  // Metallic burgundy cowling and upper fuselage over a white lower fuselage, the split sweeping
  // up from the cowl bottom to the fin root with navy and gray pinstripes, a burgundy and white
  // checker flag behind the cowling, burgundy and navy bands at the fin tip.
  const metallic = { roughness: 0.3, metalness: 0.35 };
  const split75 = [
    [1.42, 0.6],
    [0.7, 0.8],
    [0.0, 1.03],
    [-1.0, 1.28],
    [-2.2, 1.5],
    [-3.3, 1.66],
    [-3.95, 1.75],
  ];
  const seg = (i) => [split75[i], split75[i + 1]];
  const anniversary = [
    { color: BURGUNDY, ...metallic, planes: [ahead(1.42), above(0.45), ...inboard(0.645)] },
    ...[0, 1, 2, 3, 4, 5].map((i) => ({
      color: BURGUNDY,
      ...metallic,
      planes: [ahead(split75[i + 1][0]), behind(split75[i][0]), over(...seg(i)), ...inboard(0.645)],
    })),
    fin(BURGUNDY, [above(2.4)]),
    fin(NAVY, [above(2.33), below(2.365)]),
  ];
  const lines75 = new SideArt(k, { zFront: 1.5, zRear: -4.0, yBottom: 0.5, yTop: 1.8 });
  const offset = (dy) =>
    spline(
      split75.map(([z, y]) => [z, y + dy]),
      4,
    );
  lines75.between(NAVY, ...taper(offset(-0.035), 0.018, { lead: 0.08, trail: 0.15 }));
  lines75.between(STEEL, ...taper(offset(-0.085), 0.035, { lead: 0.1, trail: 0.3 }));
  const pins75 = sideArt('g36-75-pins', lines75);
  // Checker flag: three rows of checks leaning with the split, dropping out toward the rear.
  const checks = new SideArt(k, { zFront: 1.35, zRear: 0.05, yBottom: 0.92, yTop: 1.42 });
  const s = 0.095,
    lean = 0.3;
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 12; col++) {
      if ((row + col) % 2 || col > 11 - row * 2) continue;
      const z0 = 1.3 - col * s - row * s * lean,
        y0 = 1.12 - row * s + col * s * 0.12;
      checks.poly(WHITE, [
        [z0, y0],
        [z0 - s, y0 + s * 0.12],
        [z0 - s - s * lean, y0 + s * 0.12 + s],
        [z0 - s * lean, y0 + s],
      ]);
    }
  const checker75 = sideArt('g36-75-checks', checks);
  const reg75 = text('reg-n175bz', 'N175BZ', {
    z: -2.65,
    y: 1.12,
    width: 1.45,
    height: 0.28,
    cap: 0.22,
    color: NAVY,
    layers: [SHELL, BANDS],
  });

  /* ---------------------------------------------------- 2015 factory scheme ---- */
  const factory2015 = [
    { color: NAVY, planes: [ahead(1.42), over([2.66, 1.3], [1.42, 1.6]), ...inboard(0.645)] },
    fin(NAVY, [above(2.44)]),
  ];
  const art2015 = new SideArt(k, { zFront: 2.6, zRear: -5.3, yBottom: 0.65, yTop: 1.75 });
  art2015.between(
    NAVY,
    ...taper(
      spline(
        [
          [1.45, 1.61],
          [1.0, 1.6],
          [0.55, 1.56],
        ],
        4,
      ),
      0.09,
      { lead: 0, trail: 0.9 },
    ),
  );
  const pinLine = [
    [2.35, 1.24],
    [0.6, 1.31],
    [-1.2, 1.34],
    [-2.8, 1.32],
    [-4.1, 1.22],
    [-5.2, 1.12],
  ];
  art2015.between(NAVY, ...taper(spline(pinLine, 4), 0.022, { lead: 0.05, trail: 0.12 }));
  art2015.between(
    STEEL,
    ...taper(
      spline(
        pinLine.map(([z, y]) => [z, y - 0.042]),
        4,
      ),
      0.014,
      { lead: 0.05, trail: 0.12 },
    ),
  );
  art2015.between(
    NAVY,
    ...taper(
      spline(
        [
          [-2.7, 0.76],
          [-3.9, 0.86],
          [-5.25, 1.07],
        ],
        4,
      ),
      0.07,
      { lead: 0.35, trail: 0.05 },
    ),
  );
  const stripes2015 = sideArt('g36-2015', art2015);
  const reg2015 = text('reg-n836gb', 'N836GB', {
    z: -2.55,
    y: 1.1,
    width: 1.6,
    height: 0.3,
    cap: 0.25,
    color: NAVY,
    layers: [SHELL, BANDS],
  });

  /* ---------------------------------------------------- 2007 factory navy ---- */
  const split07 = [
    [2.66, 1.18],
    [-4.6, 1.12],
  ];
  const factory2007 = [
    ...body(NAVY, [under(...split07)]),
    fin(NAVY, [above(2.45)]),
    fin(NAVY, [above(2.33), below(2.37)]),
    fin(NAVY, [above(2.25), below(2.275)]),
  ];
  const art2007 = new SideArt(k, { zFront: 2.6, zRear: -4.7, yBottom: 1.1, yTop: 1.6 });
  art2007.between(
    STEEL,
    ...taper(
      [
        [2.6, 1.205],
        [-1.0, 1.19],
        [-4.2, 1.175],
      ],
      0.03,
      { lead: 0.02, trail: 0.1 },
    ),
  );
  art2007.between(
    NAVY,
    ...taper(
      [
        [2.55, 1.245],
        [-1.0, 1.232],
        [-4.0, 1.22],
      ],
      0.014,
      { lead: 0.03, trail: 0.1 },
    ),
  );
  // The navy hooks up at the tail toward the fin root.
  art2007.between(
    NAVY,
    ...taper(
      spline(
        [
          [-3.2, 1.13],
          [-3.8, 1.2],
          [-4.3, 1.36],
          [-4.55, 1.55],
        ],
        5,
      ),
      0.09,
      { lead: 0.2, trail: 0.4 },
    ),
  );
  const stripes2007 = sideArt('g36-2007', art2007);
  const reg2007 = text('reg-n6236b', 'N6236B', {
    z: -2.85,
    y: 1.36,
    width: 1.5,
    height: 0.28,
    cap: 0.23,
    color: NAVY,
  });

  /* ---------------------------------------------------- 1987 A36 factory ---- */
  const cheat = [
    [2.66, 1.25],
    [-5.3, 1.16],
  ];
  const lift = (line, dy) => line.map(([z, y]) => [z, y + dy]);
  const a36 = [
    ...body(CHARCOAL, [over(...cheat), under(...lift(cheat, 0.07))]),
    ...body(WINE, [over(...lift(cheat, 0.085)), under(...lift(cheat, 0.1))]),
    { color: CHARCOAL, planes: [behind(-3.9), under(...cheat), ...inboard(0.22)] },
    fin(CHARCOAL, [above(2.42)]),
    fin(WINE, [above(2.355), below(2.385)]),
  ];
  const regA36 = text('reg-n3617k', 'N3617K', {
    z: -2.8,
    y: 0.98,
    width: 2.2,
    height: 0.36,
    cap: 0.29,
    color: CHARCOAL,
    slant: 0.2,
    layers: [SHELL, BANDS],
  });

  /* ---------------------------------------------------- stars and stripes ---- */
  // Navy nose with white stars back to the windshield posts, red and cream stripes slanting
  // down and aft over the cabin and tail cone, level stripes across the fin.
  const field = [
    [1.05, 0.5],
    [0.5, 2.2],
  ];
  const patriot = [
    { color: FLAG_NAVY, planes: [front(...field), above(0.45), ...inboard(0.7)] },
    fin(FLAG_RED, [above(2.47)]),
  ];
  const slope = 0.3,
    period = 0.3;
  const diagonal = (art, z0, z1, _y0, _y1) => {
    for (let b = -1.2; b < 3.6; b += period) {
      const y = (z) => b + slope * z;
      art.poly(FLAG_RED, [
        [z0, y(z0)],
        [z1, y(z1)],
        [z1, y(z1) + period / 2],
        [z0, y(z0) + period / 2],
      ]);
    }
    return art;
  };
  const cabinStripes = sideArt(
    'flag-cabin',
    diagonal(new SideArt(k, { zFront: 0.95, zRear: -3.8, yBottom: 0.5, yTop: 2.12 }), 1.3, -3.9),
  );
  const coneStripes = sideArt(
    'flag-cone',
    diagonal(new SideArt(k, { zFront: -3.8, zRear: -5.42, yBottom: 0.72, yTop: 1.74 }), -3.7, -5.5),
    { reach: 0.4 },
  );
  const finFlag = new SideArt(k, { zFront: -3.75, zRear: -5.45, yBottom: 1.74, yTop: 2.47 });
  for (let i = 0; i < 4; i++)
    finFlag.poly(FLAG_RED, [
      [-3.75, 1.74 + i * 0.2],
      [-5.45, 1.74 + i * 0.2],
      [-5.45, 1.84 + i * 0.2],
      [-3.75, 1.84 + i * 0.2],
    ]);
  const finStripes = sideArt('flag-fin', finFlag, { reach: 0.25, layers: [SHELL, RUDDER] });
  const starArt = new SideArt(k, { zFront: 2.62, zRear: 0.5, yBottom: 0.62, yTop: 1.98 });
  for (let row = 0; row < 5; row++)
    for (let col = 0; col < 7; col++) {
      const z = 2.5 - col * 0.26 - (row % 2) * 0.13,
        y = 0.75 + row * 0.27;
      // Keep stars inside the navy field (ahead of its slanted rear edge, on the cowl sides).
      const edge = 1.05 - ((y - 0.5) / 1.7) * 0.55;
      if (z < edge + 0.12 || y > 1.58 + Math.max(0, z - 1.4) * 0.05) continue;
      starArt.canvas.star(WHITE, 2.62 - z, y - 0.62, 0.075);
    }
  const stars = sideArt('flag-stars', starArt, { mirror: false });
  const regFlag = text('reg-n47sb', 'N47SB', {
    z: -2.45,
    y: 1.2,
    width: 1.25,
    height: 0.3,
    cap: 0.25,
    color: FLAG_RED,
    halo: FLAG_CREAM,
    shadow: FLAG_NAVY,
    layers: [SHELL, BANDS],
  });

  /* ---------------------------------------------------- Indonesian Navy ---- */
  const tniTitle = text('tni-title', 'TNI ANGKATAN LAUT', {
    z: -1.55,
    y: 1.3,
    width: 1.5,
    height: 0.13,
    cap: 0.1,
    color: BLACK,
  });
  const tniSerial = text('tni-serial', 'T-2502', {
    z: -4.78,
    y: 2.08,
    width: 0.85,
    height: 0.18,
    cap: 0.15,
    color: BLACK,
    layers: [SHELL, RUDDER],
    reach: 0.25,
  });
  const flagArt = new SideArt(k, { zFront: -4.78, zRear: -5.1, yBottom: 2.32, yTop: 2.5 });
  flagArt.poly('#d0202d', [
    [-4.78, 2.41],
    [-5.1, 2.41],
    [-5.1, 2.5],
    [-4.78, 2.5],
  ]);
  flagArt.poly('#ffffff', [
    [-4.78, 2.32],
    [-5.1, 2.32],
    [-5.1, 2.41],
    [-4.78, 2.41],
  ]);
  const tniFlag = sideArt('tni-flag', flagArt, { reach: 0.25, layers: [SHELL] });

  const references = {
    anniversary: {
      title:
        'Beechcraft G36 Bonanza N152BZ, 75th-anniversary scheme, Oshkosh 2023 (Wikimedia Commons, CC BY-SA 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Beechcraft_G36_Bonanza_(N152BZ,_cn_E-4152)_(7-29-2023).jpg',
    },
    f2015: {
      title: 'N850KS 2015 Beechcraft G36 Bonanza (Wikimedia Commons, CC BY-SA 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:N850KS_2015_Beechcraft_G36_Bonanza_s_n_E-4065_(48806945087).jpg',
    },
    f2007: {
      title: 'N6980B 2007 Beechcraft G36 Bonanza (Wikimedia Commons, CC BY-SA 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:N6980B_2007_Beechcraft_G36_Bonanza_s_n_E-3780_(53607431363).jpg',
    },
    a36: {
      title: 'N3050K 1987 Beech A36 Bonanza (Wikimedia Commons, CC BY-SA 2.0)',
      url: 'https://commons.wikimedia.org/wiki/File:N3050K_1987_Beech_A36_Bonanza_36_C-N_E-2364_(7757064500).jpg',
    },
    flag: {
      title: 'N49EL Beech G36 Bonanza (Wikimedia Commons, CC BY-SA 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:N49EL_Beech_G36_Bonanza_s_n_E-4158_(54387449351).jpg',
    },
    tni: {
      title: 'Beechcraft Bonanza G36 of the Indonesian Navy (public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:Beechcraft_Bonanza_G36_Indonesian_Navy.jpg',
    },
  };

  return {
    selected: 'g36-75th-anniversary',
    anchors,
    graphics,
    variants: [
      {
        id: 'g36-75th-anniversary',
        label: '75th-anniversary edition, 2022',
        provenance: {
          kind: 'inspired',
          note: 'The 2022 Bonanza 75th-anniversary paint from the referenced photograph: metallic burgundy cowling and upper fuselage over white, the split sweeping up to the fin root with navy and gray pinstripes, a burgundy and white checker flag behind the cowling and burgundy and navy bands at the fin tip. The Beechcraft and Bonanza logos and the large fin B are omitted; registration N175BZ is fictional. Shapes and colors are approximations.',
          references: [references.anniversary],
        },
        paints: paint(WHITE, anniversary),
        markings: [...pins75, ...checker75, ...reg75],
      },
      {
        id: 'g36-factory-2015',
        label: 'Factory white and navy, 2015',
        provenance: {
          kind: 'inspired',
          note: 'Beechcraft’s mid-2010s G36 factory paint from the referenced photograph: white with a navy upper cowling running back as a blade under the windshield, navy and gray pinstripes from the cowling to the stabilizer, a navy blade along the lower tail cone, a navy fin cap and a large navy registration (N836GB, fictional). Logos omitted; approximate shapes.',
          references: [references.f2015],
        },
        paints: paint(WHITE, factory2015),
        markings: [...stripes2015, ...reg2015],
      },
      {
        id: 'g36-factory-2007-navy',
        label: 'Factory navy belly, 2007',
        provenance: {
          kind: 'inspired',
          note: 'The 2007 Hawker Beechcraft G36 scheme from the referenced photograph: white over a navy lower fuselage and cowling, gray and navy pinstripes along the split, the navy hooking up toward the fin root, navy bands at the fin tip and a navy registration (N6236B, fictional). Logos omitted; approximate colors.',
          references: [references.f2007],
        },
        paints: paint(WHITE, factory2007),
        markings: [...stripes2007, ...reg2007],
      },
      {
        id: 'a36-factory-1987',
        label: 'A36 factory cream and charcoal, 1987',
        provenance: {
          kind: 'inspired',
          note: 'Beech’s late-1980s A36 Bonanza paint from the referenced photograph, applied to the G36 model: cream with a charcoal cheatline and wine pinstripe from the spinner to the tail, a charcoal lower tail cone and fin cap, and a very large italic charcoal registration (N3617K, fictional). Approximate colors.',
          references: [references.a36],
        },
        paints: paint(CREAM, a36),
        markings: [...regA36],
      },
      {
        id: 'stars-and-stripes-custom',
        label: 'Stars and stripes owner scheme',
        provenance: {
          kind: 'inspired',
          note: 'A private owner’s flag scheme after the referenced photograph: a navy nose with white stars back to the windshield posts, red and cream stripes slanting down and aft over the cabin and tail cone, level stripes across the fin and a red registration with a cream edge and navy shadow (N47SB, fictional). Star count, stripe spacing and the wing treatment are approximations; the stripes are side projections and do not wrap over the fuselage top.',
          references: [references.flag],
        },
        paints: paint(FLAG_CREAM, patriot),
        markings: [...cabinStripes, ...coneStripes, ...finStripes, ...stars, ...regFlag],
      },
      {
        id: 'indonesian-navy',
        label: 'Indonesian Navy G36 trainer',
        provenance: {
          kind: 'inspired',
          note: 'Indonesian Navy (TNI Angkatan Laut) G36 T-2502 from the referenced photograph: light gray overall, TNI ANGKATAN LAUT under the rear windows, the serial T-2502 on the fin and the red-and-white national flag at the fin tip (original vector art). The naval aviation badge on the cowling is omitted; approximate colors.',
          references: [references.tni],
        },
        paints: paint(NAVY_GRAY, [], { roughness: 0.55 }),
        markings: [...tniTitle, ...tniSerial, ...tniFlag],
      },
    ],
  };
}
