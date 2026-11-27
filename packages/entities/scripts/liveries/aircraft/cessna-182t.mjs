/**
 * Cessna 182T Skylane liveries: the Civil Air Patrol scheme, Cessna's late-2000s factory paint in
 * two of its color options (black and orange, US registered; black and olive, Slovak
 * registered) and the 2013 factory navy scheme (Australian registered).
 *
 * Civil operators take their photographed colors and layout with fictional registrations in the
 * right national format and no names or emblems. Paint regions are authored in model metres and
 * applied to every paint slot (shell, the baked belt strip, flaps, ailerons, elevators, rudder).
 */
import {
  above,
  aft,
  ahead,
  behind,
  inboard,
  leftOf,
  lettering,
  over,
  paintSlots,
  rightOf,
  SideArt,
  spline,
  taper,
  under,
  wingAnchor,
} from '../art-ga-a.mjs';

const SHELL = 'body-Skylane-shell-Skylane-white',
  ACCENT = 'accent-Skylane-shell-Skylane-green',
  RUDDER = 'body-Skylane-rudder-Skylane-white';

const WHITE = '#f3f3ef',
  CAP_NAVY = '#1b2a52',
  CAP_RED = '#c3242d',
  BLACK = '#1a1b1e',
  ORANGE = '#e98a1f',
  OLIVE = '#8f8a5a',
  NAVY = '#1c2544',
  GRAPHITE = '#4a4f57';

export default function design({ kit: k, space, slots: all }) {
  const painted = Object.keys(all).filter((n) => space.bounds[n]);
  const paint = (base, regions, finish) => paintSlots(space, painted, base, regions, finish);
  const anchors = {},
    graphics = {};
  /** Side art projected on each listed slot (shell, belt strip, rudder), mirrored on the right. */
  const sideArt = (name, art, { reach = 0.75, layers = [SHELL, ACCENT], mirror = true } = {}) => {
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
    { z, y, width, height, color, layers = [SHELL], reach = 0.75, ...opts },
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

  /* ---------------------------------------------------- Civil Air Patrol ---- */
  // Navy below a split just under the windows, red and white pinstripes along it; the navy
  // climbs to the fin root at the tail, and the fin and rudder are red over a white pinstripe.
  const split = [
    [2.8, 1.2],
    [-5.3, 1.42],
  ];
  const lift = (line, dy) => line.map(([z, y]) => [z, y + dy]);
  const finLine = [
    [-3.55, 1.72],
    [-5.75, 1.62],
  ];
  // The dorsal fin's leading edge: the tail colors start behind it.
  const dorsal = [
    [-3.05, 1.42],
    [-3.85, 1.8],
  ];
  const cap = [
    { color: CAP_NAVY, planes: [under(...split), above(0.45), ...inboard(0.65)] },
    { color: CAP_NAVY, planes: [aft(...dorsal), ahead(-3.85), ...inboard(0.3)] },
    { color: CAP_NAVY, planes: [behind(-3.85), under(...finLine), ...inboard(0.19)] },
    {
      color: WHITE,
      planes: [over(...lift(finLine, -0.035)), under(...finLine), aft(...dorsal), ...inboard(0.3)],
    },
    { color: CAP_RED, planes: [over(...finLine), behind(-3.3), ...inboard(0.3)] },
    {
      color: WHITE,
      planes: [over(...split), under(...lift(split, 0.013)), above(0.45), ...inboard(0.65)],
    },
    {
      color: CAP_RED,
      planes: [
        over(...lift(split, 0.013)),
        under(...lift(split, 0.043)),
        above(0.45),
        ...inboard(0.65),
      ],
    },
  ];
  const capReg = text('reg-n488cp', 'N488CP', {
    z: -2.45,
    y: 1.06,
    width: 1.55,
    height: 0.34,
    cap: 0.28,
    color: WHITE,
    layers: [SHELL, ACCENT],
  });

  /* ---------------------------------------------------- 2009 factory Skylane ---- */
  // Black upper cowling and a black blade under the windshield; a long accent-color stripe and
  // black blades sweep down and aft across the cabin; a black and accent swoosh on the fin.
  const factoryArt = (accent) => {
    const art = new SideArt(k, { zFront: 2.75, zRear: -2.0, yBottom: 0.7, yTop: 1.42 });
    const blade = (color, points, width, opts) =>
      art.between(color, ...taper(spline(points, 4), width, opts));
    // Black blade continuing the cowl top under the windshield to the door front.
    art.between(
      BLACK,
      spline(
        [
          [2.75, 1.27],
          [1.5, 1.35],
          [0.55, 1.31],
        ],
        4,
      ),
      spline(
        [
          [2.75, 1.215],
          [1.9, 1.22],
          [1.2, 1.235],
          [0.55, 1.31],
        ],
        4,
      ),
    );
    blade(
      accent,
      [
        [2.72, 1.16],
        [1.6, 1.145],
        [0.6, 1.05],
        [-0.4, 0.92],
        [-1.1, 0.84],
      ],
      0.085,
      { lead: 0.03, trail: 0.35 },
    );
    blade(
      BLACK,
      [
        [2.5, 1.065],
        [1.5, 1.045],
        [0.6, 0.955],
        [-0.2, 0.835],
      ],
      0.04,
      { lead: 0.1, trail: 0.4 },
    );
    blade(
      BLACK,
      [
        [0.75, 0.8],
        [0.2, 0.86],
        [-0.6, 0.96],
      ],
      0.03,
      { lead: 0.3, trail: 0.3 },
    );
    blade(
      BLACK,
      [
        [0.35, 1.2],
        [-0.5, 1.12],
        [-1.3, 1.02],
        [-1.95, 0.96],
      ],
      0.028,
      { lead: 0.25, trail: 0.4 },
    );
    blade(
      BLACK,
      [
        [0.0, 1.13],
        [-0.8, 1.04],
        [-1.5, 0.98],
      ],
      0.02,
      { lead: 0.3, trail: 0.4 },
    );
    return art;
  };
  const factoryFinArt = (accent) => {
    const art = new SideArt(k, { zFront: -3.3, zRear: -5.75, yBottom: 1.55, yTop: 2.2 });
    art.between(
      BLACK,
      spline([
        [-3.4, 1.66],
        [-4.2, 1.82],
        [-5.0, 1.93],
        [-5.75, 2.07],
      ]),
      spline([
        [-3.4, 1.66],
        [-4.2, 1.73],
        [-5.0, 1.8],
        [-5.75, 1.92],
      ]),
    );
    art.between(
      accent,
      spline([
        [-3.7, 1.66],
        [-4.4, 1.71],
        [-5.1, 1.77],
        [-5.75, 1.88],
      ]),
      spline([
        [-3.7, 1.66],
        [-4.4, 1.665],
        [-5.1, 1.715],
        [-5.75, 1.82],
      ]),
    );
    return art;
  };
  const factoryRegions = [
    { color: BLACK, planes: [ahead(1.5), over([2.8, 1.215], [1.5, 1.225]), ...inboard(0.62)] },
    { color: BLACK, planes: [leftOf(5.22)] },
    { color: BLACK, planes: [rightOf(-5.22)] },
  ];
  const orangeBody = sideArt('skylane-orange', factoryArt(ORANGE));
  const orangeFin = sideArt('skylane-orange-fin', factoryFinArt(ORANGE), {
    reach: 0.3,
    layers: [SHELL, RUDDER],
  });
  const oliveBody = sideArt('skylane-olive', factoryArt(OLIVE));
  const oliveFin = sideArt('skylane-olive-fin', factoryFinArt(OLIVE), {
    reach: 0.3,
    layers: [SHELL, RUDDER],
  });
  const usReg = text('reg-n1823s', 'N1823S', {
    z: -2.75,
    y: 1.12,
    width: 1.5,
    height: 0.32,
    cap: 0.27,
    color: BLACK,
    slant: 0.2,
    layers: [SHELL, ACCENT],
  });
  const omReg = text('reg-om-bkl', 'OM-BKL', {
    z: -2.75,
    y: 1.12,
    width: 1.55,
    height: 0.32,
    cap: 0.25,
    color: GRAPHITE,
    layers: [SHELL, ACCENT],
  });
  // Under the left wing, letter tops toward the leading edge.
  anchors['wing-reg'] = wingAnchor(space, SHELL, {
    x: 3.2,
    y: 1.885,
    z: -0.02,
    width: 2.9,
    height: 0.62,
    depth: 0.12,
    dihedral: 0.03,
  });
  graphics['reg-om-bkl-wing'] = lettering(k, 'OM-BKL', {
    width: 2.9,
    height: 0.62,
    cap: 0.5,
    color: GRAPHITE,
  });

  /* ---------------------------------------------------- 2013 factory Skylane ---- */
  // Navy lower fuselage tapering to a point under the registration, a white spear and a long
  // graphite blade above it, navy pinstripes at the fin root and navy wingtips.
  const navyRegions = [
    {
      color: NAVY,
      planes: [
        under([2.8, 1.06], [-3.4, 0.96]),
        over([-1.0, 0.45], [-3.45, 0.97]),
        above(0.45),
        ...inboard(0.65),
      ],
    },
    { color: NAVY, planes: [leftOf(5.2)] },
    { color: NAVY, planes: [rightOf(-5.2)] },
  ];
  const spear = new SideArt(k, { zFront: 2.6, zRear: -3.6, yBottom: 0.78, yTop: 1.3 });
  spear.between(
    GRAPHITE,
    ...taper(
      spline(
        [
          [2.55, 1.13],
          [1.2, 1.1],
          [-0.6, 1.04],
          [-2.2, 0.99],
          [-3.5, 0.97],
        ],
        5,
      ),
      0.045,
      { lead: 0.08, trail: 0.4 },
    ),
  );
  spear.between(
    WHITE,
    ...taper(
      spline(
        [
          [0.95, 0.9],
          [-0.4, 0.92],
          [-1.8, 0.935],
          [-2.7, 0.95],
        ],
        5,
      ),
      0.04,
      { lead: 0.3, trail: 0.25 },
    ),
  );
  spear.between(
    NAVY,
    ...taper(
      spline(
        [
          [0.3, 1.18],
          [-1.0, 1.12],
          [-2.3, 1.06],
        ],
        4,
      ),
      0.022,
      { lead: 0.3, trail: 0.4 },
    ),
  );
  const navySpear = sideArt('skylane-2013', spear);
  const finStripes = new SideArt(k, { zFront: -3.3, zRear: -5.75, yBottom: 1.55, yTop: 1.95 });
  finStripes.between(
    NAVY,
    ...taper(
      spline(
        [
          [-3.35, 1.64],
          [-4.4, 1.7],
          [-5.75, 1.76],
        ],
        4,
      ),
      0.06,
      { lead: 0.15, trail: 0 },
    ),
  );
  finStripes.between(
    GRAPHITE,
    ...taper(
      spline(
        [
          [-3.9, 1.77],
          [-4.8, 1.81],
          [-5.75, 1.85],
        ],
        4,
      ),
      0.025,
      { lead: 0.2, trail: 0 },
    ),
  );
  const navyFin = sideArt('skylane-2013-fin', finStripes, { reach: 0.3, layers: [SHELL, RUDDER] });
  const vhReg = text('reg-vh-skq', 'VH-SKQ', {
    z: -2.7,
    y: 1.16,
    width: 1.6,
    height: 0.34,
    cap: 0.28,
    color: NAVY,
    layers: [SHELL, ACCENT],
  });

  const references = {
    cap: {
      title: 'Civil Air Patrol Cessna 182T at DuPage Airport (Wikimedia Commons, CC BY 2.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Civil_Air_Patrol_Cessna_182T_at_DuPage_Airport_01.jpg',
    },
    cap2: {
      title: 'Cessna 182T Skylane N956CP, Civil Air Patrol (Wikimedia Commons, CC BY-SA 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Cessna_182T_Skylane_(N956CP,_cn_18282409)_(8-23-2024).jpg',
    },
    orange: {
      title: 'Cessna 182T Skylane N2152K, factory scheme (Wikimedia Commons, CC BY-SA 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Cessna_182T_Skylane_(N2152K,_cn_18281908)_(4-13-2024).jpg',
    },
    olive: {
      title: 'Cessna 182T Skylane OM-AKC (Wikimedia Commons, CC BY-SA 2.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Cessna_182T_Skylane_OM-AKC_(9818038013).jpg',
    },
    navy: {
      title: 'VH-ULW Cessna 182T Skylane at Avalon (Wikimedia Commons, GFDL)',
      url: 'https://commons.wikimedia.org/wiki/File:VH-ULW_Cessna_182T_Skylane_(11357623763).jpg',
    },
  };

  return {
    selected: 'skylane-2009-black-orange',
    anchors,
    graphics,
    variants: [
      {
        id: 'skylane-2009-black-orange',
        label: 'Skylane factory black and orange, 2009',
        provenance: {
          kind: 'inspired',
          note: 'Cessna’s late-2000s 182T factory paint from the referenced photograph: white with a black upper cowling and windshield blade, a long orange stripe and black blades sweeping down across the cabin, a black and orange swoosh on the fin and black wingtips. The Skylane fin logo is omitted; registration N1823S is fictional. Blade shapes are approximations.',
          references: [references.orange],
        },
        paints: paint(WHITE, factoryRegions),
        markings: [...orangeBody, ...orangeFin, ...usReg],
      },
      {
        id: 'skylane-2009-black-olive',
        label: 'Skylane factory black and olive, Slovakia',
        provenance: {
          kind: 'inspired',
          note: 'The same late-2000s factory layout in its black and olive color option, after the referenced Slovak-registered aircraft, with the registration on the rear fuselage and in large letters under the left wing (European practice). The registration OM-BKL is fictional; the camera turret and operator badge are omitted. Approximate colors.',
          references: [references.olive],
        },
        paints: paint(WHITE, factoryRegions),
        markings: [
          ...oliveBody,
          ...oliveFin,
          ...omReg,
          { anchor: 'wing-reg', graphic: 'reg-om-bkl-wing' },
        ],
      },
      {
        id: 'civil-air-patrol',
        label: 'Civil Air Patrol, 2010s',
        provenance: {
          kind: 'inspired',
          note: 'Civil Air Patrol corporate scheme from the referenced photographs: navy lower fuselage below a white and red pinstripe, navy climbing to the fin root, a red fin and rudder over a white pinstripe and a large white registration on the navy. Under the civil-operator rule the CIVIL AIR PATROL fin titles and the emblem are omitted; registration N488CP is fictional. Approximate colors.',
          references: [references.cap, references.cap2],
        },
        paints: paint(WHITE, cap),
        markings: [...capReg],
      },
      {
        id: 'skylane-2013-navy',
        label: 'Skylane factory navy, Australia 2013',
        provenance: {
          kind: 'inspired',
          note: 'Cessna’s 2013 182T factory scheme from the referenced Avalon photograph: white over a navy lower fuselage that tapers to a point aft, a white spear and a long graphite blade above it, navy and graphite stripes at the fin root and navy wingtips, with an Australian registration (VH-SKQ, fictional). The Skylane fin logo is omitted; shapes and colors are approximations.',
          references: [references.navy],
        },
        paints: paint(WHITE, navyRegions),
        markings: [...navySpear, ...navyFin, ...vhReg],
      },
    ],
  };
}
