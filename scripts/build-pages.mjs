import {build} from 'esbuild';
import {mkdir,readFile,writeFile,copyFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {MAPS,ENEMY_TYPES} from '../client/world.mjs';
import {PROP_TYPES} from '../client/scenery.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
export async function buildPages(){
 const output=path.resolve(root,'dist/pages');
 // Only the fixed generated build directory can be replaced.
 if(path.relative(root,output)!==path.join('dist','pages'))throw Error('Unsafe output path');
 await rm(output,{recursive:true,force:true});await mkdir(path.join(output,'sprites'),{recursive:true});
 await build({absWorkingDir:root,entryPoints:['client/app.mjs'],outfile:path.join(output,'game.js'),bundle:true,format:'esm',platform:'browser',target:'es2022',define:{__PAGES__:'true'},minify:true,charset:'utf8',legalComments:'none'});
 const code=await readFile(path.join(output,'game.js'),'utf8');
 if(/socket\.io|window\.io|\/api\/(settings|network)|new WebSocket/.test(code))throw Error('Server dependency leaked into static build');
 const html=(await readFile(path.join(root,'client/index.html'),'utf8')).replaceAll('data-server-only','data-server-only hidden');
 await writeFile(path.join(output,'index.html'),html);await copyFile(path.join(root,'client/style.css'),path.join(output,'style.css'));await writeFile(path.join(output,'.nojekyll'),'');
 const sprites=new Set(['aurorabroken-logo.png','warrior.png','witch.png','bonfire-lit.png','bonfire-unlit.png',...MAPS.map(m=>m.image),...Object.values(PROP_TYPES).map(p=>p.file),...Object.keys(ENEMY_TYPES).map(type=>type+'-topdown.png')]);
 for(const file of sprites)await copyFile(path.join(root,'client/sprites',file),path.join(output,'sprites',file));
 console.log(`Static solo build: ${output} (${sprites.size} sprites, no server or Socket.IO)`);return output;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await buildPages();
