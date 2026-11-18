// Validate an imported backup before it reaches any storage or replacement code.
(function(root){
  const stores=['transactions','people','accounts','reminders'];
  const optionalStores=['budgets','recurringEntries','recurringDrafts','investmentRecords'];
  function validRow(row){
    return !!row&&typeof row==='object'&&!Array.isArray(row)&&typeof row.id==='string'&&row.id.length>0;
  }
  function validateBackup(data){
    if(!data||typeof data!=='object'||data.app!=='Pocket Ledger'||![1,2,3,4,5,6].includes(data.version))throw new Error('unsupported');
    for(const key of stores){
      if(!Array.isArray(data[key])||data[key].some(row=>!validRow(row)))throw new Error('invalid');
    }
    for(const key of optionalStores){
      if(data[key]!==undefined&&(!Array.isArray(data[key])||data[key].some(row=>!validRow(row))))throw new Error('invalid');
    }
    for(const row of data.transactions){
      if(row.amount!==undefined&&(!Number.isFinite(Number(row.amount))||Number(row.amount)<0))throw new Error('invalid');
      if(row.date!==undefined&&!/^\d{4}-\d{2}-\d{2}$/.test(row.date))throw new Error('invalid');
    }
    for(const row of data.accounts){
      if(row.openingBalance!==undefined&&!Number.isFinite(Number(row.openingBalance)))throw new Error('invalid');
    }
    if(data.categories!==undefined&&(!Array.isArray(data.categories)||data.categories.some(x=>typeof x!=='string')))throw new Error('invalid');
    if(data.investments!==undefined&&(!Array.isArray(data.investments)||data.investments.some(x=>typeof x!=='string')))throw new Error('invalid');
    return data;
  }
  const api={validateBackup};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.PocketLedgerBackupValidation=api;
})(typeof globalThis!=='undefined'?globalThis:this);
