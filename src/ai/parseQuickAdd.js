// Pure local parser. It never writes data or calls a network service.
(function (root) {
  const kw = typeof module !== 'undefined' && module.exports
    ? require('./keywords.js') : root.PocketLedgerQuickAddKeywords;
  const flat = s => String(s || '').toLocaleLowerCase().normalize('NFKC').replace(/[.,;:!?()[\]{}]/g, ' ').replace(/\s+/g, ' ').trim();
  const has = (text, words) => words.some(w => flat(text).includes(flat(w)));
  const amountRegex = /₹?\s*(\d[\d,]*(?:\.\d+)?)\s*(k|thousand|lakh|lac|l)?\b/giu;
  function parseAmount(text) {
    const values = [];
    const withoutDates=String(text).replace(/\b20\d{2}-\d{1,2}-\d{1,2}\b/g,' ').replace(/\b\d{1,2}[/-]\d{1,2}[/-]20\d{2}\b/g,' ');
    for (const m of withoutDates.matchAll(amountRegex)) {
      const raw = m[1].replaceAll(',', '');
      let value = Number(raw), suffix = (m[2] || '').toLowerCase();
      if (suffix === 'k' || suffix === 'thousand') value *= 1000;
      if (['l','lac','lakh'].includes(suffix)) value *= 100000;
      if (Number.isFinite(value) && value > 0) values.push(value);
    }
    return values;
  }
  function distance(a, b) {
    const row = Array.from({length:b.length + 1}, (_, i) => i);
    for (let i=1;i<=a.length;i++) { let prev=row[0]; row[0]=i; for (let j=1;j<=b.length;j++) { const old=row[j]; row[j]=Math.min(row[j]+1,row[j-1]+1,prev+(a[i-1]===b[j-1]?0:1)); prev=old; } }
    return row[b.length];
  }
  function matchNamed(text, records, field) {
    const list = records || [];
    const clean = flat(text);
    let exact = list.find(x => clean.includes(flat(field ? x[field] : x.name)));
    if (exact) return {record:exact,confidence:0.98};
    const words = clean.split(' ').filter(x=>/\p{L}/u.test(x)&&!['to','from','ne','e','ko','se','udhar','udhaar','give','gave','borrowed','loan'].includes(x));
    let best=null,score=Infinity;
    for (const record of list) {
      const name=flat(field ? record[field] : record.name);
      const count=name.split(' ').length;
      for (let size=Math.max(1,count-1);size<=count+1;size++)for(let i=0;i<=words.length-size;i++){const candidate=words.slice(i,i+size).join(' '),d=distance(candidate,name);if(d<score){score=d;best=record}}
    }
    return best && score<=2 ? {record:best,confidence:score===1?0.78:0.62} : null;
  }
  function parseDate(text, today) {
    const base = new Date(`${today || new Date().toISOString().slice(0,10)}T00:00:00`);
    const localDate=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (has(text,kw.yesterday)) {base.setDate(base.getDate()-1);return localDate(base)}
    if (has(text,kw.tomorrow)) {base.setDate(base.getDate()+1);return localDate(base)}
    if (has(text,kw.today)) return localDate(base);
    let m=String(text).match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
    if (m) return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
    m=String(text).match(/\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b/);
    if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
    return today || new Date().toISOString().slice(0,10);
  }
  function maybeSms(text) { return /(debited|credited|withdrawn|spent|paid to|received from|upi\/|txn|transaction|a\/c|account)/i.test(text); }
  function parseQuickAdd(input, context={}) {
    const digitText=String(input||'').replace(/[૦-૯]/g,d=>String('૦૧૨૩૪૫૬૭૮૯'.indexOf(d))).replace(/[०-९]/g,d=>String('०१२३४५६७८९'.indexOf(d)));
    const text=digitText.trim(), normalized=flat(text), amounts=parseAmount(text), isSms=maybeSms(text);
    const investments=kw.investment;
    const isInvestment=has(normalized,investments);
    let type='Daily Expense',kind='debit',confidence=0.55;
    if (has(normalized,kw.receivedBack)) {type='Udhar Received Back';kind='credit';confidence=0.88}
    else if (has(normalized,kw.udharGiven)) {type='Udhar Given';kind='debit';confidence=0.86}
    else if (has(normalized,kw.udharTaken)) {type='Udhar Taken';kind='credit';confidence=0.86}
    else if (has(normalized,kw.repaid)) {type='Udhar Repaid';kind='debit';confidence=0.82}
    else if (has(normalized,kw.salary)) {type='Salary';kind='credit';confidence=0.9}
    else if (has(normalized,kw.investmentLoss)) {type='Investment Loss';kind='debit';confidence=0.82}
    else if (isInvestment) {type='Investment';kind='debit';confidence=0.84}
    else if (has(normalized,kw.sideIncome)) {type='Side Income';kind='credit';confidence=0.82}
    else if (has(normalized,kw.credit)) {type='Side Income';kind='credit';confidence=0.68}
    else if (has(normalized,kw.expense)) {type='Daily Expense';kind='debit';confidence=0.76}
    const names=context.people||[], accounts=context.accounts||[];
    let personMatch=matchNamed(text,names), person=personMatch?.record||null;
    if (!person && ['Udhar Given','Udhar Taken','Udhar Received Back','Udhar Repaid'].includes(type)) {
      const beforeAmount=text.split(/₹?\s*\d[\d,]*(?:\.\d+)?\s*(?:k|lakh|lac|thousand)?/i)[0];
      const candidates=beforeAmount.replace(/\b(to|from|ne|e|ko|se|udhar|udhaar|give|gave|borrowed|loan)\b/gi,' ').trim().split(/\s+/).filter(x=>/[\p{L}]/u.test(x));
      const candidate=candidates.slice(-2).join(' ').replace(/[\p{P}\p{S}]+/gu,' ').trim();
      if(candidate && !has(candidate,[...kw.udharGiven,...kw.udharTaken,...kw.repaid])) person={id:null,name:candidate,unknown:true};
    }
    const accountMatch=matchNamed(text,accounts,'name');
    let account=accountMatch?.record||null;
    if (!account && has(normalized,kw.cash)) account=accounts.find(a=>flat(a.name)==='cash')||null;
    if (!account && has(normalized,kw.upi)) account=accounts.find(a=>a.kind==='bank')||null;
    if (!account && has(normalized,kw.bank)) account=accounts.find(a=>a.kind==='bank')||null;
    if (!account) account=accounts.find(a=>a.id===context.defaultAccountId)||accounts[0]||null;
    let category='';
    const categoryMap={Food:['chai','tea','coffee','food','grocery','lunch','dinner','breakfast','ચા','ખાધું'],Fuel:['petrol','diesel','fuel','પેટ્રોલ'],Travel:['bus','taxi','train','metro','travel','cab'],Bills:['bill','electricity','internet','recharge'],Shopping:['shopping','bought','shirt','store'],Medical:['medicine','doctor','દવા'],Rent:['rent','ભાડું']};
    for(const [cat,words] of Object.entries(categoryMap)) if(has(normalized,words)){category=cat;break}
    const date=parseDate(text,context.today);
    const rawAmounts=amounts;
    let note=text.replace(/₹?\s*\d[\d,]*(?:\.\d+)?\s*(?:k|lakh|lac|thousand)?/ig,' ').replace(/\b(today|yesterday|tomorrow|aaje|aaj|kal|kaal)\b/ig,' ').replace(/\s+/g,' ').trim();
    const merchant=(text.match(/\b(?:to|at|from)\s+([\p{L}\p{N} &.'-]{2,40}?)(?=\s+(?:on|ref|upi|txn|a\/?c|\d)|[.,;]|$)/iu)||[])[1]?.trim()||'';
    if (isSms && !context.saveOriginalText) note=merchant;
    if (isSms && context.saveOriginalText) note=text;
    let investmentName='';
    if(['Investment','Investment Profit','Investment Loss'].includes(type)){
      const clean=text.replace(/₹?\s*\d[\d,]*(?:\.\d+)?\s*(?:k|lakh|lac|thousand)?/ig,' ').replace(/\b(today|yesterday|tomorrow|aaje|aaj|kal|kaal)\b/ig,' ').replace(/\b(cash|upi|gpay|phonepe|paytm|bank|profit|loss|invested|invest|investment|sip|stocks?|shares?|gold|fd|mutual fund|crypto)\b/ig,' ').replace(/\s+/g,' ').trim();
      investmentName=clean;
    }
    const negative=/(not\s+(?:spent|spend|paid|debited)|didn['’]?t\s+(?:spend|pay)|no\s+(?:expense|payment)|refund\s+not)/i.test(text);
    const question=amounts.length===0?'amount':amounts.length>1?'amountChoice':person?.unknown?'person':negative?'confirmMeaning':'';
    if (amounts.length===1) confidence+=0.18; if (personMatch) confidence+=0.08; if(accountMatch)confidence+=0.05; if(question)confidence=Math.min(confidence,0.45);
    return {text,kind,type,amount:amounts[0]||0,amounts:rawAmounts,date,note,person,account,category,investmentName,confidence:Math.max(0,Math.min(0.99,confidence)),question,isSms,last4:(text.match(/(?:\*|x|X){2,}(\d{4})\b/)||[])[1]||'',rawTextSaved:!!context.saveOriginalText};
  }
  const api={parseQuickAdd,parseAmount,matchNamed};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PocketLedgerQuickAdd=api;
})(typeof globalThis!=='undefined'?globalThis:this);
