// Simple deterministic forecast math. Values are derived from current device data only.
(function (root) {
  const recurringApi = typeof module !== 'undefined' && module.exports ? require('./recurring.js') : root.PocketLedgerRecurring;
  const investmentLedger = root.PocketLedgerInvestmentLedger || (typeof module !== 'undefined' && module.exports ? require('../data/investmentLedger.js') : null);
  const n = value => Number(value) || 0;
  const incomeTypes = new Set(['Salary', 'Side Income', 'Investment Profit']);
  function safeToSpend({ balance = 0, reminders = [], recurringDrafts = [], recurringEntries = [], budgets = [], transactions = [], monthKey, today }) {
    const date = new Date(`${today}T00:00:00`), lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const daysLeft = Math.max(1, lastDay - date.getDate() + 1);
    const withinMonth = due => String(due || '').slice(0, 7) === monthKey && due >= today;
    const reminderCommitments = reminders.filter(row => row.status === 'Pending' && row.type === 'give' && withinMonth(row.dueDate)).reduce((sum, row) => sum + n(row.amount), 0);
    const recurringCommitments = recurringDrafts.filter(row => row.kind === 'debit' && withinMonth(row.date)).reduce((sum, row) => sum + n(row.amount), 0);
    const monthExpenses = transactions.filter(row => row.type === 'Daily Expense' && String(row.date || '').slice(0, 7) === monthKey);
    const overallBudget = budgets.find(row => row.scope === 'overall' || row.category === 'Overall');
    // An overall budget already reserves the same spending as category budgets, so don't double count it.
    const reserveBudgets = overallBudget ? [overallBudget] : budgets;
    const reserved = reserveBudgets.reduce((sum, budget) => {
      const spent = monthExpenses.filter(row => !budget.category || budget.scope === 'overall' || budget.category === 'Overall' || row.category === budget.category).reduce((total, row) => total + n(row.amount), 0);
      return sum + Math.max(0, n(budget.amount) - spent);
    }, 0);
    const monthEnd = `${monthKey}-${String(lastDay).padStart(2, '0')}`;
    const future = recurringApi?.buildDueDrafts(recurringEntries, recurringDrafts, [], monthEnd) || [];
    const futureRecurringCommitments = future.filter(row => row.kind === 'debit' && row.date > today).reduce((sum, row) => sum + n(row.amount), 0);
    const committed = reminderCommitments + recurringCommitments + futureRecurringCommitments;
    const available = n(balance) - committed - reserved;
    return { daily: available / daysLeft, balance: n(balance), reminderCommitments, recurringCommitments: recurringCommitments + futureRecurringCommitments, reserved, committed, daysLeft, available };
  }
  function monthEndForecast({ balance = 0, transactions = [], reminders = [], recurringEntries = [], recurringDrafts = [], monthKey, today }) {
    const date = new Date(`${today}T00:00:00`), [year, month] = monthKey.split('-').map(Number);
    const daysElapsed = Math.max(1, Math.min(date.getDate(), new Date(year, month, 0).getDate()));
    const daysInMonth = new Date(year, month, 0).getDate(), daysRemaining = Math.max(0, daysInMonth - daysElapsed);
    const current = transactions.filter(row => String(row.date || '').slice(0, 7) === monthKey);
    const income = investmentLedger ? investmentLedger.incomeForTransactions(current) : current.filter(row => incomeTypes.has(row.type)).reduce((sum, row) => sum + n(row.amount), 0);
    const expense = current.filter(row => row.type === 'Daily Expense').reduce((sum, row) => sum + n(row.amount), 0);
    const dailyIncome = income / daysElapsed, dailyExpense = expense / daysElapsed;
    const monthEnd = `${monthKey}-${String(daysInMonth).padStart(2, '0')}`;
    const futureRecurring = recurringApi?.buildDueDrafts(recurringEntries, recurringDrafts, transactions, monthEnd) || [];
    const knownIncome = futureRecurring.filter(row => row.kind === 'credit' && row.date > today).reduce((sum, row) => sum + n(row.amount), 0);
    const knownExpense = reminders.filter(row => row.status === 'Pending' && row.type === 'give' && String(row.dueDate || '').slice(0, 7) === monthKey && row.dueDate > today).reduce((sum, row) => sum + n(row.amount), 0)
      + futureRecurring.filter(row => row.kind === 'debit' && row.date > today).reduce((sum, row) => sum + n(row.amount), 0);
    const projectedIncome = dailyIncome * daysRemaining + knownIncome;
    const projectedExpense = dailyExpense * daysRemaining + knownExpense;
    const forecast = n(balance) + projectedIncome - projectedExpense;
    const band = (projectedIncome + projectedExpense) * 0.15;
    return { forecast, low: forecast - band, high: forecast + band, projectedIncome, projectedExpense, dailyIncome, dailyExpense, daysElapsed, daysRemaining, daysInMonth, confidenceBand: band };
  }
  const api = { safeToSpend, monthEndForecast };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PocketLedgerForecast = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
