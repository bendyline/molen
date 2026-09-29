/** Typed component handles and data shapes for the ambient capability. */

import {
  type ComponentType,
  defineComponent,
  type JsonObject,
} from '@bendyline/molen-kernel/world';
import {
  AMBIENT_AGENT_COMPONENT,
  AMBIENT_OBSERVER_COMPONENT,
  AMBIENT_ROLE_COMPONENT,
  AMBIENT_STATE_COMPONENT,
} from './schema';

/** An ambient NPC class. */
export type AmbientKind = 'car' | 'pedestrian' | 'train' | 'aircraft';

export const AMBIENT_KINDS: readonly AmbientKind[] = ['car', 'pedestrian', 'train', 'aircraft'];

/** An aircraft corridor: a straight line flown at linearly varying altitude. */
export interface AmbientAirCorridor extends JsonObject {
  x: number;
  z: number;
  dx: number;
  dz: number;
  y0: number;
  y1: number;
  length: number;
}

export interface AmbientAgentData extends JsonObject {
  kind: AmbientKind;
  type: string;
  color?: string;
  lane: string;
  s: number;
  speed: number;
  prev?: string;
  next?: string;
  seed: number;
  length: number;
  width: number;
  state: 'move' | 'wait' | 'dwell' | 'idle';
  since: number;
  hops: number;
  hidden?: boolean;
  consist?: string;
  carIndex?: number;
  trail?: string[];
  served?: string;
  air?: AmbientAirCorridor;
  spawnedTick: number;
}

export interface AmbientObserverData extends JsonObject {
  radius?: number;
  despawnRadius?: number;
  density?: number;
}

export interface AmbientRoleVisual extends JsonObject {
  wheelNodes?: string[];
  frontWheelNodes?: string[];
  paintMaterial?: string;
  wheelRadius?: number;
  wheelbase?: number;
  rotors?: string[];
  gearNodes?: string[];
}

export interface AmbientRoleData extends JsonObject {
  role: 'car' | 'bus' | 'rail' | 'aircraft';
  length?: number;
  width?: number;
  height?: number;
  cruise?: number;
  max?: number;
  weight?: number;
  cars?: number;
  colors?: string[];
  visual?: AmbientRoleVisual;
}

export interface AmbientObserverState extends JsonObject {
  pos?: [number, number, number];
  forward?: [number, number];
  entity?: string;
  setAtTick: number;
}

export interface AmbientStateData extends JsonObject {
  observer?: AmbientObserverState;
  nextSeq: number;
  spawned: number;
  despawned: number;
  policy?: JsonObject;
}

export const AmbientAgent: ComponentType<AmbientAgentData> =
  defineComponent<AmbientAgentData>(AMBIENT_AGENT_COMPONENT);
export const AmbientObserver: ComponentType<AmbientObserverData> =
  defineComponent<AmbientObserverData>(AMBIENT_OBSERVER_COMPONENT);
export const AmbientRole: ComponentType<AmbientRoleData> =
  defineComponent<AmbientRoleData>(AMBIENT_ROLE_COMPONENT);
export const AmbientState: ComponentType<AmbientStateData> =
  defineComponent<AmbientStateData>(AMBIENT_STATE_COMPONENT);

/** The singleton entity holding ambient bookkeeping. */
export const AMBIENT_ENTITY: '$ambient' = '$ambient';
