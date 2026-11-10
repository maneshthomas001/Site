const cloneConfig=value=>JSON.parse(JSON.stringify(value));
const fontsReady=document.fonts?.ready||Promise.resolve();
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const draftKey = new URL('.', location.href).pathname;
const label = (key, fallback='') => esc(config.labels?.[key] ?? fallback);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const icons = {
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  down: '<path d="M12 4v16m-6-6 6 6 6-6"/>',
  music: '<path d="M9 18V5l11-2v13M9 8l11-2"/><ellipse cx="6" cy="18" rx="3" ry="3"/><ellipse cx="17" cy="16" rx="3" ry="3"/>',
  muted: '<path d="M9 18V5l11-2v7M9 8l11-2M15 15l6 6m0-6-6 6"/><ellipse cx="6" cy="18" rx="3" ry="3"/>',
  pin: '<path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18m-11 4h4"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.5 10.5 7-4m-7 7 7 4"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  edit: '<path d="m16 3 5 5-12 12-6 1 1-6Z M13 6l5 5"/>'
};
const icon = (name, cls='') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||''}</svg>`;
let config, defaultConfig, uploads = {}, objectUrls = {}, revealed = false, opened = false;
let countdownInterval, resizeObserver, intersectionObserver;
let audio = new Audio();
audio.loop = true;
audio.preload = 'none';
let playing = false;
let currentMusic = '';

export function notify(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(notify.timer);
  notify.timer = setTimeout(()=>toast.classList.remove('visible'),4200);
}

function database() {
  return new Promise((resolve,reject)=>{
    const req = indexedDB.open('forever-invitation-v1',1);
    const timeout=setTimeout(()=>reject(new Error('Browser storage is unavailable')),1500);
    req.onupgradeneeded = () => req.result.createObjectStore('draft');
    req.onsuccess = () => {clearTimeout(timeout);resolve(req.result);};
    req.onerror = () => {clearTimeout(timeout);reject(req.error);};
    req.onblocked = () => {clearTimeout(timeout);reject(new Error('Browser storage is busy'));};
  });
}
async function readDraft() {
  const db = await database();
  try {return await new Promise((resolve,reject)=>{
    const req = db.transaction('draft').objectStore('draft').get(draftKey);
    req.onsuccess = ()=>resolve(req.result);
    req.onerror = ()=>reject(req.error);
  });} finally {db.close();}
}
async function writeDraft(value) {
  const db = await database();
  try {await new Promise((resolve,reject)=>{
    const tx = db.transaction('draft','readwrite');
    if(value) tx.objectStore('draft').put(value,draftKey);
    else tx.objectStore('draft').delete(draftKey);
    tx.oncomplete = resolve;
    tx.onerror = ()=>reject(tx.error);
    tx.onabort = ()=>reject(tx.error||new Error('Storage unavailable'));
  });} finally {db.close();}
}
function asset(src) {
  if(!src) return '';
  if(uploads[src] instanceof Blob) return objectUrls[src] ||= URL.createObjectURL(uploads[src]);
  if (/^(https?:\/\/|\.\.?\/|[a-zA-Z0-9_-])/.test(src) && !/^[a-z]+:/i.test(src.replace(/^https?:/i,''))) return src;
  if(src.startsWith('/') && !src.startsWith('//')) return '.' + src;
  return '';
}
function safeLink(url) {
  try {const u = new URL(url); return /^https?:$/.test(u.protocol) ? u.href : '#';} catch {return '#';}
}
function dateParts() {
  const date = new Date(config.dateTime);
  const opts = {timeZone:config.timeZone||'Asia/Kolkata'};
  const format = options => new Intl.DateTimeFormat('en-GB',{...opts,...options}).format(date);
  return {date, day:format({day:'2-digit'}), month:format({month:'long'}), year:format({year:'numeric'}), weekday:format({weekday:'long'}), time:format({hour:'numeric',minute:'2-digit',hour12:true}).toUpperCase(), zone:config.timeZone==='Asia/Kolkata'?'IST':(new Intl.DateTimeFormat('en',{...opts,timeZoneName:'short'}).formatToParts(date).find(p=>p.type==='timeZoneName')?.value||config.timeZone), full:format({day:'numeric',month:'long',year:'numeric'})};
}
function photoMarkup(photo, name, cls='') {
  const src = asset(photo?.src);
  return `<div class="portrait ${cls} ${src?'has-photo':''}">${src?`<img src="${esc(src)}" alt="${esc(photo.alt||name)}" loading="lazy" decoding="async" style="object-position:${esc(/^\d+% \d+%$/.test(photo.position)?photo.position:'50% 40%')}">`:`<img class="portrait-botanical" src="./art/botanical.svg" alt=""><span class="portrait-initial" aria-hidden="true">${esc(name.slice(0,1))}</span><span class="portrait-name">${esc(name)}</span>`}</div>`;
}

function render() {
  resizeObserver?.disconnect();
  intersectionObserver?.disconnect();
  clearInterval(countdownInterval);
  const d = dateParts();
  document.title = `${config.partnerOne} & ${config.partnerTwo} — A Celebration of Love`;
  const monogram = `${config.partnerOne.slice(0,1)}<span>&</span>${config.partnerTwo.slice(0,1)}`;
  $('#app').innerHTML = `
  <section class="invitation-cover ${opened?'is-hidden':''}" id="cover" role="dialog" aria-modal="true" aria-labelledby="cover-title" ${opened?'hidden':''}>
    <div class="cover-grain"></div><div class="cover-border"></div>
    <img class="cover-branch cover-branch-one" src="./art/botanical.svg" alt=""><img class="cover-branch cover-branch-two" src="./art/botanical.svg" alt="">
    <div class="cover-topline"><span>${label('celebration','A CELEBRATION OF LOVE')}</span><span class="tiny-star">✦</span><span>${esc(d.year)}</span></div>
    <div class="cover-content">
      <p class="eyebrow cover-eyebrow">${esc(config.coverEyebrow)}</p>
      <h1 id="cover-title" class="cover-names"><span>${esc(config.partnerOne)}</span><i>&</i><span>${esc(config.partnerTwo)}</span></h1>
      <div class="cover-date"><span>${esc(d.day)}</span><span>${esc(d.month)}</span><span>${esc(d.year)}</span></div>
      <p class="cover-message">${esc(config.coverMessage)}</p>
      <button id="open-invitation" class="seal-button" aria-label="Open the wedding invitation"><span class="seal">${icon('heart')}</span><span class="seal-label">${label('openInvitation','OPEN THE INVITATION')}</span><span class="seal-hint">${label('openHint','a beautiful beginning awaits')}</span></button>
    </div>
    <div class="cover-bottom">MADE WITH LOVE <span>·</span> MEANT TO BE SHARED</div>
  </section>
  <div id="invitation" ${opened?'':'inert'}>
    <header class="site-header">
      <a class="wordmark" href="#home" aria-label="${esc(config.partnerOne)} and ${esc(config.partnerTwo)}, back to top">${monogram}</a>
      <nav class="desktop-nav" aria-label="Invitation sections"><a href="#our-story">${label('navStory','Our story')}</a><a href="#the-day">${label('navDay','The day')}</a><a href="#moments">${label('navMoments','Moments')}</a><a href="#venue">${label('navVenue','The venue')}</a></nav>
      <button class="sound-button" id="sound-toggle" aria-label="Play background music" aria-pressed="false">${icon('muted')}<span>${label('soundOff','Sound off')}</span></button>
    </header>
    <main>
      <section class="hero section-wrap" id="home" aria-labelledby="hero-heading">
        <div class="hero-copy"><p class="eyebrow"><span class="short-line"></span> ${esc(config.heroEyebrow)}</p>
          <h2 id="hero-heading" class="hero-names" tabindex="-1"><span>${esc(config.partnerOne)}</span><em>&</em><span>${esc(config.partnerTwo)}</span><span class="hero-star" aria-hidden="true">✧</span></h2>
          <p class="hero-message">${esc(config.heroMessage)}</p>
          <div class="hero-details"><span>${esc(d.day)} <i>·</i> ${esc(d.month.toUpperCase())} <i>·</i> ${esc(d.year)}</span><span>${esc(config.venue)}</span></div>
          <a href="#our-story" class="scroll-indicator"><span class="scroll-circle">${icon('down')}</span><span>${label('scrollPrompt','OUR FOREVER STARTS HERE')}</span></a>
        </div>
        <div class="hero-art" aria-label="Our wedding monogram">
          <div class="arch-outer"></div><div class="arch-inner"></div><div class="arch-sun"></div>
          <img class="hero-botanical" src="./art/botanical.svg" alt="">
          <div class="hero-monogram">${monogram}</div><p class="arch-caption">${label('archOverline','A LOVE TO LAST')}<br><i>${label('archScript','a lifetime')}</i></p>
          <span class="art-sparkle art-sparkle-one">✧</span><span class="art-sparkle art-sparkle-two">✦</span><div class="hero-art-note">${label('artNote','THE BEGINNING OF ALWAYS')}</div>
        </div>
        <div class="hero-bottom"><span>${label('familyLine','WITH OUR FAMILIES & ALL OUR LOVE')}</span><span>${esc(d.weekday.toUpperCase())} · ${esc(d.time)} <span class="timezone">${esc(d.zone)}</span></span></div>
      </section>
      <section class="story section-wrap" id="our-story" aria-labelledby="story-heading">
        <div class="section-intro reveal"><p class="eyebrow">${label('storyEyebrow','01 / A NEW CHAPTER')}</p><span class="section-number" aria-hidden="true">I.</span><h2 id="story-heading">${esc(config.invitationTitle)}</h2><div class="ornament-line"><span>✧</span></div><p class="story-message">${esc(config.invitationMessage)}</p></div>
        <div class="couple-portraits reveal"><figure>${photoMarkup(config.photos.partnerOne,config.partnerOne,'portrait-one')}<figcaption><span class="eyebrow">${label('portraitOneEyebrow','WITH ALL MY HEART')}</span><h3>${esc(config.partnerOne)}</h3></figcaption></figure><div class="couple-and" aria-hidden="true">&</div><figure>${photoMarkup(config.photos.partnerTwo,config.partnerTwo,'portrait-two')}<figcaption><span class="eyebrow">${label('portraitTwoEyebrow','FOR ALL MY DAYS')}</span><h3>${esc(config.partnerTwo)}</h3></figcaption></figure></div>
        <p class="love-quote reveal">“${esc(config.quote)}”</p>
      </section>
      <section class="date-section" id="the-day" aria-labelledby="date-heading">
        <img class="date-branch" src="./art/botanical.svg" alt=""><div class="section-wrap date-inner"><div class="section-intro reveal"><p class="eyebrow">${label('dateEyebrow','02 / SAVE OUR DATE')}</p><h2 id="date-heading">${esc(config.dateTitle)}</h2><p class="section-subtitle">${label('dateSubtitle','A little surprise, just for you.')}</p></div>
        <div class="scratch-card reveal ${revealed?'is-revealed':''}"><div class="date-underlay"><span class="eyebrow">${esc(d.weekday)}</span><div class="date-display"><span>${esc(d.day)}</span><i>${esc(d.month)}</i><span>${esc(d.year)}</span></div><p>${esc(d.time)} <span class="timezone">${esc(d.zone)}</span> <span class="dot">·</span> ${esc(config.venue)}</p></div><canvas id="scratch-canvas" aria-label="Scratch this golden card to reveal our wedding date" ${revealed?'hidden':''}></canvas></div>
        <div class="scratch-help"><p id="scratch-status" role="status">${revealed?label('scratchDiscovered','A date for your heart, and your calendar.'):label('scratchHelp','Gently scratch the gold to reveal our special day')}</p><button id="reveal-date" class="text-button" ${revealed?'hidden':''}>${label('scratchAlternative','Or tap to reveal')} ${icon('arrow')}</button><button class="text-button calendar-button" id="calendar" ${revealed?'':'hidden'}>${icon('calendar')} ${label('addCalendar','Add to calendar')}</button></div>
        <div class="countdown-wrap reveal"><p class="eyebrow" id="countdown-label">${esc(config.countdownTitle)}</p><div class="countdown" role="timer" aria-label="Time until our wedding"><div><strong id="days">00</strong><span>${label('days','DAYS')}</span></div><i>:</i><div><strong id="hours">00</strong><span>${label('hours','HOURS')}</span></div><i>:</i><div><strong id="minutes">00</strong><span>${label('minutes','MINUTES')}</span></div><i>:</i><div><strong id="seconds">00</strong><span>${label('seconds','SECONDS')}</span></div></div><p class="countdown-footnote">${label('countdownFootnote','UNTIL WE SAY “I DO”')}</p></div>
        </div>
      </section>
      <section class="moments section-wrap" id="moments" aria-labelledby="moments-heading"><div class="moments-top reveal"><div><p class="eyebrow">${label('momentsEyebrow','03 / MOMENTS OF US')}</p><h2 id="moments-heading">${esc(config.galleryTitle)}</h2></div><p>${esc(config.galleryMessage)}</p></div>
        <div class="gallery reveal">${galleryMarkup()}</div><p class="gallery-footnote">${label('galleryFootnote','LITTLE MOMENTS. A LOVE THAT GROWS.')}</p>
      </section>
      <section class="venue-section" id="venue" aria-labelledby="venue-heading"><div class="section-wrap venue-layout"><div class="venue-illustration reveal"><div class="venue-arch"><img src="./art/church.svg" alt="An elegant line illustration of a church" loading="lazy"></div><span class="eyebrow">${label('venueArtCaption','A SACRED PLACE. A BEAUTIFUL PROMISE.')}</span></div><div class="venue-copy reveal"><p class="eyebrow">${label('venueEyebrow','04 / THE PLACE WE’LL REMEMBER')}</p><h2 id="venue-heading">${esc(config.venueTitle)}</h2><span class="venue-rule"></span><h3>${esc(config.venue)}</h3><p>${esc(config.venueNote)}</p><div class="venue-time">${icon('calendar')}<div>${esc(d.full)}<br><span>${esc(d.weekday)} · ${esc(d.time)} <span class="timezone">${esc(d.zone)}</span></span></div></div><a class="button button-dark" href="${esc(safeLink(config.mapUrl))}" target="_blank" rel="noopener noreferrer">${icon('pin')} ${label('mapButton','Open in Google Maps')} ${icon('arrow')}</a><p class="venue-note">${label('venueNote','We’ll save a little place in our day for you.')}</p></div></div></section>
      <section class="closing section-wrap reveal" aria-labelledby="closing-heading"><span class="closing-star">✧</span><p class="eyebrow">${label('closingEyebrow','THE BEST PART IS SHARING IT WITH YOU')}</p><h2 id="closing-heading">${esc(config.closingTitle)}</h2><p>${esc(config.closingMessage)}</p><button class="button button-outline" id="share-invitation">${icon('share')} ${label('shareButton','Share the invitation')} ${icon('arrow')}</button><div class="closing-signature"><span>${esc(config.footerMessage)}</span><p>${esc(config.partnerOne)} <i>&</i> ${esc(config.partnerTwo)}</p></div></section>
    </main>
    <footer class="site-footer section-wrap"><span>${label('footerCelebrating','Celebrating love')} · ${esc(d.year)}</span><button id="replay-cover" class="footer-button">${label('replayCover','Open invitation again')}</button><button id="edit-invitation" class="footer-button" title="Edit a private copy of this invitation">${icon('edit')} ${label('editButton','Personalise')}</button></footer>
  </div>
  <dialog id="lightbox" class="lightbox" aria-label="Photo gallery"><button class="lightbox-close" aria-label="Close photo">${icon('close')}</button><button class="lightbox-prev" aria-label="Previous photo">‹</button><figure><img alt=""><figcaption></figcaption></figure><button class="lightbox-next" aria-label="Next photo">›</button></dialog>`;
  document.body.classList.toggle('is-covered',!opened);
  wireEvents();
  setupReveals();
  if(!revealed) setupScratch();
  updateCountdown();
  countdownInterval = setInterval(updateCountdown,1000);
  syncAudio();
  fontsReady.then(fitNames);
}

function fitNames() {
  const hero=$('#hero-heading');
  if(hero) {
    hero.style.fontSize='';
    const available=$('.hero-copy').clientWidth-38;
    const width=hero.getBoundingClientRect().width;
    if(width>available) hero.style.fontSize=`${parseFloat(getComputedStyle(hero).fontSize)*available/width}px`;
  }
  const cover=$('.cover-names');
  if(cover && !$('#cover').hidden) {
    cover.style.fontSize='';
    const available=Math.min(innerWidth-64,640);
    const spans=$$('span',cover);
    const width=innerWidth<=760?Math.max(...spans.map(el=>el.getBoundingClientRect().width)):cover.scrollWidth;
    if(width>available) cover.style.fontSize=`${parseFloat(getComputedStyle(cover).fontSize)*available/width}px`;
  }
}
window.addEventListener('resize',()=>{
  clearTimeout(fitNames.timer);fitNames.timer=setTimeout(fitNames,120);
});

function galleryItems() {
  if(config.gallery.length) return config.gallery.filter(item=>asset(item.src));
  return [{...config.photos.partnerOne,caption:config.partnerOne},{...config.photos.partnerTwo,caption:config.partnerTwo}].filter(item=>asset(item.src));
}
function galleryMarkup() {
  const photos = galleryItems();
  if(photos.length) return photos.map((photo,i)=>`<button class="gallery-item gallery-item-${i%3}" data-photo="${i}" aria-label="View ${esc(photo.alt||photo.caption||'photo '+(i+1))}"><img src="${esc(asset(photo.src))}" alt="${esc(photo.alt||'A moment of us')}" loading="lazy" decoding="async"><span class="gallery-caption"><span>${esc(photo.caption||'A moment to remember')}</span><span aria-hidden="true">↗</span></span></button>`).join('');
  return `<div class="memory-note"><span class="eyebrow">${label('emptyGalleryEyebrow','THE BEAUTY OF EVERYDAY')}</span><span class="memory-initials">${esc(config.partnerOne.slice(0,1))}<i>&</i>${esc(config.partnerTwo.slice(0,1))}</span><span>${label('emptyGalleryMessage','All the little things that brought us here.')}</span><img src="./art/botanical.svg" alt="" loading="lazy"></div><div class="memory-quote"><span class="memory-quote-mark">“</span><p>${esc(config.quote)}</p><span class="eyebrow">${label('emptyQuoteFootnote','OUR STORY, STILL UNFOLDING')}</span></div>`;
}

function wireEvents() {
  $('#open-invitation').addEventListener('click',openInvitation);
  $('#cover').addEventListener('keydown',event=>{
    if(event.key==='Tab' && !opened){event.preventDefault();$('#open-invitation').focus();}
  });
  if(!opened) setTimeout(()=>$('#open-invitation')?.focus({preventScroll:true}),20);
  $('#sound-toggle').addEventListener('click',toggleMusic);
  $('#reveal-date').addEventListener('click',revealDate);
  $('#calendar').addEventListener('click',downloadCalendar);
  $('#share-invitation').addEventListener('click',shareInvitation);
  $('#edit-invitation').addEventListener('click',editInvitation);
  $('#replay-cover').addEventListener('click',()=>{
    opened = false;
    render();
    window.scrollTo({top:0,behavior:'instant'});
  });
  $$('.gallery-item').forEach(btn=>btn.addEventListener('click',()=>showLightbox(Number(btn.dataset.photo))));
  const lb=$('#lightbox');
  $('.lightbox-close',lb).addEventListener('click',()=>lb.close());
  lb.addEventListener('click',event=>{if(event.target===lb) lb.close();});
  $('.lightbox-prev',lb).addEventListener('click',()=>showLightbox(Number(lb.dataset.index)-1));
  $('.lightbox-next',lb).addEventListener('click',()=>showLightbox(Number(lb.dataset.index)+1));
  lb.addEventListener('keydown',event=>{
    if(event.key==='ArrowLeft') showLightbox(Number(lb.dataset.index)-1);
    if(event.key==='ArrowRight') showLightbox(Number(lb.dataset.index)+1);
  });
}
function openInvitation() {
  if(opened) return;
  opened=true;
  const cover=$('#cover');
  cover.classList.add('opening');
  $('#open-invitation').disabled=true;
  if(asset(config.music.src)) playMusic();
  setTimeout(()=>{
    cover.hidden=true;
    document.body.classList.remove('is-covered');
    $('#invitation').inert=false;
    $('#invitation').classList.add('has-opened');
    $('#hero-heading').focus({preventScroll:true});
    window.scrollTo({top:0,behavior:'instant'});
  },reducedMotion.matches?20:1050);
}

function setupReveals() {
  if(reducedMotion.matches || typeof IntersectionObserver!=='function') return;
  intersectionObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{
    if(entry.isIntersecting) {entry.target.classList.add('in-view');intersectionObserver.unobserve(entry.target);}
  }),{threshold:.08});
  $$('.reveal').forEach(el=>{el.classList.add('will-reveal');intersectionObserver.observe(el);});
}
function updateCountdown() {
  const left = new Date(config.dateTime).getTime()-Date.now();
  const total = Math.max(0,Math.floor(left/1000));
  const vals=[Math.floor(total/86400),Math.floor(total/3600)%24,Math.floor(total/60)%60,total%60];
  ['days','hours','minutes','seconds'].forEach((key,i)=>$('#'+key).textContent=String(vals[i]).padStart(2,'0'));
  if(left<=0) {
    const localDay=new Intl.DateTimeFormat('en-CA',{timeZone:config.timeZone,year:'numeric',month:'2-digit',day:'2-digit'});
    const weddingIsToday=localDay.format(new Date(Date.now()))===localDay.format(new Date(config.dateTime));
    $('#countdown-label').textContent = weddingIsToday ? (config.labels?.countdownToday||'Today, we begin forever.') : (config.labels?.countdownPast||'Our forever has begun.');
    $('.countdown-footnote').textContent=config.labels?.countdownPastFootnote||'A lifetime of love ahead';
  }
}

function setupScratch() {
  const canvas=$('#scratch-canvas');
  let ctx;
  try {ctx=canvas.getContext('2d',{willReadFrequently:true});} catch { /* Keep the tap-to-reveal option available. */ }
  if(!ctx) {canvas.hidden=true;$('#reveal-date').textContent=config.labels?.scratchAlternative||'Reveal our wedding date';return;}
  let pointer=null,last=null,drawn=false,lastCheck=0;
  function paint() {
    if(revealed) return;
    const rect=canvas.getBoundingClientRect();
    if(rect.width<1) return;
    const dpr=Math.min(devicePixelRatio||1,2);
    const w=Math.round(rect.width*dpr),h=Math.round(rect.height*dpr);
    if(canvas.width===w && canvas.height===h) return;
    const previous=document.createElement('canvas');
    if(drawn) {previous.width=canvas.width;previous.height=canvas.height;previous.getContext('2d').drawImage(canvas,0,0);}
    canvas.width=w;canvas.height=h;ctx.setTransform(dpr,0,0,dpr,0,0);
    if(drawn) {ctx.drawImage(previous,0,0,previous.width,previous.height,0,0,rect.width,rect.height);return;}
    const gradient=ctx.createLinearGradient(0,0,rect.width,rect.height);
    gradient.addColorStop(0,'#a3864e');gradient.addColorStop(.35,'#e4d3a9');gradient.addColorStop(.6,'#bb9a60');gradient.addColorStop(1,'#d7c08a');
    ctx.fillStyle=gradient;ctx.fillRect(0,0,rect.width,rect.height);
    ctx.strokeStyle='rgba(255,249,223,.4)';ctx.lineWidth=1;ctx.strokeRect(10,10,rect.width-20,rect.height-20);
    for(let i=0;i<1800;i++){ctx.fillStyle=i%2?'rgba(255,255,255,.09)':'rgba(78,55,22,.06)';ctx.fillRect(Math.random()*rect.width,Math.random()*rect.height,1,1);}
    ctx.textAlign='center';ctx.fillStyle='#4f432c';ctx.font='26px Cormorant, Georgia, serif';ctx.fillText(config.labels?.scratchHeading||'A beautiful day is waiting',rect.width/2,rect.height/2-6);
    ctx.font='9px DMSans, sans-serif';ctx.fillText((config.labels?.scratchPrompt||'Scratch to discover').toUpperCase().split('').join(' '),rect.width/2,rect.height/2+22);
    ctx.font='16px Georgia';ctx.fillText('✧',rect.width/2,38);
  }
  if(typeof ResizeObserver==='function') {
    resizeObserver=new ResizeObserver(paint);resizeObserver.observe(canvas);
  } else {
    window.addEventListener('resize',paint);
    resizeObserver={disconnect:()=>window.removeEventListener('resize',paint)};
    paint();
  }
  fontsReady.then(paint);
  function point(event){const r=canvas.getBoundingClientRect();return {x:event.clientX-r.left,y:event.clientY-r.top};}
  function stroke(event){
    if(event.pointerId!==pointer||revealed) return;
    const p=point(event);ctx.globalCompositeOperation='destination-out';ctx.lineWidth=52;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(last?.x??p.x,last?.y??p.y);ctx.lineTo(p.x,p.y);ctx.stroke();ctx.beginPath();ctx.arc(p.x,p.y,26,0,Math.PI*2);ctx.fill();ctx.globalCompositeOperation='source-over';last=p;drawn=true;
    if(performance.now()-lastCheck>160){lastCheck=performance.now();check();}
  }
  function check(){
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    let clear=0,total=0;for(let i=3;i<pixels.length;i+=4*89){if(pixels[i]<100) clear++;total++;}
    if(clear/total>.38) revealDate();
  }
  canvas.addEventListener('pointerdown',event=>{if(event.button!==0)return;pointer=event.pointerId;canvas.setPointerCapture(pointer);last=point(event);stroke(event);});
  canvas.addEventListener('pointermove',stroke);
  const end=event=>{if(event.pointerId!==pointer)return;pointer=null;last=null;check();};
  canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
}
function revealDate() {
  if(revealed) return;
  revealed=true;
  $('.scratch-card').classList.add('is-revealed');
  $('#scratch-canvas').style.pointerEvents='none';
  setTimeout(()=>{$('#scratch-canvas').hidden=true;},reducedMotion.matches?0:650);
  $('#reveal-date').hidden=true;
  $('#calendar').hidden=false;
  $('#scratch-status').textContent=config.labels?.scratchDiscovered||'A date for your heart, and your calendar.';
  if(document.activeElement?.id==='reveal-date') $('#calendar').focus({preventScroll:true});
  if(!reducedMotion.matches) flowerBurst();
}
function flowerBurst() {
  const host=$('#petals');
  const fragment=document.createDocumentFragment();
  for(let i=0;i<34;i++){
    const p=document.createElement('span');p.className='petal';
    p.style.cssText=`--x:${Math.random()*100}vw;--drift:${(Math.random()-.5)*280}px;--delay:${Math.random()*.8}s;--rotate:${Math.random()*540}deg;--duration:${3+Math.random()*2}s;background:${['#e3c9b1','#d4b777','#f3e6d2','#a5ad90'][i%4]};width:${8+Math.random()*10}px;height:${14+Math.random()*12}px;`;
    fragment.append(p);
  }
  host.append(fragment);setTimeout(()=>host.replaceChildren(),6200);
}
function syncAudio() {
  const next=asset(config.music.src);
  if(next!==currentMusic){audio.pause();playing=false;audio.removeAttribute('src');if(next) audio.src=next;currentMusic=next;}
  const volume=Number(config.music.volume);
  audio.volume=Math.min(1,Math.max(0,Number.isFinite(volume)?volume:.35));
  updateSoundButton();
}
function updateSoundButton() {
  const btn=$('#sound-toggle');if(!btn)return;
  btn.innerHTML=icon(playing?'music':'muted')+`<span>${playing?label('soundOn','Sound on'):label('soundOff','Sound off')}</span>`;
  btn.setAttribute('aria-pressed',String(playing));btn.setAttribute('aria-label',`${playing?'Pause':'Play'} background music`);
}
async function playMusic() {
  try {await audio.play();playing=true;updateSoundButton();}
  catch {playing=false;updateSoundButton();notify('Tap the sound button to start the music.');}
}
function toggleMusic() {
  if(!currentMusic) {notify('The soundtrack hasn’t been added yet. You can add it in Personalise.');return;}
  if(playing){audio.pause();playing=false;updateSoundButton();}else playMusic();
}
audio.addEventListener('error',()=>{playing=false;updateSoundButton();notify('This soundtrack could not be played. Try an MP3 or M4A file.');});
document.addEventListener('visibilitychange',()=>{if(document.hidden && playing){audio.pause();playing=false;updateSoundButton();}});

function downloadFile(blob,name) {
  const url=URL.createObjectURL(blob), a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
function downloadCalendar() {
  const start = new Date(config.dateTime), end=new Date(start.getTime()+90*60000);
  const format = d=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
  const ics = s=>String(s).replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
  const text=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Our Forever//Wedding Invitation//EN','CALSCALE:GREGORIAN','BEGIN:VEVENT',`UID:${format(start)}-wedding@ourforever.local`,`DTSTAMP:${format(new Date())}`,`DTSTART:${format(start)}`,`DTEND:${format(end)}`,`SUMMARY:${ics(config.partnerOne+' & '+config.partnerTwo+' — Wedding')}`,`LOCATION:${ics(config.venue)}`,`DESCRIPTION:${ics(config.venueNote+'\n'+config.mapUrl)}`,'END:VEVENT','END:VCALENDAR',''].join('\r\n');
  downloadFile(new Blob([text],{type:'text/calendar;charset=utf-8'}),'our-wedding.ics');notify('Your calendar invitation is ready.');
}
async function shareInvitation() {
  const url=safeLink(config.siteUrl)||location.href;
  const shareUrl=url==='#'?location.href.split('?')[0]:url;
  try {
    if(navigator.share) await navigator.share({title:document.title,text:config.shareDescription,url:shareUrl});
    else {await navigator.clipboard.writeText(shareUrl);notify('Invitation link copied with love.');}
  } catch(error){if(error.name!=='AbortError') notify('You can share this invitation by copying its address.');}
}
function showLightbox(index) {
  const photos=galleryItems();if(!photos.length)return;
  const i=(index+photos.length)%photos.length,photo=photos[i],lb=$('#lightbox');
  lb.dataset.index=i;const img=$('img',lb);img.src=asset(photo.src);img.alt=photo.alt||'A moment of us';$('figcaption',lb).textContent=photo.caption||'';
  $('.lightbox-prev',lb).hidden=photos.length<2;$('.lightbox-next',lb).hidden=photos.length<2;
  if(!lb.open) lb.showModal();
}
async function editInvitation() {
  const button=$('#edit-invitation');button.disabled=true;
  try {
    const {openEditor}=await import('./editor.js');
    await openEditor({config,uploads,notify,onSave:async(next,nextUploads)=>{
      await writeDraft({config:next,uploads:nextUploads});
      config=next;uploads=nextUploads;
      Object.values(objectUrls).forEach(URL.revokeObjectURL);objectUrls={};
      opened=true;render();notify('Your changes are saved in this browser. Export to share them.');
    },onReset:async()=>{
      await writeDraft(null);config=cloneConfig(defaultConfig);uploads={};
      Object.values(objectUrls).forEach(URL.revokeObjectURL);objectUrls={};
      revealed=false;opened=true;render();notify('Restored the original invitation.');
    }});
  } catch(error){notify('The editor could not open: '+error.message);}
  finally {$('#edit-invitation').disabled=false;}
}

function validatedConfig(input,base) {
  if(!input || typeof input!=='object' || Array.isArray(input)) throw new Error('Invalid invitation details');
  const next=cloneConfig(base||input);
  if(base) {
    for(const key of Object.keys(base)) if(typeof base[key]==='string' && typeof input[key]==='string') next[key]=input[key];
  }
  for(const key of ['partnerOne','partnerTwo','venue','dateTime','timeZone']) {
    if(typeof next[key]!=='string'||!next[key].trim()) throw new Error('Incomplete invitation details');
  }
  if(!Number.isFinite(Date.parse(next.dateTime))) throw new Error('Invalid wedding date');
  new Intl.DateTimeFormat('en',{timeZone:next.timeZone}).format(new Date(next.dateTime));
  next.photos={...next.photos};
  for(const key of ['partnerOne','partnerTwo']) {
    const photo=input.photos?.[key]||next.photos[key]||{};
    const fallback=base?.photos?.[key]||{};
    next.photos[key]={
      src:typeof photo.src==='string'?photo.src:(fallback.src||''),
      alt:typeof photo.alt==='string'?photo.alt:next[key],
      position:typeof photo.position==='string'?photo.position:(fallback.position||'50% 40%')
    };
  }
  next.gallery=(Array.isArray(input.gallery)?input.gallery:(next.gallery||[])).filter(p=>p && typeof p.src==='string').map(p=>({src:p.src,alt:typeof p.alt==='string'?p.alt:'',caption:typeof p.caption==='string'?p.caption:''}));
  const music=input.music||next.music||{};
  next.music={src:typeof music.src==='string'?music.src:'',title:typeof music.title==='string'?music.title:'Our wedding soundtrack',volume:Number.isFinite(Number(music.volume))?Math.max(0,Math.min(1,Number(music.volume))):.35};
  next.labels={...next.labels};
  for(const key of Object.keys(next.labels)) if(typeof input.labels?.[key]==='string') next.labels[key]=input.labels[key];
  return next;
}

async function loadContent() {
  const embedded=$('#invitation-content');
  if(embedded?.textContent.trim()) return validatedConfig(JSON.parse(embedded.textContent));
  // Compatibility for older templates. Current builds and exports embed their details.
  const response=await fetch(new URL('./content.json',import.meta.url));
  if(!response.ok) throw new Error('Invitation details unavailable');
  return validatedConfig(await response.json());
}

async function init() {
  try {
    defaultConfig=await loadContent();config=cloneConfig(defaultConfig);
    let usingDraft=false;
    try {
      const saved=await readDraft();
      if(saved?.config) {
        config=validatedConfig(saved.config,defaultConfig);
        uploads=Object.fromEntries(Object.entries(saved.uploads||{}).filter(([,value])=>value instanceof Blob));
        usingDraft=true;
      }
    } catch { /* Invalid or unavailable browser drafts must never block the invitation. */ }
    try {render();} catch(error) {
      if(!usingDraft) throw error;
      config=cloneConfig(defaultConfig);uploads={};render();
    }
    if(new URLSearchParams(location.search).has('edit')) {opened=true;render();await editInvitation();}
  } catch(error){
    document.body.classList.remove('is-covered');
    $('#app').innerHTML='<div class="load-error"><p class="eyebrow">A CELEBRATION OF LOVE</p><h1>We’ll be right with you.</h1><p>The invitation could not load. Please refresh to try again.</p><button class="button button-dark" onclick="location.reload()">Try again</button></div>';
    console.error(error);
  }
}
init();
