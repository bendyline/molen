/** Small, batched sign faces with deterministic lettering; works in Node and workers. */
import { buildTextMesh, type FontLibrary } from '@bendyline/molen-materials/text';
import * as THREE from 'three';
import type { TerrainBoxPlacement, TerrainSurfaceMeshBuilder } from './linear-features';
import type { TerrainRoadSignPatternId } from './road-sign-patterns';
import { DEFAULT_ROAD_SIGN_PROFILE, type TerrainRoadSignProfile } from './road-sign-styles';
import type { TerrainRouteMarker, TerrainRouteShieldLibrary } from './route-shields';

export interface SurfaceSign {
  kind: 'stop' | 'yield' | 'speed' | 'guide' | 'exit' | 'attraction' | 'route' | 'street-name';
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
  /** A street name hung from a signal mast arm: panel center height above `ground`; no support. */
  hang?: number;
  /**
   * A pair of street-name blades on one post: the upper blade (`lines[1]`) turns this far (radians,
   * as `atan2(dz, dx)` turns) from the lower one, which faces `dx, dz` and names `lines[0]`.
   */
  bladeTurn?: number;
}

/** Street-name panel proportions, in meters: lettering em size, panel height, side padding, width. */
export interface StreetNamePanel {
  em: number;
  height: number;
  padding: number;
  minWidth: number;
  maxWidth: number;
}

/** Overhead panel on a signal mast arm: capitals about 23 cm, a little over the MUTCD's 8 inches. */
export const STREET_NAME_MAST: Readonly<StreetNamePanel> = {
  em: 0.32,
  height: 0.5,
  padding: 0.18,
  minWidth: 1.4,
  maxWidth: 4,
};

/** Corner blade: capitals about 12 cm, as on a local street's 6-inch blade. */
export const STREET_NAME_BLADE: Readonly<StreetNamePanel> = {
  em: 0.17,
  height: 0.22,
  padding: 0.08,
  minWidth: 0.6,
  maxWidth: 1.5,
};

/** Blade centers above the post's footing; the post stops under the lower blade. */
const BLADE_HEIGHTS = [2.9, 3.14] as const;

/**
 * A panel's width for its legend, from Overpass-like advances so the planner needs no font (within a
 * few percent for street names). Longer legends shrink to fit the widest panel.
 */
export function streetNamePanelWidth(legend: string, panel: Readonly<StreetNamePanel>): number {
  let advance = 0;
  for (const c of legend)
    advance +=
      c === ' '
        ? 0.25
        : /[iljtfrI.,'1]/.test(c)
          ? 0.33
          : /[mwMW]/.test(c)
            ? 0.85
            : /[A-Z]/.test(c)
              ? 0.66
              : /\d/.test(c)
                ? 0.6
                : 0.56;
  return Math.min(panel.maxWidth, Math.max(panel.minWidth, advance * panel.em + panel.padding * 2));
}

/** The library font a sign letters with: the requested role or face, else the highway role. */
function signFontId(
  fonts: FontLibrary,
  appearance: Readonly<TerrainRoadSignProfile>,
  font?: string,
): string {
  const requested = font ?? appearance.font;
  const resolved = requested ? (fonts.roles?.[requested] ?? requested) : undefined;
  return resolved && fonts.fonts[resolved] ? resolved : (fonts.roles?.highway ?? fonts.defaultFont);
}

/** Lettering as 2D triangles centered on the origin, Y up. */
function letterTriangles(
  value: string,
  fonts: FontLibrary,
  font: string,
  options: { size: number; maxWidth: number; maxHeight: number },
): [number, number][][] {
  const mesh = buildTextMesh(value, fonts, {
    font,
    ...options,
    align: 'center',
    verticalAlign: 'center',
    maxCharacters: 80,
  });
  const triangles: [number, number][][] = [];
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const points: [number, number][] = [];
    for (let j = 0; j < 3; j++) {
      const index = (mesh.indices[i + j] as number) * 3;
      points.push([mesh.positions[index] as number, mesh.positions[index + 1] as number]);
    }
    triangles.push(points);
  }
  return triangles;
}

/**
 * Street names: a single-faced panel hung from a mast arm (`hang`), or a post carrying two
 * double-faced blades (`bladeTurn`). Faces go to `builder`; the post and straps are fixtures.
 */
function appendStreetNameSign(
  builder: TerrainSurfaceMeshBuilder,
  fixtures: TerrainBoxPlacement[],
  sign: SurfaceSign,
  fonts?: FontLibrary,
  font?: string,
): void {
  const appearance = sign.appearance ?? DEFAULT_ROAD_SIGN_PROFILE;
  const style = appearance.streetNames;
  const panelColor = new THREE.Color(style?.panelColor ?? appearance.exitColor);
  const ink = new THREE.Color(style?.inkColor ?? '#eeeadd');
  const back = new THREE.Color('#a2aaa7');
  const fontId = fonts ? signFontId(fonts, appearance, font) : undefined;
  const { x, z, ground } = sign;
  const panel = (
    legend: string,
    nx: number,
    nz: number,
    y: number,
    size: Readonly<StreetNamePanel>,
    twoFaced: boolean,
  ): number => {
    const width = streetNamePanelWidth(legend, size),
      height = size.height,
      half = 0.015,
      border = Math.min(0.03, height * 0.08);
    // `mirror` draws the far face: u and depth negate, so it reads (and winds) from behind.
    const quad = (
      w: number,
      h: number,
      depth: number,
      color: THREE.Color,
      mirror: number,
    ): void => {
      const corners: [number, number][] = [
        [-w / 2, -h / 2],
        [w / 2, -h / 2],
        [w / 2, h / 2],
        [-w / 2, h / 2],
      ];
      builder.face(
        corners.map(
          ([u, v]) =>
            [
              x + nz * u * mirror + nx * depth * mirror,
              y + v,
              z - nx * u * mirror + nz * depth * mirror,
            ] as const,
        ),
        color,
      );
    };
    const letters =
      fonts && fontId && legend
        ? letterTriangles(legend, fonts, fontId, {
            size: size.em,
            maxWidth: width - size.padding * 2,
            maxHeight: height - border * 4,
          })
        : [];
    for (const mirror of twoFaced ? [1, -1] : [1]) {
      quad(width, height, half, ink, mirror);
      quad(width - border * 2, height - border * 2, half + 0.003, panelColor, mirror);
      for (const triangle of letters)
        builder.face(
          triangle.map(
            ([u, v]) =>
              [
                x + nz * u * mirror + nx * (half + 0.007) * mirror,
                y + v,
                z - nx * u * mirror + nz * (half + 0.007) * mirror,
              ] as const,
          ),
          ink,
        );
    }
    if (!twoFaced) {
      quad(width, height, half, back, -1);
      // Edges close the gap between the two faces when seen side-on.
      for (const [w, h, cu, cv] of [
        [width, 0, 0, height / 2],
        [width, 0, 0, -height / 2],
        [0, height, width / 2, 0],
        [0, height, -width / 2, 0],
      ] as const) {
        const a: [number, number] = [cu - w / 2, cv - h / 2],
          b: [number, number] = [cu + w / 2, cv + h / 2];
        builder.face(
          [
            [x + nz * a[0] - nx * half, y + a[1], z - nx * a[0] - nz * half],
            [x + nz * b[0] - nx * half, y + b[1], z - nx * b[0] - nz * half],
            [x + nz * b[0] + nx * half, y + b[1], z - nx * b[0] + nz * half],
            [x + nz * a[0] + nx * half, y + a[1], z - nx * a[0] + nz * half],
          ],
          back,
        );
      }
    }
    return width;
  };
  if (sign.hang !== undefined) {
    const y = ground + sign.hang;
    const width = panel(sign.lines[0] ?? '', sign.dx, sign.dz, y, STREET_NAME_MAST, false);
    // Two straps up into the mast arm above.
    for (const u of [-1, 1])
      fixtures.push({
        x: x + sign.dz * u * (width / 2 - 0.25),
        z: z - sign.dx * u * (width / 2 - 0.25),
        y: y + STREET_NAME_MAST.height / 2 + 0.07,
        yaw: Math.atan2(sign.dx, sign.dz),
        size: [0.05, 0.16, 0.04],
        color: '#626d73',
      });
    return;
  }
  const turn = sign.bladeTurn ?? Math.PI / 2;
  const upper: [number, number] = [
    sign.dx * Math.cos(turn) - sign.dz * Math.sin(turn),
    sign.dx * Math.sin(turn) + sign.dz * Math.cos(turn),
  ];
  // The blades sit on the post, not around it: a post through them would hide the middle
  // letter. A saddle under the lower blade, and a bracket in the gap between the two.
  const half = STREET_NAME_BLADE.height / 2;
  const post = ground + BLADE_HEIGHTS[0] - half;
  const yaw = Math.atan2(sign.dx, sign.dz);
  fixtures.push(
    { x, z, y: (ground + post) / 2, yaw, size: [0.075, post - ground, 0.075], color: '#9ca5a4' },
    { x, z, y: post - 0.02, yaw, size: [0.1, 0.05, 0.1], color: '#9ca5a4' },
    {
      x,
      z,
      y: ground + (BLADE_HEIGHTS[0] + BLADE_HEIGHTS[1]) / 2,
      yaw,
      size: [0.07, BLADE_HEIGHTS[1] - BLADE_HEIGHTS[0] - half * 2 + 0.04, 0.07],
      color: '#9ca5a4',
    },
  );
  panel(sign.lines[0] ?? '', sign.dx, sign.dz, ground + BLADE_HEIGHTS[0], STREET_NAME_BLADE, true);
  panel(
    sign.lines[1] ?? '',
    upper[0],
    upper[1],
    ground + BLADE_HEIGHTS[1],
    STREET_NAME_BLADE,
    true,
  );
}

export function appendSurfaceSign(
  builder: TerrainSurfaceMeshBuilder,
  fixtures: TerrainBoxPlacement[],
  sign: SurfaceSign,
  fonts?: FontLibrary,
  font?: string,
  routeShields?: TerrainRouteShieldLibrary,
): void {
  if (sign.kind === 'street-name') {
    appendStreetNameSign(builder, fixtures, sign, fonts, font);
    return;
  }
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
    const mesh = buildTextMesh(value, fonts, {
      font: signFontId(fonts, appearance, font),
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
