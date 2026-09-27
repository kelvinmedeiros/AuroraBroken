// Coordinates are world units. The anchor is where the object meets the ground.
// Only the footprint collides; tall artwork is ordered by its ground Y.
export const PROP_TYPES={
 barrier:{file:'prop-barrier.png',anchor:.68,rx:.44,ry:.045,shadow:.42},
 tree:{file:'prop-tree.png',anchor:.90,rx:.075,ry:.045,shadow:.20},
 deadTree:{file:'prop-dead-tree.png',anchor:.90,rx:.065,ry:.04,shadow:.14},
 rock:{file:'prop-rock.png',anchor:.87,rx:.32,ry:.12,shadow:.29},
 log:{file:'prop-log.png',anchor:.60,rx:0,ry:0,shadow:0,ground:true},
 shrine:{file:'prop-shrine.png',anchor:.98,rx:.34,ry:.13,collisionY:-.12,shadow:.34},
 castle:{file:'prop-castle.png',anchor:.96,rx:.43,ry:.18,collisionY:-.17,shadow:.35}
};
const prop=(id,type,x,y,width)=>({id,type,x,y,width,...PROP_TYPES[type]});
export const SCENERY=[
 [prop('santuario','shrine',1050,1210,360),
 ...[[360,380,240],[780,360,230],[1700,720,270],[480,900,230],[300,1440,260],[760,1750,280],[1250,1580,270],[1760,1700,240],[1520,340,230]].map((p,i)=>prop('arvore-'+i,'tree',...p)),
 ...[[310,550,140],[1320,420,175],[1710,1050,150],[510,1550,130],[1500,1820,160]].map((p,i)=>prop('pedra-'+i,'rock',...p)),
 ...[[450,230,200],[1830,1400,240],[900,1880,220]].map((p,i)=>prop('seco-'+i,'deadTree',...p)),
 ...[[840,1440,95],[1380,830,85],[240,1760,105],[1610,1320,90]].map((p,i)=>prop('galho-'+i,'log',...p))],
 [prop('cidadela','castle',1040,730,970),
 ...[[260,400,220],[1770,390,230],[360,1000,230],[1630,1370,240],[380,1720,240],[1260,1780,220],[1820,1820,200],[820,1440,190]].map((p,i)=>prop('seco-'+i,'deadTree',...p)),
 ...[[1580,900,150],[250,1370,150],[1730,1100,130],[1560,1770,140],[660,1790,110]].map((p,i)=>prop('pedra-'+i,'rock',...p)),
 ...[[850,980,90],[1300,1460,105],[510,1460,110],[1840,660,90],[480,640,110]].map((p,i)=>prop('galho-'+i,'log',...p))]
];

// Dense perimeter dressing leaves the central travel routes and encounters open.
for(let map=0;map<2;map++){
 for(let i=0;i<8;i++){
  const y=190+i*230;
  SCENERY[map].push(prop('borda-oeste-'+i,map?'deadTree':'tree',105,y,190),prop('borda-leste-'+i,map?'deadTree':'tree',1940,y,200));
 }
 for(const x of [180,400,620,840,1240,1460,1680,1900]){
  SCENERY[map].push(prop('muralha-norte-'+x,'barrier',x,70,210),prop('muralha-sul-'+x,'barrier',x,1990,210));
 }
 for(const [i,p] of [[580,400,100],[1450,600,130],[350,1200,100],[1700,1530,110],[1350,1900,90],[700,900,90]].entries())SCENERY[map].push(prop('rocha-extra-'+i,'rock',...p));
 for(const [i,p] of [[720,790,220],[1460,1530,210]].entries())SCENERY[map].push(prop('ruina-extra-'+i,'barrier',...p));
}
SCENERY.push([
 ...[170,390,610,830,1218,1438,1658,1878].map((x,i)=>prop('parede-selo-'+i,'barrier',x,880,220)),
 ...[[330,520,200],[1700,520,180],[400,1220,150],[1670,1630,130]].map((p,i)=>prop('cripta-pedra-'+i,'rock',...p)),
 ...[[320,1800,100],[1750,1160,100],[650,350,100]].map((p,i)=>prop('cripta-galho-'+i,'log',...p))
]);

SCENERY.push(
 [...[480,930,1380].flatMap((y,i)=>[prop('escada-oeste-'+i,'barrier',735,y,125),prop('escada-leste-'+i,'barrier',1310,y,125)]),prop('rocha-escada','rock',780,250,90)],
 [prop('lava-rocha-1','rock',440,1330,75),prop('lava-rocha-2','rock',1570,930,75),prop('lava-rocha-3','rock',710,410,70)],
 [...[[300,450],[1748,450],[300,1450],[1748,1450]].map((p,i)=>prop('trono-rocha-'+i,'rock',...p,200))]
);

export function sceneryObstacles(map){const fixed=map===2?[{name:'Parede selada oeste',points:[[0,855],[934,855],[934,905],[0,905]]},{name:'Parede selada leste',points:[[1114,855],[2048,855],[2048,905],[1114,905]]}]:[];if(map===3)fixed.push({name:'Abismo oeste',points:[[0,0],[660,0],[660,2048],[0,2048]]},{name:'Abismo leste',points:[[1388,0],[2048,0],[2048,2048],[1388,2048]]});return [...fixed,...SCENERY[map].filter(p=>p.rx>0).map(p=>({name:p.id,points:Array.from({length:12},(_,i)=>[p.x+Math.cos(i*Math.PI/6)*p.width*p.rx,p.y+(p.collisionY||0)*p.width+Math.sin(i*Math.PI/6)*p.width*p.ry])}))];}
export function propBounds(prop,image){const h=prop.width*image.height/image.width;return {x:prop.x-prop.width/2,y:prop.y-h*prop.anchor,width:prop.width,height:h};}
export function depthOrder(items){return items.slice().sort((a,b)=>a.y-b.y||(a.order||0)-(b.order||0));}
export function drawProp(ctx,prop,image){const b=propBounds(prop,image);ctx.drawImage(image,b.x,b.y,b.width,b.height);}
