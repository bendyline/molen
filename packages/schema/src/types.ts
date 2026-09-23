import type { InputProfile } from './input';
import type { JsonObject, JsonValue } from './json';

/** Runtime ids are "e" + sequence; authored ids are any other non-empty string. */
export type EntityId = string;
export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];

export interface Command {
  kind: 'command';
  /** Per-source monotonic sequence number: dedupe + deterministic total order. */
  seq: number;
  /** Peer/agent identity: "local" in single-player, "agent:..." from tooling. */
  source: string;
  /** Requested execution tick (client-stamped). */
  tick: number;
  /** Set by the kernel when a late command is re-stamped; replay logs store it. */
  tickExecuted?: number;
  type: string;
  payload: JsonValue;
}

export interface EngineEvent {
  type: string;
  payload: JsonValue;
}

/** Component name -> pure-JSON component data. */
export type ComponentMap = Record<string, JsonObject>;

export interface Prefab {
  format?: 'molen/prefab@1';
  /** Name of a prefab in the same manifest to inherit components from (deep-merged). */
  extends?: string;
  /** Project-registry type this prefab specializes (its defaults merge in below `extends`). */
  type?: string;
  components: ComponentMap;
}

export interface SceneEntity {
  /** Authored id; must not match /^e\d+$/, be all digits, or start with "$" (reserved). */
  id?: string;
  /** Project-registry type to instantiate (lowest layer of the component stack). */
  type?: string;
  prefab?: string;
  /** Components layered over the type/prefab base (a partial when a base is present). */
  components?: ComponentMap;
}

/** A command type the scene accepts; scripts attach handlers with `molen.onCommand`. */
export interface SceneCommandDef {
  doc?: string;
  /** JSON Schema for the payload (see schema/src/commands.ts for the subset); omitted = any. */
  payload?: JsonObject;
}

/** A declared custom component: docs + examples, optionally a JSON Schema for its data. */
export interface CustomComponentDecl {
  description: string;
  examples: JsonValue[];
  schema?: JsonObject;
}

export interface ScriptRef {
  /** All durable state is in molen.state/components/plugins, never mutable closures. */
  checkpoint?: 'state';
  id: string;
  /** Inline JavaScript text (exactly one of `code` | `path`). */
  code?: string;
  /** Scene-file-relative path to a JS text file; tooling resolves it into `code` pre-build. */
  path?: string;
  config: JsonObject;
}

export type SceneCamera =
  | {
      mode: 'follow';
      entity: EntityId;
      offset: Vec3;
      lookOffset: Vec3;
      space?: 'world' | 'local';
      fov?: number;
    }
  | { mode: 'fixed'; position: Vec3; lookAt?: Vec3; fov?: number }
  | {
      mode: 'free-fly';
      position: Vec3;
      lookAt?: Vec3;
      fov?: number;
      moveSpeed: number;
      boost: number;
    }
  | {
      mode: 'top-down-ortho';
      center: [number, number];
      viewHeight: number;
      cameraHeight?: number;
    };

export type InputEmitRule =
  | { kind: 'press'; action: string; command: string; payload: JsonObject }
  | { kind: 'release'; action: string; command: string; payload: JsonObject }
  | { kind: 'axis'; action: string; negative?: string; command: string; field: string }
  | {
      kind: 'axis2d';
      xNeg: string;
      xPos: string;
      yNeg: string;
      yPos: string;
      command: string;
      field: string;
    };

export interface SceneInput extends InputProfile {
  /** Device code (KeyW, Mouse0, …) -> action name; the client InputMap's exact shape. */
  bindings: Record<string, string>;
  /** Named complete binding sets. The root bindings are used when profile is absent. */
  profiles?: Record<string, InputProfile>;
  /** Initial profile name; hosts switch at runtime with InputMap.setProfile(). */
  profile?: string;
  /** Declarative action -> command emission rules the client runs; the kernel adjudicates. */
  emit: InputEmitRule[];
}

export interface SceneTerrainRef {
  /** Scene-file-relative path to a molen/terrain@2 descriptor (v1 auto-upgrades). */
  descriptor: string;
  /** Scene-file-relative path to a 16-bit grayscale heightmap PNG. */
  heightmap?: string;
}

export interface ScenePhysics {
  /** kinematics and platformer are cross-platform deterministic; rapier is same-platform. */
  engine: 'none' | 'kinematics' | 'platformer' | 'rapier';
  gravity?: Vec3;
  /** Ground for kinematic bodies: flat y=0 (default) or the scene's terrain heightfield. */
  ground?: 'flat' | 'terrain';
  /** Install the kernel character controller (character + moveIntent). Not with rapier. */
  character?: boolean;
}

export interface SceneManifest {
  format: 'molen/scene@3';
  name: string;
  seed: string | number;
  /** Fixed timestep rate in Hz; immutable for the world's lifetime. */
  tickRate: number;
  lateCommands: 'rewrite' | 'reject';
  keyframeInterval: number;
  prefabs: Record<string, Prefab>;
  entities: SceneEntity[];
  scripts: ScriptRef[];
  /** Command types this scene accepts, with optional payload schemas. */
  commands: Record<string, SceneCommandDef>;
  /** Custom component vocabulary this scene introduces. */
  components: Record<string, CustomComponentDecl>;
  camera?: SceneCamera;
  input?: SceneInput;
  terrain?: SceneTerrainRef;
  physics?: ScenePhysics;
}

// --- project + type registry (molen/project@1, molen/types@1) ---

export interface EntityTypeDef {
  doc?: string;
  /** Full id of another registry type to inherit from (deep-merged, ancestor-first). */
  extends?: string;
  /** Default components applied below prefab/entity data. */
  components: ComponentMap;
  /** Project asset ids this type depends on. */
  assets: string[];
  /** Deterministic behavior installed once per world for this external entity type. */
  scripts: ScriptRef[];
}

export interface TypesDoc {
  format: 'molen/types@1';
  /** Dotted namespace every type id in this file must live under. */
  namespace: string;
  /** Matched against project reservations by `molen types check`. */
  owner?: string;
  doc?: string;
  types: Record<string, EntityTypeDef>;
}

export interface NamespaceReservation {
  namespace: string;
  owner: string;
  note?: string;
}

export interface ProjectManifest {
  format: 'molen/project@1';
  name: string;
  /** Engine version this project targets (informational). */
  engine?: string;
  /** Scene name -> project-relative scene file path. */
  scenes: Record<string, string>;
  defaultScene?: string;
  /** Project-relative paths to molen/types@1 documents. */
  types: string[];
  /** Asset id -> project-relative path to its molen asset sidecar. */
  assets: Record<string, string>;
  /** Namespace ownership for type + asset ids (multi-agent vocabulary partitioning). */
  reservations: NamespaceReservation[];
  /** Default setup/Experience module for sim/shot (project-relative). */
  setup?: string;
  /** Custom component vocabulary shared by every scene in the project. */
  components: Record<string, CustomComponentDecl>;
  codegen: { out: string };
}

export interface RngState {
  algo: 'sfc32';
  state: [number, number, number, number];
}

/** Accepted future commands and live-source deduplication cursors. */
export interface CommandQueueState {
  pending: Command[];
  highestSeq: Record<string, number>;
  latePolicy: 'rewrite' | 'reject';
}

export interface Keyframe {
  kind: 'keyframe';
  v: 1;
  engine: string;
  tick: number;
  tickRate: number;
  seed: string | number;
  nextEntitySeq: number;
  /** Explicit creation order (including integer-like ids); absent in older saves. */
  entityOrder?: EntityId[];
  /** Absent in older saves, which restore with an empty queue. */
  commands?: CommandQueueState;
  rng: RngState;
  entities: Record<EntityId, ComponentMap>;
  /** Opaque per-plugin snapshot blobs (e.g. Rapier). */
  plugins: Record<string, JsonValue>;
}

export interface Delta {
  kind: 'delta';
  v: 1;
  tick: number;
  baseTick: number;
  spawned: Record<EntityId, ComponentMap>;
  destroyed: EntityId[];
  /** Whole-component replacement granularity. */
  changed: Record<EntityId, ComponentMap>;
  removedComponents: Record<EntityId, string[]>;
  events: EngineEvent[];
}

export interface ReplayFixture {
  format: 'molen/replay@1';
  engine: string;
  scene?: string;
  initialKeyframe?: Keyframe;
  seed?: string | number;
  ticks: number;
  commands: Command[];
  expected?: { stateHash: string; eventCount?: number; tickHashes?: string[] };
}

export type SelectOp =
  | 'eq'
  | 'approx'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'count'
  | 'exists'
  | 'all_eq'
  | 'all_approx'
  | 'all_gt'
  | 'all_gte'
  | 'all_lt'
  | 'all_lte'
  | 'any_eq'
  | 'any_approx'
  | 'any_gt'
  | 'any_gte'
  | 'any_lt'
  | 'any_lte';

export interface SelectAssertion {
  /** Selector DSL: "#id", "tag:x", "has:comp", value paths like ".health.hp". */
  select: string;
  op: SelectOp;
  value?: JsonValue;
  tol?: number;
}

export interface EventAssertion {
  event: string;
  op: 'occurred' | 'never' | 'count' | 'at_tick';
  value?: number;
}

export type Assertion = SelectAssertion | EventAssertion;

export interface AssertionDoc {
  format: 'molen/assert@1';
  assertions: Assertion[];
}
