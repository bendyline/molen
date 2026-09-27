/** Authoring-time WGS84 geometry fitting. No map-axis fit implies facade-direction verification. */
const metersPerDegree = (Math.PI * 6378137) / 180;
export function metricFrame(anchor) {
  const xScale = metersPerDegree * Math.cos((anchor[1] * Math.PI) / 180);
  return {
    project: (point) => [(point[0] - anchor[0]) * xScale, (point[1] - anchor[1]) * metersPerDegree],
    unproject: (point) => [anchor[0] + point[0] / xScale, anchor[1] + point[1] / metersPerDegree],
  };
}
const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
export function convexHull(points) {
  const sorted = [...new Map(points.map((point) => [point.join(','), point])).values()].sort(
    (a, b) => a[0] - b[0] || a[1] - b[1],
  );
  if (sorted.length < 3) return sorted;
  const lower = [],
    upper = [];
  for (const point of sorted) {
    while (lower.length > 1 && cross(lower.at(-2), lower.at(-1), point) <= 0) lower.pop();
    lower.push(point);
  }
  for (const point of [...sorted].reverse()) {
    while (upper.length > 1 && cross(upper.at(-2), upper.at(-1), point) <= 0) upper.pop();
    upper.push(point);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}
/** Smallest oriented rectangle. Longitude/latitude ordering is explicit at the boundary. */
export function fitMapFrame(coordinates, reference) {
  if (coordinates.length < 2) return undefined;
  const projection = metricFrame(reference);
  const points = coordinates.map(projection.project);
  const hull = convexHull(points);
  let best;
  for (let index = 0; index < hull.length; index++) {
    const a = hull[index],
      b = hull[(index + 1) % hull.length];
    if (!a || !b || Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.01) continue;
    let heading = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const c = Math.cos(heading),
      s = Math.sin(heading);
    const rotated = points.map(([x, north]) => [c * x + s * north, s * x - c * north]);
    const minimum = [Math.min(...rotated.map((p) => p[0])), Math.min(...rotated.map((p) => p[1]))];
    const maximum = [Math.max(...rotated.map((p) => p[0])), Math.max(...rotated.map((p) => p[1]))];
    let length = maximum[0] - minimum[0],
      width = maximum[1] - minimum[1];
    const area = length * width;
    if (best && area >= best.area - 1e-6) continue;
    const center = [(minimum[0] + maximum[0]) / 2, (minimum[1] + maximum[1]) / 2];
    const anchor = projection.unproject([
      c * center[0] + s * center[1],
      s * center[0] - c * center[1],
    ]);
    if (width > length) {
      [length, width] = [width, length];
      heading += Math.PI / 2;
    }
    while (heading < -Math.PI / 2) heading += Math.PI;
    while (heading >= Math.PI / 2) heading -= Math.PI;
    best = { anchor, heading, length, width, area };
  }
  if (!best || best.length < 0.1 || !Number.isFinite(best.area)) return undefined;
  const local = metricFrame(best.anchor),
    c = Math.cos(best.heading),
    s = Math.sin(best.heading);
  return {
    ...best,
    toLocal: (point) => {
      const [x, north] = local.project(point);
      return [c * x + s * north, s * x - c * north];
    },
  };
}
export function featureLines(feature) {
  if (feature.geometry)
    return [
      {
        role: 'outer',
        coordinates: feature.geometry
          .filter((p) => Number.isFinite(p.lon) && Number.isFinite(p.lat))
          .map((p) => [p.lon, p.lat]),
      },
    ];
  const lines = (feature.members ?? [])
    .filter((member) => member.geometry?.length)
    .map((member) => ({
      role: member.role || 'outer',
      coordinates: member.geometry
        .filter((p) => Number.isFinite(p.lon) && Number.isFinite(p.lat))
        .map((p) => [p.lon, p.lat]),
    }));
  const joined = [];
  while (lines.length) {
    const line = lines.shift();
    let changed = true;
    while (changed && !closedLine(line.coordinates)) {
      changed = false;
      for (let index = 0; index < lines.length; index++) {
        const next = lines[index];
        if (next.role !== line.role) continue;
        const same = (a, b) => a?.[0] === b?.[0] && a?.[1] === b?.[1];
        if (same(line.coordinates.at(-1), next.coordinates[0]))
          line.coordinates.push(...next.coordinates.slice(1));
        else if (same(line.coordinates.at(-1), next.coordinates.at(-1)))
          line.coordinates.push(...next.coordinates.slice(0, -1).reverse());
        else if (same(line.coordinates[0], next.coordinates.at(-1)))
          line.coordinates.unshift(...next.coordinates.slice(0, -1));
        else if (same(line.coordinates[0], next.coordinates[0]))
          line.coordinates.unshift(...next.coordinates.slice(1).reverse());
        else continue;
        lines.splice(index, 1);
        changed = true;
        break;
      }
    }
    joined.push(line);
  }
  return joined;
}
export function closedLine(line) {
  return line.length >= 4 && line[0][0] === line.at(-1)[0] && line[0][1] === line.at(-1)[1];
}
export function featureIsObsolete(feature) {
  const tags = feature.tags ?? {};
  return (
    ['demolished', 'razed', 'destroyed', 'removed', 'proposed', 'construction'].some(
      (prefix) =>
        tags[prefix] === 'yes' ||
        Object.keys(tags).some((key) => key.startsWith(`${prefix}:`) && !key.endsWith(':date')),
    ) || tags.building === 'construction'
  );
}
export function lengthMeters(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : undefined;
  const text = String(value ?? '').trim();
  const match = /^([\d.]+)\s*(m|metres|meters|ft|feet)?$/.exec(text);
  if (!match) return undefined;
  const number = Number(match[1]) * (['ft', 'feet'].includes(match[2]) ? 0.3048 : 1);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}
