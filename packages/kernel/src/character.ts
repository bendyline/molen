import type { JsonObject } from '@bendyline/molen-schema';
import { type ComponentType, defineComponent, Transform } from './component';
import { dmath } from './dmath';
import { KinematicBody } from './kinematics';
import { groundFieldOf } from './terrain';
import { Mounted } from './vehicles';
import type { World } from './world';

// Kinematic character controller (FPS/3rd-person capability, docs/08 P7). Gravity + ground
// snapping + jump + planar movement from an intent component. Not full rigid-body physics —
// a deterministic game-feel mover. Ground height is pluggable (flat by default; the terrain
// heightfield can supply it).

export interface CharacterData extends JsonObject {
  speed: number;
  jumpSpeed: number;
  gravity: number;
  /** Vertical velocity (kernel-owned). */
  vy: number;
  grounded: boolean;
}

export interface MoveIntentData extends JsonObject {
  /** Desired planar move direction (need not be normalized). */
  dir: [number, number];
  jump: boolean;
}

export const Character: ComponentType<CharacterData> = defineComponent<CharacterData>('character');
export const MoveIntent: ComponentType<MoveIntentData> =
  defineComponent<MoveIntentData>('moveIntent');

export interface CharacterOptions {
  /**
   * Terrain/ground height at a world XZ. Default: the world's registered ground field
   * (`installTerrain`, resolved lazily each tick so install order does not matter), else a
   * flat ground at y=0.
   */
  groundHeight?: (x: number, z: number) => number;
}

/** Install the character controller system (physics phase). */
export function installCharacterController(world: World, opts: CharacterOptions = {}): void {
  const groundAt =
    opts.groundHeight ?? ((x: number, z: number) => groundFieldOf(world)?.sampleHeight(x, z) ?? 0);
  world.addSystem(
    (w, ctx) => {
      for (const [id, t, ch] of w.query(Transform, Character).without(Mounted)) {
        const intent = w.get(id, MoveIntent);
        const dir = intent?.dir ?? [0, 0];
        // Planar movement (normalize so diagonal isn't faster).
        const len = dmath.hypot(dir[0], dir[1]) || 1;
        const nx = (dir[0] / (len < 1 ? 1 : len)) * ch.speed * ctx.dt;
        const nz = (dir[1] / (len < 1 ? 1 : len)) * ch.speed * ctx.dt;
        const x = t.pos[0] + nx;
        const z = t.pos[2] + nz;

        // Jump from the ground (using last tick's grounded state) before integrating, so the
        // impulse moves the character this tick.
        let vy = ch.vy;
        if (intent?.jump === true && ch.grounded) vy = ch.jumpSpeed;
        // Gravity + integrate vertical.
        vy -= ch.gravity * ctx.dt;
        if (w.has(id, KinematicBody)) {
          // The collision solver owns displacement. Never move twice in the same tick.
          w.patch(id, KinematicBody, { vel: [nx / ctx.dt, vy, nz / ctx.dt] });
          w.patch(id, Character, { vy, grounded: false });
          continue;
        }
        let y = t.pos[1] + vy * ctx.dt;
        const gh = groundAt(x, z);
        let grounded = false;
        if (y <= gh && vy <= 0) {
          y = gh;
          vy = 0;
          grounded = true;
        }

        w.patch(id, Transform, { pos: [x, y, z] });
        w.patch(id, Character, { vy, grounded });
      }
    },
    { phase: 'physics', name: 'character', priority: -100 },
  );
  world.addSystem(
    (w) => {
      for (const [id, t, ch, body] of w
        .query(Transform, Character, KinematicBody)
        .without(Mounted)) {
        const ground = groundAt(t.pos[0], t.pos[2]);
        const grounded = t.pos[1] <= ground && body.vel[1] <= 0;
        const vy = grounded ? 0 : body.vel[1];
        if (grounded) {
          w.patch(id, Transform, { pos: [t.pos[0], ground, t.pos[2]] });
          w.patch(id, KinematicBody, { vel: [body.vel[0], 0, body.vel[2]] });
        }
        if (ch.vy !== vy || ch.grounded !== grounded) w.patch(id, Character, { vy, grounded });
      }
    },
    { phase: 'physics', name: 'character-ground', priority: 100 },
  );
}
