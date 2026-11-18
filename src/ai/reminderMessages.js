// Local message formatting and safe URI builders for Udhar reminders.
(function (root) {
  function buildUpiLink({ upiId, name, amount, note = '' }) {
    if (!upiId) return '';
    const params = new URLSearchParams({ pa: upiId, pn: name || '', am: String(Math.abs(Number(amount) || 0)), cu: 'INR', tn: note });
    return `upi://pay?${params.toString()}`;
  }
  function buildReminderMessage({ template, name, amount, date, upiId = '', upiName = '', note = '' }) {
    const link = buildUpiLink({ upiId, name: upiName, amount, note });
    return String(template || 'Hi {name}, outstanding balance is {amount} as of {date}.{upi}')
      .replaceAll('{name}', name || '').replaceAll('{amount}', `₹${new Intl.NumberFormat('en-IN').format(Math.abs(Number(amount) || 0))}`)
      .replaceAll('{date}', date || '').replaceAll('{upi}', link ? ` Pay here: ${link}` : '').trim();
  }
  function whatsappUrl(phone, message) {
    const digits = String(phone || '').replace(/\D/g, '');
    return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : '';
  }
  function smsUrl(phone, message) {
    const digits = String(phone || '').replace(/[^\d+]/g, '');
    return `sms:${digits}?body=${encodeURIComponent(message)}`;
  }
  const api = { buildUpiLink, buildReminderMessage, whatsappUrl, smsUrl };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PocketLedgerReminderMessages = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
