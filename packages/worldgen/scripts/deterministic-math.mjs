/**
 * `pow` with the same bits on every platform. Node's `**` and `Math.pow` round differently on
 * Windows and Linux builds and between Node majors, even for integer exponents, and that changed
 * generated GLB bytes.
 * `log` is fdlibm's `__ieee754_log` in plain IEEE arithmetic; `Math.exp` already agrees across
 * platforms.
 */
const view = new DataView(new ArrayBuffer(8));
function high(x) {
  view.setFloat64(0, x);
  return view.getInt32(0);
}
function low(x) {
  view.setFloat64(0, x);
  return view.getUint32(4);
}
function withHigh(x, h) {
  view.setFloat64(0, x);
  view.setInt32(0, h);
  return view.getFloat64(0);
}
function fromBits(h, l) {
  view.setUint32(0, h);
  view.setUint32(4, l);
  return view.getFloat64(0);
}

// fdlibm's constants, from their exact bit patterns.
const LN2_HI = fromBits(0x3fe62e42, 0xfee00000);
const LN2_LO = fromBits(0x3dea39ef, 0x35793c76);
const TWO54 = fromBits(0x43500000, 0);
const LG1 = fromBits(0x3fe55555, 0x55555593);
const LG2 = fromBits(0x3fd99999, 0x9997fa04);
const LG3 = fromBits(0x3fd24924, 0x94229359);
const LG4 = fromBits(0x3fcc71c5, 0x1d8e78af);
const LG5 = fromBits(0x3fc74664, 0x96cb03de);
const LG6 = fromBits(0x3fc39a09, 0xd078c69f);
const LG7 = fromBits(0x3fc2f112, 0xdf3e5244);

export function log(x) {
  let hx = high(x);
  const lx = low(x);
  let k = 0;
  if (hx < 0x00100000) {
    if (((hx & 0x7fffffff) | lx) === 0) return -Infinity;
    if (hx < 0) return Number.NaN;
    k -= 54;
    x *= TWO54;
    hx = high(x);
  }
  if (hx >= 0x7ff00000) return x + x;
  k += (hx >> 20) - 1023;
  hx &= 0x000fffff;
  const i = (hx + 0x95f64) & 0x100000;
  x = withHigh(x, hx | (i ^ 0x3ff00000));
  k += i >> 20;
  const f = x - 1;
  if ((0x000fffff & (2 + hx)) < 3) {
    if (f === 0) return k === 0 ? 0 : k * LN2_HI + k * LN2_LO;
    const r = f * f * (0.5 - 0.3333333333333333 * f);
    return k === 0 ? f - r : k * LN2_HI - (r - k * LN2_LO - f);
  }
  const s = f / (2 + f);
  const z = s * s;
  const w = z * z;
  const t1 = w * (LG2 + w * (LG4 + w * LG6));
  const t2 = z * (LG1 + w * (LG3 + w * (LG5 + w * LG7)));
  const R = t2 + t1;
  const j = 0x6b851 - hx;
  const m = (hx - 0x6147a) | j;
  if (m > 0) {
    const hfsq = 0.5 * f * f;
    return k === 0
      ? f - (hfsq - s * (hfsq + R))
      : k * LN2_HI - (hfsq - (s * (hfsq + R) + k * LN2_LO) - f);
  }
  return k === 0 ? f - s * (f - R) : k * LN2_HI - (s * (f - R) - k * LN2_LO - f);
}

/** `x ** y` for the non-negative bases geometry uses. */
export function pow(x, y) {
  if (x < 0 || Number.isNaN(x)) throw new RangeError(`pow expects a non-negative base, got ${x}`);
  if (y === 0) return 1;
  if (x === 0) return y > 0 ? 0 : Infinity;
  return Math.exp(y * log(x));
}
