import test from 'node:test';
import assert from 'node:assert/strict';
import {pickCollision,nearestEdge} from '../client/editor-geometry.mjs';
import {createStageTest} from '../client/stage-test.mjs';
import {interact,tick,STEP} from '../client/engine.mjs';
import {MAPS,portalsOf} from '../client/world.mjs';
const objects=[{points:[[0,0],[100,0],[100,100],[0,100]]},{points:[[20,20],[80,20],[80,80],[20,80]]}];
test('editor selects nearest vertex and outside edge, cycles overlapping polygons',()=>{
 assert.equal(pickCollision(objects,[21,21],5).vertex,0);assert.equal(pickCollision(objects,[21,21],5).object,1);
 assert.equal(pickCollision(objects,[50,-3],5).object,0);assert.equal(pickCollision(objects,[500,500],5),null);
 const a=pickCollision(objects,[50,50],5);const b=pickCollision(objects,[50,50],5,a.object,true);assert.notEqual(a.object,b.object);
 assert.deepEqual(nearestEdge([40,-5],objects[0].points).point,[40,0]);
});
test('each isolated stage starts and respawns in that stage without portal travel',()=>{
 for(const m of MAPS){const w=createStageTest(m.id,'witch'),p=w.players.solo;assert.equal(p.map,m.id);assert.equal(p.character,'witch');assert.equal(p.checkpointMap,m.id);assert.equal(w.enemies.filter(e=>e.map===m.id&&e.hp>0).length,w.enemies.filter(e=>e.map===m.id).length);
 for(const portal of portalsOf(m.id)){Object.assign(p,{x:portal.x,y:portal.y,portalCd:0});interact(w,p);assert.equal(p.map,m.id);}
 p.hp=0;tick(w,{solo:{respawn:true}},STEP);assert.equal(p.map,m.id);assert.equal(p.hp,100);
 if(m.id===2)assert.equal(w.puzzle.solved,false);
 }assert.throws(()=>createStageTest(99));
});
