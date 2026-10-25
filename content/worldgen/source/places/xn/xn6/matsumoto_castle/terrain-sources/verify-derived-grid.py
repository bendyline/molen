"""Read-only verification of the retained original GSI PNGs and all derived samples. Python3 stdlib only."""
from pathlib import Path
import json, hashlib, math, struct, zlib
root=Path(__file__).resolve().parents[1]
g=json.loads((root/'terrain-grid.json').read_text())
f=json.loads((root/'map-frame.json').read_text())
def png8(p):
    b=p.read_bytes(); assert b[:8]==b'\x89PNG\r\n\x1a\n'
    pos=8; compressed=b''
    while pos<len(b):
        n=struct.unpack('>I',b[pos:pos+4])[0]; typ=b[pos+4:pos+8]; data=b[pos+8:pos+8+n]; pos+=n+12
        if typ==b'IHDR': w,h,depth,col,comp,fil,inter=struct.unpack('>IIBBBBB',data)
        if typ==b'IDAT': compressed+=data
    assert depth==8 and col in (2,6) and inter==0
    channels=3 if col==2 else 4; stride=w*channels; raw=zlib.decompress(compressed); rows=[]; old=bytearray(stride)
    for j in range(h):
        off=j*(stride+1); flag=raw[off]; row=bytearray(raw[off+1:off+1+stride])
        for i in range(stride):
            a=row[i-channels] if i>=channels else 0; b=old[i]; c=old[i-channels] if i>=channels else 0
            if flag==1: v=a
            elif flag==2: v=b
            elif flag==3: v=(a+b)//2
            elif flag==4:
                p=a+b-c; pa=abs(p-a); pb=abs(p-b); pc=abs(p-c); v=a if pa<=pb and pa<=pc else b if pb<=pc else c
            else: assert flag==0; v=0
            row[i]=(row[i]+v)&255
        rows.append(row); old=row
    return w,h,channels,rows
layers={}
for s in g['sources']:
    p=root/s['path']; assert 'sha256:'+hashlib.sha256(p.read_bytes()).hexdigest()==s['sha256']
    layers.setdefault(s['dataset'],{})[(s['x'],s['y'])]=png8(p)
lon,lat=f['anchor']; R=6378137; rad=math.pi/180; factor=math.cos(lat*rad); circ=2*math.pi*R; cx=lon*rad*R*factor; cz=-R*math.asinh(math.tan(lat*rad))*factor; c=math.cos(f['heading']); ss=math.sin(f['heading'])
zooms={s['dataset']:s['zoom'] for s in g['sources']}
def sample(x,z):
    wx=cx+c*x+ss*z; wz=cz-ss*x+c*z
    for dataset in g['sourcePriority']:
        if dataset not in layers: continue
        zoom=zooms[dataset]; n=256*2**zoom; px=(wx/factor/circ+.5)*n-.5; pz=(wz/factor/circ+.5)*n-.5; ix=math.floor(px); iz=math.floor(pz); a=px-ix; b=pz-iz; vals=[]
        for i,j in [(ix,iz),(ix+1,iz),(ix,iz+1),(ix+1,iz+1)]:
            tile=layers[dataset].get((i//256,j//256))
            if not tile: vals.append(None); continue
            w,h,ch,rows=tile; q=rows[j%256]; off=(i%256)*ch; value=q[off]*65536+q[off+1]*256+q[off+2]
            vals.append(None if value==8388608 or (ch==4 and q[off+3]==0) else (value-16777216 if value>8388608 else value)*.01)
        if None not in vals: return vals[0]*(1-a)*(1-b)+vals[1]*a*(1-b)+vals[2]*(1-a)*b+vals[3]*a*b,dataset
    raise ValueError('No independently valid original support')
maximum=0; counts={}
for j,row in enumerate(g['heightsMeters']):
    for i,expected in enumerate(row):
        actual,dataset=sample(g['origin'][0]+i*g['stepMeters'],g['origin'][1]+j*g['stepMeters']); error=abs(actual-expected); maximum=max(maximum,error); assert error<=.000051
        assert dataset==g['sourceSelection']['gridRowMajorDatasets'][j*len(row)+i]; counts[dataset]=counts.get(dataset,0)+1
assert counts==g['sourceSelection']['sampleCounts']
datum=sample(*f['terrainContact']['local'])[0]-f['terrainContact']['modelY']; assert abs(datum-g['modelDatumElevationMeters'])<=.000051
print(json.dumps({'originalFilesVerified':len(g['sources']),'gridValuesVerified':sum(map(len,g['heightsMeters'])),'sampleCounts':counts,'maximumRoundingErrorMeters':maximum,'nativeDatumErrorMeters':abs(datum-g['modelDatumElevationMeters']),'groundUnchanged':True},indent=2))
