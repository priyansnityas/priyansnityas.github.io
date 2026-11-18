/* Investment calculations keep opening holdings and market value snapshots separate from cash transactions. */
(function (root) {
  'use strict';
  const amount = row => Math.max(0, Number(row?.amount) || 0);
  const sum = values => values.reduce((total, value) => total + value, 0);
  const isSale = row => row?.type === 'Investment Sale';
  function realizedSaleProfit(row) { return isSale(row) ? Math.max(0, amount(row) - amount({ amount: row.redeemedCost })) : 0; }
  function incomeForTransactions(rows = []) {
    return sum(rows.filter(row => ['Salary', 'Side Income', 'Investment Profit'].includes(row.type)).map(amount))
      + sum(rows.filter(isSale).map(realizedSaleProfit));
  }
  function summarize(rows = []) {
    return {
      income: incomeForTransactions(rows),
      expense: sum(rows.filter(row => row.type === 'Daily Expense').map(amount)),
      invested: sum(rows.filter(row => row.type === 'Investment' && row.kind !== 'noncash').map(amount)),
      credit: sum(rows.filter(row => row.kind === 'credit').map(amount)),
      debit: sum(rows.filter(row => row.kind === 'debit').map(amount))
    };
  }
  function records(holdings = [], transactions = [], snapshots = []) {
    const map = new Map();
    const get = (name, kind = 'Other') => {
      const key = String(name || '').trim() || 'Unnamed investment';
      if (!map.has(key)) map.set(key, { name: key, kind, openingCost: 0, invested: 0, redeemedCost: 0, remainingCost: 0, currentValue: null, realizedProfit: 0, realizedLoss: 0, unrealizedProfit: 0, net: 0, entries: [], lastDate: '' });
      const record = map.get(key);
      if (kind && (!record.kind || record.kind === 'Other')) record.kind = kind;
      return record;
    };
    const entry = (record, row) => {
      record.entries.push(row);
      if (String(row.date || '') > record.lastDate) record.lastDate = String(row.date);
      if (row.investmentKind && (record.kind === 'Other' || !record.kind)) record.kind = row.investmentKind;
    };
    for (const holding of holdings || []) {
      if (holding.type === 'snapshot') continue;
      const record = get(holding.name, holding.kind);
      record.openingCost += amount({ amount: holding.amount });
      entry(record, { ...holding, type: 'Investment Existing', kind: 'noncash', amount: amount(holding) });
      if (holding.currentValue !== undefined && holding.currentValue !== null && Number.isFinite(Number(holding.currentValue))) {
        const candidate = { date: holding.date || '', value: Number(holding.currentValue) };
        if (!record._valueDate || candidate.date >= record._valueDate) { record.currentValue = candidate.value; record._valueDate = candidate.date; }
      }
    }
    for (const snapshot of snapshots || []) {
      const record = get(snapshot.name, snapshot.kind);
      entry(record, { ...snapshot, type: 'Investment Value', amount: Number(snapshot.value) || 0 });
      const date = String(snapshot.date || '');
      if (!record._valueDate || date >= record._valueDate) { record.currentValue = Number(snapshot.value) || 0; record._valueDate = date; }
    }
    for (const row of transactions || []) {
      const recognized = ['Investment', 'Investment Existing', 'Investment Profit', 'Investment Loss', 'Investment Sale'].includes(row.type);
      if (!recognized) continue;
      const record = get(row.investmentName, row.investmentKind);
      entry(record, row);
      if (row.type === 'Investment Existing') record.openingCost += amount(row);
      if (row.type === 'Investment' && row.kind !== 'noncash') record.invested += amount(row);
      if (isSale(row)) {
        record.redeemedCost += amount({ amount: row.redeemedCost });
        record.realizedProfit += realizedSaleProfit(row);
        record.realizedLoss += Math.max(0, amount({ amount: row.redeemedCost }) - amount(row));
      }
      if (row.type === 'Investment Profit') record.realizedProfit += amount(row);
      if (row.type === 'Investment Loss') record.realizedLoss += amount(row);
    }
    return [...map.values()].map(record => {
      record.totalInvested = record.openingCost + record.invested;
      record.remainingCost = Math.max(0, record.totalInvested - record.redeemedCost);
      record.unrealizedProfit = record.currentValue === null ? null : record.currentValue - record.remainingCost;
      record.net = record.realizedProfit - record.realizedLoss + (record.unrealizedProfit || 0);
      record.entries.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || String(a.createdAt || '').localeCompare(String(b.createdAt || '')) || String(a.id || '').localeCompare(String(b.id || '')));
      delete record._valueDate;
      return record;
    }).sort((a, b) => b.lastDate.localeCompare(a.lastDate) || a.name.localeCompare(b.name));
  }
  function totals(recordsList = []) {
    return recordsList.reduce((result, row) => {
      result.totalInvested += row.totalInvested;
      result.remainingCost += row.remainingCost;
      if (row.currentValue !== null) result.currentValue += row.currentValue;
      result.hasCurrentValue ||= row.currentValue !== null;
      result.realizedProfit += row.realizedProfit;
      result.realizedLoss += row.realizedLoss;
      if (row.unrealizedProfit !== null) result.unrealizedProfit += row.unrealizedProfit;
      result.net += row.net;
      return result;
    }, { totalInvested: 0, remainingCost: 0, currentValue: 0, hasCurrentValue: false, realizedProfit: 0, realizedLoss: 0, unrealizedProfit: 0, net: 0 });
  }
  const api = Object.freeze({ realizedSaleProfit, incomeForTransactions, summarize, records, totals });
  root.PocketLedgerInvestmentLedger = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
