// Street lamps and car beams as a lighting field. Every lit surface near the camera takes the
// diffuse light of each nearby street lamp, and of a few car headlight beams, without a three
// light for any of them.
//
// Three lights every lit fragment with every light in the scene, through a full physical BRDF.
// Sixteen street lamps and eight headlight beams as point and spot lights were the whole cost of
// night on a residential street: 14 ms of a 36 ms frame on the GPU (1440x900), and 5 ms of the
// main thread for their uniforms, as the renderer switched programs across 1,900 draws. Being
// the nearest sixteen, they also switched on one by one, a whole wall at a time, ahead of a
// driver.
//
// Here the host hands over the lamps within a few hundred meters (setLamps). They go into one
// small float texture: a square grid over them, each cell listing the lamps whose reach touches
// it, and the lamps themselves. A lit fragment finds its cell and adds those lamps' diffuse
// light, with the falloff of a three point light with the same reach (decay 2, windowed to zero
// at the reach), and the lamps fade out with distance from the camera (and the point it looks
// at), so none switches on. Beams, which move every frame, are a short uniform array beside it
// (setBeams). Each renderer keeps one field for its lifetime, and every lit shader it builds reads
// it; a strength of 0 skips it, so nightfall rebuilds no shader. On WebGL a hook on three's
// lighting chunks adds it (installed with the cloud shadows); on WebGPU a light node in the scene
// does (three/webgpu-lamp-field.ts).

import * as THREE from 'three';

/** Grid cells along each side. */
export const LAMP_FIELD_CELLS = 48;
/** Lamps a cell lists; past that the ones farthest from the cell are left out of it. */
export const LAMP_FIELD_SLOTS = 16;
/** Lamps the field holds. */
export const LAMP_FIELD_MAX_LAMPS = 1024;
/** Beams the field holds. */
export const LAMP_FIELD_MAX_BEAMS = 8;
/** Texels a cell's list takes (four indices each). */
export const LAMP_FIELD_CELL_TEXELS: number = LAMP_FIELD_SLOTS / 4;
/** Texture width: one row of cells. Lamps fill the rows below the grid, this many to a row. */
export const LAMP_FIELD_WIDTH: number = LAMP_FIELD_CELLS * LAMP_FIELD_CELL_TEXELS;
const LAMP_ROWS = Math.ceil(LAMP_FIELD_MAX_LAMPS / LAMP_FIELD_WIDTH);
export const LAMP_FIELD_HEIGHT: number = LAMP_FIELD_CELLS + LAMP_ROWS;
/** Cells are never smaller than this, m, however close together the lamps. */
const MIN_CELL = 4;

export interface LampFieldUniforms {
  /** The grid's cell lists (rows 0..CELLS-1), then the lamps: x, y, z from the anchor, strength. */
  molenLampData: { value: THREE.DataTexture };
  /** The anchor in render space (xyz), and the lamps' strength in candela (w, 0: off). */
  molenLampAnchor: { value: THREE.Vector4 };
  /** The grid's corner (x, z from the anchor), cell size, and a lamp's reach, m. */
  molenLampGrid: { value: THREE.Vector4 };
  /** The camera's x, z and the point it looks at, from the anchor. */
  molenLampView: { value: THREE.Vector4 };
  /** Lamps fade out from x to y meters away (from the camera, or z times from the view's focus). */
  molenLampFade: { value: THREE.Vector4 };
  /** The lamps' light color, linear. */
  molenLampColor: { value: THREE.Color };
  /**
   * Beams, two vectors each: position from the anchor and intensity in candela (0 ends the
   * list); direction and the cosine of the cone's edge.
   */
  molenLampBeams: { value: THREE.Vector4[] };
  /** The beams' color, linear, and their reach (w), m. */
  molenLampBeamColor: { value: THREE.Vector4 };
}

export interface LampFieldBeam {
  /** Render-space position. */
  position: readonly [number, number, number];
  /** Unit direction, render-space axes. */
  direction: readonly [number, number, number];
  /** Candela on the axis. */
  intensity: number;
}

export interface LampFieldView {
  /**
   * The frame the positions below (and the beams') are in: an object under the scene, which may
   * move (a floating origin) but not turn or scale while the lamps it measured stand. Absent,
   * they are render space.
   */
  frame?: THREE.Object3D;
  /** The point the lamps' offsets are measured from (setLamps). */
  anchor: readonly [number, number, number];
  /** The camera's position and the point it looks at, for the fade. */
  eye: readonly [number, number, number];
  focus: readonly [number, number, number];
  /** Candela of a lamp of strength 1 (0 turns the lamps off). */
  intensity: number;
}

export interface LampFieldOptions {
  /** A lamp lights nothing farther than this, m. */
  reach?: number;
  /** Lamps fade out between these distances from the camera, m. */
  fadeFrom?: number;
  fadeTo?: number;
  /** A lamp's distance from the view's focus counts this many times over. */
  focusWeight?: number;
  color?: THREE.ColorRepresentation;
  beamColor?: THREE.ColorRepresentation;
  beamReach?: number;
  /** Cosine of the angle off a beam's axis where it has faded to nothing. */
  beamCone?: number;
}

export class LampField {
  readonly uniforms: LampFieldUniforms;
  readonly reach: number;
  readonly fadeTo: number;
  readonly focusWeight: number;
  private readonly data: Float32Array;
  private readonly texture: THREE.DataTexture;
  private readonly beamCone: number;
  /** Where the fade begins, as a share of where it ends. */
  private readonly fadeShare: number;
  private lampCount = 0;
  private frame: THREE.Object3D | undefined;
  /** The anchor in its frame (setView). */
  private readonly anchorAt = new THREE.Vector3();
  private readonly point = new THREE.Vector3();
  /** Each cell's lamps, nearest the cell's middle first, and how far each is. */
  private readonly slotIndex = new Int32Array(
    LAMP_FIELD_CELLS * LAMP_FIELD_CELLS * LAMP_FIELD_SLOTS,
  );
  private readonly slotDistance = new Float32Array(
    LAMP_FIELD_CELLS * LAMP_FIELD_CELLS * LAMP_FIELD_SLOTS,
  );
  private readonly slotCount = new Int32Array(LAMP_FIELD_CELLS * LAMP_FIELD_CELLS);

  constructor(options: LampFieldOptions = {}) {
    this.reach = options.reach ?? 42;
    this.fadeTo = options.fadeTo ?? 300;
    this.focusWeight = options.focusWeight ?? 1.2;
    this.beamCone = options.beamCone ?? 0.5;
    const fadeFrom = options.fadeFrom ?? this.fadeTo * 0.7;
    this.fadeShare = fadeFrom / this.fadeTo;
    if (
      !(this.reach > 0) ||
      !(this.fadeTo > fadeFrom) ||
      !(fadeFrom >= 0) ||
      !(this.focusWeight > 0) ||
      !(this.beamCone >= -1 && this.beamCone < 1)
    )
      throw new RangeError('Lamp field reach, fade and beam cone must be positive and ordered');
    this.data = new Float32Array(LAMP_FIELD_WIDTH * LAMP_FIELD_HEIGHT * 4);
    this.texture = new THREE.DataTexture(
      this.data,
      LAMP_FIELD_WIDTH,
      LAMP_FIELD_HEIGHT,
      THREE.RGBAFormat,
      THREE.FloatType,
    );
    this.texture.name = 'molen:lamp-field';
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;
    this.clearCells();
    this.texture.needsUpdate = true;
    const color = new THREE.Color(options.beamColor ?? '#fff1dc');
    this.uniforms = {
      molenLampData: { value: this.texture },
      molenLampAnchor: { value: new THREE.Vector4() },
      molenLampGrid: { value: new THREE.Vector4(0, 0, 1, this.reach) },
      molenLampView: { value: new THREE.Vector4() },
      molenLampFade: { value: new THREE.Vector4(fadeFrom, this.fadeTo, this.focusWeight, 0) },
      molenLampColor: { value: new THREE.Color(options.color ?? '#ffe1a1') },
      molenLampBeams: {
        value: Array.from({ length: LAMP_FIELD_MAX_BEAMS * 2 }, () => new THREE.Vector4()),
      },
      molenLampBeamColor: {
        value: new THREE.Vector4(color.r, color.g, color.b, options.beamReach ?? 55),
      },
    };
  }

  /** Lamps held by the last setLamps. */
  get lamps(): number {
    return this.lampCount;
  }

  /**
   * Replace the lamps: x, y, z and strength for each, in meters from the anchor of the views to
   * come (setView), in its frame's axes. At most LAMP_FIELD_MAX_LAMPS: a caller with more keeps
   * the nearest, and passes the distance it stopped at as `fadeTo`, so that the farthest it kept
   * fade out rather than end. A caller may also reach farther than the default `fadeTo` (a view
   * from the air), handing over the lamps out to there.
   */
  setLamps(
    lamps: ArrayLike<number>,
    count: number = Math.floor(lamps.length / 4),
    fadeTo: number = this.fadeTo,
  ): void {
    if (!(count >= 0) || count * 4 > lamps.length)
      throw new RangeError('Lamp count must fit the lamp array');
    if (!(fadeTo > 0)) throw new RangeError('Lamp fade distance must be positive');
    this.uniforms.molenLampFade.value.x = fadeTo * this.fadeShare;
    this.uniforms.molenLampFade.value.y = fadeTo;
    const n = Math.min(count, LAMP_FIELD_MAX_LAMPS);
    this.lampCount = n;
    this.clearCells();
    const data = this.data;
    const base = LAMP_FIELD_CELLS * LAMP_FIELD_WIDTH * 4;
    data.fill(0, base);
    if (n === 0) {
      this.texture.needsUpdate = true;
      return;
    }
    let minX = Infinity,
      minZ = Infinity,
      maxX = -Infinity,
      maxZ = -Infinity;
    for (let i = 0; i < n; i++) {
      const x = lamps[i * 4] as number,
        y = lamps[i * 4 + 1] as number,
        z = lamps[i * 4 + 2] as number,
        strength = lamps[i * 4 + 3] as number;
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z) || !(strength >= 0))
        throw new RangeError('Lamp positions must be finite and strengths nonnegative');
      const at = base + i * 4;
      data[at] = x;
      data[at + 1] = y;
      data[at + 2] = z;
      data[at + 3] = strength;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    }
    const reach = this.reach;
    const cell = Math.max(
      MIN_CELL,
      (Math.max(maxX - minX, maxZ - minZ) + 2 * reach) / LAMP_FIELD_CELLS,
    );
    const cornerX = (minX + maxX) / 2 - (cell * LAMP_FIELD_CELLS) / 2;
    const cornerZ = (minZ + maxZ) / 2 - (cell * LAMP_FIELD_CELLS) / 2;
    this.uniforms.molenLampGrid.value.set(cornerX, cornerZ, cell, reach);
    const last = LAMP_FIELD_CELLS - 1;
    for (let i = 0; i < n; i++) {
      const x = data[base + i * 4] as number,
        z = data[base + i * 4 + 2] as number;
      const fromX = Math.max(0, Math.floor((x - reach - cornerX) / cell));
      const toX = Math.min(last, Math.floor((x + reach - cornerX) / cell));
      const fromZ = Math.max(0, Math.floor((z - reach - cornerZ) / cell));
      const toZ = Math.min(last, Math.floor((z + reach - cornerZ) / cell));
      for (let cz = fromZ; cz <= toZ; cz++)
        for (let cx = fromX; cx <= toX; cx++) {
          // Whether the lamp reaches the cell at all, and how far it is from the cell's middle.
          const left = cornerX + cx * cell,
            top = cornerZ + cz * cell;
          const dx = Math.max(left - x, 0, x - left - cell);
          const dz = Math.max(top - z, 0, z - top - cell);
          if (dx * dx + dz * dz >= reach * reach) continue;
          this.insert(
            cz * LAMP_FIELD_CELLS + cx,
            i,
            Math.hypot(x - left - cell / 2, z - top - cell / 2),
          );
        }
    }
    for (let c = 0; c < LAMP_FIELD_CELLS * LAMP_FIELD_CELLS; c++) {
      const count = this.slotCount[c] as number;
      const cx = c % LAMP_FIELD_CELLS,
        cz = Math.floor(c / LAMP_FIELD_CELLS);
      const at = (cz * LAMP_FIELD_WIDTH + cx * LAMP_FIELD_CELL_TEXELS) * 4;
      for (let s = 0; s < count; s++)
        data[at + s] = this.slotIndex[c * LAMP_FIELD_SLOTS + s] as number;
    }
    this.texture.needsUpdate = true;
  }

  /** Where the lamps are measured from and seen from, and how bright they are. Every frame. */
  setView(view: LampFieldView): void {
    const [ax, ay, az] = view.anchor;
    if (![ax, ay, az, ...view.eye, ...view.focus, view.intensity].every(Number.isFinite))
      throw new RangeError('Lamp field view must be finite');
    this.frame = view.frame;
    this.anchorAt.set(ax, ay, az);
    this.uniforms.molenLampAnchor.value.w = Math.max(0, view.intensity);
    this.uniforms.molenLampView.value.set(
      view.eye[0] - ax,
      view.eye[2] - az,
      view.focus[0] - ax,
      view.focus[2] - az,
    );
    this.prepare();
  }

  /**
   * Place the anchor in render space from its frame's current matrix. The renderer calls this
   * before each drawing, after any floating-origin shift, so the lamps never lag the scene by a
   * frame.
   */
  prepare(): void {
    this.point.copy(this.anchorAt);
    if (this.frame !== undefined) {
      this.frame.updateWorldMatrix(true, false);
      this.point.applyMatrix4(this.frame.matrixWorld);
    }
    const anchor = this.uniforms.molenLampAnchor.value;
    anchor.x = this.point.x;
    anchor.y = this.point.y;
    anchor.z = this.point.z;
  }

  /**
   * Replace the beams (at most LAMP_FIELD_MAX_BEAMS; the rest are dropped). Positions are in the
   * frame of the latest setView, whose anchor they are measured against.
   */
  setBeams(beams: readonly LampFieldBeam[]): void {
    const anchor = this.anchorAt;
    const slots = this.uniforms.molenLampBeams.value;
    let n = 0;
    for (const beam of beams) {
      if (n === LAMP_FIELD_MAX_BEAMS) break;
      if (!(beam.intensity > 0)) continue;
      const [x, y, z] = beam.position;
      const [dx, dy, dz] = beam.direction;
      if (![x, y, z, dx, dy, dz, beam.intensity].every(Number.isFinite))
        throw new RangeError('Beam must be finite');
      const length = Math.hypot(dx, dy, dz) || 1;
      (slots[n * 2] as THREE.Vector4).set(x - anchor.x, y - anchor.y, z - anchor.z, beam.intensity);
      (slots[n * 2 + 1] as THREE.Vector4).set(dx / length, dy / length, dz / length, this.beamCone);
      n++;
    }
    for (let i = n; i < LAMP_FIELD_MAX_BEAMS; i++) (slots[i * 2] as THREE.Vector4).w = 0;
  }

  /** Light nothing: no lamps, no beams, strength 0. */
  clear(): void {
    this.setLamps([], 0);
    this.setBeams([]);
    this.uniforms.molenLampAnchor.value.w = 0;
    this.frame = undefined;
  }

  dispose(): void {
    this.texture.dispose();
  }

  private clearCells(): void {
    this.slotCount.fill(0);
    this.data.fill(-1, 0, LAMP_FIELD_CELLS * LAMP_FIELD_WIDTH * 4);
  }

  /** Keep a cell's nearest lamps, nearest first. */
  private insert(cell: number, lamp: number, distance: number): void {
    const start = cell * LAMP_FIELD_SLOTS;
    let count = this.slotCount[cell] as number;
    if (count === LAMP_FIELD_SLOTS) {
      if (distance >= (this.slotDistance[start + count - 1] as number)) return;
      count--;
    }
    let s = count;
    while (s > 0 && (this.slotDistance[start + s - 1] as number) > distance) {
      this.slotDistance[start + s] = this.slotDistance[start + s - 1] as number;
      this.slotIndex[start + s] = this.slotIndex[start + s - 1] as number;
      s--;
    }
    this.slotDistance[start + s] = distance;
    this.slotIndex[start + s] = lamp;
    this.slotCount[cell] = count + 1;
  }
}

export const LAMP_FIELD_GLSL: string = /* glsl */ `
uniform highp sampler2D molenLampData;
uniform vec4 molenLampAnchor;
uniform vec4 molenLampGrid;
uniform vec4 molenLampView;
uniform vec4 molenLampFade;
uniform vec3 molenLampColor;
uniform vec4 molenLampBeams[ ${LAMP_FIELD_MAX_BEAMS * 2} ];
uniform vec4 molenLampBeamColor;
// A point light's falloff with its reach (three's getDistanceAttenuation, decay 2), from the
// squared distance.
float molenLampFalloff( float distanceSquared, float reach ) {
	float ratio = distanceSquared / ( reach * reach );
	float window = clamp( 1.0 - ratio * ratio, 0.0, 1.0 );
	return window * window / max( distanceSquared, 0.01 );
}
// Light (irradiance) from the street lamps and beams near a view-space point facing a view-space
// normal.
vec3 molenLampLight( vec3 viewPosition, vec3 viewNormal ) {
	vec3 light = vec3( 0.0 );
	if ( molenLampAnchor.w <= 0.0 && molenLampBeams[ 0 ].w <= 0.0 ) return light;
	vec3 local = cameraPosition + ( vec4( viewPosition, 0.0 ) * viewMatrix ).xyz - molenLampAnchor.xyz;
	vec3 normal = ( vec4( viewNormal, 0.0 ) * viewMatrix ).xyz;
	vec2 cellAt = floor( ( local.xz - molenLampGrid.xy ) / molenLampGrid.z );
	if ( molenLampAnchor.w > 0.0 && all( greaterThanEqual( cellAt, vec2( 0.0 ) ) ) &&
		all( lessThan( cellAt, vec2( ${LAMP_FIELD_CELLS}.0 ) ) ) ) {
		ivec2 cell = ivec2( cellAt );
		float lamps = 0.0;
		for ( int t = 0; t < ${LAMP_FIELD_CELL_TEXELS}; t ++ ) {
			vec4 slots = texelFetch( molenLampData, ivec2( cell.x * ${LAMP_FIELD_CELL_TEXELS} + t, cell.y ), 0 );
			if ( slots.x < 0.0 ) break;
			for ( int s = 0; s < 4; s ++ ) {
				float index = slots[ s ];
				if ( index < 0.0 ) break;
				int i = int( index );
				vec4 lamp = texelFetch( molenLampData, ivec2( i % ${LAMP_FIELD_WIDTH}, ${LAMP_FIELD_CELLS} + i / ${LAMP_FIELD_WIDTH} ), 0 );
				vec3 toLamp = lamp.xyz - local;
				float distanceSquared = dot( toLamp, toLamp );
				vec2 fromEye = lamp.xz - molenLampView.xy;
				vec2 fromFocus = ( lamp.xz - molenLampView.zw ) * molenLampFade.z;
				float away = sqrt( min( dot( fromEye, fromEye ), dot( fromFocus, fromFocus ) ) );
				float facing = max( dot( normal, toLamp ), 0.0 ) * inversesqrt( max( distanceSquared, 0.0001 ) );
				lamps += lamp.w * facing * molenLampFalloff( distanceSquared, molenLampGrid.w ) *
					( 1.0 - smoothstep( molenLampFade.x, molenLampFade.y, away ) );
			}
		}
		light += lamps * molenLampAnchor.w * molenLampColor;
	}
	float beams = 0.0;
	for ( int b = 0; b < ${LAMP_FIELD_MAX_BEAMS}; b ++ ) {
		vec4 beam = molenLampBeams[ b * 2 ];
		if ( beam.w <= 0.0 ) break;
		vec3 toLamp = beam.xyz - local;
		float distanceSquared = dot( toLamp, toLamp );
		if ( distanceSquared >= molenLampBeamColor.w * molenLampBeamColor.w ) continue;
		vec4 axis = molenLampBeams[ b * 2 + 1 ];
		float inverse = inversesqrt( max( distanceSquared, 0.0001 ) );
		// three's spot cone with a full penumbra: smoothstep( cos( angle ), 1, cos( off axis ) ).
		float cone = smoothstep( axis.w, 1.0, - dot( toLamp, axis.xyz ) * inverse );
		float facing = max( dot( normal, toLamp ), 0.0 ) * inverse;
		beams += beam.w * cone * facing * molenLampFalloff( distanceSquared, molenLampBeamColor.w );
	}
	return light + beams * molenLampBeamColor.rgb;
}
`;

/**
 * After the lights (lights_fragment_begin, which declares the view-space position and normal read
 * here, and which other hooks expand in place) and before the light maps.
 */
const INCLUDE = '#include <lights_fragment_maps>';

/**
 * Add the lamp field to a WebGL shader built from three's lit chunks (standard, physical,
 * Lambert, Phong, toon); false if it has none. Diffuse only: the lamps' light joins the direct
 * diffuse light, as a point light's would without its highlight.
 */
export function injectLampField(
  shader: THREE.WebGLProgramParametersWithUniforms,
  uniforms: LampFieldUniforms,
): boolean {
  const fragment = shader.fragmentShader;
  if (!fragment.includes(INCLUDE)) return false;
  shader.fragmentShader = `${LAMP_FIELD_GLSL}\n${fragment.replace(
    INCLUDE,
    `reflectedLight.directDiffuse += molenLampLight( geometryPosition, geometryNormal ) * BRDF_Lambert( material.diffuseColor );\n${INCLUDE}`,
  )}`;
  Object.assign(shader.uniforms, uniforms);
  return true;
}
