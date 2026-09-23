import type {
  Assertion,
  AssertionDoc,
  EngineEvent,
  EventAssertion,
  JsonValue,
  SelectAssertion,
} from '@bendyline/molen-schema';
import { select } from './select';
import type { World } from './world';

export interface AssertionResult {
  pass: boolean;
  /** Echo of the assertion's selector or event for reporting. */
  target: string;
  op: string;
  message: string;
}

export interface AssertContext {
  /** All events emitted over the run, with the tick they occurred on. */
  events: Array<{ tick: number; event: EngineEvent }>;
}

/** Evaluate an assertion document against the final world state and recorded events. */
export function runAssertions(
  world: World,
  doc: AssertionDoc,
  ctx: AssertContext = { events: [] },
): AssertionResult[] {
  return doc.assertions.map((a) => evalAssertion(world, a, ctx));
}

function evalAssertion(world: World, a: Assertion, ctx: AssertContext): AssertionResult {
  if ('event' in a) return evalEvent(a, ctx);
  return evalSelect(world, a);
}

function evalSelect(world: World, a: SelectAssertion): AssertionResult {
  const matches = select(world, a.select);
  const target = a.select;

  if (a.op === 'count') {
    const pass = matches.length === a.value;
    return result(
      pass,
      target,
      a.op,
      `count ${matches.length} ${pass ? '==' : '!='} ${String(a.value)}`,
    );
  }
  if (a.op === 'exists') {
    const pass = matches.length > 0;
    return result(pass, target, a.op, pass ? `matched ${matches.length}` : 'no matches');
  }

  // Value comparisons operate on each match's resolved value-path value.
  const values = matches.map((m) => m.value);
  if (values.length === 0) {
    return result(false, target, a.op, 'no entities matched the selector');
  }

  const isAny = a.op.startsWith('any_');
  const baseOp = a.op.replace(/^(all_|any_)/, '');

  const checks = values.map((v) => compare(baseOp, v, a.value, a.tol));
  // any_ passes if at least one matches; all_ and bare ops require every match to pass.
  const pass = isAny ? checks.some(Boolean) : checks.every(Boolean);

  const sample = values.length === 1 ? JSON.stringify(values[0]) : `${values.length} values`;
  return result(
    pass,
    target,
    a.op,
    `${a.op} ${String(a.value)} over ${sample}: ${pass ? 'pass' : 'fail'}`,
  );
}

function compare(
  op: string,
  actual: JsonValue | undefined,
  expected: JsonValue | undefined,
  tol?: number,
): boolean {
  if (op === 'eq') return JSON.stringify(actual) === JSON.stringify(expected);
  if (op === 'approx') {
    if (typeof actual !== 'number' || typeof expected !== 'number') return false;
    return Math.abs(actual - expected) <= (tol ?? 1e-6);
  }
  if (typeof actual !== 'number' || typeof expected !== 'number') return false;
  switch (op) {
    case 'gt':
      return actual > expected;
    case 'gte':
      return actual >= expected;
    case 'lt':
      return actual < expected;
    case 'lte':
      return actual <= expected;
    default:
      return false;
  }
}

function evalEvent(a: EventAssertion, ctx: AssertContext): AssertionResult {
  const occurrences = ctx.events.filter((e) => e.event.type === a.event);
  const count = occurrences.length;
  switch (a.op) {
    case 'occurred':
      return result(count > 0, a.event, a.op, `occurred ${count} time(s)`);
    case 'never':
      return result(
        count === 0,
        a.event,
        a.op,
        count === 0 ? 'never occurred' : `occurred ${count} time(s)`,
      );
    case 'count': {
      const pass = count === a.value;
      return result(pass, a.event, a.op, `count ${count} ${pass ? '==' : '!='} ${String(a.value)}`);
    }
    case 'at_tick': {
      const pass = occurrences.some((e) => e.tick === a.value);
      return result(
        pass,
        a.event,
        a.op,
        pass ? `occurred at tick ${String(a.value)}` : `not at tick ${String(a.value)}`,
      );
    }
    default:
      return result(false, a.event, a.op, `unknown event op "${a.op}"`);
  }
}

function result(pass: boolean, target: string, op: string, message: string): AssertionResult {
  return { pass, target, op, message };
}

/** Format assertion results as an agent-facing block. */
export function formatAssertionResults(results: AssertionResult[]): string {
  const failed = results.filter((r) => !r.pass);
  const lines: string[] = [];
  lines.push(
    `${failed.length === 0 ? '✓' : '✖'} ${results.length - failed.length}/${results.length} assertions passed`,
  );
  for (const r of results) {
    lines.push(`  ${r.pass ? '✓' : '✗'} [${r.op}] ${r.target} — ${r.message}`);
  }
  return lines.join('\n');
}
