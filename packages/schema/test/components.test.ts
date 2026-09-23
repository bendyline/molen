import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  type ComponentEntry,
  componentIssues,
  componentNames,
  getComponent,
  listComponents,
  listRenderableKinds,
  registerComponent,
  registerDeclaredComponents,
  registerRenderableKind,
  unregisterComponent,
  validate,
} from '../src/index';

describe('component registry', () => {
  it('ships the core component vocabulary', () => {
    const names = componentNames();
    for (const core of [
      'transform',
      'renderable',
      'collider',
      'kinematicBody',
      'character',
      'moveIntent',
      'lifetime',
      'health',
      'tag',
    ]) {
      expect(names, core).toContain(core);
    }
    expect(getComponent('transform')?.meta.examples.length).toBeGreaterThan(0);
    expect(listComponents().find((c) => c.name === 'transform')?.owner).toBe('kernel');
  });

  it('flags a near-typo of a known component (the marquee error)', () => {
    const r = validate('scene', {
      format: 'molen/scene@3',
      name: 'x',
      entities: [{ id: 'goblin', components: { helth: { hp: 10 } } }],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    const issue = r.issues.find((i) => i.code === 'unknown_component');
    expect(issue?.path).toBe('/entities/0/components/helth');
    expect(issue?.hint).toContain('health');
    expect(issue?.expected).toContain('transform');
  });

  it('allows genuinely novel component names', () => {
    const r = validate('scene', {
      format: 'molen/scene@3',
      name: 'x',
      entities: [{ id: 'a', components: { enemyAI: { aggression: 3 } } }],
    });
    expect(r.ok).toBe(true);
  });

  it('catches a wrong field in a known component with known-keys + example hint', () => {
    const r = validate('prefab', {
      format: 'molen/prefab@1',
      components: { transform: { position: [0, 0, 0] } },
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    // The bogus key is reported, and the required `pos` is reported missing.
    const unknownKey = r.issues.find((i) => i.path === '/components/transform/position');
    expect(unknownKey?.expected).toContain('pos');
    expect(r.issues.some((i) => i.path === '/components/transform/pos')).toBe(true);
    expect(r.formatted).toContain('transform');
  });

  it('attaches a copy-pasteable example hint on a type error', () => {
    const issues = componentIssues('transform', { pos: 'nope' }, '/c/transform');
    expect(issues[0]?.path).toBe('/c/transform/pos');
    expect(issues.some((i) => i.hint?.includes('[0,1.5,-3]'))).toBe(true);
  });

  it('allowUnknownComponents disables the did-you-mean', () => {
    const issues = componentIssues('helth', { hp: 1 }, '/c/helth', {
      allowUnknownComponents: true,
    });
    expect(issues).toHaveLength(0);
  });

  it('throws on duplicate registration unless override is passed', () => {
    const meta = { description: 'test-only component', examples: [{ n: 1 }] };
    registerComponent('h1-dup-test', z.looseObject({ n: z.number() }), meta);
    expect(() => registerComponent('h1-dup-test', z.looseObject({ n: z.number() }), meta)).toThrow(
      /already registered.*override/,
    );
    // Override replaces the schema (and meta) in place.
    registerComponent(
      'h1-dup-test',
      z.looseObject({ s: z.string() }),
      { ...meta, description: 'replaced' },
      { override: true },
    );
    expect(getComponent('h1-dup-test')?.meta.description).toBe('replaced');
    expect(componentIssues('h1-dup-test', { s: 'ok' }, '/c/h1-dup-test')).toHaveLength(0);
  });

  it('refuses to unregister a core component', () => {
    const before = getComponent('transform');
    expect(() => unregisterComponent('transform')).toThrow(/core component/);
    expect(getComponent('transform')).toBe(before);
    // Non-core registrations stay removable.
    registerComponent('h1-removable-test', z.looseObject({ n: z.number() }), {
      description: 'test-only component',
      examples: [{ n: 1 }],
    });
    expect(unregisterComponent('h1-removable-test')).toBe(true);
    expect(getComponent('h1-removable-test')).toBeUndefined();
  });

  it('declarations can only land in a registry the caller owns', () => {
    const decls = {
      score: { description: 'Points.', examples: [{ value: 0 }] as never[] },
    };
    const scoped = new Map<string, ComponentEntry>();
    expect(registerDeclaredComponents(decls, { registry: scoped })).toEqual([]);
    expect(scoped.has('score')).toBe(true);
    // The process-global vocabulary is never the default target: one document's declarations
    // must not survive into the next validation in a long-lived MCP/dev-server process.
    expect(() =>
      (registerDeclaredComponents as unknown as (d: unknown) => unknown)(decls),
    ).toThrow();
    expect(getComponent('score')).toBeUndefined();
  });

  it('still accepts valid core components', () => {
    const r = validate('scene', {
      format: 'molen/scene@3',
      name: 'ok',
      entities: [
        {
          id: 'p',
          components: {
            transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
            health: { hp: 100 },
            renderable: { kind: 'primitive', ref: 'box', materialRef: 'palette:#fff' },
          },
        },
      ],
    });
    expect(r.ok).toBe(true);
  });
});

// AGENTS.md: "Components are validated against a known vocabulary … typos get did-you-mean."
// That promise used to hold only for the handful of strictObject components; renderable, light,
// collider, every physics/gameplay component was looseObject and the vehicle family was a bare
// z.object (strip: unknown keys accepted and silently dropped), so a typo returned ok: true and
// the entity rendered with a default.
describe('engine-owned components reject unknown keys', () => {
  // Snapshot at collection time: other tests register throwaway components at run time.
  const coreComponents = componentNames();
  const entity = (components: Record<string, unknown>) =>
    validate('scene', {
      format: 'molen/scene@3',
      name: 'strict',
      entities: [{ id: 'a', components }],
    });

  it.each([
    [
      'renderable',
      { kind: 'primitive', ref: 'box', materialref: 'palette:#fff' },
      'materialref',
      'materialRef',
    ],
    ['light', { type: 'point', colour: '#ffffff' }, 'colour', 'color'],
    ['collider', { shape: 'circle', radius: 1, isstatic: true }, 'isstatic', 'isStatic'],
    ['vehicle', { kind: 'sedan', color: '#566d82', colour: '#000000' }, 'colour', 'color'],
    ['collider3d', { shape: { type: 'ball', radius: 1 }, sensors: true }, 'sensors', 'sensor'],
    [
      'character',
      { speed: 6, jumpSpeed: 8, gravity: 20, vy: 0, grounded: true, jumpspeed: 8 },
      'jumpspeed',
      'jumpSpeed',
    ],
  ])('%s: a typo is an error with did-you-mean, not a silent default', (name, data, typo, meant) => {
    const r = entity({ [name]: data });
    expect(r.ok, `${name}.${typo} should be rejected`).toBe(false);
    if (r.ok) return;
    const issue = r.issues.find((i) => i.path === `/entities/0/components/${name}/${typo}`);
    expect(issue?.code, JSON.stringify(r.issues)).toBe('unrecognized_keys');
    expect(issue?.hint).toBe(`did you mean "${meant}"?`);
  });

  it('nested engine-owned objects are strict too', () => {
    const r = entity({
      renderable: { kind: 'primitive', ref: 'box', shadows: { recieve: true } },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(
        r.issues.some((i) => i.path === '/entities/0/components/renderable/shadows/recieve'),
      ).toBe(true);
    }
  });

  it('keeps health and tag open: content owns their extra fields', () => {
    const r = entity({ health: { hp: 10, armor: 2 }, tag: { name: 'enemy', faction: 'red' } });
    expect(r.ok, r.ok ? '' : r.formatted).toBe(true);
  });

  it('leaves no component on strip semantics (the accidental third mode)', () => {
    const openByDesign = ['health', 'tag'];
    const strip: string[] = [];
    for (const name of coreComponents) {
      const schema = z.toJSONSchema(getComponent(name)?.zod as z.ZodType, { io: 'input' }) as {
        properties?: Record<string, unknown>;
        additionalProperties?: unknown;
        anyOf?: { additionalProperties?: unknown }[];
        oneOf?: { additionalProperties?: unknown }[];
      };
      const variants = schema.anyOf ?? schema.oneOf ?? [schema];
      const open = variants.some((v) => v.additionalProperties !== false);
      if (open && !openByDesign.includes(name)) strip.push(name);
    }
    expect(strip).toEqual([]);
  });
});

describe('capability renderable kinds', () => {
  it('declare the extra renderable fields they read', () => {
    // `renderable` is strict, so a capability field nobody declared reads as a typo.
    expect(
      componentIssues('renderable', { kind: 'primitive', ref: 'box', tier: 2 }, '/c'),
    ).not.toEqual([]);
    registerRenderableKind('h1-kind-test', {
      description: 'a test kind',
      owner: 'test',
      fields: { tier: z.int().min(0).max(2).describe('Test detail tier.') },
    });
    expect(componentIssues('h1-kind-test-unused' as string, {}, '/c')).toEqual([]);
    expect(
      componentIssues('renderable', { kind: 'h1-kind-test', ref: 'x', tier: 2 }, '/c'),
    ).toEqual([]);
    // Optional for every other kind, and still validated when present.
    expect(componentIssues('renderable', { kind: 'primitive', ref: 'box' }, '/c')).toEqual([]);
    expect(
      componentIssues('renderable', { kind: 'h1-kind-test', ref: 'x', tier: 9 }, '/c'),
    ).not.toEqual([]);
    expect(listRenderableKinds().find((k) => k.kind === 'h1-kind-test')?.description).toBe(
      'a test kind',
    );
  });

  it('cannot shadow a core renderable field', () => {
    expect(() =>
      registerRenderableKind('h1-kind-clash', {
        description: 'x',
        fields: { ref: z.string() },
      }),
    ).toThrow(/core field "ref"/);
  });
});

describe('component field descriptions', () => {
  // Snapshot at collection time: other tests register throwaway components at run time.
  const coreComponents = componentNames();

  it('propagate .describe() into the JSON Schema (transform.pos)', () => {
    const entry = getComponent('transform');
    expect(entry).toBeDefined();
    const jsonSchema = z.toJSONSchema(entry?.zod as z.ZodType, { io: 'input' }) as {
      properties: Record<string, { description?: unknown }>;
    };
    const description = jsonSchema.properties.pos?.description;
    expect(typeof description).toBe('string');
    expect((description as string).length).toBeGreaterThan(0);
  });

  it('every core component field carries a description', () => {
    const missing: string[] = [];
    const walk = (node: unknown, path: string): void => {
      if (node === null || typeof node !== 'object') return;
      const s = node as Record<string, unknown>;
      for (const [key, prop] of Object.entries(
        (s.properties as Record<string, unknown> | undefined) ?? {},
      )) {
        const p = prop as Record<string, unknown>;
        if (typeof p.description !== 'string' || p.description.length === 0) {
          missing.push(`${path}.${key}`);
        }
        walk(p, `${path}.${key}`);
      }
      if (s.items !== undefined) walk(s.items, `${path}[]`);
      for (const variants of [s.oneOf, s.anyOf]) {
        if (!Array.isArray(variants)) continue;
        variants.forEach((v, i) => {
          walk(v, `${path}|${i}`);
        });
      }
    };
    expect(coreComponents.length).toBeGreaterThan(0);
    for (const name of coreComponents) {
      walk(z.toJSONSchema(getComponent(name)?.zod as z.ZodType, { io: 'input' }), name);
    }
    expect(missing).toEqual([]);
  });
});
