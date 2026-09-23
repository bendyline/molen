/**
 * The quadruped body: a lofted barrel along +Z, a lofted neck, an ellipsoid head with a snout,
 * disc eyes, cone ears and optional horns, four lofted legs ending in hooves or paws, and a
 * lofted tail. Left-side features and legs are generated once and mirrored.
 */

import { dmath, type Vec3 } from '@bendyline/molen-kernel/determinism';
import { jointIndex, jointPosition } from './body';
import { parseColor, type RGB, scaleColor } from './color';
import { type FigureRig, mirrorName, rigBindModel, socketBindPosition } from './rig';
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
const FORWARD: Vec3 = [0, 0, 1];

function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}

function unit(a: Vec3): Vec3 {
  const l = dmath.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

function mix(a: Vec3, b: Vec3, t: number): Vec3 {
  return [dmath.lerp(a[0], b[0], t), dmath.lerp(a[1], b[1], t), dmath.lerp(a[2], b[2], t)];
}

export function buildQuadrupedBody(
  d: ResolvedFigureDescriptor,
  rig: FigureRig,
  tier: FigureTier,
  b: SkinnedMeshBuilder,
): void {
  const m = rig.metrics;
  const S = d.height;
  const bind = rigBindModel(rig);
  const J = (name: string): number => jointIndex(rig, name);
  const P = (name: string): Vec3 => jointPosition(bind, J(name));
  const fur = parseColor(d.palette.skin);
  const markings = parseColor(d.palette.markings);
  const hair = parseColor(d.palette.hair);
  const eyes = parseColor(d.palette.eyes);
  const hooves =
    d.features.feet === 'unguligrade'
      ? scaleColor(parseColor(d.palette.shoes), 0.55)
      : parseColor(d.palette.shoes);
  const accent = parseColor(d.palette.accent);
  const bodySides = tier === 0 ? 12 : 8;
  const limbSides = tier === 0 ? 8 : 6;
  const headSegments = tier === 0 ? 12 : 8;
  const headRings = tier === 0 ? 8 : 6;
  const eyeSides = tier === 0 ? 8 : 6;
  const r = m.bodyRadius;
  const hips = P('hips');
  const spine = P('spine');
  const chest = P('chest');
  const neck = P('neck');
  const head = P('head');

  // --- barrel along +Z ---
  const barrel = (z: number, y: number, rx: number, ry: number, s: Skin): RingRef =>
    b.ring('skin', [0, y, z], FORWARD, rx, ry, bodySides, s, fur);
  const rump = barrel(hips[2] - 0.55 * r, hips[1] + 0.05 * r, 0.72 * r, 0.8 * r, skin(J('hips')));
  b.cap('skin', rump, skin(J('hips')), fur, [0, hips[1] + 0.15 * r, hips[2] - 0.95 * r], false);
  const hipRing = barrel(hips[2], hips[1], 0.88 * r, r, skin(J('hips')));
  const midRing = barrel(spine[2], spine[1] - 0.03 * r, 0.9 * r, 1.03 * r, skin(J('spine')));
  const chestRing = barrel(chest[2], chest[1], 0.9 * r, r, skin(J('chest')));
  const frontRing = barrel(
    chest[2] + 0.55 * r,
    chest[1] - 0.05 * r,
    0.7 * r,
    0.8 * r,
    skin(J('chest')),
  );
  b.loft('skin', rump, hipRing);
  b.loft('skin', hipRing, midRing);
  b.loft('skin', midRing, chestRing);
  b.loft('skin', chestRing, frontRing);
  b.cap(
    'skin',
    frontRing,
    skin(J('chest')),
    fur,
    [0, chest[1] - 0.15 * r, chest[2] + 0.95 * r],
    true,
  );
  // Belly marking: a lighter band under the barrel (a second, slightly larger open loft).
  if (d.species === 'dog' || d.species === 'cat' || d.species === 'deer') {
    const belly = (z: number, s: Skin): RingRef =>
      b.ring(
        'markings',
        [0, spine[1] - 0.25 * r, z],
        FORWARD,
        0.62 * r,
        0.62 * r,
        bodySides,
        s,
        markings,
      );
    const bellyBack = belly(hips[2] + 0.1 * r, skin(J('hips')));
    const bellyMid = belly(spine[2], skin(J('spine')));
    const bellyFront = belly(chest[2] - 0.1 * r, skin(J('chest')));
    b.loft('markings', bellyBack, bellyMid);
    b.loft('markings', bellyMid, bellyFront);
  }

  // --- neck and head ---
  const neckDir = unit(sub(head, neck));
  const neckBase = b.ring(
    'skin',
    add(neck, scale(neckDir, -0.15 * r)),
    neckDir,
    0.5 * r,
    0.55 * r,
    limbSides,
    blend(J('chest'), 0.5, J('neck'), 0.5),
    fur,
  );
  const neckMid = b.ring(
    'skin',
    mix(neck, head, 0.5),
    neckDir,
    0.42 * r,
    0.46 * r,
    limbSides,
    skin(J('neck')),
    fur,
  );
  const neckTop = b.ring(
    'skin',
    head,
    neckDir,
    0.36 * r,
    0.4 * r,
    limbSides,
    blend(J('neck'), 0.4, J('head'), 0.6),
    fur,
  );
  b.loft('skin', neckBase, neckMid);
  b.loft('skin', neckMid, neckTop);
  if (d.features.mane) {
    const maneBack = b.ring(
      'hair',
      add(neck, scale(neckDir, -0.1 * r)),
      neckDir,
      0.2 * r,
      0.75 * r,
      limbSides,
      blend(J('chest'), 0.5, J('neck'), 0.5),
      hair,
    );
    const maneFront = b.ring(
      'hair',
      add(mix(neck, head, 0.9), [0, 0.05 * r, 0]),
      neckDir,
      0.16 * r,
      0.62 * r,
      limbSides,
      blend(J('neck'), 0.4, J('head'), 0.6),
      hair,
    );
    b.loft('hair', maneBack, maneFront);
    b.cap('hair', maneFront, blend(J('neck'), 0.4, J('head'), 0.6), hair, undefined, true);
  }
  const hp = m.headPitch;
  const headDir: Vec3 = [0, -dmath.sin(hp), dmath.cos(hp)];
  const headCenter = add(head, scale(headDir, 0.42 * m.headLen));
  b.ellipsoid(
    'skin',
    headCenter,
    headDir,
    [0.5 * m.headWidth, 0.5 * m.headHeight, 0.5 * m.headLen],
    headSegments,
    headRings,
    skin(J('head')),
    fur,
  );
  if (m.snoutLen > 0) {
    const snoutBase = add(head, scale(headDir, 0.82 * m.headLen));
    const snoutTip = add(snoutBase, scale(headDir, m.snoutLen));
    const baseRing = b.ring(
      'markings',
      snoutBase,
      headDir,
      0.36 * m.headWidth,
      0.34 * m.headHeight,
      limbSides,
      skin(J('head')),
      markings,
    );
    const tipRing = b.ring(
      'markings',
      snoutTip,
      headDir,
      0.26 * m.headWidth,
      0.24 * m.headHeight,
      limbSides,
      skin(J('head')),
      markings,
    );
    b.loft('markings', baseRing, tipRing);
    b.cap(
      'eyes',
      tipRing,
      skin(J('head')),
      eyes,
      add(snoutTip, scale(headDir, 0.05 * m.headLen)),
      true,
    );
  }

  // --- tail ---
  if (d.features.tail !== 'none' && m.tailLen > 0) {
    const bushy = d.features.tail === 'bushy';
    const region: FigureRegion = bushy ? 'hair' : 'skin';
    const color: RGB = bushy ? hair : fur;
    const t0 = P('tail.0');
    const t1 = P('tail.1');
    const t2 = P('tail.2');
    const tip = socketBindPosition(rig, 'tail.tip', bind) ?? t2;
    const segments: [Vec3, Vec3, Skin, number][] = [
      [t0, t1, skin(J('tail.0')), 0.16],
      [t1, t2, blend(J('tail.0'), 0.5, J('tail.1'), 0.5), 0.12],
      [t2, tip, blend(J('tail.1'), 0.5, J('tail.2'), 0.5), 0.08],
    ];
    const count = d.features.tail === 'short' ? 1 : 3;
    let previous: RingRef | undefined;
    for (let i = 0; i < count; i++) {
      const [from, to, s, radius] = segments[i] as [Vec3, Vec3, Skin, number];
      const dir = unit(sub(to, from));
      const rr = radius * r * (bushy ? 2.2 : 1);
      const ring = b.ring(region, from, dir, rr, rr, limbSides, s, color);
      if (previous !== undefined) b.loft(region, previous, ring);
      else b.cap(region, ring, s, color, undefined, false);
      previous = ring;
      if (i === count - 1) {
        b.cap(
          region,
          ring,
          blend(J('tail.2'), 1, J('tail.2'), 0),
          color,
          add(to, scale(dir, bushy ? 0.5 * rr : 0.2 * rr)),
          true,
        );
      }
    }
  }

  // --- mirrored side: ear, eye, horn, front and hind legs ---
  const mark = b.mark();
  const earDir: Vec3 =
    d.features.ears === 'floppy'
      ? [0.55, -0.7, 0.05]
      : d.features.ears === 'round'
        ? [0.5, 0.75, 0]
        : [0.3, 0.9, 0.1];
  if (d.features.ears !== 'none' && m.earLen > 0) {
    const earBase = P('ear.l');
    const dir = unit(earDir);
    const earR = (d.features.ears === 'round' ? 0.4 : 0.28) * m.earLen;
    const baseRing = b.ring('skin', earBase, dir, earR, 0.45 * earR, 6, skin(J('ear.l')), fur);
    const length = d.features.ears === 'round' ? 0.65 * m.earLen : m.earLen;
    b.cap('skin', baseRing, skin(J('ear.l')), fur, add(earBase, scale(dir, length)), true);
    b.cap(
      'markings',
      baseRing,
      skin(J('ear.l')),
      markings,
      add(earBase, scale(dir, 0.02 * length)),
      false,
    );
  }
  {
    const eyeCenter = add(add(head, scale(headDir, 0.55 * m.headLen)), [
      0.48 * m.headWidth,
      0.18 * m.headHeight,
      0,
    ]);
    const normal = unit([1, 0.15, 0.45]);
    b.disc('eyes', eyeCenter, normal, 0.085 * m.headLen, eyeSides, skin(J('head')), eyes);
  }
  if (d.features.horns !== 'none') {
    const hornBase = add(add(head, scale(headDir, 0.2 * m.headLen)), [
      0.32 * m.headWidth,
      0.42 * m.headHeight,
      0,
    ]);
    const length = (d.features.horns === 'short' ? 0.55 : 1.1) * m.headLen;
    const dir = unit(d.features.horns === 'antlers' ? [0.45, 0.9, -0.25] : [0.5, 0.85, 0.15]);
    const baseRing = b.ring(
      'markings',
      hornBase,
      dir,
      0.09 * m.headLen,
      0.09 * m.headLen,
      6,
      skin(J('head')),
      markings,
    );
    b.cap('markings', baseRing, skin(J('head')), markings, add(hornBase, scale(dir, length)), true);
    b.cap('markings', baseRing, skin(J('head')), markings, hornBase, false);
    if (d.features.horns === 'antlers') {
      const branchBase = add(hornBase, scale(dir, 0.45 * length));
      const branchDir = unit([0.9, 0.5, 0.2]);
      const branchRing = b.ring(
        'markings',
        branchBase,
        branchDir,
        0.07 * m.headLen,
        0.07 * m.headLen,
        6,
        skin(J('head')),
        markings,
      );
      b.cap(
        'markings',
        branchRing,
        skin(J('head')),
        markings,
        add(branchBase, scale(branchDir, 0.55 * length)),
        true,
      );
      b.cap('markings', branchRing, skin(J('head')), markings, branchBase, false);
    }
  }
  for (const leg of ['fl', 'hl'] as const) {
    const upper = P(`upperLeg.${leg}`);
    const lower = P(`lowerLeg.${leg}`);
    const foot = P(`foot.${leg}`);
    const toes = P(`toes.${leg}`);
    const parent = leg === 'fl' ? 'chest' : 'hips';
    const legRing = (center: Vec3, rr: number, s: Skin): RingRef =>
      b.ring('skin', center, UP, rr, rr, limbSides, s, fur);
    const top = legRing(
      [upper[0], upper[1] + 0.12 * r, upper[2]],
      1.35 * m.limbRadius,
      blend(J(parent), 0.5, J(`upperLeg.${leg}`), 0.5),
    );
    const knee = legRing(
      lower,
      1.0 * m.limbRadius,
      blend(J(`upperLeg.${leg}`), 0.5, J(`lowerLeg.${leg}`), 0.5),
    );
    const hock = legRing(
      foot,
      0.8 * m.limbRadius,
      blend(J(`lowerLeg.${leg}`), 0.5, J(`foot.${leg}`), 0.5),
    );
    const fetlock = legRing(
      [toes[0], toes[1] + 0.02 * S, toes[2]],
      0.72 * m.limbRadius,
      blend(J(`foot.${leg}`), 0.6, J(`toes.${leg}`), 0.4),
    );
    b.loft('skin', top, knee);
    b.loft('skin', knee, hock);
    b.loft('skin', hock, fetlock);
    b.cap(
      'skin',
      fetlock,
      blend(J(`foot.${leg}`), 0.6, J(`toes.${leg}`), 0.4),
      fur,
      undefined,
      true,
    );
    const w = 0.85 * m.limbRadius;
    b.box(
      'shoes',
      [toes[0] - w, 0, toes[2] - 0.6 * m.quadToesLen],
      [toes[0] + w, toes[1] + 0.02 * S, toes[2] + 0.8 * m.quadToesLen],
      skin(J(`toes.${leg}`)),
      hooves,
    );
  }
  // Collar (accent) for pets.
  if (d.species === 'dog' || d.species === 'cat') {
    const collarBase = b.ring(
      'accent',
      add(neck, scale(neckDir, 0.05 * r)),
      neckDir,
      0.55 * r,
      0.6 * r,
      limbSides,
      blend(J('chest'), 0.5, J('neck'), 0.5),
      accent,
    );
    const collarTop = b.ring(
      'accent',
      add(neck, scale(neckDir, 0.2 * r)),
      neckDir,
      0.52 * r,
      0.57 * r,
      limbSides,
      skin(J('neck')),
      accent,
    );
    b.loft('accent', collarBase, collarTop);
  }

  b.mirrorX(mark, (joint) => jointIndex(rig, mirrorName(rig.joints[joint]?.name ?? 'root')));
}
