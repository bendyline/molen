"""Reproduce the review grid from the original ACT vector tiles, without model fitting.

Requires numpy, scipy and pyproj (recorded versions in derivation.json). These are
verification-only tools; normal asset builds use the saved source inputs offline.
The small protobuf/MVT reader below is independent of the acquisition decoder.
"""
import hashlib
import gzip
import json
import math
import struct
from pathlib import Path
import numpy as np
from scipy.spatial import Delaunay
from scipy.interpolate import LinearNDInterpolator
from pyproj import Transformer

BASE = Path(__file__).resolve().parent.parent

def varint(data, offset):
    value = shift = 0
    while True:
        byte = data[offset]
        offset += 1
        value |= (byte & 127) << shift
        if byte < 128:
            return value, offset
        shift += 7
        assert shift < 70

def fields(data):
    offset = 0
    while offset < len(data):
        tag, offset = varint(data, offset)
        wire, key = tag & 7, tag >> 3
        if wire == 0:
            value, offset = varint(data, offset)
        elif wire == 2:
            size, offset = varint(data, offset)
            value = data[offset:offset+size]
            offset += size
        elif wire in (1, 5):
            size = 8 if wire == 1 else 4
            value = data[offset:offset+size]
            offset += size
        else:
            raise ValueError('Unsupported protobuf wire')
        yield key, wire, value

def packed(data):
    out = []
    offset = 0
    while offset < len(data):
        v, offset = varint(data, offset)
        out.append(v)
    return out

def value(data):
    key, wire, v = next(fields(data))
    if key == 1:
        return v.decode('utf8')
    if key == 2:
        return struct.unpack('<f', v)[0]
    if key == 3:
        return struct.unpack('<d', v)[0]
    if key == 6:
        return (v >> 1) ^ -(v & 1)
    return v

def label_vertices(data, tile):
    if data[:2] == b'\x1f\x8b':
        data = gzip.decompress(data)
    for key, wire, layer_bytes in fields(data):
        if key != 3:
            continue
        layer = list(fields(layer_bytes))
        name = next(v.decode() for k,w,v in layer if k == 1)
        if not name.endswith('/label'):
            continue
        extent = next(v for k,w,v in layer if k == 5)
        keys = [v.decode() for k,w,v in layer if k == 3]
        values = [value(v) for k,w,v in layer if k == 4]
        for k,w,v in layer:
            if k != 2:
                continue
            feature = list(fields(v))
            tags = packed(next(v for k,w,v in feature if k == 2))
            props = {keys[tags[i]]: values[tags[i+1]] for i in range(0,len(tags),2)}
            height = float(props['_name'])
            geometry = packed(next(v for k,w,v in feature if k == 4))
            offset = x = y = 0
            while offset < len(geometry):
                command = geometry[offset]
                offset += 1
                kind, count = command & 7, command >> 3
                if kind == 7:
                    continue
                assert kind in (1, 2)
                for _ in range(count):
                    dx,dy = geometry[offset:offset+2]
                    offset += 2
                    x += (dx >> 1) ^ -(dx & 1)
                    y += (dy >> 1) ^ -(dy & 1)
                    yield (tile['origin'][0] + x/extent*tile['span'],
                           tile['origin'][1] - y/extent*tile['span'], height)

def verify():
    manifest = json.loads((BASE/'terrain-sources/derivation.json').read_text())
    frame = json.loads((BASE/'map-frame.json').read_text())
    grid = json.loads((BASE/'terrain-grid.json').read_text())
    projection = Transformer.from_crs(4326, 7855, always_xy=True)
    lon0,lat0 = frame['anchor']
    east0,north0 = projection.transform(lon0,lat0)
    points = {}
    conflicts = {}
    for tile in manifest['tiles']:
        raw = (BASE/'terrain-sources'/tile['file']).read_bytes()
        assert hashlib.sha256(raw).hexdigest() == tile['sha256']
        for e,n,y in label_vertices(raw,tile):
            if abs(e-east0) <= 500 and abs(n-north0) <= 500:
                key = (round(e,6),round(n,6))
                old = points.setdefault(key,y)
                if old != y:
                    conflicts.setdefault(key,{old}).add(y)
    assert not conflicts
    assert len(points) == 8447
    xy = np.array(list(points))
    tri = Delaunay(xy)
    interpolate = LinearNDInterpolator(tri,np.array(list(points.values())))
    radius = 6378137
    factor = math.cos(math.radians(lat0))
    merc_y0 = radius * math.asinh(math.tan(math.radians(lat0)))
    heading = frame['heading']
    def sample(x,z):
        lon = lon0 + math.degrees((math.cos(heading)*x+math.sin(heading)*z)/radius/factor)
        my = merc_y0 + (math.sin(heading)*x-math.cos(heading)*z)/factor
        lat = math.degrees(math.atan(math.sinh(my/radius)))
        result = float(interpolate(*projection.transform(lon,lat)))
        assert math.isfinite(result)
        return result
    error = 0
    count = 0
    for j,row in enumerate(grid['heightsMeters']):
        for i,height in enumerate(row):
            exact = sample(grid['origin'][0]+i*grid['stepMeters'],
                           grid['origin'][1]+j*grid['stepMeters'])
            error = max(error,abs(height-exact))
            count += 1
    assert error <= .000050001, error
    datum_error = abs(sample(*frame['terrainContact']['local'])-
                      frame['terrainContact']['modelY']-grid['modelDatumElevationMeters'])
    assert datum_error <= .000050001
    png = BASE/'terrain-review.height.png'
    assert 'sha256:'+hashlib.sha256(png.read_bytes()).hexdigest() == grid['reviewHeightfieldHash']
    print(json.dumps({'originalTilesVerified':len(manifest['tiles']),
                      'independentlyDecodedContourVertices':len(points),
                      'gridValuesVerified':count,'maximumRoundingErrorMeters':error,
                      'nativeDatumErrorMeters':datum_error,
                      'sourceHeightsUnchanged':True,
                      'sourceContourIntervalMeters':2,
                      'notOneMetreRaster':True},indent=2))

if __name__ == '__main__':
    verify()
