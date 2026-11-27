/**
 * Screens in a vehicle's loaded model, found from its geometry, and a live surface laid over one
 * for a host to paint (the Earth view's moving map): a car's centre screen, an aircraft's map
 * display.
 *
 * The generators draw a screen as a box (or sheet) of a display material, merged into one mesh
 * with the cabin's other screens, and print still symbology on it. The finders read the cabin's
 * triangles, gather the flat rectangles of display materials facing the seat, and choose one:
 * - `findVehicleCenterDisplay`: a road dashboard's centre screen (`display-glass`, or the shared
 *   panel kit's `instrument-display`), square to the vehicle's long axis, on its centre line, at
 *   least 15 by 8 cm. A radio's strip is 5 cm tall and a driver's cluster sits off the centre
 *   line, so a car with only a radio or only a cluster has none, as it should: the medium-fi
 *   guide gives no generic centre screen to a car without one.
 * - `findCockpitMapDisplay`: the map display of a cockpit. A helicopter's glass NAV page has a map
 *   area of its own (`avionics-terrain`) and is taken first. Otherwise the screens within the
 *   pilot's reach are measured against the cockpit's live parts (the nodes its bindings move):
 *   any part bound in front of a screen is cut out of it, and what is left must be a rectangle
 *   of at least half the screen. A primary flight display's horizon fills its middle, so it is
 *   never chosen; a G1000 MFD keeps its map pane beside the live engine strip. Parts bound to
 *   heading alone do not count: the map shows heading itself. The nearest of the largest wins.
 *
 * `createVehicleScreen` sets a thin slab on the face: its front a canvas texture, its edges dark
 * like a bezel. It stands as far proud of the glass as the printed symbology does (measured from
 * the geometry in front of the face, bezels aside: 4 to 14 mm in cars and most cockpits, up to
 * 30 in a transport's), so it covers it; it is a child of the screen's own parent, so it moves
 * and hides with the cabin; `dispose()` takes it off again.
 *
 * Related: `vehicles.ts` (`createVehicleVisual`) and `aircraft.ts` (`createAircraftVisual`),
 * whose `object` is the model these read; the entities package's `panelTools().display` and
 * aircraft `glassDisplay` (the screens' geometry); the Earth view's `EarthMovingMap`.
 *
 * Gotchas: model-frame +Z is the vehicle's front and +X its left, so a dashboard faces -Z and the
 * canvas's x runs to the reader's right, model -X. The slab is unlit (`MeshBasicMaterial`, not
 * tone mapped), like a backlit panel, and casts no shadow. Without a 2D canvas (Node)
 * `createVehicleScreen` returns undefined. Finding a face reads every triangle of the cabin once
 * (milliseconds); call it when a vehicle is boarded, not per frame.
 */
import * as THREE from 'three';

/** A screen's face in the model's frame (`createVehicleVisual`'s or `createAircraftVisual`'s `object`). */
export interface VehicleDisplay {
  /** Middle of the face, on the glass, meters. */
  center: [number, number, number];
  /** Unit vector out of the face toward its reader. */
  normal: [number, number, number];
  /** Unit vector up the face, square to `normal`. */
  up: [number, number, number];
  /** Width (across `up`) and height (along it), meters. */
  width: number;
  height: number;
  /** How far the printed symbology stands in front of the glass, meters: the slab's depth. */
  relief: number;
  /** The node the screen's mesh hangs from: the slab goes beside it. */
  parent: THREE.Object3D;
}

export interface VehicleCenterDisplayOptions {
  /**
   * The seat the screen is read from, in the model's frame (a vehicle spec's `driverEye`): the
   * face on its side of the screen is the one found. Default: a seat behind it, toward -Z.
   */
  eye?: readonly number[];
}

export interface CockpitMapDisplayOptions {
  /** The pilot's eye in the model's frame (an aircraft spec's `pilotEye`). */
  eye: readonly number[];
  /**
   * The cockpit's live parts: its interior's bindings (`node`, `source`, `property`, `axis`). A
   * screen they move parts in front of is cut down to what they leave clear.
   */
  bindings?: readonly { node: string; source: string; property?: string; axis?: string }[];
  /** @internal Told about each screen considered and what became of it (fleet audits). */
  explain?: (screen: {
    material: string;
    parent: string;
    width: number;
    height: number;
    center: number[];
    left?: [number, number];
    verdict: string;
    blockers: string[];
  }) => void;
}

/** Materials road generators draw screens in. */
const CAR_DISPLAY = /(^|-)(display-glass|instrument-display)$/;
/**
 * Materials cockpit generators draw screens in (glass, liquid crystal, a G1000's black sheet,
 * the green of a transport's displays), never their printed lettering.
 */
const COCKPIT_DISPLAY =
  /(^|-)(display-glass|instrument-display|avionics-terrain|screen|display|display-green|green-display|instrument-black)$/;
/** A helicopter glass NAV page's own map area. */
const MAP_AREA = /(^|-)avionics-terrain$/;
/**
 * A black sheet is a screen only in a glass cockpit (a G1000's MFD); in a cockpit of round gauges
 * it is panel backing or an instrument's insert. A cockpit is glass where a node is named for a
 * display (`Skyhawk-PFD-horizon`, `FA18-DDI-speed`) or a material is an airframe's own display.
 */
const BLACK_SHEET = /(^|-)instrument-black$/;
const GLASS_NODE = /(^|-)(pfd|mfd|ddi|mpcd|mfcd|mhdd|nd|eicas|ecam|hld|du)(-|_|\d|$)/i;
const GLASS_MATERIAL = /^(?!instrument-).*-(display|screen|display-green|green-display)$/;
/** Sources a part may follow and still be covered: the map shows heading itself. */
const HEADING_SOURCE = /heading|^yaw$/i;
/** A part shown only while its system is available (an ND's rose) is not a reading. */
const AVAILABILITY_SOURCE = /\.available$/;
/**
 * The cockpit-controls generator's levers and grips (`flight-power-engine-2-moving-…`): they move
 * with the pilot's input, outside the interior's bindings, and an MV-22's sat over a screen.
 */
const MOVING_CONTROL = /(^|-)moving(-|$)/;

/** Smallest centre screen, meters: a radio's strip (5 cm tall) is not one. */
const CAR_MIN_WIDTH = 0.15;
const CAR_MIN_HEIGHT = 0.08;
/** Farthest a centre screen's middle may lie from the centre line, meters. */
const CENTRE_LINE = 0.06;
/** A centre screen is within this of square to the long axis (cosine of its normal with Z). */
const SQUARE = 0.95;
/**
 * Smallest cockpit map area, meters (a glass NAV page's own), and smallest and largest other
 * screen: under 10 by 8 cm is an instrument's face or a radio's; the largest is the F-35's
 * 20-inch panoramic display, and anything wider a whole panel.
 */
const MAP_MIN_WIDTH = 0.06;
const MAP_MIN_HEIGHT = 0.045;
const SCREEN_MIN_WIDTH = 0.1;
const SCREEN_MIN_HEIGHT = 0.08;
const SCREEN_MOST = 0.6;
/** Farthest from the pilot's eye, and least ahead of it (meters): not the seat behind. */
const MAP_REACH = 1.4;
const MAP_AHEAD = 0.25;
/**
 * Screens more than this below the eye (meters) are on a pedestal or console, taken only where
 * the panel has none: a Skyhawk's radio stack beat its MFD, a 737's lower display its NDs.
 */
const PANEL_DROP = 0.62;
/** A cockpit screen faces the eye at least this squarely (cosine). */
const MAP_FACING = 0.4;
/**
 * What is left of a screen once live parts are cut out must be this share of it at least; of a
 * panoramic display (PANORAMIC wide or more), a portal's share.
 */
const MAP_LEFT = 0.5;
const PANORAMIC = 0.45;
const PORTAL_LEFT = 0.25;
/** Triangles closer than this to one plane (meters), turned alike, lie in one face. */
const PLANE = 0.0005;
const ALIGNED = 0.9995;
/** Two faces this close (meters) over the same rectangle are one box's front and back. */
const BOX_DEPTH = 0.02;
/**
 * Live parts this far in front of a screen (meters) stand on it, and this far behind show through
 * it: the F-35's horizon is seen through apertures in its panoramic display.
 */
const PART_REACH = 0.04;
const PART_BEHIND = 0.05;
/**
 * Default relief when nothing stands in front of the glass, and the most allowed, meters: an
 * F-35's display lettering stands 24 mm proud, a Twin Otter's exactly 15.
 */
const MIN_RELIEF = 0.0015;
const MAX_RELIEF = 0.03;
/** Clearance in front of the frontmost stroke, meters. */
const RELIEF_CLEARANCE = 0.0008;

/** A flat rectangle of one material, in its own plane's coordinates. */
interface Face {
  material: string;
  mesh: THREE.Mesh;
  /** Out of the face toward the reader; across it (the reader's right) and up it. */
  normal: THREE.Vector3;
  across: THREE.Vector3;
  up: THREE.Vector3;
  /** The plane's offset along `normal`. */
  offset: number;
  /** Bounds in (across, up) coordinates. */
  box: THREE.Box2;
  area: number;
}

/** Each triangle of `mesh` (in groups whose material passes `include`) in the model's frame. */
function forEachTriangle(
  mesh: THREE.Mesh,
  toModel: THREE.Matrix4,
  include: (material: THREE.Material) => boolean,
  visit: (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, material: THREE.Material) => void,
): void {
  const geometry = mesh.geometry;
  const position = geometry.getAttribute('position');
  if (position === undefined) return;
  const index = geometry.getIndex();
  const count = index ? index.count : position.count;
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const ranges: [number, number, THREE.Material][] = [];
  if (Array.isArray(mesh.material) && geometry.groups.length > 0) {
    for (const group of geometry.groups) {
      const material = materials[group.materialIndex ?? 0];
      if (material !== undefined && include(material))
        ranges.push([group.start, Math.min(count, group.start + group.count), material]);
    }
  } else if (materials[0] !== undefined && include(materials[0]))
    ranges.push([0, count, materials[0]]);
  if (ranges.length === 0) return;
  const matrix = new THREE.Matrix4().multiplyMatrices(toModel, mesh.matrixWorld);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const vertex = (target: THREE.Vector3, i: number): THREE.Vector3 =>
    target.fromBufferAttribute(position, index ? index.getX(i) : i).applyMatrix4(matrix);
  for (const [start, end, material] of ranges) {
    for (let i = start; i + 2 < end; i += 3)
      visit(vertex(a, i), vertex(b, i + 1), vertex(c, i + 2), material);
  }
}

/**
 * The flat rectangles of `include`d materials in `model` that `accept` takes, each turned toward
 * `eye` (toward -Z without one). Only whole rectangles: an L of two screens is not one face.
 */
function collectFaces(
  model: THREE.Object3D,
  toModel: THREE.Matrix4,
  include: (material: THREE.Material) => boolean,
  eye: THREE.Vector3 | undefined,
  accept: (normal: THREE.Vector3, middle: THREE.Vector3) => boolean,
): Face[] {
  const faces: Face[] = [];
  const edge1 = new THREE.Vector3();
  const edge2 = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const middle = new THREE.Vector3();
  const corner = new THREE.Vector2();
  model.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || object.userData.vehicleScreen === true) return;
    forEachTriangle(mesh, toModel, include, (a, b, c, material) => {
      normal.crossVectors(edge1.subVectors(b, a), edge2.subVectors(c, a));
      const doubled = normal.length();
      if (doubled < 1e-9) return;
      normal.divideScalar(doubled);
      middle.copy(a).add(b).add(c).divideScalar(3);
      // Toward the reader, whichever way the triangle winds.
      if (eye !== undefined ? normal.dot(edge1.subVectors(eye, middle)) < 0 : normal.z > 0)
        normal.negate();
      // Screens stand up: a face looking up or down is a shelf.
      if (Math.abs(normal.y) > 0.9 || !accept(normal, middle)) return;
      const offset = normal.dot(middle);
      const name = material.name;
      // The plane's own axes: across it level (the reader's right), and up it.
      const across = new THREE.Vector3(0, 1, 0).cross(normal).normalize();
      const up = new THREE.Vector3().crossVectors(normal, across);
      const box = new THREE.Box2();
      for (const p of [a, b, c]) box.expandByPoint(corner.set(p.dot(across), p.dot(up)));
      const touching = box.clone().expandByScalar(0.001);
      const face = faces.find(
        (f) =>
          f.material === name &&
          f.normal.dot(normal) > ALIGNED &&
          Math.abs(f.offset - offset) < PLANE &&
          f.box.intersectsBox(touching),
      );
      if (face === undefined)
        faces.push({
          material: name,
          mesh,
          normal: normal.clone(),
          across,
          up,
          offset,
          box,
          area: doubled / 2,
        });
      else {
        face.box.union(box);
        face.area += doubled / 2;
      }
    });
  });
  const size = new THREE.Vector2();
  return faces.filter((face) => {
    face.box.getSize(size);
    return face.area >= 0.9 * size.x * size.y;
  });
}

/** Where `face` lies: the middle of `box` (default the face's) on its plane. */
function faceMiddle(face: Face, box: THREE.Box2 = face.box): THREE.Vector3 {
  const middle = box.getCenter(new THREE.Vector2());
  return new THREE.Vector3()
    .addScaledVector(face.across, middle.x)
    .addScaledVector(face.up, middle.y)
    .addScaledVector(face.normal, face.offset);
}

/** The front of `face`'s box: the face of the pair over the same rectangle nearest the reader. */
function frontOf(face: Face, faces: readonly Face[]): Face {
  let front = face;
  for (const other of faces)
    if (
      other.material === face.material &&
      other.normal.dot(face.normal) > ALIGNED &&
      Math.abs(other.offset - face.offset) <= BOX_DEPTH &&
      other.offset > front.offset &&
      Math.abs(other.area - face.area) <= 0.1 * face.area &&
      other.box.intersectsBox(face.box)
    )
      front = other;
  return front;
}

/** `face` (cut down to `box`) as a display, with the relief measured over it. */
function toDisplay(
  model: THREE.Object3D,
  toModel: THREE.Matrix4,
  face: Face,
  box: THREE.Box2 = face.box,
): VehicleDisplay {
  const size = box.getSize(new THREE.Vector2());
  return {
    center: faceMiddle(face, box).toArray() as [number, number, number],
    normal: face.normal.toArray() as [number, number, number],
    up: face.up.toArray() as [number, number, number],
    width: size.x,
    height: size.y,
    relief: measureRelief(model, toModel, face, box),
    parent: face.mesh.parent ?? model,
  };
}

const vectorOf = (value: readonly number[] | undefined): THREE.Vector3 | undefined =>
  value !== undefined && value.length >= 3 && value.every(Number.isFinite)
    ? new THREE.Vector3(value[0], value[1], value[2])
    : undefined;

/**
 * The centre screen of a road vehicle's dashboard in `model` (see the module comment), or
 * undefined where it has none.
 */
export function findVehicleCenterDisplay(
  model: THREE.Object3D,
  options: VehicleCenterDisplayOptions = {},
): VehicleDisplay | undefined {
  model.updateMatrixWorld(true);
  const toModel = new THREE.Matrix4().copy(model.matrixWorld).invert();
  const eye = vectorOf(options.eye);
  const faces = collectFaces(
    model,
    toModel,
    (material) => CAR_DISPLAY.test(material.name),
    eye,
    (normal) => Math.abs(normal.z) >= SQUARE,
  );
  const size = new THREE.Vector2();
  const candidates = faces.filter((face) => {
    face.box.getSize(size);
    return (
      size.x >= CAR_MIN_WIDTH &&
      size.y >= CAR_MIN_HEIGHT &&
      Math.abs(faceMiddle(face).x) <= CENTRE_LINE
    );
  });
  if (candidates.length === 0) return undefined;
  const largest = candidates.reduce((best, face) => (face.area > best.area ? face : best));
  return toDisplay(model, toModel, frontOf(largest, candidates));
}

/**
 * The map display of a cockpit in `model` (see the module comment), cut clear of its live parts;
 * undefined where it has none (round gauges, or only displays the cockpit's bindings drive).
 */
export function findCockpitMapDisplay(
  model: THREE.Object3D,
  options: CockpitMapDisplayOptions,
): VehicleDisplay | undefined {
  const eye = vectorOf(options.eye);
  if (eye === undefined) return undefined;
  model.updateMatrixWorld(true);
  const toModel = new THREE.Matrix4().copy(model.matrixWorld).invert();
  let glass = false;
  model.traverse((object) => {
    if (glass) return;
    if (GLASS_NODE.test(object.name)) glass = true;
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh)
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
        if (GLASS_MATERIAL.test(material.name)) glass = true;
  });
  const toEye = new THREE.Vector3();
  const faces = collectFaces(
    model,
    toModel,
    (material) =>
      COCKPIT_DISPLAY.test(material.name) && (glass || !BLACK_SHEET.test(material.name)),
    eye,
    (normal, middle) => {
      const distance = toEye.subVectors(eye, middle).length();
      return (
        distance <= MAP_REACH &&
        middle.z - eye.z >= MAP_AHEAD &&
        normal.dot(toEye) >= MAP_FACING * distance
      );
    },
  );
  const size = new THREE.Vector2();
  const big = (box: THREE.Box2): boolean => {
    box.getSize(size);
    return size.x >= MAP_MIN_WIDTH && size.y >= MAP_MIN_HEIGHT;
  };
  const candidates = faces.filter((face) => big(face.box));
  const distance = (face: Face, box?: THREE.Box2): number => faceMiddle(face, box).distanceTo(eye);
  const onPanel = (face: Face): boolean => eye.y - faceMiddle(face).y <= PANEL_DROP;
  // A glass NAV page's own map area first: the nearest, on the panel where there is one.
  const allMaps = candidates.filter((face) => MAP_AREA.test(face.material));
  const panelMaps = allMaps.filter(onPanel);
  const maps = panelMaps.length > 0 ? panelMaps : allMaps;
  if (maps.length > 0) {
    const nearest = maps.reduce((best, face) => (distance(face) < distance(best) ? face : best));
    return toDisplay(model, toModel, frontOf(nearest, candidates));
  }
  const parts = liveParts(model, toModel, options.bindings ?? []);
  const screen = (box: THREE.Box2): boolean => {
    box.getSize(size);
    return (
      size.x >= SCREEN_MIN_WIDTH &&
      size.y >= SCREEN_MIN_HEIGHT &&
      size.x <= SCREEN_MOST &&
      size.y <= SCREEN_MOST
    );
  };
  const explain = options.explain;
  let best: { face: Face; box: THREE.Box2; score: number } | undefined;
  let bestLow: typeof best;
  for (const candidate of candidates) {
    const face = frontOf(candidate, candidates);
    if (face !== candidate) continue;
    const blockers: string[] = [];
    const box = screen(face.box) ? clearOf(face, parts, blockers) : undefined;
    let verdict = 'kept';
    if (!screen(face.box)) verdict = 'not screen-sized';
    else if (box === undefined) verdict = 'live part over its middle';
    else {
      box.getSize(size);
      const aspect = size.x / size.y;
      if (!big(box)) verdict = 'too little left';
      else if (
        size.x * size.y <
        (face.box.max.x - face.box.min.x >= PANORAMIC ? PORTAL_LEFT : MAP_LEFT) * face.area
      )
        verdict = 'live parts cover too much';
      else if (aspect < 0.4 || aspect > 2.5) verdict = 'left too narrow';
    }
    if (explain !== undefined) {
      face.box.getSize(size);
      explain({
        material: face.material,
        parent: face.mesh.parent?.name ?? '',
        width: size.x,
        height: size.y,
        center: faceMiddle(face).toArray(),
        ...(box !== undefined
          ? { left: [box.max.x - box.min.x, box.max.y - box.min.y] as [number, number] }
          : {}),
        verdict,
        blockers,
      });
    }
    if (verdict !== 'kept' || box === undefined) continue;
    box.getSize(size);
    // The largest, and of the same size, the nearest.
    const score = (size.x * size.y) / distance(face, box);
    if (onPanel(face)) {
      if (best === undefined || score > best.score) best = { face, box, score };
    } else if (bestLow === undefined || score > bestLow.score) bestLow = { face, box, score };
  }
  const chosen = best ?? bestLow;
  return chosen === undefined ? undefined : toDisplay(model, toModel, chosen.face, chosen.box);
}

/** A live part's reach: its vertices, or for one that turns, the circle it sweeps. */
interface Part {
  name: string;
  /** What moves it, for audits. */
  sources: string[];
  points: THREE.Vector3[];
  /** Turning parts: the pivot, how far from it the part reaches, and the axes it turns about. */
  pivot?: THREE.Vector3;
  radius?: number;
  axes?: THREE.Vector3[];
}

/** The parts the bindings move (not those following heading alone), in the model's frame. */
function liveParts(
  model: THREE.Object3D,
  toModel: THREE.Matrix4,
  bindings: readonly { node: string; source: string; property?: string; axis?: string }[],
): Part[] {
  const byNode = new Map<string, { live: boolean; axes: Set<string>; sources: string[] }>();
  for (const binding of bindings) {
    const entry = byNode.get(binding.node) ?? { live: false, axes: new Set(), sources: [] };
    // A system's availability flag is not a reading (a readout's digits, shown and hidden, are),
    // and heading the map shows itself.
    const flag = binding.property === 'visible' && AVAILABILITY_SOURCE.test(binding.source);
    if (!flag && !HEADING_SOURCE.test(binding.source)) entry.live = true;
    if (binding.property === 'rotation') entry.axes.add(binding.axis ?? 'z');
    entry.sources.push(binding.source);
    byNode.set(binding.node, entry);
  }
  const parts: Part[] = [];
  model.traverse((node) => {
    const entry =
      byNode.get(node.name) ??
      (MOVING_CONTROL.test(node.name) && !MOVING_CONTROL.test(node.parent?.name ?? '')
        ? { live: true, axes: new Set<string>(), sources: ['pilot input'] }
        : undefined);
    if (entry === undefined || !entry.live) return;
    const points: THREE.Vector3[] = [];
    node.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      forEachTriangle(
        mesh,
        toModel,
        () => true,
        (a, b, c) => {
          points.push(a.clone(), b.clone(), c.clone());
        },
      );
    });
    if (points.length === 0) return;
    const own = { name: node.name, sources: entry.sources, points };
    if (entry.axes.size === 0) {
      parts.push(own);
      return;
    }
    // Turned about its local axes, which lie in the model's frame as these directions.
    const frame = new THREE.Matrix4().multiplyMatrices(toModel, node.matrixWorld);
    const axes = [...entry.axes].map((axis) =>
      new THREE.Vector3(
        axis === 'x' ? 1 : 0,
        axis === 'y' ? 1 : 0,
        axis === 'z' ? 1 : 0,
      ).transformDirection(frame),
    );
    const pivot = new THREE.Vector3().setFromMatrixPosition(frame);
    let radius = 0;
    for (const point of points) radius = Math.max(radius, point.distanceTo(pivot));
    parts.push({ ...own, pivot, radius, axes });
  });
  return parts;
}

/**
 * The largest rectangle of `face` the live parts in front of it leave clear, cut a side at a
 * time; undefined when one covers its middle.
 */
function clearOf(face: Face, parts: readonly Part[], blockers?: string[]): THREE.Box2 | undefined {
  const box = face.box.clone();
  const reach = new THREE.Box2();
  const corner = new THREE.Vector2();
  const pad = 0.003;
  for (const part of parts) {
    reach.makeEmpty();
    const inFront = (point: THREE.Vector3): boolean => {
      const height = point.dot(face.normal) - face.offset;
      return height > -PART_BEHIND && height < PART_REACH;
    };
    // A needle turning about the screen's own axis sweeps a disc over it; a part pitching
    // toward the reader (a yoke) only stands where it is.
    const sweeps =
      part.axes?.some((axis) => Math.abs(axis.dot(face.normal)) > 0.7) === true &&
      part.pivot !== undefined &&
      part.radius !== undefined;
    if (sweeps && part.pivot !== undefined && part.radius !== undefined) {
      if (!inFront(part.pivot)) continue;
      corner.set(part.pivot.dot(face.across), part.pivot.dot(face.up));
      reach.set(
        corner.clone().subScalar(part.radius + pad),
        corner.clone().addScalar(part.radius + pad),
      );
    } else {
      for (const point of part.points)
        if (inFront(point))
          reach.expandByPoint(corner.set(point.dot(face.across), point.dot(face.up)));
      if (reach.isEmpty()) continue;
      reach.expandByScalar(pad);
    }
    if (!reach.intersectsBox(box)) continue;
    blockers?.push(`${part.name} (${part.sources.join(',')})`);
    // Keep the largest of the four sides of the part.
    const sides = [
      new THREE.Box2(box.min.clone(), new THREE.Vector2(reach.min.x, box.max.y)),
      new THREE.Box2(new THREE.Vector2(reach.max.x, box.min.y), box.max.clone()),
      new THREE.Box2(box.min.clone(), new THREE.Vector2(box.max.x, reach.min.y)),
      new THREE.Box2(new THREE.Vector2(box.min.x, reach.max.y), box.max.clone()),
    ].filter((side) => side.max.x > side.min.x && side.max.y > side.min.y);
    if (sides.length === 0) return undefined;
    const area = (b: THREE.Box2): number => (b.max.x - b.min.x) * (b.max.y - b.min.y);
    box.copy(sides.reduce((most, side) => (area(side) > area(most) ? side : most)));
  }
  return box;
}

/**
 * Bezels and the panel around a screen: their lips reach over its edges and stand on in front of
 * the slab, which tucks under them (a 737's would have made it 21 mm deep instead of 12).
 */
const SURROUND = /(^|-)(bezel|panel|frame)(-|$)/;

/** How far geometry printed on `box` of the face stands in front of it, meters. */
function measureRelief(
  model: THREE.Object3D,
  toModel: THREE.Matrix4,
  face: Face,
  box: THREE.Box2,
): number {
  // Clear of the edges, where a bezel's lip or the panel around can reach over the glass.
  const inside = box.clone().expandByScalar(-0.004);
  let reach = 0;
  const visit = (point: THREE.Vector3): void => {
    const across = point.dot(face.across);
    if (across < inside.min.x || across > inside.max.x) return;
    const up = point.dot(face.up);
    if (up < inside.min.y || up > inside.max.y) return;
    const out = point.dot(face.normal) - face.offset;
    if (out > 1e-4 && out <= MAX_RELIEF && out > reach) reach = out;
  };
  model.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || object.userData.vehicleScreen === true) return;
    forEachTriangle(
      mesh,
      toModel,
      (material) => !SURROUND.test(material.name),
      (a, b, c) => {
        visit(a);
        visit(b);
        visit(c);
      },
    );
  });
  return Math.min(MAX_RELIEF, Math.max(MIN_RELIEF, reach + RELIEF_CLEARANCE));
}

/** A live surface on a vehicle's screen. */
export interface VehicleScreen {
  /** The slab, a child of the screen's own parent. */
  readonly object: THREE.Mesh;
  readonly display: VehicleDisplay;
  /** The canvas's size in pixels: the face's aspect, `resolution` on its long side. */
  readonly width: number;
  readonly height: number;
  /** Paint here, then call {@link refresh}. */
  readonly context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  /** Show what was painted since the last call. */
  refresh(): void;
  /** Take the slab off the model and release its canvas, texture, geometry and materials. */
  dispose(): void;
}

export interface VehicleScreenOptions {
  /** Pixels along the face's long side (default 512). */
  resolution?: number;
  /** Color of the slab's edges (default a bezel's near-black). */
  edgeColor?: THREE.ColorRepresentation;
}

/** The slab's edges: the near-black of a screen's bezel. */
const EDGE_COLOR = '#0c1214';

/**
 * A 2D canvas drawn on the CPU (`willReadFrequently`), where the platform has one: it is uploaded
 * as a texture every few frames, and drawing on a GPU-backed one then stalled at times while the
 * GPU was busy with the scene.
 */
function canvas2d(
  width: number,
  height: number,
):
  | {
      canvas: HTMLCanvasElement | OffscreenCanvas;
      context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
    }
  | undefined {
  try {
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      return context ? { canvas, context } : undefined;
    }
    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(width, height);
      const context = canvas.getContext('2d', { willReadFrequently: true });
      return context ? { canvas, context } : undefined;
    }
  } catch {
    // No 2D canvas here.
  }
  return undefined;
}

/**
 * Lay a live surface over `display` on `model` (see the module comment): undefined where the
 * platform has no 2D canvas.
 */
export function createVehicleScreen(
  model: THREE.Object3D,
  display: VehicleDisplay,
  options: VehicleScreenOptions = {},
): VehicleScreen | undefined {
  const resolution = Math.max(16, Math.round(options.resolution ?? 512));
  const long = Math.max(display.width, display.height);
  const width = Math.max(16, Math.round((resolution * display.width) / long));
  const height = Math.max(16, Math.round((resolution * display.height) / long));
  const paint = canvas2d(width, height);
  if (paint === undefined) return undefined;
  const texture = new THREE.CanvasTexture(paint.canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const face = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
  face.name = 'vehicle-screen';
  const edge = new THREE.MeshBasicMaterial({ color: options.edgeColor ?? EDGE_COLOR });
  edge.name = 'vehicle-screen-edge';
  const geometry = new THREE.BoxGeometry(display.width, display.height, display.relief);
  // BoxGeometry's groups run +X, -X, +Y, -Y, +Z, -Z: the picture goes on +Z, out of the face.
  const slab = new THREE.Mesh(geometry, [edge, edge, edge, edge, face, edge]);
  slab.name = 'vehicle-screen';
  slab.castShadow = false;
  slab.receiveShadow = false;
  // Not something to stand on, and not part of the vehicle's own geometry scans.
  slab.userData.walkIgnore = true;
  slab.userData.vehicleGeometry = true;
  slab.userData.vehicleScreen = true;
  // In the model's frame: +Z out of the face, +Y up it, +X to the reader's right.
  const out = new THREE.Vector3(...display.normal);
  const up = new THREE.Vector3(...display.up);
  const right = new THREE.Vector3().crossVectors(up, out);
  const place = new THREE.Matrix4()
    .makeBasis(right, up, out)
    .setPosition(new THREE.Vector3(...display.center).addScaledVector(out, display.relief / 2));
  // Beside the screen's mesh, so it moves and hides with the cabin.
  const parent = display.parent;
  model.updateMatrixWorld(true);
  slab.applyMatrix4(
    new THREE.Matrix4()
      .copy(parent.matrixWorld)
      .invert()
      .multiply(model.matrixWorld)
      .multiply(place),
  );
  parent.add(slab);
  slab.updateMatrixWorld(true);
  let disposed = false;
  return {
    object: slab,
    display,
    width,
    height,
    context: paint.context,
    refresh() {
      if (!disposed) texture.needsUpdate = true;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      slab.removeFromParent();
      geometry.dispose();
      face.dispose();
      edge.dispose();
      texture.dispose();
    },
  };
}
