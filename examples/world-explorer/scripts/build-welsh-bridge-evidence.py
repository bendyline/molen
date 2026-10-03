"""Rebuild Monnow's independent 1 m LiDAR evidence from the hashed official source tiles.

Research-only dependencies: Pillow, numpy, pyproj==3.7.2. Run from the repository root.
The local research dependency directory is optional; the GLB generator uses committed JSON
and does not depend on Python or network access. Raw tiles and OSTN15 grid stay in .artifacts.
"""
import hashlib
import json
import math
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

sys.path.insert(0, '.artifacts/bridge-terrain/python-libs')
import numpy as np
from PIL import Image
from pyproj import datadir
from pyproj.aoi import AreaOfInterest
from pyproj.transformer import TransformerGroup

cache = Path('.artifacts/bridge-terrain/wales')
output = Path('content/earth/structures/evidence/bridge-terrain/wales')
output.mkdir(parents=True, exist_ok=True)
datadir.append_data_dir(str(cache.resolve()))
group = TransformerGroup(4326, 27700, always_xy=True,
    area_of_interest=AreaOfInterest(-2.73, 51.8, -2.71, 51.82), allow_ballpark=False)
if not group.best_available:
    raise RuntimeError('Install the recorded OSTN15 grid; do not fall back to a Helmert transform')
transform = group.transformers[0]
source = Path('content/worldgen/source/places/gc/gcn/n0015_monnow_bridge')
spec = json.loads((source / 'spec.json').read_text())
anchor = spec['geographicProposal']['anchor']
heading = spec['geographicProposal']['heading']
radius = 6378137
factor = math.cos(math.radians(anchor[1]))
cx = math.radians(anchor[0]) * radius * factor
cz = -radius * math.asinh(math.tan(math.radians(anchor[1]))) * factor
sha = lambda p: 'sha256:' + hashlib.sha256(Path(p).read_bytes()).hexdigest()
grids = {}
sources = []
for kind in ['dtm', 'dsm']:
    path = cache / f'wg_del_20_350212_20220112{kind}.tif'
    image = Image.open(path)
    assert image.mode == 'F' and image.size == (1000, 1000)
    assert image.tag_v2[33922] == (0, 0, 0, 350000, 213000, 0)
    assert image.tag_v2[33550] == (1, 1, 0)
    grids[kind] = np.array(image)
    sources.append({'kind': kind, 'url': f'https://dmwproductionblob.blob.core.windows.net/lidar-zips/2020-22/{kind}/{path.name}',
        'path': path.as_posix(), 'hash': sha(path)})

def sample(kind, wx, wz):
    lon = math.degrees(wx / factor / radius)
    lat = math.degrees(math.atan(math.sinh(-wz / factor / radius)))
    east, north = transform.transform(lon, lat)
    u, v = east - 350000 - .5, 213000 - north - .5
    ix, iy = math.floor(u), math.floor(v)
    if ix < 0 or iy < 0 or ix + 1 >= 1000 or iy + 1 >= 1000:
        return None
    fx, fy = u - ix, v - iy
    values = [float(grids[kind][iy + dy, ix + dx]) for dx, dy in [(0,0), (1,0), (0,1), (1,1)]]
    if any(value == -9999 or not math.isfinite(value) for value in values):
        return None
    return round(sum(value * weight for value, weight in zip(values,
        [(1-fx)*(1-fy), fx*(1-fy), (1-fx)*fy, fx*fy])), 4)

def point(x, z):
    return (cx + math.cos(heading)*x + math.sin(heading)*z,
            cz - math.sin(heading)*x + math.cos(heading)*z)

size, resolution = 160, 161
origin = [cx - size/2, cz - size/2]
heights = [sample('dtm', origin[0] + col, origin[1] + row)
    for row in range(resolution) for col in range(resolution)]
valid = [h for h in heights if h is not None]
document = {'format':'molen/bridge-terrain-evidence@1', 'candidateId':'N0015',
    'title':spec['title'], 'modelFolder':'n0015_monnow_bridge', 'specHash':sha(source/'spec.json'),
    'anchor':anchor, 'heading':heading, 'factor':factor, 'worldCenter':[cx,cz], 'worldOrigin':origin,
    'size':size, 'resolution':resolution, 'sourcePixelGroundSpacing':1,
    'heightRange':[min(valid),max(valid)], 'anchorElevation':sample('dtm',cx,cz),
    'renderOriginElevation':13, 'heights':heights, 'noDataCount':len(heights)-len(valid),
    'sources':sources, 'horizontalTransform':{'description':transform.description,
        'declaredAccuracyMeters':transform.accuracy, 'grid':{'url':'https://cdn.proj.org/uk_os_OSTN15_NTv2_OSGBtoETRS.tif',
            'hash':sha(cache/'uk_os_OSTN15_NTv2_OSGBtoETRS.tif')}},
    'surveyCatalogue':{'path':(cache/'monnow-lidar-catalog.json').as_posix(),
        'hash':sha(cache/'monnow-lidar-catalog.json'), 'date':'2021-02-27', 'tile':'SO5012'},
    'verticalDatum':'Original source metre heights; TIFF declares EPSG:27700 horizontally but no explicit vertical CRS. No absolute datum conversion is assumed.',
    'attribution':'Welsh Government; LiDAR 2020–2023, Open Government Licence',
    'attributionUrl':'https://datamap.gov.wales/maps/lidar-data-download/',
    'sourceLabel':'Welsh Government 1 m LiDAR DTM, 2021 survey',
    'method':'Original Float32 DTM, bilinearly sampled at British National Grid cell centers with PROJ OSTN15 coordinate transformation. No channel carving, bridge fitting, water replacement or height correction. DSM is preserved separately.',
    'limitations':['Filtered/interpolated water is not bathymetry.',
        'DSM includes the gatehouse and trees; occluded stations cannot establish road heights.',
        'One metre cells and four decimal storage are not a claim of survey vertical accuracy.'],
    'reviewHalfLength':19.4, 'reviewDeckHeight':5.7, 'reviewCameraRange':65, 'reviewCameraFov':48,
    'reviewAdditionalCameras':[{'name':'west-approach','position':[-33,13,22],'lookAt':[-18,5,0]},
        {'name':'east-approach','position':[31,13,-20],'lookAt':[15,5,0]}],
    'reviewProbePoints':[[-23.8,0],[-18,0],[-10,0],[-5,0],[0,0],[10,0],[16,0],[22.8,0]],
    'reviewProbeBasis':'End probes are inside the authored approach caps near their bank joins; intermediate probes measure bridge clearance above the unmodified filtered DTM.'}
write = lambda path, data: Path(path).write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
write(output/'N0015.json', document)
stations = [{'x':x, 'samples':[{'z':z, **{kind:sample(kind,*point(x,z)) for kind in grids}}
    for z in [-8,-6,-4,-2,0,2,4,6,8]]} for x in range(-35,36)]
write(output/'N0015-deck-profile.json', {'format':'molen/bridge-deck-evidence@1', 'candidateId':'N0015',
    'anchor':anchor, 'heading':heading, 'sources':sources, 'stations':stations,
    'method':'Independent DTM/DSM cross sections in the native bridge frame. Cubic deck reconstruction uses DSM medians at Z 0 and 2, X -18 through 0 and 10 through 16; X 1–9 is hidden by the gatehouse. No terrain samples are edited.',
    'reconstructedDeckPolynomialDescending':[-0.0000584435023917965,-0.0024805789789153422,0.01839900828785006,19.193598698869433],
    'polynomialBasis':'Least squares cubic through unoccluded DSM stations; 0.0048 m sample residual is fit error, not measurement accuracy.',
    'modelOriginInSourceHeightUnits':13.4})
xml = Path('.artifacts/monnow-research/osm.xml')
tree = ET.parse(xml).getroot()
nodes = {n.attrib['id']:[float(n.attrib['lon']),float(n.attrib['lat'])] for n in tree.findall('node')}
features = []
for way in tree.findall('way'):
    tags = {t.attrib['k']:t.attrib['v'] for t in way.findall('tag')}
    if 'highway' not in tags:
        continue
    coordinates = [nodes[n.attrib['ref']] for n in way.findall('nd') if n.attrib['ref'] in nodes]
    points = []
    for lon,lat in coordinates:
        east = math.radians(lon)*radius*factor-cx
        south = -radius*math.asinh(math.tan(math.radians(lat)))*factor-cz
        points.append([math.cos(heading)*east-math.sin(heading)*south,
            math.sin(heading)*east+math.cos(heading)*south])
    if any(abs(x)<65 and abs(z)<45 for x,z in points):
        features.append({'id':way.attrib['id'],'tags':tags,'coordinates':coordinates,'localPoints':points})
write(output/'N0015-road-profile.json', {'format':'molen/bridge-road-evidence@1', 'candidateId':'N0015',
    'source':'https://api.openstreetmap.org/api/0.6/map?bbox=-2.7211,51.8083,-2.7191,51.8096',
    'rawHash':sha(xml), 'attribution':'© OpenStreetMap contributors', 'license':'ODbL-1.0', 'features':features})
print(f'N0015: {len(heights)} terrain samples, {len(stations)} cross sections, {len(features)} mapped roads')

# Preserve the measured slope samples behind the approximate roof reconstruction.
# Pixel-center heights are kept separate from fitted/extrapolated dimensions.
roof_samples = [[], []]
inverse = lambda e, n: transform.transform(e, n, direction='INVERSE')
center_east, center_north = transform.transform(*anchor)
for row in range(1000):
    north = 213000 - row - .5
    if abs(north - center_north) > 20:
        continue
    for col in range(1000):
        east = 350000 + col + .5
        if abs(east - center_east) > 20:
            continue
        lon, lat = inverse(east, north)
        ex = math.radians(lon)*radius*factor-cx
        sz = -radius*math.asinh(math.tan(math.radians(lat)))*factor-cz
        x, z = math.cos(heading)*ex-math.sin(heading)*sz, math.sin(heading)*ex+math.cos(heading)*sz
        side = 0 if 3 < x < 4.2 else 1 if 5.9 < x < 7 else None
        if side is not None and abs(z) < 2:
            roof_samples[side].append([x, z, float(grids['dsm'][row,col])])
if any(len(points) < 4 for points in roof_samples):
    raise RuntimeError('Insufficient roof-slope pixels in the recorded source window')
fits = [np.polyfit([p[0] for p in points], [p[2] for p in points], 1) for points in roof_samples]
ridge_x = (fits[1][1] - fits[0][1]) / (fits[0][0] - fits[1][0])
write(output/'N0015-roof-profile.json', {'format':'molen/bridge-roof-evidence@1',
    'candidateId':'N0015', 'sources':sources, 'samples':roof_samples,
    'slopeFits':[fit.tolist() for fit in fits],
    'extrapolatedRidge':[float(ridge_x),float(np.polyval(fits[0],ridge_x))],
    'method':'Native-frame central roof pixels at X 3–4.2 and 5.9–7, abs(Z)<2, from the original 1 m DSM. Separate least-squares slope lines intersect near the unsampled ridge.',
    'limitations':'A coarse-raster envelope reconstruction, not a survey of roof edges, eaves, stone courses or vertical accuracy.'})

walls = {}
for way in tree.findall('way'):
    if way.attrib['id'] not in ['172233193','172233195','855452310']:
        continue
    coordinates = [nodes[n.attrib['ref']] for n in way.findall('nd')]
    points = []
    for lon, lat in coordinates:
        ex = math.radians(lon)*radius*factor-cx
        sz = -radius*math.asinh(math.tan(math.radians(lat)))*factor-cz
        points.append([math.cos(heading)*ex-math.sin(heading)*sz,
            math.sin(heading)*ex+math.cos(heading)*sz])
    walls[way.attrib['id']] = {'coordinates':coordinates,'localPoints':points}
write(source/'site-approaches.json', {'format':'molen/structure-site-approaches@1',
    'candidateId':'N0015', 'originHeight':13.4, 'walls':walls,
    'roadHeights':[[s['x'],float(np.median([p['dsm'] for p in s['samples'] if p['z'] in [0,2]]))]
        for s in stations if s['x'] <= -18 or s['x'] >= 16],
    'sources':sources, 'mapSource':'https://api.openstreetmap.org/api/0.6/map?bbox=-2.7211,51.8083,-2.7191,51.8096',
    'mapHash':sha(xml), 'attribution':'© OpenStreetMap contributors ODbL-1.0; Welsh Government LiDAR Open Government Licence',
    'method':'Mapped retaining wall alignments and independently sampled DSM road heights. Reconstructed approach caps end at native X -24 and +23, where unfiltered ground rejoins the deck. Original bridge and gate footprints remain separate.',
    'limitations':['Unmapped house-side pavement edges, wall thickness and individual masonry are reconstructed.',
        'The western retaining wall continues outside this bounded bridge asset; surrounding buildings and riverbank paths belong to host map data.']})
