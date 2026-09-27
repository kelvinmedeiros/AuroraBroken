import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_SETTINGS,applySettings,getSettings,refreshWorldSettings} from '../client/settings.mjs';
import {MAPS} from '../client/world.mjs';
import {createWorld,addPlayer,interact,respawn} from '../client/engine.mjs';
import {encodeSave,decodeSave} from '../client/save.mjs';
import {newRoom,joinProfile,captureRoom,restoreRoom,hashToken} from '../api/room-store.mjs';
test('bonfires light once, persist in solo and multiplayer, and set respawn map',()=>{
 const w=createWorld(),p=addPlayer(w,'solo');p.portalCd=0;assert.deepEqual(w.campfires,[false,false,false,false,false,false]);
 assert.equal(interact(w,p),true);assert.equal(w.campfires[0],true);const effects=w.effects.length;p.healCd=0;interact(w,p);assert.equal(w.effects.length,effects);
 p.map=1;Object.assign(p,MAPS[1].camp);p.healCd=0;interact(w,p);assert.equal(p.checkpointMap,1);
 const restored=decodeSave(encodeSave(w,'solo'));assert.deepEqual(restored.campfires,[true,true,false,false,false,false]);restored.players.solo.hp=0;restored.players.solo.map=0;respawn(restored,restored.players.solo);assert.equal(restored.players.solo.map,1);
 const hash=hashToken('a'.repeat(32)),room=newRoom(hash);joinProfile(room,'a',hash,'warrior','Teste');room.world.campfires=[true,true];room.world.players.a.checkpointMap=1;
 const back=restoreRoom(captureRoom(room,'TEST'));assert.deepEqual(back.world.campfires,[true,true,false,false,false,false]);assert.equal(back.profiles[hash].checkpointMap,1);
});
test('settings reject invalid geometry, unsafe spawns and invalid difficulty without partial mutation',()=>{
 const original=getSettings();for(const mutate of [s=>s.enemies.hollow.hp=-1,s=>s.maps[0].obstacles.push({name:'Bloqueio',points:[[1000,1450],[1200,1450],[1200,1550],[1000,1550]]}),s=>s.maps[0].obstacles.push({name:'Cruzado',points:[[500,500],[600,600],[500,600],[600,500]]})]){const s=structuredClone(original);mutate(s);assert.throws(()=>applySettings(s));assert.deepEqual(getSettings(),original);}
});
test('live difficulty changes preserve defeated enemies and remaining health ratio',()=>{
 const w=createWorld();w.enemies[0].hp=0;w.enemies[1].hp=w.enemies[1].maxHp/2;const config=structuredClone(DEFAULT_SETTINGS);config.enemies.hollow.hp=200;applySettings(config);refreshWorldSettings(w);assert.equal(w.enemies[0].hp,0);assert.equal(w.enemies[1].hp,100);assert.equal(w.enemies[1].maxHp,200);applySettings(DEFAULT_SETTINGS);
});
