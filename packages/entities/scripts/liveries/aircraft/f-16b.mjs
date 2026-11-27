/**
 * F-16B Fighting Falcon liveries: USAF wing and squadron schemes (tail codes, fin-tip bands,
 * serial blocks, squadron art), the Royal Danish Air Force, the Israeli Air Force and a US Navy
 * adversary, with insignia and art redrawn as original vector artwork (no reference pixels).
 *
 * The model is the two-seat F-16B. Where no F-16B photograph of a unit was available the scheme
 * comes from that unit's two-seat F-16D (same canopy and fin; the D's avionics differ inside),
 * and the variant's note says so. Colors follow the FED-STD-595 shades named in the notes.
 *
 * Model frame: +Z nose, +X the aircraft's left, +Y up. The fin is a flat slab (outer faces at
 * x = ±0.065) from the root at y 2.43 to the tip at 5.09; its leading edge runs from
 * (z -2.38, y 3.03) to (z -4.50, y 5.09) and the rudder hinge from (z -4.64, y 2.50) to
 * (z -5.16, y 4.84). The wings, fin, strakes and ventral fins share the F16-upper-gray material.
 */

// Paint slots. The F16-upper-gray airframe node carries the fin, wings, leading-edge strakes and
// ventral fins; the F16-light-gray airframe node the fuselage (and the speed-brake skins cut from
// it, which keep their source node); flaperons, rudder, stabilators and gear doors are their own.
export function slots() {
  const gray = 'F16-light-gray',
    upper = 'F16-upper-gray';
  const slot = (material, node) => ({ materials: [material], node });
  return {
    radome: slot('F16-radome', 'F16-airframe-F16-radome'),
    [FUSELAGE]: slot(gray, 'F16-airframe-F16-light-gray'),
    'wing-fin': slot(upper, 'F16-airframe-F16-upper-gray'),
    'flaperon-1': slot(gray, 'F16-flaperon-1-F16-light-gray'),
    'flaperon--1': slot(gray, 'F16-flaperon--1-F16-light-gray'),
    rudder: slot(gray, 'F16-rudder-F16-light-gray'),
    'stabilator-1': slot(upper, 'F16-stabilator-1-F16-upper-gray'),
    'stabilator--1': slot(upper, 'F16-stabilator--1-F16-upper-gray'),
    'gear-0': slot(gray, 'F16-gear-0-F16-light-gray'),
    'gear-1': slot(gray, 'F16-gear-1-F16-light-gray'),
    'gear-2': slot(gray, 'F16-gear-2-F16-light-gray'),
  };
}

// The fuselage slot keeps its original name: packages/earth/test/liveries.test.ts paints it.
const FUSELAGE = 'body-F16-airframe-F16-light-gray';
const GUNSHIP = '#53585e', // FS 36118 gunship gray
  MEDIUM = '#7c8389', // FS 36270 medium gray
  COMPASS = '#a6acb0', // FS 36375 light compass ghost gray
  INK = '#1b1d1f',
  WHITE = '#f2f2ee',
  YELLOW = '#f0b81c',
  INSIGNIA_GRAY = '#2c3135';

// Mid-surfaces of the thin parts (fitted to the imported model by rays through both skins):
// y = a + b|x| + c z. Undersides are painted below them.
const MID = {
  wing: [1.9615, -0.008, 0.003],
  flaperon: [1.9636, -0.0083, 0.0034],
  stabilator: [2.0463, -0.1771, 0.0017],
};

/** A snarling wolf's head in profile, facing the canvas's left (the nose on the left fin). */
function wolfHead(k, w, h) {
  const c = new k.Canvas(w, h);
  const P = (pts) => pts.map(([u, v]) => [u * w, v * h]);
  c.add(
    INK,
    P([
      [0.02, 0.56],
      [0.06, 0.64],
      [0.27, 0.7],
      [0.4, 0.8],
      [0.47, 0.86],
      [0.54, 1.0],
      [0.63, 0.84],
      [0.72, 0.97],
      [0.8, 0.79],
      [0.93, 0.66],
      [1.0, 0.44],
      [0.91, 0.38],
      [0.98, 0.2],
      [0.85, 0.23],
      [0.8, 0.02],
      [0.66, 0.14],
      [0.53, 0.1],
      [0.4, 0.2],
      [0.3, 0.29],
      [0.1, 0.3],
      [0.08, 0.37],
      [0.33, 0.45],
      [0.06, 0.48],
    ]),
  );
  // Eye, brow line and fangs in white.
  c.add(
    WHITE,
    P([
      [0.36, 0.63],
      [0.47, 0.68],
      [0.5, 0.64],
      [0.41, 0.6],
    ]),
  );
  c.add(
    WHITE,
    P([
      [0.52, 0.75],
      [0.66, 0.72],
      [0.67, 0.69],
      [0.53, 0.71],
    ]),
  );
  for (const [u0, v0, down] of [
    [0.09, 0.48, true],
    [0.17, 0.47, true],
    [0.25, 0.46, true],
    [0.13, 0.37, false],
    [0.21, 0.39, false],
  ])
    c.add(
      WHITE,
      P([
        [u0 - 0.025, v0],
        [u0 + 0.025, v0],
        [u0, v0 + (down ? -0.07 : 0.07)],
      ]),
    );
  return c;
}

/** A red phoenix rising with fanned wing feathers, facing the canvas's left. */
function phoenix(k, w, h, red, accent) {
  const c = new k.Canvas(w, h);
  const feather = (color, bx, by, angle, length, width) => {
    const dx = Math.cos(angle),
      dy = Math.sin(angle),
      px = -dy,
      py = dx;
    c.add(
      color,
      [
        [0, 0],
        [0.3, width * 0.5],
        [0.75, width * 0.42],
        [1, 0],
        [0.75, -width * 0.18],
        [0.3, -width * 0.32],
      ].map(([t, s]) => [(bx + dx * length * t + px * s) * w, (by + dy * length * t + py * s) * h]),
    );
  };
  // Wing feathers fan up and back (toward the canvas's right) from the shoulder.
  for (let i = 0; i < 6; i++)
    feather(i % 2 ? accent : red, 0.4, 0.52, 0.35 + i * 0.22, 0.58 - i * 0.03, 0.11);
  // Tail feathers sweep down and back.
  for (let i = 0; i < 3; i++) feather(red, 0.42, 0.42, -0.55 - i * 0.28, 0.5, 0.1);
  // Body and neck, then the head and beak facing forward.
  c.add(
    red,
    [
      [0.46, 0.3],
      [0.54, 0.5],
      [0.36, 0.72],
      [0.26, 0.78],
      [0.24, 0.68],
      [0.33, 0.55],
    ].map(([u, v]) => [u * w, v * h]),
  );
  c.circle(red, 0.24 * w, 0.8 * h, 0.07 * Math.min(w, h), 24);
  c.add(
    red,
    [
      [0.19, 0.84],
      [0.06, 0.78],
      [0.19, 0.76],
    ].map(([u, v]) => [u * w, v * h]),
  );
  return c;
}

/** The Danish swallow-tailed state flag, hoist on the canvas's left. */
function danishFlag(k, w, h) {
  const c = new k.Canvas(w, h);
  const red = '#c8102e';
  c.add(red, [
    [0, 0],
    [w, 0],
    [w * 0.74, h / 2],
    [w, h],
    [0, h],
  ]);
  c.rect(WHITE, w * 0.27, 0, w * 0.11, h);
  c.rect(WHITE, 0, h * 0.43, w * 0.74, h * 0.14);
  return c;
}

/** A jagged lightning bolt running down and forward (toward the canvas's left). */
function lightningBolt(k, w, h, color) {
  const c = new k.Canvas(w, h);
  c.add(
    color,
    [
      [0.78, 1.0],
      [0.98, 1.0],
      [0.62, 0.6],
      [0.82, 0.6],
      [0.3, 0.16],
      [0.4, 0.34],
      [0.02, 0.0],
      [0.46, 0.46],
      [0.3, 0.46],
    ].map(([u, v]) => [u * w, v * h]),
  );
  return c;
}

export default function design({ kit: k, space, slots: all, bounds }) {
  const SIDES = [
    ['left', 1],
    ['right', -1],
  ];
  const anchors = {};
  const both = (name, graphic, flipRight = false) => [
    { anchor: `${name}-left`, graphic },
    { anchor: `${name}-right`, graphic, ...(flipRight ? { flip: true } : {}) },
  ];
  for (const [side, s] of SIDES) {
    const fin = (slot, y, z, width, height) =>
      space.anchor(slot, {
        center: [s * 0.065, y, z],
        facing: [s, 0, 0],
        width,
        height,
        depth: 0.08,
      });
    anchors[`tail-code-${side}`] = fin('wing-fin', 3.62, -3.95, 1.0, 0.56);
    anchors[`tail-serial-${side}`] = fin('wing-fin', 3.05, -3.95, 0.95, 0.34);
    anchors[`fin-art-${side}`] = fin('wing-fin', 4.3, -4.5, 0.6, 0.45);
    anchors[`fin-bolt-${side}`] = fin('wing-fin', 4.08, -4.32, 0.5, 0.9);
    anchors[`cap-number-${side}`] = fin('wing-fin', 4.97, -5.02, 0.3, 0.14);
    // The phoenix spans the hinge: the same box projects onto the fin and onto the rudder.
    anchors[`fin-bird-${side}`] = fin('wing-fin', 3.85, -4.55, 1.4, 1.5);
    anchors[`rudder-bird-${side}`] = space.anchor('rudder', {
      center: [s * 0.065, 3.85, -4.55],
      facing: [s, 0, 0],
      width: 1.4,
      height: 1.5,
      depth: 0.12,
    });
    anchors[`fin-number-${side}`] = fin('wing-fin', 2.86, -3.3, 0.85, 0.32);
    // Danish swallow-tailed flag on the upper fin (ET-612 photographs).
    anchors[`flag-${side}`] = fin('wing-fin', 4.3, -4.45, 0.4, 0.27);
    // Upper fuselage side behind the canopy, sloping about 37 degrees from vertical.
    anchors[`roundel-${side}`] = space.anchor(FUSELAGE, {
      center: [s * 0.585, 2.16, 1.7],
      facing: [s * 0.8, 0.6, 0],
      width: 0.3,
      height: 0.3,
      depth: 0.3,
    });
    anchors[`serial-${side}`] = space.anchor(FUSELAGE, {
      center: [s * 0.6, 2.12, 0.85],
      facing: [s * 0.85, 0.53, 0],
      width: 1.1,
      height: 0.22,
      depth: 0.3,
    });
    // USAF national insignia: aft fuselage shoulder just ahead of the fin root.
    anchors[`insignia-${side}`] = space.anchor(FUSELAGE, {
      center: [s * 0.57, 2.17, -2.4],
      facing: [s * 0.79, 0.61, 0],
      width: 0.76,
      height: 0.43,
      depth: 0.3,
    });
    // Intake trunk side, ahead of the main gear.
    anchors[`intake-number-${side}`] = space.anchor(FUSELAGE, {
      center: [s * 0.7, 1.13, 3.7],
      facing: [s, 0, 0],
      width: 0.55,
      height: 0.34,
      depth: 0.3,
    });
    anchors[`intake-small-${side}`] = space.anchor(FUSELAGE, {
      center: [s * 0.7, 1.12, 3.55],
      facing: [s, 0, 0],
      width: 0.4,
      height: 0.14,
      depth: 0.3,
    });
    // Ventral fin outer face (canted out at the bottom, so it looks slightly up).
    anchors[`ventral-${side}`] = space.anchor('wing-fin', {
      center: [s * 0.8, 0.86, -1.95],
      facing: [s * 0.9, 0.43, 0],
      width: 0.8,
      height: 0.18,
      depth: 0.1,
    });
    // Wing marks at mid-span; the boxes reach one skin only (upper skin y 1.955-1.977, lower
    // 1.912-1.925 under them). Artwork up is the nose.
    for (const [surface, y, dir] of [
      ['upper', 1.968, 1],
      ['lower', 1.916, -1],
    ]) {
      anchors[`wing-ins-${surface}-${side}`] = space.anchor('wing-fin', {
        center: [s * 3.0, y, -0.15],
        facing: [0, dir, 0],
        up: [0, 0, 1],
        width: 0.96,
        height: 0.54,
        depth: 0.04,
      });
      anchors[`wing-disc-${surface}-${side}`] = space.anchor('wing-fin', {
        center: [s * 3.0, y, -0.15],
        facing: [0, dir, 0],
        up: [0, 0, 1],
        width: 0.5,
        height: 0.5,
        depth: 0.04,
      });
    }
  }

  const text = (label, w, h, color, opts = {}) =>
    new k.Canvas(w, h)
      .text(color, label, { x: w / 2, y: h / 2, height: h * 0.86, maxWidth: w * 0.97, ...opts })
      .graphic(label);
  // USAF fin serial: "AF" over the fiscal year, then the last three digits large.
  const serialBlock = (fy, last, color = INK) =>
    new k.Canvas(0.95, 0.34)
      .text(color, 'AF', { x: 0.13, y: 0.245, height: 0.09, face: 'geometric' })
      .text(color, fy, { x: 0.13, y: 0.095, height: 0.09, face: 'geometric' })
      .text(color, last, {
        x: 0.6,
        y: 0.17,
        height: 0.27,
        face: 'geometric',
        maxWidth: 0.66,
      })
      .graphic(`AF ${fy} ${last}`);
  const code = (letters) => text(letters, 1.0, 0.56, INK, { face: 'geometric', height: 0.5 });
  const graphics = {
    'insignia-lowvis': k
      .usInsignia(new k.Canvas(0.64, 0.36), 0.32, 0.18, 0.155, {
        style: 'lowvis',
        color: INSIGNIA_GRAY,
        stroke: 0.024,
      })
      .graphic('US national insignia, low visibility'),
    'code-wp': code('WP'),
    'code-sp': code('SP'),
    'code-av': code('AV'),
    'code-mc': code('MC'),
    'serial-89-172': serialBlock('89', '172'),
    'serial-91-481': serialBlock('91', '481'),
    'serial-89-178': serialBlock('89', '178'),
    'serial-79-418': serialBlock('79', '418'),
    wolf: wolfHead(k, 0.6, 0.45).graphic('8th Fighter Wing wolf head'),
    'dk-roundel': k
      .roundel(new k.Canvas(0.3, 0.3), 0.15, 0.15, 0.148, k.ROUNDELS.denmark)
      .graphic('Danish roundel'),
    'dk-flag': danishFlag(k, 0.4, 0.27).graphic('Danish swallow-tailed flag'),
    'dk-serial': text('ET 612', 1.1, 0.22, '#dfe3e5', { face: 'technical' }),
    'il-roundel': k.israelMark(new k.Canvas(0.5, 0.5), 0.25, 0.25, 0.24).graphic('Israeli roundel'),
    'il-phoenix': phoenix(k, 1.4, 1.5, '#c8341f', '#e0662a').graphic('Red phoenix squadron art'),
    'il-fin-989': text('989', 0.85, 0.32, INK, { face: 'technical' }),
    'il-intake-989': text('989', 0.4, 0.14, INK, { face: 'technical' }),
    'nsawc-07-intake': text('07', 0.55, 0.34, INK, { face: 'geometric' }),
    'nsawc-07-cap': text('07', 0.3, 0.14, '#1f3a5c', { face: 'geometric' }),
    'nsawc-title': text('NSAWC', 0.8, 0.18, '#1f3a5c', { face: 'geometric', tracking: 0.04 }),
    'nsawc-bolt': lightningBolt(k, 0.5, 0.9, '#2b3a4a').graphic('Lightning bolt'),
  };

  // ---------------------------------------------------------------- paint ----
  const longest = (slot) => {
    const b = bounds[slot];
    return Math.max(...b.max.map((v, i) => v - b.min[i]));
  };
  /** Camouflage with the same patch size in metres on every slot (tile = metres per repeat). */
  const camo = (colors, tile, seed, style) => (slot) => ({
    colors,
    scale: Math.round((longest(slot) / tile) * 1000) / 1000,
    seed,
    ...(style ? { style } : {}),
  });
  /** Half-space below a fitted mid-surface y = a + b|x| + c z, on one side of the centreline. */
  const belowMid = (slot, [a, b, c], side) => space.plane(slot, [b * side, -1, c], [0, a, 0]);
  /** Underside zones for each paintable slot (light belly, wing and tail undersides). */
  const undersides = (color, bellyY) => ({
    ...(bellyY === undefined
      ? {}
      : { [FUSELAGE]: [{ color, planes: [space.below(FUSELAGE, bellyY)] }] }),
    'wing-fin': [
      {
        color,
        planes: [
          space.plane('wing-fin', [-1, 0, 0], [0.95, 0, 0]),
          space.plane('wing-fin', [1, 0, 0], [-0.95, 0, 0]),
          space.below('wing-fin', 1.815),
        ],
      },
      {
        color,
        planes: [
          space.plane('wing-fin', [1, 0, 0], [0.95, 0, 0]),
          belowMid('wing-fin', MID.wing, 1),
        ],
      },
      {
        color,
        planes: [
          space.plane('wing-fin', [-1, 0, 0], [-0.95, 0, 0]),
          belowMid('wing-fin', MID.wing, -1),
        ],
      },
    ],
    'flaperon-1': [{ color, planes: [belowMid('flaperon-1', MID.flaperon, 1)] }],
    'flaperon--1': [{ color, planes: [belowMid('flaperon--1', MID.flaperon, -1)] }],
    'stabilator-1': [{ color, planes: [belowMid('stabilator-1', MID.stabilator, 1)] }],
    'stabilator--1': [{ color, planes: [belowMid('stabilator--1', MID.stabilator, -1)] }],
  });
  /**
   * Paint for every slot: `color(slot)` base, optional `camouflage(slot)`, and zones per slot
   * (concatenated in order; later zones win).
   */
  const paint = ({ color, radome, gear, camouflage, zones = [] }) => {
    const out = {};
    for (const slot of Object.keys(all)) {
      if (slot === 'radome') {
        out[slot] = { color: radome };
        continue;
      }
      if (slot.startsWith('gear-')) {
        out[slot] = { color: gear ?? color };
        continue;
      }
      const z = zones.flatMap((set) => set[slot] ?? []);
      out[slot] = {
        color,
        ...(camouflage ? { camouflage: camouflage(slot) } : {}),
        ...(z.length ? { zones: z } : {}),
      };
    }
    return out;
  };
  /** Fin-top zones (fin and rudder) between two heights, optionally aft of a station. */
  const finBand = (color, from, to = 9, aftOf) => {
    const planes = (slot) => [
      space.above(slot, from),
      space.below(slot, to),
      ...(aftOf === undefined ? [] : [space.behind(slot, aftOf)]),
    ];
    return {
      'wing-fin': [{ color, planes: planes('wing-fin') }],
      rudder: [{ color, planes: planes('rudder') }],
    };
  };
  const hillTwo = { [FUSELAGE]: [{ color: GUNSHIP, planes: [space.above(FUSELAGE, 2.13)] }] };
  const usafModern = (bands) =>
    paint({ color: MEDIUM, radome: '#7a8186', zones: [hillTwo, ...bands] });
  const usafMarks = (codeId, serialId) => [
    ...both('tail-code', codeId),
    ...both('tail-serial', serialId),
    ...both('insignia', 'insignia-lowvis'),
    { anchor: 'wing-ins-upper-left', graphic: 'insignia-lowvis' },
    { anchor: 'wing-ins-lower-right', graphic: 'insignia-lowvis' },
  ];

  const ref = (title, file) => ({
    title,
    url: `https://commons.wikimedia.org/wiki/File:${file}`,
  });
  const NOTE_TAIL =
    ' Colors are approximations of the FS shades; stencils, crew names and small unit badges are omitted.';

  return {
    selected: 'usaf-wp-80fs',
    anchors,
    graphics,
    variants: [
      {
        id: 'usaf-wp-80fs',
        label: 'USAF 80th FS Juvats WP 89-172, Kunsan',
        provenance: {
          kind: 'inspired',
          note:
            '8th Fighter Wing "Wolf Pack" F-16D 89-0172 of the 80th Fighter Squadron at Kunsan, applied to the two-seat F-16B model: FS 36270 medium gray with FS 36118 gunship gray along the spine, yellow fin cap, black WP tail code over the AF 89 172 serial block, the wolf head redrawn as original art, low-visibility national insignia on the aft fuselage, upper left and lower right wings. The wing shield above the wolf is omitted.' +
            NOTE_TAIL,
          references: [
            ref(
              '80th Fighter Squadron F-16D in a training exercise (USAF, public domain)',
              '80th_Fighter_Squadron_F-16D_in_training_exercise.jpg',
            ),
          ],
        },
        paints: usafModern([finBand(YELLOW, 4.86)]),
        markings: [...usafMarks('code-wp', 'serial-89-172'), ...both('fin-art', 'wolf', true)],
      },
      {
        id: 'usaf-sp-480fs',
        label: 'USAF 480th FS SP 91-481, Spangdahlem 2010',
        provenance: {
          kind: 'inspired',
          note:
            '52nd Fighter Wing F-16D 91-0481 of the 480th Fighter Squadron from Spangdahlem, photographed taking off in Bulgaria in 2010, applied to the two-seat F-16B model: FS 36270/36118 grays, a blue fin-tip band, dark SP tail code over the AF 91 481 serial block and low-visibility insignia. The white script in the band is omitted.' +
            NOTE_TAIL,
          references: [
            ref(
              'F-16D of the 480th FS taking off, Bulgaria 2010 (USAF, public domain)',
              'F-16D_480th_FS_taking_off_Bulgaria_2010.jpg',
            ),
          ],
        },
        paints: usafModern([finBand('#2f62b8', 4.68)]),
        markings: usafMarks('code-sp', 'serial-91-481'),
      },
      {
        id: 'usaf-av-31fw',
        label: 'USAF 31st FW AV 89-178, Aviano',
        provenance: {
          kind: 'inspired',
          note:
            '31st Fighter Wing F-16D 89-0178 from Aviano, applied to the two-seat F-16B model: FS 36270/36118 grays, the squadron band below the fin tip in purple edged with black, black AV tail code over the AF 89 178 serial block and low-visibility insignia. The lettering inside the band and the wing badge on the fin are omitted.' +
            NOTE_TAIL,
          references: [
            ref(
              "General Dynamics F-16DM '89-178 - AV' in flight (CC BY-SA 2.0)",
              'General_Dynamics_F-16DM_%E2%80%9889-178_-_AV%E2%80%99_(28264486733).jpg',
            ),
          ],
        },
        paints: usafModern([finBand(INK, 4.6, 4.8, -4.5), finBand('#4b3a8c', 4.625, 4.775, -4.53)]),
        markings: usafMarks('code-av', 'serial-89-178'),
      },
      {
        id: 'usaf-mc-gray',
        label: 'USAF 56th TFW MC 79-418, MacDill 1980s',
        provenance: {
          kind: 'inspired',
          note: 'F-16B-10 79-0418 of the 56th Tactical Fighter Wing at MacDill in the early gray scheme: FS 36270 medium gray fuselage and upper surfaces, FS 36375 light compass gray under the wings, tailplanes and gear doors, and a light radome (the gunship gray spine is not shown); yellow fin-tip band over a black pinstripe, black MC tail code over the AF 79 418 serial block, low-visibility insignia. The Tactical Air Command badge on the fin is omitted. Colors are approximations; stencils are omitted.',
          references: [
            ref(
              'General Dynamics F-16B-10 79-0418 of the 56th TFW at MacDill (USAF, public domain)',
              'General_Dynamics_F-16B-10_(SN_79-0418)_060905-F-1234S-041.jpg',
            ),
          ],
        },
        paints: paint({
          color: MEDIUM,
          radome: '#9ca2a6',
          gear: COMPASS,
          // The fuselage stays one plain color (packages/earth/test/liveries.test.ts reads its
          // single material); the three-gray look carries on the wings, tail and gear doors.
          zones: [undersides(COMPASS), finBand(INK, 4.86), finBand(YELLOW, 4.895, 5.07)],
        }),
        markings: usafMarks('code-mc', 'serial-79-418'),
      },
      {
        id: 'danish-et-612',
        label: 'Royal Danish Air Force ET-612, 2014',
        provenance: {
          kind: 'inspired',
          note: 'Danish F-16B ET-612 at Tour de Sky, Oulu 2014. Both side photographs establish the small red and white roundels behind the canopy, the pale ET 612 serial immediately aft of them and the swallow-tailed state flags on the fin, hoist forward on both sides; FS 36270 medium gray overall. The small US serial under the flag, stencils and wing markings (not visible in the photographs) are omitted. Colors are approximations.',
          references: [
            ref(
              'F-16B Denmark (ET 612), Tour de Sky 2014, left side (public domain)',
              'F-16B_Denmark_(ET_612)_Tour_de_Sky_2014-08-10_02.JPG',
            ),
            ref(
              'F-16B Denmark (ET 612), Tour de Sky 2014, right side (public domain)',
              'F-16B_Denmark_(ET_612)_Tour_de_Sky_2014-08-09_01.JPG',
            ),
          ],
        },
        paints: paint({ color: '#8e9599', radome: '#7d8488' }),
        markings: [
          ...both('roundel', 'dk-roundel'),
          ...both('serial', 'dk-serial'),
          ...both('flag', 'dk-flag', true),
        ],
      },
      {
        id: 'iaf-netz-989',
        label: 'Israeli Air Force F-16B Netz 989',
        provenance: {
          kind: 'inspired',
          note: 'Israeli Air Force F-16B Netz 989 in the desert scheme: tan, brown and pale green upper surfaces (a procedural blotch pattern standing in for the painted one), light blue-gray undersides, dark gray radome, black 989 on the fin and intake, the squadron phoenix redrawn as original art spanning fin and rudder, Star of David roundels on the upper right and lower left wings (which wings carry them is approximated). Colors are approximations; stencils and the fin-top badge are omitted.',
          references: [
            ref(
              'Israeli Air Force General Dynamics F-16B Netz 989 (GFDL 1.2)',
              'Israeli_Air_Force_General_Dynamics_F-16B_Netz_(401)_Lofting-1.jpg',
            ),
            ref(
              'IAF F-16B Netz 017 at CIAF 2004, desert scheme (CC BY-SA 4.0)',
              'IAF_F-16B_Netz_017_CIAF_2004-2.jpg',
            ),
          ],
        },
        paints: paint({
          color: '#c4a882',
          radome: '#4f5458',
          gear: '#b7c0c4',
          camouflage: camo(['#cbb089', '#a07757', '#a8b597'], 8, 41),
          zones: [undersides('#b7c0c4', 1.72)],
        }),
        markings: [
          ...both('fin-bird', 'il-phoenix', true),
          ...both('rudder-bird', 'il-phoenix', true),
          ...both('fin-number', 'il-fin-989'),
          ...both('intake-small', 'il-intake-989'),
          { anchor: 'wing-disc-upper-right', graphic: 'il-roundel' },
          { anchor: 'wing-disc-lower-left', graphic: 'il-roundel' },
        ],
      },
      {
        id: 'nsawc-07-blue-camouflage',
        label: 'US Navy NSAWC adversary 07, Fallon',
        provenance: {
          kind: 'inspired',
          note: 'Naval Strike and Air Warfare Center adversary F-16B 920461 "07" at Fallon: three-blue angular camouflage (a procedural splinter pattern standing in for the painted one) over light blue-gray undersides, white radome, black 07 on the intakes, a small 07 on the fin cap, a dark lightning bolt on the fin, NSAWC on the ventral fins and low-visibility insignia. The badge on the bolt is omitted. Colors are approximations.',
          references: [
            ref(
              'NSAWC F-16B 920461 07 at Fallon (CC BY 2.0)',
              '920461_07_F-16B_NSAWC_(3143354959).jpg',
            ),
          ],
        },
        paints: paint({
          color: '#7fb3c2',
          radome: '#e9eae5',
          gear: '#b3c0c6',
          camouflage: camo(['#93c8d3', '#5d9cb1', '#6b8595'], 9, 7, 'splinter'),
          zones: [undersides('#b3c0c6', 1.3)],
        }),
        markings: [
          ...both('intake-number', 'nsawc-07-intake'),
          ...both('cap-number', 'nsawc-07-cap'),
          ...both('fin-bolt', 'nsawc-bolt', true),
          ...both('ventral', 'nsawc-title'),
          ...both('insignia', 'insignia-lowvis'),
          { anchor: 'wing-ins-upper-left', graphic: 'insignia-lowvis' },
          { anchor: 'wing-ins-lower-right', graphic: 'insignia-lowvis' },
        ],
      },
    ],
  };
}
