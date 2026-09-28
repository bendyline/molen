import type { AudioBackend, AudioBackendStats, VoiceCommand } from './types';

type StartCommand = Extract<VoiceCommand, { op: 'start' }>;

export interface RecordingBackend extends AudioBackend {
  /** Every command applied, in order. */
  readonly log: VoiceCommand[];
  /** Looping voices currently started and not stopped. */
  readonly active: ReadonlyMap<string, StartCommand>;
  clear(): void;
}

/** A silent backend that records commands: tests, headless planning, and hosts without audio. */
export function createRecordingBackend(opts: { unlocked?: boolean } = {}): RecordingBackend {
  const log: VoiceCommand[] = [];
  const active = new Map<string, StartCommand>();
  let unlocked = opts.unlocked ?? true;
  return {
    log,
    active,
    get unlocked() {
      return unlocked;
    },
    async unlock() {
      unlocked = true;
    },
    apply(commands) {
      for (const cmd of commands) {
        log.push(cmd);
        if (cmd.op === 'start' && cmd.loop) active.set(cmd.voice, cmd);
        else if (cmd.op === 'stop') active.delete(cmd.voice);
        else if (cmd.op === 'set') {
          const v = active.get(cmd.voice);
          if (v) {
            active.set(cmd.voice, {
              ...v,
              ...(cmd.gain !== undefined ? { gain: cmd.gain } : {}),
              ...(cmd.pitch !== undefined ? { pitch: cmd.pitch } : {}),
              ...(cmd.position && v.spatial
                ? { spatial: { ...v.spatial, position: cmd.position } }
                : {}),
            });
          }
        }
      }
    },
    stats(): AudioBackendStats {
      return { voices: active.size, decoded: 0, pending: 0, state: 'headless' };
    },
    clear() {
      log.length = 0;
      active.clear();
    },
    dispose() {
      active.clear();
    },
  };
}
