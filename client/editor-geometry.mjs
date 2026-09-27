export function nearestEdge(p,points){let best={distance:Infinity,index:-1};points.forEach((a,index)=>{const b=points[(index+1)%points.length],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1))),point=[a[0]+t*dx,a[1]+t*dy],distance=Math.hypot(p[0]-point[0],p[1]-point[1]);if(distance<best.distance)best={distance,index,point};});return best;}
function contains(p,points){let hit=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
export function pickCollision(objects,p,tolerance,selected=-1,cycle=false){
 if(!cycle){let vertex=null;objects.forEach((o,index)=>o.points.forEach((q,v)=>{const d=Math.hypot(q[0]-p[0],q[1]-p[1]);if(d<=tolerance&&(!vertex||d<vertex.distance||d===vertex.distance&&index===selected))vertex={object:index,vertex:v,distance:d};}));if(vertex)return vertex;}
 const hits=objects.map((o,index)=>({object:index,vertex:-1,distance:nearestEdge(p,o.points).distance,inside:contains(p,o.points)})).filter(h=>h.inside||h.distance<=tolerance).sort((a,b)=>a.distance-b.distance);
 if(cycle&&hits.length){const i=hits.findIndex(h=>h.object===selected);return hits[(i+1)%hits.length];}return hits[0]||null;
}
