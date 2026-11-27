/** Physical controls for the supported flight model, exported in the aircraft GLB.
 * Existing authored controls are retained; missing systems receive a bolted lower-panel module.
 * glTF extras carry the interaction and rest-relative motion through the normal asset importer.
 */
import { createAircraftCockpit } from '../../../client/dist/aircraft.mjs';
import { cockpitText } from './cockpit-lettering.mjs';
import { controlStation, pedalGeometry } from './cockpit-parts.mjs';
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
  // Stations put each remaining control where the real aircraft has it, as its own part from
  // the shared library (cockpit-parts.mjs); the bolted module below is only a fallback.
  const ink = mat('flight-control-legend', '#e0e5da');
  const write = (kit, host, label, at, height) => {
    if (frame.letteringFont)
      cockpitText(host, `${host.name}-legend`, label, at, height, ink, frame.letteringFont, 0.08);
    else kit.text(label, at, height, Math.PI, ink);
  };
  const stationParent =
    model.getObjectByName(frame.controlParent ?? spec.visual.interior?.nodes?.[0] ?? '') ?? model;
  for (const station of frame.controlStations ?? []) {
    const engineId = station.engine === undefined ? undefined : engineIds[station.engine];
    if (station.engine !== undefined && engineId === undefined)
      throw Error(`${spec.label}: station ${station.action} names engine ${station.engine}`);
    const control = missing.find((c) => c.action === station.action && c.engine === engineId);
    if (!control)
      throw Error(
        `${spec.label}: no unmodeled ${station.action}${engineId ? ` (${engineId})` : ''} control for its station`,
      );
    missing.splice(missing.indexOf(control), 1);
    if (station.action === 'yaw') {
      for (const side of [-1, 1]) {
        const at = [station.at[0] + side * (station.spacing ?? 0.1), station.at[1], station.at[2]];
        const pedalGroup = group(stationParent, `flight-rudder-pedal-${side}`);
        model.add(pedalGroup);
        pedalGroup.position.fromArray(at);
        stationParent.attach(pedalGroup);
        const kit = detailKit(pedalGroup, pedalGroup.name);
        pedalGeometry(kit, { ...station, side });
        kit.finish();
        pedalGroup.userData.aircraftControl = {
          action: 'yaw',
          motion: { property: 'position', axis: 'z', scale: -side * 0.035 },
        };
      }
      continue;
    }
    const name = `cockpit-${station.action}-${engineId ?? 'common'}`;
    controlStation(model, stationParent, name, station.action, { ...station, engineId }, write);
  }
  if (!missing.length) return model;
  if (frame.controlStations)
    console.warn(
      `${spec.label}: falling back to the bolted control module for ${missing.map((c) => c.label).join(', ')}`,
    );
  const eye = spec.pilotEye;
  const panelZ = frame.panelZ ?? eye[2] + 0.74;
  const floor = frame.floor ?? eye[1] - 1.05;
  const controls = group(model, 'flight-controls');
  const dark = mat('flight-control-panel', '#30383b', { roughness: 0.82 });
  const black = mat('flight-control-grip', '#141b1d', { roughness: 0.78 });
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
  // Every catalog aircraft now models its controls (frame.controlStations or its own nodes), so
  // this module only appears for a new aircraft whose stations are not written yet: a lower
  // fascia under the panel, to be replaced. `frame.controlModule` = [x, y, z, fit] places it; the
  // optional fit takes `columns` (grid width), `skip` (columns left empty where something stands
  // in front) and `tilt` (radians laid back onto a console; pi/2 lies flat, top row forward).
  const [mx, my, mz, fit = {}] = frame.controlModule ?? [0, eye[1] - 0.7, panelZ - 0.055];
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
      pedalGeometry(d, { style: frame.pedalStyle ?? 'ga', side, drop: 0.12 });
      pedal.userData.aircraftControl = {
        action: 'yaw',
        // Right rudder pushes the right pedal (-X) forward.
        motion: { property: 'position', axis: 'z', scale: -side * 0.035 },
      };
      d.finish();
    }
  }
  if (tilted) plate.finish();
  backing.finish();
  return model;
}
