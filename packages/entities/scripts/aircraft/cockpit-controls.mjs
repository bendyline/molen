/** Physical controls for the supported flight model, exported in the aircraft GLB.
 * Existing authored controls are retained; missing systems receive a bolted lower-panel module.
 * glTF extras carry the interaction and rest-relative motion through the normal asset importer.
 */
import { createAircraftCockpit } from '../../../client/dist/aircraft.mjs';
import { detailKit, group, mat, T } from './mesh-kit.mjs';

export function completeCockpitControls(model, spec, frame = {}) {
  // Stable named lever groups already present in the models. Keep their full-rich/high-RPM
  // rest pose; selecting a smaller value pulls the knob or rotates the lever back.
  const existing = [
    ['Skyhawk-mixture', 'mixture', 'position', 0.055],
    ['Skylane-mixture', 'mixture', 'position', 0.055],
    ['Skylane-prop', 'propeller', 'position', 0.055],
    ['Cherokee-mixture', 'mixture', 'position', 0.055],
    ['Bonanza-mixture', 'mixture'],
    ['Bonanza-propeller', 'propeller'],
    ['Cirrus-mixture', 'mixture'],
    ['Caravan-lever-prop', 'propeller'],
    ['Beaver-quadrant-1', 'propeller'],
    ['Beaver-quadrant-2', 'mixture'],
    ['Porter-power-1', 'propeller'],
    ...[0, 1].flatMap((i) => [
      [`Baron-mixture-${i + 1}`, 'mixture', 'rotation', 0.65, i],
      [`Baron-prop-lever-${i + 1}`, 'propeller', 'rotation', 0.65, i],
      [`KingAir-prop-lever-${i + 1}`, 'propeller', 'rotation', 0.65, i],
      [`Beech18-lever-${i}`, 'propeller', 'rotation', 0.65, i],
      [`Beech18-lever-${i + 4}`, 'mixture', 'rotation', 0.65, i],
      [`DC3-lever-${i}`, 'propeller', 'rotation', 0.65, i],
      [`DC3-lever-${i + 4}`, 'mixture', 'rotation', 0.65, i],
      [`TwinOtter-overhead-lever-${i + 2}`, 'propeller', 'rotation', 0.65, i],
      [`ATR72-power-lever-${i + 2}`, 'propeller', 'rotation', 0.65, i],
    ]),
  ];
  const engineIds = [...(spec.engines ?? [])]
    .sort((a, b) => b.position[0] - a.position[0])
    .map((e) => e.id);
  for (const [name, action, property = 'rotation', scale = 0.65, index] of existing) {
    const node = model.getObjectByName(name);
    if (!node) continue;
    node.userData.aircraftControl = {
      action,
      ...(index === undefined ? {} : { engine: engineIds[index] }),
      motion: { property, axis: property === 'position' ? 'z' : 'x', scale, offset: -scale },
    };
  }
  const missing = createAircraftCockpit(model, spec).controls.filter((c) => !c.nodes.length);
  if (!missing.length) return model;
  const eye = spec.pilotEye;
  const panelZ = frame.panelZ ?? eye[2] + 0.74;
  const floor = frame.floor ?? eye[1] - 1.05;
  const controls = group(model, 'flight-controls');
  const dark = mat('flight-control-panel', '#30383b', { roughness: 0.82 });
  const black = mat('flight-control-grip', '#141b1d', { roughness: 0.78 });
  const ink = mat('flight-control-legend', '#e0e5da');
  const alloy = mat('flight-control-alloy', '#9aa4a2', { metalness: 0.7 });
  const red = mat('flight-control-master', '#a54438');
  const blue = mat('flight-control-propeller', '#3679ab');
  const backing = detailKit(controls, 'flight-control-mounts');
  const moduleControls = missing.filter((c) => c.action !== 'yaw');
  const columns = Math.min(moduleControls.length, (frame.cabinWidth ?? 1.2) < 1 ? 7 : 8);
  const rows = Math.ceil(moduleControls.length / columns);
  const pitch = 0.092;
  const width = columns * pitch + 0.018;
  const height = rows * 0.105 + 0.015;
  // A lower fascia joins the existing instrument panel. It does not cover the flight displays.
  const mounts = {
    ...Object.fromEntries(
      [
        'Airbus A220-300',
        'Airbus A320neo',
        'Boeing 737-800',
        'Cessna Citation CJ4',
        'De Havilland Canada Dash 8-400',
        'Embraer E175',
        'Gulfstream G650ER',
        'Airbus H125',
        'Beechcraft Bonanza G36',
      ].map((label) => [label, [0, eye[1] - 0.5, panelZ - 0.055]]),
    ),
    'Cessna 172S Skyhawk': [-0.42, 1.13, 1.065],
    'Beechcraft Baron G58': [0, 1.395, 1.065],
    'Mikoyan MiG-29A': [0, 2.1, 4.105],
    'Robinson R44 Raven II': [-0.13, 0.98, 1.4],
    'Boeing C-17A Globemaster III': [0, 4.89, 23.18],
    'Antonov An-124-100 Ruslan': [0, 8.95, 28.22],
    'Douglas DC-3': [0, 4.1, 6.95],
    'P-51D Mustang': [-0.16, 1.48, 0.735],
    'OH-6': [0, 1.2, 1.265],
    'Bendy Small Airliner': [0, 3.99, 15.92],
    'Airbus A400M Atlas': [0, eye[1] - 1, panelZ - 0.055],
    'Lockheed Martin C-130J Super Hercules': [0, eye[1] - 1, panelZ - 0.055],
    'ATR 72-600': [0, eye[1] - 0.95, panelZ - 0.055],
    'Bell Boeing MV-22B Osprey': [0, eye[1] - 0.7, panelZ - 0.18],
    'Dassault Rafale C': [0, eye[1] - 1.05, panelZ - 0.055],
    'Eurofighter Typhoon': [0, eye[1] - 0.7, panelZ - 0.14],
    'De Havilland Canada DHC-2 Beaver': [0.4, eye[1] - 0.5, panelZ - 0.055],
  };
  const center = mounts[spec.label] ?? [0, eye[1] - 0.7, panelZ - 0.055];
  const mountZ = center[2] + 0.055;
  if (moduleControls.length) {
    backing.box([width, height, 0.035], center, dark);
    for (const side of [-1, 1]) {
      // Folded brackets rise behind the existing backboard, leaving its front instruments clear.
      backing.box(
        [0.018, 0.24, 0.018],
        [center[0] + side * (width / 2 - 0.018), center[1] + 0.1, mountZ + 0.025],
        dark,
      );
      backing.box(
        [0.018, height - 0.012, 0.08],
        [center[0] + side * (width / 2 - 0.018), center[1], mountZ - 0.018],
        dark,
      );
      for (const y of [-height / 2 + 0.014, height / 2 - 0.014])
        backing.add(new T.CylinderGeometry(0.0035, 0.0035, 0.003, 8).rotateX(Math.PI / 2), alloy, [
          center[0] + side * (width / 2 - 0.012),
          center[1] + y,
          center[2] - 0.02,
        ]);
    }
  }
  for (const [index, control] of moduleControls.entries()) {
    const x = center[0] + ((columns - 1) / 2 - (index % columns)) * pitch;
    const y = center[1] + ((rows - 1) / 2 - Math.floor(index / columns)) * 0.105;
    const at = [x, y - 0.008, center[2] - 0.023];
    const name = `flight-${control.action}-${control.engine ?? 'common'}`;
    const pivot = group(controls, name, at);
    const d = detailKit(pivot, `${name}-moving`);
    const engineNumber = control.engine ? control.label.match(/\d+/)?.[0] : undefined;
    const label =
      control.action === 'engine'
        ? engineNumber
          ? `ENG ${engineNumber}`
          : 'ENGINE'
        : control.action === 'power'
          ? engineNumber
            ? `PWR ${engineNumber}`
            : spec.engines?.length > 1
              ? 'PWR ALL'
              : 'POWER'
          : control.action === 'brake'
            ? 'BRAKE'
            : control.action === 'thrustVector'
              ? 'VECTOR'
              : control.action === 'propeller'
                ? `PROP ${engineNumber ?? ''}`
                : control.action === 'mixture'
                  ? `MIX ${engineNumber ?? ''}`
                  : control.action.toUpperCase();
    backing.text(label, [x, y + 0.032, center[2] - 0.02], 0.008, Math.PI, ink);
    backing.box([0.009, 0.049, 0.002], [x, y - 0.009, center[2] - 0.019], black);
    if (control.action === 'engine') {
      d.box([0.032, 0.029, 0.017], [0, 0, -0.008], control.engine ? black : red);
      d.box([0.014, 0.0025, 0.001], [0, 0.007, -0.017], ink);
      pivot.userData.aircraftControl = {
        action: control.action,
        engine: control.engine,
        motion: { property: 'rotation', axis: 'x', scale: -0.5 },
      };
    } else {
      d.rod([0, 0, 0], [0, 0, -0.028], 0.005, alloy);
      if (control.action === 'gear') {
        d.add(
          new T.CylinderGeometry(0.016, 0.016, 0.014, 16).rotateX(Math.PI / 2),
          black,
          [0, 0, -0.034],
        );
        d.ring(0.009, 0.002, [0, 0, -0.042], ink);
      } else if (control.action === 'flaps') {
        d.box([0.04, 0.012, 0.025], [0, 0, -0.032], ink);
      } else {
        d.box(
          [control.action === 'brake' ? 0.041 : 0.035, 0.018, 0.027],
          [0, 0, -0.031],
          control.action === 'mixture' ? red : control.action === 'propeller' ? blue : black,
        );
        d.box([0.018, 0.002, 0.001], [0, 0, -0.045], ink);
      }
      pivot.userData.aircraftControl = {
        action: control.action,
        engine: control.engine,
        motion: {
          property: 'position',
          axis: control.action === 'brake' ? 'z' : 'y',
          scale: control.action === 'brake' ? -0.022 : control.action === 'gear' ? -0.025 : 0.025,
        },
      };
    }
    d.finish();
  }
  if (missing.some((c) => c.action === 'yaw')) {
    for (const side of [-1, 1]) {
      const at = [eye[0] + side * 0.1, floor + 0.13, panelZ - 0.09];
      backing.rod([at[0], floor, at[2] + 0.08], at, 0.009, alloy);
      const pedal = group(controls, `flight-rudder-pedal-${side}`, at);
      const d = detailKit(pedal, pedal.name);
      d.box([0.13, 0.085, 0.025], [0, 0, 0], black);
      for (let i = -2; i <= 2; i++) d.box([0.11, 0.003, 0.003], [0, i * 0.014, -0.014], alloy);
      pedal.userData.aircraftControl = {
        action: 'yaw',
        motion: { property: 'position', axis: 'z', scale: side * 0.035 },
      };
      d.finish();
    }
  }
  backing.finish();
  return model;
}
