import { z } from 'zod';
import type { JsonObject, JsonValue } from './json';

// Choreography and rules of play as data: the vocabulary of `cues`, `rules`, `path`, `mover`,
// `trigger`, `controller` and `vars` (registered as core components in components.ts) and of
// the scene `hud` block (formats.ts). Every kernel-owned field is integer-tick state kept in
// the component, so it reaches the state hash, keyframes and replays like `timer` and `tween`.
//
// Wire schemas stay in the JSON-Schema-expressible subset (no refinements or transforms).
// Component data is validated by Zod after parsing (componentIssues), so fixed-length values
// are tuples here, as in glass.ts.

const num = z.number();
const vec3 = z.tuple([num, num, num]);
const vec2 = z.tuple([num, num]);
const jsonValue = z.json();

export type PlayVec3 = [number, number, number];

// --- select conditions (shared with molen/assert@1) ---

/** Comparison ops for a select condition or assertion. */
export const SELECT_OPS: readonly [
  'eq',
  'approx',
  'gt',
  'gte',
  'lt',
  'lte',
  'count',
  'count_lt',
  'count_lte',
  'count_gt',
  'count_gte',
  'exists',
  'all_eq',
  'all_approx',
  'all_gt',
  'all_gte',
  'all_lt',
  'all_lte',
  'any_eq',
  'any_approx',
  'any_gt',
  'any_gte',
  'any_lt',
  'any_lte',
] = [
  'eq',
  'approx',
  'gt',
  'gte',
  'lt',
  'lte',
  'count',
  'count_lt',
  'count_lte',
  'count_gt',
  'count_gte',
  'exists',
  'all_eq',
  'all_approx',
  'all_gt',
  'all_gte',
  'all_lt',
  'all_lte',
  'any_eq',
  'any_approx',
  'any_gt',
  'any_gte',
  'any_lt',
  'any_lte',
];

/** A select condition: the same shape as a `molen/assert@1` select assertion. */
export interface PlayCondition extends JsonObject {
  /** Selector DSL: "#id", "tag:x", "has:comp", value paths like ".vars.score". */
  select: string;
  op: (typeof SELECT_OPS)[number];
  value?: JsonValue;
  tol?: number;
}

export const selectConditionSchema: z.ZodType<PlayCondition> = z.strictObject({
  select: z
    .string()
    .min(1)
    .describe(
      "Entity selector plus optional value path: '#id', 'tag:name', 'has:component', e.g. '#player.health.hp'. In rules, '$self', '$a', '$b' and '$entity' name bound entities.",
    ),
  op: z
    .enum(SELECT_OPS)
    .describe(
      'Comparison: eq/approx/gt/gte/lt/lte on the single match, count/exists on the match set (count_lt/count_lte/count_gt/count_gte compare the number of matches), all_*/any_* over every match.',
    ),
  value: jsonValue
    .describe('Expected value (for count ops: the number of matches to compare with).')
    .optional(),
  tol: num.positive().describe('Absolute tolerance for approx ops (default 1e-6).').optional(),
});

// --- actions (shared by cues and rules) ---

const target = z
  .string()
  .min(1)
  .describe("Selector for the entities acted on (default '$self'): '#id', 'tag:x', '$a', ...");

export interface TweenStart extends JsonObject {
  target?: string;
  id?: string;
  component: string;
  path: string;
  from?: number | number[];
  to: number | number[];
  ticks: number;
  delay?: number;
  easing?: 'linear' | 'quadIn' | 'quadOut' | 'quadInOut' | 'cubicIn' | 'cubicOut' | 'cubicInOut';
  loop?: 'none' | 'loop' | 'pingpong';
  emitOnComplete?: string;
}

export interface PathStart extends JsonObject {
  target?: string;
  id?: string;
  points: PlayVec3[];
  speed?: number;
  ticks?: number;
  easing?: 'linear' | 'smooth';
  delay?: number;
  loop?: 'none' | 'loop' | 'pingpong';
  emitOnComplete?: string;
}

export type PlayAction =
  | { set: { target?: string; component: string; path?: string; value: JsonValue } }
  | { add: { target?: string; component: string; path: string; value?: number; from?: string } }
  | {
      spawn: {
        prefab: string;
        at?: PlayVec3;
        pick?: PlayVec3[];
        awayFrom?: string;
        minDistance?: number;
      };
    }
  | { destroy: string }
  | { emit: { event: string; payload?: JsonValue } }
  | { tween: TweenStart }
  | { path: PathStart }
  | {
      figure: {
        target?: string;
        mode?: 'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'sit' | 'custom' | null;
        lookAt?: string | PlayVec3 | null;
      };
    }
  | { place: { target?: string; at: PlayVec3 } }
  | { timer: { target?: string; ticks: number; event: string; payload?: JsonValue } }
  | { sound: { sound: string; at?: string; gain?: number } };

const easingEnum = z.enum([
  'linear',
  'quadIn',
  'quadOut',
  'quadInOut',
  'cubicIn',
  'cubicOut',
  'cubicInOut',
]);
const loopEnum = z.enum(['none', 'loop', 'pingpong']);

const pathFields = {
  id: z.string().min(1).describe('Optional path id, echoed in path-complete.').optional(),
  points: z
    .array(vec3)
    .min(1)
    .describe(
      'Waypoints [x, y, z] in meters. The path runs from where the entity stands when it starts, through each point in order.',
    ),
  speed: num
    .positive()
    .describe('Constant travel speed in meters per second (default 1 when ticks is absent).')
    .optional(),
  ticks: z
    .int()
    .positive()
    .describe('Ticks to cover the whole path; takes precedence over speed.')
    .optional(),
  easing: z
    .enum(['linear', 'smooth'])
    .describe('With ticks: linear, or smooth (ease in and out over the whole path).')
    .optional(),
  delay: z.int().nonnegative().describe('Ticks to wait before starting (default 0).').optional(),
  loop: loopEnum
    .describe(
      'After the last point: none (remove the path, default), loop (return to the start and repeat), or pingpong (run back and forth).',
    )
    .optional(),
  emitOnComplete: z
    .string()
    .min(1)
    .describe('World event emitted (payload { entity }) each time the path completes.')
    .optional(),
};

const tweenStartSchema = z.strictObject({
  target: target.optional(),
  id: z.string().min(1).describe('Optional tween id.').optional(),
  component: z.string().min(1).describe('Component whose value is animated.'),
  path: z.string().min(1).describe("Value path within the component, e.g. 'pos[1]'."),
  from: z
    .union([num, z.array(num)])
    .describe('Start value; defaults to the value when the tween starts.')
    .optional(),
  to: z.union([num, z.array(num)]).describe('End value.'),
  ticks: z.int().positive().describe('Duration in ticks.'),
  delay: z.int().nonnegative().describe('Ticks to wait before starting.').optional(),
  easing: easingEnum.describe('Easing curve (default linear).').optional(),
  loop: loopEnum.describe('After completing: none, loop, or pingpong.').optional(),
  emitOnComplete: z.string().describe('World event emitted when the tween completes.').optional(),
});

/** The action vocabulary shared by `cues` and `rules`. Each action has exactly one key. */
export const playActionSchema: z.ZodType<PlayAction> = z.union([
  z.strictObject({
    set: z
      .strictObject({
        target: target.optional(),
        component: z.string().min(1).describe('Component to write.'),
        path: z
          .string()
          .min(1)
          .describe(
            "Value path within the component, e.g. 'status' or 'pos[1]'; omit to replace it.",
          )
          .optional(),
        value: jsonValue.describe('Value to write.'),
      })
      .describe('Write a value into a component (creating the component if needed).'),
  }),
  z.strictObject({
    add: z
      .strictObject({
        target: target.optional(),
        component: z.string().min(1).describe('Component holding the number.'),
        path: z.string().min(1).describe("Value path of the number, e.g. 'score'."),
        value: num
          .describe('Amount to add (negative to subtract); default 1, and the fallback for from.')
          .optional(),
        from: z
          .string()
          .min(1)
          .describe(
            "Selector with a value path whose number is added instead, e.g. '$b.vars.points'.",
          )
          .optional(),
      })
      .describe('Add to a number in a component (a missing number counts as 0).'),
  }),
  z.strictObject({
    spawn: z
      .strictObject({
        prefab: z.string().min(1).describe('Scene prefab to instantiate.'),
        at: vec3.describe('Position [x, y, z] in meters.').optional(),
        pick: z
          .array(vec3)
          .min(1)
          .describe('Candidate positions; one is chosen with the world RNG.')
          .optional(),
        awayFrom: z
          .string()
          .min(1)
          .describe('Selector: only pick positions at least minDistance from its first match.')
          .optional(),
        minDistance: num
          .nonnegative()
          .describe('Meters from awayFrom (default 0); falls back to any candidate.')
          .optional(),
      })
      .describe('Create an entity from a scene prefab.'),
  }),
  z.strictObject({ destroy: target.describe('Selector for the entities to destroy.') }),
  z.strictObject({
    emit: z
      .strictObject({
        event: z.string().min(1).describe('World event type.'),
        payload: jsonValue.describe('Event payload (default {}).').optional(),
      })
      .describe('Emit a world event.'),
  }),
  z.strictObject({ tween: tweenStartSchema.describe('Start a tween on each target.') }),
  z.strictObject({
    path: z
      .strictObject({ target: target.optional(), ...pathFields })
      .describe("Start (or replace) each target's path."),
  }),
  z.strictObject({
    figure: z
      .strictObject({
        target: target.optional(),
        mode: z
          .enum(['idle', 'walk', 'run', 'jump', 'fall', 'sit', 'custom'])
          .nullable()
          .describe('Force a figure mode, or null to derive it from motion again.')
          .optional(),
        lookAt: z
          .union([z.string().min(1), vec3])
          .nullable()
          .describe('Look at an entity (selector, first match) or a point; null to stop looking.')
          .optional(),
      })
      .describe("Set a figure's mode or look-at (figureIntent)."),
  }),
  z.strictObject({
    place: z
      .strictObject({
        target: target.optional(),
        at: vec3.describe('Position [x, y, z] in meters.'),
      })
      .describe('Teleport each target and stop its body.'),
  }),
  z.strictObject({
    timer: z
      .strictObject({
        target: target.optional(),
        ticks: z.int().positive().describe('Ticks until the event.'),
        event: z.string().min(1).describe('World event emitted when the timer fires.'),
        payload: jsonValue.describe('Optional event payload.').optional(),
      })
      .describe('Schedule a timer event on the first target.'),
  }),
  z.strictObject({
    sound: z
      .strictObject({
        sound: z.string().min(1).describe('Sound-bank id.'),
        at: z
          .string()
          .min(1)
          .describe('Selector: play at its first match (positional).')
          .optional(),
        gain: num.nonnegative().describe('Gain multiplier (default 1).').optional(),
      })
      .describe('Play a sound (emits audio.play).'),
  }),
]);

// --- triggers ---

export type PlayTrigger =
  | { event: string; from?: string }
  | { touch: [string, string] }
  | { command: string }
  | { every: number; offset?: number }
  | { tick: number }
  | { becomes: PlayCondition };

export const playTriggerSchema: z.ZodType<PlayTrigger> = z.union([
  z.strictObject({
    event: z.string().min(1).describe('World event type.'),
    from: z
      .string()
      .min(1)
      .describe('Selector the event payload entity must match (binds $entity).')
      .optional(),
  }),
  z.strictObject({
    touch: z
      .tuple([z.string().min(1), z.string().min(1)])
      .describe(
        'Two selectors; fires while a trigger zone of a match of the first overlaps one of the second (either order). Binds $a and $b.',
      ),
  }),
  z.strictObject({
    command: z.string().min(1).describe('Declared command type (binds $payload).'),
  }),
  z.strictObject({
    every: z.int().positive().describe('Fire every this many ticks.'),
    offset: z.int().nonnegative().describe('Tick of the first firing (default every).').optional(),
  }),
  z.strictObject({ tick: z.int().nonnegative().describe('Fire once, at this tick.') }),
  z.strictObject({
    becomes: selectConditionSchema.describe('Fire when this condition turns true.'),
  }),
]);

// --- components ---

export interface RuleEntry extends JsonObject {
  id?: string;
  when: PlayTrigger;
  if?: PlayCondition[];
  do: PlayAction[];
  once?: boolean;
  /** Kernel-owned: a `once` rule has fired. */
  fired?: boolean;
  /** Kernel-owned: the last value of a `becomes` condition. */
  was?: boolean;
  /** Kernel-owned: the error code that disabled this rule. */
  disabled?: string;
}
export interface RulesData extends JsonObject {
  rules: RuleEntry[];
}

export const rulesSchema: z.ZodType<RulesData> = z.strictObject({
  rules: z
    .array(
      z.strictObject({
        id: z.string().min(1).describe('Optional rule id, named in rule-error.').optional(),
        when: playTriggerSchema.describe('What fires the rule (exactly one trigger).'),
        if: z
          .array(selectConditionSchema)
          .describe('Conditions that must all hold when the trigger fires.')
          .optional(),
        do: z.array(playActionSchema).min(1).describe('Actions run in order.'),
        once: z.boolean().describe('Fire at most once (default false).').optional(),
        fired: z.boolean().describe('Kernel-owned: a once rule has fired.').optional(),
        was: z.boolean().describe('Kernel-owned: last value of a becomes condition.').optional(),
        disabled: z
          .string()
          .describe('Kernel-owned: error code that disabled this rule.')
          .optional(),
      }),
    )
    .describe('Rules checked in order, in the late phase after every other system.'),
});

export interface CueEntry extends JsonObject {
  id?: string;
  tick: number;
  do: PlayAction[];
}
export interface CuesData extends JsonObject {
  cues: CueEntry[];
  loop?: number;
}

export const cuesSchema: z.ZodType<CuesData> = z.strictObject({
  cues: z
    .array(
      z.strictObject({
        id: z.string().min(1).describe('Optional cue id, named in rule-error.').optional(),
        tick: z.int().nonnegative().describe('Tick at which the actions run.'),
        do: z.array(playActionSchema).min(1).describe('Actions run in order.'),
      }),
    )
    .describe('Timed actions, run in the update phase before tweens and paths.'),
  loop: z
    .int()
    .positive()
    .describe('Repeat every this many ticks: cue ticks are taken modulo it.')
    .optional(),
});

export interface PathData extends JsonObject {
  id?: string;
  points: PlayVec3[];
  speed?: number;
  ticks?: number;
  easing?: 'linear' | 'smooth';
  delay?: number;
  loop?: 'none' | 'loop' | 'pingpong';
  emitOnComplete?: string;
  /** Kernel-owned: where the path started. */
  origin?: PlayVec3;
  /** Kernel-owned: ticks since the current pass started. */
  elapsed?: number;
  /** Kernel-owned: a pingpong path is running back. */
  back?: boolean;
}

export const pathSchema: z.ZodType<PathData> = z.strictObject({
  ...pathFields,
  origin: vec3.describe('Kernel-owned: where the path started.').optional(),
  elapsed: z.int().nonnegative().describe('Kernel-owned: ticks into the current pass.').optional(),
  back: z.boolean().describe('Kernel-owned: a pingpong path is running back.').optional(),
});

export interface MoverData extends JsonObject {
  mode: 'chase' | 'flee' | 'wander';
  target?: string;
  speed: number;
  turnTicks?: number;
  range?: number;
  /** Kernel-owned: current wander heading [x, z]. */
  heading?: [number, number];
  /** Kernel-owned: ticks until the next wander turn. */
  turnIn?: number;
}

export const moverSchema: z.ZodType<MoverData> = z.strictObject({
  mode: z
    .enum(['chase', 'flee', 'wander'])
    .describe('chase (toward target), flee (away from target), or wander (random headings).'),
  target: z
    .string()
    .min(1)
    .describe('Selector for chase/flee (first match), e.g. #player.')
    .optional(),
  speed: num.nonnegative().describe('Speed in meters per second.'),
  turnTicks: z
    .int()
    .positive()
    .describe('Wander: ticks between new headings (default 60).')
    .optional(),
  range: num
    .positive()
    .describe('Chase/flee only while the target is within this many meters (default unlimited).')
    .optional(),
  heading: vec2.describe('Kernel-owned: current wander heading [x, z].').optional(),
  turnIn: z.int().nonnegative().describe('Kernel-owned: ticks until the next turn.').optional(),
});

export interface TriggerData extends JsonObject {
  shape?: 'circle' | 'box';
  radius?: number;
  halfExtents?: [number, number];
  plane?: 'xz' | 'xy';
  layer?: number;
  mask?: number;
}

export const triggerSchema: z.ZodType<TriggerData> = z.strictObject({
  shape: z.enum(['circle', 'box']).describe('Zone shape (default circle).').optional(),
  radius: num.positive().describe('Circle radius in meters (default 0.5).').optional(),
  halfExtents: z
    .tuple([num.positive(), num.positive()])
    .describe('Box half-extents in meters along the plane axes ([x, z] or [x, y]).')
    .optional(),
  plane: z
    .enum(['xz', 'xy'])
    .describe('Plane the zone lies in: xz (ground, default) or xy (side view, platformers).')
    .optional(),
  layer: z
    .int()
    .nonnegative()
    .describe('Bitmask of layers this zone belongs to (default 1).')
    .optional(),
  mask: z
    .int()
    .nonnegative()
    .describe('Bitmask of layers it touches (default 1); a pair touches when either side matches.')
    .optional(),
});

export interface ControllerData extends JsonObject {
  move?: string;
  jump?: string;
  speed?: number;
  enabled?: boolean;
}

export const controllerSchema: z.ZodType<ControllerData> = z.strictObject({
  move: z
    .string()
    .min(1)
    .describe("Command whose payload { dir: [x, y] } steers this entity (default 'move').")
    .optional(),
  jump: z
    .string()
    .min(1)
    .describe('Command whose payload { held: boolean } jumps (platformBody or moveIntent).')
    .optional(),
  speed: num
    .positive()
    .describe('Speed in meters per second for kinematic bodies (default 5).')
    .optional(),
  enabled: z.boolean().describe('Accept commands (default true).').optional(),
});

export type VarsData = { [key: string]: number | string | boolean };

export const varsSchema: z.ZodType<VarsData> = z.record(
  z.string().min(1),
  z.union([num, z.string(), z.boolean()]),
);

// --- the scene `hud` block ---

export interface HudItem extends JsonObject {
  label: string;
  value: string;
}
export interface HudMessage extends JsonObject {
  when: PlayCondition;
  text: string;
  detail?: string;
}
export interface HudCaption extends JsonObject {
  tick: number;
  ticks: number;
  text: string;
}
export interface HudData extends JsonObject {
  items?: HudItem[];
  messages?: HudMessage[];
  captions?: HudCaption[];
  title?: { text: string; ticks?: number };
}

export const hudSchema: z.ZodType<HudData> = z.strictObject({
  items: z
    .array(
      z.strictObject({
        label: z.string().min(1).describe('Readout label, e.g. Score.'),
        value: z
          .string()
          .min(1)
          .describe('Value reference #id.component.path, e.g. #game.vars.score.'),
      }),
    )
    .describe('Readouts shown in a corner.')
    .optional(),
  messages: z
    .array(
      z.strictObject({
        when: selectConditionSchema.describe(
          'Condition on one entity by id (#id.component.path), e.g. #game.vars.status eq won.',
        ),
        text: z.string().min(1).describe('Message shown while the condition holds.'),
        detail: z.string().describe('Smaller second line.').optional(),
      }),
    )
    .describe('Centered messages; the first whose condition holds is shown.')
    .optional(),
  captions: z
    .array(
      z.strictObject({
        tick: z.int().nonnegative().describe('Tick the caption appears.'),
        ticks: z.int().positive().describe('Ticks it stays.'),
        text: z.string().min(1).describe('Caption text.'),
      }),
    )
    .describe('Timed captions along the bottom (films).')
    .optional(),
  title: z
    .strictObject({
      text: z.string().min(1).describe('Title shown when play starts.'),
      ticks: z.int().positive().describe('Ticks it stays (default 90).').optional(),
    })
    .describe('A title card at the start.')
    .optional(),
});

/** Parse a HUD value reference "#id.component.path" (null when it is not one). */
export function parseValueRef(
  ref: string,
): { entity: string; component: string; path: Array<string | number> } | null {
  const m = /^#([^.\s]+)\.([A-Za-z_][\w-]*)((?:\.[A-Za-z_][\w-]*|\[\d+\])*)$/.exec(ref.trim());
  if (m === null) return null;
  const [, entity, component, rest] = m as unknown as [string, string, string, string];
  const path: Array<string | number> = [];
  for (const seg of rest.matchAll(/\.([A-Za-z_][\w-]*)|\[(\d+)\]/g)) {
    if (seg[1] !== undefined) path.push(seg[1]);
    else if (seg[2] !== undefined) path.push(Number(seg[2]));
  }
  return { entity, component, path };
}
