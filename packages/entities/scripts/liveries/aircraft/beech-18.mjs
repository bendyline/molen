/**
 * Beech 18 liveries: the US Navy's SNB-1 Kansan, a Royal Canadian Navy Expeditor, a USAAF C-45F
 * in olive drab, and an executive D18S in its real colors (fictional registration, no names).
 *
 * The model stands in its three-point attitude: pitched 12.283 degrees nose-up and lowered
 * 0.613 m (beech-18.mjs). Markings are authored in that posed frame with the posed "up" so
 * lettering follows the fuselage datum. The ivory shell carries fuselage, wings and tailplane;
 * the twin fins (x ±2.3, z -4.3 to -5.3) and nacelles are separate ivory skins; cowlings,
 * control surfaces and the baked cheatline are blue-material skins. The rear fuselage runs from
 * y 0.57-1.71 at z -2.6 to y 0.55-1.34 at z -3.8.
 */
import * as art from '../art-twins.mjs';

const SHELL = 'body-Beech18-shell-Beech18-ivory',
  CHEAT = 'accent-Beech18-shell-Beech18-blue',
  FINS = ['body-Beech18-fin-1-Beech18-ivory', 'body-Beech18-fin--1-Beech18-ivory'],
  NACELLES = ['body-Beech18-nacelle-1-Beech18-ivory', 'body-Beech18-nacelle--1-Beech18-ivory'];
const frame = art.posedFrame(12.283, -0.613);

// The baked "D 18 S" labels are gone from the model; keep every other painted region and add a
// region spanning fin and rudder for tail lettering.
export function slots(existing) {
  const out = {};
  for (const [name, binding] of Object.entries(existing))
    if (!name.includes('decal')) out[name] = binding;
  return { ...out, tail: { materials: ['Beech18-ivory', 'Beech18-blue'] } };
}

export default function design({ kit: k, space, slots: all }) {
  const UP = frame.up,
    FWD = frame.fwd;
  const sides = ['1', '-1'];
  const anchors = {};
  const at = (name, slot, o) => (anchors[name] = space.anchor(slot, o));
  for (const side of sides) {
    const x = Number(side);
    at(`fus-insignia-${side}`, SHELL, {
      center: [x * 0.38, 1.24, -2.5],
      facing: [x, 0, 0],
      up: UP,
      width: 1.1,
      height: 0.6,
      depth: 0.5,
    });
    at(`fus-aft-${side}`, SHELL, {
      center: [x * 0.26, 0.98, -3.45],
      facing: [x, 0, 0],
      up: UP,
      width: 1.1,
      height: 0.24,
      depth: 0.5,
    });
    at(`fus-fwd-${side}`, SHELL, {
      center: [x * 0.47, 1.36, -1.65],
      facing: [x, 0, 0],
      up: UP,
      width: 0.8,
      height: 0.26,
      depth: 0.5,
    });
    at(`title-${side}`, SHELL, {
      center: [x * 0.6, 1.98, -0.1],
      facing: [x, 0.25, 0],
      up: UP,
      width: 2.6,
      height: 0.18,
      depth: 0.5,
    });
    // Both fins carry lettering on their outer faces.
    at(`fin-${side}`, 'tail', {
      center: [x * 2.31, 1.3, -5.05],
      facing: [x, 0, 0],
      up: UP,
      width: 1.6,
      height: 1.6,
      depth: 0.2,
    });
  }
  const wingAt = (x, top) =>
    space.anchor(SHELL, {
      center: [x, top ? 1.72 : 1.5, 1.0],
      facing: top ? UP : frame.down,
      up: FWD,
      width: 1.3,
      height: 1.1,
      depth: 0.35,
    });
  anchors['wing-upper-left'] = wingAt(4.6, true);
  anchors['wing-lower-right'] = wingAt(-4.6, false);
  anchors['wing-upper-right'] = wingAt(-4.6, true);
  anchors['wing-lower-left'] = wingAt(4.6, false);

  const SILVER = { color: '#c3c8ca', metalness: 0.45, roughness: 0.38 },
    BLACK = '#17181a',
    OD = '#525236',
    NGRAY = '#80827f',
    WHITE = '#f2f1ec',
    YELLOW = '#ecdf9a',
    TEAL = '#1d5a5a';
  const ivory = Object.keys(all).filter((n) => n.startsWith('body-'));
  const blue = Object.keys(all).filter((n) => n.startsWith('accent-'));
  const paintAll = (p) => ({ ...art.paintAll(ivory, p), ...art.paintAll(blue, p) });

  const g = {};
  const starDisc = (w, h, r) => {
    const c = new k.Canvas(w, h);
    art.starInDisc(c, w / 2, h / 2, r);
    return c.graphic('US star in disc (1942)');
  };
  const starBar = (w, h, r) => {
    const c = new k.Canvas(w, h);
    art.starAndBar(c, w / 2, h / 2, r);
    return c.graphic('US star-and-bar (1943)');
  };
  g['navy-star'] = starDisc(1.1, 0.6, 0.26);
  g['navy-star-wing'] = starDisc(1.3, 1.1, 0.42);
  g['us-navy'] = art.lettering(k, 'U.S. NAVY', 1.1, 0.24, BLACK, { height: 0.16 });
  g['c-55'] = art.lettering(k, 'C-55', 0.8, 0.26, BLACK, { height: 0.18 });
  g['snb-fin'] = (() => {
    const c = new k.Canvas(1.6, 1.6);
    art.text(c, BLACK, 'SNB-1', { x: 0.62, y: 1.28, height: 0.07 });
    art.text(c, BLACK, '51025', { x: 1.1, y: 1.28, height: 0.07 });
    return c.graphic('Type and bureau number');
  })();
  g['rcn-title'] = art.lettering(k, 'ROYAL CANADIAN NAVY', 2.6, 0.18, BLACK, { height: 0.13 });
  g['rcn-roundel'] = (() => {
    const c = new k.Canvas(1.1, 0.6);
    k.canadaRoundel(c, 0.55, 0.3, 0.25);
    return c.graphic('Canadian roundel');
  })();
  g['rcn-roundel-wing'] = (() => {
    const c = new k.Canvas(1.3, 1.1);
    k.canadaRoundel(c, 0.65, 0.55, 0.42);
    return c.graphic('Canadian roundel');
  })();
  // Fin flash with the serial above it, as on the preserved tail of 2312.
  g['rcn-fin'] = (() => {
    const c = new k.Canvas(1.6, 1.6);
    art.finFlash(c, 0.55, 0.62, 0.42, 0.5, ['#1f3a8a', '#ffffff', '#c8102e']);
    art.text(c, BLACK, '2312', { x: 0.76, y: 1.25, height: 0.12 });
    return c.graphic('Fin flash and serial');
  })();
  g['us-bar'] = starBar(1.1, 0.6, 0.24);
  g['us-bar-wing'] = starBar(1.3, 1.1, 0.3);
  g['reg-exec'] = art.lettering(k, 'N7618B', 1.1, 0.24, TEAL, { height: 0.17 });

  const references = {
    snb1: {
      title: 'Beech SNB-1 Kansan Bu 51025 in US Navy markings, 2013 (CC BY-SA 3.0)',
      url: 'https://commons.wikimedia.org/wiki/File:N145SC_(Bu51025)_Beech_SNB-1_Kansan_(US_Navy)_PAE_02AUG13_(9424635997).jpg',
    },
    rcn: {
      title: 'Royal Canadian Navy Expeditor 2312 under restoration, Shearwater (CC BY-SA 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:CF-SEB_RCAF_2312_Beech_3NM_Expeditor_Shearwater_Aviation_Museum_NS_18.6.25_(54626170478).jpg',
    },
    c45f: {
      title: 'Beechcraft C-45F Expeditor, Barksdale Global Power Museum (CC BY-SA 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Barksdale_Global_Power_Museum_September_2015_18_(Beechcraft_C-45F_Expeditor).jpg',
    },
    exec: {
      title: 'Beechcraft D18S executive transport, Smithsonian (CC0)',
      url: 'https://commons.wikimedia.org/wiki/File:Beechcraft_D18S_Twin_Beech_-_DPLA_-_90ef321242ce1c6d7ab221d9774b3412_(page_18).jpg',
    },
  };

  return {
    selected: 'us-navy-snb-1',
    anchors,
    graphics: g,
    variants: [
      {
        id: 'us-navy-snb-1',
        label: 'US Navy SNB-1 Kansan C-55',
        provenance: {
          kind: 'inspired',
          note: 'SNB-1 Kansan Bu 51025 in 1942-43 Navy trainer markings as preserved: aluminum lacquer overall, the star-in-disc insignia on the rear fuselage, upper left and lower right wing, U.S. NAVY aft and the C-55 station code ahead of it, SNB-1 and 51025 high on the fins. Colors approximate.',
          references: [references.snb1],
        },
        paints: paintAll(SILVER),
        markings: [
          ...sides.map((s) => ({ anchor: `fus-insignia-${s}`, graphic: 'navy-star' })),
          { anchor: 'fus-aft-1', graphic: 'us-navy' },
          { anchor: 'fus-aft--1', graphic: 'us-navy' },
          { anchor: 'fus-fwd-1', graphic: 'c-55' },
          { anchor: 'fus-fwd--1', graphic: 'c-55' },
          { anchor: 'fin-1', graphic: 'snb-fin' },
          { anchor: 'fin--1', graphic: 'snb-fin' },
          { anchor: 'wing-upper-left', graphic: 'navy-star-wing' },
          { anchor: 'wing-lower-right', graphic: 'navy-star-wing' },
        ],
      },
      {
        id: 'royal-canadian-navy-expeditor',
        label: 'Royal Canadian Navy Expeditor 2312',
        provenance: {
          kind: 'inspired',
          note: 'Expeditor 3NM 2312 of the Royal Canadian Navy, Shearwater, as preserved: natural metal, ROYAL CANADIAN NAVY above the cabin windows, the maple-leaf roundel on the rear fuselage and wings, a blue-white-red fin flash with the serial above it on both fins. Colors approximate; small stencils omitted.',
          references: [references.rcn],
        },
        paints: paintAll({ color: '#b9bec1', metalness: 0.62, roughness: 0.32 }),
        markings: [
          { anchor: 'title-1', graphic: 'rcn-title' },
          { anchor: 'title--1', graphic: 'rcn-title' },
          ...sides.map((s) => ({ anchor: `fus-insignia-${s}`, graphic: 'rcn-roundel' })),
          { anchor: 'fin-1', graphic: 'rcn-fin' },
          { anchor: 'fin--1', graphic: 'rcn-fin', flip: true },
          ...['wing-upper-left', 'wing-upper-right', 'wing-lower-left', 'wing-lower-right'].map(
            (a) => ({ anchor: a, graphic: 'rcn-roundel-wing' }),
          ),
        ],
      },
      {
        id: 'usaaf-c-45f-olive-drab',
        label: 'USAAF C-45F olive drab',
        provenance: {
          kind: 'inspired',
          note: 'C-45F Expeditor in the USAAF olive drab over neutral gray of the referenced museum aircraft, the demarcation low on the fuselage and nacelles, with 1943 star-and-bar insignia on the rear fuselage, upper left and lower right wing. Serial and unit markings not visible in the photograph are omitted; colors approximate.',
          references: [references.c45f],
        },
        paints: (() => {
          const p = paintAll({ color: OD, roughness: 0.75, metalness: 0.02 });
          const below = (slot, y0, y1) => ({
            color: NGRAY,
            roughness: 0.7,
            planes: [frame.line(space, slot, [5, y0], [-5, y1], -1)],
          });
          p[SHELL] = { ...p[SHELL], zones: [below(SHELL, 1.5, 1.4)] };
          for (const n of [...NACELLES, ...FINS]) p[n] = { ...p[n], zones: [below(n, 1.5, 1.4)] };
          return p;
        })(),
        markings: [
          ...sides.map((s) => ({ anchor: `fus-insignia-${s}`, graphic: 'us-bar' })),
          { anchor: 'wing-upper-left', graphic: 'us-bar-wing' },
          { anchor: 'wing-lower-right', graphic: 'us-bar-wing' },
        ],
      },
      {
        id: 'executive-white-and-yellow',
        label: 'Executive D18S white and yellow (N7618B)',
        provenance: {
          kind: 'inspired',
          note: 'D18S executive transport in the colors of the referenced Smithsonian aircraft: white upper fuselage, fins and tailplane over pale yellow wings, nacelles and cowlings, with a teal cheatline along the cabin. Fictional registration N7618B on the rear fuselage; operator names and badges omitted. Colors approximate.',
          references: [references.exec],
        },
        paints: (() => {
          const p = paintAll({ color: YELLOW, roughness: 0.35 });
          const fuselage = [
            space.plane(SHELL, [-1, 0, 0], [0.75, 0, 0]),
            space.plane(SHELL, [1, 0, 0], [-0.75, 0, 0]),
          ];
          p[SHELL] = {
            color: YELLOW,
            roughness: 0.35,
            zones: [
              {
                color: WHITE,
                planes: [...fuselage, frame.line(space, SHELL, [5, 1.95], [-5, 1.48], 1)],
              },
              { color: WHITE, planes: [space.behind(SHELL, -3.9), space.above(SHELL, 0.62)] },
              {
                color: TEAL,
                planes: [
                  ...fuselage,
                  frame.line(space, SHELL, [5, 1.95], [-5, 1.48], 1),
                  frame.line(space, SHELL, [5, 2.05], [-5, 1.58], -1),
                ],
              },
            ],
          };
          for (const n of FINS) p[n] = { color: WHITE, roughness: 0.35 };
          p[CHEAT] = { color: TEAL, roughness: 0.35 };
          for (const n of blue.filter((b) => /rudder|elevator/.test(b)))
            p[n] = { color: WHITE, roughness: 0.35 };
          return p;
        })(),
        markings: [
          { anchor: 'fus-aft-1', graphic: 'reg-exec' },
          { anchor: 'fus-aft--1', graphic: 'reg-exec' },
        ],
      },
    ],
  };
}
