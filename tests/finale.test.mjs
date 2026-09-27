import test from 'node:test';
import assert from 'node:assert/strict';
import {MAPS,ENEMY_SPAWNS,portalsOf,portalLocked,blocked} from '../client/world.mjs';
import {PLATFORMS,inLava} from '../client/terrain.mjs';
import {createWorld,addPlayer,interact,tick,attack,titanAttackArea} from '../client/engine.mjs';
import {encodeSave,decodeSave} from '../client/save.mjs';
import {newRoom,joinProfile,captureRoom,restoreRoom,hashToken} from '../api/room-store.mjs';
import {equip,SLOTS} from '../client/equipment.mjs';
import {mkdtempSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {DEFAULT_SETTINGS,applySettings} from '../client/settings.mjs';
import {installAdmin} from '../api/admin.mjs';

test('all six maps have safe portal endpoints; stairs and furnace require their encounters',()=>{
 const w=createWorld(),p=addPlayer(w,'a');
 for(const m of MAPS)for(const portal of portalsOf(m.id)){
  assert.equal(blocked(m.id,portal.x,portal.y),false);assert.equal(inLava(m.id,portal.x,portal.y),false);
  assert.equal(blocked(portal.to,portal.destination.x,portal.destination.y),false);assert.equal(inLava(portal.to,portal.destination.x,portal.destination.y),false);
 }
 for(const map of [2,3,4]){
  const portal=portalsOf(map).find(p=>p.to===map+1);Object.assign(p,{map,x:portal.x,y:portal.y,portalCd:0});assert.ok(portalLocked(w,map,portal));assert.equal(interact(w,p),false);
  for(const e of w.enemies.filter(e=>e.map===map))e.hp=0;assert.equal(portalLocked(w,map,portal),false);assert.equal(interact(w,p),true);assert.equal(p.map,map+1);assert.equal(interact(w,p),false);
 }
});
test('lava platforms form one continuous safe route through every encounter and exit',()=>{
 const step=10,n=205,seen=new Set(),queue=[[102,183]];
 for(let i=0;i<queue.length;i++){const [x,y]=queue[i],key=x+','+y;if(x<0||y<0||x>=n||y>=n||seen.has(key)||inLava(4,x*step,y*step)||blocked(4,x*step,y*step))continue;seen.add(key);for(const [dx,dy] of [[0,1],[0,-1],[1,0],[-1,0]])queue.push([x+dx,y+dy]);}
 for(const p of [...ENEMY_SPAWNS.filter(e=>e.map===4),MAPS[4].camp,...portalsOf(4)])assert.ok(seen.has(Math.round(p.x/step)+','+Math.round(p.y/step)),p.id||'safe target');
 for(const p of PLATFORMS)assert.equal(inLava(4,p.x+p.w/2,p.y+p.h/2),false);
 assert.equal(inLava(4,200,1000),true);assert.equal(inLava(3,200,1000),false);
});
test('lava damages periodically despite dodge invulnerability; safe platforms stop damage and death respawns safely',()=>{
 const w=createWorld(),p=addPlayer(w,'a');w.enemies=[];Object.assign(p,{map:4,x:200,y:1000,invuln:99,checkpointMap:4});w.campfires[4]=true;
 tick(w,{},.01);assert.equal(p.hp,82);for(let i=0;i<10;i++)tick(w,{},.05);assert.equal(p.hp,82);
 Object.assign(p,MAPS[4].spawn);for(let i=0;i<30;i++)tick(w,{},.05);assert.equal(p.hp,82);
 p.x=200;p.y=1000;for(let i=0;i<100;i++)tick(w,{},.05);assert.equal(p.hp,0);tick(w,{a:{respawn:true}},.01);assert.equal(p.map,4);assert.equal(p.hp,100);assert.equal(inLava(p.map,p.x,p.y),false);
});
test('giant boss telegraphs all three attacks, has a safe ring center and enters a larger second phase',()=>{
 const w=createWorld(),p=addPlayer(w,'a'),boss=w.enemies.find(e=>e.type==='titan');w.enemies=[boss];Object.assign(p,{map:5,x:1024,y:950,invuln:0});
 tick(w,{},.01);assert.equal(boss.state,'windup');assert.equal(boss.attackPattern,0);assert.equal(p.hp,100);
 const first=titanAttackArea(boss);boss.hp=boss.maxHp*.4;assert.ok(titanAttackArea(boss).outer>first.outer);boss.hp=boss.maxHp;
 boss.attackPattern=2;boss.timer=.01;p.x=boss.x;p.y=boss.y;tick(w,{},.02);assert.equal(p.hp,100);
 Object.assign(boss,{state:'windup',attackPattern:2,timer:.01});p.y=boss.y+250;tick(w,{},.02);assert.equal(p.hp,64);
 Object.assign(boss,{state:'windup',attackPattern:1,timer:.01,aimX:1200,aimY:1000});Object.assign(p,{x:1500,y:1000,invuln:0});tick(w,{},.02);assert.equal(p.hp,64);
 Object.assign(boss,{state:'windup',attackPattern:1,timer:.01,aimX:p.x,aimY:p.y});tick(w,{},.02);assert.equal(p.hp,28);
});
test('both classes can defeat Asterion by attacking between telegraphs and dodging marked areas',()=>{
 for(const character of ['warrior','witch']){
  const w=createWorld(),p=addPlayer(w,'a',character),boss=w.enemies.find(e=>e.type==='titan');w.enemies.find(e=>e.type==='malenio').hp=0;for(const slot of Object.keys(SLOTS))equip(w,p,slot,2);w.puzzle={solved:true,progress:3};w.enemies=[boss];Object.assign(p,{map:5,x:1024,y:1050,invuln:0});
  for(let i=0;i<60*180&&boss.hp>0&&p.hp>0;i++){
   const d=Math.hypot(p.x-boss.x,p.y-boss.y),area=titanAttackArea(boss),winding=boss.state==='windup',command={};
   if(winding){if(boss.attackPattern===2){command.up=p.y>boss.y+80;command.down=p.y<boss.y+50;command.dash=d>area.inner-20&&boss.timer<.65;}
    else {command.down=p.y<area.y+area.outer+50;command.dash=boss.timer<.7;}}
   else {command.up=d>(character==='witch'?230:155)||p.facingY>=0;command.attack=true;command.special=p.specialCd===0;command.ranged=!command.special&&p.rangedCd===0;}
   tick(w,{a:command});
  }
  assert.ok(p.hp>0,character+' survives');assert.equal(boss.hp,0,character+' defeats titan');assert.equal(w.won,true);
 }
});
test('six-stage saves retain checkpoints, final victory and old room progression',()=>{
 const hash=hashToken('a'.repeat(32)),room=newRoom(hash),p=joinProfile(room,'p',hash,'warrior','Teste');room.world.puzzle={progress:3,solved:true};room.world.campfires[5]=true;Object.assign(p,{map:5,x:1024,y:1700,checkpointMap:5});room.world.enemies.find(e=>e.type==='titan').hp=0;
 assert.equal(decodeSave(encodeSave(room.world,'p')).won,true);const restored=restoreRoom(captureRoom(room,'TEST'));assert.equal(restored.world.won,true);assert.equal(restored.profiles[hash].checkpointMap,5);
 const old=captureRoom(room,'TEST');old.version=2;old.enemies=old.enemies.filter(e=>ENEMY_SPAWNS.find(s=>s.id===e.id).map<3);old.enemies.find(e=>e.id==='custodio').hp=0;old.campfires=old.campfires.slice(0,3);old.profiles[hash].map=2;old.profiles[hash].checkpointMap=2;
 const expanded=restoreRoom(old);assert.equal(expanded.world.enemies.length,26);assert.equal(expanded.world.enemies.find(e=>e.id==='custodio').hp,0);assert.equal(expanded.world.enemies.find(e=>e.type==='titan').hp,1800);assert.equal(expanded.world.won,false);
});
test('three-map admin settings migrate without restoring deliberately removed collision shapes',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'aurora-finale-')),old=structuredClone(DEFAULT_SETTINGS);old.version=3;old.maps=old.maps.slice(0,3);old.maps[0].obstacles.pop();delete old.enemies.titan;old.tuning.playerDamage=1.2;const count=old.maps[0].obstacles.length;
 writeFileSync(path.join(dir,'world-settings.json'),JSON.stringify(old));
 try{installAdmin({get(){},post(){}},{directory:dir,onApply(){}});const next=JSON.parse(readFileSync(path.join(dir,'world-settings.json'),'utf8'));assert.equal(next.version,4);assert.equal(next.maps.length,6);assert.equal(next.maps[0].obstacles.length,count);assert.equal(next.tuning.playerDamage,1.2);assert.equal(next.enemies.titan.hp,1800);assert.ok(existsSync(path.join(dir,'world-settings.json.before-finale.bak')));}finally{applySettings(DEFAULT_SETTINGS);}
});
