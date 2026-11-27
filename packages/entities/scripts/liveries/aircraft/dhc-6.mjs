/**
 * DHC-6 Twin Otter liveries: the US Air Force Academy's UV-18B, Antarctic and Canadian military
 * operators, and civil airline schemes in their real colors and layouts (fictional
 * registrations, no names or logos).
 *
 * Model frame: +Z nose, +X left, +Y up. One ivory shell carries fuselage, wings, struts, fin and
 * tailplane; flaps, ailerons and nacelles are separate ivory skins, and red strips (lower
 * cheatline, elevators, rudder) are their own meshes. The boxy cabin side sits at x 0.91 from
 * z -1 to 5 with windows at y 2.05-2.45 and the belly at y 0.95; the tail cone tapers to z -7
 * and the fin leading edge runs from (z -5.1, y 3.2) to (z -6.4, y 5.6).
 */
import * as art from '../art-twins.mjs';

const SHELL = 'body-TwinOtter-shell-TwinOtter-ivory',
  RED_STRIP = 'accent-TwinOtter-shell-TwinOtter-red',
  RUDDER = 'accent-TwinOtter-rudder-moving-TwinOtter-red',
  ELEVATORS = [
    'accent-TwinOtter-elevator-1-TwinOtter-red',
    'accent-TwinOtter-elevator--1-TwinOtter-red',
  ],
  NACELLES = [
    'body-TwinOtter-nacelle-0-TwinOtter-ivory',
    'body-TwinOtter-nacelle-1-TwinOtter-ivory',
  ];

// The type labels baked into earlier models are gone (registrations are markings now); keep the
// painted regions and add one spanning region for lettering across fin and rudder.
export function slots(existing) {
  const out = {};
  for (const [name, binding] of Object.entries(existing))
    if (!name.includes('label') && name !== 'topPaint') out[name] = binding;
  return { ...out, skin: { materials: ['TwinOtter-ivory', 'TwinOtter-red'] } };
}

export default function design({ kit: k, space, slots: all }) {
  const sides = ['1', '-1'];
  const anchors = {};
  const at = (name, slot, o) => (anchors[name] = space.anchor(slot, o));
  for (const side of sides) {
    const x = Number(side);
    at(`title-${side}`, SHELL, {
      center: [x * 0.9, 1.5, 3.0],
      facing: [x, 0, 0],
      width: 2.4,
      height: 0.3,
      depth: 0.5,
    });
    at(`reg-${side}`, SHELL, {
      center: [x * 0.6, 2.18, -2.9],
      facing: [x, 0, 0],
      width: 1.9,
      height: 0.3,
      depth: 0.5,
    });
    at(`rear-${side}`, SHELL, {
      center: [x * 0.6, 1.95, -3.0],
      facing: [x, 0, 0],
      width: 3.6,
      height: 1.3,
      depth: 0.6,
    });
    at(`insignia-${side}`, SHELL, {
      center: [x * 0.62, 1.82, -2.6],
      facing: [x, 0, 0],
      width: 0.8,
      height: 0.42,
      depth: 0.5,
    });
    at(`fin-${side}`, 'skin', {
      center: [x * 0.06, 4.3, -6.6],
      facing: [x, 0, 0],
      width: 2.4,
      height: 3.2,
      depth: 0.24,
    });
    at(`nose-num-${side}`, SHELL, {
      center: [x * 0.6, 1.55, 6.6],
      facing: [x, 0, 0.3],
      width: 0.7,
      height: 0.24,
      depth: 0.5,
    });
    at(`flag-${side}`, SHELL, {
      center: [x * 0.88, 2.3, 4.3],
      facing: [x, 0, 0],
      width: 0.5,
      height: 0.3,
      depth: 0.5,
    });
  }
  // Wing undersides (US practice: insignia under the right wing, the title under the left).
  const wingAt = (x, top) =>
    space.anchor(SHELL, {
      center: [x, top ? 3.05 : 2.9, 1.5],
      facing: [0, top ? 1 : -1, 0],
      up: [0, 0, 1],
      width: 1.6,
      height: 1.2,
      depth: 0.3,
    });
  anchors['wing-upper-left'] = wingAt(5.4, true);
  anchors['wing-lower-right'] = wingAt(-5.4, false);

  const WHITE = '#f2f2ee',
    NAVY = '#1b2a57',
    BLACK = '#17181a';
  const bodySlots = Object.keys(all).filter((n) => n.startsWith('body-'));
  const base = (color) => art.paintAll(bodySlots, { color, roughness: 0.32 });
  const fuselageOnly = [
    space.plane(SHELL, [-1, 0, 0], [1.0, 0, 0]),
    space.plane(SHELL, [1, 0, 0], [-1.0, 0, 0]),
    space.below(SHELL, 2.9),
  ];
  // Below a line along the fuselage side from the nose (z 8) to the tail (z -7.4).
  const lower = (color, yNose, yTail) => ({
    color,
    planes: [...fuselageOnly, space.sideLine(SHELL, [8, yNose], [-7.4, yTail], -1)],
  });
  const band = (color, [a0, b0], [a1, b1]) => ({
    color,
    planes: [
      ...fuselageOnly,
      space.sideLine(SHELL, [8, a0], [-7.4, a1], 1),
      space.sideLine(SHELL, [8, b0], [-7.4, b1], -1),
    ],
  });
  const fin = (color, extra = []) => ({
    color,
    planes: [
      space.plane(SHELL, [-1, 0, 0], [0.2, 0, 0]),
      space.plane(SHELL, [1, 0, 0], [-0.2, 0, 0]),
      space.above(SHELL, 2.62),
      ...extra,
    ],
  });

  const g = {};
  // Concentric arcs sweeping up the tail (Aurora): navy rings on white, centred low and aft.
  const arcs = (w, h, cx, cy, r0, r1, n, color, label) => {
    const c = new k.Canvas(w, h);
    const step = (r1 - r0) / n;
    for (let i = 0; i < n; i++)
      c.ring(color, cx, cy, r0 + i * step, r0 + i * step + step * 0.55, 72);
    return c.graphic(label);
  };
  g['aurora-arcs-rear'] = arcs(3.6, 1.3, 1.6, -0.6, 1.0, 2.1, 6, NAVY, 'Tail arcs');
  g['aurora-arcs-fin'] = arcs(2.4, 3.2, 0.2, -0.2, 1.4, 2.9, 7, '#f2f2ee', 'Fin arcs');
  g['reg-ra'] = art.lettering(k, 'RA-67293', 1.9, 0.3, NAVY, { height: 0.24 });
  g['ru-flag'] = (() => {
    const c = new k.Canvas(2.4, 3.2);
    art.bandFlag(c, 1.05, 1.3, 0.42, 0.28, ['#f4f4f2', '#1c3f94', '#d52b1e']);
    return c.graphic('Russian flag');
  })();
  g['reg-a3'] = art.lettering(k, 'A3-KLQ', 1.9, 0.3, BLACK, { height: 0.24 });
  g['to-flag'] = (() => {
    const c = new k.Canvas(0.5, 0.3);
    c.rect('#c10000', 0.02, 0.03, 0.44, 0.24);
    c.rect('#ffffff', 0.02, 0.15, 0.2, 0.12);
    c.rect('#c10000', 0.105, 0.165, 0.03, 0.09);
    c.rect('#c10000', 0.075, 0.195, 0.09, 0.03);
    return c.graphic('Tongan flag');
  })();
  // Tapa-cloth style band ahead of the fin: a red frame with a repeated diamond motif.
  g.tapa = (() => {
    const c = new k.Canvas(3.6, 1.3);
    const x0 = 3.05,
      w = 0.28;
    c.rect('#b7121d', x0, 0.0, w, 1.3);
    c.rect(WHITE, x0 + 0.03, 0.03, w - 0.06, 1.24);
    for (let y = 0.12; y < 1.25; y += 0.24) {
      c.add('#b7121d', [
        [x0 + w / 2, y - 0.1],
        [x0 + w - 0.05, y],
        [x0 + w / 2, y + 0.1],
        [x0 + 0.05, y],
      ]);
      c.circle(WHITE, x0 + w / 2, y, 0.03, 12);
    }
    return c.graphic('Tapa band');
  })();
  g['usaf-title'] = art.lettering(k, 'U.S. AIR FORCE', 2.4, 0.3, NAVY, { height: 0.2 });
  g['usaf-insignia'] = k
    .usInsignia(new k.Canvas(0.8, 0.42), 0.4, 0.21, 0.17, { style: 'full' })
    .graphic('US national insignia');
  g['usaf-wing-insignia'] = k
    .usInsignia(new k.Canvas(1.6, 1.2), 0.8, 0.6, 0.36, { style: 'full' })
    .graphic('US national insignia');
  g['usaf-fin'] = (() => {
    const c = new k.Canvas(2.4, 3.2);
    art.text(c, BLACK, '70465', { x: 1.05, y: 1.95, height: 0.12 });
    // Small Air Force Academy badge redrawn as a plain blue shield with a gold border.
    c.add('#c9a227', [
      [1.05, 2.15],
      [1.17, 2.22],
      [1.17, 2.4],
      [0.93, 2.4],
      [0.93, 2.22],
    ]);
    c.add(NAVY, [
      [1.05, 2.18],
      [1.145, 2.235],
      [1.145, 2.375],
      [0.955, 2.375],
      [0.955, 2.235],
    ]);
    return c.graphic('Serial and badge');
  })();

  // RCAF CC-138: bilingual titles either side of the roundel on the cheatline, a red rear panel.
  g['rcaf-titles'] = (() => {
    const c = new k.Canvas(3.6, 1.3);
    art.text(c, '#2c3a4e', 'RCAF', { x: 1.05, y: 0.86, height: 0.15 });
    art.text(c, '#2c3a4e', 'ARC', { x: 2.05, y: 0.86, height: 0.15 });
    k.canadaRoundel(c, 1.55, 0.86, 0.14);
    return c.graphic('RCAF titles and roundel');
  })();
  g['rcaf-panel'] = new k.Canvas(3.6, 1.3)
    .rect('#b0242a', 2.45, 0.12, 0.75, 0.3)
    .graphic('Red panel');
  g['rcaf-fin'] = (() => {
    const c = new k.Canvas(2.4, 3.2);
    const fx = 0.97,
      fy = 1.92,
      fw = 0.46,
      fh = 0.23;
    c.rect('#d52b1e', fx, fy, fw, fh);
    c.rect('#ffffff', fx + fw * 0.25, fy, fw * 0.5, fh);
    const leaf = [
      [0, 0.95],
      [0.12, 0.68],
      [0.3, 0.76],
      [0.24, 0.42],
      [0.5, 0.56],
      [0.44, 0.38],
      [0.7, 0.4],
      [0.56, 0.18],
      [0.62, 0.08],
      [0.28, -0.12],
      [0.34, -0.3],
      [0.04, -0.24],
      [0.04, -0.7],
      [-0.04, -0.7],
      [-0.04, -0.24],
      [-0.34, -0.3],
      [-0.28, -0.12],
      [-0.62, 0.08],
      [-0.56, 0.18],
      [-0.7, 0.4],
      [-0.44, 0.38],
      [-0.5, 0.56],
      [-0.24, 0.42],
      [-0.3, 0.76],
      [-0.12, 0.68],
    ].map(([lx, ly]) => [fx + fw / 2 + lx * fh * 0.42, fy + fh / 2 + ly * fh * 0.42]);
    c.add('#d52b1e', leaf);
    art.text(c, '#2c3a4e', '13803', { x: fx + fw / 2, y: fy - 0.13, height: 0.08 });
    return c.graphic('Canadian flag and serial');
  })();
  g['rcaf-803'] = art.lettering(k, '803', 0.7, 0.24, '#1b1c1e', { height: 0.17 });

  const references = {
    cc138: {
      title: 'RCAF CC-138 Twin Otter in the Arctic, 5 March 2018 (US Navy, public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:Royal_Canadian_Air_Force_CC-138_Twin_Otter_in_the_arctic_on_5_March_2018_(180305-N-SV928-130).JPG',
    },
    uv18b: {
      title: 'UV-18B of the US Air Force Academy, parachute training, 1980 (USAF, public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:UV-18B_USAF_academy_parachute_training_1980.JPEG',
    },
    aurora: {
      title: 'DHC-6 Series 400 RA-67284 of Aurora (CC BY-SA 2.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Viking_Air_DHC-6_Twin_Otter_Series_400_of_Avropa_(30127684035).jpg',
    },
    lulutai: {
      title: 'DHC-6 Series 400 A3-KLT of Lulutai Airlines at Wagga Wagga (CC BY-SA 3.0 AU)',
      url: 'https://commons.wikimedia.org/wiki/File:Lulutai_Airlines_(A3-KLT)_Viking_Air_DHC-6_Twin_Otter_Series_400,_ex_Reignwood_Air_(B-10GE),_taxiing_at_Wagga_Wagga_Airport.jpg',
    },
  };

  return {
    selected: 'usaf-academy-uv-18b',
    anchors,
    graphics: g,
    variants: [
      {
        id: 'usaf-academy-uv-18b',
        label: 'USAF Academy UV-18B, 1980',
        provenance: {
          kind: 'inspired',
          note: 'UV-18B 77-0465 of the US Air Force Academy parachute team, 1980: white upper fuselage, fin and wings over a pale blue lower fuselage split by a dark blue pinstripe, U.S. AIR FORCE in dark blue on the forward fuselage, national insignia on the rear fuselage, upper left and lower right wing, the serial and a small badge (redrawn as a plain shield) on the fin. Colors approximate.',
          references: [references.uv18b],
        },
        paints: (() => {
          const p = base(WHITE);
          p[SHELL] = {
            color: WHITE,
            roughness: 0.32,
            zones: [lower('#a9c1d6', 1.78, 2.2), band(NAVY, [1.78, 1.82], [2.2, 2.24])],
          };
          p[RED_STRIP] = { color: '#a9c1d6', roughness: 0.32 };
          p[RUDDER] = { color: WHITE, roughness: 0.32 };
          for (const n of ELEVATORS) p[n] = { color: WHITE, roughness: 0.32 };
          return p;
        })(),
        markings: [
          { anchor: 'title-1', graphic: 'usaf-title' },
          { anchor: 'title--1', graphic: 'usaf-title' },
          { anchor: 'insignia-1', graphic: 'usaf-insignia' },
          { anchor: 'insignia--1', graphic: 'usaf-insignia' },
          { anchor: 'fin-1', graphic: 'usaf-fin' },
          { anchor: 'fin--1', graphic: 'usaf-fin' },
          { anchor: 'wing-upper-left', graphic: 'usaf-wing-insignia' },
          { anchor: 'wing-lower-right', graphic: 'usaf-wing-insignia' },
        ],
      },
      {
        id: 'navy-tail-arcs',
        label: 'Far East regional airline, navy and white (RA-67293)',
        provenance: {
          kind: 'inspired',
          note: 'Series 400 in the colors of the referenced Aurora RA-67284: white with a navy lower fuselage, navy fin, nacelles and tail arcs sweeping up the rear fuselage and fin, orange fin cap, and the Russian flag on the fin. Fictional registration RA-67293; airline title and emblem omitted. Arc count and spacing approximate.',
          references: [references.aurora],
        },
        paints: (() => {
          const p = base(WHITE);
          p[SHELL] = {
            color: WHITE,
            roughness: 0.32,
            zones: [lower(NAVY, 1.45, 1.7), fin(NAVY), fin('#e0602a', [space.above(SHELL, 5.75)])],
          };
          p[RED_STRIP] = { color: NAVY, roughness: 0.32 };
          p[RUDDER] = { color: NAVY, roughness: 0.32 };
          for (const n of ELEVATORS) p[n] = { color: WHITE, roughness: 0.32 };
          for (const n of NACELLES) p[n] = { color: NAVY, roughness: 0.32 };
          return p;
        })(),
        markings: [
          { anchor: 'reg-1', graphic: 'reg-ra' },
          { anchor: 'reg--1', graphic: 'reg-ra' },
          { anchor: 'rear-1', graphic: 'aurora-arcs-rear' },
          { anchor: 'rear--1', graphic: 'aurora-arcs-rear', flip: true },
          { anchor: 'fin-1', graphic: 'aurora-arcs-fin' },
          { anchor: 'fin--1', graphic: 'aurora-arcs-fin', flip: true },
          { anchor: 'fin-1', graphic: 'ru-flag' },
          { anchor: 'fin--1', graphic: 'ru-flag' },
        ],
      },
      {
        id: 'pacific-red-and-white',
        label: 'South Pacific red and white (A3-KLQ)',
        provenance: {
          kind: 'inspired',
          note: 'Series 400 in the colors of the referenced Lulutai Airlines A3-KLT: white upper fuselage over a red belly with twin red pinstripes, a red fin and rudder, a tapa-cloth style band ahead of the fin (simplified original pattern) and the Tongan flag behind the cockpit. Fictional Tongan registration A3-KLQ; airline title and bird emblem omitted. Colors approximate.',
          references: [references.lulutai],
        },
        paints: (() => {
          const RED = '#c4141f';
          const p = base(WHITE);
          p[SHELL] = {
            color: WHITE,
            roughness: 0.32,
            zones: [
              lower(RED, 1.5, 1.95),
              band(RED, [1.6, 1.64], [2.05, 2.09]),
              band(RED, [1.69, 1.72], [2.14, 2.17]),
              fin(RED),
            ],
          };
          p[RED_STRIP] = { color: RED, roughness: 0.32 };
          p[RUDDER] = { color: RED, roughness: 0.32 };
          for (const n of ELEVATORS) p[n] = { color: RED, roughness: 0.32 };
          return p;
        })(),
        markings: [
          { anchor: 'reg-1', graphic: 'reg-a3' },
          { anchor: 'reg--1', graphic: 'reg-a3' },
          { anchor: 'rear-1', graphic: 'tapa' },
          { anchor: 'rear--1', graphic: 'tapa', flip: true },
          { anchor: 'flag-1', graphic: 'to-flag' },
          { anchor: 'flag--1', graphic: 'to-flag', flip: true },
        ],
      },
      {
        id: 'rcaf-cc-138-arctic',
        label: 'RCAF CC-138 Twin Otter 13803, Arctic 2018',
        provenance: {
          kind: 'inspired',
          note: 'CC-138 13803 of 440 Transport Squadron, Royal Canadian Air Force, on Arctic sea ice in 2018: overall search-and-rescue yellow with a gray cheatline and red pinstripe along the windows, RCAF and ARC titles either side of the maple-leaf roundel on the rear fuselage, the red rear panel, the Canadian flag and serial on the fin, 803 on the nose and a black radome. Colors approximate; skis are not modelled.',
          references: [references.cc138],
        },
        paints: (() => {
          const YELLOW_SAR = '#e5b417';
          const p = base(YELLOW_SAR);
          p[SHELL] = {
            color: YELLOW_SAR,
            roughness: 0.4,
            zones: [
              band('#8a8f93', [2.18, 2.26], [2.28, 2.36]),
              band('#b0242a', [2.12, 2.15], [2.22, 2.25]),
              { color: '#1b1c1e', planes: [space.ahead(SHELL, 7.75), space.below(SHELL, 2.2)] },
            ],
          };
          p[RED_STRIP] = { color: YELLOW_SAR, roughness: 0.4 };
          p[RUDDER] = { color: YELLOW_SAR, roughness: 0.4 };
          for (const n of ELEVATORS) p[n] = { color: YELLOW_SAR, roughness: 0.4 };
          return p;
        })(),
        markings: [
          { anchor: 'rear-1', graphic: 'rcaf-titles' },
          { anchor: 'rear--1', graphic: 'rcaf-titles' },
          { anchor: 'rear-1', graphic: 'rcaf-panel' },
          { anchor: 'rear--1', graphic: 'rcaf-panel', flip: true },
          { anchor: 'fin-1', graphic: 'rcaf-fin' },
          { anchor: 'fin--1', graphic: 'rcaf-fin' },
          { anchor: 'nose-num-1', graphic: 'rcaf-803' },
          { anchor: 'nose-num--1', graphic: 'rcaf-803' },
        ],
      },
    ],
  };
}
