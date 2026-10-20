"""Verify original DeltaDTM range bytes and independently reproduce the bounded grid.

Offline verification requires Python3.14 (stdlib ZSTD), NumPy and Pillow/libtiff.
Normal model builds use the saved grid and require none of these Python tools.
"""
import hashlib
import io
import json
import math
import struct
import zipfile
import zlib
from pathlib import Path
from compression import zstd
import numpy as np
from PIL import Image, TiffImagePlugin

HERE = Path(__file__).resolve().parent
BASE = HERE.parent

def verify():
    manifest = json.loads((HERE/'derivation.json').read_text())
    metadata = json.loads((HERE/'original-tiff-metadata.json').read_text())
    frame = json.loads((BASE/'map-frame.json').read_text())
    grid = json.loads((BASE/'terrain-grid.json').read_text())
    for name, expected in manifest['originalFiles'].items():
        assert 'sha256:'+hashlib.sha256((HERE/name).read_bytes()).hexdigest() == expected, name
    archive = manifest['archive']
    for part in archive['ranges']:
        assert (HERE/part['file']).stat().st_size == part['end']-part['start']+1
    tail = (HERE/'original-europe-zip-tail.bin').read_bytes()
    with zipfile.ZipFile(io.BytesIO(tail)) as z:
        member = z.getinfo(archive['member'])
        assert member.compress_type == archive['method'] == 0
        assert member.file_size == archive['memberBytes']
        assert member.CRC == archive['memberCrc32FromDirectoryOnly']
        assert member.header_offset+2385939863 == archive['zipLocalHeaderOffset']
    prefix = (HERE/'original-zip-local-header-and-tiff-prefix.bin').read_bytes()
    assert prefix[:4] == b'PK\x03\x04'
    name_size, extra_size = struct.unpack_from('<HH', prefix, 26)
    assert prefix[30:30+name_size].decode() == archive['member']
    offset = 30+name_size+extra_size
    assert offset+archive['zipLocalHeaderOffset'] == archive['tiffByteOffset']
    tiff = prefix[offset:]
    assert tiff[:4] == b'II*\0'
    ifd = struct.unpack_from('<I', tiff, 4)[0]
    tags = {}
    types = {1:('B',1),2:('s',1),3:('H',2),4:('I',4),12:('d',8)}
    for i in range(struct.unpack_from('<H',tiff,ifd)[0]):
        pos = ifd+2+i*12
        key, kind, count, pointer = struct.unpack_from('<HHII',tiff,pos)
        if kind not in types:
            continue
        fmt, size = types[kind]
        start = pos+8 if count*size <= 4 else pointer
        assert start+count*size <= len(tiff)
        tags[key] = tiff[start:start+count].rstrip(b'\0').decode() if kind == 2 else list(struct.unpack_from('<'+str(count)+fmt,tiff,start))
    for key in [256,257,258,259,277,284,317,322,323,324,325,33550,33922,34735,42113]:
        assert tags[key] == metadata['tags'][str(key)], key
    assert tags[259] == [50000] and tags[317] == [3]
    assert tags[256] == tags[257] == [3600]
    selected = metadata['selectedBlock']
    assert selected['index'] == 22
    block = (HERE/'original-tiff-block22.zstd').read_bytes()
    assert len(block) == tags[325][22]
    assert archive['tiffByteOffset']+tags[324][22] == 841845009
    raw = zstd.decompress(block)
    assert len(raw) == 512*512*4
    encoded = np.frombuffer(raw,dtype=np.uint8).reshape(512,2048)
    accumulated = (np.cumsum(encoded,axis=1,dtype=np.uint32)&255).astype(np.uint8)
    plain = accumulated.reshape(512,4,512)[:,::-1,:].transpose(0,2,1).copy()
    heights = np.frombuffer(plain.tobytes(),dtype='<f4').reshape(512,512)
    # A second predictor decoder: re-Deflate original encoded bytes without changing them.
    compressed = zlib.compress(raw)
    directory = TiffImagePlugin.ImageFileDirectory_v2()
    for key,val in {256:512,257:512,258:32,259:8,262:1,277:1,284:1,317:3,322:512,323:512,339:3,324:(0,),325:(len(compressed),)}.items():
        directory[key] = val
    directory.tagtype[324] = directory.tagtype[325] = 4
    at = 8+len(directory.tobytes(offset=8))
    directory[324] = (at,)
    wrapper = b'II*\0'+struct.pack('<I',8)+directory.tobytes(offset=8)+compressed
    with Image.open(io.BytesIO(wrapper)) as image:
        independently_decoded = np.array(image,dtype=np.float32)
    assert np.array_equal(heights.view(np.uint32),independently_decoded.view(np.uint32))
    lon0,lat0 = frame['anchor']
    c,s = math.cos(frame['heading']),math.sin(frame['heading'])
    def sample(x,z):
        lon = lon0+(c*x+s*z)/(111320*math.cos(math.radians(lat0)))
        lat = lat0+(s*x-c*z)/111320
        px = (lon-tags[33922][3])/tags[33550][0]-.5-selected['column']*512
        py = (tags[33922][4]-lat)/tags[33550][1]-.5-selected['row']*512
        i,j = math.floor(px),math.floor(py)
        a,b = px-i,py-j
        p = heights[j:j+2,i:i+2].astype(float)
        assert p.shape == (2,2) and np.all(p != -9999)
        return float(p[0,0]*(1-a)*(1-b)+p[0,1]*a*(1-b)+p[1,0]*(1-a)*b+p[1,1]*a*b)
    error = 0
    for j,row in enumerate(grid['heightsMeters']):
        for i,height in enumerate(row):
            error = max(error,abs(height-sample(grid['origin'][0]+i*grid['stepMeters'],grid['origin'][1]+j*grid['stepMeters'])))
    assert error <= .000000501
    datum = sample(*frame['terrainContact']['local'])-frame['terrainContact']['modelY']
    assert abs(datum-grid['modelDatumElevationMeters']) < 1e-10
    before = json.loads((HERE/'before-deltadtm.json').read_text())['snapshot']
    assert frame['anchor'] == before['anchor'] and frame['heading'] == before['heading']
    assert frame['terrainContact'] == before['terrainContact']
    png = BASE/'terrain-review.height.png'
    assert 'sha256:'+hashlib.sha256(png.read_bytes()).hexdigest() == grid['reviewHeightfieldHash']
    desc = json.loads((BASE/'terrain-review.terrain.json').read_text())
    with Image.open(png) as image:
        decoded = np.array(image,dtype=float)/65535*(desc['height']['max']-desc['height']['min'])+desc['height']['min']
    png_error = float(np.max(np.abs(decoded-(np.array(grid['heightsMeters'])-datum))))
    assert png_error <= 3/65535/2+1e-10
    print(json.dumps({'status':'passed','originalRangeFilesVerified':3,'fullMemberCrcVerified':False,
                      'independentlyDecodedOriginalPixels':heights.size,'bitwisePredictorAgreement':True,
                      'reviewValuesVerified':1089,'maximumRoundingErrorMeters':error,
                      'maximumPngEncodingErrorMeters':png_error,'datumMetersEGM2008':datum,
                      'sourceHeightsUnchanged':True,'sourceResolutionArcSeconds':1,
                      'nativeFrameAndDryReferenceUnchanged':True},indent=2))

if __name__ == '__main__':
    verify()
