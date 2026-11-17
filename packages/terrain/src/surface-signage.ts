/** Roadside and overhead sign placement from source semantics and bounded topology inference. */
import { sampleTerrainLine, type TerrainLinePath } from './line-path';
import { normalizeRing, pointInPolygon } from './polygon';
import type { TerrainPyramidTileLayerContext } from './pyramid-stream';
import {
  DEFAULT_ROAD_SIGN_PROFILE,
  roadSignExitLabel,
  streetSignName,
  type TerrainRoadSignProfile,
  type TerrainStreetNameStyle,
} from './road-sign-styles';
import { resolveTerrainRouteMarker, type TerrainRouteShieldLibrary } from './route-shields';
import type { TerrainBuildingFeature, TerrainSemanticTile } from './semantic-types';
import type { SurfaceControl } from './surface-controls';
import {
  isSurfaceLink,
  type SurfaceJunction,
  type SurfaceNetwork,
  type SurfaceRoad,
  sortedJunctionArms,
  surfaceHash,
  surfaceJunctionCorners,
} from './surface-network';
import { STREET_NAME_WALL, type SurfaceSign, streetNamePanelWidth } from './surface-sign-mesh';

/** Only literal posted limits are usable: no implicit country codes, conditional or variable limits. */
export function postedSpeed(value: string | undefined): [string, string] | undefined {
  const match = value?.trim().match(/^(\d+(?:\.\d+)?)\s*(mph|km\/h|kmh|kph)?$/i);
  if (!match || Number(match[1]) <= 0 || Number(match[1]) > 300) return undefined;
  return [String(Number(match[1])), match[2]?.toLowerCase() === 'mph' ? 'MPH' : 'KM/H'];
}

/**
 * Junctions a detail tile may name at a corner (one post, or two wall or frame plates), outside
 * the 48 boards and the shared fixture budget
 * (a host that allows no fixtures still gets none). Mast panels come one per signal mast instead.
 */
export const STREET_NAME_SIGNS_PER_TILE = 64;

/** One straight stretch of a building's outer wall, in tile meters. */
export interface SurfaceFacade {
  /** Start of the wall, its unit direction and length. */
  x: number;
  z: number;
  tx: number;
  tz: number;
  length: number;
  /** Unit normal out of the building. */
  nx: number;
  nz: number;
  /** Building height above its base, when mapped. */
  height?: number;
}

/** What the host knows that street names need beyond the road network. */
export interface SurfaceStreetNameOptions {
  /** Whether the host's fonts letter a legend; a name they cannot letter is not posted. */
  lettered?: (legend: string) => boolean;
  /** Building walls with any part within `reach` meters of a point, for `mount: 'wall'`. */
  facades?: (x: number, z: number, reach: number) => readonly SurfaceFacade[];
}

/** How far from a street corner a nameplate may sit on a building wall. */
const WALL_REACH = 12;

/**
 * Building walls by grid cell, answering `SurfaceStreetNameOptions.facades`. Raised parts
 * (bridges between buildings, overhangs) and underground ones carry no plates.
 */
export function surfaceFacadeIndex(
  buildings: readonly TerrainBuildingFeature[],
  tileSize: number,
): (x: number, z: number, reach: number) => SurfaceFacade[] {
  const size = 16;
  const cells = new Map<string, SurfaceFacade[]>();
  for (const building of buildings) {
    if ((building.minHeight ?? 0) > 0.5 || (building.layer ?? 0) < 0) continue;
    for (const polygon of building.polygons) {
      const ring = normalizeRing(polygon.outer);
      if (ring.length < 3) continue;
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i] as readonly [number, number],
          b = ring[(i + 1) % ring.length] as readonly [number, number];
        const x = a[0] * tileSize,
          z = a[1] * tileSize,
          dx = b[0] * tileSize - x,
          dz = b[1] * tileSize - z;
        const length = Math.hypot(dx, dz);
        if (length < 1.5) continue;
        const tx = dx / length,
          tz = dz / length;
        // Outward is whichever side of the wall's middle lies outside the footprint.
        const outside = !pointInPolygon(
          [(x + dx / 2 + tz * 0.2) / tileSize, (z + dz / 2 - tx * 0.2) / tileSize],
          polygon,
        );
        const facade: SurfaceFacade = {
          x,
          z,
          tx,
          tz,
          length,
          nx: outside ? tz : -tz,
          nz: outside ? -tx : tx,
          ...(building.height !== undefined ? { height: building.height } : {}),
        };
        for (
          let cx = Math.floor(Math.min(x, x + dx) / size);
          cx <= Math.floor(Math.max(x, x + dx) / size);
          cx++
        )
          for (
            let cz = Math.floor(Math.min(z, z + dz) / size);
            cz <= Math.floor(Math.max(z, z + dz) / size);
            cz++
          ) {
            const key = `${cx}/${cz}`;
            const cell = cells.get(key) ?? [];
            cell.push(facade);
            cells.set(key, cell);
          }
      }
    }
  }
  return (x, z, reach) => {
    const found = new Set<SurfaceFacade>();
    for (let cx = Math.floor((x - reach) / size); cx <= Math.floor((x + reach) / size); cx++)
      for (let cz = Math.floor((z - reach) / size); cz <= Math.floor((z + reach) / size); cz++)
        for (const facade of cells.get(`${cx}/${cz}`) ?? []) {
          if (found.has(facade)) continue;
          const t = Math.max(
            0,
            Math.min(facade.length, (x - facade.x) * facade.tx + (z - facade.z) * facade.tz),
          );
          if (Math.hypot(facade.x + facade.tx * t - x, facade.z + facade.tz * t - z) <= reach)
            found.add(facade);
        }
    return [...found];
  };
}

/**
 * The legend posted for a road at a junction, or undefined: paths, rails, freeways, ramps and turn
 * connectors carry none, nor does a compound label such as "A Street & B Avenue", nor a name the
 * host's fonts cannot letter.
 */
export function postedStreetName(
  road: SurfaceRoad,
  style: Readonly<TerrainStreetNameStyle>,
  lettered?: (legend: string) => boolean,
): string | undefined {
  const name = road.feature.name?.trim();
  if (!name || /[&;]/.test(name) || isSurfaceLink(road)) return undefined;
  if (road.kind !== 'street' && road.kind !== 'service') return undefined;
  const legend = streetSignName(style, name);
  return lettered && !lettered(legend) ? undefined : legend;
}

/**
 * The street a signal approach crosses, as posted: the named arm most nearly perpendicular to it
 * (at least 30 degrees), other than the approach's own street. Where the cross street changes name
 * across the junction, the arm on the driving side wins.
 */
export function crossStreetName(
  node: SurfaceJunction,
  approach: SurfaceJunction['arms'][number],
  style: Readonly<TerrainStreetNameStyle>,
  side: 1 | -1,
  lettered?: (legend: string) => boolean,
): { name: string; road: SurfaceRoad } | undefined {
  const own = postedStreetName(approach.road, style);
  let best: { name: string; road: SurfaceRoad } | undefined;
  let score = 0.5;
  for (const arm of node.arms) {
    if (arm === approach) continue;
    const name = postedStreetName(arm.road, style, lettered);
    if (!name || name === own) continue;
    const turn = (approach.dz * arm.dx - approach.dx * arm.dz) * side;
    const value = Math.abs(turn) + (turn > 0 ? 0.01 : 0);
    if (value > score) {
      score = value;
      best = { name, road: arm.road };
    }
  }
  return best;
}

function nearest(path: TerrainLinePath, x: number, z: number): { distance: number; along: number } {
  let distance = Number.POSITIVE_INFINITY,
    along = 0;
  for (let i = 1; i < path.points.length; i++) {
    const a = path.points[i - 1] as [number, number],
      b = path.points[i] as [number, number];
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = Math.hypot(dx, dz);
    const t = Math.max(
      0,
      Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (length * length || 1)),
    );
    const d = Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
    if (d < distance) {
      distance = d;
      along = (path.distances[i - 1] ?? 0) + t * length;
    }
  }
  return { distance, along };
}

/** World-axis stations survive source splits and neighboring tile buffers. */
function stations(
  path: TerrainLinePath,
  origin: readonly [number, number],
  spacing: number,
  phase: number,
): number[] {
  const result: number[] = [];
  for (let i = 1; i < path.points.length && result.length < 32; i++) {
    const a = path.points[i - 1] as [number, number],
      b = path.points[i] as [number, number];
    const axis = Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]) ? 0 : 1;
    const lo = Math.min(a[axis], b[axis]) + origin[axis],
      hi = Math.max(a[axis], b[axis]) + origin[axis];
    for (
      let v = Math.ceil((lo - phase) / spacing) * spacing + phase;
      v < hi && result.length < 32;
      v += spacing
    ) {
      const t = (v - origin[axis] - a[axis]) / (b[axis] - a[axis]);
      result.push(
        (path.distances[i - 1] ?? 0) +
          t * ((path.distances[i] ?? 0) - (path.distances[i - 1] ?? 0)),
      );
    }
  }
  return result;
}

export function planSurfaceSigns(
  tile: TerrainSemanticTile,
  context: TerrainPyramidTileLayerContext,
  network: SurfaceNetwork,
  controls: ReadonlyMap<SurfaceJunction, SurfaceControl>,
  blocked: (x: number, z: number) => boolean,
  maximum: number,
  deckProfiles: ReadonlyMap<SurfaceRoad, (x: number, z: number) => number>,
  appearance: Readonly<TerrainRoadSignProfile> = DEFAULT_ROAD_SIGN_PROFILE,
  routeShields?: TerrainRouteShieldLibrary,
  streets: SurfaceStreetNameOptions = {},
): SurfaceSign[] {
  const result: SurfaceSign[] = [];
  const side = appearance.drivingSide === 'left' ? -1 : 1;
  const exitLabel = (ref?: string): string => roadSignExitLabel(appearance, ref);
  const ground = (road: SurfaceRoad, x: number, z: number): number =>
    deckProfiles.get(road)?.(x, z) ??
    context.heightfield.sampleHeight(context.origin[0] + x, context.origin[1] + z) + road.elevation;
  const inside = (x: number, z: number): boolean =>
    x >= 2 && z >= 2 && x < context.tileSize - 2 && z < context.tileSize - 2;
  const add = (sign: SurfaceSign, road: SurfaceRoad): void => {
    const boards = result.filter((s) => s.kind !== 'street-name').length;
    if (boards >= 48 || result.length >= maximum || !inside(sign.x, sign.z)) return;
    const clear = (x: number, z: number): boolean =>
      inside(x, z) && !blocked(x, z) && !network.occupied(x, z, 0.5, road);
    if (sign.span) {
      if (
        ![-1, 1].every((s) =>
          clear(
            sign.x + (sign.dz * s * (sign.span as number)) / 2,
            sign.z - (sign.dx * s * (sign.span as number)) / 2,
          ),
        )
      )
        return;
    } else if (!clear(sign.x, sign.z)) return;
    if (
      result.some(
        (s) =>
          s.kind === sign.kind &&
          (sign.kind === 'guide' || s.lines.join('\n') === sign.lines.join('\n')) &&
          Math.abs((s.x - sign.x) * sign.dz - (s.z - sign.z) * sign.dx) < 4 &&
          s.dx * sign.dx + s.dz * sign.dz > 0.8 &&
          Math.hypot(s.x - sign.x, s.z - sign.z) <
            (sign.kind === 'guide' ? 250 : sign.kind === 'speed' ? 150 : 8),
      )
    )
      return;
    result.push(sign);
  };
  const at = (
    road: SurfaceRoad,
    distance: number,
    direction: number,
    kind: Exclude<SurfaceSign['kind'], 'stop' | 'yield'>,
    lines: string[],
    source: SurfaceSign['source'],
    overhead = false,
    evidence: string[] = [],
    arrow?: SurfaceSign['arrow'],
    routeGuide = false,
    roadId: string | number | undefined = road.feature.id,
    panelColor?: string,
    routeShield?: SurfaceSign['routeShield'],
  ): void => {
    if (distance < 0 || distance > road.path.length) return;
    const p = sampleTerrainLine(road.path, distance);
    const dx = p.dx * direction,
      dz = p.dz * direction;
    const offset = overhead
      ? 0
      : side * (road.width / 2 + (road.kind === 'motorway' && !isSurfaceLink(road) ? 2.8 : 1.6));
    const x = p.x - dz * offset,
      z = p.z + dx * offset;
    // No overhead fixture may hang low over a cambered/sloped carriageway.
    const y = Math.max(
      ...[-road.width / 2, 0, road.width / 2].map((u) =>
        ground(road, p.x - p.dz * u, p.z + p.dx * u),
      ),
    );
    add(
      {
        kind,
        appearance,
        ...(routeShield ? { routeShield } : {}),
        ...(panelColor ? { panelColor } : {}),
        pattern:
          kind === 'route'
            ? 'route-marker'
            : kind === 'speed'
              ? road.kind === 'motorway'
                ? 'freeway-speed'
                : 'street-speed'
              : kind === 'guide'
                ? routeGuide
                  ? 'route-guide'
                  : 'highway-overhead'
                : kind === 'exit'
                  ? 'highway-exit'
                  : 'attraction',
        evidence,
        roadId,
        ...(arrow ? { arrow } : {}),
        x,
        z,
        ground: y,
        dx: -dx,
        dz: -dz,
        lines,
        source,
        ...(overhead ? { span: road.width + 5 } : {}),
      },
      road,
    );
  };

  for (const [node, control] of controls) {
    if (!inside(node.x, node.z)) continue;
    for (const [kind, arms] of [
      ['stop', control.stops],
      ['yield', control.yields],
    ] as const)
      for (const arm of arms) {
        const offset = side * (arm.width / 2 + 1.05);
        const x = arm.x + arm.dx * 2.5 + arm.dz * offset,
          z = arm.z + arm.dz * 2.5 - arm.dx * offset;
        add(
          {
            kind,
            appearance,
            pattern: kind === 'yield' ? 'yield' : control.allWay ? 'all-way-stop' : 'minor-stop',
            evidence:
              control.source === 'mapped'
                ? [
                    kind === 'yield' ? 'highway=give_way' : 'highway=stop',
                    ...(control.allWay ? ['all-incoming-approaches-stop'] : []),
                  ]
                : [control.allWay ? 'local-road-junction' : 'minor-approach-to-arterial'],
            roadId: arm.road.feature.id,
            x,
            z,
            ground: ground(arm.road, x, z),
            dx: arm.dx,
            dz: arm.dz,
            lines: [],
            source: control.source,
            allWay: control.allWay,
          },
          arm.road,
        );
      }
  }

  // Only a ramp leaving a mainline supplies an inferred exit; a nearby overpass does not.
  const mainlines = network.roads.filter((r) => r.kind === 'motorway' && !isSurfaceLink(r));
  let comparisons = 0;
  for (const ramp of network.roads) {
    if (result.length >= maximum || comparisons >= 20_000) break;
    if (!isSurfaceLink(ramp) || ramp.kind !== 'motorway' || ramp.path.length < 12) continue;
    const start = ramp.path.points[0] as [number, number];
    let connection: { road: SurfaceRoad; along: number; distance: number } | undefined;
    for (const road of mainlines) {
      if (++comparisons > 20_000) break;
      if (
        (road.feature.layer ?? 0) !== (ramp.feature.layer ?? 0) ||
        !!road.feature.bridge !== !!ramp.feature.bridge
      )
        continue;
      const p = nearest(road.path, ...start);
      if (p.distance <= 3 && (!connection || p.distance < connection.distance))
        connection = { road, ...p };
    }
    const poi = (tile.pois ?? []).find(
      (p) =>
        (p.subclass ?? p.class) === 'motorway_junction' &&
        (p.layer ?? 0) === (ramp.feature.layer ?? 0) &&
        !!p.bridge === !!ramp.feature.bridge &&
        !p.tunnel &&
        Math.hypot(
          p.point[0] * context.tileSize - start[0],
          p.point[1] * context.tileSize - start[1],
        ) < 8,
    );
    const exit = ramp.feature.junctionRef ?? poi?.ref;
    const destination = ramp.feature.destination ?? poi?.exitTo;
    if (!connection && !exit && !destination) continue;
    const colours =
      ramp.feature.destinationColour?.split(';').map((v) => v.trim().toLowerCase()) ?? [];
    const destinations = destination?.split(';').map((v) => v.trim()) ?? [];
    const brown = (index: number): boolean =>
      (colours.length === 1 ? colours[0] : colours[index]) === 'brown';
    const attractions = destinations.filter((v, i) => v && brown(i));
    const evidence = [
      'motorway_link',
      ...(connection ? ['connected-departure'] : []),
      ...(ramp.feature.junctionRef ? ['junction:ref'] : poi?.ref ? ['motorway_junction.ref'] : []),
      ...(ramp.feature.destination
        ? ['destination']
        : poi?.exitTo
          ? ['motorway_junction.exit_to']
          : []),
      ...(ramp.feature.destinationRef ? ['destination:ref'] : []),
    ];
    const palette: Record<string, string> = {
      green: '#236346',
      blue: '#245a91',
      white: '#eeeadd',
      yellow: '#d8b84f',
    };
    const nonBrownColours = destinations.flatMap((v, i) =>
      v && !brown(i) ? [colours.length === 1 ? colours[0] : colours[i]] : [],
    );
    const uniformColour =
      nonBrownColours.length && nonBrownColours.every((c) => c === nonBrownColours[0])
        ? nonBrownColours[0]
        : undefined;
    const panelColor = uniformColour ? palette[uniformColour] : undefined;
    if (panelColor) evidence.push(`destination:colour=${uniformColour}`);
    const lines = [
      exitLabel(exit),
      ...(ramp.feature.destinationRef ? [ramp.feature.destinationRef] : []),
      ...destinations.filter((v, i) => v && !brown(i)),
    ]
      .filter(Boolean)
      .slice(0, 3);
    if (lines.length)
      at(
        ramp,
        Math.min(22, ramp.path.length / 3),
        1,
        'exit',
        lines,
        exit || destination ? 'mapped' : 'inferred',
        false,
        evidence,
        undefined,
        false,
        ramp.feature.id,
        panelColor,
      );
    if (attractions.length && !connection)
      at(
        ramp,
        Math.min(55, ramp.path.length * 0.65),
        1,
        'attraction',
        [...attractions.slice(0, 2), ...(exit ? [exitLabel(exit)] : [])],
        'mapped',
        false,
        [...evidence, 'destination:colour=brown'],
      );
    if (connection) {
      const tangent = sampleTerrainLine(connection.road.path, connection.along);
      const rampTangent = sampleTerrainLine(ramp.path, Math.min(8, ramp.path.length));
      const direction = tangent.dx * rampTangent.dx + tangent.dz * rampTangent.dz >= 0 ? 1 : -1;
      if (!connection.road.feature.oneway || direction === 1) {
        const side = (tangent.dx * rampTangent.dz - tangent.dz * rampTangent.dx) * direction;
        const arrow = Math.abs(side) > 0.05 ? (side > 0 ? 'right' : 'left') : undefined;
        if (lines.length)
          at(
            connection.road,
            connection.along - direction * 55,
            direction,
            'guide',
            lines,
            exit || destination ? 'mapped' : 'inferred',
            true,
            evidence,
            arrow,
            false,
            ramp.feature.id,
            panelColor,
          );
        if (attractions.length)
          at(
            connection.road,
            connection.along - direction * 100,
            direction,
            'attraction',
            [...attractions.slice(0, 2), ...(exit ? [exitLabel(exit)] : [])],
            'mapped',
            false,
            [...evidence, 'destination:colour=brown'],
            undefined,
            false,
            ramp.feature.id,
          );
      }
    }
  }

  for (const road of network.roads) {
    if (result.length >= maximum) break;
    if (road.kind === 'path' || road.kind === 'rail' || road.unpaved || isSurfaceLink(road))
      continue;
    const speed = postedSpeed(road.feature.maxspeed);
    const route = road.feature.ref ?? road.feature.name;
    const marker = resolveTerrainRouteMarker(road.feature, appearance, routeShields);
    const directions = road.feature.oneway ? [1] : [1, -1];
    for (const direction of directions) {
      if (marker)
        for (const d of stations(road.path, context.origin, 400, direction === 1 ? 120 : 320))
          at(
            road,
            d,
            direction,
            'route',
            [marker.marker.ref],
            'mapped',
            false,
            marker.evidence,
            undefined,
            false,
            road.feature.id,
            undefined,
            marker.marker,
          );
      if (speed)
        for (const d of stations(road.path, context.origin, 400, direction === 1 ? 70 : 230))
          at(road, d, direction, 'speed', speed, 'mapped', false, ['maxspeed']);
      if (road.kind === 'motorway' && (route || road.feature.destination)) {
        const lines = [
          ...(route ? [route] : []),
          ...(road.feature.destination?.split(';').filter(Boolean) ?? []),
        ].slice(0, 3);
        for (const d of stations(road.path, context.origin, 800, direction === 1 ? 180 : 580))
          at(
            road,
            d,
            direction,
            'guide',
            lines,
            'mapped',
            true,
            [
              ...(road.feature.ref ? ['ref'] : road.feature.name ? ['name'] : []),
              ...(road.feature.destination ? ['destination'] : []),
            ],
            'down',
            true,
          );
      }
    }
  }

  // Each junction names the two streets that form one of its corners: both on one corner post,
  // or (`mount: 'wall'`) a plate for each on the corner building's walls, standing on a low frame
  // where no wall is near. Where the style hangs names from mast arms, a signalized junction is
  // left to those (see surface-client).
  const names = appearance.streetNames;
  const lettered = streets.lettered;
  type Corner = ReturnType<typeof surfaceJunctionCorners>[number];
  type Arm = Corner['a'];
  /** A plate on the wall nearest the corner that runs along `arm`'s street and faces it. */
  const wallPlate = (corner: Corner, arm: Arm, name: string): SurfaceSign | undefined => {
    const width = streetNamePanelWidth(name, STREET_NAME_WALL);
    let best: { x: number; z: number; nx: number; nz: number; distance: number } | undefined;
    for (const facade of streets.facades?.(corner.x, corner.z, WALL_REACH) ?? []) {
      // Along the street, facing it, at most a front garden back from the carriageway.
      if (Math.abs(facade.tx * arm.dx + facade.tz * arm.dz) < 0.85) continue;
      const out = (arm.x - facade.x) * facade.nx + (arm.z - facade.z) * facade.nz;
      if (out < arm.width / 2 + 0.5 || out > arm.width / 2 + 10) continue;
      if (facade.length < width + 0.6 || (facade.height !== undefined && facade.height < 3.2))
        continue;
      // As near the corner as the whole plate fits on the wall.
      const along = Math.max(
        width / 2 + 0.3,
        Math.min(
          facade.length - width / 2 - 0.3,
          (corner.x - facade.x) * facade.tx + (corner.z - facade.z) * facade.tz,
        ),
      );
      const x = facade.x + facade.tx * along + facade.nx * 0.06,
        z = facade.z + facade.tz * along + facade.nz * 0.06;
      const distance = Math.hypot(x - corner.x, z - corner.z);
      // A party wall faces the next building, not the street.
      if (distance > WALL_REACH || blocked(x + facade.nx * 0.4, z + facade.nz * 0.4)) continue;
      if (!inside(x, z) || (best && best.distance <= distance)) continue;
      best = { x, z, nx: facade.nx, nz: facade.nz, distance };
    }
    if (!best) return undefined;
    return {
      kind: 'street-name',
      pattern: 'street-name-wall',
      mount: 'wall',
      appearance,
      evidence: ['name', 'facade'],
      roadId: arm.road.feature.id,
      x: best.x,
      z: best.z,
      ground: context.heightfield.sampleHeight(
        context.origin[0] + best.x,
        context.origin[1] + best.z,
      ),
      dx: best.nx,
      dz: best.nz,
      lines: [name],
      source: 'mapped',
    };
  };
  /** A low frame at the back of the footway, running out along `arm` from the corner. */
  const framePlate = (corner: Corner, arm: Arm, name: string): SurfaceSign | undefined => {
    const out = streetNamePanelWidth(name, STREET_NAME_WALL) / 2 + 0.6;
    const x = corner.x + arm.dx * out,
      z = corner.z + arm.dz * out;
    if (!inside(x, z) || blocked(x, z) || network.occupied(x, z, 0.4)) return undefined;
    return {
      kind: 'street-name',
      pattern: 'street-name-wall',
      mount: 'frame',
      appearance,
      evidence: ['name', 'junction-corner'],
      roadId: arm.road.feature.id,
      x,
      z,
      ground: ground(arm.road, x, z),
      dx: -arm.dz,
      dz: arm.dx,
      lines: [name],
      source: 'mapped',
    };
  };
  /** Both names at one corner of the junction, or undefined where no corner has room. */
  const nameCorner = (
    corners: readonly { corner: Corner; first: string; second: string }[],
  ): SurfaceSign[] | undefined => {
    if (names?.mount !== 'wall') {
      for (const { corner, first, second } of corners) {
        // A step in from the lamp's corner: on the sidewalk, near the curb ramp.
        const x = corner.x - Math.cos(corner.direction) * 1.1,
          z = corner.z - Math.sin(corner.direction) * 1.1;
        if (!inside(x, z) || blocked(x, z) || network.occupied(x, z, 0.5)) continue;
        const { a, b } = corner;
        return [
          {
            kind: 'street-name',
            pattern: 'street-name-blade',
            mount: 'post',
            appearance,
            evidence: ['name', 'junction-corner'],
            roadId: a.road.feature.id,
            x,
            z,
            ground: ground(a.road, x, z),
            // The lower panel runs along the first street; the upper one turns to the second.
            dx: -a.dz,
            dz: a.dx,
            bladeTurn: Math.atan2(b.dz, b.dx) - Math.atan2(a.dz, a.dx),
            lines: [first, second],
            source: 'mapped',
          },
        ];
      }
      return undefined;
    }
    // The corner whose buildings carry the most names wins; frames make up the rest.
    let best: { signs: SurfaceSign[]; walls: number } | undefined;
    for (const { corner, first, second } of corners) {
      const signs: SurfaceSign[] = [];
      let walls = 0;
      for (const [arm, name] of [
        [corner.a, first],
        [corner.b, second],
      ] as const) {
        const onWall = wallPlate(corner, arm, name);
        if (onWall) walls++;
        const sign = onWall ?? framePlate(corner, arm, name);
        if (sign) signs.push(sign);
      }
      if (signs.length === 2 && (!best || walls > best.walls)) best = { signs, walls };
      if (best?.walls === 2) break;
    }
    return best?.signs;
  };
  let posts = 0;
  const served: { pair: string; x: number; z: number }[] = [];
  if (names)
    for (const node of network.junctions) {
      if (posts >= Math.min(STREET_NAME_SIGNS_PER_TILE, maximum)) break;
      if (!inside(node.x, node.z) || (names.mastArms && controls.get(node)?.signal)) continue;
      // A post stands on the ground; skip junctions on or under a structure.
      if (node.arms.some((arm) => arm.road.feature.bridge || arm.road.feature.tunnel)) continue;
      const corners = surfaceJunctionCorners(node, sortedJunctionArms(node)).flatMap((corner) => {
        const first = postedStreetName(corner.a.road, names, lettered),
          second = postedStreetName(corner.b.road, names, lettered);
        return first && second && first !== second ? [{ corner, first, second }] : [];
      });
      if (!corners.length) continue;
      // World coordinates choose the first corner tried, so a junction in two tiles' buffers agrees.
      const start = Math.floor(
        surfaceHash(context.origin[0] + node.x, context.origin[1] + node.z) * corners.length,
      );
      const signs = nameCorner([...corners.slice(start), ...corners.slice(0, start)]);
      if (!signs) continue;
      // Divided roads can meet at neighboring nodes: one corner names the pair.
      const pair = [...new Set(signs.flatMap((sign) => sign.lines))].sort().join('\n');
      if (served.some((s) => s.pair === pair && Math.hypot(s.x - node.x, s.z - node.z) < 40))
        continue;
      served.push({ pair, x: node.x, z: node.z });
      result.push(...signs);
      posts++;
    }
  return result;
}
