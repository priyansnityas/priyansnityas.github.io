// Date-safe recurring schedule helpers. Draft generation never writes or confirms transactions.
(function (root) {
  const DAY = 86400000;
  const toDate = value => new Date(`${value}T00:00:00`);
  const iso = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  function addMonthsClamped(dateValue, months, anchorDay) {
    const start = toDate(dateValue), target = new Date(start.getFullYear(), start.getMonth() + months, 1);
    target.setDate(Math.min(anchorDay || start.getDate(), new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()));
    return target;
  }
  function occurrenceDate(template, index) {
    const start = toDate(template.startDate), cadence = template.cadence || template.frequency || 'monthly';
    if (cadence === 'daily') { const date = new Date(start); date.setDate(date.getDate() + index); return date; }
    if (cadence === 'weekly') { const date = new Date(start); date.setDate(date.getDate() + index * 7); return date; }
    if (cadence === 'yearly') return addMonthsClamped(template.startDate, index * 12, start.getDate());
    return addMonthsClamped(template.startDate, index, start.getDate());
  }
  function buildDueDrafts(templates = [], existingDrafts = [], transactions = [], today = iso(new Date()), maxPerTemplate = 120) {
    const known = new Set(existingDrafts.map(row => `${row.recurringId}:${row.recurrenceDate}`));
    for (const row of transactions) if (row.recurringId && row.recurrenceDate) known.add(`${row.recurringId}:${row.recurrenceDate}`);
    const drafts = [];
    for (const template of templates.filter(row => row.active !== false)) {
      if (!template.startDate) continue;
      for (let index = 0; index < maxPerTemplate; index++) {
        const date = iso(occurrenceDate(template, index));
        if (date > today) break;
        if (template.endDate && date > template.endDate) break;
        const key = `${template.id}:${date}`;
        if (known.has(key)) continue;
        drafts.push({ id: `draft:${template.id}:${date}`, recurringId: template.id, recurrenceDate: date, type: template.type, kind: template.kind, amount: Number(template.amount) || 0, date, note: template.note || '', category: template.category || '', accountId: template.accountId || null, investmentKind: template.investmentKind || '', investmentName: template.investmentName || '', createdAt: new Date().toISOString() });
        known.add(key);
      }
    }
    return drafts;
  }
  function nextOccurrence(template, afterDate) {
    const start = toDate(template.startDate);
    for (let index = 0; index < 10000; index++) {
      const date = iso(occurrenceDate(template, index));
      if (date > afterDate && (!template.endDate || date <= template.endDate)) return date;
      if (template.endDate && date > template.endDate) return null;
      if (index === 0 && date > afterDate) return date;
    }
    return null;
  }
  const api = { buildDueDrafts, occurrenceDate: (template, index) => iso(occurrenceDate(template, index)), addMonthsClamped, nextOccurrence };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PocketLedgerRecurring = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
