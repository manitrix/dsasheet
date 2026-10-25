'use strict';
// Optional static preview server. The workspace also opens directly from index.html.
const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path');
const PORT=Number(process.env.PORT||4173);
const assets={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/core.js':'core.js','/data.js':'data.js','/styles.css':'styles.css'};
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
http.createServer(async(req,res)=>{
  const file=assets[new URL(req.url,'http://127.0.0.1').pathname];
  if(!file||!['GET','HEAD'].includes(req.method)){res.writeHead(404);return res.end('Not found')}
  try{const body=await fs.readFile(path.join(__dirname,file));res.writeHead(200,{'Content-Type':types[path.extname(file)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:body)}catch{res.writeHead(500);res.end('Could not load file')}
}).listen(PORT,'127.0.0.1',()=>console.log('DSA Garden: http://127.0.0.1:'+PORT));
