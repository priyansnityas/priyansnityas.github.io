const {test,expect}=require('@playwright/test');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

test('file and HTTP versions resolve every SVG icon and render matching Dashboard and Entry screens',async({browser,browserName,baseURL})=>{
  test.skip(browserName!=='chromium','file protocol parity is checked in Chromium.');
  test.setTimeout(90000);
  const root=path.resolve(__dirname,'../..'),fileUrl=pathToFileURL(path.join(root,'index.html')).href;
  const context=await browser.newContext({serviceWorkers:'allow'});
  await context.addInitScript(()=>{
    localStorage.setItem('pocket-ledger-onboarded','1');
    localStorage.setItem('pocket-ledger-theme','light');
    localStorage.setItem('pocket-ledger-visual-effects','lite');
  });
  const filePage=await context.newPage(),httpPage=await context.newPage();
  const errors=[];for(const page of [filePage,httpPage])page.on('pageerror',error=>errors.push(error.message));
  await filePage.goto(fileUrl);await httpPage.goto(`${baseURL}/`);
  await expect(filePage.locator('#entryCard')).toBeVisible();await expect(httpPage.locator('#entryCard')).toBeVisible();
  expect(filePage.url()).toBe(fileUrl);
  expect(new URL(httpPage.url()).origin).toBe(new URL(baseURL).origin);
  expect(await filePage.evaluate(async()=>('serviceWorker'in navigator)?(await navigator.serviceWorker.getRegistrations().catch(()=>[])).length:0)).toBe(0);

  const checkIcons=async page=>page.evaluate(()=>{
    const isVisible=el=>{for(let node=el;node;node=node.parentElement){const style=getComputedStyle(node);if(node.hidden||style.display==='none'||style.visibility==='hidden')return false}return true};
    const uses=[...document.querySelectorAll('svg use')],problems=[];
    for(const use of uses){
      const href=use.getAttribute('href')||use.getAttribute('xlink:href')||'',id=href.startsWith('#')?href.slice(1):'';
      const symbol=id&&document.getElementById(id);
      if(!symbol||symbol.tagName.toLowerCase()!=='symbol'){problems.push(`unresolved ${href}`);continue}
      if(isVisible(use)){
        const box=use.getBBox(),svg=use.closest('svg'),rect=svg.getBoundingClientRect();
        if(!(box.width>0&&box.height>0&&rect.width>0&&rect.height>0))problems.push(`zero-size ${href}`);
      }
    }
    return {problems,count:uses.length,external:[...document.querySelectorAll('svg use')].map(x=>x.getAttribute('href')).filter(x=>x&&!x.startsWith('#'))};
  });
  const compare=async(a,b)=>httpPage.evaluate(async([left,right])=>{
    const load=src=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=`data:image/png;base64,${src}`});
    const [one,two]=await Promise.all([load(left),load(right)]);
    if(one.width!==two.width||one.height!==two.height)return {different:1,width:[one.width,two.width],height:[one.height,two.height]};
    const canvas=document.createElement('canvas');canvas.width=one.width;canvas.height=one.height;const ctx=canvas.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(one,0,0);const a=ctx.getImageData(0,0,canvas.width,canvas.height).data;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(two,0,0);const b=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    let different=0,totalDelta=0;for(let i=0;i<a.length;i+=4){const delta=Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]));if(delta>12)different++;totalDelta+=delta}
    const pixels=a.length/4;return {different:different/pixels,meanDelta:totalDelta/pixels};
  },[a.toString('base64'),b.toString('base64')]);

  for(const width of [360,1280]){
    for(const [page,name] of [[filePage,'file'],[httpPage,'http']]){
      await page.setViewportSize({width,height:800});
      await page.locator('.nav-item[data-screen="dashboard"]').click();
      await expect(page.locator('#dashboardAvailable')).toBeVisible();
      await page.evaluate(()=>window.scrollTo(0,0));
      const icons=await checkIcons(page);expect(icons.problems,`${name} icons at ${width}px`).toEqual([]);expect(icons.external).toEqual([]);
    }
    for(const screen of ['dashboard','entry']){
      const shots=[];
      for(const page of [filePage,httpPage]){
        await page.locator(`.nav-item[data-screen="${screen}"]`).click();
        await page.evaluate(()=>window.scrollTo(0,0));
        await page.screenshot({animations:'disabled'}).then(buffer=>shots.push(buffer));
      }
      const result=await compare(shots[0],shots[1]);
      expect(result.different,`${screen} screenshot pixel difference at ${width}px: ${JSON.stringify(result)}`).toBeLessThanOrEqual(.01);
      expect(result.meanDelta,`${screen} screenshot mean color delta at ${width}px`).toBeLessThanOrEqual(1.5);
    }
  }
  expect(errors).toEqual([]);
  await context.close();
});
