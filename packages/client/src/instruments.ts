/** Reusable instrument wiring for authored geometry; all axes are local to each gauge frame. */
import type {
  ModelSignalBinding,
  ModelSignalExpression,
  ModelSignalSpec,
} from '@bendyline/molen-schema';

export { compileModelSignalExpressions } from './model-signal-expressions';
export type { ModelSignals, ModelSignalVisual } from './model-signals';
export {
  createModelSignalVisual,
  modelSignalDisplacement,
  readModelSignals,
} from './model-signals';

export interface DialInstrumentOptions {
  node: string;
  source: string;
  /** Measured [reading, needle radians from authored rest] pairs, including nonlinear scales. */
  calibration: [number, number][];
  axis?: 'x' | 'y' | 'z';
  responseSeconds?: number;
  /** Usually 2π for a continuously rotating heading or altimeter needle. */
  period?: number;
  missing?: 'hold' | 'rest';
}

/** The same binding can calibrate tick placement with modelSignalDisplacement(binding, reading). */
export function dialInstrument(options: DialInstrumentOptions): ModelSignalBinding {
  return {
    node: options.node,
    source: options.source,
    property: 'rotation',
    axis: options.axis ?? 'z',
    keys: options.calibration.map(([reading, angle]) => [reading, angle]),
    responseSeconds: options.responseSeconds ?? 0,
    ...(options.period === undefined ? {} : { period: options.period }),
    missing: options.missing ?? 'hold',
  };
}

export interface AltimeterInstrumentOptions {
  /** Caller supplies barometrically indicated altitude in feet, or explicitly labels an approximation. */
  source: string;
  hundreds: string;
  thousands: string;
  tenThousands?: string;
  axis?: 'x' | 'y' | 'z';
  /** +Z facing the viewer uses -1 for clockwise motion. Reverse for a frame facing -Z. */
  direction?: 1 | -1;
  responseSeconds?: number;
}

/** Three independent, continuous needles: one turn per 1,000 / 10,000 / 100,000 feet. */
export function altimeterInstrument(options: AltimeterInstrumentOptions): ModelSignalBinding[] {
  const needles: [string | undefined, number][] = [
    [options.hundreds, 1000],
    [options.thousands, 10000],
    [options.tenThousands, 100000],
  ];
  return needles.flatMap(([node, feet]) =>
    node === undefined
      ? []
      : [
          {
            node,
            source: options.source,
            property: 'rotation' as const,
            axis: options.axis ?? 'z',
            scale: ((options.direction ?? -1) * 2 * Math.PI) / feet,
            period: 2 * Math.PI,
            responseSeconds: options.responseSeconds ?? 0,
          },
        ],
  );
}

export interface AttitudeInstrumentOptions {
  /** A bank frame containing the pitch card, inside the authored face mask. */
  bankNode: string;
  pitchNode: string;
  rollSource?: string;
  pitchSource?: string;
  bankAxis?: 'x' | 'y' | 'z';
  pitchAxis?: 'x' | 'y' | 'z';
  /** Local meters per radian; sign follows the face's orientation. */
  pitchScale: number;
  pitchLimit: number;
  bankDirection?: 1 | -1;
  responseSeconds?: number;
}

/** Moving horizon behind a fixed aircraft symbol. Geometry supplies the circular mask. */
export function attitudeInstrument(options: AttitudeInstrumentOptions): ModelSignalBinding[] {
  return [
    {
      node: options.bankNode,
      source: options.rollSource ?? 'roll',
      property: 'rotation',
      axis: options.bankAxis ?? 'z',
      scale: options.bankDirection ?? -1,
      period: 2 * Math.PI,
      responseSeconds: options.responseSeconds ?? 0,
    },
    {
      node: options.pitchNode,
      source: options.pitchSource ?? 'pitch',
      property: 'position',
      axis: options.pitchAxis ?? 'y',
      scale: options.pitchScale,
      min: -Math.abs(options.pitchLimit),
      max: Math.abs(options.pitchLimit),
      responseSeconds: options.responseSeconds ?? 0,
    },
  ];
}

/** Own an authored lamp/flag node; positive means on, missing readings turn it off. */
export function annunciatorInstrument(node: string, source: string): ModelSignalBinding {
  return { node, source, property: 'visible', scale: 1, missing: 'hide' };
}

export interface NumericInstrumentOptions {
  source: string;
  /** Most-significant to least-significant digit; each has seven node names in a,b,c,d,e,f,g order. */
  digits: [string, string, string, string, string, string, string][];
  /** Prefix for private derived variables, unique when combining multiple readouts. */
  prefix: string;
}

/** Fixed-width unsigned integer display; no DOM, textures or per-frame glyph allocation. */
export function numericInstrument(options: NumericInstrumentOptions): ModelSignalSpec {
  if (!options.prefix || options.digits.length < 1 || options.digits.length > 9)
    throw new Error('Numeric instruments require a prefix and 1–9 digits');
  const derived: Record<string, ModelSignalExpression> = Object.create(null);
  const bindings: ModelSignalBinding[] = [];
  const whole = `${options.prefix}.whole`;
  derived[whole] = { op: 'floor', args: [options.source] };
  const segmentMasks = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f];
  const valid = `${options.prefix}.valid`,
    positive = `${options.prefix}.positive`,
    inRange = `${options.prefix}.inRange`;
  derived[positive] = { op: 'greater', args: [whole, -1] };
  derived[inRange] = { op: 'less', args: [whole, 10 ** options.digits.length] };
  derived[valid] = { op: 'and', args: [positive, inRange] };
  options.digits.forEach((nodes, index) => {
    const quotient = `${options.prefix}.${index}.quotient`,
      integer = `${options.prefix}.${index}.integer`;
    const digit = `${options.prefix}.${index}.digit`,
      display = `${options.prefix}.${index}.display`;
    derived[quotient] = { op: 'divide', args: [whole, 10 ** (options.digits.length - index - 1)] };
    derived[integer] = { op: 'floor', args: [quotient] };
    derived[digit] = { op: 'modulo', args: [integer, 10] };
    // -1 blanks every segment for invalid/out-of-range inputs; no misleading wraparound.
    derived[display] = { op: 'if', args: [valid, digit, -1] };
    nodes.forEach((node, segment) => {
      bindings.push({
        node,
        source: display,
        property: 'visible',
        missing: 'hide',
        keys: [
          [-1, 0],
          ...segmentMasks.map((mask, number): [number, number] => [
            number,
            Number((mask & (1 << segment)) !== 0),
          ]),
        ],
      });
    });
  });
  return { derived, bindings };
}
