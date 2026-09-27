import {migrateStorage} from './storage-migration.mjs';
import {SAVE_KEY,decodeSave,encodeSave} from './save.mjs';
export const LIBRARY_KEY='aurorabroken-save-library-v2';
export const newId=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
export function readLibrary(storage){
 migrateStorage(storage);
 let entries=[];
 try{const raw=JSON.parse(storage.getItem(LIBRARY_KEY)||'[]');if(Array.isArray(raw))entries=raw.filter(e=>e&&typeof e.id==='string'&&typeof e.name==='string'&&typeof e.updatedAt==='string'&&typeof e.data==='string'&&decodeSave(e.data));}catch{}
 if(!entries.length){const legacy=storage.getItem(SAVE_KEY);if(decodeSave(legacy))entries=[{id:'legacy',name:'Jornada original',updatedAt:new Date().toISOString(),data:legacy}];}
 return entries;
}
export function putSave(storage,id,name,world,playerId){
 const entries=readLibrary(storage),entry={id,name:String(name||'Jornada').slice(0,60),updatedAt:new Date().toISOString(),data:encodeSave(world,playerId)};
 const index=entries.findIndex(e=>e.id===id);if(index<0)entries.push(entry);else entries[index]=entry;
 storage.setItem(LIBRARY_KEY,JSON.stringify(entries));return entry;
}
export function exportSolo(entry){return JSON.stringify({...JSON.parse(entry.data),kind:'solo',name:entry.name,updatedAt:entry.updatedAt},null,2);}
export function importSolo(storage,text){
 const parsed=JSON.parse(text);if(parsed.kind&&parsed.kind!=='solo')throw new Error('Este arquivo é multiplayer. Entre na sala e use Restaurar sala.');
 const world=decodeSave(text);if(!world)throw new Error('Arquivo de save inválido ou versão incompatível.');
 return putSave(storage,newId(),typeof parsed.name==='string'?parsed.name:'Jornada importada',world,'solo');
}
