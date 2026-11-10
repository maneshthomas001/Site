import sharp from 'sharp';
const xml=value=>String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export async function previewImage(config,path) {
  const names=`${config.partnerOne} & ${config.partnerTwo}`;
  const size=Math.min(108,Math.max(34,1650/names.length));
  const date=new Date(config.dateTime);
  const day=new Intl.DateTimeFormat('en-GB',{timeZone:config.timeZone,day:'numeric',month:'long',year:'numeric'}).format(date);
  const time=new Intl.DateTimeFormat('en-GB',{timeZone:config.timeZone,hour:'numeric',minute:'2-digit',hour12:true}).format(date).toUpperCase();
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <rect width="1200" height="630" fill="#f7f3e8"/>
    <rect x="30" y="30" width="1140" height="570" rx="2" fill="none" stroke="#a78c54"/>
    <rect x="40" y="40" width="1120" height="550" fill="none" stroke="#d4c7a4"/>
    <path d="M530 128h140M530 502h140" stroke="#a78c54"/>
    <g text-anchor="middle" fill="#293c32"><text x="600" y="181" font-family="sans-serif" font-size="15" letter-spacing="4">${xml(config.labels?.celebration||'A celebration of love').toUpperCase()}</text>
    <text x="600" y="318" font-family="serif" font-size="${size}">${xml(names)}</text>
    <text x="600" y="403" font-family="serif" font-size="28" fill="#9c804b">${xml(day)} · ${xml(time)}</text>
    <text x="600" y="457" font-family="sans-serif" font-size="${Math.min(23,1200/Math.max(config.venue.length,1))}">${xml(config.venue)}</text></g></svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path);
}
