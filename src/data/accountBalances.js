/* One source of truth for account balances and history safety checks. */
(function (root) {
  'use strict';
  const isCashFlow = row => row && row.type !== 'Investment Loss' && row.kind !== 'noncash';
  const amountOf = row => Math.max(0, Number(row?.amount) || 0);
  const compareDate = (a, b) => String(a.date || '').localeCompare(String(b.date || ''));

  function accountEffect(row, accountId) {
    if (!isCashFlow(row)) return 0;
    const amount = amountOf(row);
    if (row.kind === 'transfer') {
      if (row.fromAccountId === accountId) return -amount;
      if (row.toAccountId === accountId) return amount;
      return 0;
    }
    if (row.accountId !== accountId) return 0;
    return row.kind === 'credit' ? amount : row.kind === 'debit' ? -amount : 0;
  }

  function orderedEvents(accountId, transactions, throughDate) {
    return (transactions || []).filter(row => (!throughDate || String(row.date) <= String(throughDate)) && accountEffect(row, accountId) !== 0)
      .map(row => ({ row, delta: accountEffect(row, accountId) }))
      .sort((a, b) => compareDate(a.row, b.row)
        // Credits, including transfer-ins, are applied before same-day debits.
        || (a.delta < 0 ? 1 : 0) - (b.delta < 0 ? 1 : 0)
        || String(a.row.createdAt || '').localeCompare(String(b.row.createdAt || ''))
        || String(a.row.id || '').localeCompare(String(b.row.id || '')));
  }

  function history(account, transactions, throughDate) {
    let balance = Number(account?.openingBalance) || 0;
    const rows = [];
    for (const event of orderedEvents(account?.id, transactions, throughDate)) {
      balance = Math.round((balance + event.delta + Number.EPSILON) * 100) / 100;
      rows.push({ id: event.row.id, date: event.row.date, transaction: event.row, delta: event.delta, balance });
    }
    return rows;
  }

  function balance(account, transactions, date) {
    const rows = history(account, transactions, date);
    return rows.length ? rows[rows.length - 1].balance : Number(account?.openingBalance) || 0;
  }

  function accountAnalysis(account, transactions) {
    let minimum = Number(account?.openingBalance) || 0;
    let minimumDate = null;
    let balanceNow = minimum;
    const rows = history(account, transactions);
    for (const row of rows) {
      balanceNow = row.balance;
      if (balanceNow < minimum) { minimum = balanceNow; minimumDate = row.date; }
    }
    return { balance: balanceNow, minimum, minimumDate, rows };
  }

  function allBalances(accounts, transactions, date) {
    return (accounts || []).reduce((map, account) => {
      map[account.id] = balance(account, transactions, date);
      return map;
    }, {});
  }

  function totalHistory(accounts, transactions) {
    let balance = (accounts || []).reduce((sum, account) => sum + (Number(account.openingBalance) || 0), 0);
    const events = (transactions || []).filter(Boolean)
      .map(row => ({ row, delta: row.kind === 'credit' ? amountOf(row) : row.kind === 'debit' ? -amountOf(row) : 0 }))
      .sort((a, b) => compareDate(a.row, b.row) || (a.delta < 0 ? 1 : 0) - (b.delta < 0 ? 1 : 0)
        || String(a.row.createdAt || '').localeCompare(String(b.row.createdAt || ''))
        || String(a.row.id || '').localeCompare(String(b.row.id || '')));
    return events.map(event => {
      balance = Math.round((balance + event.delta + Number.EPSILON) * 100) / 100;
      return { id: event.row.id, date: event.row.date, transaction: event.row, balance };
    });
  }

  function plannedTransactions(transactions, change) {
    let rows = [...(transactions || [])];
    if (change?.removeId) rows = rows.filter(row => row.id !== change.removeId);
    if (change?.removeIds?.length) { const ids = new Set(change.removeIds); rows = rows.filter(row => !ids.has(row.id)); }
    if (change?.upsert) rows = rows.filter(row => row.id !== change.upsert.id).concat(change.upsert);
    return rows;
  }

  /* Existing legacy negatives are tolerated only when the proposed history does not worsen that account's minimum. */
  function validateChange(accounts, transactions, change = {}) {
    const proposedTransactions = plannedTransactions(transactions, change);
    const proposedAccounts = (accounts || []).map(account => {
      const updated = change.accountUpdates?.[account.id];
      return updated ? { ...account, ...updated } : account;
    });
    const affected = new Set(Object.keys(change.accountUpdates || {}));
    const ids = new Set([...(change.removeIds || []), ...(change.removeId ? [change.removeId] : []), ...(change.upsert ? [change.upsert.id] : [])]);
    for (const row of transactions || []) if (ids.has(row.id)) {
      if (row.kind === 'transfer') { if (row.fromAccountId) affected.add(row.fromAccountId); if (row.toAccountId) affected.add(row.toAccountId); }
      else if (isCashFlow(row) && row.accountId) affected.add(row.accountId);
    }
    if (change.upsert) {
      const row = change.upsert;
      if (row.kind === 'transfer') { if (row.fromAccountId) affected.add(row.fromAccountId); if (row.toAccountId) affected.add(row.toAccountId); }
      else if (isCashFlow(row) && row.accountId) affected.add(row.accountId);
    }
    for (const account of proposedAccounts) {
      if (!affected.has(account.id)) continue;
      const candidateAccount = (accounts || []).find(item => item.id === account.id) || account;
      const after = accountAnalysis(account, proposedTransactions);
      // Opening balance edits compare against the original opening balance/history.
      const original = accountAnalysis(candidateAccount, transactions);
      if (after.minimum < 0 && after.minimum < original.minimum) {
        return { ok: false, account, date: after.minimumDate, shortfall: Math.round(Math.abs(after.minimum) * 100) / 100, beforeMinimum: original.minimum, afterMinimum: after.minimum };
      }
    }
    return { ok: true };
  }

  function dataCheck(accounts, transactions) {
    const issues = [];
    for (const account of accounts || []) {
      const opening = Number(account.openingBalance) || 0;
      if (opening < 0) issues.push({ account, date: '', balance: opening, shortfall: Math.abs(opening), transaction: null });
      const lastByDate = new Map();
      for (const row of history(account, transactions)) lastByDate.set(row.date, row);
      for (const [date, row] of lastByDate) if (row.balance < 0) issues.push({ account, date, balance: row.balance, shortfall: Math.abs(row.balance), transaction: row.transaction });
    }
    return issues;
  }

  root.PocketLedgerAccountBalances = Object.freeze({ balance, history, accountAnalysis, allBalances, totalHistory, validateChange, dataCheck, accountEffect, orderedEvents });
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PocketLedgerAccountBalances;
})(typeof window !== 'undefined' ? window : globalThis);
