"""Preserve an independent bridge terrain set from cached public Copernicus COGs.

Requires Python 3 and Pillow. No downloaded pixels are changed or fitted to a model.
Fetch the COG URLs recorded below into .artifacts/bridge-terrain first.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
SOURCE_ROOT = ROOT / 'content/worldgen/source'
SOURCE_INDEX = json.loads((SOURCE_ROOT / 'structure-index.json').read_text(encoding='utf8'))
if SOURCE_INDEX.get('format') != 'molen/structure-source-index@1':
    raise ValueError('Invalid structure source index')
SOURCE_ENTRIES = {entry['key']: entry for entry in SOURCE_INDEX['entries']}
if len(SOURCE_ENTRIES) != len(SOURCE_INDEX['entries']):
    raise ValueError('Duplicate structure source key')
PARSER = argparse.ArgumentParser()
PARSER.add_argument('--ids', default='N0011,N0012,N0014')
ARGS = PARSER.parse_args()
RADIUS = 6378137


def digest(data):
    return 'sha256:' + hashlib.sha256(data).hexdigest()


for candidate in ARGS.ids.split(','):
    if len(candidate) != 5 or candidate[0] != 'N' or not candidate[1:].isdigit():
        raise ValueError('Invalid candidate ID')
    existing = ROOT / 'content/earth/structures/evidence/bridge-terrain' / (candidate + '.json')
    evidence = json.loads(existing.read_text(encoding='utf8'))
    source_entry = SOURCE_ENTRIES[evidence['modelFolder']]
    source_directory = (ROOT / source_entry['sourcePath']).resolve()
    if not source_directory.is_relative_to(SOURCE_ROOT.resolve()):
        raise ValueError('Structure source path escapes source directory')
    spec_path = source_directory / 'spec.json'
    spec_bytes = spec_path.read_bytes()
    spec = json.loads(spec_bytes)
    if spec['geographicProposal']['anchor'] != evidence['anchor']:
        raise ValueError('Regenerate the geographic grid after an anchor change')
    suffix = 'copernicus90' if candidate == 'N0014' else 'copernicus'
    source = ROOT / '.artifacts/bridge-terrain' / (candidate + '-' + suffix + '.tif')
    image = Image.open(source)
    tiepoint = image.tag_v2[33922]
    scale = image.tag_v2[33550]
    keys = image.tag_v2[34735]
    raster_type = next(keys[i + 3] for i in range(4, len(keys), 4) if keys[i] == 1025)
    if raster_type != 2:
        raise ValueError('Expected RasterPixelIsPoint, not area-centered raster')
    data = image.load()

    def sample_world(x, z):
        lon = x / evidence['factor'] / RADIUS * 180 / math.pi
        lat = math.atan(math.sinh(-z / evidence['factor'] / RADIUS)) * 180 / math.pi
        px = (lon - tiepoint[3]) / scale[0] + tiepoint[0]
        py = (tiepoint[4] - lat) / scale[1] + tiepoint[1]
        ix, iy = math.floor(px), math.floor(py)
        if ix < 0 or iy < 0 or ix + 1 >= image.width or iy + 1 >= image.height:
            raise ValueError('Sample lies beyond this COG; do not clamp across a tile boundary')
        u, v = px - ix, py - iy
        return (data[ix, iy] * (1-u)*(1-v) + data[ix+1, iy]*u*(1-v)
                + data[ix, iy+1]*(1-u)*v + data[ix+1, iy+1]*u*v)

    size, resolution = evidence['size'], evidence['resolution']
    ox, oz = evidence['worldOrigin']
    heights = [round(sample_world(ox + col*size/(resolution-1), oz + row*size/(resolution-1)), 4)
               for row in range(resolution) for col in range(resolution)]
    lat, lon = int(tiepoint[4]-1), int(tiepoint[3])
    spacing = 30 if suffix == 'copernicus' else 90
    key = f'Copernicus_DSM_COG_{10 if spacing == 30 else 30}_N{lat}_00_E{lon:03d}_00_DEM'
    url = f'https://copernicus-dem-{spacing}m.s3.amazonaws.com/{key}/{key}.tif'
    evidence.update({
        'specHash': digest(spec_bytes),
        'heightRange': [min(heights), max(heights)],
        'anchorElevation': sample_world(*evidence['worldCenter']),
        'heights': heights,
        'sources': [{'url': url, 'sha256': digest(source.read_bytes()),
                     'nativeArcSecond': scale[1]*3600, 'rasterPixelType': 'point'}],
        'sourcePixelGroundSpacing': scale[1]*math.pi/180*RADIUS,
        'sourceLabel': f'Copernicus GLO-{spacing}, unmodified surface model',
        'verticalReference': 'EGM2008; retained in this isolated comparison, no datum conversion',
        'attribution': 'Copernicus Digital Elevation Model; European Union, ESA and Airbus',
        'attributionUrl': 'https://registry.opendata.aws/copernicus-dem/',
        'encodingReference': f'https://copernicus-dem-{spacing}m.s3.amazonaws.com/readme.html',
        'method': 'Bilinear sampling of original Float32 GeoTIFF point samples into the same metric review grid. No valley carving, model fitting, height correction or bridge removal.',
        'limitations': ['Surface model can include vegetation and infrastructure.',
                        'Review grid spacing is not native terrain accuracy.',
                        'Source is EGM2008; do not mix its absolute elevations into an EGM96 or unspecified host datum.'],
    })
    output = existing.parent / 'copernicus'
    output.mkdir(exist_ok=True)
    (output / existing.name).write_text(json.dumps(evidence, indent=2)+'\n', encoding='utf8', newline='\n')
    print(candidate, evidence['sourceLabel'], f"anchor {evidence['anchorElevation']:.3f} m")
