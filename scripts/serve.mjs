import http from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {embedContent} from '../share.js';
const root = resolve(process.argv[2] || '.');
const port = Number(process.env.PORT || 3000);
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.mp3':'audio/mpeg','.wav':'audio/wav','.m4a':'audio/mp4'};
const server = http.createServer(async (req,res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    let file = resolve(root, '.' + pathname);
    if (file !== root && !file.startsWith(root + sep)) {res.writeHead(403).end(); return;}
    if (pathname.includes('/.')) {res.writeHead(403).end(); return;}
    if ((await stat(file).catch(()=>null))?.isDirectory()) {
      if(!pathname.endsWith('/')) {res.writeHead(301,{'Location':pathname+'/'}).end();return;}
      file = resolve(file,'index.html');
    }
    let data;
    try {data = await readFile(file);} catch {
      if (root.endsWith('dist')) throw new Error('Not found');
      file = resolve(root,'public','.' + pathname);
      if (!file.startsWith(resolve(root,'public') + sep)) throw new Error('Not found');
      data = await readFile(file);
    }
    if(file===resolve(root,'index.html') && !root.endsWith('dist')) {
      const config=JSON.parse(await readFile(resolve(root,'content.json'),'utf8'));
      data=embedContent(data.toString(),config);
    }
    res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}).end(data);
  } catch {res.writeHead(404,{'Content-Type':'text/plain'}).end('Not found');}
});
server.listen(port,'0.0.0.0',()=>console.log(`Invitation server listening on port ${port} (${root})`));
