"""Bake Natural Earth 1:50m country outlines for coarse architectural selection.

Authoring only. Requires pyshp from ecology-requirements.txt; accepts the source ZIP explicitly.
Keeps islands, simplifies exterior rings to 0.02 degrees, rounds coordinates to 0.001 degrees.
These are visual priors, not a political boundary service or building-style survey.
"""
import argparse
import gzip
import hashlib
import json
from pathlib import Path
import shapefile


def simplify(points, tolerance=0.02):
    # Iterative Douglas-Peucker, with a stable farthest-point split for closed rings.
    def line(vertices):
        keep = {0, len(vertices) - 1}
        stack = [(0, len(vertices) - 1)]
        while stack:
            start, end = stack.pop()
            a, b = vertices[start], vertices[end]
            dx, dy = b[0] - a[0], b[1] - a[1]
            length = dx * dx + dy * dy
            maximum, index = tolerance * tolerance, None
            for i in range(start + 1, end):
                p = vertices[i]
                t = max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length)) if length else 0
                distance = (p[0] - a[0] - t * dx) ** 2 + (p[1] - a[1] - t * dy) ** 2
                if distance > maximum:
                    maximum, index = distance, i
            if index is not None:
                keep.add(index)
                stack.extend([(start, index), (index, end)])
        return [vertices[i] for i in sorted(keep)]
    if points[0] == points[-1]:
        points = points[:-1]
    split = max(range(1, len(points)), key=lambda i: (points[i][0] - points[0][0]) ** 2 + (points[i][1] - points[0][1]) ** 2)
    result = line(points[:split + 1])[:-1] + line(points[split:] + [points[0]])[:-1]
    if len(result) < 3:
        result = points
    rounded = []
    for x, y in result:
        point = [round(x, 3), round(y, 3)]
        if not rounded or point != rounded[-1]:
            rounded.append(point)
    if len(rounded) > 1 and rounded[0] == rounded[-1]:
        rounded.pop()
    return rounded if len({tuple(p) for p in rounded}) >= 3 else []


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('--out', type=Path, default=Path('content/earth/source/architecture-countries.json'))
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    digest = hashlib.file_digest(args.source.open('rb'), 'sha256').hexdigest()
    if digest != '5fed433373581fa648920435f937d95f2d3c0200e067409c6478dcdf1b853139':
        raise ValueError('Expected the pinned Natural Earth 5.1.1 source archive')
    reader = shapefile.Reader(str(args.source), encoding='utf8')
    countries = []
    for shape in reader.iterShapeRecords():
        record = shape.record.as_dict()
        if record['REGION_UN'] == 'Antarctica':
            continue
        code = record['ISO_A2_EH']
        if code == '-99':
            code = record['ADM0_A3']
        geometry = shape.shape.__geo_interface__
        polygons = [geometry['coordinates']] if geometry['type'] == 'Polygon' else geometry['coordinates']
        rings = [simplify(list(polygon[0])) for polygon in polygons]
        rings = [ring for ring in rings if ring]
        if any(abs(a[0] - b[0]) > 180 for ring in rings for a, b in zip(ring, ring[1:] + ring[:1])):
            raise ValueError(f'Unexpected antimeridian-crossing ring: {code}')
        countries.append({'code': code, 'name': record['NAME_EN'], 'subregion': record['SUBREGION'], 'polygons': rings})
    countries.sort(key=lambda country: country['code'])
    result = {'source': {'title': 'Natural Earth Admin 0 Countries 1:50m, 5.1.1',
                        'url': 'https://naturalearth.s3.amazonaws.com/50m_cultural/ne_50m_admin_0_countries.zip',
                        'license': 'public-domain', 'sha256': f'sha256:{digest}',
                        'interpretation': 'Coarse exterior outlines for visual content selection. Simplified at 0.02 degrees, rounded to 0.001 degrees. Source de facto boundaries; no claims about architectural identity.'},
              'countries': countries}
    output = (json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n').encode('utf8')
    if args.check:
        if args.out.read_bytes() != output:
            raise ValueError('Stale architectural boundary data')
    else:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_bytes(output)
    print(json.dumps({'countries': len(countries), 'vertices': sum(len(ring) for c in countries for ring in c['polygons']), 'bytes': len(output), 'gzipBytes': len(gzip.compress(output, mtime=0))}))


if __name__ == '__main__':
    main()
