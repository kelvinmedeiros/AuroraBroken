import {defaultGear,equipmentStats} from './equipment.mjs';
import {MAPS,ENEMY_TYPES,ENEMY_SPAWNS,RADIUS,move,blocked,lineClear,safePoint,portalsOf,RUNES,RUNE_ORDER,INSCRIPTION,GATE} from './world.mjs';
import {TUNING} from './settings.mjs';
export const STEP=1/60;
export function createWorld(){return {time:0,players:{},campfires:MAPS.map(()=>false),puzzle:{progress:0,solved:false},projectiles:[],enemies:ENEMY_SPAWNS.map(e=>({...e,...ENEMY_TYPES[e.type],maxHp:ENEMY_TYPES[e.type].hp,homeX:e.x,homeY:e.y,state:'idle',timer:0,flash:0})),effects:[],won:false};}
export function addPlayer(w,id,character='warrior'){
 const p={id,character:character==='witch'?'witch':'warrior',map:0,...MAPS[0].spawn,hp:100,maxHp:100,direction:'down',facingX:0,facingY:1,moving:false,attackCd:0,dashCd:0,dashTime:0,invuln:1,portalCd:1,healCd:0,kills:0,message:'Encontre os três guardiões do Jardim. E interage com fogueiras e portais.',messageTime:7};
 p.checkpointMap=0;p.equipment=defaultGear(p.character);p.energy=100;p.specialCd=0;p.rangedCd=0;w.players[id]=p;return p;
}
export function objective(w){
 const left=w.enemies.filter(e=>e.map===0&&e.hp>0).length;
 if(left)return `Liberte o Jardim • ${3-left}/3 guardiões`;
 if(w.won)return 'A aurora voltou • Jornada concluída';
 if(w.enemies.some(e=>e.type==='malenio'&&e.hp>0))return 'Derrote Malênio na Cidadela';
 if(!w.puzzle.solved)return `Entre no castelo • Resolva as runas (${w.puzzle.progress}/3)`;
 return 'O selo abriu • Derrote o Custódio na câmara norte';
}
export function worldBlocked(w,map,x,y,r=RADIUS){return blocked(map,x,y,r)||(map===2&&!w.puzzle.solved&&Math.abs(x-GATE.x)<GATE.halfWidth+r&&Math.abs(y-GATE.y)<GATE.halfHeight+r);}
export function moveInWorld(w,actor,dx,dy,r=RADIUS){const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/6));for(let i=0;i<steps;i++){if(!worldBlocked(w,actor.map,actor.x+dx/steps,actor.y,r))actor.x+=dx/steps;if(!worldBlocked(w,actor.map,actor.x,actor.y+dy/steps,r))actor.y+=dy/steps;}}
export function lineOfSight(w,map,a,b){const steps=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/6);for(let i=1;i<steps;i++)if(worldBlocked(w,map,a.x+(b.x-a.x)*i/steps,a.y+(b.y-a.y)*i/steps,2))return false;return true;}
const tell=(p,text)=>{p.message=text;p.messageTime=5;};
function damagePlayer(w,p,damage){
 if(p.hp<=0||p.invuln>0)return;
 damage=Math.max(1,Math.round(damage*(1-equipmentStats(p).defense/100)));p.hp=Math.max(0,p.hp-damage);p.invuln=.75;
 w.effects.push({kind:'number',x:p.x,y:p.y-65,text:`−${damage}`,color:'#ff8e84',life:.7,map:p.map});
 if(p.hp===0){p.moving=false;tell(p,'Sua brasa ainda vive. Pressione R para voltar à fogueira.');}
}
function hitEnemy(w,p,e,damage){
 if(e.hp<=0)return;e.hp=Math.max(0,e.hp-Math.round(damage));e.flash=.15;
 w.effects.push({kind:'number',x:e.x,y:e.y-80,text:String(Math.round(damage)),color:'#fff3cd',life:.65,map:e.map});
 if(e.hp===0){e.state='dead';if(p){p.kills++;p.hp=Math.min(100,p.hp+15);tell(p,e.reward);}if(e.type==='warden'&&w.puzzle.solved)w.won=true;if(['malenio','warden'].includes(e.type))for(const ally of Object.values(w.players))tell(ally,e.reward);}
}
export function attack(w,p,kind='normal'){
 if(p.hp<=0||p.attackCd>0||p.dashTime>0)return false;
 const stats=equipmentStats(p),weapon=stats.weapon,special=kind==='special',ranged=kind==='ranged';
 if(special&&(p.specialCd>0||p.energy<30)||ranged&&(p.rangedCd>0||p.energy<40))return false;
 const damage=weapon.damage*stats.power*TUNING.playerDamage;
 if(ranged){p.energy-=40;p.rangedCd=3;p.attackCd=.35;w.projectiles.push({id:w.time+':'+p.id,owner:p.id,map:p.map,x:p.x,y:p.y,dx:p.facingX,dy:p.facingY,life:1.25,damage:damage*1.7,color:weapon.color,hits:[]});return true;}
 let range=weapon.range,arc=weapon.arc,multiplier=1;
 if(special){p.energy-=30;p.specialCd=4;p.attackCd=.75;multiplier=2;range=weapon.style==='thrust'?330:weapon.style==='beam'?400:weapon.range+70;arc=['thrust','beam'].includes(weapon.style)?.92:-1;}
 else p.attackCd=weapon.cooldown;
 w.effects.push({kind:special&&arc===-1?'burst':'slash',x:p.x,y:p.y,angle:Math.atan2(p.facingY,p.facingX),range,life:special?.4:.18,map:p.map,color:weapon.color});
 for(const e of w.enemies){if(e.hp<=0||e.map!==p.map)continue;const dx=e.x-p.x,dy=e.y-p.y,d=Math.hypot(dx,dy),dot=(dx*p.facingX+dy*p.facingY)/(d||1);if(d>range+18||dot<arc||!lineOfSight(w,p.map,p,e))continue;hitEnemy(w,p,e,damage*multiplier);if(special)e.slow=2;}
 return true;
}
export function interact(w,p){
 if(p.hp<=0||p.portalCd>0)return false;
 const m=MAPS[p.map];
 for(const portal of portalsOf(p.map)){
 if(Math.hypot(p.x-portal.x,p.y-portal.y)<portal.r+RADIUS){
  if(portal.requires&&w.enemies.some(e=>e.type===portal.requires&&e.hp>0)){tell(p,'A entrada está selada. Derrote Malênio.');return false;}
  if(p.map===0&&w.enemies.some(e=>e.map===0&&e.hp>0)){tell(p,'O selo exige a queda dos três guardiões do Jardim.');return false;}
  p.map=portal.to;Object.assign(p,safePoint(p.map,portal.destination));p.portalCd=1;p.invuln=1;p.moving=false;p.dashTime=0;
  tell(p,MAPS[p.map].name);return true;
 }
 }
 if(p.map===2){
  if(Math.hypot(p.x-INSCRIPTION.x,p.y-INSCRIPTION.y)<85){tell(p,'Inscrição: primeiro a LUA guarda a noite, depois a BRASA desperta, por fim o SOL renasce.');return true;}
  const rune=RUNES.find(r=>Math.hypot(p.x-r.x,p.y-r.y)<85);
  if(rune){if(w.puzzle.solved){tell(p,'O selo já foi desfeito. A câmara norte está aberta.');return true;}
   if(rune.id===RUNE_ORDER[w.puzzle.progress]){w.puzzle.progress++;if(w.puzzle.progress===3){w.puzzle.solved=true;for(const ally of Object.values(w.players))tell(ally,'As três runas ressoam. A passagem norte se abriu!');}else tell(p,'Runa correta • '+w.puzzle.progress+'/3');}
   else {w.puzzle.progress=0;tell(p,'A ordem foi quebrada. Leia a inscrição junto à entrada.');}
   p.portalCd=.6;return true;
  }
 }
 if(Math.hypot(p.x-m.camp.x,p.y-m.camp.y)<95){
  if(!w.campfires[p.map]){w.campfires[p.map]=true;p.checkpointMap=p.map;p.hp=100;p.healCd=8;w.effects.push({kind:'burst',x:m.camp.x,y:m.camp.y,range:65,life:.6,map:p.map,color:'#ffd186'});tell(p,'Fogueira acesa. Sua brasa ficará guardada aqui.');return true;}
  if(p.healCd>0){tell(p,'A fogueira está se recompondo. Aguarde alguns segundos.');return false;}
  p.checkpointMap=p.map;p.hp=100;p.healCd=8;tell(p,'Brasa restaurada. Os guardiões derrotados continuam em repouso.');return true;
 }return false;
}
export function respawn(w,p){
 if(p.hp>0)return false;
 const deathMap=p.map;
 p.map=w.campfires[p.checkpointMap]?p.checkpointMap:0;
 Object.assign(p,safePoint(p.map,MAPS[p.map].spawn));p.hp=100;p.invuln=2;p.attackCd=0;p.dashTime=0;p.dashCd=0;p.portalCd=1;
 // Reset surviving enemies on this map only when nobody else is fighting here.
 if(!Object.values(w.players).some(a=>a.id!==p.id&&a.map===deathMap&&a.hp>0))for(const e of w.enemies.filter(e=>e.map===deathMap&&e.hp>0)){
  e.x=e.homeX;e.y=e.homeY;e.hp=e.maxHp;e.state='idle';e.timer=0;
 }
 tell(p,'A fogueira guardou sua jornada. Tente novamente.');return true;
}
function tickPlayer(w,p,input,dt){
 for(const k of ['attackCd','dashCd','invuln','portalCd','messageTime','healCd','specialCd','rangedCd'])p[k]=Math.max(0,p[k]-dt);
 if(input.respawn)respawn(w,p);
 if(p.hp<=0){p.moving=false;return;}
 p.energy=Math.min(100,(p.energy??100)+equipmentStats(p).regen*dt);
 let dx=Number(input.right===true)-Number(input.left===true),dy=Number(input.down===true)-Number(input.up===true);
 const len=Math.hypot(dx,dy);if(len){dx/=len;dy/=len;p.facingX=dx;p.facingY=dy;p.direction=Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up');}
 if(input.dash&&p.dashCd===0&&p.dashTime<=0){p.dashTime=.18;p.dashCd=1.2;p.invuln=.25;p.dashX=p.facingX;p.dashY=p.facingY;}
 const oldX=p.x,oldY=p.y;
 if(p.dashTime>0){moveInWorld(w,p,p.dashX*620*dt,p.dashY*620*dt);p.dashTime=Math.max(0,p.dashTime-dt);}
 else moveInWorld(w,p,dx*TUNING.playerSpeed*dt,dy*TUNING.playerSpeed*dt);
 p.moving=Math.hypot(p.x-oldX,p.y-oldY)>.01;
 if(input.special)attack(w,p,'special');else if(input.ranged)attack(w,p,'ranged');else if(input.attack)attack(w,p);
 if(input.interact)interact(w,p);
}
function tickEnemy(w,e,dt){
 e.flash=Math.max(0,e.flash-dt);e.slow=Math.max(0,(e.slow||0)-dt);if(e.hp<=0||e.map===2&&e.homeY<880&&!w.puzzle.solved)return;
 const targets=Object.values(w.players).filter(p=>p.map===e.map&&p.hp>0);
 if(!targets.length){e.state='idle';e.timer=0;return;}
 const p=targets.reduce((a,b)=>Math.hypot(a.x-e.x,a.y-e.y)<Math.hypot(b.x-e.x,b.y-e.y)?a:b);
 e.timer=Math.max(0,e.timer-dt);
 const enraged=['malenio','warden'].includes(e.type)&&e.hp<e.maxHp/2;
 if(e.state==='windup'){
  if(e.timer===0){
   const blast=['seer','shade'].includes(e.type);const center=blast?{x:e.aimX,y:e.aimY}:e;
   const radius=blast?72:e.range*(enraged?1.2:1);
   w.effects.push({kind:'burst',x:center.x,y:center.y,range:radius,life:.3,map:e.map,color:e.color});
   for(const target of targets)if(Math.hypot(target.x-center.x,target.y-center.y)<radius+RADIUS&&lineOfSight(w,e.map,e,target))damagePlayer(w,target,e.damage);
   e.state='recover';e.timer=e.cooldown*(enraged?.7:1);
  }return;
 }
 if(e.state==='recover'){if(e.timer===0)e.state='idle';return;}
 const dx=p.x-e.x,dy=p.y-e.y,d=Math.hypot(dx,dy),visible=lineOfSight(w,e.map,e,p);
 // Foes never camp the checkpoint; this also gives players a safe recovery area.
 const camp=MAPS[e.map].camp;
 if(d>TUNING.aggroRange||(w.campfires[e.map]&&Math.hypot(p.x-camp.x,p.y-camp.y)<130)){
  const hx=e.homeX-e.x,hy=e.homeY-e.y,h=Math.hypot(hx,hy);
  if(h>3)moveInWorld(w,e,hx/h*e.speed*dt,hy/h*e.speed*dt,18);
  e.state='idle';return;
 }
 if(d<=e.range&&visible){e.state='windup';e.timer=e.windup*(enraged?.8:1);e.aimX=p.x;e.aimY=p.y;return;}
 e.state='chase';
 if(d>1){
  const speed=e.speed*(enraged?1.3:1)*(e.slow>0?.5:1),x=e.x,y=e.y;
  moveInWorld(w,e,dx/d*speed*dt,dy/d*speed*dt,18);
  // Deterministic wall following if direct pursuit is blocked.
  if(Math.hypot(e.x-x,e.y-y)<speed*dt*.25){
   const a=Math.atan2(dy,dx);
   for(const turn of [.6,-.6,1.2,-1.2,1.8,-1.8]){
    const nx=Math.cos(a+turn)*speed*dt,ny=Math.sin(a+turn)*speed*dt;
    if(!blocked(e.map,e.x+nx,e.y+ny,18)){moveInWorld(w,e,nx,ny,18);break;}
   }
  }
 }
}
export function tick(w,inputs={},dt=STEP){
 dt=Math.max(0,Math.min(dt,.05));w.time+=dt;
 w.effects=w.effects.filter(e=>(e.life-=dt)>0);
 for(const p of Object.values(w.players))tickPlayer(w,p,inputs[p.id]||{},dt);
 for(const e of w.enemies)tickEnemy(w,e,dt);
 for(const shot of w.projectiles){shot.life-=dt;const steps=Math.ceil(480*dt/6);for(let i=0;i<steps&&shot.life>0;i++){shot.x+=shot.dx*480*dt/steps;shot.y+=shot.dy*480*dt/steps;if(worldBlocked(w,shot.map,shot.x,shot.y,5)){shot.life=0;break;}for(const e of w.enemies)if(e.map===shot.map&&e.hp>0&&!shot.hits.includes(e.id)&&Math.hypot(e.x-shot.x,e.y-shot.y)<25){shot.hits.push(e.id);hitEnemy(w,w.players[shot.owner],e,shot.damage);}}}
 w.projectiles=w.projectiles.filter(s=>s.life>0);
}
