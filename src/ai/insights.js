// Explainable, local-only insight rules. The module has no browser or storage access.
(function (root) {
  const investmentLedger = root.PocketLedgerInvestmentLedger || (typeof module !== 'undefined' && module.exports ? require('../data/investmentLedger.js') : null);
  const DAY = 86400000;
  const incomeTypes = new Set(['Salary', 'Side Income', 'Investment Profit']);
  const expenseTypes = new Set(['Daily Expense']);
  const udharTypes = new Set(['Udhar Given', 'Udhar Received Back', 'Udhar Taken', 'Udhar Repaid']);
  const number = value => Number(value) || 0;
  const monthOf = value => String(value || '').slice(0, 7);
  const monthOffset = (key, offset) => {
    const [year, month] = key.split('-').map(Number);
    const date = new Date(year, month - 1 + offset, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  };
  const hash = value => {
    let out = 2166136261;
    for (const char of String(value)) { out ^= char.charCodeAt(0); out = Math.imul(out, 16777619); }
    return (out >>> 0).toString(36);
  };
  const median = values => {
    const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
    if (!sorted.length) return 0;
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };
  function personNet(transactions, personId) {
    return transactions.reduce((sum, row) => {
      if (row.person?.id !== personId) return sum;
      if (row.type === 'Udhar Given' || row.type === 'Udhar Repaid') return sum + number(row.amount);
      if (row.type === 'Udhar Received Back' || row.type === 'Udhar Taken') return sum - number(row.amount);
      return sum;
    }, 0);
  }
  function oldestOpenDate(rows) {
    const receive = [], give = [];
    const apply = (lots, value) => { let remaining = value; for (const lot of lots) { if (remaining <= 0) break; const used = Math.min(lot.remaining, remaining); lot.remaining -= used; remaining -= used; } };
    for (const row of [...rows].sort((a, b) => a.date.localeCompare(b.date) || String(a.createdAt || '').localeCompare(String(b.createdAt || '')))) {
      const value = number(row.amount);
      if (row.type === 'Udhar Given') receive.push({ date: row.date, remaining: value });
      else if (row.type === 'Udhar Received Back') apply(receive, value);
      else if (row.type === 'Udhar Taken') give.push({ date: row.date, remaining: value });
      else if (row.type === 'Udhar Repaid') apply(give, value);
    }
    return [...receive, ...give].filter(lot => lot.remaining > 0).map(lot => lot.date).sort()[0] || '';
  }
  function baseInsight(type, month, data, payload, rank, titleKey, reasonKey, reasonParams = {}, entryIds = [], action = null) {
    const revision = hash(JSON.stringify({ transactions: (data.transactions || []).map(row => [row.id, row.amount, row.date, row.type, row.kind, row.category, row.note, row.accountId, row.person?.id]), people: (data.people || []).map(row => [row.id, row.name, row.creditLimit, row.lastRemindedAt]), reminders: (data.reminders || []).map(row => [row.id, row.amount, row.dueDate, row.status, row.type, row.person?.id]), budgets: (data.budgets || []).map(row => [row.id, row.amount, row.category]), accounts: (data.accounts || []).map(row => [row.id, row.openingBalance]), backupDate: data.lastBackupDate || data.backupDate || '' }));
    const fingerprint = hash(JSON.stringify([payload, revision]));
    return { id: `${type}:${month}:${fingerprint}`, type, rank, titleKey, reasonKey, reasonParams, entryIds, action };
  }
  function generateInsights(data = {}, options = {}) {
    const transactions = Array.isArray(data.transactions) ? data.transactions : [];
    const people = Array.isArray(data.people) ? data.people : [];
    const reminders = Array.isArray(data.reminders) ? data.reminders : [];
    const budgets = Array.isArray(data.budgets) ? data.budgets : [];
    const month = options.monthKey || data.monthKey || new Date().toISOString().slice(0, 7);
    const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
    const today = options.today || now.toISOString().slice(0, 10);
    const current = transactions.filter(row => monthOf(row.date) === month);
    const cards = [];

    // Category spend spike versus the previous three calendar months.
    const categories = new Set(current.filter(row => expenseTypes.has(row.type)).map(row => row.category || 'Other'));
    for (const category of categories) {
      const spend = rows => rows.filter(row => row.type === 'Daily Expense' && (row.category || 'Other') === category).reduce((sum, row) => sum + number(row.amount), 0);
      const currentAmount = spend(current);
      const priorAmounts = [-1, -2, -3].map(offset => spend(transactions.filter(row => monthOf(row.date) === monthOffset(month, offset))));
      const average = priorAmounts.reduce((a, b) => a + b, 0) / 3;
      const minAmount = number(options.minimumSpikeAmount ?? 1000);
      if (average > 0 && currentAmount >= minAmount && currentAmount > average * 1.3) {
        const rows = current.filter(row => row.type === 'Daily Expense' && (row.category || 'Other') === category);
        cards.push(baseInsight('category-spike', month, data, [category, rows.map(row => [row.id, row.amount]), priorAmounts], 10, 'insightCategorySpikeTitle', 'insightCategorySpikeReason', { category, percent: Math.round((currentAmount / average - 1) * 100), average: Math.round(average) }, rows.map(row => row.id)));
      }
    }

    // Repeated merchant/note and amount at weekly or monthly spacing.
    const normalizeMerchant = row => String(row.note || row.source || row.category || '').toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    const byMerchant = new Map();
    for (const row of transactions.filter(row => row.type === 'Daily Expense' || row.type === 'Salary' || row.type === 'Side Income')) {
      const key = normalizeMerchant(row);
      if (!key || key.length < 2) continue;
      if (!byMerchant.has(key)) byMerchant.set(key, []);
      byMerchant.get(key).push(row);
    }
    for (const [merchant, rows] of byMerchant) {
      rows.sort((a, b) => a.date.localeCompare(b.date));
      if (rows.length < 3) continue;
      const recent = rows.slice(-4), amounts = recent.map(row => number(row.amount));
      const amountAvg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      if (amountAvg <= 0 || amounts.some(value => Math.abs(value - amountAvg) / amountAvg > 0.15)) continue;
      const gaps = recent.slice(1).map((row, index) => (new Date(`${row.date}T00:00:00`) - new Date(`${recent[index].date}T00:00:00`)) / DAY);
      const weekly = gaps.length >= 2 && gaps.every(gap => gap >= 6 && gap <= 8);
      const monthly = gaps.length >= 2 && gaps.every(gap => gap >= 26 && gap <= 35);
      if (!weekly && !monthly) continue;
      const latest = recent[recent.length - 1];
      cards.push(baseInsight('recurring-detected', month, data, recent.map(row => [row.id, row.amount, row.date]), 20, 'insightRecurringTitle', 'insightRecurringReason', { merchant, cadence: weekly ? 'weekly' : 'monthly' }, recent.map(row => row.id), { kind: latest.kind, type: latest.type, amount: Math.round(amountAvg * 100) / 100, note: latest.note || merchant, cadence: weekly ? 'weekly' : 'monthly', accountId: latest.accountId || null, category: latest.category || '' }));
      break;
    }

    // Median + 3 MAD, with a floor so ordinary small fluctuations are not flagged.
    const expenses = current.filter(row => row.type === 'Daily Expense');
    const values = expenses.map(row => number(row.amount));
    if (values.length >= 4) {
      const center = median(values), mad = median(values.map(value => Math.abs(value - center)));
      const threshold = Math.max(center + 3 * mad, center * 1.75, number(options.minimumOutlierAmount ?? 5000));
      const outlier = [...expenses].sort((a, b) => number(b.amount) - number(a.amount))[0];
      if (number(outlier.amount) > threshold) cards.push(baseInsight('large-expense', month, data, [values, outlier.id, outlier.amount], 30, 'insightOutlierTitle', 'insightOutlierReason', { amount: Math.round(number(outlier.amount)), threshold: Math.round(threshold) }, [outlier.id]));
    }

    // Aged Udhar and optional person credit limits. Open principal is approximated from the oldest open Udhar row.
    for (const person of people) {
      const net = personNet(transactions, person.id);
      if (!net) continue;
      const rows = transactions.filter(row => row.person?.id === person.id && udharTypes.has(row.type)).sort((a, b) => a.date.localeCompare(b.date));
      const oldestDate = oldestOpenDate(rows);
      const age = oldestDate ? Math.floor((new Date(`${today}T00:00:00`) - new Date(`${oldestDate}T00:00:00`)) / DAY) : 0;
      const limit = number(person.creditLimit ?? person.limit);
      const daysSinceReminder = person.lastRemindedAt ? Math.floor((new Date(`${today}T00:00:00`) - new Date(person.lastRemindedAt)) / DAY) : null;
      if (age > 30 || (limit > 0 && Math.abs(net) > limit)) {
        const openRows = rows.filter(row => row.date === oldestDate || row.type === 'Udhar Given' || row.type === 'Udhar Taken');
        const reasonKey = age > 30 ? 'insightUdharAgeReason' : 'insightUdharLimitReason';
        cards.push(baseInsight('udhar-alert', month, data, [person.id, net, oldestDate, limit], 40, 'insightUdharTitle', reasonKey, { person: person.name, amount: Math.round(Math.abs(net)), age, limit: Math.round(limit) }, openRows.map(row => row.id)));
      } else if (daysSinceReminder >= 20) {
        cards.push(baseInsight('udhar-not-reminded', month, data, [person.id, net, person.lastRemindedAt], 42, 'insightUdharTitle', 'insightUdharNotRemindedReason', { person: person.name, days: daysSinceReminder }, rows.map(row => row.id)));
      }
    }

    const monthlyIncome = rows => investmentLedger ? investmentLedger.incomeForTransactions(rows) : rows.filter(row => incomeTypes.has(row.type)).reduce((sum, row) => sum + number(row.amount), 0);
    const monthlySpend = rows => rows.filter(row => expenseTypes.has(row.type)).reduce((sum, row) => sum + number(row.amount), 0);
    const priorMonth = monthOffset(month, -1);
    const priorRows = transactions.filter(row => monthOf(row.date) === priorMonth);
    const income = monthlyIncome(current), spend = monthlySpend(current), invest = current.filter(row => row.type === 'Investment').reduce((sum, row) => sum + number(row.amount), 0);
    const priorIncome = monthlyIncome(priorRows), priorSavings = priorIncome - monthlySpend(priorRows);
    const savings = income - spend;
    if (!income) cards.push(baseInsight('no-income', month, data, [current.map(row => row.id)], 50, 'insightNoIncomeTitle', 'insightNoIncomeReason', {}, current.map(row => row.id)));
    else if (priorIncome > 0 && Math.abs(savings / income - priorSavings / priorIncome) >= 0.1) {
      cards.push(baseInsight('savings-change', month, data, [income, spend, priorIncome, priorSavings], 50, 'insightSavingsTitle', 'insightSavingsReason', { direction: savings / income >= priorSavings / priorIncome ? 'higher' : 'lower', currentRate: Math.round(savings / income * 100), previousRate: Math.round(priorSavings / priorIncome * 100) }, current.filter(row => incomeTypes.has(row.type) || expenseTypes.has(row.type) || row.type === 'Investment Sale').map(row => row.id)));
    }

    const lastBackup = data.lastBackupDate || data.backupDate || '';
    if (!lastBackup || !Number.isFinite(new Date(lastBackup).getTime()) || (now - new Date(lastBackup)) / DAY > 30) cards.push(baseInsight('backup-due', month, data, [lastBackup || 'none'], 60, 'insightBackupTitle', lastBackup ? 'insightBackupOldReason' : 'insightBackupMissingReason', {}, [], { screen: 'settings' }));

    // Reminder and budget signals use the same local values as the dashboard modules.
    const dueSoon = reminders.filter(row => row.status === 'Pending' && row.type === 'give' && row.dueDate >= today && monthOf(row.dueDate) === month);
    const overallBudget = budgets.find(row => row.scope === 'overall' || row.category === 'Overall');
    if (dueSoon.length && overallBudget) {
      const dueAmount = dueSoon.reduce((sum, row) => sum + number(row.amount), 0);
      if (dueAmount > number(overallBudget.amount)) cards.push(baseInsight('commitments-budget', month, data, [dueSoon.map(row => row.id), overallBudget.amount], 45, 'insightCommitmentTitle', 'insightCommitmentReason', { due: Math.round(dueAmount), budget: Math.round(number(overallBudget.amount)) }));
    }
    return cards.sort((a, b) => a.rank - b.rank || a.title.localeCompare(b.title)).slice(0, 5);
  }
  const api = { generateInsights, personNet, median, oldestOpenDate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PocketLedgerInsights = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
