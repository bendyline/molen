/**
 * Math functions with the same bits on every CPU, installed over `Math` in asset generators.
 *
 * V8's transcendental functions are C++ (fdlibm, and the C library's pow), and on arm64 the
 * compiler fuses multiply-adds, so about 0.1-0.6% of results differ from x64 in the last bit.
 * Rounded into GLB floats, UV projections and near-zero coordinates, those bits changed model
 * bytes. JS arithmetic is exact IEEE everywhere, so these ports give every CPU the same results:
 * the fdlibm functions are V8's src/base/ieee754.cc (Node 24.18.0) expression for expression and
 * return x64 V8's bits, and `Math.pow` is deterministic-pow.mjs. `Math.sqrt`, `hypot` and the
 * rounding functions agree natively and stay. The `**` operator cannot be replaced: generators
 * write Math.pow for any exponent but 2 or 0.5, which V8 computes as x * x and sqrt.
 *
 * Translated from V8's src/base/ieee754.cc: Copyright 2016 the V8 project authors, BSD 3-Clause.
 * V8 adapted it from fdlibm, whose notice follows. See NOTICE.md §7.
 *
 * ====================================================
 * Copyright (C) 1993 by Sun Microsystems, Inc. All rights reserved.
 *
 * Developed at SunSoft, a Sun Microsystems, Inc. business.
 * Permission to use, copy, modify, and distribute this
 * software is freely granted, provided that this notice
 * is preserved.
 * ====================================================
 */
import { pow as portablePow } from './deterministic-pow.mjs';

const f64 = new Float64Array(1);
const u32 = new Uint32Array(f64.buffer);
const i32 = new Int32Array(f64.buffer);
if (new Uint8Array(new Uint16Array([1]).buffer)[0] !== 1)
  throw new Error('deterministic-math.mjs expects a little-endian host.');

/** High word as int32_t. */
function high(x) {
  f64[0] = x;
  return i32[1];
}
/** High word as uint32_t. */
function highU(x) {
  f64[0] = x;
  return u32[1];
}
/** Low word as uint32_t. */
function low(x) {
  f64[0] = x;
  return u32[0];
}
function fromWords(hi, lo) {
  u32[1] = hi;
  u32[0] = lo;
  return f64[0];
}
function withHigh(x, hi) {
  f64[0] = x;
  u32[1] = hi;
  return f64[0];
}
function withLow(x, lo) {
  f64[0] = x;
  u32[0] = lo;
  return f64[0];
}

// musl's scalbn: x * 2^n, exact whenever the result is normal.
const P1023 = fromWords(0x7fe00000, 0);
const PM969 = fromWords(0x03600000, 0); // 0x1p-1022 * 0x1p53
function scalbn(x, n) {
  let y = x;
  if (n > 1023) {
    y *= P1023;
    n -= 1023;
    if (n > 1023) {
      y *= P1023;
      n -= 1023;
      if (n > 1023) n = 1023;
    }
  } else if (n < -1022) {
    y *= PM969;
    n += 1022 - 53;
    if (n < -1022) {
      y *= PM969;
      n += 1022 - 53;
      if (n < -1022) n = -1022;
    }
  }
  return y * fromWords((0x3ff + n) << 20, 0);
}

const sqrt = Math.sqrt;
const fabs = Math.abs;
const floor = Math.floor;

// ---------------------------------------------------------------------------------------------
// Argument reduction and kernels

const TWO_OVER_PI = [
  0xa2f983, 0x6e4e44, 0x1529fc, 0x2757d1, 0xf534dd, 0xc0db62, 0x95993c, 0x439041, 0xfe5163,
  0xabdebb, 0xc561b7, 0x246e3a, 0x424dd2, 0xe00649, 0x2eea09, 0xd1921c, 0xfe1deb, 0x1cb129,
  0xa73ee8, 0x8235f5, 0x2ebb44, 0x84e99c, 0x7026b4, 0x5f7e41, 0x3991d6, 0x398353, 0x39f49c,
  0x845f8b, 0xbdf928, 0x3b1ff8, 0x97ffde, 0x05980f, 0xef2f11, 0x8b5a0a, 0x6d1f6d, 0x367ecf,
  0x27cb09, 0xb74f46, 0x3f669e, 0x5fea2d, 0x7527ba, 0xc7ebe5, 0xf17b3d, 0x0739f7, 0x8a5292,
  0xea6bfb, 0x5fb11f, 0x8d5d08, 0x560330, 0x46fc7b, 0x6babf0, 0xcfbc20, 0x9af436, 0x1da9e3,
  0x91615e, 0xe61b08, 0x659985, 0x5f14a0, 0x68408d, 0xffd880, 0x4d7327, 0x310606, 0x1556ca,
  0x73a8c9, 0x60e27b, 0xc08c6b,
];
const NPIO2_HW = [
  0x3ff921fb, 0x400921fb, 0x4012d97c, 0x401921fb, 0x401f6a7a, 0x4022d97c, 0x4025fdbb, 0x402921fb,
  0x402c463a, 0x402f6a7a, 0x4031475c, 0x4032d97c, 0x40346b9c, 0x4035fdbb, 0x40378fdb, 0x403921fb,
  0x403ab41b, 0x403c463a, 0x403dd85a, 0x403f6a7a, 0x40407e4c, 0x4041475c, 0x4042106c, 0x4042d97c,
  0x4043a28c, 0x40446b9c, 0x404534ac, 0x4045fdbb, 0x4046c6cb, 0x40478fdb, 0x404858eb, 0x404921fb,
];
const INVPIO2 = 0.6366197723675814;
const PIO2_1 = 1.5707963267341256;
const PIO2_1T = 6.077100506506192e-11;
const PIO2_2 = 6.077100506303966e-11;
const PIO2_2T = 2.0222662487959506e-21;
const PIO2_3 = 2.0222662487111665e-21;
const PIO2_3T = 8.4784276603689e-32;
const TWO24 = 1.6777216e7;
const TWON24 = 5.9604644775390625e-8;

/** __ieee754_rem_pio2: writes x mod pi/2 as y[0] + y[1], returns n. */
function remPio2(x, y) {
  let z = 0;
  let w;
  let t;
  let r;
  let fn;
  const hx = high(x);
  const ix = hx & 0x7fffffff;
  if (ix <= 0x3fe921fb) {
    y[0] = x;
    y[1] = 0;
    return 0;
  }
  if (ix < 0x4002d97c) {
    if (hx > 0) {
      z = x - PIO2_1;
      if (ix !== 0x3ff921fb) {
        y[0] = z - PIO2_1T;
        y[1] = z - y[0] - PIO2_1T;
      } else {
        z -= PIO2_2;
        y[0] = z - PIO2_2T;
        y[1] = z - y[0] - PIO2_2T;
      }
      return 1;
    }
    z = x + PIO2_1;
    if (ix !== 0x3ff921fb) {
      y[0] = z + PIO2_1T;
      y[1] = z - y[0] + PIO2_1T;
    } else {
      z += PIO2_2;
      y[0] = z + PIO2_2T;
      y[1] = z - y[0] + PIO2_2T;
    }
    return -1;
  }
  if (ix <= 0x413921fb) {
    t = fabs(x);
    const n = (t * INVPIO2 + 0.5) | 0;
    fn = n;
    r = t - fn * PIO2_1;
    w = fn * PIO2_1T;
    if (n < 32 && ix !== NPIO2_HW[n - 1]) {
      y[0] = r - w;
    } else {
      const j = ix >> 20;
      y[0] = r - w;
      let i = j - ((highU(y[0]) >>> 20) & 0x7ff);
      if (i > 16) {
        t = r;
        w = fn * PIO2_2;
        r = t - w;
        w = fn * PIO2_2T - (t - r - w);
        y[0] = r - w;
        i = j - ((highU(y[0]) >>> 20) & 0x7ff);
        if (i > 49) {
          t = r;
          w = fn * PIO2_3;
          r = t - w;
          w = fn * PIO2_3T - (t - r - w);
          y[0] = r - w;
        }
      }
    }
    y[1] = r - y[0] - w;
    if (hx < 0) {
      y[0] = -y[0];
      y[1] = -y[1];
      return -n;
    }
    return n;
  }
  if (ix >= 0x7ff00000) {
    y[0] = y[1] = x - x;
    return 0;
  }
  const e0 = (ix >> 20) - 1046;
  z = fromWords((ix - (e0 << 20)) | 0, low(x));
  const tx = [0, 0, 0];
  for (let i = 0; i < 2; i++) {
    tx[i] = z | 0;
    z = (z - tx[i]) * TWO24;
  }
  tx[2] = z;
  let nx = 3;
  while (tx[nx - 1] === 0) nx--;
  const n = kernelRemPio2(tx, y, e0, nx, 2);
  if (hx < 0) {
    y[0] = -y[0];
    y[1] = -y[1];
    return -n;
  }
  return n;
}

const INIT_JK = [2, 3, 4, 6];
const PIO2 = [
  1.570796251296997, 7.549789415861596e-8, 5.390302529957765e-15, 3.282003415807913e-22,
  1.270655753080676e-29, 1.2293330898111133e-36, 2.7337005381646456e-44, 2.1674168387780482e-51,
];

/** __kernel_rem_pio2 for prec 2, with ipio2 = TWO_OVER_PI. */
function kernelRemPio2(x, y, e0, nx, prec) {
  const iq = new Int32Array(20);
  const f = new Float64Array(20);
  const fq = new Float64Array(20);
  const q = new Float64Array(20);
  const jk = INIT_JK[prec];
  const jp = jk;
  const jx = nx - 1;
  let jv = ((e0 - 3) / 24) | 0;
  if (jv < 0) jv = 0;
  let q0 = e0 - 24 * (jv + 1);
  let j = jv - jx;
  const m = jx + jk;
  for (let i = 0; i <= m; i++, j++) f[i] = j < 0 ? 0 : TWO_OVER_PI[j];
  let fw;
  for (let i = 0; i <= jk; i++) {
    fw = 0;
    for (j = 0; j <= jx; j++) fw += x[j] * f[jx + i - j];
    q[i] = fw;
  }
  let jz = jk;
  let z;
  let n;
  let ih;
  for (;;) {
    let i;
    for (i = 0, j = jz, z = q[jz]; j > 0; i++, j--) {
      fw = (TWON24 * z) | 0;
      iq[i] = (z - TWO24 * fw) | 0;
      z = q[j - 1] + fw;
    }
    z = scalbn(z, q0);
    z -= 8 * floor(z * 0.125);
    n = z | 0;
    z -= n;
    ih = 0;
    if (q0 > 0) {
      i = iq[jz - 1] >> (24 - q0);
      n += i;
      iq[jz - 1] -= i << (24 - q0);
      ih = iq[jz - 1] >> (23 - q0);
    } else if (q0 === 0) {
      ih = iq[jz - 1] >> 23;
    } else if (z >= 0.5) {
      ih = 2;
    }
    if (ih > 0) {
      n += 1;
      let carry = 0;
      for (i = 0; i < jz; i++) {
        j = iq[i];
        if (carry === 0) {
          if (j !== 0) {
            carry = 1;
            iq[i] = 0x1000000 - j;
          }
        } else {
          iq[i] = 0xffffff - j;
        }
      }
      if (q0 > 0) {
        if (q0 === 1) iq[jz - 1] &= 0x7fffff;
        else if (q0 === 2) iq[jz - 1] &= 0x3fffff;
      }
      if (ih === 2) {
        z = 1 - z;
        if (carry !== 0) z -= scalbn(1, q0);
      }
    }
    if (z === 0) {
      j = 0;
      for (i = jz - 1; i >= jk; i--) j |= iq[i];
      if (j === 0) {
        let k = 1;
        while (jk >= k && iq[jk - k] === 0) k++;
        for (i = jz + 1; i <= jz + k; i++) {
          f[jx + i] = TWO_OVER_PI[jv + i];
          fw = 0;
          for (j = 0; j <= jx; j++) fw += x[j] * f[jx + i - j];
          q[i] = fw;
        }
        jz += k;
        continue;
      }
    }
    break;
  }
  if (z === 0) {
    jz -= 1;
    q0 -= 24;
    while (iq[jz] === 0) {
      jz--;
      q0 -= 24;
    }
  } else {
    z = scalbn(z, -q0);
    if (z >= TWO24) {
      fw = (TWON24 * z) | 0;
      iq[jz] = (z - TWO24 * fw) | 0;
      jz += 1;
      q0 += 24;
      iq[jz] = fw;
    } else {
      iq[jz] = z | 0;
    }
  }
  fw = scalbn(1, q0);
  for (let i = jz; i >= 0; i--) {
    q[i] = fw * iq[i];
    fw *= TWON24;
  }
  for (let i = jz; i >= 0; i--) {
    fw = 0;
    for (let k = 0; k <= jp && k <= jz - i; k++) fw += PIO2[k] * q[i + k];
    fq[jz - i] = fw;
  }
  // prec 1 or 2
  fw = 0;
  for (let i = jz; i >= 0; i--) fw += fq[i];
  y[0] = ih === 0 ? fw : -fw;
  fw = fq[0] - fw;
  for (let i = 1; i <= jz; i++) fw += fq[i];
  y[1] = ih === 0 ? fw : -fw;
  return n & 7;
}

const C1 = 0.0416666666666666;
const C2 = -0.001388888888887411;
const C3 = 0.00002480158728947673;
const C4 = -2.7557314351390663e-7;
const C5 = 2.087572321298175e-9;
const C6 = -1.1359647557788195e-11;

function kernelCos(x, y) {
  const ix = high(x) & 0x7fffffff;
  if (ix < 0x3e400000) {
    if ((x | 0) === 0) return 1;
  }
  const z = x * x;
  const r = z * (C1 + z * (C2 + z * (C3 + z * (C4 + z * (C5 + z * C6)))));
  if (ix < 0x3fd33333) return 1 - (0.5 * z - (z * r - x * y));
  const qx = ix > 0x3fe90000 ? 0.28125 : fromWords(ix - 0x00200000, 0);
  const iz = 0.5 * z - qx;
  const a = 1 - qx;
  return a - (iz - (z * r - x * y));
}

const S1 = -0.16666666666666632;
const S2 = 0.00833333333332249;
const S3 = -0.0001984126982985795;
const S4 = 0.0000027557313707070068;
const S5 = -2.5050760253406863e-8;
const S6 = 1.58969099521155e-10;

function kernelSin(x, y, iy) {
  const ix = high(x) & 0x7fffffff;
  if (ix < 0x3e400000) {
    if ((x | 0) === 0) return x;
  }
  const z = x * x;
  const v = z * x;
  const r = S2 + z * (S3 + z * (S4 + z * (S5 + z * S6)));
  if (iy === 0) return x + v * (S1 + z * r);
  return x - (z * (0.5 * y - v * r) - y - v * S1);
}

const T = [
  0.3333333333333341, 0.13333333333320124, 0.05396825397622605, 0.021869488294859542,
  0.0088632398235993, 0.0035920791075913124, 0.0014562094543252903, 0.0005880412408202641,
  0.0002464631348184699, 0.00007817944429395571, 0.00007140724913826082, -0.000018558637485527546,
  0.00002590730518636337,
];
const PIO4 = 0.7853981633974483;
const PIO4LO = 3.061616997868383e-17;

function kernelTan(x, y, iy) {
  let z;
  let r;
  let v;
  let w;
  let s;
  const hx = high(x);
  const ix = hx & 0x7fffffff;
  if (ix < 0x3e300000) {
    if ((x | 0) === 0) {
      if ((ix | low(x) | (iy + 1)) === 0) return 1 / fabs(x);
      if (iy === 1) return x;
      z = w = x + y;
      z = withLow(z, 0);
      v = y - (z - x);
      const a = -1 / w;
      let t = a;
      t = withLow(t, 0);
      s = 1 + t * z;
      return t + a * (s + t * v);
    }
  }
  if (ix >= 0x3fe59428) {
    if (hx < 0) {
      x = -x;
      y = -y;
    }
    z = PIO4 - x;
    w = PIO4LO - y;
    x = z + w;
    y = 0.0;
  }
  z = x * x;
  w = z * z;
  r = T[1] + w * (T[3] + w * (T[5] + w * (T[7] + w * (T[9] + w * T[11]))));
  v = z * (T[2] + w * (T[4] + w * (T[6] + w * (T[8] + w * (T[10] + w * T[12])))));
  s = z * x;
  r = y + z * (s * (r + v) + y);
  r += T[0] * s;
  w = x + r;
  if (ix >= 0x3fe59428) {
    v = iy;
    return (1 - ((hx >> 30) & 2)) * (v - 2.0 * (x - ((w * w) / (w + v) - r)));
  }
  if (iy === 1) return w;
  z = w;
  z = withLow(z, 0);
  v = r - (z - x);
  const a = -1.0 / w;
  let t = a;
  t = withLow(t, 0);
  s = 1.0 + t * z;
  return t + a * (s + t * v);
}

// ---------------------------------------------------------------------------------------------
// Public functions

const PI = Math.PI;
const PIO2_HI = 1.5707963267948966;
const PIO2_LO = 6.123233995736766e-17;
const PIO4_HI = 0.7853981633974483;
const pS0 = 0.16666666666666666;
const pS1 = -0.3255658186224009;
const pS2 = 0.20121253213486293;
const pS3 = -0.04005553450067941;
const pS4 = 0.0007915349942898145;
const pS5 = 0.00003479331075960212;
const qS1 = -2.403394911734414;
const qS2 = 2.0209457602335057;
const qS3 = -0.6882839716054533;
const qS4 = 0.07703815055590194;

export function acos(x) {
  let z;
  let p;
  let q;
  let r;
  let w;
  let s;
  const hx = high(x);
  const ix = hx & 0x7fffffff;
  if (ix >= 0x3ff00000) {
    if (((ix - 0x3ff00000) | low(x)) === 0) {
      if (hx > 0) return 0.0;
      return PI + 2.0 * PIO2_LO;
    }
    return Number.NaN;
  }
  if (ix < 0x3fe00000) {
    if (ix <= 0x3c600000) return PIO2_HI + PIO2_LO;
    z = x * x;
    p = z * (pS0 + z * (pS1 + z * (pS2 + z * (pS3 + z * (pS4 + z * pS5)))));
    q = 1 + z * (qS1 + z * (qS2 + z * (qS3 + z * qS4)));
    r = p / q;
    return PIO2_HI - (x - (PIO2_LO - x * r));
  }
  if (hx < 0) {
    z = (1 + x) * 0.5;
    p = z * (pS0 + z * (pS1 + z * (pS2 + z * (pS3 + z * (pS4 + z * pS5)))));
    q = 1 + z * (qS1 + z * (qS2 + z * (qS3 + z * qS4)));
    s = sqrt(z);
    r = p / q;
    w = r * s - PIO2_LO;
    return PI - 2.0 * (s + w);
  }
  z = (1 - x) * 0.5;
  s = sqrt(z);
  const df = withLow(s, 0);
  const c = (z - df * df) / (s + df);
  p = z * (pS0 + z * (pS1 + z * (pS2 + z * (pS3 + z * (pS4 + z * pS5)))));
  q = 1 + z * (qS1 + z * (qS2 + z * (qS3 + z * qS4)));
  r = p / q;
  w = r * s + c;
  return 2.0 * (df + w);
}

const LN2 = Math.LN2;

export function acosh(x) {
  const hx = high(x);
  const lx = low(x);
  if (hx < 0x3ff00000) return Number.NaN;
  if (hx >= 0x41b00000) {
    if (hx >= 0x7ff00000) return x + x;
    return log(x) + LN2;
  }
  if (((hx - 0x3ff00000) | lx) === 0) return 0.0;
  if (hx > 0x40000000) {
    const t = x * x;
    return log(2.0 * x - 1 / (x + sqrt(t - 1)));
  }
  const t = x - 1;
  return log1p(t + sqrt(2.0 * t + t * t));
}

const HUGE = 1.0e300;

export function asin(x) {
  let t = 0;
  let w;
  let p;
  let q;
  let c;
  let r;
  let s;
  const hx = high(x);
  const ix = hx & 0x7fffffff;
  if (ix >= 0x3ff00000) {
    if (((ix - 0x3ff00000) | low(x)) === 0) return x * PIO2_HI + x * PIO2_LO;
    return Number.NaN;
  }
  if (ix < 0x3fe00000) {
    if (ix < 0x3e400000) {
      if (HUGE + x > 1) return x;
    } else {
      t = x * x;
    }
    p = t * (pS0 + t * (pS1 + t * (pS2 + t * (pS3 + t * (pS4 + t * pS5)))));
    q = 1 + t * (qS1 + t * (qS2 + t * (qS3 + t * qS4)));
    w = p / q;
    return x + x * w;
  }
  w = 1 - fabs(x);
  t = w * 0.5;
  p = t * (pS0 + t * (pS1 + t * (pS2 + t * (pS3 + t * (pS4 + t * pS5)))));
  q = 1 + t * (qS1 + t * (qS2 + t * (qS3 + t * qS4)));
  s = sqrt(t);
  if (ix >= 0x3fef3333) {
    w = p / q;
    t = PIO2_HI - (2.0 * (s + s * w) - PIO2_LO);
  } else {
    w = withLow(s, 0);
    c = (t - w * w) / (s + w);
    r = p / q;
    p = 2.0 * s * r - (PIO2_LO - 2.0 * c);
    q = PIO4_HI - 2.0 * w;
    t = PIO4_HI - (p - q);
  }
  return hx > 0 ? t : -t;
}

export function asinh(x) {
  let w;
  const hx = high(x);
  const ix = hx & 0x7fffffff;
  if (ix >= 0x7ff00000) return x + x;
  if (ix < 0x3e300000) {
    if (HUGE + x > 1) return x;
  }
  if (ix > 0x41b00000) {
    w = log(fabs(x)) + LN2;
  } else if (ix > 0x40000000) {
    const t = fabs(x);
    w = log(2.0 * t + 1 / (sqrt(x * x + 1) + t));
  } else {
    const t = x * x;
    w = log1p(fabs(x) + t / (1 + sqrt(1 + t)));
  }
  return hx > 0 ? w : -w;
}

const ATANHI = [0.4636476090008061, 0.7853981633974483, 0.982793723247329, 1.5707963267948966];
const ATANLO = [
  2.2698777452961687e-17, 3.061616997868383e-17, 1.3903311031230998e-17, 6.123233995736766e-17,
];
const AT = [
  0.3333333333333293, -0.19999999999876483, 0.14285714272503466, -0.11111110405462356,
  0.09090887133436507, -0.0769187620504483, 0.06661073137387531, -0.058335701337905735,
  0.049768779946159324, -0.036531572744216916, 0.016285820115365782,
];

export function atan(x) {
  let id;
  const hx = high(x);
  const ix = hx & 0x7fffffff;
  if (ix >= 0x44100000) {
    if (ix > 0x7ff00000 || (ix === 0x7ff00000 && low(x) !== 0)) return x + x;
    if (hx > 0) return ATANHI[3] + ATANLO[3];
    return -ATANHI[3] - ATANLO[3];
  }
  if (ix < 0x3fdc0000) {
    if (ix < 0x3e400000) {
      if (HUGE + x > 1) return x;
    }
    id = -1;
  } else {
    x = fabs(x);
    if (ix < 0x3ff30000) {
      if (ix < 0x3fe60000) {
        id = 0;
        x = (2.0 * x - 1) / (2.0 + x);
      } else {
        id = 1;
        x = (x - 1) / (x + 1);
      }
    } else if (ix < 0x40038000) {
      id = 2;
      x = (x - 1.5) / (1 + 1.5 * x);
    } else {
      id = 3;
      x = -1.0 / x;
    }
  }
  let z = x * x;
  const w = z * z;
  const s1 = z * (AT[0] + w * (AT[2] + w * (AT[4] + w * (AT[6] + w * (AT[8] + w * AT[10])))));
  const s2 = w * (AT[1] + w * (AT[3] + w * (AT[5] + w * (AT[7] + w * AT[9]))));
  if (id < 0) return x - x * (s1 + s2);
  z = ATANHI[id] - (x * (s1 + s2) - ATANLO[id] - x);
  return hx < 0 ? -z : z;
}

const TINY = 1.0e-300;
const PI_O_4 = 0.7853981633974483;
const PI_O_2 = 1.5707963267948966;
const PI_LO = 1.2246467991473532e-16;

export function atan2(y, x) {
  let z;
  const hx = high(x);
  const lx = low(x);
  const ix = hx & 0x7fffffff;
  const hy = high(y);
  const ly = low(y);
  const iy = hy & 0x7fffffff;
  if ((ix | ((lx | -lx) >>> 31)) > 0x7ff00000 || (iy | ((ly | -ly) >>> 31)) > 0x7ff00000)
    return x + y;
  if (((hx - 0x3ff00000) | 0 | lx) === 0) return atan(y);
  let m = ((hy >> 31) & 1) | ((hx >> 30) & 2);
  if ((iy | ly) === 0) {
    switch (m) {
      case 0:
      case 1:
        return y;
      case 2:
        return PI + TINY;
      default:
        return -PI - TINY;
    }
  }
  if ((ix | lx) === 0) return hy < 0 ? -PI_O_2 - TINY : PI_O_2 + TINY;
  if (ix === 0x7ff00000) {
    if (iy === 0x7ff00000) {
      switch (m) {
        case 0:
          return PI_O_4 + TINY;
        case 1:
          return -PI_O_4 - TINY;
        case 2:
          return 3.0 * PI_O_4 + TINY;
        default:
          return -3.0 * PI_O_4 - TINY;
      }
    }
    switch (m) {
      case 0:
        return 0.0;
      case 1:
        return -0.0;
      case 2:
        return PI + TINY;
      default:
        return -PI - TINY;
    }
  }
  if (iy === 0x7ff00000) return hy < 0 ? -PI_O_2 - TINY : PI_O_2 + TINY;
  const k = (iy - ix) >> 20;
  if (k > 60) {
    z = PI_O_2 + 0.5 * PI_LO;
    m &= 1;
  } else if (hx < 0 && k < -60) {
    z = 0.0;
  } else {
    z = atan(fabs(y / x));
  }
  switch (m) {
    case 0:
      return z;
    case 1:
      return -z;
    case 2:
      return PI - (z - PI_LO);
    default:
      return z - PI_LO - PI;
  }
}

const Y = [0, 0];

export function cos(x) {
  const ix = high(x) & 0x7fffffff;
  if (ix <= 0x3fe921fb) return kernelCos(x, 0.0);
  if (ix >= 0x7ff00000) return x - x;
  const n = remPio2(x, Y);
  switch (n & 3) {
    case 0:
      return kernelCos(Y[0], Y[1]);
    case 1:
      return -kernelSin(Y[0], Y[1], 1);
    case 2:
      return -kernelCos(Y[0], Y[1]);
    default:
      return kernelSin(Y[0], Y[1], 1);
  }
}

export function sin(x) {
  const ix = high(x) & 0x7fffffff;
  if (ix <= 0x3fe921fb) return kernelSin(x, 0.0, 0);
  if (ix >= 0x7ff00000) return x - x;
  const n = remPio2(x, Y);
  switch (n & 3) {
    case 0:
      return kernelSin(Y[0], Y[1], 1);
    case 1:
      return kernelCos(Y[0], Y[1]);
    case 2:
      return -kernelSin(Y[0], Y[1], 1);
    default:
      return -kernelCos(Y[0], Y[1]);
  }
}

export function tan(x) {
  const ix = high(x) & 0x7fffffff;
  if (ix <= 0x3fe921fb) return kernelTan(x, 0.0, 1);
  if (ix >= 0x7ff00000) return x - x;
  const n = remPio2(x, Y);
  return kernelTan(Y[0], Y[1], 1 - ((n & 1) << 1));
}

const O_THRESHOLD = 709.782712893384;
const U_THRESHOLD = -745.1332191019411;
const LN2HI = [0.6931471803691238, -0.6931471803691238];
const LN2LO = [1.9082149292705877e-10, -1.9082149292705877e-10];
const HALF = [0.5, -0.5];
const INVLN2 = Math.LOG2E;
const P1 = 0.16666666666666602;
const P2 = -0.0027777777777015593;
const P3 = 0.00006613756321437934;
const P4 = -0.0000016533902205465252;
const P5 = 4.1381367970572385e-8;
const E = Math.E;
const TWOM1000 = 9.332636185032189e-302;
const TWO1023 = 8.98846567431158e307;

export function exp(x) {
  let hi = 0.0;
  let lo = 0.0;
  let k = 0;
  let hx = highU(x);
  const xsb = (hx >>> 31) & 1;
  hx &= 0x7fffffff;
  if (hx >= 0x40862e42) {
    if (hx >= 0x7ff00000) {
      if (((hx & 0xfffff) | low(x)) !== 0) return x + x;
      return xsb === 0 ? x : 0.0;
    }
    if (x > O_THRESHOLD) return HUGE * HUGE;
    if (x < U_THRESHOLD) return TWOM1000 * TWOM1000;
  }
  if (hx > 0x3fd62e42) {
    if (hx < 0x3ff0a2b2) {
      if (x === 1.0) return E;
      hi = x - LN2HI[xsb];
      lo = LN2LO[xsb];
      k = 1 - xsb - xsb;
    } else {
      k = (INVLN2 * x + HALF[xsb]) | 0;
      const t = k;
      hi = x - t * LN2HI[0];
      lo = t * LN2LO[0];
    }
    x = hi - lo;
  } else if (hx < 0x3e300000) {
    if (HUGE + x > 1) return 1 + x;
  } else {
    k = 0;
  }
  const t = x * x;
  const twopk =
    k >= -1021
      ? fromWords((0x3ff00000 + (k << 20)) | 0, 0)
      : fromWords(0x3ff00000 + ((k + 1000) << 20), 0);
  const c = x - t * (P1 + t * (P2 + t * (P3 + t * (P4 + t * P5))));
  if (k === 0) return 1 - ((x * c) / (c - 2.0) - x);
  const y = 1 - (lo - (x * c) / (2.0 - c) - hi);
  if (k >= -1021) {
    if (k === 1024) return y * 2.0 * TWO1023;
    return y * twopk;
  }
  return y * twopk * TWOM1000;
}

export function atanh(x) {
  let t;
  const hx = high(x);
  const lx = low(x);
  const ix = hx & 0x7fffffff;
  if ((ix | ((lx | -lx) >>> 31)) > 0x3ff00000) return Number.NaN;
  if (ix === 0x3ff00000) return x > 0 ? Infinity : -Infinity;
  if (ix < 0x3e300000 && HUGE + x > 0) return x;
  x = withHigh(x, ix);
  if (ix < 0x3fe00000) {
    t = x + x;
    t = 0.5 * log1p(t + (t * x) / (1 - x));
  } else {
    t = 0.5 * log1p((x + x) / (1 - x));
  }
  return hx >= 0 ? t : -t;
}

const LN2_HI = 0.6931471803691238;
const LN2_LO = 1.9082149292705877e-10;
const TWO54 = 18014398509481984;
const Lg1 = 0.6666666666666735;
const Lg2 = 0.3999999999940942;
const Lg3 = 0.2857142874366239;
const Lg4 = 0.22222198432149784;
const Lg5 = 0.1818357216161805;
const Lg6 = 0.15313837699209373;
const Lg7 = 0.14798198605116586;

export function log(x) {
  let dk;
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
  let i = (hx + 0x95f64) & 0x100000;
  x = withHigh(x, hx | (i ^ 0x3ff00000));
  k += i >> 20;
  const f = x - 1.0;
  if ((0x000fffff & (2 + hx)) < 3) {
    if (f === 0) {
      if (k === 0) return 0;
      dk = k;
      return dk * LN2_HI + dk * LN2_LO;
    }
    const R = f * f * (0.5 - 0.3333333333333333 * f);
    if (k === 0) return f - R;
    dk = k;
    return dk * LN2_HI - (R - dk * LN2_LO - f);
  }
  const s = f / (2.0 + f);
  dk = k;
  const z = s * s;
  i = hx - 0x6147a;
  const w = z * z;
  const j = 0x6b851 - hx;
  const t1 = w * (Lg2 + w * (Lg4 + w * Lg6));
  const t2 = z * (Lg1 + w * (Lg3 + w * (Lg5 + w * Lg7)));
  i |= j;
  const R = t2 + t1;
  if (i > 0) {
    const hfsq = 0.5 * f * f;
    if (k === 0) return f - (hfsq - s * (hfsq + R));
    return dk * LN2_HI - (hfsq - (s * (hfsq + R) + dk * LN2_LO) - f);
  }
  if (k === 0) return f - s * (f - R);
  return dk * LN2_HI - (s * (f - R) - dk * LN2_LO - f);
}

export function log1p(x) {
  let f = 0;
  let c = 0;
  let u;
  let hu = 0;
  const hx = high(x);
  const ax = hx & 0x7fffffff;
  let k = 1;
  if (hx < 0x3fda827a) {
    if (ax >= 0x3ff00000) {
      if (x === -1.0) return -Infinity;
      return Number.NaN;
    }
    if (ax < 0x3e200000) {
      if (TWO54 + x > 0 && ax < 0x3c900000) return x;
      return x - x * x * 0.5;
    }
    if (hx > 0 || hx <= (0xbfd2bec4 | 0)) {
      k = 0;
      f = x;
      hu = 1;
    }
  }
  if (hx >= 0x7ff00000) return x + x;
  if (k !== 0) {
    if (hx < 0x43400000) {
      u = 1.0 + x;
      hu = high(u);
      k = (hu >> 20) - 1023;
      c = k > 0 ? 1.0 - (u - x) : x - (u - 1.0);
      c /= u;
    } else {
      u = x;
      hu = high(u);
      k = (hu >> 20) - 1023;
      c = 0;
    }
    hu &= 0x000fffff;
    if (hu < 0x6a09e) {
      u = withHigh(u, hu | 0x3ff00000);
    } else {
      k += 1;
      u = withHigh(u, hu | 0x3fe00000);
      hu = (0x00100000 - hu) >> 2;
    }
    f = u - 1.0;
  }
  const hfsq = 0.5 * f * f;
  if (hu === 0) {
    if (f === 0) {
      if (k === 0) return 0;
      c += k * LN2_LO;
      return k * LN2_HI + c;
    }
    const R = hfsq * (1.0 - 0.6666666666666666 * f);
    if (k === 0) return f - R;
    return k * LN2_HI - (R - (k * LN2_LO + c) - f);
  }
  const s = f / (2.0 + f);
  const z = s * s;
  const R = z * (Lg1 + z * (Lg2 + z * (Lg3 + z * (Lg4 + z * (Lg5 + z * (Lg6 + z * Lg7))))));
  if (k === 0) return f - (hfsq - s * (hfsq + R));
  return k * LN2_HI - (hfsq - (s * (hfsq + R) + (k * LN2_LO + c)) - f);
}

function kLog1p(f) {
  const s = f / (2.0 + f);
  const z = s * s;
  const w = z * z;
  const t1 = w * (Lg2 + w * (Lg4 + w * Lg6));
  const t2 = z * (Lg1 + w * (Lg3 + w * (Lg5 + w * Lg7)));
  const R = t2 + t1;
  const hfsq = 0.5 * f * f;
  return s * (hfsq + R);
}

const IVLN2HI = 1.4426950407214463;
const IVLN2LO = 1.6751713164886512e-10;

export function log2(x) {
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
  if (hx === 0x3ff00000 && lx === 0) return 0.0;
  k += (hx >> 20) - 1023;
  hx &= 0x000fffff;
  const i = (hx + 0x95f64) & 0x100000;
  x = withHigh(x, hx | (i ^ 0x3ff00000));
  k += i >> 20;
  const y = k;
  const f = x - 1.0;
  const hfsq = 0.5 * f * f;
  const r = kLog1p(f);
  let hi = f - hfsq;
  hi = withLow(hi, 0);
  const lo = f - hi - hfsq + r;
  let valHi = hi * IVLN2HI;
  let valLo = (lo + hi) * IVLN2LO + lo * IVLN2HI;
  const w = y + valHi;
  valLo += y - w + valHi;
  valHi = w;
  return valLo + valHi;
}

const IVLN10 = Math.LOG10E;
const LOG10_2HI = 0.30102999566361177;
const LOG10_2LO = 3.694239077158931e-13;

export function log10(x) {
  let hx = high(x);
  let lx = low(x);
  let k = 0;
  if (hx < 0x00100000) {
    if (((hx & 0x7fffffff) | lx) === 0) return -Infinity;
    if (hx < 0) return Number.NaN;
    k -= 54;
    x *= TWO54;
    hx = high(x);
    lx = low(x);
  }
  if (hx >= 0x7ff00000) return x + x;
  if (hx === 0x3ff00000 && lx === 0) return 0.0;
  k += (hx >> 20) - 1023;
  const i = (k & 0x80000000) >>> 31;
  hx = (hx & 0x000fffff) | ((0x3ff - i) << 20);
  const y = k + i;
  x = fromWords(hx, lx);
  const z = y * LOG10_2LO + IVLN10 * log(x);
  return z + y * LOG10_2HI;
}

const Q1 = -0.03333333333333313;
const Q2 = 0.0015873015872548146;
const Q3 = -0.0000793650757867488;
const Q4 = 0.000004008217827329362;
const Q5 = -2.0109921818362437e-7;

export function expm1(x) {
  let y;
  let hi;
  let lo;
  let c = 0;
  let t;
  let e;
  let k;
  let hx = highU(x);
  const xsb = hx & 0x80000000;
  hx &= 0x7fffffff;
  if (hx >= 0x4043687a) {
    if (hx >= 0x40862e42) {
      if (hx >= 0x7ff00000) {
        if (((hx & 0xfffff) | low(x)) !== 0) return x + x;
        return xsb === 0 ? x : -1.0;
      }
      if (x > O_THRESHOLD) return HUGE * HUGE;
    }
    if (xsb !== 0) {
      if (x + TINY < 0.0) return TINY - 1;
    }
  }
  if (hx > 0x3fd62e42) {
    if (hx < 0x3ff0a2b2) {
      if (xsb === 0) {
        hi = x - LN2_HI;
        lo = LN2_LO;
        k = 1;
      } else {
        hi = x + LN2_HI;
        lo = -LN2_LO;
        k = -1;
      }
    } else {
      k = (INVLN2 * x + (xsb === 0 ? 0.5 : -0.5)) | 0;
      t = k;
      hi = x - t * LN2_HI;
      lo = t * LN2_LO;
    }
    x = hi - lo;
    c = hi - x - lo;
  } else if (hx < 0x3c900000) {
    t = HUGE + x;
    return x - (t - (HUGE + x));
  } else {
    k = 0;
  }
  const hfx = 0.5 * x;
  const hxs = x * hfx;
  const r1 = 1 + hxs * (Q1 + hxs * (Q2 + hxs * (Q3 + hxs * (Q4 + hxs * Q5))));
  t = 3.0 - r1 * hfx;
  e = hxs * ((r1 - t) / (6.0 - x * t));
  if (k === 0) return x - (x * e - hxs);
  const twopk = fromWords((0x3ff00000 + (k << 20)) | 0, 0);
  e = x * (e - c) - c;
  e -= hxs;
  if (k === -1) return 0.5 * (x - e) - 0.5;
  if (k === 1) {
    if (x < -0.25) return -2.0 * (e - (x + 0.5));
    return 1 + 2.0 * (x - e);
  }
  if (k <= -2 || k > 56) {
    y = 1 - (e - x);
    if (k === 1024) y = y * 2.0 * 8.98846567431158e307;
    else y = y * twopk;
    return y - 1;
  }
  t = 1;
  if (k < 20) {
    t = withHigh(t, 0x3ff00000 - (0x200000 >> k));
    y = t - (e - x);
    y = y * twopk;
  } else {
    t = withHigh(t, (0x3ff - k) << 20);
    y = x - (e + t);
    y += 1;
    y = y * twopk;
  }
  return y;
}

const B1 = 715094163;
const B2 = 696219795;
const CP0 = 1.87595182427177;
const CP1 = -1.8849797954337717;
const CP2 = 1.6214297201053545;
const CP3 = -0.758397934778766;
const CP4 = 0.14599619288661245;

export function cbrt(x) {
  let hx = high(x);
  const lo = low(x);
  let t = 0.0;
  const sign = hx & 0x80000000;
  hx ^= sign;
  if (hx >= 0x7ff00000) return x + x;
  if (hx < 0x00100000) {
    if ((hx | lo) === 0) return x;
    t = withHigh(t, 0x43500000);
    t *= x;
    const hi = highU(t);
    t = fromWords(sign | (Math.trunc((hi & 0x7fffffff) / 3) + B2), 0);
  } else {
    t = fromWords(sign | (Math.trunc(hx / 3) + B1), 0);
  }
  let r = t * t * (t / x);
  t = t * (CP0 + r * (CP1 + r * CP2) + r * r * r * (CP3 + r * CP4));
  // bits = (bits + 0x80000000) & 0xFFFFFFFFC0000000
  const lw = low(t) + 0x80000000;
  const carry = lw >= 0x100000000 ? 1 : 0;
  t = fromWords(highU(t) + carry, lw & 0xc0000000);
  const s = t * t;
  r = x / s;
  const w = t + t;
  r = (r - t) / (w + r);
  t = t + t * r;
  return t;
}

const KCOSH_OVERFLOW = 710.4758600739439;

export function cosh(x) {
  const ix = high(x) & 0x7fffffff;
  if (ix < 0x3fd62e43) {
    const t = expm1(fabs(x));
    const w = 1 + t;
    if (ix < 0x3c800000) return w;
    return 1 + (t * t) / (w + w);
  }
  if (ix < 0x40360000) {
    const t = exp(fabs(x));
    return 0.5 * t + 0.5 / t;
  }
  if (ix < 0x40862e42) return 0.5 * exp(fabs(x));
  if (fabs(x) <= KCOSH_OVERFLOW) {
    const w = exp(0.5 * fabs(x));
    const t = 0.5 * w;
    return t * w;
  }
  if (ix >= 0x7ff00000) return x * x;
  return HUGE * HUGE;
}

const TWO_M28 = 3.725290298461914e-9;
const LOG_MAXD = 709.7822265625;
const SHUGE = 1.0e307;

export function sinh(x) {
  const h = x < 0 ? -0.5 : 0.5;
  const ax = fabs(x);
  if (ax < 22) {
    if (ax < TWO_M28) return x;
    const t = expm1(ax);
    if (ax < 1) return h * (2 * t - (t * t) / (t + 1));
    return h * (t + t / (t + 1));
  }
  if (ax < LOG_MAXD) return h * exp(ax);
  if (ax <= KCOSH_OVERFLOW) {
    const w = exp(0.5 * ax);
    const t = h * w;
    return t * w;
  }
  return x * SHUGE;
}

export function tanh(x) {
  let t;
  let z;
  const jx = high(x);
  const ix = jx & 0x7fffffff;
  if (ix >= 0x7ff00000) {
    if (jx >= 0) return 1 / x + 1;
    return 1 / x - 1;
  }
  if (ix < 0x40360000) {
    if (ix < 0x3e300000) {
      if (HUGE + x > 1) return x;
    }
    if (ix >= 0x3ff00000) {
      t = expm1(2 * fabs(x));
      z = 1 - 2 / (t + 2);
    } else {
      t = expm1(-2 * fabs(x));
      z = -t / (t + 2);
    }
  } else {
    z = 1 - TINY;
  }
  return jx >= 0 ? z : -z;
}

/** `x ** y` for the non-negative bases geometry uses, as the Telekom model has always computed it. */
export function pow(x, y) {
  if (x < 0 || Number.isNaN(x)) throw new RangeError(`pow expects a non-negative base, got ${x}`);
  if (y === 0) return 1;
  if (x === 0) return y > 0 ? 0 : Infinity;
  return exp(y * log(x));
}

const REPLACED = {
  acos,
  acosh,
  asin,
  asinh,
  atan,
  atan2,
  atanh,
  cbrt,
  cos,
  cosh,
  exp,
  expm1,
  log,
  log10,
  log1p,
  log2,
  pow: portablePow,
  sin,
  sinh,
  tan,
  tanh,
};
const INSTALLED = Symbol.for('molen.deterministicMath');

/** Replace Math's CPU-dependent functions in this process. */
export function installDeterministicMath() {
  if (Math[INSTALLED]) return;
  for (const [name, value] of Object.entries(REPLACED))
    Object.defineProperty(Math, name, { value, writable: true, configurable: true });
  Object.defineProperty(Math, INSTALLED, { value: true });
}
