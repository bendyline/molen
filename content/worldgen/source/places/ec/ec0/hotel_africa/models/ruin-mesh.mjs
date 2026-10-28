/** Parameter-driven structural pieces. Metric layout/sections come only from the later frozen plan. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

const ref = 'palette:#ffffff';
export function tools(out, colors) {
  const face = (key, points, normal) =>
    out.addConvexPolygon(
      key,
      ref,
      points,
      normal ?? normalFor(...points),
      (p) => [p[0], p[1]],
      colors[key],
    );
  const box = (key, [x, y, z], [X, Y, Z]) => {
    for (const [p, n] of [
      [
        [
          [x, y, z],
          [X, y, z],
          [X, Y, z],
          [x, Y, z],
        ],
        [0, 0, -1],
      ],
      [
        [
          [X, y, Z],
          [x, y, Z],
          [x, Y, Z],
          [X, Y, Z],
        ],
        [0, 0, 1],
      ],
      [
        [
          [x, y, Z],
          [x, y, z],
          [x, Y, z],
          [x, Y, Z],
        ],
        [-1, 0, 0],
      ],
      [
        [
          [X, y, z],
          [X, y, Z],
          [X, Y, Z],
          [X, Y, z],
        ],
        [1, 0, 0],
      ],
      [
        [
          [x, Y, z],
          [X, Y, z],
          [X, Y, Z],
          [x, Y, Z],
        ],
        [0, 1, 0],
      ],
      [
        [
          [x, y, Z],
          [X, y, Z],
          [X, y, z],
          [x, y, z],
        ],
        [0, -1, 0],
      ],
    ])
      face(key, p, n);
  };
  const cap = (key, ring, y, up = true) => {
    const b = new MeshBufferBuilder();
    if (
      !b.addCap(
        key,
        ref,
        ring,
        [],
        () => y,
        [0, up ? 1 : -1, 0],
        (p) => p,
        colors[key],
      )
    )
      throw Error('Ruin floor triangulation failed');
    const m = b.finalize();
    for (let i = 0; i < m.indices.length; i += 3) {
      const ps = Array.from(m.indices.slice(i, i + 3), (j) =>
        Array.from(m.positions.slice(j * 3, j * 3 + 3)),
      );
      out.addTriangle(
        key,
        ref,
        ps,
        [0, up ? 1 : -1, 0],
        ps.map((p) => [p[0], p[2]]),
        colors[key],
      );
    }
  };
  return { face, box, cap };
}
function columnSides(o, key, [x, y, z], [X, Y, Z]) {
  o.face(
    key,
    [
      [x, y, z],
      [X, y, z],
      [X, Y, z],
      [x, Y, z],
    ],
    [0, 0, -1],
  );
  o.face(
    key,
    [
      [X, y, Z],
      [x, y, Z],
      [x, Y, Z],
      [X, Y, Z],
    ],
    [0, 0, 1],
  );
  o.face(
    key,
    [
      [x, y, Z],
      [x, y, z],
      [x, Y, z],
      [x, Y, Z],
    ],
    [-1, 0, 0],
  );
  o.face(
    key,
    [
      [X, y, z],
      [X, y, Z],
      [X, Y, Z],
      [X, Y, z],
    ],
    [1, 0, 0],
  );
}
function doubleFace(o, key, p, n) {
  o.face(key, p, n);
  o.face(
    key,
    [...p].reverse(),
    n.map((v) => -v),
  );
}
export function local(out, origin, u, v) {
  const point = ([x, y, z]) => [
      origin[0] + u[0] * x + v[0] * z,
      y,
      origin[1] + u[1] * x + v[1] * z,
    ],
    normal = ([x, y, z]) => [u[0] * x + v[0] * z, y, u[1] * x + v[1] * z];
  return {
    addConvexPolygon: (k, r, p, n, uv, col) =>
      out.addConvexPolygon(k, r, p.map(point), normal(n), uv, col),
    addTriangle: (k, r, p, n, uv, col) => out.addTriangle(k, r, p.map(point), normal(n), uv, col),
  };
}

/** Complete repeated slab/frame body, with real front/back voids and a missing roof. */
export function roomWing(out, colors, wing, section, lod) {
  const o = tools(local(out, wing.origin, wing.u, wing.v), colors),
    L = wing.length,
    W = wing.width,
    floors = section.floorYs,
    t = section.slabThickness,
    cw = section.columnWidth,
    bays =
      lod === 0
        ? Math.max(2, Math.round(wing.bays / 4))
        : lod === 1
          ? Math.max(3, Math.round(wing.bays / 2))
          : wing.bays,
    pitch = L / bays,
    top = section.roofBeamY;
  for (const y of floors) {
    if (lod === 0) {
      o.face(
        'concrete',
        [
          [0, y, -W / 2],
          [L, y, -W / 2],
          [L, y, W / 2],
          [0, y, W / 2],
        ],
        [0, 1, 0],
      );
      o.face(
        'concrete',
        [
          [0, y - t, W / 2],
          [L, y - t, W / 2],
          [L, y - t, -W / 2],
          [0, y - t, -W / 2],
        ],
        [0, -1, 0],
      );
      for (const z of [-W / 2, W / 2])
        o.face(
          'concrete',
          [
            [0, y - t, z],
            [L, y - t, z],
            [L, y, z],
            [0, y, z],
          ],
          [0, 0, z < 0 ? -1 : 1],
        );
    } else o.box('concrete', [0, y - t, -W / 2], [L, y, W / 2]);
  }
  // Columns stand through all storeys. Four authored levels keep the complete body.
  for (let i = 0; i <= bays; i++)
    for (const z of [-W / 2 + cw / 2, W / 2 - cw / 2])
      (lod === 0 ? (key, a, b) => columnSides(o, key, a, b) : o.box)(
        'concrete',
        [i * pitch - cw / 2, floors[0], z - cw / 2],
        [i * pitch + cw / 2, top, z + cw / 2],
      );
  for (const y of lod === 0 ? [] : floors.slice(1))
    for (const z of [-W / 2, W / 2 - section.spandrelThickness])
      o.box('concrete', [0, y, z], [L, y + section.spandrelHeight, z + section.spandrelThickness]);
  for (const z of [-W / 2, W / 2 - cw])
    o.box('concrete', [0, top - section.roofBeamDepth, z], [L, top, z + cw]);
  if (lod > 0)
    for (let i = 0; i <= bays; i++)
      o.box(
        'concrete',
        [i * pitch - cw / 2, top - section.roofBeamDepth, -W / 2],
        [i * pitch + cw / 2, top, W / 2],
      );
  // Partition remnants are authored as walls, not dark pictures filling the facade openings.
  if (lod > 1)
    for (let i = 1; i < bays; i++)
      for (let f = 0; f < floors.length; f++) {
        const a = floors[f],
          b = floors[f + 1] ?? top;
        if ((i + f) % 4 !== 0)
          o.box(
            'inside',
            [i * pitch - section.partitionThickness / 2, a, -W / 2 + section.balconyDepth],
            [i * pitch + section.partitionThickness / 2, b - t, -section.corridorWidth / 2],
          );
        if (lod > 2 && (i + f) % 3 !== 0)
          o.box(
            'inside',
            [i * pitch - section.partitionThickness / 2, a, section.corridorWidth / 2],
            [i * pitch + section.partitionThickness / 2, b - t, W / 2 - section.balconyDepth],
          );
      }
  // Short retained roof fragments, explicitly estimated damage pattern, never a full new roof.
  if (lod > 1)
    for (let i = 1; i < bays; i += section.roofFragmentEvery)
      o.box(
        'concrete',
        [i * pitch, top - t, -W / 2],
        [
          Math.min(L, (i + section.roofFragmentFraction) * pitch),
          top,
          -W / 2 + section.balconyDepth,
        ],
      );
  return {
    bays,
    floors: floors.length,
    wholeLength: L,
    wholeWidth: W,
    openFacade: true,
    missingMainRoof: true,
  };
}

/** A hollow service core with stacked actual slits, floor landings and its own sloping roof. */
export function serviceCore(out, colors, core, section, lod) {
  const o = tools(local(out, core.origin, core.u, core.v), colors),
    L = core.length,
    W = core.width,
    t = section.coreWallThickness,
    F = section.floorYs[0],
    T = core.topY;
  if (lod === 0) {
    for (const z of [-W / 2, W / 2])
      doubleFace(
        o,
        'core',
        [
          [0, F, z],
          [L, F, z],
          [L, T, z],
          [0, T, z],
        ],
        [0, 0, z < 0 ? -1 : 1],
      );
    for (const x of [0, L])
      for (const [a, b] of [
        [-W / 2, -section.coreSlitWidth / 2],
        [section.coreSlitWidth / 2, W / 2],
      ])
        doubleFace(
          o,
          'core',
          [
            [x, F, a],
            [x, F, b],
            [x, T, b],
            [x, T, a],
          ],
          [x === 0 ? -1 : 1, 0, 0],
        );
    o.face(
      'core',
      [
        [0, T, -W / 2],
        [L, T, -W / 2],
        [L, T + core.roofRise, W / 2],
        [0, T + core.roofRise, W / 2],
      ],
      [0, 1, 0],
    );
    return {
      hollow: true,
      wholeLength: L,
      wholeWidth: W,
      top: T,
      slitFloors: 'continuous silhouette reduction',
    };
  }
  o.box('core', [0, F, -W / 2], [L, T, -W / 2 + t]);
  o.box('core', [0, F, W / 2 - t], [L, T, W / 2]);
  // End-wall slit width and spacing are later section parameters, not embedded metric guesses.
  for (const x of [0, L - t]) {
    const a = -section.coreSlitWidth / 2,
      b = section.coreSlitWidth / 2;
    o.box('core', [x, F, -W / 2], [x + t, T, a]);
    o.box('core', [x, F, b], [x + t, T, W / 2]);
    let bottom = F;
    for (const y of lod === 1 ? [F, section.floorYs.at(-1)] : section.floorYs) {
      const low = y + section.coreSlitBottom,
        high = Math.min(T, y + section.coreSlitTop);
      if (low > bottom) o.box('core', [x, bottom, a], [x + t, Math.min(low, T), b]);
      bottom = Math.max(bottom, high);
    }
    if (bottom < T) o.box('core', [x, bottom, a], [x + t, T, b]);
  }
  for (const y of lod === 1 ? [F, section.floorYs.at(-1)] : section.floorYs)
    o.box('concrete', [t, y - section.slabThickness, -W / 2 + t], [L - t, y, W / 2 - t]);
  const Y = T + core.roofRise;
  o.face(
    'core',
    [
      [0, T, -W / 2],
      [L, T, -W / 2],
      [L, Y, W / 2],
      [0, Y, W / 2],
    ],
    [0, 1, 0],
  );
  for (const x of [0, L])
    o.face(
      'core',
      [
        [x, T, -W / 2],
        [x, T, W / 2],
        [x, Y, W / 2],
      ],
      x === 0 ? [-1, 0, 0] : [1, 0, 0],
    );
  o.face(
    'core',
    [
      [0, T, W / 2],
      [L, T, W / 2],
      [L, Y, W / 2],
      [0, Y, W / 2],
    ],
    [0, 0, 1],
  );
  if (lod > 1)
    for (const x of [0, L - t])
      o.box(
        'inside',
        [x, F, -section.coreSlitWidth / 2],
        [x + t, F + section.coreSlitBottom, section.coreSlitWidth / 2],
      );
  return {
    hollow: true,
    wholeLength: L,
    wholeWidth: W,
    top: T,
    slitFloors: section.floorYs.length,
  };
}

/** Intrinsic D-shaped coastal halls, with full structural floor and real open ruined bays. */
export function lowHall(out, colors, hall, section, lod) {
  const outLocal = local(out, hall.origin, hall.u, hall.v),
    o = tools(outLocal, colors),
    count = [4, 8, 16, 24][lod],
    R = hall.radius,
    D = hall.backDepth,
    F = hall.floorY,
    T = hall.topY,
    ring = Array.from({ length: count + 1 }, (_, i) => [
      -R * Math.cos((Math.PI * i) / count),
      -R * Math.sin((Math.PI * i) / count),
    ]);
  ring.push([R, D], [-R, D]);
  o.cap('concrete', ring, F);
  o.cap('concrete', ring, F - section.slabThickness, false);
  if (lod === 0) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        len = Math.hypot(dx, dz),
        u = [dx / len, dz / len],
        v = [-u[1], u[0]],
        wall = tools(local(outLocal, a, u, v), colors),
        w = section.hallPierWidth;
      columnSides(
        wall,
        'concrete',
        [0, F, 0],
        [Math.min(w, len / 3), T, section.coreWallThickness],
      );
      doubleFace(
        wall,
        'concrete',
        [
          [0, T - section.hallBeamDepth, 0],
          [len, T - section.hallBeamDepth, 0],
          [len, T, 0],
          [0, T, 0],
        ],
        [0, 0, -1],
      );
    }
    return { wholeFloor: true, curvedExteriorSegments: count, openBays: true, missingRoof: true };
  }
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      len = Math.hypot(dx, dz),
      u = [dx / len, dz / len],
      v = [-u[1], u[0]],
      wall = tools(local(outLocal, a, u, v), colors),
      w = section.hallPierWidth;
    wall.box('concrete', [0, F, 0], [Math.min(w, len / 3), T, section.coreWallThickness]);
    wall.box('concrete', [0, T - section.hallBeamDepth, 0], [len, T, section.coreWallThickness]);
    wall.box('concrete', [0, F, 0], [len, F + section.hallSillHeight, section.coreWallThickness]);
    if (lod > 1 && i < count && i % hall.retainedRoofEvery === 0) {
      o.face(
        'concrete',
        [
          [a[0], T, a[1]],
          [b[0], T, b[1]],
          [b[0] * hall.roofFragmentInner, T, b[1] * hall.roofFragmentInner],
          [a[0] * hall.roofFragmentInner, T, a[1] * hall.roofFragmentInner],
        ],
        [0, 1, 0],
      );
    }
  }
  // Back connections and roof fragments leave the entire hall visible, without an intact-roof fiction.
  if (lod > 0)
    o.box('concrete', [-R, T - section.hallBeamDepth, D - section.coreWallThickness], [R, T, D]);
  return { wholeFloor: true, curvedExteriorSegments: count, openBays: true, missingRoof: true };
}
