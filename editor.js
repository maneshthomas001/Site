const cloneConfig=value=>JSON.parse(JSON.stringify(value));
import {renderMetadata,embedContent} from './share.js';
import {createZip} from './zip.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const imageTypes = ['image/jpeg','image/png','image/webp','image/gif'];
const imageAccept = '.jpg,.jpeg,.png,.webp,.gif';
const styles = `
.inv-editor{border:1px solid #d2c6a5;border-radius:16px;padding:0;width:min(760px,calc(100% - 24px));max-height:90dvh;color:#263c32;background:#faf7f0;box-shadow:0 30px 100px #0006;font:14px/1.6 DMSans,Arial,sans-serif;z-index:1000}
.inv-editor::backdrop{background:#17271fd9;backdrop-filter:blur(8px)}.inv-editor *{box-sizing:border-box}.inv-editor[open]{display:flex;flex-direction:column}.editor-header{padding:24px 28px 14px;display:flex;align-items:start;justify-content:space-between;gap:16px}.editor-header h2{margin:0;font:36px/1.15 Georgia,serif}.editor-header p{margin:8px 0 0;font-size:12px;color:#667064}.editor-close{border:0;background:transparent;font-size:27px;color:inherit;cursor:pointer;min-width:44px;min-height:44px}.editor-tabs{display:flex;border-bottom:1px solid #ddd4bf;padding:0 22px;gap:4px;overflow:auto;flex-shrink:0}.editor-tabs button{font:inherit;white-space:nowrap;border:0;border-bottom:2px solid transparent;background:transparent;padding:12px;color:#667064;cursor:pointer}.editor-tabs [aria-selected=true]{color:#263c32;border-color:#917342}.editor-form{overflow:auto;padding:24px 28px;flex:1;overscroll-behavior:contain}.editor-panel[hidden]{display:none}.editor-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.editor-field{display:block;margin-bottom:16px;font-weight:500;font-size:12px;letter-spacing:.02em}.editor-field input:not([type=file]),.editor-field textarea,.editor-field select{display:block;width:100%;border:1px solid #cfc6b1;background:#fffdf8;color:#263c32;border-radius:6px;padding:10px 12px;margin-top:6px;font-family:inherit;font-size:14px;line-height:1.5;letter-spacing:normal}.editor-field textarea{min-height:88px;resize:vertical}.editor-field input:focus,.editor-field textarea:focus{outline:2px solid #9b8450;outline-offset:2px}.editor-field input[type=file]{display:block;width:100%;margin-top:8px;font:inherit;font-size:12px}.editor-field input[type=range]{padding:0}.editor-help{font-size:12px;color:#667064;margin:0 0 20px}.editor-section-title{font:25px Georgia,serif;margin:20px 0 16px}.editor-note{background:#ede8d9;border-left:2px solid #9b8450;padding:12px 14px;margin-bottom:20px;font-size:12px}.editor-photo{border:1px solid #ddd4bf;padding:16px;border-radius:8px;margin-bottom:16px}.editor-photo img{width:96px;height:120px;object-fit:cover;float:left;margin:0 16px 10px 0;border-radius:45px 45px 4px 4px}.editor-photo::after{content:'';display:table;clear:both}.editor-photo h3{margin:0 0 12px;font:23px Georgia,serif}.editor-small{font-family:inherit;font-size:12px;line-height:inherit;color:#344d3e;border:1px solid #cfc6b1;border-radius:4px;padding:7px 11px;background:transparent;cursor:pointer}.editor-actions{padding:16px 28px;border-top:1px solid #ddd4bf;display:flex;flex-wrap:wrap;gap:8px;align-items:center;background:#f6f2e8;flex-shrink:0}.editor-actions button{border:1px solid #b7ab8c;border-radius:5px;background:transparent;color:#263c32;padding:11px 15px;font-family:inherit;font-size:12px;line-height:1.4;cursor:pointer;min-height:44px}.editor-actions .editor-save{background:#263c32;color:#fffdf8;border-color:#263c32;margin-left:auto}.editor-actions .editor-reset{border:0;padding-left:0;margin-right:auto;text-decoration:underline;font-size:11px}.editor-actions button:disabled{opacity:.5;cursor:wait}.editor-error{color:#8a312b;font-size:12px;margin:0 28px 12px}.editor-form details{border-top:1px solid #ddd4bf;padding-top:16px;margin-top:16px}.editor-form summary{cursor:pointer;font-size:13px;margin-bottom:16px}.editor-inline{display:flex;gap:12px;align-items:center}.editor-status{font-size:12px;color:#667064;min-height:20px;margin:8px 0}.editor-thumb-list{display:grid;gap:12px}.editor-gallery-row{border:1px solid #ddd4bf;padding:12px;border-radius:7px}.editor-gallery-row img{width:80px;height:90px;object-fit:cover;float:left;margin:0 12px 8px 0;border-radius:3px}.editor-gallery-row:after{content:'';display:table;clear:both}.editor-gallery-row .editor-field{margin-bottom:8px}.editor-gallery-row input{padding:7px!important}.editor-field small{display:block;font-weight:400;color:#667064;margin-top:5px;letter-spacing:normal}.editor-panel audio{max-width:100%;margin:0 0 16px}.editor-panel a{color:#5d703d}.editor-panel h3:first-child{margin-top:0}
@media(max-width:520px){.editor-header{padding:20px 18px 12px}.editor-header h2{font-size:30px}.editor-form{padding:20px 18px}.editor-tabs{padding:0 8px}.editor-tabs button{padding:11px}.editor-grid{grid-template-columns:1fr;gap:0}.editor-actions{padding:12px 18px}.editor-actions .editor-reset{width:100%;text-align:left}.editor-actions .editor-save{margin-left:auto}.editor-error{margin-left:18px;margin-right:18px}}
`;

function localDateTime(value,timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value));
  const p = Object.fromEntries(parts.map(x=>[x.type,x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
function zonedISO(local,timeZone) {
  const [date,time] = local.split('T'), [y,m,d] = date.split('-').map(Number), [h,min] = time.split(':').map(Number);
  let guess = Date.UTC(y,m-1,d,h,min);
  const target = guess;
  for(let i=0;i<4;i++) {
    const p = localDateTime(guess,timeZone);
    const current = Date.parse(p+'Z');
    const delta = target-current;
    guess += delta;
    if(delta===0) break;
  }
  if(localDateTime(guess,timeZone)!==local) throw new Error('This time does not exist in the chosen time zone. Choose another time.');
  return new Date(guess).toISOString();
}
function assetUrl(src) {
  if (/^https?:\/\//i.test(src)||src.startsWith('blob:')) return src;
  return new URL(src.replace(/^\//,''),import.meta.url).href;
}
function field(name,label,value,type='text',help='') {
  const control=type==='textarea'?`<textarea name="${name}" rows="3">${esc(value)}</textarea>`:`<input name="${name}" type="${type}" value="${esc(value)}" ${['partnerOne','partnerTwo','venue','weddingDate','timeZone'].includes(name)?'required':''}>`;
  return `<label class="editor-field">${label}${control}${help?`<small>${help}</small>`:''}</label>`;
}
function validateUrl(value,label,{optional=true,relative=false}={}) {
  if(!value&&optional)return;
  if(relative&&value&&!value.includes(':')&&!value.startsWith('//')&&!value.split('/').includes('..'))return;
  try {const url=new URL(value);if(!['https:','http:'].includes(url.protocol))throw new Error();}catch{throw new Error(`${label} must be a valid HTTPS${relative?' link or local asset path':' link'}.`);}
}
async function optimiseImage(file) {
  if(file.size>20*1024*1024)throw new Error('Please choose an image smaller than 20 MB.');
  if(!imageTypes.includes(file.type)&&!/(\.jpe?g|\.png|\.webp|\.gif)$/i.test(file.name))throw new Error('Please choose a JPG, PNG, WebP, or GIF image.');
  let image, release=()=>{};
  // Older Safari versions lack createImageBitmap or reject formats which the
  // regular image element can decode. Keep the same resize path for both.
  if(typeof createImageBitmap==='function'){
    try{image=await createImageBitmap(file);release=()=>image.close?.();}catch{}
  }
  if(!image){
    const url=URL.createObjectURL(file);
    try{
      image=await new Promise((resolve,reject)=>{
        const element=new Image();
        element.onload=()=>resolve(element);
        element.onerror=()=>reject(new Error('This image could not be read. Please try another photo.'));
        element.src=url;
      });
      release=()=>URL.revokeObjectURL(url);
    }catch(error){URL.revokeObjectURL(url);throw error;}
  }
  const width=image.naturalWidth||image.width, height=image.naturalHeight||image.height;
  const scale=Math.min(1,1600/Math.max(width,height));
  const canvas=document.createElement('canvas');canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);
  try{canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);}finally{release();}
  let blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.86));
  // Safari may return PNG when WebP encoding is unavailable. Retain its actual
  // MIME type so filename() uses a matching extension instead of assuming WebP.
  if(!blob)blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  if(!blob)throw new Error('This image could not be read. Please try another photo.');
  return blob;
}
function filename(blob,prefix) {const ext=({'image/webp':'webp','image/png':'png','image/jpeg':'jpg','audio/mpeg':'mp3','audio/mp4':'m4a','audio/x-m4a':'m4a','audio/ogg':'ogg','audio/wav':'wav','audio/x-wav':'wav'})[blob.type]||'bin';return `media/${prefix}-${crypto.randomUUID().slice(0,8)}.${ext}`;}

export async function openEditor({config,uploads={},onSave,onReset,notify=()=>{}}) {
  if(document.querySelector('.inv-editor')) return;
  const draft=cloneConfig(config), files={...uploads};
  const urls=new Map(), previousFocus=document.activeElement;
  const preview=src=>{if(!src)return '';if(files[src]){if(!urls.has(src))urls.set(src,URL.createObjectURL(files[src]));return urls.get(src);}return assetUrl(src);};
  draft.photos ||= {partnerOne:{src:'',alt:draft.partnerOne,position:'50% 35%'},partnerTwo:{src:'',alt:draft.partnerTwo,position:'50% 40%'}};
  draft.gallery ||= [];draft.music||={src:'',title:'Our wedding soundtrack',volume:.35};
  const dialog=document.createElement('dialog');dialog.className='inv-editor';dialog.setAttribute('aria-labelledby','editor-title');
  const copyKeys=['coverEyebrow','coverMessage','heroEyebrow','heroMessage','invitationTitle','invitationMessage','quote','dateTitle','countdownTitle','galleryTitle','galleryMessage','venueTitle','closingTitle','closingMessage','footerMessage'];
  const labels={coverEyebrow:'Opening cover · small heading',coverMessage:'Opening cover · message',heroEyebrow:'Introduction · small heading',heroMessage:'Introduction · message',invitationTitle:'Invitation · heading',invitationMessage:'Invitation · message',quote:'Love quote',dateTitle:'Date reveal · heading',countdownTitle:'Countdown · heading',galleryTitle:'Gallery · heading',galleryMessage:'Gallery · message',venueTitle:'Venue · heading',closingTitle:'Closing · heading',closingMessage:'Closing · message',footerMessage:'Sign-off'};
  dialog.innerHTML=`<style>${styles}</style><header class="editor-header"><div><h2 id="editor-title">Make it your own.</h2><p>Your details. Your photographs. Your beautiful day.</p></div><button class="editor-close" type="button" aria-label="Close editor">×</button></header>
  <div class="editor-tabs" role="tablist" aria-label="Invitation settings">${['Details','Photos','Music','Sharing'].map((t,i)=>`<button type="button" role="tab" id="editor-tab-${i}" aria-selected="${i===0}" aria-controls="editor-panel-${i}" tabindex="${i===0?0:-1}" data-tab="${i}">${t}</button>`).join('')}</div>
  <form class="editor-form" novalidate>
    <section class="editor-panel" role="tabpanel" id="editor-panel-0" aria-labelledby="editor-tab-0">
      <div class="editor-note">Save changes keeps a private draft in this browser. To share your changes with guests, export the website and upload it to your web host.</div>
      <div class="editor-grid">${field('partnerOne','First name',draft.partnerOne)}${field('partnerTwo','Second name',draft.partnerTwo)}${field('weddingDate','Wedding date & time',localDateTime(draft.dateTime,draft.timeZone),'datetime-local')}${field('timeZone','Time zone',draft.timeZone,'text','Use an IANA zone, e.g. Asia/Kolkata.')}</div>
      ${field('venue','Venue',draft.venue)}${field('venueNote','Venue message',draft.venueNote)}${field('mapUrl','Google Maps link',draft.mapUrl,'url')}
      <details><summary>Invitation words & section headings</summary>${copyKeys.map(k=>field(k,labels[k],draft[k]||'',k.includes('Message')||k==='quote'?'textarea':'text')).join('')}</details>
      <details><summary>Labels & finishing touches</summary>${Object.entries(draft.labels||{}).map(([key,value])=>field(`label_${key}`,esc(key.replace(/([A-Z])/g,' $1').replace(/^./,letter=>letter.toUpperCase())),value)).join('')}</details>
    </section>
    <section class="editor-panel" role="tabpanel" id="editor-panel-1" aria-labelledby="editor-tab-1" hidden>
      <p class="editor-help">Add your original photographs here. Images are resized to a maximum of 1600 pixels for quick loading. Your files stay in this browser until you export.</p>
      <div class="editor-portraits"></div>
      <h3 class="editor-section-title">Your gallery</h3><label class="editor-field">Add gallery photos<input type="file" accept="${imageAccept}" multiple data-upload="gallery"></label><div class="editor-thumb-list"></div>
    </section>
    <section class="editor-panel" role="tabpanel" id="editor-panel-2" aria-labelledby="editor-tab-2" hidden>
      <h3 class="editor-section-title">A soundtrack to your story.</h3><p class="editor-help">Music begins only after a guest opens the invitation or taps the sound button, as required by iPhone and Android browsers. Use music you have permission to share.</p>
      <label class="editor-field">Upload music · MP3, M4A, WAV, or OGG · up to 30 MB<input type="file" accept=".mp3,.m4a,.wav,.ogg,audio/*" data-upload="music"></label>
      <div class="editor-music-preview"></div>${field('musicTitle','Music title',draft.music.title)}${field('musicSrc','Music file path or URL',draft.music.src,'text','Leave empty for a silent invitation.')}
      <label class="editor-field">Starting volume<input name="musicVolume" type="range" min="0" max="1" step="0.05" value="${draft.music.volume??.35}"></label>
    </section>
    <section class="editor-panel" role="tabpanel" id="editor-panel-3" aria-labelledby="editor-tab-3" hidden>
      <h3 class="editor-section-title">A lovely first impression.</h3><p class="editor-help">The exported website includes WhatsApp and social sharing metadata. Enter its final public HTTPS address before exporting so apps can find the preview image. Social apps may cache earlier previews.</p>
      ${field('siteUrl','Published website address',draft.siteUrl,'url','Example: https://your-name.github.io/wedding/ — include a subfolder if used.')}${field('shareDescription','Sharing preview description',draft.shareDescription,'textarea')}
      <label class="editor-field">Custom sharing image · ideally 1200 × 630<input type="file" accept="${imageAccept}" data-upload="share"></label><div class="editor-share-preview"></div>
      ${field('shareImage','Sharing image path or URL',draft.shareImage)}<button class="editor-small" type="button" data-action="default-share">Use automatic name & date card</button>
    </section>
    <p class="editor-status" aria-live="polite"></p>
  </form><p class="editor-error" role="alert"></p>
  <footer class="editor-actions"><button type="button" class="editor-reset">Reset browser edits</button><button type="button" class="editor-cancel">Cancel</button><button type="button" class="editor-export">Export .zip</button><button type="button" class="editor-save">Save changes</button></footer>`;
  document.body.append(dialog);dialog.showModal();
  const $=selector=>dialog.querySelector(selector), form=$('.editor-form');
  let busy=false;
  function tab(index,focus=false) {
    dialog.querySelectorAll('[role=tab]').forEach((el,i)=>{el.setAttribute('aria-selected',String(i===index));el.tabIndex=i===index?0:-1;if(focus&&i===index)el.focus();});
    dialog.querySelectorAll('.editor-panel').forEach((el,i)=>el.hidden=i!==index);
    form.scrollTop=0;
  }
  function error(message){$('.editor-error').textContent=message||'';}
  function setBusy(value,message=''){busy=value;dialog.querySelectorAll('.editor-actions button').forEach(b=>b.disabled=value);$('.editor-status').textContent=message;}
  function close(){if(busy)return;dialog.close();}
  dialog.addEventListener('close',()=>{urls.forEach(url=>URL.revokeObjectURL(url));dialog.remove();if(previousFocus?.isConnected)previousFocus.focus();},{once:true});
  dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  $('.editor-close').onclick=close;$('.editor-cancel').onclick=close;
  dialog.querySelectorAll('[data-tab]').forEach(button=>{
    button.onclick=()=>tab(Number(button.dataset.tab));
    button.onkeydown=event=>{if(['ArrowRight','ArrowLeft','Home','End'].includes(event.key)){event.preventDefault();const i=Number(button.dataset.tab);tab(event.key==='Home'?0:event.key==='End'?3:(i+(event.key==='ArrowRight'?1:3))%4,true);}};
  });
  function portraitUI(){
    $('.editor-portraits').innerHTML=['partnerOne','partnerTwo'].map(key=>{const p=draft.photos[key];return `<div class="editor-photo">${p.src?`<img src="${esc(preview(p.src))}" alt="${esc(p.alt)}" style="object-position:${esc(p.position||'50% 40%')}">`:''}<h3>${esc(draft[key])}</h3><label class="editor-field">Choose portrait<input type="file" accept="${imageAccept}" data-upload="${key}"></label>${field(`${key}Src`,'Image file path or URL',p.src)}${field(`${key}Alt`,'Photo description',p.alt)}${field(`${key}Position`,'Photo focal point',p.position||'50% 40%','text','Horizontal and vertical position, e.g. 50% 35%.')}<button class="editor-small" type="button" data-remove="${key}">Remove photo</button></div>`;}).join('');
  }
  function savePortraitValues(){
    for(const key of ['partnerOne','partnerTwo']){
      const source=form.elements[`${key}Src`], alt=form.elements[`${key}Alt`], position=form.elements[`${key}Position`];
      if(source)draft.photos[key]={src:source.value,alt:alt.value,position:position.value};
    }
  }
  function galleryUI(){
    $('.editor-thumb-list').innerHTML=draft.gallery.map((p,i)=>`<div class="editor-gallery-row" data-gallery-index="${i}"><img src="${esc(preview(p.src))}" alt="${esc(p.alt)}">${field(`galleryAlt${i}`,'Photo description',p.alt||'')}${field(`galleryCaption${i}`,'Caption',p.caption||'')}<button class="editor-small" type="button" data-remove-gallery="${i}">Remove photo</button></div>`).join('');
  }
  function saveGalleryLabels(){draft.gallery.forEach((p,i)=>{p.alt=form.elements[`galleryAlt${i}`]?.value||'';p.caption=form.elements[`galleryCaption${i}`]?.value||'';});}
  function mediaPreview(){
    $('.editor-music-preview').innerHTML=draft.music.src?`<audio controls preload="none" src="${esc(preview(draft.music.src))}"></audio>`:'<p class="editor-help">No music attached yet.</p>';
    $('.editor-share-preview').innerHTML=draft.shareImage?`<img style="max-width:100%;max-height:150px;margin-bottom:16px;border-radius:5px" src="${esc(preview(draft.shareImage))}" alt="Sharing preview">`:'';
  }
  portraitUI();galleryUI();mediaPreview();
  form.addEventListener('submit',event=>event.preventDefault());
  form.addEventListener('click',event=>{
    const remove=event.target.closest('[data-remove]');
    if(remove){const key=remove.dataset.remove;savePortraitValues();draft.photos[key].src='';portraitUI();return;}
    const removeGallery=event.target.closest('[data-remove-gallery]');
    if(removeGallery){saveGalleryLabels();draft.gallery.splice(Number(removeGallery.dataset.removeGallery),1);galleryUI();return;}
    if(event.target.closest('[data-action="default-share"]')){draft.shareImage='art/social-preview.png';form.elements.shareImage.value=draft.shareImage;mediaPreview();}
  });
  form.addEventListener('change',async event=>{
    const input=event.target, kind=input.dataset.upload;
    if(!kind||!input.files?.length)return;
    error('');setBusy(true,'Preparing your files…');
    try{
      if(kind==='music'){
        const file=input.files[0];if(file.size>30*1024*1024)throw new Error('Please choose music smaller than 30 MB.');
        if(!/\.(mp3|m4a|wav|ogg)$/i.test(file.name))throw new Error('Please choose an MP3, M4A, WAV, or OGG music file.');
        const path=`media/music-${crypto.randomUUID().slice(0,8)}.${file.name.split('.').pop().toLowerCase()}`;files[path]=file;draft.music.src=path;form.elements.musicSrc.value=path;
        if(!draft.music.title)form.elements.musicTitle.value=file.name.replace(/\.[^.]+$/,'');mediaPreview();
      }else{
        saveGalleryLabels();
        for(const file of input.files){
          const blob=await optimiseImage(file), path=filename(blob,kind);files[path]=blob;
          if(kind==='gallery')draft.gallery.push({src:path,alt:file.name.replace(/\.[^.]+$/,'').replace(/[-_]/g,' '),caption:'',position:'50% 50%'});
          else if(kind==='share'){draft.shareImage=path;form.elements.shareImage.value=path;}
          else {savePortraitValues();draft.photos[kind].src=path;}
        }
        if(kind==='gallery')galleryUI();else if(kind==='share')mediaPreview();else portraitUI();
      }
      notify('Your file is ready. Save changes to keep it in this browser.');
    }catch(e){error(e.message||'This file could not be loaded.');}
    finally{setBusy(false);input.value='';}
  });
  function collect(){
    for(const input of form.querySelectorAll('[required]'))if(!input.value.trim()){tab(0);input.focus();throw new Error('Please fill in the names, wedding date, time zone, and venue.');}
    const next=cloneConfig(draft);
    ['partnerOne','partnerTwo','venue','venueNote','mapUrl','timeZone','siteUrl','shareDescription','shareImage',...copyKeys].forEach(k=>next[k]=form.elements[k].value.trim());
    next.labels=Object.fromEntries(Object.keys(draft.labels||{}).map(key=>[key,form.elements[`label_${key}`].value.trim()]));
    try{new Intl.DateTimeFormat('en',{timeZone:next.timeZone}).format();}catch{tab(0);form.elements.timeZone.focus();throw new Error('Please enter a valid time zone, such as Asia/Kolkata.');}
    next.dateTime=zonedISO(form.elements.weddingDate.value,next.timeZone);
    validateUrl(next.mapUrl,'Map link',{optional:false});validateUrl(next.siteUrl,'Website address');validateUrl(next.shareImage,'Sharing image',{relative:true});
    ['partnerOne','partnerTwo'].forEach(key=>{
      next.photos[key]={src:form.elements[`${key}Src`].value.trim(),alt:form.elements[`${key}Alt`].value.trim(),position:form.elements[`${key}Position`].value.trim()};
      validateUrl(next.photos[key].src,'Photo source',{relative:true});
      if(!/^\d{1,3}% \d{1,3}%$/.test(next.photos[key].position))next.photos[key].position='50% 40%';
    });
    next.gallery.forEach((p,i)=>{p.alt=form.elements[`galleryAlt${i}`]?.value.trim()||'';p.caption=form.elements[`galleryCaption${i}`]?.value.trim()||'';});
    next.music={src:form.elements.musicSrc.value.trim(),title:form.elements.musicTitle.value.trim(),volume:Number(form.elements.musicVolume.value)};
    validateUrl(next.music.src,'Music source',{relative:true});
    return next;
  }
  $('.editor-save').onclick=async()=>{
    error('');try{const next=collect();setBusy(true,'Saving your invitation…');await onSave(next,files);setBusy(false);close();notify('Invitation saved in this browser. Export to share your changes.');}catch(e){error(e.message||'Changes could not be saved.');setBusy(false);}
  };
  $('.editor-export').onclick=async()=>{
    error('');try{const next=collect();setBusy(true,'Packaging your website, photos, and music…');const blob=await exportWebsite(next,files);const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${next.partnerOne}-${next.partnerTwo}-invitation.zip`.replace(/[^a-z0-9.\-_]/gi,'-');a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);notify('Website exported. Extract the ZIP and upload its contents to your host.');}catch(e){error(e.message||'Export failed. Check that all linked files are accessible.');}finally{setBusy(false);}
  };
  $('.editor-reset').onclick=async()=>{
    if(!confirm('Remove the changes and uploaded files saved in this browser? Your repository and exported websites will not change.'))return;
    error('');setBusy(true,'Resetting browser edits…');try{await onReset();setBusy(false);close();notify('Browser edits removed.');}catch(e){error(e.message||'Browser edits could not be removed.');setBusy(false);}
  };
}

async function socialCard(c){
  await (document.fonts?.ready||Promise.resolve());
  const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=630;const x=canvas.getContext('2d');
  x.fillStyle='#f7f3e8';x.fillRect(0,0,1200,630);x.strokeStyle='#ad935d';x.lineWidth=1;x.strokeRect(34,34,1132,562);x.strokeRect(45,45,1110,540);
  x.fillStyle='#263c32';x.textAlign='center';x.font='18px Arial';x.letterSpacing='5px';x.fillText('A CELEBRATION OF LOVE',600,160);x.letterSpacing='0px';
  const names=`${c.partnerOne} & ${c.partnerTwo}`;let size=110;x.font=`${size}px Georgia`;while(x.measureText(names).width>1050&&size>36){size-=2;x.font=`${size}px Georgia`;}x.fillText(names,600,320);
  const date=new Intl.DateTimeFormat('en-GB',{timeZone:c.timeZone,day:'numeric',month:'long',year:'numeric'}).format(new Date(c.dateTime));
  const time=new Intl.DateTimeFormat('en-IN',{timeZone:c.timeZone,hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(c.dateTime));
  x.fillStyle='#8c7344';x.font='25px Georgia';x.fillText(`${date}  ·  ${time.toUpperCase()}`,600,408);x.fillStyle='#4b5d4d';x.font='22px Arial';
  const venue=c.venue.length>80?c.venue.slice(0,77)+'…':c.venue;x.fillText(venue,600,460,1020);
  return new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
}
async function exportWebsite(config,uploads){
  const c=cloneConfig(config), entries=[], seen=new Set();
  async function fetchBlob(path){const response=await fetch(assetUrl(path));if(!response.ok)throw new Error(`Could not load ${path} (${response.status}).`);return response.blob();}
  const sourceFiles=['app.js','styles.css','editor.js','zip.js','share.js'];
  for(const path of sourceFiles)entries.push([path,await fetchBlob(path)]);
  const assets=['art/botanical.svg','art/church.svg','art/favicon.svg','fonts/cormorant-400.woff2','fonts/cormorant-italic.woff2','fonts/dm-sans.woff2','fonts/Cormorant-OFL.txt','fonts/DMSans-OFL.txt'];
  for(const path of assets){entries.push([path,await fetchBlob(path)]);seen.add(path);}
  async function packageAsset(src,prefix){
    if(!src)return '';
    if(src.startsWith('blob:')||src.startsWith('data:'))throw new Error('Please upload the original file instead of using a temporary browser URL.');
    const sourcePath=src.replace(/^\//,'');
    let path=sourcePath;
    if(/^https?:\/\//i.test(src)){
      const parsed=new URL(src),ext=parsed.pathname.split('.').pop();path=`media/${prefix}-${crypto.randomUUID().slice(0,8)}.${/^[a-z0-9]{1,5}$/i.test(ext)?ext:'bin'}`;
    }
    if(!seen.has(path)){entries.push([path,uploads[sourcePath]||uploads[src]||await fetchBlob(src)]);seen.add(path);}
    return path;
  }
  for(const key of ['partnerOne','partnerTwo'])c.photos[key].src=await packageAsset(c.photos[key].src,key);
  for(let i=0;i<c.gallery.length;i++)c.gallery[i].src=await packageAsset(c.gallery[i].src,`gallery-${i}`);
  c.music.src=await packageAsset(c.music.src,'music');
  if(!c.shareImage||/^(\/)?art\/social-preview\.png$/.test(c.shareImage)){c.shareImage='art/social-preview.png';entries.push(['art/social-preview.png',await socialCard(c)]);}
  else c.shareImage=await packageAsset(c.shareImage,'sharing');
  // Keep the default asset available even when a custom card is selected.
  if(c.shareImage!=='art/social-preview.png')entries.push(['art/social-preview.png',await socialCard(c)]);
  const htmlResponse=await fetch(assetUrl('index.html'));if(!htmlResponse.ok)throw new Error('Could not load the website template.');
  let html=embedContent(renderMetadata(await htmlResponse.text(),c),c);
  const date=new Intl.DateTimeFormat('en-GB',{timeZone:c.timeZone,dateStyle:'long',timeStyle:'short'}).format(new Date(c.dateTime));
  html=html.replace(/<noscript>[\s\S]*?<\/noscript>/,`<noscript><div class="no-js"><h1>${esc(c.partnerOne)} &amp; ${esc(c.partnerTwo)}</h1><p>${esc(c.heroMessage)}</p><p>${esc(date)}<br>${esc(c.venue)}</p><a href="${esc(c.mapUrl)}">View location</a></div></noscript>`);
  entries.push(['index.html',html],['content.json',JSON.stringify(c,null,2)],['README.txt','Your wedding invitation\n\nExtract this ZIP and upload ALL its contents to any static web host, preserving the folders.\nUse an HTTPS address. No build, database, or application server is needed.\nBefore sharing on WhatsApp, set the published address in Edit invitation → Sharing and export again.\nOpen the published site with ?edit=1 to edit in your browser. Browser edits stay private until exported and uploaded again.\nKeep the original photographs and music separately as a backup.\n']);
  return createZip(entries);
}
