/**
 * Cutaway box truck: the shared road-vehicle cab and running gear on a ladder chassis, with dual
 * rear wheels and a dry-freight box. Metres, +Z forward, +X driver side; no bitmap materials.
 */
import '../../worldgen/scripts/install-deterministic-math.mjs';
import * as T from 'three';
import { boxPlanes, extractPanel, pivot as mechanismPivot } from './articulation-geometry.mjs';
import { roadVehicleModel } from './road-vehicle-geometry.mjs';
import { clipBehind } from './rv-geometry.mjs';
import { detailKit } from './vehicle-detail.mjs';

export function boxTruckModel(s) {
  const { length: L, width: W, height: H, wheelRadius: R, driverEye: eye } = s;
  const front = L / 2,
    back = -L / 2,
    cabRear = front - s.cabLength,
    cabW = s.cabWidth,
    cabH = s.cabHeight;
  const axleFront = front - s.frontOverhang,
    axleRear = axleFront - s.wheelbase;
  const root = roadVehicleModel({
    id: s.id,
    length: L,
    width: cabW,
    height: cabH,
    wheelbase: s.wheelbase,
    wheelRadius: R,
    color: s.color,
    make: 'Bendy',
    model: s.model,
    year: s.year,
    plate: 'BENDY',
    bodyStyle: 'van',
    // A recipe's lamps, grille and form keys dress the cab face like a road-vehicle recipe.
    lamps: s.lamps ?? 'rect',
    grille: s.grille ?? 'bars',
    tail: 'vertical',
    driverEye: eye,
    // Ford E-series-type cutaway cab: tall square nose and a hood reaching back past the front
    // axle to the windshield base, under an upright screen (heights in m over cabH).
    form: {
      twoDoor: true,
      belt: 1.45 / cabH,
      nose: 1.15 / cabH,
      noseSlope: 0.05,
      roofFront: (front - 1.72) / L,
      roofRear: (cabRear + 0.05) / L,
      rearBase: (cabRear + 0.05) / L,
      windshieldBase: (front - 1.35) / L,
      roofWidth: 0.43,
      frontTaper: 0.97,
      rearTaper: 0.94,
      hoodCurve: 1.05,
      grilleWidth: 0.6,
      grilleHeight: 0.38 / cabH,
      grilleY: 0.8 / cabH,
      rows: 1,
      bPillar: (cabRear + 0.2) / L,
      noseRound: 0.1,
      tailRound: 0.05,
      roofCrown: 0.045,
      roofDrop: 0.035,
      frontOverhang: s.frontOverhang,
      windshieldTop: cabH - 0.14,
      fitCabin: true,
      cladding: true,
      spokes: 8,
      lite: true,
      ...s.form,
    },
  });
  clipBehind(root, cabRear, ['body-shell', 'glazing', 'exterior-fittings', 'rear-fascia', 'cabin']);
  const material = (name, color, metalness = 0, roughness = 0.6) =>
    new T.MeshStandardMaterial({ name, color, metalness, roughness, flatShading: true });
  // Livery recolors one paint material by name, so the box livery shares the cab's instance.
  let paint;
  root.traverse((o) => {
    if (o.material?.name === 'vehicle-paint-and-trim') paint ??= o.material;
  });
  const panel = material('cargo-box-panels', s.boxColor, 0.12, 0.5);
  const dark = material('chassis-and-trim', '#262c30', 0.05, 0.8);
  const alloy = material('box-alloy', '#a8b0b2', 0.7, 0.32);
  const red = material('box-lens-red', '#a62a26', 0.1, 0.3);
  const amber = material('box-lens-amber', '#c98b32', 0.1, 0.35);
  const white = material('box-lens-white', '#e2e8e2', 0.08, 0.3);
  const box = detailKit(root, 'cargo-box');
  const chassis = detailKit(root, 'chassis');

  // The cab's open back, closed by a painted wall with a small rear window above the seats.
  box.box([cabW * 0.9, cabH - 0.42, 0.03], [0, 0.21 + (cabH - 0.42) / 2, cabRear + 0.015], paint);

  // Box shell: floor clears the dual tires; corner posts, rails and seams in bright alloy. The
  // rear sill and lamps stand 0.1 m behind the door panel, so the door sits that far inside the
  // overall length.
  const floor = 2 * R + 0.2,
    z0 = cabRear - 0.1,
    z1 = back + 0.1,
    len = z0 - z1,
    mid = (z0 + z1) / 2,
    bh = H - floor;
  box.box([W, bh, len], [0, floor + bh / 2, mid], panel);
  for (const x of [-W / 2, W / 2])
    for (const z of [z0, z1]) box.box([0.075, bh + 0.02, 0.075], [x, floor + bh / 2, z], alloy);
  for (const side of [-1, 1]) {
    const x = (side * W) / 2;
    box.box([0.05, 0.16, len + 0.04], [x, floor + 0.08, mid], alloy);
    box.box([0.04, 0.07, len + 0.04], [x, H - 0.035, mid], alloy);
    for (let i = 1; i < 4; i++)
      box.box(
        [0.012, bh - 0.2, 0.035],
        [x + side * 0.004, floor + bh / 2, z0 - (i * len) / 4],
        alloy,
      );
    // House livery: a paint band and the Bendy wordmark read across a street.
    box.box([0.006, 0.22, len - 0.3], [x + side * 0.004, floor + 0.36, mid], paint);
    box.text('BENDY', [x + side * 0.008, floor + bh * 0.56, mid], 0.5, (side * Math.PI) / 2, paint);
    // Side markers: amber forward, red aft; small lamps on the bottom rail.
    box.box([0.02, 0.05, 0.09], [x + side * 0.02, floor + 0.08, z0 - 0.25], amber);
    box.box([0.02, 0.05, 0.09], [x + side * 0.02, floor + 0.08, z1 + 0.25], red);
    // Tall mirrors on two arms from the door's mirror sail, behind the A pillar, reach past the
    // box; the cab builder's small housing below them reads as the convex spotter.
    const mx = side * (W / 2 + 0.16),
      mz = front - 1.62;
    box.rod([side * cabW * 0.47, 1.56, mz + 0.06], [mx, 1.6, mz], 0.018, dark);
    box.rod([side * cabW * 0.47, 1.86, mz + 0.02], [mx, 1.88, mz], 0.018, dark);
    box.box([0.07, 0.4, 0.22], [mx, 1.74, mz], dark);
    box.box([0.012, 0.34, 0.18], [mx, 1.74, mz - 0.114], alloy);
  }
  for (const x of [-W / 2 + 0.12, W / 2 - 0.12]) {
    box.box([0.09, 0.05, 0.02], [x, H - 0.08, z0 + 0.012], amber);
    box.box([0.09, 0.05, 0.02], [x, H - 0.08, z1 - 0.012], red);
  }
  for (const x of [-0.12, 0, 0.12]) box.box([0.07, 0.04, 0.02], [x, H - 0.08, z1 - 0.012], red);

  // Rear: roll-up door in a framed opening, slat joints, handle, sill, lamps and plate.
  box.box([W, 0.18, 0.08], [0, H - 0.2, z1 - 0.02], alloy);
  box.box([W, 0.16, 0.12], [0, floor + 0.02, z1 - 0.04], alloy);
  for (const x of [-W / 2 + 0.06, W / 2 - 0.06])
    box.box([0.12, bh, 0.09], [x, floor + bh / 2, z1 - 0.025], alloy);
  for (let y = floor + 0.32; y < H - 0.32; y += 0.3)
    box.box([W - 0.26, 0.014, 0.012], [0, y, z1 - 0.008], dark);
  box.box([0.32, 0.05, 0.05], [0, floor + 0.22, z1 - 0.03], alloy);
  box.box([0.06, 0.12, 0.05], [0.4, floor + 0.2, z1 - 0.03], dark);
  // Under the door sill a deep alloy lamp panel carries reflective tape along its top, round
  // tail and reversing lamps in bright rings and the plate.
  const lampY = floor - 0.15;
  box.box([W - 0.04, 0.3, 0.06], [0, floor - 0.14, z1 - 0.06], alloy);
  for (let i = 0; i < 10; i++)
    box.box(
      [(W - 0.3) / 10 - 0.012, 0.035, 0.008],
      [-(W - 0.3) / 2 + ((i + 0.5) * (W - 0.3)) / 10, floor - 0.082, z1 - 0.094],
      i % 2 ? white : red,
    );
  for (const side of [-1, 1])
    for (const [dx, r, lens] of [
      [0.2, 0.068, red],
      [0.37, 0.058, white],
    ]) {
      const at = [side * (W / 2 - dx), lampY, z1 - 0.093];
      box.add(new T.CylinderGeometry(r, r, 0.01, 16).rotateX(Math.PI / 2), lens, at);
      box.ring(r + 0.008, 0.007, at, alloy);
    }
  box.box([0.31, 0.15, 0.012], [0, lampY - 0.02, z1 - 0.09], dark);
  box.text('BENDY', [0, lampY - 0.02, z1 - 0.0975], 0.06, Math.PI, white);

  // Ladder frame, crossmembers, fuel tank, battery box and steps under the cab doors.
  for (const x of [-0.42, 0.42])
    chassis.box(
      [0.08, 0.22, front - back - 0.9],
      [x, 2 * R - 0.12, (front + back) / 2 - 0.25],
      dark,
    );
  for (const z of [cabRear - 0.4, axleRear + 0.7, axleRear - 0.7, z1 + 0.3])
    chassis.box([0.84, 0.1, 0.1], [0, 2 * R - 0.14, z], dark);
  const tank = chassis.add(
    new T.CylinderGeometry(0.24, 0.24, 0.9, 14).rotateX(Math.PI / 2),
    alloy,
    [0.72, 0.62, (cabRear + axleRear + R) / 2],
  );
  tank.name = 'fuel-tank';
  chassis.box([0.42, 0.36, 0.5], [-0.72, 0.62, (cabRear + axleRear + R) / 2], dark);
  for (const side of [-1, 1])
    chassis.box([0.28, 0.04, 0.45], [side * (cabW / 2 - 0.05), 0.42, cabRear + 0.55], alloy);
  // Full-width alloy step bumper (the underride guard) on the frame rails' extensions just under
  // the lamp panel, and mud flaps behind the duals.
  chassis.box([W * 0.96, 0.1, 0.16], [0, floor - 0.36, z1], alloy);
  for (const x of [-0.42, 0.42]) chassis.box([0.08, 0.12, 0.3], [x, floor - 0.36, z1 + 0.22], dark);
  for (const side of [-1, 1])
    chassis.box([0.6, 0.62, 0.015], [side * (W / 2 - 0.3), 0.45, axleRear - R - 0.1], dark);

  // Dual rear wheels: outer tires move out under the box; the inner tire shares the axle spin
  // (built by the cab builder when the recipe's form sets dually).
  for (const side of [-1, 1]) {
    const pivot = root.getObjectByName(`wheel-rear-${side > 0 ? 'left' : 'right'}`);
    pivot.position.x = side * (W / 2 - 0.16);
    if (s.form?.dually) continue;
    const spin = pivot.children[0];
    const inner = spin.children[0].clone();
    inner.name = 'dual-inner-tire';
    inner.position.x = -side * 0.27;
    spin.add(inner);
  }
  box.finish();
  chassis.finish();
  root.remove(root.getObjectByName('trunk'));
  const animation = root.userData.molenAnimation;
  animation.bindings = animation.bindings.filter((b) => b.source !== 'trunk');
  root.userData.molenActuators.trunk = { seconds: 4 };
  const bottom = floor + 0.1,
    top = H - 0.3,
    travel = top - bottom;
  for (let i = 0; i < 8; i++) {
    const low = bottom + (i * travel) / 8,
      high = bottom + ((i + 1) * travel) / 8,
      cy = (low + high) / 2;
    const slat = mechanismPivot(root, `trunk-slat-${i}`, [0, cy, z1]);
    extractPanel(
      root,
      slat,
      boxPlanes([-W / 2 + 0.14, low, z1 - 0.08], [W / 2 - 0.14, high, z1 + 0.02]),
      (n) => n.name.startsWith('cargo-box'),
    );
    const turn = (top - cy) / travel;
    animation.bindings.push(
      {
        node: slat.name,
        source: 'trunk',
        property: 'position',
        axis: 'y',
        keys: [
          [0, 0],
          [turn, top - cy],
          [1, top - cy],
        ],
      },
      {
        node: slat.name,
        source: 'trunk',
        property: 'position',
        axis: 'z',
        keys: [
          [0, 0],
          [turn, 0],
          [1, travel * (1 - turn)],
        ],
      },
      {
        node: slat.name,
        source: 'trunk',
        property: 'rotation',
        axis: 'x',
        keys: [
          [0, 0],
          [Math.max(0.001, turn - 0.03), 0],
          [Math.min(0.999, turn + 0.03), -Math.PI / 2],
          [1, -Math.PI / 2],
        ],
      },
    );
  }
  return root;
}
