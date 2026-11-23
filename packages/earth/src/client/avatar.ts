/**
 * The viewer's own figure: standing where the walker's feet are and turning the way it goes, or
 * sitting in the seat the viewer is mounted in. `mountEarthView` draws it among its actors
 * ({@link AvatarMotion}, {@link seatedPose}); a host that composes its own view uses
 * {@link EarthAvatar}.
 */

import { AmbientFigures, type WalkerView } from '@bendyline/molen-ambient/client';
import {
  cycleRiderPose,
  type FigureData,
  resolveFigureDescriptor,
} from '@bendyline/molen-figures/client';
import { Mountable, Mounted, Vehicle, VehicleState } from '@bendyline/molen-kernel/vehicles';
import { Transform, type World } from '@bendyline/molen-kernel/world';
import type * as THREE from 'three';

/** The viewer's own figure this frame. */
export interface EarthAvatarFrame {
  /** Drawn at all: not in first person, nor from inside its own seat. */
  visible: boolean;
  /** On foot: the walker's feet, horizontal velocity [x, z] and compass look heading. */
  feet?: readonly [number, number, number];
  velocity?: readonly [number, number];
  heading?: number;
}

const PLAYER = 'world-player';
const TAU = 2 * Math.PI;
/** How far above the ground a car's floor is taken to be, meters. */
const CAR_FLOOR = 0.25;
/** Faster than this (m/s) the figure runs. */
const RUN_FROM = 2.2;

const compass = (heading: number): number => ((heading % TAU) + TAU) % TAU;

/** Rotation about +Y turning a figure's front (+Z) to a compass heading (north -Z, east +X). */
export function headingRotation(heading: number): [number, number, number, number] {
  const yaw = Math.PI - heading;
  return [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)];
}

/** A compass heading turned at most `step` radians from `current` toward `target`. */
export function turnToward(current: number, target: number, step: number): number {
  let delta = (target - current) % TAU;
  if (delta > Math.PI) delta -= TAU;
  if (delta < -Math.PI) delta += TAU;
  return compass(current + Math.max(-step, Math.min(step, delta)));
}

/** How a seated figure is drawn (the rest of its `WalkerView` says who and where). */
export type SeatedPose = Pick<WalkerView, 'mode' | 'anchor' | 'riding' | 'floor'>;

/**
 * How a figure mounted in a vehicle sits: astride a cycle by its saddle, anywhere else by its eye,
 * with its feet on the floor below. `cockpitFloor` is the height of an aircraft's cockpit floor in
 * its own frame (`AircraftVisual.cockpit.floor`); without it the legs simply hang.
 */
export function seatedPose(
  world: World,
  mounted: { vehicle: string; seat: string },
  cockpitFloor?: (aircraft: string) => number | undefined,
): SeatedPose {
  const vehicle = world.get(mounted.vehicle, Vehicle);
  const seat = world
    .get(mounted.vehicle, Mountable)
    ?.seats.find((candidate) => candidate.id === mounted.seat);
  const riding = cycleRiderPose(vehicle, world.get(mounted.vehicle, VehicleState), seat);
  if (riding !== undefined) return { mode: 'sit', anchor: 'pelvis', riding };
  const floor = vehicle !== undefined ? CAR_FLOOR : cockpitFloor?.(mounted.vehicle);
  return {
    mode: 'sit',
    anchor: 'eye',
    ...(seat !== undefined && floor !== undefined ? { floor: seat.position[1] - floor } : {}),
  };
}

/** The walking figure's heading and gait, followed from the walker frame by frame. */
export class AvatarMotion {
  /** m/s over the ground. */
  private speed = 0;
  /** The tick it last set off or stopped. */
  private since = 0;
  private heading = 0;
  private moving = false;

  /** Where the figure stands this frame; undefined while `seated`, or before the walker lands. */
  update(
    frame: EarthAvatarFrame,
    seated: boolean,
    tick: number,
    dt: number,
  ): { pos: [number, number, number]; rot: [number, number, number, number] } | undefined {
    if (frame.feet === undefined || seated) {
      this.speed = 0;
      return undefined;
    }
    const [vx, vz] = frame.velocity ?? [0, 0];
    const speed = Math.hypot(vx, vz);
    // Face where the walker goes; standing, face where the camera looks.
    const target = speed > 0.3 ? compass(Math.atan2(vx, -vz)) : (frame.heading ?? this.heading);
    this.heading = turnToward(this.heading, target, 12 * Math.max(0, dt));
    const moving = speed > 0.15;
    if (moving !== this.moving) {
      this.moving = moving;
      this.since = tick;
    }
    this.speed = speed;
    return {
      pos: [frame.feet[0], frame.feet[1], frame.feet[2]],
      rot: headingRotation(this.heading),
    };
  }

  /** The figure as it is drawn: on foot, or in the seat `seated` describes. */
  walker(
    id: string,
    figure: FigureData,
    at: { pos: readonly [number, number, number]; rot: readonly [number, number, number, number] },
    seated: SeatedPose | undefined,
  ): WalkerView {
    return {
      id,
      figure,
      pos: at.pos,
      rot: at.rot,
      speed: seated !== undefined ? 0 : this.speed,
      since: this.since,
      hidden: false,
      ...(seated ?? (this.speed > RUN_FROM ? { mode: 'run' as const } : {})),
    };
  }
}

export interface EarthAvatarOptions {
  /** The world the viewer mounts vehicles in: their seat is read from it. */
  world: World;
  /** Drawn under this: the streamed root vehicles hang from. */
  parent: THREE.Object3D;
  /** Shader warm-up (`renderer.prepareObject`): a new body shows once it resolves. */
  prepare?: (object: THREE.Object3D) => Promise<void> | void;
  /**
   * Height of an aircraft entity's cockpit floor above its origin
   * (`AircraftVisual.cockpit.floor`), which keeps a tall pilot's feet inside.
   */
  cockpitFloor?: (aircraft: string) => number | undefined;
}

/**
 * The viewer's figure for a host that composes its own Earth view (`mountEarthView` draws its own:
 * see `EarthWalker.setAvatar`). Call `update` once a frame, after the world step and the walker.
 */
export class EarthAvatar {
  private readonly figures: AmbientFigures;
  private readonly motion = new AvatarMotion();
  private current: FigureData | undefined;

  constructor(private readonly options: EarthAvatarOptions) {
    this.figures = new AmbientFigures(options.prepare);
    // One figure, always near the viewer: animate it every frame.
    this.figures.setBudget({ skinned: 1, radius: 300, posesPerFrame: 1 });
    options.parent.add(this.figures.group);
  }

  get figure(): FigureData | undefined {
    return this.current;
  }

  /** The body to draw. A new one takes over once its shaders are built. Throws when invalid. */
  setFigure(figure: FigureData | undefined): void {
    if (figure !== undefined) resolveFigureDescriptor(figure);
    this.current = figure;
  }

  /** Whether the last frame drew the figure. */
  get shown(): boolean {
    return this.figures.count > 0;
  }

  update(dt: number, frame: EarthAvatarFrame, camera: readonly [number, number, number]): void {
    const { world } = this.options;
    const mounted = world.get(PLAYER, Mounted);
    const standing = this.motion.update(frame, mounted !== undefined, world.tick, dt);
    const at = mounted === undefined ? standing : world.get(PLAYER, Transform);
    const walkers =
      frame.visible && this.current !== undefined && at !== undefined
        ? [
            this.motion.walker(
              PLAYER,
              this.current,
              at,
              mounted && seatedPose(world, mounted, this.options.cockpitFloor),
            ),
          ]
        : [];
    // Nothing drawn and nothing to draw: the common case in a cockpit.
    if (walkers.length === 0 && this.figures.count === 0) return;
    this.figures.update(walkers, camera, world.tick, world.tickRate);
  }

  dispose(): void {
    this.figures.dispose();
  }
}
