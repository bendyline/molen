/**
 * The ambient vocabulary: components, the `ambient-vehicle` renderable kind and the
 * molen/transport-network@1 format. Kernel-free (schema + zod only) so both halves register it on
 * import: a page validates scenes with the client half alone, tooling and Workers with the kernel
 * half.
 */

import {
  getSchema,
  type JsonValue,
  registerComponent,
  registerRenderableKind,
  registerSchema,
  type ValidationIssue,
} from '@bendyline/molen-schema';
import { z } from 'zod';
import {
  TRANSPORT_NETWORK_EXAMPLE,
  TRANSPORT_NETWORK_FORMAT,
  type TransportNetworkDocument,
} from './graph/doc';

export const AMBIENT_AGENT_COMPONENT: 'ambientAgent' = 'ambientAgent';
export const AMBIENT_OBSERVER_COMPONENT: 'ambientObserver' = 'ambientObserver';
export const AMBIENT_ROLE_COMPONENT: 'ambientRole' = 'ambientRole';
export const AMBIENT_STATE_COMPONENT: 'ambientState' = 'ambientState';

const num = z.number();
const vec2 = z.array(num).length(2);
const vec3 = z.array(num).length(3);
const kind = z.enum(['car', 'pedestrian', 'train', 'aircraft']);

const ambientAgentSchema = z.strictObject({
  kind: kind.describe('Agent class.'),
  type: z
    .string()
    .describe('Content type id (e.g. molen.entities.vehicle.sedan), figure preset, or "proxy".'),
  color: z.string().describe('Body colour (#rrggbb).').optional(),
  lane: z.string().describe('Lane id the agent is on ("" for aircraft).'),
  s: num.describe('Metres along the lane; negative while on the connector into it.'),
  speed: num.nonnegative().describe('Speed along the lane in m/s.'),
  prev: z.string().describe('Previous lane (its connector leads onto `lane`).').optional(),
  next: z.string().describe('Chosen next lane.').optional(),
  seed: z.int().nonnegative().describe('Per-agent seed for every random choice it makes.'),
  length: num.positive().describe('Body length in metres.'),
  width: num.positive().describe('Body width in metres.'),
  state: z
    .enum(['move', 'wait', 'dwell', 'idle'])
    .describe('Moving, waiting (queue, signal, crossing), dwelling at a stop, or idling.'),
  since: z.int().nonnegative().describe('Tick the current state began.'),
  hops: z.int().nonnegative().describe('Lane transitions so far (routing draw stream).'),
  hidden: z.boolean().describe('Inside a tunnel: simulated but not drawn.').optional(),
  consist: z.string().describe('Train cars: the lead agent of the consist.').optional(),
  carIndex: z
    .int()
    .positive()
    .describe('Train cars: position behind the lead (1 = first).')
    .optional(),
  trail: z
    .array(z.string())
    .describe('Train leads: the lanes behind the lead, most recent first.')
    .optional(),
  served: z.string().describe('The last stop served (not stopped at again).').optional(),
  air: z
    .strictObject({
      x: num.describe('Corridor start X.'),
      z: num.describe('Corridor start Z.'),
      dx: num.describe('Unit heading X.'),
      dz: num.describe('Unit heading Z.'),
      y0: num.describe('Altitude at the start.'),
      y1: num.describe('Altitude at the end.'),
      length: num.positive().describe('Corridor length in metres.'),
    })
    .describe('Aircraft: the straight corridor flown (s runs along it).')
    .optional(),
  spawnedTick: z.int().nonnegative().describe('Tick the agent appeared (clients fade it in).'),
});

const ambientObserverSchema = z.strictObject({
  radius: num.positive().describe('Override the car spawn radius in metres.').optional(),
  despawnRadius: num.positive().describe('Override the car despawn radius in metres.').optional(),
  density: num.nonnegative().describe('Scale every class density (1 = default).').optional(),
});

const ambientRoleSchema = z.strictObject({
  role: z
    .enum(['car', 'bus', 'rail', 'aircraft'])
    .describe('Which ambient pool the type joins (buses drive with cars).'),
  length: num.positive().describe('Body length in metres (default from vehicle.spec).').optional(),
  width: num.positive().describe('Body width in metres (default from vehicle.spec).').optional(),
  height: num.positive().describe('Body height in metres (default from vehicle.spec).').optional(),
  cruise: num.positive().describe('Preferred cruise speed in m/s.').optional(),
  max: num.positive().describe('Top speed in m/s.').optional(),
  weight: num
    .nonnegative()
    .describe('Relative spawn weight within its pool (default 1).')
    .optional(),
  cars: z.int().positive().describe('Rail: cars per consist (default 2).').optional(),
  colors: z
    .array(z.string())
    .min(1)
    .describe('Paint colours spawned agents pick from (#rrggbb).')
    .optional(),
  visual: z
    .strictObject({
      wheelNodes: z.array(z.string()).describe('Wheel nodes (their first child spins).').optional(),
      frontWheelNodes: z.array(z.string()).describe('Wheel nodes that steer.').optional(),
      paintMaterial: z.string().describe('Material name tinted with the agent colour.').optional(),
      wheelRadius: num.positive().describe('Wheel radius in metres.').optional(),
      wheelbase: num.positive().describe('Axle spacing in metres.').optional(),
      rotors: z
        .array(z.string())
        .describe('Aircraft: nodes spun about Z (fans, propellers).')
        .optional(),
      gearNodes: z
        .array(z.string())
        .describe('Aircraft: landing gear shown on approach.')
        .optional(),
    })
    .describe(
      'How the model animates when drawn in full near the camera (types without a vehicle component).',
    )
    .optional(),
});

const observerFields = z.strictObject({
  pos: vec3.describe('Observer position.').optional(),
  forward: vec2
    .describe('Unit view direction [x, z]; spawns avoid the view cone near it.')
    .optional(),
  entity: z.string().describe('Entity whose transform is the observer.').optional(),
  setAtTick: z.int().nonnegative().describe('Tick the observer was last set.'),
});

const ambientStateSchema = z.strictObject({
  observer: observerFields.describe('Where agents spawn around.').optional(),
  nextSeq: z.int().nonnegative().describe('Sequence number of the next spawned agent.'),
  spawned: z.int().nonnegative().describe('Agents spawned so far.'),
  despawned: z.int().nonnegative().describe('Agents removed so far.'),
  policy: z
    .record(z.string(), z.json())
    .describe('Policy overrides set by the ambient.policy command.')
    .optional(),
});

const point = z.union([vec2, vec3]);

const waySchema = z.strictObject({
  id: z.string().min(1).describe('Optional stable id.').optional(),
  class: z.enum(['road', 'rail', 'path', 'air']).describe('What moves on it.'),
  subclass: z
    .string()
    .describe(
      'motorway, trunk, primary, secondary, tertiary, residential, service; rail/tram; crossing.',
    )
    .optional(),
  points: z
    .array(point)
    .min(2)
    .describe('[x, z] or [x, y, z] points in scene metres (y = road surface height).'),
  oneway: z.boolean().describe('Traffic only in point order.').optional(),
  lanes: z.int().positive().describe('Total lanes across both directions.').optional(),
  width: num.positive().describe('Carriageway width in metres.').optional(),
  layer: z.int().describe('Grade: different layers never connect mid-way.').optional(),
  speed: num.positive().describe('Design speed in m/s.').optional(),
  bridge: z.boolean().optional(),
  tunnel: z.boolean().optional(),
  name: z.string().optional(),
});

const transportNetworkSchema = z.strictObject({
  format: z
    .literal(TRANSPORT_NETWORK_FORMAT)
    .describe("Format envelope; always 'molen/transport-network@1'."),
  name: z.string().optional(),
  origin: z
    .union([z.strictObject({ latitude: num, longitude: num }), z.strictObject({ x: num, z: num })])
    .describe('Where the network came from (geographic anchor of a baked network).')
    .optional(),
  drivingSide: z.enum(['right', 'left']).describe("Traffic side (default 'right').").optional(),
  sidewalks: z
    .boolean()
    .describe('Infer sidewalks along streets that have no mapped paths nearby (default false).')
    .optional(),
  ways: z.array(waySchema).describe('Roads, railways and paths.'),
  stations: z
    .array(
      z.strictObject({
        id: z.string().min(1),
        at: vec2.describe('[x, z]; projected onto the nearest rail (rail) or footway (bus).'),
        kind: z.enum(['rail', 'bus']),
        dwell: num.positive().describe('Dwell time in seconds.').optional(),
      }),
    )
    .describe('Stops trains (and buses) serve.')
    .optional(),
  signals: z
    .array(z.strictObject({ at: vec2, kind: z.enum(['stop', 'yield', 'light']) }))
    .describe(
      'Junction controls: a light signalises the junction nearest the point; a stop or yield sign makes the junction arm nearest the point give way.',
    )
    .optional(),
  aerodromes: z
    .array(
      z.strictObject({
        id: z.string().min(1),
        at: vec2,
        heading: num.describe('Runway heading in radians about +Y (0 = +Z).').optional(),
        length: num.positive().describe('Runway length in metres (default 2500).').optional(),
      }),
    )
    .describe('Runways aircraft approach and depart.')
    .optional(),
});

function validateNetwork(data: unknown): ValidationIssue[] {
  const doc = data as TransportNetworkDocument;
  const issues: ValidationIssue[] = [];
  const ids = new Set<string>();
  doc.ways.forEach((way, i) => {
    if (way.id !== undefined) {
      if (ids.has(way.id))
        issues.push({
          path: `/ways/${i}/id`,
          code: 'duplicate_id',
          message: `duplicate way id "${way.id}"`,
          docsRef: 'guide/ambient-life.md',
        });
      ids.add(way.id);
    }
    way.points.forEach((p, j) => {
      if (!p.every(Number.isFinite))
        issues.push({
          path: `/ways/${i}/points/${j}`,
          code: 'not_finite',
          message: 'way points must be finite numbers',
          docsRef: 'guide/ambient-life.md',
        });
    });
  });
  return issues;
}

export const AMBIENT_AGENT_EXAMPLE: JsonValue = {
  kind: 'car',
  type: 'molen.entities.vehicle.sedan',
  color: '#4d76b8',
  lane: '15/5245/11443#k3j9x2>f0',
  s: 42.5,
  speed: 11.2,
  seed: 1964432,
  length: 4.65,
  width: 1.82,
  state: 'move',
  since: 1200,
  hops: 3,
  spawnedTick: 1180,
};

let registered = false;

/** Register the ambient components, renderable kind and format (idempotent). */
export function registerAmbientSchema(): void {
  if (registered) return;
  registered = true;
  const owner = 'ambient';
  const docsRef = 'guide/ambient-life.md';
  registerComponent(
    AMBIENT_AGENT_COMPONENT,
    ambientAgentSchema,
    {
      description:
        'Kernel-owned state of an ambient NPC (car, pedestrian, train car or aircraft): its lane, position along it, speed and routing. Read it; the ambient systems write it.',
      owner,
      examples: [AMBIENT_AGENT_EXAMPLE],
      docsRef,
    },
    { override: true },
  );
  registerComponent(
    AMBIENT_OBSERVER_COMPONENT,
    ambientObserverSchema,
    {
      description:
        'Marks the entity ambient NPCs spawn around (usually the player or camera rig), with optional radius and density overrides.',
      owner,
      examples: [{}, { radius: 200, density: 0.5 }],
      docsRef,
    },
    { override: true },
  );
  registerComponent(
    AMBIENT_ROLE_COMPONENT,
    ambientRoleSchema,
    {
      description:
        'On an entity type: makes it an ambient NPC candidate (car, bus, rail car or aircraft) with dimensions, speeds and spawn weight.',
      owner,
      examples: [
        { role: 'car', cruise: 13, max: 25 },
        { role: 'rail', length: 27, cars: 2 },
      ],
      docsRef,
    },
    { override: true },
  );
  registerComponent(
    AMBIENT_STATE_COMPONENT,
    ambientStateSchema,
    {
      description:
        'Kernel-owned ambient bookkeeping on the `$ambient` entity: observer, spawn sequence and policy overrides.',
      owner,
      examples: [
        { nextSeq: 12, spawned: 12, despawned: 3, observer: { pos: [0, 0, 0], setAtTick: 0 } },
      ],
      docsRef,
    },
    { override: true },
  );
  registerRenderableKind('ambient-vehicle', {
    description:
      'an ambient NPC vehicle: an instanced proxy from its `ambientAgent` dimensions, or the content model named by `ref` near the camera',
    owner,
  });
  if (getSchema('transport-network') === undefined) {
    registerSchema('transport-network', transportNetworkSchema, {
      id: TRANSPORT_NETWORK_FORMAT,
      title: 'Transport network',
      description:
        'Roads, railways and paths ambient NPCs move on, for scenes without streamed map tiles. Ways that share a vertex, cross at the same grade or end on one another connect.',
      examples: [TRANSPORT_NETWORK_EXAMPLE as unknown as JsonValue],
      docsRef,
      validate: validateNetwork,
    });
  }
}
