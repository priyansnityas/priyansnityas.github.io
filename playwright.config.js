const {defineConfig,devices}=require('@playwright/test');
module.exports=defineConfig({
  testDir:'./tests/e2e',
  timeout:60000,
  fullyParallel:false,
  reporter:'list',
  use:{baseURL:'http://127.0.0.1:4173',...devices['Desktop Chrome'],serviceWorkers:'allow',acceptDownloads:true},
  projects:[
    {name:'chromium'},
    {name:'firefox',use:{browserName:'firefox'}},
    {name:'webkit',use:{browserName:'webkit'}},
    {name:'mobile-chromium',use:{...devices['Pixel 7']}},
    {name:'mobile-webkit',use:{...devices['iPhone 13']}}
  ],
  webServer:{command:'node tests/e2e/server.js',url:'http://127.0.0.1:4173',reuseExistingServer:!process.env.CI,timeout:15000}
});
