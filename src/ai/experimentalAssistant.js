// Optional browser-provided model. It only proposes Quick Add fields for review.
(function (root) {
  function provider() {
    if (root.LanguageModel?.create) return root.LanguageModel;
    if (root.ai?.languageModel?.create) return root.ai.languageModel;
    if (root.ai?.createTextSession) return { create: options => root.ai.createTextSession(options) };
    return null;
  }
  function available() { return !!provider(); }
  async function prompt(text) {
    const api=provider(); if(!api) throw new Error('Unavailable');
    const session=await api.create({systemPrompt:'You help review a possible local finance entry. Never invent an amount or save anything.'});
    try { return String(await (session.prompt?session.prompt(text):session.sendMessage(text))).trim(); }
    finally { session.destroy?.(); }
  }
  async function parseForReview(text) {
    const result=await prompt(`Extract a possible transaction into JSON only with keys amount, kind (credit or debit), type, note. If unclear use empty values. Do not infer an amount. Sentence: ${String(text).slice(0,300)}`);
    const match=result.match(/\{[\s\S]*\}/); if(!match)return null;
    try { const parsed=JSON.parse(match[0]);const allowed=['Salary','Side Income','Daily Expense','Investment','Investment Profit','Investment Loss','Udhar Given','Udhar Taken','Udhar Received Back','Udhar Repaid'];if(!Number.isFinite(Number(parsed.amount))||Number(parsed.amount)<=0||!['credit','debit'].includes(parsed.kind)||!allowed.includes(parsed.type))return null;return {...parsed,amount:Number(parsed.amount)}; } catch { return null; }
  }
  const api={available,parseForReview}; if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PocketLedgerExperimentalAssistant=api;
})(typeof globalThis!=='undefined'?globalThis:this);
