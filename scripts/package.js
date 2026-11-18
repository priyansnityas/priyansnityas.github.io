// Copy only the static files the installed PWA needs to run.
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const output=path.join(root,'upload');
const files=['index.html','manifest.json','service-worker.js','css','js','src','assets'];
const banned=new Set(['node_modules','tests','test-results','screenshots','docs','work','.npm-cache']);

fs.rmSync(output,{recursive:true,force:true});
fs.mkdirSync(output,{recursive:true});
for(const name of files){
  const source=path.join(root,name),target=path.join(output,name);
  if(!fs.existsSync(source))throw new Error(`Required runtime path is missing: ${name}`);
  fs.cpSync(source,target,{recursive:true});
}
const html=fs.readFileSync(path.join(output,'index.html'),'utf8');
const worker=fs.readFileSync(path.join(output,'service-worker.js'),'utf8');
const references=[...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(x=>x[1]).filter(x=>!x.startsWith('http')&&!x.startsWith('data:'));
const precache=[...worker.matchAll(/'\.\/([^']+)'/g)].map(x=>x[1]);
for(const item of new Set([...references,...precache]))if(!fs.existsSync(path.join(output,item)))throw new Error(`Upload package is missing ${item}`);
for(const item of fs.readdirSync(output,{withFileTypes:true}))if(banned.has(item.name)||/\.zip$/i.test(item.name))throw new Error(`Unexpected package content: ${item.name}`);
function totalBytes(dir){return fs.readdirSync(dir,{withFileTypes:true}).reduce((sum,item)=>{const full=path.join(dir,item.name);return sum+(item.isDirectory()?totalBytes(full):fs.statSync(full).size)},0)}
console.log(`Upload package is ready: ${output}`);
console.log(`Files: ${[...references,...precache].length} app references checked`);
console.log(`Size: ${(totalBytes(output)/1024/1024).toFixed(2)} MB`);
