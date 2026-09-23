import { dmath } from '@bendyline/molen-kernel';
import { schemaToTsType } from './schema-to-ts';

// Ambient declarations for scene-data scripts. The script layer is intentionally string-named
// (scripts are text inside scene.json, evaluated in a SES sandbox with no build step), so the
// types cannot live in the script source — they are generated beside it from the same facts the
// engine validates against: the component registry, the scene's entities/prefabs/commands, and
// the project's registry types. A script stays plain JavaScript; `checkJs` turns a component
// typo or a bad command payload into a tsc error before the first tick.

export interface ScriptComponentType {
  name: string;
  description: string;
  /** JSON Schema for the component's data (from the registry). */
  schema: unknown;
}

export interface ScriptCommandType {
  name: string;
  doc?: string;
  /** JSON Schema for the command payload, when the scene declares one. */
  payload?: unknown;
}

export interface ScriptConfigEntry {
  scriptId: string;
  config: Record<string, unknown>;
}

export interface ScriptTypesInput {
  /** Scene file names contributing to these declarations (header provenance). */
  scenes: string[];
  components: ScriptComponentType[];
  /** Entity ids declared in the scenes (completion only — spawned ids stay open). */
  entityIds: string[];
  prefabs: string[];
  /** Project registry type ids available to `spawnType`. */
  typeIds: string[];
  commands: ScriptCommandType[];
  configs: ScriptConfigEntry[];
  /** Capability namespaces the scenes install (`physics`, `terrain`, …). */
  capabilities: string[];
}

/** Signatures for the deterministic math endowment, keyed by dmath export. */
const MATH_SIGNATURES: Readonly<Record<string, string>> = {
  PI: 'readonly PI: number;',
  TAU: 'readonly TAU: number;',
  abs: 'abs(x: number): number;',
  acos: 'acos(x: number): number;',
  asin: 'asin(x: number): number;',
  atan: 'atan(x: number): number;',
  atan2: 'atan2(y: number, x: number): number;',
  ceil: 'ceil(x: number): number;',
  clamp: 'clamp(x: number, lo: number, hi: number): number;',
  cos: 'cos(x: number): number;',
  exp: 'exp(x: number): number;',
  floor: 'floor(x: number): number;',
  /** Fractional part in [0, 1): x - floor(x). */
  frac: 'frac(x: number): number;',
  hypot: 'hypot(x: number, y: number, z?: number): number;',
  lerp: 'lerp(a: number, b: number, t: number): number;',
  log: 'log(x: number): number;',
  max: 'max(a: number, b: number): number;',
  min: 'min(a: number, b: number): number;',
  pow: 'pow(x: number, y: number): number;',
  round: 'round(x: number): number;',
  sign: 'sign(x: number): number;',
  sin: 'sin(x: number): number;',
  smoothstep: 'smoothstep(x: number): number;',
  sqrt: 'sqrt(x: number): number;',
  tan: 'tan(x: number): number;',
  wrapAngle: 'wrapAngle(a: number): number;',
};

/**
 * Capability namespaces reach the sandbox through scripting `extensions`, so their signatures
 * live in the capability packages rather than here. Declaring them permissively keeps a scene
 * that installs one checkable everywhere else instead of erroring on every call.
 */
const CAPABILITY_DOC: Readonly<Record<string, string>> = {
  physics: 'Rapier queries: raycast / overlapSphere / velocityOf (see guide/physics.md).',
  terrain: 'Terrain sampling: heightAt / normalAt / slopeAt / raycast (see guide/terrain.md).',
  figures: 'Figure verbs: mount / dismount / socket / … (see guide/figures.md).',
  worldgen: 'Worldgen queries: buildingAt / …  (see guide/worldgen.md).',
};

function quote(value: string): string {
  return `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
}

/** A union of string literals that still accepts any other string (completion, not a wall). */
function openUnion(values: string[]): string {
  if (values.length === 0) return 'string';
  return `${values.map(quote).join(' | ')} | (string & {})`;
}

function docComment(text: string | undefined, indent: string): string[] {
  if (text === undefined || text.length === 0) return [];
  return [`${indent}/** ${text.replaceAll('*/', '*\\/')} */`];
}

/** Print a TS type for a config value. Config is authored JSON, so the value shape is the type. */
export function tsTypeOfJsonValue(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) {
    if (value.length === 0) return 'unknown[]';
    const items = value.map(tsTypeOfJsonValue);
    const unique = [...new Set(items)];
    // Short uniform arrays are vectors in practice ([x, y, z], a quat, a 2D direction), and the
    // components they feed are tuples — printing a tuple keeps `config.spawn` assignable to
    // `transform.pos`. Longer ones (routes, tables) stay arrays.
    if (unique.length === 1 && value.length > 4) return `${unique[0]}[]`;
    return `[${items.join(', ')}]`;
  }
  switch (typeof value) {
    case 'number':
      return 'number';
    case 'string':
      return 'string';
    case 'boolean':
      return 'boolean';
    case 'object': {
      const entries = Object.entries(value as Record<string, unknown>);
      if (entries.length === 0) return 'Record<string, unknown>';
      return `{ ${entries.map(([k, v]) => `${k}: ${tsTypeOfJsonValue(v)}`).join('; ')} }`;
    }
    default:
      return 'unknown';
  }
}

/**
 * One `config` global is declared per scripts directory, so the keys of every script in it are
 * merged. Each key records the script that declares it; a key two scripts declare with different
 * types degrades to `unknown` rather than picking a winner.
 */
function renderConfig(configs: ScriptConfigEntry[]): string[] {
  const keys = new Map<string, { type: string; owners: string[] }>();
  for (const entry of configs) {
    for (const [key, value] of Object.entries(entry.config)) {
      const type = tsTypeOfJsonValue(value);
      const existing = keys.get(key);
      if (existing === undefined) {
        keys.set(key, { type, owners: [entry.scriptId] });
      } else {
        existing.owners.push(entry.scriptId);
        if (existing.type !== type) existing.type = 'unknown';
      }
    }
  }
  const lines = [
    '/**',
    " * The script's own `config` block from scene.json, frozen. Keys from every script in this",
    ' * directory are merged here (one ambient global covers the directory), each tagged with the',
    ' * script that declares it.',
    ' */',
    'interface MolenScriptConfig {',
  ];
  if (keys.size === 0) {
    lines.push('  readonly [key: string]: never;');
  } else {
    for (const [key, entry] of [...keys].sort(([a], [b]) => (a < b ? -1 : 1))) {
      lines.push(
        ...docComment(`script ${entry.owners.map(quote).join(', ')}`, '  '),
        `  readonly ${/^[A-Za-z_$][\w$]*$/.test(key) ? key : quote(key)}: ${entry.type};`,
      );
    }
  }
  lines.push('}');
  return lines;
}

function renderComponents(components: ScriptComponentType[]): string[] {
  const lines: string[] = [];
  const mapLines: string[] = [
    "/** Component name -> data shape, from this project's component vocabulary. */",
    'interface MolenComponentData {',
  ];
  for (const c of components) {
    const iface = `Molen${c.name.charAt(0).toUpperCase()}${c.name.slice(1)}Data`.replace(
      /[^A-Za-z0-9_$]/g,
      '_',
    );
    lines.push(...docComment(c.description, ''), `type ${iface} = ${schemaToTsType(c.schema)};`);
    mapLines.push(...docComment(c.description, '  '), `  ${quote(c.name)}: ${iface};`);
  }
  mapLines.push('}');
  return [...lines, '', ...mapLines];
}

function renderCommands(commands: ScriptCommandType[]): string[] {
  if (commands.length === 0) {
    return [
      '/** Command types this scene accepts; this script directory has none. */',
      'type MolenCommands = Record<never, never>;',
    ];
  }
  const lines = [
    '/** Command types this scene accepts, with the payload each handler receives. */',
    'interface MolenCommands {',
  ];
  for (const c of commands) {
    const payload = c.payload === undefined ? 'MolenJsonValue' : schemaToTsType(c.payload, '  ');
    lines.push(...docComment(c.doc, '  '), `  ${quote(c.name)}: ${payload};`);
  }
  lines.push('}');
  return lines;
}

function renderMath(): string[] {
  const lines = [
    '/** Deterministic math (dmath). `Math.random`, `Date` and `Intl` are absent. */',
    'interface MolenMath {',
  ];
  for (const key of Object.keys(dmath)) {
    lines.push(`  ${MATH_SIGNATURES[key] ?? `${key}(...args: number[]): number;`}`);
  }
  lines.push('}');
  return lines;
}

function renderCapabilities(capabilities: string[]): string[] {
  if (capabilities.length === 0) return [];
  const lines: string[] = [];
  for (const name of capabilities) {
    lines.push(
      ...docComment(
        `${CAPABILITY_DOC[name] ?? 'Capability namespace installed by this scene.'} Installed as a scripting extension, so its verbs are not checked here.`,
        '  ',
      ),
      '  // biome-ignore lint/suspicious/noExplicitAny: capability signatures are owned by their extensions',
      `  readonly ${name}: Record<string, (...args: any[]) => any>;`,
    );
  }
  return lines;
}

/** Render the ambient declaration file for one directory of scene-data scripts. */
export function renderScriptTypes(input: ScriptTypesInput): string {
  const body = [
    ...renderComponents(input.components),
    '',
    'type MolenComponentName = keyof MolenComponentData;',
    'type MolenComponentPatch = { [K in MolenComponentName]?: MolenComponentData[K] };',
    '',
    '/** Entity ids declared in the scene. Ids of spawned entities are plain strings. */',
    `type MolenEntityId = ${openUnion(input.entityIds)};`,
    '/** Prefab names declared in the scene. */',
    `type MolenPrefabName = ${openUnion(input.prefabs)};`,
    '/** Registry type ids this project declares (`molen.spawnType`). */',
    `type MolenTypeId = ${input.typeIds.length === 0 ? 'string' : input.typeIds.map(quote).join(' | ')};`,
    '',
    ...renderCommands(input.commands),
    '',
    'type MolenCommandName = keyof MolenCommands;',
    '',
    'type MolenJsonValue =',
    '  | string',
    '  | number',
    '  | boolean',
    '  | null',
    '  | MolenJsonValue[]',
    '  | { [key: string]: MolenJsonValue };',
    '',
    'type MolenVec3 = [number, number, number];',
    'type MolenUnsubscribe = () => void;',
    '',
    'interface MolenTickContext {',
    '  readonly tick: number;',
    '  readonly dt: number;',
    '}',
    '',
    'interface MolenCommand {',
    '  readonly kind: 	"command";',
    '  readonly type: MolenCommandName;',
    '  readonly seq: number;',
    '  readonly source: string;',
    '  readonly tick: number;',
    '  readonly payload: MolenJsonValue;',
    '}',
    '',
    '/** Kinematics collision event (`physics.engine: "kinematics"`). */',
    'interface MolenCollisionEvent {',
    '  readonly a: string;',
    '  readonly b: string;',
    '  readonly normal: MolenVec3;',
    '  readonly point?: MolenVec3;',
    '}',
    '',
    '/** Payload of an event emitted by `molen.after` / `molen.every`. */',
    'interface MolenTimerEvent {',
    '  readonly entity: string;',
    '  readonly timerId: string;',
    '  readonly payload?: MolenJsonValue;',
    '}',
    '',
    'interface MolenTweenCompleteEvent {',
    '  readonly entity: string;',
    '  readonly id?: string;',
    '}',
    '',
    'interface MolenRayHit {',
    '  readonly id: string;',
    '  readonly distance: number;',
    '  readonly point: MolenVec3;',
    '}',
    '',
    'interface MolenTweenSpec {',
    '  id?: string;',
    '  component: MolenComponentName;',
    '  /** Value path inside the component, e.g. "pos", "pos[1]", "primitive.size". */',
    '  path: string;',
    '  from?: number | number[];',
    '  to: number | number[];',
    '  ticks: number;',
    "  easing?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';",
    "  loop?: 'none' | 'loop' | 'pingpong';",
    '  emitOnComplete?: string;',
    '}',
    '',
    'type MolenRow<K extends readonly MolenComponentName[]> = [',
    '  id: string,',
    '  ...{ [I in keyof K]: Readonly<MolenComponentData[K[I] & MolenComponentName]> },',
    '];',
    '',
    '/** Iterable query result: `for (const [id, tag, t] of molen.query("tag", "transform"))`. */',
    'interface MolenQuery<K extends readonly MolenComponentName[]> extends Iterable<MolenRow<K>> {',
    '  ids(): readonly string[];',
    '  count(): number;',
    '  first(): MolenRow<K> | undefined;',
    '  /** The same query, excluding entities carrying ANY of the named components. */',
    '  without(...components: MolenComponentName[]): MolenQuery<K>;',
    '}',
    '',
    ...renderMath(),
    '',
    '/** The verb set injected into every scene-data script as `molen`. */',
    'interface MolenApi {',
    '  /** Spawn from a component map. */',
    '  spawn(components: MolenComponentPatch, id?: string): string;',
    '  /** Spawn a scene prefab, with optional components layered on top. */',
    '  spawn(prefab: MolenPrefabName, components?: MolenComponentPatch, id?: string): string;',
    '  /** Instantiate a project registry type with optional overrides. */',
    '  spawnType(type: MolenTypeId, components?: MolenComponentPatch, id?: string): string;',
    '  /**',
    '   * Script-owned durable JSON state (checkpointed, survives reload). Untyped by design —',
    '   * annotate a read with JSDoc when you want it checked.',
    '   */',
    '  // biome-ignore lint/suspicious/noExplicitAny: script state is free-form JSON',
    '  readonly state: any;',
    '  setState(data: Record<string, MolenJsonValue>): void;',
    '  patchState(partial: Record<string, MolenJsonValue>): void;',
    '  destroy(id: MolenEntityId): void;',
    '  exists(id: MolenEntityId): boolean;',
    '  /** The stored component object, frozen. Never mutate it — write with set/patch. */',
    '  get<K extends MolenComponentName>(',
    '    id: MolenEntityId,',
    '    component: K,',
    '  ): Readonly<MolenComponentData[K]> | undefined;',
    '  set<K extends MolenComponentName>(',
    '    id: MolenEntityId,',
    '    component: K,',
    '    data: MolenComponentData[K],',
    '  ): void;',
    '  patch<K extends MolenComponentName>(',
    '    id: MolenEntityId,',
    '    component: K,',
    '    partial: Partial<MolenComponentData[K]>,',
    '  ): void;',
    '  remove(id: MolenEntityId, component: MolenComponentName): void;',
    '  has(id: MolenEntityId, component: MolenComponentName): boolean;',
    '  /** Entities carrying every named component, in creation order. */',
    '  query<K extends MolenComponentName[]>(...components: K): MolenQuery<K>;',
    '  /** Run every tick, in the update phase. */',
    "  on(event: 'tick', handler: (payload: null, ctx: MolenTickContext) => void): MolenUnsubscribe;",
    '  on(',
    "    event: 'collision',",
    '    handler: (payload: MolenCollisionEvent, ctx: MolenTickContext) => void,',
    '  ): MolenUnsubscribe;',
    '  on(',
    "    event: 'tween-complete',",
    '    handler: (payload: MolenTweenCompleteEvent, ctx: MolenTickContext) => void,',
    '  ): MolenUnsubscribe;',
    '  /** Timer and custom events: the payload is whatever the emitter sent. */',
    '  // biome-ignore lint/suspicious/noExplicitAny: event payloads are emitter-defined JSON',
    '  on(event: string, handler: (payload: any, ctx: MolenTickContext) => void): MolenUnsubscribe;',
    '  /** Handle player/agent input. Undeclared types are rejected before any handler runs. */',
    '  onCommand<T extends MolenCommandName>(',
    '    type: T,',
    '    handler: (payload: MolenCommands[T], ctx: MolenTickContext, command: MolenCommand) => void,',
    '  ): MolenUnsubscribe;',
    '  emit(type: string, payload?: MolenJsonValue): void;',
    '  raycast(origin: MolenVec3, dir: MolenVec3, maxDist: number, mask?: number): MolenRayHit | null;',
    '  overlapCircle(center: MolenVec3, radius: number, mask?: number): string[];',
    '  /** Emit `event` after `ticks` ticks (snapshot-safe world timer). Returns the timer id. */',
    '  after(ticks: number, event: string, payload?: MolenJsonValue): string;',
    '  /** Emit `event` every `ticks` ticks. Returns the timer id. */',
    '  every(ticks: number, event: string, payload?: MolenJsonValue): string;',
    '  cancelTimer(timerId: string, entity?: MolenEntityId): void;',
    '  tween(entity: MolenEntityId, spec: MolenTweenSpec): void;',
    '  cancelTween(entity: MolenEntityId, tweenId?: string): void;',
    '  parent(id: MolenEntityId, parentId: MolenEntityId): void;',
    '  unparent(id: MolenEntityId): void;',
    '  /** The only source of randomness — deterministic, seeded by the world. */',
    '  rng(): number;',
    '  readonly tick: number;',
    '  readonly dt: number;',
    '  readonly math: MolenMath;',
    ...renderCapabilities(input.capabilities),
    '}',
    '',
    ...renderConfig(input.configs),
    '',
    '/** The verb set (see guide/scripting.md). */',
    'declare const molen: MolenApi;',
    "/** This script's `config` block from the scene manifest, frozen. */",
    'declare const config: MolenScriptConfig;',
    '',
  ].join('\n');

  return [
    '// AUTO-GENERATED by `molen types gen` — do not edit.',
    `// Ambient types for the scripts in this directory, from ${input.scenes.map((s) => `"${s}"`).join(', ')}.`,
    '// `molen scripts check` (or tsc via the jsconfig.json beside this file) checks them.',
    '/** biome-ignore-all format: generated file (stable output beats house wrapping) */',
    '/** biome-ignore-all lint/style/useConsistentArrayType: generated declarations */',
    '',
    body,
  ].join('\n');
}

/**
 * The tsconfig that checks a scripts directory. `erasableSyntaxOnly` keeps a .ts script to the
 * syntax the loader can erase (no enums, namespaces, or parameter properties), so a script that
 * would fail to load fails the check first. .js scripts are checked in the same project.
 */
export function renderScriptsTsconfig(): string {
  // Written out literally rather than via JSON.stringify: stringify puts every array element on
  // its own line, which no common formatter agrees with, so a generated tsconfig would be a
  // permanent formatting diff in any project that lints its tree (this repo included).
  return `{
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true,
    "noEmit": true,
    "strict": true,
    "erasableSyntaxOnly": true,
    "target": "ES2023",
    "module": "preserve",
    "moduleResolution": "bundler",
    "lib": ["ES2023"],
    "types": [],
    "skipLibCheck": true
  },
  "include": ["*.ts", "*.js"]
}
`;
}
