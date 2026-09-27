import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {randomBytes} from 'node:crypto';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const {io}=createRequire(import.meta.url)('../client/node_modules/socket.io-client');
const request=(s,event,data={})=>new Promise((resolve,reject)=>s.timeout(3000).emit(event,data,(error,result)=>error?reject(error):resolve(result)));
test('multiplayer file import permissions, server restart and same-player resume',async t=>{
 const saveDir=mkdtempSync(path.join(tmpdir(),'aurorabroken-restart-')),sockets=[];let server;
 async function stop(){if(!server||server.exitCode!==null)return;const stopped=new Promise(resolve=>server.once('exit',resolve));server.kill();await stopped;}
 t.after(async()=>{sockets.forEach(s=>s.disconnect());await stop();});
 async function boot(){
  server=spawn(process.execPath,[fileURLToPath(new URL('../api/server.js',import.meta.url))],{env:{...process.env,PORT:'0',HOST:'127.0.0.1',SAVE_DIR:saveDir,SETTINGS_DIR:path.join(saveDir,"config")},windowsHide:true,stdio:['ignore','pipe','pipe']});
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('startup timeout')),5000);server.stdout.on('data',data=>{const url=String(data).match(/http:\/\/localhost:\d+/)?.[0];if(url){clearTimeout(timer);resolve(url);}});server.once('error',reject);});
 }
 let url=await boot();const token=randomBytes(32).toString('hex');
 async function join(key){const s=io(url,{autoConnect:false,reconnection:false});sockets.push(s);await new Promise((resolve,reject)=>{s.once('connect',resolve);s.once('connect_error',reject);s.connect();});return {s,result:await request(s,'join',{room:'RESTORE',character:'warrior',name:'Teste',token:key})};}
 const a=await join(token),b=await join(randomBytes(32).toString('hex'));
 assert.equal(a.result.host,true);assert.equal(b.result.host,false);
 const saved=(await request(a.s,'exportRoom')).data;saved.enemies[0].hp=0;saved.profiles[saved.hostHash].hp=57;saved.profiles[saved.hostHash].character='witch';
 assert.match((await request(b.s,'importRoom',saved)).error,/criador/);
 assert.match((await request(a.s,'importRoom',saved)).error,/sair/);
 const departed=b.s.id;b.s.disconnect();
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('disconnect timeout')),3000);const onState=w=>{if(!w.players[departed]){clearTimeout(timer);a.s.off('state',onState);resolve();}};a.s.on('state',onState);});
 assert.equal((await request(a.s,'importRoom',saved)).ok,true);
 const snapshot=(await request(a.s,'saveRoom')).data;assert.equal(snapshot.enemies[0].hp,0);assert.equal(snapshot.profiles[snapshot.hostHash].hp,57);
 await stop();url=await boot();const resumed=await join(token);
 assert.equal(resumed.result.host,true);assert.equal(resumed.result.world.players[resumed.s.id].hp,57);assert.equal(resumed.result.world.players[resumed.s.id].character,'witch');assert.equal(resumed.result.world.enemies[0].hp,0);
 assert.match((await join(token)).result.error,/já está conectado/);
 const bad={...saved,enemies:[]};assert.match((await request(resumed.s,'importRoom',bad)).error,/incompleta/);
 assert.equal((await request(resumed.s,'exportRoom')).data.enemies[0].hp,0);
});
