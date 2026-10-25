/** Roadside and overhead sign placement from source semantics and bounded topology inference. */
import { sampleTerrainLine, type TerrainLinePath } from './line-path';
import type { TerrainPyramidTileLayerContext } from './pyramid-stream';
import {
  DEFAULT_ROAD_SIGN_PROFILE,
  roadSignExitLabel,
  type TerrainRoadSignProfile,
} from './road-sign-styles';
import { resolveTerrainRouteMarker, type TerrainRouteShieldLibrary } from './route-shields';
import type { TerrainSemanticTile } from './semantic-types';
import type { SurfaceControl } from './surface-controls';
import {
  isSurfaceLink,
  type SurfaceJunction,
  type SurfaceNetwork,
  type SurfaceRoad,
} from './surface-network';
import type { SurfaceSign } from './surface-sign-mesh';

/** Only literal posted limits are usable: no implicit country codes, conditional or variable limits. */
export function postedSpeed(value: string | undefined): [string, string] | undefined {
  const match = value?.trim().match(/^(\d+(?:\.\d+)?)\s*(mph|km\/h|kmh|kph)?$/i);
  if (!match || Number(match[1]) <= 0 || Number(match[1]) > 300) return undefined;
  return [String(Number(match[1])), match[2]?.toLowerCase() === 'mph' ? 'MPH' : 'KM/H'];
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
    if (result.length >= Math.min(48, maximum) || !inside(sign.x, sign.z)) return;
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
  return result;
}
