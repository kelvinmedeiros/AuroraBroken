import {MAPS,ENEMY_TYPES,ENEMY_SPAWNS,SIZE,blocked,portalsOf,RUNES,INSCRIPTION} from './world.mjs';
const copy=value=>JSON.parse(JSON.stringify(value));
export const DEFAULT_SETTINGS={version:3,revision:0,maps:MAPS.map(m=>({id:m.id,obstacles:copy(m.obstacles)})),enemies:copy(ENEMY_TYPES),tuning:{playerSpeed:225,playerDamage:1,aggroRange:440}};
export const TUNING={...DEFAULT_SETTINGS.tuning};
let active=copy(DEFAULT_SETTINGS);
export const getSettings=()=>copy(active);
const ranges={hp:[1,5000],speed:[0,500],range:[25,500],damage:[0,100],windup:[.15,5],cooldown:[.2,10]};
const number=(v,min,max,label)=>{if(!Number.isFinite(v)||v<min||v>max)throw new Error(label+': valor deve ficar entre '+min+' e '+max);return v;};
function cross(a,b,c){return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);}
function intersects(a,b,c,d){return cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0;}
export function validateSettings(input){
 if(!input||input.version!==3||!Array.isArray(input.maps)||input.maps.length!==MAPS.length)throw new Error('Configuração inválida ou versão incompatível.');
 const out=copy(DEFAULT_SETTINGS);out.revision=Number.isFinite(input.revision)?input.revision:0;
 out.maps=DEFAULT_SETTINGS.maps.map(base=>{
  const map=input.maps.find(m=>m?.id===base.id);if(!map||!Array.isArray(map.obstacles)||map.obstacles.length>300)throw new Error('Mapa inválido: máximo de 300 polígonos.');
  return {id:base.id,obstacles:map.obstacles.map((o,index)=>{
   if(!o||typeof o.name!=='string'||!o.name.trim()||o.name.length>80||!Array.isArray(o.points)||o.points.length<3||o.points.length>64)throw new Error('Polígono '+index+': nome e 3 a 64 vértices são obrigatórios.');
   const points=o.points.map(p=>{if(!Array.isArray(p)||p.length!==2)throw new Error('Vértice inválido.');return [number(p[0],0,SIZE,'X'),number(p[1],0,SIZE,'Y')];});
   let area=0;
   for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length];if(Math.hypot(a[0]-b[0],a[1]-b[1])<1)throw new Error(o.name+': vértices duplicados.');
    area+=a[0]*b[1]-b[0]*a[1];
    for(let j=i+2;j<points.length;j++){if(i===0&&j===points.length-1)continue;if(intersects(a,b,points[j],points[(j+1)%points.length]))throw new Error(o.name+': arestas não podem se cruzar.');}
   }
   if(Math.abs(area)<4)throw new Error(o.name+': polígono sem área.');return {name:o.name.trim(),points};
  })};
 });
 for(const type of Object.keys(ENEMY_TYPES))for(const [key,[min,max]] of Object.entries(ranges))out.enemies[type][key]=number(input.enemies?.[type]?.[key],min,max,type+' / '+key);
 for(const [key,min,max] of [['playerSpeed',60,600],['playerDamage',.1,5],['aggroRange',100,1200]])out.tuning[key]=number(input.tuning?.[key],min,max,key);
 return out;
}
export function applySettings(input,{checkSpawns=true}={}){
 const next=validateSettings(input),before=MAPS.map(m=>m.obstacles);
 try{
  next.maps.forEach((m,i)=>{MAPS[i].obstacles=copy(m.obstacles);});
  if(checkSpawns)for(const e of ENEMY_SPAWNS)if(blocked(e.map,e.x,e.y,18))throw new Error('A colisão cobre o ponto do inimigo '+e.id);
  if(checkSpawns)for(const m of MAPS)for(const p of [m.spawn,m.camp,...portalsOf(m.id),...MAPS.flatMap(a=>portalsOf(a.id)).filter(p=>p.to===m.id).map(p=>p.destination),...(m.id===2?[...RUNES,INSCRIPTION]:[])])if(blocked(m.id,p.x,p.y))throw new Error(m.name+': a colisão cobre um ponto de entrada, fogueira ou portal.');
 }catch(error){MAPS.forEach((m,i)=>{m.obstacles=before[i];});throw error;}
 for(const type of Object.keys(ENEMY_TYPES))Object.assign(ENEMY_TYPES[type],next.enemies[type]);Object.assign(TUNING,next.tuning);active=next;return getSettings();
}
export function refreshWorldSettings(world){
 for(const e of world.enemies){const ratio=e.maxHp?e.hp/e.maxHp:1,stats=ENEMY_TYPES[e.type];Object.assign(e,stats,{hp:e.hp<=0?0:Math.max(1,Math.round(stats.hp*ratio)),maxHp:stats.hp});}
}
