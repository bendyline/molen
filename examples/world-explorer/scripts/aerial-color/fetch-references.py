"""Download the open orthophoto for every aerial-color frame.

Usage (from the repository root):
    python -I examples/world-explorer/scripts/aerial-color/fetch-references.py [--out DIR] [--ids a,b]

Each frame's ground extent is cut from a public-domain or openly licensed source and resampled to
1200 x 800 (2 m per pixel for the default 2400 x 1600 m extent). Photographs are comparison
evidence only; they stay in the ignored output directory and never become runtime textures.
"""

import argparse
import datetime
import hashlib
import io
import json
import math
import pathlib
import subprocess
import time
import urllib.parse

from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[3]
SIZE = (1200, 800)
EARTH = 6378137.0
USER_AGENT = 'molen-aerial-color/1 (+https://github.com/bendyline/molen)'

PROVIDERS = {
    'naip': {
        'credit': 'USGS National Map / USDA NAIP Plus',
        'license': 'Public domain (U.S. Government work)',
        'service': 'https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPPlus/ImageServer/exportImage',
    },
    'nsw': {
        'credit': 'NSW Spatial Services, Department of Customer Service',
        'license': 'CC BY 4.0',
        'service': 'https://maps.six.nsw.gov.au/arcgis/rest/services/public/NSW_Imagery/MapServer/export',
    },
    'gsi': {
        'credit': 'Geospatial Information Authority of Japan (GSI) seamless aerial photographs',
        'license': 'GSI Content Terms of Use (compatible with CC BY 4.0; attribution required)',
        'service': 'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg',
    },
    'sentinel2': {
        'credit': 'Contains modified Copernicus Sentinel data 2026, via Microsoft Planetary Computer',
        'license': 'Copernicus Sentinel data terms (free, full and open, including commercial use)',
        'service': 'https://planetarycomputer.microsoft.com/api/data/v1/item/bbox',
    },
}


def fetch(url):
    # curl uses the operating system's certificate store, which Python's bundled one may not match.
    for attempt in range(4):
        result = subprocess.run(
            ['curl', '-sSfL', '--max-time', '120', '-A', USER_AGENT, url],
            capture_output=True,
            check=False,
        )
        if result.returncode == 0 and result.stdout:
            return result.stdout
        if attempt == 3:
            raise RuntimeError(f'{url}: {result.stderr.decode(errors="replace").strip()}')
        time.sleep(2 + attempt * 3)
    raise RuntimeError('unreachable')


def mercator(lat, lon):
    x = math.radians(lon) * EARTH
    y = math.log(math.tan(math.pi / 4 + math.radians(lat) / 2)) * EARTH
    return x, y


def mercator_bbox(center, extent):
    """Web Mercator bounds whose ground size is `extent` meters at the frame's latitude."""
    lat, lon = center
    x, y = mercator(lat, lon)
    scale = 1 / math.cos(math.radians(lat))
    half_w, half_h = extent[0] / 2 * scale, extent[1] / 2 * scale
    return [x - half_w, y - half_h, x + half_w, y + half_h]


def arcgis_export(service, bbox):
    query = urllib.parse.urlencode(
        {
            'bbox': ','.join(repr(v) for v in bbox),
            'bboxSR': 3857,
            'imageSR': 3857,
            'size': f'{SIZE[0]},{SIZE[1]}',
            'format': 'png',
            'f': 'image',
        }
    )
    url = f'{service}?{query}'
    return url, [fetch(url)]


def gsi_mosaic(service, bbox, zoom=17):
    """Mosaic GSI XYZ tiles and cut the exact Mercator bounds."""
    world = 2 * math.pi * EARTH
    tiles = 2**zoom

    def pixel(x, y):
        return ((x + world / 2) / world * tiles * 256, (world / 2 - y) / world * tiles * 256)

    left, top = pixel(bbox[0], bbox[3])
    right, bottom = pixel(bbox[2], bbox[1])
    x0, x1 = int(left // 256), int(right // 256)
    y0, y1 = int(top // 256), int(bottom // 256)
    mosaic = Image.new('RGB', ((x1 - x0 + 1) * 256, (y1 - y0 + 1) * 256))
    urls, payloads = [], []
    for ty in range(y0, y1 + 1):
        for tx in range(x0, x1 + 1):
            url = service.format(z=zoom, x=tx, y=ty)
            data = fetch(url)
            urls.append(url)
            payloads.append(data)
            tile = Image.open(io.BytesIO(data)).convert('RGB')
            mosaic.paste(tile, ((tx - x0) * 256, (ty - y0) * 256))
    box = (left - x0 * 256, top - y0 * 256, right - x0 * 256, bottom - y0 * 256)
    image = mosaic.resize(SIZE, Image.Resampling.LANCZOS, box=box)
    return urls, payloads, image


def sentinel_crop(service, frame, extent):
    """Planetary Computer crop of one Sentinel-2 L2A true-color item at its native 10 m."""
    lat, lon = frame['center']
    dlat = extent[1] / 2 / 111_320
    dlon = extent[0] / 2 / (111_320 * math.cos(math.radians(lat)))
    native = (round(extent[0] / 10), round(extent[1] / 10))
    query = urllib.parse.urlencode(
        {
            'collection': 'sentinel-2-l2a',
            'item': frame['sentinelItem'],
            'assets': 'visual',
            'asset_bidx': 'visual|1,2,3',
            'nodata': 0,
        }
    )
    bounds = f'{lon - dlon:.6f},{lat - dlat:.6f},{lon + dlon:.6f},{lat + dlat:.6f}'
    url = f'{service}/{bounds}/{native[0]}x{native[1]}.png?{query}'
    data = fetch(url)
    image = Image.open(io.BytesIO(data)).convert('RGB').resize(SIZE, Image.Resampling.BICUBIC)
    return url, [data], image


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--out', default=str(ROOT / '.artifacts/aerial-color/references'))
    parser.add_argument('--ids', default='')
    args = parser.parse_args()
    config = json.loads((HERE / 'frames.json').read_text(encoding='utf8'))
    extent = config['extentMeters']
    wanted = {i for i in args.ids.split(',') if i}
    out = pathlib.Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    manifest_path = out / 'references.json'
    manifest = (
        json.loads(manifest_path.read_text(encoding='utf8')) if manifest_path.exists() else {}
    )
    for frame in config['frames']:
        if wanted and frame['id'] not in wanted:
            continue
        provider = PROVIDERS[frame['provider']]
        bbox = mercator_bbox(frame['center'], extent)
        if frame['provider'] in ('naip', 'nsw'):
            url, payloads = arcgis_export(provider['service'], bbox)
            urls = [url]
            image = Image.open(io.BytesIO(payloads[0])).convert('RGB')
        elif frame['provider'] == 'gsi':
            urls, payloads, image = gsi_mosaic(provider['service'], bbox)
        else:
            url, payloads, image = sentinel_crop(provider['service'], frame, extent)
            urls = [url]
        if image.size != SIZE:
            image = image.resize(SIZE, Image.Resampling.LANCZOS)
        path = out / f'{frame["id"]}.png'
        image.save(path)
        manifest[frame['id']] = {
            'provider': frame['provider'],
            'credit': provider['credit'],
            'license': provider['license'],
            'center': frame['center'],
            'extentMeters': extent,
            'bboxEPSG3857': bbox,
            'nativeMetersPerPixel': 10 if frame['provider'] == 'sentinel2' else None,
            'sources': [
                {'url': u, 'sha256': hashlib.sha256(p).hexdigest(), 'bytes': len(p)}
                for u, p in zip(urls, payloads)
            ],
            'image': path.name,
            'retrieved': datetime.date.today().isoformat(),
        }
        print(f'{frame["id"]}: {path} from {len(urls)} source request(s)')
    manifest_path.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf8', newline='\n')


if __name__ == '__main__':
    main()
