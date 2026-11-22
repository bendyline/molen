/**
 * Frame rate as a viewer sees it, for the explorer's panel: frames a second over the last
 * second, and the rate of the slowest frames over the last several seconds, which is what a
 * stutter is. An average hides it: fifty-nine frames at 16 ms and one at 120 ms still average
 * 56 a second.
 *
 * Related: main.ts (the frame loop feeds it and draws the readout), index.html (`#fps`,
 * `#frame-graph`).
 */

export interface FrameMeterStats {
  /** Frames a second over the last second or so of frames; 0 before the first frame. */
  fps: number;
  /** The rate the slowest 1% of the remembered frames ran at (at least the slowest one). */
  lowFps: number;
  /** Mean and longest frame over that last second, ms. */
  meanMs: number;
  maxMs: number;
  /** Frames longer than two 60 Hz refreshes (33.4 ms) among those remembered. */
  longFrames: number;
  /** Frames remembered. */
  frames: number;
}

/** How a rate reads at a glance: the color of the panel's readout. */
export type FrameRateHealth = 'good' | 'fair' | 'poor';

/** 50 a second and up is smooth, 30 and up is playable, below that it drags. */
export function frameRateHealth(fps: number): FrameRateHealth {
  return fps >= 50 ? 'good' : fps >= 30 ? 'fair' : 'poor';
}

export class FrameMeter {
  private readonly samples: Float32Array;
  private readonly sorted: Float32Array;
  private count = 0;
  private next = 0;

  /** Remembers the last `capacity` frames: ten seconds of them at 60 a second by default. */
  constructor(capacity = 600) {
    if (!Number.isInteger(capacity) || capacity < 1)
      throw new RangeError('Frame meter capacity must be a positive integer');
    this.samples = new Float32Array(capacity);
    this.sorted = new Float32Array(capacity);
  }

  /** One frame's interval, ms. Intervals that are not positive and finite are left out. */
  add(frameMs: number): void {
    if (!(frameMs > 0) || !Number.isFinite(frameMs)) return;
    this.samples[this.next] = frameMs;
    this.next = (this.next + 1) % this.samples.length;
    this.count = Math.min(this.count + 1, this.samples.length);
  }

  /** Forget everything: the page was hidden, and the gap is not a slow frame. */
  reset(): void {
    this.count = 0;
    this.next = 0;
  }

  /** The `index`th most recent frame's interval, ms (0 is the latest), or undefined. */
  recent(index: number): number | undefined {
    if (index < 0 || index >= this.count) return undefined;
    const capacity = this.samples.length;
    return this.samples[(this.next - 1 - index + capacity * 2) % capacity];
  }

  stats(windowMs = 1000): FrameMeterStats {
    const { count } = this;
    if (count === 0) return { fps: 0, lowFps: 0, meanMs: 0, maxMs: 0, longFrames: 0, frames: 0 };
    // The last second: newest first, until the window is full.
    let total = 0;
    let frames = 0;
    let maxMs = 0;
    while (frames < count && total < windowMs) {
      const ms = this.recent(frames) as number;
      total += ms;
      maxMs = Math.max(maxMs, ms);
      frames++;
    }
    let longFrames = 0;
    for (let i = 0; i < count; i++) {
      const ms = this.recent(i) as number;
      this.sorted[i] = ms;
      if (ms > 33.4) longFrames++;
    }
    const sorted = this.sorted.subarray(0, count).sort();
    // Where the slowest hundredth begins; with under a hundred frames, the slowest one.
    const slowest = sorted[Math.min(count - 1, Math.floor(count * 0.99))];
    return {
      fps: (frames * 1000) / total,
      lowFps: 1000 / (slowest as number),
      meanMs: total / frames,
      maxMs,
      longFrames,
      frames: count,
    };
  }
}

/**
 * Draw the remembered frames as bars, newest at the right, on a canvas `width` by `height`
 * pixels: a bar reaches the top at `fullMs` (four 60 Hz refreshes, so a view running at 20 to 30
 * frames a second still shows its shape), with rules at one and two refreshes. Colors follow
 * `frameRateHealth` of each frame's own rate.
 */
export function drawFrameGraph(
  context: CanvasRenderingContext2D,
  meter: FrameMeter,
  width: number,
  height: number,
  fullMs = 4000 / 60,
): void {
  context.clearRect(0, 0, width, height);
  const colors: Record<FrameRateHealth, string> = {
    good: '#8fd3a4',
    fair: '#f0c36a',
    poor: '#f08a7a',
  };
  const bar = 2;
  const bars = Math.floor(width / bar);
  for (let i = 0; i < bars; i++) {
    const ms = meter.recent(i);
    if (ms === undefined) break;
    const tall = Math.max(1, Math.min(height, (ms / fullMs) * height));
    context.fillStyle = colors[frameRateHealth(1000 / ms)];
    context.fillRect(width - (i + 1) * bar, height - tall, bar, tall);
  }
  context.fillStyle = 'rgb(255 255 255 / 28%)';
  for (const rule of [1000 / 60, 1000 / 30]) {
    const y = Math.round(height - (rule / fullMs) * height);
    context.fillRect(0, y, width, 1);
  }
}
