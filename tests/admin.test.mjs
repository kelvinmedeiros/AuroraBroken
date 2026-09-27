import test from 'node:test';
import {DEFAULT_SETTINGS} from '../client/settings.mjs';
import http from 'node:http';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
test('admin API protects writes, rejects stale revisions, persists configuration and reloads after restart',async t=>{
 const dir=mkdtempSync(path.join(tmpdir(),'aurora-admin-'));let processHandle;
 async function boot(){processHandle=spawn(process.execPath,[fileURLToPath(new URL('../api/server.js',import.meta.url))],{env:{...process.env,PORT:'0',HOST:'127.0.0.1',SETTINGS_DIR:dir,SAVE_DIR:path.join(dir,'saves')},windowsHide:true,stdio:['ignore','pipe','pipe']});return await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Timeout')),5000);processHandle.stdout.on('data',d=>{const match=String(d).match(/http:\/\/localhost:\d+/);if(match){clearTimeout(timer);resolve(match[0]);}});processHandle.once('error',reject);});}
 const legacy=structuredClone(DEFAULT_SETTINGS);legacy.version=1;legacy.maps[0].obstacles=[];legacy.tuning.playerSpeed=230;writeFileSync(path.join(dir,'world-settings.json'),JSON.stringify(legacy));
 t.after(()=>processHandle?.kill());let url=await boot();let session=await (await fetch(url+'/api/admin/session')).json();assert.ok(session.token);assert.equal(session.settings.version,4);assert.equal(session.settings.tuning.playerSpeed,230);assert.ok(session.settings.maps[0].obstacles.length>0);assert.ok(existsSync(path.join(dir,'world-settings.json.before-layers.bak')));
 const next=structuredClone(session.settings);next.enemies.hollow.damage=7;
 const post=(data,headers={})=>fetch(url+'/api/admin/settings',{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(data)});
 assert.equal((await post(next)).status,403);assert.equal((await post(next,{'x-admin-token':session.token,origin:'https://example.com'})).status,403);
 const deniedHost=await new Promise((resolve,reject)=>{http.get(url+'/api/admin/session',{headers:{host:'remote.example'}},r=>{r.resume();resolve(r.statusCode);}).on('error',reject);});assert.equal(deniedHost,403);
 const saved=await post(next,{'x-admin-token':session.token});assert.equal(saved.status,200);const config=await saved.json();assert.equal(config.enemies.hollow.damage,7);
 assert.equal((await post(next,{'x-admin-token':session.token})).status,409);
 assert.equal(JSON.parse(readFileSync(path.join(dir,'world-settings.json'),'utf8')).enemies.hollow.damage,7);
 await new Promise(resolve=>{processHandle.once('exit',resolve);processHandle.kill();});url=await boot();assert.equal((await (await fetch(url+'/api/settings')).json()).enemies.hollow.damage,7);
});
