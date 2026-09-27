import {SCENERY,sceneryObstacles} from './scenery.mjs';
export const SIZE=2048;
export const RADIUS=12;
export const MAPS=[
 {id:0,name:'Jardim das Cinzas',image:'ground-garden.png',spawn:{x:1040,y:1500},camp:{x:1102,y:1500},portal:{x:1040,y:126,r:58,to:1,destination:{x:1030,y:1720},label:'Ir à Cidadela'},props:SCENERY[0],obstacles:sceneryObstacles(0)},
 {id:1,name:'Cidadela do Sol Partido',image:'ground-ash.png',spawn:{x:1030,y:1720},camp:{x:1092,y:1720},portal:{x:1030,y:1800,r:56,to:0,destination:{x:1040,y:234},label:'Voltar ao Jardim'},extraPortals:[{x:1040,y:825,r:56,to:2,destination:{x:1024,y:1830},label:'Entrar no castelo',requires:'malenio'}],props:SCENERY[1],obstacles:sceneryObstacles(1)},
 {id:2,name:'Cripta da Primeira Aurora',image:'ground-dungeon.png',spawn:{x:1024,y:1830},camp:{x:1100,y:1830},portal:{x:1024,y:1950,r:50,to:1,destination:{x:1040,y:845},label:'Sair do castelo'},extraPortals:[{x:1024,y:150,r:55,to:3,destination:{x:1024,y:1830},label:'Subir a escadaria',requires:'warden'}],props:SCENERY[2],obstacles:sceneryObstacles(2)},
 {id:3,name:'Escadaria dos Condenados',image:'ground-dungeon.png',spawn:{x:1024,y:1830},camp:{x:1120,y:1830},portal:{x:1024,y:1950,r:50,to:2,destination:{x:1024,y:270},label:'Voltar à cripta'},extraPortals:[{x:1024,y:100,r:50,to:4,destination:{x:1024,y:1830},label:'Entrar na fornalha',requiresClear:true}],props:SCENERY[3],obstacles:sceneryObstacles(3)},
 {id:4,name:'Fornalha das Pontes Partidas',image:'ground-lava.png',spawn:{x:1024,y:1830},camp:{x:1130,y:1830},portal:{x:1024,y:1950,r:50,to:3,destination:{x:1024,y:230},label:'Voltar à escadaria'},extraPortals:[{x:1024,y:100,r:50,to:5,destination:{x:1024,y:1830},label:'Entrar no trono',requiresClear:true}],props:SCENERY[4],obstacles:sceneryObstacles(4)},
 {id:5,name:'Trono do Sol Devorado',image:'ground-ash.png',spawn:{x:1024,y:1830},camp:{x:1130,y:1830},portal:{x:1024,y:1950,r:50,to:4,destination:{x:1024,y:210},label:'Voltar à fornalha'},props:SCENERY[5],obstacles:sceneryObstacles(5)}
];
export const RUNE_ORDER=['moon','flame','sun'];
export const RUNES=[{id:'sun',label:'Sol',glyph:'☀',x:1450,y:1430},{id:'moon',label:'Lua',glyph:'☾',x:600,y:1430},{id:'flame',label:'Brasa',glyph:'♨',x:1024,y:1230}];
export const INSCRIPTION={x:1024,y:1650};
export const GATE={x:1024,y:880,halfWidth:90,halfHeight:25};
export const portalLocked=(world,map,portal)=>!!(portal.requires&&world.enemies.some(e=>e.type===portal.requires&&e.hp>0)||portal.requiresClear&&world.enemies.some(e=>e.map===map&&e.hp>0)||map===0&&world.enemies.some(e=>e.map===0&&e.hp>0));
export const portalsOf=map=>[MAPS[map].portal,...(MAPS[map].extraPortals||[])];
export const ENEMY_TYPES = {
 titan:{name:'Asterion, o Devorador do Sol',hp:1800,speed:55,range:230,damage:36,windup:1.5,cooldown:2.2,radius:85,color:'#ffd077',reward:'Asterion cai. O Sol renasce, e a aurora enfim pertence ao reino.'},
 shade:{name:'Espectro da Cripta',hp:95,speed:92,range:260,damage:18,windup:1.1,cooldown:1.9,color:'#87d8ed',reward:'A memória da cripta descansa.'},
 warden:{name:'Custódio da Primeira Aurora',hp:520,speed:95,range:145,damage:30,windup:1.2,cooldown:1.7,color:'#f1d080',reward:'O Custódio cai. A escadaria se abre. Asterion ainda aprisiona o coração do Sol.'},
  hollow:{name:'Sentinela Oca',hp:65,speed:105,range:65,damage:12,windup:.7,cooldown:1.45,color:'#c98f75',reward:'Uma sentinela recorda seu juramento. O primeiro selo enfraquece.'},
  ember:{name:'Devorador de Brasas',hp:90,speed:82,range:100,damage:18,windup:1,cooldown:2,color:'#ef914b',reward:'A brasa roubada retorna ao Jardim. O caminho da Cidadela está aberto.'},
  seer:{name:'Vidente do Eclipse',hp:80,speed:66,range:290,damage:16,windup:1.2,cooldown:2.2,color:'#b59be9',reward:'A Vidente silencia. Malênio já não pode esconder o Sol Partido.'},
  malenio:{name:'Malênio, o Rei sem Aurora',hp:320,speed:88,range:130,damage:25,windup:1.15,cooldown:1.8,color:'#e6b65f',reward:'Malênio cai. A entrada do castelo se abre; a última brasa está na cripta.'}
};
export const ENEMY_SPAWNS = [
 {id:'sentinela-oeste',type:'hollow',map:0,x:590,y:1120},
 {id:'sentinela-norte',type:'hollow',map:0,x:1040,y:620},
 {id:'devorador',type:'ember',map:0,x:1470,y:1150},
 {id:'vidente',type:'seer',map:1,x:650,y:1130},
 {id:'sentinela-cidadela',type:'hollow',map:1,x:1440,y:1100},
 {id:'malenio',type:'malenio',map:1,x:1030,y:1100},
 ...[{id:'cripta-oeste',type:'hollow',x:550,y:1630},{id:'cripta-leste',type:'hollow',x:1520,y:1630},{id:'espectro-oeste',type:'shade',x:560,y:1110},{id:'espectro-leste',type:'shade',x:1480,y:1110},{id:'brasa-cripta',type:'ember',x:1350,y:590},{id:'espectro-altar',type:'shade',x:680,y:550},{id:'custodio',type:'warden',x:1024,y:450}].map(e=>({...e,map:2})),
 ...[{type:'hollow',x:870,y:1510},{type:'hollow',x:1160,y:1500},{type:'shade',x:850,y:1090},{type:'ember',x:1160,y:1030},{type:'hollow',x:950,y:750},{type:'seer',x:1210,y:650},{type:'ember',x:1000,y:350}].map((e,i)=>({...e,id:'escada-'+i,map:3})),
 ...[{type:'ember',x:560,y:1450},{type:'shade',x:1390,y:1060},{type:'ember',x:1500,y:960},{type:'seer',x:850,y:510},{type:'ember',x:1110,y:410}].map((e,i)=>({...e,id:'fornalha-'+i,map:4})),
 {id:'asterion',type:'titan',map:5,x:1024,y:750}
];

function inside(x,y,points) {
 let hit=false;
 for(let i=0,j=points.length-1;i<points.length;j=i++){
  const [a,b]=points[i], [c,d]=points[j];
  if(((b>y)!==(d>y)) && x<(c-a)*(y-b)/(d-b)+a) hit=!hit;
 } return hit;
}
export function blocked(map,x,y,r=RADIUS) {
 if(!Number.isFinite(x)||!Number.isFinite(y)||x<r||y<r||x>SIZE-r||y>SIZE-r) return true;
 return MAPS[map].obstacles.some(({points})=>{
  if(inside(x,y,points)) return true;
  return points.some(([a,b],i)=>{
   const [c,d]=points[(i+1)%points.length],vx=c-a,vy=d-b;
   const t=Math.max(0,Math.min(1,((x-a)*vx+(y-b)*vy)/(vx*vx+vy*vy||1)));
   return Math.hypot(x-a-t*vx,y-b-t*vy)<r;
  });
 });
}
export function move(actor,dx,dy,r=RADIUS) {
 const n=Math.max(1,Math.ceil(Math.hypot(dx,dy)/6));
 for(let i=0;i<n;i++){
  if(!blocked(actor.map,actor.x+dx/n,actor.y,r))actor.x+=dx/n;
  if(!blocked(actor.map,actor.x,actor.y+dy/n,r))actor.y+=dy/n;
 }
}
export function lineClear(map,a,b) {
 const n=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/8);
 for(let i=1;i<n;i++)if(blocked(map,a.x+(b.x-a.x)*i/n,a.y+(b.y-a.y)*i/n,2))return false;
 return true;
}
export function safePoint(map,point) {
 if(!blocked(map,point.x,point.y))return {x:point.x,y:point.y};
 for(let r=16;r<512;r+=16)for(let a=0;a<Math.PI*2;a+=Math.PI/12){
  const x=point.x+Math.cos(a)*r,y=point.y+Math.sin(a)*r;
  if(!blocked(map,x,y))return {x,y};
 }
 return {...MAPS[map].spawn};
}
