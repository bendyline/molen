/**
 * Reference-based road vehicles. Metres, +Z forward, +X driver side; no bitmap materials.
 * Geometry carries no manufacturer emblem, wordmark, model lettering or trademarked grille
 * signature: the badge positions hold plain chrome rings. See content/entities/NOTICE.md.
 */
import '../../worldgen/scripts/install-deterministic-math.mjs';
import * as T from 'three';
import { detailKit } from './vehicle-detail.mjs';
import { addRoadDashboard, interiorProfile } from './vehicle-interiors.mjs';

export function roadVehicleModel(s) {
  const root = new T.Group();
  root.name = s.id;
  const { length: L, width: W, height: H, wheelRadius: R, wheelbase: WB, form: f } = s;
  const pickup = s.bodyStyle === 'pickup',
    rugged = s.bodyStyle === 'offroad';
  const mat = (name, color, metalness = 0, roughness = 0.6) =>
    new T.MeshStandardMaterial({
      name,
      color,
      metalness,
      roughness,
      flatShading: true,
      side: T.DoubleSide,
    });
  const paint = mat('vehicle-paint-and-trim', s.color, 0.32, 0.36);
  const black = mat('rubber-and-trim', '#20272c', 0.03, 0.8);
  const rubber = mat('tire-rubber', '#24292b', 0, 0.95);
  const chrome = mat('satin-alloy', '#a4b0b6', 0.75, 0.3);
  const light = mat('led-optics', '#e5f0ed', 0.15, 0.22);
  const red = mat('rear-optics', '#8f1820', 0.2, 0.27);
  const amber = mat('amber-optics', '#c18429', 0.1, 0.35);
  const seat = mat('upholstery', interiorProfile(s.id).trim, 0, 0.92);
  const screen = mat('display-glass', '#173038', 0.1, 0.28);
  const pixel = mat('display-graphics', '#b2c9cb', 0, 0.6);
  const glass = mat('clear-glazing', '#526e82', 0.22, 0.18);
  glass.transparent = true;
  glass.opacity = 0.65;
  glass.depthWrite = false;
  glass.side = T.FrontSide;
  const roofGlass = mat('panoramic-roof-glass', '#263b47', 0.25, 0.22);
  const shell = detailKit(root, 'body-shell');
  const details = detailKit(root, 'exterior-fittings');
  const windows = detailKit(root, 'glazing');
  const cabin = detailKit(root, 'cabin');
  const front = detailKit(root, 'front-fascia');
  const rear = detailKit(root, 'rear-fascia');
  const noseRound = f.noseRound ?? (pickup || rugged ? 0.1 : 0.27);
  const tailRound = f.tailRound ?? (pickup || rugged ? 0.055 : 0.15);
  const roofPaint = f.roofColor ? mat('contrast-roof', f.roofColor, 0.25, 0.4) : paint;
  const endWidth = (end) => (W / 2) * (end > 0 ? f.frontTaper : f.rearTaper);
  const endOffset = (x, end) =>
    (end > 0 ? noseRound : tailRound) *
    (1 - Math.sqrt(Math.max(0, 1 - Math.min(0.999, Math.abs(x) / endWidth(end)) ** 2)));
  // Fascia fittings follow the rounded nose/rear instead of floating on a flat billboard.
  for (const [d, end] of [
    [front, 1],
    [rear, -1],
  ]) {
    const conform = (mesh, x) => {
      mesh.position.z -= end * endOffset(x, end);
      const epsilon = 0.001;
      mesh.rotation.y +=
        Math.atan((endOffset(x + epsilon, end) - endOffset(x - epsilon, end)) / (epsilon * 2)) *
        end;
      return mesh;
    };
    const box = d.box,
      add = d.add,
      rod = d.rod,
      ring = d.ring;
    d.box = (size, at, material) => {
      if (size[0] < 0.28) return conform(box(size, at, material), at[0]);
      const count = Math.ceil(size[0] / 0.075);
      let mesh;
      for (let i = 0; i < count; i++) {
        const x = at[0] - size[0] / 2 + ((i + 0.5) * size[0]) / count;
        mesh = conform(box([size[0] / count, size[1], size[2]], [x, at[1], at[2]], material), x);
      }
      return mesh;
    };
    d.add = (geometry, material, at = [0, 0, 0]) => conform(add(geometry, material, at), at[0]);
    d.rod = (a, b, r, material) =>
      rod(
        [a[0], a[1], a[2] - end * endOffset(a[0], end)],
        [b[0], b[1], b[2] - end * endOffset(b[0], end)],
        r,
        material,
      );
    d.ring = (r, t, at, material, axis) => conform(ring(r, t, at, material, axis), at[0]);
  }
  // Polygon surface with explicit outward normal; bodies are hollow rather than filled slabs.
  function face(d, points, material, normal) {
    let p = points;
    if (normal) {
      const n = new T.Vector3()
        .subVectors(new T.Vector3(...p[1]), new T.Vector3(...p[0]))
        .cross(new T.Vector3().subVectors(new T.Vector3(...p[2]), new T.Vector3(...p[0])));
      if (n.dot(new T.Vector3(...normal)) < 0) p = [...p].reverse();
    }
    const vertices = [];
    for (let i = 1; i < p.length - 1; i++) {
      const a = new T.Vector3(...p[i]).sub(new T.Vector3(...p[0]));
      const b = new T.Vector3(...p[i + 1]).sub(new T.Vector3(...p[0]));
      if (a.cross(b).lengthSq() <= 1e-16) continue;
      if (d === front || d === rear) {
        const end = d === front ? 1 : -1;
        const steps = Math.max(
          1,
          Math.ceil(Math.max(Math.abs(p[i][0] - p[0][0]), Math.abs(p[i + 1][0] - p[0][0])) / 0.07),
        );
        const point = (u, v) => {
          const q = p[0].map(
            (n, k) => n + ((p[i][k] - n) * u) / steps + ((p[i + 1][k] - n) * v) / steps,
          );
          q[2] -= end * endOffset(q[0], end);
          return q;
        };
        for (let u = 0; u < steps; u++)
          for (let v = 0; v < steps - u; v++) {
            vertices.push(...point(u, v), ...point(u + 1, v), ...point(u, v + 1));
            if (u + v < steps - 1)
              vertices.push(...point(u + 1, v), ...point(u + 1, v + 1), ...point(u, v + 1));
          }
      } else vertices.push(...p[0], ...p[i], ...p[i + 1]);
    }
    if (!vertices.length) return undefined;
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    g.computeVertexNormals();
    return d.add(g, material);
  }
  const path = (d, points, radius, material) => {
    d.path(points, radius, material);
  };
  const belt = H * f.belt,
    clearance = Math.max(0.13, R * 0.48);
  const cowl = L * f.windshieldBase,
    rf = L * f.roofFront,
    rr = L * f.roofRear,
    rb = L * f.rearBase;
  const roofCrown = f.roofCrown ?? (pickup || rugged ? 0.035 : 0.075);
  const roofDrop = f.roofDrop ?? (pickup || rugged ? 0.025 : 0.06);
  const roofY = H - roofCrown - roofDrop,
    roofW = W * f.roofWidth;
  const frontGlassY = f.windshieldTop ?? roofY;
  const roofEdge = (z) => H - roofCrown - roofDrop * ((2 * (z - rr)) / (rf - rr) - 1) ** 2;
  const axleFront = L / 2 - (f.frontOverhang ?? (L - WB) * 0.46),
    axleRear = axleFront - WB;
  const arch = R + 0.045,
    track = W * 0.86,
    tireW = f.tireWidth ?? (pickup || rugged ? 0.26 : 0.225);
  const widthAt = (z) => {
    const round = z > 0 ? noseRound : tailRound;
    if (Math.abs(z) > L / 2 - round) {
      const u = (L / 2 - Math.abs(z)) / round;
      return endWidth(z) * Math.sqrt(Math.max(0, 2 * u - u * u));
    }
    const t = Math.max(0, (Math.abs(z) / L - 0.32) / 0.18);
    const waist = f.waist ?? 0;
    const swell = Math.max(
      ...[axleFront, axleRear].map((a) => Math.max(0, 1 - ((z - a) / (arch * 1.8)) ** 2)),
    );
    return (
      (W / 2) * (1 - t * (1 - (z > 0 ? f.frontTaper : f.rearTaper))) * (1 - waist * (1 - swell))
    );
  };
  const fenderRise = (z) => {
    if (!f.fenderCrown || (z >= rb && z <= cowl)) return 0;
    const fade = Math.min(1, Math.abs(z > cowl ? z - cowl : z - rb) / 0.3);
    return (
      f.fenderCrown *
      fade *
      Math.max(...[axleFront, axleRear].map((a) => Math.max(0, 1 - ((z - a) / (arch * 2.2)) ** 2)))
    );
  };
  const beltAt = (z) =>
    (z > cowl
      ? belt + ((H * f.nose - belt) * (z - cowl)) / (L / 2 - cowl)
      : z < rb
        ? belt + ((belt * 0.94 - belt) * (rb - z)) / (rb + L / 2)
        : belt) + fenderRise(z);
  const bottomAt = (z) =>
    Math.max(
      clearance,
      ...[axleFront, axleRear].map((a) =>
        Math.abs(z - a) < arch
          ? R + Math.sqrt(Math.max(0, arch * arch - (z - a) * (z - a)))
          : clearance,
      ),
    );
  const stations = new Set([
    -L / 2,
    -L * 0.42,
    -L * 0.32,
    rb,
    rr,
    0,
    rf,
    cowl,
    L * 0.32,
    L * 0.42,
    L / 2,
  ]);
  for (const end of [-1, 1])
    for (let i = 0; i <= 8; i++)
      stations.add(end * (L / 2 - ((end > 0 ? noseRound : tailRound) * i) / 8));
  for (const a of [axleFront, axleRear])
    for (let i = 0; i <= 20; i++) stations.add(a - arch + (2 * arch * i) / 20);
  const zs = [...stations].filter((z) => z >= -L / 2 && z <= L / 2).sort((a, b) => a - b);
  for (const side of [-1, 1]) {
    for (let i = 1; i < zs.length; i++) {
      const a = zs[i - 1],
        b = zs[i];
      const lowA = bottomAt(a),
        lowB = bottomAt(b),
        topA = beltAt(a),
        topB = beltAt(b);
      const midA = lowA + (topA - lowA) * 0.62,
        midB = lowB + (topB - lowB) * 0.62;
      face(
        shell,
        [
          [side * widthAt(a) * 0.91, lowA, a],
          [side * widthAt(b) * 0.91, lowB, b],
          [side * widthAt(b), midB, b],
          [side * widthAt(a), midA, a],
        ],
        paint,
        [side, 0, 0],
      );
      face(
        shell,
        [
          [side * widthAt(a), midA, a],
          [side * widthAt(b), midB, b],
          [side * widthAt(b) * 0.96, topB, b],
          [side * widthAt(a) * 0.96, topA, a],
        ],
        paint,
        [side, 0, 0],
      );
    }
    // Arch lips follow a real opening; there is no painted side panel behind the tires.
    for (const a of [axleFront, axleRear]) {
      const arc = [];
      for (let i = 0; i <= 24; i++) {
        const angle = (i * Math.PI) / 24,
          z = a + Math.cos(angle) * arch;
        const p = [side * (widthAt(z) * 0.98 + 0.006), R + Math.sin(angle) * arch, z];
        arc.push(p);
        if (i)
          face(
            shell,
            [
              arc[i - 1],
              p,
              [side * (track / 2 - tireW * 0.6), p[1], p[2]],
              [side * (track / 2 - tireW * 0.6), arc[i - 1][1], arc[i - 1][2]],
            ],
            black,
            [0, -1, 0],
          );
      }
      path(details, arc, f.cladding ? 0.035 : 0.016, f.cladding ? black : paint);
    }
    details.box(
      [0.035, 0.06, WB - arch * 2],
      [side * W * 0.493, clearance + 0.045, (axleFront + axleRear) / 2],
      f.cladding ? black : paint,
    );
  }
  // Bonnet and deck skins have a shallow crown and separate shoulder facets.
  function deck(a, b, isBed = false) {
    const cuts = [...new Set([a, ...zs.filter((z) => z > a && z < b), b])],
      fractions = [-1, -0.86, -0.64, -0.32, 0, 0.32, 0.64, 0.86, 1];
    for (let j = 1; j < cuts.length; j++)
      for (let k = 1; k < fractions.length; k++) {
        const point = (z, x) => [
          x * widthAt(z) * 0.96,
          (isBed ? clearance + 0.28 : beltAt(z)) +
            (isBed ? 0 : (1 - x * x) * ((f.hoodSculpt ?? 0.045) - fenderRise(z))),
          z,
        ];
        face(
          shell,
          [
            point(cuts[j - 1], fractions[k - 1]),
            point(cuts[j - 1], fractions[k]),
            point(cuts[j], fractions[k]),
            point(cuts[j], fractions[k - 1]),
          ],
          isBed ? black : paint,
          [0, 1, 0],
        );
      }
  }
  deck(cowl, L / 2);
  deck(-L / 2, rb, pickup);
  cabin.box([W * 0.87, 0.035, cowl - rb], [0, clearance + 0.02, (cowl + rb) / 2], black);
  for (const end of [-1, 1]) {
    const z = end * (L / 2 - 0.015),
      w = endWidth(end);
    (end > 0 ? front : rear).box(
      [w * 1.65, 0.1, 0.07],
      [0, clearance + 0.11, z],
      f.cladding || pickup ? black : paint,
    );
  }
  if (pickup) {
    const floorY = clearance + 0.3;
    for (let x = -W * 0.37; x <= W * 0.38; x += 0.12)
      details.box([0.018, 0.018, rb + L / 2 - 0.12], [x, floorY, (-L / 2 + rb) / 2], black);
    for (const side of [-1, 1]) {
      face(
        shell,
        [
          [side * W * 0.43, floorY, -L / 2 + 0.06],
          [side * W * 0.43, floorY, rb],
          [side * W * 0.43, belt, rb],
          [side * endWidth(-1) * 0.9, belt * 0.94, -L / 2 + 0.06],
        ],
        paint,
        [0, 1, 0],
      );
      details.box(
        [0.1, 0.035, rb + L / 2],
        [side * W * 0.45, belt - 0.012, (-L / 2 + rb) / 2],
        black,
      );
      // Bed wheel tubs and tiedown eyes.
      details.box([0.24, 0.18, 0.8], [side * W * 0.38, floorY + 0.08, axleRear], black);
      for (const z of [rb - 0.15, -L / 2 + 0.22])
        details.ring(0.026, 0.006, [side * W * 0.41, belt - 0.13, z], chrome, 'x');
    }
    face(
      shell,
      [
        [-W * 0.43, floorY, rb],
        [W * 0.43, floorY, rb],
        [W * 0.43, belt, rb],
        [-W * 0.43, belt, rb],
      ],
      paint,
      [0, 0, -1],
    );
    rear.box([0.2, 0.035, 0.03], [0, belt * 0.84, -L / 2 - 0.025], black);
  }
  // Compound roof crown and bowed glazing keep modern silhouettes without texture shading.
  const roofSections = [0, 0.15, 0.35, 0.5, 0.65, 0.85, 1].map((t) => rr + (rf - rr) * t);
  const across = [-1, -0.75, -0.4, 0, 0.4, 0.75, 1];
  const roofPoint = (z, u) => [u * roofW, roofEdge(z) + roofCrown * (1 - u * u), z];
  for (let i = 1; !f.openTop && i < roofSections.length; i++) {
    for (let j = 1; j < across.length; j++)
      face(
        shell,
        [
          roofPoint(roofSections[i - 1], across[j - 1]),
          roofPoint(roofSections[i - 1], across[j]),
          roofPoint(roofSections[i], across[j]),
          roofPoint(roofSections[i], across[j - 1]),
        ],
        f.blackRoof ? black : f.roofGlass ? roofGlass : roofPaint,
        [0, 1, 0],
      );
  }
  for (const z of f.openTop ? [rf] : [rf, rr])
    path(
      details,
      across.map((u) => roofPoint(z, u)),
      0.024,
      f.blackRoof ? black : roofPaint,
    );
  function windscreen(zBase, zTop, width, normal, topY = roofY) {
    const point = (t, u) => [
      u * (width * (1 - t) + roofW * t),
      belt + (topY - belt) * t + roofCrown * (1 - u * u) * t,
      zBase + (zTop - zBase) * t,
    ];
    for (let i = 1; i <= 5; i++)
      for (let j = 1; j < across.length; j++)
        face(
          windows,
          [
            point((i - 1) / 5, across[j - 1]),
            point((i - 1) / 5, across[j]),
            point(i / 5, across[j]),
            point(i / 5, across[j - 1]),
          ],
          glass,
          normal,
        );
    path(
      details,
      across.map((u) => point(0, u)),
      0.024,
      black,
    );
  }
  windscreen(cowl, rf, W * 0.455, [0, 1, 1], frontGlassY);
  if (f.windshieldTop !== undefined) {
    const header = (u) => [u * roofW, frontGlassY + roofCrown * (1 - u * u), rf];
    for (let i = 1; i < across.length; i++)
      face(
        shell,
        [
          header(across[i - 1]),
          header(across[i]),
          roofPoint(rf, across[i]),
          roofPoint(rf, across[i - 1]),
        ],
        paint,
        [0, 0, 1],
      );
    path(details, across.map(header), 0.022, black);
  }
  if (!f.openTop && !f.cargoVan) windscreen(rb, rr, W * 0.45, [0, 1, -1]);
  if (f.openTop) {
    // An actual open passenger cell: folded fabric, rear bulkhead and two roll hoops.
    cabin.box([W * 0.84, 0.24, 0.05], [0, belt - 0.1, rb + 0.04], black);
    details.box([W * 0.7, 0.065, 0.2], [0, belt + 0.035, rb - 0.12], black);
    for (const x of [-W * 0.23, W * 0.23])
      path(
        details,
        [
          [x - 0.13, belt, rb + 0.08],
          [x - 0.13, H - 0.21, rb + 0.08],
          [x + 0.13, H - 0.21, rb + 0.08],
          [x + 0.13, belt, rb + 0.08],
        ],
        0.025,
        chrome,
      );
  }
  const bz = f.bPillar !== undefined ? L * f.bPillar : pickup ? -L * 0.02 : -L * 0.06;
  for (const side of [-1, 1]) {
    const points = [
      [side * W * 0.455, belt, cowl],
      [side * roofW, roofY, rf],
      [side * roofW, roofY, rr],
      [side * W * 0.45, belt, rb],
    ];
    const windowOutline = [
      points[0],
      ...roofSections.toReversed().map((z) => [side * roofW, roofEdge(z), z]),
      points[3],
    ];
    if (f.cargoVan) {
      const splitBottom = [side * W * 0.454, belt, bz];
      const splitTop = [side * roofW, frontGlassY, bz];
      const frontTop = [side * roofW, frontGlassY, rf];
      face(windows, [points[0], frontTop, splitTop, splitBottom], glass, [side, 0, 0]);
      face(
        shell,
        [
          frontTop,
          points[1],
          ...roofSections
            .filter((z) => z < rf && z > bz)
            .toReversed()
            .map((z) => [side * roofW, roofEdge(z), z]),
          [side * roofW, roofEdge(bz), bz],
          splitTop,
        ],
        paint,
        [side, 0, 0],
      );
      face(
        shell,
        [
          splitBottom,
          splitTop,
          ...roofSections
            .filter((z) => z < bz)
            .toReversed()
            .map((z) => [side * roofW, roofEdge(z), z]),
          points[3],
        ],
        paint,
        [side, 0, 0],
      );
      path(details, [points[0], frontTop, splitTop, splitBottom, points[0]], 0.024, black);
      const insetX = side * W * 0.452;
      for (const y of [belt + 0.18, roofY - 0.2])
        details.rod([insetX, y, rb + 0.18], [insetX, y, bz - 0.18], 0.008, paint);
    } else if (!f.openTop) {
      face(windows, windowOutline, glass, [side, 0, 0]);
      path(details, [...windowOutline, windowOutline[0]], 0.024, black);
    } else details.rod(points[0], points[3], 0.024, black);
    details.rod(points[0], points[1], rugged ? 0.045 : 0.04, paint);
    const quarterWidth = pickup ? 0.1 : raggedQuarter();
    function raggedQuarter() {
      return rugged ? 0.12 : s.bodyStyle === 'sedan' || s.bodyStyle === 'coupe' ? 0.25 : 0.18;
    }
    if (!f.openTop)
      face(
        shell,
        [
          points[2],
          points[3],
          [points[3][0], points[3][1], rb + quarterWidth],
          [points[2][0], points[2][1], rr + quarterWidth * 0.45],
        ],
        f.blackPillar ? black : paint,
        [side, 0, 0],
      );
    // Shoulder strip closes the small gap between the side skin and window sill.
    face(
      shell,
      [
        [side * widthAt(rb) * 0.96, belt, rb],
        [side * widthAt(cowl) * 0.96, belt, cowl],
        points[0],
        points[3],
      ],
      paint,
      [0, 1, 0],
    );
    if (!f.openTop)
      path(
        details,
        roofSections.map((z) => [side * roofW, roofEdge(z) - 0.015, z]),
        0.025,
        f.blackRoof ? black : paint,
      );
    if (!f.openTop)
      details.rod(
        [side * W * 0.454, belt, bz],
        [side * roofW, roofEdge(bz), bz],
        0.039,
        f.safetyCell ? chrome : black,
      );
    if (!f.openTop && !pickup && !['sedan', 'coupe', 'fastback'].includes(s.bodyStyle))
      details.rod(
        [side * W * 0.452, belt, rr + 0.08],
        [side * roofW, roofEdge(rr + 0.08), rr + 0.08],
        0.028,
        f.blackPillar ? black : paint,
      );
    // Door shuts follow the side skin; handles and fuel flap stand only millimetres proud.
    const twoDoor = f.twoDoor || (f.asymmetricDoors && side > 0);
    for (const z of twoDoor ? [rb + 0.2, cowl - 0.05] : [rb + 0.18, bz, cowl - 0.05]) {
      const x = side * (widthAt(z) * 0.984 + 0.008);
      details.rod(
        [x, Math.max(clearance + 0.13, bottomAt(z) + 0.035), z],
        [x, belt - 0.035, z],
        0.0035,
        black,
      );
    }
    for (const z of twoDoor ? [rb + 0.32] : f.cargoVan ? [bz + 0.13] : [bz + 0.13, rb + 0.33]) {
      const x = side * (widthAt(z) * 0.98 + 0.015);
      details.box([0.025, 0.028, 0.135], [x, belt - 0.105, z], f.flushHandles ? black : paint);
      if (!f.flushHandles)
        details.box([0.008, 0.012, 0.08], [x + side * 0.017, belt - 0.105, z], chrome);
    }
    const mx = side * (W * 0.5 + 0.055),
      my = belt + 0.12,
      mz = cowl - 0.14;
    details.rod([side * W * 0.45, belt + 0.05, mz], [mx, my, mz], 0.025, black);
    details.box([0.17, 0.1, 0.22], [mx, my, mz], paint);
    details.box([0.145, 0.073, 0.006], [mx, my, mz - 0.114], chrome);
    details.box([0.13, 0.012, 0.012], [mx, my - 0.02, mz + 0.116], light);
    cabin.box(
      [0.035, 0.23, Math.max(0.5, cowl - rb - 0.3)],
      [side * W * 0.445, belt - 0.17, (cowl + rb) / 2],
      black,
    );
    cabin.box([0.055, 0.045, 0.35], [side * W * 0.42, belt - 0.15, bz + 0.3], seat);
    cabin.box([0.02, 0.022, 0.12], [side * W * 0.416, belt - 0.06, bz + 0.4], chrome);
    if (f.rails) {
      path(
        details,
        [
          [side * roofW * 0.9, roofY + 0.05, rr + 0.08],
          [side * roofW * 0.9, H + 0.055, rr + 0.23],
          [side * roofW * 0.9, H + 0.055, rf - 0.1],
        ],
        0.022,
        chrome,
      );
      for (const z of [rr + 0.23, rf - 0.1])
        details.rod(
          [side * roofW * 0.9, roofEdge(z) + roofCrown * 0.19, z],
          [side * roofW * 0.9, H + 0.055, z],
          0.018,
          black,
        );
    }
    if (f.slidingDoors)
      details.rod(
        [side * W * 0.486, belt - 0.1, rb],
        [side * W * 0.486, belt - 0.1, bz - 0.2],
        0.009,
        black,
      );
    if (rugged)
      for (const z of [bz + 0.06, cowl - 0.1])
        for (const y of [belt - 0.15, belt - 0.4])
          details.box([0.035, 0.04, 0.09], [side * W * 0.5, y, z], paint);
    if (f.sideIntakes) {
      const z = rb - 0.1,
        x = side * widthAt(z) * 0.985;
      details.box([0.015, 0.2, 0.36], [x, belt - 0.16, z], black);
      for (let i = 0; i < 4; i++)
        details.box([0.024, 0.012, 0.3], [x + side * 0.01, belt - 0.23 + i * 0.045, z], chrome);
    }
    if (f.sideCladding)
      details.box(
        [0.018, 0.18, WB - arch * 1.6],
        [side * W * 0.49, clearance + 0.16, (axleFront + axleRear) / 2],
        black,
      );
    if (f.safetyCell) path(details, [points[3], points[2], points[1]], 0.055, chrome);
  }
  if (f.cargoVan) {
    face(
      shell,
      [
        [-W * 0.45, belt, rb],
        [-roofW, roofY, rr],
        [roofW, roofY, rr],
        [W * 0.45, belt, rb],
      ],
      paint,
      [0, 0, -1],
    );
    const partitionZ = bz - 0.16;
    cabin.box(
      [W * 0.84, roofY - clearance - 0.08, 0.03],
      [0, (roofY + clearance) / 2, partitionZ],
      black,
    );
    for (let i = -4; i <= 4; i++)
      cabin.box(
        [0.025, 0.018, partitionZ - rb - 0.08],
        [i * W * 0.085, clearance + 0.05, (partitionZ + rb) / 2],
        chrome,
      );
    path(
      details,
      [
        [0, clearance + 0.15, -L / 2 - 0.025],
        [0, belt, rb - 0.01],
        [0, roofY, rr - 0.01],
      ],
      0.004,
      black,
    );
    for (const side of [-1, 1])
      rear.box([0.1, 0.025, 0.03], [side * 0.12, belt * 0.8, -L / 2 - 0.035], black);
  }
  details.box([0.012, 0.13, 0.16], [W * 0.496, belt - 0.22, axleRear - 0.3], paint);
  // Windscreen wipers are attached to the sloping pane.
  for (const x of [-W * 0.21, W * 0.21]) {
    const dz = 0.08,
      y = belt + ((frontGlassY - belt) * dz) / (cowl - rf) + 0.018;
    details.rod([x - 0.11, y, cowl - dz], [x + 0.18, y + 0.015, cowl - dz - 0.025], 0.009, black);
    details.rod([x - 0.15, belt + 0.016, cowl - 0.015], [x, y, cowl - dz], 0.008, black);
  }
  if (f.hoodVents)
    for (const x of [-W * 0.22, W * 0.22]) {
      const z = (cowl + L / 2) / 2;
      details.box([0.23, 0.015, 0.3], [x, beltAt(z) + 0.04, z], black);
      for (let i = 0; i < 4; i++)
        details.box([0.21, 0.012, 0.016], [x, beltAt(z) + 0.052, z - 0.12 + i * 0.075], chrome);
    }
  if (f.spoiler) details.box([W * 0.78, 0.045, 0.16], [0, belt * 0.98 + 0.08, -L * 0.45], paint);
  else if (!f.openTop && !pickup && s.bodyStyle !== 'sedan')
    details.box(
      [W * 0.75, 0.025, 0.09],
      [0, roofY + 0.015, rr - 0.04],
      f.blackRoof ? black : paint,
    );
  // Grille perimeter and lamp signatures are authored per model, independent of body dimensions.
  const gy = H * (f.grilleY ?? (pickup ? 0.47 : raggedGrilleY())),
    gw = (W * f.grilleWidth) / 2,
    gh = (H * f.grilleHeight) / 2,
    zf = L / 2 + 0.021;
  function raggedGrilleY() {
    return rugged ? 0.47 : s.grille === 'closed' ? 0.27 : 0.41;
  }
  let outline;
  if (s.grille === 'pentagon')
    outline = [
      [-gw * 0.84, gy + gh],
      [gw * 0.84, gy + gh],
      [gw, gy + gh * 0.15],
      [0, gy - gh],
      [-gw, gy + gh * 0.15],
    ];
  else if (s.grille === 'triangle')
    outline = [
      [-gw, gy + gh],
      [gw, gy + gh],
      [0, gy - gh],
    ];
  else if (s.grille === 'hex' || s.grille === 'shield' || s.grille === 'v')
    outline = [
      [-gw * 0.72, gy + gh],
      [gw * 0.72, gy + gh],
      [gw, gy + gh * 0.25],
      [gw * 0.75, gy - gh],
      [-gw * 0.75, gy - gh],
      [-gw, gy + gh * 0.25],
    ];
  else if (s.grille === 'trapezoid')
    outline = [
      [-gw * 0.62, gy + gh],
      [gw * 0.62, gy + gh],
      [gw, gy - gh],
      [-gw, gy - gh],
    ];
  else if (s.grille === 'oval')
    outline = Array.from({ length: 16 }, (_, i) => [
      Math.cos((i * Math.PI) / 8) * gw,
      gy + Math.sin((i * Math.PI) / 8) * gh,
    ]);
  else
    outline = [
      [-gw, gy + gh],
      [gw, gy + gh],
      [gw, gy - gh],
      [-gw, gy - gh],
    ];
  if (s.grille !== 'closed') {
    face(
      front,
      outline.map(([x, y]) => [x, y, zf]),
      black,
      [0, 0, 1],
    );
    path(
      front,
      [...outline, outline[0]].map(([x, y]) => [x, y, zf + 0.008]),
      0.012,
      s.grille === 'mesh' || s.grille === 'hex' ? black : chrome,
    );
    if (s.grille === 'split') {
      front.box([0.035, gh * 2.15, 0.025], [0, gy, zf + 0.02], paint);
      for (const side of [-1, 1])
        for (let i = 1; i < 6; i++)
          front.box(
            [0.012, gh * 1.65, 0.025],
            [side * (0.05 + i * gw * 0.14), gy, zf + 0.035],
            chrome,
          );
    } else if (s.grille === 'vertical-slats') {
      for (let i = -8; i <= 8; i++)
        front.box([0.014, gh * 1.8, 0.018], [i * gw * 0.105, gy, zf + 0.022], chrome);
    } else if (s.grille === 'slots5') {
      front.box([gw * 2, gh * 2, 0.012], [0, gy, zf + 0.01], paint);
      for (let i = -2; i <= 2; i++)
        front.box([gw * 0.21, gh * 1.65, 0.015], [i * gw * 0.36, gy, zf + 0.025], black);
    } else if (s.grille === 'slots') {
      // Six open slots: a generic slotted truck grille, deliberately not a seven-slot signature.
      front.box([gw * 2, gh * 2, 0.012], [0, gy, zf + 0.01], paint);
      for (let i = -2.5; i <= 2.5; i++)
        front.box([gw * 0.17, gh * 1.75, 0.015], [i * gw * 0.3, gy, zf + 0.025], black);
    } else if (['bars', 'v', 'oval'].includes(s.grille)) {
      for (let i = -2; i <= 2; i++)
        front.box([gw * 1.77, 0.025, 0.015], [0, gy + i * gh * 0.32, zf + 0.015], chrome);
      if (s.grille === 'v')
        path(
          front,
          [
            [-gw * 0.9, gy + gh, zf + 0.035],
            [0, gy - gh * 0.9, zf + 0.035],
            [gw * 0.9, gy + gh, zf + 0.035],
          ],
          0.022,
          chrome,
        );
    } else if (s.grille === 'pentagon') {
      // The MDX diamond grille spreads small facets outward around its central badge.
      for (let row = -2; row <= 2; row++)
        for (let col = -6; col <= 6; col++) {
          if ((row < 0 && Math.abs(col) > 6 + row * 2) || (Math.abs(col) < 2 && Math.abs(row) < 2))
            continue;
          const x = col * gw * 0.13,
            y = gy + row * gh * 0.3;
          face(
            front,
            [
              [x - 0.012, y, zf + 0.024],
              [x, y + 0.018, zf + 0.027],
              [x + 0.012, y, zf + 0.024],
              [x, y - 0.018, zf + 0.024],
            ],
            chrome,
            [0, 0, 1],
          );
        }
    } else if (s.grille !== 'triangle') {
      for (let y = -3; y <= 3; y++)
        for (let x = -7; x <= 7; x++) {
          if (Math.abs(x) > 5 && Math.abs(y) > 1) continue;
          front.box(
            [0.034, 0.025, 0.016],
            [x * gw * 0.12, gy + y * gh * 0.26, zf + 0.02],
            s.make === 'GMC' ? chrome : black,
          );
        }
    }
  } else front.box([W * 0.58, 0.07, 0.018], [0, clearance + 0.18, zf], black);
  const lampX = W * 0.355,
    lampW = W * 0.2,
    lampH = pickup && s.lamps === 'c' ? H * 0.24 : pickup ? 0.22 : 0.11;
  const lampY =
    H * f.nose -
    (s.lamps.startsWith('round') ? H * 0.078 : s.lamps === 'vertical' ? 0.15 : lampH * 0.6);
  for (const side of [-1, 1]) {
    const x = side * lampX;
    if (f.lampOnHood) {
      const z = axleFront + arch * 0.7,
        xx = side * W * 0.355;
      const y = beltAt(z) + 0.025;
      const lens = details.add(new T.SphereGeometry(1, 16, 8), black, [xx, y, z]);
      lens.scale.set(0.12, 0.025, 0.19);
      const optic = details.ring(0.095, 0.009, [xx, y + 0.023, z + 0.04], chrome);
      optic.rotation.x = -Math.PI * 0.4;
      const lamp = details.add(new T.CircleGeometry(0.08, 20), light, [xx, y + 0.024, z + 0.042]);
      lamp.rotation.x = -Math.PI * 0.4;
    } else if (s.lamps === 'stadium') {
      const outline = [];
      for (let i = 0; i <= 32; i++) {
        const a = (i * Math.PI) / 16;
        outline.push([
          x + Math.cos(a) * 0.072,
          lampY + Math.sin(a) * 0.072 + Math.sign(Math.sin(a)) * 0.07,
          zf + 0.026,
        ]);
      }
      face(front, outline, black, [0, 0, 1]);
      path(front, outline, 0.015, light);
    } else if (s.lamps === 'quad-round') {
      for (const dx of [-0.095, 0.095]) {
        front.add(new T.CircleGeometry(0.085, 20), black, [x + dx, lampY, zf + 0.02]);
        front.ring(0.069, 0.009, [x + dx, lampY, zf + 0.029], light);
        front.add(new T.CircleGeometry(0.043, 16), chrome, [x + dx, lampY, zf + 0.032]);
      }
    } else if (s.lamps.startsWith('round')) {
      const rad = H * 0.07;
      front.add(new T.CircleGeometry(rad, 24), black, [x, lampY, zf + 0.02]);
      front.ring(rad * 0.83, 0.012, [x, lampY, zf + 0.026], light);
      front.add(new T.CircleGeometry(rad * 0.46, 16), chrome, [x, lampY, zf + 0.03]);
      if (s.lamps === 'round-bar')
        front.box([lampW, 0.022, 0.016], [x - side * 0.12, lampY, zf + 0.035], light);
    } else if (s.lamps === 'twin-line') {
      for (const dy of [-0.038, 0.038]) {
        front.box([lampW, 0.038, 0.025], [x, lampY + dy, zf + 0.021], black);
        front.box([lampW * 0.92, 0.016, 0.025], [x, lampY + dy, zf + 0.035], light);
      }
    } else if (s.lamps === 'y-signature') {
      for (const dy of [-0.055, 0.055])
        front.rod(
          [x - side * lampW * 0.4, lampY + dy, zf + 0.03],
          [x, lampY, zf + 0.03],
          0.012,
          light,
        );
      front.rod([x, lampY, zf + 0.03], [x + side * lampW * 0.45, lampY, zf + 0.03], 0.012, light);
    } else if (s.lamps === 'countryman') {
      const shape = [
        [-0.11, -0.075],
        [-0.12, 0.035],
        [-0.075, 0.125],
        [0.055, 0.135],
        [0.115, 0.075],
        [0.12, -0.045],
        [0.065, -0.11],
        [-0.04, -0.115],
      ].map(([dx, dy]) => [x + side * dx, lampY + dy, zf + 0.027]);
      face(front, shape, black, [0, 0, 1]);
      path(front, [...shape, shape[0]], 0.012, chrome);
      front.ring(0.063, 0.011, [x, lampY + 0.006, zf + 0.042], light);
      front.add(new T.CircleGeometry(0.044, 20), chrome, [x, lampY + 0.006, zf + 0.045]);
      front.box([0.07, 0.022, 0.012], [x, lampY - 0.076, zf + 0.04], light);
    } else if (s.lamps === 'oval-upright') {
      const shape = Array.from({ length: 25 }, (_, i) => [
        x + Math.cos((i * Math.PI) / 12) * 0.09,
        lampY + Math.sin((i * Math.PI) / 12) * 0.14,
        zf + 0.024,
      ]);
      face(front, shape, black, [0, 0, 1]);
      path(front, shape, 0.012, chrome);
      front.ring(0.052, 0.01, [x, lampY - 0.015, zf + 0.04], light);
    } else {
      const h = s.lamps === 'vertical' ? 0.28 : lampH;
      const w = s.lamps === 'vertical' ? 0.12 : lampW;
      face(
        front,
        [
          [x - (side * w) / 2, lampY + h / 2, zf],
          [x + (side * w) / 2, lampY + h * 0.35, zf],
          [x + side * w * 0.4, lampY - h / 2, zf],
          [x - side * w * 0.48, lampY - h * 0.35, zf],
        ],
        black,
        [0, 0, 1],
      );
      if (s.lamps === 'jewel-five') {
        for (let i = 0; i < 5; i++) {
          const xx = x + (i - 2) * w * 0.175;
          front.box([0.048, 0.053, 0.018], [xx, lampY, zf + 0.024], chrome);
          front.box([0.035, 0.038, 0.021], [xx, lampY, zf + 0.031], light);
        }
        front.rod(
          [x - w * 0.45, lampY - 0.041, zf + 0.025],
          [x + w * 0.45, lampY - 0.041, zf + 0.025],
          0.008,
          light,
        );
      } else if (s.lamps === 'c' || s.lamps === 'hammer')
        path(
          front,
          [
            [x - side * w * 0.42, lampY + h * 0.4, zf + 0.02],
            [x + side * w * 0.42, lampY + h * 0.4, zf + 0.02],
            [x + side * w * 0.42, lampY - h * 0.4, zf + 0.02],
            [x - side * w * 0.18, lampY - h * 0.4, zf + 0.02],
          ],
          0.012,
          light,
        );
      else if (s.lamps === 'boomerang')
        path(
          front,
          [
            [x + side * w * 0.4, lampY + 0.1, zf + 0.02],
            [x - side * w * 0.2, lampY, zf + 0.025],
            [x + side * w * 0.45, lampY - 0.2, zf + 0.02],
          ],
          0.014,
          light,
        );
      else if (s.lamps === 'vertical')
        for (const dx of [-0.025, 0.025])
          front.box([0.014, 0.25, 0.018], [x + dx, lampY, zf + 0.021], light);
      else if (s.lamps === 'pixel-squares') {
        for (const dx of [-0.065, 0.065]) {
          const p = [
            [x + dx - 0.045, lampY - 0.034, zf + 0.025],
            [x + dx + 0.045, lampY - 0.034, zf + 0.025],
            [x + dx + 0.045, lampY + 0.034, zf + 0.025],
            [x + dx - 0.045, lampY + 0.034, zf + 0.025],
          ];
          path(front, [...p, p[0]], 0.008, light);
        }
      } else if (s.lamps === 'pixels')
        for (let i = 0; i < 3; i++)
          front.box(
            [0.045, 0.042, 0.018],
            [x - side * i * 0.062, lampY - i * 0.024, zf + 0.02],
            light,
          );
      else
        front.rod(
          [x - side * w * 0.42, lampY + h * 0.28, zf + 0.02],
          [x + side * w * 0.42, lampY + h * 0.14, zf + 0.02],
          0.012,
          light,
        );
      for (let i = 0; i < (s.lamps === 'jewel-five' ? 0 : s.lamps === 'triple' ? 3 : 2); i++)
        front.add(new T.CircleGeometry(0.023, 12), chrome, [
          x + (i - 0.5) * 0.065,
          lampY - 0.012,
          zf + 0.022,
        ]);
      if (s.lamps === 'split') front.box([0.13, 0.08, 0.025], [x, lampY - 0.2, zf + 0.012], light);
      front.box([0.018, 0.032, 0.015], [x + side * w * 0.46, lampY, zf + 0.02], amber);
    }
    // Low air ducts and separate foglight recesses.
    front.box([0.14, 0.08, 0.018], [side * W * 0.35, clearance + 0.18, zf], black);
    front.box([0.055, 0.022, 0.022], [side * W * 0.35, clearance + 0.18, zf + 0.015], light);
    const zr = -L / 2 - 0.021,
      ty = belt * 0.83,
      tx = side * W * 0.375;
    const vertical = ['vertical', 'c', 'square', 'high-l'].includes(s.tail);
    if (s.tail === 'round') {
      rear.add(new T.CircleGeometry(0.078, 20).rotateY(Math.PI), red, [tx, ty, zr]);
      rear.ring(0.06, 0.009, [tx, ty, zr - 0.012], red);
    } else if (s.tail === 'wrap-l') {
      const shape = [
        [tx - side * 0.2, ty + 0.04, zr],
        [tx + side * 0.16, ty + 0.1, zr],
        [tx + side * 0.17, ty - 0.08, zr],
        [tx + side * 0.07, ty - 0.14, zr],
        [tx - side * 0.22, ty - 0.06, zr],
      ];
      face(rear, shape, red, [0, 0, -1]);
      path(
        rear,
        [
          [tx - side * 0.16, ty + 0.005, zr - 0.017],
          [tx + side * 0.1, ty + 0.035, zr - 0.017],
          [tx + side * 0.1, ty - 0.08, zr - 0.017],
        ],
        0.012,
        light,
      );
      details.rod(
        [side * W * 0.475, ty + 0.035, -L / 2 + 0.1],
        [side * W * 0.48, ty + 0.05, -L / 2 + 0.3],
        0.024,
        red,
      );
    } else rear.box([vertical ? 0.13 : 0.32, vertical ? 0.24 : 0.09, 0.027], [tx, ty, zr], red);
    if (s.tail === 'tri-bar')
      for (let i = 0; i < 3; i++)
        rear.box([0.037, 0.16, 0.025], [tx + (i - 1) * 0.068, ty, zr - 0.017], red);
    if (s.tail === 'high-l')
      details.rod(
        [side * roofW, roofY - 0.02, rr - 0.02],
        [side * W * 0.45, belt, rb - 0.02],
        0.022,
        red,
      );
    if (s.tail === 'claws')
      for (let i = 0; i < 2; i++)
        rear.box([0.04, 0.16, 0.025], [tx + (i - 0.5) * 0.08, ty - 0.055, zr - 0.02], red);
    rear.box([0.05, 0.018, 0.03], [tx, ty - 0.04, zr - 0.02], light);
    if (!f.electric && !pickup)
      details.ring(0.033, 0.008, [side * W * 0.32, clearance + 0.03, -L / 2 - 0.04], chrome);
  }
  if (s.tail === 'bar' || s.tail === 'claws')
    rear.box([W * 0.74, 0.025, 0.025], [0, belt * 0.87, -L / 2 - 0.04], red);
  if (f.frontLightBar) front.box([W * 0.82, 0.024, 0.025], [0, lampY, zf + 0.035], light);
  if (f.clawDrl)
    for (const side of [-1, 1])
      for (let i = 0; i < 3; i++)
        front.rod(
          [side * (W * 0.35 + i * 0.045), lampY - 0.06, zf + 0.032],
          [side * (W * 0.33 + i * 0.045), lampY - 0.28, zf + 0.032],
          0.012,
          light,
        );
  if (f.lowerRound)
    for (const side of [-1, 1]) {
      front.add(new T.CircleGeometry(0.115, 20), black, [side * W * 0.34, gy - 0.05, zf + 0.021]);
      front.ring(0.087, 0.012, [side * W * 0.34, gy - 0.05, zf + 0.035], light);
    }
  if (f.windowDividers)
    for (const side of [-1, 1]) {
      details.rod(
        [side * W * 0.495, belt - 0.08, -L * 0.1],
        [side * W * 0.495, belt - 0.08, -L * 0.39],
        0.01,
        black,
      );
      for (const z of [-L * 0.04, -L * 0.27])
        details.rod(
          [side * W * 0.493, belt + 0.05, z],
          [side * W * 0.4, H - 0.08, z],
          0.017,
          black,
        );
    }
  if (f.grilleSlash)
    front.rod(
      [-gw * 0.85, gy - gh * 0.8, zf + 0.045],
      [gw * 0.85, gy + gh * 0.8, zf + 0.045],
      0.018,
      chrome,
    );
  if (f.stripes) {
    const stripeY = (x, z) =>
      beltAt(z) +
      (1 - (x / (widthAt(z) * 0.96)) ** 2) * ((f.hoodSculpt ?? 0.045) - fenderRise(z)) +
      0.003;
    for (const x of [-W * 0.075, W * 0.075]) {
      for (let i = 0; i < 16; i++) {
        const a = cowl + ((L / 2 - noseRound - cowl) * i) / 16,
          b = cowl + ((L / 2 - noseRound - cowl) * (i + 1)) / 16;
        face(
          details,
          [
            [x - 0.055, stripeY(x - 0.055, a), a],
            [x + 0.055, stripeY(x + 0.055, a), a],
            [x + 0.055, stripeY(x + 0.055, b), b],
            [x - 0.055, stripeY(x - 0.055, b), b],
          ],
          light,
          [0, 1, 0],
        );
      }
    }
  }
  // Neutral badges only. A reference interpretation carries no manufacturer emblem, wordmark or
  // model lettering in its geometry; the make, model and year identify it in recipe.json, the
  // entity doc and the README instead (see content/entities/NOTICE.md). The same plain chrome
  // ring and disc front and rear keep the badge positions without reproducing any mark.
  {
    const y = s.grille === 'closed' ? H * f.nose + 0.016 : gy;
    front.ring(0.042, 0.006, [0, y, zf + 0.04], chrome);
    front.add(new T.CircleGeometry(0.024, 20), chrome, [0, y, zf + 0.042]);
    rear.ring(0.03, 0.005, [0, belt * 0.78, -L / 2 - 0.043], chrome);
  }
  for (const end of [-1, 1]) {
    const d = end > 0 ? front : rear,
      z = end * (L / 2 + 0.045),
      y = clearance + 0.13;
    d.box([0.31, 0.15, 0.018], [0, y, z], black);
    d.box([0.285, 0.125, 0.02], [0, y, z + end * 0.01], light);
    d.text(
      `MLN ${String(s.year).slice(2)}`,
      [0, y, z + end * 0.023],
      0.037,
      end < 0 ? Math.PI : 0,
      black,
    );
  }
  // Wheels have separate steering/spin/caliper transforms, bevelled tires and open alloy spokes.
  function wheel(name, x, z) {
    const pivot = new T.Group();
    pivot.name = name;
    pivot.position.set(x, R, z);
    root.add(pivot);
    const spin = new T.Group();
    spin.name = `${name}-spin`;
    pivot.add(spin);
    const d = detailKit(spin, 'wheel-surfaces');
    const fixed = detailKit(pivot, `${name}-brakes`);
    const profile = [
      [-tireW * 0.5, R * 0.71],
      [-tireW * 0.5, R * 0.87],
      [-tireW * 0.38, R * 0.97],
      [-tireW * 0.26, R],
      [tireW * 0.26, R],
      [tireW * 0.38, R * 0.97],
      [tireW * 0.5, R * 0.87],
      [tireW * 0.5, R * 0.71],
    ];
    const tire = new T.LatheGeometry(
      profile.map(([x, r]) => new T.Vector2(r, x)),
      32,
    ).rotateZ(Math.PI / 2);
    d.add(tire, rubber);
    for (const side of [-1, 1]) {
      const xx = side * (tireW * 0.51),
        rim = R * 0.7;
      d.ring(rim, 0.013, [xx, 0, 0], chrome, 'x');
      d.ring(R * 0.88, 0.004, [xx * 0.98, 0, 0], black, 'x');
      d.add(
        new T.CylinderGeometry(rim * 0.75, rim * 0.75, 0.013, 24).rotateZ(Math.PI / 2),
        chrome,
        [xx - side * 0.035, 0, 0],
      );
      const count =
        f.spokes ?? (s.form.aeroWheels ? 5 : s.make === 'Toyota' ? 6 : s.make === 'Honda' ? 10 : 5);
      for (let i = 0; i < count; i++) {
        const a = (i * Math.PI * 2) / count,
          b = a + (f.aeroWheels ? 0.38 : 0.1);
        face(
          d,
          [
            [xx, Math.cos(a) * R * 0.18, Math.sin(a) * R * 0.18],
            [xx, Math.cos(a) * rim * 0.95, Math.sin(a) * rim * 0.95],
            [xx, Math.cos(b) * rim * 0.93, Math.sin(b) * rim * 0.93],
            [xx, Math.cos(b + 0.16) * R * 0.18, Math.sin(b + 0.16) * R * 0.18],
          ],
          f.aeroWheels ? black : chrome,
          [side, 0, 0],
        );
      }
      d.add(new T.CylinderGeometry(R * 0.18, R * 0.18, 0.018, 12).rotateZ(Math.PI / 2), chrome, [
        xx,
        0,
        0,
      ]);
      for (let i = 0; i < 5; i++) {
        const a = (i * Math.PI * 2) / 5;
        d.add(new T.CylinderGeometry(0.009, 0.009, 0.012, 6).rotateZ(Math.PI / 2), black, [
          xx + side * 0.012,
          Math.cos(a) * R * 0.12,
          Math.sin(a) * R * 0.12,
        ]);
      }
      fixed.box(
        [0.025, R * 0.26, R * 0.13],
        [xx - side * 0.025, R * 0.35, 0],
        s.bodyStyle === 'coupe' ? red : black,
      );
    }
    // Small tread blocks, merged with the tire material rather than individual draw calls.
    for (let i = 0; i < 32; i++)
      for (const sign of [-1, 1]) {
        const a = (i * Math.PI) / 16;
        const block = d.box(
          [tireW * 0.32, 0.005, 0.035],
          [sign * tireW * 0.2, Math.cos(a) * (R + 0.001), Math.sin(a) * (R + 0.001)],
          rubber,
        );
        block.rotation.x = a;
      }
    d.finish();
    fixed.finish();
    return pivot;
  }
  for (const side of [-1, 1])
    for (const [axle, z] of [
      ['front', axleFront],
      ['rear', axleRear],
    ])
      wheel(`wheel-${axle}-${side > 0 ? 'left' : 'right'}`, (side * track) / 2, z);
  if (f.spare) {
    const d = detailKit(root, 'rear-spare');
    d.add(new T.TorusGeometry(R * 0.79, R * 0.21, 8, 24), rubber, [0, belt * 0.85, -L / 2 - 0.12]);
    d.add(new T.CylinderGeometry(R * 0.53, R * 0.53, 0.13, 16).rotateX(Math.PI / 2), chrome, [
      0,
      belt * 0.85,
      -L / 2 - 0.12,
    ]);
    d.finish();
  }
  // The eye and controls are authored together so the driver can actually see out.
  const eye = s.driverEye ?? [W * 0.23, H - 0.32, cowl - 0.66],
    dashY = f.fitCabin
      ? Math.max(eye[1] - 0.36, Math.min(eye[1] - 0.27, belt - 0.055))
      : eye[1] - 0.27,
    dashZ = eye[2] + 0.57;
  const seatY = eye[1] - 0.59;
  for (let row = 0; row < (f.rows ?? 2); row++)
    for (const x of [-W * 0.23, W * 0.23]) {
      const z = eye[2] - 0.14 - row * 0.77;
      if (z < rb + 0.17) continue;
      cabin.box([0.43, 0.1, 0.45], [x, seatY, z], seat);
      const back = cabin.box([0.43, 0.48, 0.08], [x, seatY + 0.25, z - 0.2], seat);
      back.rotation.x = -0.13;
      for (const dx of [-0.17, 0.17])
        cabin.box([0.045, 0.4, 0.11], [x + dx, seatY + 0.25, z - 0.16], black);
      cabin.box([0.25, 0.16, 0.09], [x, seatY + 0.59, z - 0.22], seat);
      for (const dx of [-0.075, 0.075])
        cabin.rod(
          [x + dx, seatY + 0.42, z - 0.22],
          [x + dx, seatY + 0.55, z - 0.22],
          0.008,
          chrome,
        );
      for (const dx of [-0.11, 0.11])
        cabin.rod(
          [x + dx, seatY + 0.065, z - 0.16],
          [x + dx, seatY + 0.065, z + 0.17],
          0.0025,
          chrome,
        );
      cabin.rod(
        [x + Math.sign(x) * 0.15, seatY + 0.45, z - 0.16],
        [x - Math.sign(x) * 0.15, seatY + 0.07, z + 0.08],
        0.013,
        black,
      );
    }
  addRoadDashboard(
    root,
    s,
    {
      eye,
      width: W,
      dashY,
      dashZ,
      seatY,
      clearance,
      shallowDash: f.fitCabin && belt - 0.055 < eye[1] - 0.36,
      cabin,
      black,
      chrome,
      pixel,
      screen,
      red,
    },
    detailKit,
  );
  // Deep, low cabins need a continuous dash top up to the windshield base. The short fascia
  // alone leaves the wheel wells visible through the open cowl when the seated camera looks down.
  if (cowl > dashZ + 0.17) {
    const nearZ = dashZ + 0.1;
    const farZ = cowl + 0.015;
    const nearY = dashY + 0.04;
    const farY = belt - 0.018;
    const dz = farZ - nearZ;
    const dy = farY - nearY;
    const cover = cabin.box(
      [W * 0.86, 0.025, Math.sqrt(dz * dz + dy * dy)],
      [0, (nearY + farY) / 2, (nearZ + farZ) / 2],
      black,
    );
    cover.rotation.x = -Math.atan2(dy, dz);
  }
  if (axleFront - arch < cowl) {
    // Opaque inner wheel-arch liners keep tires out of the footwells in short cabins.
    for (const side of [-1, 1])
      cabin.add(new T.CircleGeometry(arch, 24, 0, Math.PI).rotateY((-side * Math.PI) / 2), black, [
        side * (track / 2 - tireW / 2 - 0.015),
        R,
        axleFront,
      ]);
  }
  // Interior mirror mounted inside the top of the windscreen.
  cabin.box([0.2, 0.06, 0.025], [0, frontGlassY - 0.11, rf + 0.12], black);
  cabin.box([0.18, 0.043, 0.005], [0, frontGlassY - 0.11, rf + 0.105], chrome);
  for (const d of [shell, details, windows, cabin, front, rear]) d.finish();
  return root;
}
