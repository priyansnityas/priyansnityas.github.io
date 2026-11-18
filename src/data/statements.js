// Account statements use the same chronological balance engine as every account view.
(function(root){
  const Balances=root.PocketLedgerAccountBalances||(typeof require==='function'?require('./accountBalances.js'):null);
  function personStatement(person,transactions,generatedAt=new Date().toISOString()){
    let balance=0;const rows=(transactions||[]).filter(x=>x.person?.id===person.id&&['Udhar Given','Udhar Received Back','Udhar Taken','Udhar Repaid'].includes(x.type)).slice().sort((a,b)=>a.date.localeCompare(b.date)||(a.createdAt||'').localeCompare(b.createdAt||'')).map(row=>{const delta=row.type==='Udhar Given'||row.type==='Udhar Repaid'?Number(row.amount)||0:-(Number(row.amount)||0);balance+=delta;return {date:row.date,type:row.type,note:row.note||'',amount:Number(row.amount)||0,balance,id:row.id}});
    return {title:person.name,opening:0,rows,final:balance,generatedAt};
  }
  function accountStatement(account,transactions,generatedAt=new Date().toISOString()){
    const opening=Number(account.openingBalance)||0,rows=Balances.history(account,transactions).map(({transaction,row,delta,balance,id,date})=>{const x=transaction||row;const movement=delta??Balances.accountEffect(x,account.id);return {date:date||x.date,type:x.type,note:x.note||'',credit:movement>0?movement:0,debit:movement<0?-movement:0,balance,id:id||x.id}});
    return {title:account.name,opening,rows,final:rows.at(-1)?.balance??opening,generatedAt};
  }
  function toText(statement,labels={}){const text={generated:'Generated',opening:'Opening balance',final:'Final balance',balance:'Balance',...labels},lines=[statement.title,`${text.generated}: ${statement.generatedAt}`,`${text.opening}: ₹${statement.opening.toLocaleString('en-IN')}`];for(const row of statement.rows)lines.push(`${row.date} · ${row.type} · ${row.note||''} · ${row.amount!==undefined?`₹${row.amount.toLocaleString('en-IN')}`:`+₹${row.credit.toLocaleString('en-IN')} / -₹${row.debit.toLocaleString('en-IN')}`} · ${text.balance} ₹${row.balance.toLocaleString('en-IN')}`);lines.push(`${text.final}: ₹${statement.final.toLocaleString('en-IN')}`);return lines.join('\n')}
  const api={personStatement,accountStatement,toText};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PocketLedgerStatements=api;
})(typeof globalThis!=='undefined'?globalThis:this);
