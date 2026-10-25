import { type ModelSignalExpression, modelSignalDerivedSchema } from '@bendyline/molen-schema';
import type { ModelSignals } from './model-signals';

function evaluate(expression: ModelSignalExpression, values: ModelSignals): number | undefined {
  const args = expression.args.map((arg) =>
    typeof arg === 'number' ? arg : Object.hasOwn(values, arg) ? values[arg] : undefined,
  );
  const [a, b, c] = args;
  // Branches may reference unavailable systems. Only the selected branch must have a value.
  if (expression.op === 'if') return a === undefined ? undefined : a !== 0 ? b : c;
  if (expression.op === 'coalesce') return args.find((value) => value !== undefined);
  if (args.some((value) => value === undefined)) return undefined;
  const numbers = args as number[];
  const x = a as number,
    y = b as number,
    z = c as number;
  switch (expression.op) {
    case 'add':
      return numbers.reduce((sum, value) => sum + value, 0);
    case 'subtract':
      return x - y;
    case 'multiply':
      return numbers.reduce((product, value) => product * value, 1);
    case 'divide':
      return y === 0 ? undefined : x / y;
    case 'min':
      return Math.min(...numbers);
    case 'max':
      return Math.max(...numbers);
    case 'clamp':
      return y > z ? undefined : Math.max(y, Math.min(z, x));
    case 'abs':
      return Math.abs(x);
    case 'sqrt':
      return x < 0 ? undefined : Math.sqrt(x);
    case 'floor':
      return Math.floor(x);
    case 'modulo':
      return y <= 0 ? undefined : ((x % y) + y) % y;
    case 'sin':
      return Math.sin(x);
    case 'cos':
      return Math.cos(x);
    case 'atan2':
      return Math.atan2(x, y);
    case 'less':
      return Number(x < y);
    case 'greater':
      return Number(x > y);
    case 'equal':
      return Number(x === y);
    case 'and':
      return Number(numbers.every((value) => value !== 0));
    case 'or':
      return Number(numbers.some((value) => value !== 0));
    case 'not':
      return Number(x === 0);
  }
}

/** Compile a bounded dependency graph once. Evaluation is read-only and never executes code. */
export function compileModelSignalExpressions(
  definitions: Record<string, ModelSignalExpression> | undefined,
): (sources: ModelSignals) => ModelSignals {
  const derived = modelSignalDerivedSchema.parse(definitions ?? {});
  const order: [string, ModelSignalExpression][] = [],
    visited = new Set<string>();
  const visit = (name: string): void => {
    if (visited.has(name)) return;
    visited.add(name);
    const expression = derived[name];
    if (!expression) return;
    for (const arg of expression.args)
      if (typeof arg === 'string' && Object.hasOwn(derived, arg)) visit(arg);
    order.push([name, expression]);
  };
  for (const name of Object.keys(derived)) visit(name);
  return (sources) => {
    const values: Record<string, number | undefined> = Object.create(null);
    for (const [name, value] of Object.entries(sources))
      if (typeof value === 'number' && Number.isFinite(value)) values[name] = value;
    for (const [name, expression] of order) {
      const value = evaluate(expression, values);
      values[name] = value !== undefined && Number.isFinite(value) ? value : undefined;
    }
    return values;
  };
}
