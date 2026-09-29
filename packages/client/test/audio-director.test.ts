import type { EngineEvent, JsonObject, SoundbankDoc } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import {
  AudioDirector,
  type AudioEntitySource,
  createAudioLayer,
  createRecordingBackend,
  curve,
  entitySourceFromWorld,
  Gate,
  mergeSoundbanks,
  type VoiceCommand,
} from '../src/audio';

const src = (license = 'CC0-1.0') => ({ license });
const BANK: SoundbankDoc = {
  format: 'molen/soundbank@1',
  id: 'test',
  sounds: {
    'ambience.rain': { clips: ['rain.mp3'], loop: true, bus: 'ambience', source: src() },
    'ambience.birds': { clips: ['birds.mp3'], loop: true, bus: 'ambience', source: src() },
    'engine.car': { clips: ['engine.mp3'], loop: true, source: src() },
    'footstep.grass': {
      clips: ['g1.mp3', 'g2.mp3', 'g3.mp3'],
      pitch: [0.9, 1.1],
      durationS: 0.3,
      source: src(),
    },
    'footstep.wood': { clips: ['w1.mp3'], durationS: 0.3, source: src() },
    'impact.heavy': { clips: ['crash.mp3'], durationS: 1, source: src() },
    'ui.click': { clips: ['click.mp3'], durationS: 0.1, spatial: false, source: src() },
    'music.a': { clips: ['a.mp3'], durationS: 20, source: src() },
    'music.b': { clips: ['b.mp3'], durationS: 20, source: src() },
    'water.stream': { clips: ['stream.mp3'], loop: true, source: src() },
  },
};

class FakeSource implements AudioEntitySource {
  tick = 0;
  tickRate = 30;
  readonly entities = new Map<string, Record<string, JsonObject>>();
  private listeners: ((e: EngineEvent, t: number) => void)[] = [];
  each(component: string): [string, JsonObject][] {
    const out: [string, JsonObject][] = [];
    for (const [id, comps] of this.entities) if (comps[component]) out.push([id, comps[component]]);
    return out;
  }
  get(id: string, component: string): JsonObject | undefined {
    return this.entities.get(id)?.[component];
  }
  set(id: string, component: string, data: JsonObject): void {
    const e = this.entities.get(id) ?? {};
    e[component] = data;
    this.entities.set(id, e);
  }
  onEvent(cb: (e: EngineEvent, t: number) => void): () => void {
    this.listeners.push(cb);
    return () => {};
  }
  emit(type: string, payload: JsonObject): void {
    for (const l of this.listeners) l({ type, payload }, this.tick);
  }
}

const starts = (cmds: VoiceCommand[]) =>
  cmds.filter((c): c is Extract<VoiceCommand, { op: 'start' }> => c.op === 'start');
const stops = (cmds: VoiceCommand[]) => cmds.filter((c) => c.op === 'stop');
const director = (env = {}) =>
  new AudioDirector({ bank: mergeSoundbanks([BANK]), environment: env });

describe('ambience rules', () => {
  it('plays rain only while it rains, with gain from intensity', () => {
    const d = director({
      ambience: [
        {
          sound: 'ambience.rain',
          when: { 'weather.precipitation.kind': 'rain' },
          gainFrom: {
            signal: 'weather.precipitation.intensity',
            curve: [
              [0, 0],
              [1, 1],
            ],
          },
        },
      ],
    });
    expect(starts(d.update({ nowMs: 0 }))).toEqual([]);
    const rain = { precipitation: { kind: 'rain' as const, intensity: 0.5 } };
    let cmds = d.update({ nowMs: 100, signals: { weather: rain } });
    // Gate needs 250 ms of the condition before entering after the first evaluation.
    expect(starts(cmds)).toEqual([]);
    cmds = d.update({ nowMs: 400, signals: { weather: rain } });
    const [start] = starts(cmds);
    expect(start).toMatchObject({ sound: 'ambience.rain', loop: true, bus: 'ambience', gain: 0.5 });
    cmds = d.update({
      nowMs: 500,
      signals: { weather: { precipitation: { kind: 'rain', intensity: 0.9 } } },
    });
    expect(cmds.find((c) => c.op === 'set')).toMatchObject({ gain: 0.9 });
    // Snow keeps intensity up but fails the condition: the layer holds for the exit delay.
    const snow = { precipitation: { kind: 'snow' as const, intensity: 0.9 } };
    expect(stops(d.update({ nowMs: 600, signals: { weather: snow } }))).toEqual([]);
    expect(stops(d.update({ nowMs: 1700, signals: { weather: snow } }))).toHaveLength(1);
    // Zero gain (no precipitation at all) stops a voice at once, fading.
    d.update({ nowMs: 1800, signals: { weather: rain } });
    d.update({ nowMs: 2100, signals: { weather: rain } });
    expect(stops(d.update({ nowMs: 2200, signals: { weather: {} } }))).toHaveLength(1);
  });

  it('holds a layer through a signal flickering around its threshold', () => {
    const d = director({
      ambience: [{ sound: 'ambience.birds', when: { 'sky.daylight': { min: 0.3 } } }],
    });
    d.update({ nowMs: 0, signals: { sky: { daylight: 0.5 } } });
    expect(d.voices().map((v) => v.sound)).toEqual(['ambience.birds']);
    let t = 0;
    for (const daylight of [0.29, 0.31, 0.29, 0.305, 0.29]) {
      t += 100;
      const cmds = d.update({ nowMs: t, signals: { sky: { daylight } } });
      expect(stops(cmds)).toEqual([]);
    }
    expect(d.voices()).toHaveLength(1);
  });

  it('fades ground ambience with height and multiplies listed curves', () => {
    const d = director({
      ambience: [
        {
          sound: 'ambience.birds',
          gainFrom: [
            {
              signal: 'listener.heightAboveGround',
              curve: [
                [2, 1],
                [40, 0.4],
                [200, 0],
              ],
            },
            {
              signal: 'host.streetDistance',
              curve: [
                [0, 0.5],
                [100, 1],
              ],
            },
          ],
        },
      ],
    });
    const at = (nowMs: number, heightAboveGround: number, streetDistance: number) =>
      d.update({ nowMs, listener: { heightAboveGround }, signals: { host: { streetDistance } } });
    const [start] = starts(at(0, 1.7, 100));
    expect(start?.gain).toBeCloseTo(1);
    expect(at(100, 40, 100).find((c) => c.op === 'set')).toMatchObject({ gain: 0.4 });
    expect(at(200, 40, 0).find((c) => c.op === 'set')?.gain).toBeCloseTo(0.2);
    expect(stops(at(300, 250, 100))).toHaveLength(1);
    // Hosts that report no height count as standing on the ground.
    const flat = director({
      ambience: [
        {
          sound: 'ambience.birds',
          gainFrom: {
            signal: 'listener.heightAboveGround',
            curve: [
              [2, 1],
              [200, 0],
            ],
          },
        },
      ],
    });
    expect(starts(flat.update({ nowMs: 0 }))[0]?.gain).toBe(1);
  });

  it('treats a scene without sky as daytime', () => {
    const d = director({
      ambience: [{ sound: 'ambience.birds', when: { 'sky.daylight': { min: 0.3 } } }],
    });
    expect(starts(d.update({ nowMs: 0 }))).toHaveLength(1);
  });
});

describe('entity sources', () => {
  it('binds engine pitch to vehicleState.speed and follows the entity', () => {
    const s = new FakeSource();
    s.set('car', 'transform', { pos: [10, 0, 0] });
    s.set('car', 'vehicleState', { speed: 0 });
    s.set('car', 'audioSource', {
      sound: 'engine.car',
      pitchFrom: {
        signal: 'vehicleState.speed',
        curve: [
          [0, 1],
          [30, 2],
        ],
      },
    });
    const d = director();
    const [start] = starts(d.update({ nowMs: 0, source: s }));
    expect(start).toMatchObject({ sound: 'engine.car', loop: true, pitch: 1 });
    expect(start?.spatial?.position).toEqual([10, 0, 0]);
    s.set('car', 'vehicleState', { speed: 15 });
    s.set('car', 'transform', { pos: [12, 0, 0] });
    const set = d.update({ nowMs: 16, source: s }).find((c) => c.op === 'set');
    expect(set).toMatchObject({ pitch: 1.5, position: [12, 0, 0] });
    s.entities.delete('car');
    expect(stops(d.update({ nowMs: 32, source: s }))).toHaveLength(1);
  });

  it('runs an engine only while someone rides the vehicle (self.occupied)', () => {
    const s = new FakeSource();
    s.set('car', 'transform', { pos: [2, 0, 0] });
    s.set('car', 'audioSource', { sound: 'engine.car', when: { 'self.occupied': true } });
    const d = director();
    expect(starts(d.update({ nowMs: 0, source: s }))).toEqual([]);
    s.set('driver', 'mounted', { vehicle: 'car', seat: 'driver' });
    d.update({ nowMs: 100, source: s });
    expect(starts(d.update({ nowMs: 400, source: s }))).toMatchObject([{ sound: 'engine.car' }]);
    s.entities.delete('driver'); // the driver gets out
    d.update({ nowMs: 500, source: s });
    expect(stops(d.update({ nowMs: 1600, source: s }))).toHaveLength(1);
  });

  it('holds no voice for a loop driven to silence', () => {
    const s = new FakeSource();
    s.set('plane', 'transform', { pos: [5, 0, 0] });
    s.set('plane', 'aircraftState', { rpm: 0 });
    s.set('plane', 'audioSource', {
      sound: 'engine.car',
      gainFrom: {
        signal: 'aircraftState.rpm',
        curve: [
          [0, 0],
          [1, 1],
        ],
      },
    });
    const d = director();
    expect(starts(d.update({ nowMs: 0, source: s }))).toEqual([]);
    s.set('plane', 'aircraftState', { rpm: 0.5 });
    expect(starts(d.update({ nowMs: 16, source: s }))).toMatchObject([{ gain: 0.5 }]);
    s.set('plane', 'aircraftState', { rpm: 0 });
    expect(stops(d.update({ nowMs: 32, source: s }))).toHaveLength(1);
  });

  it('culls positional loops beyond maxDistance', () => {
    const s = new FakeSource();
    s.set('far', 'transform', { pos: [500, 0, 0] });
    s.set('far', 'audioSource', { sound: 'engine.car', spatial: { maxDistance: 100 } });
    expect(starts(director().update({ nowMs: 0, source: s }))).toEqual([]);
  });

  it('fires startTick one-shots once and triggerFrom by distance', () => {
    const s = new FakeSource();
    s.set('bot', 'transform', { pos: [0, 0, 0] });
    s.set('bot', 'audioSource', {
      sound: 'footstep.grass',
      autoplay: false,
      triggerFrom: { signal: 'self.distance', every: 1 },
    });
    s.set('door', 'audioSource', { sound: 'impact.heavy', autoplay: false, startTick: 5 });
    const d = director();
    let shots = 0;
    let doors = 0;
    for (let i = 0; i <= 30; i++) {
      s.tick = i;
      s.set('bot', 'transform', { pos: [i * 0.25, 0, 0] });
      const cmds = starts(d.update({ nowMs: i * 33, source: s }));
      shots += cmds.filter((c) => c.sound === 'footstep.grass').length;
      doors += cmds.filter((c) => c.sound === 'impact.heavy').length;
    }
    expect(doors).toBe(1);
    expect(shots).toBe(7); // 7.5 m walked, one step per meter
  });
});

describe('events and scripts', () => {
  it('maps engine events to positional one-shots', () => {
    const s = new FakeSource();
    s.set('car', 'transform', { pos: [3, 0, 4] });
    const d = director({ events: { crash: { sound: 'impact.heavy' } } });
    d.handleEvent({ type: 'crash', payload: { entity: 'car' } });
    const [shot] = starts(d.update({ nowMs: 0, source: s }));
    expect(shot).toMatchObject({ sound: 'impact.heavy', loop: false });
    expect(shot?.spatial?.position).toEqual([3, 0, 4]);
  });

  it('plays and stops script loops by handle', () => {
    const d = director();
    d.handleEvent({
      type: 'audio.play',
      payload: { handle: 'h1', sound: 'engine.car', loop: true },
    });
    expect(starts(d.update({ nowMs: 0 }))).toHaveLength(1);
    expect(starts(d.update({ nowMs: 16 }))).toHaveLength(0);
    d.handleEvent({ type: 'audio.stop', payload: { handle: 'h1', fadeS: 0.4 } });
    expect(stops(d.update({ nowMs: 32 }))).toEqual([expect.objectContaining({ fadeS: 0.4 })]);
  });

  it('warns once about unknown sounds with a suggestion', () => {
    const warnings: string[] = [];
    const d = new AudioDirector({
      bank: mergeSoundbanks([BANK]),
      onWarning: (m) => warnings.push(m),
    });
    d.handleEvent({ type: 'audio.play', payload: { sound: 'footstep.grss' } });
    d.handleEvent({ type: 'audio.play', payload: { sound: 'footstep.grss' } });
    d.update({ nowMs: 0 });
    expect(warnings).toEqual([
      'unknown sound "footstep.grss" (molen.audio.play); did you mean "footstep.grass"?',
    ]);
  });
});

describe('footsteps and music', () => {
  it('steps every stride while walking, with surface overrides', () => {
    const d = director({
      footsteps: {
        sound: 'footstep.grass',
        surfaces: { wood: 'footstep.wood' },
        strideM: 0.75,
        when: { 'listener.mode': 'walk' },
      },
    });
    const sounds: string[] = [];
    for (let i = 0; i <= 20; i++) {
      const cmds = d.update({
        nowMs: i * 50,
        listener: { position: [i * 0.15, 0, 0], mode: 'walk', surface: i > 10 ? 'wood' : 'grass' },
      });
      sounds.push(...starts(cmds).map((c) => c.sound));
    }
    expect(sounds).toEqual(['footstep.grass', 'footstep.grass', 'footstep.wood', 'footstep.wood']);
    const flying = director({
      footsteps: { sound: 'footstep.grass', when: { 'listener.mode': 'walk' } },
    });
    for (let i = 0; i <= 20; i++)
      expect(
        starts(flying.update({ nowMs: i * 50, listener: { position: [i, 0, 0], mode: 'fly' } })),
      ).toEqual([]);
  });

  it('crossfades through a playlist and obeys molen.audio.music', () => {
    const d = director({ music: { playlist: ['music.a', 'music.b'], crossfadeS: 4 } });
    expect(starts(d.update({ nowMs: 0 }))).toMatchObject([{ sound: 'music.a', bus: 'music' }]);
    expect(starts(d.update({ nowMs: 15000 }))).toEqual([]);
    const cmds = d.update({ nowMs: 16100 });
    expect(starts(cmds)).toMatchObject([{ sound: 'music.b', fadeInS: 4 }]);
    expect(stops(cmds)).toEqual([expect.objectContaining({ fadeS: 4 })]);
    d.handleEvent({ type: 'audio.music', payload: { playlist: null } });
    expect(stops(d.update({ nowMs: 17000 }))).toHaveLength(1);
  });
});

describe('zones, budget, determinism', () => {
  it('fades a zone with distance outside its shape', () => {
    const s = new FakeSource();
    s.set('creek', 'transform', { pos: [0, 0, 0] });
    s.set('creek', 'audioZone', {
      sound: 'water.stream',
      shape: { kind: 'sphere', radius: 5 },
      fade: 10,
    });
    const d = director();
    const [start] = starts(d.update({ nowMs: 0, source: s, listener: { position: [10, 0, 0] } }));
    expect(start?.gain).toBeCloseTo(0.5);
    expect(start?.spatial).toBeUndefined();
    expect(
      stops(d.update({ nowMs: 16, source: s, listener: { position: [40, 0, 0] } })),
    ).toHaveLength(1);
  });

  it('keeps the loudest voices within maxVoices', () => {
    const s = new FakeSource();
    for (let i = 0; i < 6; i++) {
      s.set(`car${i}`, 'transform', { pos: [i * 5 + 1, 0, 0] });
      s.set(`car${i}`, 'audioSource', { sound: 'engine.car' });
    }
    const d = director({ maxVoices: 3 });
    d.update({ nowMs: 0, source: s });
    expect(
      d
        .voices()
        .map((v) => v.entity)
        .sort(),
    ).toEqual(['car0', 'car1', 'car2']);
  });

  it('is deterministic for identical inputs', () => {
    const run = () => {
      const d = director({ footsteps: { sound: 'footstep.grass', strideM: 0.5 } });
      const all: VoiceCommand[] = [];
      for (let i = 0; i < 40; i++)
        all.push(...d.update({ nowMs: i * 50, listener: { position: [i * 0.2, 0, 0] } }));
      return all;
    };
    expect(run()).toEqual(run());
  });
});

describe('helpers', () => {
  it('interpolates curves and clamps ends', () => {
    expect(
      curve(
        [
          [0, 0],
          [10, 1],
        ],
        5,
      ),
    ).toBeCloseTo(0.5);
    expect(
      curve(
        [
          [10, 1],
          [0, 0],
        ],
        -3,
      ),
    ).toBe(0);
    expect(
      curve(
        [
          [0, 0],
          [10, 1],
        ],
        30,
      ),
    ).toBe(1);
  });

  it('gates with enter and exit delays', () => {
    const g = new Gate(100, 300);
    expect(g.update(false, 0)).toBe(false);
    expect(g.update(true, 50)).toBe(false);
    expect(g.update(true, 160)).toBe(true);
    expect(g.update(false, 200)).toBe(true);
    expect(g.update(false, 520)).toBe(false);
  });
});

describe('layer', () => {
  it('drives a recording backend from a main-thread world and applies master volume', () => {
    const backend = createRecordingBackend();
    const handlers: ((e: EngineEvent, ctx: { tick: number }) => void)[] = [];
    const rows = new Map<string, JsonObject>([['car', { sound: 'engine.car' }]]);
    const world = {
      tick: 1,
      tickRate: 60,
      *query(c: { name: string }) {
        if (c.name === 'audioSource')
          for (const [id, d] of rows) yield [id, d] as [string, JsonObject];
      },
      get: (id: string, c: { name: string }) =>
        c.name === 'transform' && id === 'car'
          ? { pos: [1, 0, 0] }
          : c.name === 'audioSource'
            ? rows.get(id)
            : undefined,
      on(_t: string, h: (e: EngineEvent, ctx: { tick: number }) => void) {
        handlers.push(h);
        return () => {};
      },
    };
    expect(entitySourceFromWorld(world).tickRate).toBe(60);
    const layer = createAudioLayer({
      banks: [{ doc: BANK, base: 'pack:test/' }],
      backend,
      volume: 0.5,
    });
    layer.attachWorld(world);
    layer.update(0, { position: [0, 0, 0] });
    for (const h of handlers)
      h({ type: 'audio.play', payload: { sound: 'ui.click' } }, { tick: 1 });
    layer.update(16);
    expect(backend.log[0]).toEqual({ op: 'bus', bus: 'master', gain: 0.5 });
    const refs = backend.log.filter((c) => c.op === 'start').map((c) => (c as { ref: string }).ref);
    expect(refs).toEqual(['pack:test/engine.mp3', 'pack:test/click.mp3']);
    layer.setMuted(true);
    expect(backend.log.at(-1)).toEqual({ op: 'bus', bus: 'master', gain: 0 });
    layer.dispose();
    expect(backend.active.size).toBe(0);
  });
});
