const escape = value => String(value || '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function embedContent(html,config) {
  const json=JSON.stringify(config).replace(/</g,'\\u003c');
  const block=`<script id="invitation-content" type="application/json">${json}</script>`;
  if(/<script\b[^>]*\bid="invitation-content"[^>]*>[\s\S]*?<\/script>/.test(html)) {
    return html.replace(/<script\b[^>]*\bid="invitation-content"[^>]*>[\s\S]*?<\/script>/,()=>block);
  }
  return html.replace('</head>',()=>`${block}\n</head>`);
}
export function renderMetadata(html,c) {
  const title = `${c.partnerOne} & ${c.partnerTwo} — A Celebration of Love`;
  const base = /^https?:\/\//i.test(c.siteUrl) ? c.siteUrl.replace(/\/$/,'') : '';
  const image = /^https?:\/\//i.test(c.shareImage) ? c.shareImage : `${base}/${(c.shareImage||'art/social-preview.png').replace(/^\//,'')}`;
  return html.replace(/<!-- share:start -->[\s\S]*?<!-- share:end -->/,`<!-- share:start -->
  <title>${escape(title)}</title>
  <meta name="description" content="${escape(c.shareDescription)}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escape(title)}">
  <meta property="og:description" content="${escape(c.shareDescription)}">
  <meta property="og:image" content="${escape(image)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  ${base ? `<meta property="og:url" content="${escape(base)}"><link rel="canonical" href="${escape(base)}">` : ''}
  <!-- share:end -->`);
}
