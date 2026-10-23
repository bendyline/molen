/** Continuous skull-to-muzzle profiles, visible inset eyes, fleshy ears and curved horns. */
import { dmath, type Vec3 } from '@bendyline/molen-kernel/determinism';
import {
  type AnimalContext,
  add,
  colorMix,
  scale,
  surfaceRing,
  tube,
  unit,
} from './body-animal-shape';
import { parseColor, scaleColor } from './color';
import { mirrorName } from './rig';
import { type RingRef, skin } from './skinned-mesh-builder';

export function buildAnimalHead(c: AnimalContext): void {
  const { d, m, b, J, P, tier } = c,
    L = m.headLen,
    W = m.headWidth,
    H = m.headHeight;
  const cat = d.species === 'cat',
    horse = d.species === 'horse',
    cow = d.species === 'cow',
    sheep = d.species === 'sheep';
  const dir: Vec3 = [0, -dmath.sin(m.headPitch), dmath.cos(m.headPitch)];
  const up: Vec3 = [0, dir[2], -dir[1]],
    head = P('head'),
    s = skin(J('head'));
  const at = (x: number, y: number, z: number): Vec3 =>
    add(head, add([x, 0, 0], add(scale(up, y), scale(dir, z))));
  const fur = sheep ? c.markings : c.fur;
  const end = (cat ? 0.66 : 0.78) * L + (horse ? 0.75 : 0.58) * m.snoutLen;
  const noseWidth = (cow ? 0.47 : horse ? 0.38 : cat ? 0.3 : 0.32) * W;
  const profiles: [number, number, number, number][] = [
    [-0.18 * L, 0.24 * W, 0.3 * H, 0],
    [0, 0.49 * W, 0.5 * H, 0],
    [0.2 * L, 0.58 * W, 0.56 * H, 0],
    [0.4 * L, 0.56 * W, 0.49 * H, 0],
    [dmath.min(0.58 * L, end - 0.2 * L), (cat ? 0.44 : 0.4) * W, 0.34 * H, -0.06 * H],
    [end - 0.16 * L, noseWidth, (cow ? 0.34 : 0.27) * H, -0.11 * H],
    [end, noseWidth * 0.94, (cow ? 0.29 : 0.23) * H, -0.1 * H],
  ];
  let previous: RingRef | undefined;
  for (let i = 0; i < profiles.length; i++) {
    if (tier === 2 && i === 1) continue;
    const [z, w, h, y] = profiles[i] as [number, number, number, number];
    const ring = surfaceRing(c, 'skin', at(0, y, z), up, w, h, h, c.sides, s, (_p, x, v) => {
      if (cow) return colorMix(fur, c.markings, dmath.clamp((dmath.abs(x) - 0.5) * 3, 0, 1));
      if (sheep) return fur;
      if (horse)
        return colorMix(
          fur,
          c.markings,
          v > 0.5 ? dmath.clamp((0.22 - dmath.abs(x)) * 8, 0, 1) : 0,
        );
      return colorMix(fur, c.markings, dmath.clamp((i - 3) * 0.45 + (0.15 - v) * 0.5, 0, 0.85));
    });
    if (previous) b.loft('skin', previous, ring);
    else b.cap('skin', ring, s, fur, at(0, 0, -0.25 * L), false);
    if (i === profiles.length - 1)
      b.cap('skin', ring, s, cow ? c.pink : fur, at(0, y, end + 0.025 * L), true);
    previous = ring;
  }
  const nose = cat ? c.pink : c.dark;
  b.ellipsoid(
    'markings',
    at(0, (cat ? 0.015 : -0.065) * H, end + 0.018 * L),
    dir,
    [cat ? 0.14 * W : noseWidth * 0.96, (cow ? 0.19 : horse ? 0.13 : 0.115) * H, 0.065 * L],
    tier === 0 ? 16 : 8,
    tier === 0 ? 6 : 4,
    s,
    cow ? c.pink : horse ? scaleColor(fur, 0.42) : nose,
  );
  if (d.features.mane) {
    b.ellipsoid(
      'hair',
      at(0, 0.47 * H, 0.12 * L),
      dir,
      [0.22 * W, 0.14 * H, 0.28 * L],
      c.limbSides,
      4,
      s,
      c.hair,
    );
  }

  const mark = b.mark();
  // Eyelid mound and cornea sit outside the skull; the pupil follows the same outward normal.
  const eyeAt = at((cat ? 0.43 : 0.54) * W, 0.17 * H, (cat ? 0.49 : 0.35) * L),
    normal = unit(cat ? [0.5, 0.1, 1] : [1, 0.15, 0.3]);
  const eyeR = (cat ? 0.095 : 0.075) * L,
    detail = tier === 0 ? 12 : 8;
  b.ellipsoid(
    'skin',
    eyeAt,
    normal,
    [eyeR * 1.22, eyeR * 0.91, eyeR * 0.58],
    detail,
    4,
    s,
    scaleColor(fur, 0.68),
  );
  const cornea = add(eyeAt, scale(normal, eyeR * 0.39));
  b.ellipsoid('eyes', cornea, normal, [eyeR, eyeR * 0.68, eyeR * 0.34], detail, 4, s, c.eyes);
  if (tier !== 2) {
    if (cat)
      b.ellipsoid(
        'eyes',
        add(cornea, scale(normal, eyeR * 0.32)),
        normal,
        [eyeR * 0.2, eyeR * 0.6, eyeR * 0.08],
        8,
        4,
        s,
        c.dark,
      );
    b.ellipsoid(
      'eyes',
      add(add(cornea, scale(normal, eyeR * 0.33)), [0, eyeR * 0.2, eyeR * 0.12]),
      normal,
      [eyeR * 0.13, eyeR * 0.13, eyeR * 0.06],
      6,
      3,
      s,
      parseColor('#eee7d8'),
    );
    // A narrow lip crease, following the side of the muzzle rather than a floating disc.
    tube(
      c,
      'markings',
      [
        at(noseWidth * 0.92, -0.24 * H, end - 0.18 * L),
        at(noseWidth, -0.24 * H, end - 0.07 * L),
        at(noseWidth * 0.78, -0.24 * H, end + 0.02 * L),
      ],
      [0.009 * L, 0.009 * L, 0.005 * L],
      [s, s, s],
      c.dark,
      6,
    );
    if (horse || cow) {
      b.ellipsoid(
        'eyes',
        at(noseWidth * 0.74, 0.04 * H, end + 0.033 * L),
        unit([0.6, 0.1, 1]),
        [0.05 * L, 0.032 * L, 0.02 * L],
        8,
        4,
        s,
        c.dark,
      );
    }
    if (cat) {
      b.ellipsoid(
        'markings',
        at(0.19 * W, -0.12 * H, end - 0.02 * L),
        dir,
        [0.22 * W, 0.17 * H, 0.12 * L],
        12,
        6,
        s,
        c.markings,
      );
      if (tier === 0)
        for (let row = 0; row < 3; row++) {
          const y = (-0.11 + row * 0.07) * H;
          tube(
            c,
            'markings',
            [
              at(0.31 * W, y, end + 0.03 * L),
              at(0.61 * W, y + 0.02 * H, end + 0.02 * L),
              at(0.87 * W, y + (row - 1) * 0.1 * H, end - 0.04 * L),
            ],
            [0.0035 * L, 0.0025 * L, 0.0012 * L],
            [s, s, s],
            scaleColor(c.markings, 0.75),
            4,
          );
        }
    }
  }
  const sideEar = cow || sheep || d.species === 'deer';
  buildEar(
    c,
    at(
      (sideEar ? 0.46 : cat || horse ? 0.32 : 0.4) * W,
      (sideEar ? 0.1 : cat || horse ? 0.34 : 0.25) * H,
      0.04 * L,
    ),
    fur,
  );
  if (d.features.horns !== 'none') {
    const root = at(0.32 * W, 0.37 * H, 0.04 * L),
      antler = d.features.horns === 'antlers';
    const length = (antler ? 1.2 : d.features.horns === 'short' ? 0.55 : 0.9) * L;
    const offsets: Vec3[] = antler
      ? [
          [0, 0, 0],
          [0.18, 0.35, -0.12],
          [0.35, 0.7, -0.2],
          [0.48, 1, -0.14],
        ]
      : [
          [0, 0, 0],
          [0.32, 0.12, 0],
          [0.52, 0.4, -0.04],
          [0.5, 0.73, -0.08],
        ];
    const points = offsets.map((p) => add(root, scale(p, length)));
    const hornColor = antler ? parseColor('#8e7652') : parseColor('#c7bca1');
    tube(
      c,
      'markings',
      points,
      [0.075 * L, 0.06 * L, 0.035 * L, 0.006 * L],
      [s, s, s, s],
      hornColor,
      tier === 0 ? 8 : 6,
    );
    if (antler)
      for (let i = 1; i <= (tier === 2 ? 1 : 3); i++) {
        const from = points[Math.min(i, 2)] as Vec3;
        tube(
          c,
          'markings',
          [
            from,
            add(from, [(-0.13 + i * 0.1) * length, 0.22 * length, 0.14 * length]),
            add(from, [(0.02 + i * 0.09) * length, 0.45 * length, 0.19 * length]),
          ],
          [0.035 * L, 0.024 * L, 0.004 * L],
          [s, s, s],
          hornColor,
          6,
        );
      }
  }
  b.mirrorX(mark, (j) => J(mirrorName(c.rig.joints[j]?.name ?? 'root')));
}

function buildEar(c: AnimalContext, base: Vec3, fur: ReturnType<typeof parseColor>): void {
  const { d, m, b, J, tier } = c;
  if (d.features.ears === 'none' || m.earLen <= 0) return;
  const floppy = d.features.ears === 'floppy',
    lateral = d.species === 'cow' || d.species === 'sheep';
  const round = d.features.ears === 'round';
  const direction = unit(
    floppy
      ? lateral
        ? [1, -0.18, 0]
        : [0.65, -0.9, 0.12]
      : d.species === 'deer'
        ? [0.85, 0.6, 0]
        : [0.3, 1, -0.08],
  );
  const across: Vec3 = [direction[1], -direction[0], 0];
  const len = m.earLen * (floppy ? 1.7 : round ? 0.85 : 1.3),
    width = m.earLen * (lateral ? 0.5 : 0.48);
  const s = skin(J('ear.l'));
  // A closed leaf with a cupped front, a convex back, and an inset inner-ear surface.
  const outline: [number, number][] = [
    [0, -0.35],
    [0.4, -1],
    [0.78, round ? -0.7 : -0.5],
    [1, 0],
    [0.78, round ? 0.7 : 0.5],
    [0.4, 1],
    [0, 0.35],
  ];
  const point = (t: number, w: number, z: number) =>
    add(base, add(scale(direction, t * len), add(scale(across, w * width), [0, 0, z * len])));
  const edge = outline.map(([t, w]) => b.vertex(point(t, w, 0), fur, s));
  const front = b.vertex(point(0.42, 0, 0.07), fur, s),
    back = b.vertex(point(0.42, 0, -0.1), scaleColor(fur, 0.85), s);
  for (let i = 0; i < edge.length; i++) {
    const a = edge[i] as number,
      z = edge[(i + 1) % edge.length] as number;
    b.triangle('skin', front, z, a);
    b.triangle('skin', back, a, z);
  }
  if (tier !== 2) {
    const inner = outline.map(([t, w]) =>
      b.vertex(point(0.12 + t * 0.72, w * 0.64, 0.05), colorMix(c.pink, fur, 0.45), s),
    );
    const center = b.vertex(point(0.42, 0, 0.078), colorMix(c.pink, fur, 0.2), s);
    for (let i = 0; i < inner.length; i++)
      b.triangle('markings', center, inner[(i + 1) % inner.length] as number, inner[i] as number);
  }
}
