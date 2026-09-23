# 02 — Packages & Public API Sketches

Resolves brief §4 question 1 (naming/boundaries). `@bendyline/molen-*` is the final npm scope; see
[09-questions-and-risks.md](09-questions-and-risks.md) Q12.

## 1. Package list & boundaries

| Package | Contents | Depends on | Environments |
|---|---|---|---|
| `@bendyline/molen-schema` | Zod schemas (components, commands/events, keyframes/deltas, manifests, asset formats), schema registry, `validate()` + error formatter, emitted JSON Schema files | — | any |
| `@bendyline/molen-kernel` | ECS, tick `step()` + `Scheduler`, command queue/adjudication, event bus, snapshot/delta engine, sfc32 RNG + `dmath`, prefab instantiation, plugin interface. Subpaths: `./kinematics` (opt-in collision), `./scripting` (SES host), `./testing` (test world + assertion engine) | schema | Worker, Node |
| `@bendyline/molen-client` | three.js wrapper, snapshot→scene-graph sync, interpolation buffer, `AssetRegistry` (glTF/textures), camera rigs, `InputMap` + command emission, material resolver registry (rungs 1 & 6 built in), `unstable_three` escape hatch | schema, three | browser |
| `@bendyline/molen-materials` | Rungs 2–4: pixel-grid rasterizer, resvg-wasm SVG rasterizer, material-graph CPU evaluator. **No three.js import** — emits `RGBAImage`; client adapts to `DataTexture`, tooling writes PNG | schema | any |
| `@bendyline/molen-terrain` | `./kernel`: heightfield resource, bilinear sampling, terrain raycast, pure-TS PNG16 decoder, residency handling — no three.js. `./client`: ChunkManager, quadtree LOD meshing, skirts, splat material | schema (+kernel / +client per half) | per half |
| `@bendyline/molen-tooling` | `src/ops/` operation library; `molen` CLI; MCP server (`molen mcp`); Playwright capture harness; xatlas unwrap + UV template/import pipeline; terrain generator; docs search | everything | Node |
| `@bendyline/molen-docs` | Built llms.txt bundle, version-locked to the release | — | n/a |
| `@bendyline/molen-physics-rapier` *(Phase 4)* | Rapier kernel plugin: body↔ECS mirroring, snapshot blob | schema, kernel, rapier3d-compat | Worker, Node |

Boundary rationale (the calls that could have gone the other way):

- **Terrain is not kernel.** The Phase 1 flyover uses it, but kernel smallness wins; terrain
  exercises the capability-extension hooks early, which pressure-tests the architecture.
  One package with `./kernel` + `./client` subpaths rather than two packages — halves are
  versioned atomically, and two packages per capability doubles release coordination for nothing.
- **Kinematics is a kernel subpath, not a separate package.** The brief calls it "built-in",
  it has zero external deps, and Phase 2 needs it. It is opt-in via `world.use(kinematics())`
  so a flyover world pays nothing. If kernel line count creeps, extracting it later is mechanical.
- **One tooling package, not `@bendyline/molen-cli` + `@bendyline/molen-mcp`.** They share >90% of code (the ops
  library); agents face one package to learn; fixed versioning makes a split buy nothing.
- **`@bendyline/molen-materials` exists** because its evaluators must produce byte-identical pixels in
  browser (live preview), Node (tooling bakes), and CI (golden tests) — which forbids a
  three.js dependency.
- **Rung 5 (UV paint) lives in tooling**, not client: it is an import-time asset pipeline
  (unwrap/template/import), never executed by the client at runtime.

## 2. `@bendyline/molen-schema` — public surface

```ts
// Validation — the keystone of the agent feedback loop
export function validate<K extends SchemaKind>(kind: K, data: unknown): ValidationResult<K>;

export type ValidationResult<K> =
  | { ok: true; value: SchemaType<K> }
  | { ok: false; issues: ValidationIssue[]; formatted: string };

export interface ValidationIssue {
  path: string;        // JSON Pointer: "/components/transform/position"
  code: string;        // stable machine code: "invalid_type" | "unknown_key" | ...
  message: string;     // what's wrong
  expected: string;    // what valid looks like (rendered type / enum list)
  received: string;    // what was found (truncated repr)
  hint?: string;       // did-you-mean, example value, or fix suggestion
  docsRef?: string;    // "schemas/prefab.md#components"
}

// Registry — capability packages register their schemas; tooling sees one unified registry
export interface SchemaRegistry {
  register(kind: string, schema: ZodType, meta: SchemaMeta): void;
  list(): SchemaSummary[];
  get(kind: string): { zod: ZodType; jsonSchema: JsonSchema; meta: SchemaMeta } | undefined;
}

// Core wire types (full shapes in 03-data-formats.md)
export type { EntityId, Command, EngineEvent, Keyframe, Delta, SceneManifest, Prefab };
export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];
```

## 3. `@bendyline/molen-kernel` — public surface

```ts
// Components: typed handles over wire-string names
export interface ComponentType<T extends JsonObject> {
  readonly name: string;            // wire name, e.g. "transform"
  readonly schema?: JsonSchema;
  readonly defaults?: () => T;
}
export function defineComponent<T extends JsonObject>(
  name: string, opts?: { schema?: JsonSchema; defaults?: () => T }): ComponentType<T>;

// Core components shipped by the kernel (everything else comes from plugins/user code)
export const Transform: ComponentType<{ pos: Vec3; rot: Quat; scale?: Vec3 }>;
export const Lifetime:  ComponentType<{ ticksLeft: number }>;

// The world
export function createWorld(manifest: SceneManifest, opts?: WorldOptions): Promise<KernelWorld>;

export interface KernelWorld {
  // simulation
  step(): TickResult;                  // one tick, synchronous, clock-free
  stepN(n: number): TickResult;
  readonly tick: number;

  // entities & components
  spawn(prefab: string, overrides?: Record<string, JsonObject>): EntityId;
  spawnRaw(components: Record<string, JsonObject>, id?: EntityId): EntityId;
  destroy(id: EntityId): void;
  exists(id: EntityId): boolean;
  get<T extends JsonObject>(id: EntityId, c: ComponentType<T>): Readonly<T> | undefined;
  set<T extends JsonObject>(id: EntityId, c: ComponentType<T>, data: T): void;
  patch<T extends JsonObject>(id: EntityId, c: ComponentType<T>, partial: Partial<T>): void;
  remove(id: EntityId, c: ComponentType<JsonObject>): void;

  // queries (overloads to 4 components; see 04 §1.3)
  query<A extends JsonObject>(a: ComponentType<A>): QueryResult<[A]>;
  query<A extends JsonObject, B extends JsonObject>(
    a: ComponentType<A>, b: ComponentType<B>): QueryResult<[A, B]>;

  // systems, commands, events
  addSystem(system: System, opts?: { phase?: Phase; name?: string }): void;
  registerCommand<T extends JsonObject>(type: string, handler: CommandHandler<T>,
    opts?: { schema?: JsonSchema }): void;
  emit(type: string, payload: JsonValue): void;
  on(event: string, handler: EventHandler): Unsubscribe;

  // serialization
  takeKeyframe(): Keyframe;
  takeDelta(): Delta;                  // since last takeDelta/step boundary
  static fromKeyframe(k: Keyframe, opts?: WorldOptions): Promise<KernelWorld>;

  // extension
  use(plugin: KernelPlugin): void;
  describeSystems(): SystemInfo[];     // flat ordered list, for agent inspection
}

export type Phase = "commands" | "update" | "physics" | "late";
export type System = (world: KernelWorld, ctx: TickContext) => void;
export interface TickContext { tick: number; dt: number; rng: Rng; }

export interface KernelPlugin {
  name: string;
  init?(world: KernelWorld): void | Promise<void>;   // awaited before first tick
  components?: ComponentType<JsonObject>[];
  systems?: { fn: System; phase: Phase }[];
  commands?: { type: string; schema?: JsonSchema; handler: CommandHandler<JsonObject> }[];
  snapshot?: { save(): JsonValue; load(data: JsonValue): void };  // → keyframe "plugins" map
}

// Real-time driving (browser Worker host and `molen serve`); headless tests skip it
export class Scheduler {
  constructor(world: KernelWorld, opts?: { maxCatchUpTicks?: number });
  start(): void; pause(): void; step(n?: number): void;
  readonly state: "running" | "paused";
}

// ./testing subpath
export function createTestWorld(scene: SceneManifest | string): Promise<KernelWorld>;
export function runAssertions(world: KernelWorld, doc: AssertionDoc): AssertionResult[];
export function stateHash(world: KernelWorld): string;   // canonical SHA-256, see 07 §5.2
```

## 4. `@bendyline/molen-client` — public surface

```ts
export interface ClientOptions {
  canvas?: HTMLCanvasElement | OffscreenCanvas;
  renderer?: { antialias?: boolean; pixelRatio?: number; toneMapping?: "none" | "aces" };
  frameLoop?: "auto" | "manual";        // "manual" is the headless/screenshot mode
  interpolationDelayTicks?: number;     // default 1.5
  assetBaseUrl?: string;
}

export function createClient(kernelPort: MessagePortLike, opts?: ClientOptions): MolenClient;

export interface MolenClient {
  readonly camera: CameraController;
  readonly input: InputMap;
  readonly assets: AssetRegistry;
  connect(): Promise<void>;                       // handshake, initial keyframe
  renderFrame(timeMs?: number): void;             // manual mode
  sendCommand(cmd: Command): void;
  on(event: ClientEvent, fn: (...a: unknown[]) => void): Unsubscribe;
  registerMaterialResolver(extension: string, resolver: MaterialResolver): void;
  unstable_three: { scene: THREE.Scene; renderer: THREE.WebGLRenderer; camera: THREE.Camera };
  dispose(): void;
}

// Boot a client from a serialized keyframe with no live kernel (capture page, replay viewer)
export function createSnapshotViewer(keyframe: Keyframe, opts?: ClientOptions): MolenClient;
```

## 5. `@bendyline/molen-materials` — public surface

```ts
export interface RGBAImage { width: number; height: number; data: Uint8ClampedArray; }

export interface BakedMaterial {
  slots: Partial<Record<"baseColor" | "roughness" | "metalness" | "normal" | "emissive" | "ao",
                        RGBAImage>>;
  meta: { filter: "nearest" | "linear"; alphaTest?: number };
}

export function bakePixelGrid(doc: PixelGridDoc): BakedMaterial;
export function bakeMatGraph(doc: MatGraphDoc): BakedMaterial;
export function bakeSvg(svgText: string, meta?: SvgMeta): Promise<BakedMaterial>; // resvg-wasm
```

## 6. `@bendyline/molen-terrain` — public surface

```ts
// ./kernel — registers as a KernelPlugin
export function terrainPlugin(descriptor: TerrainDescriptor,
  opts?: { collision?: boolean }): KernelPlugin;
export interface TerrainSampler {
  sampleHeight(x: number, z: number): number;      // bilinear
  raycastDown(x: number, z: number): number | undefined;
  isResident(cx: number, cz: number): boolean;
}

// ./client
export function createTerrainRenderer(client: MolenClient, descriptor: TerrainDescriptor,
  opts?: TerrainRenderOptions): TerrainRenderer;
export interface TerrainRenderer {
  update(cameraPos: Vec3): void;       // residency + LOD selection, called per frame
  readonly stats: { chunksResident: number; trianglesVisible: number };
  sampleHeightLocal(x: number, z: number): number | undefined;  // client-side, camera clamp
  dispose(): void;
}
```

## 7. `@bendyline/molen-tooling` — surfaces

Three faces over one ops library (full tool contracts in
[07-tooling-and-testing.md §3](07-tooling-and-testing.md)):

```ts
// src/ops/ — every operation is (input) => Promise<output> with Zod-validated I/O
export const ops: {
  validateAsset(input: { path?: string; inline?: unknown; kind?: string }): Promise<OpResult>;
  loadScene(...): Promise<{ session: string; summary: SceneSummary }>;
  runSimulation(...): Promise<SimResult>;
  screenshotScene(...): Promise<{ imagePath: string; renderStats: RenderStats }>;
  // … one per MCP tool / CLI subcommand
};
```

- CLI: `molen validate | schema | sim | replay | diff | shot | material | import | uv | terrain | docs | test | mcp`
- MCP: `molen mcp` starts a stdio server; each tool's `inputSchema` **is** the op's Zod schema.

## 8. The Script API (the agent-facing verb set)

Game logic written by agents runs sandboxed inside the kernel
([04-kernel-design.md §8](04-kernel-design.md)) against this surface — **twelve verbs**, the
primary AI interface. Every addition is a documentation and legibility cost; be stingy.

```ts
export interface ScriptAPI {
  spawn(prefab: string, overrides?: Record<string, JsonObject>): EntityId;
  destroy(id: EntityId): void;
  exists(id: EntityId): boolean;

  get<T extends JsonObject>(id: EntityId, c: ComponentType<T>): Readonly<T> | undefined;
  set<T extends JsonObject>(id: EntityId, c: ComponentType<T>, data: T): void;
  patch<T extends JsonObject>(id: EntityId, c: ComponentType<T>, partial: Partial<T>): void;
  remove(id: EntityId, c: ComponentType<JsonObject>): void;

  query: KernelWorld["query"];
  on(event: "tick" | string, handler: (payload: JsonValue, ctx: TickContext) => void): Unsubscribe;
  emit(type: string, payload: JsonValue): void;

  // capability-provided; present only when the plugin is active (typed optional)
  raycast?(origin: Vec3, dir: Vec3, maxDist: number, mask?: number): RayHit | null;

  rng(): number;            // [0,1) from the world's seeded stream
  readonly tick: number;
  readonly dt: number;
  math: DMath;              // deterministic math indirection (04 §5.3)
}
```
