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
  count(name: string): void {
    this.counters[name] = (this.counters[name] ?? 0) + 1;
  }
  snapshot(): {
    stages: Record<string, { count: number; mean: number; p95: number; p99: number; max: number }>;
    counters: Record<string, number>;
  } {
    return {
      counters: { ...this.counters },
      stages: Object.fromEntries(
        [...this.stages].map(([stage, samples]) => {
          const sorted = [...samples].sort((a, b) => a - b);
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
