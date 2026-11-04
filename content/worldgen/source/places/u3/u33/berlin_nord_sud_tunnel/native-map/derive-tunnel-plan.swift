import Foundation
import CoreGraphics
let args=CommandLine.arguments
let input=try JSONSerialization.jsonObject(with:Data(contentsOf:URL(fileURLWithPath:args[1]))) as! [String:Any]
let polygons=input["polygons"] as! [[[[Double]]]]
var result=CGPath(rect:.zero,transform:nil)
func path(_ rings:[[[Double]]])->CGPath { let p=CGMutablePath();for ring in rings {if ring.isEmpty {continue};p.move(to:CGPoint(x:ring[0][0],y:ring[0][1]));for q in ring.dropFirst(){p.addLine(to:CGPoint(x:q[0],y:q[1]))};p.closeSubpath()};return p }
var started=false
for poly in polygons {let p=path(poly);result=started ? result.union(p) : p;started=true}
let width=input["estimatedGapHalfWidth"] as! Double
for line in input["railways"] as! [[[Double]]] {let p=CGMutablePath();p.move(to:CGPoint(x:line[0][0],y:line[0][1]));for q in line.dropFirst(){p.addLine(to:CGPoint(x:q[0],y:q[1]))};let stroke=p.copy(strokingWithWidth:width*2,lineCap:.butt,lineJoin:.bevel,miterLimit:2);result=result.union(stroke)}
var rings=[[[Double]]]();var ring=[[Double]]();var unsupported=false
result.applyWithBlock { ptr in let e=ptr.pointee;switch e.type {case .moveToPoint: if !ring.isEmpty {rings.append(ring)};ring=[[e.points[0].x,e.points[0].y]];case .addLineToPoint:ring.append([e.points[0].x,e.points[0].y]);case .closeSubpath:if !ring.isEmpty {if ring.first! == ring.last! {ring.removeLast()};rings.append(ring);ring=[]};default:unsupported=true}}
if !ring.isEmpty {rings.append(ring)}
if unsupported {fatalError("Unexpected curved output; source inputs are polygonal")}
let data=try JSONSerialization.data(withJSONObject:["rings":rings,"method":"CoreGraphics union of original numeric full tunnel envelopes and explicitly estimated missing-plan corridors around complete original railways; no source image tracing or fitted coordinates."],options:[.prettyPrinted,.sortedKeys])
try data.write(to:URL(fileURLWithPath:args[2]))
print("union rings",rings.count,"controls",rings.reduce(0){$0+$1.count})
