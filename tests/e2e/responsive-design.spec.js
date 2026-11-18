const {test,expect}=require('@playwright/test');

test('layout stays within the viewport and nav targets remain touch sized',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium','Responsive checks use desktop Chromium at explicit CSS widths.');
  await page.addInitScript(()=>localStorage.setItem('pocket-ledger-onboarded','1'));
  await page.goto('/');
  await page.locator('.nav-item[data-screen="dashboard"]').click();
  const demo=page.locator('#dashboardTryDemo');if(await demo.isVisible())await demo.click();
  for(const width of [320,360,390,768,1280]){
    await page.setViewportSize({width,height:850});
    for(const screen of ['dashboard','entry','outstanding','reminders']){
      await page.locator(`.nav-item[data-screen="${screen}"]`).click();
      const measurements=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,innerWidth,nav:[...document.querySelectorAll('.nav-item')].map(item=>{const r=item.getBoundingClientRect();return {width:r.width,height:r.height}})}));
      expect(measurements.scrollWidth,`${screen} at ${width}px`).toBeLessThanOrEqual(measurements.innerWidth);
      expect(measurements.nav).toHaveLength(5);
      expect(measurements.nav.every(box=>box.width>=40&&box.height>=48),`navigation touch targets at ${width}px`).toBe(true);
    }
  }
});
