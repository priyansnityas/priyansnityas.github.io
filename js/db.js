// Small IndexedDB wrapper. localStorage is used only if IndexedDB is unavailable.
window.LedgerDB = (() => {
  const DB_NAME='pocket-ledger', DB_VERSION=6;
  let dbPromise;
  function openDB(){
    if(!('indexedDB' in window)) return Promise.resolve(null);
    if(dbPromise) return dbPromise;
    dbPromise=new Promise((resolve,reject)=>{
      const request=indexedDB.open(DB_NAME,DB_VERSION);
      request.onupgradeneeded=()=>{const db=request.result,tx=request.transaction;let transactions;if(!db.objectStoreNames.contains('transactions'))transactions=db.createObjectStore('transactions',{keyPath:'id'});else transactions=tx.objectStore('transactions');for(const [name,path] of [['date','date'],['personId','person.id'],['accountId','accountId'],['type','type']])if(!transactions.indexNames.contains(name))transactions.createIndex(name,path,{unique:false});if(!db.objectStoreNames.contains('people'))db.createObjectStore('people',{keyPath:'id'});if(!db.objectStoreNames.contains('accounts'))db.createObjectStore('accounts',{keyPath:'id'});if(!db.objectStoreNames.contains('reminders'))db.createObjectStore('reminders',{keyPath:'id'});if(!db.objectStoreNames.contains('budgets'))db.createObjectStore('budgets',{keyPath:'id'});if(!db.objectStoreNames.contains('recurring'))db.createObjectStore('recurring',{keyPath:'id'});if(!db.objectStoreNames.contains('recurringDrafts'))db.createObjectStore('recurringDrafts',{keyPath:'id'});if(!db.objectStoreNames.contains('investmentRecords'))db.createObjectStore('investmentRecords',{keyPath:'id'});};
      request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
    });
    return dbPromise;
  }
  function fallbackKey(store){return `pocket-ledger-${store}`;}
  const STORE_NAMES=['transactions','people','accounts','reminders','budgets','recurring','recurringDrafts','investmentRecords'];
  function fallbackAll(store){const raw=localStorage.getItem(fallbackKey(store));if(!raw)return [];const rows=JSON.parse(raw);if(!Array.isArray(rows))throw new Error(`Stored ${store} data is unreadable.`);return rows}
  async function all(store){const db=await openDB();if(!db)return fallbackAll(store);return new Promise((resolve,reject)=>{const req=db.transaction(store,'readonly').objectStore(store).getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error)})}
  async function put(store,value){const db=await openDB();if(!db){const rows=fallbackAll(store);const i=rows.findIndex(x=>x.id===value.id);if(i<0)rows.push(value);else rows[i]=value;localStorage.setItem(fallbackKey(store),JSON.stringify(rows));return value}return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value);tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error)})}
  async function remove(store,id){const db=await openDB();if(!db){localStorage.setItem(fallbackKey(store),JSON.stringify(fallbackAll(store).filter(x=>x.id!==id)));return}return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}
  async function clear(store){const db=await openDB();if(!db){localStorage.removeItem(fallbackKey(store));return}return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).clear();tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}
  async function replaceAll(data){
    const rows={transactions:data.transactions||[],people:data.people||[],accounts:data.accounts||[],reminders:data.reminders||[],budgets:data.budgets||[],recurring:data.recurringEntries||[],recurringDrafts:data.recurringDrafts||[],investmentRecords:data.investmentRecords||[]};
    const db=await openDB();
    if(!db){
      const previous=new Map(STORE_NAMES.map(name=>[name,localStorage.getItem(fallbackKey(name))]));
      try{for(const name of STORE_NAMES)localStorage.setItem(fallbackKey(name),JSON.stringify(rows[name]))}
      catch(error){for(const [name,value] of previous){if(value===null)localStorage.removeItem(fallbackKey(name));else localStorage.setItem(fallbackKey(name),value)}throw error}
      return;
    }
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE_NAMES,'readwrite');
      for(const name of STORE_NAMES){const store=tx.objectStore(name);store.clear();for(const row of rows[name])store.put(row)}
      tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||new Error('Storage replacement aborted'));tx.onerror=()=>reject(tx.error||new Error('Storage replacement failed'));
    });
  }
  return {all,put,remove,clear,replaceAll,transactions:()=>all('transactions'),people:()=>all('people'),accounts:()=>all('accounts'),reminders:()=>all('reminders'),budgets:()=>all('budgets'),recurring:()=>all('recurring'),recurringDrafts:()=>all('recurringDrafts'),investmentRecords:()=>all('investmentRecords'),saveInvestmentRecord:x=>put('investmentRecords',x),deleteInvestmentRecord:id=>remove('investmentRecords',id),saveBudget:x=>put('budgets',x),deleteBudget:id=>remove('budgets',id),saveRecurring:x=>put('recurring',x),deleteRecurring:id=>remove('recurring',id),saveRecurringDraft:x=>put('recurringDrafts',x),deleteRecurringDraft:id=>remove('recurringDrafts',id),saveTransaction:x=>put('transactions',x),deleteTransaction:id=>remove('transactions',id),savePerson:x=>put('people',x),deletePerson:id=>remove('people',id),saveAccount:x=>put('accounts',x),deleteAccount:id=>remove('accounts',id),saveReminder:x=>put('reminders',x),deleteReminder:id=>remove('reminders',id)};
})();
