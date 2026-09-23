/**
 * The biped body: a lofted torso with pants/shirt color blocks, a neck, an ellipsoid head with
 * disc eyes and a hair shell, lofted arms with sleeves and mitten hands, lofted legs and block
 * shoes. Left limbs are generated and mirrored for exact symmetry. No mouth, nose, or teeth:
 * that is the style.
 */

import { dmath, type Vec3 } from '@bendyline/molen-kernel/determinism';
import { jointIndex, jointPosition } from './body';
import { parseColor, type RGB } from './color';
import { type FigureRig, mirrorName, rigBindModel } from './rig';
import {
  blend,
  type FigureTier,
  type RingRef,
  type Skin,
  type SkinnedMeshBuilder,
  skin,
} from './skinned-mesh-builder';
import type { ResolvedFigureDescriptor } from './types';

const UP: Vec3 = [0, 1, 0];

function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}

function mix(a: Vec3, b: Vec3, t: number): Vec3 {
  return [dmath.lerp(a[0], b[0], t), dmath.lerp(a[1], b[1], t), dmath.lerp(a[2], b[2], t)];
}

export function buildBipedBody(
  d: ResolvedFigureDescriptor,
  rig: FigureRig,
  tier: FigureTier,
  b: SkinnedMeshBuilder,
): void {
  const m = rig.metrics;
  const H = d.height;
  const bind = rigBindModel(rig);
  const J = (name: string): number => jointIndex(rig, name);
  const P = (name: string): Vec3 => jointPosition(bind, J(name));
  const palette = {
    skin: parseColor(d.palette.skin),
    hair: parseColor(d.palette.hair),
    eyes: parseColor(d.palette.eyes),
    top: parseColor(d.palette.top),
    bottom: parseColor(d.palette.bottom),
    shoes: parseColor(d.palette.shoes),
    accent: parseColor(d.palette.accent),
  };
  const torsoSides = tier === 0 ? 12 : 8;
  const limbSides = tier === 0 ? 10 : 6;
  const headSegments = tier === 0 ? 14 : 8;
  const headRings = tier === 0 ? 10 : 6;
  const eyeSides = tier === 0 ? 8 : 6;

  const hips = P('hips');
  const spine = P('spine');
  const chest = P('chest');
  const neck = P('neck');
  const head = P('head');
  const pelvisHalf = m.hipHalf + 1.15 * m.limbRadius;
  const neckR = 0.36 * m.headWidth;

  // --- torso: pants block, then shirt block, then the neck ---
  const torsoRing = (
    region: 'top' | 'bottom' | 'skin' | 'accent',
    y: number,
    rx: number,
    rz: number,
    s: Skin,
    color: RGB,
  ): RingRef => b.ring(region, [0, y, 0], UP, rx, rz, torsoSides, s, color);
  const crotch = torsoRing(
    'bottom',
    hips[1] - 0.035 * H,
    0.95 * pelvisHalf,
    0.85 * m.torsoRadius,
    skin(J('hips')),
    palette.bottom,
  );
  b.cap('bottom', crotch, skin(J('hips')), palette.bottom, [0, hips[1] - 0.06 * H, 0], false);
  const waistBottom = torsoRing(
    'bottom',
    spine[1] - 0.005 * H,
    0.92 * pelvisHalf,
    0.88 * m.torsoRadius,
    blend(J('hips'), 0.6, J('spine'), 0.4),
    palette.bottom,
  );
  b.loft('bottom', crotch, waistBottom);
  // Belt (accent) as a thin raised band.
  const beltLow = torsoRing(
    'accent',
    spine[1] - 0.005 * H,
    0.95 * pelvisHalf,
    0.91 * m.torsoRadius,
    blend(J('hips'), 0.6, J('spine'), 0.4),
    palette.accent,
  );
  const beltHigh = torsoRing(
    'accent',
    spine[1] + 0.02 * H,
    0.95 * pelvisHalf,
    0.91 * m.torsoRadius,
    blend(J('hips'), 0.4, J('spine'), 0.6),
    palette.accent,
  );
  b.loft('accent', beltLow, beltHigh);
  const waistTop = torsoRing(
    'top',
    spine[1] + 0.02 * H,
    0.9 * pelvisHalf,
    0.86 * m.torsoRadius,
    blend(J('hips'), 0.4, J('spine'), 0.6),
    palette.top,
  );
  const chestLow = torsoRing(
    'top',
    chest[1],
    0.82 * m.shoulderHalf,
    m.torsoRadius,
    blend(J('spine'), 0.5, J('chest'), 0.5),
    palette.top,
  );
  const shoulders = torsoRing(
    'top',
    neck[1] - 0.035 * H,
    1.02 * m.shoulderHalf,
    0.95 * m.torsoRadius,
    skin(J('chest')),
    palette.top,
  );
  const collar = torsoRing(
    'top',
    neck[1] + 0.004 * H,
    1.15 * neckR,
    1.05 * neckR,
    blend(J('chest'), 0.5, J('neck'), 0.5),
    palette.top,
  );
  b.loft('top', waistTop, chestLow);
  b.loft('top', chestLow, shoulders);
  b.loft('top', shoulders, collar);
  const neckBase = torsoRing(
    'skin',
    neck[1] + 0.004 * H,
    neckR,
    0.92 * neckR,
    blend(J('chest'), 0.4, J('neck'), 0.6),
    palette.skin,
  );
  const neckTop = torsoRing(
    'skin',
    head[1] + 0.06 * m.headLen,
    0.95 * neckR,
    0.88 * neckR,
    blend(J('neck'), 0.4, J('head'), 0.6),
    palette.skin,
  );
  b.loft('skin', neckBase, neckTop);

  // --- head ---
  const headCenter: Vec3 = [0, head[1] + 0.5 * m.headLen, 0];
  const headRadii: Vec3 = [0.5 * m.headWidth, 0.475 * m.headWidth, 0.5 * m.headLen];
  b.ellipsoid(
    'skin',
    headCenter,
    UP,
    headRadii,
    headSegments,
    headRings,
    skin(J('head')),
    palette.skin,
  );
  const hair = d.features.hair;
  if (hair !== 'none') {
    const hairCenter: Vec3 = [0, headCenter[1] + 0.03 * m.headLen, -0.02 * m.headLen];
    const hairRadii: Vec3 = [1.07 * headRadii[0], 1.07 * headRadii[1], 1.06 * headRadii[2]];
    const latMin = hair === 'cap' ? 0.12 : -0.35;
    b.ellipsoid(
      'hair',
      hairCenter,
      UP,
      hairRadii,
      headSegments,
      headRings,
      skin(J('head')),
      palette.hair,
      latMin,
      1,
    );
    if (hair === 'long') {
      const backTop = b.ring(
        'hair',
        [0, head[1] + 0.35 * m.headLen, -0.38 * m.headWidth],
        UP,
        0.42 * m.headWidth,
        0.16 * m.headWidth,
        limbSides,
        skin(J('head')),
        palette.hair,
      );
      const backBottom = b.ring(
        'hair',
        [0, neck[1] - 0.09 * H, -0.85 * m.torsoRadius],
        UP,
        0.5 * m.headWidth,
        0.14 * m.headWidth,
        limbSides,
        blend(J('chest'), 0.7, J('head'), 0.3),
        palette.hair,
      );
      b.loft('hair', backBottom, backTop);
      b.cap(
        'hair',
        backBottom,
        blend(J('chest'), 0.7, J('head'), 0.3),
        palette.hair,
        undefined,
        false,
      );
    }
  }
  // Eyes and brows on the front of the head (mirrored below with the limbs).
  const eyeY = head[1] + 0.6 * m.headLen;
  const eyeZ = 0.47 * m.headWidth;
  const eyeX = 0.19 * m.headWidth;

  // --- mirrored side: left eye/brow, left arm, left leg ---
  const mark = b.mark();
  b.disc(
    'eyes',
    [eyeX, eyeY, eyeZ],
    [0, 0, 1],
    0.08 * m.headWidth,
    eyeSides,
    skin(J('head')),
    palette.eyes,
  );
  b.box(
    'brow',
    [eyeX - 0.11 * m.headWidth, eyeY + 0.1 * m.headWidth, eyeZ - 0.04 * m.headWidth],
    [eyeX + 0.11 * m.headWidth, eyeY + 0.13 * m.headWidth, eyeZ + 0.005 * m.headWidth],
    skin(J('head')),
    palette.hair,
  );

  // Left arm.
  {
    const A = P('upperArm.l');
    const E = P('foreArm.l');
    const W = P('hand.l');
    const upperDir = scale(sub(E, A), 1 / (dmath.hypot(...sub(E, A)) || 1));
    const lowerDir = scale(sub(W, E), 1 / (dmath.hypot(...sub(W, E)) || 1));
    const sleeves = d.features.sleeves;
    const sleeveColor = palette.top;
    const armRing = (
      region: 'sleeves' | 'skin',
      center: Vec3,
      axis: Vec3,
      r: number,
      s: Skin,
    ): RingRef =>
      b.ring(
        region,
        center,
        axis,
        r,
        r,
        limbSides,
        s,
        region === 'sleeves' ? sleeveColor : palette.skin,
      );
    const topRegion = sleeves === 'none' ? 'skin' : 'sleeves';
    const shoulderRing = armRing(
      topRegion,
      add(A, scale(upperDir, -0.02 * H)),
      upperDir,
      1.12 * m.limbRadius,
      skin(J('upperArm.l')),
    );
    b.cap(
      topRegion,
      shoulderRing,
      skin(J('upperArm.l')),
      topRegion === 'skin' ? palette.skin : sleeveColor,
      add(A, scale(upperDir, -0.5 * m.limbRadius)),
      false,
    );
    let previous = shoulderRing;
    let region: 'sleeves' | 'skin' = topRegion;
    if (sleeves === 'short') {
      const cuff = mix(A, E, 0.5);
      const cuffRing = armRing(
        'sleeves',
        cuff,
        upperDir,
        1.06 * m.limbRadius,
        blend(J('upperArm.l'), 0.7, J('foreArm.l'), 0.3),
      );
      b.loft('sleeves', previous, cuffRing);
      previous = armRing(
        'skin',
        cuff,
        upperDir,
        0.98 * m.limbRadius,
        blend(J('upperArm.l'), 0.7, J('foreArm.l'), 0.3),
      );
      region = 'skin';
    }
    const elbow = armRing(
      region,
      E,
      mix(upperDir, lowerDir, 0.5),
      0.95 * m.limbRadius,
      blend(J('upperArm.l'), 0.5, J('foreArm.l'), 0.5),
    );
    b.loft(region, previous, elbow);
    const wrist = armRing(
      region,
      W,
      lowerDir,
      0.75 * m.limbRadius,
      blend(J('foreArm.l'), 0.75, J('hand.l'), 0.25),
    );
    b.loft(region, elbow, wrist);
    if (region === 'sleeves') {
      // Cuff: close the sleeve so the skin hand reads as a separate block.
      b.cap(
        'sleeves',
        wrist,
        blend(J('foreArm.l'), 0.75, J('hand.l'), 0.25),
        sleeveColor,
        undefined,
        true,
      );
    }
    // Mitten hand.
    const handCenter = add(W, scale(lowerDir, 0.5 * m.handLen));
    b.ellipsoid(
      'skin',
      handCenter,
      lowerDir,
      [0.2 * m.handLen, 0.42 * m.handLen, 0.52 * m.handLen],
      limbSides,
      tier === 0 ? 6 : 4,
      skin(J('hand.l')),
      palette.skin,
    );
    if (d.features.hands === 'fingers' && tier === 0) {
      const thumbCenter = add(add(W, scale(lowerDir, 0.35 * m.handLen)), [0, 0, 0.42 * m.handLen]);
      b.ellipsoid(
        'skin',
        thumbCenter,
        [0, 0, 1],
        [0.1 * m.handLen, 0.1 * m.handLen, 0.22 * m.handLen],
        6,
        4,
        skin(J('hand.l')),
        palette.skin,
      );
    }
  }

  // Left leg.
  {
    const Hj = P('upperLeg.l');
    const K = P('lowerLeg.l');
    const Ak = P('foot.l');
    const legs = d.features.legs;
    const legRing = (region: 'bottom' | 'skin', center: Vec3, r: number, s: Skin): RingRef =>
      b.ring(
        region,
        center,
        UP,
        r,
        1.05 * r,
        limbSides,
        s,
        region === 'bottom' ? palette.bottom : palette.skin,
      );
    const thigh = legRing(
      'bottom',
      [Hj[0], Hj[1] + 0.015 * H, Hj[2]],
      1.3 * m.limbRadius,
      blend(J('hips'), 0.35, J('upperLeg.l'), 0.65),
    );
    let previous = thigh;
    let region: 'bottom' | 'skin' = 'bottom';
    if (legs === 'shorts') {
      const hem = mix(Hj, K, 0.5);
      const hemRing = legRing(
        'bottom',
        hem,
        1.16 * m.limbRadius,
        blend(J('upperLeg.l'), 0.75, J('lowerLeg.l'), 0.25),
      );
      b.loft('bottom', previous, hemRing);
      b.cap(
        'bottom',
        hemRing,
        blend(J('upperLeg.l'), 0.75, J('lowerLeg.l'), 0.25),
        palette.bottom,
        undefined,
        true,
      );
      previous = legRing(
        'skin',
        hem,
        1.08 * m.limbRadius,
        blend(J('upperLeg.l'), 0.75, J('lowerLeg.l'), 0.25),
      );
      region = 'skin';
    }
    const knee = legRing(
      region,
      K,
      1.0 * m.limbRadius,
      blend(J('upperLeg.l'), 0.5, J('lowerLeg.l'), 0.5),
    );
    b.loft(region, previous, knee);
    const ankle = legRing(
      region,
      [Ak[0], Ak[1] + 0.01 * H, Ak[2]],
      0.72 * m.limbRadius,
      blend(J('lowerLeg.l'), 0.7, J('foot.l'), 0.3),
    );
    b.loft(region, knee, ankle);
    b.cap(
      region,
      ankle,
      blend(J('lowerLeg.l'), 0.7, J('foot.l'), 0.3),
      region === 'bottom' ? palette.bottom : palette.skin,
      undefined,
      true,
    );
    // Block shoe.
    const shoeW = 0.055 * H;
    b.box(
      'shoes',
      [Ak[0] - 0.5 * shoeW, 0, Ak[2] - 0.3 * m.footLen],
      [Ak[0] + 0.5 * shoeW, Ak[1] + 0.02 * H, Ak[2] + 0.75 * m.footLen],
      skin(J('foot.l')),
      palette.shoes,
    );
  }

  b.mirrorX(mark, (joint) => jointIndex(rig, mirrorName(rig.joints[joint]?.name ?? 'root')));
}
