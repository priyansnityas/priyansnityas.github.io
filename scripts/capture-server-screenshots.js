// Save fresh screenshots of the currently running Pocket Ledger server.
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');

(async()=>{
  const baseURL=process.env.LEDGER_SCREENSHOT_URL||'http://localhost:3000';
  const output=path.join(__dirname,'..','screenshots');
  fs.mkdirSync(output,{recursive:true});
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext();
  await context.addInitScript(()=>{
    localStorage.setItem('pocket-ledger-onboarded','1');
    localStorage.setItem('pocket-ledger-theme','dark');
    localStorage.setItem('pocket-ledger-visual-effects','lite');
  });
  const page=await context.newPage();
  for(const width of [360,1280]){
    await page.setViewportSize({width,height:900});
    await page.goto(baseURL,{waitUntil:'networkidle'});
    await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important}'});
    await page.locator('.nav-item[data-screen="dashboard"]').click();
    const demo=page.locator('#dashboardTryDemo');if(await demo.isVisible())await demo.click();
    await page.waitForTimeout(1800);
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:path.join(output,`dashboard-server-${width}.png`)});
    await page.locator('.nav-item[data-screen="entry"]').click();
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:path.join(output,`entry-server-${width}.png`)});
  }
  await context.close();
  await browser.close();
})().catch(error=>{console.error(error);process.exitCode=1});
