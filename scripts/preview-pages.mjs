import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../dist/pages/',import.meta.url)),prefix='/AuroraBroken/';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png'};
// Preview under the same nested path as a GitHub project site.
createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');if(url.pathname==='/'||url.pathname==='/AuroraBroken'){res.writeHead(302,{Location:prefix});return res.end();}
 if(!url.pathname.startsWith(prefix))throw Error('Not found');
 const relative=decodeURIComponent(url.pathname.slice(prefix.length))||'index.html',file=path.resolve(root,relative),inside=path.relative(root,file);
 if(inside.startsWith('..')||path.isAbsolute(inside))throw Error('Not found');
 const bytes=await readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(bytes);
 }catch{res.writeHead(404);res.end('Not found');}
}).listen(4173,'127.0.0.1',()=>console.log('Static preview: http://localhost:4173/AuroraBroken/'));
