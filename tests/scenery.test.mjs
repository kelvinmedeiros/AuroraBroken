import test from 'node:test';
import assert from 'node:assert/strict';
import {SCENERY,depthOrder,propBounds} from '../client/scenery.mjs';
import {blocked,move} from '../client/world.mjs';
import {migrateStorage} from '../client/storage-migration.mjs';
test('canopy allows passage behind while trunk blocks; depth order flips at ground anchor',()=>{
 const tree=SCENERY[0].find(p=>p.x===1250),actor={map:0,x:1150,y:1500};
 move(actor,200,0);assert.ok(Math.abs(actor.x-1350)<.001);assert.equal(blocked(0,1250,1580),true);
 assert.equal(depthOrder([{id:'actor',y:1500},tree])[1].id,tree.id);
 assert.equal(depthOrder([{id:'actor',y:1620},tree])[1].id,'actor');
 const bounds=propBounds(tree,{width:1222,height:1287});assert.ok(bounds.y<1500);assert.ok(bounds.x<1250&&bounds.x+bounds.width>1250);
});
test('brand migration preserves browser saves and multiplayer identities without deleting originals',()=>{
 const values=new Map([['kelvingame-save-library-v2','saved campaign'],['kelvingame-profile:TEST:player','identity']]);
 const storage={get length(){return values.size;},key:i=>Array.from(values.keys())[i],getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
 migrateStorage(storage);assert.equal(values.get('aurorabroken-save-library-v2'),'saved campaign');assert.equal(values.get('aurorabroken-profile:TEST:player'),'identity');assert.equal(values.get('kelvingame-save-library-v2'),'saved campaign');
 values.set('aurorabroken-save-library-v2','newer');migrateStorage(storage);assert.equal(values.get('aurorabroken-save-library-v2'),'newer');
});


test('migration merges a newer save from an old open tab while preserving new campaigns',()=>{
 const old=JSON.stringify([{id:'shared',updatedAt:'2026-09-27',data:'latest'}]);
 const current=JSON.stringify([{id:'shared',updatedAt:'2026-09-26',data:'earlier'},{id:'new',updatedAt:'2026-09-27',data:'new campaign'}]);
 const values=new Map([['kelvingame-save-library-v2',old],['aurorabroken-save-library-v2',current]]);
 migrateStorage({getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)});
 const merged=JSON.parse(values.get('aurorabroken-save-library-v2'));
 assert.equal(merged.length,2);assert.equal(merged.find(e=>e.id==='shared').data,'latest');assert.equal(merged.find(e=>e.id==='new').data,'new campaign');
});
