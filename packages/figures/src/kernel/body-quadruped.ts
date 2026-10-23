/** Species-shaped ribcage, abdomen and neck, sharing the existing animated quadruped rig. */
import { dmath, type Vec3 } from '@bendyline/molen-kernel/determinism';
import { buildAnimalHead } from './body-animal-head';
import { buildAnimalLegs, buildAnimalTail } from './body-animal-parts';
import { add, animalContext, coat, mix, scale, sub, surfaceRing, unit } from './body-animal-shape';
import { parseColor } from './color';
import { type FigureRig, mirrorName } from './rig';
import {
  blend,
  type FigureTier,
  type RingRef,
  type SkinnedMeshBuilder,
  skin,
} from './skinned-mesh-builder';
import type { ResolvedFigureDescriptor } from './types';

export function buildQuadrupedBody(
  d: ResolvedFigureDescriptor,
  rig: FigureRig,
  tier: FigureTier,
  b: SkinnedMeshBuilder,
): void {
  const c = animalContext(d, rig, tier, b),
    { m, J, P, fur } = c;
  const r = m.bodyRadius,
    hips = P('hips'),
    chest = P('chest');
  const heavy = d.species === 'cow' || d.species === 'sheep';
  const tuck =
    d.species === 'dog' ? 0.52 : d.species === 'cat' ? 0.64 : d.species === 'deer' ? 0.62 : 0.85;
  // z from rump to brisket; separate upper/lower radii give a level back and a real belly tuck.
  const profile: [number, number, number, number][] = [
    [hips[2] - 0.8 * r, 0.18, 0.35, 0.36],
    [hips[2] - 0.55 * r, 0.64, 0.78, 0.72],
    [hips[2] - 0.18 * r, 0.86, 0.96, 0.85],
    [hips[2] + 0.2 * r, 0.9, 0.98, heavy ? 1.08 : 0.8],
    [hips[2] * 0.52, heavy ? 1.02 : 0.76, 0.94, tuck],
    [0, heavy ? 1.14 : 0.89, 0.96, heavy ? 1.25 : 0.9],
    [chest[2] * 0.48, heavy ? 1.1 : 0.98, 0.98, heavy ? 1.25 : 1.13],
    [chest[2] * 0.85, 0.91, 1, 1.18],
    [chest[2] + 0.22 * r, 0.81, 0.93, 1.12],
    [chest[2] + 0.65 * r, 0.6, 0.7, 0.84],
    [chest[2] + 0.87 * r, 0.22, 0.35, 0.44],
  ];
  const sections: [number, number, number, number][] = [];
  const subdivisions = tier === 0 ? (d.species === 'cow' ? 3 : 2) : 1;
  for (let i = 0; i < profile.length - 1; i++) {
    const a = profile[i] as [number, number, number, number];
    const z = profile[i + 1] as [number, number, number, number];
    for (let step = 0; step < subdivisions; step++) {
      const t = step / subdivisions;
      sections.push(
        a.map((value, k) => {
          if (k === 0) return dmath.lerp(value, z[k] as number, t);
          const before = profile[Math.max(0, i - 1)]?.[k] as number;
          const after = profile[Math.min(profile.length - 1, i + 2)]?.[k] as number;
          const end = z[k] as number;
          return (
            0.5 *
            (2 * value +
              (-before + end) * t +
              (2 * before - 5 * value + 4 * end - after) * t * t +
              (-before + 3 * value - 3 * end + after) * t * t * t)
          );
        }) as [number, number, number, number],
      );
    }
  }
  sections.push(profile[profile.length - 1] as [number, number, number, number]);
  let previous: RingRef | undefined;
  for (let i = 0; i < sections.length; i++) {
    if (tier === 2 && [1, 3, 6, 8].includes(i)) continue;
    const [z, w, top, bottom] = sections[i] as [number, number, number, number];
    const back = z < 0,
      t = dmath.clamp(back ? (z - hips[2]) / -hips[2] : z / chest[2], 0, 1);
    const s = back
      ? blend(J('hips'), 1 - t, J('spine'), t)
      : blend(J('spine'), 1 - t, J('chest'), t);
    const ring = surfaceRing(
      c,
      'skin',
      [0, m.legY, z],
      [0, 1, 0],
      w * r,
      top * r,
      bottom * r,
      tier === 0 ? (d.species === 'cow' ? 48 : 24) : c.sides,
      s,
      (p, _x, y) => coat(c, p, y),
      d.species === 'sheep' && tier !== 2 ? 0.055 : 0,
      i * 1.8,
    );
    if (previous) b.loft('skin', previous, ring);
    else b.cap('skin', ring, s, fur, [0, m.legY, z - 0.06 * r], false);
    if (i === sections.length - 1) b.cap('skin', ring, s, fur, [0, m.legY, z + 0.05 * r], true);
    previous = ring;
  }

  const neck = P('neck'),
    head = P('head'),
    dir = unit(sub(head, neck));
  const up: Vec3 = [0, dir[2], -dir[1]];
  const equine = d.species === 'horse',
    feline = d.species === 'cat';
  const base = add(neck, scale(dir, -0.5 * r));
  previous = undefined;
  const neckSections = tier === 0 ? 6 : tier === 1 ? 4 : 3;
  for (let i = 0; i <= neckSections; i++) {
    const t = i / neckSections;
    const width = dmath.lerp(0.82, feline ? 0.42 : 0.4, t) * r;
    const depth = dmath.lerp(equine ? 1.08 : 0.82, equine ? 0.6 : 0.43, t) * r;
    const s =
      t < 0.45
        ? blend(J('chest'), 1 - t / 0.45, J('neck'), t / 0.45)
        : blend(J('neck'), 1 - (t - 0.45) * 1.3, J('head'), (t - 0.45) * 1.3);
    const ring = surfaceRing(
      c,
      'skin',
      mix(base, head, t),
      up,
      width,
      depth,
      depth,
      c.sides,
      s,
      (p, _x, y) => coat(c, p, y),
    );
    if (previous) b.loft('skin', previous, ring);
    previous = ring;
  }
  // A thin collar follows the widened throat and is emitted only once, outside the mirror pass.
  if (d.species === 'dog' || feline) {
    const accent = parseColor(d.palette.accent);
    const a = b.ring(
      'accent',
      mix(base, head, 0.31),
      dir,
      0.704 * r,
      0.711 * r,
      c.sides,
      skin(J('neck')),
      accent,
    );
    const z = b.ring(
      'accent',
      mix(base, head, 0.38),
      dir,
      0.675 * r,
      0.684 * r,
      c.sides,
      skin(J('neck')),
      accent,
    );
    b.loft('accent', a, z);
  }
  if (d.features.mane) {
    // Hair sits on the dorsal crest, leaving the throat and cheek visible.
    let last: RingRef | undefined;
    for (let i = 0; i <= neckSections; i++) {
      const t = i / neckSections,
        depth = dmath.lerp(equine ? 1.08 : 0.82, equine ? 0.6 : 0.43, t) * r;
      const center = add(mix(base, head, t), scale(up, depth * 0.95));
      const s = blend(J('neck'), 1 - t * 0.7, J('head'), t * 0.7);
      const ring = b.ring('hair', center, dir, 0.13 * r, 0.23 * r, c.limbSides, s, c.hair);
      if (last) b.loft('hair', last, ring);
      else b.cap('hair', ring, s, c.hair, undefined, false);
      if (i === neckSections) b.cap('hair', ring, s, c.hair, undefined, true);
      last = ring;
    }
  }
  buildAnimalTail(c);
  buildAnimalHead(c);
  const mark = b.mark();
  buildAnimalLegs(c);
  b.mirrorX(mark, (joint) => J(mirrorName(rig.joints[joint]?.name ?? 'root')));
}
