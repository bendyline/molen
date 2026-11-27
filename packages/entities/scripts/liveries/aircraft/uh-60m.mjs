/**
 * UH-60M Black Hawk liveries: US Army, the HH-60M MEDEVAC with red crosses, the Swedish Armed
 * Forces' Hkp 16, the Lithuanian Air Force and the Mexican Navy. Titles, national insignia,
 * flags, serials and codes are original vector redrawings placed from the referenced photographs;
 * the operator titles live here rather than in the model.
 *
 * Model frame: +Z nose, +X the aircraft's left, +Y up. Cabin sides x ±1.18 (y 0.42–2.2) with the
 * sliding door between z 0.95 and -0.85; the tail cone tapers from z -2.9 (x ±1.06) to the pylon
 * (fin) at z -7.8 to -10.8, whose sides stand at x ±0.1; the engine nacelles' outer sides are at
 * x ±1.02, y 2.38, z 0.8 to -1.6.
 */
import {
  both,
  commons,
  label,
  lithuaniaFlag,
  PAINT,
  redCross,
  sidePair,
  vytisCross,
} from '../art-helicopters-b.mjs';

const AIRFRAME = 'airframe',
  nacelle = (s) => `nacelle-${s}`;

export function slots() {
  return {
    [AIRFRAME]: { materials: ['UH60-olive'], node: 'UH60-airframe-UH60-olive' },
    'nacelle-1': { materials: ['UH60-olive'], node: 'nacelle-UH60-olive_1' },
    'nacelle--1': { materials: ['UH60-olive'], node: 'nacelle-UH60-olive' },
    'exhaust-1': { materials: ['UH60-olive'], node: 'exhaust-UH60-olive_1' },
    'exhaust--1': { materials: ['UH60-olive'], node: 'exhaust-UH60-olive' },
    'tail-gearbox': { materials: ['UH60-olive'], node: 'tail-support-UH60-olive' },
  };
}

const BLACK = PAINT.stencilBlack,
  WHITE = PAINT.white;

/** Every painted region in one color (optionally with zones on the airframe). */
const all = (color, airframe = {}) => ({
  [AIRFRAME]: { color, ...airframe },
  'nacelle-1': { color },
  'nacelle--1': { color },
  'exhaust-1': { color },
  'exhaust--1': { color },
  'tail-gearbox': { color },
});

export default function design({ kit: k, space }) {
  // Tail cone half-width at y 1.25 (measured), narrowing about 6.5 cm per metre aft.
  const coneX = (z) => 0.453 + (z + 4.45) * 0.065;
  const onCone = (name, z, y, width, height) =>
    sidePair(space, name, {
      slot: AIRFRAME,
      at: (s) => [s * coneX(z), y, z],
      facing: [1, 0, -0.065],
      width,
      height,
      depth: 0.3,
    });
  const onPylon = (name, z, y, width, height) =>
    sidePair(space, name, {
      slot: AIRFRAME,
      at: (s) => [s * (0.097 + (y - 2.5) * 0.024), y, z],
      facing: [1, -0.06, -0.05],
      width,
      height,
      depth: 0.1,
    });
  const onCabin = (name, z, y, width, height) =>
    sidePair(space, name, {
      slot: AIRFRAME,
      at: (s) => [s * 1.181, y, z],
      width,
      height,
      depth: 0.3,
    });
  const anchors = {
    ...onCone('cone-title', -5.3, 1.3, 2.1, 0.17),
    // The roundel sits ahead of the title, on the cone's steep forward taper.
    ...sidePair(space, 'cone-roundel', {
      slot: AIRFRAME,
      at: (s) => [s * 0.57, 1.33, -3.95],
      facing: [0.93, 0, -0.36],
      width: 0.42,
      height: 0.42,
      depth: 0.3,
    }),
    ...onCone('cone-reg', -5.3, 1.15, 1.0, 0.14),
    ...onPylon('pylon-serial', -9.5, 2.45, 1.05, 0.2),
    ...onPylon('pylon-code', -9.62, 2.5, 0.6, 0.5),
    ...onPylon('pylon-insignia', -9.85, 3.05, 0.36, 0.42),
    ...onCabin('door-cross', 0.05, 0.93, 0.56, 0.56),
    ...onCabin('door-title', 0.05, 0.86, 1.6, 0.38),
    ...onCabin('flank-number', -1.5, 1.55, 1.0, 0.56),
    ...sidePair(space, 'nose-cross', {
      slot: AIRFRAME,
      at: (s) => [s * 0.9, 1.05, 3.78],
      facing: [0.9, 0.1, 0.38],
      width: 0.46,
      height: 0.46,
      depth: 0.3,
    }),
    ...sidePair(space, 'nacelle-mark', {
      slot: nacelle,
      at: (s) => [s * 1.022, 2.37, -1.02],
      facing: [1, 0.12, 0],
      width: 0.75,
      height: 0.34,
      depth: 0.2,
    }),
    'nose-front': space.anchor(AIRFRAME, {
      center: [0, 1.12, 4.62],
      facing: [0, 0.5, 1],
      width: 0.46,
      height: 0.34,
      depth: 0.4,
    }),
    belly: space.anchor(AIRFRAME, {
      center: [0, 0.42, 0.3],
      facing: [0, -1, 0],
      up: [0, 0, 1],
      width: 1.1,
      height: 1.1,
      depth: 0.2,
    }),
  };

  const graphics = {
    'us-army': label(k, 'UNITED STATES ARMY', 2.1, 0.17, BLACK, { fill: 0.75, tracking: 0.05 }),
    'us-serial': label(k, '09-20208', 1.05, 0.2, BLACK, { fill: 0.75 }),
    'hh-serial': label(k, '11-20339', 1.05, 0.2, BLACK, { fill: 0.75 }),
    'cross-door': redCross(new k.Canvas(0.56, 0.56), 0.28, 0.28, 0.54).graphic('Red cross'),
    'cross-nose': redCross(new k.Canvas(0.46, 0.46), 0.23, 0.23, 0.44).graphic('Red cross'),
    'cross-front': (() => {
      const c = new k.Canvas(0.46, 0.34);
      c.rect(WHITE, 0, 0, 0.46, 0.34);
      c.rect('#c1121c', 0.19, 0.03, 0.08, 0.28);
      c.rect('#c1121c', 0.09, 0.13, 0.28, 0.08);
      return c.graphic('Red cross');
    })(),
    'cross-belly': redCross(new k.Canvas(1.1, 1.1), 0.55, 0.55, 1.06).graphic('Red cross'),
    'se-roundel': k
      .swedenRoundel(new k.Canvas(0.42, 0.42), 0.21, 0.21, 0.2, { lowvis: true })
      .graphic('Swedish roundel (low visibility)'),
    'se-title': label(k, 'SWEDISH ARMED FORCES', 2.1, 0.17, '#5f665b', {
      fill: 0.7,
      tracking: 0.04,
    }),
    'se-code': label(k, '06', 0.6, 0.5, '#5f665b', { fill: 0.85 }),
    'lt-title': label(k, 'LITHUANIAN AIR FORCE', 2.1, 0.17, BLACK, { fill: 0.75, tracking: 0.03 }),
    'lt-vytis': vytisCross(new k.Canvas(0.36, 0.42), 0.18, 0.21, 0.4, {
      fill: WHITE,
      outline: '#2b2f33',
    }).graphic('Cross of Vytis'),
    'lt-flag-62': (() => {
      const c = new k.Canvas(0.75, 0.34);
      lithuaniaFlag(c, 0.02, 0.06, 0.33, 0.22);
      c.text('#1c2329', '62', { x: 0.57, y: 0.17, height: 0.26 });
      c.text('#7fb6e6', '62', { x: 0.57, y: 0.17, height: 0.22 });
      return c.graphic('Flag and 62');
    })(),
    'mx-marina': label(k, 'MARINA', 1.6, 0.38, BLACK, { fill: 0.78, slant: 0.12, tracking: 0.02 }),
    'mx-302': new k.Canvas(1.0, 0.56)
      .text(BLACK, '302', { x: 0.5, y: 0.28, height: 0.46, tracking: 0.08 })
      .text(WHITE, '302', { x: 0.5, y: 0.28, height: 0.4, tracking: 0.08 })
      .graphic('302'),
    'mx-reg': label(k, 'AMHA-302', 1.0, 0.14, BLACK, { fill: 0.75 }),
    'mx-triangle': (() => {
      const c = new k.Canvas(0.75, 0.34);
      const tri = (size, color) => {
        const r = size / Math.sqrt(3);
        c.add(color, [
          [0.375 - size / 2, 0.17 + r / 2],
          [0.375 + size / 2, 0.17 + r / 2],
          [0.375, 0.17 - r],
        ]);
      };
      // As photographed on the naval aviation insignia: red edge, white, green centre.
      tri(0.36, '#ce1126');
      tri(0.25, '#ffffff');
      tri(0.12, '#006847');
      return c.graphic('Mexican Navy aviation insignia');
    })(),
  };

  const ref = {
    army: commons(
      'US Army UH-60M of 1-150th Aviation Regiment, Resolute Sentinel 2024 (DVIDS, public domain)',
      'RS24- 1st Battalion - 150th Aviation Regiment prepares UH-60M Black Hawk for operations (8447133).jpg',
    ),
    armyKabul: commons(
      'US Army UH-60M of 2-10th Aviation over Kabul, 2013 (US Army, public domain)',
      'A U.S. Army UH-60M Black Hawk helicopter assigned to Charlie Company, 2nd Battalion, 10th Combat Aviation Brigade, Task Force Knighthawk flies a personnel movement mission Dec. 23, 2013, over Kabul 131223-A-MH207-006.jpg',
    ),
    medevac: commons(
      'US Army HH-60M MEDEVAC of Task Force Dust Off, Helmand, 2011 (USMC, public domain)',
      'A U.S. Army HH-60M Blackhawk medical evacuation (medevac) helicopter of Army Task Force Lift "Dust Off", Charlie Company 1-171, Aviation Regiment, departs for mission, Forward Operating Base Edinburgh, Helmand 111209-M-CL319-178.jpg',
    ),
    medevacFront: commons(
      'US Army HH-60M MEDEVAC refuelling, Afghanistan (MOD, OGL)',
      'Sikorsky HH-60 MEDEVAC Black Hawk Helicopter MOD 45162031.jpg',
    ),
    medevacOregon: commons(
      'Oregon Army National Guard HH-60M (Commons, public domain)',
      'Oregon Army National Guard HH-60M Blackhawk helicopter (9576423831).jpg',
    ),
    sweden: commons(
      'Swedish Armed Forces Hkp 16 at Turku Airshow 2023 (Commons, CC BY 4.0)',
      'Swedish Black Hawk at Turku Airshow 2023.jpg',
    ),
    sweden06: commons(
      'Swedish Air Force Hkp 16 06, Flygdagarna 2026 (Commons, CC BY-SA 4.0)',
      '06 UH-60M Black Hawk Swedish AF Flygdagarna 2026 01.jpg',
    ),
    lithuania: commons(
      'Lithuanian Air Force UH-60M in flight (Commons, CC BY-SA 4.0)',
      'Lithuanian Air Force UH-60M Black Hawk helicopter in flight.jpg',
    ),
    mexico: commons(
      'Mexican Navy UH-60M AMHA-302 at Toluca, 2013 (André Du-pont, GFDL)',
      'Sikorsky UH-60M Black Hawk, Mexico - Navy JP7602302.jpg',
    ),
  };

  return {
    selected: 'us-army',
    anchors,
    graphics,
    variants: [
      {
        id: 'us-army',
        label: 'US Army',
        provenance: {
          kind: 'inspired',
          note: 'US Army UH-60M: FS 34031 aircraft green overall, black UNITED STATES ARMY on the tail cone and the serial on the pylon, as photographed; no national insignia, per current Army practice. The serial 09-20208 is illustrative of the M-model series. Approximate colors and letter sizes.',
          references: [ref.army, ref.armyKabul],
        },
        paints: all('#4c5244'),
        markings: [...both('cone-title', 'us-army'), ...both('pylon-serial', 'us-serial')],
      },
      {
        id: 'us-army-hh60m-medevac',
        label: 'US Army HH-60M MEDEVAC',
        provenance: {
          kind: 'inspired',
          note: 'US Army HH-60M MEDEVAC (Dust Off): aircraft green with red crosses on white on the nose, both nose sides, the cabin doors and the belly, black UNITED STATES ARMY on the tail cone and a pylon serial (11-20339, illustrative). The UH-60M model stands in for the HH-60M (no rescue hoist or FLIR turret); approximate cross sizes.',
          references: [ref.medevac, ref.medevacFront, ref.medevacOregon],
        },
        paints: all('#4c5244'),
        markings: [
          { anchor: 'nose-front', graphic: 'cross-front' },
          ...both('nose-cross', 'cross-nose'),
          ...both('door-cross', 'cross-door'),
          { anchor: 'belly', graphic: 'cross-belly' },
          ...both('cone-title', 'us-army'),
          ...both('pylon-serial', 'hh-serial'),
        ],
      },
      {
        id: 'swedish-hkp16',
        label: 'Swedish Armed Forces Hkp 16',
        provenance: {
          kind: 'inspired',
          note: 'Swedish Armed Forces Hkp 16 (UH-60M) as photographed at Turku 2023 and Flygdagarna 2026: dark green overall with the low-visibility three-crowns roundel and SWEDISH ARMED FORCES title on the tail cone and the code 06 on the pylon, all in a darker grey-green, redrawn. Approximate colors and sizes.',
          references: [ref.sweden, ref.sweden06],
        },
        paints: all('#40463a'),
        markings: [
          ...both('cone-roundel', 'se-roundel'),
          ...both('cone-title', 'se-title'),
          ...both('pylon-code', 'se-code'),
        ],
      },
      {
        id: 'lithuanian-air-force',
        label: 'Lithuanian Air Force',
        provenance: {
          kind: 'inspired',
          note: 'Lithuanian Air Force UH-60M 62: medium blue-grey overall, LITHUANIAN AIR FORCE on the tail cone, the national flag and the code 62 on the engine nacelles and the white Cross of Vytis on the pylon, all redrawn. Approximate colors and sizes.',
          references: [ref.lithuania],
        },
        paints: all('#78828a'),
        markings: [
          ...both('cone-title', 'lt-title'),
          ...both('nacelle-mark', 'lt-flag-62'),
          ...both('pylon-insignia', 'lt-vytis'),
        ],
      },
      {
        id: 'mexican-navy',
        label: 'Mexican Navy',
        provenance: {
          kind: 'inspired',
          note: 'Mexican Navy UH-60M AMHA-302 (Toluca 2013): light grey overall, MARINA in bold black on the sliding doors, the naval aviation triangle on the engine nacelles, a large outlined 302 and the registration, redrawn. The navy crest beneath the triangle is omitted, and the outlined number sits on the aft cabin rather than across the door windows. Approximate colors.',
          references: [ref.mexico],
        },
        paints: all('#9ba5ac'),
        markings: [
          ...both('door-title', 'mx-marina'),
          ...both('flank-number', 'mx-302'),
          ...both('nacelle-mark', 'mx-triangle'),
          ...both('cone-reg', 'mx-reg'),
        ],
      },
    ],
  };
}
