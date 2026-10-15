export type GameKind = 'courier' | 'skybound' | 'dungeon';
export interface GameReader {
  get(id: string, component: string): Record<string, unknown> | undefined;
  entities(): string[];
}
export interface Description {
  summary: string;
  surroundings: string[];
}
const n = (v: unknown): number => Number(v ?? 0);
const point = (reader: GameReader, id: string): number[] =>
  (reader.get(id, 'transform')?.pos as number[] | undefined) ?? [0, 0, 0];
const metres = (v: number): string => `${Math.abs(v).toFixed(1)} metres`;
function offset(from: number[], to: number[], side = false): string {
  const x = (to[0] ?? 0) - (from[0] ?? 0);
  const z = side ? (to[1] ?? 0) - (from[1] ?? 0) : (to[2] ?? 0) - (from[2] ?? 0);
  return `${metres(x)} ${x >= 0 ? 'east' : 'west'}, ${metres(z)} ${side ? (z >= 0 ? 'above' : 'below') : z >= 0 ? 'south' : 'north'}`;
}
function heading(reader: GameReader): string {
  const rot = reader.get('player', 'transform')?.rot as number[] | undefined;
  const degrees =
    ((((-2 * Math.atan2(rot?.[1] ?? 0, rot?.[3] ?? 1) * 180) / Math.PI) % 360) + 360) % 360;
  const compass = [
    'north',
    'northeast',
    'east',
    'southeast',
    'south',
    'southwest',
    'west',
    'northwest',
  ];
  return `${compass[Math.round(degrees / 45) % 8]}, ${degrees.toFixed(0)} degrees clockwise from north`;
}

/** Read the actual mirrored world, including dynamic enemies and collected/removed objects. */
export function describeGame(
  kind: GameKind,
  reader: GameReader,
  textControls = false,
): Description {
  const p = point(reader, 'player');
  const component =
    kind === 'courier' ? 'courierGame' : kind === 'skybound' ? 'skyGame' : 'dungeonGame';
  const game = reader.get('game', component);
  if (!game) return { summary: 'Loading the world.', surroundings: [] };
  const message = textControls
    ? String(game.message)
        .replace(/\bPress R[^.]*\./gi, 'Choose Restart game to begin again.')
        .replace(/\bpress E\b/gi, 'choose Interact')
        .replace(
          'Space to attack. H drinks your potion.',
          'Choose Strike to attack. Choose Drink potion to heal.',
        )
    : String(game.message);
  const location = `Position: east ${p[0]?.toFixed(1)}, south ${p[2]?.toFixed(1)} metres.`;
  if (kind === 'courier') {
    const surroundings = [
      `Roads run north–south at east −24, 0 and 24 metres, and east–west at south −24, 0 and 24 metres. Stay within about 3 metres of a road centre. Steer while accelerating; steering alone does not turn a stationary car.`,
    ];
    if (game.status !== 'won')
      surroundings.push(
        `Next delivery beacon: ${offset(p, point(reader, 'beacon'))}. Drive within 3 metres to deliver.`,
      );
    const obstacles = reader
      .entities()
      .filter((id) => id !== 'player' && reader.get(id, 'collider'))
      .map((id) => ({ id, pos: point(reader, id) }))
      .filter((o) => Math.hypot((o.pos[0] ?? 0) - (p[0] ?? 0), (o.pos[2] ?? 0) - (p[2] ?? 0)) < 12)
      .sort(
        (a, b) =>
          Math.hypot((a.pos[0] ?? 0) - (p[0] ?? 0), (a.pos[2] ?? 0) - (p[2] ?? 0)) -
          Math.hypot((b.pos[0] ?? 0) - (p[0] ?? 0), (b.pos[2] ?? 0) - (p[2] ?? 0)),
      );
    for (const o of obstacles.slice(0, 6))
      surroundings.push(`Obstacle ${o.id.replaceAll('-', ' ')}: ${offset(p, o.pos)}.`);
    return {
      summary: `${game.status}. ${message} ${location} Facing ${heading(reader)}. Speed ${n(game.speed).toFixed(1)} metres per second. ${game.delivered} of ${game.total} deliveries; condition ${game.health} percent; ${game.seconds} seconds of driving time left.`,
      surroundings,
    };
  }
  if (kind === 'skybound') {
    const body = reader.get('player', 'platformBody');
    const velocity = body?.vel as number[] | undefined;
    const surroundings: string[] = [];
    for (const id of reader.entities()) {
      const q = point(reader, id);
      const solid = reader.get(id, 'platformSolid');
      if (solid) {
        const half = solid.halfExtents as number[];
        const left = (q[0] ?? 0) - (half[0] ?? 0),
          right = (q[0] ?? 0) + (half[0] ?? 0);
        if (right < (p[0] ?? 0) - 10 || left > (p[0] ?? 0) + 15) continue;
        surroundings.push(
          `${solid.oneWay ? 'Raised ledge' : 'Island'} from east ${left.toFixed(1)} to ${right.toFixed(1)}, surface height ${((q[1] ?? 0) + (half[1] ?? 0)).toFixed(1)} metres. ${!solid.oneWay && (p[0] ?? 0) >= left && (p[0] ?? 0) <= right ? `Eastern edge ${metres(right - (p[0] ?? 0))} away; the space between islands is a gap.` : ''}`,
        );
      }
      if (Math.abs((q[0] ?? 0) - (p[0] ?? 0)) > 12) continue;
      if (reader.get(id, 'tag')?.name === 'hazard')
        surroundings.push(`Thorns: ${offset(p, q, true)}. Jump over them.`);
      if (reader.get(id, 'patrol')?.alive)
        surroundings.push(
          `Patrolling creature: ${offset(p, q, true)}. Jump over it or land on it while falling.`,
        );
      const seed = reader.get(id, 'seedPickup');
      if (seed && !seed.collected) surroundings.push(`Seed: ${offset(p, q, true)}.`);
    }
    surroundings.push(
      'Checkpoint at east 37 metres; lighthouse at east 75. Short steps travel up to 1.6 metres; long jumps travel up to 5.8 metres. Jump near an island edge to cross a gap.',
    );
    return {
      summary: `${game.status}. ${message} East ${p[0]?.toFixed(1)} metres, height ${p[1]?.toFixed(1)} metres. ${body?.grounded ? 'On ground' : n(velocity?.[1]) > 0 ? 'Rising' : 'Falling'}. ${game.lives} lives; ${game.coins} of ${game.total} seeds; checkpoint ${game.checkpoint ? 'saved' : 'not reached'}.`,
      surroundings,
    };
  }
  const surroundings = [
    `Brass key ${game.key ? 'collected' : `at ${offset(p, point(reader, 'key'))}; walk within 1.2 metres to collect`}.`,
    `North gate ${game.doorOpen ? 'open' : 'locked'}: ${offset(p, point(reader, 'gate'))}. Face it within 3 metres and interact after collecting the key.`,
    `Lantern: ${offset(p, [0, 0, -12])}. Interact within 2.5 metres after opening the gate.`,
  ];
  for (const id of reader.entities()) {
    const q = point(reader, id);
    const enemy = reader.get(id, 'sentinel');
    if (enemy?.alive)
      surroundings.push(
        `Sentinel ${id.replaceAll('-', ' ')}: ${offset(p, q)}, ${enemy.hp} health. Face it within 2.6 metres to strike; a sentinel within 1.4 metres can attack.`,
      );
    const collider = reader.get(id, 'collider');
    if (
      collider?.isStatic &&
      Math.hypot((q[0] ?? 0) - (p[0] ?? 0), (q[2] ?? 0) - (p[2] ?? 0)) < 5
    ) {
      const half = collider.halfExtents as number[] | undefined;
      surroundings.push(
        `Wall or barrier ${id.replaceAll('-', ' ')}: ${offset(p, q)}${half ? `, ${n(half[0]) * 2} by ${n(half[1]) * 2} metres` : ''}.`,
      );
    }
  }
  return {
    summary: `${game.status}. ${message} ${location} Facing ${heading(reader)}. Vitality ${game.health}; ${game.potions} potion; ${game.kills} sentinels defeated.`,
    surroundings,
  };
}
