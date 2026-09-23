import { z } from 'zod';
import type { ValidationIssue } from './issues';
import type { JsonObject, JsonValue } from './json';
import { modelSignalsSchema } from './model-signals';
import { unsafePatterns } from './regex-safety';
import { skySchema } from './sky';
import { vehicleInteriorSchema } from './vehicle-interior';
import { weatherSchema } from './weather';
import { nearestWithDistance, zodErrorToIssues } from './zod-issues';

// Component registry (docs/01-architecture.md §2: "schema defines component schemas").
//
// validateByKind() runs this as a POST-PARSE pass over every component map in a scene/prefab/
// keyframe/delta — it is NOT a Zod refinement, so the emitted JSON Schema (and the Ajv side of
// the cross-validation tripwire) is unaffected. Two agent-facing wins come from it:
//   1. unknown component names that are near-typos of a known component → did-you-mean
//      (the marquee error from docs/07 §2.2). Genuinely novel names are allowed (docs/03 permits
//      invented components for your own systems/scripts).
//   2. known components with the wrong field shape → pinpoint errors with example hints
//      (e.g. transform.position → "did you mean pos?").
//
// CONVENTIONS encoded in the field descriptions below (and in every emitted JSON Schema):
//   - Coordinate system: Y-up, right-handed; distances in meters.
//   - Time: ticks at the scene tickRate (dt = 1/tickRate seconds); rates are per second.
//   - Quaternions are [x, y, z, w]; identity is [0, 0, 0, 1].
//   - Colors are "#rrggbb" strings.
//   - `collider.halfExtents` is [x, z] (2.5D kinematics act in the XZ plane).
//   - `moveIntent.dir` is [x, z]: +x east, +z south (screen-down in top-down views).
//   - `layer`/`mask` are bitmasks: a collides with b when (a.mask & b.layer) or (b.mask & a.layer).
//   - `renderable.primitive.size` is [x, y, z].
//   - `environment.sun.direction` points FROM the origin TOWARD the sun (the light sits at that
//     offset and shines back at the origin).

export interface ComponentMeta {
  /** One-line human/agent description. */
  description: string;
  /** At least one valid example of the component's data; feeds hints and docs. */
  examples: JsonValue[];
  /** Owning layer, for docs grouping. */
  owner?: string;
  docsRef?: string;
}

export interface ComponentEntry {
  name: string;
  zod: z.ZodType;
  meta: ComponentMeta;
}

export interface ComponentSummary {
  name: string;
  description: string;
  owner?: string;
}

export type ComponentRegistry = ReadonlyMap<string, ComponentEntry>;
const components = new Map<string, ComponentEntry>();

/** Create an isolated vocabulary. Validation never installs declarations in another context. */
export function createComponentRegistry(
  decls: Record<string, DeclaredComponent> = {},
  opts?: { base?: ComponentRegistry; owner?: string },
): { registry: ComponentRegistry; issues: ValidationIssue[] } {
  const registry = new Map(opts?.base ?? components);
  const issues = registerDeclaredComponents(decls, { registry, owner: opts?.owner });
  return { registry, issues };
}

export interface RegisterComponentOptions {
  /** Replace an existing registration instead of throwing on a duplicate name. */
  override?: boolean;
}

/**
 * Register a component schema. Capability packages and content may register their own component
 * names so validation knows about them; core components are registered below. Duplicate names
 * throw (two packages silently fighting over one name is a determinism hazard) unless
 * `{ override: true }` is passed.
 */
export function registerComponent(
  name: string,
  zod: z.ZodType,
  meta: ComponentMeta,
  opts?: RegisterComponentOptions,
): void {
  if (name.length === 0) throw new Error('component name must be non-empty');
  if (components.has(name) && opts?.override !== true) {
    throw new Error(
      `component "${name}" is already registered (pass { override: true } to replace)`,
    );
  }
  components.set(name, { name, zod, meta });
}

/**
 * Remove a registration (tests, and re-loading a project with a changed vocabulary). Core
 * components are not removable: `unregisterComponent('transform')` would leave every later
 * validation in a long-lived process (an MCP server, the dev server) unable to check the one
 * component every entity has, and nothing would report it.
 */
export function unregisterComponent(name: string): boolean {
  if (CORE_COMPONENTS.has(name)) {
    throw new Error(`component "${name}" is a core component and cannot be unregistered`);
  }
  return components.delete(name);
}

export function getComponent(
  name: string,
  registry: ComponentRegistry = components,
): ComponentEntry | undefined {
  return registry.get(name);
}

/** The shape of a project/scene-declared custom component (molen/project@1, molen/scene@3). */
export interface DeclaredComponent {
  description: string;
  examples: JsonValue[];
  /** JSON Schema for the data; omitted = any object. */
  schema?: JsonObject;
}

/**
 * Register a declared custom-component vocabulary so every consumer (validation, spawn checks,
 * `molen components`, docs) knows the names. A declaration WITH a schema is shape-checked like a
 * core component; without one it accepts any object. Re-declaring overrides (a project reload
 * is the normal case). Returns blocking issues for reserved names or unsupported schemas.
 *
 * `registry` is REQUIRED and is never the process-global vocabulary: one document's declarations
 * must not leak into every later validation in a long-lived process (an MCP server validates
 * documents from unrelated projects back to back). `createComponentRegistry` is the normal entry
 * point; call this directly only to add declarations to a registry you already own.
 */
export function registerDeclaredComponents(
  decls: Record<string, DeclaredComponent>,
  opts: { registry: Map<string, ComponentEntry>; owner?: string; pointer?: string },
): ValidationIssue[] {
  const notices: ValidationIssue[] = [];
  const registry = opts.registry;
  for (const [name, decl] of Object.entries(decls)) {
    const existing = registry.get(name);
    if (
      existing !== undefined &&
      !['scene', 'project', 'declared'].includes(existing.meta.owner ?? '')
    ) {
      notices.push({
        path: `${opts.pointer ?? '/components'}/${escapePointer(name)}`,
        code: 'reserved_component',
        message: `component "${name}" is owned by ${existing.meta.owner ?? 'a registered package'} and cannot be redeclared`,
      });
      continue;
    }
    // A declaration without a schema is "any object" by definition: loose is the contract here,
    // not an accident (with a schema, the declared JSON Schema decides).
    let zod: z.ZodType = z.looseObject({});
    if (decl.schema !== undefined) {
      // A declared schema's `pattern` becomes a RegExp run over authored data; the same
      // catastrophic-backtracking hazard as a command payload pattern (see regex-safety.ts).
      const unsafe = unsafePatterns(
        decl.schema as JsonValue,
        `${opts.pointer ?? '/components'}/${escapePointer(name)}/schema`,
      );
      const risky = unsafe[0];
      if (risky !== undefined) {
        notices.push({
          path: risky.pointer,
          code: 'component_schema_unsafe_pattern',
          message: `component "${name}" declares a pattern that ${risky.reason}`,
          received: JSON.stringify(risky.pattern),
          hint: 'flatten the repetition (one quantifier per group), or drop the pattern',
          docsRef: 'schemas/components.md',
        });
        continue;
      }
      try {
        zod = z.fromJSONSchema(decl.schema as Parameters<typeof z.fromJSONSchema>[0]);
      } catch (error) {
        notices.push({
          path: `${opts.pointer ?? '/components'}/${escapePointer(name)}/schema`,
          code: 'component_schema_unsupported',
          message: `component "${name}" schema could not be compiled (${error instanceof Error ? error.message : String(error)})`,
          hint: 'use the JSON Schema subset: type object/array/number/integer/string/boolean, properties, required, additionalProperties, items, enum, const, min*/max*',
          docsRef: 'schemas/components.md',
        });
        continue;
      }
    }
    registry.set(name, {
      name,
      zod,
      meta: {
        description: decl.description,
        examples: decl.examples,
        owner: opts.owner ?? 'declared',
      },
    });
  }
  return notices;
}

export function listComponents(registry: ComponentRegistry = components): ComponentSummary[] {
  return [...registry.values()]
    .map((c) => ({ name: c.name, description: c.meta.description, owner: c.meta.owner }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function componentNames(registry: ComponentRegistry = components): string[] {
  return [...registry.keys()].sort();
}

export interface ComponentValidateOptions {
  registry?: ComponentRegistry;
  /** When true, unknown component names are never flagged (not even near-typos). */
  allowUnknownComponents?: boolean;
  /**
   * The data is a partial layer (entity `overrides`, or `components` stacked on a prefab/type
   * base): keep the unknown-name did-you-mean but skip shape validation — only the RESOLVED
   * component map can be checked for completeness.
   */
  partial?: boolean;
}

function escapePointer(seg: string): string {
  return seg.replaceAll('~', '~0').replaceAll('/', '~1');
}

function shortExample(value: JsonValue | undefined): string | undefined {
  if (value === undefined) return undefined;
  const s = JSON.stringify(value);
  return s !== undefined && s.length <= 80 ? s : undefined;
}

/**
 * Validate one component's data, returning prefixed ValidationIssues. `basePointer` is the JSON
 * Pointer to the component itself (e.g. "/entities/0/components/transform").
 */
export function componentIssues(
  name: string,
  data: unknown,
  basePointer: string,
  opts?: ComponentValidateOptions,
): ValidationIssue[] {
  const registry = opts?.registry ?? components;
  const entry = registry.get(name);
  if (entry === undefined) {
    if (opts?.allowUnknownComponents === true) return [];
    const near = nearestWithDistance(name, componentNames(registry));
    // Genuinely novel component names are allowed (custom vocabulary for your own scripts).
    if (near === undefined) return [];
    // A strong near-miss (case-only, or a single edit that is not a plural) is a typo: error.
    // Anything else close-ish ("team" vs "tag") is a custom component that happens to be near
    // a core name: accept it with an advisory notice that a declaration would silence.
    const lower = name.toLowerCase();
    const candidate = near.candidate.toLowerCase();
    const strong = lower === candidate || (near.distance <= 1 && lower !== `${candidate}s`);
    if (strong) {
      return [
        {
          path: basePointer,
          code: 'unknown_component',
          message: `unknown component "${name}"`,
          expected: `one of: ${componentNames(registry).join(', ')}`,
          hint: `did you mean "${near.candidate}"? (or declare "${name}" under "components" if it is intentional)`,
          docsRef: 'schemas/components.md',
        },
      ];
    }
    return [
      {
        path: basePointer,
        code: 'undeclared_component',
        message: `"${name}" is not a known component; accepted as a custom component`,
        hint: `declare "${name}" under "components" (description + examples) to document it and silence this notice — or did you mean "${near.candidate}"?`,
        docsRef: 'schemas/components.md',
        severity: 'notice',
      },
    ];
  }
  if (opts?.partial === true) return []; // known name, partial layer — shape checked post-merge
  const result = entry.zod.safeParse(data);
  if (result.success) return [];
  const issues = zodErrorToIssues(result.error, data, entry.zod);
  const example = shortExample(entry.meta.examples[0]);
  let hintApplied = false;
  return issues.map((issue) => {
    const out: ValidationIssue = {
      ...issue,
      path: basePointer + issue.path,
      docsRef: issue.docsRef ?? entry.meta.docsRef ?? 'schemas/components.md',
    };
    if (out.hint === undefined && !hintApplied && example !== undefined) {
      out.hint = `e.g. "${name}": ${example}`;
      hintApplied = true;
    }
    return out;
  });
}

/** Walk a component map and collect issues for each entry. */
export function componentMapIssues(
  componentMap: Record<string, unknown> | undefined,
  basePointer: string,
  opts?: ComponentValidateOptions,
): ValidationIssue[] {
  if (componentMap === undefined || componentMap === null) return [];
  const out: ValidationIssue[] = [];
  for (const [name, data] of Object.entries(componentMap)) {
    out.push(...componentIssues(name, data, `${basePointer}/${escapePointer(name)}`, opts));
  }
  if (opts?.partial !== true && componentMap.collider3d !== undefined) {
    const scale = (componentMap.transform as { scale?: unknown } | undefined)?.scale;
    if (
      scale !== undefined &&
      (!Array.isArray(scale) ||
        scale.length !== 3 ||
        !scale.every((v) => typeof v === 'number' && Number.isFinite(v) && v > 0) ||
        scale[0] !== scale[1] ||
        scale[0] !== scale[2])
    ) {
      out.push({
        path: `${basePointer}/transform/scale`,
        code: 'unsupported_physics_scale',
        message: 'collider3d requires positive uniform transform.scale',
        hint: 'bake nonuniform or mirrored scale into collision geometry',
      });
    }
  }
  return out;
}

// --- core component schemas (the engine-provided vocabulary) ---
//
// Every field carries a `.describe()` so the emitted JSON Schema (molen component <name>,
// get_component, docs-src/schemas/components.md) documents units and axis conventions; JSDoc
// alone is compiled away. See the CONVENTIONS block at the top of this file.

const num = z.number();
const vec3 = z.array(num).length(3);
const quat = z.array(num).length(4);
const jsonValueLoose = z.json();

const makeTransformSchema = (frame: string) =>
  z.strictObject({
    pos: vec3.describe(`${frame} position [x, y, z] in meters (Y-up).`),
    rot: quat
      .describe(`${frame} orientation quaternion [x, y, z, w]; defaults to identity [0, 0, 0, 1].`)
      .optional(),
    scale: vec3.describe('Per-axis scale factors [x, y, z]; defaults to [1, 1, 1].').optional(),
    /** Client interpolation hint: skip lerp for this update. */
    teleport: z
      .boolean()
      .describe(
        'Client interpolation hint: when true the client snaps to this update instead of lerping from the previous tick.',
      )
      .optional(),
  });
const transformSchema = makeTransformSchema('World');
const localTransformSchema = makeTransformSchema('Parent-relative');

// STRICTNESS: every ENGINE-OWNED component is a strictObject, so an unknown key is reported
// with the did-you-mean machinery above ("materialref" → materialRef) instead of being dropped
// in silence while the entity renders with a default. AGENTS.md promises that error; it has to
// hold for `renderable.materialRef` and `collider.isStatic`, not just `transform.rotation`.
// Loose (extra keys kept) is reserved for the two shapes whose whole point is content-owned
// extra data — `health` and `tag`, flagged where they are defined — plus a scene/project
// component DECLARED without a schema, which is "any object" by definition.
export interface RenderableKindMeta {
  /** What the kind renders (e.g. "an imported project asset"); shown in the `kind` field docs. */
  description: string;
  /** Owning layer (the capability's client half), for docs grouping. */
  owner?: string;
  /**
   * Extra `renderable` fields this kind reads, e.g. figures' `lod`. `renderable` is strict, so a
   * capability that reads a field nobody declared would have its own documents rejected as typos.
   * Declare it here and it joins the schema, the emitted JSON Schema and the docs. Each field is
   * made optional (one flat renderable shape serves every kind) and may not shadow a core field.
   */
  fields?: Record<string, z.ZodType>;
}

// The renderable `kind` vocabulary: core kinds here, capability client halves add theirs with
// registerRenderableKind (which re-registers `renderable` so validation, the emitted JSON Schema,
// and docs enumerate every kind).
const renderableKinds = new Map<string, RenderableKindMeta>([
  ['primitive', { description: 'built-in geometry named by ref', owner: 'client' }],
  ['gltf', { description: 'an imported project asset', owner: 'client' }],
]);

const renderableKindDescription = (): string =>
  `Render source: ${[...renderableKinds]
    .map(([kind, meta]) => `'${kind}' (${meta.description})`)
    .join(', ')}.`;

const renderableFields = {
  /** Primitive name (box/sphere/plane/cylinder), or a project asset id / URL-ish path for gltf. */
  ref: z
    .string()
    .min(1)
    .describe('Primitive name (box, sphere, plane, cylinder) or, for gltf, the project asset id.'),
  materialRef: z
    .string()
    .describe(
      "Material reference, e.g. 'palette:#rrggbb' or a project material doc id; overrides the asset's own materials.",
    )
    .optional(),
  primitive: z
    .strictObject({
      size: vec3
        .describe(
          'Primitive extents [x, y, z] in meters: box = full extents; sphere = x is the diameter; cylinder = x diameter, y height; plane = x by z. Default [1, 1, 1].',
        )
        .optional(),
    })
    .describe('Primitive geometry parameters (kind = primitive).')
    .optional(),
  /** gltf: named sub-node to instance (default: the whole scene). */
  node: z
    .string()
    .min(1)
    .describe('gltf: named sub-node of the asset to instance (default: the whole scene).')
    .optional(),
  visible: z.boolean().describe('Whether the object is drawn; default true.').optional(),
  shadows: z
    .strictObject({
      cast: z.boolean().describe('Whether this object casts shadows onto others.').optional(),
      receive: z.boolean().describe('Whether this object receives shadows from others.').optional(),
    })
    .describe('Shadow participation flags.')
    .optional(),
  /** gltf clip playback: client-owned; clip time derives deterministically from startTick. */
  animation: z
    .strictObject({
      clip: z.string().min(1).describe('Name of the glTF animation clip to play.'),
      speed: num.describe('Playback rate multiplier (1 = authored speed).').optional(),
      loop: z
        .enum(['repeat', 'once', 'pingpong'])
        .describe('Loop mode: repeat, once (hold the last frame), or pingpong.')
        .optional(),
      paused: z
        .boolean()
        .describe('Freeze playback at pausedAtTick (default startTick).')
        .optional(),
      pausedAtTick: z
        .int()
        .nonnegative()
        .describe(
          'Simulation tick to hold while paused; serialize this when pausing so live and captured poses agree.',
        )
        .optional(),
      startTick: z
        .int()
        .nonnegative()
        .describe(
          'Tick the clip started at; clip time = (tick - startTick) / tickRate * speed seconds (default 0).',
        )
        .optional(),
    })
    .describe(
      'gltf clip playback (client-owned); clip time derives deterministically from startTick.',
    )
    .optional(),
};

/** The extra fields capability kinds declared, all optional (see RenderableKindMeta.fields). */
const registeredRenderableFields = (): Record<string, z.ZodType> => {
  const extra: Record<string, z.ZodType> = {};
  for (const meta of renderableKinds.values()) {
    for (const [field, zod] of Object.entries(meta.fields ?? {})) extra[field] = zod.optional();
  }
  return extra;
};

const buildRenderableSchema = () =>
  z.strictObject({
    kind: z
      .enum([...renderableKinds.keys()] as [string, ...string[]])
      .describe(renderableKindDescription()),
    ...renderableFields,
    ...registeredRenderableFields(),
  });

const colorHex = z.string().regex(/^#[0-9a-fA-F]{6}$/, { error: 'must be "#rrggbb"' });

const lightSchema = z.strictObject({
  type: z
    .enum(['directional', 'point', 'spot'])
    .describe(
      'Light type: directional (parallel rays), point (omnidirectional), or spot (cone). Directional/spot lights aim at the world origin by default.',
    ),
  color: colorHex.describe("Light color as '#rrggbb'.").optional(),
  intensity: num
    .nonnegative()
    .describe('Light intensity (three.js units; a unitless multiplier).')
    .optional(),
  /** point/spot falloff distance. */
  range: num
    .positive()
    .describe('point/spot falloff distance in meters (absent = unlimited).')
    .optional(),
  /** spot cone angle in degrees. */
  angleDeg: num
    .positive()
    .describe('spot cone half-angle in degrees, measured from the aim direction (default 45).')
    .optional(),
  /** spot soft-edge fraction 0..1. */
  penumbra: num
    .min(0)
    .max(1)
    .describe('spot soft-edge fraction 0..1 of the cone (default 0 = hard edge).')
    .optional(),
  castShadow: z.boolean().describe('Whether this light casts shadows.').optional(),
});

const environmentSchema = z.strictObject({
  sky: skySchema
    .optional()
    .describe(
      'Clear sky with sun, moon, stars and automatic lighting. Earth mode uses an explicit UTC epoch and observer; custom mode accepts authored body directions. See guide/sky.md.',
    ),
  ambient: z
    .strictObject({
      sky: colorHex.describe("Sky-side (from above) ambient color '#rrggbb'.").optional(),
      ground: colorHex.describe("Ground-side (from below) ambient color '#rrggbb'.").optional(),
      intensity: num
        .nonnegative()
        .describe('Ambient intensity (unitless multiplier; default 1.1).')
        .optional(),
    })
    .describe('Hemisphere ambient light.')
    .optional(),
  sun: z
    .strictObject({
      direction: vec3
        .describe(
          'Vector [x, y, z] pointing FROM the world origin TOWARD the sun: the directional light is placed at this offset and shines back toward the origin, so y > 0 puts the sun above the horizon (Y-up). Default [5, 10, 7].',
        )
        .optional(),
      color: colorHex.describe("Sun light color '#rrggbb'.").optional(),
      intensity: num
        .nonnegative()
        .describe('Sun intensity (unitless multiplier; default 1.4).')
        .optional(),
      castShadow: z
        .boolean()
        .describe("Whether the sun casts shadows (also requires shadows != 'off').")
        .optional(),
    })
    .describe('Directional sun light.')
    .optional(),
  /** Background clear color. */
  background: colorHex.describe("Background clear color '#rrggbb'.").optional(),
  fog: z
    .strictObject({
      color: colorHex.describe("Fog color '#rrggbb'."),
      near: num
        .nonnegative()
        .describe('Distance from the camera in meters at which fog starts.')
        .optional(),
      far: num
        .positive()
        .describe('Distance from the camera in meters at which fog is fully opaque.')
        .optional(),
    })
    .describe('Linear distance fog.')
    .optional(),
  toneMapping: z
    .enum(['none', 'aces', 'agx'])
    .describe('Tone-mapping operator: none, aces, or agx.')
    .optional(),
  exposure: num.positive().describe('Tone-mapping exposure multiplier (1 = neutral).').optional(),
  shadows: z
    .enum(['off', 'low', 'medium', 'high'])
    .describe('Shadow quality tier (shadow-map resolution); off disables all shadows.')
    .optional(),
});

registerComponent('weather', weatherSchema, {
  description:
    'Singleton physical atmosphere and visual weather: temperature, pressure, humidity, wind, independent cloud cover, precipitation and visibility. Readable by scripts and physics; see guide/weather.md.',
  examples: [
    {
      atmosphere: { temperatureK: 282.15, pressurePa: 100200, windVelocity: [7, 0, 3] },
      clouds: { coverage: 0.95 },
      precipitation: { kind: 'rain', intensity: 0.7 },
      visibility: 4500,
    },
  ],
});

const collisionMask = z.number().int().min(0).max(0xffffffff);
const layerField = collisionMask.describe(
  'Bitmask of collision layers this collider belongs to; a collides with b when (a.mask & b.layer) or (b.mask & a.layer) is non-zero.',
);
const maskField = collisionMask.describe(
  'Bitmask of layers this collider collides with (see layer for the rule).',
);
const isStaticField = z
  .boolean()
  .describe('Static colliders never move and are never pushed by other bodies.')
  .optional();
const colliderSchema = z.discriminatedUnion('shape', [
  z.strictObject({
    shape: z.literal('circle').describe('Circle collider in the XZ plane.'),
    radius: num.positive().describe('Circle radius in meters (default 0.5).').optional(),
    layer: layerField,
    mask: maskField,
    isStatic: isStaticField,
  }),
  z.strictObject({
    shape: z.literal('aabb').describe('Axis-aligned box collider in the XZ plane.'),
    halfExtents: z
      .array(num.positive())
      .length(2)
      .describe(
        'Half-extents [x, z] in meters of the box in the XZ plane (2.5D; default [0.5, 0.5]).',
      )
      .optional(),
    layer: layerField,
    mask: maskField,
    isStatic: isStaticField,
  }),
]);

const kinematicBodySchema = z.strictObject({
  vel: vec3.describe(
    'Velocity [x, y, z] in meters per second, integrated each tick (dt = 1/tickRate).',
  ),
  slide: z
    .boolean()
    .describe('When true, blocked motion slides along the contact surface instead of stopping.'),
});

const characterSchema = z.strictObject({
  speed: num.describe('Planar move speed in meters per second.'),
  jumpSpeed: num.describe(
    'Initial upward velocity in meters per second applied when jumping from the ground.',
  ),
  gravity: num.describe(
    'Downward acceleration in meters per second squared applied to vy each tick.',
  ),
  vy: num.describe('Current vertical velocity in meters per second (kernel-owned).'),
  grounded: z
    .boolean()
    .describe('True when the character stood on the ground as of the last tick (kernel-owned).'),
});

const moveIntentSchema = z.strictObject({
  dir: z
    .array(num)
    .length(2)
    .describe(
      'Desired planar move direction [x, z]: +x east, +z south (screen-down in top-down views); magnitudes above 1 are normalized.',
    ),
  jump: z.boolean().describe('Request a jump this tick (honored only while grounded).'),
});

const lifetimeSchema = z.strictObject({
  ticksLeft: num.describe('Ticks remaining before the entity is despawned; decremented each tick.'),
});
// health and tag stay LOOSE on purpose: they are content-owned shapes, not engine contracts.
// The engine reads only `hp` / `name`; a game routinely carries its own fields alongside them
// (armor, faction, spawnGroup) and no engine system can know what those should be.
const healthSchema = z.looseObject({ hp: num.describe('Hit points.') });
const tagSchema = z.looseObject({
  name: z.string().min(1).describe("Tag name used for selecting/grouping entities, e.g. 'enemy'."),
});

registerComponent('transform', transformSchema, {
  description: 'World position + orientation. pos is required; rot defaults to identity.',
  owner: 'kernel',
  examples: [{ pos: [0, 1.5, -3], rot: [0, 0, 0, 1] }],
  docsRef: 'schemas/components.md',
});
function registerRenderableComponent(): void {
  registerComponent(
    'renderable',
    buildRenderableSchema(),
    {
      description:
        'Client render contract: a primitive, a gltf asset (by project asset id) with optional sub-node, material override, shadows, and clip playback, or a capability-registered kind.',
      owner: 'client',
      examples: [
        { kind: 'primitive', ref: 'box', materialRef: 'palette:#4363d8' },
        { kind: 'gltf', ref: 'crate', animation: { clip: 'spin', loop: 'repeat' } },
      ],
      docsRef: 'schemas/components.md',
    },
    { override: true },
  );
}
registerRenderableComponent();

registerComponent('model.signals', modelSignalsSchema, {
  description:
    'Bind same-entity simulation fields to named GLB transform channels. Visual only; no physics writes.',
  owner: 'client',
  examples: [
    {
      sources: { speed: { component: 'vehicleState', path: ['speed'] } },
      bindings: [
        { node: 'speed-pointer', source: 'speed', property: 'rotation', axis: 'z', scale: 0.04 },
      ],
    },
  ],
  docsRef: 'guide/vehicle-interiors.md',
});

/**
 * Register a renderable `kind` rendered by a capability client half (e.g. 'figure'). Idempotent
 * (re-registering updates the description) and additive: `renderable` is re-registered with the
 * widened `kind` enum — and with any `fields` the kind declares — so `molen validate`, the
 * emitted JSON Schema, and the docs all list it.
 */
export function registerRenderableKind(kind: string, meta: RenderableKindMeta): void {
  if (!/^[a-z][a-z0-9-]*$/.test(kind)) {
    throw new Error(`renderable kind "${kind}" must match /^[a-z][a-z0-9-]*$/`);
  }
  for (const field of Object.keys(meta.fields ?? {})) {
    if (field === 'kind' || field in renderableFields) {
      throw new Error(`renderable kind "${kind}" cannot redefine the core field "${field}"`);
    }
  }
  renderableKinds.set(kind, meta);
  registerRenderableComponent();
}

/** Every registered renderable kind, in registration order (core kinds first). */
export function listRenderableKinds(): { kind: string; description: string; owner?: string }[] {
  return [...renderableKinds].map(([kind, meta]) => ({
    kind,
    description: meta.description,
    ...(meta.owner !== undefined ? { owner: meta.owner } : {}),
  }));
}
registerComponent('light', lightSchema, {
  description: 'A light source at the entity transform (directional/point/spot).',
  owner: 'client',
  examples: [{ type: 'point', color: '#ffdca8', intensity: 2, range: 12 }],
  docsRef: 'schemas/components.md',
});
registerComponent('environment', environmentSchema, {
  description:
    'Singleton scene environment: optional Earth/custom sky, ambient/sun lighting, background, fog, tone mapping, shadow quality tier.',
  owner: 'client',
  examples: [
    {
      ambient: { sky: '#ffffff', ground: '#444455', intensity: 1.1 },
      sun: { direction: [5, 10, 7], intensity: 1.4, castShadow: true },
      shadows: 'medium',
    },
    {
      sky: {
        mode: 'earth',
        observer: { latitude: 47.6, longitude: -122.3 },
        time: { epochMs: 1718942400000, scale: 60 },
      },
      toneMapping: 'agx',
    },
  ],
  docsRef: 'schemas/components.md',
});
registerComponent('lifetime', lifetimeSchema, {
  description: 'Auto-despawn countdown in ticks.',
  owner: 'kernel',
  examples: [{ ticksLeft: 30 }],
  docsRef: 'schemas/components.md',
});
registerComponent('collider', colliderSchema, {
  description: '2.5D kinematic collider (circle or XZ AABB) with layer/mask bitmasks.',
  owner: 'kernel/kinematics',
  examples: [{ shape: 'circle', radius: 0.5, layer: 1, mask: 1 }],
  docsRef: 'schemas/components.md',
});
registerComponent('kinematicBody', kinematicBodySchema, {
  description: 'Velocity-driven body for the kinematic collision layer.',
  owner: 'kernel/kinematics',
  examples: [{ vel: [0, 0, 0], slide: true }],
  docsRef: 'schemas/components.md',
});
registerComponent('character', characterSchema, {
  description:
    'Kinematic character controller state (speed/jump/gravity + kernel-owned vy/grounded).',
  owner: 'kernel/character',
  examples: [{ speed: 6, jumpSpeed: 8, gravity: 20, vy: 0, grounded: true }],
  docsRef: 'schemas/components.md',
});
registerComponent('moveIntent', moveIntentSchema, {
  description: 'Desired planar move direction + jump flag, consumed by the character controller.',
  owner: 'kernel/character',
  examples: [{ dir: [1, 0], jump: false }],
  docsRef: 'schemas/components.md',
});
// --- 3D physics (consumed by @bendyline/molen-physics-rapier; same-platform determinism) ---

const shape3dSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('ball').describe('Sphere.'),
    radius: num.positive().describe('Sphere radius in meters.'),
  }),
  z.strictObject({
    type: z.literal('cuboid').describe('Axis-aligned box (in the collider frame).'),
    hx: num.positive().describe('Half-extent along X in meters.'),
    hy: num.positive().describe('Half-extent along Y in meters.'),
    hz: num.positive().describe('Half-extent along Z in meters.'),
  }),
  z.strictObject({
    type: z.literal('capsule').describe('Capsule aligned with the Y axis.'),
    halfHeight: num
      .nonnegative()
      .describe('Half the length of the cylindrical section along Y in meters (caps excluded).'),
    radius: num.positive().describe('Capsule radius in meters.'),
  }),
  z.strictObject({
    type: z.literal('convexHull').describe('Convex hull of a point cloud.'),
    points: z
      .array(num)
      .min(12)
      .describe(
        'Flat [x, y, z, x, y, z, ...] point list in meters (at least 4 points); the shape is their convex hull.',
      ),
  }),
  z.strictObject({
    type: z.literal('trimesh').describe('Triangle mesh (static geometry).'),
    vertices: z.array(num).min(9).describe('Flat [x, y, z, ...] vertex positions in meters.'),
    indices: z
      .array(z.int().nonnegative())
      .min(3)
      .describe('Triangle vertex indices, three per triangle.'),
  }),
  z.strictObject({
    type: z.literal('asset').describe("Collision geometry from a project asset's sidecar."),
    assetId: z
      .string()
      .min(1)
      .describe('Project asset id whose sidecar collision geometry is used.'),
    collision: z
      .enum(['hull', 'trimesh'])
      .describe('Which sidecar geometry to use: hull (convex, default) or trimesh.')
      .optional(),
    index: z
      .int()
      .nonnegative()
      .describe('Index of the sidecar hull to use when the asset has several (default 0).')
      .optional(),
  }),
  z.strictObject({
    type: z.literal('heightfield').describe('Terrain heightfield.'),
    ref: z
      .string()
      .min(1)
      .describe('Heightfield reference id resolved by the host (e.g. the scene terrain).'),
  }),
]);

const collider3dSchema = z.strictObject({
  shape: shape3dSchema.describe('Collision shape.'),
  offset: vec3
    .describe('Shape offset [x, y, z] in meters relative to the entity transform.')
    .optional(),
  rotOffset: quat
    .describe('Shape rotation quaternion [x, y, z, w] relative to the entity transform.')
    .optional(),
  layer: z
    .int()
    .min(0)
    .max(0xffff)
    .describe('16-bit collision-group bitmask this collider belongs to (default 1).')
    .optional(),
  mask: z
    .int()
    .min(0)
    .max(0xffff)
    .describe('16-bit bitmask of groups this collider collides with (default 0xffff = all).')
    .optional(),
  sensor: z
    .boolean()
    .describe('Sensor colliders detect overlaps (collision events) but produce no contact forces.')
    .optional(),
  events: z
    .boolean()
    .describe("Emit 'collision' / 'collisionEnd' world events for this collider.")
    .optional(),
  restitution: num.min(0).describe('Bounciness coefficient (0 = inelastic).').optional(),
  friction: num.min(0).describe('Coulomb friction coefficient.').optional(),
  density: num
    .positive()
    .describe('Mass density in kg/m^3 used to derive the body mass from the shape volume.')
    .optional(),
});

const rigidbodySchema = z.strictObject({
  body: z
    .enum(['dynamic', 'fixed', 'kinematicPosition'])
    .describe(
      'Body type: dynamic (simulated), fixed (immovable), or kinematicPosition (driven by transform writes, e.g. characters).',
    ),
  gravityScale: num
    .describe('Multiplier on scene gravity for this body (1 = normal, 0 = weightless).')
    .optional(),
  linearDamping: num
    .min(0)
    .describe('Linear velocity damping coefficient per second (0 = none).')
    .optional(),
  angularDamping: num
    .min(0)
    .describe('Angular velocity damping coefficient per second (0 = none).')
    .optional(),
  ccd: z
    .boolean()
    .describe('Enable continuous collision detection for fast-moving bodies.')
    .optional(),
  lockRot: z.boolean().describe('Lock all rotations so the body never tumbles.').optional(),
});

const jointSchema = z.strictObject({
  type: z
    .enum(['fixed', 'revolute', 'spherical', 'prismatic'])
    .describe('Joint type: fixed, revolute (hinge), spherical (ball), or prismatic (slider).'),
  other: z.string().min(1).describe('Entity id of the other body.'),
  anchor1: vec3.describe("Anchor point [x, y, z] in meters in this body's local frame."),
  anchor2: vec3.describe("Anchor point [x, y, z] in meters in the other body's local frame."),
  axis: vec3
    .describe("Joint axis [x, y, z] in this body's local frame (revolute/prismatic).")
    .optional(),
  limits: z
    .array(num)
    .length(2)
    .describe('[min, max] joint limits: radians for revolute, meters for prismatic.')
    .optional(),
  motor: z
    .strictObject({
      targetVel: num.describe('Target joint velocity: rad/s for revolute, m/s for prismatic.'),
      maxForce: num.positive().describe('Maximum force (N) or torque (N*m) the motor may apply.'),
    })
    .describe('Velocity motor driving the joint (revolute/prismatic).')
    .optional(),
});

const forceSchema = z.strictObject({
  linear: vec3
    .describe('Force [x, y, z] in newtons applied at the center of mass every tick while present.')
    .optional(),
  torque: vec3.describe('Torque [x, y, z] in N*m applied every tick while present.').optional(),
});
const impulseSchema = z.strictObject({
  v: vec3.describe('Linear impulse [x, y, z] in N*s (kg*m/s) applied once.').optional(),
  torque: vec3.describe('Angular impulse [x, y, z] in N*m*s applied once.').optional(),
});
const setVelocitySchema = z.strictObject({
  linear: vec3.describe('Linear velocity [x, y, z] in m/s to set once.').optional(),
  angular: vec3.describe('Angular velocity [x, y, z] in rad/s to set once.').optional(),
});
const velocitySchema = z.strictObject({
  linear: vec3.describe('Current linear velocity [x, y, z] in m/s (plugin-written each tick).'),
  angular: vec3.describe('Current angular velocity [x, y, z] in rad/s (plugin-written each tick).'),
});

registerComponent('collider3d', collider3dSchema, {
  description:
    '3D collider (ball/cuboid/capsule/hull/trimesh/asset/heightfield) with layer/mask, sensor, and material params. Static without a rigidbody.',
  owner: 'physics-rapier',
  examples: [{ shape: { type: 'cuboid', hx: 10, hy: 0.5, hz: 10 } }],
  docsRef: 'schemas/components.md',
});
registerComponent('rigidbody', rigidbodySchema, {
  description: '3D rigid-body dynamics: dynamic, fixed, or kinematicPosition (characters).',
  owner: 'physics-rapier',
  examples: [{ body: 'dynamic' }],
  docsRef: 'schemas/components.md',
});
registerComponent('joint', jointSchema, {
  description: 'Impulse joint to another body (fixed/revolute/spherical/prismatic + limits/motor).',
  owner: 'physics-rapier',
  examples: [
    { type: 'revolute', other: 'chassis', anchor1: [0, 0, 1], anchor2: [0, 0, 0], axis: [0, 0, 1] },
  ],
  docsRef: 'schemas/components.md',
});
registerComponent('force', forceSchema, {
  description: 'Continuous force/torque applied every tick while present.',
  owner: 'physics-rapier',
  examples: [{ linear: [0, 20, 0] }],
  docsRef: 'schemas/components.md',
});
registerComponent('impulse', impulseSchema, {
  description: 'One-shot impulse/torque; consumed the tick it is applied.',
  owner: 'physics-rapier',
  examples: [{ v: [10, 0, 0] }],
  docsRef: 'schemas/components.md',
});
registerComponent('setVelocity', setVelocitySchema, {
  description: 'One-shot velocity set; consumed the tick it is applied.',
  owner: 'physics-rapier',
  examples: [{ linear: [0, 0, 5] }],
  docsRef: 'schemas/components.md',
});
registerComponent('velocity', velocitySchema, {
  description: 'Opt-in per-tick body velocity mirror (presence = subscription; plugin-written).',
  owner: 'physics-rapier',
  examples: [{ linear: [0, 0, 0], angular: [0, 0, 0] }],
  docsRef: 'schemas/components.md',
});

// --- gameplay layer (kernel systems installed by installGameplay) ---

const parentSchema = z.strictObject({
  id: z.string().min(1).describe('Entity id of the parent.'),
  /** What happens to this entity when the parent dies. Default: destroy (cascade). */
  onParentDestroyed: z
    .enum(['destroy', 'detach'])
    .describe(
      'When the parent is destroyed: destroy this entity too (default, cascading) or detach it and keep it alive.',
    )
    .optional(),
});
const timerSchema = z.strictObject({
  timers: z
    .array(
      z.strictObject({
        id: z.string().min(1).describe('Timer id, unique within this entity.'),
        ticksLeft: z
          .int()
          .positive()
          .describe('Ticks until the timer fires; decremented each tick.'),
        event: z
          .string()
          .min(1)
          .describe(
            'World event type emitted when the timer fires (payload carries entity + timerId).',
          ),
        payload: jsonValueLoose
          .describe('Optional JSON payload included in the emitted event.')
          .optional(),
        repeatEvery: z
          .int()
          .positive()
          .describe('If set, the timer re-arms with this many ticks after firing (repeating).')
          .optional(),
      }),
    )
    .describe('Active timers on this entity.'),
});
const tweenSchema = z.strictObject({
  tweens: z
    .array(
      z.strictObject({
        id: z.string().min(1).describe('Optional tween id.').optional(),
        component: z.string().min(1).describe('Name of the component whose value is animated.'),
        path: z
          .string()
          .min(1)
          .describe(
            "Select-style value path within the component, e.g. 'pos', 'pos[1]', or 'primitive.size'.",
          ),
        from: z
          .union([num, z.array(num)])
          .describe(
            'Start value (number or number array); defaults to the current value when the tween starts.',
          )
          .optional(),
        to: z
          .union([num, z.array(num)])
          .describe('End value (number or number array, same arity as from).'),
        ticks: z.int().positive().describe('Duration in ticks.'),
        elapsed: z
          .int()
          .nonnegative()
          .describe('Ticks elapsed so far (kernel-owned; starts at 0).')
          .optional(),
        easing: z
          .enum(['linear', 'quadIn', 'quadOut', 'quadInOut', 'cubicIn', 'cubicOut', 'cubicInOut'])
          .describe('Easing curve (default linear).')
          .optional(),
        loop: z
          .enum(['none', 'loop', 'pingpong'])
          .describe(
            'After completing: none (remove, default), loop (restart from `from`), or pingpong (swap from/to).',
          )
          .optional(),
        emitOnComplete: z
          .string()
          .describe('World event type emitted (payload { entity }) each time the tween completes.')
          .optional(),
      }),
    )
    .describe('Active tweens on this entity.'),
});
const fsmSchema = z.strictObject({
  state: z.string().min(1).describe('Current state name.'),
  transitions: z
    .array(
      z.strictObject({
        from: z.string().min(1).describe("State the transition leaves ('*' matches any state)."),
        event: z
          .string()
          .min(1)
          .describe(
            'World event type that triggers the transition (events with payload.entity only match that entity).',
          ),
        to: z.string().min(1).describe('State entered.'),
      }),
    )
    .describe('Transition table, checked in order; the first match wins.'),
});

registerComponent('parent', parentSchema, {
  description:
    'Attach to a parent entity: transform becomes parent.transform × localTransform each tick.',
  owner: 'kernel/gameplay',
  examples: [{ id: 'turret-base' }],
  docsRef: 'schemas/components.md',
});
registerComponent('localTransform', localTransformSchema, {
  description: 'Parent-relative transform for entities carrying `parent`.',
  owner: 'kernel/gameplay',
  examples: [{ pos: [0, 1, 0], rot: [0, 0, 0, 1] }],
  docsRef: 'schemas/components.md',
});
registerComponent('timer', timerSchema, {
  description:
    'Snapshot-safe countdown timers that emit events (one-shot or repeating). Replaces callbacks.',
  owner: 'kernel/gameplay',
  examples: [{ timers: [{ id: 'respawn', ticksLeft: 90, event: 'respawn_ready' }] }],
  docsRef: 'schemas/components.md',
});
registerComponent('tween', tweenSchema, {
  description:
    'Data-driven value animation over ticks: component + select-style path, lerp with easing.',
  owner: 'kernel/gameplay',
  examples: [
    { tweens: [{ component: 'transform', path: 'pos[1]', to: 4, ticks: 30, easing: 'quadOut' }] },
  ],
  docsRef: 'schemas/components.md',
});
registerComponent('fsm', fsmSchema, {
  description:
    'Minimal event-driven state machine: transitions fire on world events targeting the entity.',
  owner: 'kernel/gameplay',
  examples: [
    {
      state: 'idle',
      transitions: [{ from: 'idle', event: 'player_seen', to: 'aggro' }],
    },
  ],
  docsRef: 'schemas/components.md',
});

registerComponent('health', healthSchema, {
  description: 'Common gameplay hit-points component.',
  owner: 'content',
  examples: [{ hp: 100 }],
  docsRef: 'schemas/components.md',
});
registerComponent('tag', tagSchema, {
  description: 'Named tag for selecting/grouping entities (e.g. tag.name === "enemy").',
  owner: 'content',
  examples: [{ name: 'enemy' }],
  docsRef: 'schemas/components.md',
});

// Lightweight XY platform games: dimensions are explicit world-space meters, independent of
// renderable geometry and visual scale. Static axis-aligned solids, no rigid-body response.
// array().length(2) (not tuple) so the emitted JSON Schema carries minItems/maxItems; z.tuple
// emits prefixItems only, which lenient Ajv accepts at any length and strict Ajv refuses to
// compile at all. Same reason as rngStateSchema in formats.ts.
const platformHalf = z.array(num.positive()).length(2);
const platformVec2 = z.array(num).length(2);
registerComponent(
  'platformSolid',
  z.strictObject({
    halfExtents: platformHalf.describe(
      'Static XY box half-width/half-height in world meters. Rotation and visual scale do not affect collision.',
    ),
    oneWay: z
      .boolean()
      .describe('Only stop descending bodies crossing the top; default false.')
      .optional(),
  }),
  {
    owner: 'kernel',
    description: 'Static XY solid for physics.engine=platformer; Z is ignored.',
    examples: [{ halfExtents: [3, 0.5] }],
  },
);
registerComponent(
  'platformBody',
  z.strictObject({
    halfExtents: platformHalf.describe(
      'Moving XY box half-width/half-height, world meters. Z remains unchanged.',
    ),
    vel: platformVec2.optional().describe('XY velocity in meters/second; default [0,0].'),
    speed: num.positive().optional().describe('Maximum horizontal speed; default 7 m/s.'),
    acceleration: num
      .positive()
      .optional()
      .describe('Horizontal acceleration/braking; default 45 m/s squared.'),
    gravity: num.positive().optional().describe('Downward acceleration; default 28 m/s squared.'),
    jumpSpeed: num.positive().optional().describe('Jump velocity; default 11 m/s.'),
    grounded: z.boolean().optional().describe('Output: landed in the last physics tick.'),
    coyoteTicks: z
      .int()
      .nonnegative()
      .optional()
      .describe('Jump grace after leaving a ledge; default 3 ticks.'),
    bufferTicks: z
      .int()
      .nonnegative()
      .optional()
      .describe('Jump input buffer before landing; default 4 ticks.'),
    grace: z
      .int()
      .nonnegative()
      .optional()
      .describe('Runtime remaining coyote ticks; checkpointed.'),
    buffered: z
      .int()
      .nonnegative()
      .optional()
      .describe('Runtime remaining buffered jump ticks; checkpointed.'),
  }),
  {
    owner: 'kernel',
    description:
      'Deterministic XY platform controller: gravity, swept wall/floor/ceiling collision, jump buffering and coyote time.',
    examples: [{ halfExtents: [0.4, 0.6], speed: 7, jumpSpeed: 11 }],
  },
);
registerComponent(
  'platformIntent',
  z.strictObject({
    move: num.min(-1).max(1).describe('Horizontal intent -1..1.'),
    jump: z
      .boolean()
      .optional()
      .describe(
        'One-shot jump request, consumed by the controller. Send on press, not every tick.',
      ),
    jumpHeld: z
      .boolean()
      .optional()
      .describe('Hold for full height; false cuts upward velocity for a short hop. Default true.'),
  }),
  {
    owner: 'kernel',
    description: 'Input to a platformBody. Scripts translate declared commands to this component.',
    examples: [{ move: 1, jump: true, jumpHeld: true }],
  },
);

function describedFields<T extends Record<string, z.ZodType>>(shape: T): T {
  return Object.fromEntries(
    Object.entries(shape).map(([name, schema]) => [
      name,
      schema.description ? schema : schema.describe(`External ${name} setting.`),
    ]),
  ) as T;
}

const vehicleSpecSchema = z.strictObject(
  describedFields({
    label: z.string().min(1),
    width: num.positive(),
    length: num.positive(),
    height: num.positive(),
    centerOfMass: vec3,
    wheelbase: num.positive(),
    wheelTrack: num.positive(),
    wheelRadius: num.positive(),
    mass: num.positive(),
    engineForce: num.positive(),
    maxSpeed: num.positive(),
    reverseSpeed: num.positive(),
    brakeDeceleration: num.positive(),
    maxSteer: num.positive(),
    grip: num.positive(),
    driverEye: vec3,
    steeringRate: num.positive(),
    steeringFadeSpeed: num.positive(),
    rollingResistance: num.nonnegative(),
    aerodynamicResistance: num.nonnegative(),
    terrainAlignRate: num.positive(),
    supportTolerance: num.nonnegative(),
    maxStepHeight: num.nonnegative(),
    maxSlope: num.positive(),
  }),
);
const vehicleVisualSchema = z.strictObject(
  describedFields({
    wheelNodes: z.array(z.string().min(1)).min(1),
    frontWheelNodes: z.array(z.string().min(1)).min(1),
    steeringWheelNode: z.string().min(1).optional(),
    paintMaterial: z.string().min(1),
    interior: vehicleInteriorSchema.optional(),
  }),
);

registerComponent(
  'vehicle',
  z.strictObject({
    kind: z.string().min(1).describe('Stable external entity/type id.'),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .describe('Body paint as an sRGB #rrggbb color.'),
    spec: vehicleSpecSchema.describe('Complete data-driven chassis and handling configuration.'),
    visual: vehicleVisualSchema.describe('Named GLB nodes/material used by the generic client.'),
  }),
  {
    description:
      'External wheeled-vehicle instance: stable id, paint, complete physics tuning, and GLB bindings.',
    owner: 'kernel/vehicles',
    examples: [
      {
        kind: 'example.vehicle',
        color: '#566d82',
        spec: {
          label: 'Example car',
          width: 1.8,
          length: 4.6,
          height: 1.5,
          centerOfMass: [0, 0.55, 0],
          wheelbase: 2.75,
          wheelTrack: 1.5,
          wheelRadius: 0.31,
          mass: 1450,
          engineForce: 6200,
          maxSpeed: 42,
          reverseSpeed: 8,
          brakeDeceleration: 9.5,
          maxSteer: 0.56,
          grip: 8,
          driverEye: [0.4, 1.14, 0.25],
          steeringRate: 1.8,
          steeringFadeSpeed: 18,
          rollingResistance: 0.15,
          aerodynamicResistance: 0.0025,
          terrainAlignRate: 1.8,
          supportTolerance: 0.08,
          maxStepHeight: 0.4,
          maxSlope: 0.61,
        },
        visual: {
          wheelNodes: ['wheel-front-left'],
          frontWheelNodes: ['wheel-front-left'],
          steeringWheelNode: 'steering-wheel',
          paintMaterial: 'vehicle-paint-and-trim',
        },
      },
    ],
    docsRef: 'guide/vehicles.md',
  },
);
registerComponent(
  'vehicleInput',
  z.strictObject({
    throttle: num
      .min(-1)
      .max(1)
      .describe('Signed accelerator; opposite input brakes to zero before reversing.'),
    steering: num.min(-1).max(1).describe('Steering intent -1..1; positive turns right.'),
    brake: z.boolean().describe('Apply the service/parking brake while true.'),
  }),
  {
    description:
      'Driver intent: signed throttle (negative brakes then reverses), signed steering (positive right), brake/handbrake.',
    owner: 'kernel/vehicles',
    examples: [{ throttle: 1, steering: 0, brake: false }],
    docsRef: 'guide/vehicles.md',
  },
);
registerComponent(
  'vehicleState',
  z.strictObject({
    speed: num.describe('Signed forward speed in meters per second.'),
    steer: num.describe('Current front wheel steering angle in radians. Positive turns right.'),
    yaw: num.describe('Chassis rotation about Y in radians; zero faces +Z.'),
    pitch: num.describe('Chassis rotation about local X in radians, from terrain support.'),
    roll: num.describe('Chassis rotation about local Z in radians, from terrain support.'),
    vy: num.describe('Vertical velocity in meters per second.'),
    grounded: z.boolean().describe('Whether wheel support currently carries the chassis.'),
    waitingForTerrain: z
      .boolean()
      .describe('Motion is paused because one or more wheel samples have no terrain.'),
    wheelAngle: num.describe('Accumulated wheel spin angle in radians, wrapped each revolution.'),
  }),
  {
    description:
      'Snapshot-safe chassis state. Speeds in m/s, angles in radians; owned by installVehicles.',
    owner: 'kernel/vehicles',
    examples: [
      {
        speed: 0,
        steer: 0,
        yaw: 0,
        pitch: 0,
        roll: 0,
        vy: 0,
        grounded: true,
        waitingForTerrain: false,
        wheelAngle: 0,
      },
    ],
    docsRef: 'guide/vehicles.md',
  },
);
registerComponent(
  'mountable',
  z.strictObject({
    seats: z
      .array(
        z.strictObject({
          id: z.string().min(1).describe('Unique seat identifier within this mount.'),
          role: z
            .enum(['driver', 'passenger'])
            .describe('Only a driver seat grants vehicle control.'),
          position: vec3.describe(
            'Local rider/camera anchor in meters, transformed by the chassis quaternion.',
          ),
        }),
      )
      .min(1)
      .describe('Available seat definitions. Each seat can hold one actor.'),
    exits: z.array(vec3).min(1).describe('Ordered local foot positions to check when dismounting.'),
    reach: num
      .positive()
      .describe('Maximum distance in meters from the actor to the seat to enter.'),
  }),
  {
    description:
      'Mount points in local meters, ordered safe exit candidates, and interaction reach. Seat position is the rider camera anchor.',
    owner: 'kernel/vehicles',
    examples: [
      {
        seats: [{ id: 'driver', role: 'driver', position: [0.4, 1.14, 0.25] }],
        exits: [
          [-1.56, 0, 0.25],
          [1.56, 0, 0.25],
        ],
        reach: 3,
      },
    ],
    docsRef: 'guide/vehicles.md',
  },
);
registerComponent(
  'mounted',
  z.strictObject({
    vehicle: z.string().min(1).describe('Entity ID of the mount.'),
    seat: z.string().min(1).describe('Occupied seat ID in the mountable component.'),
  }),
  {
    description:
      'Rider-to-mount relationship. Occupied seats are exclusive; mounted characters bypass walking physics.',
    owner: 'kernel/vehicles',
    examples: [{ vehicle: 'car-1', seat: 'driver' }],
    docsRef: 'guide/vehicles.md',
  },
);
const visualBindingSchema = z.strictObject(
  describedFields({
    node: z.string().min(1),
    axis: z.enum(['x', 'y', 'z']),
    multiplier: num,
  }),
);
const airplanePhysicsSchema = z.strictObject(
  describedFields({
    wingPosition: vec3,
    wingArea: num.positive(),
    controlAuthoritySpeed: num.positive(),
    maxControlAuthority: num.positive(),
    pitchAuthority: num.positive(),
    pitchResponse: num.positive(),
    stallPitchRate: num.nonnegative(),
    rollAuthority: num.positive(),
    rollResponse: num.positive(),
    rudderAuthority: num.positive(),
    groundSteerSpeed: num.positive(),
    coordinatedTurnMinSpeed: num.positive(),
    groundLevelRate: num.positive(),
    maxPitch: num.positive(),
    maxGroundPitch: num.positive(),
    maxRoll: num.positive(),
    camberAngle: num,
    flapLift: num.nonnegative(),
    postStallFlapEffect: num.nonnegative(),
    stallAngle: num.positive(),
    stallTransitionAngle: num
      .positive()
      .optional()
      .describe('Radians beyond stallAngle over which flow separates smoothly. Default 0.12.'),
    yawStability: num
      .nonnegative()
      .optional()
      .describe('Sideslip restoring yaw rate per radian at reference airspeed, in 1/s. Default 1.'),
    yawInertia: num
      .positive()
      .optional()
      .describe('Yaw inertia in kg m². Default mass * (span² + length²) / 12.'),
    thrustYawDamping: num
      .nonnegative()
      .optional()
      .describe(
        'Thrust-induced yaw-rate damping in 1/s at reference airspeed. Default 1.2; scales with airspeed with a 20% floor.',
      ),
    stallSpeed: num
      .positive()
      .describe(
        'Legacy tuning reference in m/s; aerodynamic stall detection uses angle of attack.',
      ),
    liftSlope: num.positive(),
    postStallLift: num.nonnegative(),
    postStallDecay: num.nonnegative(),
    profileDrag: num.nonnegative(),
    inducedDrag: num.nonnegative(),
    gearDrag: num.nonnegative(),
    flapDrag: num.nonnegative(),
    stallDrag: num
      .nonnegative()
      .describe(
        'Broadside separated-flow drag coefficient, blended by separation and sin(alpha)^2.',
      ),
    propellerEfficiency: num.nonnegative(),
    maxThrust: num.positive(),
    minPropellerSpeed: num.positive(),
    lateralDamping: num.nonnegative(),
    brakeDeceleration: num.positive(),
    rollingDeceleration: num.nonnegative(),
    groundTrackRate: num.positive(),
  }),
);
const helicopterPhysicsSchema = z.strictObject(
  describedFields({
    rotorPosition: vec3,
    rotorRadius: num.positive(),
    cyclicTilt: num.positive(),
    cyclicResponse: num.positive(),
    cyclicDamping: num.nonnegative(),
    groundLevelRate: num.positive(),
    maxTilt: num.positive(),
    yawRate: num.positive(),
    liftMultiplier: num.positive(),
    groundEffect: num.nonnegative(),
    translationalLift: num.nonnegative(),
    translationalLiftSpeed: num.positive(),
    verticalDrag: num.nonnegative(),
    horizontalDrag: num.nonnegative(),
    quadraticDrag: num.nonnegative(),
    groundDeceleration: num.positive(),
  }),
);
const aircraftEngineSchema = z.strictObject(
  describedFields({
    position: vec3.describe(
      'Engine thrust application point in aircraft-local meters, relative to the landing-contact origin.',
    ),
    thrustAxis: vec3
      .refine((axis) => axis.some((value) => value !== 0), 'Thrust axis must be nonzero.')
      .describe('Local thrust direction; normalized by the solver.'),
    power: num.positive().describe('Maximum shaft power in watts, for this engine only.'),
    idleRpm: num.min(0).max(1),
    spoolRate: num.positive(),
    rotorAngularSpeed: num.positive(),
    propellerEfficiency: num
      .min(0)
      .max(1)
      .optional()
      .describe('Per-engine override of airplane.propellerEfficiency.'),
    maxThrust: num
      .positive()
      .optional()
      .describe('Per-engine static thrust cap in newtons; defaults to airplane.maxThrust.'),
    minPropellerSpeed: num
      .positive()
      .optional()
      .describe(
        'Minimum propeller advance speed in m/s for the power/thrust calculation; defaults to airplane.minPropellerSpeed.',
      ),
  }),
);
const aircraftEngineId = z
  .string()
  .regex(/^[A-Za-z][A-Za-z0-9_-]*$/)
  .refine((id) => !['__proto__', 'constructor', 'prototype'].includes(id), 'Reserved engine id.')
  .describe('Stable engine id, such as left or right; single-engine form uses main.');
const aircraftSpecSchema = z
  .strictObject(
    describedFields({
      label: z.string().min(1),
      model: z.enum(['airplane', 'helicopter']),
      mass: num.positive(),
      span: num.positive(),
      length: num.positive(),
      height: num.positive(),
      centerOfMass: vec3,
      pilotEye: vec3,
      engine: aircraftEngineSchema
        .optional()
        .describe('Single engine, implicitly named main. Supply exactly one of engine or engines.'),
      engines: z
        .array(aircraftEngineSchema.extend({ id: aircraftEngineId }))
        .min(1)
        .optional()
        .describe(
          'Named independent airplane engines; ids must be unique. Each power/thrust limit is per engine.',
        ),
      airplane: airplanePhysicsSchema.optional(),
      helicopter: helicopterPhysicsSchema.optional(),
      hardLandingSpeed: num.positive(),
      hardLandingRoll: num.positive(),
      hardLandingPitch: num.positive(),
      maxSupportStep: num.nonnegative(),
      collisionProbes: z.array(vec3).min(1),
      visual: z.strictObject(
        describedFields({
          rotors: z.array(
            visualBindingSchema.extend({
              engine: aircraftEngineId
                .optional()
                .describe('Engine id driving this propeller; omitted follows the first engine.'),
            }),
          ),
          gearNodes: z.array(z.string().min(1)),
          flaps: z.array(visualBindingSchema),
          ailerons: z.array(visualBindingSchema),
          controlStick: z
            .strictObject(
              describedFields({
                node: z.string().min(1),
                pitchAxis: z.enum(['x', 'y', 'z']),
                rollAxis: z.enum(['x', 'y', 'z']),
              }),
            )
            .optional(),
          collective: visualBindingSchema.optional(),
          airspeedGaugeMax: num.positive().optional(),
          interior: vehicleInteriorSchema.optional(),
        }),
      ),
    }),
  )
  .superRefine((value, ctx) => {
    if ((value.engine === undefined) === (value.engines === undefined))
      ctx.addIssue({
        code: 'custom',
        path: ['engines'],
        message: 'Supply exactly one of engine or engines.',
      });
    if (value.model === 'helicopter' && value.engines !== undefined)
      ctx.addIssue({
        code: 'custom',
        path: ['engines'],
        message:
          'Independent propeller engines require model airplane; helicopters use engine and a shared rotor.',
      });
    const ids = new Set<string>();
    if (value.engine !== undefined) ids.add('main');
    for (const [index, engine] of (value.engines ?? []).entries()) {
      if (ids.has(engine.id))
        ctx.addIssue({
          code: 'custom',
          path: ['engines', index, 'id'],
          message: 'Engine ids must be unique.',
        });
      ids.add(engine.id);
    }
    for (const [index, rotor] of value.visual.rotors.entries())
      if (rotor.engine !== undefined && !ids.has(rotor.engine))
        ctx.addIssue({
          code: 'custom',
          path: ['visual', 'rotors', index, 'engine'],
          message: `Unknown engine id ${rotor.engine}.`,
        });
    const expected = value.model === 'airplane' ? value.airplane : value.helicopter;
    if (expected === undefined)
      ctx.addIssue({
        code: 'custom',
        path: [value.model],
        message: `${value.model} configuration is required for model ${value.model}`,
      });
  });

registerComponent(
  'aircraft',
  z.strictObject({
    kind: z.string().min(1).describe('Stable external entity/type id.'),
    spec: aircraftSpecSchema.describe('Complete airplane or helicopter performance configuration.'),
  }),
  {
    owner: 'kernel/aircraft',
    description: 'External airplane/helicopter instance. Y up, Z forward; landing-contact origin.',
    docsRef: 'guide/aircraft.md',
    examples: [
      {
        kind: 'example.airplane',
        spec: {
          label: 'Example airplane',
          model: 'airplane',
          mass: 1200,
          span: 10,
          length: 8,
          height: 3,
          centerOfMass: [0, 1, 0],
          pilotEye: [0, 1.8, 0],
          engine: {
            position: [0, 1, 2.5],
            thrustAxis: [0, 0, 1],
            power: 200000,
            idleRpm: 0.2,
            spoolRate: 0.5,
            rotorAngularSpeed: 200,
          },
          airplane: {
            wingPosition: [0, 1, 0],
            wingArea: 16,
            controlAuthoritySpeed: 45,
            maxControlAuthority: 1.3,
            pitchAuthority: 0.4,
            pitchResponse: 0.75,
            stallPitchRate: 0.18,
            rollAuthority: 1,
            rollResponse: 2,
            rudderAuthority: 0.2,
            groundSteerSpeed: 8,
            coordinatedTurnMinSpeed: 25,
            groundLevelRate: 2,
            maxPitch: 1.2,
            maxGroundPitch: 0.2,
            maxRoll: 1.3,
            camberAngle: 0.04,
            flapLift: 0.3,
            postStallFlapEffect: 0.4,
            stallAngle: 0.28,
            stallSpeed: 22,
            liftSlope: 4.5,
            postStallLift: 0.2,
            postStallDecay: 2.8,
            profileDrag: 0.025,
            inducedDrag: 0.065,
            gearDrag: 0.018,
            flapDrag: 0.035,
            stallDrag: 0.2,
            propellerEfficiency: 0.8,
            maxThrust: 5000,
            minPropellerSpeed: 40,
            lateralDamping: 0.8,
            brakeDeceleration: 7,
            rollingDeceleration: 0.22,
            groundTrackRate: 12,
          },
          hardLandingSpeed: 4.5,
          hardLandingRoll: 0.3,
          hardLandingPitch: 0.35,
          maxSupportStep: 0.65,
          collisionProbes: [[0, 1, 0]],
          visual: {
            rotors: [{ node: 'propeller', axis: 'z', multiplier: 1 }],
            gearNodes: ['gear'],
            flaps: [{ node: 'flap', axis: 'x', multiplier: -0.45 }],
            ailerons: [{ node: 'aileron', axis: 'x', multiplier: 0.3 }],
            controlStick: { node: 'control-stick', pitchAxis: 'x', rollAxis: 'z' },
            airspeedGaugeMax: 180,
          },
        },
      },
    ],
  },
);
registerComponent(
  'aircraftInput',
  z.strictObject({
    power: num
      .min(0)
      .max(1)
      .describe('Absolute throttle for a plane; collective for a helicopter.'),
    pitch: num.min(-1).max(1).describe('Positive pulls the nose up.'),
    roll: num.min(-1).max(1).describe('Positive banks right.'),
    yaw: num.min(-1).max(1).describe('Positive rudder/pedals turns right.'),
    brake: z.boolean().describe('Ground wheel brake.'),
    engine: z.boolean().describe('Engine on; rotor/propeller spools over time.'),
    engines: z
      .record(
        aircraftEngineId,
        z.strictObject({
          power: num
            .min(0)
            .max(1)
            .optional()
            .describe('Absolute throttle override; omitted inherits common power.'),
          enabled: z
            .boolean()
            .optional()
            .describe('Individual engine switch; common engine switch is the master cutoff.'),
        }),
      )
      .optional()
      .describe(
        'Per-engine pilot overrides by id. Failures live in aircraftState and cannot be cleared by pilot input.',
      ),
    gear: z.boolean().describe('Landing gear extended; helicopter skids are fixed.'),
    flaps: z.boolean().describe('Plane landing flaps extended.'),
  }),
  {
    owner: 'kernel/aircraft',
    description: 'Pilot flight controls. Power is retained when input keys are released.',
    docsRef: 'guide/aircraft.md',
    examples: [
      { power: 0, pitch: 0, roll: 0, yaw: 0, brake: true, engine: false, gear: true, flaps: false },
    ],
  },
);
registerComponent(
  'aircraftState',
  z.strictObject({
    velocity: vec3.describe('World velocity in meters per second.'),
    yaw: num.describe('Heading in radians, zero +Z.'),
    pitch: num.describe('Nose-up angle in radians.'),
    roll: num.describe('Right bank angle in radians.'),
    pitchRate: num.describe('Pitch angular speed in radians per second.'),
    rollRate: num.describe('Roll angular speed in radians per second.'),
    thrustYawRate: num
      .optional()
      .describe('Additional thrust-induced yaw angular speed about local +Y, in rad/s.'),
    engines: z
      .record(
        aircraftEngineId,
        z.strictObject({
          rpm: num.min(0).max(1),
          rotorAngle: num,
          failed: z.boolean(),
          thrust: num
            .nonnegative()
            .describe('Current propeller thrust in newtons; zero for the helicopter shaft engine.'),
        }),
      )
      .optional()
      .describe(
        'Authoritative individual spool, rotor phase, failure and thrust state; initialized by the solver.',
      ),
    rpm: num
      .min(0)
      .max(1)
      .describe('Maximum normalized RPM across all engines; used by common HUDs and exit checks.'),
    rotorAngle: num.describe(
      'First engine rotor phase, wrapped in radians; bind visuals by engine id for independent phases.',
    ),
    airspeed: num.nonnegative().describe('Speed relative to wind in meters per second.'),
    altitudeAGL: num.nonnegative().describe('Height above available terrain in meters.'),
    verticalSpeed: num.describe('Vertical velocity in meters per second.'),
    angleOfAttack: num.describe('Wing incidence relative to airflow in radians.'),
    stalled: z.boolean().describe('Wing beyond useful lift envelope.'),
    grounded: z.boolean().describe('Supported by landing surface.'),
    crashed: z
      .boolean()
      .describe('Hard landing or obstruction impact; explicit recovery required.'),
    waitingForTerrain: z
      .boolean()
      .describe('Paused at last known position while terrain is unavailable.'),
  }),
  {
    owner: 'kernel/aircraft',
    description:
      'Deterministic flight state, including rotor phase and engine spool, preserved by keyframes.',
    docsRef: 'guide/aircraft.md',
    examples: [
      {
        velocity: [0, 0, 0],
        yaw: 0,
        pitch: 0,
        roll: 0,
        pitchRate: 0,
        rollRate: 0,
        rpm: 0,
        rotorAngle: 0,
        airspeed: 0,
        altitudeAGL: 0,
        verticalSpeed: 0,
        angleOfAttack: 0,
        stalled: false,
        grounded: true,
        crashed: false,
        waitingForTerrain: false,
      },
    ],
  },
);

// Snapshotted after the engine's own registrations above: the vocabulary no document, project,
// or test may take away (see unregisterComponent). Capability packages register later, so
// theirs stay removable — a host that installed them can uninstall them.
const CORE_COMPONENTS: ReadonlySet<string> = new Set(components.keys());
