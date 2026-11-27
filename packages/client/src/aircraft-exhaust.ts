import type {
  AircraftEngineSpec,
  AircraftEngineStateData,
  AircraftExhaustSpec,
  AircraftSpec,
  AircraftStateData,
} from '@bendyline/molen-schema';
import * as THREE from 'three';

/**
 * Share of its travel a variable jet nozzle stands open at idle and with the engine stopped.
 * Afterburning turbofans open the nozzle at idle to cut idle thrust, close it toward its minimum
 * area as the throttle comes up to military power, and open it again as reheat is added (on the
 * F404 the area follows the throttle below military power and the turbine temperature above it).
 * Pilots quoting the F-16 flight manual put the idle opening near 80%; it varies by engine.
 */
export const IDLE_NOZZLE_OPENING = 0.8;
/** Where across the climb from idle to military rpm the nozzle starts and finishes closing. */
const NOZZLE_CLOSE_START = 0.1;
const NOZZLE_CLOSE_END = 0.75;
/** Time constant of the nozzle actuators, seconds (a full stroke takes about a second). */
export const NOZZLE_RESPONSE = 0.35;

const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/**
 * How far a variable nozzle stands open, 0 closed to its minimum area (military power) to 1 open to
 * its maximum (full reheat): open at idle and stopped, closing as the engine winds up to military
 * rpm, opening with the lit reheat fraction. Only afterburning engines have one; undefined otherwise.
 * The schedule is the generic one described at IDLE_NOZZLE_OPENING, not any engine's control law.
 */
export function jetNozzleOpening(
  engine: AircraftEngineSpec,
  reading: AircraftEngineStateData | undefined,
): number | undefined {
  if (engine.propulsion !== 'jet' || engine.afterburnerThrust === undefined) return undefined;
  const detent = engine.afterburnerDetent ?? 0.85;
  // Jet rpm runs from idle to full across the lever, so military power is reached at the detent.
  const span = (1 - engine.idleRpm) * detent;
  const climb = span > 0 ? ((reading?.rpm ?? 0) - engine.idleRpm) / span : 1;
  const dry = IDLE_NOZZLE_OPENING * (1 - smoothstep(NOZZLE_CLOSE_START, NOZZLE_CLOSE_END, climb));
  return Math.max(dry, Math.max(0, Math.min(1, reading?.afterburner ?? 0)));
}

/** The flame drawn behind one nozzle this frame; exported so tests can check the physics. */
export interface JetPlumeShape {
  /** Nozzle exit radius, m. */
  exitRadius: number;
  /** Lit reheat fraction, 0..1. */
  reheat: number;
  /** Visible flame length behind the exit, m (0 with no flame). */
  length: number;
  /** Shock-cell spacing, m: the distance between diamonds; 0 for a subsonic jet. */
  cell: number;
  /** Fully expanded jet Mach number. */
  jetMach: number;
  /** Dull glow of the hot tailpipe with the afterburner out, 0..1 (seen at night, from behind). */
  tailpipe: number;
}

/**
 * Nozzle pressure ratio of the jet: about 3 at military power on the ground (typical of fighter
 * turbofans), a little more in reheat, and raised by the ram pressure of flight, since the engine
 * multiplies the inlet's total pressure while the jet expands to the static pressure outside.
 */
function nozzlePressureRatio(dry: number, reheat: number, mach: number): number {
  const ram = (1 + 0.2 * Math.min(2.5, Math.max(0, mach)) ** 2) ** 3.5;
  return (1 + 2.2 * dry + 0.4 * reheat) * ram;
}

/**
 * The flame for an exhaust: exit size from the nozzle opening; shock-cell spacing from the
 * Prandtl–Pack estimate for a nearly ideally expanded round jet, L = 1.306·D·√(Mj² − 1), with the
 * fully expanded Mach number Mj from the nozzle pressure ratio (γ 1.3, hot gas). The visible
 * afterburner flame runs from about 2 exit diameters at minimum reheat to about 5.5 at full
 * (photographs of fighters at night show four to six diamonds), longer and wider in thin air.
 */
export function jetPlumeShape(
  exhaust: AircraftExhaustSpec,
  engine: AircraftEngineSpec,
  reading: AircraftEngineStateData | undefined,
  nozzle: number | undefined,
  mach: number,
  densityRatio: number,
): JetPlumeShape {
  const open = Math.max(0, Math.min(1, nozzle ?? 1));
  const exitRadius =
    exhaust.closedRadius === undefined
      ? exhaust.radius
      : exhaust.closedRadius + (exhaust.radius - exhaust.closedRadius) * open;
  const running =
    reading !== undefined && !reading.failed && (reading.combustion ?? 1) > 0 && reading.rpm > 0;
  const reheat = running ? Math.max(0, Math.min(1, reading.afterburner ?? 0)) : 0;
  const detent = engine.afterburnerDetent ?? 0.85;
  const span = (1 - engine.idleRpm) * (engine.afterburnerThrust === undefined ? 1 : detent);
  const dry = running ? Math.max(0, Math.min(1, (reading.rpm - engine.idleRpm) / span)) : 0;
  const ratio = nozzlePressureRatio(dry, reheat, mach);
  const gamma = 1.3;
  const jetMach = Math.sqrt(Math.max(0, (2 / (gamma - 1)) * (ratio ** ((gamma - 1) / gamma) - 1)));
  const diameter = 2 * exitRadius;
  const cell = jetMach > 1.02 ? 1.306 * diameter * Math.sqrt(jetMach * jetMach - 1) : 0;
  const thin = 1 - Math.max(0, Math.min(1, densityRatio));
  const length = reheat > 0.002 ? diameter * (2 + 3.5 * reheat) * (1 + 0.8 * thin) : 0;
  return { exitRadius, reheat, length, cell, jetMach, tailpipe: running ? dry ** 4 : 0 };
}

/** Diamonds drawn per flame at most. */
const MAX_DIAMONDS = 6;
/** Rings along each flame strip, and vertices across it (edge, shoulder, center, shoulder, edge). */
const RINGS = 24;
const ACROSS = [-1, -0.5, 0, 0.5, 1] as const;
const ACROSS_WEIGHT = [0, 0.55, 1, 0.55, 0] as const;
const GLOW_RIM = 12;
/** Points round each diamond's soft oval: an inner ring at DIAMOND_INNER of it, then the rim. */
const DIAMOND_RIM = 12;
const DIAMOND_INNER = 0.5;
const DIAMOND_VERTICES = 1 + 2 * DIAMOND_RIM;
const STRIP_VERTICES = (RINGS + 1) * ACROSS.length;
/** Core strip, envelope strip, diamonds (center + rim each), tailpipe glow disc. */
const VERTICES_PER_EXHAUST = 2 * STRIP_VERTICES + MAX_DIAMONDS * DIAMOND_VERTICES + 1 + GLOW_RIM;
/**
 * WebGL tone maps each overlapping layer of the flame on its own and adds the results on screen,
 * WebGPU adds them in linear light and tone maps the sum once, so the same flame came out dimmer
 * on WebGPU: mean red 142 against 156 at night and 178 against 208 by day, F-15C at 30% reheat
 * under ACES. Raised by this much there, night matches (155 against 156); by day, where the sky
 * behind is bright, WebGPU stays a little softer (185 against 208).
 */
const WEBGPU_FLAME_GAIN = 1.35;
/** Beyond this distance the flame fades out (m); a few kilometers, where it is a few pixels. */
const FADE_START = 3000;
const FADE_END = 9000;

/**
 * Colors in linear light, scaled above 1 where the flame is brighter than a lit surface. Little
 * reheat burns lean and shows the pale blue-violet of a clean flame; more turns the core pale
 * yellow inside a blue fringe, and full reheat is orange-yellow with soot. The shock diamonds are
 * the hottest, near white. Each runs low → pale → full, never through a blue-orange pink.
 */
const CORE_LOW = new THREE.Color(0.32, 0.42, 1).multiplyScalar(0.85);
const CORE_PALE = new THREE.Color(1, 0.8, 0.58).multiplyScalar(0.95);
const CORE_FULL = new THREE.Color(1, 0.52, 0.18).multiplyScalar(1.05);
const ENVELOPE_LOW = new THREE.Color(0.25, 0.32, 0.9).multiplyScalar(0.28);
const ENVELOPE_PALE = new THREE.Color(0.7, 0.55, 0.6).multiplyScalar(0.3);
const ENVELOPE_FULL = new THREE.Color(1, 0.4, 0.14).multiplyScalar(0.4);
const DIAMOND_LOW = new THREE.Color(0.72, 0.8, 1).multiplyScalar(0.8);
const DIAMOND_PALE = new THREE.Color(1, 0.9, 0.75).multiplyScalar(0.8);
const DIAMOND_FULL = new THREE.Color(1, 0.84, 0.58).multiplyScalar(0.85);
/** Three-stop blend: low at 0, pale at 0.5, full at 1. */
function flameColor(
  out: THREE.Color,
  low: THREE.Color,
  pale: THREE.Color,
  full: THREE.Color,
  f: number,
): THREE.Color {
  return f < 0.5 ? out.copy(low).lerp(pale, 2 * f) : out.copy(pale).lerp(full, 2 * f - 1);
}
/** Hot turbine and liner at high dry power: a dull red seen only against the dark. */
const TAILPIPE = new THREE.Color(1, 0.3, 0.07).multiplyScalar(0.03);

export interface AircraftExhaustVisual {
  /** The flame mesh (one draw for every nozzle), a child of the model; hidden while unlit. */
  readonly object: THREE.Mesh;
  /**
   * Pose the flames. `nozzles` holds each engine's nozzle opening (`jetNozzleOpening`), `camera`
   * the viewer in model coordinates (the strips turn about their axes to face it); without one,
   * or with one at infinity, the camera that last drew the flame. `time` seconds, for the flicker.
   */
  update(
    state: AircraftStateData,
    nozzles: Readonly<Record<string, number | undefined>>,
    camera: THREE.Vector3 | undefined,
    densityRatio: number,
    time: number,
  ): void;
}

/**
 * The afterburner flame and tailpipe glow of every exhaust in `spec.visual.exhausts`, drawn as
 * unlit vertex-colored strips that turn about the jet axis to face the camera, lens-shaped shock
 * diamonds, and a disc of glow at the exit seen most from behind. One mesh and one standard
 * material serve both renderers; color adds to what is behind and alpha takes some of it away, so
 * the flame stays orange against a bright sky and glows at night. It casts no shadow and is never
 * hit by a ray. Returns undefined when the spec declares no exhausts.
 */
export function createAircraftExhaust(
  model: THREE.Object3D,
  spec: AircraftSpec,
): AircraftExhaustVisual | undefined {
  const bank = spec.engines ?? (spec.engine ? [{ ...spec.engine, id: 'main' }] : []);
  const exhausts = (spec.visual.exhausts ?? []).flatMap((exhaust) => {
    const engine = bank.find((candidate) => candidate.id === exhaust.engine);
    if (engine === undefined || engine.propulsion !== 'jet') return [];
    const axis = engine.thrustAxis;
    const direction = new THREE.Vector3(
      ...(exhaust.direction ?? ([-axis[0], -axis[1], -axis[2]] as [number, number, number])),
    );
    if (direction.lengthSq() < 1e-12) return [];
    direction.normalize();
    // The exit's own width axis: model left, square to the jet.
    const across = new THREE.Vector3(1, 0, 0).addScaledVector(direction, -direction.x);
    if (across.lengthSq() < 1e-6) across.set(0, 1, 0).addScaledVector(direction, -direction.y);
    across.normalize();
    const upward = new THREE.Vector3().crossVectors(direction, across).normalize();
    return [
      {
        exhaust,
        engine,
        origin: new THREE.Vector3(...exhaust.position),
        direction,
        across,
        upward,
        aspect: exhaust.aspect ?? 1,
        phase: (exhaust.position[0] * 7.31 + exhaust.position[2] * 3.17) % (2 * Math.PI),
      },
    ];
  });
  if (exhausts.length === 0) return undefined;
  const count = exhausts.length * VERTICES_PER_EXHAUST;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 4);
  const indices: number[] = [];
  for (let e = 0; e < exhausts.length; e++) {
    const base = e * VERTICES_PER_EXHAUST;
    for (let strip = 0; strip < 2; strip++) {
      const start = base + strip * STRIP_VERTICES;
      for (let ring = 0; ring < RINGS; ring++)
        for (let k = 0; k < ACROSS.length - 1; k++) {
          const a = start + ring * ACROSS.length + k;
          const b = a + ACROSS.length;
          indices.push(a, b, a + 1, a + 1, b, b + 1);
        }
    }
    const diamonds = base + 2 * STRIP_VERTICES;
    for (let d = 0; d < MAX_DIAMONDS; d++) {
      const c = diamonds + d * DIAMOND_VERTICES;
      for (let k = 0; k < DIAMOND_RIM; k++) {
        const next = (k + 1) % DIAMOND_RIM;
        const inner = c + 1;
        const outer = c + 1 + DIAMOND_RIM;
        indices.push(c, inner + k, inner + next);
        indices.push(inner + k, outer + k, outer + next, inner + k, outer + next, inner + next);
      }
    }
    const glow = diamonds + MAX_DIAMONDS * DIAMOND_VERTICES;
    for (let k = 0; k < GLOW_RIM; k++)
      indices.push(glow, glow + 1 + k, glow + 1 + ((k + 1) % GLOW_RIM));
  }
  const geometry = new THREE.BufferGeometry();
  const position = new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage);
  const color = new THREE.BufferAttribute(colors, 4).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', position);
  geometry.setAttribute('color', color);
  geometry.setIndex(indices);
  // Fixed bounds round the longest flame every nozzle could draw, so culling never recomputes.
  const reach = Math.max(...exhausts.map(({ exhaust }) => exhaust.radius)) * 2 * 7.5 * 1.8;
  const center = new THREE.Vector3();
  for (const { origin, direction } of exhausts)
    center.add(origin.clone().addScaledVector(direction, reach / 2));
  center.divideScalar(exhausts.length);
  let radius = 0;
  for (const { origin } of exhausts) radius = Math.max(radius, origin.distanceTo(center));
  geometry.boundingSphere = new THREE.Sphere(center, radius + reach / 2 + 2);
  const material = new THREE.MeshBasicMaterial({
    name: 'aircraft-exhaust-flame',
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
    // Emission adds to the scene; alpha is what the flame hides of it (premultiplied).
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'aircraft-exhaust-flames';
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = true;
  mesh.renderOrder = 1;
  mesh.visible = false;
  mesh.userData.walkIgnore = true;
  mesh.userData.vehicleGeometry = true;
  mesh.userData.shadowCaster = false;
  mesh.raycast = () => {};
  // Which renderer drew the flame last, and from where: the emission and, when the host gives
  // no camera of its own, the strips' facing follow from the next update.
  let gain = 1;
  let drawnFrom: THREE.Vector3 | undefined;
  mesh.onBeforeRender = (renderer, _scene, camera) => {
    gain = (renderer as { isWebGPURenderer?: boolean }).isWebGPURenderer ? WEBGPU_FLAME_GAIN : 1;
    drawnFrom = (drawnFrom ?? new THREE.Vector3()).setFromMatrixPosition(camera.matrixWorld);
  };
  const lastViewer = new THREE.Vector3();
  model.add(mesh);

  const toCamera = new THREE.Vector3();
  const width = new THREE.Vector3();
  const facing = new THREE.Vector3();
  const point = new THREE.Vector3();
  const tint = new THREE.Color();
  const scratch = new THREE.Color();
  const discU = new THREE.Vector3();
  const discV = new THREE.Vector3();
  const setVertex = (index: number, p: THREE.Vector3, c: THREE.Color, alpha: number): void => {
    positions[index * 3] = p.x;
    positions[index * 3 + 1] = p.y;
    positions[index * 3 + 2] = p.z;
    colors[index * 4] = c.r;
    colors[index * 4 + 1] = c.g;
    colors[index * 4 + 2] = c.b;
    colors[index * 4 + 3] = alpha;
  };
  const clearRange = (from: number, to: number): void => {
    colors.fill(0, from * 4, to * 4);
    positions.fill(0, from * 3, to * 3);
  };
  return {
    object: mesh,
    update(state, nozzles, given, densityRatio, time) {
      let lit = false;
      // A host parks a far camera at infinity to leave a model's cockpit out (an apron, a passing
      // aircraft); the flame then faces the camera that last drew it.
      let camera = given && Number.isFinite(given.x + given.y + given.z) ? given : undefined;
      if (camera === undefined && drawnFrom !== undefined) {
        model.updateWorldMatrix(true, false);
        camera = model.worldToLocal(lastViewer.copy(drawnFrom));
      }
      for (const [e, plume] of exhausts.entries()) {
        const base = e * VERTICES_PER_EXHAUST;
        const reading = state.engines?.[plume.engine.id];
        const shape = jetPlumeShape(
          plume.exhaust,
          plume.engine,
          reading,
          nozzles[plume.engine.id],
          state.mach ?? 0,
          densityRatio,
        );
        const { origin, direction } = plume;
        // The viewer, from the middle of the flame; a camera on the axis gets a stable fallback.
        const mid = shape.length / 2;
        if (camera) toCamera.copy(camera).sub(point.copy(origin).addScaledVector(direction, mid));
        else toCamera.copy(plume.across).multiplyScalar(30).addScaledVector(plume.upward, 10);
        const distance = toCamera.length();
        const fade = Number.isFinite(distance) ? 1 - smoothstep(FADE_START, FADE_END, distance) : 0;
        width.crossVectors(direction, toCamera);
        if (width.lengthSq() < 1e-8 * Math.max(1, distance * distance)) width.copy(plume.across);
        width.normalize();
        // A rectangular exit looks wider or narrower as the view turns about the jet.
        const wide = Math.sqrt(plume.aspect);
        const apparent = (t: number): number => {
          const a = 1 + (wide - 1) * (1 - t);
          const b = 1 + (1 / wide - 1) * (1 - t);
          return Math.hypot(a * width.dot(plume.across), b * width.dot(plume.upward));
        };
        // How far the view looks up the tailpipe: 1 straight from behind.
        const behind = Math.max(0, toCamera.dot(direction) / Math.max(1e-6, distance));
        const flicker =
          1 +
          0.07 * Math.sin(2 * Math.PI * 17 * time + plume.phase) +
          0.04 * Math.sin(2 * Math.PI * 29 * time + 2 * plume.phase);
        const stretch = 1 + 0.05 * Math.sin(2 * Math.PI * 11 * time + 3 * plume.phase);
        const reheat = shape.reheat * fade;
        // Even minimum reheat is a clear flame at night; brightness rises slower than the fraction.
        const intensity = reheat ** 0.6 * gain;
        const glowStrength = shape.tailpipe * fade;
        if (reheat <= 0.002 && glowStrength <= 0.01) {
          clearRange(base, base + VERTICES_PER_EXHAUST);
          continue;
        }
        lit = true;
        // The core turns from blue to yellow early; its fringe stays blue until more is added.
        const full = smoothstep(0.05, 0.75, shape.reheat);
        const fringe = smoothstep(0.35, 1, shape.reheat);
        const length = shape.length * stretch;
        const r0 = shape.exitRadius;
        const spread = 0.25 + 0.6 * (1 - Math.max(0, Math.min(1, densityRatio)));
        // Core: the bright cone tapering to its tip; envelope: the faint wider flame round it.
        for (let strip = 0; strip < 2; strip++) {
          const core = strip === 0;
          const start = base + strip * STRIP_VERTICES;
          const stripLength = core ? length * 0.85 : length;
          for (let ring = 0; ring <= RINGS; ring++) {
            const t = ring / RINGS;
            const along = stripLength * t;
            // The core keeps nearly the exit's width, then necks to its tip; the envelope spreads.
            const half =
              (core ? r0 * (1.05 - 0.6 * t ** 1.4) : r0 * (1.3 + spread * t * 2.2)) *
              apparent(Math.min(1, along / Math.max(1e-6, 4 * r0)));
            const fall = core ? (1 - t) ** 0.9 : (1 - t) ** 1.4;
            (core
              ? flameColor(tint, CORE_LOW, CORE_PALE, CORE_FULL, full)
              : flameColor(tint, ENVELOPE_LOW, ENVELOPE_PALE, ENVELOPE_FULL, fringe)
            ).multiplyScalar(intensity * flicker * fall);
            const alpha = (core ? 0.5 * full : 0.1) * reheat * fall;
            point.copy(origin).addScaledVector(direction, along);
            for (let k = 0; k < ACROSS.length; k++) {
              const w = ACROSS_WEIGHT[k] ?? 0;
              facing.copy(point).addScaledVector(width, (ACROSS[k] ?? 0) * half);
              setVertex(
                start + ring * ACROSS.length + k,
                facing,
                scratch.copy(tint).multiplyScalar(w),
                alpha * w,
              );
            }
          }
        }
        // Shock diamonds: soft ovals on the axis, a cell apart, fading downstream.
        const diamonds = base + 2 * STRIP_VERTICES;
        for (let d = 0; d < MAX_DIAMONDS; d++) {
          const c = diamonds + d * DIAMOND_VERTICES;
          // Inside the core, which is 0.85 of the flame, and short of its tip.
          const at = (d + 0.55) * shape.cell;
          if (shape.cell <= 0 || at > length * 0.72 || reheat <= 0.05) {
            clearRange(c, c + DIAMOND_VERTICES);
            continue;
          }
          const t = at / Math.max(1e-6, length);
          // Faint at minimum reheat, bright knots at full.
          const strength = reheat ** 1.1 * 0.88 ** d * (1 - 0.7 * t) * flicker * gain;
          const halfLength = Math.min(0.38 * shape.cell, 1.1 * r0);
          const halfWidth = r0 * 0.6 * (1 - 0.4 * t) * apparent(1);
          flameColor(tint, DIAMOND_LOW, DIAMOND_PALE, DIAMOND_FULL, full).multiplyScalar(strength);
          point.copy(origin).addScaledVector(direction, at);
          setVertex(c, point, tint, 0.3 * strength * full);
          // A rounded falloff: 0.45 of the peak halfway out, nothing at the rim.
          for (const [ring, reach, share] of [
            [0, DIAMOND_INNER, 0.45],
            [1, 1, 0],
          ] as const)
            for (let k = 0; k < DIAMOND_RIM; k++) {
              const angle = (k * 2 * Math.PI) / DIAMOND_RIM;
              facing
                .copy(point)
                .addScaledVector(direction, Math.cos(angle) * halfLength * reach)
                .addScaledVector(width, Math.sin(angle) * halfWidth * reach);
              setVertex(
                c + 1 + ring * DIAMOND_RIM + k,
                facing,
                scratch.copy(tint).multiplyScalar(share),
                0.3 * strength * full * share,
              );
            }
        }
        // The glow at the exit faces the viewer; it is the lit tailpipe seen from behind.
        const glow = diamonds + MAX_DIAMONDS * DIAMOND_VERTICES;
        discU.crossVectors(toCamera, direction);
        if (discU.lengthSq() < 1e-8) discU.copy(plume.across);
        discU.normalize();
        discV.crossVectors(toCamera, discU).normalize();
        const seen = 0.15 + 0.85 * smoothstep(0.1, 0.8, behind);
        flameColor(tint, CORE_LOW, DIAMOND_PALE, DIAMOND_FULL, full)
          .multiplyScalar(intensity * flicker * 1.1)
          .add(scratch.copy(TAILPIPE).multiplyScalar(glowStrength * smoothstep(0.3, 0.9, behind)))
          .multiplyScalar(seen);
        point.copy(origin).addScaledVector(direction, r0 * 0.05);
        // The dry glow only adds light: by day it must not darken or tint the tailpipe.
        setVertex(glow, point, tint, Math.min(0.6, 0.45 * reheat * full) * seen);
        const rim = r0 * (0.92 + 0.12 * reheat);
        for (let k = 0; k < GLOW_RIM; k++) {
          const angle = (k * 2 * Math.PI) / GLOW_RIM;
          facing
            .copy(point)
            .addScaledVector(discU, Math.cos(angle) * rim)
            .addScaledVector(discV, Math.sin(angle) * rim);
          setVertex(glow + 1 + k, facing, scratch.setRGB(0, 0, 0), 0);
        }
      }
      mesh.visible = lit;
      if (lit) {
        position.needsUpdate = true;
        color.needsUpdate = true;
      }
    },
  };
}
