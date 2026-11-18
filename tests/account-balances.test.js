const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const B=require('../src/data/accountBalances.js');
const cash={id:'cash',name:'Cash',kind:'cash',openingBalance:5000};
const tx=(id,kind,amount,date,accountId='cash',extra={})=>({id,kind,type:kind==='credit'?'Salary':'Daily Expense',amount,date,accountId,createdAt:`${date}T12:00:00.000Z`,...extra});

test('cash debit cannot take the balance below zero and exactly zero is allowed',()=>{
  assert.deepEqual(B.validateChange([cash],[],{upsert:tx('bad','debit',5001,'2026-10-29')}),{ok:false,account:cash,date:'2026-10-29',shortfall:1,beforeMinimum:5000,afterMinimum:-1});
  assert.equal(B.validateChange([cash],[],{upsert:tx('ok','debit',5000,'2026-10-29')}).ok,true);
  assert.equal(B.balance(cash,[tx('ok','debit',5000,'2026-10-29')]),0);
});

test('transfer outflow is guarded against the source account balance',()=>{
  const sbi={id:'sbi',name:'SBI',kind:'bank',openingBalance:2000};
  const transfer={id:'t1',kind:'transfer',type:'Transfer',amount:3000,date:'2026-10-29',fromAccountId:'sbi',toAccountId:'cash'};
  const result=B.validateChange([cash,sbi],[],{upsert:transfer});
  assert.equal(result.ok,false);assert.equal(result.account.id,'sbi');assert.equal(result.shortfall,1000);
});

test('deleting a credit relied on by a later debit is rejected with the breaking date',()=>{
  const sbi={id:'sbi',name:'SBI',kind:'bank',openingBalance:0};
  const rows=[tx('pay','credit',10000,'2026-10-01','sbi'),tx('spend','debit',10000,'2026-10-12','sbi')];
  const result=B.validateChange([sbi],rows,{removeId:'pay'});
  assert.equal(result.ok,false);assert.equal(result.date,'2026-10-12');assert.equal(result.shortfall,10000);
});

test('backdated debit is rejected but same debit after its funding credit is accepted',()=>{
  const account={id:'sbi',name:'SBI',kind:'bank',openingBalance:0},salary=tx('salary','credit',5000,'2026-10-10','sbi');
  assert.equal(B.validateChange([account],[salary],{upsert:tx('early','debit',1000,'2026-10-09','sbi')}).ok,false);
  assert.equal(B.validateChange([account],[salary],{upsert:tx('late','debit',5000,'2026-10-11','sbi')}).ok,true);
});

test('opening balance edits are checked against the complete account history',()=>{
  const account={id:'sbi',name:'SBI',kind:'bank',openingBalance:20000},spent=tx('spend','debit',15000,'2026-10-12','sbi');
  assert.equal(B.validateChange([account],[spent],{accountUpdates:{sbi:{openingBalance:1000}}}).ok,false);
  assert.equal(B.validateChange([account],[spent],{accountUpdates:{sbi:{openingBalance:25000}}}).ok,true);
});

test('same-date credits are applied before debits',()=>{
  const account={id:'cash',name:'Cash',openingBalance:0};
  const rows=[tx('debit','debit',6000,'2026-10-29'),tx('credit','credit',6000,'2026-10-29')];
  assert.equal(B.validateChange([account],[],{upsert:rows[0]}).ok,false);
  assert.equal(B.validateChange([account],[rows[0]],{upsert:rows[1]}).ok,true);
  assert.equal(B.balance(account,rows),0);
});

test('legacy negative history is reported and only worsening changes are blocked',()=>{
  const account={id:'cash',name:'Cash',openingBalance:0},rows=[tx('old','debit',100,'2026-10-01')];
  const issue=B.dataCheck([account],rows)[0];assert.equal(issue.balance,-100);assert.equal(issue.date,'2026-10-01');
  assert.equal(B.validateChange([account],rows,{upsert:tx('worse','debit',1,'2026-10-02')}).ok,false);
  assert.equal(B.validateChange([account],rows,{upsert:tx('fix','credit',50,'2026-10-02')}).ok,true);
  const second=[...rows,tx('later','debit',20,'2026-10-03')];assert.deepEqual(B.dataCheck([account],second).map(issue=>issue.date),['2026-10-01','2026-10-03']);
});

test('one thousand fixed-seed random accepted writes never produce a negative account balance',()=>{
  const accounts=[{id:'cash',name:'Cash',openingBalance:20000},{id:'bank',name:'Bank',kind:'bank',openingBalance:20000}],rows=[];let seed=0x51a7e;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/0x100000000};
  for(let i=0;i<1000;i++){
    const date=`2026-${String(1+Math.floor(random()*12)).padStart(2,'0')}-${String(1+Math.floor(random()*28)).padStart(2,'0')}`,account=accounts[Math.floor(random()*accounts.length)],kind=random()<.48?'credit':'debit',candidate=tx(`r${i}`,kind,1+Math.floor(random()*2500),date,account.id);
    if(B.validateChange(accounts,rows,{upsert:candidate}).ok)rows.push(candidate);
    for(const current of accounts)assert.ok(B.accountAnalysis(current,rows).minimum>=0,`negative ${current.name} after random step ${i}`);
  }
});

test('full running total history ignores transfers and noncash investment loss',()=>{
  const accounts=[cash,{id:'bank',name:'Bank',openingBalance:1000}];
  const rows=[tx('salary','credit',1000,'2026-10-01','bank'),{id:'loss',kind:'noncash',type:'Investment Loss',amount:50,date:'2026-10-02'}, {id:'move',kind:'transfer',type:'Transfer',amount:500,date:'2026-10-03',fromAccountId:'bank',toAccountId:'cash'}];
  assert.deepEqual(B.totalHistory(accounts,rows).map(row=>row.balance),[7000,7000,7000]);
  assert.equal(B.balance(accounts[1],rows),1500);
  assert.equal(B.balance(accounts[0],rows),5500);
});

test('the PWA loads the shared balance engine and all entry mutation paths use its history guard',()=>{
  const html=fs.readFileSync(require.resolve('../index.html'),'utf8'),app=fs.readFileSync(require.resolve('../js/app.js'),'utf8'),worker=fs.readFileSync(require.resolve('../service-worker.js'),'utf8');
  assert.ok(html.indexOf('src/data/accountBalances.js')<html.indexOf('js/app.js'));
  assert.match(worker,/\.\/src\/data\/accountBalances\.js/);
  for(const path of ['form.addEventListener(\'submit\'','async function deleteTransaction','async function settlePerson','async function confirmRecurringDraft','async function saveAccountEditor'])assert.ok(app.includes(path),`expected guarded path: ${path}`);
  assert.ok((app.match(/PocketLedgerAccountBalances\.validateChange/g)||[]).length>=5);
});
