// What the vehicle console shows for a vehicle, and how a touch works each control. Each control
// is the vehicle's own part where its model has one (lifted out of the cockpit), a part of the
// console kit where it does not, and a plain button for what has no lever at all.

import type { AircraftSpec, BoatData, ModelSignalSpec, VehicleData } from '@bendyline/molen-schema';
import * as THREE from 'three';
import type { AircraftVisual } from '../aircraft';
import type { AircraftCockpitSession } from '../aircraft-cockpit-pointer';
import {
  type AircraftCockpitControl,
  aircraftControlValue,
  aircraftReheatDetent,
} from '../aircraft-controls';
import { createAircraftInstrumentViews } from '../aircraft-instruments';
import type { ModelSignals } from '../model-signals';
import { NAVIGATION_ACTIONS } from '../navigation/input-source';
import { createSpeedometerView, type SpeedometerUnit } from '../speedometer';
import type { VehicleVisual } from '../vehicles';
import {
  type ConsoleView,
  DECK_AZIMUTH,
  DECK_ELEVATION,
  deckView,
  HANDLEBAR_VIEW,
  PEDAL_VIEW,
  SEAT_VIEW,
  WHEEL_VIEW,
} from './camera';
import {
  FLAP_DETENTS,
  type KitControl,
  kitCarPedals,
  kitEngineSwitch,
  kitFlapLever,
  kitGearHandle,
  kitHandbrake,
  kitLever,
  kitLeverHousing,
  kitParkingBrake,
  kitRudderPedals,
  kitSteeringWheel,
  kitStick,
} from './kit';
import { controlFrame, type LiftedControls, liftControls, liftTarget } from './lift';
import { type ConsolePart, createControlPart, createGaugePart } from './parts';
import { leanPedals } from './pedals';

/** An aircraft the viewer flies. */
export interface ConsoleAircraftSubject {
  kind: 'aircraft';
  /** The loaded aircraft (`createAircraftVisual`), posed by the host each frame. */
  visual: AircraftVisual;
  spec: AircraftSpec;
  /** Entity type id, e.g. `molen.entities.aircraft.p51d`. */
  type?: string;
  /**
   * The pilot's controls, in any view (a cockpit session works too). Read when a control is
   * worked, so it can be a fresh object each call.
   */
  session(): AircraftCockpitSession | undefined;
  /** Show the airspeed and altitude dials (for a chase view; the cockpit view has its own). */
  gauges?: boolean;
}

/** A car, cycle, snow vehicle or boat the viewer drives. */
export interface ConsoleVehicleSubject {
  kind: 'vehicle';
  /** The loaded vehicle (`createVehicleVisual`), posed by the host each frame. */
  visual: VehicleVisual;
  /** Its data: spec (body style, cycle, handlebar) and visual bindings. */
  data: Pick<VehicleData, 'spec' | 'visual'> | Pick<BoatData, 'spec' | 'visual'>;
  boat?: boolean;
  /** Entity type id, e.g. `molen.entities.vehicle.toyota_corolla_2025`. */
  type?: string;
  /**
   * Show its speedometer, a dial of the console kit (`createSpeedometerView`), in every view: a
   * dashboard's own dial carries no numerals, and a cycle, board or boat has none.
   */
  gauges?: boolean;
  /** The speedometer's units (default km/h, knots on a boat). A change rebuilds the console. */
  speedUnit?: SpeedometerUnit;
}

/** On foot (`walk`), or a free camera that flies up and down (`free`). */
export interface ConsoleOnFootSubject {
  kind: 'walk' | 'free';
}

export type ConsoleSubject = ConsoleAircraftSubject | ConsoleVehicleSubject | ConsoleOnFootSubject;

/** A plain button: a named navigation action held while pressed, or pressed once per tap. */
export interface ConsoleButton {
  label: string;
  /** How to work it, for its tooltip ("Hold to brake"). */
  hint?: string;
  /** SVG markup inside a 24 x 24 view box, stroked in the button's color. */
  icon: string;
  action: string;
  mode: 'hold' | 'tap';
}

/** What a control's tooltip says when a mouse rests on it. */
export interface ConsoleTip {
  /** Its name ("Throttle", "Landing gear"). */
  label: string;
  /** How to work it ("Drag up for more power"). */
  hint?: string;
  /** Navigation actions the keyboard works it with: the tooltip lists the keys bound to them. */
  actions?: readonly string[];
}

/** How a touch works an item. */
export type ConsoleZone =
  /** The touch stick (today's two circles), drawn as the vehicle's stick, wheel or handlebars. */
  | { kind: 'stick' }
  | {
      kind: 'lever';
      axis?: 'x' | 'y';
      /** Thumb travel for the whole range, as a share of the rectangle's height (or width). */
      travel: number;
      min?: number;
      max?: number;
      /** Up (or right) is less: a gear handle, where down is 1. */
      invert?: boolean;
      spring?: number;
      detents?: readonly number[];
      /** Show the thumb's value on the part while dragging, until `release` settles it. */
      preview?: boolean;
      read(): number;
      change?(value: number): void;
      release?(value: number): void;
    }
  /** A navigation action held while the zone is pressed (a brake pedal, a handbrake). */
  | { kind: 'hold'; action: string }
  /** Pressed once per touch (a switch). */
  | { kind: 'tap'; press(): void };

/** One thing on the console: a 3D part with a zone over it, or a plain button. */
export interface ConsoleItem {
  id: string;
  /** Left: by the stick. Right: from the right edge in, by the throttle. Middle: dials. */
  side: 'left' | 'right' | 'middle';
  /** Width and height on a phone, CSS pixels (tablets scale them). */
  size: readonly [number, number];
  /** On a phone, shown only while the "more controls" drawer is open. */
  drawer?: boolean;
  /**
   * Lower goes first when room is short (the stick always first); what does not fit waits in a
   * row above, or behind the drawer on a landscape phone.
   */
  priority?: number;
  /** Shown only while the subject shows its dials. */
  gauge?: boolean;
  part?: () => ConsolePart;
  button?: ConsoleButton;
  zone?: ConsoleZone;
  /** Its tooltip (a button's comes from the button when this is left out). */
  tip?: ConsoleTip;
  /** Readings that override the subject's while posing (a refused gear handle's shake). */
  overrides?(nowMs: number): ModelSignals | undefined;
}

/** What a deck needs from its console. */
export interface DeckContext {
  /** Hold or release a navigation action for this console (a pedal, a button). */
  setAction(action: string, value: number): void;
  /** Turn deck views toward the left edge (a left-handed console). */
  mirror: boolean;
}

const A = NAVIGATION_ACTIONS;

/** Inline icons (24 x 24, stroked). */
export const CONSOLE_ICONS = {
  view: '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  exit: '<path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4"/><path d="M6 12h10"/>',
  use: '<path d="M10 4H5v16h5"/><path d="M14 8l4 4-4 4"/><path d="M18 12H8"/>',
  jump: '<path d="M5 13l7-7 7 7"/><path d="M5 19l7-7 7 7"/>',
  up: '<path d="M5 15l7-7 7 7"/>',
  down: '<path d="M5 9l7 7 7-7"/>',
  brake:
    '<circle cx="12" cy="12" r="6.5"/><path d="M4.5 6.5a10 10 0 0 0 0 11M19.5 6.5a10 10 0 0 1 0 11"/>',
  anchor: '<path d="M12 7v13M8 10h8M5 14a7 7 0 0 0 14 0"/><circle cx="12" cy="5" r="2"/>',
  more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
} as const;

const button = (
  label: string,
  icon: keyof typeof CONSOLE_ICONS,
  action: string,
  mode: 'hold' | 'tap',
  hint?: string,
): ConsoleButton => ({
  label,
  ...(hint !== undefined ? { hint } : {}),
  icon: CONSOLE_ICONS[icon],
  action,
  mode,
});

/** The keyboard's stick: W A S D, as a keycap row reads. */
const MOVE_ACTIONS = [A.forward, A.left, A.back, A.right] as const;

/** A button's tooltip: its label and hint, and the keys of its action. */
export function buttonTip(spec: ConsoleButton): ConsoleTip {
  return {
    label: spec.label,
    ...(spec.hint !== undefined ? { hint: spec.hint } : {}),
    ...(spec.action ? { actions: [spec.action] } : {}),
  };
}

/** A control's tooltip: its own, or its button's. */
export function itemTip(item: ConsoleItem): ConsoleTip | undefined {
  return item.tip ?? (item.button ? buttonTip(item.button) : undefined);
}

/** The buttons shown at the top for a mounted vehicle: the view, and leaving it. */
export function mountedButtons(): ConsoleButton[] {
  return [button('Change view', 'view', A.view, 'tap'), button('Leave', 'exit', A.interact, 'tap')];
}

/**
 * The buttons a subject shows at the top corner: the view and leaving it when mounted, the view
 * on foot, none for a free camera.
 */
export function subjectButtons(subject: ConsoleSubject): ConsoleButton[] {
  if (subject.kind === 'aircraft' || subject.kind === 'vehicle') return mountedButtons();
  return subject.kind === 'walk' ? mountedButtons().slice(0, 1) : [];
}

/** Triangles below which a modeled control is a placeholder, drawn from the kit instead. */
const MIN_TRIANGLES = 40;

/** Triangles in a node's subtree. */
function triangles(root: THREE.Object3D): number {
  let count = 0;
  root.traverse((node) => {
    const geometry = (node as THREE.Mesh).isMesh ? (node as THREE.Mesh).geometry : undefined;
    if (geometry)
      count += (geometry.index?.count ?? geometry.getAttribute('position')?.count ?? 0) / 3;
  });
  return count;
}

/** Model-frame position of a node. */
function inModel(node: THREE.Object3D, model: THREE.Object3D): THREE.Vector3 {
  return model.worldToLocal(node.getWorldPosition(new THREE.Vector3()));
}

/**
 * The controls of the station nearest `eye`: lift targets of `nodes`, the nearest one and every
 * other within `reach` meters of it (a pair of pedals, the levers of one quadrant), without the
 * same control at a second seat.
 */
function station(
  nodes: readonly THREE.Object3D[],
  model: THREE.Object3D,
  frames: ReadonlySet<string>,
  eye: THREE.Vector3,
  reach: number,
): { targets: THREE.Object3D[]; frame: THREE.Object3D } | undefined {
  model.updateMatrixWorld(true);
  const targets = new Map<THREE.Object3D, THREE.Vector3>();
  let frame: THREE.Object3D | undefined;
  for (const node of nodes) {
    const nodeFrame = controlFrame(node, model, frames);
    const target = liftTarget(node, nodeFrame);
    if (!targets.has(target)) targets.set(target, inModel(target, model));
    frame ??= nodeFrame;
  }
  const sorted = [...targets].sort(([, a], [, b]) => a.distanceTo(eye) - b.distanceTo(eye));
  const nearest = sorted[0];
  if (nearest === undefined || frame === undefined) return undefined;
  const [first, at] = nearest;
  const chosen = sorted
    .filter(([, position]) => position.distanceTo(at) <= reach)
    .map(([target]) => target)
    // A control and its own ancestor are one part.
    .filter((target, _, all) => {
      for (let parent = target.parent; parent; parent = parent.parent)
        if (all.includes(parent)) return false;
      return true;
    });
  return {
    targets: chosen.length > 0 ? chosen : [first],
    frame: controlFrame(first, model, frames),
  };
}

/** Model-frame center of a node's geometry (a pedal group may sit at the origin). */
function centerIn(node: THREE.Object3D, model: THREE.Object3D): THREE.Vector3 {
  const box = new THREE.Box3().setFromObject(node, true);
  return model.worldToLocal(
    box.isEmpty() ? node.getWorldPosition(new THREE.Vector3()) : box.getCenter(new THREE.Vector3()),
  );
}

/**
 * A pair of pedals from a station's: the one nearest the eye and the one nearest it, so a second
 * seat's pedals stay out, beside (side by side) or behind (tandem). A station of one target (both
 * pads in one node) is kept as it is.
 */
function pair(
  picked: { targets: THREE.Object3D[]; frame: THREE.Object3D } | undefined,
  model: THREE.Object3D,
  eye: THREE.Vector3,
): { targets: THREE.Object3D[]; frame: THREE.Object3D } | undefined {
  if (!picked || picked.targets.length <= 1) return picked;
  model.updateMatrixWorld(true);
  const at = picked.targets.map((target) => ({ target, center: centerIn(target, model) }));
  at.sort((a, b) => a.center.distanceTo(eye) - b.center.distanceTo(eye));
  const [first, ...rest] = at;
  if (!first) return picked;
  rest.sort((a, b) => a.center.distanceTo(first.center) - b.center.distanceTo(first.center));
  const other = rest[0];
  return { ...picked, targets: other ? [first.target, other.target] : [first.target] };
}

/** Largest bound travel (|scale|, or the span of a keyed curve) of `channel` bindings on `nodes`. */
function travel(
  spec: Pick<ModelSignalSpec, 'bindings'>,
  targets: readonly THREE.Object3D[],
  property: 'rotation' | 'position',
  sources: readonly string[],
): number {
  const names = new Set<string>();
  for (const target of targets) target.traverse((node) => names.add(node.name));
  let most = 0;
  for (const binding of spec.bindings) {
    if (!names.has(binding.node) || binding.property !== property) continue;
    if (
      !sources.some((source) => binding.source === source || binding.source.endsWith(`.${source}`))
    )
      continue;
    const span =
      binding.keys !== undefined
        ? Math.max(...binding.keys.map(([, v]) => Math.abs(v)))
        : Math.abs(binding.scale ?? 1);
    most = Math.max(most, span);
  }
  return most;
}

/**
 * Which of a lifted stick's or yoke's channels run backwards. The documented convention (see
 * the vehicle interiors guide): nose up tilts a stick aft (-Z) and pulls a yoke back; right bank
 * tilts a stick toward -X and turns a yoke clockwise from the seat, its top toward -X. A thumb
 * pushing forward must see the stick go forward, so a model that binds it the other way (the
 * P-51's, OH-6's and DC-3's did until 2026-11-19) is drawn by the convention, not the binding.
 * Measured, not keyed by aircraft, so a model fixed later is drawn as it is.
 */
function stickConvention(lifted: LiftedControls): Record<string, number> {
  const grip = lifted.moving.at(-1);
  if (!grip) return {};
  const at = (signals: ModelSignals): THREE.Vector3 => {
    lifted.visual.update(signals);
    lifted.root.updateMatrixWorld(true);
    // A point above the moving part's pivot: a stick's grip, the top of a yoke's wheel.
    return grip.localToWorld(new THREE.Vector3(0, 0.3, 0));
  };
  const rest = at({ pitchInput: 0, rollInput: 0 });
  const pitch = at({ pitchInput: 1, rollInput: 0 }).sub(rest);
  const roll = at({ pitchInput: 0, rollInput: 1 }).sub(rest);
  lifted.visual.reset();
  return {
    ...(pitch.z > 1e-4 ? { pitchInput: -1 } : {}),
    ...(roll.x > 1e-4 ? { rollInput: -1 } : {}),
  };
}

/**
 * Whether lifted rudder pedals run backwards: right rudder (positive yaw) must push the right
 * pedal (toward -X) forward (+Z). Measured, as `stickConvention`.
 */
function pedalConvention(lifted: LiftedControls): Record<string, number> {
  if (lifted.moving.length < 2) return {};
  const centers = (): THREE.Vector3[] => {
    lifted.root.updateMatrixWorld(true);
    return lifted.moving.map((node) =>
      new THREE.Box3().setFromObject(node, true).getCenter(new THREE.Vector3()),
    );
  };
  lifted.visual.update({ yawInput: 0 });
  const rest = centers();
  lifted.visual.update({ yawInput: 1 });
  const pushed = centers();
  lifted.visual.reset();
  let right = 0;
  for (const [index, center] of rest.entries())
    if (center.x < (rest[right] as THREE.Vector3).x) right = index;
  const moved = (pushed[right] as THREE.Vector3).z - (rest[right] as THREE.Vector3).z;
  return moved < -1e-4 ? { yawInput: -1 } : {};
}

/** A lifted part from `targets`, or a kit part when there are none. */
function liftedPart(options: {
  id: string;
  model: THREE.Object3D;
  spec: Pick<ModelSignalSpec, 'derived' | 'bindings'>;
  picked: { targets: THREE.Object3D[]; frame: THREE.Object3D };
  gain?: number;
  prepare?: (root: THREE.Object3D) => void;
  view: ConsoleView;
  samples: readonly ModelSignals[];
  /** Readings a thumb's preview stands for. */
  preview?: (value: number) => ModelSignals;
  /** A kit housing under the lifted levers. */
  housing?: boolean;
  /**
   * Measures the copy against the way the control must move under a thumb and returns the
   * channels to reverse (`{ pitchInput: -1 }`); see `stickConvention`, `pedalConvention`.
   */
  convention?: (lifted: LiftedControls) => Readonly<Record<string, number>>;
}): ConsolePart {
  const lift = (gains?: Readonly<Record<string, number>>): LiftedControls =>
    liftControls({
      model: options.model,
      nodes: options.picked.targets,
      spec: options.spec,
      frame: options.picked.frame,
      ...(options.gain !== undefined ? { gain: options.gain } : {}),
      ...(gains !== undefined ? { gains } : {}),
      ...(options.prepare !== undefined ? { prepare: options.prepare } : {}),
    });
  let lifted = lift();
  const reverse = options.convention?.(lifted);
  if (reverse && Object.keys(reverse).length > 0) lifted = lift(reverse);
  const housing = options.housing ? kitLeverHousing(lifted.root, lifted.moving) : undefined;
  if (housing) lifted.root.add(housing.root);
  return createControlPart({
    id: options.id,
    root: lifted.root,
    moving: lifted.moving,
    pose: (signals, preview) =>
      lifted.visual.update(
        preview !== undefined && options.preview
          ? { ...signals, ...options.preview(preview) }
          : signals,
      ),
    view: options.view,
    samples: options.samples,
    reset: () => lifted.visual.reset(),
    dispose: () => housing?.dispose(),
  });
}

function kitPart(
  id: string,
  kit: KitControl,
  view: ConsoleView,
  samples: readonly ModelSignals[],
): ConsolePart {
  return createControlPart({
    id,
    root: kit.root,
    moving: kit.moving,
    pose: (signals, preview) => kit.pose(signals, preview),
    view,
    samples,
    dispose: () => kit.dispose(),
  });
}

/** The console's items for an aircraft. */
export function aircraftDeck(subject: ConsoleAircraftSubject, context: DeckContext): ConsoleItem[] {
  const { visual, spec } = subject;
  const model = visual.object;
  const cockpit = visual.cockpit;
  const bindings: Pick<ModelSignalSpec, 'derived' | 'bindings'> = cockpit.interior ?? {
    bindings: [],
  };
  const frames = new Set<string>([...(spec.visual.interior?.nodes ?? []), 'flight-controls']);
  const byName = new Map<string, THREE.Object3D[]>();
  model.traverse((node) => byName.set(node.name, [...(byName.get(node.name) ?? []), node]));
  const kitModule = (node: THREE.Object3D): boolean => {
    for (let parent: THREE.Object3D | null = node; parent; parent = parent.parent)
      if (parent.name === 'flight-controls') return true;
    return false;
  };
  /** A control's own modeled nodes, without the bolted-on module's stand-ins. */
  const authored = (controls: readonly AircraftCockpitControl[]): THREE.Object3D[] =>
    controls
      .flatMap((control) => control.nodes)
      .flatMap((name) => byName.get(name) ?? [])
      .filter((node) => !kitModule(node));
  const eye = new THREE.Vector3().fromArray(spec.pilotEye);
  /**
   * The modeled controls of the pilot's station, or undefined to draw the kit's: also when they
   * are placeholders (a box of a dozen triangles reads as a floating cube once enlarged).
   */
  const pick = (controls: readonly AircraftCockpitControl[], reach: number, detail = true) => {
    const nodes = authored(controls);
    const picked = nodes.length > 0 ? station(nodes, model, frames, eye, reach) : undefined;
    if (!picked || !detail) return picked;
    return picked.targets.every((target) => triangles(target) >= MIN_TRIANGLES)
      ? picked
      : undefined;
  };
  const of = (action: AircraftCockpitControl['action']): AircraftCockpitControl[] =>
    cockpit.controls.filter((control) => control.action === action);
  const common = (action: AircraftCockpitControl['action']): AircraftCockpitControl | undefined =>
    of(action).find((control) => control.engine === undefined) ?? of(action)[0];
  const change = (control: AircraftCockpitControl | undefined, value: number): void => {
    const session = subject.session();
    if (session && control) session.change({ control, value });
  };
  const value = (control: AircraftCockpitControl | undefined): number => {
    const session = subject.session();
    return session && control ? aircraftControlValue(session.input, control) : 0;
  };
  const deck = deckView(DECK_AZIMUTH, DECK_ELEVATION, context.mirror);
  const helicopter = spec.model === 'helicopter';
  const items: ConsoleItem[] = [];

  // Stick, yoke or cyclic, worked by the touch stick.
  // Any modeled stick beats the kit's: every catalog aircraft has one.
  // One stick: the nearest the pilot (side-by-side seats can hold theirs 17 cm apart).
  const stick = pick(of('stick'), 0.05, false);
  const stickTravel = stick
    ? travel(bindings, stick.targets, 'rotation', ['pitchInput', 'rollInput'])
    : 0;
  const corners = [-1, 1].flatMap((pitchInput) =>
    [-1, 1].map((rollInput): ModelSignals => ({ pitchInput, rollInput })),
  );
  const yoke = stick?.targets.some((target) => {
    let found = false;
    target.traverse((node) => {
      found ||= /yoke/i.test(node.name);
    });
    return found;
  });
  items.push({
    id: 'stick',
    side: 'left',
    size: [160, 168],
    priority: 0,
    zone: { kind: 'stick' },
    tip: {
      label: helicopter ? 'Cyclic' : yoke ? 'Yoke' : 'Stick',
      hint: helicopter
        ? 'Drag up to fly forward, sideways to bank'
        : 'Drag down to raise the nose, sideways to bank',
      actions: MOVE_ACTIONS,
    },
    part: () =>
      stick
        ? liftedPart({
            id: 'stick',
            model,
            spec: bindings,
            picked: stick,
            // A full push should read at a glance: about 18 degrees of tilt.
            gain: stickTravel > 0 ? Math.max(1, Math.min(10, 0.32 / stickTravel)) : 1,
            convention: stickConvention,
            view: SEAT_VIEW,
            samples: corners,
          })
        : kitPart('stick', kitStick(), SEAT_VIEW, corners),
  });

  // Rudder pedals beside it, slid sideways; they center when the thumb lifts.
  // One seat's pair: the nearest pedal and the nearest on the other side of the pilot's eye.
  const pedals = pair(pick(of('yaw'), 1.5), model, eye);
  const pedalTravel = pedals ? travel(bindings, pedals.targets, 'position', ['yawInput']) : 0;
  const yawSamples: ModelSignals[] = [{ yawInput: -1 }, { yawInput: 1 }];
  items.push({
    id: 'pedals',
    side: 'left',
    size: [124, 96],
    priority: 4,
    tip: {
      label: helicopter ? 'Pedals' : 'Rudder pedals',
      hint: 'Slide sideways to swing the nose',
      actions: [A.yawLeft, A.yawRight],
    },
    zone: {
      kind: 'lever',
      axis: 'x',
      travel: 0.45,
      min: -1,
      max: 1,
      spring: 0,
      read: () => 0,
      change: (yaw) => {
        context.setAction(A.yawRight, Math.max(0, yaw));
        context.setAction(A.yawLeft, Math.max(0, -yaw));
      },
      release: () => {
        context.setAction(A.yawRight, 0);
        context.setAction(A.yawLeft, 0);
      },
    },
    part: () =>
      pedals
        ? liftedPart({
            id: 'pedals',
            model,
            spec: bindings,
            picked: pedals,
            gain: pedalTravel > 0 ? Math.max(1, Math.min(3, 0.06 / pedalTravel)) : 1,
            convention: pedalConvention,
            // Linkage rods can stand in front of the pads from the seat; the pads are the point.
            prepare: (root) => {
              const links: THREE.Object3D[] = [];
              root.traverse((node) => {
                if (/link/i.test(node.name) && !bindings.bindings.some((b) => b.node === node.name))
                  links.push(node);
              });
              for (const link of links) link.removeFromParent();
              leanPedals(root);
            },
            view: PEDAL_VIEW,
            samples: yawSamples,
          })
        : kitPart('pedals', kitRudderPedals(), PEDAL_VIEW, yawSamples),
  });

  // Throttle (or collective) at the right edge: all levers move together.
  const power = common('power');
  const levers = pick(of('power'), 0.35);
  const engines = spec.engines?.map((engine) => engine.id) ?? [];
  const powerSamples = [0, 1].map(
    (v): ModelSignals =>
      Object.fromEntries([['power', v], ...engines.map((id) => [`engines.${id}.power`, v])]),
  );
  items.push({
    id: 'throttle',
    side: 'right',
    priority: 1,
    size: [Math.min(140, 86 + 16 * Math.max(0, (levers?.targets.length ?? 1) - 1)), 160],
    tip: {
      label: helicopter
        ? 'Collective'
        : (levers?.targets.length ?? 0) > 1
          ? 'Throttles'
          : 'Throttle',
      hint: helicopter
        ? 'Drag up for more lift'
        : aircraftReheatDetent(spec) === undefined
          ? 'Drag up for more power'
          : 'Drag up for more power; the top of the travel, past military power, is the afterburner',
      actions: [A.throttleDown, A.throttleUp],
    },
    zone: {
      kind: 'lever',
      travel: 0.8,
      read: () => value(power),
      change: (v) => change(power, v),
    },
    part: () =>
      levers
        ? liftedPart({
            id: 'throttle',
            model,
            spec: bindings,
            picked: levers,
            view: deck,
            samples: powerSamples,
            housing: true,
          })
        : kitPart('throttle', kitLever('power', 'black'), deck, powerSamples),
  });

  // Gear handle: a throw past halfway; refused on the ground, when the handle shakes.
  const gear = common('gear');
  let refusedAt = Number.NEGATIVE_INFINITY;
  if (gear) {
    const handle = pick([gear], 0.5);
    const preview = (down: number): ModelSignals => ({ gearCommand: down, gear: down });
    const samples = [preview(0), preview(1)];
    items.push({
      id: 'gear',
      side: 'right',
      size: [62, 120],
      priority: 2,
      tip: {
        label: 'Landing gear',
        hint: 'Drag down to lower, up to raise',
        actions: [A.gear],
      },
      zone: {
        kind: 'lever',
        travel: 0.55,
        invert: true,
        preview: true,
        read: () => value(gear),
        release: (down) => {
          const wanted = down >= 0.5 ? 1 : 0;
          if (wanted === value(gear)) return;
          change(gear, wanted);
          if (value(gear) !== wanted) refusedAt = performance.now();
        },
      },
      overrides: (now) => {
        const since = now - refusedAt;
        if (since > 450) return undefined;
        const down = value(gear);
        return preview(down + (down > 0.5 ? -1 : 1) * 0.12 * Math.abs(Math.sin(since / 30)));
      },
      part: () =>
        handle
          ? liftedPart({
              id: 'gear',
              model,
              spec: bindings,
              picked: handle,
              view: deck,
              samples,
              preview,
            })
          : kitPart('gear', kitGearHandle(DECK_ELEVATION), deck, samples),
    });
  }

  // Flap lever with up, half and full notches.
  const flaps = common('flaps');
  if (flaps) {
    const handle = pick([flaps], 0.5);
    const preview = (v: number): ModelSignals => ({ flapCommand: v, flapPosition: v });
    const samples = [preview(0), preview(1)];
    items.push({
      id: 'flaps',
      side: 'right',
      size: [62, 120],
      priority: 3,
      tip: {
        label: 'Flaps',
        hint: 'Drag down for more: up, half, full',
        actions: [A.flaps],
      },
      zone: {
        kind: 'lever',
        travel: 0.55,
        invert: true,
        detents: FLAP_DETENTS,
        preview: true,
        read: () => value(flaps),
        release: (v) => change(flaps, v),
      },
      part: () =>
        handle
          ? liftedPart({
              id: 'flaps',
              model,
              spec: bindings,
              picked: handle,
              view: deck,
              samples,
              preview: (v) => ({ ...preview(v), flaps: v }),
            })
          : kitPart('flaps', kitFlapLever(DECK_ELEVATION), deck, samples),
    });
  }

  // Engine master: tap to start or stop.
  const engine = common('engine');
  if (engine)
    items.push({
      id: 'engine',
      side: 'right',
      size: [52, 76],
      priority: 6,
      tip: { label: 'Engine', hint: 'Tap to start or stop', actions: [A.engine] },
      zone: { kind: 'tap', press: () => change(engine, value(engine) > 0.5 ? 0 : 1) },
      part: () =>
        kitPart('engine', kitEngineSwitch(DECK_ELEVATION), deck, [{ engine: 0 }, { engine: 1 }]),
    });

  // Parking brake: tap to set or release.
  const parking = common('brake');
  if (parking)
    items.push({
      id: 'parking-brake',
      side: 'right',
      size: [52, 76],
      priority: 8,
      tip: { label: 'Parking brake', hint: 'Tap to set or release' },
      zone: { kind: 'tap', press: () => change(parking, value(parking) > 0.5 ? 0 : 1) },
      part: () =>
        kitPart('parking-brake', kitParkingBrake(DECK_ELEVATION), deck, [
          { brake: 0 },
          { brake: 1 },
        ]),
    });

  // Toe brakes, held, for an airplane on its wheels.
  if (!helicopter)
    items.push({
      id: 'brakes',
      side: 'right',
      size: [56, 56],
      priority: 7,
      button: button('Brakes', 'brake', A.jump, 'hold', 'Hold to brake the wheels'),
    });

  // Secondary levers: behind the drawer on a phone.
  const secondary: [
    AircraftCockpitControl['action'],
    'red' | 'blue' | 'grey' | 'green',
    string,
    ConsoleTip,
  ][] = [
    ['mixture', 'red', 'mixture', { label: 'Mixture', hint: 'Drag up for richer, down to lean' }],
    ['propeller', 'blue', 'propeller', { label: 'Propeller', hint: 'Drag up for more rpm' }],
    [
      'thrustVector',
      'green',
      'vectorCommand',
      { label: 'Thrust vector', hint: 'Drag to swing the thrust', actions: [A.vector] },
    ],
    ['speedBrake', 'grey', 'speedBrake', { label: 'Speed brake', hint: 'Drag up to open' }],
  ];
  for (const [action, color, signal, tip] of secondary) {
    const controls = of(action);
    if (controls.length === 0) continue;
    const first = common(action);
    const handle = pick(controls, 0.35);
    const samples = [0, 1].map(
      (v): ModelSignals =>
        Object.fromEntries([[signal, v], ...engines.map((id) => [`engines.${id}.${action}`, v])]),
    );
    items.push({
      id: action,
      side: 'right',
      size: [58, 120],
      drawer: true,
      priority: 10 + secondary.findIndex(([name]) => name === action),
      tip,
      zone: {
        kind: 'lever',
        travel: 0.8,
        ...(action === 'speedBrake' ? { detents: [0, 1] } : {}),
        read: () => value(first),
        change: (v) => {
          for (const control of controls) change(control, v);
        },
      },
      part: () =>
        handle
          ? liftedPart({
              id: action,
              model,
              spec: bindings,
              picked: handle,
              view: deck,
              samples,
              housing: true,
            })
          : kitPart(action, kitLever(signal, color), deck, samples),
    });
  }

  // The aircraft's own airspeed and altitude dials, in a chase view.
  const views = createAircraftInstrumentViews({ model, spec });
  for (const view of views)
    items.push({
      id: view.kind,
      side: 'middle',
      size: [84, 84],
      priority: 5,
      gauge: true,
      tip: { label: view.kind === 'speed' ? 'Airspeed' : 'Altitude' },
      part: () => createGaugePart(view.kind, view),
    });
  return items;
}

/** How the stick drives a vehicle. */
const STEER_HINT = 'Drag sideways to steer, up to go, down to brake or reverse';

/** A vehicle's top speed when its spec names none, m/s (about 140 km/h). */
const DEFAULT_TOP_SPEED = 40;

/** The console's items for a car, cycle, snow vehicle or boat. */
export function vehicleDeck(subject: ConsoleVehicleSubject, context: DeckContext): ConsoleItem[] {
  const { visual, data } = subject;
  const model = visual.object;
  const spec = data.spec as Partial<VehicleData['spec']>;
  const interior = data.visual.interior;
  const animation = data.visual.animation;
  const frames = new Set<string>(interior?.nodes ?? []);
  const items: ConsoleItem[] = [];
  const steering = (source?: Pick<ModelSignalSpec, 'bindings'>, pattern?: RegExp) =>
    source?.bindings.find(
      (binding) =>
        binding.source === 'steering' &&
        binding.property === 'rotation' &&
        (pattern === undefined || pattern.test(binding.node)),
    );
  const wheel = steering(interior);
  const bars = wheel ? undefined : steering(animation, /handlebar|bars/i);
  const bound = wheel ?? bars;
  const node = bound ? model.getObjectByName(bound.node) : undefined;
  const spin: ModelSignals[] = [{ steering: -1 }, { steering: 1 }];
  const cycle = spec.cycle !== undefined;
  const handlebar = spec.handlebar !== undefined || bars !== undefined;
  if (node && bound) {
    const frame = controlFrame(node, model, frames);
    const binds = (wheel ? interior : animation) as Pick<ModelSignalSpec, 'derived' | 'bindings'>;
    items.push({
      id: 'stick',
      side: 'left',
      size: [160, 168],
      zone: { kind: 'stick' },
      tip: {
        label: bars ? 'Handlebars' : 'Steering wheel',
        hint: STEER_HINT,
        actions: MOVE_ACTIONS,
      },
      part: () =>
        liftedPart({
          id: 'stick',
          model,
          spec: binds,
          picked: { targets: [liftTarget(node, frame)], frame },
          view: bars ? HANDLEBAR_VIEW : WHEEL_VIEW,
          samples: spin,
        }),
    });
  } else if (!cycle && !subject.boat) {
    items.push({
      id: 'stick',
      side: 'left',
      size: [160, 168],
      zone: { kind: 'stick' },
      tip: { label: 'Steering wheel', hint: STEER_HINT, actions: MOVE_ACTIONS },
      part: () => kitPart('stick', kitSteeringWheel(), WHEEL_VIEW, spin),
    });
  } else {
    // Boards and skis: the plain stick.
    items.push({
      id: 'stick',
      side: 'left',
      size: [160, 168],
      zone: { kind: 'stick' },
      tip: { label: 'Steer', hint: STEER_HINT, actions: MOVE_ACTIONS },
    });
  }
  const deck = deckView(DECK_AZIMUTH, DECK_ELEVATION, context.mirror);
  if (subject.boat) {
    items.push({
      id: 'anchor',
      side: 'right',
      size: [60, 60],
      button: button('Anchor', 'anchor', A.sprint, 'hold', 'Hold to stop'),
    });
  } else if (cycle || handlebar) {
    items.push({
      id: 'brakes',
      side: 'right',
      size: [60, 60],
      button: button('Brake', 'brake', A.jump, 'hold', 'Hold to brake'),
    });
  } else {
    // A car: its pedals by the wheel (hold them to brake; a held zone previews 1, pressed) and
    // a handbrake at the right, pulled up and springing back down when let go.
    items.push({
      id: 'pedals',
      side: 'left',
      size: [100, 96],
      zone: { kind: 'hold', action: A.jump },
      tip: { label: 'Brake pedal', hint: 'Hold to brake', actions: [A.jump] },
      part: () =>
        kitPart('pedals', kitCarPedals(), PEDAL_VIEW, [
          { throttle: 1 },
          { throttle: -1, brake: 1 },
        ]),
    });
    items.push({
      id: 'handbrake',
      side: 'right',
      size: [70, 120],
      tip: { label: 'Handbrake', hint: 'Pull up and hold', actions: [A.sprint] },
      zone: {
        kind: 'lever',
        travel: 0.5,
        spring: 0,
        preview: true,
        read: () => 0,
        change: (v) => context.setAction(A.sprint, v > 0.3 ? 1 : 0),
        release: () => context.setAction(A.sprint, 0),
      },
      part: () => kitPart('handbrake', kitHandbrake(), deck, [{}]),
    });
  }
  // The speedometer, between the stick and the brakes, numbered past the vehicle's top speed.
  items.push({
    id: 'speed',
    side: 'middle',
    size: [84, 84],
    priority: 5,
    gauge: true,
    tip: { label: 'Speed' },
    part: () =>
      createGaugePart(
        'speed',
        createSpeedometerView({
          maxSpeed: spec.maxSpeed ?? DEFAULT_TOP_SPEED,
          unit: subject.speedUnit ?? (subject.boat ? 'kt' : 'km/h'),
          speed: () => visual.signals.speed,
        }),
      ),
  });
  return items;
}

/** The console's items on foot: the plain stick, and jumping and using things. */
export function onFootDeck(subject: ConsoleOnFootSubject): ConsoleItem[] {
  const items: ConsoleItem[] = [
    {
      id: 'stick',
      side: 'left',
      size: [160, 168],
      zone: { kind: 'stick' },
      tip: {
        label: 'Move',
        hint: subject.kind === 'free' ? 'Drag to fly around' : 'Drag to walk',
        actions: MOVE_ACTIONS,
      },
    },
  ];
  if (subject.kind === 'free') {
    items.push(
      {
        id: 'up',
        side: 'right',
        size: [60, 60],
        button: button('Up', 'up', A.up, 'hold', 'Hold to rise'),
      },
      {
        id: 'down',
        side: 'right',
        size: [60, 60],
        button: button('Down', 'down', A.down, 'hold', 'Hold to sink'),
      },
    );
  } else {
    items.push(
      { id: 'jump', side: 'right', size: [68, 68], button: button('Jump', 'jump', A.jump, 'hold') },
      {
        id: 'use',
        side: 'right',
        size: [56, 56],
        button: button('Use', 'use', A.interact, 'tap', 'Board a vehicle or open a door'),
      },
    );
  }
  return items;
}
