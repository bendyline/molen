import type {
  ModelSignalBinding,
  ModelSignalSource,
  ModelSignalSpec,
} from '@bendyline/molen-schema';
import type { Object3D } from 'three';
import { compileModelSignalExpressions } from './model-signal-expressions';

export type ModelSignals = Readonly<Record<string, number | undefined>>;
export interface ModelSignalVisual {
  readonly missingNodes: readonly string[];
  /** Unavailable binding sources on the most recent update (including invalid formulas). */
  readonly missingSignals: readonly string[];
  /** Absolute simulation time enables responseSeconds; omission applies readings immediately. */
  update(signals: ModelSignals, timeSeconds?: number): void;
  /** Restore authored transforms before removing or replacing bindings. */
  reset(): void;
}

/** Read data only: no expressions, evaluation, prototype traversal, or simulation writes. */
export function readModelSignals(
  sources: Readonly<Record<string, ModelSignalSource>> | undefined,
  readComponent: (name: string) => unknown,
): ModelSignals {
  const signals: Record<string, number | undefined> = Object.create(null);
  for (const [name, source] of Object.entries(sources ?? {})) {
    // An explicitly bound but unavailable sensor must override a host convenience reading.
    signals[name] = undefined;
    // An explicitly bound but unavailable sensor must override a host convenience reading.
    signals[name] = undefined;
    let value = readComponent(source.component);
    for (const part of source.path) {
      if (value === null || typeof value !== 'object' || !Object.hasOwn(value, part)) {
        value = undefined;
        break;
      }
      value = (value as Record<string | number, unknown>)[part];
    }
    if (typeof value === 'boolean') signals[name] = Number(value);
    else if (typeof value === 'number' && Number.isFinite(value)) signals[name] = value;
  }
  return signals;
}

/**
 * A binding's displacement for a signal, before its limits: linear in the signal, or along its
 * keyframed curve, which holds its end values outside the keys. Exported for tests.
 */
export function modelSignalDisplacement(binding: ModelSignalBinding, signal: number): number {
  const keys = binding.keys;
  if (keys === undefined) return signal * (binding.scale ?? 1) + (binding.offset ?? 0);
  const first = keys[0];
  const last = keys[keys.length - 1];
  if (first === undefined || last === undefined) return 0;
  if (signal <= first[0]) return first[1];
  if (signal >= last[0]) return last[1];
  let index = 1;
  while (index < keys.length - 1 && signal > (keys[index]?.[0] ?? Infinity)) index++;
  const [x0, y0] = keys[index - 1] ?? first;
  const [x1, y1] = keys[index] ?? last;
  let f = (signal - x0) / (x1 - x0);
  if (binding.ease === 'smooth') f = f * f * (3 - 2 * f);
  return y0 + (y1 - y0) * f;
}

/** Model-agnostic; moves existing geometry without creating a cockpit or changing physics. */
export function createModelSignalVisual(model: Object3D, spec: ModelSignalSpec): ModelSignalVisual {
  const derive = compileModelSignalExpressions(spec.derived);
  let missingSignals: string[] = [];
  const nodes = new Map<string, Object3D[]>();
  model.traverse((node) => {
    const matches = nodes.get(node.name) ?? [];
    matches.push(node);
    nodes.set(node.name, matches);
  });
  const missingNodes = [...new Set(spec.bindings.map((b) => b.node))].filter(
    (name) => !nodes.has(name),
  );
  const bindings = spec.bindings.flatMap((binding) =>
    (nodes.get(binding.node) ?? []).map((node) => {
      node.matrixAutoUpdate = true;
      const rest =
        binding.property === 'visible'
          ? Number(node.visible)
          : node[binding.property][binding.axis ?? 'z'];
      return {
        binding,
        node,
        rest,
        current: undefined as number | undefined,
        time: undefined as number | undefined,
      };
    }),
  );
  return {
    missingNodes,
    get missingSignals() {
      return missingSignals;
    },
    update(sources, timeSeconds) {
      const signals = derive(sources);
      const missing = new Set<string>();
      const time =
        timeSeconds !== undefined && Number.isFinite(timeSeconds) ? timeSeconds : undefined;
      for (const state of bindings) {
        const { binding, node, rest } = state;
        const write = (value: number): void => {
          if (binding.property === 'visible') node.visible = value > 0;
          else node[binding.property][binding.axis ?? 'z'] = value;
        };
        const signal = signals[binding.source];
        const raw = signal === undefined ? NaN : modelSignalDisplacement(binding, signal);
        if (!Number.isFinite(raw)) {
          missing.add(binding.source);
          state.time = undefined;
          if (binding.missing === 'rest' || binding.missing === 'hide') {
            write(binding.missing === 'hide' ? 0 : rest);
            state.current = undefined;
          } else {
            write(
              state.current === undefined
                ? rest
                : binding.property === 'visible'
                  ? state.current
                  : rest + state.current,
            );
          }
          continue;
        }
        let value = Math.max(binding.min ?? -Infinity, Math.min(binding.max ?? Infinity, raw));
        const period = binding.period;
        const wrap = (v: number): number =>
          period === undefined ? v : ((v % period) + period) % period;
        value = wrap(value);
        if (
          binding.responseSeconds &&
          time !== undefined &&
          state.time !== undefined &&
          time >= state.time &&
          state.current !== undefined
        ) {
          let delta = value - state.current;
          if (period !== undefined)
            delta = ((((delta + period / 2) % period) + period) % period) - period / 2;
          value = wrap(
            state.current + delta * -Math.expm1(-(time - state.time) / binding.responseSeconds),
          );
        }
        state.current = value;
        state.time = time;
        write(binding.property === 'visible' ? value : rest + value);
      }
      missingSignals = [...missing];
    },
    reset() {
      for (const state of bindings) {
        const { binding, node, rest } = state;
        if (binding.property === 'visible') node.visible = rest > 0;
        else node[binding.property][binding.axis ?? 'z'] = rest;
        state.current = state.time = undefined;
      }
      missingSignals = [];
    },
  };
}
