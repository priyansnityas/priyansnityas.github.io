// Syntax-check every first-party JavaScript file with Node's parser.
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.join(__dirname,'..');
const ignored=new Set(['node_modules','.npm-cache','.playwright-browsers','outputs.restore-point-2026-11-17']);
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{if(entry.isDirectory())return ignored.has(entry.name)?[]:walk(path.join(dir,entry.name));return entry.name.endsWith('.js')&&!entry.name.endsWith('.spec.js')?[path.join(dir,entry.name)]:[]})}
const files=walk(root);let failed=false;
for(const file of files){const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(result.status!==0){failed=true;process.stderr.write(`${path.relative(root,file)}\n${result.stderr}`)}}
if(failed)process.exit(1);
console.log(`Syntax checked ${files.length} JavaScript files.`);
