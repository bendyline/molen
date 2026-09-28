/** Reject self-crossing or degenerate local ground-opening rings before placement. */
export function validGroundOutline(input: [number, number][]): boolean {
  const p = input.slice();
  if (p.length > 3 && p[0]?.[0] === p.at(-1)?.[0] && p[0]?.[1] === p.at(-1)?.[1]) p.pop();
  const cross = (a: number[], b: number[], c: number[]) =>
    ((b[0] ?? 0) - (a[0] ?? 0)) * ((c[1] ?? 0) - (a[1] ?? 0)) -
    ((b[1] ?? 0) - (a[1] ?? 0)) * ((c[0] ?? 0) - (a[0] ?? 0));
  let area = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i] as [number, number],
      b = p[(i + 1) % p.length] as [number, number];
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6) return false;
    area += a[0] * b[1] - b[0] * a[1];
    for (let j = i + 2; j < p.length; j++) {
      if (i === 0 && j === p.length - 1) continue;
      const c = p[j] as [number, number],
        d = p[(j + 1) % p.length] as [number, number];
      if (
        cross(a, b, c) * cross(a, b, d) <= 0 &&
        cross(c, d, a) * cross(c, d, b) <= 0 &&
        Math.max(Math.min(a[0], b[0]), Math.min(c[0], d[0])) <=
          Math.min(Math.max(a[0], b[0]), Math.max(c[0], d[0])) &&
        Math.max(Math.min(a[1], b[1]), Math.min(c[1], d[1])) <=
          Math.min(Math.max(a[1], b[1]), Math.max(c[1], d[1]))
      )
        return false;
    }
  }
  return Math.abs(area) > 1e-6;
}
