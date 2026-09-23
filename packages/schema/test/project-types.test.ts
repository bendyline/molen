import { describe, expect, it } from 'vitest';
import {
  buildTypeIndex,
  checkTypes,
  commandPayloadValidator,
  compileCommandPayload,
  getComponent,
  namespaceCovers,
  resolveType,
  sceneTypeRefIssues,
  type TypesDoc,
  unregisterComponent,
  validate,
} from '../src/index';

const trainTypes: TypesDoc = {
  format: 'molen/types@1',
  namespace: 'train',
  owner: 'agent:layout',
  types: {
    'train.car': {
      components: {
        transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
        renderable: { kind: 'primitive', ref: 'box', materialRef: 'palette:#8a5a2b' },
      },
      assets: [],
    },
    'train.locomotive': {
      extends: 'train.car',
      components: { renderable: { materialRef: 'palette:#2b2b2b' } },
      assets: [],
    },
  },
};

describe('molen/types@1 + molen/project@1', () => {
  it('validates the registered examples and enforces the namespace', () => {
    const outside = validate('types', {
      format: 'molen/types@1',
      namespace: 'train',
      types: { 'road.car': { components: {} } },
    });
    expect(outside.ok).toBe(false);
    if (!outside.ok) {
      expect(outside.issues.some((i) => i.code === 'type_outside_namespace')).toBe(true);
    }
  });

  it('rejects same-file extends cycles', () => {
    const r = validate('types', {
      format: 'molen/types@1',
      namespace: 'a',
      types: {
        'a.x': { extends: 'a.y', components: {} },
        'a.y': { extends: 'a.x', components: {} },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.some((i) => i.code === 'type_extends_cycle')).toBe(true);
  });

  it('resolveType flattens extends ancestor-first (child overrides win)', () => {
    const { index, issues } = buildTypeIndex([{ doc: trainTypes, source: 'train.types.json' }]);
    expect(issues).toHaveLength(0);
    const loco = resolveType(index, 'train.locomotive');
    expect(loco.renderable?.materialRef).toBe('palette:#2b2b2b'); // child override
    expect(loco.renderable?.kind).toBe('primitive'); // inherited from train.car
    expect(loco.transform?.pos).toEqual([0, 0, 0]);
  });

  it('namespaceCovers respects dot boundaries', () => {
    expect(namespaceCovers('train', 'train.car')).toBe(true);
    expect(namespaceCovers('train', 'train')).toBe(true);
    expect(namespaceCovers('train', 'trainer.x')).toBe(false);
  });

  it('project validation rejects cross-owner reservation overlap + unknown defaultScene', () => {
    const r = validate('project', {
      format: 'molen/project@1',
      name: 'x',
      scenes: { main: 'scenes/main.scene.json' },
      defaultScene: 'other',
      reservations: [
        { namespace: 'train', owner: 'a' },
        { namespace: 'train.cars', owner: 'b' },
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues.some((i) => i.code === 'unknown_default_scene')).toBe(true);
      expect(r.issues.some((i) => i.code === 'reservation_overlap')).toBe(true);
    }
  });

  it('checkTypes flags foreign-owned namespaces and dangling asset refs', () => {
    const project = validate('project', {
      format: 'molen/project@1',
      name: 'x',
      reservations: [{ namespace: 'train', owner: 'someone-else' }],
    });
    expect(project.ok).toBe(true);
    if (!project.ok) return;
    const withAsset: TypesDoc = {
      ...trainTypes,
      types: {
        ...trainTypes.types,
        'train.boxcar': { components: {}, assets: ['train.boxcar_mesh'] },
      },
    };
    const issues = checkTypes(project.value, [{ doc: withAsset, source: 'train.types.json' }]);
    expect(issues.some((i) => i.code === 'namespace_not_owned')).toBe(true);
    expect(issues.some((i) => i.code === 'unknown_asset_ref')).toBe(true);
  });
});

describe('scene@3: older formats are rejected (no migration path)', () => {
  it('rejects scene@1 and scene@2 documents at /format', () => {
    for (const format of ['molen/scene@1', 'molen/scene@2']) {
      const r = validate('scene', { format, name: 'old' });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.issues[0]?.path).toBe('/format');
    }
  });

  it('rejects the removed entity `overrides` field as an unknown key', () => {
    const r = validate('scene', {
      format: 'molen/scene@3',
      name: 'x',
      prefabs: { p: { components: { health: { hp: 1 } } } },
      entities: [{ id: 'a', prefab: 'p', overrides: { health: { hp: 2 } } }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.some((i) => i.path === '/entities/0/overrides')).toBe(true);
  });

  it('rejects integer-like authored ids', () => {
    const r = validate('scene', { format: 'molen/scene@3', name: 'x', entities: [{ id: '42' }] });
    expect(r.ok).toBe(false);
  });

  it('rejects scripts with both code and path (or neither)', () => {
    const both = validate('scene', {
      format: 'molen/scene@3',
      name: 'x',
      scripts: [{ id: 's', code: 'molen.on', path: 'scripts/s.js' }],
    });
    expect(both.ok).toBe(false);
    if (!both.ok) expect(both.issues[0]?.code).toBe('script_source_ambiguous');
    const neither = validate('scene', {
      format: 'molen/scene@3',
      name: 'x',
      scripts: [{ id: 's' }],
    });
    expect(neither.ok).toBe(false);
    if (!neither.ok) expect(neither.issues[0]?.code).toBe('script_source_missing');
  });

  it('rejects emit rules referencing unbound actions and duplicate entity ids', () => {
    const r = validate('scene', {
      format: 'molen/scene@3',
      name: 'x',
      entities: [{ id: 'a' }, { id: 'a' }],
      commands: { jump: {} },
      input: {
        bindings: { KeyW: 'up' },
        emit: [{ kind: 'press', action: 'jump', command: 'jump' }],
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues.some((i) => i.code === 'duplicate_entity_id')).toBe(true);
      expect(r.issues.some((i) => i.code === 'unknown_input_action')).toBe(true);
    }
  });
});

describe('scene@3: declared commands', () => {
  it('flags emit rules that send undeclared commands, with did-you-mean', () => {
    const r = validate('scene', {
      format: 'molen/scene@3',
      name: 'x',
      commands: { move: {} },
      input: {
        bindings: { KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right' },
        emit: [
          {
            kind: 'axis2d',
            xNeg: 'left',
            xPos: 'right',
            yNeg: 'up',
            yPos: 'down',
            command: 'mvoe',
          },
        ],
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const issue = r.issues.find((i) => i.code === 'undeclared_command');
      expect(issue?.path).toBe('/input/emit/0/command');
      expect(issue?.hint).toContain('"move"');
    }
  });

  it('accepts a declared command with a JSON Schema payload and rejects an unsupported one', () => {
    const ok = validate('scene', {
      format: 'molen/scene@3',
      name: 'x',
      commands: {
        move: {
          doc: 'planar move',
          payload: {
            type: 'object',
            properties: { dir: { type: 'array', items: { type: 'number' } } },
            required: ['dir'],
          },
        },
      },
    });
    expect(ok.ok).toBe(true);
    const bad = validate('scene', {
      format: 'molen/scene@3',
      name: 'x',
      commands: { move: { payload: { type: 'bogus' } } },
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.issues[0]?.code).toBe('invalid_payload_schema');
      expect(bad.issues[0]?.path).toBe('/commands/move/payload');
    }
  });

  it('commandPayloadValidator formats failures like every other validation surface', () => {
    const check = commandPayloadValidator('move', {
      type: 'object',
      properties: {
        dir: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
      },
      required: ['dir'],
      additionalProperties: false,
    });
    expect(check({ dir: [1, 0] })).toEqual({ ok: true });
    const r = check({ dir: 'x' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toContain('command "move" payload failed validation');
      expect(r.message).toContain('/dir');
    }
    expect(() => compileCommandPayload({ type: 'bogus' })).toThrow();
  });
});

describe('scene@3: prefab references and physics flags', () => {
  it('flags unknown prefab references (entity and extends) with did-you-mean', () => {
    const r = validate('scene', {
      format: 'molen/scene@3',
      name: 'x',
      prefabs: {
        goblin: { components: { health: { hp: 1 } } },
        elite: { extends: 'gobln', components: {} },
      },
      entities: [{ id: 'a', prefab: 'goblim' }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const entityRef = r.issues.find((i) => i.path === '/entities/0/prefab');
      expect(entityRef?.code).toBe('unknown_prefab');
      expect(entityRef?.hint).toContain('goblin');
      expect(r.issues.some((i) => i.path === '/prefabs/elite/extends')).toBe(true);
    }
  });

  it('flags prefab extends cycles', () => {
    const r = validate('scene', {
      format: 'molen/scene@3',
      name: 'x',
      prefabs: { a: { extends: 'b', components: {} }, b: { extends: 'a', components: {} } },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.some((i) => i.code === 'prefab_extends_cycle')).toBe(true);
  });

  it('rejects physics.character together with the rapier engine', () => {
    const r = validate('scene', {
      format: 'molen/scene@3',
      name: 'x',
      physics: { engine: 'rapier', character: true },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues[0]?.code).toBe('character_engine_conflict');
    expect(
      validate('scene', {
        format: 'molen/scene@3',
        name: 'x',
        physics: { engine: 'kinematics', ground: 'terrain', character: true },
      }).ok,
    ).toBe(true);
  });
});

describe('custom components: severity and declarations', () => {
  it('a strong near-miss is still an error; a merely-close custom name is a notice', () => {
    const typo = validate('scene', {
      format: 'molen/scene@3',
      name: 'x',
      entities: [{ id: 'a', components: { Transform: { pos: [0, 0, 0] } } }],
    });
    expect(typo.ok).toBe(false);
    if (!typo.ok) expect(typo.issues[0]?.code).toBe('unknown_component');

    for (const name of ['team', 'coin', 'heat', 'tags']) {
      const r = validate('scene', {
        format: 'molen/scene@3',
        name: 'x',
        entities: [{ id: 'a', components: { [name]: { v: 1 } } }],
      });
      expect(r.ok, name).toBe(true);
      if (r.ok) expect(r.notices?.[0]?.code, name).toBe('undeclared_component');
    }
    // Far from every core name: genuinely novel, no notice at all.
    const novel = validate('scene', {
      format: 'molen/scene@3',
      name: 'x',
      entities: [{ id: 'a', components: { inventory: { slots: [] } } }],
    });
    expect(novel.ok).toBe(true);
    if (novel.ok) expect(novel.notices).toBeUndefined();
  });

  it('a scene-declared component is known, shape-checked when it has a schema, and silent', () => {
    const doc = {
      format: 'molen/scene@3',
      name: 'x',
      components: {
        team: {
          description: 'Team membership.',
          examples: [{ id: 'red' }],
          schema: {
            type: 'object',
            properties: { id: { type: 'string' } },
            required: ['id'],
            additionalProperties: false,
          },
        },
        coin: { description: 'Collectible marker.', examples: [{ value: 1 }] },
      },
      entities: [{ id: 'a', components: { team: { id: 'red' }, coin: { anything: true } } }],
    };
    const r = validate('scene', doc);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.notices).toBeUndefined();
    expect(getComponent('team')).toBeUndefined(); // Validation is pure.

    const bad = validate('scene', {
      ...doc,
      entities: [{ id: 'a', components: { team: {} } }],
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.issues[0]?.path).toBe('/entities/0/components/team/id');
    unregisterComponent('team');
    unregisterComponent('coin');
  });

  it('an unsupported declared schema fails closed', () => {
    const r = validate('scene', {
      format: 'molen/scene@3',
      name: 'x',
      components: { weird: { description: 'x', examples: [{}], schema: { type: 'bogus' } } },
      entities: [{ id: 'a', components: { weird: { whatever: 1 } } }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues[0]?.code).toBe('component_schema_unsupported');
    unregisterComponent('weird');
  });

  it('project.json declares a shared component vocabulary', () => {
    const r = validate('project', {
      format: 'molen/project@1',
      name: 'p',
      components: { score: { description: 'Points.', examples: [{ value: 0 }] } },
    });
    expect(r.ok).toBe(true);
    expect(getComponent('score')).toBeUndefined();
    unregisterComponent('score');
  });
});

describe('scene type references (sceneTypeRefIssues)', () => {
  it('flags unknown entity and prefab type ids with did-you-mean', () => {
    const r = validate('scene', {
      format: 'molen/scene@3',
      name: 'x',
      prefabs: { car: { type: 'train.boxcarr', components: {} } },
      entities: [
        { id: 'a', type: 'train.locomotiv' },
        { id: 'b', type: 'train.locomotive' },
      ],
    });
    if (!r.ok) throw new Error(r.formatted);
    const issues = sceneTypeRefIssues(r.value, ['train.locomotive', 'train.boxcar']);
    expect(issues.map((i) => [i.path, i.code, i.hint])).toEqual([
      ['/entities/0/type', 'unknown_type', 'did you mean "train.locomotive"?'],
      ['/prefabs/car/type', 'unknown_type', 'did you mean "train.boxcar"?'],
    ]);
    expect(
      sceneTypeRefIssues(r.value, [
        'train.locomotive',
        'train.boxcar',
        'train.locomotiv',
        'train.boxcarr',
      ]),
    ).toEqual([]);
  });
});
