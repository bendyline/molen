import {
  extrude,
  fbox,
  opening,
  outwardRing,
  quad4,
  roundArch,
  tri,
  wallFace,
} from './place-recipe-kit.mjs';

const surface = 'palette:#ffffff';

export const courtyardWalls = (ring) => {
  const points = outwardRing(ring);
  return points.map((point, i) => wallFace(point, points[(i + 1) % points.length]));
};

/** A surveyed wing with piecewise planar roofs and optional courtyard holes. */
export function roofedWing(out, wing, wallSlot, wallColor, roofSlot, roofColor) {
  const { ring, holes = [], base, eave, panels } = wing;
  extrude(out, wallSlot, ring, base, eave, wallColor, {
    holes,
    top: panels.length === 0,
    topSlot: roofSlot,
    topColor: roofColor,
  });
  for (const { ring: face, holes: openings, plane, skirts } of panels) {
    const height = ([x, z]) => plane[0] * x + plane[1] * z + plane[2];
    if (
      !out.addCap(roofSlot, surface, face, openings, height, [0, 1, 0], (point) => point, roofColor)
    ) {
      throw new Error('Roof panel could not be triangulated');
    }
    for (const [a, b] of skirts) {
      const topA = [a[0], height(a), a[1]];
      const topB = [b[0], height(b), b[1]];
      const lowA = [a[0], eave, a[1]];
      const lowB = [b[0], eave, b[1]];
      if (topB[1] - eave > 0.001) tri(out, wallSlot, lowA, lowB, topB, wallColor);
      if (topA[1] - eave > 0.001) tri(out, wallSlot, lowA, topB, topA, wallColor);
    }
  }
}

/** Repeated façade bays with inexpensive flat panes at district distance. */
export function facadeWindows(out, wall, y, width, height, count, detail, style) {
  for (let i = 0; i < count; i++) {
    const u = (wall.length * (i + 0.5)) / count;
    opening(out, wall, u, y, width, height, {
      ...style,
      frameWidth: detail > 1 ? (style.frameWidth ?? 0.14) : 0,
      mullions: detail > 1 ? (style.mullions ?? 1) : 0,
      transoms: detail > 2 ? (style.transoms ?? 1) : 0,
      sill: detail > 1,
    });
  }
}

/** A masonry screen with through-open arches and modeled soffits. */
export function openArcade(out, wall, spec) {
  const {
    count,
    start = 0,
    end = wall.length,
    bottom,
    top,
    spring,
    depth,
    slot,
    color,
    steps = 5,
    shallow = false,
  } = spec;
  const bay = (end - start) / count;
  const radius = bay * (spec.openRatio ?? 0.42);
  const p = wall.P;
  const pier = (a, b) => {
    if (shallow) quad4(out, slot, p(a, bottom), p(b, bottom), p(b, top), p(a, top), color);
    else fbox(out, slot, wall, a, b, bottom, top, -depth, 0, color, { bottom: true });
  };
  pier(start, start + bay / 2 - radius);
  pier(end - bay / 2 + radius, end);
  for (let i = 1; i < count; i++) {
    const u = start + i * bay;
    pier(u - bay / 2 + radius, u + bay / 2 - radius);
  }
  for (let i = 0; i < count; i++) {
    const center = start + (i + 0.5) * bay;
    const profile = roundArch(radius, steps);
    for (let j = 1; j < profile.length; j++) {
      const [u, y] = profile[j - 1];
      const [v, h] = profile[j];
      const x = center + u;
      const z = center + v;
      const a = spring + y;
      const b = spring + h;
      quad4(out, slot, p(x, a), p(z, b), p(z, top), p(x, top), color);
      if (!shallow) {
        quad4(
          out,
          slot,
          p(z, b, -depth),
          p(x, a, -depth),
          p(x, top, -depth),
          p(z, top, -depth),
          color,
        );
        quad4(out, slot, p(x, a, -depth), p(z, b, -depth), p(z, b), p(x, a), color);
      }
    }
    if (!shallow) {
      quad4(
        out,
        slot,
        p(center - radius, top),
        p(center + radius, top),
        p(center + radius, top, -depth),
        p(center - radius, top, -depth),
        color,
      );
    }
  }
}
