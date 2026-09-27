import {ATTRIBUTES,RARITIES,level,levelCost,maxEnergy} from './progression.mjs';
import {createStageTest} from './stage-test.mjs';
import {t,setText,locale,readLanguage,setLanguage,bindLanguageUI} from './i18n.mjs';
import {drawTerrain,inLava} from './terrain.mjs';
import {portalLocked} from './world.mjs';
import {titanAttackArea} from './engine.mjs';
import {SLOTS,WEAPONS,ARMOR_SETS,normalizeGear,equipmentStats,unlockTier,equip} from './equipment.mjs';
import {migrateStorage} from './storage-migration.mjs';
import {PROP_TYPES,drawProp,depthOrder} from './scenery.mjs';
import {MAPS,SIZE,ENEMY_TYPES,RADIUS,safePoint,portalsOf,RUNES,RUNE_ORDER,INSCRIPTION,GATE} from './world.mjs';
import {createWorld,addPlayer,tick,objective,STEP,playerAction} from './engine.mjs';
import {applySettings,refreshWorldSettings,getSettings} from './settings.mjs';
import {decodeSave,encodeSave} from './save.mjs';
import {newId,readLibrary,putSave,exportSolo,importSolo,LIBRARY_KEY} from './save-library.mjs';
// Replaced at build time; direct server development keeps both modes enabled.

const $=id=>document.getElementById(id),canvas=$('gameCanvas'),ctx=canvas.getContext('2d');
let width=innerWidth,height=innerHeight,dpr=1,world=null,id='solo',mode='solo',character='warrior',socket=null;
let input={},mapOpen=false,debug=false,victorySeen=false,accumulator=0,last=performance.now(),lastSend=0,lastSave=0,lastHud=0,onlineError='',joining=false;
const assets={};
let stageTest=null;
if(typeof __PAGES__==='undefined'){const key=new URLSearchParams(location.search).get('testSession');if(key?.startsWith('aurora-admin-test-')){try{stageTest=JSON.parse(localStorage.getItem(key));if(!Number.isInteger(stageTest?.map)||!MAPS[stageTest.map])stageTest=null;}catch{stageTest=null;}}}
const languageStorage=(()=>{try{return localStorage;}catch{return null;}})();
const applyLanguage=bindLanguageUI(document,languageStorage);applyLanguage();
if(!(typeof __PAGES__==='undefined')){for(const el of document.querySelectorAll('[data-server-only]'))el.hidden=true;document.querySelector('input[value=online]').disabled=true;}
$('language').value=readLanguage(languageStorage);
$('language').onchange=()=>{setLanguage($('language').value,languageStorage);applyLanguage();refreshSaveList();if(world)updateHud();};
let activeSlot='',activeName='',isRoomHost=false,roomSavedAt='',roomSaveError='';
function resize(){width=innerWidth;height=innerHeight;dpr=Math.min(devicePixelRatio||1,2);canvas.width=width*dpr;canvas.height=height*dpr;}
resize();addEventListener('resize',resize);
async function loadImage(name,file){const img=new Image();img.src='sprites/'+file;await img.decode();assets[name]=img;}
function library(){try{return readLibrary(localStorage).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));}catch{return [];}}
function selectedSave(){const entries=library();return entries.find(e=>e.id===$('saveList').value)||entries[0];}
function savedWorld(){const entry=selectedSave();return entry?decodeSave(entry.data):null;}
function save(){
 if(stageTest||mode!=='solo'||!world||!activeSlot)return false;
 try{putSave(localStorage,activeSlot,activeName,world,id);setText($('saveStatus'),'Salvo · '+activeName);return true;}
 catch{setText($('saveStatus'),'Falha no armazenamento. Exporte seu save.');return false;}
}
function modalOpen(){return ['journal','victory','saves','equipment','bonfire'].some(x=>$(x).open);}
function inputAllowed(){return world&&$('menu').hidden&&!modalOpen()&&document.visibilityState==='visible';}
function clearInput(){input={};if(socket?.connected)socket.emit('input',{});}
function closeDialogs(){for(const d of document.querySelectorAll('dialog'))d.close();}
function showGame(){
 $('menu').hidden=true;$('hud').hidden=false;$('controls').hidden=false;$('resume').hidden=false;
 $('touch').hidden=!matchMedia('(pointer:coarse)').matches;clearInput();canvas.focus();last=performance.now();accumulator=0;
}
function openMenu(){save();clearInput();$('menu').hidden=false;$('resume').hidden=!world;refreshMode();}
function refreshMode(){const online=(typeof __PAGES__==='undefined')&&document.querySelector('input[name=mode]:checked').value==='online';$('roomField').hidden=!online;$('continue').hidden=online||!savedWorld();}
document.querySelectorAll('input[name=mode]').forEach(el=>el.addEventListener('change',refreshMode));
document.querySelectorAll('[data-character]').forEach(el=>el.onclick=()=>{
 character=el.dataset.character;
 document.querySelectorAll('[data-character]').forEach(b=>{b.classList.toggle('selected',b===el);b.setAttribute('aria-pressed',String(b===el));});
});
function refreshSaveList(preferred){
 const selected=preferred||$('saveList').value,entries=library();$('saveList').replaceChildren();
 for(const entry of entries){const option=document.createElement('option');option.value=entry.id;option.textContent=entry.name+' · '+new Date(entry.updatedAt).toLocaleString(locale());$('saveList').append(option);}
 if(entries.some(e=>e.id===selected))$('saveList').value=selected;
 $('saveName').value=selectedSave()?.name||'';
 for(const name of ['loadSelected','renameSave','exportSolo'])$(name).disabled=!entries.length;
}
function openSaves(){
 clearInput();refreshSaveList();setText($('saveFeedback'),'');
 setText($('activeSave'),!world?'Nenhuma partida ativa.':mode==='solo'?'Solo atual: '+activeName:'Sala atual: '+$('room').value.toUpperCase());
 $('saveNow').disabled=!world||(mode==='online'&&!socket?.connected);
 $('exportRoom').disabled=mode!=='online'||!socket?.connected;
 $('importRoom').disabled=mode!=='online'||!socket?.connected||!isRoomHost;
 setText($('roomSaveInfo'),mode==='online'?'Sala '+$('room').value.toUpperCase()+' · '+(isRoomHost?'você é o criador':'participante')+' · último save: '+(roomSavedAt?new Date(roomSavedAt).toLocaleString(locale()):'aguardando'):'Entre em uma sala para salvar ou exportar sua campanha cooperativa.');
 $('saves').showModal();
}
function roomRequest(event,data={}){return new Promise((resolve,reject)=>{
 if(!socket?.connected)return reject(new Error('Conecte-se a uma sala primeiro.'));
 socket.timeout(5000).emit(event,data,(error,result)=>error?reject(new Error('O servidor não respondeu.')):result?.error?reject(new Error(result.error)):resolve(result));
});}
const number=n=>new Intl.NumberFormat(locale(),{notation:n>=10000?'compact':'standard',maximumFractionDigits:1}).format(n);
async function progressAction(action,value){if(mode==='online'){const response=await roomRequest('progression',{action,value});world=response.world;}else playerAction(world,world.players[id],action,value);save();}
function refreshLoot(){const p=world.players[id];$('lootInventory').replaceChildren();$('lootSummary').textContent=`${p.inventory.length}/120 · ${number(p.embers)} ${t('Brasas')}`;for(const item of [...p.inventory].reverse()){const row=document.createElement('div');row.className='loot-row';const name=document.createElement('span'),equipped=Object.values(p.lootGear).includes(item.id);name.textContent=`${t(item.relic?item.name:item.slot==='weapon'?WEAPONS[item.base].name:SLOTS[item.slot])} · ${t(RARITIES[item.rarity])} · ${t('Grau')} ${number(item.rank)} · +${number(item.power*100)}% ${t('Dano')} / ${number(item.defense)}% ${t('Defesa')}${equipped?' ✓':''}`;name.style.color=['#ccc','#a2d8a0','#86cfff','#d7a0ff','#ffd06c'][item.rarity];if(item.relic)name.textContent+=' · '+t({malenio:'Poder solar +15%',warden:'Defesa adicional +10%',titan:'Dano de Q +50%'}[item.relic]);row.append(name);for(const [label,action,value] of [[equipped?'Desequipar':'Equipar',equipped?'unequipItem':'equipItem',equipped?item.slot:item.id],['Desmontar','dismantle',item.id]]){const button=document.createElement('button');setText(button,label);button.disabled=action==='dismantle'&&equipped;button.onclick=async()=>{try{await progressAction(action,value);refreshGear();}catch(e){setText($('gearFeedback'),e.message);}};row.append(button);}$('lootInventory').append(row);}}
function refreshCamp(){const p=world.players[id];$('campStats').textContent=`${t('Nível')} ${number(level(p))} · ${number(p.embers)} ${t('Brasas')} · ${t('Custo')} ${number(levelCost(p))} · ${t('Jornada')} ${world.cycle+1}`;$('attributes').replaceChildren();for(const [key,label] of Object.entries(ATTRIBUTES)){const button=document.createElement('button');button.textContent=`${t(label)} ${number(p.attributes[key])} +`;button.disabled=p.embers<levelCost(p)||key==='fortune'&&p.attributes[key]>=150||key==='vigor'&&p.attributes[key]>=134;button.onclick=async()=>{try{await progressAction('level',key);refreshCamp();}catch(e){setText($('campFeedback'),e.message);}};$('attributes').append(button);}$('nextCycle').disabled=!!stageTest||!world.won;}
$('restEnemies').onclick=async()=>{try{await progressAction('rest');setText($('campFeedback'),'Inimigos comuns renovados');refreshCamp();}catch(e){setText($('campFeedback'),e.message);}};
$('nextCycle').onclick=async()=>{try{await progressAction('cycle');victorySeen=false;$('bonfire').close();canvas.focus();}catch(e){setText($('campFeedback'),e.message);}};
$('leaveCamp').onclick=async()=>{try{await progressAction('leaveCamp');$('bonfire').close();canvas.focus();}catch(e){setText($('campFeedback'),e.message);}};
$('bonfire').addEventListener('cancel',e=>{e.preventDefault();$('leaveCamp').click();});
function refreshGear(){
 const p=world?.players[id];if(!p)return;refreshLoot();const gear=normalizeGear(p.character,p.equipment),tier=unlockTier(world),stats=equipmentStats(p);
 setText($('gearClass'),p.character==='witch'?'Feiticeira · vestes arcanas':'Guerreiro · armadura de batalha');$('gearSlots').replaceChildren();
 const names=p.character==='witch'?{helmet:'Capuz',chest:'Manto',gloves:'Luvas',legs:'Perneiras',boots:'Botas'}:{helmet:'Elmo',chest:'Peitoral',gloves:'Manoplas',legs:'Grevas',boots:'Botas'};
 for(const slot of ['weapon',...Object.keys(SLOTS)]){
  const label=document.createElement('label'),caption=document.createElement('span');setText(caption,slot==='weapon'?'Arma':names[slot]);label.append(caption);const select=document.createElement('select');select.setAttribute('aria-label',caption.textContent);
  const options=slot==='weapon'?Object.entries(WEAPONS).filter(([,w])=>w.class===p.character).map(([value,w])=>({value,text:w.name})):ARMOR_SETS[p.character].map((set,value)=>({value,text:names[slot]+' · '+set.name+(value>tier?' (bloqueado)':''),disabled:value>tier}));
  for(const item of options){const option=document.createElement('option');option.value=item.value;setText(option,item.text);option.disabled=!!item.disabled;select.append(option);}select.value=gear[slot];
  select.onchange=async()=>{try{const value=slot==='weapon'?select.value:Number(select.value);if(mode==='online'){const result=await roomRequest('equip',{slot,value});world.players[id].equipment=result.equipment;}else{equip(world,p,slot,value);save();}setText($('gearFeedback'),'Equipamento atualizado.');refreshGear();}catch(error){setText($('gearFeedback'),error.message);refreshGear();}};
  label.append(select);$('gearSlots').append(label);
 }
 setText($('gearStats'),`Dano ${Math.round(stats.weapon.damage*stats.power*(1+(p.attributes?.strength||0)*.06))} · Defesa ${stats.defense}% · Alcance ${stats.weapon.range} · Energia +${stats.regen.toFixed(1)}/s`);
 setText($('gearUnlocks'),`Q: ${stats.weapon.special}. F: projétil de energia. `+(tier===0?'Derrote os três guardiões para liberar o segundo conjunto.':tier===1?'Derrote Malênio para liberar o último conjunto.':'Todos os conjuntos estão disponíveis.'));
 const preview=$('gearPreview').getContext('2d');preview.clearRect(0,0,180,220);preview.save();preview.translate(90,195);preview.scale(2,2);drawEquipped(preview,{...p,x:0,y:0,direction:'down',facingX:0,facingY:1,moving:false},0);preview.restore();
}
function openGear(){if(!world)return;if($('equipment').open){$('equipment').close();canvas.focus();return;}clearInput();setText($('gearFeedback'),'');refreshGear();$('equipment').showModal();}
$('gearButton').onclick=openGear;$('closeGear').onclick=()=>{$('equipment').close();canvas.focus();};
function download(text,name){const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name.replace(/[^a-zA-Z0-9À-ÿ_.-]/g,'_')+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);}
function feedback(action){return async()=>{try{await action();}catch(error){setText($('saveFeedback'),error.message);}};}
$('saveButton').onclick=openSaves;$('menuSaves').onclick=openSaves;
$('closeSaves').onclick=()=>{$('saves').close();if($('menu').hidden)canvas.focus();};
$('saveList').onchange=()=>{$('saveName').value=selectedSave()?.name||'';};
$('saveNow').onclick=feedback(async()=>{
 if(mode==='online'){await roomRequest('saveRoom');setText($('saveFeedback'),'Sala salva no disco do servidor.');}
 else{if(!save())throw new Error('Não foi possível salvar neste navegador. Use Exportar solo.');refreshSaveList(activeSlot);setText($('saveFeedback'),'Campanha salva separadamente: '+activeName);}
});
$('loadSelected').onclick=()=>{document.querySelector('input[value=solo]').checked=true;start(true);};
$('renameSave').onclick=feedback(()=>{
 const entry=selectedSave(),name=$('saveName').value.trim();if(!entry||!name)throw new Error('Informe um nome para o save.');
 const entries=library();entries.find(e=>e.id===entry.id).name=name;localStorage.setItem(LIBRARY_KEY,JSON.stringify(entries));if(activeSlot===entry.id)activeName=name;refreshSaveList(entry.id);setText($('saveFeedback'),'Save renomeado.');
});
$('exportSolo').onclick=feedback(()=>{
 const entry=selectedSave();if(!entry)throw new Error('Selecione uma campanha solo.');
 if(entry.id===activeSlot&&mode==='solo'&&world)download(exportSolo({...entry,data:encodeSave(world,id)}),entry.name);
 else download(exportSolo(entry),entry.name);setText($('saveFeedback'),'Arquivo solo exportado.');
});
$('exportRoom').onclick=feedback(async()=>{const result=await roomRequest('exportRoom');download(JSON.stringify(result.data,null,2),'multiplayer-'+$('room').value.toUpperCase());setText($('saveFeedback'),'Arquivo multiplayer exportado.');});
let importKind='solo';
$('importSolo').onclick=()=>{importKind='solo';$('saveFile').value='';$('saveFile').click();};
$('importRoom').onclick=()=>{importKind='multiplayer';$('saveFile').value='';$('saveFile').click();};
$('saveFile').onchange=feedback(async()=>{
 const file=$('saveFile').files[0];if(!file)return;if(file.size>240000)throw new Error('Arquivo grande demais (máximo de 240 KB).');
 const text=await file.text();
 if(importKind==='solo'){const entry=importSolo(localStorage,text);refreshSaveList(entry.id);refreshMode();setText($('saveFeedback'),'Importado como uma campanha separada. Clique em Carregar selecionado.');}
 else{await roomRequest('importRoom',JSON.parse(text));victorySeen=false;setText($('saveFeedback'),'Sala restaurada. O save anterior foi guardado em backup.');}
});
if((typeof __PAGES__==='undefined'))fetch('/api/network').then(r=>{if(!r.ok)throw new Error();return r.json();}).then(info=>{setText($('lanInfo'),'No outro PC da mesma rede, abra: '+info.addresses.join(' ou ')+'. Use o mesmo código de sala.');}).catch(()=>{setText($('lanInfo'),'No outro PC, abra http://IP-DESTE-PC:3000. localhost funciona apenas neste computador.');});
let socketScript;
async function loadSocket(){
 if(!(typeof __PAGES__==='undefined'))return;
 if(window.io)return;
 if(!socketScript)socketScript=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='/socket.io/socket.io.js';
  script.onload=resolve;script.onerror=()=>{script.remove();socketScript=null;reject(new Error('Não foi possível carregar o modo online. O modo solo continua disponível.'));};document.head.append(script);
 });await socketScript;
}
function startStageTest(){applySettings(stageTest.settings);world=createStageTest(stageTest.map,stageTest.character,stageTest.cycle,stageTest.level,stageTest.embers,stageTest.loot);id='solo';mode='solo';activeSlot='';victorySeen=false;closeDialogs();showGame();}
async function start(continueSave=false){
 if(stageTest){startStageTest();return;}
 if(joining)return;joining=true;$('start').disabled=true;$('continue').disabled=true;setText($('menuError'),'');
 try{
  const chosen=(typeof __PAGES__==='undefined')?document.querySelector('input[name=mode]:checked').value:'solo';
  if(chosen==='online'&&!$('playerName').value.trim())throw new Error('Informe seu nome de jogador.');
  if(chosen==='online'&&!/^[A-Z0-9-]{1,20}$/.test($('room').value.trim().toUpperCase()))throw new Error('Use de 1 a 20 letras, números ou hífens no código da sala.');
  save();socket?.disconnect();socket=null;onlineError='';clearInput();closeDialogs();
  if(chosen==='solo'){
   const entry=continueSave?selectedSave():null;
   mode='solo';id='solo';world=entry?decodeSave(entry.data):createWorld();if(!world)world=createWorld();
   activeSlot=entry?.id||newId();activeName=entry?.name||(t('Jornada')+' '+new Date().toLocaleString(locale()));
   refreshSaveList(activeSlot);
   if(!world.players[id])addPlayer(world,id,character);
   victorySeen=world.won;save();refreshSaveList(activeSlot);showGame();
  }else if((typeof __PAGES__==='undefined')){
   await loadSocket();
   const room=$('room').value.trim().toUpperCase(),name=$('playerName').value.trim();
   migrateStorage(localStorage);
   const profileKey='aurorabroken-profile:'+room+':'+name.toLowerCase();
   let token=localStorage.getItem(profileKey);if(!token){token=newId()+newId();localStorage.setItem(profileKey,token);}
   const connection=window.io({autoConnect:false,reconnection:false,timeout:5000});socket=connection;
   const response=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('O servidor não respondeu. Tente novamente ou jogue solo.')),7000);
    connection.once('connect_error',()=>{clearTimeout(timer);reject(new Error('Sem conexão com a sala. O modo solo está disponível.'));});
    connection.once('connect',()=>connection.emit('join',{room,character,name,token},result=>{clearTimeout(timer);result.error?reject(new Error(result.error)):resolve(result);}));
    connection.connect();
   });
   mode='online';id=response.id;world=response.world;victorySeen=world.won;isRoomHost=response.host;roomSavedAt=response.savedAt;roomSaveError='';
   connection.on('saveStatus',status=>{roomSavedAt=status.savedAt||roomSavedAt;roomSaveError=status.error||'';});
   connection.on('state',state=>{world=state;});
   connection.on('settings',syncSettings);
   connection.on('disconnect',()=>{clearInput();onlineError='Conexão encerrada. Abra o menu para entrar novamente ou jogar solo.';});
   showGame();
  }
 }catch(error){socket?.disconnect();socket=null;if(mode==='online')onlineError='Desconectado';setText($('menuError'),error.message);}
 finally{joining=false;$('start').disabled=false;$('continue').disabled=false;}
}
$('start').onclick=()=>start(false);$('continue').onclick=()=>start(true);$('resume').onclick=()=>showGame();$('menuButton').onclick=openMenu;
$('mapButton').onclick=()=>{mapOpen=!mapOpen;canvas.focus();};
function journal(){
 if(!world)return;
 if($('journal').open){$('journal').close();canvas.focus();return;}
 clearInput();setText($('journalQuest'),objective(world));
 const lore={titan:'Asterion devorou o coração do Sol. Seus pisões atingem perto; a erupção marca seus pés; a onda solar deixa o centro seguro. Abaixo de meia vida, seus ataques ficam maiores e mais rápidos.',hollow:'Antigos vigias, presos ao último juramento. Aproximam-se e anunciam um golpe curto.',ember:'Alimentou-se da luz roubada. Sua explosão é lenta, mas alcança uma área maior.',seer:'Viu o futuro do rei e perdeu a própria sombra. Marca o chão antes de conjurar uma explosão.',shade:'Almas presas à cripta. Invocam marcas de gelo sob seus pés.',warden:'Protege a primeira brasa na câmara selada. Resolva as runas para enfrentá-lo.',malenio:'O guardião que confundiu amor com prisão. Abaixo de meia vida, entra em fúria: seus golpes ficam mais rápidos e amplos.'};
 $('bestiary').replaceChildren();for(const [type,info] of Object.entries(ENEMY_TYPES)){
  const block=document.createElement('p');block.className='bestiary-entry';const title=document.createElement('strong');setText(title,info.name);block.append(title,document.createElement('br'),document.createTextNode(t(lore[type])));$('bestiary').append(block);
 }$('journal').showModal();
}
$('journalButton').onclick=journal;document.querySelector('#journal .close').onclick=()=>{$('journal').close();canvas.focus();};
function requestRespawn(){input.respawn=true;$('death').close();canvas.focus();}
$('respawn').onclick=requestRespawn;$('explore').onclick=()=>{$('victory').close();canvas.focus();};
const keyMap={KeyW:'up',ArrowUp:'up',KeyS:'down',ArrowDown:'down',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',Space:'attack',ShiftLeft:'dash',ShiftRight:'dash',KeyE:'interact',KeyR:'respawn',KeyQ:'special',KeyF:'ranged'};
addEventListener('keydown',event=>{
 if(event.target instanceof HTMLInputElement||event.target instanceof HTMLSelectElement)return;
 if(event.code==='Escape'&&world){clearInput();if(modalOpen())return;event.preventDefault();$('menu').hidden?openMenu():showGame();return;}
 if(!$('menu').hidden||!world)return;
 if(!event.repeat&&event.code==='KeyI'){event.preventDefault();openGear();return;}
 if(!event.repeat&&event.code==='KeyJ'){event.preventDefault();journal();return;}
 if(!event.repeat&&event.code==='KeyM'){event.preventDefault();mapOpen=!mapOpen;return;}
 if(!event.repeat&&event.code==='F3'){event.preventDefault();debug=!debug;return;}
 const key=keyMap[event.code];if(!key)return;event.preventDefault();
 if(key==='respawn'&&world.players[id]?.hp<=0){requestRespawn();return;}
 if(!modalOpen())input[key]=true;
});
addEventListener('keyup',event=>{const key=keyMap[event.code];if(key&&!['interact','respawn','special','ranged'].includes(key))input[key]=false;});
addEventListener('blur',clearInput);document.addEventListener('visibilitychange',()=>{clearInput();save();last=performance.now();accumulator=0;});addEventListener('pagehide',save);
document.querySelectorAll('[data-key]').forEach(button=>{
 button.addEventListener('pointerdown',event=>{event.preventDefault();button.setPointerCapture(event.pointerId);input[button.dataset.key]=true;});
 for(const name of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(name,()=>{input[button.dataset.key]=false;});
});
function circle(x,y,r,fill,stroke){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}}
function label(text,x,y,color='#fff0cf',size=12,translate=true){if(translate)text=t(text);ctx.font=`${size}px system-ui`;ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#141911';ctx.strokeText(text,x,y);ctx.fillStyle=color;ctx.fillText(text,x,y);}
function drawSprite(image,x,y,direction,moving,time,h=82){
 const fw=image.width/9,fh=image.height/4,row={up:0,left:1,down:2,right:3}[direction]??2,frame=moving?1+Math.floor(time*10)%8:0;
 const w=h*fw/fh;ctx.drawImage(image,frame*fw,row*fh,fw,fh,x-w/2,y-h+10,w,h);
}
const armorCanvas=document.createElement('canvas'),armorContext=armorCanvas.getContext('2d');
function drawEquipped(target,p,time){
 const image=assets[p.character];if(!image)return;const fw=image.width/9,fh=image.height/4,h=82,w=h*fw/fh,row={up:0,left:1,down:2,right:3}[p.direction]??2,frame=p.moving?1+Math.floor(time*10)%8:0;
 armorCanvas.width=Math.ceil(fw);armorCanvas.height=Math.ceil(fh);armorContext.drawImage(image,frame*fw,row*fh,fw,fh,0,0,fw,fh);
 const gear=normalizeGear(p.character,p.equipment),sets=ARMOR_SETS[p.character];armorContext.globalCompositeOperation='source-atop';armorContext.globalAlpha=.48;
 for(const [slot,top,bottom] of [['helmet',0,.35],['chest',.35,.62],['legs',.62,.82],['boots',.82,1]])if(gear[slot]){armorContext.fillStyle=sets[gear[slot]].color;armorContext.fillRect(0,fh*top,fw,fh*(bottom-top));}
 if(gear.gloves){armorContext.fillStyle=sets[gear.gloves].color;armorContext.fillRect(0,fh*.42,fw*.25,fh*.3);armorContext.fillRect(fw*.75,fh*.42,fw*.25,fh*.3);}
 target.drawImage(armorCanvas,p.x-w/2,p.y-h+10,w,h);
 const weapon=WEAPONS[gear.weapon];target.save();target.translate(p.x+w*.24,p.y-25);target.rotate((p.direction==='left'?-.4:p.direction==='right'?.4:0));target.strokeStyle=weapon.color;target.fillStyle=weapon.color;target.lineWidth=3;
 if(gear.weapon==='tome'){target.fillRect(-7,-12,14,17);target.strokeStyle='#624126';target.lineWidth=1;target.beginPath();target.moveTo(0,-11);target.lineTo(0,4);target.stroke();}
 else{const length=gear.weapon==='spear'?45:gear.weapon==='wand'?19:30;target.beginPath();target.moveTo(0,7);target.lineTo(0,-length);target.stroke();if(gear.weapon==='axe'){target.beginPath();target.moveTo(0,-30);target.lineTo(13,-25);target.lineTo(13,-14);target.lineTo(0,-17);target.fill();}else if(['staff','wand'].includes(gear.weapon)){target.beginPath();target.arc(0,-length,5,0,7);target.fill();}else{target.beginPath();target.moveTo(-5,-length+7);target.lineTo(0,-length-4);target.lineTo(5,-length+7);target.fill();}}
 target.restore();
}
function drawEnemy(e,time){
 if(e.hp<=0){circle(e.x,e.y,8,'#d4b06766');return;}
 const image=assets[e.type],h={hollow:80,ember:86,seer:86,malenio:112,shade:82,warden:120,titan:420}[e.type],w=h*image.width/image.height;
 ctx.save();ctx.translate(e.x,e.y);ctx.fillStyle='#05080555';ctx.beginPath();ctx.ellipse(0,2,e.type==='malenio'?29:19,7,0,0,7);ctx.fill();
 if(e.flash>0)ctx.filter='brightness(1.8)';
 const bob=e.type==='seer'?Math.sin(time*3+e.homeX)*3:e.state==='chase'?Math.sin(time*10)*1.5:0;
 ctx.imageSmoothingEnabled=true;ctx.drawImage(image,-w/2,-h+8+bob,w,h);ctx.restore();
 const bw=e.type==='malenio'?85:55,barY=e.y-h-3;ctx.fillStyle='#151711';ctx.fillRect(e.x-bw/2,barY,bw,5);ctx.fillStyle=e.color;ctx.fillRect(e.x-bw/2,barY,bw*e.hp/e.maxHp,5);
 if(e.type!=='malenio')label(t(e.name)+(e.variant?' · '+t(e.variant):''),e.x,barY-7,e.color,10);
}
function drawMapOverlay(p){
 const s=Math.min(width-48,height-170,600),x=(width-s)/2,y=(height-s)/2;
 ctx.fillStyle='#101912ee';ctx.fillRect(x-15,y-45,s+30,s+95);ctx.drawImage(assets['map'+p.map],x,y,s,s);ctx.save();ctx.translate(x,y);ctx.scale(s/SIZE,s/SIZE);drawTerrain(ctx,p.map,world.time,assets.map2);for(const prop of depthOrder(MAPS[p.map].props))drawProp(ctx,prop,assets[prop.type]);ctx.restore();
 const project=a=>({x:x+a.x/SIZE*s,y:y+a.y/SIZE*s});
 for(const e of world.enemies.filter(e=>e.map===p.map&&e.hp>0)){const q=project(e);circle(q.x,q.y,5,e.color,'#241911');}
 for(const a of [MAPS[p.map].camp,...portalsOf(p.map),...(p.map===2?RUNES:[])]){const q=project(a);circle(q.x,q.y,6,'#e7cc87','#172219');}
 if(p.bloodstain?.map===p.map){const b=project(p.bloodstain);circle(b.x,b.y,8,'#ffc760','#111');}
 const q=project(p);circle(q.x,q.y,6,'#f6fff2','#213c24');label(MAPS[p.map].name,x+s/2,y-18,'#ead0a0',16);label('Você: branco  •  Guardiões: cores  •  Fogueira e portal: dourado  •  M fecha',x+s/2,y+s+28,'#e9e5ce',Math.min(12,s/43));
}
function render(){
 ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#101610';ctx.fillRect(0,0,width,height);
 if(!world||!world.players[id])return;
 const p=world.players[id],m=MAPS[p.map],time=world.time;
 const zoom=Math.min(1,Math.max(.68,width/1300));const viewW=width/zoom,viewH=height/zoom;
 const cameraX=viewW>=SIZE?(SIZE-viewW)/2:Math.max(0,Math.min(SIZE-viewW,p.x-viewW/2));
 const cameraY=viewH>=SIZE?(SIZE-viewH)/2:Math.max(0,Math.min(SIZE-viewH,p.y-viewH/2));
 ctx.save();ctx.scale(zoom,zoom);ctx.translate(-cameraX,-cameraY);ctx.imageSmoothingEnabled=false;
 ctx.drawImage(assets['map'+p.map],0,0,SIZE,SIZE);
 drawTerrain(ctx,p.map,time,assets.map2);
 for(const prop of m.props){if(prop.ground)drawProp(ctx,prop,assets[prop.type]);else if(prop.shadow){ctx.save();ctx.fillStyle='#10130e30';ctx.beginPath();ctx.ellipse(prop.x,prop.y,prop.width*prop.shadow,prop.width*.065,0,0,Math.PI*2);ctx.fill();ctx.restore();}}
 // Checkpoint and portals sit on verified walkable ground.
 const lit=world.campfires?.[p.map],fire=lit?assets.fireLit:assets.fireUnlit;if(lit)circle(m.camp.x,m.camp.y,32,'#e8a04e22');ctx.save();ctx.imageSmoothingEnabled=true;const fireW=64,fireH=fireW*fire.height/fire.width;ctx.drawImage(fire,m.camp.x-fireW/2,m.camp.y-fireH/2,fireW,fireH);ctx.restore();label(lit?'Fogueira acesa':'Fogueira apagada',m.camp.x,m.camp.y+42,'#ffe2a4');
 for(const portal of portalsOf(p.map)){
  const locked=portalLocked(world,p.map,portal);
  ctx.lineWidth=3;circle(portal.x,portal.y,portal.r*.68+Math.sin(time*2)*3,locked?'#5b447044':'#e3be7033',locked?'#a99ab6':'#ffe09c');label(locked?'Selo fechado':portal.label,portal.x,portal.y+65,locked?'#d4c7dc':'#ffe3a3');
 }
 if(p.map===2){
  for(const rune of RUNES){const lit=world.puzzle.solved||RUNE_ORDER.indexOf(rune.id)<world.puzzle.progress;circle(rune.x,rune.y,32,lit?'#7de0ad88':'#151f30','#afbdd1');label(rune.glyph,rune.x,rune.y+9,lit?'#b4ffd9':'#e6d5a8',30);label(rune.label,rune.x,rune.y+55);}
  label('E · Inscrição antiga',INSCRIPTION.x,INSCRIPTION.y,'#e6c69a',16);
  if(!world.puzzle.solved){ctx.fillStyle='#263246';ctx.fillRect(GATE.x-90,GATE.y-25,180,50);ctx.strokeStyle='#cfb987';ctx.lineWidth=5;for(let x=GATE.x-85;x<GATE.x+90;x+=20){ctx.beginPath();ctx.moveTo(x,GATE.y-50);ctx.lineTo(x,GATE.y+25);ctx.stroke();}label('Selo das três runas',GATE.x,GATE.y-65);}
 }
 for(const e of world.enemies.filter(e=>e.map===p.map&&e.hp>0&&e.state==='windup')){
  if(e.type==='titan'){const a=titanAttackArea(e);ctx.save();ctx.fillStyle='#fa713c44';ctx.strokeStyle='#ffe6a1';ctx.lineWidth=4;ctx.beginPath();ctx.arc(a.x,a.y,a.outer,0,Math.PI*2);if(a.inner)ctx.arc(a.x,a.y,a.inner,0,Math.PI*2,true);ctx.fill('evenodd');ctx.stroke();label(['PISÃO','ERUPÇÃO','ONDA SOLAR'][e.attackPattern],a.x,a.y-a.outer-15,'#ffe3ab',18);ctx.restore();continue;}
  const seer=['seer','shade'].includes(e.type),x=seer?e.aimX:e.x,y=seer?e.aimY:e.y,r=seer?72:e.range*(['malenio','warden'].includes(e.type)&&e.hp<e.maxHp/2?1.2:1);
  circle(x,y,r,'#dc624533','#ffc288');circle(x,y,r*Math.max(0,1-e.timer/e.windup),'#df5c4a33');label('!',x,y-10,'#fff0cb',24);
 }
 for(const c of world.crates||[])if(c.map===p.map&&!c.broken){ctx.fillStyle='#4a2c18';ctx.fillRect(c.x-22,c.y-30,44,36);ctx.strokeStyle='#d6ac63';ctx.lineWidth=3;ctx.strokeRect(c.x-22,c.y-30,44,36);ctx.beginPath();ctx.moveTo(c.x-20,c.y-28);ctx.lineTo(c.x+20,c.y+4);ctx.moveTo(c.x+20,c.y-28);ctx.lineTo(c.x-20,c.y+4);ctx.stroke();}
 if(p.bloodstain?.map===p.map){circle(p.bloodstain.x,p.bloodstain.y,16+Math.sin(time*4)*3,'#ffbb5555','#ffda83');label(t('Brasas perdidas'),p.bloodstain.x,p.bloodstain.y-24,'#ffe399');}
 const actors=[...m.props.filter(prop=>!prop.ground).map(prop=>({y:prop.y,order:1,draw:()=>drawProp(ctx,prop,assets[prop.type])})),...world.enemies.filter(e=>e.map===p.map).map(e=>({y:e.y,draw:()=>drawEnemy(e,time)})),...Object.values(world.players).filter(a=>a.map===p.map).map(a=>({y:a.y,draw:()=>{
  ctx.save();if(a.hp<=0)ctx.globalAlpha=.35;else if(a.invuln>0&&Math.floor(time*15)%2)ctx.globalAlpha=.6;
  ctx.fillStyle='#111a1266';ctx.beginPath();ctx.ellipse(a.x,a.y+2,18,7,0,0,7);ctx.fill();drawEquipped(ctx,a,time);ctx.restore();
  if(a.id===id){ctx.lineWidth=2;ctx.strokeStyle='#fff5c4aa';ctx.beginPath();ctx.moveTo(a.x+a.facingX*24,a.y+a.facingY*24);ctx.lineTo(a.x+a.facingX*33,a.y+a.facingY*33);ctx.stroke();}
  else label(a.name||t(a.character==='witch'?'Feiticeira aliada':'Guerreiro aliado'),a.x,a.y-78,'#d9f4d4',10,false);
 }}))];depthOrder(actors).forEach(a=>a.draw());
 for(const shot of world.projectiles.filter(s=>s.map===p.map)){circle(shot.x,shot.y-12,8,shot.color,'#fff3ce');ctx.strokeStyle=shot.color;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(shot.x,shot.y-12);ctx.lineTo(shot.x-shot.dx*26,shot.y-12-shot.dy*26);ctx.stroke();}
 for(const effect of world.effects.filter(e=>e.map===p.map)){
  ctx.save();ctx.globalAlpha=Math.min(1,effect.life*5);
  if(effect.kind==='shockwave'){ctx.strokeStyle=effect.color;ctx.lineWidth=10;ctx.beginPath();ctx.arc(effect.x,effect.y,effect.outer,0,Math.PI*2);ctx.stroke();if(effect.inner)circle(effect.x,effect.y,effect.inner,null,effect.color);}
  else if(effect.kind==='number')label(effect.text,effect.x,effect.y-(.7-effect.life)*38,effect.color,20);
  else if(effect.kind==='burst')circle(effect.x,effect.y,effect.range*(1.2-effect.life),'#e19b4b33',effect.color);
  else{ctx.strokeStyle=effect.color;ctx.lineWidth=7;ctx.beginPath();ctx.arc(effect.x,effect.y,effect.range*.85,effect.angle-.95,effect.angle+.95);ctx.stroke();}
  ctx.restore();
 }
 if(debug){ctx.lineWidth=2;for(const obstacle of m.obstacles){ctx.beginPath();obstacle.points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle='#ff333322';ctx.fill();ctx.strokeStyle='#ff8277';ctx.stroke();}circle(p.x,p.y,RADIUS,'#40ff4055','#a1ff98');}
 ctx.restore();if(mapOpen)drawMapOverlay(p);
}
function updateHud(){
 if(!world?.players[id])return;const p=world.players[id],m=MAPS[p.map];
 setText($('mapName'),m.name);setText($('healthText'),`Brasa · ${Math.ceil(p.hp)} / ${p.maxHp}`);$('healthFill').style.width=p.hp/p.maxHp*100+'%';$('progressHUD').textContent=`${t('Nível')} ${number(level(p))} · ${number(p.embers)} ${t('Brasas')} · ${t('Jornada')} ${world.cycle+1}`;setText($('objective'),objective(world));
 setText($('network'),mode==='solo'?'Solo':onlineError?'Desconectado':`Sala ${$('room').value.toUpperCase()} · ${Object.keys(world.players).length}/4`);
 $('saveStatus').hidden=mode==='online';if(stageTest)$('saveStatus').textContent='Teste isolado · saves desativados';setText($('dashStatus'),p.dashCd>0?p.dashCd.toFixed(1)+'s':'pronta');
 const message=onlineError||roomSaveError||(p.messageTime>0?p.message:'');$('toast').hidden=!message||!$('menu').hidden;setText($('toast'),message);
 let prompt=inLava(p.map,p.x,p.y)?'Lava! Volte para as plataformas de pedra.':'';const nearPortal=portalsOf(p.map).find(a=>Math.hypot(p.x-a.x,p.y-a.y)<a.r+RADIUS);if(nearPortal)prompt=stageTest?'Teste isolado · portais desativados':'E · '+nearPortal.label;
 else if(Math.hypot(p.x-m.camp.x,p.y-m.camp.y)<95)prompt=world.campfires?.[p.map]?'E · Descansar na fogueira':'E · Acender fogueira';
 if(p.map===2){const rune=RUNES.find(r=>Math.hypot(p.x-r.x,p.y-r.y)<85);if(rune)prompt='E · Ativar '+rune.label;if(Math.hypot(p.x-INSCRIPTION.x,p.y-INSCRIPTION.y)<85)prompt='E · Ler inscrição';}
 setText($('combatStatus'),`Energia ${Math.floor(p.energy??100)} · Q ${p.specialCd>0?p.specialCd.toFixed(1)+'s':'pronto'} · F ${p.rangedCd>0?p.rangedCd.toFixed(1)+'s':'pronto'}`);
 $('interaction').hidden=!prompt||p.hp<=0||!$('menu').hidden;setText($('interaction'),prompt);
 const boss=world.enemies.find(e=>e.type===(p.map===5?'titan':p.map===2?'warden':'malenio'));setText($('bossName'),boss.name);$('bossHud').hidden=![1,2,5].includes(p.map)||boss.hp<=0||!!prompt||!$('menu').hidden;
 $('bossFill').style.width=boss.hp/boss.maxHp*100+'%';
 if(!world.won)victorySeen=false;if(!p.resting&&$('bonfire').open){$('bonfire').close();canvas.focus();}
 if(p.resting&&$('menu').hidden&&!$('bonfire').open){closeDialogs();clearInput();setText($('campFeedback'),'');refreshCamp();$('bonfire').showModal();}
 if(p.hp<=0&&$('menu').hidden&&!$('death').open&&!modalOpen())$('death').showModal();
 if(p.hp>0&&$('death').open)$('death').close();
 if(world.won&&!victorySeen&&$('menu').hidden&&!$('death').open){victorySeen=true;clearInput();$('victory').showModal();save();}
}
function frame(now){
 const elapsed=Math.min((now-last)/1000,.1);last=now;
 if(world){
  const allowed=inputAllowed();
  if(mode==='solo'&&allowed){accumulator+=elapsed;while(accumulator>=STEP){tick(world,{[id]:input},STEP);input.interact=false;input.respawn=false;input.special=false;input.ranged=false;accumulator-=STEP;}}
  else accumulator=0;
  if(mode==='online'&&socket?.connected&&now-lastSend>33){socket.emit('input',allowed?input:{});input.interact=false;input.respawn=false;input.special=false;input.ranged=false;lastSend=now;}
  if(now-lastSave>2000){save();lastSave=now;}
  render();if(now-lastHud>80){updateHud();lastHud=now;}
 }
 requestAnimationFrame(frame);
}
function syncSettings(settings){if(settings.revision===getSettings().revision)return;applySettings(settings);if(world&&mode==='solo'){refreshWorldSettings(world);for(const actor of [...Object.values(world.players),...world.enemies])Object.assign(actor,safePoint(actor.map,actor));}}
async function fetchSettings(){if(stageTest||!(typeof __PAGES__==='undefined'))return;const r=await fetch('/api/settings',{cache:'no-store'});if(!r.ok)throw new Error('Configuração indisponível');syncSettings(await r.json());}
$('adminLink').hidden=!(typeof __PAGES__==='undefined')||!['localhost','127.0.0.1','[::1]'].includes(location.hostname);
if((typeof __PAGES__==='undefined'))setInterval(()=>fetchSettings().catch(console.error),5000);
try{
 await fetchSettings();
 await Promise.all([...Object.entries(PROP_TYPES).map(([name,type])=>loadImage(name,type.file)),...MAPS.map(m=>loadImage('map'+m.id,m.image)),loadImage('warrior','warrior.png'),loadImage('witch','witch.png'),...Object.keys(ENEMY_TYPES).map(name=>loadImage(name,name+'-topdown.png')),loadImage('fireLit','bonfire-lit.png'),loadImage('fireUnlit','bonfire-unlit.png')]);
 for(const preview of document.querySelectorAll('[data-preview]')){
  const img=assets[preview.dataset.preview],c=preview.getContext('2d'),fw=img.width/9,fh=img.height/4;c.imageSmoothingEnabled=false;c.drawImage(img,0,fh*2,fw,fh,0,0,80,80);
 }
 $('start').disabled=false;setText($('start'),'Iniciar nova jornada →');refreshSaveList();refreshMode();requestAnimationFrame(frame);
 if(stageTest){const bar=document.createElement('div');bar.id='stageTestBar';bar.style.cssText='position:fixed;right:16px;top:100px;z-index:50;padding:10px;background:#17251f;border:1px solid #d9ba7b';const title=document.createElement('span');title.textContent='TESTE · '+MAPS[stageTest.map].name+' · Sem saves ';const restart=document.createElement('button');restart.textContent='Reiniciar fase';restart.onclick=startStageTest;const back=document.createElement('a');back.href='/admin.html';back.textContent=' Voltar ao painel';bar.append(title,restart,back);document.body.append(bar);for(const name of ['saveButton','menuSaves','continue'])$(name).hidden=true;startStageTest();}
}catch(error){setText($('menuError'),'Um recurso do jogo não carregou. Recarregue a página para tentar novamente.');console.error(error);}
