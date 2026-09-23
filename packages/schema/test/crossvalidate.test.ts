// The Zod <-> JSON Schema lossiness tripwire (docs/07-tooling-and-testing.md §2.1):
// every fixture must get the same verdict from Zod and from Ajv validating against the
// emitted JSON Schema. If this fails, a wire schema used a non-JSON-Schema-expressible
// Zod construct.
import { existsSync, readFileSync } from 'node:fs';
import AjvModule from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  componentIssues,
  componentNames,
  getComponent,
  getSchema,
  jsonSchemaId,
  SCHEMA_ID_BASE,
  schemaKinds,
  validate,
} from '../src/index';

const Ajv = (AjvModule as unknown as { default?: typeof AjvModule }).default ?? AjvModule;

interface Fixture {
  kind: string;
  data: unknown;
  valid: boolean;
  note: string;
}

const goodFixtures: Fixture[] = [
  {
    kind: 'command',
    note: 'minimal command',
    valid: true,
    data: { kind: 'command', seq: 0, source: 'local', tick: 0, type: 't', payload: null },
  },
  {
    kind: 'command',
    note: 'command with executed tick',
    valid: true,
    data: {
      kind: 'command',
      seq: 9,
      source: 'agent:test-1',
      tick: 10,
      tickExecuted: 11,
      type: 'move',
      payload: { to: [1, 0, 2] },
    },
  },
  {
    kind: 'scene',
    note: 'minimal scene (defaults omitted)',
    valid: true,
    data: { format: 'molen/scene@3', name: 'minimal' },
  },
  {
    kind: 'scene',
    note: 'scene with prefab + authored entity',
    valid: true,
    data: {
      format: 'molen/scene@3',
      name: 'arena',
      seed: 7,
      prefabs: { goblin: { components: { health: { hp: 10 } } } },
      entities: [{ id: 'player', prefab: 'goblin', components: { health: { hp: 100 } } }],
    },
  },
  {
    kind: 'scene',
    note: 'scene script file reference (.ts)',
    valid: true,
    data: {
      format: 'molen/scene@3',
      name: 'scripted',
      scripts: [{ id: 'spin', path: 'scripts/spin.ts' }],
    },
  },
  {
    kind: 'prefab',
    note: 'standalone prefab with format envelope',
    valid: true,
    data: { format: 'molen/prefab@1', components: { transform: { pos: [0, 0, 0] } } },
  },
  {
    kind: 'keyframe',
    note: 'keyframe with two entities',
    valid: true,
    data: {
      kind: 'keyframe',
      v: 1,
      engine: '0.0.1',
      tick: 5,
      tickRate: 30,
      seed: 's',
      nextEntitySeq: 3,
      rng: { algo: 'sfc32', state: [1, 2, 3, 4] },
      entities: { e1: { transform: { pos: [0, 0, 0] } }, player: {} },
      plugins: {},
    },
  },
  {
    kind: 'delta',
    note: 'delta with spawn and event',
    valid: true,
    data: {
      kind: 'delta',
      v: 1,
      tick: 6,
      baseTick: 5,
      spawned: { e2: { transform: { pos: [1, 1, 1] } } },
      destroyed: ['e1'],
      changed: {},
      removedComponents: { player: ['burning'] },
      events: [{ type: 'spawned', payload: { id: 'e2' } }],
    },
  },
  {
    kind: 'replay',
    note: 'replay referencing a scene file',
    valid: true,
    data: {
      format: 'molen/replay@1',
      engine: '0.0.1',
      scene: 's.json',
      ticks: 10,
      commands: [],
    },
  },
  {
    kind: 'assert',
    note: 'mixed select and event assertions',
    valid: true,
    data: {
      format: 'molen/assert@1',
      assertions: [
        { select: 'has:transform', op: 'count', value: 2 },
        { event: 'boom', op: 'never' },
      ],
    },
  },
  {
    kind: 'assert',
    note: 'approx with tolerance',
    valid: true,
    data: {
      format: 'molen/assert@1',
      assertions: [{ select: '#player .transform.pos[1]', op: 'approx', value: 0, tol: 0.01 }],
    },
  },
];

const badFixtures: Fixture[] = [
  {
    kind: 'command',
    note: 'missing type',
    valid: false,
    data: { kind: 'command', seq: 0, source: 'local', tick: 0, payload: null },
  },
  {
    kind: 'command',
    note: 'negative tick',
    valid: false,
    data: { kind: 'command', seq: 0, source: 'local', tick: -1, type: 't', payload: null },
  },
  {
    kind: 'command',
    note: 'non-integer seq',
    valid: false,
    data: { kind: 'command', seq: 1.5, source: 'local', tick: 0, type: 't', payload: null },
  },
  {
    kind: 'scene',
    note: 'runtime-style authored id',
    valid: false,
    data: { format: 'molen/scene@3', name: 'x', entities: [{ id: 'e42' }] },
  },
  {
    kind: 'scene',
    note: 'unknown top-level key',
    valid: false,
    data: { format: 'molen/scene@3', name: 'x', tickrate: 30 },
  },
  {
    kind: 'scene',
    note: 'tickRate out of range',
    valid: false,
    data: { format: 'molen/scene@3', name: 'x', tickRate: 1000 },
  },
  {
    kind: 'scene',
    note: 'camera position has the wrong arity',
    valid: false,
    data: {
      format: 'molen/scene@3',
      name: 'x',
      camera: { mode: 'fixed', position: [1] },
    },
  },
  {
    kind: 'scene',
    note: 'relative file reference escapes the scene directory',
    valid: false,
    data: {
      format: 'molen/scene@3',
      name: 'x',
      terrain: { descriptor: '../outside.json' },
    },
  },
  {
    // A .refine() here would be dropped by z.toJSONSchema and Ajv would accept the document.
    kind: 'scene',
    note: 'script path with a non-script extension',
    valid: false,
    data: {
      format: 'molen/scene@3',
      name: 'x',
      scripts: [{ id: 'spin', path: 'scripts/spin.txt' }],
    },
  },
  {
    kind: 'keyframe',
    note: 'rng state wrong arity',
    valid: false,
    data: {
      kind: 'keyframe',
      v: 1,
      engine: '0.0.1',
      tick: 5,
      tickRate: 30,
      seed: 's',
      nextEntitySeq: 0,
      rng: { algo: 'sfc32', state: [1, 2, 3] },
      entities: {},
      plugins: {},
    },
  },
  {
    kind: 'delta',
    note: 'wrong version literal',
    valid: false,
    data: { kind: 'delta', v: 2, tick: 1, baseTick: 0 },
  },
  {
    kind: 'replay',
    note: 'zero ticks',
    valid: false,
    data: { format: 'molen/replay@1', engine: '0.0.1', ticks: 0 },
  },
  {
    kind: 'assert',
    note: 'unknown op',
    valid: false,
    data: { format: 'molen/assert@1', assertions: [{ select: 'x', op: 'equals' }] },
  },
  {
    kind: 'assert',
    note: 'empty assertion list',
    valid: false,
    data: { format: 'molen/assert@1', assertions: [] },
  },
];

describe('zod/ajv cross-validation tripwire', () => {
  const ajv = new Ajv({ strict: false, allowUnionTypes: true });
  const compiled = new Map<string, ReturnType<typeof ajv.compile>>();
  // Legacy versions are separate emitted schemas: a doc claiming a legacy format id is
  // Ajv-validated against that version's schema (validate() auto-upgrades it on the Zod side).
  const compiledByFormatId = new Map<string, ReturnType<typeof ajv.compile>>();
  for (const kind of schemaKinds()) {
    const entry = getSchema(kind);
    if (entry === undefined) continue;
    const jsonSchema = z.toJSONSchema(entry.zod, { io: 'input' });
    compiled.set(kind, ajv.compile(jsonSchema));
    compiledByFormatId.set(entry.meta.id, compiled.get(kind) as ReturnType<typeof ajv.compile>);
    for (const legacy of entry.legacy) {
      compiledByFormatId.set(legacy.id, ajv.compile(z.toJSONSchema(legacy.zod, { io: 'input' })));
    }
  }

  function ajvFor(kind: string, data: unknown): ReturnType<typeof ajv.compile> | undefined {
    const format =
      data !== null && typeof data === 'object'
        ? (data as Record<string, unknown>).format
        : undefined;
    if (typeof format === 'string' && compiledByFormatId.has(format)) {
      return compiledByFormatId.get(format);
    }
    return compiled.get(kind);
  }

  it.each([...goodFixtures, ...badFixtures])('$kind: $note (valid=$valid)', (fixture) => {
    const zodVerdict = validate(fixture.kind as never, fixture.data).ok;
    const ajvValidate = ajvFor(fixture.kind, fixture.data);
    expect(ajvValidate, `schema for kind ${fixture.kind}`).toBeDefined();
    const ajvVerdict = ajvValidate?.(fixture.data) === true;
    expect(zodVerdict, 'zod verdict matches fixture expectation').toBe(fixture.valid);
    expect(ajvVerdict, 'ajv agrees with zod').toBe(zodVerdict);
  });

  it('registered examples (current + legacy versions) agree under both validators', () => {
    for (const kind of schemaKinds()) {
      const entry = getSchema(kind);
      for (const example of entry?.meta.examples ?? []) {
        expect(validate(kind as never, example).ok, `${kind} example`).toBe(true);
        expect(compiled.get(kind)?.(example), `${kind} example (ajv)`).toBe(true);
      }
      for (const legacy of entry?.legacy ?? []) {
        for (const example of legacy.examples) {
          const r = validate(kind as never, example);
          expect(r.ok, `${kind} legacy ${legacy.id} example`).toBe(true);
          if (r.ok) expect(r.notices?.[0]?.code).toBe('deprecated_format');
          expect(
            compiledByFormatId.get(legacy.id)?.(example),
            `${kind} legacy ${legacy.id} example (ajv)`,
          ).toBe(true);
        }
      }
    }
  });
});

// The build (scripts/emit-schemas.mjs) also emits one JSON Schema per registered component into
// dist/schemas/components/. Field `.describe()` calls must survive into `description` keys —
// that is what makes `molen component <name>` / get_component self-documenting.
describe('emitted component schemas (dist)', () => {
  const dir = new URL('../dist/schemas/components/', import.meta.url);
  // Snapshot at collection time: tests above register scene-declared components (e.g. `spin`)
  // at run time, and those are not part of the built-in vocabulary the build emits.
  const coreComponents = componentNames();

  it('exist for every registered component', () => {
    expect(coreComponents.length).toBeGreaterThan(0);
    for (const name of coreComponents) {
      const file = new URL(`${name}.schema.json`, dir);
      expect(existsSync(file), `dist/schemas/components/${name}.schema.json`).toBe(true);
      const doc = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
      // The $id SCHEME is asserted against the emitter (see "emitted schema $ids" below);
      // dist is a build artifact that lags a source edit until the next `pnpm build`.
      expect(typeof doc.$id, `${name} $id`).toBe('string');
      expect(doc.title).toBe(name);
      expect(doc.description).toBe(getComponent(name)?.meta.description);
      expect(doc.examples).toEqual(getComponent(name)?.meta.examples);
    }
  });

  it('carry field descriptions (transform.pos)', () => {
    const doc = JSON.parse(readFileSync(new URL('transform.schema.json', dir), 'utf8')) as {
      properties: Record<string, { description?: unknown }>;
    };
    expect(typeof doc.properties.pos?.description).toBe('string');
    expect((doc.properties.pos?.description as string).length).toBeGreaterThan(0);
  });
});

// The tripwire above only covers top-level formats. Component schemas are emitted too
// (dist/schemas/components/) and are just as easy to write in a construct JSON Schema cannot
// express — z.tuple was exactly that: prefixItems with no minItems/maxItems, which lenient Ajv
// accepts at ANY length.
interface ComponentFixture {
  component: string;
  data: unknown;
  valid: boolean;
  note: string;
}

const componentFixtures: ComponentFixture[] = [
  { component: 'transform', note: 'pos only', valid: true, data: { pos: [0, 1, 0] } },
  {
    component: 'transform',
    note: 'pos with the wrong arity',
    valid: false,
    data: { pos: [0, 1] },
  },
  {
    component: 'renderable',
    note: 'primitive with a material ref',
    valid: true,
    data: { kind: 'primitive', ref: 'box', materialRef: 'palette:#4363d8' },
  },
  {
    component: 'collider',
    note: 'circle collider',
    valid: true,
    data: { shape: 'circle', radius: 0.5, layer: 1, mask: 1 },
  },
  {
    component: 'vehicle',
    note: 'legacy archetype + paint without external configuration',
    valid: false,
    data: { kind: 'sedan', color: '#566d82' },
  },
  {
    component: 'vehicle',
    note: 'paint that is not #rrggbb',
    valid: false,
    data: { kind: 'sedan', color: 'red' },
  },
  {
    component: 'platformSolid',
    note: 'XY half extents',
    valid: true,
    data: { halfExtents: [3, 0.5] },
  },
  {
    component: 'platformSolid',
    note: 'three half extents (z.tuple emitted no maxItems)',
    valid: false,
    data: { halfExtents: [1, 2, 3] },
  },
  {
    component: 'platformSolid',
    note: 'one half extent (z.tuple emitted no minItems)',
    valid: false,
    data: { halfExtents: [1] },
  },
  {
    component: 'platformBody',
    note: 'half extents + velocity',
    valid: true,
    data: { halfExtents: [0.4, 0.6], vel: [0, 0], speed: 7, jumpSpeed: 11 },
  },
  {
    component: 'platformBody',
    note: 'three-component velocity',
    valid: false,
    data: { halfExtents: [0.4, 0.6], vel: [1, 2, 3] },
  },
  // Strictness must reach Ajv too: strictObject emits additionalProperties:false, looseObject
  // does not, so a fixture pair here is what keeps the two sides telling the same story.
  {
    component: 'renderable',
    note: 'misspelled materialRef',
    valid: false,
    data: { kind: 'primitive', ref: 'box', materialref: 'palette:#fff' },
  },
  {
    component: 'light',
    note: 'misspelled color',
    valid: false,
    data: { type: 'point', colour: '#ffffff' },
  },
  {
    component: 'health',
    note: 'content-owned extra fields stay legal',
    valid: true,
    data: { hp: 10, armor: 2, faction: 'red' },
  },
];

describe('zod/ajv cross-validation: components', () => {
  const ajv = new Ajv({ strict: false, allowUnionTypes: true });
  const compiled = new Map<string, ReturnType<typeof ajv.compile>>();
  for (const name of componentNames()) {
    const entry = getComponent(name);
    if (entry === undefined) continue;
    compiled.set(name, ajv.compile(z.toJSONSchema(entry.zod, { io: 'input' })));
  }

  it.each(componentFixtures)('$component: $note (valid=$valid)', (fixture) => {
    const zodVerdict = componentIssues(fixture.component, fixture.data, '').length === 0;
    const ajvValidate = compiled.get(fixture.component);
    expect(ajvValidate, `schema for component ${fixture.component}`).toBeDefined();
    const ajvVerdict = ajvValidate?.(fixture.data) === true;
    expect(zodVerdict, 'zod verdict matches fixture expectation').toBe(fixture.valid);
    expect(ajvVerdict, 'ajv agrees with zod').toBe(zodVerdict);
  });

  it('registered component examples validate under both validators', () => {
    for (const name of componentNames()) {
      for (const example of getComponent(name)?.meta.examples ?? []) {
        expect(componentIssues(name, example, ''), `${name} example`).toEqual([]);
        expect(compiled.get(name)?.(example), `${name} example (ajv)`).toBe(true);
      }
    }
  });
});

// Agreeing with LENIENT Ajv is not enough: a schema Ajv refuses to compile in strict mode is
// unusable to any consumer that keeps Ajv's defaults, and the constructs it rejects
// (prefixItems without min/maxItems, a type it cannot check) are exactly the ones whose Zod
// meaning did not survive emission. Every emitted schema must compile strictly.
describe('emitted schemas compile under Ajv strict mode', () => {
  const strictAjv = (): InstanceType<typeof Ajv> =>
    new Ajv({ strict: true, strictTypes: true, strictTuples: true, allowUnionTypes: true });

  it('every format schema (current + legacy versions)', () => {
    const failures: string[] = [];
    for (const kind of schemaKinds()) {
      const entry = getSchema(kind);
      if (entry === undefined) continue;
      for (const [id, zod] of [
        [entry.meta.id, entry.zod] as const,
        ...entry.legacy.map((l) => [l.id, l.zod] as const),
      ]) {
        try {
          strictAjv().compile(z.toJSONSchema(zod, { io: 'input' }));
        } catch (error) {
          failures.push(`${id}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('every component schema', () => {
    const failures: string[] = [];
    for (const name of componentNames()) {
      const entry = getComponent(name);
      if (entry === undefined) continue;
      try {
        strictAjv().compile(z.toJSONSchema(entry.zod, { io: 'input' }));
      } catch (error) {
        failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    expect(failures).toEqual([]);
  });
});

// The emitted files are only useful if a consumer can reach them and their $ids resolve.
describe('emitted schema $ids and the package export path', () => {
  const pkg = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
  ) as Record<string, { './schemas/*'?: string }>;
  const emittedIds = (): string[] => [
    ...schemaKinds().flatMap((kind) => {
      const entry = getSchema(kind);
      return entry === undefined ? [] : [entry.meta.id, ...entry.legacy.map((l) => l.id)];
    }),
    ...componentNames().map((name) => `molen/component/${name}@1`),
  ];

  it('gives every emitted schema an absolute, resolvable $id', () => {
    const ids = emittedIds();
    expect(ids.length).toBeGreaterThan(0);
    for (const formatId of ids) {
      const id = jsonSchemaId(formatId);
      expect(() => new URL(id), id).not.toThrow();
      expect(new URL(id).protocol, id).toBe('https:');
      expect(id.startsWith(SCHEMA_ID_BASE), id).toBe(true);
      expect(id.endsWith('.json'), id).toBe(true);
    }
    expect(new Set(ids.map(jsonSchemaId)).size, 'ids are unique').toBe(ids.length);
  });

  it('keeps the emitter from reintroducing a bare relative $id', () => {
    const emitter = readFileSync(new URL('../scripts/emit-schemas.mjs', import.meta.url), 'utf8');
    const assignments = [...emitter.matchAll(/\$id = (.*);/g)].map((m) => m[1] as string);
    expect(assignments.length).toBeGreaterThan(0);
    for (const rhs of assignments) expect(rhs.startsWith('jsonSchemaId(')).toBe(true);
  });

  it('exports the directory the emitter writes into', () => {
    // scripts/emit-schemas.mjs writes dist/schemas/<kind>.schema.json and
    // dist/schemas/components/<name>.schema.json; without this pattern a consumer importing
    // them gets ERR_PACKAGE_PATH_NOT_EXPORTED even though they ship in the tarball.
    const pattern = pkg.exports?.['./schemas/*'];
    expect(pattern).toBe('./dist/schemas/*');
    for (const relative of [
      ...schemaKinds().map((kind) => `${kind}.schema.json`),
      ...componentNames().map((name) => `components/${name}.schema.json`),
    ]) {
      const resolved = (pattern as string).replace('*', relative);
      expect(resolved).toBe(`./dist/schemas/${relative}`);
      expect(existsSync(new URL(`../${resolved.slice(2)}`, import.meta.url)), resolved).toBe(true);
    }
  });
});
