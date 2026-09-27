// Compatibility only: copy old browser saves and room identities without deleting them.
// No legacy branding is displayed in the game or used for new data.
export function migrateStorage(storage){
 const pairs=[['kelvingame-save-library-v2','aurorabroken-save-library-v2'],['kelvingame-sol-partido-v1','aurorabroken-sol-partido-v1']];
 if(typeof storage.key==='function')for(let i=0;i<storage.length;i++){const key=storage.key(i);if(key?.startsWith('kelvingame-profile:'))pairs.push([key,key.replace('kelvingame-profile:','aurorabroken-profile:')]);}
 for(const [oldKey,newKey] of pairs){
  const value=storage.getItem(oldKey),current=storage.getItem(newKey);if(!value)continue;
  try{
   if(!current)storage.setItem(newKey,value);
   else if(oldKey.endsWith('save-library-v2')){
    const oldEntries=JSON.parse(value),newEntries=JSON.parse(current);if(!Array.isArray(oldEntries)||!Array.isArray(newEntries))continue;
    const merged=new Map();for(const entry of [...oldEntries,...newEntries])if(entry?.id){const existing=merged.get(entry.id);if(!existing||String(entry.updatedAt)>=String(existing.updatedAt))merged.set(entry.id,entry);}
    const json=JSON.stringify([...merged.values()]);if(json!==current)storage.setItem(newKey,json);
   }
  }catch{}
 }
}
