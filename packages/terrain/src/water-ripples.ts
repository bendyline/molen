import * as THREE from 'three';

// A shared slope/height field, generated once rather than evaluating dozens of waves per pixel.
// Integer Fourier frequencies make both values and derivatives seamless at the texture edges.
// The independently drifting, warped samples below hide its period in world space.
// Like the ground noise lattice, this immutable texture lives for the module's lifetime.
let rippleTexture: THREE.DataTexture | undefined;

export function waterRippleTexture(): THREE.DataTexture {
  if (rippleTexture) return rippleTexture;
  const size = 256;
  const field = new Float32Array(size * size * 3);
  let seed = 0x72a4f19b;
  const random = (): number => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
  };
  for (let wave = 0; wave < 48; wave++) {
    const angle = random() * Math.PI * 2;
    const frequency = 6 + random() * 26;
    const x = Math.round(Math.cos(angle) * frequency);
    const y = Math.round(Math.sin(angle) * frequency);
    const length = Math.hypot(x, y);
    const phase = random() * Math.PI * 2;
    const amplitude = 0.5 + random() * 0.5;
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const p = ((col * x + row * y) / size) * Math.PI * 2 + phase;
        const slope = Math.cos(p) * amplitude;
        const index = (row * size + col) * 3;
        field[index] = (field[index] ?? 0) + (slope * x) / length;
        field[index + 1] = (field[index + 1] ?? 0) + (slope * y) / length;
        field[index + 2] = (field[index + 2] ?? 0) + (Math.sin(p) * amplitude * 16) / length;
      }
    }
  }
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    for (let channel = 0; channel < 3; channel++)
      data[i * 4 + channel] = Math.round(
        127.5 + THREE.MathUtils.clamp((field[i * 3 + channel] ?? 0) / 16, -1, 1) * 127.5,
      );
    data[i * 4 + 3] = 255;
  }
  rippleTexture = new THREE.DataTexture(data, size, size);
  rippleTexture.name = 'terrain:water-ripples';
  rippleTexture.wrapS = rippleTexture.wrapT = THREE.RepeatWrapping;
  rippleTexture.magFilter = THREE.LinearFilter;
  rippleTexture.minFilter = THREE.LinearMipmapLinearFilter;
  rippleTexture.generateMipmaps = true;
  rippleTexture.needsUpdate = true;
  return rippleTexture;
}

/** Shared coefficients keep GLSL and TSL sampling the same moving surface. */
export const WATER_RIPPLE_LAYERS: ReadonlyArray<{
  scale: number;
  direction: readonly [number, number];
  drift: readonly [number, number];
  weight: number;
}> = [
  { scale: 0.12, direction: [0.8, 0.6], drift: [0.013, -0.007], weight: 0.85 },
  { scale: 0.67, direction: [0.6, -0.8], drift: [-0.011, -0.017], weight: 1 },
  { scale: 2.17, direction: [-0.8, 0.6], drift: [0.019, 0.009], weight: 0.6 },
];

/** Slow patches that bend the layers and vary their energy, read once per pixel. */
export const WATER_RIPPLE_AREA = { scale: 0.009, drift: [0.001, 0] } as const;

/**
 * A layer fades out as one pixel grows from the first to the second fraction of its texture
 * repeat: from about 2.5 texels, where the finest wave (8.4 texels) still spans three pixels,
 * to 8 texels, where it is below one. Mipmaps average a finer layer's slopes, but the
 * reflection of what remains still swings from sky to shore between neighbouring pixels.
 */
export const WATER_RIPPLE_FADE: readonly [number, number] = [2.5 / 256, 8 / 256];

/**
 * Twice the per-axis slope variance one unit-weight layer contributes: the texture's slope
 * channels measure 0.17 RMS, and the second channel enters at 0.65. Ripples a pixel can no
 * longer show return this much GGX alpha² as roughness, so they still spread the highlight.
 */
export const WATER_RIPPLE_SLOPE_VARIANCE: number = 0.17 * 0.17 * (1 + 0.65 * 0.65);

/**
 * Geometric specular anti-aliasing (Kaplanyan and Tokuyoshi): how fast the shading normal
 * turns between neighbouring pixels, as GGX alpha², capped so a shoreline's swing between
 * pixels cannot turn the whole surface matte.
 */
export const WATER_NORMAL_VARIANCE = { gain: 0.5, max: 0.18 } as const;

/** The second ripple sample axis, shortened to stretch ripples across the first. */
const ACROSS = 0.65;

const fract = (value: number): number => value - Math.floor(value);

/**
 * Wrap the parts of each layer's texture coordinate that come from the world origin and from
 * time, in double precision, into one repeat of the texture. Shaders add them to coordinates
 * of camera-relative positions: adding a planet-scale origin in 32-bit floats instead rounds
 * positions to a metre or more, so the ripples break into flickering blocks.
 */
export function waterRippleOffsets(
  origin: readonly [number, number],
  waveScale: number,
  phase: number,
  area: THREE.Vector2,
  layers: ReadonlyArray<{ readonly value: THREE.Vector2 }>,
): void {
  const px = origin[0] * waveScale;
  const pz = origin[1] * waveScale;
  area.set(
    fract(px * WATER_RIPPLE_AREA.scale + WATER_RIPPLE_AREA.drift[0] * phase),
    fract(pz * WATER_RIPPLE_AREA.scale + WATER_RIPPLE_AREA.drift[1] * phase),
  );
  WATER_RIPPLE_LAYERS.forEach(({ scale, direction: [x, y], drift: [dx, dy] }, index) => {
    layers[index]?.value.set(
      fract((px * x + pz * y) * scale + dx * phase),
      fract((pz * x - px * y) * ACROSS * scale + dy * phase),
    );
  });
}

const literal = (value: number): string => value.toFixed(6);

export const WATER_RIPPLES_GLSL: string = /* glsl */ `
  uniform sampler2D terrainWaterRipples;
  uniform vec2 terrainWaterAreaOffset;
  ${WATER_RIPPLE_LAYERS.map((_, i) => `uniform vec2 terrainWaterLayerOffset${i};`).join('\n  ')}
  // xy: ripple slope; z: surface variation; w: slope variance too fine for this pixel to show.
  vec4 terrainWaterDetail(vec2 localPosition) {
    vec2 p = localPosition * terrainWaterWaveScale;
    // One pixel's extent along its longer axis: across the view at grazing angles.
    float footprint = length(fwidth(p));
    // Slow patches bend the wavelets and vary their energy, instead of tinting the water
    // with broad, painted-looking sine bands. Four filtered reads for the entire surface.
    vec3 area = texture2D(terrainWaterRipples,
      p * ${literal(WATER_RIPPLE_AREA.scale)} + terrainWaterAreaOffset).rgb * 2.0 - 1.0;
    vec2 warp = area.rg * 0.025;
    float gain = (1.0 + area.b * 0.7) * terrainWaterWaveStrength * 14.0;
    vec2 slope = vec2(0.0);
    float lost = 0.0;
    ${WATER_RIPPLE_LAYERS.map(
      ({ scale, direction: [x, y], weight }, i) => `
      float keep${i} = 1.0 - smoothstep(${literal(WATER_RIPPLE_FADE[0])}, ${literal(WATER_RIPPLE_FADE[1])},
        footprint * ${literal(scale)});
      vec2 uv${i} = vec2(dot(p, vec2(${literal(x)}, ${literal(y)})),
        dot(p, vec2(${literal(-y)}, ${literal(x)}))) * vec2(1.0, ${literal(ACROSS)}) * ${literal(scale)};
      vec2 n${i} = texture2D(terrainWaterRipples, uv${i} + warp + terrainWaterLayerOffset${i}).rg * 2.0 - 1.0;
      slope += (vec2(${literal(x)}, ${literal(y)}) * n${i}.x +
        vec2(${literal(-y)}, ${literal(x)}) * n${i}.y * ${literal(ACROSS)}) * ${literal(weight)} * keep${i};
      lost += ${literal(weight * weight)} * (1.0 - keep${i} * keep${i});`,
    ).join('\n')}
    float areaKeep = 1.0 - smoothstep(${literal(WATER_RIPPLE_FADE[0])}, ${literal(WATER_RIPPLE_FADE[1])},
      footprint * ${literal(WATER_RIPPLE_AREA.scale)});
    return vec4(slope * gain, area.b * terrainWaterWaveStrength * areaKeep,
      lost * gain * gain * ${literal(WATER_RIPPLE_SLOPE_VARIANCE)});
  }
  float terrainWaterNormalVariance(vec3 normal) {
    vec3 dx = dFdx(normal);
    vec3 dy = dFdy(normal);
    return min(${literal(WATER_NORMAL_VARIANCE.gain)} * (dot(dx, dx) + dot(dy, dy)),
      ${literal(WATER_NORMAL_VARIANCE.max)});
  }
  // Specular anti-aliasing: GGX alpha² grows by the slope variance a pixel averages over.
  float terrainWaterRoughness(float roughness, float variance) {
    return pow(clamp(pow(roughness, 4.0) + variance, 0.0, 1.0), 0.25);
  }
`;
