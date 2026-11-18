const {test,expect}=require('@playwright/test');

async function openSettings(page){await page.locator('.nav-item[data-screen="more"]').click();await page.locator('#settingsMenuButton').click();await expect(page.locator('#settingsView')).toBeVisible()}
async function openEntry(page){await page.locator('.nav-item[data-screen="entry"]').click();await expect(page.locator('#entryCard')).toBeVisible()}

test('accounts can be created, balances are guarded, opening edits are simulated, and archives stay out of pickers',async({page})=>{
  await page.setViewportSize({width:360,height:800});await page.addInitScript(()=>localStorage.setItem('pocket-ledger-onboarded','1'));await page.goto('/');
  await expect(page.locator('#entryCard')).toBeVisible();await openSettings(page);
  await page.locator('#addAccountButton').click();await expect(page.locator('#accountEditorDialog')).toBeVisible();
  await page.locator('#accountEditorKind').selectOption('bank');await page.locator('#accountEditorName').fill('SBI');await page.locator('#accountEditorOpening').fill('20000');
  await expect(page.locator('#accountEditorOpening')).toHaveValue('20,000');await expect(page.locator('#accountCurrentPreview')).toContainText('₹20,000');await page.locator('#accountEditorForm button[type=submit]').click();
  await expect(page.locator('#accountEditorDialog')).toBeHidden();await expect(page.locator('#accountManagerList')).toContainText('SBI');await expect(page.locator('#accountManagerList')).toContainText('₹20,000');
  await openEntry(page);await page.locator('#amount').fill('20,001');await page.locator('[data-chip-group="account"] [data-value]').filter({hasText:'SBI'}).click();
  await expect(page.locator('#availabilityError')).toHaveText('Not enough balance in SBI. Available ₹20,000.');await expect(page.locator('#saveButton')).toBeDisabled();
  await page.locator('#amount').fill('15,000');await expect(page.locator('#availabilityError')).toBeEmpty();await page.locator('#saveButton').click();await expect(page.locator('#toast')).toContainText('Saved');
  await openSettings(page);const sbi=page.locator('.account-card').filter({hasText:'SBI'});await sbi.locator('[data-edit-account]').click();
  await page.locator('#accountEditorOpening').fill('1000');await expect(page.locator('#accountOpeningImpact')).toContainText('Current balance changes from ₹5,000 to ₹-14,000');
  page.once('dialog',dialog=>dialog.accept());await page.locator('#accountEditorForm button[type=submit]').click();await expect(page.locator('#accountEditorError')).toContainText('This change would make SBI negative on');
  await page.locator('#accountEditorOpening').fill('25000');page.once('dialog',dialog=>dialog.accept());await page.locator('#accountEditorForm button[type=submit]').click();await expect(sbi).toContainText('₹10,000');
  await expect(sbi.locator('[data-delete-account]')).toBeDisabled();await sbi.locator('[data-archive-account]').click();await expect(sbi).toHaveClass(/archived/);await openEntry(page);await expect(page.locator('[data-chip-group="account"]')).not.toContainText('SBI');await page.locator('#recentEntries [data-edit]').first().click();await expect(page.locator('[data-chip-group="account"] .chip.selected')).toContainText('SBI');
});

test('account sheet keeps Indian amounts readable in light and dark themes',async({page})=>{
  await page.setViewportSize({width:360,height:800});await page.addInitScript(()=>{localStorage.setItem('pocket-ledger-onboarded','1');localStorage.setItem('pocket-ledger-theme','light')});await page.goto('/');await openSettings(page);
  await page.locator('#addAccountButton').click();await page.locator('#accountEditorName').fill('HDFC');await page.locator('#accountEditorOpening').fill('150000');await expect(page.locator('#accountEditorOpening')).toHaveValue('1,50,000');await expect(page.locator('#accountCurrentPreview')).toContainText('₹1,50,000');await page.locator('#accountEditorForm button[type=submit]').click();
  const card=page.locator('.account-card').filter({hasText:'HDFC'});await expect(card).toContainText('₹1,50,000');await expect(card).toBeVisible();
  await page.locator('#themeSelect').selectOption('dark');await expect(page.locator('body')).toHaveClass(/dark-theme/);await expect(card).toBeVisible();await page.locator('#themeSelect').selectOption('light');await expect(page.locator('body')).toHaveClass(/light-theme/);await expect(card).toBeVisible();
  await page.locator('#addAccountButton').click();await page.locator('#accountEditorName').fill('Unused');await page.locator('#accountEditorForm button[type=submit]').click();const unused=page.locator('.account-card').filter({hasText:'Unused'});page.once('dialog',dialog=>dialog.accept());await unused.locator('[data-delete-account]').click();await expect(unused).toHaveCount(0);
});

test('rapid form submissions persist a single account transaction',async({page})=>{
  await page.setViewportSize({width:360,height:800});await page.addInitScript(()=>localStorage.setItem('pocket-ledger-onboarded','1'));await page.goto('/');await page.locator('.kind-button[data-kind="credit"]').click();await page.locator('#typeChips [data-type="Salary"]').click();await page.locator('#amount').fill('20000');await page.locator('#transactionForm').evaluate(form=>{for(let i=0;i<5;i++)form.requestSubmit()});await expect(page.locator('#recentEntries .transaction-row')).toHaveCount(1);await expect(page.locator('#recentEntries')).toContainText('₹20,000');
});

test('legacy negative balances remain visible in Data Check and worsening entries are blocked',async({page})=>{
  await page.setViewportSize({width:360,height:800});await page.addInitScript(()=>localStorage.setItem('pocket-ledger-onboarded','1'));await page.goto('/');
  await page.evaluate(()=>LedgerDB.saveTransaction({id:'legacy-negative',kind:'debit',type:'Daily Expense',amount:100,date:'2026-10-12',accountId:'cash',category:'Food',createdAt:'2026-10-12T10:00:00Z'}));await page.reload();await expect(page.locator('#dataCheckChip')).toBeVisible();
  await page.locator('#dataCheckChip').click();await expect(page.locator('#dataCheckSection')).toBeVisible();await expect(page.locator('#dataCheckList')).toContainText('Cash');await expect(page.locator('#dataCheckList')).toContainText('12 Oct 2026');
  await openEntry(page);await page.locator('#amount').fill('1');await expect(page.locator('#availabilityError')).toHaveText('Not enough balance in Cash. Available ₹0.');await expect(page.locator('#saveButton')).toBeDisabled();
});

test('Cash opening amount shows the exact inline insufficiency message and permits a zero ending balance',async({page})=>{
  await page.setViewportSize({width:360,height:800});await page.addInitScript(()=>localStorage.setItem('pocket-ledger-onboarded','1'));await page.goto('/');await openSettings(page);
  const cash=page.locator('.account-card').filter({hasText:'Cash'});await cash.locator('[data-edit-account]').click();await page.locator('#accountEditorOpening').fill('5000');page.once('dialog',dialog=>dialog.accept());await page.locator('#accountEditorForm button[type=submit]').click();await expect(cash).toContainText('₹5,000');
  await openEntry(page);await page.locator('#amount').fill('5001');await expect(page.locator('#availabilityError')).toHaveText('Not enough balance in Cash. Available ₹5,000.');await expect(page.locator('#saveButton')).toBeDisabled();
  await page.locator('#amount').fill('5000');await expect(page.locator('#availabilityError')).toBeEmpty();await page.locator('#saveButton').click();await expect(page.locator('#recentEntries')).toContainText('Available ₹0');
});

test('welcome tour adds a skippable account setup step that opens account management',async({page})=>{
  await page.setViewportSize({width:360,height:800});await page.addInitScript(()=>localStorage.removeItem('pocket-ledger-onboarded'));await page.goto('/');await expect(page.locator('#welcomeTour')).toBeVisible();await expect(page.locator('#tourCards .tour-slide')).toHaveCount(4);
  await page.locator('#tourCards').evaluate(el=>{el.scrollLeft=el.scrollWidth});await expect(page.locator('#tourNext')).toHaveText('Start using Pocket Ledger');await page.locator('#tourSetupAccounts').click();await expect(page.locator('#welcomeTour')).toBeHidden();await expect(page.locator('#settingsView')).toBeVisible();await expect(page.locator('#accountManagerList')).toContainText('Cash');
});
