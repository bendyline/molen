import { z } from 'zod';
import type { JsonObject } from './json';

/** A number is a literal; a string names a source or another derived signal. */
export type ModelSignalOperand = number | string;
export type ModelSignalOperator =
  | 'add'
  | 'subtract'
  | 'multiply'
  | 'divide'
  | 'min'
  | 'max'
  | 'clamp'
  | 'abs'
  | 'sqrt'
  | 'floor'
  | 'modulo'
  | 'sin'
  | 'cos'
  | 'atan2'
  | 'less'
  | 'greater'
  | 'equal'
  | 'and'
  | 'or'
  | 'not'
  | 'if'
  | 'coalesce';

/** Data-only expressions; name intermediate results instead of nesting executable strings. */
export interface ModelSignalExpression extends JsonObject {
  op: ModelSignalOperator;
  args: ModelSignalOperand[];
}

const arity: Record<ModelSignalOperator, readonly [number, number]> = {
  add: [2, 16],
  subtract: [2, 2],
  multiply: [2, 16],
  divide: [2, 2],
  min: [2, 16],
  max: [2, 16],
  clamp: [3, 3],
  abs: [1, 1],
  sqrt: [1, 1],
  floor: [1, 1],
  modulo: [2, 2],
  sin: [1, 1],
  cos: [1, 1],
  atan2: [2, 2],
  less: [2, 2],
  greater: [2, 2],
  equal: [2, 2],
  and: [2, 16],
  or: [2, 16],
  not: [1, 1],
  if: [3, 3],
  coalesce: [2, 16],
};

export const modelSignalExpressionSchema: z.ZodType<ModelSignalExpression> = z
  .strictObject({
    op: z
      .enum([
        'add',
        'subtract',
        'multiply',
        'divide',
        'min',
        'max',
        'clamp',
        'abs',
        'sqrt',
        'floor',
        'modulo',
        'sin',
        'cos',
        'atan2',
        'less',
        'greater',
        'equal',
        'and',
        'or',
        'not',
        'if',
        'coalesce',
      ])
      .describe('Numeric operation; comparisons/logic return 0 or 1. Angles are radians.'),
    args: z
      .array(z.union([z.number().finite(), z.string().min(1)]))
      .min(1)
      .max(16)
      .describe('Finite numeric literals or names of signals, in operand order.'),
  })
  .superRefine((expression, ctx) => {
    const [min, max] = arity[expression.op];
    if (expression.args.length < min || expression.args.length > max)
      ctx.addIssue({
        code: 'custom',
        path: ['args'],
        message: `${expression.op} requires ${min === max ? min : `${min}–${max}`} operands`,
      });
  });

/** Validated once, before compiling a visual. Bounds also keep dependency traversal small. */
export const modelSignalDerivedSchema: z.ZodType<Record<string, ModelSignalExpression>> = z
  .record(z.string().min(1), modelSignalExpressionSchema)
  .superRefine((derived, ctx) => {
    if (Object.keys(derived).length > 256) {
      ctx.addIssue({ code: 'custom', message: 'At most 256 derived signals per model' });
      return;
    }
    const active = new Set<string>(),
      done = new Set<string>();
    const visit = (name: string): void => {
      if (active.has(name)) {
        ctx.addIssue({ code: 'custom', path: [name], message: 'Cyclic derived signal dependency' });
        return;
      }
      if (done.has(name)) return;
      active.add(name);
      for (const arg of derived[name]?.args ?? [])
        if (typeof arg === 'string' && Object.hasOwn(derived, arg)) visit(arg);
      active.delete(name);
      done.add(name);
    };
    for (const name of Object.keys(derived)) visit(name);
  })
  .describe('Up to 256 named data-only formulas, evaluated in dependency order. No cycles.');

/** Shared by direct visual specs, interiors, and the automatic ECS component. */
export function checkModelSignalNames(
  value: {
    sources?: Record<string, unknown>;
    derived?: Record<string, ModelSignalExpression>;
    bindings: { source: string }[];
  },
  ctx: z.RefinementCtx,
  requireSources = false,
): void {
  const sources = value.sources ?? {},
    derived = value.derived ?? {};
  for (const [name, expression] of Object.entries(derived)) {
    if (Object.hasOwn(sources, name))
      ctx.addIssue({
        code: 'custom',
        path: ['derived', name],
        message: 'Derived signal duplicates a component source',
      });
    if (requireSources)
      expression.args.forEach((arg, index) => {
        if (typeof arg === 'string' && !Object.hasOwn(sources, arg) && !Object.hasOwn(derived, arg))
          ctx.addIssue({
            code: 'custom',
            path: ['derived', name, 'args', index],
            message: `Unknown signal: ${arg}`,
          });
      });
  }
  if (requireSources)
    value.bindings.forEach((binding, index) => {
      if (!Object.hasOwn(sources, binding.source) && !Object.hasOwn(derived, binding.source))
        ctx.addIssue({
          code: 'custom',
          path: ['bindings', index, 'source'],
          message: 'Unknown signal source',
        });
    });
}
