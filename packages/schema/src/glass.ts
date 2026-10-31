import { z } from 'zod';
import type { JsonObject } from './json';

/** Fracture and retention are independent: laminated fragments can remain in the opening. */
export type GlassMaterial = 'laminated' | 'tempered' | 'annealed';

/** A rectangular pane in its owner's metric frame. Local XY is the pane, +Z its normal. */
export interface GlassSurfaceSpec extends JsonObject {
  id: string;
  material: GlassMaterial;
  center: [number, number, number];
  rotation: [number, number, number, number];
  size: [number, number];
  thickness: number;
  density?: number;
  strength?: number;
  fractureEnergy?: number;
  retentionForce?: number;
  retentionEnergy?: number;
  /** Dedicated pane meshes/groups. Omit to draw a procedural pane. */
  nodes?: string[];
}
export interface GlassData extends JsonObject {
  surfaces: GlassSurfaceSpec[];
  /** Physical crash pulse, independent of simulation substeps; default 0.06 s. */
  crashPulseSeconds?: number;
}
export interface GlassRelease extends JsonObject {
  time: number;
  position: [number, number, number];
  rotation: [number, number, number, number];
  velocity: [number, number, number];
  fragmentSpeed?: number;
}
export interface GlassSurfaceState extends JsonObject {
  fracture: 'intact' | 'cracked' | 'shattered';
  retained: boolean;
  damage: number;
  retentionDamage: number;
  peakStress: number;
  point: [number, number];
  release?: GlassRelease;
}
export interface GlassStateData extends JsonObject {
  surfaces: Record<string, GlassSurfaceState>;
}
/** A resolved contact load, not vehicle speed. Impulse is in the owner's frame, in N s. */
export interface GlassImpact extends JsonObject {
  impulse: [number, number, number];
  energy: number;
  duration: number;
  /** Contact in pane XY coordinates, meters from its center. */
  point: [number, number];
  /** Uniform inertial loading instead of a point contact. */
  distributed?: boolean;
}
export interface GlassImpactEvent extends GlassImpact {
  entity: string;
  surface: string;
  /** Owner's world velocity at this pane, for released visual fragments. */
  velocity?: [number, number, number];
}

const finite = z.number().finite();
const positive = finite.positive();
const unit = finite.min(0).max(1);
const vec2 = z.tuple([finite, finite]);
const vec3 = z.tuple([finite, finite, finite]);
const rotation = z
  .tuple([finite, finite, finite, finite])
  .refine(
    (q) => Math.abs(q.reduce((sum, n) => sum + n * n, 0) - 1) < 1e-5,
    'Glass rotation must be a unit quaternion.',
  );
export const glassSurfaceSchema: z.ZodType<GlassSurfaceSpec> = z.strictObject({
  id: z.string().min(1).max(64).describe('Stable pane id, unique on its owner.'),
  material: z
    .enum(['laminated', 'tempered', 'annealed'])
    .describe(
      'Laminated retains cracked glass; tempered releases granules; annealed releases larger shards.',
    ),
  center: vec3.describe('Pane center in owner coordinates, meters.'),
  rotation: rotation.describe('Pane XY orientation in owner coordinates, unit quaternion.'),
  size: z.tuple([positive, positive]).describe('Width and height in meters.'),
  thickness: positive.describe('Total glass thickness, meters; interlayer thickness excluded.'),
  density: positive.optional().describe('Glass density, kg/m³; default 2500.'),
  strength: positive
    .optional()
    .describe(
      'Effective bending failure stress, Pa. Defaults: tempered 120e6, others 45e6. Simulation tuning, not certification.',
    ),
  fractureEnergy: positive.optional().describe('Post-initiation fracture work, J/m²; default 80.'),
  retentionForce: positive
    .optional()
    .describe('Frame/interlayer failure force, N; default 4000 times pane perimeter in meters.'),
  retentionEnergy: positive
    .optional()
    .describe('Work to lose frame/interlayer retention, J; default 3000 times area in m².'),
  nodes: z
    .array(z.string().min(1))
    .min(1)
    .optional()
    .describe(
      'Dedicated glass mesh/group names; omit for a generated rectangular pane. Never bind a whole vehicle or a shared body mesh.',
    ),
});
export const glassSchema: z.ZodType<GlassData> = z
  .strictObject({
    surfaces: z
      .array(glassSurfaceSchema)
      .min(1)
      .max(64)
      .describe('Physical glass panes and their model bindings.'),
    crashPulseSeconds: positive
      .max(1)
      .optional()
      .describe(
        'Duration of the vehicle crash pulse, seconds; default 0.06, independent of tick rate.',
      ),
  })
  .superRefine((data, ctx) => {
    const ids = new Set<string>();
    const nodes = new Set<string>();
    data.surfaces.forEach((pane, index) => {
      if (ids.has(pane.id))
        ctx.addIssue({
          code: 'custom',
          path: ['surfaces', index, 'id'],
          message: 'Duplicate glass surface id.',
        });
      ids.add(pane.id);
      for (const node of pane.nodes ?? []) {
        if (nodes.has(node))
          ctx.addIssue({
            code: 'custom',
            path: ['surfaces', index, 'nodes'],
            message: 'A node can belong to only one glass surface.',
          });
        nodes.add(node);
      }
    });
  });
export const glassStateSchema: z.ZodType<GlassStateData> = z.strictObject({
  surfaces: z
    .record(
      z.string().min(1),
      z.strictObject({
        fracture: z.enum(['intact', 'cracked', 'shattered']),
        retained: z.boolean(),
        damage: unit,
        retentionDamage: unit,
        peakStress: finite.nonnegative().describe('Largest resolved bending stress in Pa.'),
        point: vec2,
        release: z
          .strictObject({
            time: finite.nonnegative(),
            position: vec3,
            rotation,
            velocity: vec3,
            fragmentSpeed: finite
              .nonnegative()
              .optional()
              .describe('Energy-limited cosmetic fragment dispersion speed, m/s.'),
          })
          .optional()
          .describe(
            'Snapshot-safe initial world pose, velocity and simulation time for cosmetic debris.',
          ),
      }),
    )
    .describe('Per-pane fracture, retention and release state keyed by surface id.'),
});
export const glassImpactSchema: z.ZodType<GlassImpactEvent> = z.strictObject({
  entity: z.string().min(1),
  surface: z.string().min(1),
  impulse: vec3,
  energy: finite.nonnegative().describe('Available impact energy in joules.'),
  duration: positive.describe('Physical contact duration, seconds; do not use render frame time.'),
  point: vec2,
  distributed: z.boolean().optional(),
  velocity: vec3.optional(),
});
