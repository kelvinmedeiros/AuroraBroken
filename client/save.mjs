import {normalizeGear,unlockTier,SLOTS} from './equipment.mjs';
import {createWorld,addPlayer} from './engine.mjs';
import {MAPS,safePoint} from './world.mjs';
export const SAVE_KEY='aurorabroken-sol-partido-v1';
export function encodeSave(world,id){
 const p=world.players[id];
 return JSON.stringify({version:2,player:{character:p.character,map:p.map,x:p.x,y:p.y,hp:p.hp,kills:p.kills,checkpointMap:p.checkpointMap,equipment:p.equipment,energy:p.energy},campfires:world.campfires,puzzle:world.puzzle,enemies:world.enemies.map(e=>({id:e.id,hp:e.hp}))});
}
export function decodeSave(raw){
 try{
  const data=JSON.parse(raw);if(![1,2].includes(data?.version)||!data.player||!Array.isArray(data.enemies))return null;
  const w=createWorld(),p=addPlayer(w,'solo',data.player.character),saved=data.player;
  p.map=Number.isInteger(saved.map)&&MAPS[saved.map]?saved.map:0;
  w.campfires=MAPS.map((_,i)=>data.campfires?.[i]===true);p.checkpointMap=Number.isInteger(saved.checkpointMap)&&MAPS[saved.checkpointMap]?saved.checkpointMap:0;
  w.puzzle={solved:data.puzzle?.solved===true,progress:data.puzzle?.solved===true?3:Math.max(0,Math.min(2,Math.floor(Number(data.puzzle?.progress)||0)))};
  const valid=Number.isFinite(saved.x)&&Number.isFinite(saved.y);
  Object.assign(p,safePoint(p.map,valid?saved:MAPS[p.map].camp));
  // safePoint returns only coordinates for save data, never trusted player fields.
  p.id='solo';p.character=saved.character==='witch'?'witch':'warrior';
  p.hp=Number.isFinite(saved.hp)?Math.max(0,Math.min(100,saved.hp)):100;
  p.kills=Number.isFinite(saved.kills)?Math.max(0,Math.floor(saved.kills)):0;
  for(const e of w.enemies){const item=data.enemies.find(a=>a?.id===e.id);if(Number.isFinite(item?.hp)){e.hp=Math.max(0,Math.min(e.maxHp,item.hp));if(e.hp===0)e.state='dead';}}
  p.equipment=normalizeGear(p.character,saved.equipment);for(const slot of Object.keys(SLOTS))p.equipment[slot]=Math.min(p.equipment[slot],unlockTier(w));p.energy=Number.isFinite(saved.energy)?Math.max(0,Math.min(100,saved.energy)):100;
  if(p.map===2&&!w.puzzle.solved&&p.y<930)Object.assign(p,MAPS[2].spawn);
  w.won=w.puzzle.solved&&w.enemies.find(e=>e.type==='warden').hp===0;
  p.message='Sua brasa foi preservada. A jornada continua.';p.messageTime=4;
  return w;
 }catch{return null;}
}
