// Editable, local dictionaries for the offline Quick Add parser.
(function (root) {
  const keywords = {
    credit: ['salary','income','received','credited','dividend','interest','maturity','aaya','aayi','mila','mili','jama','આવક','મળ્યા','મળ્યું','જમા','ક્રેડિટ','આવ્યા'],
    expense: ['expense','spent','spend','paid','bought','chai','tea','coffee','petrol','fuel','grocery','groceries','food','bus','taxi','rent','bill','kharch','ખર્ચ','ચા','પેટ્રોલ','ભાડું','બિલ','ખાધું','ખરીદી'],
    investment: ['invest','investment','sip','stocks','stock','shares','gold','fd','mutual fund','crypto','રોકાણ','સિપ','શેર'],
    investmentLoss: ['investment loss','loss on','value dropped','મૂલ્ય ઘટ્યું','નુકસાન'],
    salary: ['salary','પગાર','તનખ્વાહ'],
    sideIncome: ['side income','freelance','bonus','વ્યાજ','અન્ય આવક'],
    udharGiven: ['udhar diya','udhaar diya','lend','lent','gave','give','aapya','aapyu','આપ્યા','આપ્યું','આપ્યો','ઉધાર આપ્યું','ઉધાર આપ્યા'],
    udharTaken: ['udhar liya','udhaar liya','borrow','borrowed','liya','liye','લીધું','લીધા','ઉધાર લીધું'],
    receivedBack: ['received back','got back','returned','parat karya','parat karyu','wapas mila','વાપસ મળ્યા','પાછા મળ્યા','પાછા કર્યા','પાછું મળ્યું','પરત કર્યા','પરત કર્યું'],
    repaid: ['repaid','paid back','chukaya','chukavyu','ચૂકવ્યા','ચૂકવ્યું','પાછા આપ્યા'],
    today: ['today','aaje','aaj','આજે'],
    yesterday: ['yesterday','kal','kaal','ગઈકાલે','ગઇકાલે'],
    tomorrow: ['tomorrow','કાલે','કાલ'],
    cash: ['cash','રોકડ'],
    upi: ['upi','gpay','phonepe','paytm'],
    card: ['card','કાર્ડ'],
    bank: ['bank','બેંક']
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = keywords;
  else root.PocketLedgerQuickAddKeywords = keywords;
})(typeof globalThis !== 'undefined' ? globalThis : this);
