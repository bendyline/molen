/**
 * UH-1H Iroquois liveries: US Army Vietnam-era slick and Dustoff, RAAF No. 9 Squadron, JGSDF
 * three-tone camouflage and a CAL FIRE Super Huey's civil fire-service scheme. National
 * insignia, serials and unit marks are original vector redrawings; the civil scheme shows its
 * colors and layout only (no name, seal or wordmark).
 *
 * Model frame: +Z nose, +X the aircraft's left, +Y up. The cabin's flat sides are at x ±1.197
 * (y 0.77–2.14, z -1.65–1.45); the tail boom runs z -2.43 to -8.63 and the thin fin stands at
 * x ±0.05 between z -7.8 and -9.05.
 */
import {
  bars,
  both,
  commons,
  forward,
  label,
  PAINT,
  redCross,
  sidePair,
} from '../art-helicopters-b.mjs';

const CABIN = 'body-huey-airframe-huey-olive-drab',
  TAIL = 'body-huey-running-structure-huey-olive-drab';

const OD = PAINT.oliveDrab,
  BLACK = PAINT.stencilBlack,
  WHITE = PAINT.white;

export default function design({ kit: k, space }) {
  // Boom: tapered rounded square, its side normal leaning ~5 degrees aft; the centre line rises
  // about 0.075 m per metre toward the tail, so boom lettering is turned to follow it.
  const boomUp = [0, 1, 0.075],
    boomFacing = [1, 0, -0.09];
  const boomX = (z) => 0.51 + ((z + 3.15) * (0.51 - 0.315)) / (-3.15 + 5.45);
  const onBoom = (name, z, y, width, height) =>
    sidePair(space, name, {
      slot: TAIL,
      at: (s) => [s * boomX(z), y, z],
      facing: boomFacing,
      up: boomUp,
      width,
      height,
      depth: 0.4,
    });
  const onCabin = (name, z, y, width, height) =>
    sidePair(space, name, {
      slot: CABIN,
      at: (s) => [s * 1.197, y, z],
      width,
      height,
      depth: 0.3,
    });
  // The fin is a thin double sheet: keep the projector inside one sheet's thickness.
  const onFin = (name, z, y, width, height) =>
    sidePair(space, name, {
      slot: TAIL,
      at: (s) => [s * (0.058 - (y - 2.03) * 0.009), y, z],
      width,
      height,
      depth: 0.05,
    });
  const anchors = {
    ...onBoom('boom-title', -4.07, 1.55, 2.5, 0.3),
    ...onBoom('boom-roundel', -3.18, 1.46, 0.5, 0.5),
    ...onBoom('boom-raaf', -4.0, 1.52, 0.95, 0.26),
    ...onBoom('boom-unit', -5.55, 1.63, 0.32, 0.3),
    ...onBoom('boom-reg', -6.9, 1.73, 0.62, 0.11),
    ...onCabin('cabin-aft', -1.28, 1.5, 0.52, 0.52),
    ...onCabin('cabin-number', -1.27, 1.12, 0.64, 0.32),
    ...onCabin('door-number', -0.2, 1.1, 0.36, 0.2),
    ...onCabin('crew-door', 1.98, 0.87, 0.5, 0.13),
    ...onFin('fin-serial', -8.62, 2.32, 0.42, 0.13),
    ...onFin('fin-flash', -8.56, 2.25, 0.21, 0.3),
    ...onFin('fin-star', -8.84, 2.88, 0.18, 0.17),
    ...onFin('fin-code', -8.68, 2.5, 0.36, 0.1),
    'nose-front': space.anchor(CABIN, {
      center: [0, 1.27, 3.5],
      facing: [0, 0.42, 1],
      width: 0.64,
      height: 0.64,
      depth: 0.6,
    }),
    'nose-number': space.anchor(CABIN, {
      center: [0.22, 1.47, 3.37],
      facing: [0.15, 0.72, 0.7],
      width: 0.24,
      height: 0.12,
      depth: 0.3,
    }),
    belly: space.anchor(CABIN, {
      center: [0, 0.376, 0.45],
      facing: [0, -1, 0],
      up: [0, 0, 1],
      width: 0.95,
      height: 0.95,
      depth: 0.25,
    }),
  };

  const graphics = {
    'title-army-black': label(k, 'UNITED STATES ARMY', 2.5, 0.3, BLACK, {
      fill: 0.78,
      tracking: 0.05,
    }),
    'serial-13643': label(k, '13643', 0.42, 0.13, BLACK, { fill: 0.86 }),
    'serial-15209': label(k, '15209', 0.42, 0.13, BLACK, { fill: 0.86 }),
    // Company marking from the 64-13643 photograph: a yellow triangle edged in white.
    'unit-triangle': (() => {
      const c = new k.Canvas(0.32, 0.3);
      c.add(WHITE, [
        [0.01, 0.01],
        [0.31, 0.01],
        [0.16, 0.29],
      ]);
      c.add(PAINT.insigniaYellow, [
        [0.045, 0.03],
        [0.275, 0.03],
        [0.16, 0.245],
      ]);
      return c.graphic('Company triangle');
    })(),
    'red-cross-nose': redCross(new k.Canvas(0.64, 0.64), 0.32, 0.32, 0.62).graphic('Red cross'),
    'red-cross-side': redCross(new k.Canvas(0.52, 0.52), 0.26, 0.26, 0.5).graphic('Red cross'),
    'red-cross-belly': redCross(new k.Canvas(0.95, 0.95), 0.475, 0.475, 0.92).graphic('Red cross'),
    'raaf-roundel': k
      .australiaRoundel(new k.Canvas(0.5, 0.5), 0.25, 0.25, 0.24)
      .graphic('RAAF roundel'),
    'raaf-title': label(k, 'RAAF', 0.95, 0.26, WHITE, { fill: 0.8, tracking: 0.06 }),
    'raaf-484': label(k, '484', 0.64, 0.32, WHITE, { fill: 0.86 }),
    'raaf-84': label(k, '84', 0.24, 0.12, WHITE, { fill: 0.86 }),
    // RAF-pattern fin flash as the RAAF wore it: red leading, white, blue trailing.
    'raaf-flash': bars(new k.Canvas(0.21, 0.3), 0, 0, 0.21, 0.3, [
      '#c8102e',
      WHITE,
      '#00247d',
    ]).graphic('Fin flash'),
    hinomaru: k.hinomaru(new k.Canvas(0.46, 0.46), 0.23, 0.23, 0.22).graphic('Hinomaru'),
    'jgsdf-41659': label(k, '41659', 0.5, 0.13, BLACK, { fill: 0.8 }),
    'jgsdf-fin': label(k, 'JG-1659', 0.36, 0.1, '#263038', { fill: 0.8 }),
    'calfire-number': label(k, '309', 0.36, 0.2, BLACK, { fill: 0.86 }),
    'calfire-reg': label(k, 'N4093F', 0.62, 0.11, BLACK, { fill: 0.8 }),
  };
  // A red star on the CAL FIRE fin, as on the California flag.
  graphics['calfire-star'] = new k.Canvas(0.18, 0.17)
    .star(PAINT.red, 0.09, 0.08, 0.085)
    .graphic('Star');

  const whole = (color, extra = {}) => ({
    [CABIN]: { color, ...extra },
    [TAIL]: { color },
  });

  // CAL FIRE: red nose cap, three diagonal red bands edged in black rising aft across the
  // cabin and cowling, black boom spine over a red pinstripe, and a red band on the fin.
  const rise = Math.tan((52 * Math.PI) / 180),
    // A band edge through (z, 0.6) rising aft at 52 degrees.
    edge = (z, side) => space.sideLine(CABIN, [z, 0.6], [z - 1, 0.6 + rise], side);
  const band = (front, back, color) => ({
    color,
    planes: [edge(front, -1), edge(back, 1)],
  });
  const calfireCabinZones = [
    {
      color: PAINT.red,
      planes: [space.ahead(CABIN, 2.86), space.sideLine(CABIN, [3.62, 1.2], [2.86, 1.4], 1)],
    },
  ];
  for (const z of [-0.05, -0.53, -1.01]) {
    calfireCabinZones.push(band(z, z - 0.34, PAINT.red));
    calfireCabinZones.push(band(z, z - 0.05, BLACK));
  }
  const spine = (dy, side) => space.sideLine(TAIL, [-2.43, 1.72 + dy], [-7.7, 1.84 + dy], side);
  const calfireTailZones = [
    { color: PAINT.red, planes: [spine(-0.05, 1), space.ahead(TAIL, -7.72)] },
    { color: BLACK, planes: [spine(0, 1), space.ahead(TAIL, -7.72)] },
    // Fin band: from the root's leading edge up toward the tip's trailing edge.
    {
      color: PAINT.red,
      planes: [
        space.behind(TAIL, -7.72),
        space.sideLine(TAIL, [-7.8, 1.85], [-9.1, 2.95], -1),
        space.sideLine(TAIL, [-7.8, 1.6], [-9.1, 2.7], 1),
      ],
    },
    {
      color: BLACK,
      planes: [
        space.behind(TAIL, -7.72),
        space.sideLine(TAIL, [-7.8, 1.92], [-9.1, 3.02], -1),
        space.sideLine(TAIL, [-7.8, 1.85], [-9.1, 2.95], 1),
      ],
    },
  ];

  const ref = {
    army: commons(
      'UH-1H 64-13643 in Vietnam-era US Army markings (Commons, CC BY-SA 2.0)',
      'Bell UH-1H Huey 6343 (64-13643) (9988333016).jpg',
    ),
    khamDuc: commons(
      'US Army UH-1H Hueys at Kham Duc, Vietnam, 1970 (NARA, public domain)',
      'U.S. Army UH-1H Hueys insert ARVN troops at Khâm Đức, Vietnam, 12 July 1970 (79431435).jpg',
    ),
    medevac: commons(
      'UH-1H preserved in Vietnam medevac markings (Commons, CC BY-SA 4.0)',
      'Bell UH-1 Iroquois "Huey" Medevac (medical evacuation).jpg',
    ),
    dustoff: commons(
      'US Army Dustoff UH-1 with a 7 RAR guard, Vietnam (Australian War Memorial, CC0)',
      '7RAR soldier stands guard for a U.S. dustoff UH-1.jpg',
    ),
    raaf: commons(
      'RAAF UH-1H A2-484 at Laverton, April 1971 (Commons, CC BY-SA 3.0)',
      'Bell UH-1H A2-484 RAAF LAV 18.04.71 edited-2.jpg',
    ),
    raafVungTau: commons(
      'No. 9 Squadron RAAF UH-1s at Vung Tau, 1966 (Australian War Memorial, CC0)',
      'No. 9 Squadron RAAF crewmen prepare to board their UH-1 at Vung Tau Air Base.jpg',
    ),
    jgsdf: commons(
      'JGSDF UH-1H 41659 at Camp Uji, right side, 2018 (Commons, CC BY-SA 4.0)',
      'JGSDF UH-1H(41659) right side view at Camp Uji November 23, 2018.jpg',
    ),
    jgsdfRear: commons(
      'JGSDF UH-1H 41659 at Camp Uji, left rear, 2018 (Commons, CC BY-SA 4.0)',
      'JGSDF UH-1H(41659) left rear view at Camp Uji November 23, 2018.jpg',
    ),
    calfire: commons(
      'CAL FIRE Super Huey N488DF on a rappel exercise (Commons, CC BY-SA 4.0)',
      'CAL FIRE Super Huey-N488DF.jpg',
    ),
  };

  return {
    selected: 'us-army-vietnam',
    anchors,
    graphics,
    variants: [
      {
        id: 'us-army-vietnam',
        label: 'US Army, Vietnam era',
        provenance: {
          kind: 'inspired',
          note: 'Vietnam-era US Army UH-1H after the 64-13643 restoration: FS 34087 olive drab overall, black UNITED STATES ARMY on the boom, the last five digits of the serial on the fin and the company triangle (yellow edged white) ahead of the elevator, redrawn as vector art. The restoration’s unit nose badge and black nose are omitted. Approximate colors and letter sizes.',
          references: [ref.army, ref.khamDuc],
        },
        paints: whole(OD),
        markings: [
          ...both('boom-title', 'title-army-black'),
          ...both('fin-serial', 'serial-13643'),
          ...forward('boom-unit', 'unit-triangle'),
        ],
      },
      {
        id: 'us-army-dustoff',
        label: 'US Army Dustoff medevac, Vietnam era',
        provenance: {
          kind: 'inspired',
          note: 'Vietnam-era US Army air ambulance (Dustoff): olive drab with red crosses on white squares on the nose, both aft cabin flanks and the belly, black UNITED STATES ARMY on the boom and a fin serial (15209, illustrative). Approximate colors and cross sizes.',
          references: [ref.medevac, ref.dustoff],
        },
        paints: whole(OD),
        markings: [
          { anchor: 'nose-front', graphic: 'red-cross-nose' },
          ...both('cabin-aft', 'red-cross-side'),
          { anchor: 'belly', graphic: 'red-cross-belly' },
          ...both('boom-title', 'title-army-black'),
          ...both('fin-serial', 'serial-15209'),
        ],
      },
      {
        id: 'raaf-9-squadron',
        label: 'RAAF No. 9 Squadron, 1971',
        provenance: {
          kind: 'inspired',
          note: 'RAAF UH-1H A2-484 as photographed at Laverton in 1971: olive drab, the RAAF roundel (blue ring, white disc, red kangaroo) and white RAAF title on the boom, white 484 on the aft cabin and 84 on the nose, and a red-white-blue fin flash. Roundel, kangaroo and lettering redrawn; sizes and the fin flash position are approximations.',
          references: [ref.raaf, ref.raafVungTau],
        },
        paints: whole('#4d5238'),
        markings: [
          ...forward('boom-roundel', 'raaf-roundel'),
          ...both('boom-raaf', 'raaf-title'),
          ...both('cabin-number', 'raaf-484'),
          { anchor: 'nose-number', graphic: 'raaf-84' },
          ...forward('fin-flash', 'raaf-flash'),
        ],
      },
      {
        id: 'jgsdf-camouflage',
        label: 'JGSDF three-tone camouflage',
        provenance: {
          kind: 'inspired',
          note: 'Japan Ground Self-Defense Force UH-1H 41659 (Camp Uji): tan, olive green and dark green camouflage (a generated pattern in those colors, not the exact pattern), hinomaru on the boom, 41659 on the crew door and JG-1659 on the fin. The kanji unit title is omitted. Approximate colors.',
          references: [ref.jgsdf, ref.jgsdfRear],
        },
        paints: {
          [CABIN]: {
            color: '#5e6a42',
            camouflage: {
              colors: ['#857650', '#5b673f', '#30382e'],
              scale: 2.1,
              seed: 41659,
              style: 'blotch',
            },
          },
          [TAIL]: {
            color: '#5e6a42',
            camouflage: {
              colors: ['#857650', '#5b673f', '#30382e'],
              scale: 2.2,
              seed: 1659,
              style: 'blotch',
            },
          },
        },
        markings: [
          ...both('boom-roundel', 'hinomaru'),
          ...both('crew-door', 'jgsdf-41659'),
          ...both('fin-code', 'jgsdf-fin'),
        ],
      },
      {
        id: 'cal-fire-super-huey',
        label: 'Fire service Super Huey (CAL FIRE colors)',
        provenance: {
          kind: 'inspired',
          note: 'CAL FIRE UH-1H Super Huey colors and layout from the referenced photograph: white overall, red nose cap, three black-edged red bands rising aft across the cabin and cowling, a black boom spine over a red pinstripe and a red band and star on the fin. The agency name, seals and lettering are omitted; the fleet number 309 and registration N4093F are fictional.',
          references: [ref.calfire],
        },
        paints: {
          [CABIN]: { color: WHITE, zones: calfireCabinZones },
          [TAIL]: { color: WHITE, zones: calfireTailZones },
        },
        markings: [
          ...both('door-number', 'calfire-number'),
          ...both('boom-reg', 'calfire-reg'),
          ...both('fin-star', 'calfire-star'),
        ],
      },
    ],
  };
}
