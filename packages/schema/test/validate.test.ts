import { describe, expect, it } from 'vitest';
import { detectKind, getSchema, listSchemas, validate } from '../src/index';

describe('validate: happy paths', () => {
  it('parses a valid command', () => {
    const r = validate('command', {
      kind: 'command',
      seq: 1,
      source: 'local',
      tick: 45,
      type: 'spawn_cube',
      payload: { pos: [0, 2, 0] },
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.type).toBe('spawn_cube');
  });

  it('applies scene defaults', () => {
    const r = validate('scene', { format: 'molen/scene@3', name: 'minimal' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.tickRate).toBe(30);
      expect(r.value.lateCommands).toBe('rewrite');
      expect(r.value.keyframeInterval).toBe(60);
      expect(r.value.entities).toEqual([]);
      expect(r.value.prefabs).toEqual({});
    }
  });

  it('every registered schema example validates', () => {
    for (const summary of listSchemas()) {
      const entry = getSchema(summary.kind);
      expect(entry).toBeDefined();
      for (const example of entry?.meta.examples ?? []) {
        const r = validate(summary.kind as never, example);
        expect(r.ok, `${summary.kind} example should validate`).toBe(true);
      }
    }
  });
});

describe('validate: rejections', () => {
  it('rejects an authored entity id that looks like a runtime id', () => {
    const r = validate('scene', {
      format: 'molen/scene@3',
      name: 'bad-id',
      entities: [{ id: 'e42', components: {} }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues[0]?.path).toBe('/entities/0/id');
      expect(r.formatted).toContain('runtime ids');
    }
  });

  it('suggests the nearest enum value on a typo', () => {
    const r = validate('scene', {
      format: 'molen/scene@3',
      name: 'typo',
      lateCommands: 'rewite',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const issue = r.issues.find((i) => i.path === '/lateCommands');
      expect(issue?.hint).toBe('did you mean "rewrite"?');
      expect(issue?.expected).toContain('"rewrite"');
    }
  });

  it('suggests the nearest key for an unknown key', () => {
    const r = validate('command', {
      kind: 'command',
      seq: 1,
      source: 'local',
      tikc: 45,
      tick: 45,
      type: 'x',
      payload: null,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const issue = r.issues.find((i) => i.code === 'unrecognized_keys');
      expect(issue?.hint).toBe('did you mean "tick"?');
      expect(issue?.expected).toContain('known keys:');
    }
  });

  it('reports unknown schema kinds with a suggestion', () => {
    const r = validate('comand' as never, {});
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues[0]?.code).toBe('unknown_schema_kind');
      expect(r.issues[0]?.hint).toBe('did you mean "command"?');
    }
  });

  it('rejects duplicate scene script ids', () => {
    const r = validate('scene', {
      format: 'molen/scene@3',
      name: 'scripts',
      scripts: [
        { id: 'same', code: `molen.on('tick', () => {});` },
        { id: 'same', code: `molen.on('tick', () => {});` },
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.some((i) => i.code === 'duplicate_script_id')).toBe(true);
  });
});

// A wrong `format` is version/kind skew, not a value typo: "did you mean \"molen/scene@3\"?"
// invites an agent to edit the version string and then meet the real breaking changes one at a
// time. The message has to say what the document is and what this build reads.
describe('format envelope skew', () => {
  it('names both versions and refuses to suggest a one-character fix', () => {
    const r = validate('scene', { format: 'molen/scene@2', name: 'old' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const issue = r.issues.find((i) => i.path === '/format');
      expect(issue?.code).toBe('format_version_skew');
      expect(issue?.message).toBe(
        'document declares "molen/scene@2"; this build reads "molen/scene@3"',
      );
      expect(issue?.expected).toBe('"molen/scene@3"');
      expect(issue?.received).toBe('"molen/scene@2"');
      expect(issue?.hint).toContain('different shape');
      expect(issue?.hint).not.toContain('did you mean');
      expect(issue?.docsRef).toBe('schemas/scene.md');
    }
  });

  it('says so when the document is newer than this build', () => {
    const r = validate('scene', { format: 'molen/scene@9', name: 'future' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const issue = r.issues.find((i) => i.path === '/format');
      expect(issue?.code).toBe('format_version_skew');
      expect(issue?.hint).toContain('newer than this build reads');
    }
  });

  it('reports a different document kind as a kind mismatch, not a typo', () => {
    const r = validate('scene', { format: 'molen/prefab@1', name: 'x' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const issue = r.issues.find((i) => i.path === '/format');
      expect(issue?.code).toBe('format_kind_mismatch');
      expect(issue?.message).toContain('a prefab document, not a scene');
    }
  });

  it('tells a document with no envelope to add one', () => {
    const r = validate('scene', { name: 'no-envelope' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const issue = r.issues.find((i) => i.path === '/format');
      expect(issue?.code).toBe('missing_format');
      expect(issue?.received).toBe('undefined (missing)');
      expect(issue?.hint).toContain('"format": "molen/scene@3"');
    }
  });

  it('leaves ordinary enum typos with their did-you-mean', () => {
    const r = validate('scene', {
      format: 'molen/scene@3',
      name: 'x',
      lateCommands: 'rewite',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues.find((i) => i.path === '/lateCommands')?.hint).toBe(
        'did you mean "rewrite"?',
      );
    }
  });
});

describe('formatted output (golden text)', () => {
  it('renders the agent-facing block exactly', () => {
    const r = validate('scene', {
      format: 'molen/scene@3',
      name: 'goblin-arena',
      tickRate: 'fast',
      entities: [{ id: 'player', components: { transform: { pos: [0, 1] } } }],
      lateCommand: 'reject',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.formatted).toBe(
        [
          '✖ scene "goblin-arena" failed validation (2 issues)',
          '',
          '1. /tickRate',
          '   Invalid input: expected number, received string',
          '   expected: number',
          '   received: "fast"',
          '   docs:     schemas/scene.md',
          '',
          '2. /lateCommand',
          '   unknown key: "lateCommand"',
          '   expected: known keys: format, name, seed, tickRate, lateCommands, keyframeInterval, prefabs, entities, scripts, commands, components, camera, input, terrain, physics',
          '   hint:     did you mean "lateCommands"?',
          '   docs:     schemas/scene.md',
        ].join('\n'),
      );
    }
  });

  it('renders a missing-field issue with received undefined', () => {
    const r = validate('command', {
      kind: 'command',
      seq: 1,
      source: 'local',
      tick: 1,
      payload: {},
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const issue = r.issues.find((i) => i.path === '/type');
      expect(issue?.received).toBe('undefined (missing)');
    }
  });
});

describe('detectKind', () => {
  it('detects from format envelope', () => {
    expect(detectKind({ format: 'molen/scene@3' })).toBe('scene');
    expect(detectKind({ format: 'molen/replay@1' })).toBe('replay');
  });
  it('detects from kind field', () => {
    expect(detectKind({ kind: 'keyframe' })).toBe('keyframe');
    expect(detectKind({ kind: 'delta' })).toBe('delta');
    expect(detectKind({ kind: 'command' })).toBe('command');
  });
  it('returns undefined for unknowns', () => {
    expect(detectKind({ format: 'molen/nope@1' })).toBeUndefined();
    expect(detectKind(42)).toBeUndefined();
    expect(detectKind({})).toBeUndefined();
  });
});
