// A safe, idempotent adapter for records created before account IDs were added.
(function(root){
  function migrateLegacyTransaction(transaction, accounts=[]){
    const row={...transaction};
    if(row.kind==='transfer'||row.kind==='noncash'||row.type==='Investment Loss')return row;
    if(row.accountId&&accounts.some(a=>a.id===row.accountId))return row;
    const cash=accounts.find(a=>a.id==='cash'||a.kind==='cash');
    const bank=accounts.find(a=>a.kind==='bank');
    const oldMethod=String(row.paymentMethod||'').trim().toLowerCase();
    const target=oldMethod==='cash'?cash:(['bank','upi','card'].includes(oldMethod)?(bank||cash):cash);
    if(target)row.accountId=target.id;
    return row;
  }
  const api={migrateLegacyTransaction};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PocketLedgerMigrations=api;
})(typeof globalThis!=='undefined'?globalThis:this);
