const CACHE_NAME='pocket-ledger-v24';
const APP_FILES=['./','./index.html','./manifest.json','./css/style.css','./js/translations.js','./js/db.js','./js/theme-init.js','./js/app.js','./js/visualEffects.js','./assets/icons.svg','./src/data/migrate.js','./src/data/money.js','./src/data/accountBalances.js','./src/data/csv.js','./src/data/references.js','./src/data/backupValidation.js','./src/data/backupCrypto.js','./src/data/performance.js','./src/data/investmentLedger.js','./src/data/statements.js','./src/ai/keywords.js','./src/ai/parseQuickAdd.js','./src/ai/insights.js','./src/ai/budgets.js','./src/ai/recurring.js','./src/ai/forecast.js','./src/ai/reminderMessages.js','./src/ai/experimentalAssistant.js','./assets/icon.svg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  event.respondWith((async()=>{
    try{
      const cached=await caches.match(event.request);
      if(cached)return cached;
    }catch{}
    try{
      const response=await fetch(event.request);
      if(response.ok){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy)).catch(()=>{});}
      return response;
    }catch{
      if(event.request.mode==='navigate'){
        try{
          const shell=await caches.match(new URL('./index.html',self.registration.scope).href);
          if(shell)return shell;
        }catch{}
      }
      return new Response('Offline. This page is not in the app cache.',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}});
    }
  })().catch(()=>new Response('Offline. This page is not in the app cache.',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}})));
});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(windows=>{const existing=windows.find(client=>client.url.includes(self.location.origin));if(existing)return existing.focus();return clients.openWindow(event.notification.data?.url||'./')}))});
