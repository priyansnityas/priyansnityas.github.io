const {test,expect}=require('@playwright/test');
const fs=require('node:fs');

test('onboarding, demo, Quick Add, reminder link, backups, and offline shell',async({page,context,browserName})=>{
  const pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));
  await page.goto('/');
  await expect.poll(()=>page.locator('#welcomeTour').evaluate(el=>!el.hidden)).toBe(true);await page.locator('#skipTour').click();
  await expect(page.locator('#entryCard')).toBeVisible();await page.setViewportSize({width:360,height:800});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await expect(page.locator('.nav-item[data-screen="entry"]')).toHaveClass(/selected/);await expect(page.locator('.kind-button[data-kind="debit"]')).toHaveClass(/active/);await expect(page.locator('#typeChips .chip.selected')).toContainText('Daily Expense');await expect(page.locator('[data-chip-group="account"] .chip.selected')).toContainText('Cash');
  await page.locator('.nav-item[data-screen="dashboard"]').click();const demo=page.locator('#dashboardTryDemo');if(await demo.isVisible())await demo.click();
  await page.locator('.nav-item[data-screen="entry"]').click();
  await page.locator('#quickAddInput').fill('chai 20 cash');await page.locator('#parseQuickAddButton').click();
  await expect(page.locator('#quickAddPreview')).toBeVisible();await page.locator('#confirmQuickAdd').click();
  await expect(page.locator('#recentEntries')).toContainText('chai');
  await page.locator('.nav-item[data-screen="dashboard"]').click();await expect(page.locator('#smartInsightsList')).toBeVisible();

  await page.locator('.nav-item[data-screen="outstanding"]').click();
  await page.locator('#outstandingPeople button').filter({hasText:'Rahul'}).first().click();
  await page.locator('#personPhone').fill('+91 98765 43210');await page.locator('#savePersonDetails').click();
  let whatsappUrl='';await context.route('https://wa.me/**',route=>{whatsappUrl=route.request().url();return route.fulfill({status:200,contentType:'text/plain',body:'offline smoke test'})});
  const popupPromise=page.waitForEvent('popup');await page.locator('#remindWhatsApp').click();const popup=await popupPromise;
  await expect.poll(()=>whatsappUrl).toContain('https://wa.me/919876543210?text=');await popup.close();

  await page.locator('.nav-item[data-screen="more"]').click();await page.locator('#settingsMenuButton').click();
  const plainDownload=page.waitForEvent('download');await page.locator('#exportBackupButton').click();const plain=await plainDownload;const plainPath=await plain.path();expect(JSON.parse(fs.readFileSync(plainPath,'utf8')).checksum).toBeTruthy();
  page.on('dialog',dialog=>dialog.accept('ledger-passphrase-123'));
  const encryptedDownload=page.waitForEvent('download');await page.locator('#exportEncryptedBackupButton').click();const encrypted=await encryptedDownload;const encryptedPath=await encrypted.path();expect(JSON.parse(fs.readFileSync(encryptedPath,'utf8')).format).toBe('pocket-ledger-encrypted');
  await page.locator('#backupFileInput').setInputFiles(plainPath);await expect(page.locator('#restoreOverlay')).toBeVisible();await page.locator('#cancelRestoreButton').click();
  await page.locator('#backupFileInput').setInputFiles(encryptedPath);await expect(page.locator('#restoreOverlay')).toBeVisible();await page.locator('#cancelRestoreButton').click();
  await page.locator('#backupFileInput').setInputFiles(plainPath);await expect(page.locator('#restoreOverlay')).toBeVisible();const safetyCopy=page.waitForEvent('download');await page.locator('#replaceBackupButton').click();await safetyCopy;await expect(page.locator('#restoreOverlay')).toBeHidden();await expect(page.locator('#toast')).toContainText('Restore complete.');await page.locator('.nav-item[data-screen="entry"]').click();await expect(page.locator('#recentEntries')).toContainText('chai');
  await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
  if(browserName==='chromium'){await context.setOffline(true);await page.reload();await expect(page.locator('#entryCard')).toBeVisible();await expect(page.locator('.kind-button[data-kind="debit"]')).toHaveClass(/active/)}
  expect(pageErrors).toEqual([]);
});
