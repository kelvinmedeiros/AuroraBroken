const express = require('express');
const path = require('path');
const os = require('os');
const {performance} = require('node:perf_hooks');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {maxHttpBufferSize:262144});
const config = require('./config');
app.use(express.json({limit:'256kb'}));
app.use(express.static(path.join(__dirname,'../client'), {etag:true}));
app.get('/health',(_,res)=>res.json({ok:true}));
app.get('/api/network',(_,res)=>{
 const addresses=Object.entries(os.networkInterfaces()).filter(([name])=>!(/vEthernet|WSL|Hyper-V|Bluetooth/i.test(name))).flatMap(([,addresses])=>addresses).filter(a=>a.family==='IPv4'&&!a.internal&&!a.address.startsWith('169.254.')).map(a=>'http://'+a.address+':'+http.address().port);
 res.json({addresses});
});
async function main(){
 const {tick,STEP,playerAction}=await import('../client/engine.mjs');
 const {RoomStore,newRoom,joinProfile,hashToken,captureRoom,restoreRoom,playerRecord}=await import('./room-store.mjs');
 const store=new RoomStore(process.env.SAVE_DIR||path.join(__dirname,'../saves/multiplayer'));
 const rooms=new Map();
 const {installAdmin}=await import('./admin.mjs');
 const {refreshWorldSettings}=await import('../client/settings.mjs');
 const {safePoint}=await import('../client/world.mjs');
 installAdmin(app,{directory:process.env.SETTINGS_DIR||path.join(__dirname,'../config'),onApply:settings=>{
  for(const room of rooms.values()){
   refreshWorldSettings(room.world);
   for(const actor of [...Object.values(room.world.players),...room.world.enemies])Object.assign(actor,safePoint(actor.map,actor));
  }
  io.emit('settings',settings);
 }});
 const {equip}=await import('../client/equipment.mjs');
 const allowed=['special','ranged','up','down','left','right','attack','dash','interact','respawn'];
 const persist=(key,room)=>{
  try{const data=store.save(key,room);io.to(key).emit('saveStatus',{savedAt:data.updatedAt});return data;}
  catch(error){console.error('Falha ao salvar sala '+key+': '+error.message);io.to(key).emit('saveStatus',{error:'Falha ao gravar o save no servidor. Exporte uma cópia.'});throw error;}
 };
 io.on('connection',socket=>{
  socket.on('join',(data,ack)=>{
   if(typeof ack!=='function')return;
   if(socket.data.room)return ack({error:'Você já entrou em uma sala.'});
   if(!data||typeof data.room!=='string'||!/^[A-Z0-9-]{1,20}$/.test(data.room)||!['warrior','witch'].includes(data.character)||typeof data.token!=='string'||!/^[a-f0-9]{32,64}$/.test(data.token)||typeof data.name!=='string'||!data.name.trim()||data.name.length>24)return ack({error:'Informe sala, nome e um perfil válido.'});
   try{
    const key=data.room,hash=hashToken(data.token);
    let room=rooms.get(key);
    if(!room){room=store.load(key)||newRoom(hash);rooms.set(key,room);}
    if(Object.keys(room.world.players).length>=4)return ack({error:'Sala cheia (máximo de 4 jogadores).'});
    if(Object.values(room.identities).includes(hash))return ack({error:'Este perfil já está conectado. Use outro nome para jogar em outra aba.'});
    if(!room.profiles[hash]&&Object.keys(room.profiles).length>=256)return ack({error:'Limite de perfis desta sala atingido. Crie outra sala.'});
    joinProfile(room,socket.id,hash,data.character,data.name.trim());
    room.lastInput[socket.id]=performance.now();socket.data.room=key;socket.data.hash=hash;socket.join(key);
    persist(key,room);
    ack({id:socket.id,world:room.world,host:hash===room.hostHash,savedAt:room.lastSaved});
   }catch(error){
    const room=rooms.get(socket.data.room);
    if(room){delete room.world.players[socket.id];delete room.identities[socket.id];delete room.lastInput[socket.id];socket.leave(socket.data.room);delete socket.data.room;}
    ack({error:error.message});
   }
  });
  socket.on('input',data=>{
   const room=rooms.get(socket.data.room);if(!room||!data||typeof data!=='object')return;
   const now=performance.now();
   // Keep the newest intent; the fixed simulation tick bounds action frequency.
   room.inputs[socket.id]=Object.fromEntries(allowed.map(k=>[k,data[k]===true]));room.lastInput[socket.id]=now;
  });
  socket.on('equip',(data,ack)=>{
   if(typeof ack!=='function')return;const room=rooms.get(socket.data.room),player=room?.world.players[socket.id];
   try{if(!player)throw new Error('Entre em uma sala.');const equipment=equip(room.world,player,data?.slot,data?.value);ack({equipment});io.to(socket.data.room).emit('state',room.world);}catch(error){ack({error:error.message});}
  });
  socket.on('progression',(data,ack)=>{
   if(typeof ack!=='function')return;const room=rooms.get(socket.data.room),player=room?.world.players[socket.id];
   try{if(!player)throw new Error('Entre em uma sala.');playerAction(room.world,player,data?.action,data?.value);persist(socket.data.room,room);ack({world:room.world});io.to(socket.data.room).emit('state',room.world);}catch(error){ack({error:error.message});}
  });
  socket.on('saveRoom',(_,ack)=>{
   if(typeof ack!=='function')return;
   const room=rooms.get(socket.data.room);if(!room)return ack({error:'Entre em uma sala primeiro.'});
   if(socket.data.lastSave!==undefined&&performance.now()-socket.data.lastSave<1000)return ack({error:'Aguarde um segundo entre salvamentos.'});
   socket.data.lastSave=performance.now();
   try{ack({data:persist(socket.data.room,room)});}catch{ack({error:'Não foi possível salvar no disco do servidor.'});}
  });
  socket.on('exportRoom',(_,ack)=>{
   if(typeof ack!=='function')return;
   const room=rooms.get(socket.data.room);if(!room)return ack({error:'Entre em uma sala primeiro.'});
   ack({data:captureRoom(room,socket.data.room)});
  });
  socket.on('importRoom',(data,ack)=>{
   if(typeof ack!=='function')return;
   const key=socket.data.room,room=rooms.get(key);if(!room)return ack({error:'Entre na sala de destino primeiro.'});
   if(socket.data.hash!==room.hostHash)return ack({error:'Somente o criador da sala pode restaurar um arquivo.'});
   if(Object.keys(room.world.players).length!==1)return ack({error:'Para restaurar, os outros jogadores precisam sair da sala.'});
   try{
    const next=restoreRoom(data);
    // The current host retains authority in the destination room.
    next.hostHash=room.hostHash;
    const old=room.world.players[socket.id],recovery=next.profiles[socket.data.hash]||next.profiles[data.hostHash];
    if(recovery)next.profiles[socket.data.hash]=recovery;
    joinProfile(next,socket.id,socket.data.hash,old.character,old.name);next.lastInput[socket.id]=performance.now();
    store.archive(key,room);persist(key,next);rooms.set(key,next);io.to(key).emit('state',next.world);ack({ok:true});
   }catch(error){ack({error:error.message});}
  });
  socket.on('disconnect',()=>{
   const key=socket.data.room,room=rooms.get(key);if(!room)return;
   if(room.world.players[socket.id])room.profiles[socket.data.hash]=playerRecord(room.world.players[socket.id]);
   delete room.world.players[socket.id];delete room.identities[socket.id];delete room.inputs[socket.id];delete room.lastInput[socket.id];
   try{persist(key,room);if(!Object.keys(room.world.players).length)rooms.delete(key);}catch{/* Keep in memory and retry on the next autosave. */}
  });
 });
 let last=performance.now(),accumulator=0,frames=0,lastDisk=last;
 setInterval(()=>{
  const now=performance.now();accumulator+=Math.min((now-last)/1000,.25);last=now;
  while(accumulator>=STEP){
   for(const room of rooms.values()){
    for(const id of Object.keys(room.inputs))if(now-room.lastInput[id]>300)room.inputs[id]={};
    tick(room.world,room.inputs,STEP);
   }
   accumulator-=STEP;frames++;
   if(frames%3===0)for(const [key,room] of rooms)io.to(key).emit('state',room.world);
  }
  if(now-lastDisk>5000){lastDisk=now;for(const [key,room] of rooms)try{persist(key,room);}catch{}}
 },8);
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{
  for(const [key,room] of rooms)try{persist(key,room);}catch{}
  http.close(()=>process.exit(0));setTimeout(()=>process.exit(0),500).unref();
 });
 const port=process.env.PORT===undefined?config.PORT:Number(process.env.PORT);
 http.listen(port,process.env.HOST||config.SERVER_ADDRESS,()=>console.log('AuroraBroken: http://localhost:'+http.address().port));
}
main().catch(error=>{console.error(error);process.exitCode=1;});

