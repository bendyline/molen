import type {
  AircraftInputData,
  AircraftSpec,
  AircraftStateData,
  LiveryData,
} from '@bendyline/molen-schema';
import * as THREE from 'three';
import { type AircraftCockpit, createAircraftCockpit } from './aircraft-controls';
import { createAircraftDamageVisual } from './aircraft-damage';
import { createAircraftPropellers } from './aircraft-propellers';

export * from './aircraft-cockpit-pointer';
export * from './aircraft-collision';
export * from './aircraft-controls';

import { applyLivery } from './livery';
import {
  createModelSignalVisual,
  type ModelSignals,
  type ModelSignalVisual,
} from './model-signals';
import { createRotorBlur, type RotorBlur } from './rotor-blur';
import type { VehicleCameraOptions, VehicleCameraPose } from './vehicle-camera';
import { drawGlassInOnePass, isGlass } from './vehicle-glass';
import { createVehicleInteriorVisual, type VehicleInteriorVisual } from './vehicle-interior';

/** The group the cockpit-controls generator adds beside a model's cockpit: levers and legends. */
const FLIGHT_CONTROLS_NODE = 'flight-controls';
/**
 * Angular radius (radians) below which a cabin part is left out of the frame: under four pixels
 * across in a 1080p view with a 60° field of view. From a chase camera fifteen meters back,
 * gauges, needles and switches are each smaller than that behind the canopy, and each was a draw:
 * the P-51's cockpit, 415 meshes, was a quarter of a takeoff's draws in chase view.
 */
const CABIN_DETAIL_ANGLE = 0.002;
/**
 * Sun shadow-map texel (meters) beyond which the map no longer resolves an aircraft's own canopy
 * frame, seat and panels. Coarser, their shadows on the aircraft fall in blocks that jump as it
 * slides across the map's texel grid: at 0.2 m (100 m above the ground on High) about 1% of an
 * F-15C's cockpit view changed from frame to frame in straight flight, at 0.8 m 10%, a cockpit
 * flickering in the sun. It comes back once texels are SELF_SHADOW_RETURN or finer.
 */
const SELF_SHADOW_TEXEL = 0.15;
const SELF_SHADOW_RETURN = 0.12;

export interface AircraftVisual {
  setLivery(data: LiveryData | undefined): void;
  object: THREE.Object3D;
  cockpit: AircraftCockpit;
  interior?: VehicleInteriorVisual;
  /** The spec's exterior `animation` bindings (gear legs and doors, control surfaces). */
  animation?: ModelSignalVisual;
  update(
    state: AircraftStateData,
    input: AircraftInputData,
    altitude: number,
    signals?: ModelSignals,
    timeSeconds?: number,
  ): void;
  /**
   * The camera, in the coordinates of `object.position`. Cabin nodes (the spec's interior and the
   * generated flight controls) are drawn only near it: from farther away a cockpit is a few pixels
   * behind the canopy, yet it held most of an aircraft's draw calls, and as many again in the
   * shadow pass. Boarded and chase views are always near enough, but within the cabin a part too
   * small to see from the camera (CABIN_DETAIL_ANGLE) leaves the frame through its render layers,
   * so a binding's or damage's own `visible` is never overridden.
   */
  updateView(camera: readonly [number, number, number]): void;
  /**
   * The sun shadow map's texel size in meters (`Renderer.shadowTexelSize`) for the aircraft a view
   * is built around: the one flown or followed. Hosts pass `undefined` for every other aircraft.
   * While texels are too coarse to resolve the aircraft's own parts (over 0.15 m), it casts no
   * sun shadow until they are 0.12 m or finer. Its shadows on itself and on the ground below go,
   * and it still receives shadows from terrain, buildings and clouds.
   */
  updateShadows(texel: number | undefined): void;
  dispose(): void;
}
/**
 * Takes ownership of a loaded library GLB. The named nodes remain editable in a DCC.
 *
 * The gear and flaps follow `state.gearPosition` and `state.flapPosition` as they travel, or the
 * selection in `input` when the state has no positions (helicopters, hosts that animate only).
 */
export function createAircraftVisual(
  model: THREE.Object3D,
  spec: AircraftSpec,
  livery?: LiveryData,
): AircraftVisual {
  const cockpit = createAircraftCockpit(model, spec);
  const interior =
    cockpit.interior === undefined
      ? undefined
      : createVehicleInteriorVisual(model, cockpit.interior);
  const animation =
    spec.visual.animation === undefined
      ? undefined
      : createModelSignalVisual(model, spec.visual.animation);
  const moving = new Map<string, THREE.Object3D[]>();
  const articulatedGear = new Set(
    (spec.visual.animation?.bindings ?? [])
      .filter((binding) => binding.property === 'rotation' || binding.property === 'position')
      .map((binding) => binding.node),
  );
  model.traverse((o) => {
    o.userData.vehicleGeometry = true;
    if (o instanceof THREE.Mesh) {
      // Glass by name or by material: most catalog aircraft name theirs glass or glazing.
      o.castShadow = !o.name.includes('canopy') && !o.name.includes('bubble') && !isGlass(o);
      o.receiveShadow = true;
      drawGlassInOnePass(o);
    }
    const list = moving.get(o.name) ?? [];
    list.push(o);
    moving.set(o.name, list);
  });
  const turn = (name: string, axis: 'x' | 'y' | 'z', angle: number): void => {
    for (const node of moving.get(name) ?? []) node.rotation[axis] = angle;
  };
  let appearance = livery === undefined ? undefined : applyLivery(model, livery);
  const cabin = [...(spec.visual.interior?.nodes ?? []), FLIGHT_CONTROLS_NODE].flatMap(
    (name) => moving.get(name) ?? [],
  );
  // Nobody walks into a cockpit (boarding mounts the seat), and its hundreds of small parts made
  // the walker's collision tree beside a parked aircraft take a third of a second to build.
  for (const node of cabin)
    node.traverse((object) => {
      if ((object as THREE.Mesh).isMesh) object.userData.walkIgnore = true;
    });
  const cabinRange = Math.max(60, 3 * Math.max(spec.length, spec.span));
  const damage = createAircraftDamageVisual(model, spec);
  let propellers = createAircraftPropellers(model, spec);
  // Airplane propellers (tiltrotors' included) cross-fade into the disk createAircraftPropellers
  // draws, which follows damage and liveries. Every other rotor (helicopter main and tail rotors,
  // fans a jet binds as rotors) blurs here.
  const rotorEngines = spec.engines ?? (spec.engine ? [{ ...spec.engine, id: 'main' }] : []);
  const ownPropeller = (binding: (typeof spec.visual.rotors)[number]): boolean => {
    if (spec.model !== 'airplane') return false;
    const engine =
      binding.engine === undefined
        ? rotorEngines[0]
        : rotorEngines.find((e) => e.id === binding.engine);
    return engine !== undefined && engine.propulsion !== 'jet';
  };
  const blurs = new Map<(typeof spec.visual.rotors)[number], RotorBlur[]>();
  for (const binding of spec.visual.rotors) {
    if (ownPropeller(binding)) continue;
    const prepared = (moving.get(binding.node) ?? []).flatMap(
      (node) => createRotorBlur(node, binding.axis) ?? [],
    );
    if (prepared.length > 0) blurs.set(binding, prepared);
  }
  const shaftSpeed = (id: string | undefined): number =>
    (id === undefined
      ? undefined
      : spec.engines?.find((engine) => engine.id === id)?.rotorAngularSpeed) ??
    spec.engine?.rotorAngularSpeed ??
    spec.engines?.[0]?.rotorAngularSpeed ??
    0;
  let cabinShown = true;
  // Cabin parts, farthest-seen first, with the camera distance from the pilot's eye beyond which
  // each is too small to draw. The first `detailed` are drawn; the rest keep their layers here.
  model.updateMatrixWorld(true);
  const modelScale = model.matrixWorld.getMaxScaleOnAxis();
  const details: { mesh: THREE.Mesh; reach: number; layers: number }[] = [];
  const listed = new Set<THREE.Object3D>();
  for (const node of cabin)
    node.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh || listed.has(mesh)) return;
      listed.add(mesh);
      if (mesh.geometry.boundingSphere === null) mesh.geometry.computeBoundingSphere();
      const radius =
        ((mesh.geometry.boundingSphere?.radius ?? 0) * mesh.matrixWorld.getMaxScaleOnAxis()) /
        modelScale;
      details.push({ mesh, reach: radius / CABIN_DETAIL_ANGLE, layers: mesh.layers.mask });
    });
  details.sort((a, b) => b.reach - a.reach);
  let detailed = details.length;
  const eye = new THREE.Vector3();
  // Parts updateShadows took out of the shadow pass; each casts again when texels are fine enough.
  let shadowsOut = false;
  const unshadowed: THREE.Mesh[] = [];
  const castShadows = (cast: boolean): void => {
    shadowsOut = !cast;
    if (cast) {
      for (const mesh of unshadowed) mesh.castShadow = true;
      unshadowed.length = 0;
      return;
    }
    model.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh || !mesh.castShadow) return;
      mesh.castShadow = false;
      unshadowed.push(mesh);
    });
  };
  return {
    setLivery(data) {
      // New propellers record each blade's own shadow flag, so restore the flags first.
      const out = shadowsOut;
      if (out) castShadows(true);
      propellers.dispose();
      appearance?.dispose();
      damage.reset();
      appearance = data === undefined ? undefined : applyLivery(model, data);
      propellers = createAircraftPropellers(model, spec);
      if (out) castShadows(false);
    },
    object: model,
    cockpit,
    interior,
    animation,
    update(state, input, altitude, signals, timeSeconds) {
      const gear = state.gearPosition ?? Number(input.gear);
      const flaps = state.flapPosition ?? Number(input.flaps);
      for (const binding of spec.visual.rotors) {
        const engine = binding.engine === undefined ? undefined : state.engines?.[binding.engine];
        turn(
          binding.node,
          binding.axis,
          (engine?.rotorAngle ?? state.rotorAngle) * binding.multiplier,
        );
        // State rpm is a 0..1 fraction; ambient traffic reports a nominal figure, so it saturates.
        const fraction = Math.min(1, engine?.rpm ?? state.rpm ?? 0);
        const speed = fraction * shaftSpeed(binding.engine) * binding.multiplier;
        for (const blur of blurs.get(binding) ?? []) blur.update(speed);
      }
      for (const name of spec.visual.gearNodes) {
        // Authored hinges carry the gear into its well. Keep exposed stowed wheels visible
        // (e.g. 737 mains); the legacy hide/show fallback is only for unrigged models.
        if (articulatedGear.has(name)) continue;
        for (const node of moving.get(name) ?? []) node.visible = gear > 0;
      }
      for (const binding of spec.visual.flaps) {
        turn(binding.node, binding.axis, flaps * binding.multiplier);
      }
      for (const binding of spec.visual.ailerons) {
        turn(binding.node, binding.axis, input.roll * binding.multiplier);
      }
      if (spec.visual.interior === undefined && spec.visual.controlStick !== undefined) {
        turn(spec.visual.controlStick.node, spec.visual.controlStick.pitchAxis, input.pitch * 0.22);
        turn(spec.visual.controlStick.node, spec.visual.controlStick.rollAxis, input.roll * 0.22);
      }
      if (spec.visual.interior === undefined && spec.visual.collective !== undefined) {
        turn(
          spec.visual.collective.node,
          spec.visual.collective.axis,
          input.power * spec.visual.collective.multiplier,
        );
      }
      const engineSignals: Record<string, number | undefined> = Object.create(null);
      const bank = spec.engines ?? (spec.engine ? [{ ...spec.engine, id: 'main' }] : []);
      for (const engine of bank) {
        const reading = state.engines?.[engine.id];
        const prefix = `engines.${engine.id}.`;
        engineSignals[`${prefix}rpmNormalized`] = reading?.rpm;
        engineSignals[`${prefix}rotorRpm`] =
          reading === undefined
            ? undefined
            : (reading.rpm * engine.rotorAngularSpeed * 60) / (2 * Math.PI);
        engineSignals[`${prefix}failed`] =
          reading === undefined ? undefined : Number(reading.failed);
        engineSignals[`${prefix}thrustN`] = reading?.thrust;
        engineSignals[`${prefix}afterburner`] = reading?.afterburner ?? 0;
        engineSignals[`${prefix}shaftPowerW`] = reading?.shaftPower;
        engineSignals[`${prefix}combustion`] = reading?.combustion;
      }
      const telemetry: ModelSignals = {
        airspeed: state.airspeed,
        trueAirspeed: state.airspeed,
        equivalentAirspeed: state.equivalentAirspeed,
        mach: state.mach,
        overspeed: Number(state.overspeed ?? false),
        departure: state.departure ?? 0,
        vortexRing: state.vortexRing ?? 0,
        afterburner: Math.max(
          0,
          ...Object.values(state.engines ?? {}).map((engine) => engine.afterburner ?? 0),
        ),
        altitude,
        altitudeAGL: state.altitudeAGL,
        heading: state.yaw,
        verticalSpeed: state.verticalSpeed,
        rpm: state.rpm,
        rpmNormalized: state.rpm,
        // Shaft/prop/rotor speed configured by the flight model, never inferred turbine N1/N2.
        rotorRpm:
          spec.engines?.length || spec.engine === undefined
            ? undefined
            : (state.rpm * spec.engine.rotorAngularSpeed * 60) / (2 * Math.PI),
        pitch: state.pitch,
        roll: state.roll,
        pitchRate: state.pitchRate,
        rollRate: state.rollRate,
        yawRate: state.yawRate,
        angleOfAttack: state.angleOfAttack,
        sideslip: state.sideslip,
        loadFactor: state.loadFactor,
        groundSpeed:
          state.velocity === undefined
            ? undefined
            : Math.hypot(state.velocity[0], state.velocity[2]),
        stalled: Number(state.stalled),
        crashed: Number(state.crashed),
        power: input.power,
        pitchInput: input.pitch,
        rollInput: input.roll,
        yawInput: input.yaw,
        elevator: state.elevator ?? input.pitch,
        gear,
        flaps,
        thrustVector: state.thrustVectorPosition ?? 0,
        engine: Number(input.engine),
        brake: Number(input.brake),
        grounded: Number(state.grounded),
        ...state.actuators,
        ...engineSignals,
        ...signals,
      };
      for (const engine of bank) {
        // Commanded lever position, independent of shaft spool-up and external sensors.
        (telemetry as Record<string, number | undefined>)[`engines.${engine.id}.power`] =
          input.engines?.[engine.id]?.power ?? input.power;
        (telemetry as Record<string, number | undefined>)[`engines.${engine.id}.enabled`] = Number(
          input.engines?.[engine.id]?.enabled ?? true,
        );
        for (const action of ['mixture', 'propeller'] as const)
          (telemetry as Record<string, number | undefined>)[`engines.${engine.id}.${action}`] =
            input.engines?.[engine.id]?.[action] ?? input[action] ?? 1;
      }
      Object.assign(telemetry, {
        gearCommand: Number(input.gear),
        flapCommand: Number(input.flaps),
        vectorCommand: input.thrustVector ?? 0,
        engine: Number(input.engine),
        brake: Number(input.brake),
        mixture: input.mixture ?? 1,
        propeller: input.propeller ?? 1,
      });
      interior?.update(telemetry, timeSeconds);
      animation?.update(telemetry, timeSeconds);
      propellers.update(state, !shadowsOut);
      damage.update(state);
    },
    updateShadows(texel) {
      const out =
        texel !== undefined && texel > (shadowsOut ? SELF_SHADOW_RETURN : SELF_SHADOW_TEXEL);
      if (out !== shadowsOut) castShadows(!out);
    },
    updateView(camera) {
      if (cabin.length === 0) return;
      const p = model.position;
      const distance = Math.hypot(p.x - camera[0], p.y - camera[1], p.z - camera[2]);
      // A little hysteresis, so a camera at the edge does not flicker the cabin.
      const shown = distance < cabinRange * (cabinShown ? 1.1 : 1);
      if (shown !== cabinShown) {
        cabinShown = shown;
        for (const node of cabin) node.visible = shown;
      }
      if (!shown) return;
      eye.fromArray(spec.pilotEye).applyQuaternion(model.quaternion).add(p);
      const near = Math.hypot(eye.x - camera[0], eye.y - camera[1], eye.z - camera[2]);
      // The same hysteresis per part: drawn again within its reach, left out beyond a tenth more.
      for (let next = details[detailed]; next !== undefined && near < next.reach; ) {
        next.mesh.layers.mask = next.layers;
        next = details[++detailed];
      }
      for (let last = details[detailed - 1]; last !== undefined && near > last.reach * 1.1; ) {
        last.layers = last.mesh.layers.mask;
        last.mesh.layers.mask = 0;
        last = details[--detailed - 1];
      }
    },
    dispose() {
      damage.reset();
      propellers.dispose();
      appearance?.dispose();
      const geometries = new Set<THREE.BufferGeometry>(),
        materials = new Set<THREE.Material>();
      model.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          geometries.add(o.geometry);
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m);
        }
      });
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      model.removeFromParent();
    },
  };
}
export interface AircraftCameraPose extends VehicleCameraPose {
  rotation: [number, number, number, number];
}
export function aircraftCameraPose(
  transform: { pos: [number, number, number]; rot: [number, number, number, number] },
  spec: AircraftSpec,
  options: VehicleCameraOptions,
): AircraftCameraPose {
  const q = new THREE.Quaternion().fromArray(transform.rot);
  const origin = new THREE.Vector3().fromArray(transform.pos);
  const look = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(-(options.lookPitch ?? 0), -(options.lookYaw ?? 0), 0, 'YXZ'),
  );
  const direction = new THREE.Vector3(0, 0, 1).applyQuaternion(look).applyQuaternion(q);
  let position = new THREE.Vector3().fromArray(spec.pilotEye).applyQuaternion(q).add(origin);
  let target = position.clone().add(direction);
  let up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  if (options.view === 'chase') {
    target = origin.clone().add(new THREE.Vector3(0, 1.5, 0));
    position = target
      .clone()
      .addScaledVector(direction, -spec.length * 1.5)
      .add(new THREE.Vector3(0, 4.5, 0));
    const hit = options.obstructionDistance?.(target.toArray(), position.toArray());
    if (hit !== undefined && hit < target.distanceTo(position)) {
      const offset = position.clone().sub(target).normalize();
      position.copy(target).addScaledVector(offset, Math.max(0.3, hit - 0.3));
    }
    // World up keeps the horizon level in ordinary flight; toward the vertical of a loop it
    // stops defining a view, so the camera takes the airframe's own up instead.
    const vertical = THREE.MathUtils.smoothstep(Math.abs(direction.y), 0.7, 0.95);
    up = new THREE.Vector3(0, 1, 0).lerp(up, vertical).normalize();
  }
  const forward = target.clone().sub(position).normalize();
  const rotation = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().lookAt(position, target, up),
  );
  return {
    position: position.toArray(),
    lookAt: target.toArray(),
    rotation: rotation.toArray(),
    yaw: Math.atan2(forward.z, forward.x),
    pitch: Math.asin(forward.y),
  };
}
