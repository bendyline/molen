/** Physical controls for the supported flight model, exported in the aircraft GLB.
 * Existing authored controls are retained; missing systems receive a bolted lower-panel module.
 * glTF extras carry the interaction and rest-relative motion through the normal asset importer.
 */
import { createAircraftCockpit } from '../../../client/dist/aircraft.mjs';
import { cockpitText } from './cockpit-lettering.mjs';
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
  const pitch = 0.092;
  const grid = (columns, skip = []) => {
    const open = Array.from({ length: columns }, (_, column) => column).filter(
      (column) => !skip.includes(column),
    );
    const rows = Math.ceil(moduleControls.length / open.length);
    return { columns, open, rows, width: columns * pitch + 0.018, height: rows * 0.105 + 0.015 };
  };
  const standard = grid(Math.min(moduleControls.length, (frame.cabinWidth ?? 1.2) < 1 ? 7 : 8));
  // A lower fascia joins the existing instrument panel. It does not cover the flight displays.
  // The shared transport deck (aircraft-interiors.mjs, fitted by deckFit) has a ledge along the
  // panel foot 0.6875 m under the eye: the module stands on it, its folded brackets inside the
  // panel board. Each placement below was measured on the built model against the panel,
  // pedestal, console and displays.
  const ledge = eye[1] - 0.6875 + standard.height / 2 + 0.0025;
  const mounts = {
    ...Object.fromEntries(
      ['Airbus H125', 'Beechcraft Bonanza G36'].map((label) => [
        label,
        [0, eye[1] - 0.5, panelZ - 0.055],
      ]),
    ),
    'Gulfstream G650ER': [0, ledge, panelZ - 0.055],
    // Clear of the console's forward end and of the standby dials on the pilot's side.
    'Cessna Citation CJ4': [-0.14, ledge, panelZ - 0.043],
    // The centre of the ledge carries the pedestal display, so the module stands to its right.
    'Airbus A220-300': [-0.567, ledge - 0.005, panelZ - 0.055],
    // Two rows on the ledge would hide the displays' lower edge: it rests on the console's
    // forward switch row instead, ahead of the power levers.
    'De Havilland Canada Dash 8-400': [0, eye[1] - 0.648, eye[2] + 0.3],
    // The aircraft's own flight decks: on the pedestal, clear of throttles and displays.
    'Airbus A320neo': [0, eye[1] - 0.74, eye[2] + 0.47],
    // Between the aft pedestal and the throttle quadrant, behind the trim wheels and levers.
    'Boeing 737-800': [0, eye[1] - 0.638, eye[2] + 0.185],
    'Embraer E175': [0, eye[1] - 0.63, eye[2] + 0.47],
    'Cessna 172S Skyhawk': [-0.42, 1.13, 1.065],
    'Beechcraft Baron G58': [0, 1.395, 1.065],
    'Mikoyan MiG-29A': [0, 2.1, 4.105],
    'Robinson R44 Raven II': [-0.13, 0.98, 1.4],
    'Boeing C-17A Globemaster III': [0, 4.89, 23.18],
    // On the face of the glareshield housing, under its radio heads. The housing stands 0.17 m
    // aft of the panel, so a module on the panel itself sat inside it.
    'Antonov An-124-100 Ruslan': [0, 9.005, 28.0125],
    'Douglas DC-3': [0, 4.1, 6.95],
    'P-51D Mustang': [-0.16, 1.48, 0.485],
    // On the pedestal, between the cyclic roots and the panel post.
    'OH-6': [0, 1.115, 0.96],
    // On the forward end of the pedestal top, ahead of the thrust levers.
    'Bendy Small Airliner': [0, 4.02, 16.33],
    'Airbus A400M Atlas': [0, eye[1] - 1, panelZ - 0.055],
    // On the forward end of the centre console, under the panel's lower edge: lower, the yokes
    // and the console itself hid it.
    'Lockheed Martin C-130J Super Hercules': [0, eye[1] - 0.805, panelZ - 0.055],
    // Flat on the forward end of the pedestal, between the lever labels and the FMS keyboards.
    'ATR 72-600': [0, 2.247, 11.3, { tilt: Math.PI / 2 }],
    // In the pedestal's centre strip, between the FMS keypads and below the engine levers.
    'Leonardo AW139': [0, 1.014, 2.572, { columns: 1, tilt: 1 }],
    // Below the lower panel on the pilot's side, at the switch bolster's height; the centre
    // console stood in front of the old place.
    'Cirrus SR22T G6': [0.4, eye[1] - 0.65, panelZ - 0.055],
    // Under the pilot-side corner of the panel; the pedestal fills the centre below the panel.
    'Airbus H145 D3': [-0.315, 1.46, panelZ - 0.055],
    // On the centre panel between the engine display and the left map, above the pedestal.
    'Boeing CH-47F Chinook': [0.172, 1.84, panelZ - 0.055],
    'Bell Boeing MV-22B Osprey': [0, 1.95, panelZ - 0.18],
    'Sikorsky UH-60M Black Hawk': [0, 1.21, panelZ - 0.055],
    // At the panel's foot under the HLD, five wide so the front consoles stay clear of it. The
    // seat cushion, now under the eye, hid the old place in the footwell.
    'Dassault Rafale C': [0, 2.22, panelZ - 0.055, { columns: 5 }],
    // The quadrant's levers and the pilot's wheel stand in front of the middle three columns;
    // the starters and gear switch that sat there are on the panel (beech-18-cockpit.mjs).
    'Beechcraft Model 18': [0, eye[1] - 0.7, panelZ - 0.055, { columns: 7, skip: [2, 3, 4] }],
    'Eurofighter Typhoon': [0, eye[1] - 0.7, panelZ - 0.14],
    'Lockheed Martin F-22A Raptor': [0, 1.99, panelZ - 0.055],
    'De Havilland Canada DHC-2 Beaver': [0.4, eye[1] - 0.5, panelZ - 0.055],
  };
  // An optional fourth element fits the module to a tighter space: `columns` sets the grid width,
  // `skip` leaves those columns empty where something stands in front of them, and `tilt` lays
  // the module back by that many radians onto a sloped or flat console (pi/2 lies flat, top row
  // forward). A console module rests on its side cheeks, so it has no hanger brackets.
  const [mx, my, mz, fit = {}] = mounts[spec.label] ?? [0, eye[1] - 0.7, panelZ - 0.055];
  const { columns, open, rows, width, height } =
    fit.columns || fit.skip ? grid(fit.columns ?? standard.columns, fit.skip) : standard;
  const tilted = fit.tilt !== undefined;
  const host = tilted ? group(controls, 'flight-control-module', [mx, my, mz]) : controls;
  if (tilted) host.rotation.x = fit.tilt;
  const plate = tilted ? detailKit(host, 'flight-control-module-mounts') : backing;
  const center = tilted ? [0, 0, 0] : [mx, my, mz];
  const mountZ = center[2] + 0.055;
  if (moduleControls.length) {
    plate.box([width, height, 0.035], center, dark);
    for (const side of [-1, 1]) {
      // Folded brackets rise behind the existing backboard, leaving its front instruments clear.
      if (!tilted)
        plate.box(
          [0.018, 0.24, 0.018],
          [center[0] + side * (width / 2 - 0.018), center[1] + 0.1, mountZ + 0.025],
          dark,
        );
      plate.box(
        [0.018, height - 0.012, 0.08],
        [center[0] + side * (width / 2 - 0.018), center[1], mountZ - 0.018],
        dark,
      );
      for (const y of [-height / 2 + 0.014, height / 2 - 0.014])
        plate.add(new T.CylinderGeometry(0.0035, 0.0035, 0.003, 8).rotateX(Math.PI / 2), alloy, [
          center[0] + side * (width / 2 - 0.012),
          center[1] + y,
          center[2] - 0.02,
        ]);
    }
  }
  for (const [index, control] of moduleControls.entries()) {
    const x = center[0] + ((columns - 1) / 2 - open[index % open.length]) * pitch;
    const y = center[1] + ((rows - 1) / 2 - Math.floor(index / open.length)) * 0.105;
    const at = [x, y - 0.008, center[2] - 0.023];
    const name = `flight-${control.action}-${control.engine ?? 'common'}`;
    const pivot = group(host, name, at);
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
    const legendAt = [x, y + 0.032, center[2] - 0.02];
    if (frame.letteringFont)
      cockpitText(
        host,
        `${name}-legend`,
        label,
        legendAt,
        0.008,
        ink,
        frame.letteringFont,
        pitch * 0.85,
      );
    else plate.text(label, legendAt, 0.008, Math.PI, ink);
    plate.box([0.009, 0.049, 0.002], [x, y - 0.009, center[2] - 0.019], black);
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
  if (tilted) plate.finish();
  backing.finish();
  return model;
}
