/**
 * Eurofighter Typhoon liveries: Royal Air Force squadrons (a front-line jet and the 3(F)
 * Squadron centenary tail), the Luftwaffe (a standard jet and the 2018 Tiger Meet "Ghost
 * Tiger"), the Aeronautica Militare and the Austrian Air Force, each from photographs. National
 * markings and squadron art are original vector drawings; the model carries none of its own.
 *
 * Model frame: +Z nose, +X the aircraft's left, +Y up. One fin in the x = 0 plane (11 cm thick,
 * 5 cm at the tip): leading edge (y 2.57, z -2.67) to (5.29, -6.06), trailing edge (2.43,
 * -5.60) to (5.29, -6.96); the rudder behind the hinge (2.38, -4.80) to (4.98, -6.30) is its
 * own slot. Flat fuselage side behind the cockpit at x 1.0 to 1.1 (z 1.5 to 2.75, y 1.7 to
 * 2.1); forward fuselage above the intake at x 0.6 to 0.9 (z 2.6 to 4, y 2.25).
 */
import { bundeswehrCross, leanLivery, textGraphic } from '../art-fighters-b.mjs';

// Paint slots: the existing ones without the catch-all 'body' slot (it overlaps them all).
export function slots(existing) {
  return Object.fromEntries(Object.entries(existing).filter(([name]) => name !== 'body'));
}

const RAF_GRAY = '#8b959b', // RAF Typhoon medium gray
  LW_GRAY = '#86949b', // Luftwaffe blue-gray
  IT_GRAY = '#8e979c',
  WHITE = '#f3f3f0',
  BLACK = '#121314';

const AIRFRAME = 'body-Typhoon-airframe-Typhoon-gray',
  RUDDER = 'body-Typhoon-rudder-Typhoon-gray';
// Fin canvas: z from -2.4 aft to -7.0, y from 2.35 to 5.35.
const FIN = { z0: -2.4, z1: -7.0, y0: 2.35, y1: 5.35 };
const finW = FIN.z0 - FIN.z1,
  finH = FIN.y1 - FIN.y0;
const leadingZ = (y) => -2.67 - ((y - 2.57) / 2.72) * 3.39;

/** Fin-coordinate canvas (x aft of z0, y up from y0), mirrored on the right; text readable. */
function finCanvas(k, right) {
  const c = new k.Canvas(finW, finH);
  const add = c.add.bind(c),
    text = c.text.bind(c);
  let mirror = right;
  c.add = (color, points, holes = []) => {
    const m = (ring) => (mirror ? ring.map(([x, y]) => [finW - x, y]) : ring);
    return add(color, m(points), holes.map(m));
  };
  c.text = (color, label, opts) => {
    const saved = mirror;
    mirror = false;
    text(color, label, { ...opts, x: saved ? finW - opts.x : opts.x });
    mirror = saved;
    return c;
  };
  c.at = (z, y) => [FIN.z0 - z, y - FIN.y0];
  return c;
}

/** A tapered, curving stripe (tiger art), original. */
function stripe(c, color, x, y, length, width, angle, bend = 0.3) {
  const left = [],
    right = [];
  const n = 8;
  let px = x,
    py = y;
  for (let i = 0; i <= n; i++) {
    const t = i / n,
      a = angle + bend * t,
      w = width * (1 - t) ** 0.7 * 0.5;
    left.push([px + Math.cos(a + Math.PI / 2) * w, py + Math.sin(a + Math.PI / 2) * w]);
    right.unshift([px - Math.cos(a + Math.PI / 2) * w, py - Math.sin(a + Math.PI / 2) * w]);
    px += (Math.cos(a) * length) / n;
    py += (Math.sin(a) * length) / n;
  }
  return c.add(color, [...left, ...right]);
}

export default function design({ kit: k, space, slots: all, bounds }) {
  const anchors = {};
  const pair = (name, slot, x, y, z, w, h, facing = [1, 0, 0], depth = 0.4) => {
    for (const side of [1, -1])
      anchors[`${name}-${side}`] = space.anchor(slot, {
        center: [side * x, y, z],
        facing: [side * facing[0], facing[1], facing[2]],
        width: w,
        height: h,
        depth,
      });
  };
  const finCenter = [0.06, (FIN.y0 + FIN.y1) / 2, (FIN.z0 + FIN.z1) / 2];
  pair('fin-panel', AIRFRAME, ...finCenter, finW, finH, [1, 0, 0], 0.3);
  pair('rudder-panel', RUDDER, ...finCenter, finW, finH, [1, 0, 0], 0.3);
  pair('fin-badge', AIRFRAME, 0.06, 3.85, -5.05, 0.5, 0.62, [1, 0, 0], 0.3);
  pair('fin-code', AIRFRAME, 0.04, 4.74, -5.78, 0.66, 0.19, [1, 0, 0], 0.3);
  pair('fin-flag', AIRFRAME, 0.04, 4.72, -5.62, 0.32, 0.19, [1, 0, 0], 0.3);
  pair('fin-flash', AIRFRAME, 0.06, 2.95, -4.75, 0.34, 0.15, [1, 0, 0], 0.3);
  // Fuselage: the national mark with squadron bars above the intake, the serial/code block
  // on the flat side behind the cockpit, the serial on the rear fuselage.
  pair('nose-bars', AIRFRAME, 1.06, 1.97, 2.05, 1.7, 0.36, [1, 0, 0], 0.5);
  pair('side-code', AIRFRAME, 1.08, 1.93, 1.75, 2.0, 0.42, [1, 0, 0], 0.5);
  pair('side-roundel', AIRFRAME, 1.02, 1.95, 2.55, 0.42, 0.42, [1, 0, 0], 0.5);
  pair('aft-code', AIRFRAME, 1.08, 1.95, 1.85, 0.9, 0.3, [1, 0, 0], 0.5);
  pair('aft-serial', AIRFRAME, 1.22, 1.85, -3.4, 0.9, 0.17, [1, 0, 0], 0.5);
  pair('aft-side', AIRFRAME, 1.15, 1.9, -1.1, 6.6, 1.4, [1, 0, 0], 0.9);
  // Wings: outboard, above and below.
  for (const side of [1, -1])
    for (const [face, y] of [
      ['upper', 1.53],
      ['lower', 1.46],
    ])
      anchors[`wing-${face}-${side}`] = space.anchor(AIRFRAME, {
        center: [side * 3.85, y, -2.55],
        facing: [0, face === 'upper' ? 1 : -1, 0],
        up: [0, 0, 1],
        width: 0.8,
        height: 0.8,
        depth: 0.2,
      });

  const graphics = {};
  const text = (label, w, h, color, opts) => textGraphic(k, label, w, h, color, opts);
  const both = (anchor, graphic, flipRight = false) => [
    { anchor: `${anchor}-1`, graphic },
    { anchor: `${anchor}--1`, graphic, ...(flipRight ? { flip: true } : {}) },
  ];
  const sidesOf = (anchor, left, right) => [
    { anchor: `${anchor}-1`, graphic: left },
    { anchor: `${anchor}--1`, graphic: right },
  ];
  const finArt = (id, draw, rudder = true) => {
    for (const [suffix, right] of [
      ['left', false],
      ['right', true],
    ]) {
      const c = finCanvas(k, right);
      draw(c);
      graphics[`${id}-${suffix}`] = c.graphic(`${id} (${suffix})`);
    }
    return [
      ...sidesOf('fin-panel', `${id}-left`, `${id}-right`),
      ...(rudder ? sidesOf('rudder-panel', `${id}-left`, `${id}-right`) : []),
    ];
  };
  const wings = (graphic, faces = ['upper', 'lower']) =>
    faces.flatMap((face) => both(`wing-${face}`, graphic));
  const disc = (draw, label) => {
    const c = new k.Canvas(0.42, 0.42);
    draw(c, 0.21, 0.21, 0.205);
    return c.graphic(label);
  };

  // National markings.
  graphics['roundel-raf-lowvis'] = disc(
    (c, x, y, r) => k.roundel(c, x, y, r, ['#8fa6c4', '#d59ba0'], [0.5, 0.5]),
    'RAF roundel (low visibility)',
  );
  graphics['roundel-italy'] = disc(
    (c, x, y, r) => k.roundel(c, x, y, r, k.ROUNDELS.italy),
    'Italian roundel',
  );
  graphics['roundel-austria'] = disc((c, x, y, r) => {
    c.circle('#c8102e', x, y, r, 48);
    const tri = (s) => {
      const h = (Math.sqrt(3) / 2) * s;
      return [
        [x - s / 2, y + h / 3],
        [x + s / 2, y + h / 3],
        [x, y - (2 * h) / 3],
      ];
    };
    c.add('#ffffff', tri(r * 1.62));
    c.add('#c8102e', tri(r * 0.8));
  }, 'Austrian roundel');
  graphics['cross-germany'] = disc((c, x, y) => bundeswehrCross(c, x, y, 0.4), 'Bundeswehr cross');

  // RAF 41(R) Squadron: white bars with a red stripe flanking the roundel; double-armed red
  // cross under a gold crown on the fin; EB-G at the fin top; low-visibility fin flash.
  graphics['bars-41'] = (() => {
    const c = new k.Canvas(1.7, 0.36);
    for (const x of [0.06, 1.04]) {
      c.rect('#ffffff', x, 0.08, 0.6, 0.2);
      c.rect('#d22630', x, 0.155, 0.6, 0.05);
    }
    k.roundel(c, 0.85, 0.18, 0.17, ['#8fa6c4', '#d59ba0'], [0.5, 0.5]);
    return c.graphic('41 Squadron bars and roundel');
  })();
  graphics['badge-41'] = (() => {
    const c = new k.Canvas(0.5, 0.62);
    const red = '#d22630';
    c.rect(red, 0.225, 0.02, 0.05, 0.4);
    c.rect(red, 0.13, 0.27, 0.24, 0.05);
    c.rect(red, 0.1, 0.13, 0.3, 0.05);
    // Crown: band, five points, pearls.
    c.rect('#e3b11f', 0.13, 0.45, 0.24, 0.04);
    c.add('#e3b11f', [
      [0.13, 0.49],
      [0.37, 0.49],
      [0.39, 0.58],
      [0.33, 0.52],
      [0.29, 0.59],
      [0.25, 0.53],
      [0.21, 0.59],
      [0.17, 0.52],
      [0.11, 0.58],
    ]);
    return c.graphic('41 Squadron cross and crown (simplified)');
  })();
  graphics['code-EB-G'] = text('EB-G', 0.66, 0.19, WHITE, { fill: 0.8 });
  graphics['flash-raf-lowvis'] = (() => {
    const c = new k.Canvas(0.34, 0.15);
    c.rect('#d59ba0', 0, 0, 0.17, 0.15);
    c.rect('#8fa6c4', 0.17, 0, 0.17, 0.15);
    return c.graphic('RAF fin flash (low visibility)');
  })();
  graphics['serial-ZJ914'] = text('ZJ914', 0.9, 0.17, '#6d777d', { fill: 0.8 });

  // RAF 3(F) Squadron centenary, 2012: green fin with the red and yellow band, the badge,
  // 100 in yellow, QO-C; green bars on the nose; yellow spine stripe.
  const GREEN = '#2f8a43',
    YELLOW = '#f2c919',
    RED = '#c8202b';
  const fin3 = finArt('fin-3sqn', (c) => {
    c.rect(GREEN, 0, 0, finW, finH);
    // Gray fin tip above 5.0 m.
    c.rect('#8b959b', 0, c.at(0, 5.12)[1], finW, finH);
    // Band: red over yellow, across the fin at 3.75 to 4.15 m.
    const [, yb] = c.at(0, 3.75),
      [, ym] = c.at(0, 3.95),
      [, yt] = c.at(0, 4.15);
    c.rect(YELLOW, 0, yb, finW, ym - yb);
    c.rect(RED, 0, ym, finW, yt - ym);
    // Badge: a blue disc in a white ring under a crown, with a stylized cockatrice.
    const [bx, by] = c.at(-4.85, 3.95);
    c.circle(WHITE, bx, by, 0.29, 40);
    c.circle('#2e64ad', bx, by, 0.25, 40);
    c.circle(WHITE, bx, by, 0.17, 32);
    c.add('#2e64ad', [
      [bx - 0.12, by - 0.08],
      [bx + 0.02, by - 0.02],
      [bx + 0.04, by + 0.1],
      [bx + 0.11, by + 0.12],
      [bx + 0.08, by + 0.04],
      [bx + 0.12, by - 0.06],
      [bx + 0.02, by - 0.1],
    ]);
    c.rect(YELLOW, bx - 0.11, by + 0.3, 0.22, 0.04);
    c.add(YELLOW, [
      [bx - 0.11, by + 0.34],
      [bx + 0.11, by + 0.34],
      [bx + 0.13, by + 0.44],
      [bx, by + 0.38],
      [bx - 0.13, by + 0.44],
    ]);
    // 100 low on the fin; QO-C near the top.
    const [nx, ny] = c.at(-5.4, 3.05);
    c.text(YELLOW, '100', { x: nx, y: ny, height: 0.42, face: 'geometric' });
    const [qx, qy] = c.at(-6.15, 4.85);
    c.text('#1d2c55', 'QO-C', { x: qx, y: qy, height: 0.14 });
  });
  graphics['bars-3'] = (() => {
    const c = new k.Canvas(1.7, 0.36);
    for (const x of [0.06, 1.04]) {
      c.rect('#3b3a1c', x, 0.07, 0.6, 0.22);
      c.rect(YELLOW, x + 0.01, 0.08, 0.58, 0.2);
      c.rect(GREEN, x + 0.01, 0.125, 0.58, 0.11);
    }
    k.roundel(c, 0.85, 0.18, 0.17, ['#8fa6c4', '#d59ba0'], [0.5, 0.5]);
    return c.graphic('3(F) Squadron bars and roundel');
  })();
  graphics['serial-ZJ936'] = text('ZJ936', 0.9, 0.17, '#6d777d', { fill: 0.8 });

  // Luftwaffe: the code block 30 + cross + 46 in black, thinly edged in white.
  graphics['code-30-46'] = (() => {
    const c = new k.Canvas(2.0, 0.42);
    c.text(BLACK, '30', { x: 0.62, y: 0.21, height: 0.3, align: 'right' });
    bundeswehrCross(c, 1.0, 0.21, 0.36);
    c.text(BLACK, '46', { x: 1.38, y: 0.21, height: 0.3, align: 'left' });
    return c.graphic('30 + 46');
  })();
  graphics['flag-germany'] = (() => {
    const c = new k.Canvas(0.32, 0.19);
    c.rect(BLACK, 0, 0.127, 0.32, 0.063);
    c.rect('#dd0000', 0, 0.063, 0.32, 0.064);
    c.rect('#ffce00', 0, 0, 0.32, 0.063);
    return c.graphic('Flag of Germany');
  })();
  graphics['badge-lw'] = (() => {
    const c = new k.Canvas(0.5, 0.62);
    const shield = (i) => [
      [0.1 + i, 0.5 - i],
      [0.4 - i, 0.5 - i],
      [0.4 - i, 0.27],
      [0.25, 0.08 + i * 1.3],
      [0.1 + i, 0.27],
    ];
    c.add('#2f5fa0', shield(0));
    c.add('#e8eef3', shield(0.03));
    c.add('#2f5fa0', [
      [0.25, 0.5 - 0.03],
      [0.4 - 0.03, 0.5 - 0.03],
      [0.4 - 0.03, 0.27],
      [0.25, 0.27],
    ]);
    c.add('#2f5fa0', [
      [0.1 + 0.03, 0.27],
      [0.25, 0.27],
      [0.25, 0.12],
    ]);
    return c.graphic('Wing badge (simplified quartered shield)');
  })();

  // Luftwaffe Ghost Tiger 2018 (TaktLwG 74): dark gray with neon green tiger stripes.
  const NEON = '#3fe05a',
    TIGER_DARK = '#272c2f';
  const ghostFin = finArt('fin-ghost', (c) => {
    c.rect('#1f6a2c', 0, 0, finW, finH);
    for (let i = 0; i < 9; i++) {
      const y = 0.25 + i * 0.3;
      const [x] = c.at(leadingZ(FIN.y0 + y) + 0.02, 0);
      stripe(c, TIGER_DARK, x, y, 1.0 + (i % 3) * 0.3, 0.22, -0.35 - (i % 2) * 0.12, 0.35);
    }
    for (let i = 0; i < 6; i++)
      stripe(c, NEON, 1.0 + i * 0.5, 0.05, 0.9, 0.12, 1.0 + (i % 2) * 0.2, 0.3);
    const [tx, ty] = c.at(-5.35, 4.25);
    c.text(WHITE, 'GHOST TIGER', { x: tx, y: ty, height: 0.1 });
    c.text(WHITE, 'NTM 2018', { x: tx, y: ty - 0.15, height: 0.08 });
  });
  graphics['ghost-side'] = (() => {
    const c = new k.Canvas(6.6, 1.4);
    for (let i = 0; i < 12; i++)
      stripe(c, NEON, 0.2 + i * 0.52, 1.35, 1.1 + (i % 3) * 0.2, 0.26, -0.75 - (i % 2) * 0.2, 0.5);
    for (let i = 0; i < 10; i++)
      stripe(c, NEON, 0.5 + i * 0.6, 0.05, 0.7, 0.18, 0.95 + (i % 2) * 0.2, -0.4);
    return c.graphic('Ghost Tiger stripes (original)');
  })();
  graphics['code-31-00'] = (() => {
    const c = new k.Canvas(2.0, 0.42);
    c.text(WHITE, '31', { x: 0.62, y: 0.21, height: 0.28, align: 'right' });
    bundeswehrCross(c, 1.0, 0.21, 0.34, { lowvis: true });
    c.text(WHITE, '00', { x: 1.38, y: 0.21, height: 0.28, align: 'left' });
    return c.graphic('31 + 00');
  })();

  // Aeronautica Militare 4-7 and Austrian 7L-WD codes.
  graphics['code-4-7'] = text('4-7', 0.9, 0.3, '#5d666b', { fill: 0.84 });
  graphics['code-7L-WD'] = (() => {
    const c = new k.Canvas(2.0, 0.42);
    c.text(BLACK, '7L', { x: 0.75, y: 0.21, height: 0.28, align: 'right' });
    c.circle('#c8102e', 1.0, 0.21, 0.17, 40);
    const tri = (s) => {
      const h = (Math.sqrt(3) / 2) * s;
      return [
        [1.0 - s / 2, 0.21 + h / 3],
        [1.0 + s / 2, 0.21 + h / 3],
        [1.0, 0.21 - (2 * h) / 3],
      ];
    };
    c.add('#ffffff', tri(0.27));
    c.add('#c8102e', tri(0.13));
    c.text(BLACK, 'WD', { x: 1.25, y: 0.21, height: 0.28, align: 'left' });
    return c.graphic('7L + roundel + WD');
  })();

  const paints = (color, extra = {}) => ({
    ...Object.fromEntries(Object.keys(all).map((name) => [name, { color }])),
    ...extra,
  });

  const references = {
    raf41: {
      title: "Typhoon FGR4 ZJ914 'EB-G' of No. 41 Squadron (CC BY-SA 2.0)",
      url: 'https://commons.wikimedia.org/wiki/File:Eurofighter_Typhoon_FGR4_%27ZJ914_-_EB-G%27_(19806048123).jpg',
    },
    raf3: {
      title:
        "Typhoon FGR4 ZJ936 'QO-C' of No. 3(F) Squadron, centenary tail, Waddington 2012 (CC BY-SA 3.0)",
      url: "https://commons.wikimedia.org/wiki/File:Royal_Air_Force_(RAF)_Typhoon_FGR4_ZJ936_'QO-C'_of_No._3_Squadron_RAF,_with_a_commemorative_100th_anniversary_custom_paint_scheme_on_its_tail_fin,_on_static_display_at_RAF_Waddington_during_the_2012_Waddington_Int._Airshow_(8581632937).jpg",
    },
    lw: {
      title: 'Luftwaffe Eurofighter 30+46 at Neubrandenburg (CC BY-SA 2.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Eurofighter_Typhoon_Germany_30%2B46_Neubrandenburg_(9965132925).jpg',
    },
    ghost: {
      title: 'Eurofighter "Ghost Tiger" 2018, Taktisches Luftwaffengeschwader 74 (CC BY-SA 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Eurofighter_%22Ghost_Tiger%22_2018_Taktisches_Luftwaffengeschwader_74.jpg',
    },
    italy: {
      title: 'Aeronautica Militare Eurofighter Typhoon 4-7, 2009 (CC BY-SA 3.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Eurofighter_Typhoon_Aeronautica_Militare_2009_04.jpg',
    },
    austria: {
      title: 'Austrian Air Force Eurofighters 7L-WD and 7L-WI at RIAT 2022 (CC BY 2.0)',
      url: 'https://commons.wikimedia.org/wiki/File:AUSTRIAN_AIR_FORCE_EUROFIGHTER_EF.2000_7L-WD,7L-WI_(52247472319).jpg',
    },
  };

  const built = {
    selected: 'raf-41-squadron-eb-g',
    anchors,
    graphics,
    variants: [
      {
        id: 'raf-41-squadron-eb-g',
        label: 'RAF No. 41 Squadron (EB-G)',
        provenance: {
          kind: 'inspired',
          note: 'Typhoon FGR4 ZJ914 of No. 41 Squadron from the referenced photograph: overall medium gray, the low-visibility roundel between white bars with a red stripe on the forward fuselage, the double-armed red cross under a gold crown on the fin (simplified), EB-G in white at the fin top, the low-visibility fin flash and ZJ914 on the rear fuselage, low-visibility roundels above the wings. Stencils are omitted.',
          references: [references.raf41],
        },
        paints: paints(RAF_GRAY),
        markings: [
          ...both('nose-bars', 'bars-41'),
          ...both('fin-badge', 'badge-41'),
          ...both('fin-code', 'code-EB-G'),
          ...both('fin-flash', 'flash-raf-lowvis', true),
          ...both('aft-serial', 'serial-ZJ914'),
          ...wings('roundel-raf-lowvis', ['upper']),
        ],
      },
      {
        id: 'raf-3-squadron-centenary-qo-c',
        label: 'RAF No. 3(F) Squadron centenary, 2012 (QO-C)',
        provenance: {
          kind: 'inspired',
          note: 'Typhoon FGR4 ZJ936 in the 3(F) Squadron 100th anniversary scheme from the referenced photograph: green fin with the red and yellow band, the squadron badge (blue disc and white ring under a crown with a simplified cockatrice), 100 in yellow and QO-C, green and yellow bars around the low-visibility roundel and ZJ936 on the rear fuselage. The green and yellow spine stripe, the motto and LARKHILL 1912 lettering are omitted.',
          references: [references.raf3],
        },
        paints: paints(RAF_GRAY, { [RUDDER]: { color: GREEN } }),
        markings: [
          ...fin3,
          ...both('nose-bars', 'bars-3'),
          ...both('aft-serial', 'serial-ZJ936'),
          ...wings('roundel-raf-lowvis', ['upper']),
        ],
      },
      {
        id: 'luftwaffe-30-46',
        label: 'Luftwaffe (30+46)',
        provenance: {
          kind: 'inspired',
          note: 'Eurofighter 30+46 from the referenced photograph: Luftwaffe blue-gray, 30 + Bundeswehr cross + 46 in black on the fuselage side (the thin white edging of the digits is omitted), the German flag at the fin top and the wing badge on the fin (simplified to a quartered blue and white shield), Bundeswehr crosses above and below the wings.',
          references: [references.lw],
        },
        paints: paints(LW_GRAY),
        markings: [
          ...both('side-code', 'code-30-46'),
          ...both('fin-flag', 'flag-germany', true),
          ...both('fin-badge', 'badge-lw'),
          ...wings('cross-germany'),
        ],
      },
      {
        id: 'luftwaffe-ghost-tiger-2018',
        label: 'Luftwaffe TaktLwG 74 "Ghost Tiger", 2018',
        provenance: {
          kind: 'inspired',
          note: 'The Taktisches Luftwaffengeschwader 74 NATO Tiger Meet 2018 "Ghost Tiger" scheme from the referenced photograph: dark gray center and rear fuselage with neon green tiger stripes (the wings are left gray; they are not visible in the reference), a green fin with dark stripes and GHOST TIGER NTM 2018 in white, 31 + 00 in white with a low-visibility cross, the nose in standard gray. The painted tiger face is not reproduced; stripes are original vector art.',
          references: [references.ghost],
        },
        paints: paints(LW_GRAY, {
          [AIRFRAME]: {
            color: LW_GRAY,
            zones: [
              {
                color: TIGER_DARK,
                planes: [
                  space.behind(AIRFRAME, 2.6),
                  space.plane(AIRFRAME, [-1, 0, 0], [1.35, 0, 0]),
                  space.plane(AIRFRAME, [1, 0, 0], [-1.35, 0, 0]),
                ],
              },
            ],
          },
          [RUDDER]: { color: '#1f6a2c' },
        }),
        markings: [
          ...ghostFin,
          ...both('aft-side', 'ghost-side', true),
          ...both('side-code', 'code-31-00'),
          ...both('fin-flag', 'flag-germany', true),
          ...wings('cross-germany'),
        ],
      },
      {
        id: 'aeronautica-militare-4-stormo',
        label: 'Aeronautica Militare, 4° Stormo (4-7)',
        provenance: {
          kind: 'inspired',
          note: 'Eurofighter 4-7 of the 4° Stormo from the referenced 2009 photograph: overall gray, the Italian roundel on the fuselage side ahead of the code 4-7 in gray, roundels above and below the wings. The 4° Stormo fin badge and the fin lettering are omitted.',
          references: [references.italy],
        },
        paints: paints(IT_GRAY),
        markings: [
          ...both('side-roundel', 'roundel-italy'),
          ...both('aft-code', 'code-4-7'),
          ...wings('roundel-italy'),
        ],
      },
      {
        id: 'austria-7l-wd',
        label: 'Austrian Air Force (7L-WD)',
        provenance: {
          kind: 'inspired',
          note: 'Eurofighter 7L-WD from the referenced 2022 photograph: overall gray, 7L + roundel + WD in black on the fuselage side, Austrian roundels (red disc with the white triangle) above and below the wings. Stencils and the CALL 121.5 tank lettering are omitted.',
          references: [references.austria],
        },
        paints: paints(IT_GRAY),
        markings: [...both('side-code', 'code-7L-WD'), ...wings('roundel-austria')],
      },
    ],
  };
  return leanLivery(built, bounds);
}
