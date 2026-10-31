/** Touring motorhomes. Hollow coach shells, real glazing openings, stowed fittings, no bitmaps. */
import '../../worldgen/scripts/install-deterministic-math.mjs';
import * as T from 'three';
import { articulateMotorhome } from './road-articulation.mjs';
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
  // Cab profiles (m; set-backs from the bumper): a Sprinter-type van cab (View) and a ProMaster-
  // type high-roof van (Class B) have short sloping hoods and raked screens; the Ford E-series
  // cutaway under the Bendy Class C has a taller, longer hood and a more upright screen.
  const cab = A
    ? undefined
    : s.view
      ? { belt: 1.4, nose: 1.08, cowl: 1.0, header: 1.68, glassTop: 2.16, slope: 0.18 }
      : B
        ? { belt: 1.22, nose: 1.0, cowl: 0.8, header: 1.5, glassTop: 2.02, slope: 0.12 }
        : {
            belt: 1.45,
            nose: 1.15,
            cowl: 1.35,
            header: 1.72,
            glassTop: 2.16,
            slope: 0.06,
            square: true,
          };
  const base = roadVehicleModel({
    articulate: false,
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
    // A recipe's lamps, grille and form keys dress the cab face like a road-vehicle recipe.
    lamps: s.lamps ?? (s.view ? 'slim' : 'rect'),
    grille: s.grille ?? 'bars',
    tail: 'vertical',
    cabin: 'tablet',
    driverEye: eye,
    form: {
      belt: A ? 0.46 : cab.belt / cabH,
      nose: A ? 0.39 : cab.nose / cabH,
      noseSlope: cab?.slope,
      roofFront: (front - (A ? 0.28 : cab.header)) / L,
      roofRear: B ? -0.475 : A ? -0.45 : cabRear / L,
      rearBase: B ? -0.49 : A ? -0.48 : (cabRear - 0.08) / L,
      windshieldBase: (front - (A ? 0.1 : cab.cowl)) / L,
      roofWidth: 0.43,
      frontTaper: cab?.square ? 0.97 : 0.91,
      rearTaper: 0.94,
      hoodCurve: cab ? (cab.square ? 1.05 : 1.3) : undefined,
      grilleWidth: cab?.square ? 0.6 : 0.55,
      grilleHeight: A ? 0.14 : 0.3 / cabH,
      grilleY: A ? 0.3 : (cab.nose * 0.7) / cabH,
      rows: 1,
      bPillar: (cabRear + 0.15) / L,
      noseRound: cab?.square ? 0.1 : 0.15,
      tailRound: 0.05,
      roofCrown: 0.045,
      roofDrop: 0.035,
      frontOverhang: s.frontOverhang,
      windshieldTop: A ? roof - 0.25 : cab.glassTop,
      fitCabin: !A,
      tireWidth: A ? 0.29 : 0.225,
      slidingDoors: B,
      cargoVan: B,
      cladding: !A,
      spokes: A ? 8 : 6,
      ...s.form,
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
  // A Class C coach is built behind the cab bulkhead: trim the shared road body there. A Class B
  // keeps the whole high-roof van body (its roof rises from the windshield header in a raked cap
  // and rolls over rounded shoulders) and is fitted out on that skin.
  if (C) clipBehind(root, cabRear, ['body-shell', 'glazing', 'exterior-fittings', 'rear-fascia']);
  root.updateMatrixWorld(true);
  const skin = [],
    caster = new T.Raycaster();
  root.getObjectByName('body-shell')?.traverse((n) => n.isMesh && skin.push(n));
  // Outer van skin along a ray toward the body (B fittings sit on it), or `miss` if none.
  const skinHit = (from, direction, miss) => {
    caster.set(new T.Vector3(...from), new T.Vector3(...direction));
    return caster.intersectObjects(skin, false)[0]?.point ?? miss;
  };
  const skinX = (side, y, z) => skinHit([side * 3, y, z], [-side, 0, 0], { x: (side * W) / 2 }).x;
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
  // Coach windows carry the dark privacy tint of RV glazing; the windshield stays clearer.
  const glass = material('coach-glazing', '#24323b', 0.18, 0.2);
  glass.transparent = true;
  glass.opacity = 0.7;
  glass.depthWrite = false;
  const windshield = glass.clone();
  windshield.name = 'coach-windshield';
  // Cab glass: the road vehicles' tint (road-vehicle-geometry.mjs), so a Class A screen reads as
  // dark glass like the cutaway and van cabs; it is single-sided, so the driver's view from the
  // cab stays clear.
  windshield.color.set('#2b3b48');
  windshield.metalness = 0.3;
  windshield.roughness = 0.12;
  windshield.opacity = 0.8;
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
      // Inner rear tire shares its axle spin, while outer rims retain the reviewed brake transform;
      // the cab builder draws the pair itself when the recipe's form sets dually.
      if (!s.form?.dually) {
        const inner = spin.children[0].clone();
        inner.name = 'dual-inner-tire';
        inner.position.x = -side * 0.27;
        spin.add(inner);
      }
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
  // Class A side walls stop where the molded front cap begins, clear of the front wheel arch;
  // coach walls stop where the molded rear cap rolls round its corners.
  const sideFront = A ? front - Math.min(1.15, s.frontOverhang - R - 0.15) : coachFront;
  const rearCap = B ? 0 : 0.3,
    sideBack = back + rearCap;
  const floorBack = back + (B ? 0 : 0.03);
  interior.box(
    [W - 0.18, 0.08, floorFront - floorBack],
    [0, floor, (floorFront + floorBack) / 2],
    wood,
  );
  // Class A window bays: large dark-framed windows spread from behind the driver's window to the
  // bedroom, clear of the rear cap; slide-out rooms stand proud of the wall around some of them.
  const bays = [];
  const slides = { 1: [], [-1]: [] };
  if (A) {
    const count = L > 12 ? 5 : L > 10 ? 4 : 3,
      zA = sideFront - 2,
      zB = back + 1.35,
      w = Math.min(1.45, (zA - zB) / (count - 1) - 0.45);
    for (let i = 0; i < count; i++) bays.push({ z: zA - (i * (zA - zB)) / (count - 1), w });
    const around = (from, to, fore = Infinity) => ({
      z0: bays[to].z - w / 2 - 0.3,
      z1: Math.min(fore, bays[from].z + w / 2 + 0.3),
    });
    // A full-wall street-side slide behind the driver, a curb-side lounge slide and, on the
    // longest coaches, a bedroom slide.
    slides[1].push(around(0, 1, sideFront - 1.07));
    slides[-1].push(around(1, count > 4 ? 2 : 1));
    if (count > 4) slides[1].push(around(3, 3));
  }
  const slideDepth = 0.075,
    slideAt = (side, z) => slides[side].find((p) => z > p.z0 && z < p.z1);
  // An arch-following lower contour leaves tires exposed; window holes go through the shell.
  for (const side of [-1, 1]) {
    const x = (side * W) / 2;
    if (B) {
      // The van conversion is fitted out on the high-roof van's skin: a long band of flush dark
      // privacy glass in the cab glass band (on the curb side a separate pane rides on the
      // sliding door), a waist stripe and the model name low on the rear quarter.
      const onSkin = (z, y, lift) => [skinX(side, y, z) + side * lift, y, z];
      const y = floor + 1.02,
        h = 0.67;
      for (const [z, w] of side > 0
        ? [
            [-0.55, 2.3],
            [-2.38, 0.85],
          ]
        : [
            [cabRear - 0.65, 0.56],
            [-1.45, 2.1],
          ]) {
        const n = Math.ceil(w / 0.5),
          zs = Array.from({ length: n + 1 }, (_, i) => z - w / 2 + 0.02 + (i * (w - 0.04)) / n),
          ys = [y - h / 2 + 0.02, y, y + h / 2 - 0.02];
        for (let i = 0; i < n; i++)
          for (let j = 0; j < 2; j++)
            for (const [kit, mat, lift] of [
              [fittings, dark, 0.006],
              [windows, glass, 0.01],
            ])
              poly(
                kit,
                [
                  onSkin(zs[i], ys[j], lift),
                  onSkin(zs[i + 1], ys[j], lift),
                  onSkin(zs[i + 1], ys[j + 1], lift),
                  onSkin(zs[i], ys[j + 1], lift),
                ],
                mat,
              );
        const frame = rect(z, y, w, h).map(([zz, yy]) => onSkin(zz, yy, 0.014));
        line(fittings, [...frame, frame[0]], 0.023, dark);
      }
      const zs = Array.from({ length: 13 }, (_, i) => back + 0.15 + (i * (cabRear - back)) / 12);
      for (let i = 0; i < zs.length - 1; i++)
        poly(
          fittings,
          [
            onSkin(zs[i], 1.1, 0.008),
            onSkin(zs[i + 1], 1.1, 0.008),
            onSkin(zs[i + 1], 1.19, 0.008),
            onSkin(zs[i], 1.19, 0.008),
          ],
          stripe,
        );
      fittings.text(
        s.model.replace('Class ', '').toUpperCase(),
        onSkin(back + 1.0, 0.95, 0.012),
        0.1,
        (side * Math.PI) / 2,
        dark,
      );
      continue;
    }
    const openings = [];
    // Driver's window behind the cap; the entry door takes that bay on the curb side.
    if (A && side > 0) openings.push({ z: sideFront - 0.5, y: 2.32, w: 0.9, h: 0.8 });
    const usableFront = A ? front - 2 : coachFront - 0.22;
    const span = usableFront - sideBack;
    if (A) for (const b of bays) openings.push({ z: b.z, y: floor + 1.3, w: b.w, h: 0.78 });
    else
      for (let i = 0; i < (L > 10 ? 4 : 3); i++) {
        const count = L > 10 ? 4 : 3,
          z = usableFront - 0.68 - (i * (span - 1.4)) / (count - 1);
        // Passenger entry occupies the front coach window bay on Class C.
        if (C && side < 0 && i === 0) continue;
        openings.push({
          z,
          y: floor + (s.view ? 1.21 : 1.28),
          w: i === 0 ? 1.14 : Math.min(1.25, span / count - 0.28),
          h: i === count - 1 && s.view ? 0.45 : s.view ? 0.67 : 0.74,
        });
      }
    if (C && side < 0) openings.push({ z: coachFront - 0.55, y: floor + 1.28, w: 0.36, h: 0.56 });
    const contour = [[sideBack, 0.43]];
    const arch = R + 0.07;
    const inRange = tires
      .filter((z) => z - arch > back && z + arch < sideFront)
      .sort((a, b) => a - b);
    for (const z of inRange) {
      contour.push([z - arch, 0.43], [z - arch, R]);
      for (let i = 0; i <= 16; i++) {
        const a = Math.PI - (i * Math.PI) / 16;
        contour.push([z + Math.cos(a) * arch, R + Math.sin(a) * arch]);
      }
      contour.push([z + arch, 0.43]);
    }
    contour.push([sideFront, 0.43], [sideFront, roof - 0.14], [sideBack, roof - 0.14]);
    const shape = new T.Shape(contour.map(([z, y]) => new T.Vector2(z, y)));
    // Slide-out rooms: a painted box proud of the wall with its own windows, a dark seal round
    // its opening and the topper cassette above it. Window holes also pierce the wall behind.
    const slideFaces = slides[side].map((p) => {
      const y0 = floor - 0.02,
        y1 = roof - 0.3,
        xo = x + side * slideDepth,
        corners = [
          [p.z0, y0],
          [p.z1, y0],
          [p.z1, y1],
          [p.z0, y1],
        ];
      for (let i = 0; i < 4; i++) {
        const [za, ya] = corners[i],
          [zb, yb] = corners[(i + 1) % 4];
        poly(
          shell,
          [
            [x, ya, za],
            [x, yb, zb],
            [xo, yb, zb],
            [xo, ya, za],
          ],
          paint,
        );
      }
      outline(corners, x + side * 0.012, 0.016);
      fittings.box(
        [0.09, 0.09, p.z1 - p.z0 + 0.12],
        [x + side * 0.045, y1 + 0.075, (p.z0 + p.z1) / 2],
        alloy,
      );
      return { ...p, xo, shape: new T.Shape(corners.map(([z, y]) => new T.Vector2(z, y))) };
    });
    for (const o of openings) {
      const p = rect(o.z, o.y, o.w, o.h),
        room = slideFaces.find((f) => o.z > f.z0 && o.z < f.z1),
        face = room ? room.xo : x;
      shape.holes.push(new T.Path(p.map(([z, y]) => new T.Vector2(z, y))));
      room?.shape.holes.push(new T.Path(p.map(([z, y]) => new T.Vector2(z, y))));
      sidePoly(windows, p, face + side * 0.006, glass);
      // A Class A coach has frameless bonded windows: a thin seal and no slider rail.
      outline(p, face + side * 0.013, A ? 0.012 : 0.023);
      if (!A)
        fittings.rod(
          [face + side * 0.018, o.y - o.h * 0.2, o.z - o.w / 2],
          [face + side * 0.018, o.y - o.h * 0.2, o.z + o.w / 2],
          0.009,
          dark,
        );
    }
    for (const f of slideFaces)
      shell.add(new T.ShapeGeometry(f.shape).rotateY(-Math.PI / 2), paint, [f.xo, 0, 0]);
    const g = new T.ShapeGeometry(shape).rotateY(-Math.PI / 2);
    shell.add(g, paint, [x, 0, 0]);
    // Polygonal shoulder and gently crowned roof, with visible rain gutter.
    poly(
      shell,
      [
        [x, roof - 0.14, sideBack],
        [x, roof - 0.14, sideFront],
        [x - side * 0.12, roof, sideFront],
        [x - side * 0.12, roof, sideBack],
      ],
      paint,
    );
    fittings.rod([x, roof - 0.12, sideBack], [x, roof - 0.12, sideFront], 0.018, alloy);
    for (const z of inRange) {
      const p = [];
      for (let i = 0; i <= 16; i++) {
        const a = (i * Math.PI) / 16;
        p.push([x + side * 0.012, R + Math.sin(a) * arch, z + Math.cos(a) * arch]);
      }
      line(fittings, p, 0.025, dark);
    }
    // Coach graphics: swooshes that run in from the front, swell along the coach and sweep up
    // toward the rear cap, continuing across slide-out faces. On a Class A they also run along
    // the flat flank of the front cap and flare into the headlamp pod; on a Class C they start
    // at the cab bulkhead and stay under the window band.
    {
      const zr = sideBack + 0.04,
        zf = A ? front - 0.49 : coachFront - 0.04;
      // Cosine-eased curve through [t, y] knots, t = 0 at the rear end and 1 at the front.
      const curve = (knots) => (t) => {
        let i = 0;
        while (i < knots.length - 2 && t > knots[i + 1][0]) i++;
        const [ta, ya] = knots[i],
          [tb, yb] = knots[i + 1],
          u = Math.min(1, Math.max(0, (t - ta) / (tb - ta)));
        return ya + ((yb - ya) * (1 - Math.cos(Math.PI * u))) / 2;
      };
      const mainLow = curve(
          A
            ? [
                [0, 1.6],
                [0.07, 1.16],
                [0.3, 1.06],
                [0.88, 1.06],
                [1, 1.15],
              ]
            : [
                [0, 1.36],
                [0.25, 1.12],
                [0.6, 1.05],
                [1, 1.05],
              ],
        ),
        mainHigh = curve(
          A
            ? [
                [0, 1.92],
                [0.09, 1.74],
                [0.36, 1.48],
                [0.72, 1.2],
                [0.87, 1.13],
                [1, 1.42],
              ]
            : [
                [0, 1.78],
                [0.3, 1.58],
                [0.7, 1.24],
                [1, 1.1],
              ],
        ),
        accentHigh = curve(
          A
            ? [
                [0, 1.95],
                [0.11, 1.9],
                [0.42, 1.64],
                [0.8, 1.3],
                [1, 1.2],
              ]
            : [
                [0, 1.84],
                [0.35, 1.8],
                [0.75, 1.4],
                [1, 1.2],
              ],
        );
      const zs = Array.from({ length: 37 }, (_, i) => zr + ((zf - zr) * i) / 36);
      for (const p of slides[side]) zs.push(p.z0, p.z1);
      zs.sort((a, b) => a - b);
      const at = (z) => (z - zr) / (zf - zr);
      const sweep = (low, high, lift, mat) => {
        for (let i = 0; i < zs.length - 1; i++) {
          const za = zs[i],
            zb = zs[i + 1];
          if (zb - za < 1e-4 || za < zr - 1e-6 || zb > zf + 1e-6) continue;
          const [la, lb] = [low(at(za)), low(at(zb))],
            [ha, hb] = [Math.max(la, high(at(za))), Math.max(lb, high(at(zb)))];
          if (ha - la < 0.004 && hb - lb < 0.004) continue;
          const off = slideAt(side, (za + zb) / 2) ? slideDepth : 0;
          sidePoly(
            fittings,
            [
              [za, la],
              [zb, lb],
              [zb, hb],
              [za, ha],
            ],
            x + side * (off + lift),
            mat,
          );
        }
      };
      sweep(mainLow, mainHigh, 0.011, stripe);
      sweep((t) => mainHigh(t) + 0.05, accentHigh, 0.014, accent);
    }
    // Storage hatches sit between axles or behind them, never across tires.
    for (let z = sideBack + (A ? 0.55 : 0.65); z < sideFront - 0.7; z += 1.1) {
      if (tires.some((a) => Math.abs(a - z) < R + 0.6)) continue;
      const h = rect(z, 0.76, 0.92, 0.49, 0.025);
      outline(h, x + side * 0.025, 0.009);
      fittings.box([0.025, 0.045, 0.12], [x + side * 0.036, 0.93, z], dark);
      for (const dz of [-0.32, 0.32])
        fittings.box([0.025, 0.025, 0.11], [x + side * 0.035, 0.53, z + dz], alloy);
    }
    // Flush touring slide seal, no duplicate surface hiding its windows.
    if (side > 0 && C)
      outline(
        rect((sideBack + usableFront) / 2, floor + 1.0, span - 0.36, 1.9, 0.025),
        x + side * 0.025,
        0.012,
      );
    if (!s.view)
      fittings.text(
        s.model.replace('Class ', '').toUpperCase(),
        [
          x + side * (0.025 + (slideAt(side, back + 1.6) ? slideDepth : 0)),
          roof - 0.34,
          back + 1.6,
        ],
        0.12,
        (side * Math.PI) / 2,
        dark,
      );
  }
  const roofFront = A ? front - 0.92 : coachFront,
    roofBack = back + 0.26;
  if (!B)
    shell.box(
      [W - 0.24, 0.06, roofFront - roofBack],
      [0, roof - 0.025, (roofFront + roofBack) / 2],
      paint,
    );
  // The roof shoulder chamfer carries round the molded caps.
  const capHalfWidth = (y) => W / 2 - 0.12 * Math.min(1, Math.max(0, (y - roof + 0.14) / 0.14));
  if (!B) {
    // Molded rear cap: plan-rounded corners rolling forward into the roof over the bedroom and
    // bath, a dark bumper, tall round-lamp tail clusters and, on diesel pushers, the radiator
    // grille low in the cap (it opens with the engine hatch).
    const rings = [
      [0.43, 0, 0.16],
      [0.62, 0, 0.18],
      [roof - 0.4, 0, 0.2],
      [roof - 0.14, 0.05, 0.18],
      [roof, 0.18, 0.08],
    ].map(([y, setBack, r]) => {
      const hw = capHalfWidth(y),
        zb = back + setBack,
        pts = [[hw, y, sideBack]];
      for (let i = 0; i <= 4; i++) {
        const a = (i * Math.PI) / 8;
        pts.push([hw - r + r * Math.cos(a), y, zb + r - r * Math.sin(a)]);
      }
      for (let i = 0; i <= 4; i++) {
        const a = Math.PI / 2 + (i * Math.PI) / 8;
        pts.push([-hw + r + r * Math.cos(a), y, zb + r - r * Math.sin(a)]);
      }
      pts.push([-hw, y, sideBack]);
      return pts;
    });
    for (let k = 0; k < rings.length - 1; k++)
      for (let i = 0; i < rings[k].length - 1; i++)
        poly(shell, [rings[k][i], rings[k][i + 1], rings[k + 1][i + 1], rings[k + 1][i]], paint);
    poly(shell, rings[rings.length - 1], paint);
    // The side swoosh wraps round the rear corners and tapers across the cap (lo, hi: its band
    // where it leaves the side wall).
    const [lo, hi] = A ? [1.6, 1.92] : [1.36, 1.78];
    for (const side of [-1, 1]) {
      const r = 0.18 + (0.02 * (hi - 0.17 - 0.62)) / (roof - 1.02),
        hw = W / 2,
        out = 0.011,
        stations = [
          [[side * (hw + out), sideBack + 0.04], lo, hi],
          ...Array.from({ length: 5 }, (_, i) => {
            const a = (i * Math.PI) / 8;
            return [
              [side * (hw - r + (r + out) * Math.cos(a)), back + r - (r + out) * Math.sin(a)],
              lo,
              hi,
            ];
          }),
          [[side * (hw - r - 0.3), back - out], lo - 0.05, hi - 0.1],
          [[side * (hw - r - 0.62), back - out], lo - 0.1, lo + 0.02],
          [[side * (hw - r - 0.85), back - out], lo - 0.1, lo - 0.1],
        ];
      for (let i = 0; i < stations.length - 1; i++) {
        const [[xa, za], la, ha] = stations[i],
          [[xb, zb], lb, hb] = stations[i + 1];
        poly(
          fittings,
          [
            [xa, la, za],
            [xb, lb, zb],
            [xb, hb, zb],
            [xa, ha, za],
          ],
          stripe,
        );
      }
    }
    fittings.box([W - 0.3, 0.16, 0.14], [0, 0.51, back - 0.04], dark);
    for (const side of [-1, 1]) {
      const lx = side * (W / 2 - 0.3);
      fittings.box([0.24, 0.7, 0.04], [lx, 1.0, back - 0.015], dark);
      for (const [y, lens] of [
        [1.22, red],
        [1.0, red],
        [0.78, white],
      ])
        fittings.add(new T.CylinderGeometry(0.078, 0.078, 0.03, 14).rotateX(Math.PI / 2), lens, [
          lx,
          y,
          back - 0.045,
        ]);
    }
    if (C && !s.view) {
      // The Bendy Class C carries a bedroom window high in the rear wall, clear of the ladder.
      const p = rect(0.25, floor + 1.2, 0.95, 0.5, 0.08);
      poly(
        fittings,
        p.map(([x, y]) => [x, y, back - 0.004]),
        dark,
      );
      poly(
        windows,
        p.map(([x, y]) => [x, y, back - 0.008]),
        glass,
      );
      line(
        fittings,
        [...p, p[0]].map(([x, y]) => [x, y, back - 0.012]),
        0.02,
        dark,
      );
    }
    if (A && (s.tagAxle || L > 12)) {
      fittings.box([1.24, 0.5, 0.02], [0, 0.88, back - 0.01], dark);
      for (let i = 0; i < 7; i++)
        fittings.box([1.16, 0.022, 0.03], [0, 0.68 + i * 0.067, back - 0.025], alloy);
    }
  } else {
    // The van's twin rear doors keep the cab's tinted glass in their upper halves and carry the
    // wordmark; the road body supplies the door seam, tail lamps, bumper and plate.
    const rearAt = (x, y, lift) => [
      x,
      y,
      skinHit([x, y, back - 3], [0, 0, 1], { z: back }).z - lift,
    ];
    for (const side of [-1, 1]) {
      const cx = side * 0.45,
        xs = [cx - 0.31, cx, cx + 0.31],
        ys = [1.56, 1.86, 2.16];
      for (let i = 0; i < 2; i++)
        for (let j = 0; j < 2; j++)
          for (const [kit, mat, lift] of [
            [fittings, dark, 0.006],
            [windows, glass, 0.01],
          ])
            poly(
              kit,
              [
                rearAt(xs[i], ys[j], lift),
                rearAt(xs[i + 1], ys[j], lift),
                rearAt(xs[i + 1], ys[j + 1], lift),
                rearAt(xs[i], ys[j + 1], lift),
              ],
              mat,
            );
      const frame = rect(cx, 1.86, 0.66, 0.64).map(([xx, yy]) => rearAt(xx, yy, 0.014));
      line(fittings, [...frame, frame[0]], 0.02, dark);
      fittings.box([0.15, 0.045, 0.035], rearAt(side * 0.18, 1.25, 0.018), alloy);
    }
    fittings.text('BENDY', rearAt(0.45, 1.42, 0.012), 0.08, Math.PI, dark);
  }
  // Coach and cab names stay out of the View's geometry; the house wordmark is for Bendy designs.
  if (!B) {
    if (!s.view) fittings.text('BENDY', [0, roof - 0.4, back - 0.012], 0.14, Math.PI, dark);
    const plateY = 0.51,
      plateZ = back - 0.12;
    fittings.box([0.34, 0.16, 0.025], [0, plateY, plateZ], white);
    fittings.text(s.view ? 'MLN 22' : 'BENDY', [0, plateY, plateZ - 0.017], 0.04, Math.PI, dark);
  }
  if (C) {
    // Overcab sleeper over the cab roof: a molded cap whose rounded bull nose ends above the
    // windshield base (View) or a little ahead of it over the hood (E-series cutaway), as on the
    // photographed coaches. Plan-rounded rings rise from a raked underside behind the header to
    // the nose and roll back into the roof; a dark band wraps the nose and runs down the flanks.
    const tip = front - (s.view ? cab.cowl : 0.85),
      tipY = cabH + 0.3,
      header = front - cab.header;
    // [height, nose z, plan corner radius]
    const levels = [
      [cabH, header + 0.05, 0.22],
      [tipY - 0.13, tip - 0.24, 0.42],
      [tipY - 0.02, tip - 0.05, 0.5],
      [tipY + 0.1, tip, 0.54],
      [tipY + 0.24, tip - 0.07, 0.54],
      [roof - 0.14, tip - 0.36, 0.5],
      [roof - 0.04, tip - 0.6, 0.4],
      [roof, tip - 0.78, 0.26],
    ];
    const noseAt = (y) => {
      let i = 0;
      while (i < levels.length - 2 && y > levels[i + 1][0]) i++;
      const [ya, za] = levels[i],
        [yb, zb] = levels[i + 1];
      return za + ((zb - za) * (y - ya)) / (yb - ya);
    };
    const flank = (y) => W / 2 - 0.07 - 0.05 * Math.min(1, Math.max(0, (y - roof + 0.14) / 0.14));
    const rings = levels.map(([y, zn, r]) => {
      const hw = flank(y),
        pts = [[hw, y, coachFront]];
      for (let i = 0; i <= 6; i++) {
        const a = (i * Math.PI) / 12;
        pts.push([hw - r + r * Math.cos(a), y, zn - r + r * Math.sin(a)]);
      }
      for (let i = 0; i <= 6; i++) {
        const a = Math.PI / 2 + (i * Math.PI) / 12;
        pts.push([-hw + r + r * Math.cos(a), y, zn - r + r * Math.sin(a)]);
      }
      pts.push([-hw, y, coachFront]);
      return pts;
    });
    for (let k = 0; k < rings.length - 1; k++)
      for (let i = 0; i < rings[k].length - 1; i++)
        poly(
          shell,
          [rings[k][i], rings[k][i + 1], rings[k + 1][i + 1], rings[k + 1][i]],
          // The View's cap is a plain bull nose over a dark underside; the E-series coach's
          // carries a dark band round the nose.
          s.view ? (k < 2 ? dark : paint) : k === 2 ? stripe : paint,
        );
    poly(shell, rings[0], s.view ? dark : paint);
    poly(shell, rings[rings.length - 1], paint);
    for (const side of [-1, 1]) {
      if (s.view) {
        // The View's sleeper has a broad tinted side window behind its nose.
        const p = rect(tip - 1.02, tipY + 0.09, 0.66, 0.3, 0.09);
        sidePoly(fittings, p, side * (flank(tipY) + 0.006), dark);
        sidePoly(windows, p, side * (flank(tipY) + 0.012), glass);
        outline(p, side * (flank(tipY) + 0.016), 0.014);
        continue;
      }
      // A tapering graphic sweeps back from the nose band along the flank.
      const x = side * (flank(tipY) + 0.008),
        z1 = tip - 0.56;
      sidePoly(
        fittings,
        [
          [z1, tipY - 0.02],
          [z1, tipY + 0.1],
          [coachFront + 0.6, tipY + 0.2],
          [coachFront + 0.1, tipY + 0.24],
          [coachFront + 0.1, tipY + 0.12],
          [coachFront + 0.6, tipY + 0.06],
        ],
        x,
        stripe,
      );
    }
    if (s.view) {
      // Neutral cab badge: a plain ring and disc, not the cab maker's emblem or the coach name.
      fittings.ring(0.095, 0.012, [0, 0.83, front + 0.07], alloy);
      fittings.add(new T.CircleGeometry(0.05, 20), alloy, [0, 0.83, front + 0.072]);
    } else {
      const label = fittings.text(
        'BENDY',
        [0, tipY + 0.17, noseAt(tipY + 0.17) + 0.012],
        0.15,
        0,
        dark,
      );
      label.rotation.x = -Math.atan2(0.07, 0.14);
    }
    // Amber clearance lamps along the top of the nose.
    const lampY = roof - 0.09;
    for (let i = -2; i <= 2; i++)
      fittings.box([0.07, 0.035, 0.03], [i * 0.24, lampY, noseAt(lampY) + 0.008], amber);
    const bunk = Math.min(1.52, tip - 0.3 - coachFront);
    interior.box([W - 0.3, 0.12, bunk], [0, cabH + 0.08, coachFront + 0.05 + bunk / 2], fabric);
    // Exposed transition from narrow cab to the wider coach below its sleeper, closed over the
    // cab's roof shoulders too.
    for (const side of [-1, 1]) {
      shell.box([(W - cabW) / 2, 1.92, 0.1], [(side * (W + cabW)) / 4, 1.39, coachFront], paint);
      shell.box(
        [cabW / 2 - 0.72, cabH - 1.9, 0.04],
        [(side * (cabW / 2 + 0.72)) / 2, (cabH + 1.9) / 2, coachFront - 0.02],
        paint,
      );
    }
  }
  if (A) {
    // Molded fiberglass front cap: plan-rounded corners, a raked one-piece wraparound windshield
    // between a bulging lower fascia and a dark brow that overhangs the glass and rolls back into
    // the roof, as on modern Class A coaches.
    const glassBase = floor + 0.6,
      glassTop = roof - 0.48;
    // [height, set-back from the bumper line, plan corner radius]
    const levels = [
      [0.43, 0.07, 0.34],
      [0.62, 0.01, 0.4],
      [0.95, 0, 0.44],
      [1.32, 0.04, 0.46],
      [glassBase, 0.13, 0.48],
      [glassTop, 0.64, 0.48],
      [glassTop + 0.08, 0.58, 0.48],
      [roof - 0.2, 0.68, 0.42],
      [roof - 0.08, 0.8, 0.26],
      [roof, 0.92, 0.12],
    ];
    // Set-back and corner radius at height y, interpolated between the levels.
    const level = (y) => {
      let i = 0;
      while (i < levels.length - 2 && y > levels[i + 1][0]) i++;
      const [ya, ba, ra] = levels[i],
        [yb, bb, rb] = levels[i + 1],
        t = (y - ya) / (yb - ya);
      return [ba + (bb - ba) * t, ra + (rb - ra) * t];
    };
    const capZ = (y) => front - level(y)[0];
    const halfWidth = capHalfWidth;
    // A point on the cap at height y, `a` round the plan corner (0 faces the side, pi/2 the
    // front; beyond pi/2 it runs inboard across the front face), `out` m proud of the skin.
    const capAt = (y, a, side, out) => {
      const [setBack, r] = level(y),
        hw = halfWidth(y),
        zf = front - setBack;
      if (a > Math.PI / 2) return [side * (hw - r - (a - Math.PI / 2) * r), y, zf + out];
      return [side * (hw - r + (r + out) * Math.cos(a)), y, zf - r + (r + out) * Math.sin(a)];
    };
    const ring = ([y, setBack, r]) => {
      const hw = halfWidth(y),
        zf = front - setBack,
        pts = [[hw, y, sideFront]];
      for (let i = 0; i <= 6; i++) {
        const a = (i * Math.PI) / 12;
        pts.push([hw - r + r * Math.cos(a), y, zf - r + r * Math.sin(a)]);
      }
      for (let i = 0; i <= 6; i++) {
        const a = Math.PI / 2 + (i * Math.PI) / 12;
        pts.push([-hw + r + r * Math.cos(a), y, zf - r + r * Math.sin(a)]);
      }
      pts.push([-hw, y, sideFront]);
      return pts;
    };
    const rings = levels.map(ring);
    const inside = new T.Vector3(0, 1.9, sideFront - 0.6);
    const quad = (kit, p, mat) => {
      // Wind each facet outward so the single-sided windshield faces the street.
      const [a, b, c] = p.map((v) => new T.Vector3(...v));
      const n = b.clone().sub(a).cross(c.clone().sub(a));
      return poly(kit, n.dot(a.clone().sub(inside)) < 0 ? [...p].reverse() : p, mat);
    };
    // Rows: dark bumper, painted fascia, the glazed screen between black pillar bands, the dark
    // underside of the brow, the brow mask in the graphics colour, then the painted roll.
    const rowMaterial = [dark, paint, paint, paint, dark, dark, stripe, stripe, paint];
    for (let k = 0; k < rings.length - 1; k++)
      for (let i = 0; i < rings[k].length - 1; i++) {
        const glazed = k === 4 && i > 0 && i < rings[k].length - 2;
        quad(
          glazed ? windows : shell,
          [rings[k][i], rings[k][i + 1], rings[k + 1][i + 1], rings[k + 1][i]],
          glazed ? windshield : rowMaterial[k],
        );
      }
    // Gasket around the glass and raked A pillars where the screen meets the cap sides.
    line(fittings, rings[4].slice(1, -1), 0.022, dark);
    line(fittings, rings[5].slice(1, -1), 0.022, dark);
    for (const i of [1, rings[4].length - 2])
      line(fittings, [rings[4][i], rings[5][i]], 0.035, dark);
    const z0 = capZ(glassBase);
    // Swept headlamp pods wrap each plan corner of the fascia, rising toward the sides, with a
    // chrome bezel, an LED signature along the brow, three projector lenses and an amber side
    // marker; a wide chrome-barred grille fills the face between them.
    const podFrom = 0.2,
      podTo = Math.PI / 2 + 0.16 / level(1.1)[1],
      podLow = (u) => 0.82 + 0.22 * (1 - u) * (1 - u),
      podHigh = (u) => 1.4 + 0.16 * (1 - u);
    for (const side of [-1, 1]) {
      const n = 8,
        edge = (v, out) =>
          Array.from({ length: n + 1 }, (_, i) => {
            const u = i / n;
            return capAt(
              podLow(u) + (podHigh(u) - podLow(u)) * v,
              podFrom + (podTo - podFrom) * u,
              side,
              out,
            );
          });
      // The pod is split into rows so it follows the cap over the fascia's crease.
      const bands = [0, 0.25, 0.5, 0.75, 1].map((v) => edge(v, 0.014)),
        markLow = edge(0.08, 0.018),
        markHigh = edge(0.3, 0.018),
        ledLow = edge(0.8, 0.018),
        ledHigh = edge(0.9, 0.018);
      for (let i = 0; i < n; i++) {
        for (let k = 0; k < bands.length - 1; k++)
          poly(
            fittings,
            [bands[k][i], bands[k][i + 1], bands[k + 1][i + 1], bands[k + 1][i]],
            dark,
          );
        if (i < 2)
          poly(fittings, [markLow[i], markLow[i + 1], markHigh[i + 1], markHigh[i]], amber);
        else poly(fittings, [ledLow[i], ledLow[i + 1], ledHigh[i + 1], ledHigh[i]], white);
      }
      line(fittings, edge(1, 0.02), 0.013, alloy);
      for (const u of [0.42, 0.64, 0.86]) {
        const a = podFrom + (podTo - podFrom) * u,
          y = podLow(u) + (podHigh(u) - podLow(u)) * 0.42,
          facing = Math.min(a, Math.PI / 2);
        fittings.add(
          new T.CylinderGeometry(0.07, 0.07, 0.03, 16)
            .rotateX(Math.PI / 2)
            .rotateY(side * (Math.PI / 2 - facing)),
          white,
          capAt(y, a, side, 0.03),
        );
      }
      // Fog lamps in the bumper.
      fittings.add(new T.CylinderGeometry(0.05, 0.05, 0.03, 12).rotateX(Math.PI / 2), white, [
        side * (W / 2 - 0.55),
        0.53,
        capZ(0.53) + 0.015,
      ]);
    }
    const gw = W / 2 - 0.7,
      grilleRows = [0.7, 0.95, 1.28];
    for (let k = 0; k < 2; k++) {
      const [ya, yb] = [grilleRows[k], grilleRows[k + 1]];
      poly(
        fittings,
        [
          [-gw, ya, capZ(ya) + 0.012],
          [gw, ya, capZ(ya) + 0.012],
          [gw, yb, capZ(yb) + 0.012],
          [-gw, yb, capZ(yb) + 0.012],
        ],
        dark,
      );
    }
    line(
      fittings,
      [
        [-gw, 0.7, capZ(0.7) + 0.02],
        [gw, 0.7, capZ(0.7) + 0.02],
        [gw, 0.95, capZ(0.95) + 0.02],
        [gw, 1.28, capZ(1.28) + 0.02],
        [-gw, 1.28, capZ(1.28) + 0.02],
        [-gw, 0.95, capZ(0.95) + 0.02],
        [-gw, 0.7, capZ(0.7) + 0.02],
      ],
      0.024,
      alloy,
    );
    for (const y of [0.79, 0.89, 0.99, 1.09, 1.19])
      fittings.rod([-gw + 0.03, y, capZ(y) + 0.03], [gw - 0.03, y, capZ(y) + 0.03], 0.02, alloy);
    for (const side of [-1, 1]) {
      const mount = new T.Group();
      mount.name = `wiper-mount-${side}`;
      mount.position.set(side * 0.26, glassBase + 0.03, z0 + 0.01);
      mount.rotation.x = -Math.atan2(capZ(glassBase) - capZ(glassTop), glassTop - glassBase);
      root.add(mount);
      const moving = new T.Group();
      moving.name = `wiper-${side}`;
      mount.add(moving);
      const wk = detailKit(moving, `coach-wiper-${side}`);
      wk.rod([0, 0, 0], [0.5, 0.05, 0], 0.014, dark);
      wk.rod([0.25, 0.05, 0], [0.78, 0.05, 0], 0.017, dark);
      wk.finish();
      /* Replaced by the parked movable arms above.
      fittings.rod(
        [side * 0.26, glassBase + 0.03, z0 - 0.02],
        [side * 0.66, glassBase + 0.1, capZ(glassBase + 0.1) - 0.01],
        0.014,
        dark,
      );
      fittings.rod(
        [side * 0.42, glassBase + 0.09, capZ(glassBase + 0.09) - 0.005],
        [side * 0.98, glassBase + 0.19, capZ(glassBase + 0.19) - 0.03],
        0.017,
        dark,
      );
      */
      // Bus-style mirrors: arms from the cap beside the top of the screen curve forward and
      // hang tall heads ahead of the A pillars, with separate upper and convex lower lenses.
      const mx = side * (W / 2 + 0.15),
        mz = front - 0.34,
        my = glassTop - 0.62;
      line(
        fittings,
        [
          [side * (W / 2 - 0.04), glassTop - 0.12, front - 0.98],
          [side * (W / 2 + 0.08), glassTop - 0.04, front - 0.62],
          [mx, glassTop - 0.14, mz + 0.02],
          [mx, my + 0.26, mz],
        ],
        0.024,
        dark,
      );
      fittings.box([0.13, 0.52, 0.11], [mx, my, mz], dark);
      fittings.box([0.11, 0.34, 0.012], [mx, my + 0.07, mz - 0.06], alloy);
      fittings.box([0.11, 0.12, 0.012], [mx, my - 0.18, mz - 0.06], alloy);
    }
    fittings.text('BENDY', [0, 1.42, capZ(1.42) + 0.012], 0.1, 0, alloy);
    // bumperFinish 'chrome': a bright strip along the top of the bumper, round both corners.
    if (s.form?.bumperFinish === 'chrome') {
      const y = 0.6,
        reach = Math.PI / 2 + (halfWidth(y) - level(y)[1]) / level(y)[1],
        arc = (side) =>
          Array.from({ length: 13 }, (_, i) =>
            capAt(y, 0.25 + ((reach - 0.25) * i) / 12, side, 0.014),
          );
      line(fittings, [...arc(-1), ...arc(1).toReversed().slice(1)], 0.022, alloy);
    }
    // Clearance lamps on the brow above the windshield.
    const browY = glassTop + 0.2;
    for (let i = -2; i <= 2; i++)
      fittings.box([0.07, 0.035, 0.03], [i * 0.24, browY, capZ(browY) + 0.012], amber);
  }
  if (cab)
    for (const side of [-1, 1]) {
      // Tall van and cutaway mirror heads on two arms from the door's mirror sail, reaching past
      // the coach; the cab builder's small housing below them reads as the convex spotter.
      const mx = side * (W / 2 + (B ? 0.14 : 0.12)),
        mz = front - cab.cowl - 0.25,
        y = cab.belt + 0.28;
      fittings.rod(
        [side * cabW * 0.47, cab.belt + 0.1, mz + 0.06],
        [mx, y - 0.14, mz],
        0.017,
        dark,
      );
      fittings.rod(
        [side * cabW * 0.46, cab.belt + 0.4, mz + 0.02],
        [mx, y + 0.13, mz],
        0.017,
        dark,
      );
      fittings.box([0.07, 0.36, 0.22], [mx, y, mz], dark);
      fittings.box([0.012, 0.22, 0.18], [mx, y + 0.05, mz - 0.114], alloy);
      fittings.box([0.012, 0.09, 0.18], [mx, y - 0.11, mz - 0.114], alloy);
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
  // Side fittings stand on the coach wall, or on the van's tumblehome skin for a Class B.
  const wallX = (side, y, z) => (B ? skinX(side, y, z) : (side * W) / 2);
  // Retracted awning and its end caps on the curb side, under the van's roof shoulder on a B.
  const awningLength = s.view ? 4.8768 : Math.min(L - 2.2, 6.4),
    awningZ = (back + livingFront) / 2 + 0.3,
    awningY = roof - (B ? 0.32 : 0.12),
    awningX = wallX(-1, awningY, awningZ) + (B ? -0.085 : -0.055);
  fittings.box([0.16, 0.14, awningLength], [awningX, awningY, awningZ], dark);
  fittings.box(
    [0.012, 0.015, awningLength - 0.15],
    [awningX - 0.085, awningY - 0.05, awningZ],
    white,
  );
  for (const z of [awningZ - awningLength / 2, awningZ + awningLength / 2])
    fittings.box([0.18, 0.17, 0.07], [awningX + 0.005, awningY, z], alloy);
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
    // A Class A's entry steps retract under the floor over the front wheel.
    if (C)
      for (let i = 0; i < 2; i++)
        fittings.box([0.25, 0.055, 0.67], [-W / 2 - 0.045, floor - 0.2 - i * 0.22, doorZ], dark);
    fittings.box([0.035, 0.06, 0.2], [-W / 2 - 0.04, floor + 1.95, doorZ], white);
  }
  // Service fittings, vent grille, seam fasteners, rear ladder and tow receiver.
  for (const [i, label] of ['WATER', 'POWER', 'LP'].entries()) {
    const z = back + (B ? 0.75 : 0.6) + i * 0.5,
      wx = wallX(1, 1.15, z);
    fittings.box([0.025, 0.23, 0.32], [wx + 0.02, 1.15, z], counter);
    fittings.add(new T.CylinderGeometry(0.046, 0.046, 0.02, 12).rotateZ(Math.PI / 2), dark, [
      wx + 0.045,
      1.15,
      z,
    ]);
    fittings.text(label, [wx + 0.04, 1.31, z], 0.04, Math.PI / 2, dark);
  }
  // The refrigerator vent sits behind the rear window, or above a van's window band.
  const ventZ = B ? -1.2 : back + 0.65;
  for (let i = 0; i < 7; i++) {
    const y = (B ? 2.06 : 1.55) + i * 0.045;
    fittings.box([0.03, 0.025, 0.55], [wallX(1, y, ventZ) + 0.027, y, ventZ], dark);
  }
  for (const side of [-1, 1]) {
    for (const z of [back + 0.25, Math.min(livingFront - 0.1, front - 0.3)])
      fittings.box(
        [0.03, 0.07, 0.14],
        [wallX(side, 0.55, z) + side * 0.02, 0.55, z],
        z < 0 ? red : amber,
      );
    for (const z of tires)
      fittings.box([0.26, 0.19, 0.025], [side * cabW * 0.43, 0.23, z - R - 0.08], dark);
    if (!B)
      for (let z = back + 0.25; z < livingFront; z += 0.38)
        fittings.add(new T.CylinderGeometry(0.006, 0.006, 0.006, 6).rotateZ(Math.PI / 2), alloy, [
          side * (W / 2 + 0.01),
          roof - 0.19,
          z,
        ]);
  }
  if (!B) {
    // The ladder stands inboard of the curb-side lamps, clear of the engine hatch, and bends
    // over the rolled cap onto the roof.
    const lz = back - 0.19,
      [l0, l1] = [-W / 2 + 0.5, -W / 2 + 0.9];
    for (const x of [l0, l1])
      line(
        fittings,
        [
          [x, 0.65, lz],
          [x, roof - 0.32, lz],
          [x, roof + 0.05, back + 0.12],
        ],
        0.024,
        alloy,
      );
    for (let y = 0.85; y < roof - 0.32; y += 0.27)
      fittings.rod([l0, y, lz], [l1, y, lz], 0.018, alloy);
    for (let i = -2; i <= 2; i++)
      fittings.box([0.07, 0.035, 0.025], [i * 0.24, roof - 0.2, back + 0.008], red);
  }
  fittings.box([0.09, 0.09, 0.26], [0, 0.33, back - 0.08], dark);
  // Compact, visible living space. Closed bath and stowed bed respect the touring envelope; a
  // van's furniture stands clear of its tumblehome sides.
  const galleyZ = Math.min(livingFront - 0.95, 0.15),
    insideX = W / 2 - (B ? 0.47 : 0.35);
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
  interior.box([W - (B ? 0.42 : 0.22), 1.85, 0.065], [0, floor + 0.96, rearRoom], wood);
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
  return articulateMotorhome(root, s, { cab, cabRear, coachFront, doorZ });
}

/**
 * Trim named groups of a shared road body at a cab bulkhead (keep z >= z). Crossing triangles are
 * clipped rather than deleted, so the join has no holes or buried glazing.
 */
export function clipBehind(root, z, names) {
  for (const name of names) {
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
            inside = a[2] >= z,
            next = b[2] >= z;
          if (inside) clipped.push(a);
          if (inside !== next) {
            const t = (z - a[2]) / (b[2] - a[2]);
            clipped.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, z]);
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
