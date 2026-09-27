import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,addPlayer,interact,attack,tick,worldBlocked,moveInWorld,lineOfSight} from '../client/engine.mjs';
import {MAPS,RUNES,RUNE_ORDER,portalsOf,blocked} from '../client/world.mjs';
import {SLOTS,WEAPONS,equip,equipmentStats} from '../client/equipment.mjs';
import {encodeSave,decodeSave} from '../client/save.mjs';
import {newRoom,joinProfile,captureRoom,restoreRoom,hashToken} from '../api/room-store.mjs';

test('castle requires Malênio, enters dungeon safely and returns without retriggering',()=>{
 const w=createWorld(),p=addPlayer(w,'a'),door=portalsOf(1).find(p=>p.to===2);
 Object.assign(p,{map:1,x:door.x,y:door.y,portalCd:0});assert.equal(blocked(1,p.x,p.y),false);assert.equal(interact(w,p),false);
 w.enemies.find(e=>e.type==='malenio').hp=0;assert.equal(interact(w,p),true);assert.equal(p.map,2);assert.equal(blocked(2,p.x,p.y),false);
 assert.equal(interact(w,p),false);Object.assign(p,{...MAPS[2].portal,map:2,portalCd:0});interact(w,p);assert.equal(p.map,1);assert.equal(blocked(1,p.x,p.y),false);assert.equal(interact(w,p),false);
});
test('runes reset on a wrong order and only the completed shared puzzle opens the seal',()=>{
 const w=createWorld(),a=addPlayer(w,'a'),b=addPlayer(w,'b');a.map=b.map=2;
 const use=(p,id)=>{Object.assign(p,RUNES.find(r=>r.id===id),{portalCd:0});return interact(w,p);};
 use(a,'moon');assert.equal(w.puzzle.progress,1);assert.equal(interact(w,a),false);use(b,'sun');assert.equal(w.puzzle.progress,0);
 for(const id of RUNE_ORDER)use(id==='flame'?b:a,id);
 assert.deepEqual(w.puzzle,{progress:3,solved:true});assert.match(a.message,/abriu/);assert.equal(a.message,b.message);
 assert.equal(worldBlocked(w,2,1024,880),false);
});
test('closed dungeon gate stops movement, dashes, projectiles and attacks until solved',()=>{
 const w=createWorld(),p=addPlayer(w,'a');Object.assign(p,{map:2,x:1024,y:950,facingX:0,facingY:-1});
 assert.equal(lineOfSight(w,2,p,{x:1024,y:800}),false);moveInWorld(w,p,0,-300);assert.ok(p.y>=917);
 assert.ok(worldBlocked(w,2,200,880));assert.ok(worldBlocked(w,2,1900,880));
 const target=w.enemies.find(e=>e.type==='warden');w.enemies=[target];Object.assign(target,{x:1024,y:800});const hp=target.hp;
 attack(w,p,'ranged');for(let i=0;i<80;i++)tick(w,{});assert.equal(target.hp,hp);assert.equal(w.projectiles.length,0);
 tick(w,{a:{dash:true,up:true}});for(let i=0;i<20;i++)tick(w,{});assert.ok(p.y>=917);
 w.puzzle={progress:3,solved:true};moveInWorld(w,p,0,-300);assert.ok(p.y<880);
});
test('all six weapons have distinct timing/range, Q costs energy and F damages at range',()=>{
 for(const [key,weapon] of Object.entries(WEAPONS)){
  const w=createWorld(),p=addPlayer(w,'a',weapon.class);w.enemies=[];equip(w,p,'weapon',key);
  assert.ok(attack(w,p));assert.equal(p.attackCd,weapon.cooldown);p.attackCd=0;
  assert.ok(attack(w,p,'special'));assert.equal(p.energy,70);assert.equal(p.specialCd,4);p.attackCd=0;assert.equal(attack(w,p,'special'),false);
  p.energy=39;assert.equal(attack(w,p,'ranged'),false);p.energy=100;assert.ok(attack(w,p,'ranged'));assert.equal(p.energy,60);assert.equal(w.projectiles.length,1);
 }
 const w=createWorld(),p=addPlayer(w,'a');Object.assign(p,{x:1000,y:650,facingX:0,facingY:-1});const e=w.enemies[0];w.enemies=[e];Object.assign(e,{x:1000,y:450,homeX:1000,homeY:450,speed:0});const hp=e.hp;attack(w,p,'ranged');for(let i=0;i<35;i++)tick(w,{});assert.ok(e.hp<hp);
});
test('armor is class-specific, unlocks through progress, reduces damage and persists per player',()=>{
 const w=createWorld(),p=addPlayer(w,'a'),witch=addPlayer(w,'b','witch');
 assert.throws(()=>equip(w,p,'helmet',1),/bloqueada/);assert.throws(()=>equip(w,p,'weapon','wand'),/incompatível/);
 for(const e of w.enemies.filter(e=>e.map===0))e.hp=0;equip(w,p,'helmet',1);assert.equal(equipmentStats(p).defense,3);
 w.enemies.find(e=>e.type==='malenio').hp=0;for(const slot of Object.keys(SLOTS))equip(w,p,slot,2);assert.equal(equipmentStats(p).defense,25);assert.equal(equipmentStats(witch).defense,0);
 const e=w.enemies.find(e=>e.type==='seer');Object.assign(p,{map:1,x:1000,y:1200,invuln:0});Object.assign(e,{x:1000,y:1150,state:'windup',timer:0,aimX:1000,aimY:1200,damage:40});w.enemies=w.enemies.filter(x=>x.hp===0||x===e);tick(w,{},.01);assert.equal(p.hp,70);
 const loaded=decodeSave(encodeSave(w,'a'));assert.deepEqual(loaded.players.solo.equipment,p.equipment);
});
test('third map, armor, puzzle and final victory round-trip solo and cooperative saves; old rooms expand',()=>{
 const hash=hashToken('x'.repeat(32)),room=newRoom(hash),p=joinProfile(room,'a',hash,'witch','Viajante');
 room.world.enemies.find(e=>e.type==='malenio').hp=0;room.world.enemies.find(e=>e.type==='warden').hp=0;room.world.puzzle={progress:3,solved:true};room.world.campfires[2]=true;Object.assign(p,{map:2,x:1024,y:1200,checkpointMap:2});equip(room.world,p,'weapon','tome');equip(room.world,p,'gloves',2);
 const solo=decodeSave(encodeSave(room.world,'a'));assert.equal(solo.won,false);assert.equal(solo.players.solo.map,2);assert.equal(solo.players.solo.checkpointMap,2);
 const saved=captureRoom(room,'TEST'),restored=restoreRoom(saved);assert.equal(restored.world.won,false);assert.deepEqual(restored.profiles[hash].equipment,p.equipment);assert.equal(restored.world.campfires[2],true);
 const legacy=structuredClone(saved);legacy.version=1;legacy.enemies=legacy.enemies.slice(0,6);delete legacy.puzzle;delete legacy.profiles[hash].equipment;legacy.profiles[hash].map=1;const migrated=restoreRoom(legacy);assert.equal(migrated.world.enemies.length,26);assert.equal(migrated.world.enemies.find(e=>e.type==='malenio').hp,0);assert.equal(migrated.world.enemies.find(e=>e.type==='warden').hp,520);assert.equal(migrated.world.won,false);
});
