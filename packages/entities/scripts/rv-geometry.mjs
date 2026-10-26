/** Touring motorhomes. Hollow coach shells, real glazing openings, stowed fittings, no bitmaps. */
import '../../worldgen/scripts/install-deterministic-math.mjs';
import * as T from 'three';
import { roadVehicleModel } from './road-vehicle-geometry.mjs';
import { detailKit } from './vehicle-detail.mjs';

export function recreationalVehicleModel(s) {
  const { length: L, width: W, wheelRadius: R, roofHeight: roof, floor, driverEye: eye } = s;
  const A = s.rvClass === 'A',
    B = s.rvClass === 'B',
    C = s.rvClass === 'C';
  const cabH = s.cabHeight,
    cabW = s.cabWidth,
    front = L / 2,
    back = -L / 2 + 0.06;
  const cabRear = front - 2.45,
    coachFront = s.coachFront;
  const axleFront = front - s.frontOverhang,
    axleRear = axleFront - s.wheelbase;
  const base = roadVehicleModel({
    id: s.id,
    length: L,
    width: cabW,
    height: cabH,
    wheelbase: s.wheelbase,
    wheelRadius: R,
    color: s.color,
    make: s.view ? 'Mercedes-Benz' : 'Bendy',
    model: s.view ? 'SPRINTER' : s.model,
    year: s.year ?? 2024,
    bodyStyle: B ? 'cargo-van' : 'van',
    lamps: s.view ? 'slim' : 'rect',
    grille: 'bars',
    tail: 'vertical',
    cabin: 'tablet',
    driverEye: eye,
    form: {
      belt: A ? 0.46 : 0.49,
      nose: A ? 0.39 : 0.39,
      roofFront: (front - (A ? 0.28 : 1.5)) / L,
      roofRear: B ? -0.44 : A ? -0.45 : cabRear / L,
      rearBase: B ? -0.48 : A ? -0.48 : (cabRear - 0.08) / L,
      windshieldBase: (front - (A ? 0.1 : 0.82)) / L,
      roofWidth: 0.43,
      frontTaper: 0.91,
      rearTaper: 0.94,
      grilleWidth: 0.55,
      grilleHeight: 0.14,
      grilleY: 0.3,
      rows: 1,
      bPillar: (cabRear + 0.15) / L,
      noseRound: 0.15,
      tailRound: 0.05,
      roofCrown: 0.045,
      roofDrop: 0.035,
      frontOverhang: s.frontOverhang,
      windshieldTop: A ? roof - 0.25 : 2.14,
      fitCabin: !A,
      tireWidth: A ? 0.29 : 0.225,
      slidingDoors: B,
      cladding: !A,
      spokes: A ? 8 : 6,
    },
  });
  const root = new T.Group();
  root.name = s.id;
  // Share the already reviewed cab, controls and tire construction without changing older models.
  for (const node of [...base.children]) {
    if (
      !A ||
      node.name.startsWith('wheel-') ||
      ['cabin', 'steering-wheel', 'speed-needle'].includes(node.name)
    )
      root.add(node);
  }
  if (B || C) {
    // Trim the shared road body at the cab bulkhead before adding the coach. Clip crossing
    // triangles rather than deleting entire faces, so the join has no holes or buried glazing.
    for (const name of ['body-shell', 'glazing', 'exterior-fittings', 'rear-fascia']) {
      const group = root.getObjectByName(name);
      group?.traverse((mesh) => {
        if (!mesh.isMesh) return;
        const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
        const p = g.getAttribute('position'),
          vertices = [];
        for (let i = 0; i < p.count; i += 3) {
          const triangle = Array.from({ length: 3 }, (_, j) => [
              p.getX(i + j),
              p.getY(i + j),
              p.getZ(i + j),
            ]),
            clipped = [];
          for (let j = 0; j < 3; j++) {
            const a = triangle[j],
              b = triangle[(j + 1) % 3],
              inside = a[2] >= cabRear,
              next = b[2] >= cabRear;
            if (inside) clipped.push(a);
            if (inside !== next) {
              const t = (cabRear - a[2]) / (b[2] - a[2]);
              clipped.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, cabRear]);
            }
          }
          for (let j = 1; j < clipped.length - 1; j++) {
            const a = new T.Vector3().fromArray(clipped[0]);
            const ab = new T.Vector3().fromArray(clipped[j]).sub(a);
            const ac = new T.Vector3().fromArray(clipped[j + 1]).sub(a);
            if (ab.cross(ac).lengthSq() > 1e-14)
              vertices.push(...clipped[0], ...clipped[j], ...clipped[j + 1]);
          }
        }
        const clipped = new T.BufferGeometry();
        clipped.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
        clipped.computeVertexNormals();
        mesh.geometry = clipped;
      });
      for (const mesh of [...(group?.children ?? [])])
        if (mesh.geometry?.getAttribute('position').count === 0) group.remove(mesh);
    }
  }
  const material = (name, color, metalness = 0, roughness = 0.6) =>
    new T.MeshStandardMaterial({
      name,
      color,
      metalness,
      roughness,
      flatShading: true,
      side: T.DoubleSide,
    });
  const paint = material('vehicle-paint-and-trim', s.color, 0.28, 0.4);
  const dark = material('coach-trim', '#252c30', 0.1, 0.72),
    alloy = material('coach-alloy', '#a7b0b3', 0.7, 0.3);
  const stripe = material('coach-graphics', s.stripe, 0.22, 0.42),
    accent = material('coach-accent', s.accent, 0.2, 0.42);
  const white = material('coach-lens-white', '#e1e7df', 0.08, 0.3),
    red = material('coach-lens-red', '#a22a27', 0.1, 0.3),
    amber = material('coach-lens-amber', '#c58c39', 0.1, 0.4);
  const wood = material('coach-cabinetry', '#6f5845', 0, 0.82),
    fabric = material('coach-upholstery', '#b1a58d', 0, 0.92),
    counter = material('coach-countertop', '#c4c4b9', 0, 0.58);
  const glass = material('coach-glazing', '#3a5260', 0.18, 0.2);
  glass.transparent = true;
  glass.opacity = 0.55;
  glass.depthWrite = false;
  const windshield = glass.clone();
  windshield.name = 'coach-windshield';
  windshield.opacity = 0.24;
  windshield.side = T.FrontSide;
  const shell = detailKit(root, 'coach-shell'),
    fittings = detailKit(root, 'coach-fittings'),
    windows = detailKit(root, 'coach-glazing'),
    interior = detailKit(root, 'coach-interior');
  const interiorBox = interior.box;
  interior.box = (size, at, mat) => {
    if (mat !== fabric) return interiorBox(size, at, mat);
    const [w, h, d] = size,
      b = Math.min(0.035, h * 0.22, d * 0.22);
    const shape = new T.Shape([
      new T.Vector2(-w / 2 + b, -h / 2 + b),
      new T.Vector2(w / 2 - b, -h / 2 + b),
      new T.Vector2(w / 2 - b, h / 2 - b),
      new T.Vector2(-w / 2 + b, h / 2 - b),
    ]);
    const geometry = new T.ExtrudeGeometry(shape, {
      depth: d - 2 * b,
      steps: 1,
      bevelEnabled: true,
      bevelSize: b,
      bevelThickness: b,
      bevelSegments: 1,
    });
    geometry.translate(0, 0, -(d - 2 * b) / 2);
    return interior.add(geometry, mat, at);
  };
  function poly(kit, points, mat) {
    const g = new T.BufferGeometry(),
      p = [];
    for (let i = 1; i < points.length - 1; i++)
      p.push(...points[0], ...points[i], ...points[i + 1]);
    g.setAttribute('position', new T.Float32BufferAttribute(p, 3));
    g.computeVertexNormals();
    return kit.add(g, mat);
  }
  function line(kit, points, r, mat) {
    kit.path(points, r, mat);
  }
  function rect(z, y, w, h, r = 0.055) {
    return [
      [z - w / 2 + r, y - h / 2],
      [z + w / 2 - r, y - h / 2],
      [z + w / 2, y - h / 2 + r],
      [z + w / 2, y + h / 2 - r],
      [z + w / 2 - r, y + h / 2],
      [z - w / 2 + r, y + h / 2],
      [z - w / 2, y + h / 2 - r],
      [z - w / 2, y - h / 2 + r],
    ];
  }
  function sidePoly(kit, points, x, mat) {
    return poly(
      kit,
      points.map(([z, y]) => [x, y, z]),
      mat,
    );
  }
  function outline(points, x, r = 0.012, mat = dark) {
    const p = points.map(([z, y]) => [x, y, z]);
    line(fittings, [...p, p[0]], r, mat);
  }
  const tires = [axleFront, axleRear, ...(s.tagAxle ? [axleRear - 1.23] : [])];
  if (s.dualRear)
    for (const side of [-1, 1]) {
      const original = root.getObjectByName(`wheel-rear-${side > 0 ? 'left' : 'right'}`);
      const spin = original.children[0];
      // Inner rear tire shares its axle spin, while outer rims retain the reviewed brake transform.
      const inner = spin.children[0].clone();
      inner.name = 'dual-inner-tire';
      inner.position.x = -side * 0.27;
      spin.add(inner);
      if (s.tagAxle) {
        const tag = root.getObjectByName(`wheel-front-${side > 0 ? 'left' : 'right'}`).clone();
        const old = tag.name;
        tag.name = `wheel-tag-${side > 0 ? 'left' : 'right'}`;
        tag.traverse((n) => {
          if (n !== tag && n.name.startsWith(old)) n.name = n.name.replace(old, tag.name);
        });
        tag.position.z = axleRear - 1.23;
        root.add(tag);
      }
    }
  const livingFront = B ? cabRear : A ? front - 2.2 : coachFront;
  const floorFront = A ? front - 0.2 : livingFront;
  interior.box([W - 0.18, 0.08, floorFront - back], [0, floor, (floorFront + back) / 2], wood);
  // An arch-following lower contour leaves tires exposed; window holes go through the shell.
  for (const side of [-1, 1]) {
    const x = (side * W) / 2;
    const openings = [];
    if (A) openings.push({ z: front - 0.95, y: 2.18, w: 1.05, h: 0.87 });
    const usableFront = A ? front - 2 : coachFront - 0.22;
    const span = usableFront - back;
    for (let i = 0; i < (L > 10 ? 4 : B ? 2 : 3); i++) {
      const count = L > 10 ? 4 : B ? 2 : 3,
        z = usableFront - 0.68 - (i * (span - 1.4)) / (count - 1);
      // Passenger entry occupies the front coach window bay on Class C.
      if (C && side < 0 && i === 0) continue;
      openings.push({
        z,
        y: floor + 1.28,
        w: i === 0 ? 1.14 : Math.min(1.25, span / count - 0.28),
        h: i === count - 1 && s.view ? 0.45 : 0.67,
      });
    }
    if (C && side < 0) openings.push({ z: coachFront - 0.55, y: floor + 1.28, w: 0.36, h: 0.56 });
    const contour = [[back, 0.43]];
    const arch = R + 0.07;
    const inRange = tires
      .filter((z) => z - arch > back && z + arch < coachFront)
      .sort((a, b) => a - b);
    for (const z of inRange) {
      contour.push([z - arch, 0.43], [z - arch, R]);
      for (let i = 0; i <= 16; i++) {
        const a = Math.PI - (i * Math.PI) / 16;
        contour.push([z + Math.cos(a) * arch, R + Math.sin(a) * arch]);
      }
      contour.push([z + arch, 0.43]);
    }
    contour.push([coachFront, 0.43], [coachFront, roof - 0.14], [back, roof - 0.14]);
    const shape = new T.Shape(contour.map(([z, y]) => new T.Vector2(z, y)));
    for (const o of openings) {
      const p = rect(o.z, o.y, o.w, o.h);
      shape.holes.push(new T.Path(p.map(([z, y]) => new T.Vector2(z, y))));
      sidePoly(windows, p, x + side * 0.006, glass);
      outline(p, x + side * 0.013, 0.023);
      fittings.rod(
        [x + side * 0.018, o.y - o.h * 0.2, o.z - o.w / 2],
        [x + side * 0.018, o.y - o.h * 0.2, o.z + o.w / 2],
        0.009,
        dark,
      );
    }
    const g = new T.ShapeGeometry(shape).rotateY(-Math.PI / 2);
    shell.add(g, paint, [x, 0, 0]);
    // Polygonal shoulder and gently crowned roof, with visible rain gutter.
    poly(
      shell,
      [
        [x, roof - 0.14, back],
        [x, roof - 0.14, coachFront],
        [x - side * 0.12, roof, coachFront],
        [x - side * 0.12, roof, back],
      ],
      paint,
    );
    fittings.rod([x, roof - 0.12, back], [x, roof - 0.12, coachFront], 0.018, alloy);
    for (const z of inRange) {
      const p = [];
      for (let i = 0; i <= 16; i++) {
        const a = (i * Math.PI) / 16;
        p.push([x + side * 0.012, R + Math.sin(a) * arch, z + Math.cos(a) * arch]);
      }
      line(fittings, p, 0.025, dark);
    }
    // Tapered coach graphics; camper vans use a narrower waist stripe.
    const start = back + 0.12,
      end = (A ? front - 1.9 : coachFront) - 0.14;
    if (B)
      sidePoly(
        fittings,
        [
          [start, 1.1],
          [end, 1.1],
          [end, 1.19],
          [start, 1.19],
        ],
        x + side * 0.011,
        stripe,
      );
    else {
      sidePoly(
        fittings,
        [
          [start, 1.48],
          [start + 1, 1.2],
          [end, 1.05],
          [end - 0.6, 1.3],
          [start + 1.7, 1.59],
        ],
        x + side * 0.011,
        stripe,
      );
      sidePoly(
        fittings,
        [
          [start, 1.68],
          [start + 1.6, 1.46],
          [end, 1.45],
          [end - 0.7, 1.53],
          [start + 1.6, 1.74],
        ],
        x + side * 0.014,
        accent,
      );
    }
    // Storage hatches sit between axles or behind them, never across tires.
    for (let z = back + 0.65; z < coachFront - 0.7; z += 1.1) {
      if (tires.some((a) => Math.abs(a - z) < R + 0.6)) continue;
      const h = rect(z, 0.76, 0.92, 0.49, 0.025);
      outline(h, x + side * 0.025, 0.009);
      fittings.box([0.025, 0.045, 0.12], [x + side * 0.036, 0.93, z], dark);
      for (const dz of [-0.32, 0.32])
        fittings.box([0.025, 0.025, 0.11], [x + side * 0.035, 0.53, z + dz], alloy);
    }
    // Flush touring slide seal, no duplicate surface hiding its windows.
    if (side > 0 && !B)
      outline(
        rect((back + usableFront) / 2, floor + 1.0, span - 0.36, 1.9, 0.025),
        x + side * 0.025,
        0.012,
      );
    if (B && side < 0) {
      outline(rect(coachFront - 0.65, 1.42, 1.2, 1.85, 0.04), x - 0.025, 0.01);
      fittings.box([0.025, 0.035, 0.18], [x - 0.04, 1.35, coachFront - 1.15], dark);
      fittings.rod(
        [x - 0.025, 1.39, back + 0.25],
        [x - 0.025, 1.39, coachFront - 1.22],
        0.014,
        alloy,
      );
    }
    if (!s.view)
      fittings.text(
        s.model.replace('Class ', '').toUpperCase(),
        [x + side * 0.025, roof - 0.34, back + 1.6],
        0.12,
        (side * Math.PI) / 2,
        dark,
      );
  }
  shell.box([W - 0.24, 0.06, coachFront - back], [0, roof - 0.025, (coachFront + back) / 2], paint);
  // Rear cap is deliberately solid around the bedroom/bath, with molded corner strips.
  shell.box([W, 0.1, 0.1], [0, 0.48, back], stripe);
  shell.box([W - 0.1, roof - 0.55, 0.08], [0, (roof + 0.45) / 2, back], paint);
  for (const side of [-1, 1]) {
    shell.box(
      [0.1, roof - 0.52, 0.12],
      [side * (W / 2 - 0.05), (roof + 0.43) / 2, back + 0.02],
      paint,
    );
    fittings.box([0.14, 0.55, 0.035], [side * (W / 2 - 0.24), 0.99, back - 0.055], dark);
    for (let i = 0; i < 3; i++)
      fittings.box(
        [0.1, 0.13, 0.04],
        [side * (W / 2 - 0.24), 0.81 + i * 0.17, back - 0.08],
        i === 0 ? white : red,
      );
  }
  // Coach and cab names stay out of the View's geometry; the house wordmark is for Bendy designs.
  if (!s.view) fittings.text('BENDY', [0, roof - 0.4, back - 0.05], 0.14, Math.PI, dark);
  fittings.box([0.34, 0.16, 0.025], [0, 0.65, back - 0.065], white);
  fittings.text(s.view ? 'MLN 22' : 'BENDY', [0, 0.65, back - 0.082], 0.04, Math.PI, dark);
  if (B) {
    fittings.rod([0, 0.5, back - 0.05], [0, roof - 0.1, back - 0.05], 0.009, dark);
    for (const x of [-0.43, 0.43]) {
      fittings.box([0.64, 0.56, 0.015], [x, 1.94, back - 0.051], dark);
      fittings.box([0.6, 0.52, 0.018], [x, 1.94, back - 0.061], stripe);
      fittings.box([0.15, 0.045, 0.035], [x * 0.4, 1.25, back - 0.07], alloy);
    }
  }
  if (C) {
    // Chamfered overcab sleeper: tapered shoulder, radiused faceted leading edge, actual bunk.
    const profile = [
      [coachFront, 2.35],
      [front - 0.47, 2.35],
      [front - 0.12, 2.52],
      [front - 0.08, 2.77],
      [front - 0.28, roof - 0.08],
      [front - 0.65, roof],
      [coachFront, roof],
    ];
    for (const side of [-1, 1]) {
      sidePoly(shell, profile, side * (W / 2 - 0.07), paint);
      sidePoly(
        fittings,
        [
          [front - 0.6, 2.67],
          [front - 1.18, 2.48],
          [coachFront + 0.1, 2.48],
          [coachFront + 0.1, 2.7],
          [front - 0.9, 2.86],
        ],
        side * (W / 2 - 0.063),
        stripe,
      );
    }
    for (let i = 0; i < profile.length - 1; i++) {
      const [za, ya] = profile[i],
        [zb, yb] = profile[i + 1];
      poly(
        shell,
        [
          [-W / 2 + 0.07, ya, za],
          [W / 2 - 0.07, ya, za],
          [W / 2 - 0.07, yb, zb],
          [-W / 2 + 0.07, yb, zb],
        ],
        paint,
      );
    }
    if (s.view) {
      // Neutral cab badge: a plain ring and disc, not the cab maker's emblem or the coach name.
      fittings.ring(0.095, 0.012, [0, 0.83, front + 0.07], alloy);
      fittings.add(new T.CircleGeometry(0.05, 20), alloy, [0, 0.83, front + 0.072]);
    } else fittings.text('BENDY', [0, 2.72, front - 0.065], 0.15, 0, dark);
    interior.box([W - 0.3, 0.12, 1.52], [0, 2.43, front - 1.1], fabric);
    // Exposed transition from narrow cab to the wider coach below its sleeper.
    for (const side of [-1, 1])
      shell.box([(W - cabW) / 2, 1.92, 0.1], [(side * (W + cabW)) / 4, 1.39, coachFront], paint);
  }
  if (A) {
    // Faceted front cap: wraparound windshield above the driver's clear eye line.
    shell.box([W - 0.12, 1.37, 0.16], [0, 1.15, front - 0.075], paint);
    const y0 = 1.76,
      y1 = roof - 0.33,
      z0 = front - 0.12,
      z1 = front - 0.31;
    for (const side of [-1, 1]) {
      const p = [
        [0, y0, z0],
        [side * (W / 2 - 0.16), y0, z0 - 0.06],
        [side * (W / 2 - 0.22), y1, z1 - 0.04],
        [0, y1, z1],
      ];
      poly(windows, side > 0 ? p : [...p].reverse(), windshield);
      line(fittings, [...p, p[0]], 0.027, dark);
      shell.box(
        [0.12, roof - 0.51, 0.12],
        [side * (W / 2 - 0.07), (roof + 0.45) / 2, front - 0.18],
        paint,
      );
      fittings.rod(
        [side * 0.26, y0 + 0.03, z0 + 0.025],
        [side * 0.66, y0 + 0.1, z0 + 0.014],
        0.014,
        dark,
      );
      fittings.rod(
        [side * 0.42, y0 + 0.09, z0 + 0.015],
        [side * 1.05, y0 + 0.19, z0 - 0.005],
        0.017,
        dark,
      );
      fittings.box([0.46, 0.2, 0.05], [side * 0.75, 1.15, front + 0.02], dark);
      for (const dx of [-0.12, 0.12])
        fittings.add(new T.CylinderGeometry(0.067, 0.067, 0.035, 16).rotateX(Math.PI / 2), white, [
          side * 0.75 + dx,
          1.15,
          front + 0.05,
        ]);
      fittings.box([0.41, 0.025, 0.025], [side * 0.75, 0.99, front + 0.03], white);
      // Long-arm coach mirrors with separate upper and convex lower lenses.
      fittings.rod(
        [side * (W / 2 - 0.05), 1.65, front - 0.3],
        [side * (W / 2 + 0.18), 1.95, front - 0.1],
        0.032,
        alloy,
      );
      fittings.box([0.16, 0.42, 0.12], [side * (W / 2 + 0.18), 2.11, front - 0.1], dark);
      fittings.box([0.135, 0.27, 0.012], [side * (W / 2 + 0.18), 2.16, front - 0.168], alloy);
      fittings.box([0.135, 0.09, 0.012], [side * (W / 2 + 0.18), 1.97, front - 0.168], alloy);
    }
    shell.box([W - 0.25, 0.27, 0.22], [0, roof - 0.13, front - 0.2], paint);
    fittings.box([W - 0.2, 0.16, 0.12], [0, 0.57, front + 0.01], stripe);
    for (let i = 0; i < 5; i++)
      fittings.box([0.82, 0.022, 0.035], [0, 0.72 + i * 0.044, front + 0.023], dark);
    fittings.text('BENDY', [0, 1.47, front + 0.014], 0.1, 0, alloy);
  }
  // Roof equipment: chamfered air conditioners, louvers, hatches, antenna and two solar modules.
  for (let i = 0; i < s.acUnits; i++) {
    const z = (B ? -0.5 : -0.1) - i * 2.5;
    shell.box([0.78, 0.12, 0.98], [0, roof + 0.06, z], paint);
    shell.box([0.66, 0.14, 0.84], [0, roof + 0.17, z - 0.04], paint);
    for (const side of [-1, 1])
      for (let j = 0; j < 7; j++)
        fittings.box([0.018, 0.07, 0.045], [side * 0.397, roof + 0.08, z - 0.31 + j * 0.1], dark);
  }
  for (const z of [livingFront - 0.55, back + 0.68]) {
    shell.box([0.46, 0.08, 0.46], [0.35, roof + 0.04, z], dark);
    shell.box([0.42, 0.08, 0.42], [0.35, roof + 0.1, z], counter);
  }
  for (const x of [-0.6, 0.6]) {
    shell.box([0.49, 0.04, 1.05], [x, roof + 0.025, -1.28], alloy);
    shell.box([0.45, 0.01, 1.0], [x, roof + 0.05, -1.28], stripe);
    for (let i = 1; i < 6; i++)
      fittings.box([0.45, 0.003, 0.005], [x, roof + 0.057, -1.8 + i / 6], alloy);
  }
  fittings.rod([-0.2, roof, back + 0.8], [-0.2, roof + 0.21, back + 0.8], 0.025, dark);
  fittings.box([0.35, 0.025, 0.12], [-0.2, roof + 0.22, back + 0.8], white);
  // Retracted awning and its end caps on the curb side.
  const awningLength = s.view ? 4.8768 : Math.min(L - 2.2, 6.4),
    awningZ = (back + livingFront) / 2 + 0.3;
  fittings.box([0.16, 0.14, awningLength], [-W / 2 - 0.055, roof - 0.12, awningZ], dark);
  fittings.box([0.012, 0.015, awningLength - 0.15], [-W / 2 - 0.14, roof - 0.17, awningZ], white);
  for (const z of [awningZ - awningLength / 2, awningZ + awningLength / 2])
    fittings.box([0.18, 0.17, 0.07], [-W / 2 - 0.05, roof - 0.12, z], alloy);
  const doorZ = A ? front - 1.45 : coachFront - 0.55;
  if (!B) {
    outline(rect(doorZ, floor + 0.87, 0.67, 1.82, 0.04), -W / 2 - 0.026, 0.014);
    fittings.box([0.03, 0.16, 0.08], [-W / 2 - 0.045, floor + 0.95, doorZ - 0.23], dark);
    fittings.rod(
      [-W / 2 - 0.06, floor + 0.76, doorZ - 0.45],
      [-W / 2 - 0.06, floor + 1.16, doorZ - 0.45],
      0.025,
      alloy,
    );
    for (let i = 0; i < 2; i++)
      fittings.box([0.25, 0.055, 0.67], [-W / 2 - 0.045, floor - 0.2 - i * 0.22, doorZ], dark);
    fittings.box([0.035, 0.06, 0.2], [-W / 2 - 0.04, floor + 1.95, doorZ], white);
  }
  // Service fittings, vent grille, seam fasteners, rear ladder and tow receiver.
  for (const [i, label] of ['WATER', 'POWER', 'LP'].entries()) {
    const z = back + 0.6 + i * 0.5;
    fittings.box([0.025, 0.23, 0.32], [W / 2 + 0.02, 1.15, z], counter);
    fittings.add(new T.CylinderGeometry(0.046, 0.046, 0.02, 12).rotateZ(Math.PI / 2), dark, [
      W / 2 + 0.045,
      1.15,
      z,
    ]);
    fittings.text(label, [W / 2 + 0.04, 1.31, z], 0.04, Math.PI / 2, dark);
  }
  for (let i = 0; i < 7; i++)
    fittings.box([0.03, 0.025, 0.55], [W / 2 + 0.027, 1.55 + i * 0.045, back + 0.65], dark);
  for (const side of [-1, 1]) {
    for (const z of [back + 0.25, Math.min(livingFront - 0.1, front - 0.3)])
      fittings.box([0.03, 0.07, 0.14], [side * (W / 2 + 0.02), 0.55, z], z < 0 ? red : amber);
    for (const z of tires)
      fittings.box([0.26, 0.19, 0.025], [side * cabW * 0.43, 0.23, z - R - 0.08], dark);
    for (let z = back + 0.25; z < livingFront; z += 0.38)
      fittings.add(new T.CylinderGeometry(0.006, 0.006, 0.006, 6).rotateZ(Math.PI / 2), alloy, [
        side * (W / 2 + 0.01),
        roof - 0.19,
        z,
      ]);
  }
  if (!B) {
    for (const x of [-W / 2 + 0.24, -W / 2 + 0.66])
      fittings.rod([x, 0.65, back - 0.17], [x, roof + 0.05, back - 0.17], 0.024, alloy);
    for (let y = 0.85; y < roof; y += 0.27)
      fittings.rod([-W / 2 + 0.24, y, back - 0.17], [-W / 2 + 0.66, y, back - 0.17], 0.018, alloy);
    for (let i = -2; i <= 2; i++) {
      fittings.box([0.07, 0.035, 0.025], [i * 0.24, roof - 0.08, back - 0.055], red);
      if (A) fittings.box([0.07, 0.035, 0.025], [i * 0.24, roof - 0.06, front - 0.075], amber);
    }
  }
  fittings.box([0.09, 0.09, 0.26], [0, 0.33, back - 0.08], dark);
  // Compact, visible living space. Closed bath and stowed bed respect the touring envelope.
  const galleyZ = Math.min(livingFront - 0.95, 0.15),
    insideX = W / 2 - 0.35;
  interior.box([0.38, 0.25, 1.4], [-insideX, roof - 0.2, galleyZ], wood);
  for (const z of [galleyZ - 0.45, galleyZ, galleyZ + 0.45]) {
    interior.box([0.014, 0.21, 0.43], [-insideX + 0.2, roof - 0.2, z], counter);
    interior.rod(
      [-insideX + 0.22, roof - 0.26, z - 0.08],
      [-insideX + 0.22, roof - 0.26, z + 0.08],
      0.008,
      alloy,
    );
  }
  interior.box([0.52, 0.83, 1.35], [-insideX, floor + 0.46, galleyZ], wood);
  interior.box([0.57, 0.055, 1.4], [-insideX, floor + 0.9, galleyZ], counter);
  interior.box([0.28, 0.014, 0.33], [-insideX, floor + 0.94, galleyZ + 0.35], alloy);
  interior.box([0.23, 0.016, 0.28], [-insideX, floor + 0.949, galleyZ + 0.35], dark);
  line(
    interior,
    [
      [-insideX - 0.15, floor + 0.94, galleyZ + 0.35],
      [-insideX - 0.15, floor + 1.15, galleyZ + 0.35],
      [-insideX, floor + 1.15, galleyZ + 0.35],
    ],
    0.012,
    alloy,
  );
  for (const z of [galleyZ - 0.3, galleyZ - 0.55])
    interior.ring(0.08, 0.009, [-insideX, floor + 0.94, z], dark, 'y');
  for (let i = 0; i < 3; i++) {
    interior.box([0.012, 0.008, 1.25], [-insideX + 0.27, floor + 0.3 + i * 0.2, galleyZ], dark);
    interior.rod(
      [-insideX + 0.29, floor + 0.38 + i * 0.2, galleyZ - 0.12],
      [-insideX + 0.29, floor + 0.38 + i * 0.2, galleyZ + 0.12],
      0.008,
      alloy,
    );
  }
  // U-shaped dinette on the driver's side with pedestal table and cushion piping.
  const loungeZ = livingFront - 0.95;
  for (const z of [loungeZ - 0.55, loungeZ + 0.55]) {
    interior.box([0.65, 0.22, 0.38], [insideX - 0.06, floor + 0.39, z], fabric);
    interior.box(
      [0.65, 0.55, 0.1],
      [insideX - 0.06, floor + 0.65, z + Math.sign(z - loungeZ) * 0.2],
      fabric,
    );
  }
  interior.box([0.2, 0.42, 1.2], [insideX + 0.17, floor + 0.53, loungeZ], fabric);
  interior.box([0.63, 0.04, 0.67], [insideX - 0.12, floor + 0.74, loungeZ], counter);
  interior.rod(
    [insideX - 0.12, floor + 0.05, loungeZ],
    [insideX - 0.12, floor + 0.72, loungeZ],
    0.035,
    alloy,
  );
  const rearRoom = back + 1.05;
  // Tall two-door refrigerator, freezer division and recessed vertical handles.
  const fridgeZ = B ? back + 1.38 : galleyZ - 1.12;
  interior.box([0.54, 1.65, 0.64], [-insideX, floor + 0.865, fridgeZ], wood);
  interior.box([0.025, 1.57, 0.59], [-insideX + 0.282, floor + 0.87, fridgeZ], alloy);
  interior.box([0.03, 0.013, 0.6], [-insideX + 0.3, floor + 1.3, fridgeZ], dark);
  for (const y of [floor + 0.8, floor + 1.48])
    interior.rod(
      [-insideX + 0.32, y - 0.12, fridgeZ + 0.23],
      [-insideX + 0.32, y + 0.12, fridgeZ + 0.23],
      0.012,
      dark,
    );
  if (A) {
    const z = -0.25,
      sofaLength = L > 11 ? 2.3 : 1.8;
    interior.box([0.62, 0.2, sofaLength], [insideX - 0.06, floor + 0.42, z], fabric);
    interior.box([0.14, 0.57, sofaLength], [insideX + 0.2, floor + 0.72, z], fabric);
    for (const dz of [-sofaLength / 2, sofaLength / 2])
      interior.box([0.67, 0.25, 0.12], [insideX - 0.06, floor + 0.61, z + dz], fabric);
    for (let dz = -sofaLength / 2 + 0.55; dz < sofaLength / 2; dz += 0.57)
      interior.rod(
        [insideX - 0.35, floor + 0.527, z + dz],
        [insideX + 0.14, floor + 0.527, z + dz],
        0.004,
        wood,
      );
    interior.box([0.46, 1.82, 0.85], [insideX, floor + 0.95, rearRoom + 0.6], wood);
    interior.rod(
      [insideX - 0.245, floor + 0.8, rearRoom + 0.65],
      [insideX - 0.245, floor + 1.05, rearRoom + 0.65],
      0.012,
      alloy,
    );
  }
  interior.box([W - 0.22, 1.85, 0.065], [0, floor + 0.96, rearRoom], wood);
  interior.box([0.62, 1.65, 0.02], [0, floor + 0.88, rearRoom + 0.04], counter);
  interior.rod(
    [0.23, floor + 0.9, rearRoom + 0.065],
    [0.23, floor + 1.04, rearRoom + 0.065],
    0.012,
    alloy,
  );
  if (s.view) {
    // 24D's Murphy bed is upright behind the sofa while traveling.
    interior.box([0.16, 1.6, 1.8], [W / 2 - 0.2, floor + 0.86, rearRoom + 1.1], wood);
    interior.box([0.5, 0.25, 1.65], [W / 2 - 0.45, floor + 0.4, rearRoom + 1.1], fabric);
    interior.box([0.17, 0.49, 1.65], [W / 2 - 0.23, floor + 0.73, rearRoom + 1.1], fabric);
  } else {
    interior.box([W - 0.42, 0.22, 0.85], [0, floor + 0.45, back + 0.5], fabric);
    for (const x of [-0.43, 0.43])
      interior.box([0.47, 0.1, 0.28], [x, floor + 0.6, back + 0.72], counter);
  }
  for (const kit of [shell, fittings, windows, interior]) kit.finish();
  if (B) {
    // A van conversion retains a tapered upper body instead of a square motorhome box.
    for (const kit of [shell, fittings, windows])
      kit.root.traverse((mesh) => {
        if (!mesh.isMesh) return;
        const p = mesh.geometry.getAttribute('position');
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i),
            y = p.getY(i),
            z = p.getZ(i);
          if (Math.abs(x) > W * 0.38 && z <= cabRear + 0.06 && y > 1.25)
            p.setX(i, x - Math.sign(x) * 0.105 * Math.min(1, (y - 1.25) / (roof - 1.25)));
        }
        mesh.geometry.computeVertexNormals();
      });
  }
  return root;
}
