// One-pass indexes and memoized aggregates for large local ledgers.
(function (root) {
  const Money=root.PocketLedgerMoney||(typeof require==='function'?require('./money.js'):null);
  const Investments=root.PocketLedgerInvestmentLedger||(typeof require==='function'?require('./investmentLedger.js'):null);
  let lastRows = null, lastIndex = null;const aggregateCache=new WeakMap();
  function buildLedgerIndex(rows = []) {
    if (rows === lastRows && lastIndex) return lastIndex;
    const byPerson = new Map(), byAccount = new Map(), byMonth = new Map(), sorted = [...rows].sort((a,b) => String(a.date||'').localeCompare(String(b.date||'')) || String(a.createdAt||'').localeCompare(String(b.createdAt||'')) || String(a.id||'').localeCompare(String(b.id||'')));
    for (const row of rows) {
      const add = (map, key) => { if (!key) return; if (!map.has(key)) map.set(key, []); map.get(key).push(row); };
      add(byPerson, row.person?.id); add(byAccount, row.accountId); add(byMonth, String(row.date||'').slice(0,7));
    }
    lastRows = rows; lastIndex = { byPerson, byAccount, byMonth, sorted }; return lastIndex;
  }
  function summarize(rows = []) {
    if(rows&&typeof rows==='object'&&aggregateCache.has(rows))return aggregateCache.get(rows);
    const totals = { credit:0, debit:0, income:0, expense:0, investment:0, count:rows.length };
    for (const row of rows) { const amount=Number(row.amount)||0; if(row.kind==='credit')totals.credit=Money.add(totals.credit,amount); if(row.kind==='debit')totals.debit=Money.add(totals.debit,amount); if(row.type==='Daily Expense')totals.expense=Money.add(totals.expense,amount); if(row.type==='Investment'&&row.kind!=='noncash')totals.investment=Money.add(totals.investment,amount); }
    totals.income=Investments?Investments.incomeForTransactions(rows):rows.filter(row=>['Salary','Side Income','Investment Profit'].includes(row.type)).reduce((sum,row)=>Money.add(sum,Number(row.amount)||0),0);
    if(rows&&typeof rows==='object')aggregateCache.set(rows,totals);
    return totals;
  }
  const api={buildLedgerIndex,summarize};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PocketLedgerPerformance=api;
})(typeof globalThis!=='undefined'?globalThis:this);
