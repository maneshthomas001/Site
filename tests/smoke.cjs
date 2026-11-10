// Browser regression checks against the built static invitation and an exported
// copy. Chromium can be supplied with CHROMIUM_PATH on other development hosts.
const assert = require('node:assert/strict');
const {spawn, execFileSync} = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..');
const results = path.join(root, 'test-results');
const base = 'http://127.0.0.1:3001';
const servers = [];
let browser, passed = 0;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function check(name, fn) {
  await fn();
  passed++;
  console.log(`PASS ${name}`);
}
async function serve(directory, port) {
  const server = spawn(process.execPath, ['scripts/serve.mjs', directory], {cwd:root, env:{...process.env, PORT:String(port)}, stdio:['ignore','pipe','pipe']});
  servers.push(server);
  let logs = '';
  server.stderr.on('data', d => logs += d);
  for(let attempt=0;attempt<50;attempt++) {
    if(server.exitCode!==null) throw new Error(`Server exited: ${logs}`);
    try {if((await fetch(`http://127.0.0.1:${port}/content.json`)).ok) return;} catch {}
    await delay(100);
  }
  throw new Error(`Server did not start: ${logs}`);
}
async function waitFor(fn, message, timeout=6000) {
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline) {if(await fn()) return;await delay(50);}
  throw new Error(message);
}
async function open(page, url=base) {
  await page.goto(url);
  await waitFor(async()=>{
    assert.equal(await page.locator('.load-error').count(),0,'Invitation rendered its startup error screen');
    return page.locator('#open-invitation').isVisible();
  },'Invitation cover did not load');
  await page.locator('#open-invitation').click();
  await waitFor(()=>page.locator('#cover').isHidden(),'Invitation did not open');
  assert.equal(await page.locator('#invitation').evaluate(el=>el.inert), false);
}
async function edit(page) {
  await page.locator('#edit-invitation').click();
  await page.locator('.inv-editor').waitFor({state:'visible'});
}
async function save(page) {
  await page.locator('.editor-save').click();
  await waitFor(()=>page.locator('.inv-editor').count().then(n=>n===0),'Editor did not save/close');
}
function wavFixture() {
  const rate=8000, samples=8000, b=Buffer.alloc(44+samples*2);
  b.write('RIFF',0);b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(samples*2,40);
  for(let i=0;i<samples;i++) b.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*220/rate)*1000),44+i*2);
  return {name:'test-tone.wav',mimeType:'audio/wav',buffer:b};
}
async function seedDraft(page,value) {
  await page.evaluate(value=>new Promise((resolve,reject)=>{
    const request=indexedDB.open('forever-invitation-v1',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('draft');
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{
      const db=request.result,tx=db.transaction('draft','readwrite');
      tx.objectStore('draft').put(value,new URL('.',location.href).pathname);
      tx.oncomplete=()=>{db.close();resolve();};
      tx.onerror=()=>{db.close();reject(tx.error);};
    };
  }),value);
}

(async()=>{
  await fs.mkdir(results,{recursive:true});
  execFileSync(process.execPath,['scripts/build.mjs'],{cwd:root,stdio:'inherit'});
  await serve('dist',3001);
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,acceptDownloads:true});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
    const NativeAudio=window.Audio;
    window.Audio=function(...args){const element=new NativeAudio(...args);window.__backgroundAudio=element;return element;};
    window.Audio.prototype=NativeAudio.prototype;
  });

  await check('built invitation opens without requesting separately hosted JSON',async()=>{
    const defaults=JSON.parse(await fs.readFile(path.join(root,'content.json'),'utf8'));
    for(const responseMode of ['blocked','html']) {
      const isolated=await browser.newContext({reducedMotion:'reduce'}),p=await isolated.newPage();
      let jsonRequests=0;
      await p.route('**/content.json',route=>{
        jsonRequests++;
        return responseMode==='blocked'?route.abort('failed'):route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><h1>Host fallback page</h1>'});
      });
      await open(p);
      const embedded=await p.locator('#invitation-content').textContent();
      assert.deepEqual(JSON.parse(embedded),defaults);
      assert.equal(jsonRequests,0,`Unexpected content.json dependency when host response is ${responseMode}`);
      assert.equal(await p.locator('.load-error').count(),0);
      assert.match(await p.locator('#hero-heading').textContent(),/Manesh/);
      await isolated.close();
    }
  });

  await check('older browser capability fallbacks preserve opening and tap reveal',async()=>{
    const isolated=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),p=await isolated.newPage(),failed=[];
    p.on('pageerror',error=>failed.push(error.message));
    await p.addInitScript(()=>{
      Object.defineProperty(window,'structuredClone',{value:undefined,configurable:true});
      Object.defineProperty(window,'ResizeObserver',{value:undefined,configurable:true});
      Object.defineProperty(document,'fonts',{value:undefined,configurable:true});
    });
    await open(p);
    assert.deepEqual(await p.evaluate(()=>({clone:typeof structuredClone,observer:typeof ResizeObserver,fonts:typeof document.fonts})),{clone:'undefined',observer:'undefined',fonts:'undefined'});
    await p.locator('#reveal-date').click();
    assert.equal(await p.locator('#calendar').isVisible(),true);
    assert.equal(await p.locator('.load-error').count(),0);
    assert.deepEqual(failed,[]);
    await isolated.close();
  });

  await check('invalid stored wedding details recover to the published invitation',async()=>{
    const isolated=await browser.newContext({reducedMotion:'reduce'}),p=await isolated.newPage(),failed=[];
    p.on('pageerror',error=>failed.push(error.message));
    await open(p);
    await seedDraft(p,{config:{partnerOne:'Broken draft',partnerTwo:'Maji',dateTime:'not-a-date',timeZone:'Bad/Zone'},uploads:{}});
    await open(p);
    assert.match(await p.locator('#hero-heading').textContent(),/Manesh/);
    assert.doesNotMatch(await p.locator('#hero-heading').textContent(),/Broken draft/);
    assert.match(await p.locator('.hero-details').textContent(),/10.*NOVEMBER.*2026/s);
    assert.equal(await p.locator('.load-error').count(),0);
    assert.deepEqual(failed,[]);
    await isolated.close();
  });

  await check('partial stored drafts retain edits and fill nested defaults safely',async()=>{
    const isolated=await browser.newContext({reducedMotion:'reduce'}),p=await isolated.newPage(),failed=[];
    p.on('pageerror',error=>failed.push(error.message));
    await open(p);
    await seedDraft(p,{
      config:{partnerOne:'Personal copy',photos:{partnerTwo:{src:'art/social-preview.png'}}},
      uploads:{'art/social-preview.png':{invalid:'not a Blob'},'unused-upload':'not a file'}
    });
    await open(p);
    assert.match(await p.locator('#hero-heading').textContent(),/Personal copy/);
    assert.match(await p.locator('#hero-heading').textContent(),/Maji/);
    assert.equal(await p.locator('.portrait-one .portrait-initial').textContent(),'P');
    await p.locator('.portrait-two').scrollIntoViewIfNeeded();
    await waitFor(()=>p.locator('.portrait-two img').evaluate(img=>img.complete&&img.naturalWidth>0),'Published portrait failed after an invalid upload entry');
    assert.equal(await p.locator('.portrait-two img').getAttribute('src'),'art/social-preview.png');
    assert.equal(await p.locator('.gallery-caption>span').first().textContent(),'Maji');
    await p.locator('#reveal-date').click();
    assert.equal(await p.locator('#calendar').isVisible(),true);
    assert.equal(await p.locator('.load-error').count(),0);
    assert.deepEqual(failed,[]);
    await isolated.close();
  });

  await check('mobile cover opens from the keyboard and releases focus/scroll',async()=>{
    await page.goto(base);
    await page.locator('#open-invitation').waitFor();
    assert.equal(await page.locator('#invitation').evaluate(el=>el.inert),true);
    await page.locator('#open-invitation').focus();
    await page.keyboard.press('Enter');
    await waitFor(()=>page.locator('#cover').isHidden(),'Keyboard opening failed');
    assert.equal(await page.locator('#invitation').evaluate(el=>el.inert),false);
    assert.equal(await page.evaluate(()=>document.activeElement.id),'hero-heading');
    assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('is-covered')),false);
  });

  await check('layout has no horizontal overflow at 320, 390, 768, and 1440px',async()=>{
    for(const width of [320,390,768,1440]) {
      await page.setViewportSize({width,height:900});
      const size=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));
      assert.ok(size.scroll<=size.width+1,`Horizontal overflow at ${width}px (${size.scroll}px)`);
    }
    await page.setViewportSize({width:390,height:844});
  });

  await check('actual pointer scratching reveals the date and emits petals',async()=>{
    const canvas=page.locator('#scratch-canvas');
    await canvas.scrollIntoViewIfNeeded();
    await delay(1000);
    const box=await canvas.boundingBox();
    await page.mouse.move(box.x+12,box.y+20);
    await page.mouse.down();
    for(let y=20;y<box.height-10;y+=22) {
      await page.mouse.move(box.x+12,box.y+y);
      await page.mouse.move(box.x+box.width-12,box.y+y,{steps:12});
      if(await page.locator('.scratch-card').evaluate(el=>el.classList.contains('is-revealed'))) break;
    }
    await page.mouse.up();
    assert.equal(await page.locator('.scratch-card').evaluate(el=>el.classList.contains('is-revealed')),true);
    assert.ok(await page.locator('#petals .petal').count()>0);
    assert.equal(await page.locator('#calendar').isVisible(),true);
  });

  await check('keyboard reveal alternative downloads the correctly timed calendar event',async()=>{
    await open(page);
    await page.locator('#reveal-date').scrollIntoViewIfNeeded();
    await page.locator('#reveal-date').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#calendar').isVisible(),true);
    const downloadPromise=page.waitForEvent('download');
    await page.locator('#calendar').click();
    const download=await downloadPromise;
    const target=path.join(results,'our-wedding.ics');await download.saveAs(target);
    const calendar=await fs.readFile(target,'utf8');
    assert.match(calendar,/DTSTART:20261110T070000Z/);
    assert.match(calendar,/LOCATION:Sacred Heart Church/);
    assert.match(calendar,/SUMMARY:Manesh & Maji/);
    assert.match(calendar,/https:\/\/maps\.app\.goo\.gl\/F9swaARwHLrwPqKYA/);
  });

  await check('venue links to the supplied Google Maps destination',async()=>{
    const map=page.locator('#venue a.button');
    assert.equal(await map.getAttribute('href'),'https://maps.app.goo.gl/F9swaARwHLrwPqKYA');
    assert.equal(await map.getAttribute('target'),'_blank');
    assert.match(await map.getAttribute('rel'),/noopener/);
  });

  await check('countdown distinguishes upcoming, wedding-day, and past states',async()=>{
    const event=Date.parse('2026-11-10T07:00:00Z');
    for(const [now,label,days] of [[event-86400000,'Every moment brings us closer.','01'],[event+3600000,'Today, we begin forever.','00'],[event+172800000,'Our forever has begun.','00']]) {
      const isolated=await browser.newContext({reducedMotion:'reduce'});
      await isolated.addInitScript(now=>{Date.now=()=>now;},now);
      const p=await isolated.newPage();await p.goto(base);
      await p.locator('#days').waitFor({state:'attached'});
      assert.equal(await p.locator('#countdown-label').textContent(),label);
      assert.equal(await p.locator('#days').textContent(),days);
      await isolated.close();
    }
  });

  await check('cancel preserves details and invalid URLs cannot be saved',async()=>{
    await edit(page);await page.locator('[name=partnerOne]').fill('Cancelled');
    await page.locator('.editor-cancel').click();
    assert.match(await page.locator('#hero-heading').textContent(),/Manesh/);
    await edit(page);await page.locator('[name=mapUrl]').fill('javascript:alert(1)');
    await page.locator('.editor-save').click();
    assert.equal(await page.locator('.inv-editor').isVisible(),true);
    assert.match(await page.locator('.editor-error').textContent(),/Map link/);
    await page.locator('.editor-cancel').click();
  });

  await check('details, local date/time, custom labels and time zone survive reload',async()=>{
    await edit(page);
    await page.locator('[name=partnerOne]').fill('Manesh');
    await page.locator('[name=weddingDate]').fill('2026-11-11T14:45');
    await page.locator('[name=timeZone]').fill('Europe/London');
    await page.locator('summary').filter({hasText:'Labels & finishing touches'}).click();
    await page.locator('[name=label_scratchAlternative]').fill('Reveal our date');
    await save(page);
    assert.match(await page.locator('.hero-details').textContent(),/11/);
    assert.ok(!(await page.locator('.timezone').first().textContent()).includes('IST'));
    await open(page);
    assert.match(await page.locator('#reveal-date').textContent(),/Reveal our date/);
    await edit(page);
    assert.equal(await page.locator('[name=weddingDate]').inputValue(),'2026-11-11T14:45');
    assert.equal(await page.locator('[name=timeZone]').inputValue(),'Europe/London');
    // Restore wedding details for export and subsequent checks.
    await page.locator('[name=weddingDate]').fill('2026-11-10T12:30');
    await page.locator('[name=timeZone]').fill('Asia/Kolkata');
    await save(page);
  });

  await check('a Maji-only upload persists and carries the correct gallery caption',async()=>{
    await edit(page);await page.getByRole('tab',{name:'Photos',exact:true}).click();
    await page.locator('[name=partnerOneAlt]').fill('Keep this description');
    await page.locator('[name=partnerOnePosition]').fill('45% 30%');
    await page.locator('[data-upload=partnerTwo]').setInputFiles(path.join(root,'public/art/social-preview.png'));
    await waitFor(()=>page.locator('[name=partnerTwoSrc]').inputValue().then(x=>x.startsWith('media/')),'Photo upload did not finish');
    assert.equal(await page.locator('[name=partnerOneAlt]').inputValue(),'Keep this description');
    assert.equal(await page.locator('[name=partnerOnePosition]').inputValue(),'45% 30%');
    await save(page);
    assert.equal(await page.locator('.gallery-caption>span').first().textContent(),'Maji');
    await open(page);
    assert.equal(await page.locator('.portrait-two img').evaluate(img=>img.complete&&img.naturalWidth>0),true);
    assert.equal(await page.locator('.gallery-caption>span').first().textContent(),'Maji');
  });

  await check('gallery lightbox opens the original and closes from Escape',async()=>{
    await page.locator('.gallery-item').first().click();
    assert.equal(await page.locator('#lightbox').evaluate(el=>el.open),true);
    assert.equal(await page.locator('#lightbox img').getAttribute('alt'),'Maji');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#lightbox').evaluate(el=>el.open),false);
  });

  await check('uploaded audio starts on opening, respects zero volume, and toggles',async()=>{
    await edit(page);await page.getByRole('tab',{name:'Music',exact:true}).click();
    await page.locator('[data-upload=music]').setInputFiles(wavFixture());
    await waitFor(()=>page.locator('[name=musicSrc]').inputValue().then(x=>x.endsWith('.wav')),'Audio upload did not finish');
    await page.locator('[name=musicVolume]').fill('0');await save(page);
    assert.equal(await page.evaluate(()=>window.__backgroundAudio.volume),0);
    await page.locator('#replay-cover').click();await page.locator('#open-invitation').click();
    await waitFor(()=>page.locator('#sound-toggle').getAttribute('aria-pressed').then(x=>x==='true'),'Audio did not start after opening');
    assert.equal(await page.evaluate(()=>window.__backgroundAudio.volume),0);
    await waitFor(()=>page.locator('#cover').isHidden(),'Reopened cover did not close');
    await page.locator('#sound-toggle').click();
    assert.equal(await page.locator('#sound-toggle').getAttribute('aria-pressed'),'false');
    await page.locator('#sound-toggle').click();
    await waitFor(()=>page.locator('#sound-toggle').getAttribute('aria-pressed').then(x=>x==='true'),'Sound toggle did not resume');
    await page.locator('#sound-toggle').click();
  });

  let exportedDir;
  await check('export ZIP includes working media and absolute social preview metadata',async()=>{
    await edit(page);await page.getByRole('tab',{name:'Sharing',exact:true}).click();
    await page.locator('[name=siteUrl]').fill('https://example.com/wedding/');
    const downloaded=page.waitForEvent('download');await page.locator('.editor-export').click();
    const download=await downloaded, zipPath=path.join(results,'invitation.zip');await download.saveAs(zipPath);
    exportedDir=path.join(results,'exported');
    const summary=JSON.parse(execFileSync('python3',['-c',
      'import zipfile,json,sys,os,re\nwith zipfile.ZipFile(sys.argv[1]) as z:\n assert z.testzip() is None\n c=json.loads(z.read("content.json"))\n assert c["photos"]["partnerTwo"]["src"] in z.namelist()\n assert c["music"]["src"] in z.namelist()\n assert z.read(c["photos"]["partnerTwo"]["src"])[:4] == b"RIFF" or c["photos"]["partnerTwo"]["src"].endswith(".png")\n html=z.read("index.html").decode()\n embedded=re.search(r"<script[^>]*id=.invitation-content.[^>]*>(.*?)</script>",html,re.S)\n assert embedded, "Export is missing its embedded content"\n assert json.loads(embedded.group(1)) == c, "Embedded export data differs from the edited settings"\n assert "https://example.com/wedding/art/social-preview.png" in html\n assert "blob:" not in z.read("content.json").decode()\n z.extractall(sys.argv[2])\n print(json.dumps({"files":len(z.namelist()),"dateTime":c["dateTime"]}))',zipPath,exportedDir],{encoding:'utf8'}));
    assert.ok(summary.files>=17);
    assert.equal(summary.dateTime,'2026-11-10T07:00:00.000Z');
    await page.locator('.editor-cancel').click();
  });

  await check('the exported website runs with photos and audio under a subfolder',async()=>{
    const hostDir=path.join(results,'export-host');
    await fs.mkdir(hostDir,{recursive:true});
    await fs.cp(exportedDir,path.join(hostDir,'wedding'),{recursive:true});
    const server=spawn(process.execPath,['scripts/serve.mjs',hostDir],{cwd:root,env:{...process.env,PORT:'3002'},stdio:'ignore'});servers.push(server);
    for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:3002/wedding/content.json')).ok)break;}catch{}await delay(100);}
    const isolated=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}), p=await isolated.newPage(), failed=[];
    p.on('pageerror',e=>failed.push(e.message));p.on('response',r=>{if(r.status()>=400)failed.push(`${r.status()} ${r.url()}`);});
    await open(p,'http://127.0.0.1:3002/wedding/');
    await p.locator('.portrait-two').scrollIntoViewIfNeeded();
    await waitFor(()=>p.locator('.portrait-two img').evaluate(img=>img.complete&&img.naturalWidth>0),'Exported image failed');
    assert.equal(await p.locator('.gallery-caption>span').first().textContent(),'Maji');
    await p.locator('#reveal-date').click();assert.equal(await p.locator('#petals .petal').count(),0);
    assert.equal(await p.locator('#calendar').isVisible(),true);
    await p.goto('http://127.0.0.1:3002/wedding/?edit=1');await p.locator('.inv-editor').waitFor();
    assert.equal(await p.locator('[name=weddingDate]').inputValue(),'2026-11-10T12:30');
    assert.deepEqual(failed,[]);
    await isolated.close();
  });

  await check('no uncaught browser errors occurred',async()=>assert.deepEqual(errors,[]));
  await context.close();
  console.log(`\n${passed} browser checks passed.`);
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
  if(browser)await browser.close();
  for(const server of servers)server.kill('SIGTERM');
});
