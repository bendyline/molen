/** Bounded raw stage samples for diagnostics. Never influences quality or simulation. */
export class GraphicsTelemetry {
  private readonly stages = new Map<string, number[]>();
  readonly counters: Record<string, number> = {};
  record(stage: string, milliseconds: number): void {
    const values = this.stages.get(stage) ?? [];
    if (values.length >= 2048) values.shift();
    values.push(milliseconds);
    this.stages.set(stage, values);
  }
  /**
   * Mean of a stage's last `samples` recordings, or undefined before its first: cheap enough
   * for a readout refreshed several times a second, unlike `snapshot`, which sorts everything.
   */
  recentMean(stage: string, samples = 32): number | undefined {
    const values = this.stages.get(stage);
    if (values === undefined || values.length === 0) return undefined;
    const from = Math.max(0, values.length - samples);
    let sum = 0;
    for (let i = from; i < values.length; i++) sum += values[i] as number;
    return sum / (values.length - from);
  }
  count(name: string): void {
    this.total(name, 1);
  }
  total(name: string, amount: number): void {
    this.counters[name] = (this.counters[name] ?? 0) + amount;
  }
  snapshot(): {
    stages: Record<string, { count: number; mean: number; p95: number; p99: number; max: number }>;
    counters: Record<string, number>;
  } {
    return {
      counters: { ...this.counters },
      stages: Object.fromEntries(
        [...this.stages].map(([stage, samples]) => {
          // A typed sort is numeric without a comparator call per step: the comparator sorts
          // of every stage's samples held a status update 3 ms.
          const sorted = Float64Array.from(samples).sort();
          return [
            stage,
            {
              count: samples.length,
              mean: samples.reduce((a, b) => a + b, 0) / samples.length,
              p95: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] as number,
              p99: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))] as number,
              max: sorted[sorted.length - 1] as number,
            },
          ];
        }),
      ),
    };
  }
}
