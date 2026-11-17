/** Optional architectural details in the facade's own edge frame, never a fixed-size model. */
import { dmath } from '@bendyline/molen-kernel/determinism';
import type { FacadeInput } from './facade';
import { type MeshBufferBuilder, normalize3 } from './mesh-buffers';
import type { RGB, Vec2, Vec3 } from './types';

export interface FacadeDetailEdge {
  a: Vec2;
  dir: Vec2;
  normal: Vec3;
  length: number;
  top: number;
  key: number;
}

export interface FacadeDetailWindow {
  s0: number;
  s1: number;
  y0: number;
  y1: number;
  floor: number;
  bay: number;
  storefront?: boolean;
}

/** Shared by all edges of one building, keeping ornament bounded even on huge outlines. */
export interface FacadeDetailBudget {
  remaining: number;
}

/**
 * A step in front of a doorway under a small canopy on two posts: what makes a door in a flat
 * wall an entrance. About sixty vertices, so a style gives it to a share of its buildings.
 */
export function buildPorch(
  edge: FacadeDetailEdge,
  input: FacadeInput,
  porch: { depth: number; canopy: 'none' | 'flat' | 'pitched' },
  doorStart: number,
  doorEnd: number,
  floor: number,
  doorTop: number,
  out: MeshBufferBuilder,
): void {
  const side = 0.38;
  const s0 = Math.max(0.05, doorStart - side);
  const s1 = Math.min(edge.length - 0.05, doorEnd + side);
  const depth = Math.min(porch.depth, Math.max(0.4, (s1 - s0) * 0.8));
  if (s1 - s0 < 0.9) return;
  const point = (s: number, y: number, d: number): Vec3 => [
    edge.a[0] + edge.dir[0] * s + edge.normal[0] * d,
    y,
    edge.a[1] + edge.dir[1] * s + edge.normal[2] * d,
  ];
  const face = (
    p: [Vec3, Vec3, Vec3, Vec3],
    normal: Vec3,
    width: number,
    height: number,
    surface: FacadeInput['trim'],
  ): void =>
    out.addQuad(
      surface.slot,
      surface.ref,
      p,
      normal,
      [
        [0, 0],
        [width, 0],
        [width, height],
        [0, height],
      ],
      surface.color,
    );
  // The step: a cast slab that runs into the ground, so it meets a lawn that falls away.
  const stone = { ...input.trim, color: [0.62, 0.61, 0.58] as RGB };
  const top = floor + 0.02;
  const sunk = floor - 0.6;
  face(
    [point(s0, top, 0), point(s1, top, 0), point(s1, top, depth), point(s0, top, depth)],
    [0, 1, 0],
    s1 - s0,
    depth,
    stone,
  );
  face(
    [point(s0, sunk, depth), point(s1, sunk, depth), point(s1, top, depth), point(s0, top, depth)],
    edge.normal,
    s1 - s0,
    top - sunk,
    stone,
  );
  for (const [s, sign] of [
    [s0, -1],
    [s1, 1],
  ] as const)
    face(
      [point(s, sunk, 0), point(s, sunk, depth), point(s, top, depth), point(s, top, 0)],
      [edge.dir[0] * sign, 0, edge.dir[1] * sign],
      depth,
      top - sunk,
      stone,
    );
  if (porch.canopy === 'none') return;
  const roof = porch.canopy === 'pitched' ? (input.roof ?? input.trim) : input.trim;
  const high = Math.min(edge.top - 0.1, doorTop + 0.42);
  const drop = porch.canopy === 'pitched' ? Math.min(0.34, depth * 0.3) : 0;
  if (high - floor < 2.2) return;
  const reach = depth + 0.12;
  const normal = normalize3([(edge.normal[0] * drop) / reach, 1, (edge.normal[2] * drop) / reach]);
  face(
    [
      point(s0, high, 0),
      point(s1, high, 0),
      point(s1, high - drop, reach),
      point(s0, high - drop, reach),
    ],
    normal,
    s1 - s0,
    dmath.hypot(reach, drop),
    roof,
  );
  face(
    [
      point(s0, high - 0.09, 0),
      point(s1, high - 0.09, 0),
      point(s1, high - drop - 0.09, reach),
      point(s0, high - drop - 0.09, reach),
    ],
    [-normal[0], -normal[1], -normal[2]],
    s1 - s0,
    reach,
    input.trim,
  );
  face(
    [
      point(s0, high - drop - 0.13, reach),
      point(s1, high - drop - 0.13, reach),
      point(s1, high - drop, reach),
      point(s0, high - drop, reach),
    ],
    edge.normal,
    s1 - s0,
    0.13,
    input.trim,
  );
  // Two posts, drawn as their street and outer faces: the others face the door.
  const post = 0.1;
  for (const [s, sign] of [
    [s0, -1],
    [s1 - post, 1],
  ] as const) {
    const y1 = high - drop - 0.11;
    face(
      [
        point(s, top, depth - 0.04),
        point(s + post, top, depth - 0.04),
        point(s + post, y1, depth - 0.04),
        point(s, y1, depth - 0.04),
      ],
      edge.normal,
      post,
      y1 - top,
      input.trim,
    );
    const outer = sign < 0 ? s : s + post;
    face(
      [
        point(outer, top, depth - 0.04 - post),
        point(outer, top, depth - 0.04),
        point(outer, y1, depth - 0.04),
        point(outer, y1, depth - 0.04 - post),
      ],
      [edge.dir[0] * sign, 0, edge.dir[1] * sign],
      post,
      y1 - top,
      input.trim,
    );
  }
}

export function buildFacadeDetails(
  edge: FacadeDetailEdge,
  input: FacadeInput,
  windows: readonly FacadeDetailWindow[],
  out: MeshBufferBuilder,
  budget: FacadeDetailBudget,
): void {
  const details = input.details;
  if (!details || budget.remaining < 20) return;
  const trim = input.trim;
  const roof = input.roof ?? trim;
  const point = (s: number, y: number, depth: number): Vec3 => [
    edge.a[0] + edge.dir[0] * s + edge.normal[0] * depth,
    y,
    edge.a[1] + edge.dir[1] * s + edge.normal[2] * depth,
  ];
  const blocked = (s0: number, s1: number, y0: number, y1: number, glazing = true): boolean =>
    (glazing &&
      windows.some(
        (w) => s0 < w.s1 + 0.11 && s1 > w.s0 - 0.11 && y0 < w.y1 + 0.11 && y1 > w.y0 - 0.11,
      )) ||
    (input.structuralOpenings?.some(
      (o) =>
        o.edge === edge.key &&
        s0 < (o.end ?? edge.length) + 0.13 &&
        s1 > (o.start ?? 0) - 0.13 &&
        y0 < o.top + 0.13 &&
        y1 > o.bottom - 0.13,
    ) ??
      false);
  const quad = (
    p: [Vec3, Vec3, Vec3, Vec3],
    normal: Vec3,
    width: number,
    height: number,
    surface = trim,
  ): void => {
    if (budget.remaining < 4) return;
    budget.remaining -= 4;
    out.addQuad(
      surface.slot,
      surface.ref,
      p,
      normal,
      [
        [0, 0],
        [width, 0],
        [width, height],
        [0, height],
      ],
      surface.color,
    );
  };
  const box = (
    s0: number,
    s1: number,
    y0: number,
    y1: number,
    d0: number,
    d1: number,
    surface = trim,
  ): void => {
    if (budget.remaining < 24 || s1 <= s0 || y1 <= y0) return;
    const width = s1 - s0,
      height = y1 - y0,
      depth = d1 - d0;
    for (const [d, sign] of [
      [d0, -1],
      [d1, 1],
    ] as const)
      quad(
        [point(s0, y0, d), point(s1, y0, d), point(s1, y1, d), point(s0, y1, d)],
        [edge.normal[0] * sign, 0, edge.normal[2] * sign],
        width,
        height,
        surface,
      );
    for (const [s, sign] of [
      [s0, -1],
      [s1, 1],
    ] as const)
      quad(
        [point(s, y0, d0), point(s, y0, d1), point(s, y1, d1), point(s, y1, d0)],
        [edge.dir[0] * sign, 0, edge.dir[1] * sign],
        depth,
        height,
        surface,
      );
    for (const [y, sign] of [
      [y0, -1],
      [y1, 1],
    ] as const)
      quad(
        [point(s0, y, d0), point(s1, y, d0), point(s1, y, d1), point(s0, y, d1)],
        [0, sign, 0],
        width,
        depth,
        surface,
      );
  };
  const canopy = (s0: number, s1: number, y: number, depth: number): void => {
    const drop = Math.min(0.38, depth * 0.24);
    const n = normalize3([(edge.normal[0] * drop) / depth, 1, (edge.normal[2] * drop) / depth]);
    quad(
      [point(s0, y, 0), point(s1, y, 0), point(s1, y - drop, depth), point(s0, y - drop, depth)],
      n,
      s1 - s0,
      dmath.hypot(depth, drop),
      roof,
    );
    quad(
      [
        point(s0, y - 0.055, 0),
        point(s1, y - 0.055, 0),
        point(s1, y - drop - 0.055, depth),
        point(s0, y - drop - 0.055, depth),
      ],
      [-n[0], -n[1], -n[2]],
      s1 - s0,
      depth,
      roof,
    );
    box(s0, s1, y - drop - 0.13, y - drop, depth - 0.04, depth + 0.025);
  };
  const corner = Math.min(0.25, edge.length * 0.08);
  const usable = edge.length - 2 * input.cornerMargin;
  const bays = Math.floor(usable / input.bayWidth);
  const start = (edge.length - bays * input.bayWidth) / 2;
  const framing = details.framing;
  if (framing && bays > 0) {
    const w = Math.min(framing.width, input.bayWidth * 0.15);
    const stride = Math.max(1, Math.ceil((bays + 1) / 16));
    for (let i = 0; i <= bays; i += stride) {
      const s = start + i * input.bayWidth;
      if (blocked(s - w / 2, s + w / 2, input.base, edge.top)) continue;
      box(
        s - w / 2,
        s + w / 2,
        input.base,
        edge.top - 0.12,
        0.015,
        framing.style === 'timber' ? 0.1 : 0.22,
      );
      if (framing.style === 'pilasters') {
        box(s - w, s + w, edge.top - 0.3, edge.top - 0.12, 0.015, 0.29);
        box(s - w, s + w, input.base, input.base + 0.22, 0.015, 0.28);
      }
    }
    if (framing.style === 'timber') {
      // Diagonal braces stay inside the solid spandrel below each actual window.
      for (const window of windows.slice(0, 32)) {
        const floorBase =
          input.base +
          (window.floor === 0
            ? 0
            : input.groundFloorHeight + (window.floor - 1) * input.floorHeight);
        const y0 = floorBase + w,
          y1 = window.y0 - w / 2 - 0.16;
        const s0 = window.s0,
          s1 = window.s1;
        if (y1 - y0 < 0.3 || blocked(s0 - w / 2, s1 + w / 2, y0 - w / 2, y1 + w / 2)) continue;
        const length = dmath.hypot(s1 - s0, y1 - y0);
        const dx = ((-(y1 - y0) / length) * w) / 2,
          dy = (((s1 - s0) / length) * w) / 2;
        quad(
          [
            point(s0 + dx, y0 + dy, 0.11),
            point(s1 + dx, y1 + dy, 0.11),
            point(s1 - dx, y1 - dy, 0.11),
            point(s0 - dx, y0 - dy, 0.11),
          ],
          edge.normal,
          length,
          w,
        );
      }
    }
  }
  // Trim boards up the wall's ends: with the neighboring wall's board each outside corner reads as
  // a cased corner rather than two siding planes meeting. A board stands 2 cm proud, so its face
  // alone carries it (four vertices: dense suburbs spend their whole building budget).
  if (details.cornerBoards && edge.key < 4096 && edge.length >= 1.2) {
    const width = 0.13,
      depth = 0.02;
    for (const [s0, s1] of [
      [0, width],
      [edge.length - width, edge.length],
    ] as const) {
      if (blocked(s0, s1, input.base, edge.top)) continue;
      quad(
        [
          point(s0, input.base, depth),
          point(s1, input.base, depth),
          point(s1, edge.top, depth),
          point(s0, edge.top, depth),
        ],
        edge.normal,
        width,
        edge.top - input.base,
      );
    }
  }
  // Painted the dark tone of the trim, like the fallback entrance door, so they read on pale siding.
  const painted = {
    ...trim,
    color: (input.paint
      ? [input.paint[0], input.paint[1], input.paint[2]]
      : [trim.color[0] * 0.42, trim.color[1] * 0.42, trim.color[2] * 0.42]) as RGB,
  };
  // Hung on the wall against the window's 10 cm trim, about 5 cm thick: set off by a gap and
  // standing proud of the siding, they read as boards floating beside the window.
  const shutters = (s0: number, s1: number, y0: number, y1: number): void => {
    const width = Math.min((s1 - s0) * 0.35, (input.bayWidth - (s1 - s0)) * 0.36, 0.55);
    for (const [a, b, side] of [
      [s0 - width - 0.1, s0 - 0.1, -1],
      [s1 + 0.1, s1 + width + 0.1, 1],
    ]) {
      if (
        a === undefined ||
        b === undefined ||
        side === undefined ||
        width < 0.13 ||
        a < corner ||
        b > edge.length - corner ||
        // Its own window's clearance is the trim the leaf hangs against: test the leaf less its
        // inner 4 cm, which still keeps it off any neighboring window.
        blocked(side > 0 ? a + 0.04 : a, side < 0 ? b - 0.04 : b, y0, y1)
      )
        continue;
      box(a, b, y0, y1, 0.008, 0.055, painted);
      for (let row = 1; row < 4; row++) {
        const y = y0 + ((y1 - y0) * row) / 4;
        quad(
          [
            point(a + 0.03, y, 0.065),
            point(b - 0.03, y, 0.065),
            point(b - 0.03, y + 0.025, 0.065),
            point(a + 0.03, y + 0.025, 0.065),
          ],
          edge.normal,
          b - a,
          0.025,
          painted,
        );
      }
    }
  };
  if (details.shutters && input.windows?.style === 'punched')
    // Interior-backed houses replace the punched grid with structural windows; frame those too.
    for (const o of input.structuralOpenings ?? [])
      if (
        o.kind === 'window' &&
        o.edge === edge.key &&
        o.start !== undefined &&
        o.end !== undefined
      )
        shutters(o.start, o.end, o.bottom, o.top);
  let balconies = 0;
  for (const window of windows.slice(0, 40)) {
    const { s0, s1, y0, y1 } = window;
    if (details.shutters && !window.storefront && input.windows?.style === 'punched')
      shutters(s0, s1, y0, y1);
    if (
      details.awnings &&
      y1 + 0.25 < edge.top &&
      !blocked(s0 - 0.13, s1 + 0.13, y1 + 0.12, y1 + 0.28)
    )
      canopy(
        Math.max(corner, s0 - 0.16),
        Math.min(edge.length - corner, s1 + 0.16),
        y1 + 0.22,
        Math.min(details.awnings.depth, (s1 - s0) * 0.8),
      );
    const balcony = details.balconies;
    if (
      !balcony ||
      edge.key >= 4096 ||
      window.floor === 0 ||
      window.bay % balcony.every !== 0 ||
      window.storefront ||
      balconies >= 4 ||
      s1 - s0 > input.bayWidth ||
      blocked(s0 - 0.2, s1 + 0.2, y0 - 0.2, y1, false)
    )
      continue;
    const a = Math.max(corner, s0 - 0.22),
      b = Math.min(edge.length - corner, s1 + 0.22);
    const depth = Math.min(balcony.depth, (b - a) * 0.7);
    const floor = y0 - 0.16;
    if (floor <= input.base || floor + 0.95 >= edge.top || budget.remaining < 240) continue;
    balconies++;
    box(a, b, floor - 0.12, floor, 0.015, depth + 0.05);
    const railBase = balcony.railing === 'solid' ? floor : floor + 0.82;
    box(a, b, railBase, floor + 0.93, depth - 0.06, depth + 0.03);
    box(a, a + 0.075, railBase, floor + 0.93, 0.04, depth);
    box(b - 0.075, b, railBase, floor + 0.93, 0.04, depth);
    if (balcony.railing === 'open') {
      const posts = Math.max(2, Math.min(7, Math.round((b - a) / 0.4)));
      for (let i = 0; i <= posts; i++) {
        const s = a + 0.035 + ((b - a - 0.07) * i) / posts;
        box(s - 0.024, s + 0.024, floor, floor + 0.86, depth - 0.055, depth + 0.005);
      }
    }
  }
  const veranda = details.veranda;
  if (
    veranda &&
    edge.key < 4096 &&
    !input.raised &&
    edge.top - input.base >= 2.7 &&
    edge.length >= 3
  ) {
    const depth = Math.min(veranda.depth, edge.length / 3);
    const y =
      input.base + Math.min(input.groundFloorHeight - 0.12, 3.1, edge.top - input.base - 0.16);
    if (y - input.base < 2.45 || blocked(corner, edge.length - corner, y - 0.16, y + 0.1, false))
      return;
    canopy(corner, edge.length - corner, y, depth);
    if (veranda.columns) {
      const count = Math.max(
        1,
        Math.min(10, Math.round((edge.length - 2 * corner) / Math.max(2.5, input.bayWidth))),
      );
      for (let i = 0; i <= count; i++) {
        const s = corner + 0.1 + ((edge.length - 2 * corner - 0.2) * i) / count;
        if (blocked(s - 0.12, s + 0.12, input.base, y, false)) continue;
        box(
          s - 0.075,
          s + 0.075,
          input.base,
          y - Math.min(0.38, depth * 0.24),
          depth - 0.12,
          depth + 0.03,
        );
      }
    }
  }
}
