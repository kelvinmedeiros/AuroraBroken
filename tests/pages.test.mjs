import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {buildPages} from '../scripts/build-pages.mjs';
test('Pages artifact is standalone, uses relative assets and contains no backend or Socket.IO loader',async()=>{
 const dir=await buildPages(),html=await readFile(path.join(dir,'index.html'),'utf8'),code=await readFile(path.join(dir,'game.js'),'utf8');
 assert.doesNotMatch(code,/socket\.io|window\.io|\/api\/(settings|network)|new WebSocket/);
 assert.match(html,/<label data-server-only hidden><input type="radio" name="mode" value="online"/);
 assert.doesNotMatch(html,/(?:src|href)="\//);assert.equal((await stat(path.join(dir,'.nojekyll'))).isFile(),true);
 assert.deepEqual((await readdir(dir)).sort(),['.nojekyll','game.js','index.html','sprites','style.css']);
 for(const file of ['ground-garden.png','ground-ash.png','ground-dungeon.png','warrior.png','witch.png','aurorabroken-logo.png'])assert.ok((await stat(path.join(dir,'sprites',file))).size>0);
 assert.match(code,/Crypt of the First Dawn/);assert.match(code,/aurorabroken-language/);assert.match(code,/aurorabroken-save-library-v2/);
});
