/** Small, batched sign faces with deterministic lettering; works in Node and workers. */
import { buildTextMesh, type FontLibrary } from '@bendyline/molen-materials/text';
import * as THREE from 'three';
import type { TerrainBoxPlacement, TerrainSurfaceMeshBuilder } from './linear-features';
import type { TerrainRoadSignPatternId } from './road-sign-patterns';
import { DEFAULT_ROAD_SIGN_PROFILE, type TerrainRoadSignProfile } from './road-sign-styles';
import type { TerrainRouteMarker, TerrainRouteShieldLibrary } from './route-shields';

export interface SurfaceSign {
  kind: 'stop' | 'yield' | 'speed' | 'guide' | 'exit' | 'attraction' | 'route';
  routeShield?: TerrainRouteMarker;
  pattern: TerrainRoadSignPatternId;
  /** Shared resolved country convention; source text and pattern identity remain separate. */
  appearance: Readonly<TerrainRoadSignProfile>;
  /** Uniform mapped destination colour, when provided. */
  panelColor?: string;
  /** Cues actually used; mapped describes the legend/control, not surveyed hardware placement. */
  evidence: string[];
  /** Source road identity when supplied by the semantic provider. */
  roadId?: string | number;
  /** Only attached when the connected road topology establishes a direction. */
  arrow?: 'down' | 'left' | 'right';
  x: number;
  z: number;
  /** Bottom of the support, in absolute world Y. */
  ground: number;
  /** Face normal toward approaching traffic. */
  dx: number;
  dz: number;
  lines: string[];
  source: 'mapped' | 'inferred';
  allWay?: boolean;
  /** Overhead gantry span; absent for roadside signs. */
  span?: number;
}

export function appendSurfaceSign(
  builder: TerrainSurfaceMeshBuilder,
  fixtures: TerrainBoxPlacement[],
  sign: SurfaceSign,
  fonts?: FontLibrary,
  font?: string,
  routeShields?: TerrainRouteShieldLibrary,
): void {
  const { x, z, dx, dz, ground } = sign;
  const appearance = sign.appearance ?? DEFAULT_ROAD_SIGN_PROFILE;
  const designs = sign.routeShield
    ? routeShields?.shields[sign.routeShield.network]?.variants
    : undefined;
  const route =
    designs?.[Math.min((sign.routeShield?.ref.length ?? 0) > 2 ? 1 : 0, designs.length - 1)];
  if (sign.kind === 'route' && !route) return;
  const circularSpeed = sign.kind === 'speed' && appearance.speedSign === 'circle';
  const panelColor =
    sign.panelColor ??
    (sign.kind === 'attraction'
      ? appearance.attractionColor
      : sign.span
        ? appearance.motorwayColor
        : appearance.exitColor);
  const panelLight = new THREE.Color(panelColor);
  const guideInk =
    panelLight.r * 0.2126 + panelLight.g * 0.7152 + panelLight.b * 0.0722 > 0.45
      ? '#303735'
      : '#eeeadd';
  const guide = sign.kind === 'guide' || sign.kind === 'exit' || sign.kind === 'attraction';
  const speedScale = sign.pattern === 'freeway-speed' ? 1.4 : 1;
  const width = route
    ? 1.1 * route.aspect
    : sign.span
      ? Math.min(8, sign.span - 1)
      : guide
        ? 3.4
        : sign.kind === 'speed'
          ? 0.85 * speedScale
          : 0.9;
  const height = route
    ? 1.1
    : circularSpeed
      ? width
      : sign.span
        ? 2.6
        : guide
          ? 1.8
          : sign.kind === 'speed'
            ? 1.15 * speedScale
            : 0.9;
  const y = ground + (sign.span ? 7.5 : guide ? 3.1 : sign.pattern === 'freeway-speed' ? 3 : 2.6);
  const yaw = Math.atan2(dx, dz);
  const box = (u: number, cy: number, w: number, h: number, depth: number): void => {
    fixtures.push({
      x: x + dz * u - (sign.span ? dx * 0.4 : 0),
      z: z - dx * u - (sign.span ? dz * 0.4 : 0),
      y: cy,
      yaw,
      size: [w, h, depth],
      color: '#9ca5a4',
    });
  };
  if (sign.span) {
    for (const side of [-1, 1]) {
      box((side * sign.span) / 2, (ground + y + 1.15) / 2, 0.28, y + 1.15 - ground, 0.28);
      box((side * sign.span) / 2, ground + 0.18, 0.8, 0.36, 0.8);
    }
    for (const rise of [-0.85, 0.85]) box(0, y + rise, sign.span, 0.16, 0.3);
    for (let u = -sign.span / 2; u <= sign.span / 2; u += 2) box(u, y, 0.12, 1.7, 0.3);
  } else {
    for (const u of guide ? [-width * 0.32, width * 0.32] : [0])
      box(u, (ground + y) / 2, 0.075, y - ground, 0.075);
  }
  const face = (
    points: readonly (readonly [number, number])[],
    depth: number,
    color: string,
  ): void => {
    builder.face(
      points.map(([u, v]) => [x + dz * u + dx * depth, y + v, z - dx * u + dz * depth] as const),
      new THREE.Color(color),
    );
  };
  const rect = (u: number, v: number, w: number, h: number, depth: number, color: string): void =>
    face(
      [
        [u - w / 2, v - h / 2],
        [u + w / 2, v - h / 2],
        [u + w / 2, v + h / 2],
        [u - w / 2, v + h / 2],
      ],
      depth,
      color,
    );
  const text = (value: string, cy: number, w: number, h: number, color: string, cx = 0): void => {
    if (!fonts || !value) return;
    const requested = font ?? appearance.font;
    const resolved = requested ? (fonts.roles?.[requested] ?? requested) : undefined;
    const mesh = buildTextMesh(value, fonts, {
      font:
        resolved && fonts.fonts[resolved] ? resolved : (fonts.roles?.highway ?? fonts.defaultFont),
      maxWidth: w,
      maxHeight: h,
      size: h * 2,
      align: 'center',
      verticalAlign: 'center',
      maxCharacters: 80,
    });
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const points: [number, number][] = [];
      for (let j = 0; j < 3; j++) {
        const index = (mesh.indices[i + j] as number) * 3;
        points.push([
          cx + (mesh.positions[index] as number),
          cy + (mesh.positions[index + 1] as number),
        ]);
      }
      face(points, 0.065, color);
    }
  };
  if (route) {
    route.layers.forEach((layer, n) => {
      for (let i = 0; i < layer.indices.length; i += 3) {
        const points = layer.indices
          .slice(i, i + 3)
          .map(
            (index) =>
              [
                (layer.positions[index * 2] as number) * width,
                (layer.positions[index * 2 + 1] as number) * height,
              ] as [number, number],
          );
        face(points, 0.055 + n * 0.00005, layer.color);
        if (n === 0) face([...points].reverse(), -0.055, '#a2aaa7');
      }
    });
    const label = (value: string, box: readonly number[], color: string): void =>
      text(
        value,
        (box[1] as number) * height,
        (box[2] as number) * width,
        (box[3] as number) * height,
        color,
        (box[0] as number) * width,
      );
    label(sign.routeShield?.ref ?? '', route.textBox, route.textColor);
    for (const legend of route.legends) label(legend.text, legend.box, legend.color);
    return;
  }
  const polygon = (scale: number): [number, number][] => {
    if (circularSpeed)
      return Array.from({ length: 32 }, (_, i) => {
        const angle = (i * Math.PI) / 16;
        return [Math.cos(angle) * width * 0.5 * scale, Math.sin(angle) * height * 0.5 * scale];
      });
    if (sign.kind === 'stop')
      return Array.from({ length: 8 }, (_, i) => {
        const angle = Math.PI / 8 + (i * Math.PI) / 4;
        return [Math.cos(angle) * width * 0.54 * scale, Math.sin(angle) * height * 0.54 * scale];
      });
    if (sign.kind === 'yield')
      return [
        [(-width / 2) * scale, (height / 2) * scale],
        [(width / 2) * scale, (height / 2) * scale],
        [0, (-height / 2) * scale],
      ];
    return [
      [(-width / 2) * scale, (-height / 2) * scale],
      [(width / 2) * scale, (-height / 2) * scale],
      [(width / 2) * scale, (height / 2) * scale],
      [(-width / 2) * scale, (height / 2) * scale],
    ];
  };
  const edge = polygon(1);
  face([...edge].reverse(), -0.055, '#a2aaa7');
  for (let i = 0; i < edge.length; i++) {
    const a = edge[i] as [number, number],
      b = edge[(i + 1) % edge.length] as [number, number];
    builder.face(
      [
        [x + dz * a[0] - dx * 0.055, y + a[1], z - dx * a[0] - dz * 0.055],
        [x + dz * b[0] - dx * 0.055, y + b[1], z - dx * b[0] - dz * 0.055],
        [x + dz * b[0] + dx * 0.055, y + b[1], z - dx * b[0] + dz * 0.055],
        [x + dz * a[0] + dx * 0.055, y + a[1], z - dx * a[0] + dz * 0.055],
      ],
      new THREE.Color('#a2aaa7'),
    );
  }
  face(
    edge,
    0.055,
    sign.kind === 'yield' || circularSpeed ? '#bd3027' : guide ? guideInk : '#eeeadd',
  );
  face(
    polygon(sign.kind === 'yield' ? 0.76 : circularSpeed ? 0.78 : 0.93),
    0.058,
    sign.kind === 'stop'
      ? '#bd3027'
      : guide
        ? panelColor
        : sign.kind === 'speed' && !circularSpeed
          ? '#303735'
          : '#eeeadd',
  );
  if (sign.kind === 'speed' && !circularSpeed)
    rect(0, 0, width * 0.87, height * 0.91, 0.061, '#eeeadd');
  if (sign.kind === 'stop') {
    text(appearance.stopLabel, 0, width * 0.77, height * 0.3, '#eeeadd');
    if (sign.allWay && appearance.allWayLabel) {
      rect(0, -0.7, 0.85, 0.27, 0.055, '#eeeadd');
      rect(0, -0.7, 0.8, 0.22, 0.058, '#bd3027');
      text(appearance.allWayLabel, -0.7, 0.72, 0.12, '#eeeadd');
    }
  } else if (sign.kind === 'yield') {
    const words = appearance.yieldLabel.split('\n').filter(Boolean);
    words.forEach((word, i) => {
      text(word, words.length > 1 ? 0.23 - i * 0.17 : 0.14, 0.5, 0.13, '#bd3027');
    });
  } else if (circularSpeed) {
    const unit = sign.lines[1] ?? '';
    const showUnit = appearance.showSpeedUnit || unit !== appearance.speedUnit;
    text(sign.lines[0] ?? '', showUnit ? height * 0.07 : 0, width * 0.62, height * 0.38, '#303735');
    if (showUnit) text(unit, -height * 0.24, width * 0.5, height * 0.1, '#303735');
  } else if (sign.kind === 'speed') {
    text('SPEED', 0.37 * speedScale, 0.67 * speedScale, 0.13 * speedScale, '#303735');
    text('LIMIT', 0.18 * speedScale, 0.67 * speedScale, 0.13 * speedScale, '#303735');
    text(sign.lines[0] ?? '', -0.1 * speedScale, 0.66 * speedScale, 0.32 * speedScale, '#303735');
    text(sign.lines[1] ?? '', -0.4 * speedScale, 0.61 * speedScale, 0.11 * speedScale, '#303735');
  } else {
    const lines = sign.lines.slice(0, 3);
    lines.forEach((line, i) => {
      text(
        line,
        height * (0.3 - i * (sign.arrow ? 0.21 : 0.29)),
        width * 0.88,
        height * 0.17,
        guideInk,
      );
    });
    if (sign.arrow) {
      // A separate lower row prevents arrows from colliding with a third destination line.
      const v = -height * 0.34,
        scale = height * 0.1;
      const angle =
        sign.arrow === 'down' ? 0 : sign.arrow === 'right' ? Math.PI * 0.75 : -Math.PI * 0.75;
      const arrow: [number, number][] = [
        [-0.2, 1],
        [0.2, 1],
        [0.2, 0],
        [0.8, 0],
        [0, -1],
        [-0.8, 0],
        [-0.2, 0],
      ];
      // Concave silhouette: use two convex faces so batching keeps correct triangulation.
      const transformed = arrow.map(([u, w]): [number, number] => [
        (u * Math.cos(angle) - w * Math.sin(angle)) * scale,
        v + (u * Math.sin(angle) + w * Math.cos(angle)) * scale,
      ]);
      face(
        [
          transformed[0] as [number, number],
          transformed[1] as [number, number],
          transformed[2] as [number, number],
          transformed[6] as [number, number],
        ],
        0.065,
        guideInk,
      );
      face(
        [
          transformed[3] as [number, number],
          transformed[4] as [number, number],
          transformed[5] as [number, number],
        ],
        0.065,
        guideInk,
      );
    }
  }
}
