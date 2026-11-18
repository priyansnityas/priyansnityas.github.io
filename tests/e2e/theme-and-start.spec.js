const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');

test('cold start uses Entry, Debit and Cash; theme changes are immediate and remembered',async({page})=>{
  await page.setViewportSize({width:360,height:800});
  const browserErrors=[];page.on('pageerror',error=>browserErrors.push(error.stack));page.on('console',message=>{if(message.type()==='error')browserErrors.push(message.text()+String(message.location()?.url||''))});
  await page.addInitScript(()=>{if(!localStorage.getItem('pocket-ledger-theme'))localStorage.setItem('pocket-ledger-theme','light');localStorage.setItem('pocket-ledger-onboarded','1')});
  await page.goto('/');
  await expect(page.locator('#entryCard')).toBeVisible();
  await expect(page.locator('.nav-item[data-screen="entry"]')).toHaveClass(/selected/);
  await expect(page.locator('.kind-button[data-kind="debit"]')).toHaveClass(/active/);
  await expect(page.locator('#typeChips .chip.selected')).toContainText('Daily Expense');
  await expect(page.locator('[data-chip-group="account"] .chip.selected')).toContainText('Cash');
  await expect(page.locator('#amount')).toHaveValue('');
  await expect(page.locator('#date')).toHaveValue(await page.evaluate(()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}));
  await expect(page.locator('body')).toHaveClass(/light-theme/);

  await page.locator('.kind-button[data-kind="credit"]').click();
  await page.locator('#typeChips [data-type="Salary"]').click();
  await page.locator('#amount').fill('50');
  await page.locator('#saveButton').click();
  await expect(page.locator('.kind-button[data-kind="credit"]')).toHaveClass(/active/);
  await page.locator('#themeToggle').click();
  await expect(page.locator('body')).toHaveClass(/dark-theme/);
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('pocket-ledger-theme'))).toBe('dark');

  await page.reload();
  await expect(page.locator('#entryCard')).toBeVisible();
  await expect(page.locator('.kind-button[data-kind="debit"]')).toHaveClass(/active/);
  await expect(page.locator('#typeChips .chip.selected')).toContainText('Daily Expense');
  await expect(page.locator('[data-chip-group="account"] .chip.selected')).toContainText('Cash');
  await expect(page.locator('body')).toHaveClass(/dark-theme/);
  await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
  expect(browserErrors,`browser console errors: ${browserErrors.join(' | ')}`).toEqual([]);
});

test('all visible text meets AA contrast in both themes across screens',async({page,browserName},testInfo)=>{
  test.skip(browserName!=='chromium','Cross-screen color sampling and screenshot audit run in Chromium.');
  test.setTimeout(150000);
  await page.setViewportSize({width:360,height:800});
  const browserErrors=[];page.on('pageerror',error=>browserErrors.push(error.message));page.on('console',message=>{if(message.type()==='error')browserErrors.push(message.text())});
  await page.addInitScript(()=>{if(!localStorage.getItem('pocket-ledger-theme'))localStorage.setItem('pocket-ledger-theme','light');localStorage.setItem('pocket-ledger-onboarded','1')});
  await page.goto('/');
  await page.locator('.nav-item[data-screen="dashboard"]').click();
  await page.locator('#dashboardTryDemo').click();
  await page.locator('.nav-item[data-screen="entry"]').click();
  await page.locator('#typeChips [data-type="Investment"]').click();
  await page.locator('#amount').fill('100');
  await page.locator('[data-chip-group="investmentKind"] [data-value="SIP"]').click();
  await page.locator('#investmentName').fill('HDFC SIP');
  await page.locator('#saveButton').click();
  await expect(page.locator('.toast.show')).toContainText('Saved');

  const inspect=async(screen)=>{
    await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important}' });
    const issues=await page.evaluate(label=>{
      const parse=value=>{
        const ctx=document.createElement('canvas').getContext('2d');ctx.fillStyle='rgba(0,0,0,0)';ctx.fillStyle=value;const normalized=ctx.fillStyle;
        let m=normalized.match(/^rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:\s*[,/]\s*([\d.]+)%?)?\s*\)$/i);
        if(m)return [+m[1],+m[2],+m[3],m[4]===undefined?1:(+m[4]>1?+m[4]/100:+m[4])];
        m=normalized.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)$/i);
        if(m)return [+m[1]*255,+m[2]*255,+m[3]*255,m[4]===undefined?1:+m[4]];
        m=normalized.match(/^#([\da-f]{3}|[\da-f]{6})$/i);if(m){const h=m[1].length===3?[...m[1]].map(x=>parseInt(x+x,16)):[parseInt(m[1].slice(0,2),16),parseInt(m[1].slice(2,4),16),parseInt(m[1].slice(4,6),16)];return [...h,1]}
        return null;
      };
      const blend=(top,bottom)=>{const a=top[3]+bottom[3]*(1-top[3]);if(!a)return [255,255,255,1];return [(top[0]*top[3]+bottom[0]*bottom[3]*(1-top[3]))/a,(top[1]*top[3]+bottom[1]*bottom[3]*(1-top[3]))/a,(top[2]*top[3]+bottom[2]*bottom[3]*(1-top[3]))/a,a]};
      const lum=color=>{const channels=color.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*channels[0]+.7152*channels[1]+.0722*channels[2]};
      const ratio=(a,b)=>{const [hi,lo]=[lum(a),lum(b)].sort((x,y)=>y-x);return (hi+.05)/(lo+.05)};
      const visible=el=>{const s=getComputedStyle(el);if(!el.getClientRects().length||s.display==='none'||s.visibility==='hidden')return false;let opacity=1;for(let n=el;n;n=n.parentElement)opacity*=Number(getComputedStyle(n).opacity||1);return opacity>0.001};
      const textElements=[...document.querySelectorAll('body *')].filter(el=>{
        if(!visible(el)||el.classList.contains('sr-only')||el.getAttribute('aria-hidden')==='true')return false;
        const direct=[...el.childNodes].some(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim());
        return direct||((el.matches('input:not([type=checkbox]):not([type=radio]):not([type=hidden]),textarea,select')&&(el.value||el.placeholder)));
      });
      const failures=[];
      for(const el of textElements){
        const style=getComputedStyle(el),fontSize=parseFloat(style.fontSize),text=el.matches('input,textarea')?(el.value||el.placeholder):[...el.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent.trim()).filter(Boolean).join(' ');
        if(!fontSize||fontSize<=0){failures.push({screen:label,text:text.slice(0,36),reason:'zero font size'});continue}
        let opacity=1;for(let n=el;n;n=n.parentElement)opacity*=Number(getComputedStyle(n).opacity||1);
        const foreground=parse(style.color);if(!foreground){failures.push({screen:label,text:text.slice(0,36),reason:`unreadable foreground ${style.color}`});continue}
        const ancestors=[];for(let n=el;n;n=n.parentElement)ancestors.push(n);ancestors.reverse();let backgrounds=[[255,255,255,1]];
        for(const n of ancestors){const css=getComputedStyle(n),solid=parse(css.backgroundColor);if(solid&&solid[3]>0)backgrounds=backgrounds.map(bg=>blend(solid,bg));const imageColors=(css.backgroundImage.match(/rgba?\([^)]*\)|#[\da-f]{3,8}/gi)||[]).map(parse).filter(Boolean);if(imageColors.length)backgrounds=backgrounds.flatMap(bg=>imageColors.map(color=>blend(color,bg))).slice(0,24)}
        const textColor=[...foreground.slice(0,3),foreground[3]*opacity];const large=fontSize>=24||(fontSize>=18.66&&Number(style.fontWeight)>=700),icon=/^[^\p{L}\p{N}]+$/u.test(text),minimum=large||icon?3:4.5;const worst=Math.min(...backgrounds.map(bg=>ratio(blend(textColor,bg),bg)));
        if(worst+0.01<minimum)failures.push({screen:label,text:text.slice(0,45),tag:el.tagName,fg:style.color,bg:backgrounds[0],worstBg:backgrounds.reduce((w,b)=>ratio(blend(textColor,b),b)<ratio(blend(textColor,w),w)?b:w,backgrounds[0]),size:fontSize,ratio:+worst.toFixed(2),minimum,selector:el.id||el.className?.toString().slice(0,40)});
      }
      return failures;
    },screen);
    expect(issues,`${screen} theme contrast: ${JSON.stringify(issues.slice(0,12))}`).toEqual([]);
    fs.mkdirSync(testInfo.outputDir,{recursive:true});
    const imageName=`${screen.replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase()}.png`;
    await page.screenshot({path:path.join(testInfo.outputDir,imageName),fullPage:true});
  };
  const capture=async(theme)=>{
    await page.goto('/');
    await page.evaluate(theme=>localStorage.setItem('pocket-ledger-theme',theme),theme);
    await page.reload();
    await expect(page.locator('body')).toHaveClass(new RegExp(`${theme}-theme`));
    await page.locator('.nav-item[data-screen="dashboard"]').click();
    await expect(page.locator('#dashboardAvailable')).toBeVisible();
    const output=testInfo.outputDir;fs.mkdirSync(output,{recursive:true});
    await page.screenshot({path:path.join(output,`dashboard-${theme}-360.png`),fullPage:true});
    await inspect(`dashboard ${theme}`);
    await page.locator('.dashboard-account-row').first().click();await inspect(`account details ${theme}`);await page.locator('#closeAccountSheet').click();
    await page.locator('.nav-item[data-screen="entry"]').click();await inspect(`entry ${theme}`);
    await page.locator('.nav-item[data-screen="outstanding"]').click();await inspect(`outstanding list ${theme}`);
    await page.locator('#outstandingPeople button').first().click();await inspect(`person details ${theme}`);
    await page.locator('.nav-item[data-screen="reminders"]').click();await inspect(`reminders ${theme}`);await page.locator('#addReminderButton').click();await inspect(`reminder form ${theme}`);await page.locator('#cancelReminderForm').click();
    await page.locator('.nav-item[data-screen="more"]').click();await inspect(`More menu ${theme}`);await page.locator('#settingsMenuButton').click();await inspect(`settings ${theme}`);await page.locator('#addAccountButton').click();await inspect(`account editor ${theme}`);await page.locator('#closeAccountEditor').click();await page.locator('#openHowWorks').click();await inspect(`How it works ${theme}`);await page.locator('#howWorksBack').click();
    await page.locator('.nav-item[data-screen="more"]').click();await page.locator('[data-more="reports"]').click();
    for(const tab of ['summary','category','trend','account','person','investment']){await page.locator(`[data-report-tab="${tab}"]`).click();await inspect(`reports ${tab} ${theme}`)}
    for(const screen of ['budgets','recurring']){await page.locator('.nav-item[data-screen="more"]').click();await page.locator(`[data-more="${screen}"]`).click();await inspect(`${screen} ${theme}`)}
    await page.locator('.nav-item[data-screen="dashboard"]').click();await expect(page.locator('#investmentTotal')).toContainText('₹100');await page.locator('#investmentSummaryCard').click();await inspect(`investment list ${theme}`);await expect(page.locator('#investmentList [data-investment-name]')).toHaveCount(1);await page.locator('#investmentList [data-investment-name]').first().evaluate(button=>button.click());await expect(page.locator('#investmentDetailView')).toBeVisible();await inspect(`investment detail ${theme}`);
  };
  await capture('light');
  await page.locator('.nav-item[data-screen="dashboard"]').click();
  await page.locator('#dashboardThemeToggle').click();
  await capture('dark');
  expect(browserErrors,`browser console errors: ${browserErrors.join(' | ')}`).toEqual([]);
});
