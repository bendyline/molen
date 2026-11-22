/**
 * A turntable preview of one figure, and small thumbnails of others, drawn by a single WebGL
 * context: no Earth view, no kernel world, no SES. The context lives on a hidden canvas; each
 * frame is rendered into a corner of its drawing buffer and copied into the host's 2D canvases,
 * so a designer showing a preview and dozens of option thumbnails holds one context in all.
 *
 * Rendering is on demand: a still pose draws once per change; a walking pose or a camera move
 * animates until it settles. Lighting defaults to the Earth view's clear-day rig (ACES at 1.05,
 * a warm sun over a cool sky fill), and hosts can pass their own.
 *
 * Gotchas: the preview canvas is a 2D canvas (the preview calls `getContext('2d')`), so pass one
 * that has no WebGL context. Without WebGL `available` is false and nothing is drawn; the host
 * keeps its controls and says so.
 */

import * as THREE from 'three';
import { FigureGeometryCache } from '../client/geometry-cache';
import { createFigureMaterial } from '../client/material';
import { applyPose, type FigureMesh, figureBodyToSkinnedMesh } from '../client/upload';
import type { FigureStateData } from '../kernel/components';
import { resolveFigureDescriptor } from '../kernel/descriptor';
import { strideRateFor } from '../kernel/gait';
import { evaluatePose, type FigurePose } from '../kernel/pose';
import type { FigureRig } from '../kernel/rig';
import type { FigureTier } from '../kernel/skinned-mesh-builder';
import type { FigureDescriptor, ResolvedFigureDescriptor } from '../kernel/types';
import type { FigureLookFraming } from '../look/types';

/** Light rig of a preview (colours as '#rrggbb'). */
export interface FigurePreviewLighting {
  sky: string;
  ground: string;
  ambient: number;
  sun: string;
  sunIntensity: number;
  /** Direction toward the sun, figure space (+Z is the figure's front). */
  sunDirection: [number, number, number];
  toneMapping: 'aces' | 'neutral' | 'none';
  exposure: number;
}

/** The Earth view's clear-day rig (molen-earth EARTH_SKY_PALETTE / EARTH_LIGHTING). */
export const FIGURE_PREVIEW_LIGHTING: FigurePreviewLighting = {
  sky: '#b2cde4',
  ground: '#9a8f70',
  ambient: 1.25,
  sun: '#fff8f0',
  sunIntensity: 4.2,
  sunDirection: [0.6, 0.9, 0.8],
  toneMapping: 'aces',
  exposure: 1.05,
};

export type FigurePreviewPose = 'idle' | 'walk' | 'run';
export type FigurePreviewFraming = FigureLookFraming;

export interface FigurePreviewOptions {
  figure?: FigureDescriptor;
  pose?: FigurePreviewPose;
  framing?: FigurePreviewFraming;
  /** Turn of the figure about its vertical axis, radians (default a three-quarter view). */
  yaw?: number;
  /** Drag (and arrow keys on the focused canvas) turn the figure (default true). */
  interactive?: boolean;
  lighting?: Partial<FigurePreviewLighting>;
  /** Highest device pixel ratio drawn (default 2). */
  maxPixelRatio?: number;
  /** 'auto' follows prefers-reduced-motion; 'reduced' never eases the camera or walks on its own. */
  motion?: 'auto' | 'reduced' | 'full';
  /** WebGL is missing or was lost; the preview draws nothing until it is restored. */
  onUnavailable?(reason: 'no-webgl' | 'context-lost'): void;
}

export interface FigurePreview {
  readonly canvas: HTMLCanvasElement;
  /** Whether frames can be drawn (WebGL present and not lost). */
  readonly available: boolean;
  readonly yaw: number;
  readonly framing: FigurePreviewFraming;
  readonly pose: FigurePreviewPose;
  setFigure(figure: FigureDescriptor): void;
  setPose(pose: FigurePreviewPose): void;
  setFraming(framing: FigurePreviewFraming): void;
  setYaw(radians: number): void;
  /** Turn by an angle (radians). */
  turn(radians: number): void;
  /**
   * Draw a still thumbnail of a figure into a 2D canvas (sized by its width and height
   * attributes), queued a few per frame, from a three-quarter view unless `yaw` (radians; 0 is
   * the front, π the back) says otherwise. Head close-ups draw the full-detail body, so faces
   * show. Returns a cancel function.
   */
  thumbnail(
    target: HTMLCanvasElement,
    figure: FigureDescriptor,
    framing: FigurePreviewFraming,
    yaw?: number,
  ): () => void;
  /** Re-measure the canvas (also done by a ResizeObserver where there is one). */
  resize(): void;
  dispose(): void;
}

const TICK_RATE = 30;
/** Ticks before the clock starts, so mode blends from tick 0 have finished. */
const SETTLED = 1000;
const FOV = 28;
const DEFAULT_YAW = -0.45;
const THUMBS_PER_FRAME = 2;

/** Camera target height and the span to fit, as fractions of standing height (and meters). */
const FRAMES: Readonly<Record<FigurePreviewFraming, { y: number; span: number; width: number }>> = {
  body: { y: 0.5, span: 1.14, width: 0.62 },
  torso: { y: 0.66, span: 0.56, width: 0.5 },
  head: { y: 0.915, span: 0.2, width: 0.18 },
  legs: { y: 0.3, span: 0.66, width: 0.42 },
  feet: { y: 0.06, span: 0.2, width: 0.3 },
};

interface Body {
  key: string;
  mesh: FigureMesh;
  rig: FigureRig;
  descriptor: ResolvedFigureDescriptor;
  pose: FigurePose | undefined;
}

interface ThumbJob {
  target: HTMLCanvasElement;
  figure: FigureDescriptor;
  framing: FigurePreviewFraming;
  yaw: number;
  cancelled: boolean;
}

function stateFor(pose: FigurePreviewPose, rig: FigureRig): FigureStateData {
  const speed = pose === 'run' ? 3.6 : pose === 'walk' ? 1.35 : 0;
  return {
    mode: pose,
    speed,
    strideRate: strideRateFor(speed, rig.legLength),
    phaseAt: 0,
    phaseAtTick: 0,
    modeAtTick: 0,
  };
}

function toneMappingOf(name: FigurePreviewLighting['toneMapping']): THREE.ToneMapping {
  if (name === 'aces') return THREE.ACESFilmicToneMapping;
  if (name === 'neutral') return THREE.NeutralToneMapping;
  return THREE.NoToneMapping;
}

/** Mount a preview drawing into a 2D canvas. */
export function mountFigurePreview(
  canvas: HTMLCanvasElement,
  options: FigurePreviewOptions = {},
): FigurePreview {
  const lighting: FigurePreviewLighting = { ...FIGURE_PREVIEW_LIGHTING, ...options.lighting };
  const interactive = options.interactive ?? true;
  const maxPixelRatio = options.maxPixelRatio ?? 2;
  const reducedQuery =
    typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : undefined;
  const reduced = (): boolean =>
    options.motion === 'reduced' || (options.motion !== 'full' && reducedQuery?.matches === true);

  const glCanvas = document.createElement('canvas');
  let renderer: THREE.WebGLRenderer | undefined;
  let available = false;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, alpha: true });
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = toneMappingOf(lighting.toneMapping);
    renderer.toneMappingExposure = lighting.exposure;
    available = true;
  } catch {
    renderer = undefined;
  }
  if (!available) queueMicrotask(() => options.onUnavailable?.('no-webgl'));
  const ctx = canvas.getContext('2d');

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(lighting.sky, lighting.ground, lighting.ambient));
  const sun = new THREE.DirectionalLight(lighting.sun, lighting.sunIntensity);
  sun.position
    .set(...lighting.sunDirection)
    .normalize()
    .multiplyScalar(10);
  scene.add(sun);
  const turntable = new THREE.Group();
  scene.add(turntable);
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 50);
  const thumbCamera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 50);
  const cache = new FigureGeometryCache();
  const material = createFigureMaterial();

  let figure = options.figure ?? { preset: 'human.adult' };
  let pose: FigurePreviewPose = options.pose ?? 'idle';
  let framing: FigurePreviewFraming = options.framing ?? 'body';
  let yaw = options.yaw ?? DEFAULT_YAW;
  let body: Body | undefined;
  let disposed = false;
  let frame = 0;
  let started = 0;
  /** Camera target (y) and distance, eased toward the framing's. */
  const view = { y: 0, distance: 0, settled: false };
  const queue: ThumbJob[] = [];
  let width = 1;
  let height = 1;

  const build = (descriptor: FigureDescriptor, tier: FigureTier): Body | undefined => {
    let resolved: ResolvedFigureDescriptor;
    try {
      resolved = resolveFigureDescriptor(descriptor);
    } catch {
      return undefined;
    }
    const cached = cache.acquire(resolved, tier);
    const mesh = figureBodyToSkinnedMesh(cached.body, cached.geometry, material);
    return {
      key: cached.key,
      mesh,
      rig: cache.rigFor(resolved),
      descriptor: resolved,
      pose: undefined,
    };
  };
  const release = (b: Body | undefined): void => {
    if (b === undefined) return;
    b.mesh.dispose();
    cache.release(b.key);
  };
  const poseBody = (b: Body, which: FigurePreviewPose, tick: number): void => {
    if (b.mesh.bones.length === 0) return;
    b.pose = evaluatePose(
      b.rig,
      stateFor(which, b.rig),
      tick,
      { tickRate: TICK_RATE, seed: 0 },
      b.pose,
    );
    applyPose(b.pose, b.mesh.bones);
  };
  const aimFor = (
    target: FigurePreviewFraming,
    stature: number,
    aspect: number,
  ): { y: number; distance: number } => {
    const f = FRAMES[target];
    const span = target === 'head' || target === 'feet' ? f.span + stature * 0.1 : f.span * stature;
    const half = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const fitHeight = span / 2 / half;
    const fitWidth = (f.width * Math.max(stature, 1)) / 2 / (half * aspect);
    return { y: f.y * stature, distance: Math.max(fitHeight, fitWidth) * 1.08 };
  };
  const placeCamera = (cam: THREE.PerspectiveCamera, y: number, distance: number): void => {
    cam.position.set(0, y + distance * 0.06, distance);
    cam.lookAt(0, y, 0);
    cam.updateProjectionMatrix();
  };

  const setBody = (): void => {
    const next = build(figure, 0);
    release(body);
    body = next;
    if (body !== undefined) {
      turntable.add(body.mesh.root);
      poseBody(body, pose, SETTLED);
    }
    view.settled = false;
    schedule();
  };

  // ---- Drawing ---------------------------------------------------------------------------------

  const ensureBuffer = (w: number, h: number): void => {
    if (renderer === undefined) return;
    if (glCanvas.width >= w && glCanvas.height >= h) return;
    renderer.setSize(Math.max(glCanvas.width, w), Math.max(glCanvas.height, h), false);
  };
  /** Render the scene into the buffer's bottom-left corner and copy it into a 2D canvas. */
  const blit = (
    cam: THREE.PerspectiveCamera,
    w: number,
    h: number,
    out: CanvasRenderingContext2D,
  ): void => {
    if (renderer === undefined) return;
    ensureBuffer(w, h);
    renderer.setViewport(0, 0, w, h);
    renderer.setScissor(0, 0, w, h);
    renderer.setScissorTest(true);
    renderer.render(scene, cam);
    out.clearRect(0, 0, out.canvas.width, out.canvas.height);
    out.drawImage(
      glCanvas,
      0,
      glCanvas.height - h,
      w,
      h,
      0,
      0,
      out.canvas.width,
      out.canvas.height,
    );
  };

  const drawMain = (now: number): boolean => {
    if (!available || ctx === null || body === undefined || width < 2 || height < 2) return false;
    const aspect = width / height;
    const aim = aimFor(framing, body.descriptor.height, aspect);
    let moving = false;
    if (!view.settled || reduced()) {
      if (reduced() || view.distance === 0) {
        view.y = aim.y;
        view.distance = aim.distance;
      } else {
        view.y += (aim.y - view.y) * 0.2;
        view.distance += (aim.distance - view.distance) * 0.2;
      }
      view.settled =
        Math.abs(aim.y - view.y) < 0.002 && Math.abs(aim.distance - view.distance) < 0.002;
      moving = !view.settled;
    }
    camera.aspect = aspect;
    placeCamera(camera, view.y, view.distance);
    turntable.rotation.y = yaw;
    const animated = pose !== 'idle';
    if (animated) poseBody(body, pose, SETTLED + ((now - started) / 1000) * TICK_RATE);
    blit(camera, width, height, ctx);
    return animated || moving;
  };

  const drawThumbs = (): void => {
    if (!available) return;
    const mainRoot = body?.mesh.root;
    let done = 0;
    while (queue.length > 0 && done < THUMBS_PER_FRAME) {
      const job = queue.shift() as ThumbJob;
      if (job.cancelled) continue;
      const out = job.target.getContext('2d');
      // Faces need the full-detail head; a body at thumbnail size reads at medium detail.
      const thumb = build(job.figure, job.framing === 'head' ? 0 : 1);
      if (out === null || thumb === undefined) {
        release(thumb);
        continue;
      }
      if (mainRoot) mainRoot.visible = false;
      turntable.add(thumb.mesh.root);
      turntable.rotation.y = job.yaw;
      poseBody(thumb, 'idle', SETTLED);
      const aim = aimFor(
        job.framing,
        thumb.descriptor.height,
        job.target.width / job.target.height,
      );
      thumbCamera.aspect = job.target.width / job.target.height;
      placeCamera(thumbCamera, aim.y, aim.distance);
      blit(thumbCamera, job.target.width, job.target.height, out);
      release(thumb);
      if (mainRoot) mainRoot.visible = true;
      done++;
    }
  };

  const tick = (now: number): void => {
    frame = 0;
    if (disposed) return;
    const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
    const again = hidden ? false : drawMain(now);
    if (!hidden) drawThumbs();
    if (again || queue.length > 0) schedule();
  };
  function schedule(): void {
    if (disposed || frame !== 0) return;
    frame = requestAnimationFrame(tick);
  }

  // ---- Size --------------------------------------------------------------------------------------

  const resize = (): void => {
    const ratio = Math.min(
      maxPixelRatio,
      typeof devicePixelRatio === 'number' ? devicePixelRatio : 1,
    );
    const w = Math.max(1, Math.round(canvas.clientWidth * ratio));
    const h = Math.max(1, Math.round(canvas.clientHeight * ratio));
    if (w === width && h === height) return;
    width = w;
    height = h;
    canvas.width = w;
    canvas.height = h;
    schedule();
  };
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : undefined;
  observer?.observe(canvas);

  // ---- Interaction -------------------------------------------------------------------------------

  let drag: { id: number; x: number; yaw: number } | undefined;
  const onDown = (event: PointerEvent): void => {
    if (!interactive || event.button !== 0) return;
    drag = { id: event.pointerId, x: event.clientX, yaw };
    canvas.setPointerCapture?.(event.pointerId);
  };
  const onMove = (event: PointerEvent): void => {
    if (drag === undefined || event.pointerId !== drag.id) return;
    api.setYaw(drag.yaw + (event.clientX - drag.x) * 0.012);
  };
  const onUp = (event: PointerEvent): void => {
    if (drag?.id === event.pointerId) drag = undefined;
  };
  const onKey = (event: KeyboardEvent): void => {
    if (!interactive) return;
    if (event.key === 'ArrowLeft') api.turn(-0.35);
    else if (event.key === 'ArrowRight') api.turn(0.35);
    else return;
    event.preventDefault();
  };
  const onLost = (event: Event): void => {
    event.preventDefault();
    available = false;
    options.onUnavailable?.('context-lost');
  };
  const onRestored = (): void => {
    available = renderer !== undefined;
    view.settled = false;
    schedule();
  };
  const onVisible = (): void => schedule();
  if (interactive) {
    canvas.style.touchAction = 'pan-y';
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('keydown', onKey);
  }
  glCanvas.addEventListener('webglcontextlost', onLost);
  glCanvas.addEventListener('webglcontextrestored', onRestored);
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible);

  const api: FigurePreview = {
    canvas,
    get available() {
      return available;
    },
    get yaw() {
      return yaw;
    },
    get framing() {
      return framing;
    },
    get pose() {
      return pose;
    },
    setFigure(next) {
      if (disposed) return;
      figure = next;
      setBody();
    },
    setPose(next) {
      if (disposed || next === pose) return;
      pose = next;
      started = performance.now();
      if (body !== undefined) poseBody(body, pose, SETTLED);
      schedule();
    },
    setFraming(next) {
      if (disposed || next === framing) return;
      framing = next;
      view.settled = false;
      schedule();
    },
    setYaw(radians) {
      if (disposed) return;
      yaw = radians;
      schedule();
    },
    turn(radians) {
      api.setYaw(yaw + radians);
    },
    thumbnail(target, thumbFigure, thumbFraming, thumbYaw) {
      const job: ThumbJob = {
        target,
        figure: thumbFigure,
        framing: thumbFraming,
        yaw: thumbYaw ?? DEFAULT_YAW,
        cancelled: false,
      };
      queue.push(job);
      schedule();
      return () => {
        job.cancelled = true;
      };
    },
    resize,
    dispose() {
      if (disposed) return;
      disposed = true;
      if (frame !== 0) cancelAnimationFrame(frame);
      observer?.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('keydown', onKey);
      glCanvas.removeEventListener('webglcontextlost', onLost);
      glCanvas.removeEventListener('webglcontextrestored', onRestored);
      if (typeof document !== 'undefined')
        document.removeEventListener('visibilitychange', onVisible);
      queue.length = 0;
      release(body);
      body = undefined;
      cache.dispose();
      material.dispose();
      renderer?.dispose();
      renderer?.forceContextLoss();
    },
  };

  started = typeof performance !== 'undefined' ? performance.now() : 0;
  resize();
  setBody();
  return api;
}
