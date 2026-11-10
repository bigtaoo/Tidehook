// The frame-time sampler behind Playgama's `performance_sample` (its telemetry guide, v1.1.2):
// only frames of active, visible play count; the first frame after a stop (a pause, a menu, a
// hidden tab) is dropped, so the gap is never taken for one long frame.

/** Active play per sample, ms. */
export const SAMPLE_MS = 30_000;
/** The frame rate the game aims for. */
export const TARGET_FPS = 60;
const OVER = [50, 100, 250, 500, 1000] as const;

export type PerfSample = Record<string, number | string>;

export class PerfSampler {
  private frames: number[] = [];
  private activeMs = 0;
  private windowMs = 0;
  private wasActive = false;

  constructor(private readonly build: string) {}

  /** One frame of `ms`; returns a finished sample, or null. */
  frame(ms: number, active: boolean): PerfSample | null {
    const counted = active && this.wasActive;
    this.wasActive = active;
    if (this.frames.length || counted) this.windowMs += ms;
    if (!counted) return null;
    this.frames.push(ms);
    this.activeMs += ms;
    if (this.activeMs < SAMPLE_MS) return null;
    const out = this.sample();
    this.frames = [];
    this.activeMs = this.windowMs = 0;
    return out;
  }

  private sample(): PerfSample {
    const f = [...this.frames].sort((a, b) => a - b);
    const at = (q: number) => f[Math.min(f.length - 1, Math.floor(q * f.length))];
    const r1 = (v: number) => Math.round(v * 10) / 10;
    const out: PerfSample = {
      target_fps: TARGET_FPS,
      window_ms: Math.round(this.windowMs),
      active_ms: Math.round(this.activeMs),
      frame_count: f.length,
      fps_avg: r1((f.length * 1000) / this.activeMs),
      fps_p10: r1(1000 / at(0.9)),
      frame_time_p50_ms: r1(at(0.5)),
      frame_time_p95_ms: r1(at(0.95)),
      frame_time_p99_ms: r1(at(0.99)),
      frame_time_max_ms: r1(f[f.length - 1]),
    };
    for (const o of OVER) out[`frames_over_${o}ms`] = f.filter((v) => v > o).length;
    out.build_version = this.build;
    return out;
  }
}
