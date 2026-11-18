// Pure monthly budget calculations for Daily Expense transactions.
(function (root) {
  const amount = row => Number(row.amount) || 0;
  function budgetUsage(budget, transactions = [], monthKey = '') {
    const rows = transactions.filter(row => String(row.date || '').slice(0, 7) === monthKey && row.type === 'Daily Expense');
    const spent = rows.filter(row => !budget.category || budget.scope === 'overall' || budget.category === 'Overall' || row.category === budget.category).reduce((sum, row) => sum + amount(row), 0);
    const limit = Math.max(0, Number(budget.amount) || 0);
    const ratio = limit ? spent / limit : spent ? Infinity : 0;
    return { spent, limit, remaining: limit - spent, ratio, state: ratio < 0.8 ? 'under' : ratio <= 1 ? 'near' : 'over', percent: limit ? Math.round(ratio * 100) : 0 };
  }
  function listBudgetUsage(budgets = [], transactions = [], monthKey = '') {
    return budgets.map(budget => ({ ...budget, ...budgetUsage(budget, transactions, monthKey) }));
  }
  function crossingBudgets(budgets = [], before = [], entry = {}, monthKey = '') {
    if (entry.type !== 'Daily Expense' || String(entry.date || '').slice(0, 7) !== monthKey) return [];
    const after = [...before, entry];
    return budgets.filter(budget => budgetUsage(budget, before, monthKey).ratio <= 1 && budgetUsage(budget, after, monthKey).ratio > 1);
  }
  const api = { budgetUsage, listBudgetUsage, crossingBudgets };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PocketLedgerBudgets = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
