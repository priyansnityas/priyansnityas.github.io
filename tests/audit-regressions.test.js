const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');

test('money helpers use integer minor units for repeated decimal transactions',()=>{
  const Money=require('../src/data/money.js');
  assert.equal(Money.sum([0.1,0.2,0.1]),0.4);
  assert.equal(Money.add(0.1,0.2),0.3);
  assert.equal(Money.fromMinor(Money.toMinor(1234.56)),1234.56);
  const Performance=require('../src/data/performance.js');
  assert.equal(Performance.summarize([{kind:'credit',type:'Salary',amount:0.1},{kind:'credit',type:'Salary',amount:0.2}]).credit,0.3);
  const Statements=require('../src/data/statements.js');
  const account=Statements.accountStatement({id:'cash',name:'Cash',openingBalance:0.1},[
    {id:'1',date:'2026-01-01',kind:'credit',type:'Salary',amount:0.2,accountId:'cash'},
    {id:'2',date:'2026-01-02',kind:'debit',type:'Daily Expense',amount:0.1,accountId:'cash'}
  ]);
  assert.equal(account.final,0.2);
});

test('CSV cells neutralize spreadsheet formula prefixes after whitespace',()=>{
  const Csv=require('../src/data/csv.js');
  assert.equal(Csv.cell('=1+1'),'"\'=1+1"');
  assert.equal(Csv.cell('  @SUM(A1:A2)'),'"\'  @SUM(A1:A2)"');
  assert.equal(Csv.cell('-100'),'"\'-100"');
  assert.equal(Csv.cell('Rahul, "R"'),'"Rahul, ""R"""');
});

test('person and account deletion guards include reminder and recurring references',()=>{
  const References=require('../src/data/references.js');
  assert.equal(References.personHasReferences('p',[{person:{id:'p'}}],[{person:{id:'p'}}]),true);
  assert.equal(References.personHasReferences('p',[],[{person:{id:'p'}}]),true);
  assert.equal(References.accountHasReferences('a',[{accountId:'a'}],[{accountId:'a'}],[]),true);
  assert.equal(References.accountHasReferences('a',[],[],[{accountId:'a'}]),true);
});

test('backup import validates payload before any destructive replacement',()=>{
  const BackupValidation=require('../src/data/backupValidation.js');
  const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
  const good={app:'Pocket Ledger',version:4,transactions:[],people:[],accounts:[],reminders:[]};
  assert.equal(BackupValidation.validateBackup(good),good);
  assert.throws(()=>BackupValidation.validateBackup({...good,transactions:[{id:'x',amount:'NaN',date:'2026-01-01'}]}));
  assert.equal(BackupValidation.validateBackup({...good,accounts:[{id:'a',openingBalance:-500}]}).accounts[0].openingBalance,-500);
  assert.throws(()=>BackupValidation.validateBackup({...good,accounts:[{id:'a',openingBalance:'NaN'}]}));
  assert.throws(()=>BackupValidation.validateBackup({...good,reminders:[null]}));
  assert.match(app,/validateBackup\(/);
});

test('backup replace uses the storage layer atomic replace operation',()=>{
  const db=fs.readFileSync(path.join(root,'js/db.js'),'utf8');
  const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
  assert.match(db,/db\.transaction\(STORE_NAMES,'readwrite'\)/);
  assert.match(app,/await LedgerDB\.replaceAll\(data\)/);
});

test('localStorage replace fallback rolls back if a write fails midway',async()=>{
  const source=fs.readFileSync(path.join(root,'js/db.js'),'utf8');
  const values=new Map([['pocket-ledger-transactions',JSON.stringify([{id:'old'}])]]);
  let shouldFail=true;
  const localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>{if(key==='pocket-ledger-accounts'&&shouldFail){shouldFail=false;throw new Error('quota')}values.set(key,String(value))},removeItem:key=>values.delete(key)};
  const window={};vm.runInNewContext(source,{window,localStorage});
  await assert.rejects(window.LedgerDB.replaceAll({transactions:[{id:'new'}]}),/quota/);
  assert.deepEqual(JSON.parse(values.get('pocket-ledger-transactions')),[{id:'old'}]);
});

test('offline service worker never resolves a failed fetch with null',async()=>{
  const source=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');
  const listeners={};
  const self={registration:{scope:'https://ledger.test/'},addEventListener:(name,handler)=>listeners[name]=handler};
  const caches={match:async()=>undefined,open:async()=>({addAll:async()=>{},put:async()=>{}}),keys:async()=>[]};
  vm.runInNewContext(source,{self,caches,fetch:async()=>{throw new Error('offline')},URL,Response,Promise});
  let responsePromise;
  listeners.fetch({request:{method:'GET',mode:'navigate',url:'https://ledger.test/'},respondWith:value=>responsePromise=value});
  const response=await responsePromise;
  assert.equal(response.status,503);
});

test('IndexedDB open errors do not silently switch to a possibly stale localStorage ledger',async()=>{
  const source=fs.readFileSync(path.join(root,'js/db.js'),'utf8');
  const request={};
  const window={indexedDB:{open:()=>{queueMicrotask(()=>{request.error=new Error('blocked');request.onerror()});return request}}};
  const localStorage={getItem:()=>JSON.stringify([{id:'stale'}]),setItem(){},removeItem(){}};
  vm.runInNewContext(source,{window,indexedDB:window.indexedDB,localStorage,Promise,queueMicrotask});
  await assert.rejects(window.LedgerDB.transactions(),/blocked/);
});

test('corrupt localStorage records fail visibly instead of becoming an empty ledger',async()=>{
  const source=fs.readFileSync(path.join(root,'js/db.js'),'utf8');
  const window={};
  const localStorage={getItem:()=>'{bad json'};
  vm.runInNewContext(source,{window,localStorage,Promise});
  await assert.rejects(window.LedgerDB.transactions(),/JSON/);
});

test('storage initialization failure is shown as a blocking, translated state',()=>{
  const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.match(app,/document\.body\.classList\.add\('storage-failed'\)/);
  assert.match(app,/\$\('#storageFailure'\)\.hidden=false;return/);
  assert.match(html,/id="storageFailure"[^>]*role="alertdialog"/);
});

test('app shell restricts scripts, connections and embedded objects to local sources',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.match(html,/Content-Security-Policy/);
  assert.match(html,/script-src 'self'/);
  assert.match(html,/connect-src 'self'/);
  assert.match(html,/object-src 'none'/);
});
