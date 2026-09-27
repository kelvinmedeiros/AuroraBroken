import test from 'node:test';
import assert from 'node:assert/strict';
import {MAPS,ENEMY_SPAWNS,SIZE,blocked,move,lineClear} from '../client/world.mjs';
import {createWorld,addPlayer,tick,attack,interact,respawn} from '../client/engine.mjs';
import {encodeSave,decodeSave} from '../client/save.mjs';

test('all spawns, checkpoints and both sides of portals are walkable',()=>{
 for(const m of MAPS){for(const p of [m.spawn,m.camp,m.portal])assert.equal(blocked(m.id,p.x,p.y),false,m.name);assert.equal(blocked(m.portal.to,m.portal.destination.x,m.portal.destination.y),false);}
 for(const e of ENEMY_SPAWNS)assert.equal(blocked(e.map,e.x,e.y,18),false,e.id);
});

// Flood-fill the actual collision geometry, including actor radius, to verify
// every encounter and portal belongs to the checkpoint's connected region.
function reachable(map,start,end){
 const cell=16,n=SIZE/cell,seen=new Set(),queue=[[Math.round(start.x/cell),Math.round(start.y/cell)]];
 for(let head=0;head<queue.length;head++){
  const [x,y]=queue[head],key=x+','+y;if(seen.has(key))continue;seen.add(key);
  if(x<0||y<0||x>=n||y>=n||blocked(map,x*cell,y*cell))continue;
  if(Math.hypot(x*cell-end.x,y*cell-end.y)<cell*1.5)return true;
  for(const [dx,dy] of [[0,1],[0,-1],[1,0],[-1,0]])if(!seen.has((x+dx)+','+(y+dy)))queue.push([x+dx,y+dy]);
 }return false;
}
test('all objectives and portals are reachable from checkpoints',()=>{
 for(const m of MAPS)for(const target of [m.portal,...ENEMY_SPAWNS.filter(e=>e.map===m.id)])assert.ok(reachable(m.id,m.camp,target),target.id||m.name);
});
test('movement slides along walls, respects boundaries and cannot tunnel',()=>{
 const p={map:0,x:1120,y:120};move(p,500,-200);assert.ok(!blocked(0,p.x,p.y));assert.ok(p.x>1120);
 move(p,5000,5000);assert.ok(p.x<SIZE&&p.y<SIZE);assert.ok(!blocked(0,p.x,p.y));
 const trunk={map:0,x:1150,y:1580};move(trunk,300,0);assert.ok(trunk.x<1220,'tree trunk stops the feet without tunnelling');
});
test('equal real time gives equal movement at different frame steps',()=>{
 const run=dt=>{const w=createWorld(),p=addPlayer(w,'a');w.enemies=[];for(let t=0;t<60;t++)tick(w,{a:{down:true}},dt);return p.y;};
 assert.ok(Math.abs(run(1/60)-1500-225)<.01);
 const w=createWorld(),p=addPlayer(w,'a');w.enemies=[];for(let i=0;i<120;i++)tick(w,{a:{down:true}},1/120);
 assert.ok(Math.abs(p.y-run(1/60))<.01);
});
test('attacks respect facing, range, map, cooldown and solid walls',()=>{
 const w=createWorld(),p=addPlayer(w,'a');p.x=1000;p.y=650;p.facingX=0;p.facingY=-1;
 const e=w.enemies[0];Object.assign(e,{x:1000,y:580,map:0});w.enemies=[e];
 attack(w,p);assert.equal(e.hp,41);attack(w,p);assert.equal(e.hp,41);
 p.attackCd=0;p.facingY=1;attack(w,p);assert.equal(e.hp,41);
 p.attackCd=0;p.facingY=-1;e.map=1;attack(w,p);assert.equal(e.hp,41);
 e.map=0;p.attackCd=0;e.y=400;attack(w,p);assert.equal(e.hp,41);
 p.x=1200;p.y=1580;p.facingX=1;p.facingY=0;e.x=1300;e.y=1580;p.character='witch';p.attackCd=0;
 assert.equal(lineClear(0,p,e),false);attack(w,p);assert.equal(e.hp,41);
});
test('enemy attacks are telegraphed, dodgeable and cannot damage dead actors',()=>{
 const w=createWorld(),p=addPlayer(w,'a');Object.assign(p,{x:1000,y:630,invuln:0});
 const e=w.enemies[1];w.enemies=[e];Object.assign(e,{x:1000,y:580});
 tick(w,{},.01);assert.equal(e.state,'windup');assert.equal(p.hp,100);
 for(let i=0;i<80;i++)tick(w,{},.01);assert.equal(p.hp,88);
 for(let i=0;i<20;i++)tick(w,{},.01);assert.equal(p.hp,88);
 p.hp=100;p.invuln=0;e.state='windup';e.timer=.08;e.aimX=p.x;e.aimY=p.y;
 tick(w,{a:{dash:true}},.01);for(let i=0;i<10;i++)tick(w,{},.01);assert.equal(p.hp,100);
 p.hp=0;const x=p.x;tick(w,{a:{right:true,attack:true}},.05);assert.equal(p.x,x);
});
test('portal lock, safe return, cooldown and defeated enemies persist',()=>{
 const w=createWorld(),p=addPlayer(w,'a');Object.assign(p,MAPS[0].portal,{portalCd:0,map:0});
 assert.equal(interact(w,p),false);assert.equal(p.map,0);
 for(const e of w.enemies.filter(e=>e.map===0))e.hp=0;
 assert.equal(interact(w,p),true);assert.equal(p.map,1);assert.equal(p.hp,100);assert.equal(blocked(1,p.x,p.y),false);
 const boss=w.enemies.find(e=>e.type==='malenio');boss.hp=101;
 Object.assign(p,{x:MAPS[1].portal.x,y:MAPS[1].portal.y});assert.equal(interact(w,p),false);
 p.portalCd=0;assert.equal(interact(w,p),true);assert.equal(p.map,0);assert.equal(boss.hp,101);
 assert.equal(blocked(0,p.x,p.y),false);
});
test('checkpoint recovery, death reset and victory survive save/load',()=>{
 const w=createWorld(),p=addPlayer(w,'a');p.portalCd=0;p.hp=30;assert.ok(interact(w,p));assert.equal(p.hp,100);
 w.enemies[0].hp=0;p.hp=0;assert.ok(respawn(w,p));assert.equal(p.hp,100);assert.equal(w.enemies[0].hp,0);
 const boss=w.enemies.find(e=>e.type==='warden');boss.hp=0;w.puzzle={progress:3,solved:true};w.won=true;
 const loaded=decodeSave(encodeSave(w,'a'));assert.equal(loaded.won,true);assert.equal(loaded.enemies[0].hp,0);
 assert.equal(decodeSave('broken'),null);
 const unsafe=decodeSave(JSON.stringify({version:1,player:{x:NaN,y:-8,map:99,hp:999,character:'bad'},enemies:[]}));assert.equal(unsafe.players.solo.hp,100);assert.equal(unsafe.players.solo.character,'warrior');assert.equal(unsafe.players.solo.map,0);
});

test('both classes can defeat the boss using normal movement, attacks and timed dodges',()=>{
 for(const character of ['warrior','witch']){
  const w=createWorld(),p=addPlayer(w,'a',character),boss=w.enemies.find(e=>e.type==='malenio');
  w.enemies=[boss];Object.assign(p,{map:1,x:1030,y:1280,invuln:0});
  let sawRage=false;
  for(let i=0;i<60*60&&boss.hp>0&&p.hp>0;i++){
   const dx=boss.x-p.x,dy=boss.y-p.y,d=Math.hypot(dx,dy);
   const retreat=boss.state==='windup'&&boss.timer<.25;
   const command={attack:true,dash:retreat};
   if(retreat||d>(character==='witch'?190:80)||p.facingY*Math.sign(dy)<0){
    const sign=retreat?-1:1;command.up=dy*sign<0;command.down=dy*sign>0;command.left=dx*sign< -4;command.right=dx*sign>4;
   }
   tick(w,{a:command});if(boss.hp<boss.maxHp/2)sawRage=true;
  }
  assert.ok(p.hp>0,character+' survives a readable dodge strategy');assert.equal(boss.hp,0,character+' can finish the boss');assert.ok(sawRage);assert.equal(w.won,false);
 }
});

test('co-op damage, victory and respawn use one shared world and preserve allies',()=>{
 const w=createWorld(),a=addPlayer(w,'a'),b=addPlayer(w,'b','witch');
 const boss=w.enemies.find(e=>e.type==='warden');w.enemies=[boss];boss.hp=45;w.puzzle={progress:3,solved:true};Object.assign(boss,{x:1030,y:1100});
 Object.assign(a,{map:2,x:1030,y:1180,facingX:0,facingY:-1});Object.assign(b,{map:2,x:1040,y:1190,facingX:0,facingY:-1});
 attack(w,a);assert.equal(boss.hp,21);attack(w,b);assert.equal(boss.hp,0);assert.ok(w.won);assert.match(a.message,/aurora/);assert.equal(a.message,b.message);
 boss.hp=100;a.hp=0;const bx=b.x;respawn(w,a);assert.equal(boss.hp,100);assert.equal(b.x,bx);assert.equal(a.hp,100);
});
