/**
 * F-35A Lightning II liveries: the USAF and the F-35A's partner and export air forces, each
 * studied from photographs. Every F-35A wears the same radar-absorbent dark gray with slightly
 * different edge treatments; operators differ in their low-visibility national markings,
 * serials, tail codes and squadron tail art, all redrawn as original vector art.
 *
 * Model frame: +Z nose, +X the aircraft's left, +Y up. The fins cant out 19 degrees from a
 * root at x 1.42, y 2.18; fixed-fin leading edge z -2.40 at the root to -4.38 at the 2.33 m
 * tip, rudder hinge z -4.23 to -5.37. The forward fuselage side below the canopy is at
 * x 0.92 (z 4.8 to 5.4); the intake lip is at z 4.6.
 */
import { cantedFin, leanLivery, sector, textGraphic } from '../art-fighters-b.mjs';

// Paint slots: the existing ones without the duplicate fin-code slots, plus the edge
// treatment (leading edges, control-surface edges, rudders) as one slot.
export function slots(existing) {
  const out = Object.fromEntries(
    Object.entries(existing).filter(([name]) => !name.startsWith('fin-code')),
  );
  out.edges = { materials: ['F35-edge'] };
  return out;
}

const WHITE = '#f1f2ef',
  SKIN = '#5f6467', // F-35 radar-absorbent coating, a slightly warm dark gray
  EDGE = '#676c6f', // edge treatment, a shade lighter
  MARK = '#a9afb1', // low-visibility light gray markings
  DARK = '#3d4246';

const FIN = { root: [1.42, 2.18, -2.45], cant: (19 * Math.PI) / 180, span: 2.33 };
const leadingZ = (s) => -2.4 - 0.85 * s;
const hingeZ = (s) => -4.23 - 0.49 * s;
const AIRFRAME = 'body-F35-airframe-F35-gray';

export default function design({ kit: k, space, slots: all, bounds }) {
  const fin = cantedFin(FIN.root, FIN.cant);
  const finSlot = (side) => `body-F35-fin-${side}-F35-gray`;
  const anchors = {};
  const finAnchor = (name, side, s, z, w, h, slot = finSlot(side)) => {
    anchors[`${name}-${side}`] = space.anchor(slot, {
      center: fin.point(side, s, z),
      facing: fin.facing(side),
      up: fin.up(side),
      width: w,
      height: h,
      depth: 0.4,
    });
  };
  const at = (s, f) => leadingZ(s) + (hingeZ(s) - leadingZ(s)) * f;
  for (const side of [1, -1]) {
    // USAF and test-unit block: badge, code, serial on a line through 55 % chord.
    finAnchor('fin-badge', side, 1.75, at(1.75, 0.55), 0.3, 0.3);
    finAnchor('fin-code', side, 1.12, at(1.12, 0.52), 0.9, 0.42);
    finAnchor('fin-serial', side, 0.52, at(0.52, 0.5), 1.0, 0.28);
    // USAF block as photographed on LF: wing badge high and forward, code mid, serial low aft.
    finAnchor('fin-badge-fwd', side, 1.9, at(1.9, 0.3), 0.3, 0.34);
    finAnchor('fin-serial-aft', side, 0.32, at(0.32, 0.66), 0.9, 0.24);
    // Low number (RNoAF 5288 mid-chord, IAF 905 aft).
    finAnchor('fin-number-mid', side, 0.42, at(0.42, 0.55), 0.8, 0.26);
    finAnchor('fin-number-aft', side, 0.36, at(0.36, 0.74), 0.6, 0.24);
    finAnchor('fin-emblem', side, 1.25, at(1.25, 0.5), 0.6, 0.3);
    // Whole fixed fin, fin-local: x aft from the root leading edge (0 to 2.9 m), y up the
    // span (0 to 2.33 m). Art drawn with the leading edge on the left; mirrored on the right.
    finAnchor('fin-panel', side, FIN.span / 2, -2.4 - 1.45, 2.9, FIN.span);
    // Forward fuselage side below the canopy: national marking.
    anchors[`nose-mark-${side}`] = space.anchor(AIRFRAME, {
      center: [side * 0.92, 1.82, 5.12],
      facing: [side, 0, 0],
      width: 0.9,
      height: 0.5,
      depth: 0.5,
    });
    // Intake trunk side ahead of the wing: USAF squadron badge.
    anchors[`intake-badge-${side}`] = space.anchor(AIRFRAME, {
      center: [side * 1.69, 1.76, 2.0],
      facing: [side, 0, 0],
      width: 0.36,
      height: 0.36,
      depth: 0.4,
    });
    // Nose numbers: IAF under the windscreen, JASDF low on the nose.
    anchors[`nose-number-${side}`] = space.anchor(AIRFRAME, {
      center: [side * 0.64, 2.2, 6.1],
      facing: [side, -0.15, 0],
      width: 0.5,
      height: 0.18,
      depth: 0.4,
    });
    anchors[`nose-low-number-${side}`] = space.anchor(AIRFRAME, {
      center: [side * 0.58, 1.62, 6.55],
      facing: [side, 0, 0],
      width: 0.36,
      height: 0.14,
      depth: 0.4,
    });
    // Aft fuselage side below the fin's leading edge: serial (RAAF style). It stays ahead of
    // z -3.1, where the side turns in under the fin-root shelf.
    anchors[`aft-serial-${side}`] = space.anchor(AIRFRAME, {
      center: [side * 1.42, 1.74, -2.5],
      facing: [side, 0, 0],
      width: 1.2,
      height: 0.2,
      depth: 0.55,
    });
  }
  // Wings: upper left, lower right (USAF); upper and lower both wings for others.
  for (const side of [1, -1])
    for (const [face, y] of [
      ['upper', 2.04],
      ['lower', 1.98],
    ])
      anchors[`wing-${face}-${side}`] = space.anchor(AIRFRAME, {
        center: [side * 4.0, y, -1.55],
        facing: [0, face === 'upper' ? 1 : -1, 0],
        up: [0, 0, 1],
        width: 1.0,
        height: 1.0,
        depth: 0.3,
      });

  const text = (label, w, h, color, opts) => textGraphic(k, label, w, h, color, opts);
  const graphics = {};
  /** Point on the fin panel canvas for span s and station z (aft distance from root LE). */
  const panel = (s, z) => [-2.4 - z, s];

  /**
   * Fin art drawn in fin-local coordinates (x aft from the root leading edge, y up the span)
   * on a mirrored-or-not canvas: on the right fin the leading edge is on the reader's right,
   * so shapes are mirrored there while lettering stays readable.
   */
  class FinCanvas extends k.Canvas {
    constructor(right) {
      super(2.9, FIN.span);
      this.right = right;
    }
    add(color, points, holes = []) {
      const m = (ring) => (this.right ? ring.map(([x, y]) => [2.9 - x, y]) : ring);
      return super.add(color, m(points), holes.map(m));
    }
    text(color, label, opts) {
      // Lettering: mirror only its anchor; draw on the base canvas so glyphs read normally.
      const x = this.right ? 2.9 - opts.x : opts.x;
      const right = this.right;
      this.right = false;
      super.text(color, label, { ...opts, x });
      this.right = right;
      return this;
    }
  }
  // RAAF: light gray double chevron from the tip down to a badge at the aft root, the
  // number high on the fin, the flag at the tip's leading corner.
  const raafTail = (right) => {
    const c = new FinCanvas(right);
    const tipLE = panel(2.33, leadingZ(2.33)),
      badge = panel(0.3, at(0.3, 0.78));
    // Two converging stripes (outer and inner), each a thin quadrilateral.
    for (const [x0, w] of [
      [0.55, 0.05],
      [0.78, 0.045],
    ]) {
      const top = [tipLE[0] + x0, 2.1 - (x0 - 0.55) * 0.5];
      c.add(MARK, [
        [top[0], top[1]],
        [top[0] + w, top[1]],
        [badge[0] - 0.05 + w * 3, badge[1] + 0.02],
        [badge[0] - 0.05, badge[1] + 0.02],
      ]);
    }
    // The lower arm of the chevron, running forward and down to the root.
    c.add(MARK, [
      [badge[0] - 0.02, badge[1] - 0.04],
      [badge[0] - 0.02, badge[1] + 0.02],
      [badge[0] - 1.0, badge[1] - 0.2],
      [badge[0] - 0.92, badge[1] - 0.22],
    ]);
    // Squadron badge: a disc with a shield silhouette.
    c.circle(MARK, badge[0], badge[1], 0.14, 32);
    c.circle(SKIN, badge[0], badge[1], 0.115, 32);
    c.add(MARK, [
      [badge[0] - 0.06, badge[1] + 0.07],
      [badge[0] + 0.06, badge[1] + 0.07],
      [badge[0] + 0.06, badge[1] - 0.01],
      [badge[0], badge[1] - 0.08],
      [badge[0] - 0.06, badge[1] - 0.01],
    ]);
    // Number high on the fin.
    const n = panel(2.05, at(2.05, 0.3));
    c.text(MARK, '32', { x: n[0], y: n[1], height: 0.14 });
    // Low-visibility Australian flag at the tip: dark field, light stars and union.
    const f = [tipLE[0] + 0.08, 2.14];
    c.rect(DARK, f[0], f[1], 0.36, 0.17);
    c.rect(MARK, f[0] + 0.02, f[1] + 0.105, 0.14, 0.012);
    c.rect(MARK, f[0] + 0.084, f[1] + 0.07, 0.012, 0.085);
    for (const [sx, sy] of [
      [0.27, 0.13],
      [0.31, 0.08],
      [0.24, 0.06],
      [0.27, 0.025],
      [0.09, 0.03],
    ])
      c.star(MARK, f[0] + sx, f[1] + sy, 0.018);
    return c.graphic('RAAF fin: number 32, chevrons, squadron badge, low-visibility flag');
  };
  graphics['raaf-tail-left'] = raafTail(false);
  graphics['raaf-tail-right'] = raafTail(true);

  // National marks (low visibility, light gray on the dark skin).
  graphics['raaf-roundel'] = (() => {
    const c = new k.Canvas(0.9, 0.5);
    c.ring(MARK, 0.45, 0.25, 0.185, 0.235, 48);
    // Bounding kangaroo, original outline, facing forward (left on the left side).
    const kx = 0.45,
      ky = 0.25,
      s = 0.16;
    c.add(
      MARK,
      [
        [0.62, -0.1],
        [0.3, -0.18],
        [0.12, -0.42],
        [-0.08, -0.46],
        [0.02, -0.3],
        [-0.12, -0.2],
        [-0.28, -0.05],
        [-0.34, 0.12],
        [-0.42, 0.18],
        [-0.5, 0.3],
        [-0.4, 0.36],
        [-0.36, 0.46],
        [-0.3, 0.36],
        [-0.2, 0.34],
        [-0.12, 0.2],
        [0.08, 0.16],
        [0.26, 0.02],
        [0.42, -0.02],
      ].map(([x, y]) => [kx + x * s, ky + y * s]),
    );
    return c.graphic('RAAF roundel (low visibility)');
  })();
  graphics['rnoaf-roundel'] = (() => {
    const c = new k.Canvas(0.9, 0.5);
    c.ring(MARK, 0.45, 0.25, 0.17, 0.225, 48);
    // The photographed arrowhead: a triangle pointing aft, split by a thin slanted gap.
    c.add(MARK, [
      [0.36, 0.38],
      [0.56, 0.255],
      [0.38, 0.27],
    ]);
    c.add(MARK, [
      [0.375, 0.245],
      [0.56, 0.235],
      [0.36, 0.13],
    ]);
    return c.graphic('Norwegian roundel (F-35 low visibility)');
  })();
  graphics['rnlaf-roundel'] = (() => {
    const c = new k.Canvas(0.9, 0.5);
    const r = 0.22;
    sector(c, '#a8b8c2', 0.45, 0.25, r, Math.PI / 2 - 0.15, (7 * Math.PI) / 6 - 0.15);
    sector(c, '#97a8b3', 0.45, 0.25, r, (7 * Math.PI) / 6 - 0.15, (11 * Math.PI) / 6 - 0.15);
    sector(c, '#b6c4cc', 0.45, 0.25, r, -Math.PI / 6 - 0.15, Math.PI / 2 - 0.15);
    c.circle('#5d676d', 0.45, 0.25, 0.035, 24);
    return c.graphic('Dutch roundel (F-35 low visibility)');
  })();
  graphics['us-insignia'] = k
    .usInsignia(new k.Canvas(0.9, 0.5), 0.45, 0.25, 0.2, {
      style: 'lowvis',
      color: MARK,
      stroke: 0.02,
    })
    .graphic('US national insignia (low visibility)');
  graphics['us-insignia-wing'] = k
    .usInsignia(new k.Canvas(1.0, 1.0), 0.5, 0.5, 0.23, {
      style: 'lowvis',
      color: MARK,
      stroke: 0.022,
    })
    .graphic('US national insignia (low visibility)');
  const wingMark = (id, source) => {
    // The nose mark's 0.5 m tall centre square, enlarged to fill the 1.0 m wing projector
    // (wing roundels are about 0.9 m across).
    const map = ([x, y]) => [(0.9 * x - 0.45) * 1.8 + 0.5, (0.5 * y - 0.25) * 1.8 + 0.5];
    graphics[id] = {
      label: source.label,
      shapes: source.shapes
        .map((sh) => ({
          ...sh,
          points: sh.points.map(map),
          ...(sh.holes ? { holes: sh.holes.map((h) => h.map(map)) } : {}),
        }))
        .filter((sh) => sh.points.every(([x]) => x >= 0 && x <= 1)),
    };
  };
  wingMark('raaf-roundel-wing', graphics['raaf-roundel']);
  wingMark('rnoaf-roundel-wing', graphics['rnoaf-roundel']);
  wingMark('rnlaf-roundel-wing', graphics['rnlaf-roundel']);

  const paints = () => ({
    ...Object.fromEntries(
      Object.keys(all)
        .filter((name) => name.startsWith('body-'))
        .map((name) => [name, { color: SKIN }]),
    ),
    edges: { color: EDGE },
  });
  const both = (anchor, graphic, flipRight = false) => [
    { anchor: `${anchor}-1`, graphic },
    { anchor: `${anchor}--1`, graphic, ...(flipRight ? { flip: true } : {}) },
  ];
  const allWings = (graphic) => ['upper', 'lower'].flatMap((face) => both(`wing-${face}`, graphic));
  const usWings = [
    { anchor: 'wing-upper-1', graphic: 'us-insignia-wing' },
    { anchor: 'wing-lower--1', graphic: 'us-insignia-wing' },
  ];

  graphics['code-OT'] = text('OT', 0.9, 0.42, MARK, { fill: 0.86 });
  graphics['serial-F-001'] = text('F-001', 1.0, 0.28, MARK, { fill: 0.8 });
  graphics['raaf-serial'] = text('A35-032', 1.2, 0.2, MARK, { fill: 0.8 });
  graphics['rnlaf-badge'] = (() => {
    const c = new k.Canvas(0.3, 0.3);
    // Crown over a shield, simplified.
    c.add(MARK, [
      [0.08, 0.2],
      [0.22, 0.2],
      [0.22, 0.11],
      [0.15, 0.03],
      [0.08, 0.11],
    ]);
    c.add(MARK, [
      [0.07, 0.22],
      [0.23, 0.22],
      [0.25, 0.29],
      [0.2, 0.25],
      [0.15, 0.29],
      [0.1, 0.25],
      [0.05, 0.29],
    ]);
    return c.graphic('RNLAF badge (simplified)');
  })();

  /** A stroked polyline (boxes with round joints) for line art. */
  const stroke = (c, color, pts, width) => {
    for (let i = 0; i + 1 < pts.length; i++) {
      const [a, b] = [pts[i], pts[i + 1]];
      c.box(
        color,
        (a[0] + b[0]) / 2,
        (a[1] + b[1]) / 2,
        Math.hypot(b[0] - a[0], b[1] - a[1]),
        width,
        Math.atan2(b[1] - a[1], b[0] - a[0]),
      );
    }
    for (const [x, y] of pts) c.circle(color, x, y, width / 2, 10);
  };
  /** Fin art pair (left, right) registered under id-left / id-right. */
  const finPair = (id, draw) => {
    for (const [suffix, right] of [
      ['left', false],
      ['right', true],
    ]) {
      const c = new FinCanvas(right);
      draw(c);
      graphics[`${id}-${suffix}`] = c.graphic(`${id} (${suffix})`);
    }
    return [
      { anchor: 'fin-panel-1', graphic: `${id}-left` },
      { anchor: 'fin-panel--1', graphic: `${id}-right` },
    ];
  };

  // USAF 56th Fighter Wing, Luke: LF, AF 12 5052, wing badge, squadron badge on the intake.
  graphics['code-LF'] = text('LF', 0.9, 0.42, MARK, { fill: 0.86 });
  graphics['serial-12-5052'] = (() => {
    const c = new k.Canvas(0.9, 0.24);
    c.text(MARK, 'AF', { x: 0.2, y: 0.17, height: 0.065, align: 'right' });
    c.text(MARK, '12', { x: 0.2, y: 0.07, height: 0.065, align: 'right' });
    c.text(MARK, '5052', { x: 0.24, y: 0.12, height: 0.18, align: 'left' });
    return c.graphic('AF 12 5052');
  })();
  graphics['badge-56fw'] = (() => {
    const c = new k.Canvas(0.3, 0.34);
    const shield = (i) => [
      [0.03 + i, 0.32 - i],
      [0.27 - i, 0.32 - i],
      [0.27 - i, 0.14],
      [0.15, 0.02 + i * 1.3],
      [0.03 + i, 0.14],
    ];
    c.add(MARK, shield(0), [[...shield(0.02)].reverse()]);
    c.star(MARK, 0.15, 0.19, 0.07);
    return c.graphic('56th Fighter Wing badge (simplified)');
  })();
  graphics['badge-sqn-disc'] = (() => {
    const c = new k.Canvas(0.36, 0.36);
    c.ring(MARK, 0.18, 0.18, 0.15, 0.175, 40);
    c.add(MARK, [
      [0.1, 0.2],
      [0.18, 0.28],
      [0.26, 0.2],
      [0.22, 0.2],
      [0.18, 0.12],
      [0.14, 0.2],
    ]);
    return c.graphic('Squadron badge (simplified)');
  })();

  // JASDF 302 Squadron: low-visibility hinomaru, the stylized white-tailed eagle, 710.
  graphics['hinomaru-lowvis'] = (() => {
    const c = new k.Canvas(0.9, 0.5);
    c.circle('#8d969b', 0.45, 0.25, 0.2, 48);
    c.ring('#a9b0b3', 0.45, 0.25, 0.19, 0.205, 48);
    return c.graphic('Hinomaru (low visibility)');
  })();
  wingMark('hinomaru-lowvis-wing', graphics['hinomaru-lowvis']);
  const eagle302 = finPair('jasdf-302-tail', (c) => {
    const [ex, ey] = panel(1.1, at(1.1, 0.52));
    // Angular eagle flying toward the leading edge (canvas left): three swept feather bands
    // rising aft from the body, a long body with a hooked head forward, a short tail aft.
    const s = 0.62;
    const P = (x, y) => [ex + x * s, ey + y * s];
    for (const [i, x0] of [
      [0, -0.28],
      [1, -0.08],
      [2, 0.12],
    ])
      c.add(MARK, [
        P(x0, 0.06),
        P(x0 + 0.16, 0.06),
        P(0.85 + i * 0.05, 0.55 - i * 0.12),
        P(0.62 + i * 0.05, 0.55 - i * 0.12),
      ]);
    c.add(MARK, [
      P(-0.62, 0.02),
      P(-0.45, 0.1),
      P(0.35, 0.02),
      P(0.62, -0.14),
      P(0.38, -0.12),
      P(-0.3, -0.12),
      P(-0.5, -0.08),
    ]);
    // Head and hooked beak.
    c.add(MARK, [
      P(-0.62, 0.02),
      P(-0.78, 0.04),
      P(-0.88, -0.02),
      P(-0.84, -0.1),
      P(-0.78, -0.05),
      P(-0.7, -0.08),
      P(-0.5, -0.08),
    ]);
  });
  graphics['number-710'] = text('710', 0.36, 0.14, MARK, { fill: 0.8 });

  // Israeli Air Force 140 Squadron (Golden Eagle): full-color national marking, the eagle-head
  // line art on the fins, 905 on nose and fins.
  graphics['israel-mark'] = (() => {
    const c = new k.Canvas(0.9, 0.5);
    k.israelMark(c, 0.45, 0.25, 0.2);
    return c.graphic('Israeli Air Force marking');
  })();
  wingMark('israel-mark-wing', graphics['israel-mark']);
  const eagle140 = finPair('iaf-140-tail', (c) => {
    const [hx, hy] = panel(1.2, at(1.2, 0.45));
    const s = 0.62;
    const P = (x, y) => [hx + x * s, hy + y * s];
    // Head outline facing the leading edge (canvas left): crown, hooked beak, gape, throat
    // and the neck sweeping aft; a brow line and the eye.
    stroke(
      c,
      WHITE,
      [
        P(1.05, 0.5),
        P(0.5, 0.62),
        P(0.0, 0.55),
        P(-0.35, 0.35),
        P(-0.55, 0.1),
        P(-0.62, -0.14),
        P(-0.48, -0.06),
        P(-0.4, 0.02),
        P(-0.2, -0.02),
        P(-0.05, -0.18),
        P(0.05, -0.45),
        P(0.25, -0.6),
        P(0.65, -0.66),
      ],
      0.034,
    );
    stroke(c, WHITE, [P(-0.32, 0.38), P(0.05, 0.43)], 0.026);
    c.circle(WHITE, ...P(-0.14, 0.28), 0.03, 12);
  });
  graphics['number-905'] = text('905', 0.6, 0.24, WHITE, { fill: 0.84 });

  // RNoAF 5288: the arrowhead emblem and the serial on the fins.
  graphics['rnoaf-fin-emblem'] = (() => {
    const c = new k.Canvas(0.6, 0.3);
    // Three stripes narrowing to a point at the right (aft once mirrored per side).
    for (const [y0, h] of [
      [0.2, 0.06],
      [0.12, 0.06],
      [0.04, 0.06],
    ])
      c.add(MARK, [
        [0.02, y0 + h],
        [0.58, 0.18],
        [0.02, y0],
      ]);
    return c.graphic('RNoAF fin emblem (simplified)');
  })();
  graphics['number-5288'] = text('5288', 0.8, 0.26, MARK, { fill: 0.84 });

  const references = {
    raaf: {
      title: 'RAAF F-35A A35-032 at the 2025 Australian International Airshow (CC BY-SA 3.0 AU)',
      url: 'https://commons.wikimedia.org/wiki/File:Royal_Australian_Air_Force_(A35-032)_Lockheed_Martin_F-35A_Lightning_II_on_display_at_the_2025_Australian_International_Airshow.jpg',
    },
    rnoaf: {
      title: 'Royal Norwegian Air Force F-35A 5208, forward fuselage (CC BY 2.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Lockheed_Martin_F-35A_Lightning_II_Royal_Norwegian_Air_Force_5208_5D4_2380_(53921025875).jpg',
    },
    rnlaf: {
      title: 'Royal Netherlands Air Force F-35A F-001 OT (CC BY-SA 2.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Royal_Netherlands_Air_Force_Lockheed_Martin_F-35A_Lightning_II_(F-001_-_OT)_(31080065885).jpg',
    },
    luke: {
      title: "F-35A 12-5052 'LF' of the 56th Fighter Wing with F-22A 09-191 (CC BY-SA 2.0)",
      url: 'https://commons.wikimedia.org/wiki/File:Raptor_%26_Lightning_(F-22A_09-191_-_FF_%26_F-35A_12-5052_-_LF)_(28201197585)_(2).jpg',
    },
    hill: {
      title: 'F-35A at Hill Air Force Base, wing insignia (USAF, public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:F-35A_Lightning_II_at_Hill_Air_Force_Base,_Utah.jpg',
    },
    rnoafTail: {
      title: 'Norwegian F-35A 5288 at Ramstein Air Base, 2024 (USAF, public domain)',
      url: 'https://commons.wikimedia.org/wiki/File:Norwegian_Lockheed-Martin_F-35A_Lightning_II_at_Ramstein_Air_Base,_Germany,_6_June_2024_(240606-F-TC518-2308).JPG',
    },
    jasdf: {
      title: 'JASDF F-35A 710 of 302 Squadron at Misawa (CC BY-SA 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:Japan_air_self_defense_force_Lockheed_Martin_F-35A_302SQ_RJSM.jpg',
    },
    adir: {
      title: 'Israeli Air Force F-35I Adir 905 (CC BY-SA 4.0)',
      url: 'https://commons.wikimedia.org/wiki/File:F-35I-Adir-0296.jpg',
    },
  };
  const common =
    'radar-absorbent dark gray with the lighter edge treatment on leading edges, control-surface edges and rudders';

  const built = {
    selected: 'raaf-a35-032',
    anchors,
    graphics,
    variants: [
      {
        id: 'raaf-a35-032',
        label: 'Royal Australian Air Force, A35-032',
        provenance: {
          kind: 'inspired',
          note: `RAAF F-35A A35-032 from the referenced 2025 photograph: ${common}; the low-visibility kangaroo roundel on the forward fuselage and both wings, A35-032 on the aft fuselage, and on the fins the number 32, the light gray double chevron ending in the squadron badge (simplified to a disc and shield) and the low-visibility flag at the tip. Stencils and the formation-light strip are omitted.`,
          references: [references.raaf],
        },
        paints: paints(),
        markings: [
          { anchor: 'fin-panel-1', graphic: 'raaf-tail-left' },
          { anchor: 'fin-panel--1', graphic: 'raaf-tail-right' },
          ...both('nose-mark', 'raaf-roundel', true),
          ...both('aft-serial', 'raaf-serial'),
          ...allWings('raaf-roundel-wing'),
        ],
      },
      {
        id: 'rnlaf-f-001-ot',
        label: 'Royal Netherlands Air Force, F-001 (OT)',
        provenance: {
          kind: 'inspired',
          note: `RNLAF F-35A F-001 during operational test with the OT code, from the referenced photograph: ${common}; the low-visibility Dutch roundel (three-tone disc with a dark centre, as photographed) on the forward fuselage and wings, OT over F-001 in light gray on the fins with the RNLAF badge above (simplified crown and shield).`,
          references: [references.rnlaf],
        },
        paints: paints(),
        markings: [
          ...both('fin-code', 'code-OT'),
          ...both('fin-serial', 'serial-F-001'),
          ...both('fin-badge', 'rnlaf-badge'),
          ...both('nose-mark', 'rnlaf-roundel'),
          ...allWings('rnlaf-roundel-wing'),
        ],
      },
      {
        id: 'usaf-56fw-luke-lf',
        label: 'USAF 56th Fighter Wing, Luke (LF)',
        provenance: {
          kind: 'inspired',
          note: `F-35A 12-5052 of the 56th Fighter Wing, Luke, from the referenced photograph: ${common}; on the fins LF in low-visibility light gray with the wing badge high and forward (simplified shield and star) and AF 12 5052 low and aft; the squadron badge disc on the intake trunk (simplified); low-visibility national insignia upper left and lower right wing (none on the fuselage).`,
          references: [references.luke, references.hill],
        },
        paints: paints(),
        markings: [
          ...both('fin-code', 'code-LF'),
          ...both('fin-badge-fwd', 'badge-56fw'),
          ...both('fin-serial-aft', 'serial-12-5052'),
          ...both('intake-badge', 'badge-sqn-disc'),
          ...usWings,
        ],
      },
      {
        id: 'rnoaf-5288',
        label: 'Royal Norwegian Air Force, 5288',
        provenance: {
          kind: 'inspired',
          note: `RNoAF F-35A 5288 from the referenced photographs: ${common}; the Norwegian F-35 low-visibility roundel (light gray ring with the split arrowhead, pointing aft on both sides as photographed) on the forward fuselage and wings, and on the fins the arrowhead emblem (simplified to three converging stripes) above the serial 5288.`,
          references: [references.rnoafTail, references.rnoaf],
        },
        paints: paints(),
        markings: [
          ...both('nose-mark', 'rnoaf-roundel', true),
          ...both('fin-emblem', 'rnoaf-fin-emblem', true),
          ...both('fin-number-mid', 'number-5288'),
          ...allWings('rnoaf-roundel-wing'),
        ],
      },
      {
        id: 'jasdf-302-squadron-710',
        label: 'JASDF 302 Squadron, Misawa (710)',
        provenance: {
          kind: 'inspired',
          note: `JASDF F-35A 710 of 302 Squadron from the referenced photograph: ${common}; the low-visibility hinomaru (gray disc) on the forward fuselage and wings, the squadron's white-tailed eagle on the fins in light gray (original angular drawing, flying forward on both sides) and 710 on the nose.`,
          references: [references.jasdf],
        },
        paints: paints(),
        markings: [
          ...eagle302,
          ...both('nose-mark', 'hinomaru-lowvis'),
          ...both('nose-low-number', 'number-710'),
          ...allWings('hinomaru-lowvis-wing'),
        ],
      },
      {
        id: 'iaf-140-squadron-905',
        label: 'Israeli Air Force, 140 Squadron (905)',
        provenance: {
          kind: 'inspired',
          note: `F-35I Adir 905 of 140 Squadron from the referenced photograph, applied to the F-35A model: ${common}; the full-color Israeli marking (blue Star of David on a white disc) on the forward fuselage and wings, 905 in white under the windscreen and on the fins, and the squadron's golden-eagle head as white line art on the fins (original drawing). The F-35I's small differences in shape are not modelled.`,
          references: [references.adir],
        },
        paints: paints(),
        markings: [
          ...eagle140,
          ...both('fin-number-aft', 'number-905'),
          ...both('nose-number', 'number-905'),
          ...both('nose-mark', 'israel-mark'),
          ...allWings('israel-mark-wing'),
        ],
      },
    ],
  };
  return leanLivery(built, bounds);
}
