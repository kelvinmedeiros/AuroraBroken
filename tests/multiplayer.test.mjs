import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
const require=createRequire(import.meta.url);
const {io}=require('../client/node_modules/socket.io-client');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function nextState(socket,predicate=()=>true){return new Promise((resolve,reject)=>{
 const timer=setTimeout(()=>{socket.off('state',listener);reject(new Error('State timeout'));},3000);
 const listener=state=>{if(predicate(state)){clearTimeout(timer);socket.off('state',listener);resolve(state);}};
 socket.on('state',listener);
});}
test('real server: room isolation, shared state, validated inputs, stale input, capacity and disconnect cleanup',async t=>{
 const saveDir=mkdtempSync(path.join(tmpdir(),'aurorabroken-test-'));
 const server=spawn(process.execPath,[fileURLToPath(new URL('../api/server.js',import.meta.url))],{env:{...process.env,PORT:'0',HOST:'127.0.0.1',SAVE_DIR:saveDir,SETTINGS_DIR:path.join(saveDir,"config")},windowsHide:true,stdio:['ignore','pipe','pipe']});
 const sockets=[];t.after(()=>{sockets.forEach(s=>s.disconnect());server.kill();});
 const url=await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error('Server startup timeout')),5000);
  server.stdout.on('data',data=>{const match=String(data).match(/http:\/\/localhost:\d+/);if(match){clearTimeout(timer);resolve(match[0]);}});
  server.on('error',reject);server.stderr.on('data',d=>{clearTimeout(timer);reject(new Error(String(d)));});
 });
 async function connect(room,character='warrior'){
  const s=io(url,{autoConnect:false,reconnection:false});sockets.push(s);
  await new Promise((resolve,reject)=>{s.once('connect',resolve);s.once('connect_error',reject);s.connect();});
  const response=await new Promise(resolve=>s.emit('join',{room,character,name:'Teste',token:randomBytes(32).toString('hex')},resolve));return {s,response};
 }
 const a=await connect('TEST'),b=await connect('TEST','witch'),other=await connect('OTHER');
 const shared=await nextState(a.s,w=>Object.keys(w.players).length===2);
 assert.equal(shared.players[b.s.id].character,'witch');
 const isolated=await nextState(other.s);assert.equal(Object.keys(isolated.players).length,1);
 assert.deepEqual((await nextState(b.s)).enemies,shared.enemies);
 const equipRequest=(socket,slot,value)=>new Promise(resolve=>socket.emit('equip',{slot,value},resolve));
 assert.equal((await equipRequest(a.s,'weapon','spear')).equipment.weapon,'spear');
 assert.match((await equipRequest(a.s,'weapon','tome')).error,/incompatível/);
 assert.match((await equipRequest(b.s,'helmet',2)).error,/bloqueada/);
 const equipped=await nextState(b.s,w=>w.players[a.s.id].equipment.weapon==='spear');assert.equal(equipped.players[b.s.id].equipment.weapon,'staff');
 a.s.emit('input',{ranged:true});const shot=await nextState(b.s,w=>w.projectiles.length>0);assert.equal(shot.projectiles[0].owner,a.s.id);a.s.emit('input',{});
 // A client's invented position/HP never becomes authoritative state.
 a.s.emit('input',{x:999999,y:NaN,hp:9999,map:1,right:'true'});
 await wait(70);let state=await nextState(a.s);assert.equal(state.players[a.s.id].map,0);assert.equal(state.players[a.s.id].hp,100);assert.equal(state.players[a.s.id].x,1040);
 a.s.emit('input',{right:true});state=await nextState(b.s,w=>w.players[a.s.id].x>1040);assert.ok(state.players[a.s.id].moving);
 await wait(400);const stopped=await nextState(a.s);await wait(100);state=await nextState(a.s);
 assert.equal(state.players[a.s.id].x,stopped.players[a.s.id].x);assert.equal(state.players[a.s.id].moving,false);
 await connect('TEST');await connect('TEST');assert.match((await connect('TEST')).response.error,/cheia/);
 const bId=b.s.id;b.s.disconnect();state=await nextState(a.s,w=>!w.players[bId]);assert.equal(Object.keys(state.players).length,3);
 assert.match((await connect('../invalid')).response.error,/sala/);
 assert.equal((await fetch(url+'/health')).status,200);
 const html=await (await fetch(url)).text();assert.ok(!html.includes('<script src="http://localhost'));
});
