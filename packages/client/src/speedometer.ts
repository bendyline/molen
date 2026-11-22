/**
 * A speedometer of the console kit: a round dial with numerals in the reader's units, a needle,
 * and the speed in digits under the hub, for a vehicle whose model has no readable dial of its
 * own. Road vehicles' dashboards carry abstract tick arcs without numerals, and a cycle, board,
 * pair of skis or boat has none at all, so every driven vehicle reads its speed from this one.
 *
 * `createSpeedometerView` builds it as an instrument view, the shape `createAircraftInstrumentViews`
 * crops out of a cockpit: a small scene of its own with an orthographic camera square-on to the
 * face, posed by `sync()` from the `speed` it is given. So it draws wherever an aircraft's dials
 * do: in a host canvas through `createAircraftInstrumentDisplay` (the Earth view's
 * `setInstrumentCanvas`), and as a gauge of the vehicle console (`createGaugePart`).
 * `speedometerScale` picks the face: a round full scale with room above the vehicle's top speed,
 * numbered in steps a real dial uses, no more than eight of them.
 *
 * Related: `aircraft-instruments.ts` (the views and their display), `console/deck.ts` (the
 * vehicle console's dial), `console/kit.ts` (the kit's other parts), and the Earth view's
 * `speedUnit` option.
 *
 * Gotchas: the face and readout are canvas textures, drawn with a 2D canvas where there is one
 * (a page or a worker); without one (Node) the face is plain and the readout absent, while the
 * needle still turns. Unlike a cropped dial the view owns its geometry, materials and textures:
 * `dispose()` releases them. Speeds are magnitudes: reversing reads forward.
 */
import * as THREE from 'three';
import type { AircraftInstrumentView } from './aircraft-instruments';

/** Units a speedometer reads in. */
export type SpeedometerUnit = 'km/h' | 'mph' | 'kt';

/** The unit's reading of one meter per second. */
const PER_METER_PER_SECOND: Record<SpeedometerUnit, number> = {
  'km/h': 3.6,
  mph: 2.2369362920544025,
  kt: 1.9438444924406046,
};

/** Numbered steps a dial counts in, smallest first. */
const STEPS = [2, 5, 10, 20, 30, 40, 50, 100] as const;
/** Most numbered intervals on a face: more crowd the numerals. */
const MAX_INTERVALS = 8;
/** Room above the top speed, as a real speedometer leaves. */
const HEADROOM = 1.15;
/** The needle's sweep, clockwise from zero at half past seven to full scale at half past four. */
export const SPEEDOMETER_SWEEP: number = (3 * Math.PI) / 2;

/** A face's numbering: full scale and the step between numerals, in the dial's units. */
export interface SpeedometerScale {
  full: number;
  step: number;
}

/**
 * The face for a vehicle whose top speed is `maxSpeed` m/s, read in `unit`: the smallest step
 * that numbers the whole range in eight intervals or fewer, and full scale the first multiple of
 * it at least 15% above the top speed.
 */
export function speedometerScale(maxSpeed: number, unit: SpeedometerUnit): SpeedometerScale {
  const top = Math.max(1, maxSpeed * PER_METER_PER_SECOND[unit] * HEADROOM);
  for (const step of STEPS) {
    const intervals = Math.ceil(top / step);
    if (intervals <= MAX_INTERVALS) return { full: intervals * step, step };
  }
  const step = 100 * Math.ceil(top / (100 * MAX_INTERVALS));
  return { full: Math.ceil(top / step) * step, step };
}

/** Where the needle points for `reading` on a face to `full`, radians clockwise from twelve. */
export function speedometerAngle(reading: number, full: number): number {
  const share = Math.min(1, Math.max(0, reading / full));
  return -SPEEDOMETER_SWEEP / 2 + SPEEDOMETER_SWEEP * share;
}

export interface SpeedometerOptions {
  /** The vehicle's top speed, m/s: the face numbers a little past it. */
  maxSpeed: number;
  unit: SpeedometerUnit;
  /** The current speed, m/s, read on each `sync`; reversing (negative) reads forward. */
  speed: () => number | undefined;
}

/** A speedometer view: an instrument view that owns its resources. */
export interface SpeedometerView extends AircraftInstrumentView {
  readonly scale: SpeedometerScale;
  /** Release its geometry, materials and textures. */
  dispose(): void;
}

const FACE = '#121619';
const BEZEL = '#2a3035';
const INK = '#e6eaee';
const SUBTLE = '#9aa4ad';
/** The kit's pointer color (console/kit.ts). */
const POINTER = '#ff9d2e';
const BACKGROUND = '#101719';
/** Face texture size, px: numerals stay sharp in a dial a few hundred pixels across. */
const FACE_PX = 512;
/** Readout texture size, px. */
const READOUT_PX: readonly [number, number] = [256, 96];
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

type Canvas2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

/** A 2D canvas where the platform has one: a page's, else a worker's offscreen one. */
function canvas2d(
  width: number,
  height: number,
): { canvas: HTMLCanvasElement | OffscreenCanvas; context: Canvas2D } | undefined {
  try {
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      return context ? { canvas, context } : undefined;
    }
    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(width, height);
      const context = canvas.getContext('2d');
      return context ? { canvas, context } : undefined;
    }
  } catch {
    // No 2D canvas here.
  }
  return undefined;
}

/** Paint the face: bezel, ticks, numerals and the unit, on a transparent square. */
function paintFace(context: Canvas2D, scale: SpeedometerScale, unit: SpeedometerUnit): void {
  const size = FACE_PX;
  const c = size / 2;
  const r = c - 2;
  context.clearRect(0, 0, size, size);
  context.fillStyle = BEZEL;
  context.beginPath();
  context.arc(c, c, r, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = FACE;
  context.beginPath();
  context.arc(c, c, r * 0.93, 0, Math.PI * 2);
  context.fill();
  const at = (angle: number, radius: number): [number, number] => [
    c + Math.sin(angle) * radius,
    c - Math.cos(angle) * radius,
  ];
  // Minor ticks halve the step (a step of five counts in ones).
  const minor = scale.step % 2 === 0 ? scale.step / 2 : scale.step / 5;
  const count = Math.round(scale.full / minor);
  context.lineCap = 'butt';
  for (let index = 0; index <= count; index++) {
    const reading = index * minor;
    const major = Math.abs(reading / scale.step - Math.round(reading / scale.step)) < 1e-6;
    const angle = speedometerAngle(reading, scale.full);
    const [x0, y0] = at(angle, r * (major ? 0.72 : 0.79));
    const [x1, y1] = at(angle, r * 0.88);
    context.strokeStyle = major ? INK : SUBTLE;
    context.lineWidth = size * (major ? 0.016 : 0.008);
    context.beginPath();
    context.moveTo(x0, y0);
    context.lineTo(x1, y1);
    context.stroke();
  }
  const digits = String(scale.full).length;
  context.fillStyle = INK;
  context.font = `600 ${Math.round(size * (digits >= 3 ? 0.075 : 0.095))}px ${FONT}`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  for (let reading = 0; reading <= scale.full + 1e-6; reading += scale.step) {
    const [x, y] = at(speedometerAngle(reading, scale.full), r * (digits >= 3 ? 0.56 : 0.58));
    context.fillText(String(Math.round(reading)), x, y);
  }
  context.fillStyle = SUBTLE;
  context.font = `500 ${Math.round(size * 0.07)}px ${FONT}`;
  context.fillText(unit, c, c - r * 0.3);
}

/** Paint the speed in digits. */
function paintReadout(context: Canvas2D, value: number): void {
  const [width, height] = READOUT_PX;
  context.clearRect(0, 0, width, height);
  context.fillStyle = INK;
  context.font = `700 ${Math.round(height * 0.78)}px ${FONT}`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(String(value), width / 2, height / 2 + height * 0.04);
}

/** A tapered needle along +Y from just behind the hub, its tip near the ticks. */
function needleGeometry(): THREE.ShapeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-0.032, -0.16);
  shape.lineTo(0.032, -0.16);
  shape.lineTo(0.01, 0.8);
  shape.lineTo(-0.01, 0.8);
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

/**
 * A speedometer for a vehicle that tops out at `maxSpeed`, read in `unit`, posed from `speed` by
 * `sync()`. Draw it as any instrument view; `dispose()` releases it.
 */
export function createSpeedometerView(options: SpeedometerOptions): SpeedometerView {
  const scale = speedometerScale(options.maxSpeed, options.unit);
  const perMeterPerSecond = PER_METER_PER_SECOND[options.unit];
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BACKGROUND);
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];
  const mesh = (
    geometry: THREE.BufferGeometry,
    material: THREE.MeshBasicMaterial,
    z: number,
  ): THREE.Mesh => {
    geometries.push(geometry);
    materials.push(material);
    const result = new THREE.Mesh(geometry, material);
    result.position.z = z;
    scene.add(result);
    return result;
  };

  // The face: painted where there is a 2D canvas, plain where not.
  const facePaint = canvas2d(FACE_PX, FACE_PX);
  let faceMap: THREE.Texture | undefined;
  if (facePaint) {
    paintFace(facePaint.context, scale, options.unit);
    const map = new THREE.CanvasTexture(facePaint.canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    textures.push(map);
    faceMap = map;
  }
  const face = mesh(
    new THREE.CircleGeometry(1, 96),
    faceMap
      ? new THREE.MeshBasicMaterial({ map: faceMap, transparent: true })
      : new THREE.MeshBasicMaterial({ color: FACE }),
    0,
  );
  face.name = 'speedometer-face';

  // The digits under the hub, repainted when the shown speed changes.
  const readoutPaint = canvas2d(READOUT_PX[0], READOUT_PX[1]);
  let readoutMap: THREE.Texture | undefined;
  if (readoutPaint) {
    const map = new THREE.CanvasTexture(readoutPaint.canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    textures.push(map);
    readoutMap = map;
    const readout = mesh(
      new THREE.PlaneGeometry(0.8, 0.8 * (READOUT_PX[1] / READOUT_PX[0])),
      new THREE.MeshBasicMaterial({ map, transparent: true }),
      0.01,
    );
    readout.name = 'speedometer-readout';
    readout.position.y = -0.64;
  }

  const needle = mesh(needleGeometry(), new THREE.MeshBasicMaterial({ color: POINTER }), 0.02);
  needle.name = 'speedometer-needle';
  const hub = mesh(
    new THREE.CircleGeometry(0.085, 32),
    new THREE.MeshBasicMaterial({ color: BEZEL }),
    0.03,
  );
  hub.name = 'speedometer-hub';

  const camera = new THREE.OrthographicCamera(-1.02, 1.02, 1.02, -1.02, 0.1, 10);
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();

  let shown: number | undefined;
  const sync = (): void => {
    const speed = options.speed();
    const reading = Number.isFinite(speed) ? Math.abs(speed as number) * perMeterPerSecond : 0;
    needle.rotation.z = -speedometerAngle(reading, scale.full);
    const value = Math.round(reading);
    if (readoutPaint && readoutMap && value !== shown) {
      shown = value;
      paintReadout(readoutPaint.context, value);
      readoutMap.needsUpdate = true;
    }
  };
  sync();
  let disposed = false;
  return {
    kind: 'speed',
    node: 'speedometer',
    unit: options.unit,
    scale,
    scene,
    camera,
    sync,
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      for (const texture of textures) texture.dispose();
    },
  };
}
