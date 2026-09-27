import fs from 'node:fs';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {DEFAULT_SETTINGS,getSettings,applySettings} from '../client/settings.mjs';
export function installAdmin(app,{directory,onApply}){
 fs.mkdirSync(directory,{recursive:true});const filename=path.join(directory,'world-settings.json');
 if(fs.existsSync(filename)){
  const saved=JSON.parse(fs.readFileSync(filename,'utf8'));
  if(saved.version<3){
   fs.copyFileSync(filename,filename+(saved.version===1?'.before-layers.bak':'.before-dungeon.bak'));
   saved.maps=DEFAULT_SETTINGS.maps.map(base=>{const old=saved.version===2?saved.maps.find(m=>m.id===base.id):null;return old?{id:base.id,obstacles:[...old.obstacles,...base.obstacles.filter(o=>!old.obstacles.some(p=>p.name===o.name))]}:base;});
   saved.enemies={...DEFAULT_SETTINGS.enemies,...saved.enemies};saved.version=3;saved.revision=Date.now();fs.writeFileSync(filename,JSON.stringify(saved,null,2));
  }
  applySettings(saved);
 }
 const token=randomBytes(32).toString('hex');
 const local=(req,res,next)=>{
  const ip=req.socket.remoteAddress,host=req.hostname;
  if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(ip)||!['localhost','127.0.0.1','[::1]','::1'].includes(host))return res.status(403).json({error:'Admin disponível somente no PC servidor via localhost.'});
  if(req.get('origin')&&req.get('origin')!==req.protocol+'://'+req.get('host'))return res.status(403).json({error:'Origem não autorizada.'});
  res.set('Cache-Control','no-store');next();
 };
 app.get('/api/settings',(_,res)=>res.json(getSettings()));
 app.get('/api/admin/session',local,(_,res)=>res.json({token,defaults:DEFAULT_SETTINGS,settings:getSettings()}));
 app.post('/api/admin/settings',local,(req,res)=>{
  if(req.get('x-admin-token')!==token)return res.status(403).json({error:'Sessão de administrador inválida. Reabra o painel.'});
  const before=getSettings();
  try{
   if(req.body?.revision!==before.revision)return res.status(409).json({error:'A configuração mudou em outro painel. Recarregue antes de publicar.'});
   const next=applySettings({...req.body,revision:Date.now()});
   if(fs.existsSync(filename))fs.copyFileSync(filename,filename+'.bak');
   fs.writeFileSync(filename+'.tmp',JSON.stringify(next,null,2),'utf8');fs.renameSync(filename+'.tmp',filename);
   onApply(next);res.json(next);
  }catch(error){applySettings(before);res.status(400).json({error:error.message});}
 });
}
