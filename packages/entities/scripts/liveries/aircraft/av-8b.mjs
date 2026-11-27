/**
 * AV-8B Harrier II liveries: US Marine Corps squadron schemes, the Spanish Navy (Armada) and
 * the Italian Navy (Marina Militare), with national insignia, roundels, unit codes, serials
 * and titles redrawn as original vector artwork from the referenced photographs (no reference
 * pixels). The model is the radar-nosed Harrier II Plus, as flown by all three services.
 *
 * Operator titles (MARINES, ARMADA, MARINA) are markings here, not model geometry. The paint
 * materials are double sided, so markings on the thin fin and wings are projected with a
 * depth that stops short of the opposite skin (fitted to the imported model with rays).
 */

// Paint slots: the existing airframe, wing, control-surface, nozzle, inlet-door and gear
// regions, plus the radome.
import { textShapes } from '../../lettering-outlines.mjs';

export function slots(existing) {
  return {
    ...existing,
    radome: { materials: ['AV8-radome'], node: 'AV8-airframe-AV8-radome' },
  };
}

const AIRFRAME = 'body-AV8-airframe-AV8-gray',
  WING = 'upper-AV8-airframe-AV8-upper',
  RUDDER = 'upper-AV8-rudder-AV8-upper';
const SIDES = [
  ['left', 1],
  ['right', -1],
];
// The fin's flat faces stand 45 mm either side of the centre line; its leading edge runs from
// (y 2.0, z -4.8) to (y 3.5, z -6.6) and the rudder hinge is at z -6.6.
const FIN_X = 0.045,
  finLeadingZ = (y) => -4.8 - 1.2 * (y - 2);

/** A concentric roundel at modest curve resolution (rings listed from the outside in). */
function lightRoundel(c, cx, cy, r, rings) {
  const n = rings.length,
    seg = 40;
  rings.forEach((color, i) => {
    const outer = r * (1 - i / n),
      inner = r * (1 - (i + 1) / n);
    if (i === n - 1) c.circle(color, cx, cy, outer, seg);
    else c.ring(color, cx, cy, inner, outer, seg);
  });
  return c;
}

/** An original fouled-free naval anchor in a disc (Italian Navy squadron badge, simplified). */
function anchorDisc(c, cx, cy, r, disc, ink) {
  c.circle(ink, cx, cy, r);
  c.circle(disc, cx, cy, r * 0.88);
  const s = r * 0.62,
    t = s * 0.09;
  c.rect(ink, cx - t, cy - s * 0.78, t * 2, s * 1.5); // shank
  c.rect(ink, cx - s * 0.42, cy + s * 0.42, s * 0.84, t * 1.6); // stock
  c.ring(ink, cx, cy + s * 0.86, s * 0.07, s * 0.15, 20); // ring
  // Arms: a lower arc with flukes.
  const arc = [];
  for (let i = 0; i <= 16; i++) {
    const a = Math.PI * 1.05 + (i / 16) * Math.PI * 0.9;
    arc.push([cx + Math.cos(a) * s * 0.78, cy - s * 0.12 + Math.sin(a) * s * 0.66]);
  }
  const inner = arc.map(([x, y]) => [
    cx + (x - cx) * 0.82,
    cy - s * 0.12 + (y - cy + s * 0.12) * 0.8,
  ]);
  c.add(ink, [...arc, ...inner.reverse()]);
  for (const side of [-1, 1])
    c.add(ink, [
      [cx + side * s * 0.74, cy - s * 0.3],
      [cx + side * s * 0.95, cy - s * 0.05],
      [cx + side * s * 0.62, cy - s * 0.22],
    ]);
  return c;
}

export default function design({ kit: k, space, slots: all, bounds }) {
  // ---------------------------------------------------------------- anchors (metres) ----
  const anchors = {};
  const fin = (_name, s, y, z, width, height) =>
    space.anchor(AIRFRAME, {
      center: [s * FIN_X, y, z],
      facing: [s, 0, 0],
      width,
      height,
      depth: 0.06,
    });
  for (const [name, s] of SIDES) {
    anchors[`fin-code-${name}`] = fin(name, s, 2.8, -6.2, 0.8, 0.5);
    anchors[`fin-stack-${name}`] = fin(name, s, 2.9, -6.4, 0.4, 0.8);
    anchors[`fin-title-${name}`] = fin(name, s, 2.26, -5.96, 1.3, 0.18);
    anchors[`fin-serial-${name}`] = fin(name, s, 2.47, -6.16, 0.6, 0.12);
    anchors[`fin-top-${name}`] = fin(name, s, 3.34, -6.54, 0.2, 0.1);
    anchors[`fin-lead-${name}`] = fin(name, s, 2.75, -5.75, 1.9, 1.5);
    // Tail boom, below the stabilator roots: forward and aft panels.
    anchors[`boom-fwd-${name}`] = space.anchor(AIRFRAME, {
      center: [s * 0.46, 1.74, -3.0],
      facing: [s, 0, -0.05],
      width: 0.9,
      height: 0.42,
      depth: 0.3,
    });
    anchors[`boom-aft-${name}`] = space.anchor(AIRFRAME, {
      center: [s * 0.42, 1.74, -3.95],
      facing: [s, 0, -0.05],
      width: 1.0,
      height: 0.42,
      depth: 0.3,
    });
    // Nose side under the windscreen, and the title band above it.
    anchors[`nose-${name}`] = space.anchor(AIRFRAME, {
      center: [s * 0.47, 2.18, 4.9],
      facing: [s, 0, -0.03],
      width: 0.7,
      height: 0.36,
      depth: 0.3,
    });
    anchors[`nose-title-${name}`] = space.anchor(AIRFRAME, {
      center: [s * 0.46, 2.4, 4.45],
      facing: [s, 0, -0.03],
      width: 1.1,
      height: 0.16,
      depth: 0.3,
    });
    // The fixed pod ahead of each front nozzle, just behind the intake, carries the US
    // insignia (4 x 1.25 r) or a disc (roundel, badge) on all three services' aircraft. The
    // projector stops short of the intake cowl behind the pod.
    const fairing = (width, height) =>
      space.anchor(AIRFRAME, {
        center: [s * 1.29, 1.72, 1.84],
        facing: [s, 0, 0],
        width,
        height,
        depth: 0.34,
      });
    anchors[`fairing-us-${name}`] = fairing(0.84, 0.2625);
    anchors[`fairing-disc-${name}`] = fairing(0.42, 0.42);
    // Small roundel on the boom ahead of the Italian code.
    anchors[`boom-disc-${name}`] = space.anchor(AIRFRAME, {
      center: [s * 0.445, 1.72, -3.32],
      facing: [s, 0, -0.05],
      width: 0.24,
      height: 0.24,
      depth: 0.3,
    });
    // Wings: each projector follows its skin's local slope (anhedral, camber) and stops short
    // of the opposite skin.
    const upper = (width, height) =>
        space.anchor(WING, {
          center: [s * 3.1, 2.037, -0.6],
          facing: [s * 0.204, 1, -0.155],
          up: [0, 0, 1],
          width,
          height,
          depth: 0.14,
        }),
      lower = (width, height) =>
        space.anchor(WING, {
          center: [s * 3.45, 1.848, -0.75],
          facing: [-s * 0.178, -1, 0.128],
          up: [0, 0, 1],
          width,
          height,
          depth: 0.07,
        });
    anchors[`wing-upper-${name}`] = upper(0.6, 0.6);
    anchors[`wing-lower-${name}`] = lower(0.6, 0.6);
    // US practice: insignia on the upper left and lower right wing.
    if (s > 0) anchors['wing-us-upper-left'] = upper(0.84, 0.2625);
    else anchors['wing-us-lower-right'] = lower(0.84, 0.2625);
  }
  // Wing title on the upper right wing, letters along the span, tops toward the leading edge.
  anchors['wing-title-right'] = space.anchor(WING, {
    center: [-2.75, 2.124, -0.45],
    facing: [-0.211, 1, -0.14],
    up: [0, 0, 1],
    width: 1.7,
    height: 0.3,
    depth: 0.1,
  });

  // ---------------------------------------------------------------- paint ----
  const extent = (slot) => {
    const b = bounds[slot];
    return Math.max(...b.max.map((v, i) => v - b.min[i]));
  };
  // Flat military finishes: matte enough that the anhedral wings do not mirror the sun.
  const coat = (slot, scheme) =>
    scheme.camouflage
      ? {
          color: scheme.camouflage[0],
          roughness: 0.75,
          camouflage: {
            colors: scheme.camouflage,
            scale: Math.round((extent(slot) / scheme.tile) * 1000) / 1000,
            seed: scheme.seed,
          },
        }
      : { color: scheme.color, roughness: 0.72 };
  /** Every existing body and wing region in the scheme's finish; radome and rudder apart. */
  function paints(scheme) {
    const out = {};
    for (const slot of Object.keys(all)) {
      if (slot === 'radome') continue;
      // Gear legs and doors stay plain; everything else takes the coat.
      out[slot] = /gear/.test(slot)
        ? { color: scheme.gear ?? scheme.color ?? scheme.camouflage[1] }
        : coat(slot, scheme);
    }
    out.radome = { color: scheme.radome, roughness: 0.55 };
    if (scheme.rudder) out[RUDDER] = { color: scheme.rudder };
    return out;
  }

  // ---------------------------------------------------------------- artwork ----
  /** Real lettering like Canvas.text, flattened with `segments` points per curve (budget). */
  const letter = (c, color, label, { x, y, height, align = 'center', maxWidth }, segments = 3) => {
    const { shapes, width } = textShapes(label, { height, face: 'technical', align });
    const squeeze = maxWidth && width > maxWidth ? maxWidth / width : 1;
    return c.shapesFrom(color, shapes, ([px, py]) => [x + px * squeeze, y + py], segments);
  };
  const text = (label, w, h, color, opts = {}, segments = 3) =>
    letter(
      new k.Canvas(w, h),
      color,
      label,
      { x: w / 2, y: h / 2, height: h * 0.8, maxWidth: w * 0.96, ...opts },
      segments,
    ).graphic(label);
  // One graphic per style serves the fairing and wing projectors (both 0.84 x 0.2625 m).
  const insignia = (style, color) =>
    k
      .usInsignia(new k.Canvas(0.84, 0.2625), 0.42, 0.13125, 0.195, { style, color })
      .graphic('US national insignia');
  const roundel = (rings, label) =>
    lightRoundel(new k.Canvas(0.5, 0.5), 0.25, 0.25, 0.25, rings).graphic(label);

  const BLACK = '#1c1e20',
    LOWVIS_LIGHT = '#a6acb0',
    WHITE = '#eeeeea';
  const graphics = {
    // VMA-542 Tigers, 2007: black codes on ghost gray, full-color insignia.
    'us-full': insignia('full'),
    'wh-code': text('W H', 0.8, 0.5, BLACK, { height: 0.27 }),
    'marines-black-fin': text('MARINES', 1.3, 0.18, BLACK, { height: 0.14 }),
    'bu-164554': text('164554', 0.6, 0.12, BLACK, { height: 0.08 }, 2),
    'fin-02-black': text('02', 0.2, 0.1, BLACK, { height: 0.07 }),
    'nose-02-black': text('02', 0.7, 0.36, BLACK, { height: 0.28 }),
    'vma-542': text('VMA-542', 0.9, 0.42, BLACK, { height: 0.06, y: 0.33 }, 2),
    'marines-wing': text('MARINES', 1.7, 0.3, BLACK, { height: 0.22 }),
    // VMA-214 Black Sheep: light gray low-visibility markings on dark gray.
    'us-lowvis-light': insignia('lowvis', LOWVIS_LIGHT),
    'marines-light-fin': text('MARINES', 1.3, 0.18, LOWVIS_LIGHT, { height: 0.14 }),
    'bu-165573': text('165573', 0.6, 0.12, LOWVIS_LIGHT, { height: 0.08 }, 2),
    'fin-04-light': text('04', 0.2, 0.1, LOWVIS_LIGHT, { height: 0.07 }),
    'nose-04-light': text('04', 0.7, 0.36, LOWVIS_LIGHT, { height: 0.26 }),
    'vma-214': (() => {
      const c = new k.Canvas(0.9, 0.42);
      letter(c, LOWVIS_LIGHT, 'VMA-214', { x: 0.45, y: 0.31, height: 0.07 }, 2);
      letter(c, LOWVIS_LIGHT, 'BLACKSHEEP', { x: 0.45, y: 0.2, height: 0.07 }, 2);
      return c.graphic('VMA-214 BLACKSHEEP');
    })(),
    // VMA-513, 1980s: black low-visibility markings on the wraparound camouflage.
    'us-lowvis-black': insignia('lowvis', '#202325'),
    'wf-code': text('W F', 0.8, 0.5, '#202325', { height: 0.27 }),
    'marines-dark-fin': text('MARINES', 1.3, 0.18, '#202325', { height: 0.14 }),
    'nose-13-dark': text('13', 0.7, 0.36, '#202325', { height: 0.26 }),
    // Spanish Navy.
    'roundel-es': roundel(k.ROUNDELS.spain, 'Spanish roundel'),
    'armada-fin': text('ARMADA', 1.3, 0.18, '#b3b9bc', { height: 0.15 }),
    'armada-nose': text('ARMADA', 1.1, 0.16, '#b3b9bc', { height: 0.12 }),
    'es-01-916': text('01-916', 0.7, 0.36, '#b3b9bc', { height: 0.075, y: 0.27 }, 2),
    'es-va1b26': text('VA.1B-26', 0.9, 0.42, BLACK, { height: 0.08, y: 0.33 }, 2),
    'fin-16-light': text('16', 0.6, 0.12, '#b3b9bc', { height: 0.085 }),
    // Italian Navy.
    'roundel-it': roundel(k.ROUNDELS.italy, 'Italian roundel'),
    'marina-fin': text('MARINA', 1.3, 0.18, WHITE, { height: 0.14 }),
    'it-1-03': (() => {
      const c = new k.Canvas(1.0, 0.42);
      letter(c, WHITE, '1-03', { x: 0.5, y: 0.17, height: 0.15 });
      letter(c, WHITE, 'M.M.7199', { x: 0.5, y: 0.36, height: 0.05 }, 2);
      return c.graphic('1-03 M.M.7199');
    })(),
    'it-03-nose': text('03', 0.7, 0.36, '#d8dadb', { height: 0.11, y: 0.24 }),
    'it-anchor': anchorDisc(new k.Canvas(0.5, 0.5), 0.25, 0.25, 0.22, '#c9cdd0', '#2a2e31').graphic(
      'Anchor badge',
    ),
  };
  // VMA-542's yellow and black sawtooth along the fin leading edge. The canvas spans the fin
  // projector (1.9 x 1.5 m): its x runs aft (left side), y up from y 2.0, z -4.8 + 0.95.
  graphics['tiger-teeth'] = (() => {
    const w = 1.9,
      h = 1.5,
      c = new k.Canvas(w, h),
      zc = -5.75,
      yc = 2.75;
    const u = (z) => zc - z + w / 2,
      v = (y) => y - yc + h / 2;
    const lead = (y) => u(finLeadingZ(y));
    const band = 0.17,
      y0 = 2.02,
      y1 = 3.5;
    // Yellow band from slightly ahead of the edge to `band` aft of it.
    c.add('#f0c21a', [
      [lead(y0) - 0.05, v(y0)],
      [lead(y0) + band, v(y0)],
      [lead(y1) + band, v(y1)],
      [lead(y1) - 0.05, v(y1)],
    ]);
    // Black teeth pointing aft from the leading edge, nine along the edge.
    const n = 9;
    for (let i = 0; i < n; i++) {
      const ya = y0 + ((y1 - y0) * i) / n,
        yb = y0 + ((y1 - y0) * (i + 1)) / n,
        ym = (ya + yb) / 2;
      c.add('#17181a', [
        [lead(ya) - 0.05, v(ya)],
        [lead(ym) + band * 0.95, v(ym)],
        [lead(yb) - 0.05, v(yb)],
      ]);
    }
    return c.graphic('VMA-542 tiger teeth');
  })();
  // VMA-214's fin: the stacked WE code and the scatter of small stars round it.
  graphics['we-stack'] = (() => {
    const c = new k.Canvas(0.4, 0.8);
    c.text(LOWVIS_LIGHT, 'W', { x: 0.2, y: 0.58, height: 0.27 });
    c.text(LOWVIS_LIGHT, 'E', { x: 0.2, y: 0.2, height: 0.27 });
    return c.graphic('WE');
  })();
  graphics['we-stars'] = (() => {
    const c = new k.Canvas(0.8, 0.5);
    // On the fin-code projector (x aft from z -5.8): ahead of the stacked letters
    // (x 0.47-0.73) and along the trailing edge, inside the swept leading edge.
    for (const [x, y, r] of [
      [0.2, 0.42, 0.02],
      [0.15, 0.3, 0.018],
      [0.1, 0.14, 0.02],
      [0.32, 0.46, 0.016],
      [0.33, 0.06, 0.018],
      [0.38, 0.3, 0.02],
      [0.24, 0.2, 0.016],
      [0.77, 0.45, 0.014],
      [0.775, 0.12, 0.014],
    ])
      c.star(LOWVIS_LIGHT, x, y, r);
    return c.graphic('Black Sheep stars');
  })();

  // Markings: `pair` puts a graphic on both sides; `mirror` flips the right side's copy so
  // art tied to the fin's leading edge (forward on both sides) stays on that edge.
  const pair = (anchor, graphic, mirror = false) =>
    SIDES.map(([name]) => ({
      anchor: `${anchor}-${name}`,
      graphic,
      ...(mirror && name === 'right' ? { flip: true } : {}),
    }));
  const usWings = (graphic) => [
    { anchor: 'wing-us-upper-left', graphic },
    { anchor: 'wing-us-lower-right', graphic },
  ];
  const allWings = (graphic) => [...pair('wing-upper', graphic), ...pair('wing-lower', graphic)];

  const references = {
    vma542: {
      title: 'AV-8B of VMA-542 landing on HMS Illustrious, 2007 (US Navy, public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:AV-8B_VMA-542_HMS_Illustrious_2007.jpg',
    },
    vma214: {
      title: 'AV-8B WE-04 of VMA-214 Black Sheep at Miramar (CC BY-SA 2.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Marine_Attack_Squadron_214_(VMA-214)_AV-8B_Harrier_ll_(V-STOL)_BuNo165573_WE-04_Black_Sheep_(15465096665).jpg',
    },
    vma214b: {
      title: 'AV-8B of VMA-214 preparing to launch from USS Peleliu, 2005 (US Navy, public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:US_Navy_051111-N-1467K-004_An_AV-8B_Harrier,_assigned_to_the_Black_Sheep_of_Marine_Attack_Squadron_Two_One_Four_(VMA-214),_prepares_to_launch.jpg',
    },
    vma513: {
      title: 'AV-8B formation of VMA-513 in wraparound camouflage (US DoD, public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:AV-8B_Harrier_formation_VMA-513.JPG',
    },
    es916: {
      title: 'EAV-8B+ VA.1B-26 / 01-916 of the 9a Escuadrilla, tail detail (CC BY-SA 2.0)',
      url: 'https://commons.wikimedia.org/wiki/File:McDonnell_Douglas_EAV-8B%2B_Harrier_II_(VA.1B-26_01-916)._Detalle_de_la_cola_(35062900096).jpg',
    },
    esDeck: {
      title: 'EAV-8B+ Harriers of the 9a Escuadrilla on the deck of L-61 (CC BY-SA 2.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Cuatro_McDonnell_Douglas_EAV-8B%2B_Harrier_II_(VA.1B-26_01-916)_de_la_9%C2%AA_Escuadrilla_en_la_cubierta_de_vuelo_del_L-61_(34292830733).jpg',
    },
    it103: {
      title: 'Marina Militare AV-8B Harrier II+ 1-03 (CC BY-SA 2.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Marina_Militare_AV-8B_Harrier_II%2B.jpg',
    },
  };

  return {
    selected: 'vma-542-wh-02',
    anchors,
    graphics,
    variants: [
      {
        id: 'vma-542-wh-02',
        label: 'USMC VMA-542 Tigers WH-02, 2007',
        provenance: {
          kind: 'inspired',
          note: 'VMA-542 AV-8B+ WH-02 from the referenced 2007 photograph: light ghost gray overall, the yellow-and-black sawtooth along the fin leading edge, black WH code, BuNo 164554 and MARINES on the fin, 02 on the nose and fin tip, MARINES on the upper right wing, VMA-542 on the boom and full-color national insignia on the nozzle fairings and wings (original vector art). The tiger-head badge and stencils are omitted; colors approximate.',
          references: [references.vma542],
        },
        paints: paints({ color: '#a6acb0', radome: '#979da1', gear: '#c4c8ca' }),
        markings: [
          ...pair('fin-lead', 'tiger-teeth', true),
          ...pair('fin-code', 'wh-code'),
          ...pair('fin-title', 'marines-black-fin'),
          ...pair('fin-serial', 'bu-164554'),
          ...pair('fin-top', 'fin-02-black'),
          ...pair('nose', 'nose-02-black'),
          ...pair('boom-fwd', 'vma-542'),
          ...pair('fairing-us', 'us-full'),
          ...usWings('us-full'),
          { anchor: 'wing-title-right', graphic: 'marines-wing' },
        ],
      },
      {
        id: 'vma-214-we-04',
        label: 'USMC VMA-214 Black Sheep WE-04',
        provenance: {
          kind: 'inspired',
          note: 'VMA-214 AV-8B+ WE-04 from the referenced photographs: dark tactical gray overall with light gray low-visibility markings: the stacked WE code among small stars, BuNo 165573 and MARINES on the fin, 04 on the nose and fin tip, VMA-214 BLACKSHEEP on the boom and outline national insignia on the nozzle fairings and wings (original vector art). The squadron badge and stencils are omitted; colors approximate.',
          references: [references.vma214, references.vma214b],
        },
        paints: paints({ color: '#545c64', radome: '#484e54', gear: '#b9bec1' }),
        markings: [
          ...pair('fin-stack', 'we-stack'),
          ...pair('fin-code', 'we-stars', true),
          ...pair('fin-title', 'marines-light-fin'),
          ...pair('fin-serial', 'bu-165573'),
          ...pair('fin-top', 'fin-04-light'),
          ...pair('nose', 'nose-04-light'),
          ...pair('boom-fwd', 'vma-214'),
          ...pair('fairing-us', 'us-lowvis-light'),
          ...usWings('us-lowvis-light'),
        ],
      },
      {
        id: 'vma-513-camouflage',
        label: 'USMC VMA-513 wraparound camouflage, 1980s',
        provenance: {
          kind: 'inspired',
          note: "Early VMA-513 AV-8B from the referenced formation photograph: wraparound dark green and dark gray camouflage on all surfaces (procedural patches standing in for the painted pattern), black low-visibility national insignia on the nozzle fairings and wings, the WF squadron code and MARINES on the fin and a nose number. The code and number are the squadron's period markings and are not legible in the photograph; colors approximate, stencils omitted.",
          references: [references.vma513],
        },
        paints: paints({
          camouflage: ['#4a5341', '#40464a'],
          tile: 6,
          seed: 513,
          radome: '#3c4144',
          gear: '#c4c8ca',
        }),
        markings: [
          ...pair('fin-code', 'wf-code'),
          ...pair('fin-title', 'marines-dark-fin'),
          ...pair('nose', 'nose-13-dark'),
          ...pair('fairing-us', 'us-lowvis-black'),
          ...usWings('us-lowvis-black'),
        ],
      },
      {
        id: 'armada-01-916',
        label: 'Spanish Navy 9a Escuadrilla 01-916',
        provenance: {
          kind: 'inspired',
          note: 'Spanish Navy EAV-8B+ VA.1B-26 / 01-916 of the 9a Escuadrilla from the referenced photographs: medium gray overall, red-yellow-red roundels on the nozzle fairings and both wing surfaces, light gray ARMADA on the fin and nose, 01-916 under it, 16 on the fin and the black VA.1B-26 serial on the boom (original vector art). The naval aviation badge on the fin and stencils are omitted; colors approximate.',
          references: [references.es916, references.esDeck],
        },
        paints: paints({ color: '#7b848a', radome: '#6d757a', gear: '#c4c8ca' }),
        markings: [
          ...pair('fin-title', 'armada-fin'),
          ...pair('fin-serial', 'fin-16-light'),
          ...pair('nose-title', 'armada-nose'),
          ...pair('nose', 'es-01-916'),
          ...pair('boom-fwd', 'es-va1b26'),
          ...pair('fairing-disc', 'roundel-es'),
          ...allWings('roundel-es'),
        ],
      },
      {
        id: 'marina-1-03',
        label: 'Italian Navy GRUPAER 1-03',
        provenance: {
          kind: 'inspired',
          note: 'Marina Militare AV-8B+ M.M.7199 / 1-03 from the referenced photograph: gray overall with a dark rudder and radome, white MARINA on the fin, 1-03 and M.M.7199 on the boom behind a small roundel, 03 on the nose, the anchor badge on the nozzle fairings and roundels on both wing surfaces (original vector art). Squadron nicknames on stores and the stencils are omitted; colors approximate.',
          references: [references.it103],
        },
        paints: paints({ color: '#8a9298', radome: '#50565a', rudder: '#3c4145', gear: '#c4c8ca' }),
        markings: [
          ...pair('fin-title', 'marina-fin'),
          ...pair('boom-disc', 'roundel-it'),
          ...pair('boom-aft', 'it-1-03'),
          ...pair('nose', 'it-03-nose'),
          ...pair('fairing-disc', 'it-anchor'),
          ...allWings('roundel-it'),
        ],
      },
    ],
  };
}
