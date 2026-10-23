/** Muscle envelopes, grounded paws/cloven hooves and species-specific animated tails. */
import { dmath, type Vec3 } from '@bendyline/molen-kernel/determinism';
import { type AnimalContext, add, coat, tube } from './body-animal-shape';
import { parseColor, scaleColor } from './color';
import { blend, type RingRef, type Skin, skin } from './skinned-mesh-builder';

export function buildAnimalLegs(c: AnimalContext): void {
  const { m, b, d, J, P, tier, fur } = c,
    R = m.limbRadius;
  for (const leg of ['fl', 'hl'] as const) {
    const hind = leg === 'hl',
      upper = P(`upperLeg.${leg}`),
      toes = P(`toes.${leg}`);
    const upperJ = J(`upperLeg.${leg}`),
      lowerJ = J(`lowerLeg.${leg}`),
      footJ = J(`foot.${leg}`),
      toeJ = J(`toes.${leg}`);
    const parent = J(hind ? 'hips' : 'chest');
    const samples: [number, number, number, number][] = [
      [-0.25, 0.35, 0.6, 0],
      [-0.12, 1.2, 1.6, 0],
      [0.06, hind ? 2.65 : 2.1, hind ? 3.1 : 2.5, hind ? 0.02 : -0.015],
      [0.2, hind ? 2.2 : 1.8, hind ? 2.5 : 2.1, hind ? 0.045 : -0.025],
      [0.38, hind ? 1.3 : 1.15, hind ? 1.5 : 1.2, hind ? 0.055 : -0.035],
      [0.51, hind ? 1.05 : 0.94, hind ? 1.2 : 1.1, hind ? 0.015 : -0.01],
      [0.68, hind ? 0.92 : 0.85, hind ? 1.08 : 0.91, hind ? -0.05 : 0.005],
      [0.81, 0.68, 0.76, hind ? -0.03 : 0],
      [0.91, 0.76, 0.82, 0.005],
      [0.96, 0.85, 0.9, 0.015],
    ];
    let previous: RingRef | undefined;
    for (let i = 0; i < samples.length; i++) {
      if (tier === 2 && [1, 4, 6].includes(i)) continue;
      const [t, w, depth, z] = samples[i] as [number, number, number, number];
      // The scapula/haunch starts inside the ribcage, then expands over the leg joint.
      // Keeping every upper ring on the leg's lateral axis creates a visible shoulder fin.
      const inset = dmath.clamp((t + 0.25) / 0.31, 0, 1);
      const center: Vec3 = [
        upper[0] * (0.3 + 0.7 * inset),
        upper[1] - t * m.legY,
        upper[2] + z * d.height,
      ];
      const s: Skin =
        t < 0.15
          ? blend(
              parent,
              dmath.clamp((0.15 - t) / 0.28, 0, 1),
              upperJ,
              dmath.clamp((t + 0.13) / 0.28, 0, 1),
            )
          : t < 0.51
            ? blend(
                upperJ,
                1 - dmath.clamp((t - 0.25) / 0.26, 0, 1),
                lowerJ,
                dmath.clamp((t - 0.25) / 0.26, 0, 1),
              )
            : t < 0.81
              ? blend(lowerJ, 1 - (t - 0.51) / 0.3, footJ, (t - 0.51) / 0.3)
              : blend(footJ, 1 - (t - 0.81) / 0.19, toeJ, (t - 0.81) / 0.19);
      const color = d.species === 'sheep' ? (t < 0.25 ? fur : c.markings) : coat(c, center, 0.3);
      const muscle = d.species === 'cat' && t < 0.3 ? 0.8 : 1;
      const ring = b.ring(
        'skin',
        center,
        [0, -1, 0],
        w * R * muscle,
        depth * R * muscle,
        c.limbSides,
        s,
        color,
      );
      if (previous) b.loft('skin', previous, ring);
      else b.cap('skin', ring, s, color, undefined, false);
      if (i === samples.length - 1) b.cap('skin', ring, s, color, undefined, true);
      previous = ring;
    }
    const hoof = d.features.feet === 'unguligrade';
    const cloven = hoof && d.species !== 'horse';
    const s = skin(toeJ),
      width = R * (hoof ? 1.05 : 1.23),
      depth = R * (hoof ? 1.35 : 1.65);
    const height = (hoof ? 0.095 : 0.075) * d.height;
    const color = hoof
      ? scaleColor(parseColor(d.palette.shoes), 0.24)
      : parseColor(d.palette.shoes);
    for (let half = 0; half < (cloven ? 2 : 1); half++) {
      const x = toes[0] + (cloven ? (half === 0 ? -0.53 : 0.53) * width : 0),
        w = cloven ? width * 0.46 : width;
      const z = toes[2] + 0.25 * depth;
      const sole = b.ring('shoes', [x, 0, z], [0, 1, 0], w, depth, c.limbSides, s, color);
      const lower = b.ring(
        'shoes',
        [x, height * 0.25, z],
        [0, 1, 0],
        w * 1.02,
        depth,
        c.limbSides,
        s,
        color,
      );
      const upperRing = b.ring(
        'shoes',
        [x, height * 0.82, z - depth * 0.16],
        [0, 1, 0],
        w * 0.82,
        depth * 0.76,
        c.limbSides,
        s,
        color,
      );
      const top = b.ring(
        'shoes',
        [x, height, z - depth * 0.25],
        [0, 1, 0],
        w * 0.63,
        depth * 0.5,
        c.limbSides,
        s,
        color,
      );
      b.cap('shoes', sole, s, color, undefined, false);
      b.loft('shoes', sole, lower);
      b.loft('shoes', lower, upperRing);
      b.loft('shoes', upperRing, top);
      b.cap('shoes', top, s, color, undefined, true);
    }
    if (!hoof && tier !== 2)
      for (let toe = 0; toe < 4; toe++) {
        b.ellipsoid(
          'shoes',
          [
            toes[0] + (toe - 1.5) * width * 0.46,
            height * 0.36,
            toes[2] + depth * (0.84 - (toe === 0 || toe === 3 ? 0.13 : 0)),
          ],
          [0, 0, 1],
          [width * 0.27, height * 0.35, depth * 0.48],
          tier === 0 ? 8 : 6,
          4,
          s,
          color,
        );
      }
  }
}

export function buildAnimalTail(c: AnimalContext): void {
  const { m, d, P, J, b, tier } = c;
  if (d.features.tail === 'none' || m.tailLen <= 0) return;
  const root = P('tail.0'),
    r = m.bodyRadius,
    L = m.tailLen * (d.features.tail === 'short' ? 0.5 : 1);
  const short = d.features.tail === 'short',
    bushy = d.features.tail === 'bushy';
  const horse = d.species === 'horse',
    cow = d.species === 'cow',
    cat = d.species === 'cat';
  const count = tier === 0 ? 10 : tier === 1 ? 6 : 4;
  const points: Vec3[] = [],
    radii: number[] = [],
    weights: Skin[] = [];
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    let offset: Vec3;
    if (short) offset = [0, -0.12 * L * t, -L * t];
    else if (horse || cow)
      offset = [0, -L * 0.96 * t, -L * (0.16 * t + 0.1 * dmath.sin(t * dmath.PI))];
    else
      offset = [0, L * (cat ? 0.12 : 0.1) * dmath.sin(t * dmath.PI) - L * 0.28 * t, -L * 0.9 * t];
    const p = add(root, offset);
    // Long user-authored tails remain above the ground in their bind pose.
    p[1] = dmath.max(0.025 * d.height, p[1]);
    points.push(p);
    const thickness = horse ? 0.19 : cow ? 0.052 : cat ? 0.14 : short ? 0.23 : 0.17;
    radii.push(
      r * thickness * (bushy ? 2 : 1) * (0.18 + 0.82 * dmath.sin((0.48 + 0.48 * t) * dmath.PI)),
    );
    weights.push(
      t < 0.5
        ? blend(J('tail.0'), 1 - 2 * t, J('tail.1'), 2 * t)
        : blend(J('tail.1'), 2 - 2 * t, J('tail.2'), 2 * t - 1),
    );
  }
  tube(
    c,
    horse || bushy ? 'hair' : 'skin',
    points,
    radii,
    weights,
    horse || bushy ? c.hair : c.fur,
    tier === 0 ? 12 : 8,
  );
  if (cow) {
    const tip = points[points.length - 1] as Vec3;
    b.ellipsoid(
      'hair',
      add(tip, [0, 0.04 * d.height, 0]),
      [0, 1, 0],
      [0.09 * r, 0.09 * r, 0.07 * d.height],
      c.limbSides,
      6,
      skin(J('tail.2')),
      scaleColor(c.markings, 0.7),
    );
  }
  if (horse && tier === 0) {
    // Narrow tonal strands follow the tail envelope and its existing three bone weights.
    for (const sign of [-1, 1]) {
      const strand = points.map((p, i) =>
        add(p, [sign * (radii[i] as number) * 0.55, 0, (radii[i] as number) * 0.7]),
      );
      tube(
        c,
        'hair',
        strand,
        radii.map((rr) => rr * 0.13),
        weights,
        scaleColor(c.hair, 1.45),
        4,
      );
    }
  }
}
