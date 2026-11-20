// The vehicle console's one 3D pass: every part (controls and dials) drawn into its own
// rectangle of one transparent canvas, through one small WebGL context. Not the main renderer:
// that may be WebGPU, runs at a render scale Auto quality lowers, and passes through
// post-processing; the parts' geometry and materials are shared with it all the same.

import * as THREE from 'three';
import type { ConsolePart } from './parts';

/** A rectangle in CSS pixels from a canvas's or container's top-left corner. */
export interface ConsoleRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** One part drawn into `rect` (strip CSS pixels) at `opacity`. */
export interface StripPlacement {
  part: ConsolePart;
  rect: ConsoleRect;
  opacity: number;
}

export interface ConsoleStrip {
  readonly canvas: HTMLCanvasElement;
  /** False once WebGL is unavailable or its context is lost. */
  readonly available: boolean;
  /** Build the parts' programs ahead of their first draw (so showing them does not hitch). */
  prepare(parts: readonly ConsolePart[]): Promise<void>;
  /** Clear and draw every placement. */
  draw(placements: readonly StripPlacement[], maxPixelRatio: number): void;
  /** Clear the canvas (nothing on show). */
  clear(): void;
  dispose(): void;
}

export function createConsoleStrip(
  canvas: HTMLCanvasElement,
  onUnavailable: () => void,
): ConsoleStrip {
  let renderer: THREE.WebGLRenderer | undefined;
  let available = true;
  let disposed = false;
  // Ghosting: after a part draws, its rectangle's premultiplied color and alpha are scaled, so
  // parts fade one by one while the materials they share with the vehicle are never touched. The
  // same pass clears a dial's square crop outside its disc.
  const uniforms = {
    opacity: { value: 1 },
    center: { value: new THREE.Vector2() },
    radius: { value: 0 },
    circle: { value: 0 },
  };
  const ghost = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `
      uniform float opacity;
      uniform vec2 center;
      uniform float radius;
      uniform float circle;
      void main() {
        float inside = 1.0 - smoothstep(radius - 1.0, radius + 1.0, distance(gl_FragCoord.xy, center));
        gl_FragColor = vec4(0.0, 0.0, 0.0, opacity * mix(1.0, inside, circle));
      }`,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.ZeroFactor,
    blendDst: THREE.SrcAlphaFactor,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.SrcAlphaFactor,
    depthTest: false,
    depthWrite: false,
    transparent: true,
  });
  const ghostScene = new THREE.Scene();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), ghost);
  quad.frustumCulled = false;
  ghostScene.add(quad);
  const ghostCamera = new THREE.OrthographicCamera();
  const lost = (event: Event): void => {
    event.preventDefault();
    fail();
  };
  const fail = (): void => {
    if (!available) return;
    available = false;
    onUnavailable();
  };
  const ensure = (): THREE.WebGLRenderer | undefined => {
    if (renderer || !available || disposed) return renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setClearColor(0x000000, 0);
      renderer.autoClear = false;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      canvas.addEventListener('webglcontextlost', lost);
    } catch (error) {
      console.warn('Vehicle console unavailable:', error);
      fail();
    }
    return renderer;
  };
  return {
    canvas,
    get available() {
      return available;
    },
    async prepare(parts) {
      const target = ensure();
      if (!target) return;
      await Promise.all(
        parts.map((part) => target.compileAsync(part.scene, part.camera).catch(() => undefined)),
      );
    },
    draw(placements, maxPixelRatio) {
      const target = ensure();
      if (!target) return;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width === 0 || height === 0) return;
      const ratio = Math.min(globalThis.devicePixelRatio || 1, maxPixelRatio);
      if (target.getPixelRatio() !== ratio) target.setPixelRatio(ratio);
      const size = target.getSize(new THREE.Vector2());
      if (size.x !== width || size.y !== height) target.setSize(width, height, false);
      target.setScissorTest(false);
      target.clear();
      target.setScissorTest(true);
      for (const { part, rect, opacity } of placements) {
        if (opacity <= 0.002) continue;
        const bottom = height - rect.top - rect.height;
        target.setViewport(rect.left, bottom, rect.width, rect.height);
        target.setScissor(rect.left, bottom, rect.width, rect.height);
        target.clearDepth();
        target.render(part.scene, part.camera);
        if (opacity < 0.999 || part.mask === 'circle') {
          const u = uniforms;
          u.opacity.value = Math.min(1, opacity);
          u.circle.value = part.mask === 'circle' ? 1 : 0;
          u.center.value.set(
            (rect.left + rect.width / 2) * ratio,
            (bottom + rect.height / 2) * ratio,
          );
          u.radius.value = Math.min(rect.width, rect.height) * 0.49 * ratio;
          target.render(ghostScene, ghostCamera);
        }
      }
      target.setScissorTest(false);
    },
    clear() {
      if (!renderer) return;
      renderer.setScissorTest(false);
      renderer.clear();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      canvas.removeEventListener('webglcontextlost', lost);
      ghost.dispose();
      quad.geometry.dispose();
      renderer?.dispose();
      renderer?.forceContextLoss();
      renderer = undefined;
    },
  };
}
