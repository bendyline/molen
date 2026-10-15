import type {
  ModelSignalBinding,
  ModelSignalSource,
  ModelSignalSpec,
} from '@bendyline/molen-schema';
import type { Object3D } from 'three';

export type ModelSignals = Readonly<Record<string, number | undefined>>;
export interface ModelSignalVisual {
  readonly missingNodes: readonly string[];
  update(signals: ModelSignals): void;
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
      return { binding, node, rest: node[binding.property][binding.axis] };
    }),
  );
  return {
    missingNodes,
    update(signals) {
      for (const { binding, node, rest } of bindings) {
        const signal = signals[binding.source];
        if (signal === undefined || !Number.isFinite(signal)) continue;
        const value = modelSignalDisplacement(binding, signal);
        if (!Number.isFinite(value)) continue;
        node[binding.property][binding.axis] =
          rest + Math.max(binding.min ?? -Infinity, Math.min(binding.max ?? Infinity, value));
      }
    },
    reset() {
      for (const { binding, node, rest } of bindings) node[binding.property][binding.axis] = rest;
    },
  };
}
