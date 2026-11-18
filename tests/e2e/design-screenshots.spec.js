const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');

test('capture the requested 360px screens in light and dark themes',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium','Canonical design screenshots use desktop Chromium at a fixed 360px viewport.');
  test.setTimeout(120000);
  const output=path.join(process.cwd(),'screenshots');fs.mkdirSync(output,{recursive:true});
  await page.setViewportSize({width:360,height:800});
  await page.addInitScript(()=>localStorage.setItem('pocket-ledger-onboarded','1'));
  for(const theme of ['light','dark']){
    await page.goto('/');
    await page.evaluate(value=>localStorage.setItem('pocket-ledger-theme',value),theme);await page.reload();
    await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important}'});
    await expect(page.locator('body')).toHaveClass(new RegExp(`${theme}-theme`));
    await page.locator('.nav-item[data-screen="dashboard"]').click();
    const demo=page.locator('#dashboardTryDemo');if(await demo.isVisible())await demo.click();
    await expect(page.locator('#dashboardAvailable')).toBeVisible();
    await page.waitForTimeout(1900);
    const capture=async(name,{preserveScroll=false}={})=>{if(!preserveScroll)await page.evaluate(()=>window.scrollTo(0,0));return page.screenshot({path:path.join(output,`${name}-${theme}-360.png`)})};
    await capture('dashboard');
    await page.locator('.nav-item[data-screen="entry"]').click();await capture('entry');
    await page.locator('.nav-item[data-screen="outstanding"]').click();await capture('outstanding');
    await page.locator('.nav-item[data-screen="reminders"]').click();await capture('reminders');
    await page.locator('.nav-item[data-screen="dashboard"]').click();await page.locator('#investmentSummaryCard').click();await capture('investments');
    await page.locator('#backToDashboardFromInvestments').click();
    await page.locator('#dashboardManageAccounts').click();await page.locator('#accountManagerList').scrollIntoViewIfNeeded();await capture('accounts',{preserveScroll:true});
    await page.locator('.nav-item[data-screen="more"]').click();await page.locator('[data-more="reports"]').click();await capture('reports');
    await page.locator('.nav-item[data-screen="more"]').click();await page.locator('#settingsMenuButton').click();await capture('settings');
  }
});
