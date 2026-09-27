import {progressRecord} from '../client/progression.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createWorld,addPlayer} from '../client/engine.mjs';
import {decodeSave} from '../client/save.mjs';
import {ENEMY_SPAWNS,MAPS,safePoint} from '../client/world.mjs';
export const hashToken=token=>createHash('sha256').update(token).digest('hex');
export function playerRecord(p){return {...progressRecord(p),maxHp:p.maxHp,character:p.character,map:p.map,x:p.x,y:p.y,hp:p.hp,kills:p.kills,checkpointMap:p.checkpointMap,equipment:p.equipment,energy:p.energy,name:String(p.name||'Viajante').slice(0,24)};}
export function captureRoom(room,key){
 for(const [id,hash] of Object.entries(room.identities))if(room.world.players[id])room.profiles[hash]=playerRecord(room.world.players[id]);
 return {version:4,cycle:room.world.cycle,seed:room.world.seed,lootSerial:room.world.lootSerial,brokenCrates:room.world.crates.filter(c=>c.broken).map(c=>c.id),kind:'multiplayer',room:key,updatedAt:new Date().toISOString(),hostHash:room.hostHash,profiles:room.profiles,campfires:room.world.campfires,puzzle:room.world.puzzle,enemies:room.world.enemies.map(e=>({id:e.id,hp:e.hp}))};
}
export function restoreRoom(data){
 if(!data||![1,2,3,4].includes(data.version)||data.kind!=='multiplayer'||!Array.isArray(data.enemies)||!data.profiles||typeof data.profiles!=='object'||Array.isArray(data.profiles)||Object.keys(data.profiles).length>256||typeof data.hostHash!=='string'||!/^[a-f0-9]{64}$/.test(data.hostHash))throw new Error('Save multiplayer inválido.');
 const expected=data.version===1?ENEMY_SPAWNS.filter(e=>e.map<2):data.version===2?ENEMY_SPAWNS.filter(e=>e.map<3):ENEMY_SPAWNS;
 if(data.enemies.length!==expected.length||new Set(data.enemies.map(e=>e?.id)).size!==expected.length||!expected.every(e=>data.enemies.some(item=>item?.id===e.id&&Number.isFinite(item.hp))))throw new Error('Lista de inimigos incompleta no save.');
 const base=decodeSave(JSON.stringify({...data,version:4,player:{},campfires:data.campfires,puzzle:data.puzzle,enemies:data.enemies}));if(!base)throw new Error('Save multiplayer inválido.');
 base.players={};const profiles=Object.create(null);
 for(const [hash,p] of Object.entries(data.profiles)){
  if(!/^[a-f0-9]{64}$/.test(hash)||!p||typeof p!=='object')throw new Error('Perfil inválido no save.');
  const recovered=decodeSave(JSON.stringify({...data,version:4,player:p,campfires:data.campfires,puzzle:data.puzzle,enemies:data.enemies}));
  profiles[hash]=playerRecord({...recovered.players.solo,name:typeof p.name==='string'?p.name:'Viajante'});
 }
 return {world:base,profiles,hostHash:data.hostHash,identities:{},inputs:{},lastInput:{},lastSaved:data.updatedAt||null};
}
export function newRoom(hostHash){return {world:createWorld(),profiles:Object.create(null),hostHash,identities:{},inputs:{},lastInput:{},lastSaved:null};}
export function joinProfile(room,id,hash,character,name){
 const player=addPlayer(room.world,id,character),record=room.profiles[hash];
 if(record)Object.assign(player,record);if(player.campaignCycle!==room.world.cycle){player.campaignCycle=room.world.cycle;player.map=0;player.checkpointMap=0;player.bloodstain=null;player.bossClaims=[];player.hp=player.maxHp;Object.assign(player,safePoint(0,MAPS[0].camp));}player.name=name;room.identities[id]=hash;return player;
}
export class RoomStore{
 constructor(directory){this.directory=directory;fs.mkdirSync(directory,{recursive:true});}
 filename(key){if(!/^[A-Z0-9-]{1,20}$/.test(key))throw new Error('Sala inválida.');return path.join(this.directory,key+'.json');}
 load(key){
  const filename=this.filename(key);if(!fs.existsSync(filename))return null;
  try{return restoreRoom(JSON.parse(fs.readFileSync(filename,'utf8')));}catch{
   try{const room=restoreRoom(JSON.parse(fs.readFileSync(filename+'.bak','utf8')));room.recoveredBackup=true;return room;}catch{throw new Error('O save desta sala está corrompido. Preserve os arquivos e restaure um backup em outra sala.');}
  }
 }
 archive(key,room){
  this.filename(key);const directory=path.join(this.directory,'backups');fs.mkdirSync(directory,{recursive:true});
  const filename=path.join(directory,key+'-antes-importacao-'+Date.now()+'.json');
  fs.writeFileSync(filename,JSON.stringify(captureRoom(room,key),null,2),{encoding:'utf8',mode:0o600});return filename;
 }
 save(key,room){
  const filename=this.filename(key),data=captureRoom(room,key),text=JSON.stringify(data,null,2);
  fs.writeFileSync(filename+'.tmp',text,{encoding:'utf8',mode:0o600});
  // Keep the last valid copy; do not replace a recovered backup with corruption.
  if(fs.existsSync(filename)&&!room.recoveredBackup)fs.copyFileSync(filename,filename+'.bak');
  fs.renameSync(filename+'.tmp',filename);room.recoveredBackup=false;room.lastSaved=data.updatedAt;return data;
 }
}
