/** Human geometry on the canonical skeleton, with continuous skinned shoulder surfaces. */
import { dmath, quatRotateVec3, type Vec3 } from '@bendyline/molen-kernel/determinism';
import { jointIndex, jointPosition } from './body';
import { buildHumanHand, buildHumanShoe } from './body-human-extremities';
import { buildHumanHead, tint } from './body-human-head';
import { parseColor, type RGB } from './color';
import { forearmRoll, REST_FOREARM_ROLL } from './hand-rest';
import { type FigureRig, mirrorName, rigBindModel } from './rig';
import {
  blend,
  type FigureRegion,
  type FigureTier,
  type RingRef,
  type Skin,
  type SkinnedMeshBuilder,
  skin,
} from './skinned-mesh-builder';
import type { ResolvedFigureDescriptor } from './types';

const UP: Vec3 = [0, 1, 0];
const DOWN: Vec3 = [0, -1, 0];
const mix = (a: Vec3, b: Vec3, t: number): Vec3 => [
  dmath.lerp(a[0], b[0], t),
  dmath.lerp(a[1], b[1], t),
  dmath.lerp(a[2], b[2], t),
];
const direction = (a: Vec3, b: Vec3): Vec3 => {
  const l = dmath.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  return [(b[0] - a[0]) / l, (b[1] - a[1]) / l, (b[2] - a[2]) / l];
};

export function buildBipedBody(
  d: ResolvedFigureDescriptor,
  rig: FigureRig,
  tier: FigureTier,
  b: SkinnedMeshBuilder,
): void {
  const m = rig.metrics;
  const H = d.height;
  const near = tier === 0;
  const sides = near ? 20 : tier === 1 ? 12 : 8;
  const limbSides = near ? 12 : 8;
  const bind = rigBindModel(rig);
  const J = (name: string): number => jointIndex(rig, name);
  const P = (name: string): Vec3 => jointPosition(bind, J(name));
  const c = {
    skin: parseColor(d.palette.skin),
    top: parseColor(d.palette.top),
    bottom: parseColor(d.palette.bottom),
    shoes: parseColor(d.palette.shoes),
    accent: parseColor(d.palette.accent),
  };
  const hips = P('hips'),
    spine = P('spine'),
    chest = P('chest'),
    neck = P('neck'),
    head = P('head');
  const pelvis = m.hipHalf + m.limbRadius * 1.1;
  const neckR = m.headWidth * 0.24;
  const waistSkin = blend(J('hips'), 0.4, J('spine'), 0.6);
  const chestSkin = skin(J('chest'));
  const torsoRing = (
    region: FigureRegion,
    y: number,
    rx: number,
    rz: number,
    s: Skin,
    color: RGB,
  ): RingRef => b.ring(region, [0, y, 0], UP, rx, rz, sides, s, color);
  const belt = torsoRing(
    'accent',
    spine[1] + H * 0.008,
    pelvis * 0.915,
    m.torsoRadius * 0.815,
    waistSkin,
    tint(c.shoes, 0.7),
  );
  const beltTop = torsoRing(
    'accent',
    spine[1] + H * 0.019,
    pelvis * 0.915,
    m.torsoRadius * 0.815,
    waistSkin,
    tint(c.shoes, 0.7),
  );
  b.loft('accent', belt, beltTop);
  if (tier < 2)
    b.box(
      'accent',
      [-H * 0.013, spine[1] + H * 0.009, m.torsoRadius * 0.81],
      [H * 0.013, spine[1] + H * 0.018, m.torsoRadius * 0.84],
      waistSkin,
      c.accent,
    );

  // Chest volume, waist and sloping shoulders replace the straight cylinder torso.
  const torso: readonly [number, number, number, Skin][] = [
    [spine[1] + H * 0.017, pelvis * 0.92, m.torsoRadius * 0.84, waistSkin],
    [
      spine[1] + m.spineLen * 0.4,
      pelvis * 0.89,
      m.torsoRadius * 0.86,
      blend(J('spine'), 0.8, J('chest'), 0.2),
    ],
    [
      chest[1],
      m.shoulderHalf * 0.94,
      m.torsoRadius * 0.94,
      blend(J('spine'), 0.35, J('chest'), 0.65),
    ],
    [chest[1] + m.chestLen * 0.65, m.shoulderHalf * 1.04, m.torsoRadius * 0.91, chestSkin],
    [neck[1] - H * 0.018, m.shoulderHalf * 1.08, m.torsoRadius * 0.72, chestSkin],
    [neck[1] + H * 0.018, neckR * 1.2, neckR * 1.1, chestSkin],
  ];
  let last: RingRef | undefined;
  const torsoRings: RingRef[] = [];
  const shoulderWidth = near ? 2 : 1;
  const torsoPoint = (row: number, col: number): Vec3 => {
    const [y, rx, rz] = torso[row] as (typeof torso)[number];
    let k = col;
    const zSign = k <= sides / 2 ? 1 : -1;
    if (k > sides / 2) k = sides - k;
    const xSign = k <= sides / 4 ? -1 : 1;
    if (k > sides / 4) k = sides / 2 - k;
    const angle = (dmath.TAU * k) / sides;
    const c0 = dmath.cos(angle);
    // Lower the axilla while leaving the front of the chest and its pockets level.
    const underarm = row === 3 ? H * 0.035 * dmath.pow(c0, 8) : 0;
    return [xSign * rx * c0, y - underarm, zSign * rz * dmath.sin(angle)];
  };
  for (const [row, [y, , , s]] of torso.entries()) {
    const start = b.mark();
    for (let i = 0; i < sides; i++) b.vertex(torsoPoint(row, i), c.top, s);
    const ring = { start, sides, center: [0, y, 0] as Vec3 };
    if (last) {
      for (let i = 0; i < sides; i++) {
        const armhole =
          row >= 4 &&
          (i < shoulderWidth ||
            i >= sides - shoulderWidth ||
            (i >= sides / 2 - shoulderWidth && i < sides / 2 + shoulderWidth));
        if (armhole) continue;
        const next = (i + 1) % sides;
        b.quad('top', last.start + i, last.start + next, ring.start + next, ring.start + i);
      }
    }
    torsoRings.push(ring);
    last = ring;
  }
  // The armholes are actual boundaries in the torso. Sleeves share these vertices
  // and their normals, so no overlapping cap can form a shoulder-pad seam.
  const boundary: [number, number][] = [];
  const middle = sides / 2;
  for (let i = middle; i >= middle - shoulderWidth; i--) boundary.push([5, i]);
  for (let row = 4; row >= 3; row--) boundary.push([row, middle - shoulderWidth]);
  for (let i = middle - shoulderWidth + 1; i <= middle + shoulderWidth; i++) boundary.push([3, i]);
  for (let row = 4; row <= 5; row++) boundary.push([row, middle + shoulderWidth]);
  for (let i = middle + shoulderWidth - 1; i > middle; i--) boundary.push([5, i]);
  const shoulderLeft = boundary.map(([row, col]) => (torsoRings[row] as RingRef).start + col);
  const shoulderRight = boundary.map(
    ([row, col]) => (torsoRings[row] as RingRef).start + ((sides / 2 - col + sides) % sides),
  );
  const shoulderPoints: Vec3[] = boundary.map(([row, col]) => torsoPoint(row, col));
  const collar0 = torsoRing(
    'top',
    neck[1] + H * 0.015,
    neckR * 1.23,
    neckR * 1.13,
    chestSkin,
    tint(c.top, 0.72),
  );
  const collar1 = torsoRing(
    'top',
    neck[1] + H * 0.023,
    neckR * 1.12,
    neckR * 1.03,
    blend(J('chest'), 0.8, J('neck'), 0.2),
    tint(c.top, 0.72),
  );
  b.loft('top', collar0, collar1);
  if (tier < 2) {
    // Subdivide the collar over the curved shoulders so its center cannot clip through.
    const shirtFront = (x: number, y: number): number => {
      for (let i = 1; i < torso.length; i++) {
        const low = torso[i - 1] as (typeof torso)[number];
        const high = torso[i] as (typeof torso)[number];
        if (y > high[0] && i < torso.length - 1) continue;
        const t = dmath.clamp((y - low[0]) / (high[0] - low[0]), 0, 1);
        const rx = dmath.lerp(low[1], high[1], t);
        const rz = dmath.lerp(low[2], high[2], t);
        return rz * dmath.sqrt(dmath.max(0, 1 - (x / rx) * (x / rx))) + H * 0.004;
      }
      return neckR;
    };
    for (const side of [-1, 1]) {
      const grid: number[][] = [];
      for (let row = 0; row <= 4; row++) {
        const v = row / 4;
        const ids: number[] = [];
        for (let col = 0; col <= 4; col++) {
          const u = col / 4;
          const x =
            side *
            dmath.lerp(
              dmath.lerp(H * 0.004, neckR * 0.85, u),
              dmath.lerp(m.shoulderHalf * 0.2, m.shoulderHalf * 0.36, u),
              v,
            );
          const y = neck[1] + H * dmath.lerp(0.019, dmath.lerp(-0.025, -0.008, u), v);
          ids.push(b.vertex([x, y, shirtFront(x, y)], tint(c.top, 1.08), chestSkin));
        }
        grid.push(ids);
      }
      for (let row = 0; row < 4; row++) {
        const high = grid[row] as number[];
        const low = grid[row + 1] as number[];
        for (let col = 0; col < 4; col++) {
          const a = high[col] as number,
            c0 = high[col + 1] as number;
          const e = low[col + 1] as number,
            f = low[col] as number;
          if (side > 0) b.quad('top', f, e, c0, a);
          else b.quad('top', a, c0, e, f);
        }
      }
    }
  }
  const neck0 = torsoRing(
    'skin',
    neck[1],
    neckR,
    neckR * 0.94,
    blend(J('chest'), 0.4, J('neck'), 0.6),
    c.skin,
  );
  const neck1 = torsoRing(
    'skin',
    head[1] + m.headLen * 0.23,
    neckR * 0.94,
    neckR * 0.9,
    blend(J('neck'), 0.2, J('head'), 0.8),
    c.skin,
  );
  b.loft('skin', neck0, neck1);
  buildHumanHead(d, m, head, tier, b, skin(J('head')));

  // A button placket follows the torso surface and shares its skin weights.
  if (tier < 2) {
    let strip: [number, number] | undefined;
    for (const [y, rx, rz, s] of torso) {
      const x = H * 0.007;
      const z = rz * dmath.sqrt(1 - (x / rx) * (x / rx)) + H * 0.001;
      const a = b.vertex([-x, y, z], tint(c.top, 0.82), s);
      const c0 = b.vertex([x, y, z], tint(c.top, 0.82), s);
      if (strip) b.quad('top', strip[0], strip[1], c0, a);
      strip = [a, c0];
      if (near)
        b.disc(
          'accent',
          [0, y + H * 0.002, z + H * 0.001],
          [0, 0, 1],
          H * 0.0018,
          8,
          s,
          tint(c.accent, 0.7),
        );
    }
  }
  const mark = b.mark();
  if (near) {
    // Patch pockets conform to the chest instead of floating rectangular blocks.
    const x0 = m.shoulderHalf * 0.2,
      x1 = m.shoulderHalf * 0.61;
    const y0 = chest[1] + m.chestLen * 0.13,
      y1 = y0 + H * 0.038;
    const patch = (x: number, y: number, color: RGB): number => {
      const t = (y - chest[1]) / (m.chestLen * 0.65);
      const rx = m.shoulderHalf * dmath.lerp(0.94, 1.04, t);
      const rz = m.torsoRadius * dmath.lerp(0.94, 0.91, t);
      const weight = 0.35 * (1 - t);
      return b.vertex(
        [x, y, rz * dmath.sqrt(1 - (x / rx) * (x / rx)) + H * 0.004],
        color,
        blend(J('spine'), weight, J('chest'), 1 - weight),
      );
    };
    for (let row = 0; row < 3; row++) {
      const low = dmath.lerp(y0, y1, row / 3);
      const high = dmath.lerp(y0, y1, (row + 1) / 3);
      for (let col = 0; col < 6; col++) {
        const left = dmath.lerp(x0, x1, col / 6),
          right = dmath.lerp(x0, x1, (col + 1) / 6);
        b.quad(
          'top',
          patch(left, low, tint(c.top, 0.94)),
          patch(right, low, tint(c.top, 0.94)),
          patch(right, high, tint(c.top, 0.94)),
          patch(left, high, tint(c.top, 0.94)),
        );
        if (row === 2)
          b.quad(
            'top',
            patch(left, y1 - H * 0.002, tint(c.top, 0.72)),
            patch(right, y1 - H * 0.002, tint(c.top, 0.72)),
            patch(right, y1, tint(c.top, 0.72)),
            patch(left, y1, tint(c.top, 0.72)),
          );
      }
    }
  }
  const A = P('upperArm.l'),
    E = P('foreArm.l'),
    W = P('hand.l');
  const armDir = direction(A, E);
  const lowerDir = direction(E, W);
  // Keep volume through the elbow and taper gradually into the forearm. A narrow
  // elbow followed by a wider forearm exaggerates an hourglass shape under skinning.
  const armSections: readonly [number, number][] = near
    ? [
        [0.22, 1.02],
        [0.4, 0.99],
        [0.5, 0.94],
        [0.8, 0.89],
        [0.94, 0.87],
        [1, 0.86],
        [1.07, 0.85],
        [1.25, 0.8],
        [1.5, 0.7],
        [1.8, 0.55],
        [2, 0.48],
      ]
    : [
        [0.22, 1.02],
        [0.5, 0.94],
        [1, 0.86],
        [1.35, 0.76],
        [2, 0.48],
      ];
  // A consistent frame keeps the outer deltoid and the forearm on the same meridian.
  const armRing = (
    center: Vec3,
    axis: Vec3,
    rx: number,
    rz: number,
    s: Skin,
    color: RGB,
    roll = 0,
  ): RingRef => {
    const start = b.mark();
    const rotation = roll === 0 ? undefined : forearmRoll(axis, roll);
    for (let i = 0; i < limbSides; i++) {
      const angle = (dmath.TAU * i) / limbSides;
      const across = rx * dmath.cos(angle);
      const offset: Vec3 = [-axis[1] * across, axis[0] * across, rz * dmath.sin(angle)];
      const p = rotation ? quatRotateVec3(rotation, offset) : offset;
      b.vertex([center[0] + p[0], center[1] + p[1], center[2] + p[2]], color, s);
    }
    return { start, sides: limbSides, center };
  };
  last = undefined;
  let previousRegion: FigureRegion | undefined;
  let sleeveBridge: RingRef | undefined;
  for (const [t, r] of armSections.filter(
    ([t]) => tier < 2 || t === 0.22 || t === 0.5 || t === 1 || t === 2,
  )) {
    const center = t <= 1 ? mix(A, E, t) : mix(E, W, t - 1);
    center[0] += H * 0.008 * dmath.clamp((1 - t) / 0.78, 0, 1);
    const axis = t <= 1 ? armDir : lowerDir;
    const region =
      d.features.sleeves === 'none' || (d.features.sleeves === 'short' && t > 0.5)
        ? 'skin'
        : 'sleeves';
    const color = region === 'skin' ? c.skin : c.top;
    const s =
      t < 0.32
        ? blend(J('chest'), 0.6 * (1 - t / 0.32), J('upperArm.l'), 0.4 + (0.6 * t) / 0.32)
        : t < 0.8
          ? skin(J('upperArm.l'))
          : t < 1.2
            ? blend(J('upperArm.l'), (1.2 - t) / 0.4, J('foreArm.l'), (t - 0.8) / 0.4)
            : t < 1.8
              ? skin(J('foreArm.l'))
              : blend(J('foreArm.l'), 0.8, J('hand.l'), 0.2);
    if (last && previousRegion !== region) {
      const edge = armRing(last.center, axis, m.limbRadius * r, m.limbRadius * r, s, color);
      b.loft(previousRegion as FigureRegion, last, edge);
      last = edge;
    }
    const radius = m.limbRadius * r * (region === 'skin' ? 0.91 : 1.03);
    const wristBlend = dmath.clamp((t - 1.8) / 0.2, 0, 1);
    const rx = dmath.lerp(radius, m.handLen * 0.105, wristBlend);
    const rz = dmath.lerp(radius * 0.94, m.handLen * 0.18, wristBlend);
    if (!last) {
      const seam =
        region === 'skin'
          ? shoulderPoints.map((point) => b.vertex(point, color, chestSkin))
          : shoulderLeft;
      const steps = near ? 5 : tier === 1 ? 3 : 2;
      for (let step = 1; step < steps; step++) {
        const u = step / steps;
        const start = b.mark();
        for (let i = 0; i < limbSides; i++) {
          const angle = (dmath.TAU * i) / limbSides;
          const across = rx * dmath.cos(angle);
          const target: Vec3 = [
            center[0] - axis[1] * across,
            center[1] + axis[0] * across,
            rz * dmath.sin(angle),
          ];
          const point = mix(shoulderPoints[i] as Vec3, target, u);
          const round = dmath.max(0, dmath.cos(angle)) ** 2 * 4 * u * (1 - u);
          point[0] += H * 0.025 * round;
          point[1] += H * 0.014 * round;
          b.vertex(point, color, blend(J('chest'), 1 - 0.9 * u, J('upperArm.l'), 0.9 * u));
        }
        const bridge = { start, sides: limbSides, center };
        if (last) b.loft(region, last, bridge);
        else {
          sleeveBridge = bridge;
          for (let i = 0; i < limbSides; i++) {
            const next = (i + 1) % limbSides;
            b.quad(region, seam[i] as number, seam[next] as number, start + next, start + i);
          }
        }
        last = bridge;
      }
    }
    const ring = armRing(
      center,
      axis,
      rx,
      rz,
      s,
      color,
      tier === 2 ? REST_FOREARM_ROLL * dmath.clamp(t - 1, 0, 1) : 0,
    );
    if (last) b.loft(region, last, ring);
    last = ring;
    previousRegion = region;
  }
  if (last)
    b.cap(
      previousRegion as FigureRegion,
      last,
      skin(J('hand.l')),
      previousRegion === 'skin' ? c.skin : c.top,
    );
  buildHumanHand(
    b,
    W,
    lowerDir,
    m.handLen,
    skin(J('hand.l')),
    c.skin,
    tier,
    d.features.hands === 'fingers',
    tier === 2 ? forearmRoll(lowerDir) : undefined,
  );

  const hipJoint = P('upperLeg.l'),
    K = P('lowerLeg.l'),
    ankle = P('foot.l');
  const legSections: readonly [number, number][] = near
    ? [
        [0.12, 1.42],
        [0.15, 1.48],
        [0.4, 1.32],
        [0.5, 1.21],
        [0.78, 0.99],
        [0.94, 0.91],
        [1, 0.94],
        [1.08, 0.94],
        [1.3, 1.07],
        [1.55, 0.91],
        [1.8, 0.69],
        [1.94, 0.64],
      ]
    : [
        [0.12, 1.42],
        [0.25, 1.42],
        [0.5, 1.21],
        [1, 0.94],
        [1.35, 1.04],
        [1.94, 0.64],
      ];
  // Each pant leg grows out of half of the waistband. The inner halves meet along
  // the crotch seam, avoiding overlapping pelvis/thigh shells and the old diaper silhouette.
  const yokeStart = b.mark();
  const waistY = spine[1] + H * 0.014;
  const crotchY = hips[1] - H * 0.045;
  for (let i = 0; i < limbSides; i++) {
    const angle = (dmath.TAU * i) / limbSides;
    const x = dmath.cos(angle);
    const z = dmath.sin(angle);
    const y = x >= 0 ? waistY : dmath.lerp(waistY, crotchY, -x);
    b.vertex(
      [dmath.max(0, x) * pelvis * 0.9, y, z * m.torsoRadius * 0.8],
      c.bottom,
      x >= 0 ? waistSkin : skin(J('hips')),
    );
  }
  last = { start: yokeStart, sides: limbSides, center: [hipJoint[0], waistY, 0] };
  previousRegion = 'bottom';
  for (const [t, r] of legSections.filter(
    ([t]) => tier < 2 || t === 0.12 || t === 0.5 || t === 1 || t === 1.94,
  )) {
    const center = t <= 1 ? mix(hipJoint, K, t) : mix(K, ankle, t - 1);
    const region = d.features.legs === 'shorts' && t > 0.5 ? 'skin' : 'bottom';
    const color = region === 'skin' ? c.skin : c.bottom;
    const s =
      t < 0.15
        ? blend(J('hips'), 0.25, J('upperLeg.l'), 0.75)
        : t < 0.8
          ? skin(J('upperLeg.l'))
          : t < 1.2
            ? blend(J('upperLeg.l'), (1.2 - t) / 0.4, J('lowerLeg.l'), (t - 0.8) / 0.4)
            : skin(J('lowerLeg.l'));
    const radius = m.limbRadius * r * (region === 'skin' ? 0.88 : 1);
    if (last && previousRegion !== region) {
      const edge = b.ring(region, last.center, DOWN, radius, radius * 1.06, limbSides, s, color);
      b.loft(previousRegion as FigureRegion, last, edge);
      last = edge;
    }
    const ring = b.ring(region, center, DOWN, radius, radius * 1.06, limbSides, s, color);
    if (last) b.loft(region, last, ring);
    else b.cap(region, ring, s, color, undefined, false);
    last = ring;
    previousRegion = region;
  }
  if (last)
    b.cap(
      previousRegion as FigureRegion,
      last,
      skin(J('lowerLeg.l')),
      previousRegion === 'skin' ? c.skin : c.bottom,
    );
  buildHumanShoe(b, ankle, m.footLen, H, skin(J('foot.l')), c.shoes, tier);
  const mirrorOffset = b.mark() - mark;
  b.mirrorX(mark, (joint) => jointIndex(rig, mirrorName(rig.joints[joint]?.name ?? 'root')));
  // mirrorX copies the arm but deliberately skips faces sharing pre-mark torso vertices.
  if (sleeveBridge && d.features.sleeves !== 'none') {
    const start = sleeveBridge.start + mirrorOffset;
    for (let i = 0; i < limbSides; i++) {
      const next = (i + 1) % limbSides;
      b.quad(
        'sleeves',
        shoulderRight[next] as number,
        shoulderRight[i] as number,
        start + i,
        start + next,
      );
    }
  }
}
