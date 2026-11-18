// Prevent deleting entities still referenced by other local records.
(function(root){
  const personHasReferences=(id,transactions=[],reminders=[])=>transactions.some(x=>x.person?.id===id)||reminders.some(x=>x.person?.id===id);
  const accountHasReferences=(id,transactions=[],recurring=[],drafts=[])=>transactions.some(x=>x.accountId===id||x.fromAccountId===id||x.toAccountId===id)||recurring.some(x=>x.accountId===id||x.fromAccountId===id||x.toAccountId===id)||drafts.some(x=>x.accountId===id||x.fromAccountId===id||x.toAccountId===id);
  const api={personHasReferences,accountHasReferences};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.PocketLedgerReferences=api;
})(typeof globalThis!=='undefined'?globalThis:this);
