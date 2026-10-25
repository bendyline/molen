"""Resample native public-domain USGS 3DEP cells; no building fitting or flattening.
Requires Pillow. Run from any directory; --check verifies current derived inputs.
The signed geographic frame and NAD83 UTM17 cell centers determine every sample.
"""
import hashlib, json, math, pathlib, struct, sys
from PIL import Image
root = pathlib.Path(__file__).resolve().parent.parent
frame = json.loads((root/'map-frame.json').read_text())
img = Image.open(root/'terrain-sources/usgs-1m-native-window.tif'); img.load()
assert img.mode == 'F' and img.size == (204, 203)
assert img.tag_v2[33550] == (1., 1., 0.)
tie = img.tag_v2[33922]; assert abs(tie[3]-630853)<.001 and abs(tie[4]-4418575)<.001
lon0, lat0 = frame['anchor']; heading = frame['heading']
def utm(lon,lat):
 a=6378137.;f=1/298.257222101;e=f*(2-f);ep=e/(1-e);p=math.radians(lat);l=math.radians(lon+81)
 N=a/math.sqrt(1-e*math.sin(p)**2);T=math.tan(p)**2;C=ep*math.cos(p)**2;A=math.cos(p)*l
 M=a*((1-e/4-3*e**2/64-5*e**3/256)*p-(3*e/8+3*e**2/32+45*e**3/1024)*math.sin(2*p)+(15*e**2/256+45*e**3/1024)*math.sin(4*p)-35*e**3/3072*math.sin(6*p))
 return 500000+.9996*N*(A+(1-T+C)*A**3/6+(5-18*T+T*T+72*C-58*ep)*A**5/120),.9996*(M+N*math.tan(p)*(A*A/2+(5-T+9*C+4*C*C)*A**4/24+(61-58*T+T*T+600*C-330*ep)*A**6/720))
def sample(x,z):
 lon=lon0+(math.cos(heading)*x+math.sin(heading)*z)/111320/math.cos(math.radians(lat0))
 lat=lat0+(math.sin(heading)*x-math.cos(heading)*z)/111320
 E,N=utm(lon,lat);u=E-tie[3]-.5;v=tie[4]-N-.5;i,j=math.floor(u),math.floor(v);u-=i;v-=j
 assert 0<=i<img.width-1 and 0<=j<img.height-1
 q=[float(img.getpixel((i,j))),float(img.getpixel((i+1,j))),float(img.getpixel((i,j+1))),float(img.getpixel((i+1,j+1)))];assert all(math.isfinite(a)and a!=-999999 for a in q)
 return q[0]*(1-u)*(1-v)+q[1]*u*(1-v)+q[2]*(1-u)*v+q[3]*u*v
if __name__ == '__main__':
 sha=lambda p:'sha256:'+hashlib.sha256(p.read_bytes()).hexdigest()
 datum=round(sample(*frame['terrainContact']['local']),4)
 grid={'format':'molen/structure-relief-grid@1','candidateId':'fallingwater','anchor':frame['anchor'],'heading':heading,'origin':[-64,-64],'stepMeters':1,'size':[129,129],'modelDatumElevationMeters':datum,'contact':frame['terrainContact'],'verticalDatum':'NAVD88 meters; USGS 3DEP PA_WesternPA_2019_D20 bare-earth DEM','sourcePixelGroundSpacing':1,'heightsMeters':[[round(sample(-64+x,-64+z),4)for x in range(129)]for z in range(129)],'sources':[{'path':'terrain-sources/usgs-1m-native-window.tif','sha256':sha(root/'terrain-sources/usgs-1m-native-window.tif'),'url':json.loads((root/'terrain-sources/usgs-products.json').read_text())['items'][0]['downloadURL'],'nativePixelWindow':[859,1431,204,203],'license':'Public domain'}],'attribution':'USGS 3D Elevation Program, PA_WesternPA_2019_D20; public domain','attributionUrl':'https://www.sciencebase.gov/catalog/item/61a5befdd34eb622f697546b','method':'Exact native-pixel window, not a warped/fitted export. NAD83 GRS80 UTM17 projection and bilinear cell-center sampling. One-meter signed local review grid; no flattening, fitting, clipping or source-elevation changes.','limitations':['2019 bare-earth lidar product; elevations under buildings are provider-interpolated, not a measured interior floor.','Generalized map registration, local 111320 meters/degree approximation and uncorrected WGS84/NAD83 epoch differences limit accuracy.','Building floors and rock/water geometry remain separate photographic interpretations. Compatible host terrain is required.']}
 values=[v-datum for row in grid['heightsMeters']for v in row]
 desc=json.loads((root/'terrain-review.terrain.json').read_text());desc['tileResolution']=129;desc['height']={'min':math.floor(min(values)-.25),'max':math.ceil(max(values)+.25)}
 lo,hi=desc['height']['min'],desc['height']['max'];codes=[round((v-lo)/(hi-lo)*65535)for v in values];assert all(0<=v<=65535 for v in codes)
 png=Image.frombytes('I;16',(129,129),struct.pack('<'+'H'*len(codes),*codes))
 if '--check' in sys.argv:
  assert json.loads((root/'terrain-grid.json').read_text())==grid
  assert json.loads((root/'terrain-review.terrain.json').read_text())==desc
  assert [v for (v,) in struct.iter_unpack('<H', Image.open(root/'terrain-review.height.png').tobytes())]==codes
 else:
  (root/'terrain-grid.json').write_text(json.dumps(grid,indent=2)+'\n');(root/'terrain-review.terrain.json').write_text(json.dumps(desc,indent=2)+'\n');png.save(root/'terrain-review.height.png')
 print(json.dumps({'nativeWindowHash':sha(root/'terrain-sources/usgs-1m-native-window.tif'),'samples':len(values),'datum':datum,'heightRange':desc['height'],'guestApproachRelative':sample(-2.8,-27)-datum,'maximumEncodingError':max(abs(c/65535*(hi-lo)+lo-v)for c,v in zip(codes,values)),'terrainFittedOrFlattened':False,'check':'--check' in sys.argv}))
