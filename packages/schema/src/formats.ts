import { z } from 'zod';
import type { AssetSidecar } from './assets';
import { compileCommandPayload } from './commands';
import {
  type ComponentValidateOptions,
  componentMapIssues,
  createComponentRegistry,
  type DeclaredComponent,
} from './components';
import { inputProfileIssues, inputProfileSchema, inputProfileShape } from './input';
import {
  blockingIssues,
  formatIssues,
  noticeIssues,
  type ValidationIssue,
  type ValidationResult,
} from './issues';
import type { JsonValue } from './json';
import { unsafePatterns } from './regex-safety';
import { getLegacySchema, getSchema, registerSchema, schemaKinds } from './registry';
import { type ResolvedTypes, resolveEntityComponents, resolvePrefab } from './scene-resolve';
import type { SourceBundle } from './source-bundle';
import { sceneTypeRefIssues } from './type-registry';
import type {
  AssertionDoc,
  Command,
  Delta,
  Keyframe,
  Prefab,
  ProjectManifest,
  ReplayFixture,
  SceneInput,
  SceneManifest,
  TypesDoc,
} from './types';
import { nearest, zodErrorToIssues } from './zod-issues';

// Schemas are module-internal: the exported API contract is the hand-written interfaces in
// types.ts; Zod is the validation engine behind validate() and the registry.
// Wire schemas use only the JSON-Schema-expressible subset (no transforms/refinements) so
// the emitted JSON Schemas agree with Zod verdicts — enforced by the cross-validation test.

// Every field carries a `.describe()` so the emitted JSON Schemas (molen schema get, get_schema,
// docs-src/schemas/*.md) document semantics, units, and axis conventions: Y-up, meters, time in
// ticks at the scene tickRate (dt = 1/tickRate s), quaternions [x, y, z, w], colors "#rrggbb".

const jsonValue = z.json();
const componentData = z.record(z.string(), jsonValue);
const componentMap = z.record(z.string(), componentData);
const entityId = z.string().min(1);
const authoredId = z
  .string()
  .min(1)
  .regex(
    /^(?!e\d+$)(?!\d+$)(?!\$)/,
    'authored entity ids must not look like runtime ids ("e" + number), be all digits (JSON objects reorder integer-like keys, which would break creation-order iteration after save/load), or start with "$" (kernel singletons)',
  );
const seedValue = z.union([z.string(), z.number()]);
const tickNumber = z.int().nonnegative();

const commandSchema = z.strictObject({
  kind: z.literal('command').describe("Envelope discriminator; always 'command'."),
  seq: z
    .int()
    .nonnegative()
    .describe('Monotonic sequence number assigned by the source; orders commands within a tick.'),
  source: z.string().min(1).describe("Origin of the command, e.g. 'local' or 'agent:<name>'."),
  tick: tickNumber.describe('Tick the command was submitted for.'),
  tickExecuted: tickNumber
    .describe(
      'Tick the kernel actually executed the command at (set when a late command was rewritten to a later tick).',
    )
    .optional(),
  type: z
    .string()
    .min(1)
    .describe(
      'Command type; must match a registered handler and, for molen/scene@3, an entry under the scene `commands`.',
    ),
  payload: jsonValue.describe(
    'Command payload (any JSON); validated against the declared payload schema when the scene declares one.',
  ),
});

const eventSchema = z.strictObject({
  type: z.string().min(1).describe('Event type name.'),
  payload: jsonValue.describe('Event payload (any JSON).'),
});

// Dotted identifier grammars shared by the type registry and project manifest.
// namespaceId: 1+ dot-segments (also the asset-id grammar); dottedId: 2+ (a type id always
// carries its namespace as the first segment).
const namespaceId = z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/, {
  error: 'must be dotted lower_snake segments, e.g. "train" or "train.rolling_stock"',
});
const dottedId = z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/, {
  error: 'must be a namespaced dotted id, e.g. "train.locomotive"',
});
const relPath = z
  .string()
  .min(1)
  .regex(/^(?![A-Za-z]:|[/\\])(?!.*\\)(?!.*(?:^|\/)\.\.(?:\/|$)).+$/, {
    error:
      'must be a contained relative POSIX path (no drive letters, leading/back slashes, or ".." segments)',
  });

const fixedNumbers = (length: number) => z.array(z.number()).length(length);

const prefabSchema = z.strictObject({
  format: z
    .literal('molen/prefab@1')
    .describe("Format envelope 'molen/prefab@1' (optional when the prefab is inlined in a scene).")
    .optional(),
  /** Name of a prefab in the same manifest to inherit components from (deep-merged). */
  extends: z
    .string()
    .min(1)
    .describe('Name of a prefab in the same manifest to inherit components from (deep-merged).')
    .optional(),
  /** Project-registry type this prefab specializes. */
  type: dottedId
    .describe("Project-registry type id this prefab specializes, e.g. 'train.locomotive'.")
    .optional(),
  components: componentMap
    .describe(
      'Component name to pure-JSON component data (deep-merged over the extends/type base).',
    )
    .default({}),
});

const sceneEntitySchema = z.strictObject({
  id: authoredId
    .describe("Authored entity id, stable across save/load; omitted = runtime id 'e<n>'.")
    .optional(),
  type: dottedId
    .describe("Project-registry type id to instantiate, e.g. 'train.locomotive'.")
    .optional(),
  prefab: z.string().min(1).describe('Name of a prefab in this scene to instantiate.').optional(),
  /** Components layered over the type/prefab base (a partial when a base is present). */
  components: componentMap
    .describe(
      'Component name to component data, layered over the type/prefab base (a partial when a base is present).',
    )
    .optional(),
});

/** Scene-declared command: an optional doc and an optional JSON Schema for the payload. */
const sceneCommandDefSchema = z.strictObject({
  doc: z.string().describe('Human/agent description of what the command does.').optional(),
  /** JSON Schema for the payload; omitted = any JSON. See schema/src/commands.ts for the subset. */
  payload: componentData
    .describe(
      'JSON Schema (object/array/number/integer/string/boolean subset) the payload must satisfy; omitted = any JSON.',
    )
    .optional(),
});

/** A project- or scene-declared custom component: docs + examples, optionally a JSON Schema. */
const customComponentDeclSchema = z.strictObject({
  description: z.string().min(1).describe('One-line human/agent description of the component.'),
  examples: z
    .array(jsonValue)
    .min(1)
    .describe('At least one valid example of the component data (feeds hints and docs).'),
  /** JSON Schema for the component data; omitted = any object. */
  schema: componentData
    .describe(
      'JSON Schema (object/array/number/integer/string/boolean subset) for the component data; omitted = any object.',
    )
    .optional(),
});
const customComponentName = z.string().regex(/^[a-zA-Z]\w*$/, {
  error: 'component names are identifiers, e.g. "team" or "spawnPoint"',
});

const scriptRefSchema = z.strictObject({
  checkpoint: z
    .literal('state')
    .describe(
      'Opt into checkpoint restore: keep all durable state in molen.state, components, or snapshot providers, never mutable closures. Without this declaration replay seeks from the beginning.',
    )
    .optional(),
  id: z.string().min(1).describe('Script id, unique within the scene.'),
  code: z
    .string()
    .min(1)
    .describe('Inline JavaScript source (exactly one of code or path).')
    .optional(),
  // .regex (not .refine): z.toJSONSchema drops refinements silently, so a refined suffix check
  // would leave the emitted scene schema accepting "scripts/x.txt" that validate() rejects.
  path: relPath
    .regex(/\.(?:js|ts)$/, { error: 'script path must end in .js or .ts' })
    .describe(
      'Scene-relative path to a script file, .js or .ts (exactly one of code or path). A .ts file has its types erased when the scene is loaded.',
    )
    .optional(),
  config: componentData
    .describe('Frozen JSON config exposed to the script as `config`.')
    .default({}),
});

const cameraPosition = fixedNumbers(3).describe('Camera position [x, y, z] in meters (Y-up).');
const cameraLookAt = fixedNumbers(3)
  .describe('Point [x, y, z] in meters the camera looks at (default: the origin).')
  .optional();
const cameraFov = z
  .number()
  .min(1)
  .max(179)
  .describe('Vertical field of view in degrees.')
  .optional();
const sceneCameraSchema = z.discriminatedUnion('mode', [
  z.strictObject({
    mode: z
      .literal('follow')
      .describe(
        'Perspective camera tracking an interpolated entity transform; works in live play and capture.',
      ),
    entity: z.string().min(1).describe('Entity to follow (need not have a renderable).'),
    offset: fixedNumbers(3).describe('Camera offset [x,y,z] in meters from the target.'),
    lookOffset: fixedNumbers(3).describe(
      'Look-at offset from the target; must differ from offset.',
    ),
    space: z
      .enum(['world', 'local'])
      .describe(
        'World-axis offsets (default), or offsets rotated by the target quaternion (first person/chase).',
      )
      .optional(),
    fov: cameraFov,
  }),
  z.strictObject({
    mode: z.literal('fixed').describe('Static perspective camera.'),
    position: cameraPosition,
    lookAt: cameraLookAt,
    fov: cameraFov,
  }),
  z.strictObject({
    mode: z.literal('free-fly').describe('Perspective camera the user flies with keyboard/mouse.'),
    position: cameraPosition,
    lookAt: cameraLookAt,
    fov: cameraFov,
    moveSpeed: z
      .number()
      .positive()
      .describe('Base fly speed in meters per second (default 10).')
      .default(10),
    boost: z
      .number()
      .positive()
      .describe('Speed multiplier while the boost key is held (default 4).')
      .default(4),
  }),
  z.strictObject({
    mode: z
      .literal('top-down-ortho')
      .describe(
        'Orthographic camera looking straight down (-Y); screen-up is -z (north), screen-down is +z (south).',
      ),
    center: fixedNumbers(2).describe('World [x, z] in meters the view centers on.'),
    viewHeight: z
      .number()
      .positive()
      .describe(
        'World-space height in meters of the visible area; width follows the viewport aspect.',
      ),
    cameraHeight: z
      .number()
      .positive()
      .describe('Camera height in meters above the y = 0 plane (default 200).')
      .optional(),
  }),
]);

const inputAction = (what: string) =>
  z
    .string()
    .min(1)
    .describe(`Input action name produced by keyboard, button, or axis bindings ${what}.`);
const emitCommand = z
  .string()
  .min(1)
  .describe('Command type to emit; must be declared under the scene `commands`.');
const emitPayload = componentData.describe('Fixed JSON payload sent with the command.').default({});
const inputEmitRuleSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('axis').describe('Emit a numeric action value when it changes.'),
    action: inputAction('whose numeric value drives the axis'),
    negative: inputAction('to subtract from the value (optional keyboard opposite)').optional(),
    command: emitCommand,
    field: z
      .string()
      .min(1)
      .describe("Payload field receiving the number (default 'value').")
      .default('value'),
  }),
  z.strictObject({
    kind: z.literal('press').describe('Emit once when the action becomes active.'),
    action: inputAction('that triggers the command'),
    command: emitCommand,
    payload: emitPayload,
  }),
  z.strictObject({
    kind: z.literal('release').describe('Emit once when the action becomes inactive.'),
    action: inputAction('that triggers the command'),
    command: emitCommand,
    payload: emitPayload,
  }),
  z.strictObject({
    kind: z
      .literal('axis2d')
      .describe(
        'Emit the command whenever the [x, y] axis vector built from four actions changes.',
      ),
    xNeg: inputAction('that drives x toward -1 (west)'),
    xPos: inputAction('that drives x toward +1 (east)'),
    yNeg: inputAction('that drives y toward -1 (north / screen-up)'),
    yPos: inputAction('that drives y toward +1 (south / screen-down, i.e. +z)'),
    command: emitCommand,
    field: z
      .string()
      .min(1)
      .describe("Payload field that receives the [x, y] vector (default 'dir').")
      .default('dir'),
  }),
]);

const sceneInputSchema = z.strictObject({
  bindings: z
    .record(z.string().min(1), z.string().min(1))
    .describe("KeyboardEvent.code (e.g. 'KeyW') to input action name."),
  axes: inputProfileShape.axes,
  buttons: inputProfileShape.buttons,
  profiles: z
    .record(z.string().min(1), inputProfileSchema)
    .describe('Named complete binding sets for walking, flying, driving, or other use cases.')
    .optional(),
  profile: z
    .string()
    .min(1)
    .describe('Initial profile name; absent uses the root bindings.')
    .optional(),
  emit: z
    .array(inputEmitRuleSchema)
    .describe('Rules that turn input actions into commands.')
    .default([]),
});

const sceneTerrainRefSchema = z.strictObject({
  descriptor: relPath.describe('Scene-relative path to the molen/terrain descriptor JSON.'),
  heightmap: relPath
    .describe(
      'Scene-relative path to a PNG16 heightmap used for headless ground sampling / collision.',
    )
    .optional(),
});

const scenePhysicsSchema = z.strictObject({
  /** kinematics and platformer are cross-platform deterministic; rapier is same-platform. */
  engine: z
    .enum(['none', 'kinematics', 'platformer', 'rapier'])
    .describe(
      'Physics engine: none, kinematics (cross-platform deterministic 2.5D in the XZ plane), platformer (cross-platform deterministic XY swept boxes), or rapier (same-platform deterministic 3D).',
    ),
  gravity: fixedNumbers(3)
    .describe('Gravity [x, y, z] in meters per second squared (rapier; default [0, -9.81, 0]).')
    .optional(),
  /** Ground for kinematic bodies: flat y=0 (default) or the scene's terrain heightfield. */
  ground: z
    .enum(['flat', 'terrain'])
    .describe(
      "Ground for kinematic bodies: flat y = 0 (default) or the scene's terrain heightfield.",
    )
    .optional(),
  /** Install the kernel character controller (character + moveIntent). Not with rapier. */
  character: z
    .boolean()
    .describe(
      'Install the kernel character controller (character + moveIntent components); not allowed with rapier.',
    )
    .optional(),
});

const sceneSchema = z.strictObject({
  format: z.literal('molen/scene@3').describe("Format envelope; always 'molen/scene@3'."),
  name: z.string().min(1).describe('Human-readable scene name.'),
  seed: seedValue.describe('Deterministic RNG seed (string or number; default 0).').default(0),
  tickRate: z
    .int()
    .min(1)
    .max(240)
    .describe('Simulation ticks per second, 1..240 (default 30); dt = 1/tickRate seconds.')
    .default(30),
  lateCommands: z
    .enum(['rewrite', 'reject'])
    .describe(
      'Commands that arrive for a past tick: rewrite to the current tick (default) or reject.',
    )
    .default('rewrite'),
  keyframeInterval: z
    .int()
    .min(1)
    .describe('Ticks between full keyframe snapshots (default 60).')
    .default(60),
  prefabs: z
    .record(z.string(), prefabSchema)
    .describe('Prefab name to prefab (entity templates instantiated by entities[].prefab).')
    .default({}),
  entities: z
    .array(sceneEntitySchema)
    .describe('Entities instantiated at tick 0, in order.')
    .default([]),
  scripts: z
    .array(scriptRefSchema)
    .describe(
      'Deterministic scene scripts (inline code or file refs). Evaluated with the authority of ' +
        'the host process, so treat a manifest like source code.',
    )
    .default([]),
  /** Command types this scene accepts (scripts attach handlers with molen.onCommand). */
  commands: z
    .record(z.string().min(1), sceneCommandDefSchema)
    .describe(
      'Command types this scene accepts, with optional doc and payload schema (scripts attach handlers via molen.onCommand).',
    )
    .default({}),
  /** Custom component vocabulary this scene introduces (known to validation + docs). */
  components: z
    .record(customComponentName, customComponentDeclSchema)
    .describe(
      'Custom component vocabulary this scene introduces (description + examples, optional schema); known to validation and docs.',
    )
    .default({}),
  camera: sceneCameraSchema.describe('Initial client camera.').optional(),
  input: sceneInputSchema
    .describe('Keyboard bindings and the rules that turn them into commands.')
    .optional(),
  terrain: sceneTerrainRefSchema
    .describe('Streamed heightmap terrain attached to the scene.')
    .optional(),
  physics: scenePhysicsSchema.describe('Physics engine selection and settings.').optional(),
});

const rngStateSchema = z.strictObject({
  algo: z.literal('sfc32').describe("RNG algorithm; always 'sfc32'."),
  // array().length(4) (not tuple) so the emitted JSON Schema carries minItems/maxItems;
  // z.tuple emits prefixItems only, which Ajv accepts at any length. The fixed-arity type
  // lives in the hand-written RngState interface, which is the published contract.
  state: z
    .array(z.int().nonnegative())
    .length(4)
    .describe('The four 32-bit unsigned words of sfc32 state.'),
});

const keyframeSchema = z.strictObject({
  kind: z.literal('keyframe').describe("Envelope discriminator; always 'keyframe'."),
  v: z.literal(1).describe('Keyframe format version; always 1.'),
  engine: z.string().min(1).describe('Engine version that produced the snapshot.'),
  tick: tickNumber.describe('Tick the snapshot was taken at (state after this tick).'),
  tickRate: z
    .int()
    .min(1)
    .max(240)
    .describe('Simulation ticks per second of the world; dt = 1/tickRate seconds.'),
  seed: seedValue.describe('World RNG seed (string or number).'),
  nextEntitySeq: z
    .int()
    .nonnegative()
    .describe("Next runtime entity sequence number (runtime ids are 'e<seq>')."),
  entityOrder: z
    .array(entityId)
    .describe('Entity creation order; older snapshots fall back to object key order.')
    .optional(),
  commands: z
    .strictObject({
      pending: z.array(commandSchema),
      highestSeq: z.record(z.string(), z.int().nonnegative()),
      latePolicy: z.enum(['rewrite', 'reject']),
    })
    .describe('Accepted future commands and deduplication cursors.')
    .optional(),
  rng: rngStateSchema.describe('Exact RNG state so the run resumes deterministically.'),
  entities: z
    .record(entityId, componentMap)
    .describe('Entity id to component map: the complete world state.'),
  plugins: z
    .record(z.string(), jsonValue)
    .describe('Opaque per-plugin snapshot blobs keyed by plugin name.')
    .default({}),
});

const deltaSchema = z.strictObject({
  kind: z.literal('delta').describe("Envelope discriminator; always 'delta'."),
  v: z.literal(1).describe('Delta format version; always 1.'),
  tick: tickNumber.describe('Tick this delta describes (state after this tick).'),
  baseTick: tickNumber.describe('Tick the delta is relative to (normally tick - 1).'),
  spawned: z
    .record(entityId, componentMap)
    .describe('Entities created this tick with their full component maps.')
    .default({}),
  destroyed: z.array(entityId).describe('Ids of entities destroyed this tick.').default([]),
  changed: z
    .record(entityId, componentMap)
    .describe(
      'Entities whose components changed, each carrying the full new value of every changed component (whole-component granularity).',
    )
    .default({}),
  removedComponents: z
    .record(entityId, z.array(z.string()))
    .describe('Entity id to names of components removed this tick.')
    .default({}),
  events: z
    .array(eventSchema)
    .describe('World events emitted this tick, in emission order.')
    .default([]),
});

const replayFields = {
  format: z.literal('molen/replay@1').describe("Format envelope; always 'molen/replay@1'."),
  engine: z.string().min(1).describe('Engine version the fixture was recorded with.'),
  seed: seedValue
    .describe('Seed override (string or number; defaults to the scene seed).')
    .optional(),
  ticks: z.int().positive().describe('Number of ticks to simulate.'),
  commands: z
    .array(commandSchema)
    .describe('Command log to feed in, ordered by tick then seq.')
    .default([]),
  expected: z
    .strictObject({
      stateHash: z.string().min(1).describe('Expected world-state hash after the final tick.'),
      eventCount: z
        .int()
        .nonnegative()
        .describe('Expected total number of events emitted over the run.')
        .optional(),
      /** Optional per-tick reference hashes (hash after tick i) for divergence localization. */
      tickHashes: z
        .array(z.string().min(1))
        .describe(
          'Per-tick reference hashes (entry i = hash after tick i) used to localize divergence.',
        )
        .optional(),
    })
    .describe('Expected outcome; a mismatch is a determinism failure.')
    .optional(),
};
const replayScene = relPath.describe('Fixture-relative path to the scene file to boot from.');
const replayInitialKeyframe = keyframeSchema.describe(
  'Keyframe to start from instead of (or in addition to) booting the scene.',
);
const replaySchema = z.union([
  z.strictObject({
    ...replayFields,
    scene: replayScene,
    initialKeyframe: replayInitialKeyframe.optional(),
  }),
  z.strictObject({
    ...replayFields,
    scene: replayScene.optional(),
    initialKeyframe: replayInitialKeyframe,
  }),
]);

const selectOps = [
  'eq',
  'approx',
  'gt',
  'gte',
  'lt',
  'lte',
  'count',
  'exists',
  'all_eq',
  'all_approx',
  'all_gt',
  'all_gte',
  'all_lt',
  'all_lte',
  'any_eq',
  'any_approx',
  'any_gt',
  'any_gte',
  'any_lt',
  'any_lte',
] as const;

const selectAssertionSchema = z.strictObject({
  select: z
    .string()
    .min(1)
    .describe(
      "Entity selector plus optional value path: '#id', 'tag:name', 'has:component', e.g. '#player .health.hp'.",
    ),
  op: z
    .enum(selectOps)
    .describe(
      'Comparison: eq/approx/gt/gte/lt/lte on the single match, count/exists on the match set, all_*/any_* over every match.',
    ),
  value: jsonValue
    .describe('Expected value (for count: the expected number of matches).')
    .optional(),
  tol: z
    .number()
    .positive()
    .describe('Absolute tolerance for approx ops (default 1e-6).')
    .optional(),
});

const eventAssertionSchema = z.strictObject({
  event: z.string().min(1).describe('World event type to check.'),
  op: z
    .enum(['occurred', 'never', 'count', 'at_tick'])
    .describe(
      'occurred (at least once), never, count (value = expected count), or at_tick (value = tick it must have occurred at).',
    ),
  value: z.number().describe('Expected count for count, or tick for at_tick.').optional(),
});

const assertSchema = z.strictObject({
  format: z.literal('molen/assert@1').describe("Format envelope; always 'molen/assert@1'."),
  assertions: z
    .array(z.union([selectAssertionSchema, eventAssertionSchema]))
    .min(1)
    .describe('Assertions evaluated after the run (at least one).'),
});

// --- Examples (mandatory; feed docs, hints, and the cross-validation test) ---

const exampleKeyframe = {
  kind: 'keyframe',
  v: 1,
  engine: '0.0.1',
  tick: 120,
  tickRate: 30,
  seed: 'demo',
  nextEntitySeq: 2,
  rng: { algo: 'sfc32', state: [738291, 102, 99182, 4] },
  entities: {
    player: { transform: { pos: [0, 1, 0], rot: [0, 0, 0, 1] }, health: { hp: 80 } },
    e1: { transform: { pos: [9, 0, 3], rot: [0, 0, 0, 1] }, lifetime: { ticksLeft: 12 } },
  },
  plugins: {},
};

registerSchema('command', commandSchema, {
  id: 'molen/command@1',
  title: 'Command envelope',
  description:
    'Client/agent intent submitted to the kernel for validation and adjudication at a tick.',
  examples: [
    {
      kind: 'command',
      seq: 1,
      source: 'local',
      tick: 45,
      type: 'spawn_cube',
      payload: { pos: [0, 2, 0] },
    },
  ],
  docsRef: 'schemas/command.md',
});

function escapePointer(seg: string): string {
  return seg.replaceAll('~', '~0').replaceAll('/', '~1');
}

/**
 * Cross-field checks Zod can't express: script code|path exclusivity, duplicate entity ids,
 * prefab references and cycles, declared commands vs input emit rules, payload schemas.
 */
function validateScene(data: unknown): ValidationIssue[] {
  const scene = data as {
    entities: { id?: string; prefab?: string }[];
    prefabs: Record<string, { extends?: string }>;
    scripts: { id: string; code?: string; path?: string }[];
    commands: Record<string, { payload?: unknown }>;
    physics?: { engine: string; character?: boolean };
    camera?: { mode: string; offset?: number[]; lookOffset?: number[] };
    input?: SceneInput;
  };
  const issues: ValidationIssue[] = [];
  if (
    scene.camera?.mode === 'follow' &&
    scene.camera.offset?.every((v, i) => v === scene.camera?.lookOffset?.[i])
  ) {
    issues.push({
      path: '/camera/lookOffset',
      code: 'invalid_camera',
      message: 'follow camera offset and lookOffset must differ',
    });
  }
  const prefabNames = Object.keys(scene.prefabs);
  for (const [name, p] of Object.entries(scene.prefabs)) {
    if (p.extends !== undefined && scene.prefabs[p.extends] === undefined) {
      const near = nearest(p.extends, prefabNames);
      issues.push({
        path: `/prefabs/${escapePointer(name)}/extends`,
        code: 'unknown_prefab',
        message: `prefab "${name}" extends unknown prefab "${p.extends}"`,
        expected: `one of: ${prefabNames.join(', ')}`,
        ...(near !== undefined ? { hint: `did you mean "${near}"?` } : {}),
        docsRef: 'schemas/scene.md',
      });
    }
  }
  for (const start of prefabNames) {
    const chain: string[] = [];
    let cur: string | undefined = start;
    while (cur !== undefined && scene.prefabs[cur] !== undefined) {
      if (chain.includes(cur)) {
        if (cur === start) {
          issues.push({
            path: `/prefabs/${escapePointer(start)}/extends`,
            code: 'prefab_extends_cycle',
            message: `extends cycle: ${[...chain, cur].join(' → ')}`,
            docsRef: 'schemas/scene.md',
          });
        }
        break;
      }
      chain.push(cur);
      cur = scene.prefabs[cur]?.extends;
    }
  }
  scene.entities.forEach((e, i) => {
    if (e.prefab !== undefined && scene.prefabs[e.prefab] === undefined) {
      const near = nearest(e.prefab, prefabNames);
      issues.push({
        path: `/entities/${i}/prefab`,
        code: 'unknown_prefab',
        message: `entity references unknown prefab "${e.prefab}"`,
        expected: `one of: ${prefabNames.join(', ')}`,
        ...(near !== undefined ? { hint: `did you mean "${near}"?` } : {}),
        docsRef: 'schemas/scene.md',
      });
    }
  });
  for (const [type, def] of Object.entries(scene.commands)) {
    if (def.payload === undefined) continue;
    // A declared `pattern` becomes a RegExp run against every incoming command, so a
    // catastrophic one is a stall anyone who can submit a command can trigger. Screened before
    // compiling so the report names the command and the pattern (compile throws generically).
    const unsafe = unsafePatterns(
      def.payload as JsonValue,
      `/commands/${escapePointer(type)}/payload`,
    );
    if (unsafe.length > 0) {
      for (const { pointer, pattern, reason } of unsafe) {
        issues.push({
          path: pointer,
          code: 'unsafe_payload_pattern',
          message: `command "${type}" declares a pattern that ${reason}`,
          received: JSON.stringify(pattern),
          hint: 'flatten the repetition (one quantifier per group), or drop the pattern and check the value in the command handler',
          docsRef: 'schemas/scene.md',
        });
      }
      continue;
    }
    try {
      compileCommandPayload(def.payload as Record<string, never>);
    } catch (error) {
      issues.push({
        path: `/commands/${escapePointer(type)}/payload`,
        code: 'invalid_payload_schema',
        message: `command "${type}" payload schema is not supported: ${error instanceof Error ? error.message : String(error)}`,
        hint: 'use the JSON Schema subset: type object/array/number/integer/string/boolean, properties, required, additionalProperties, items, enum, const, min*/max*',
        docsRef: 'schemas/scene.md',
      });
    }
  }
  if (
    scene.physics?.character === true &&
    ['rapier', 'platformer'].includes(scene.physics.engine)
  ) {
    issues.push({
      path: '/physics/character',
      code: 'character_engine_conflict',
      message:
        'physics.character installs the kernel character controller, which conflicts with the selected engine (rapier/platformer own their movement)',
      hint: 'remove "character": true, or switch engine to "kinematics"',
      docsRef: 'schemas/scene.md',
    });
  }
  const scriptIds = new Set<string>();
  scene.scripts.forEach((s, i) => {
    if (scriptIds.has(s.id)) {
      issues.push({
        path: `/scripts/${i}/id`,
        code: 'duplicate_script_id',
        message: `duplicate script id "${s.id}"`,
        docsRef: 'schemas/scene.md',
      });
    }
    scriptIds.add(s.id);
    const has = [s.code !== undefined, s.path !== undefined].filter(Boolean).length;
    if (has !== 1) {
      issues.push({
        path: `/scripts/${i}`,
        code: has === 0 ? 'script_source_missing' : 'script_source_ambiguous',
        message: `script "${s.id}" must have exactly one of "code" (inline JS) or "path" (file ref)`,
        hint: `inline: { "code": "molen.on('tick', …)" } · file: { "path": "scripts/spin.js" }`,
        docsRef: 'schemas/scene.md',
      });
    }
  });
  const seen = new Set<string>();
  scene.entities.forEach((e, i) => {
    if (e.id === undefined) return;
    if (seen.has(e.id)) {
      issues.push({
        path: `/entities/${i}/id`,
        code: 'duplicate_entity_id',
        message: `duplicate authored entity id "${e.id}"`,
        docsRef: 'schemas/scene.md',
      });
    }
    seen.add(e.id);
  });
  if (scene.input !== undefined) {
    const profiles = [
      [undefined, scene.input],
      ...Object.entries(scene.input.profiles ?? {}),
    ] as const;
    const actions = new Set<string>();
    for (const [name, profile] of profiles) {
      for (const action of Object.values(profile.bindings)) actions.add(action);
      for (const binding of [...(profile.axes ?? []), ...(profile.buttons ?? [])])
        actions.add(binding.action);
      for (const issue of inputProfileIssues(profile))
        issues.push({
          path: `${name === undefined ? '/input' : `/input/profiles/${name}`}/axes/${issue.axis}`,
          code: 'invalid_axis_calibration',
          message: issue.message,
          docsRef: 'guide/input.md',
        });
    }
    if (
      scene.input.profile !== undefined &&
      !Object.hasOwn(scene.input.profiles ?? {}, scene.input.profile)
    ) {
      issues.push({
        path: '/input/profile',
        code: 'unknown_input_profile',
        message: `Unknown input profile "${scene.input.profile}".`,
        docsRef: 'guide/input.md',
      });
    }
    const commandTypes = Object.keys(scene.commands);
    scene.input.emit.forEach((rule, i) => {
      if (rule.command !== undefined && scene.commands[rule.command] === undefined) {
        const near = nearest(rule.command, commandTypes);
        issues.push({
          path: `/input/emit/${i}/command`,
          code: 'undeclared_command',
          message: `emit rule sends command "${rule.command}" which the scene does not declare`,
          expected: `one of: ${commandTypes.join(', ')}`,
          hint:
            near !== undefined
              ? `did you mean "${near}"?`
              : `add "${rule.command}" under "commands" (payload schema is optional)`,
          docsRef: 'schemas/scene.md',
        });
      }
      const refs =
        rule.kind === 'axis2d'
          ? (['xNeg', 'xPos', 'yNeg', 'yPos'] as const).map(
              (k) => (rule as unknown as Record<string, string>)[k] as string,
            )
          : rule.kind === 'axis' && rule.negative !== undefined
            ? [rule.action, rule.negative]
            : [rule.action];
      for (const action of refs) {
        if (!actions.has(action)) {
          issues.push({
            path: `/input/emit/${i}`,
            code: 'unknown_input_action',
            message: `emit rule references action "${action}" which no binding produces`,
            expected: `one of: ${[...actions].join(', ')}`,
            docsRef: 'schemas/scene.md',
          });
        }
      }
    });
  }
  return issues;
}

registerSchema('scene', sceneSchema, {
  id: 'molen/scene@3',
  title: 'Scene manifest',
  description: 'Root document an experience boots from; instantiates into ECS state at tick 0.',
  examples: [
    {
      format: 'molen/scene@3',
      name: 'demo',
      seed: 'demo-1',
      tickRate: 30,
      prefabs: {
        cube: {
          components: {
            transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
            spin: { axis: [0, 1, 0], radPerTick: 0.05 },
          },
        },
      },
      entities: [{ id: 'cube-1', prefab: 'cube' }],
      components: {
        spin: {
          description: 'Continuous rotation about an axis, applied by the spin script.',
          examples: [{ axis: [0, 1, 0], radPerTick: 0.05 }],
        },
      },
      commands: {
        move: {
          doc: 'Set the planar move direction [x, z] (-1..1 per axis).',
          payload: {
            type: 'object',
            properties: {
              dir: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
            },
            required: ['dir'],
            additionalProperties: false,
          },
        },
      },
      scripts: [
        {
          id: 'control',
          code: "molen.onCommand('move', (p) => molen.patch('cube-1', 'transform', { pos: [p.dir[0], 0, p.dir[1]] }));",
        },
      ],
      camera: { mode: 'fixed', position: [0, 6, 16], lookAt: [0, 0, 0] },
      input: {
        bindings: { KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right' },
        emit: [
          {
            kind: 'axis2d',
            xNeg: 'left',
            xPos: 'right',
            yNeg: 'up',
            yPos: 'down',
            command: 'move',
            field: 'dir',
          },
        ],
      },
    },
  ],
  docsRef: 'schemas/scene.md',
  validate: validateScene,
});

registerSchema('prefab', prefabSchema, {
  id: 'molen/prefab@1',
  title: 'Prefab',
  description: 'Declarative entity template: component name to pure-JSON component data.',
  examples: [
    {
      format: 'molen/prefab@1',
      components: { transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] }, health: { hp: 10 } },
    },
  ],
  docsRef: 'schemas/prefab.md',
});

// --- molen/types@1: the project-level entity type registry ---

const entityTypeSchema = z.strictObject({
  doc: z.string().describe('Human/agent description of the type.').optional(),
  extends: dottedId
    .describe('Parent type id whose components this type inherits (deep-merged).')
    .optional(),
  components: componentMap
    .describe('Default component map for entities of this type (a partial when extends is set).')
    .default({}),
  assets: z
    .array(namespaceId)
    .describe('Project asset ids this type references (e.g. its gltf model).')
    .default([]),
  scripts: z
    .array(scriptRefSchema)
    .describe(
      'Deterministic type behavior, installed once per world with config.type set to this type id.',
    )
    .default([]),
});

const typesSchema = z.strictObject({
  format: z.literal('molen/types@1').describe("Format envelope; always 'molen/types@1'."),
  namespace: namespaceId.describe(
    "Namespace every type id in this file lives under (dotted lower_snake, e.g. 'train').",
  ),
  owner: z
    .string()
    .min(1)
    .describe("Owning agent or package label, e.g. 'agent:layout'.")
    .optional(),
  doc: z.string().describe('Human/agent description of this type collection.').optional(),
  types: z
    .record(dottedId, entityTypeSchema)
    .describe("Type id to definition; every id must start with '<namespace>.'.")
    .default({}),
});

/** Every type id must live under the file's namespace; same-file extends cycles are errors. */
function validateTypesDoc(data: unknown): ValidationIssue[] {
  const doc = data as {
    namespace: string;
    types: Record<
      string,
      { extends?: string; scripts: { id: string; code?: string; path?: string }[] }
    >;
  };
  const issues: ValidationIssue[] = [];
  for (const id of Object.keys(doc.types)) {
    if (!id.startsWith(`${doc.namespace}.`)) {
      issues.push({
        path: `/types/${id.replaceAll('~', '~0').replaceAll('/', '~1')}`,
        code: 'type_outside_namespace',
        message: `type id "${id}" is outside this file's namespace "${doc.namespace}"`,
        expected: `an id starting with "${doc.namespace}."`,
        docsRef: 'schemas/types.md',
      });
    }
  }
  for (const [id, def] of Object.entries(doc.types)) {
    const seen = new Set<string>();
    def.scripts.forEach((script, i) => {
      if (seen.has(script.id)) {
        issues.push({
          path: `/types/${escapePointer(id)}/scripts/${i}/id`,
          code: 'duplicate_script_id',
          message: `duplicate type script id "${script.id}"`,
        });
      }
      seen.add(script.id);
      if ((script.code === undefined) === (script.path === undefined)) {
        issues.push({
          path: `/types/${escapePointer(id)}/scripts/${i}`,
          code: 'script_source',
          message: 'type script requires exactly one of "code" or "path"',
        });
      }
    });
  }
  for (const start of Object.keys(doc.types)) {
    const seen: string[] = [];
    let cur: string | undefined = start;
    while (cur !== undefined && doc.types[cur] !== undefined) {
      if (seen.includes(cur)) {
        if (cur === start) {
          issues.push({
            path: `/types/${start.replaceAll('~', '~0').replaceAll('/', '~1')}/extends`,
            code: 'type_extends_cycle',
            message: `extends cycle: ${[...seen, cur].join(' → ')}`,
            docsRef: 'schemas/types.md',
          });
        }
        break;
      }
      seen.push(cur);
      cur = doc.types[cur]?.extends;
    }
  }
  return issues;
}

registerSchema('types', typesSchema, {
  id: 'molen/types@1',
  title: 'Entity type registry',
  description:
    'Namespaced entity types with doc strings, default components, inheritance, and asset refs. Scenes instantiate them; reservations in project.json partition the id space between agents.',
  examples: [
    {
      format: 'molen/types@1',
      namespace: 'train',
      owner: 'agent:layout',
      types: {
        'train.car': {
          doc: 'A generic rail vehicle.',
          components: {
            transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
            renderable: { kind: 'primitive', ref: 'box', materialRef: 'palette:#8a5a2b' },
          },
        },
        'train.locomotive': {
          doc: 'Powered engine at the head of a consist.',
          extends: 'train.car',
          components: { renderable: { materialRef: 'palette:#2b2b2b' } },
        },
      },
    },
  ],
  docsRef: 'schemas/types.md',
  validate: validateTypesDoc,
});

// --- molen/project@1: the project manifest binding scenes + types + assets ---

const reservationSchema = z.strictObject({
  namespace: namespaceId.describe('Reserved namespace (covers all of its sub-namespaces).'),
  owner: z.string().min(1).describe('Owner label holding the reservation, e.g. an agent id.'),
  note: z.string().describe('Free-form note about the reservation.').optional(),
});

const projectSchema = z.strictObject({
  format: z.literal('molen/project@1').describe("Format envelope; always 'molen/project@1'."),
  name: z.string().min(1).describe('Project name.'),
  engine: z.string().min(1).describe('Engine version the project targets.').optional(),
  scenes: z
    .record(z.string().regex(/^[a-z][a-z0-9_-]*$/), relPath)
    .describe('Scene name (lower-kebab) to project-relative scene file path.')
    .default({}),
  defaultScene: z.string().describe('Key of `scenes` opened when none is named.').optional(),
  types: z
    .array(relPath)
    .describe('Project-relative paths of molen/types@1 documents to load.')
    .default([]),
  assets: z
    .record(namespaceId, relPath)
    .describe('Asset id to project-relative path of its molen/asset@1 sidecar (asset.json).')
    .default({}),
  reservations: z
    .array(reservationSchema)
    .describe('Namespace reservations partitioning the type-id space between owners.')
    .default([]),
  setup: relPath
    .describe(
      'Project-relative path of the setup module (setup.mjs) exporting setup(world, manifest).',
    )
    .optional(),
  /** Custom component vocabulary shared by every scene in the project. */
  components: z
    .record(customComponentName, customComponentDeclSchema)
    .describe('Custom component vocabulary shared by every scene in the project.')
    .default({}),
  codegen: z
    .strictObject({
      out: relPath
        .describe('Project-relative output path for generated TypeScript types.')
        .default('gen/molen-types.ts'),
    })
    .describe('Code generation settings (molen codegen).')
    .default({ out: 'gen/molen-types.ts' }),
});

/** Cross-field checks: defaultScene must exist; reservations must not overlap across owners. */
function validateProject(data: unknown): ValidationIssue[] {
  const project = data as {
    scenes: Record<string, string>;
    defaultScene?: string;
    reservations: { namespace: string; owner: string }[];
  };
  const issues: ValidationIssue[] = [];
  if (project.defaultScene !== undefined && project.scenes[project.defaultScene] === undefined) {
    issues.push({
      path: '/defaultScene',
      code: 'unknown_default_scene',
      message: `defaultScene "${project.defaultScene}" is not a key of scenes`,
      expected: `one of: ${Object.keys(project.scenes).join(', ')}`,
      docsRef: 'schemas/project.md',
    });
  }
  const covers = (a: string, b: string): boolean => a === b || b.startsWith(`${a}.`);
  project.reservations.forEach((r, i) => {
    for (let j = 0; j < i; j++) {
      const other = project.reservations[j] as { namespace: string; owner: string };
      if (other.owner === r.owner) continue;
      if (covers(other.namespace, r.namespace) || covers(r.namespace, other.namespace)) {
        issues.push({
          path: `/reservations/${i}`,
          code: 'reservation_overlap',
          message: `namespace "${r.namespace}" (${r.owner}) overlaps "${other.namespace}" held by ${other.owner}`,
          docsRef: 'schemas/project.md',
        });
      }
    }
  });
  return issues;
}

registerSchema('project', projectSchema, {
  id: 'molen/project@1',
  title: 'Project manifest',
  description:
    'Binds an experience project together: scenes by name, type-registry documents, imported assets, namespace reservations, and the default setup module.',
  examples: [
    {
      format: 'molen/project@1',
      name: 'rail-yard',
      scenes: { main: 'scenes/main.scene.json' },
      defaultScene: 'main',
      types: ['types/train.types.json'],
      assets: { 'train.boxcar_mesh': 'assets/boxcar/asset.json' },
      reservations: [{ namespace: 'train', owner: 'agent:layout' }],
      setup: 'setup.mjs',
      codegen: { out: 'gen/molen-types.ts' },
    },
  ],
  docsRef: 'schemas/project.md',
  validate: validateProject,
});

registerSchema('keyframe', keyframeSchema, {
  id: 'molen/keyframe@1',
  title: 'Keyframe snapshot',
  description:
    'Complete world state at a tick: the save-file format, replay seek index, and snapshot-viewer input.',
  examples: [exampleKeyframe],
  docsRef: 'schemas/keyframe.md',
});

registerSchema('delta', deltaSchema, {
  id: 'molen/delta@1',
  title: 'Per-tick delta',
  description: 'Dirty-tracked changes since the previous tick, whole-component granularity.',
  examples: [
    {
      kind: 'delta',
      v: 1,
      tick: 121,
      baseTick: 120,
      spawned: {},
      destroyed: [],
      changed: { player: { transform: { pos: [0.1, 1, 0], rot: [0, 0, 0, 1] } } },
      removedComponents: {},
      events: [],
    },
  ],
  docsRef: 'schemas/delta.md',
});

registerSchema('replay', replaySchema, {
  id: 'molen/replay@1',
  title: 'Replay fixture',
  description:
    'Initial state plus command log; determinism regenerates everything else. Used by test:replay.',
  examples: [
    {
      format: 'molen/replay@1',
      engine: '0.0.1',
      scene: 'scenes/demo.scene.json',
      seed: 'demo-1',
      ticks: 300,
      commands: [
        {
          kind: 'command',
          seq: 1,
          source: 'local',
          tick: 45,
          tickExecuted: 46,
          type: 'spawn_cube',
          payload: {},
        },
      ],
      expected: { stateHash: 'sha256:0000', eventCount: 0 },
    },
  ],
  docsRef: 'schemas/replay.md',
});

registerSchema('assert', assertSchema, {
  id: 'molen/assert@1',
  title: 'Assertion document',
  description: 'Declarative world-state and event assertions evaluated after a headless run.',
  examples: [
    {
      format: 'molen/assert@1',
      assertions: [
        { select: 'has:transform', op: 'count', value: 2 },
        { select: '#player .health.hp', op: 'gte', value: 1 },
        { event: 'player_died', op: 'never' },
      ],
    },
  ],
  docsRef: 'schemas/assert.md',
});

// --- validate() ---

export interface SchemaKindMap {
  command: Command;
  scene: SceneManifest;
  prefab: Prefab;
  keyframe: Keyframe;
  delta: Delta;
  replay: ReplayFixture;
  assert: AssertionDoc;
  project: ProjectManifest;
  types: TypesDoc;
  asset: AssetSidecar;
  'source-bundle': SourceBundle;
}

export type SchemaKind = keyof SchemaKindMap;

export interface ValidateOptions extends ComponentValidateOptions {
  /** Supply project types to validate final scene entity and prefab merges. */
  types?: ResolvedTypes;
  /** Label used in the formatted error header, e.g. 'scene "arena"'. */
  label?: string;
}

/**
 * Post-parse pass: validate every component map a document carries against the component
 * registry. Runs only on Zod-valid documents (so we never double-report structural errors).
 */
function collectComponentIssues(
  kind: string,
  value: unknown,
  opts?: ValidateOptions,
): ValidationIssue[] {
  if (value === null || typeof value !== 'object') return [];
  const v = value as Record<string, unknown>;
  const out: ValidationIssue[] = [];
  const add = (cm: unknown, ptr: string, partial?: boolean): void => {
    out.push(
      ...componentMapIssues(
        cm as Record<string, unknown> | undefined,
        ptr,
        partial === true ? { ...opts, partial: true } : opts,
      ),
    );
  };
  switch (kind) {
    case 'scene': {
      const manifest = value as SceneManifest;
      if (opts?.types !== undefined) {
        const refs = sceneTypeRefIssues(manifest, opts.types.keys());
        if (refs.length > 0) {
          out.push(...refs);
          break;
        }
      }
      const check = (resolve: () => Record<string, unknown>, path: string): void => {
        try {
          add(resolve(), path);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          // A standalone scene can be structurally validated without loading its project.
          if (opts?.types === undefined && message.includes('unknown type')) return;
          out.push({ path, code: 'component_resolution', message });
        }
      };
      for (const name of Object.keys(manifest.prefabs)) {
        check(
          () => resolvePrefab(manifest, name, opts),
          `/prefabs/${escapePointer(name)}/components`,
        );
      }
      manifest.entities.forEach((entity, i) => {
        check(() => resolveEntityComponents(manifest, entity, opts), `/entities/${i}/components`);
      });
      break;
    }
    case 'prefab':
      add(v.components, '/components');
      break;
    case 'types': {
      // Extending types hold partial overrides; their RESOLVED shape is validated at project
      // level (checkTypes). Only base types validate as complete components here.
      const types = (v.types ?? {}) as Record<string, { extends?: string; components?: unknown }>;
      for (const [id, def] of Object.entries(types)) {
        if (def?.extends !== undefined) continue;
        add(def?.components, `/types/${escapePointer(id)}/components`);
      }
      break;
    }
    case 'keyframe': {
      const entities = (v.entities ?? {}) as Record<string, unknown>;
      for (const [id, cm] of Object.entries(entities)) add(cm, `/entities/${escapePointer(id)}`);
      break;
    }
    case 'delta': {
      const spawned = (v.spawned ?? {}) as Record<string, unknown>;
      for (const [id, cm] of Object.entries(spawned)) add(cm, `/spawned/${escapePointer(id)}`);
      const changed = (v.changed ?? {}) as Record<string, unknown>;
      for (const [id, cm] of Object.entries(changed)) add(cm, `/changed/${escapePointer(id)}`);
      break;
    }
    default:
      break;
  }
  return out;
}

/**
 * Validate against any registered schema kind (core or capability-package). Returns an
 * untyped result; prefer the typed `validate<K>` for the core kinds in SchemaKindMap.
 */
export function validateByKind(
  kind: string,
  data: unknown,
  opts?: ValidateOptions,
): ValidationResult<unknown> {
  const entry = getSchema(kind);
  if (entry === undefined) {
    const kinds = schemaKinds();
    const near = nearest(kind, kinds);
    const issue = {
      path: '',
      code: 'unknown_schema_kind',
      message: `unknown schema kind "${kind}"`,
      expected: `one of: ${kinds.join(', ')}`,
      ...(near !== undefined ? { hint: `did you mean "${near}"?` } : {}),
    };
    return {
      ok: false,
      issues: [issue],
      formatted: formatIssues(`document (kind "${kind}")`, [issue]),
    };
  }
  // Legacy version? Parse with the old schema, upgrade to the current shape, note deprecation.
  const docFormat =
    data !== null && typeof data === 'object'
      ? (data as Record<string, unknown>).format
      : undefined;
  const legacy =
    typeof docFormat === 'string' && docFormat !== entry.meta.id
      ? getLegacySchema(kind, docFormat)
      : undefined;
  const activeZod = legacy?.zod ?? entry.zod;

  const result = activeZod.safeParse(data);
  if (result.success) {
    let value: unknown = result.data;
    if (legacy !== undefined) {
      const upgraded = legacy.upgrade(result.data);
      const current = entry.zod.safeParse(upgraded);
      if (!current.success) {
        const issues = zodErrorToIssues(current.error, upgraded, entry.zod);
        if (entry.meta.docsRef !== undefined) {
          for (const issue of issues) issue.docsRef ??= entry.meta.docsRef;
        }
        const label = opts?.label ?? describeDocument(kind, data);
        return { ok: false, issues, formatted: formatIssues(label, issues) };
      }
      value = current.data;
    }
    const decls =
      kind === 'scene' || kind === 'project'
        ? ((value as { components?: Record<string, DeclaredComponent> }).components ?? {})
        : {};
    const scoped = createComponentRegistry(decls, { base: opts?.registry, owner: kind });
    const declared = scoped.issues;
    const all = [
      ...declared,
      ...collectComponentIssues(kind, value, { ...opts, registry: scoped.registry }),
      ...(entry.meta.validate?.(value) ?? []),
    ];
    const problems = blockingIssues(all);
    const notices = noticeIssues(all);
    if (legacy !== undefined) {
      notices.push({
        path: '/format',
        code: 'deprecated_format',
        message: `"${legacy.id}" is a previous version of this format`,
        expected: entry.meta.id,
        hint: `rewrite the document as ${entry.meta.id}`,
        ...(entry.meta.docsRef !== undefined ? { docsRef: entry.meta.docsRef } : {}),
        severity: 'notice',
      });
    }
    if (problems.length === 0) {
      return notices.length === 0 ? { ok: true, value } : { ok: true, value, notices };
    }
    const label = opts?.label ?? describeDocument(kind, data);
    return {
      ok: false,
      issues: problems,
      formatted: formatIssues(label, problems),
    };
  }
  const issues = zodErrorToIssues(result.error, data, activeZod);
  if (entry.meta.docsRef !== undefined) {
    for (const issue of issues) {
      if (issue.docsRef === undefined) issue.docsRef = entry.meta.docsRef;
    }
  }
  const label = opts?.label ?? describeDocument(kind, data);
  return { ok: false, issues, formatted: formatIssues(label, issues) };
}

export function validate<K extends SchemaKind>(
  kind: K,
  data: unknown,
  opts?: ValidateOptions,
): ValidationResult<SchemaKindMap[K]> {
  return validateByKind(kind, data, opts) as ValidationResult<SchemaKindMap[K]>;
}

function describeDocument(kind: string, data: unknown): string {
  if (data !== null && typeof data === 'object') {
    const name = (data as Record<string, unknown>).name;
    if (typeof name === 'string' && name.length > 0) return `${kind} "${name}"`;
  }
  return kind;
}

/** Infer the schema kind from a document's format/kind envelope fields (any registered kind). */
export function detectKind(data: unknown): string | undefined {
  if (data === null || typeof data !== 'object') return undefined;
  const doc = data as Record<string, unknown>;
  if (typeof doc.format === 'string') {
    const m = /^molen\/([a-z-]+)@\d+$/.exec(doc.format);
    if (m !== null && getSchema(m[1] as string) !== undefined) return m[1] as string;
    return undefined;
  }
  if (typeof doc.kind === 'string' && getSchema(doc.kind) !== undefined) {
    return doc.kind as string;
  }
  return undefined;
}
