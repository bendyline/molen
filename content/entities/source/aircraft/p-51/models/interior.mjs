/** P-51D station: black asymmetric panel, K-14 sight, bucket seat and sidewall controls. */
import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  bar,
  contour,
  lathe,
  loftUp,
  place,
  roundedBox,
  tube,
} from '../../../../../../packages/entities/scripts/aircraft/cockpit-parts.mjs';
import { finishCockpit } from '../../../../../../packages/entities/scripts/aircraft/cockpit-surfaces.mjs';
import { detailKit } from '../../../../../../packages/entities/scripts/aircraft/mesh-kit.mjs';
import { instrumentParts } from './instruments.mjs';

export function addInterior(parent, layout, api) {
  const { group, box, rod, sphere, mesh, silver, dark, green, rubber, yellow, red } = api;
  const { plate, gauge, screw, placard, toggle, text } = instrumentParts(api);
  const cabin = group(parent, layout.root);
  plate(cabin, 'instrument-panel', layout.panelOutline, layout.panelZ);
  for (const instrument of layout.gauges) gauge(cabin, instrument);
  for (const [i, [x, y]] of layout.panelOutline.entries())
    screw(
      cabin,
      `panel-fastener-${i}`,
      x * 0.94,
      y > 2 ? y - 0.018 : y + 0.013,
      layout.panelZ - 0.007,
    );
  box(cabin, 'lower-switch-panel', [0.76, 0.11, 0.035], [0, 1.49, 0.555], dark);
  for (const [i, label] of ['BAT', 'GEN', 'LIGHT', 'FUEL', 'PITOT', 'GUN'].entries())
    toggle(cabin, `panel-switch-${i}`, [0.32 - i * 0.105, 1.49, 0.531], label);
  placard(cabin, 'landing-check', 'GEAR DOWN', [0.185, 1.735, 0.524], 0.13, 0.0011);
  const brake = group(cabin, 'parking-brake', [0.03, 1.56, 0.493]);
  brake.userData.aircraftControl = {
    action: 'brake',
    motion: { property: 'position', axis: 'z', scale: -0.025 },
  };
  mesh(brake, 'brake-shaft', bar([0, 0, 0], [0, 0, -0.052], 0.0045, 12), silver);
  // A T-handle with rounded ends, pulled straight out of the lower panel.
  mesh(
    brake,
    'brake-handle',
    place(roundedBox([0.062, 0.016, 0.017], 0.006), [0, 0, -0.06]),
    yellow,
  );
  for (const [i, color] of [green, red, yellow].entries())
    sphere(
      cabin,
      `gear-indicator-${i}`,
      [0.008, 0.008, 0.004],
      [0.25 + i * 0.035, 1.955, 0.522],
      color,
    );
  // Narrow flat crown and long sloping legs follow the reference's A-shaped support. Panel,
  // coaming, gunsight, pedals and their fittings sit 0.25 m aft of the first fit, under the
  // windscreen the 3-view places at z 0.82; their z is given relative to the panel.
  const panelZ = layout.panelZ;
  const coaming = new T.CatmullRomCurve3(
    [
      [-0.435, 1.995, panelZ],
      [-0.385, 2.025, panelZ + 0.01],
      [-0.24, 2.2, panelZ + 0.05],
      [-0.14, 2.31, panelZ + 0.07],
      [-0.08, 2.32, panelZ + 0.07],
      [0.08, 2.32, panelZ + 0.07],
      [0.14, 2.31, panelZ + 0.07],
      [0.24, 2.2, panelZ + 0.05],
      [0.385, 2.025, panelZ + 0.01],
      [0.435, 1.995, panelZ],
    ].map((p) => new T.Vector3(...p)),
  );
  mesh(cabin, 'windscreen-support-frame', new T.TubeGeometry(coaming, 48, 0.018, 8, false), silver);
  // No checklist card on the coaming: the K-14 sight stands alone above the panel centre in
  // every P-51D cockpit photograph, and the card hid it from the seat.
  const sight = group(cabin, 'k14-gunsight', [0, 2.19, panelZ + 0.1]);
  box(sight, 'sight-mount', [0.09, 0.07, 0.11], [0, -0.085, 0.04], dark);
  const body = mesh(
    sight,
    'sight-optical-housing',
    new T.CylinderGeometry(0.079, 0.065, 0.11, 24),
    dark,
  );
  body.rotation.x = Math.PI / 2;
  box(sight, 'sight-range-dial', [0.155, 0.025, 0.032], [0, 0.036, -0.062], dark);
  text(sight, 'sight-range-scale', '100 200 400', 0, 0.038, -0.08, 0.0013);
  const reflector = box(
    sight,
    'canopy-gunsight-glass',
    [0.14, 0.083, 0.003],
    [0, 0.085, -0.035],
    api.glass,
  );
  reflector.rotation.x = -0.16;
  for (const side of [-1, 1])
    rod(
      sight,
      `sight-reflector-post-${side}`,
      [side * 0.072, 0.025, 0],
      [side * 0.072, 0.127, -0.042],
      0.004,
      dark,
    );

  // The wing crown reaches 1.38 m here; the cockpit floor sits above it.
  const floor = new T.BoxGeometry(1, 0.045, 1.79, 1, 1, 12);
  const floorVertices = floor.getAttribute('position');
  for (let i = 0; i < floorVertices.count; i++) {
    const width = api.cabinWidth(floorVertices.getY(i) + 1.36, floorVertices.getZ(i) + 0.145);
    floorVertices.setX(i, Math.sign(floorVertices.getX(i)) * (width - 0.006));
  }
  floor.computeVertexNormals();
  mesh(cabin, 'floor', floor, green, [0, 1.36, 0.145]);
  box(cabin, 'heel-trough', [0.37, 0.025, 0.7], [0, 1.3925, 0.42], rubber);
  addSidewalls(cabin, api);
  for (const side of [-1, 1]) {
    box(cabin, `side-console-${side}`, [0.09, 0.14, 0.9], [side * 0.397, 1.59, 0.09], green);
  }
  const throttle = group(cabin, 'throttle-quadrant', [0.37, 1.72, 0.21]);
  box(throttle, 'quadrant-case', [0.085, 0.115, 0.29], [0, 0, 0], dark);
  for (const [i, color] of [rubber, yellow, red].entries()) {
    const lever = group(throttle, `engine-control-${i}`, [-0.008, 0.03, 0.09 - i * 0.083]);
    lever.userData.aircraftControl = {
      action: ['power', 'propeller', 'mixture'][i],
      motion: { property: 'rotation', axis: 'x', scale: 0.65, offset: i === 0 ? 0 : -0.65 },
    };
    mesh(
      lever,
      `engine-lever-${i}`,
      bar([0, 0, 0], [-0.017, 0.1, 0.04], 0.0048, 12, 0.004),
      silver,
    );
    const top = [-0.017, 0.1, 0.04];
    if (i === 0) {
      // The throttle's grip points inboard: a fat twist grip (the K-14 sight ranging) with the
      // microphone button at its end.
      mesh(
        lever,
        `engine-lever-knob-${i}`,
        place(
          lathe(
            [
              [0.009, 0],
              [0.017, 0.006],
              [0.019, 0.02],
              [0.0195, 0.05],
              [0.017, 0.066],
              [0.011, 0.074],
              [0, 0.075],
            ],
            18,
          ),
          [top[0] + 0.004, top[1] + 0.006, top[2]],
          [0, 0, Math.PI / 2],
        ),
        color,
      );
      mesh(
        lever,
        `throttle-grip-ring-${i}`,
        place(
          new T.TorusGeometry(0.0196, 0.0018, 6, 20),
          [top[0] - 0.016, top[1] + 0.006, top[2]],
          [0, Math.PI / 2, 0],
        ),
        silver,
      );
      mesh(
        lever,
        `throttle-mic-button`,
        place(
          new T.CylinderGeometry(0.005, 0.005, 0.006, 12),
          [top[0] - 0.072, top[1] + 0.006, top[2]],
          [0, 0, Math.PI / 2],
        ),
        red,
      );
    } else if (i === 1)
      mesh(
        lever,
        `engine-lever-knob-${i}`,
        place(
          lathe(
            [
              [0, 0],
              [0.007, 0],
              [0.015, 0.006],
              [0.0165, 0.016],
              [0.013, 0.024],
              [0, 0.026],
            ],
            16,
          ),
          top,
        ),
        color,
      );
    else
      mesh(lever, `engine-lever-knob-${i}`, new T.SphereGeometry(0.017, 16, 12), color, [
        top[0],
        top[1] + 0.012,
        top[2],
      ]);
  }
  // On the quadrant case's inboard face, reading aft to forward along the levers; it used to hang
  // off the console's edge ahead of the case.
  const quadrantLabel = group(cabin, 'throttle-placard-mount', [0.3255, 1.7, 0.21]);
  quadrantLabel.rotation.y = Math.PI / 2;
  placard(quadrantLabel, 'throttle-placard', 'MIX   PROP   THROTTLE', [0, 0, 0], 0.22, 0.0012);
  // Close-view quadrant gates and mounting hardware; the levers keep their existing pivots.
  for (let i = 0; i < 3; i++) {
    box(throttle, `quadrant-slot-${i}`, [0.045, 0.005, 0.055], [0, 0.06, 0.09 - i * 0.083], silver);
    box(
      throttle,
      `quadrant-slot-recess-${i}`,
      [0.007, 0.007, 0.049],
      [0, 0.063, 0.09 - i * 0.083],
      rubber,
    );
  }
  for (const side of [-1, 1]) {
    const lamp = group(cabin, `panel-lamp-${side}`, [side * 0.385, 2.07, 0.475]);
    mesh(lamp, 'lamp-neck', bar([0, 0, 0], [-side * 0.03, 0.018, -0.017], 0.0045, 12), silver);
    // A round spot-lamp hood aimed down at the panel face.
    const hood = mesh(
      lamp,
      'lamp-shade',
      lathe(
        [
          [0, -0.014],
          [0.008, -0.014],
          [0.011, -0.006],
          [0.0125, 0.012],
          [0.0105, 0.013],
          [0.0095, 0.004],
          [0, 0.004],
        ],
        16,
      ),
      dark,
      [-side * 0.035, 0.02, -0.02],
    );
    hood.quaternion.setFromUnitVectors(
      new T.Vector3(0, 1, 0),
      new T.Vector3(-side * 0.35, -0.55, 0.75).normalize(),
    );
    for (const z of [-0.2, 0.11, 0.42]) {
      box(
        cabin,
        `rib-foot-bracket-${side}-${z}`,
        [0.035, 0.055, 0.035],
        [side * 0.419, 1.385, z],
        silver,
      );
      screw(cabin, `bracket-screw-${side}-${z}`, side * 0.419, 1.388, z - 0.02);
    }
  }
  box(cabin, 'radio-control-box', [0.09, 0.16, 0.29], [-0.373, 1.72, -0.04], dark);
  for (let i = 0; i < 4; i++)
    sphere(
      cabin,
      `radio-channel-${i}`,
      [0.012, 0.012, 0.012],
      [-0.322, 1.79 - i * 0.035, 0.065],
      rubber,
    );
  const selector = group(cabin, 'fuel-selector', [0, 1.49, 0.55]);
  const selectorPlate = mesh(
    selector,
    'selector-plate',
    new T.CylinderGeometry(0.075, 0.075, 0.01, 24),
    dark,
  );
  selectorPlate.rotation.x = Math.PI / 2;
  box(selector, 'selector-handle', [0.06, 0.013, 0.018], [0.02, 0, -0.02], red);
  text(selector, 'selector-label', 'L OFF R', 0, 0.05, -0.008, 0.0017);

  plate(
    cabin,
    'seat-bucket-back',
    [
      [-0.23, 1.49],
      [-0.23, 1.95],
      [-0.17, 2.1],
      [0.17, 2.1],
      [0.23, 1.95],
      [0.23, 1.49],
    ],
    -0.395,
    green,
    0.028,
  );
  box(cabin, 'seat-pan', [0.46, 0.05, 0.49], [0, 1.49, -0.15], green);
  mesh(
    cabin,
    'seat-cushion',
    new RoundedBoxGeometry(0.39, 0.1, 0.41, 2, 0.018),
    api.brown,
    [0, 1.56, -0.13],
  );
  mesh(
    cabin,
    'seat-back-pad',
    new RoundedBoxGeometry(0.36, 0.41, 0.06, 2, 0.012),
    api.brown,
    [0, 1.85, -0.353],
  );
  for (const x of [-0.14, 0.14])
    rod(cabin, `cushion-seam-${x}`, [x, 1.67, -0.319], [x, 2.02, -0.319], 0.0018, dark);
  for (const x of [-0.18, 0.18])
    box(cabin, `lap-belt-anchor-${x}`, [0.045, 0.033, 0.025], [x, 1.55, -0.31], silver);
  box(cabin, 'armor-plate', [0.39, 0.5, 0.04], [0, 2.12, -0.47], dark);
  mesh(
    cabin,
    'headrest',
    new T.CapsuleGeometry(0.07, 0.11, 4, 12).rotateZ(Math.PI / 2),
    rubber,
    [0, 2.335, -0.426],
  );
  for (const side of [-1, 1]) {
    const strap = box(
      cabin,
      `shoulder-harness-${side}`,
      [0.04, 0.54, 0.01],
      [side * 0.115, 1.86, -0.31],
      api.white,
    );
    strap.rotation.z = side * 0.13;
    box(cabin, `lap-belt-${side}`, [0.17, 0.025, 0.01], [side * 0.09, 1.61, -0.08], api.white);
  }
  box(cabin, 'harness-buckle', [0.04, 0.035, 0.015], [0, 1.62, -0.072], silver);
  // The stick: an olive tube out of a leather boot, under the black bakelite pistol grip with the
  // gun trigger in front and the bomb button on top (Cripes A'Mighty 3rd cockpit photographs).
  const stick = group(cabin, 'control-stick', [0, 1.39, 0.25]);
  mesh(
    stick,
    'stick-boot',
    lathe(
      [
        [0, 0],
        [0.058, 0],
        [0.056, 0.012],
        [0.044, 0.02],
        [0.043, 0.032],
        [0.032, 0.04],
        [0.03, 0.052],
        [0.021, 0.064],
        [0.017, 0.082],
        [0.015, 0.09],
        [0, 0.09],
      ],
      18,
      30,
    ),
    rubber,
  );
  mesh(stick, 'stick-shaft', bar([0, 0.08, 0], [0, 0.32, -0.03], 0.0135, 14, 0.0125), green);
  pistolGrip(stick, [0, 0.318, -0.03], Math.atan2(-0.03, 0.32) - 0.05, api);
  // Cast aluminium pedals: a rubber-treaded pad between side rails, a leather toe strap across
  // its top and a heel lip, on the arm down to the rudder bar. Their pads stand 3 cm higher than
  // the first boxes so the treads clear the footboards.
  for (const side of [-1, 1]) {
    const pedal = group(cabin, `rudder-control-${side}`, [side * 0.145, 1.45, panelZ - 0.075]);
    const kit = detailKit(pedal, `rudder-pedal-${side}`);
    mustangPedal(kit, side, api);
    kit.finish();
    // Right rudder pushes the right pedal (-X) forward.
    pedal.userData.aircraftControl = {
      action: 'yaw',
      motion: { property: 'position', axis: 'z', scale: -side * 0.035 },
    };
  }
  addLeftConsoleControls(cabin, api);
  addCanopyCrank(cabin, api);
  for (const name of ['instrument-panel', 'lower-switch-panel']) {
    const panel = cabin.getObjectByName(name);
    panel.material = panel.material.clone();
    panel.material.color.set('#343a3b');
  }
  finishCockpit(cabin, (mesh) => {
    if (['instrument-panel', 'lower-switch-panel'].includes(mesh.name)) return 'panel';
    if (/^(shoulder-harness-|lap-belt-)/.test(mesh.name) && mesh.material === api.white)
      return 'webbing';
    if (['seat-cushion', 'seat-back-pad'].includes(mesh.name)) return 'canvas';
    if (['headrest', 'stick-boot'].includes(mesh.name)) return 'vinyl';
    if (
      ['floor', 'seat-pan', 'seat-bucket-back'].includes(mesh.name) ||
      mesh.name.startsWith('side-console-')
    )
      return 'paint';
  });
}

/** Two-column card and canopy-release warning transcribed from the supplied cockpit photo. */
function addSidewalls(cabin, api) {
  const { group, box, rod, mesh, cabinWidth, green, dark, rubber, silver, red } = api;
  const { plate, placard } = instrumentParts(api);
  const walls = group(cabin, 'cockpit-sidewalls');
  const enamel = green.clone();
  enamel.name = 'sidewall-interior-green';
  enamel.color.set('#7b8754');
  const point = (side, y, z, inset = 0.01) => [side * (cabinWidth(y, z) - inset), y, z];
  const stations = [-0.72, -0.42, -0.12, 0.18, 0.48, 0.78, 1.055];
  for (const side of [-1, 1]) {
    // Shallow curved panels leave the continuous inward-facing skin behind each seam.
    for (let bay = 0; bay < stations.length - 1; bay++) {
      const positions = [],
        indices = [];
      for (let row = 0; row <= 8; row++) {
        const y = 1.31 + (row / 8) * 0.737;
        for (const z of [stations[bay] + 0.003, stations[bay + 1] - 0.003])
          positions.push(...point(side, y, z));
      }
      for (let row = 0; row < 8; row++) {
        const a = row * 2;
        const faces = [a, a + 2, a + 3, a, a + 3, a + 1];
        for (let i = 0; i < faces.length; i += 3)
          indices.push(faces[i], faces[i + (side === 1 ? 2 : 1)], faces[i + (side === 1 ? 1 : 2)]);
      }
      const geometry = new T.BufferGeometry();
      geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      mesh(walls, `sidewall-panel-${side}-${bay}`, geometry, enamel);
    }
    // Formed vertical ribs and twin longitudinal canopy channels match the metal tub.
    for (const z of stations.slice(1, -1)) {
      const curve = new T.CatmullRomCurve3(
        [1.34, 1.57, 1.8, 2.035].map((y) => new T.Vector3(...point(side, y, z, 0.022))),
      );
      mesh(
        walls,
        `sidewall-rib-${side}-${z}`,
        new T.TubeGeometry(curve, 8, 0.009, 6, false),
        enamel,
      );
    }
    for (const y of [1.965, 2.045]) {
      const curve = new T.CatmullRomCurve3(
        stations.map((z) => new T.Vector3(...point(side, y, z, 0.024))),
      );
      mesh(
        walls,
        `canopy-inner-channel-${side}-${y}`,
        new T.TubeGeometry(curve, 20, 0.011, 6, false),
        enamel,
      );
      for (let i = 0; i < 14; i++) {
        const z = -0.67 + i * 0.125;
        const rivet = mesh(
          walls,
          `rail-rivet-${side}-${y}-${i}`,
          new T.CylinderGeometry(0.003, 0.003, 0.003, 6),
          silver,
          point(side, y, z, 0.035),
        );
        rivet.rotation.z = Math.PI / 2;
      }
    }
    const label = group(walls, `sidewall-instructions-${side}`, point(side, 1.9, 0.44, 0.018));
    label.rotation.y = (side * Math.PI) / 2;
    placard(
      label,
      'instructions',
      side === 1 ? 'FLAPS  TRIM' : 'OXYGEN  RADIO',
      [0, 0, 0],
      0.19,
      0.0016,
    );
    // The dark footboards and closing bulkhead prevent a view into the engine/wing cavities.
    box(walls, `footboard-${side}`, [0.24, 0.018, 1.1], [side * 0.21, 1.39, 0.14], rubber);
  }
  const bulkhead = [
    [-0.38, 1.28],
    [-0.43, 1.5],
    [-0.44, 1.75],
    [-0.4, 2.055],
    [0.4, 2.055],
    [0.44, 1.75],
    [0.43, 1.5],
    [0.38, 1.28],
  ];
  plate(walls, 'forward-footwell-bulkhead', bulkhead, 1.025, enamel, 0.018);
  // P-51-style trim wheels below the left throttle and equipment on the right sidewall.
  for (const [i, z] of [-0.15, 0.045].entries()) {
    const wheel = mesh(walls, `trim-wheel-${i}`, new T.TorusGeometry(0.06, 0.008, 6, 20), rubber, [
      0.332,
      1.53,
      z,
    ]);
    wheel.rotation.y = Math.PI / 2;
    rod(walls, `trim-hub-${i}`, [0.325, 1.53, z], [0.391, 1.53, z], 0.016, silver);
    for (let spoke = 0; spoke < 3; spoke++) {
      const angle = (spoke * Math.PI * 2) / 3;
      rod(
        walls,
        `trim-spoke-${i}-${spoke}`,
        [0.332, 1.53, z],
        [0.332, 1.53 + Math.cos(angle) * 0.055, z + Math.sin(angle) * 0.055],
        0.004,
        dark,
      );
    }
  }
  box(walls, 'right-electrical-box', [0.085, 0.1, 0.34], [-0.346, 1.57, -0.23], dark);
  for (let i = 0; i < 5; i++)
    mesh(
      walls,
      `electrical-button-${i}`,
      new T.CylinderGeometry(0.009, 0.009, 0.014, 8),
      i === 0 ? red : rubber,
      [-0.343, 1.628, -0.36 + i * 0.065],
    );
  const hose = new T.CatmullRomCurve3(
    [
      [-0.3, 1.37, -0.2],
      [-0.32, 1.41, 0.02],
      [-0.335, 1.57, 0.3],
      [-0.355, 1.81, 0.55],
    ].map((p) => new T.Vector3(...p)),
  );
  mesh(walls, 'oxygen-hose', new T.TubeGeometry(hose, 24, 0.014, 8, false), green);
  for (let i = 0; i < 28; i++) {
    const t = i / 27;
    const collar = mesh(
      walls,
      `hose-corrugation-${i}`,
      new T.TorusGeometry(0.014, 0.0025, 4, 8),
      rubber,
      hose.getPoint(t).toArray(),
    );
    collar.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), hose.getTangent(t).normalize());
  }
  finishCockpit(walls, (part) => (part.material === enamel ? 'paint' : undefined));
  // These fittings are static: retain only one draw per material, with controls outside this group.
  walls.updateMatrixWorld(true);
  const inverse = walls.matrixWorld.clone().invert(),
    batches = new Map();
  walls.traverse((part) => {
    if (!part.isMesh) return;
    const geometry = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
    geometry.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse, part.matrixWorld));
    if (!batches.has(part.material)) batches.set(part.material, []);
    batches.get(part.material).push(geometry);
  });
  walls.clear();
  for (const [material, geometries] of batches)
    mesh(walls, `sidewall-${material.name}`, mergeGeometries(geometries), material);
}

/** One rudder pedal at its pivot, leaned top-forward as the box pedals were: a cast pad between
 * side rails, a rubber tread, a leather toe strap and a heel lip, the arm running down to the bar. */
function mustangPedal(kit, side, api) {
  const { silver, rubber, brown } = api;
  const w = 0.1,
    h = 0.15,
    lean = 0.28;
  const add = (geometry, material) => kit.add(geometry.rotateX(lean), material);
  add(roundedBox([w, h, 0.009], 0.012), silver);
  add(place(roundedBox([w * 0.76, h * 0.56, 0.003], 0.008), [0, -h * 0.1, -0.005]), rubber);
  for (const x of [-1, 1])
    add(bar([x * w * 0.5, -h * 0.48, -0.004], [x * w * 0.5, h * 0.46, -0.004], 0.0055, 12), silver);
  add(place(roundedBox([w * 1.04, 0.012, 0.032], 0.004), [0, -h / 2 + 0.002, -0.014]), silver);
  add(place(roundedBox([w * 1.02, 0.028, 0.005], 0.0025), [0, h * 0.3, -0.017]), brown);
  for (const x of [-1, 1])
    add(place(new T.BoxGeometry(0.006, 0.02, 0.016), [x * w * 0.5, h * 0.3, -0.01]), silver);
  add(
    bar([side * w * 0.2, -h * 0.42, 0.006], [side * w * 0.2, -h * 0.5 - 0.06, 0.05], 0.0085, 12),
    silver,
  );
}

/** A mount fixed in the cockpit (rotated to its panel) and the moving pivot inside it. */
function station(cabin, name, at, rotation = [0, 0, 0]) {
  const mount = new T.Group();
  mount.name = `${name}-mount`;
  mount.position.fromArray(at);
  mount.rotation.set(...rotation);
  cabin.add(mount);
  const pivot = new T.Group();
  pivot.name = name;
  mount.add(pivot);
  return { mount, pivot };
}

/** The bakelite pistol grip on the stick top: a palm swell under a domed head, the gun trigger
 * in front and the bomb button on top. +Y runs up the grip, the trigger faces +Z. */
function pistolGrip(stick, at, tilt, api) {
  const { mesh, rubber, silver, dark, red } = api;
  const head = new T.Group();
  head.name = 'stick-grip-head';
  head.position.fromArray(at);
  head.rotation.x = tilt;
  stick.add(head);
  mesh(
    head,
    'stick-grip-collar',
    lathe(
      [
        [0, 0],
        [0.0155, 0],
        [0.0165, 0.004],
        [0.0165, 0.013],
        [0.014, 0.017],
        [0, 0.017],
      ],
      16,
    ),
    silver,
  );
  const sections = [
    [0.015, 0, 0.015, 0.016, 2],
    [0.03, 0.002, 0.0175, 0.02, 2.1],
    [0.058, 0.004, 0.019, 0.023, 2.2],
    [0.088, 0.004, 0.0192, 0.024, 2.2],
    [0.106, 0.0, 0.0205, 0.0275, 2.4],
    [0.121, -0.004, 0.0195, 0.0265, 2.4],
    [0.13, -0.004, 0.0135, 0.0185, 2.2],
    [0.134, -0.004, 0.006, 0.008, 2],
  ];
  mesh(
    head,
    'stick-grip',
    loftUp(
      sections.map(([y, cz, rx, rz, power]) => ({ y, points: contour(0, cz, rx, rz, 18, power) })),
    ),
    rubber,
  );
  mesh(
    head,
    'stick-trigger',
    tube(
      [
        [0, 0.1, 0.02],
        [0, 0.094, 0.036],
        [0, 0.078, 0.039],
        [0, 0.068, 0.028],
      ],
      0.0046,
      10,
    ),
    dark,
  );
  mesh(
    head,
    'stick-bomb-button',
    place(new T.CylinderGeometry(0.0055, 0.0055, 0.006, 14), [0, 0.133, 0.004], [0.25, 0, 0]),
    red,
  );
  mesh(
    head,
    'stick-thumb-switch',
    place(roundedBox([0.006, 0.01, 0.008], 0.002), [0.019, 0.112, -0.004], [0, 0, -0.3]),
    dark,
  );
}

/** Landing gear handle forward of the throttle quadrant, flap handle at the console's aft end,
 * ignition switch on the panel's lower left (Cripes A'Mighty 3rd left-side photographs). */
function addLeftConsoleControls(cabin, api) {
  const { mesh, silver, dark, rubber } = api;
  const { text } = instrumentParts(api);
  // Gear handle on the console's inboard face; it swings in a vertical slot (UP above, DOWN
  // below) and points at the pilot's knee.
  const gear = station(cabin, 'landing-gear-handle', [0.348, 1.594, 0.455], [0, Math.PI / 2, 0]);
  mesh(
    gear.mount,
    'gear-escutcheon',
    place(roundedBox([0.044, 0.13, 0.004], 0.004, 1), [0, 0, 0.0025]),
    dark,
  );
  mesh(gear.mount, 'gear-escutcheon-slot', new T.BoxGeometry(0.008, 0.074, 0.002), rubber);
  text(gear.mount, 'gear-up-legend', 'UP', 0, 0.047, -0.0015, 0.0014);
  text(gear.mount, 'gear-down-legend', 'DOWN', 0, -0.047, -0.0015, 0.0012);
  text(gear.mount, 'gear-legend', 'GEAR', 0, 0.059, -0.0015, 0.0011);
  mesh(
    gear.pivot,
    'gear-handle-lever',
    tube(
      [
        [0, 0, 0.002],
        [0, 0, -0.03],
        [0, 0.008, -0.07],
      ],
      0.0052,
      12,
    ),
    silver,
  );
  mesh(
    gear.pivot,
    'gear-handle-knob',
    place(
      lathe(
        [
          [0, 0],
          [0.009, 0],
          [0.016, 0.004],
          [0.018, 0.012],
          [0.015, 0.02],
          [0, 0.022],
        ],
        18,
      ),
      [0, 0.009, -0.068],
      [-Math.PI / 2 - 0.2, 0, 0],
    ),
    rubber,
  );
  // Gear down (1) holds the knob down, up (0) lifts it.
  gear.pivot.userData.aircraftControl = {
    action: 'gear',
    motion: { property: 'rotation', axis: 'x', scale: -0.8, offset: 0.4 },
  };

  // Flap handle in its notched quadrant on the console top: forward is UP, aft is DOWN.
  const flaps = station(cabin, 'flap-control-handle', [0.397, 1.662, -0.235]);
  mesh(
    flaps.mount,
    'flap-quadrant',
    place(roundedBox([0.034, 0.005, 0.13], 0.003, 1), [0, 0.0005, 0]),
    dark,
  );
  mesh(
    flaps.mount,
    'flap-quadrant-slot',
    new T.BoxGeometry(0.008, 0.002, 0.1).translate(0, 0.003, 0),
    rubber,
  );
  for (let i = 0; i < 6; i++)
    mesh(
      flaps.mount,
      `flap-quadrant-notch-${i}`,
      new T.BoxGeometry(0.008, 0.0012, 0.0018).translate(0.011, 0.0034, 0.04 - i * 0.016),
      silver,
    );
  const legend = new T.Group();
  legend.name = 'flap-legend';
  legend.position.set(0, 0.004, 0);
  legend.rotation.x = Math.PI / 2;
  flaps.mount.add(legend);
  text(legend, 'flap-legend-up', 'UP', -0.004, 0.054, 0, 0.0011);
  text(legend, 'flap-legend-down', 'DN', -0.004, -0.054, 0, 0.0011);
  mesh(
    flaps.pivot,
    'flap-handle-lever',
    bar([0, 0, 0], [0, 0.082, -0.006], 0.0045, 12, 0.004),
    silver,
  );
  mesh(
    flaps.pivot,
    'flap-handle-knob',
    new T.SphereGeometry(0.0125, 16, 12),
    rubber,
    [0, 0.09, -0.007],
  );
  flaps.pivot.userData.aircraftControl = {
    action: 'flaps',
    motion: { property: 'rotation', axis: 'x', scale: -0.7, offset: 0.35 },
  };
  const placardGroup = new T.Group();
  placardGroup.name = 'flap-placard';
  placardGroup.position.set(0.397, 1.6625, -0.33);
  placardGroup.rotation.x = Math.PI / 2;
  cabin.add(placardGroup);
  mesh(placardGroup, 'flap-placard-plate', new T.BoxGeometry(0.07, 0.022, 0.002), rubber);
  text(placardGroup, 'flap-placard-print', 'FLAPS', 0, 0, -0.0015, 0.0018);

  // Ignition switch (OFF, L, R, BOTH) on the panel's lower left, below the clock.
  const ignition = station(cabin, 'ignition-switch', [0.335, 1.735, 0.536]);
  mesh(
    ignition.mount,
    'ignition-bezel',
    lathe(
      [
        [0, 0],
        [0.019, 0],
        [0.019, 0.003],
        [0.016, 0.005],
        [0, 0.005],
      ],
      20,
    ).rotateX(-Math.PI / 2),
    dark,
  );
  for (const [label, x, y] of [
    ['OFF', 0.026, 0.008],
    ['L', 0.012, 0.025],
    ['R', -0.012, 0.025],
    ['BOTH', -0.03, 0.008],
  ])
    text(ignition.mount, `ignition-${label}`, label, x, y, -0.002, 0.0009);
  text(ignition.mount, 'ignition-legend', 'IGNITION', 0, -0.03, -0.002, 0.0012);
  mesh(
    ignition.pivot,
    'ignition-knob',
    place(new T.CylinderGeometry(0.008, 0.009, 0.008, 16), [0, 0, -0.008], [Math.PI / 2, 0, 0]),
    rubber,
  );
  mesh(
    ignition.pivot,
    'ignition-lever',
    place(roundedBox([0.009, 0.034, 0.011], 0.003), [0, 0.004, -0.014]),
    rubber,
  );
  mesh(
    ignition.pivot,
    'ignition-pointer',
    place(roundedBox([0.0025, 0.012, 0.001], 0.0005), [0, 0.012, -0.02]),
    api.white,
  );
  // Rest is OFF, the lever tipped to the left; BOTH turns it clockwise past L and R.
  ignition.pivot.userData.aircraftControl = {
    action: 'engine',
    motion: { property: 'rotation', axis: 'z', scale: 2.2, offset: -1.1 },
  };
}

/** The canopy hand crank on the right wall below the sill, its handle toward the pilot. */
function addCanopyCrank(cabin, api) {
  const { mesh, cabinWidth, silver, green, rubber } = api;
  const { text } = instrumentParts(api);
  // Between the wall ribs at z 0.18 and 0.48, under the instruction placard.
  const y = 1.845,
    z = 0.3;
  const crank = station(
    cabin,
    'canopy-crank',
    [-(cabinWidth(y, z) - 0.012), y, z],
    [0, -Math.PI / 2, 0],
  );
  mesh(
    crank.mount,
    'canopy-crank-housing',
    lathe(
      [
        [0, 0],
        [0.034, 0],
        [0.034, 0.008],
        [0.026, 0.016],
        [0.014, 0.018],
        [0, 0.018],
      ],
      20,
    ).rotateX(-Math.PI / 2),
    green,
  );
  text(crank.mount, 'canopy-crank-legend', 'CANOPY', 0, -0.046, -0.002, 0.0012);
  mesh(
    crank.pivot,
    'canopy-crank-hub',
    place(new T.CylinderGeometry(0.011, 0.012, 0.012, 16), [0, 0, -0.024], [Math.PI / 2, 0, 0]),
    silver,
  );
  mesh(
    crank.pivot,
    'canopy-crank-arm',
    place(roundedBox([0.016, 0.07, 0.009], 0.004), [0, 0.027, -0.03]),
    green,
  );
  mesh(
    crank.pivot,
    'canopy-crank-handle',
    bar([0, 0.056, -0.03], [0, 0.056, -0.08], 0.0085, 14, 0.0095),
    rubber,
  );
  // Winding the hood back takes several turns of the crank.
  crank.pivot.userData.aircraftControl = {
    action: 'canopy',
    motion: { property: 'rotation', axis: 'z', scale: -9.4 },
  };
}
