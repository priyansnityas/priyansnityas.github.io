// Small static server for local and same-Wi-Fi Pocket Ledger access.
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const zlib=require('node:zlib');

const root=__dirname;
const port=Number(process.env.PORT||3000);
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
const hostLinks=()=>Object.values(os.networkInterfaces()).flat().filter(x=>x&&!x.internal&&x.family==='IPv4').map(x=>`http://${x.address}:${port}`);

http.createServer((req,res)=>{
  let pathname;
  try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{res.writeHead(400).end('Bad request');return}
  if(pathname==='/')pathname='/index.html';
  const file=path.resolve(root,`.${pathname}`),relative=path.relative(root,file);
  if(relative.startsWith('..')||path.isAbsolute(relative)){res.writeHead(403).end('Forbidden');return}
  fs.readFile(file,(error,data)=>{
    if(error){res.writeHead(error.code==='ENOENT'?404:500,{'Content-Type':'text/plain; charset=utf-8'}).end(error.code==='ENOENT'?'Not found':'Could not read file');return}
    res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    if(/\bgzip\b/.test(req.headers['accept-encoding']||'')&&/\.(html|css|js|json|svg)$/i.test(file)){
      res.setHeader('Content-Encoding','gzip');res.setHeader('Vary','Accept-Encoding');
      zlib.gzip(data,(gzipError,compressed)=>{if(gzipError){res.writeHead(500).end();return}res.end(compressed)});
    }else res.end(data);
  });
}).listen(port,'0.0.0.0',()=>{
  console.log(`Pocket Ledger is running at http://localhost:${port}`);
  for(const link of hostLinks())console.log(`Same-Wi-Fi link: ${link}`);
  console.log('Close this window to stop the server.');
});
