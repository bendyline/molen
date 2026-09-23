// Deterministic math indirection (docs/04-kernel-design.md §5.3).
//
// Single-platform replay needs nothing special: IEEE-754 +, -, *, / and Math.sqrt are
// exactly specified and reproducible within one JS engine. The hazards are transcendentals
// (sin/cos/exp/pow), which engines approximate differently. Routing kernel/sim math through
// this module means a future swap to polynomial approximations (for cross-platform lockstep)
// is a one-file change, not a codebase audit. Today these are thin re-exports.
//
// The lint rule (scripts/check-dmath.mjs) bans direct transcendental Math.* in kernel source;
// this file is the single exemption.

export interface DMath {
  readonly PI: number;
  readonly TAU: number;
  sqrt(x: number): number;
  abs(x: number): number;
  min(a: number, b: number): number;
  max(a: number, b: number): number;
  floor(x: number): number;
  ceil(x: number): number;
  round(x: number): number;
  sign(x: number): number;
  hypot(x: number, y: number, z?: number): number;
  clamp(x: number, lo: number, hi: number): number;
  /** a + (b - a) * t; t is not clamped. */
  lerp(a: number, b: number, t: number): number;
  /** Fractional part in [0, 1): x - floor(x). */
  frac(x: number): number;
  /** Hermite smoothstep of x clamped to [0, 1]. */
  smoothstep(x: number): number;
  /** Wrap an angle (radians) into (-PI, PI]. */
  wrapAngle(a: number): number;
  sin(x: number): number;
  cos(x: number): number;
  tan(x: number): number;
  asin(x: number): number;
  acos(x: number): number;
  atan(x: number): number;
  atan2(y: number, x: number): number;
  pow(x: number, y: number): number;
  exp(x: number): number;
  log(x: number): number;
  log2(x: number): number;
  log10(x: number): number;
  cbrt(x: number): number;
}

const TAU = Math.PI * 2;

export const dmath: DMath = {
  PI: Math.PI,
  TAU,
  sqrt: (x) => Math.sqrt(x),
  abs: (x) => Math.abs(x),
  min: (a, b) => (a < b ? a : b),
  max: (a, b) => (a > b ? a : b),
  floor: (x) => Math.floor(x),
  ceil: (x) => Math.ceil(x),
  round: (x) => Math.round(x),
  sign: (x) => Math.sign(x),
  // hypot via sqrt of sum-of-squares (Math.hypot is allowed but its intermediate scaling is
  // engine-defined; this form is reproducible).
  hypot: (x, y, z = 0) => Math.sqrt(x * x + y * y + z * z),
  clamp: (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x),
  lerp: (a, b, t) => a + (b - a) * t,
  frac: (x) => x - Math.floor(x),
  smoothstep: (x) => {
    const t = x < 0 ? 0 : x > 1 ? 1 : x;
    return t * t * (3 - 2 * t);
  },
  wrapAngle: (a) => {
    const r = a - TAU * Math.floor((a + Math.PI) / TAU);
    return r <= -Math.PI ? r + TAU : r;
  },
  // Transcendentals — the swap targets. Today: native Math.
  sin: (x) => Math.sin(x),
  cos: (x) => Math.cos(x),
  tan: (x) => Math.tan(x),
  asin: (x) => Math.asin(x),
  acos: (x) => Math.acos(x),
  atan: (x) => Math.atan(x),
  atan2: (y, x) => Math.atan2(y, x),
  pow: (x, y) => x ** y,
  exp: (x) => Math.exp(x),
  log: (x) => Math.log(x),
  log2: (x) => Math.log2(x),
  log10: (x) => Math.log10(x),
  // cbrt is engine-approximated like the rest of this block, so it belongs here rather than in
  // the "IEEE-exact native" set of the script Math shim.
  cbrt: (x) => Math.cbrt(x),
};
