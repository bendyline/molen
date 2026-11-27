/**
 * Beechcraft Baron G58 liveries: factory-style civil stripe schemes in their real colors (no
 * names or logos, fictional registrations) and the Indonesian Navy's gray as delivered.
 *
 * Model frame: +Z nose, +X left, +Y up. One ivory shell carries fuselage, wings, fin and
 * tailplane; the rudder is its own navy skin and two navy cheatline strips are separate meshes
 * (y 0.87-1.21 along the cabin and tail cone). The fin leading edge runs from (z -3.9, y 1.6)
 * to (z -5.1, y 2.8); the rudder hinges at z -5.05.
 */
import * as art from '../art-twins.mjs';

const SHELL = 'body-Baron-shell-Baron-ivory',
  RUDDER = 'accent-Baron-rudder-Baron-navy',
  STRIPES = 'accent-Baron-shell-Baron-navy';

export function slots(existing) {
  // Marking-only region: every painted skin (shell, rudder, nacelles) for lettering that spans parts.
  return { ...existing, skin: { materials: ['Baron-ivory', 'Baron-navy'] } };
}

export default function design({ kit: k, space, slots: all }) {
  const sides = ['1', '-1'];
  const anchors = {};
  const at = (name, slot, o) => (anchors[name] = space.anchor(slot, o));
  for (const side of sides) {
    const x = Number(side);
    at(`reg-${side}`, SHELL, {
      center: [x * 0.45, 1.38, -3.05],
      facing: [x, 0, 0],
      width: 1.2,
      height: 0.24,
      depth: 0.5,
    });
    at(`fin-${side}`, 'skin', {
      center: [x * 0.035, 2.2, -5.1],
      facing: [x, 0, 0],
      width: 1.5,
      height: 1.4,
      depth: 0.2,
    });
    at(`nose-${side}`, SHELL, {
      center: [x * 0.42, 1.2, 2.2],
      facing: [x, 0, 0],
      width: 0.6,
      height: 0.16,
      depth: 0.5,
    });
  }
  at('wing-lower-right', SHELL, {
    center: [-3.6, 1.25, -0.35],
    facing: [0, -1, 0],
    up: [0, 0, 1],
    width: 1.0,
    height: 0.8,
    depth: 0.3,
  });
  at('wing-lower-left', SHELL, {
    center: [3.6, 1.25, -0.35],
    facing: [0, -1, 0],
    up: [0, 0, 1],
    width: 1.0,
    height: 0.8,
    depth: 0.3,
  });

  const WHITE = '#f1f1ec',
    NAVY = '#1c2a4e',
    BLACK = '#16181a',
    BRONZE = '#8b6c48',
    GRAY = '#8c9296';
  const bodySlots = Object.keys(all).filter((n) => n.startsWith('body-'));
  const base = (color) => art.paintAll(bodySlots, { color, roughness: 0.32 });
  // The fin above a sloped line parallel to its root: everything with |x| < 0.2 behind z -3.9.
  const finBand = (color, y0, y1, slope = 0.55) => ({
    color,
    planes: [
      space.plane(SHELL, [-1, 0, 0], [0.2, 0, 0]),
      space.plane(SHELL, [1, 0, 0], [-0.2, 0, 0]),
      space.sideLine(SHELL, [-3.8, y0], [-5.9, y0 + slope * 2.1], 1),
      space.sideLine(SHELL, [-3.8, y1], [-5.9, y1 + slope * 2.1], -1),
    ],
  });
  const rudderBand = (color, y0, y1, slope = 0.55) => ({
    color,
    planes: [
      space.sideLine(RUDDER, [-3.8, y0], [-5.9, y0 + slope * 2.1], 1),
      space.sideLine(RUDDER, [-3.8, y1], [-5.9, y1 + slope * 2.1], -1),
    ],
  });
  // A cheatline along the fuselage between two sloped lines, kept to the fuselage (|x| < 0.68).
  const cheat = (color, [z0, ya0, yb0], [z1, ya1, yb1]) => ({
    color,
    planes: [
      space.plane(SHELL, [-1, 0, 0], [0.68, 0, 0]),
      space.plane(SHELL, [1, 0, 0], [-0.68, 0, 0]),
      space.sideLine(SHELL, [z0, ya0], [z1, ya1], 1),
      space.sideLine(SHELL, [z0, yb0], [z1, yb1], -1),
    ],
  });
  // Nacelle top flash: the forward nacelle above its waist.
  const nacelleTop = (slot, color) => ({
    color,
    planes: [space.above(slot, 1.42), space.ahead(slot, -0.2)],
  });

  const g = {};
  const reg = (label, color) => art.lettering(k, label, 1.2, 0.24, color, { height: 0.2 });
  g['reg-n458bg'] = reg('N458BG', BLACK);
  g['reg-n583gb'] = reg('N583GB', BLACK);
  g['reg-vh-bzq'] = reg('VH-BZQ', BLACK);
  g['reg-ws'] = art.lettering(k, 'N458BG', 1.0, 0.8, BLACK, { height: 0.32 });

  const references = {
    n67wm: {
      title: 'Beechcraft G58 Baron N67WM, 2023 (CC BY-SA 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Beechcraft_G58_Baron_(N67WM,_cn_TH-2485)_(1-12-2023).jpg',
    },
    n538bb: {
      title: 'Beechcraft G58 Baron N538BB, 2023 (CC BY-SA 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Beechcraft_G58_Baron_(N538BB,_cn_TH-2538)_(7-29-2023).jpg',
    },
    vhtwz: {
      title: 'Beechcraft G58 Baron VH-TWZ at Wagga Wagga (CC BY-SA 3.0 AU)',
      url: 'https://commons.wikimedia.org/wiki/File:Paced_Investments_(VH-TWZ)_Beechcraft_G58_Baron_at_Wagga_Wagga_Airport.jpg',
    },
    indo: {
      title: 'Baron G58 of the Indonesian Navy on delivery (public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:Newly_Arrived_Beechcraft_Baron_G58_of_Indonesian_Navy.jpg',
    },
  };

  return {
    selected: 'white-navy-sweep',
    anchors,
    graphics: g,
    variants: [
      {
        id: 'white-navy-sweep',
        label: 'White with navy and black sweep (N458BG)',
        provenance: {
          kind: 'inspired',
          note: 'Private G58 in the white scheme of the referenced N67WM: navy and black cheatlines under the cabin sweeping up the fin and rudder as three diagonal bands, a navy flash over each nacelle. Fictional registration N458BG on the rear fuselage and under the left wing; no names or logos. Stripe widths and angles approximate.',
          references: [references.n67wm],
        },
        paints: (() => {
          const p = base(WHITE);
          p[SHELL] = {
            color: WHITE,
            roughness: 0.32,
            zones: [
              finBand(NAVY, 1.55, 1.78),
              finBand(BLACK, 1.82, 1.9),
              finBand(NAVY, 1.94, 2.06),
            ],
          };
          p[RUDDER] = {
            color: WHITE,
            roughness: 0.32,
            zones: [
              rudderBand(NAVY, 1.55, 1.78),
              rudderBand(BLACK, 1.82, 1.9),
              rudderBand(NAVY, 1.94, 2.06),
            ],
          };
          p[STRIPES] = { color: NAVY, roughness: 0.3 };
          for (const n of ['body-Baron-nacelle-1-Baron-ivory', 'body-Baron-nacelle-2-Baron-ivory'])
            p[n] = { color: WHITE, roughness: 0.32, zones: [nacelleTop(n, NAVY)] };
          return p;
        })(),
        markings: [
          { anchor: 'reg-1', graphic: 'reg-n458bg' },
          { anchor: 'reg--1', graphic: 'reg-n458bg' },
          { anchor: 'wing-lower-left', graphic: 'reg-ws' },
        ],
      },
      {
        id: 'factory-white-black-red',
        label: 'Factory white, black and red (N583GB)',
        provenance: {
          kind: 'inspired',
          note: 'G58 in the factory scheme of the referenced N538BB: white with a black upper fin and rudder over a red sweep, black nacelle tops edged in red, and red pinstripes along the cabin and tail cone. Fictional registration N583GB; manufacturer script and logos omitted. Colors and sweep angles approximate.',
          references: [references.n538bb],
        },
        paints: (() => {
          const p = base(WHITE);
          p[SHELL] = {
            color: WHITE,
            roughness: 0.3,
            zones: [finBand('#b3202a', 1.72, 1.92, 0.5), finBand(BLACK, 1.98, 3.6, 0.5)],
          };
          p[RUDDER] = {
            color: BLACK,
            roughness: 0.3,
            zones: [rudderBand(WHITE, 0, 1.72, 0.5), rudderBand('#b3202a', 1.72, 1.92, 0.5)],
          };
          p[STRIPES] = { color: '#b3202a', roughness: 0.3 };
          for (const n of ['body-Baron-nacelle-1-Baron-ivory', 'body-Baron-nacelle-2-Baron-ivory'])
            p[n] = { color: WHITE, roughness: 0.3, zones: [nacelleTop(n, BLACK)] };
          return p;
        })(),
        markings: [
          { anchor: 'reg-1', graphic: 'reg-n583gb' },
          { anchor: 'reg--1', graphic: 'reg-n583gb' },
        ],
      },
      {
        id: 'white-black-bronze',
        label: 'White, black and bronze (VH-BZQ)',
        provenance: {
          kind: 'inspired',
          note: 'Australian G58 in the scheme of the referenced VH-TWZ: white with a black upper fin and rudder, bronze and black pinstripes along the fuselage and a black nacelle flash. Fictional Australian registration VH-BZQ; owner monogram and names omitted. Colors approximate.',
          references: [references.vhtwz],
        },
        paints: (() => {
          const p = base(WHITE);
          p[SHELL] = {
            color: WHITE,
            roughness: 0.3,
            zones: [
              finBand(BRONZE, 2.0, 2.1, 0.5),
              finBand(BLACK, 2.14, 3.5, 0.5),
              cheat(BLACK, [2.9, 1.24, 1.28], [-4.6, 1.38, 1.42]),
            ],
          };
          p[RUDDER] = {
            color: BLACK,
            roughness: 0.3,
            zones: [rudderBand(WHITE, 0, 2.0, 0.5), rudderBand(BRONZE, 2.0, 2.1, 0.5)],
          };
          p[STRIPES] = { color: BRONZE, roughness: 0.3, metalness: 0.3 };
          for (const n of ['body-Baron-nacelle-1-Baron-ivory', 'body-Baron-nacelle-2-Baron-ivory'])
            p[n] = { color: WHITE, roughness: 0.3, zones: [nacelleTop(n, BLACK)] };
          return p;
        })(),
        markings: [
          { anchor: 'reg-1', graphic: 'reg-vh-bzq' },
          { anchor: 'reg--1', graphic: 'reg-vh-bzq' },
        ],
      },
      {
        id: 'indonesian-navy-delivery',
        label: 'Indonesian Navy gray, as delivered',
        provenance: {
          kind: 'inspired',
          note: 'One of the Indonesian Navy (TNI-AL) G58 trainers on its delivery day: overall medium gray with a black fin leading edge and unpainted spinners; national and service markings were not yet applied, as in the photograph. Gray shade approximate.',
          references: [references.indo],
        },
        paints: (() => {
          const p = base(GRAY);
          p[SHELL] = {
            color: GRAY,
            roughness: 0.5,
            zones: [
              {
                color: '#26292b',
                planes: [
                  space.plane(SHELL, [-1, 0, 0], [0.2, 0, 0]),
                  space.plane(SHELL, [1, 0, 0], [-0.2, 0, 0]),
                  space.above(SHELL, 1.58),
                  // A band 0.16 m deep behind the leading edge (which runs (-3.9, 1.6) to (-5.1, 2.8)).
                  space.sideLine(SHELL, [-4.06, 1.6], [-5.26, 2.8], 1),
                ],
              },
            ],
          };
          p[RUDDER] = { color: GRAY, roughness: 0.5 };
          p[STRIPES] = { color: GRAY, roughness: 0.5 };
          return p;
        })(),
        markings: [],
      },
    ],
  };
}
