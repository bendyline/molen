import type { JsonObject } from '@bendyline/molen-schema';
import { type ComponentType, defineComponent, Transform } from './component';
import { dmath } from './dmath';
import type { World } from './world';

export interface PlatformSolidData extends JsonObject {
  halfExtents: [number, number];
  oneWay?: boolean;
}
export interface PlatformBodyData extends JsonObject {
  halfExtents: [number, number];
  vel?: [number, number];
  speed?: number;
  acceleration?: number;
  gravity?: number;
  jumpSpeed?: number;
  grounded?: boolean;
  coyoteTicks?: number;
  bufferTicks?: number;
  grace?: number;
  buffered?: number;
}
export interface PlatformIntentData extends JsonObject {
  move: number;
  jump?: boolean;
  jumpHeld?: boolean;
}
export const PlatformSolid: ComponentType<PlatformSolidData> =
  defineComponent<PlatformSolidData>('platformSolid');
export const PlatformBody: ComponentType<PlatformBodyData> =
  defineComponent<PlatformBodyData>('platformBody');
export const PlatformIntent: ComponentType<PlatformIntentData> =
  defineComponent<PlatformIntentData>('platformIntent');

/**
 * Small deterministic XY controller against static, world-axis boxes. Sweeps X then Y to
 * the nearest face (no speed-dependent substep limit). Z is preserved. Solids are in world
 * meters, independent of visual scale/rotation. Author non-overlapping spawn positions.
 * No body/body response, moving-platform carry, slopes or rigid-body dynamics; use Rapier
 * for those. All continuation state is in components, including jump grace and buffering.
 */
export function installPlatformer(world: World): void {
  world.addSystem(
    (w, ctx) => {
      const solids = [...w.query(Transform, PlatformSolid)].map(([id, t, solid]) => ({
        id,
        x: t.pos[0],
        y: t.pos[1],
        hx: solid.halfExtents[0],
        hy: solid.halfExtents[1],
        oneWay: solid.oneWay === true,
      }));
      for (const solid of solids) {
        if (
          ![solid.x, solid.y].every(Number.isFinite) ||
          ![solid.hx, solid.hy].every((v) => Number.isFinite(v) && v > 0)
        ) {
          throw new RangeError(
            `platformSolid "${solid.id}" needs finite positions and positive dimensions`,
          );
        }
      }
      for (const [id, t, body] of w.query(Transform, PlatformBody)) {
        const intent = w.get(id, PlatformIntent);
        const [hx, hy] = body.halfExtents;
        const speed = body.speed ?? 7;
        const accel = body.acceleration ?? 45;
        const jumpSpeed = body.jumpSpeed ?? 11;
        const gravity = body.gravity ?? 28;
        let [vx, vy] = body.vel ?? [0, 0];
        if (
          ![hx, hy, speed, accel, jumpSpeed, gravity].every((v) => Number.isFinite(v) && v > 0) ||
          ![...t.pos, vx, vy, intent?.move ?? 0].every(Number.isFinite)
        ) {
          throw new RangeError(
            `platformBody "${id}" needs finite positions/velocity and positive dimensions/rates`,
          );
        }
        const desired = dmath.clamp(intent?.move ?? 0, -1, 1) * speed;
        vx += dmath.clamp(desired - vx, -accel * ctx.dt, accel * ctx.dt);
        let grace = body.grounded ? (body.coyoteTicks ?? 3) : dmath.max(0, (body.grace ?? 0) - 1);
        let buffered = intent?.jump
          ? (body.bufferTicks ?? 4) + 1
          : dmath.max(0, (body.buffered ?? 0) - 1);
        if (buffered > 0 && (body.grounded || grace > 0)) {
          vy = jumpSpeed;
          grace = 0;
          buffered = 0;
        }
        if (intent?.jumpHeld === false && vy > jumpSpeed * 0.5) vy = jumpSpeed * 0.5;
        vy -= gravity * ctx.dt;
        let x = t.pos[0];
        let y = t.pos[1];
        let dx = vx * ctx.dt;
        let hitX: string | undefined;
        let hitY: string | undefined;
        for (const s of solids) {
          if (s.id === id || s.oneWay || y + hy <= s.y - s.hy || y - hy >= s.y + s.hy) continue;
          if (dx > 0 && x + hx <= s.x - s.hx && x + hx + dx >= s.x - s.hx) {
            dx = s.x - s.hx - x - hx;
            hitX = s.id;
          } else if (dx < 0 && x - hx >= s.x + s.hx && x - hx + dx <= s.x + s.hx) {
            dx = s.x + s.hx - x + hx;
            hitX = s.id;
          }
        }
        x += dx;
        const normalX = vx > 0 ? -1 : 1;
        if (hitX !== undefined) vx = 0;
        let dy = vy * ctx.dt;
        const falling = vy <= 0;
        for (const s of solids) {
          if (s.id === id || x + hx <= s.x - s.hx || x - hx >= s.x + s.hx) continue;
          if (dy <= 0 && y - hy >= s.y + s.hy - 1e-9 && y - hy + dy <= s.y + s.hy) {
            dy = s.y + s.hy - y + hy;
            hitY = s.id;
          } else if (!s.oneWay && dy > 0 && y + hy <= s.y - s.hy && y + hy + dy >= s.y - s.hy) {
            dy = s.y - s.hy - y - hy;
            hitY = s.id;
          }
        }
        y += dy;
        const grounded = hitY !== undefined && falling;
        if (hitY !== undefined) vy = 0;
        w.patch(id, Transform, { pos: [x, y, t.pos[2]] });
        w.patch(id, PlatformBody, { vel: [vx, vy], grounded, grace, buffered });
        if (intent?.jump === true) w.patch(id, PlatformIntent, { jump: false });
        // Publish state before callbacks so a handler's bounce/respawn is never overwritten.
        if (hitX !== undefined) w.emit('collision', { a: id, b: hitX, normal: [normalX, 0, 0] });
        if (hitY !== undefined)
          w.emit('collision', { a: id, b: hitY, normal: [0, falling ? 1 : -1, 0] });
      }
    },
    { phase: 'physics', name: 'platformer' },
  );
}
