const {test,expect}=require('@playwright/test');

test('existing holdings and investment sale workflow do not invent cash movements',async({page})=>{
  await page.setViewportSize({width:360,height:800});
  await page.addInitScript(()=>localStorage.setItem('pocket-ledger-onboarded','1'));
  await page.goto('/');

  await page.locator('.kind-button[data-kind="credit"]').click();
  await page.locator('#typeChips [data-type="Salary"]').click();
  await page.locator('#amount').fill('30000');
  await page.locator('#saveButton').click();
  await expect(page.locator('#toast')).toContainText('Saved');

  await page.locator('.kind-button[data-kind="debit"]').click();
  await page.locator('#typeChips [data-type="Investment"]').click();
  await page.locator('#investmentName').fill('HDFC SIP');
  await page.locator('#amount').fill('10000');
  await page.locator('#saveButton').click();
  await expect(page.locator('#investmentAddedNudge')).toBeVisible();
  await page.locator('#openInvestmentAfterSave').click();
  await expect(page.locator('#investmentDetailView')).toBeVisible();
  await expect(page.locator('#investmentDetailTotals')).toContainText('₹10,000');
  await page.locator('.nav-item[data-screen="dashboard"]').click();
  await expect(page.locator('#dashboardAvailable')).toContainText('₹20,000');
  await page.locator('#investmentSummaryCard').click();

  await page.locator('#addExistingInvestment').click();
  await page.locator('#existingInvestmentName').fill('Old Gold');
  await page.locator('#existingInvestmentKind').selectOption('Gold');
  await page.locator('#existingInvestmentAmount').fill('2000');
  await page.locator('#existingInvestmentValue').fill('2500');
  await page.locator('#existingInvestmentForm button[type="submit"]').click();
  await page.locator('.nav-item[data-screen="dashboard"]').click();
  await expect(page.locator('#investmentTotal')).toContainText('₹12,000');
  await expect(page.locator('#dashboardAvailable')).toContainText('₹20,000');

  await page.locator('.nav-item[data-screen="entry"]').click();
  await page.locator('.kind-button[data-kind="credit"]').click();
  await page.locator('#typeChips [data-type="Investment Profit"]').click();
  await page.locator('#investmentName').fill('HDFC SIP');
  await page.locator('#amount').fill('1500');
  await page.locator('#saveButton').click();
  await expect(page.locator('#recentEntries')).toContainText('Investment Profit');

  await page.locator('.nav-item[data-screen="dashboard"]').click();
  await page.locator('#investmentSummaryCard').click();
  await page.locator('#investmentList [data-investment-name="HDFC SIP"]').click();
  await page.locator('#openInvestmentSale').click();
  await page.locator('#investmentSaleReceived').fill('11500');
  await page.locator('#investmentSaleCost').fill('10000');
  await page.locator('#investmentSaleForm button[type="submit"]').click();
  await expect(page.locator('#investmentDetailTotals')).toContainText('₹0');
  await expect(page.locator('#investmentHistoryList')).toContainText('Profit ₹1,500');
  await page.locator('.nav-item[data-screen="entry"]').click();
  await expect(page.locator('#recentEntries')).toContainText('Investment Sale');
  await expect(page.locator('#recentEntries')).toContainText('Realized P/L: +₹1,500');
  await page.locator('.nav-item[data-screen="dashboard"]').click();
  await page.locator('#investmentSummaryCard').click();
  await page.locator('#investmentList [data-investment-name="HDFC SIP"]').click();
  await page.locator('#investmentHistoryList [data-investment-edit]').first().click();
  await page.locator('#investmentSaleReceived').fill('12000');
  await page.locator('#investmentSaleForm button[type="submit"]').click();
  await expect(page.locator('#investmentHistoryList')).toContainText('Profit ₹2,000');
  await page.locator('.nav-item[data-screen="dashboard"]').click();
  await expect(page.locator('#monthlyCards')).toContainText('₹33,500');
  await expect(page.locator('#dashboardAvailable')).toContainText('₹33,500');
});
