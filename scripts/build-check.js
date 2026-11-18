// Offline build check: ensure every app script and precached asset exists locally.
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const worker=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');
const refs=[...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(match=>match[1]).filter(value=>!value.startsWith('http')&&!value.startsWith('data:'));
const precache=[...worker.matchAll(/'\.\/([^']+)'/g)].map(match=>match[1]);
const missing=[...new Set([...refs,...precache])].filter(value=>!fs.existsSync(path.join(root,value)));
if(missing.length){console.error('Missing local app assets:',missing.join(', '));process.exit(1)}
if(/https?:\/\/(?:fonts\.googleapis|cdn\.)/i.test(html))throw new Error('External font/CDN reference found in app shell.');
console.log(`Offline asset check passed (${new Set([...refs,...precache]).size} local paths).`);
