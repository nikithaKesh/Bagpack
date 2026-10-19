(() => {
const LS_ITEMS='zono-index-items-v6', LS_CATS='zono-index-categories-v6', LS_COLLECTIONS='zono-index-collections-v6', LS_NOTES='bagpack-notes-v1', LS_SB='zono-index-supabase-v1';
const defaultCategories=[
'Accounts','AI & Automation','Development','Design & UI/UX','Assets & Media','Education & Learning',
'Research & Reading','Entertainment & Streaming','Games & Interactive','Work & Freelance','Productivity',
'Shopping & Lifestyle','Social Platforms','Business & References','Utilities & Downloads','Private Vault','Short Links & Review'
];
let categories=JSON.parse(localStorage.getItem(LS_CATS)||'null')||defaultCategories.map((name,i)=>({id:'cat-'+i,name,description:''}));
let items=JSON.parse(localStorage.getItem(LS_ITEMS)||'null')||window.SEED_ITEMS.map(x=>({...x}));
let collections=JSON.parse(localStorage.getItem(LS_COLLECTIONS)||'null')||[
 {id:'col-portfolio',name:'Portfolio Inspiration',description:'References and ideas for portfolio work.',itemIds:[],createdAt:new Date().toISOString()},
 {id:'col-games',name:'Game Ideas',description:'Games, mechanics, environments and inspiration.',itemIds:[],createdAt:new Date().toISOString()},
 {id:'col-tools',name:'Tools to Try',description:'Resources worth testing later.',itemIds:[],createdAt:new Date().toISOString()}
];
let notes=JSON.parse(localStorage.getItem(LS_NOTES)||'null')||[];
let activeNoteId=null, noteColorFilter='all';
let activeView='overview', density='grid', vaultUnlocked=false, discoverySeed=0;
let libraryPage=1, lastLibraryPageItems=[];
const LIBRARY_PAGE_SIZE=BAGPACK_CONFIG.PAGE_SIZE;
let supabaseClient=null, supabaseConfig={url:BAGPACK_CONFIG.SUPABASE.url,anonKey:BAGPACK_CONFIG.SUPABASE.publishableKey};
let bulkCandidates=[];

const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const notificationIcons={
 success:'check', error:'fail', warning:'alert', info:'spark'
};
function notify(message,type='info',title=''){
 const center=$('#notificationCenter');
 if(!center){console.log(message);return}
 const id=bagpackUid('notification');
 const icon=notificationIcons[type]||'spark';
 const n=document.createElement('div');
 n.className=`notification notification-${type}`;
 n.dataset.notificationId=id;
 n.innerHTML=`<div class="notification-icon">${svgIcon(icon)}</div><div class="notification-copy">${title?`<strong>${esc(title)}</strong>`:''}<span>${esc(message)}</span></div><button class="notification-close" aria-label="Dismiss">${svgIcon('close')}</button><div class="notification-progress"></div>`;
 center.appendChild(n);
 requestAnimationFrame(()=>n.classList.add('show'));
 const remove=()=>{n.classList.remove('show');setTimeout(()=>n.remove(),220)};
 n.querySelector('.notification-close').addEventListener('click',remove);
 setTimeout(remove,type==='error'?6500:4200);
}
const toast=(m)=>notify(m,'success');
function save(){
 try{localStorage.setItem(LS_ITEMS,JSON.stringify(items))}
 catch(err){
  // Large uploaded images can exceed localStorage's quota; IndexedDB retains the full payload.
  localStorage.setItem(LS_ITEMS,JSON.stringify(items.map(i=>({...i,coverUrl:i.coverUrl?.startsWith('data:image/')?'':i.coverUrl}))));
  notify('Photo saved to browser database (IndexedDB). Local backup cache omits embedded photos.','info','Photo storage');
 }
 localStorage.setItem(LS_CATS,JSON.stringify(categories));
 localStorage.setItem(LS_COLLECTIONS,JSON.stringify(collections));
 localStorage.setItem(LS_NOTES,JSON.stringify(notes));
 dbPut('items',items);dbPut('categories',categories);dbPut('collections',collections);dbPut('notes',notes);
 scheduleCloudSync();
}
function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function canon(raw){
  try{
    const u=new URL(raw.trim());
    u.protocol='https:';u.hostname=u.hostname.toLowerCase().replace(/^www\./,'');
    u.pathname=u.pathname.replace(/\/+/g,'/'); if(u.pathname.length>1)u.pathname=u.pathname.replace(/\/$/,'');
    ['fbclid','gclid','igshid','mibextid','ref','ref_','source'].forEach(k=>u.searchParams.delete(k));
    [...u.searchParams.keys()].filter(k=>k.toLowerCase().startsWith('utm_')).forEach(k=>u.searchParams.delete(k));
    const sorted=[...u.searchParams.entries()].sort(([a],[b])=>a.localeCompare(b));u.search='';sorted.forEach(([k,v])=>u.searchParams.append(k,v));
    return u.toString().replace(/\/$/,'');
  }catch{return raw.trim().toLowerCase().replace(/\/$/,'')}
}
function domain(url){try{return new URL(url).hostname.replace(/^www\./,'')}catch{return url}}
function titleFrom(url){return domain(url).split('.')[0].replace(/[-_]/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}

function normalizeItemShape(i){
 i.tags=Array.isArray(i.tags)?i.tags:[];
 i.subcategory=i.subcategory||'';
 i.theme=i.theme||'';
 i.favorite=!!i.favorite;
 i.pinned=!!i.pinned;
 i.openCount=Number(i.openCount||0);
 i.lastOpenedAt=i.lastOpenedAt||null;
 i.status=i.status||'active';
 i.coverUrl=i.coverUrl||i.cover_url||'';
 i.updatedAt=i.updatedAt||i.updated_at||i.createdAt||new Date().toISOString();
 return i;
}
items=items.map(normalizeItemShape);
normalizeActiveAndAudit(items);

const BAGPACK_ACTIVE_AUDIT='bagpack-all-active-v95';
function normalizeActiveAndAudit(list){
 let changed=0,flagged=0;
 const valid=new Set(defaultCategories);
 for(const i of list){
  if(i.status!=='active'){i.status='active';i.updatedAt=new Date().toISOString();changed++}
  if(i.type==='account' && i.category!=='Accounts'){i.category='Accounts';i.updatedAt=new Date().toISOString();changed++}
  if(i.type!=='account' && i.category==='Accounts'){
    const suggested=suggestCategory(i.url);
    i.category=suggested==='Short Links & Review'?'Short Links & Review':suggested;
    i.updatedAt=new Date().toISOString();changed++;
  }
  if(!valid.has(i.category||'')){i.category='Short Links & Review';i.updatedAt=new Date().toISOString();changed++;flagged++}
 }
 return {changed,flagged};
}

const STATUS_MIGRATION_KEY='bagpack-status-active-migrated-v1';
if(localStorage.getItem(STATUS_MIGRATION_KEY)!=='1'){
 items.forEach(i=>i.status='active');
 localStorage.setItem(STATUS_MIGRATION_KEY,'1');
 localStorage.setItem(LS_ITEMS,JSON.stringify(items));
}


function suggestSubcategory(item){
 const taxonomy=window.BAGPACK_SUBCATEGORIES||{};
 const options=taxonomy[item.category]||[[`${item.category||'General'} Resources`,[]]];
 const target=[item.title,item.url,item.note,item.theme].filter(Boolean).join(' ').toLowerCase();
 for(const [label,keys] of options){if(keys.length && keys.some(key=>target.includes(key)))return label}
 return options[options.length-1][0];
}
function fillMissingSubcategories(list=items){
 let changed=0;
 list.forEach(item=>{
   if(!(item.subcategory||'').trim()){
     item.subcategory=suggestSubcategory(item);
     item.updatedAt=new Date().toISOString(); changed++;
   }
 });
 return changed;
}
function isUncategorized(item){
  return !item.category || ['Imported','Other','Uncategorized','Short Links & Review'].includes(item.category);
}
function assignMissingCategories(list=items){
  let changed=0;
  list.forEach(i=>{
    if(i.type!=='account' && isUncategorized(i)){
      const suggested=suggestCategory(i.url);
      if(suggested && suggested!=='Short Links & Review'){
        i.category=suggested;
        changed++;
      }
    }
  });
  return changed;
}
function duplicateMap(){
 const m=new Map(); items.forEach(i=>{const k=canon(i.url); if(!m.has(k))m.set(k,[]);m.get(k).push(i)});
 return [...m.entries()].filter(([,g])=>g.length>1).sort((a,b)=>b[1].length-a[1].length);
}
function suggestCategory(url){
 const p=(url+'').toLowerCase(), d=domain(url).toLowerCase();
 const rules=[
  ['Private Vault',['onlyfans','pornhub','chaturbate','livejasmin','hentai','hanime','xxx','spicychat','candy.ai','yodayo','nectar.ai','kindroid','bunkr']],
  ['AI & Automation',['chatgpt','openai','claude.ai','gemini','perplexity','deepseek','grok','midjourney','huggingface','toolify','replit','bolt.new','lovable','manus.im','n8n','zapier','make.com','pipedream']],
  ['Development',['github','gitlab','vercel','netlify','threejs','vite','tailwind','react','codepen','codesandbox','stackblitz','devdocs','w3schools','freecodecamp','leetcode','codewars','roadmap.sh','supabase','firebase']],
  ['Design & UI/UX',['figma','behance','awwwards','dribbble','coolors','font','icon','uiverse','mobbin','lapa.ninja','land-book','spline','framer']],
  ['Assets & Media',['unsplash','pexels','freepik','envato','lottiefiles','remove.bg','remini','canva','capcut']],
  ['Education & Learning',['coursera','udemy','skillshare','khanacademy','duolingo','datacamp','codecademy','mooc.org','udacity','alison','classcentral','microsoft.com/learn']],
  ['Entertainment & Streaming',['netflix','primevideo','crunchyroll','spotify','imdb','bilibili','viki.com','anime']],
  ['Games & Interactive',['itch.io','wargaming','geo-fs','deadshot','slowroads','neal.fun','game']],
  ['Work & Freelance',['upwork','freelancer','fiverr','clutch','hypeauditor']],
  ['Productivity',['notion','todoist','obsidian','anki','reflect.app','bitly']],
  ['Shopping & Lifestyle',['shop','clothing','nutrition','supplement','sneaker','apparel','fashion','cosrx','skin1004']],
  ['Social Platforms',['instagram','facebook','threads.net','x.com','tiktok','linkedin','pinterest','discord','snapchat','reddit']],
  ['Research & Reading',['wikipedia','frontiersin','ted.com','scribd','medium.com','wattpad']],
  ['Utilities & Downloads',['massgrave','getintopc','seostudio.tools']]
 ];
 for(const [cat,words] of rules) if(words.some(w=>p.includes(w)||d.includes(w))) return cat;
 return 'Short Links & Review';
}
function renderSelects(){
 const opts=categories.map(c=>`<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('');
 ['#linkCategory','#editCategory'].forEach(id=>{const el=$(id);if(el){const val=el.value;el.innerHTML=opts;if(val)el.value=val}});
 const f=$('#libraryCategory');const val=f.value;f.innerHTML='<option value="all">All categories</option>'+opts;if(val)f.value=val;
 ['#discoveryCategory','#randomCategory'].forEach(id=>{const el=$(id);if(!el)return;const v=el.value;el.innerHTML=(id==='#randomCategory'?'<option value="all">Any category</option>':'<option value="all">All categories</option>')+opts;if(v)el.value=v});
 const colOpts='<option value="">None</option>'+collections.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
 const lc=$('#linkCollection');if(lc)lc.innerHTML=colOpts;
 const ec=$('#editCollections');if(ec)ec.innerHTML=collections.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
}

const categoryColors={
 'Accounts':'#81899A','AI & Automation':'#8173B5','Development':'#6686A5','Design & UI/UX':'#9B7089',
 'Assets & Media':'#967B59','Education & Learning':'#668B79','Research & Reading':'#628682',
 'Entertainment & Streaming':'#8F6D76','Games & Interactive':'#8B7655','Work & Freelance':'#77808D',
 'Productivity':'#747AA2','Shopping & Lifestyle':'#8E7188','Social Platforms':'#638497',
 'Business & References':'#737B86','Utilities & Downloads':'#71757D','Private Vault':'#8B5D63',
 'Short Links & Review':'#807764'
};
function catColor(name){return categoryColors[name]||'#64748b'}
const socialBrands={
 github:{color:'#5f6670',label:'GH'},linkedin:{color:'#607c91',label:'in'},instagram:{color:'#8b6f80',label:'IG'},
 youtube:{color:'#8e6265',label:'YT'},x:{color:'#666970',label:'X'},twitter:{color:'#666970',label:'X'},
 threads:{color:'#696b70',label:'TH'},pinterest:{color:'#8a6669',label:'P'},snapchat:{color:'#8e8966',label:'SC'},
 facebook:{color:'#637990',label:'f'},behance:{color:'#647e9a',label:'Bē'},duolingo:{color:'#6f876a',label:'D'},
 spotify:{color:'#68836f',label:'S'},gitlab:{color:'#907363',label:'GL'},tiktok:{color:'#77727d',label:'TT'},
 discord:{color:'#707795',label:'D'},medium:{color:'#696b70',label:'M'},whatsapp:{color:'#668674',label:'WA'},
 blogger:{color:'#8a7567',label:'B'},patreon:{color:'#896d70',label:'P'},buymeacoffee:{color:'#8b8269',label:'BMC'},
 cosmos:{color:'#6c7079',label:'C'},wattpad:{color:'#8b705f',label:'W'}
};
function brandFor(item){
 const hay=((item.title||'')+' '+(item.domain||'')+' '+(item.url||'')).toLowerCase();
 for(const [k,v] of Object.entries(socialBrands)) if(hay.includes(k)) return {key:k,...v};
 return {key:'link',color:'#6d727d',label:(item.title||'A').slice(0,2).toUpperCase()};
}
function brandLogo(item){
 const b=brandFor(item);
 const fa={
  github:'fa-github',
  linkedin:'fa-linkedin-in',
  instagram:'fa-instagram',
  youtube:'fa-youtube',
  x:'fa-x-twitter',
  twitter:'fa-x-twitter',
  threads:'fa-threads',
  pinterest:'fa-pinterest-p',
  snapchat:'fa-snapchat',
  facebook:'fa-facebook-f',
  behance:'fa-behance',
  whatsapp:'fa-whatsapp',
  spotify:'fa-spotify',
  gitlab:'fa-gitlab',
  tiktok:'fa-tiktok',
  discord:'fa-discord',
  medium:'fa-medium',
  blogger:'fa-blogger-b',
  wattpad:'fa-wattpad'
 };
 const fallback={
  duolingo:'D',
  buymeacoffee:'BMC',
  cosmos:'C'
 };
 if(fa[b.key]) return `<i class="fa-brands ${fa[b.key]} brand-fa" aria-hidden="true"></i>`;
 const initials=fallback[b.key]||(item.title||b.key||'A').replace(/[^A-Za-z0-9 ]/g,'').split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase()||'A';
 return `<span class="brand-fallback brand-${esc(b.key)}">${esc(initials)}</span>`;
}

// IndexedDB persistence. localStorage remains only as a compatibility cache.
const DB_NAME='bagpack-db', DB_VERSION=1, DB_STORE='state';
let dbPromise=null;
function openDatabase(){
 if(!('indexedDB' in window)) return Promise.resolve(null);
 if(dbPromise) return dbPromise;
 dbPromise=new Promise((resolve,reject)=>{
   const req=indexedDB.open(DB_NAME,DB_VERSION);
   req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(DB_STORE))db.createObjectStore(DB_STORE)};
   req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error);
 });
 return dbPromise;
}
async function dbPut(key,value){
 try{const db=await openDatabase();if(!db)return;await new Promise((res,rej)=>{const tx=db.transaction(DB_STORE,'readwrite');tx.objectStore(DB_STORE).put(value,key);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error)});const s=$('#dbStatus');if(s)s.textContent='IndexedDB · saved';}
 catch(e){const s=$('#dbStatus');if(s)s.textContent='Storage fallback';}
}
async function dbGet(key){
 try{const db=await openDatabase();if(!db)return null;return await new Promise((res,rej)=>{const tx=db.transaction(DB_STORE,'readonly');const r=tx.objectStore(DB_STORE).get(key);r.onsuccess=()=>res(r.result??null);r.onerror=()=>rej(r.error)});}catch{return null}
}
async function dbClear(){
 try{const db=await openDatabase();if(!db)return;await new Promise((res,rej)=>{const tx=db.transaction(DB_STORE,'readwrite');tx.objectStore(DB_STORE).clear();tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error)})}catch{}
}
async function hydrateDatabase(){
 const dbItems=await dbGet('items'), dbCats=await dbGet('categories'), dbCols=await dbGet('collections'), dbNotes=await dbGet('notes');
 if(Array.isArray(dbItems)&&dbItems.length){
   items=dbItems.map(normalizeItemShape);
   const audited=normalizeActiveAndAudit(items);
   if(audited.changed){await dbPut('items',items);localStorage.removeItem(BAGPACK_CONFIG.STORAGE.lastCloudSync);}
   if(Array.isArray(dbCats)&&dbCats.length)categories=dbCats;
   if(Array.isArray(dbCols))collections=dbCols;
   if(Array.isArray(dbNotes))notes=dbNotes;
   localStorage.setItem(LS_ITEMS,JSON.stringify(items));localStorage.setItem(LS_CATS,JSON.stringify(categories));localStorage.setItem(LS_COLLECTIONS,JSON.stringify(collections));
 localStorage.setItem(LS_NOTES,JSON.stringify(notes));renderAll();
 } else {await dbPut('items',items);await dbPut('categories',categories);await dbPut('collections',collections);await dbPut('notes',notes);}
 const s=$('#dbStatus');if(s)s.textContent='IndexedDB · active';
}


const statusMeta={
 active:{label:'Active',icon:'check',color:'#4FBE73'},
 pending:{label:'Pending',icon:'alert',color:'#D18A4A'},
 in_progress:{label:'In progress',icon:'refresh',color:'#4B91CF'},
 submitted:{label:'Submitted',icon:'send',color:'#8067CF'},
 in_review:{label:'In review',icon:'review',color:'#B1A43E'},
 success:{label:'Success',icon:'check',color:'#4EAE69'},
 failed:{label:'Failed',icon:'fail',color:'#C9635E'},
 expired:{label:'Expired',icon:'clock',color:'#777B82'}
};
function svgIcon(name,cls='icon'){
 return `<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
}
function statusChip(status='active'){
 const m=statusMeta[status]||statusMeta.pending;
 return `<span class="status-chip" style="--status:${m.color}">${svgIcon(m.icon,'status-icon')}<span>${m.label}</span></span>`;
}
function screenshotUrl(item){
 if(item.coverUrl) return item.coverUrl;
 if(item.category==='Private Vault' || item.type==='account') return '';
 if(!/^https?:\/\//i.test(item.url||'')) return '';
 return `https://image.thum.io/get/width/720/crop/420/noanimate/${encodeURI(item.url)}`;
}
function coverMarkup(item){
 const shot=screenshotUrl(item);
 const domainText=esc(item.domain||domain(item.url));
 const initial=esc((item.title||domainText||'?').slice(0,1).toUpperCase());
 return `<div class="card-cover ${shot?'has-shot':'cover-fallback'}">
   <div class="cover-fallback-inner"><div class="cover-monogram">${initial}</div><span>${domainText}</span></div>
   ${shot?`<img loading="lazy" referrerpolicy="no-referrer" src="${esc(shot)}" alt="" onerror="this.remove();this.parentElement.classList.add('cover-fallback')">`:''}
   <div class="cover-topline"><span class="category-dot-mini" style="background:${catColor(item.category)}"></span><span>${esc(item.category||'Uncategorized')}</span></div>
 </div>`;
}

function renderHomeWorkspace(){
 const counts=new Map();
 items.forEach(i=>counts.set(i.category||'Uncategorized',(counts.get(i.category||'Uncategorized')||0)+1));
 const top=[...counts].sort((a,b)=>b[1]-a[1]).slice(0,6);
 const cat=$('#homeCategories');
 if(cat)cat.innerHTML=top.map(([name,n])=>`<button class="home-category" data-category-jump="${esc(name)}"><span class="home-category-marker" style="background:${catColor(name)}"></span><span>${esc(name)}</span><strong>${n}</strong></button>`).join('');
 const needsSub=items.filter(i=>!i.subcategory||i.subcategory==='Needs Manual Classification').length;
 const unknown=items.filter(i=>i.category==='Short Links & Review').length;
 const expired=items.filter(i=>i.status==='expired').length;
 const duplicate=duplicateMap().length;
 const attention=$('#homeAttention');
 if(attention)attention.innerHTML=[['Needs subcategory review',needsSub,'library'],['Category review queue',unknown,'categories'],['Duplicate groups',duplicate,'duplicates'],['Expired links',expired,'library']].map(([label,count,page])=>`<button class="home-attention-row" data-jump="${page}"><span>${esc(label)}</span><strong>${count}</strong>${svgIcon('chevron')}</button>`).join('');
 const pinned=items.filter(i=>i.pinned&&i.category!=='Private Vault').length;
 const noteCount=notes.length;
 const accounts=items.filter(i=>i.type==='account').length;
 const work=$('#homeWork');
 if(work)work.innerHTML=[['Pinned work resources',pinned,'workbench'],['Saved notes',noteCount,'notes'],['Linked accounts',accounts,'accounts']].map(([label,count,page])=>`<button class="home-attention-row" data-jump="${page}"><span>${esc(label)}</span><strong>${count}</strong>${svgIcon('chevron')}</button>`).join('');
}
function renderStats(){
 const dups=duplicateMap();
 $('#dupBadge').textContent=dups.length;$('#statDupes').textContent=dups.length;
 $('#statResources').textContent=items.filter(i=>i.type!=='account').length;
 $('#statAccounts').textContent=items.filter(i=>i.type==='account').length;
 $('#statCategories').textContent=categories.length;
 const unc=items.filter(i=>i.category==='Short Links & Review').length;
 const expired=items.filter(i=>i.status==='expired').length;
 const neverOpened=items.filter(i=>!i.lastOpenedAt && i.type!=='account').length;
 const issues=dups.length+unc+expired;
 $('#healthScore').textContent=issues?`${issues} issues`:'Clean';
 $('#healthScoreBig').textContent=issues?`${issues}`:'0';
 $('#healthChecks').innerHTML=[
  ['Broken / expired',expired],
  ['Duplicate groups',dups.length],
  ['Needs category review',unc],
  ['Never opened',neverOpened],
  ['Total records',items.length]
 ].map(x=>`<div class="health-row"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');
 renderHomeWorkspace();
 $('#recentList').innerHTML=items.slice(-5).reverse().map(i=>`<div class="compact-item"><div class="favicon">${esc((i.domain||domain(i.url)).slice(0,2))}</div><div><strong>${esc(i.title||titleFrom(i.url))}</strong><small>${esc(i.url)}</small></div><button class="text-btn manage" data-id="${i.id}">Manage</button></div>`).join('');
}
function itemCard(i){
 const name=esc(i.title||titleFrom(i.url));
 return `<article class="resource-card bagpack-simple-resource" style="--cat:${catColor(i.category)}">
   ${coverMarkup(i)}
   <div class="resource-card-body">
     <div class="resource-card-top"><h3 title="${name}">${name}</h3><div class="record-tools"><button type="button" class="icon-btn details-trigger" data-id="${esc(i.id)}" aria-label="Details for ${name}" title="View information">${svgIcon('more')}</button><button type="button" class="icon-btn manage" data-id="${esc(i.id)}" aria-label="Edit ${name}" title="Edit record">${svgIcon('edit')}</button></div></div>
     <div class="card-actions"><a class="secondary" data-open-id="${esc(i.id)}" href="${esc(i.url)}" target="_blank" rel="noopener noreferrer">Open ${svgIcon('external')}</a></div>
   </div>
 </article>`;
}
function renderLibrary(){
 const q=(($('#librarySearch')?.value||$('#globalSearch')?.value||'').trim().toLowerCase());
 const cat=$('#libraryCategory')?.value||'all', typ=$('#libraryType')?.value||'all', status=$('#libraryStatus')?.value||'all';
 const pin=$('#libraryPinned')?.value||'all', sort=$('#librarySort')?.value||'newest';
 let list=items.filter(i=>{
  const hay=[i.title,i.url,i.domain,i.note,i.category,i.subcategory,i.theme,...(i.tags||[])].join(' ').toLowerCase();
  return (!q||hay.includes(q))
    &&(cat==='all'||i.category===cat)
    &&(typ==='all'||i.type===typ)
    &&(status==='all'||i.status===status)
    &&(pin==='all'||(pin==='pinned'&&i.pinned)||(pin==='favorite'&&i.favorite));
 });
 const time=(x)=>x?Date.parse(x)||0:0;
 list.sort((a,b)=>{
   if(sort==='oldest')return time(a.createdAt)-time(b.createdAt);
   if(sort==='az')return (a.title||'').localeCompare(b.title||'');
   if(sort==='za')return (b.title||'').localeCompare(a.title||'');
   if(sort==='recent_opened')return time(b.lastOpenedAt)-time(a.lastOpenedAt);
   if(sort==='most_opened')return (b.openCount||0)-(a.openCount||0);
   if(sort==='domain')return (a.domain||domain(a.url)).localeCompare(b.domain||domain(b.url));
   return time(b.createdAt)-time(a.createdAt);
 });
 const totalFiltered=list.length;
 const totalPages=Math.max(1,Math.ceil(totalFiltered/LIBRARY_PAGE_SIZE));
 libraryPage=Math.min(Math.max(1,libraryPage),totalPages);
 const start=(libraryPage-1)*LIBRARY_PAGE_SIZE;
 lastLibraryPageItems=list.slice(start,start+LIBRARY_PAGE_SIZE);
 $('#libraryCount').textContent=`${totalFiltered} item${totalFiltered===1?'':'s'}`;
 const meta=$('#libraryMeta');if(meta)meta.textContent=`${start+1}-${Math.min(start+LIBRARY_PAGE_SIZE,totalFiltered)} of ${totalFiltered} · ${items.length} total`;
 const g=$('#libraryGrid');g.className='card-grid '+(density==='compact'?'compact':'');g.innerHTML=lastLibraryPageItems.map(itemCard).join('')||'<div class="empty-state"><strong>No matching resources</strong><span>Try clearing one or more filters.</span></div>';
 renderLibraryPagination(totalPages,totalFiltered);
}
function renderLibraryPagination(totalPages,totalFiltered){
 const p=$('#libraryPagination');if(!p)return;
 if(totalFiltered<=LIBRARY_PAGE_SIZE){p.innerHTML='';return}
 const around=[1,libraryPage-1,libraryPage,libraryPage+1,totalPages].filter((v,i,a)=>v>=1&&v<=totalPages&&a.indexOf(v)===i).sort((a,b)=>a-b);
 let last=0,html=`<button class="pagination-btn" data-page="${libraryPage-1}" ${libraryPage===1?'disabled':''} aria-label="Previous page">${svgIcon('left')}</button>`;
 for(const n of around){if(last&&n-last>1)html+='<span class="pagination-gap">…</span>';html+=`<button class="pagination-btn ${n===libraryPage?'active':''}" data-page="${n}">${n}</button>`;last=n}
 html+=`<button class="pagination-btn" data-page="${libraryPage+1}" ${libraryPage===totalPages?'disabled':''} aria-label="Next page">${svgIcon('right')}</button>`;
 p.innerHTML=html;
}


function accountCoverMarkup(item){
 const b=brandFor(item);
 const hasPhoto=!!(item.coverUrl && (/^data:image\//.test(item.coverUrl)||/^https?:\/\//.test(item.coverUrl)));
 const photo=hasPhoto?`<img class="account-profile-cover" src="${esc(item.coverUrl)}" alt="" loading="lazy" onerror="this.remove()">`:'';
 const name=(item.title||b.label||'Account');
 const summaryRaw=(item.note||`Official ${b.label||b.key} profile`).split('·').pop().trim();
 const summary=summaryRaw||`Official ${b.label||b.key} profile`;
 return `<div class="account-cover" style="--brand:${b.color}">${photo}</div>
 <div class="account-cover-copy"><strong>${esc(name)}</strong><span>${esc(summary)}</span></div>`;
}

function renderAccounts(){
 const acc=items.filter(i=>i.type==='account');
 $('#accountGrid').innerHTML=acc.map(i=>{
   const memberships=collections.filter(c=>(c.itemIds||[]).includes(i.id)).length;
   const name=esc(i.title||titleFrom(i.url));
   return `<article class="account-card" style="--brand:${brandFor(i).color}">
      ${accountCoverMarkup(i)}
      <div class="account-card-tools"><button type="button" class="icon-btn details-trigger" data-id="${esc(i.id)}" aria-label="Details for ${name}" title="Details">${svgIcon('more')}</button><button type="button" class="icon-btn manage" data-id="${esc(i.id)}" aria-label="Edit ${name}" title="Edit">${svgIcon('edit')}</button></div>
      <div class="account-card-body"><div class="account-stats" aria-label="Account activity"><span>${svgIcon('external')} <b>${Number(i.openCount||0)} opens</b></span><span>${svgIcon('collection')} <b>${memberships} lists</b></span></div><a class="follow-cta" data-open-id="${esc(i.id)}" href="${esc(i.url)}" target="_blank" rel="noopener noreferrer">Visit ${svgIcon('external')}</a></div>
   </article>`;
 }).join('')||'<div class="empty-state"><strong>No accounts yet.</strong></div>';
}
function renderDuplicates(){
 const allGroups=duplicateMap();
 const query=($('#dupSearch')?.value||'').trim().toLowerCase();
 const groups=allGroups.filter(([key,g])=>!query||key.toLowerCase().includes(query)||g.some(i=>[i.title,i.url,i.category].join(' ').toLowerCase().includes(query)));
 const total=groups.reduce((n,[,g])=>n+g.length,0);
 const set=(id,val)=>{const el=$(id);if(el)el.textContent=String(val)};
 set('#dupGroupCount',allGroups.length);set('#dupCopyCount',allGroups.reduce((n,[,g])=>n+g.length,0));set('#dupExtraCount',allGroups.reduce((n,[,g])=>n+g.length-1,0));set('#dupVisibleCount',query?`${groups.length} of ${allGroups.length} groups`:`${allGroups.length} groups`);
 $('#duplicateGroups').innerHTML=groups.map(([key,g],idx)=>`<section class="duplicate-group">
  <div class="dup-head"><div><span class="dup-group-label">MATCH ${idx+1}</span><strong>${g.length} saved records</strong><code title="${esc(key)}">${esc(key)}</code></div><span class="dup-domain">${esc(domain(key))}</span></div>
  <div class="dup-items">${g.map(i=>`<div class="dup-item"><input type="checkbox" data-dup-select="${esc(i.id)}" aria-label="Select ${esc(i.title||titleFrom(i.url))} for removal"><div class="dup-item-copy"><strong>${esc(i.title||titleFrom(i.url))}</strong><small>${esc(i.url)}</small><span>${esc(i.category||'Uncategorized')} · ${i.sourceLine?'Imported record':'Saved record'}</span></div><button type="button" class="secondary manage" data-id="${esc(i.id)}">Inspect</button></div>`).join('')}</div>
  <div class="dup-actions"><span class="dup-safety">Nothing is removed until you confirm</span><button type="button" class="secondary" data-keep-group="${idx}">Keep all</button><button type="button" class="danger" data-delete-selected="${idx}">Remove selected</button></div>
 </section>`).join('')||`<div class="dup-empty"><div class="dup-empty-icon">${svgIcon('check')}</div><strong>No duplicate groups found</strong><p>All currently saved URLs are unique under Bagpack's matching rules. New links are checked before saving.</p></div>`;
}
function renderCategories(){
 $('#categoryGrid').innerHTML=categories.map(c=>{const n=items.filter(i=>i.category===c.name).length,cc=catColor(c.name);return `<article class="category-card" style="--cat:${cc}"><div class="category-card-head"><span class="category-color" style="background:${cc}"></span><span>${n} items</span></div><strong>${esc(c.name)}</strong><p>${esc(c.description||'Auto-organized category.')}</p><div class="category-meter"><span style="width:${Math.min(100,(n/Math.max(1,items.length))*500)}%;background:${cc}"></span></div></article>`}).join('');
}

function visibleNonPrivate(){
 return items.filter(i=>i.type!=='account' && i.category!=='Private Vault');
}
function pseudoShuffle(list,seed=0){
 return [...list].sort((a,b)=>{
   const ha=[...String(a.id+seed)].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,7);
   const hb=[...String(b.id+seed)].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,7);
   return ha-hb;
 });
}
function renderWorkbench(){
 const list=items.filter(i=>i.pinned && i.category!=='Private Vault');
 const grid=$('#workbenchGrid'), empty=$('#workbenchEmpty');if(!grid)return;
 grid.innerHTML=list.map(itemCard).join('');
 empty.classList.toggle('hidden',list.length>0);
}
function renderCollections(){
 const grid=$('#collectionGrid');if(!grid)return;
 grid.innerHTML=collections.map(c=>{
   const linked=items.filter(i=>(c.itemIds||[]).includes(i.id));
   const sample=linked.slice(0,4);
   return `<article class="collection-card"><div class="collection-head"><div><strong>${esc(c.name)}</strong><p>${esc(c.description||'No description')}</p></div><span>${linked.length}</span></div>
   <div class="collection-samples">${sample.map(i=>`<button class="manage mini-resource" data-id="${esc(i.id)}">${esc((i.title||titleFrom(i.url)).slice(0,34))}</button>`).join('')||'<small>No resources added yet.</small>'}</div></article>`;
 }).join('');
}
function renderVault(){
 const grid=$('#vaultGrid'), locked=$('#vaultLocked');if(!grid)return;
 locked.classList.toggle('hidden',vaultUnlocked);grid.classList.toggle('hidden',!vaultUnlocked);
 if(vaultUnlocked)grid.innerHTML=items.filter(i=>i.category==='Private Vault').map(itemCard).join('')||'<div class="empty-state"><strong>Vault is empty.</strong></div>';
 const vb=$('#vaultToggleBtn');if(vb)vb.innerHTML=vaultUnlocked?`${svgIcon('lock')}<span>Lock vault</span>`:`${svgIcon('lock')}<span>Unlock vault</span>`;
}



function renderCloud(){
 const u=$('#supabaseUrl'), k=$('#supabaseAnonKey');
 if(u)u.value=supabaseConfig.url;if(k)k.value=supabaseConfig.anonKey;
 updateCloudUI();
}

function normalizeNote(n){
 n.tags=Array.isArray(n.tags)?n.tags:[];n.colorKey=n.colorKey||n.color_key||'slate';n.pinned=!!n.pinned;
 n.createdAt=n.createdAt||n.created_at||new Date().toISOString();n.updatedAt=n.updatedAt||n.updated_at||n.createdAt;return n;
}
notes=notes.map(normalizeNote);
function createNote(title='Untitled note',content='',colorKey='slate'){
 const n=normalizeNote({id:bagpackUid('note'),title,content,colorKey,tags:[],pinned:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
 notes.unshift(n);activeNoteId=n.id;save();renderNotes();return n;
}
function currentNote(){return notes.find(n=>n.id===activeNoteId)||null}
function renderNotes(){
 const listEl=$('#notesList');if(!listEl)return;
 const q=($('#notesSearch')?.value||'').trim().toLowerCase();
 let list=notes.filter(n=>(noteColorFilter==='all'||n.colorKey===noteColorFilter)&&(!q||[n.title,n.content,...n.tags].join(' ').toLowerCase().includes(q)));
 list.sort((a,b)=>(b.pinned-a.pinned)||(Date.parse(b.updatedAt)-Date.parse(a.updatedAt)));
 listEl.innerHTML=list.map(n=>`<button class="note-list-item ${n.id===activeNoteId?'active':''}" data-note-id="${esc(n.id)}" style="--note:${noteColorValue(n.colorKey)}"><div class="note-card-top"><span class="note-card-color"></span>${n.pinned?svgIcon('pin','note-pin'):''}</div><strong>${esc(n.title||'Untitled note')}</strong><p>${esc((n.content||'').replace(/\s+/g,' ').slice(0,130)||'Empty note')}</p><div class="note-card-foot"><small>${new Date(n.updatedAt).toLocaleDateString()}</small><span>${(n.tags||[]).slice(0,2).map(t=>'#'+esc(t)).join(' ')}</span></div></button>`).join('')||'<div class="notes-empty-small">No notes match this view.</div>';
 const n=currentNote(), empty=$('#noteEmpty'), editor=$('#noteEditor');
 empty.classList.toggle('hidden',!!n);editor.classList.toggle('hidden',!n);
 if(n){
   $('#noteTitle').value=n.title||'';$('#noteContent').value=n.content||'';$('#noteColor').value=n.colorKey||'slate';$('#noteTags').value=(n.tags||[]).join(', ');$('#pinNoteBtn').classList.toggle('active',n.pinned);
   $('#noteSavedState').textContent=`Updated ${new Date(n.updatedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`;updateNoteStats();noteHistory.undo=[n.content||''];noteHistory.redo=[];toggleNotePreview(false);
 }
}
function noteColorValue(k){return {slate:'#747A86',blue:'#5F7E9D',violet:'#7A6B9D',amber:'#907752',green:'#5D7F6D',rose:'#8D6877'}[k]||'#747A86'}
let noteSaveTimer=null;


function renderSimpleMarkdown(source=''){
 let out=esc(source);
 out=out.replace(/^### (.*)$/gm,'<h3>$1</h3>')
        .replace(/^## (.*)$/gm,'<h2>$1</h2>')
        .replace(/^# (.*)$/gm,'<h1>$1</h1>')
        .replace(/^> (.*)$/gm,'<blockquote>$1</blockquote>')
        .replace(/^- \[ \] (.*)$/gm,'<div class="md-check"><span>□</span>$1</div>')
        .replace(/^- \[x\] (.*)$/gmi,'<div class="md-check done"><span>✓</span>$1</div>')
        .replace(/^- (.*)$/gm,'<li>$1</li>')
        .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
        .replace(/\*(.*?)\*/g,'<em>$1</em>')
        .replace(/`([^`]+)`/g,'<code>$1</code>')
        .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
        .replace(/\n\n/g,'</p><p>')
        .replace(/\n/g,'<br>');
 return `<p>${out}</p>`;
}
function updateNoteStats(){
 const ta=$('#noteContent');if(!ta)return;
 const text=ta.value||'';
 const words=text.trim()?text.trim().split(/\s+/).length:0;
 $('#noteWordCount').textContent=`${words} word${words===1?'':'s'}`;
 $('#noteCharCount').textContent=`${text.length} chars`;
}
const noteHistory={undo:[],redo:[]};
function recordNoteHistory(){
 const ta=$('#noteContent');if(!ta)return;
 const value=ta.value;
 if(noteHistory.undo[noteHistory.undo.length-1]!==value){
   noteHistory.undo.push(value);
   if(noteHistory.undo.length>80)noteHistory.undo.shift();
   noteHistory.redo=[];
 }
}
function noteUndo(){
 const ta=$('#noteContent');if(!ta||noteHistory.undo.length<2)return;
 const current=noteHistory.undo.pop();noteHistory.redo.push(current);
 ta.value=noteHistory.undo[noteHistory.undo.length-1]||'';
 ta.dispatchEvent(new Event('input',{bubbles:true}));
}
function noteRedo(){
 const ta=$('#noteContent');if(!ta||!noteHistory.redo.length)return;
 const next=noteHistory.redo.pop();noteHistory.undo.push(next);ta.value=next;
 ta.dispatchEvent(new Event('input',{bubbles:true}));
}
function toggleNotePreview(force){
 const pane=$('#notePreviewPane'), ta=$('#noteContent'), btn=$('#notePreviewBtn');if(!pane||!ta)return;
 const show=typeof force==='boolean'?force:pane.classList.contains('hidden');
 pane.classList.toggle('hidden',!show);ta.classList.toggle('hidden',show);btn?.classList.toggle('active',show);
 if(show)pane.innerHTML=renderSimpleMarkdown(ta.value);
}

function applyNoteFormat(kind){
 const ta=$('#noteContent'); if(!ta)return;
 ta.focus();
 const start=ta.selectionStart||0, end=ta.selectionEnd||0;
 const selected=ta.value.slice(start,end);
 const before=ta.value.slice(0,start), after=ta.value.slice(end);
 let insert=selected, cursorStart=start, cursorEnd=end;
 const linePrefix=(prefix)=>{
   const source=selected||'Text';
   insert=source.split('\n').map(line=>prefix+line).join('\n');
   cursorStart=start;cursorEnd=start+insert.length;
 };
 if(kind==='h1'){insert='# '+(selected||'Heading');}
 else if(kind==='h2'){insert='## '+(selected||'Heading');}
 else if(kind==='bold'){insert='**'+(selected||'bold text')+'**';cursorStart=start+2;cursorEnd=start+insert.length-2;}
 else if(kind==='italic'){insert='*'+(selected||'italic text')+'*';cursorStart=start+1;cursorEnd=start+insert.length-1;}
 else if(kind==='bullet'){linePrefix('- ');}
 else if(kind==='check'){linePrefix('- [ ] ');}
 else if(kind==='quote'){linePrefix('> ');}
 else if(kind==='code'){insert='`'+(selected||'code')+'`';cursorStart=start+1;cursorEnd=start+insert.length-1;}
 else if(kind==='link'){insert='['+(selected||'link text')+'](https://)';cursorStart=start+1;cursorEnd=start+(selected||'link text').length+1;}
 ta.value=before+insert+after;
 ta.setSelectionRange(cursorStart,cursorEnd);
 ta.dispatchEvent(new Event('input',{bubbles:true}));
}

function saveActiveNoteFromEditor(){
 const n=currentNote();if(!n)return;
 n.title=$('#noteTitle').value.trim()||'Untitled note';n.content=$('#noteContent').value;n.colorKey=$('#noteColor').value;n.tags=$('#noteTags').value.split(',').map(x=>x.trim()).filter(Boolean);n.updatedAt=new Date().toISOString();
 save();$('#noteSavedState').textContent='Saved';updateNoteStats();
}

function renderAll(){
 fillMissingSubcategories();renderSelects();renderStats();renderLibrary();renderWorkbench();renderCollections();renderVault();renderNotes();renderAccounts();renderDuplicates();renderCategories();renderCloud();queueMicrotask(()=>window.BagpackUI?.refreshSelects?.());
}
function showView(name){
 activeView=name;$$('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+name));$$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===name));$('.sidebar').classList.remove('open');
 if(name==='library')renderLibrary();
 if(name==='workbench')renderWorkbench();
 if(name==='collections')renderCollections();
 if(name==='vault')renderVault();
 if(name==='notes')renderNotes();
 if(name==='duplicates')renderDuplicates();
 if(name==='accounts')renderAccounts();
 if(name==='categories')renderCategories();
 if(name==='cloud')renderCloud();
}
function openDialog(d){d.showModal()}
function closeDialogs(){ $$('dialog').forEach(d=>{if(d.open)d.close()}) }

$$('.nav-item').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
$$('[data-jump]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.jump)));
$('#mobileMenu').addEventListener('click',()=>$('.sidebar').classList.toggle('open'));
$('#addBtn').addEventListener('click',()=>openDialog($('#addMenu')));
$('#addAccountBtn').addEventListener('click',()=>openDialog($('#accountDialog')));
$('#addCategoryBtn').addEventListener('click',()=>openDialog($('#categoryDialog')));
$('#newCollectionBtn').addEventListener('click',()=>openDialog($('#collectionDialog')));
$('#vaultToggleBtn').addEventListener('click',async()=>{
 if(!vaultUnlocked){
   const ok=await BagpackSecurity.requestPin('Private Vault');if(!ok)return;
   vaultUnlocked=true;
 } else vaultUnlocked=false;
 renderVault();
});
const vaultLocalOnlyEl=$('#vaultLocalOnly');
if(vaultLocalOnlyEl){
 vaultLocalOnlyEl.checked=localStorage.getItem(BAGPACK_CONFIG.STORAGE.vaultLocalOnly)!=='0';
 vaultLocalOnlyEl.addEventListener('change',()=>{localStorage.setItem(BAGPACK_CONFIG.STORAGE.vaultLocalOnly,vaultLocalOnlyEl.checked?'1':'0');notify(vaultLocalOnlyEl.checked?'Vault will stay local-only':'Vault cloud sync enabled','info','Vault privacy')});
}
$$('.close-dialog').forEach(b=>b.addEventListener('click',closeDialogs));
$('#addMenu').addEventListener('click',e=>{const b=e.target.closest('[data-add]');if(!b)return;closeDialogs();const map={link:'linkDialog',account:'accountDialog',category:'categoryDialog',bulk:'bulkDialog'};if(map[b.dataset.add]){ if(b.dataset.add==='link'){ $('#linkStatus').value='active';syncStatusPicker('linkStatus'); } openDialog($('#'+map[b.dataset.add])); }});

function checkLink(url, box, saveBtn, categoryEl, titleEl){
 const c=canon(url); if(!/^https?:\/\//i.test(url)){box.className='check-box bad';box.textContent='Enter a complete URL starting with http:// or https://';saveBtn.disabled=true;return}
 const exact=items.filter(i=>canon(i.url)===c);
 const same=items.filter(i=>domain(i.url)===domain(url)&&canon(i.url)!==c);
 if(exact.length){
  box.className='check-box bad';box.innerHTML=`Duplicate found: ${exact.length} existing record${exact.length>1?'s':''}. Open Duplicates to review it.`;
  saveBtn.disabled=true;
 }else{
  box.className='check-box good';box.innerHTML=`Unique URL confirmed against ${items.length} existing records.${same.length?` ${same.length} other saved page${same.length>1?'s':''} from the same domain.`:''}`;
  saveBtn.disabled=false;
  const s=suggestCategory(url); categoryEl.value=s; titleEl.value=titleEl.value||titleFrom(url);
  $('#suggestionBox').classList.remove('hidden');$('#suggestionBox').innerHTML=`Suggested category: <strong>${esc(s)}</strong>${same.length?` · ${same.length} related domain record${same.length>1?'s':''}`:''}`;
 }
}
let linkTimer;
$('#linkUrl').addEventListener('input',e=>{clearTimeout(linkTimer);const v=e.target.value.trim();$('#linkCheck').className='check-box idle';$('#linkCheck').textContent='Checking…';$('#saveLinkBtn').disabled=true;$('#suggestionBox').classList.add('hidden');if(!v){$('#linkCheck').textContent='Paste a URL to check the library.';return}linkTimer=setTimeout(()=>checkLink(v,$('#linkCheck'),$('#saveLinkBtn'),$('#linkCategory'),$('#linkTitle')),180)});
$('#linkForm').addEventListener('submit',e=>{e.preventDefault();const url=$('#linkUrl').value.trim();if(!/^https?:\/\//i.test(url)){notify('Use an http:// or https:// link','warning');return}if(items.some(i=>canon(i.url)===canon(url))){toast('Duplicate blocked. Review the existing entry first.');return}
 const it=normalizeItemShape({id:bagpackUid('resource'),title:$('#linkTitle').value.trim()||titleFrom(url),url,canonicalUrl:canon(url),domain:domain(url),note:$('#linkNote').value.trim(),sourceLine:null,type:'resource',category:$('#linkCategory').value||suggestCategory(url),subcategory:$('#linkSubcategory').value.trim()||suggestSubcategory({category:$('#linkCategory').value,url,title:$('#linkTitle').value}),theme:$('#linkTheme').value.trim(),tags:$('#linkTags').value.split(',').map(x=>x.trim()).filter(Boolean),visibility:'private',favorite:false,pinned:false,status:($('#linkStatus')?.value||'active'),coverUrl:'',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});items.push(it);
 const chosenCollection=$('#linkCollection').value;if(chosenCollection){const c=collections.find(x=>x.id===chosenCollection);if(c&&!c.itemIds.includes(it.id))c.itemIds.push(it.id);}save();e.target.reset();$('#linkCheck').className='check-box idle';$('#linkCheck').textContent='Paste a URL to check the library.';$('#suggestionBox').classList.add('hidden');closeDialogs();renderAll();notify('Link added to your library','success','Saved');});
let accTimer;
$('#accountUrl').addEventListener('input',e=>{clearTimeout(accTimer);const v=e.target.value.trim();const box=$('#accountCheck'),btn=$('#saveAccountBtn');box.className='check-box idle';box.textContent='Checking…';btn.disabled=true;if(!v){box.textContent='The profile URL will be checked against the full library.';return}accTimer=setTimeout(()=>{const ex=items.filter(i=>canon(i.url)===canon(v));if(ex.length){box.className='check-box bad';box.textContent=`Already exists as ${ex[0].type} · ${ex[0].title}.`;btn.disabled=true}else{box.className='check-box good';box.textContent=`Unique profile URL confirmed against ${items.length} records.`;btn.disabled=false}},180)});
async function readImageFile(file){
 if(!file)return '';
 if(!file.type.startsWith('image/'))throw new Error('Please choose an image file.');
 if(file.size>18*1024*1024)throw new Error('Image exceeds 18 MB. Please choose a smaller file.');
 // Compress images before writing to the local library to avoid browser storage quota errors.
 const blobUrl=URL.createObjectURL(file);
 try{
  const img=await new Promise((resolve,reject)=>{
   const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Image could not be decoded.'));image.src=blobUrl;
  });
  const scale=Math.min(1,1000/Math.max(img.naturalWidth,img.naturalHeight));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Image processing is unavailable in this browser.');
  ctx.drawImage(img,0,0,canvas.width,canvas.height);
  return canvas.toDataURL('image/jpeg',0.78);
 }finally{URL.revokeObjectURL(blobUrl)}
}
function setProfilePreview(el,dataUrl){
 if(!el)return;
 // Use a CSS custom property instead of an unsafely interpolated CSS url().
 el.style.backgroundImage=dataUrl?`url("${String(dataUrl).replace(/"/g,'%22')}")`:'';
 el.classList.toggle('has-image',!!dataUrl);
}
async function updateProfileFile(inputId,previewId){
 const input=$('#'+inputId),preview=$('#'+previewId);if(!input)return;
 const file=input.files?.[0];if(!file)return;
 input.dataset.dataUrl='';
 try{
  const result=await readImageFile(file);
  input.dataset.dataUrl=result;
  setProfilePreview(preview,result);
  notify('Image ready. Save the record to apply it.','info','Profile photo');
 }catch(err){input.value='';delete input.dataset.dataUrl;notify(err.message,'error','Profile photo')}
}
$('#accountProfileImage')?.addEventListener('change',()=>updateProfileFile('accountProfileImage','accountProfilePreview'));
$('#editProfileImage')?.addEventListener('change',()=>updateProfileFile('editProfileImage','editProfilePreview'));
$('#accountForm').addEventListener('submit',async e=>{
 e.preventDefault();const url=$('#accountUrl').value.trim();
 if(items.some(i=>canon(i.url)===canon(url)))return notify('This URL already exists.','warning');
 let profileImage='';
 try{profileImage=$('#accountProfileImage').dataset.dataUrl||await readImageFile($('#accountProfileImage').files?.[0]);}
 catch(err){return notify(err.message,'error','Profile image')}
 items.push({id:bagpackUid('account'),title:$('#accountPlatform').value.trim()||titleFrom(url),url,canonicalUrl:canon(url),domain:domain(url),note:[ $('#accountHandle').value.trim(), $('#accountRole').value, $('#accountNote').value.trim() ].filter(Boolean).join(' · '),type:'account',category:'Accounts',tags:[$('#accountRole').value],visibility:'private',favorite:false,pinned:false,status:'active',coverUrl:profileImage,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
 try{save()}catch(err){items.pop();return notify('Image could not be stored: '+err.message,'error','Save failed')}e.target.reset();delete $('#accountProfileImage').dataset.dataUrl;setProfilePreview($('#accountProfilePreview'),'');closeDialogs();renderAll();notify('Account added successfully','success','Saved');
});
$('#categoryForm').addEventListener('submit',e=>{e.preventDefault();const name=$('#categoryName').value.trim();if(categories.some(c=>c.name.toLowerCase()===name.toLowerCase()))return toast('Category already exists.');categories.push({id:bagpackUid('category'),name,description:$('#categoryDescription').value.trim()});save();e.target.reset();closeDialogs();renderAll();notify('Category created','success');});

$('#detailEditButton').addEventListener('click',()=>{const id=$('#detailEditButton').dataset.id;closeDialogs();const btn=document.createElement('button');btn.className='manage';btn.dataset.id=id;btn.style.display='none';document.body.appendChild(btn);btn.click();btn.remove();});
document.addEventListener('click',e=>{
 const detail=e.target.closest('.details-trigger');
 if(detail){
   const i=items.find(x=>x.id===detail.dataset.id);if(!i)return;
   const fields=[['Link',i.url],['Category',i.category],['Subcategory',i.subcategory],['Theme',i.theme],['Status',i.status||'active'],['Notes',i.note],['Tags',(i.tags||[]).join(', ')],['Opened',String(i.openCount||0)+' times'],['Saved',i.createdAt?new Date(i.createdAt).toLocaleDateString():'Unknown']];
   $('#detailHeading').textContent=i.title||titleFrom(i.url);
   $('#recordDetailsBody').innerHTML=fields.filter(([k,v])=>v).map(([k,v])=>`<div class="record-detail-row"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('');
   $('#detailEditButton').dataset.id=i.id;openDialog($('#detailsDialog'));return;
 }
 const m=e.target.closest('.manage'); if(m){const i=items.find(x=>x.id===m.dataset.id);if(!i)return;$('#editItemId').value=i.id;$('#editTitle').value=i.title||'';$('#editUrl').value=i.url||'';$('#editType').value=i.type||'resource';$('#editCategory').value=i.category||'Imported';$('#editSubcategory').value=i.subcategory||'';$('#editTheme').value=i.theme||'';$('#editStatus').value=i.status||'active';$('#editCoverUrl').value=/^https?:\/\//i.test(i.coverUrl||'')?i.coverUrl:'';$('#editTags').value=(i.tags||[]).join(', ');$('#editNote').value=i.note||'';$('#editPinned').checked=!!i.pinned;
 const editFile=$('#editProfileImage');if(editFile){editFile.value='';delete editFile.dataset.dataUrl;}setProfilePreview($('#editProfilePreview'),i.coverUrl||'');
 const ec=$('#editCollections');[...ec.options].forEach(o=>o.selected=collections.some(c=>c.id===o.value&&(c.itemIds||[]).includes(i.id)));
 openDialog($('#itemDialog'));return}
 const del=e.target.closest('[data-delete-selected]');if(del){const group=duplicateMap()[Number(del.dataset.deleteSelected)];if(!group)return;const selected=group[1].filter(i=>$(`[data-dup-select="${CSS.escape(i.id)}"]`)?.checked);if(!selected.length)return toast('Select at least one duplicate copy.');if(selected.length>=group[1].length)return toast('Keep at least one copy in the group.');if(confirm(`Remove ${selected.length} selected record${selected.length>1?'s':''}? This only changes your local site data; the source text file remains untouched.`)){const ids=new Set(selected.map(x=>x.id));items=items.filter(i=>!ids.has(i.id));collections.forEach(c=>c.itemIds=(c.itemIds||[]).filter(id=>!ids.has(id)));save();Promise.all([...ids].map(cloudDeleteResource));renderAll();notify('Selected duplicate copies removed','warning')}return}
 const keep=e.target.closest('[data-keep-group]');if(keep)toast('Group left unchanged.');
});


async function checkCurrentPageLinks(){
 if(!supabaseClient)return notify('Supabase is not configured','error','Link checker');
 const {data:{session}}=await supabaseClient.auth.getSession();
 if(!session)return notify('Sign in from Cloud before checking links','warning','Link checker');
 const targets=lastLibraryPageItems.filter(i=>i.type!=='account'&&i.category!=='Private Vault').slice(0,48);
 if(!targets.length)return notify('No checkable links on this page','info','Link checker');
 const btn=$('#checkLinksBtn');if(btn)btn.disabled=true;
 let expired=0,checked=0,errors=0;
 notify(`Checking ${targets.length} visible links…`,'info','Link checker');
 for(let x=0;x<targets.length;x+=6){
   const batch=targets.slice(x,x+6);
   await Promise.all(batch.map(async i=>{
     try{
       const {data,error}=await supabaseClient.functions.invoke('check-link',{body:{url:i.url}});
       if(error)throw error;checked++;
       if(data?.expired){i.status='expired';i.updatedAt=new Date().toISOString();expired++}
       else if(data?.exists && i.status==='expired'){i.status='active';i.updatedAt=new Date().toISOString()}
     }catch{errors++}
   }));
 }
 save();renderAll();if(btn)btn.disabled=false;
 notify(`${checked} checked · ${expired} expired${errors?` · ${errors} inconclusive`:''}`,expired?'warning':'success','Link check complete');
}
$('#checkLinksBtn')?.addEventListener('click',checkCurrentPageLinks);

$('#dupSearch')?.addEventListener('input',renderDuplicates);
document.addEventListener('click',e=>{const b=e.target.closest('[data-home-action]');if(b){const action=b.dataset.homeAction;const dest=$('#'+(action==='link'?'linkDialog':'bulkDialog'));if(dest)openDialog(dest);}const cat=e.target.closest('[data-category-jump]');if(cat){showView('library');$('#libraryCategory').value=cat.dataset.categoryJump;renderLibrary();}});
$('#scanDuplicatesBtn').addEventListener('click',()=>{
  renderDuplicates();
  renderStats();
  const n=duplicateMap().length;
  toast(`${n} duplicate group${n===1?'':'s'} detected. Nothing was removed.`);
});

$('#autoCategorizeBtn').addEventListener('click',()=>{
  const changed=assignMissingCategories();
  if(changed){
    save();renderAll();
    toast(`${changed} uncategorized link${changed===1?'':'s'} categorized automatically.`);
  } else {
    toast('No uncategorized links need automatic classification.');
  }
});

// ---------- Bulk import ----------
function parseCSV(text){
  const rows=[]; let row=[], field='', q=false;
  for(let i=0;i<text.length;i++){
    const c=text[i], n=text[i+1];
    if(c==='"'){
      if(q && n==='"'){field+='"';i++} else q=!q;
    } else if(c===',' && !q){row.push(field);field=''}
    else if((c==='\n'||c==='\r') && !q){
      if(c==='\r'&&n==='\n')i++;
      row.push(field); if(row.some(x=>x.trim()))rows.push(row); row=[];field='';
    } else field+=c;
  }
  row.push(field); if(row.some(x=>x.trim()))rows.push(row);
  return rows;
}
function rowObjects(rows){
  if(!rows.length)return [];
  const header=rows[0].map(x=>String(x||'').trim().toLowerCase());
  const urlNames=['url','link','website','profile url','profile_url','website url','website_url'];
  const hasHeader=header.some(h=>urlNames.includes(h));
  if(!hasHeader){
    return rows.map(r=>({url:String(r[0]||'').trim(),title:String(r[1]||'').trim(),category:String(r[2]||'').trim(),notes:String(r[3]||'').trim()}));
  }
  const idx=(names)=>header.findIndex(h=>names.includes(h));
  const ui=idx(urlNames), ti=idx(['title','name','website name','site','account']), ci=idx(['category','group']), ni=idx(['notes','note','remarks','description']), tagi=idx(['tags','tag']), typei=idx(['type','record type']);
  return rows.slice(1).map(r=>({
    url:String(r[ui]||'').trim(),
    title:ti>=0?String(r[ti]||'').trim():'',
    category:ci>=0?String(r[ci]||'').trim():'',
    notes:ni>=0?String(r[ni]||'').trim():'',
    tags:tagi>=0?String(r[tagi]||'').trim():'',
    type:typei>=0?String(r[typei]||'').trim().toLowerCase():''
  }));
}
function parsePastedBulk(text){
  return text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).map(line=>{
    const parts=line.split(/\s*\|\s*/);
    if(parts.length>1)return {url:parts[0],title:parts[1]||'',category:parts[2]||'',notes:parts[3]||''};
    const m=line.match(/https?:\/\/\S+/i);
    return {url:m?m[0].replace(/[),.;]+$/,''):line,title:'',category:'',notes:''};
  });
}
function normalizeBulkRows(rows){
  const auto=$('#bulkAutoCategory').checked;
  const existing=new Map(items.map(i=>[canon(i.url),i]));
  const seen=new Map();
  return rows.filter(r=>r.url).map((r,idx)=>{
    const c=canon(r.url), valid=/^https?:\/\//i.test(r.url);
    let status='ready', reason='';
    if(!valid){status='invalid';reason='Invalid URL'}
    else if(existing.has(c)){status='existing-duplicate';reason=`Already saved as ${existing.get(c).title||titleFrom(r.url)}`}
    else if(seen.has(c)){status='import-duplicate';reason=`Duplicates row ${seen.get(c)+1}`}
    else seen.set(c,idx);
    let category=(r.category||'').trim();
    if(auto && (!category || ['uncategorized','other','imported'].includes(category.toLowerCase()))) category=suggestCategory(r.url);
    if(!category)category='Short Links & Review';
    return {
      id:'bulk-'+idx, url:r.url.trim(), canonicalUrl:c, domain:domain(r.url),
      title:(r.title||'').trim()||titleFrom(r.url), category,
      note:(r.notes||r.note||'').trim(), tags:String(r.tags||'').split(/[,;]/).map(x=>x.trim()).filter(Boolean),
      type:r.type==='account'?'account':'resource', status, reason
    };
  });
}
function renderBulkPreview(){
  const rows=bulkCandidates;
  const ready=rows.filter(r=>r.status==='ready').length;
  const ex=rows.filter(r=>r.status==='existing-duplicate').length;
  const inn=rows.filter(r=>r.status==='import-duplicate').length;
  $('#bulkTotal').textContent=rows.length;$('#bulkReady').textContent=ready;$('#bulkExistingDup').textContent=ex;$('#bulkInternalDup').textContent=inn;
  $('#bulkPreviewRows').innerHTML=rows.slice(0,250).map(r=>{
    const label=r.status==='ready'?'Ready':r.status==='existing-duplicate'?'Existing duplicate':r.status==='import-duplicate'?'Import duplicate':'Invalid';
    return `<tr class="bulk-${r.status}"><td><span class="import-status">${esc(label)}</span>${r.reason?`<small>${esc(r.reason)}</small>`:''}</td><td><strong>${esc(r.title)}</strong><small>${esc(r.url)}</small></td><td><span class="category-pill" style="--pill:${catColor(r.category)}">${esc(r.category)}</span></td><td>${esc(r.note||'—')}</td></tr>`;
  }).join('');
  $('#bulkPreview').classList.remove('hidden');
  $('#bulkStatus').className='check-box '+(rows.length?'good':'bad');
  $('#bulkStatus').textContent=rows.length?`${ready} ready to import. ${ex+inn} duplicate row${ex+inn===1?'':'s'} detected before saving.`:'No usable rows found.';
  $('#saveBulkBtn').disabled=ready===0;
}
async function analyzeBulk(){
  try{
    let rows=[];
    const file=$('#bulkFile').files[0];
    const paste=!$('#bulkPastePane').classList.contains('hidden')?$('#bulkPaste').value.trim():'';
    if(paste){
      rows=parsePastedBulk(paste);
    }else if(file){
      const ext=file.name.split('.').pop().toLowerCase();
      if(ext==='csv'){
        rows=rowObjects(parseCSV(await file.text()));
      }else if(ext==='xlsx'||ext==='xls'){
        if(typeof XLSX==='undefined')throw new Error('Excel parser could not load. Check your internet connection or export the sheet as CSV.');
        const buf=await file.arrayBuffer();
        const wb=XLSX.read(buf,{type:'array'});
        const ws=wb.Sheets[wb.SheetNames[0]];
        rows=XLSX.utils.sheet_to_json(ws,{defval:'',raw:false});
        rows=rows.map(obj=>{
          const lower={};Object.entries(obj).forEach(([k,v])=>lower[String(k).trim().toLowerCase()]=v);
          const pick=(names)=>{for(const n of names)if(lower[n]!==undefined)return lower[n];return ''};
          return {url:String(pick(['url','link','website','profile url','profile_url','website url','website_url'])).trim(),
            title:String(pick(['title','name','website name','site','account'])).trim(),
            category:String(pick(['category','group'])).trim(),
            notes:String(pick(['notes','note','remarks','description'])).trim(),
            tags:String(pick(['tags','tag'])).trim(),
            type:String(pick(['type','record type'])).trim().toLowerCase()};
        });
      }else throw new Error('Unsupported file type. Use CSV, XLS, or XLSX.');
    }else throw new Error('Choose a file or paste some links first.');
    bulkCandidates=normalizeBulkRows(rows);
    renderBulkPreview();
  }catch(err){
    $('#bulkStatus').className='check-box bad';
    $('#bulkStatus').textContent=err.message||'Unable to analyze this import.';
    $('#saveBulkBtn').disabled=true;
  }
}
$('#analyzeBulkBtn').addEventListener('click',analyzeBulk);
$('#bulkFile').addEventListener('change',()=>{bulkCandidates=[];$('#bulkPreview').classList.add('hidden');$('#saveBulkBtn').disabled=true;});
$('#bulkPaste').addEventListener('input',()=>{bulkCandidates=[];$('#bulkPreview').classList.add('hidden');$('#saveBulkBtn').disabled=true;});
$$('[data-bulk-tab]').forEach(btn=>btn.addEventListener('click',()=>{
  $$('[data-bulk-tab]').forEach(b=>b.classList.toggle('active',b===btn));
  const paste=btn.dataset.bulkTab==='paste';
  $('#bulkPastePane').classList.toggle('hidden',!paste);$('#bulkFilePane').classList.toggle('hidden',paste);
  bulkCandidates=[];$('#bulkPreview').classList.add('hidden');$('#saveBulkBtn').disabled=true;
}));
$('#bulkForm').addEventListener('submit',e=>{
  e.preventDefault();
  const skip=$('#bulkSkipDuplicates').checked;
  const ready=bulkCandidates.filter(r=>r.status==='ready' || (!skip && r.status==='import-duplicate'));
  if(!ready.length)return toast('No unique links are ready to import.');
  ready.forEach((r,idx)=>items.push({
    id:bagpackUid('bulk'),title:r.title,url:r.url,canonicalUrl:r.canonicalUrl,domain:r.domain,note:r.note,
    sourceLine:null,type:r.type,category:r.type==='account'?'Accounts':r.category,tags:r.tags,visibility:'private',status:'active',coverUrl:'',
    favorite:false,pinned:false,createdAt:new Date().toISOString()
  }));
  // Any still-empty/legacy categories get repaired automatically after import.
  assignMissingCategories(items);
  save();renderAll();closeDialogs();
  toast(`${ready.length} link${ready.length===1?'':'s'} imported. Duplicate rows were left unchanged for review.`);
  bulkCandidates=[];e.target.reset();$('#bulkPreview').classList.add('hidden');$('#saveBulkBtn').disabled=true;
});


$('#collectionForm').addEventListener('submit',e=>{
 e.preventDefault();
 const name=$('#collectionName').value.trim();if(!name)return;
 collections.push({id:bagpackUid('collection'),name,description:$('#collectionDescription').value.trim(),itemIds:[],createdAt:new Date().toISOString()});
 save();e.target.reset();closeDialogs();renderAll();notify('Collection created','success');
});

$('#itemForm').addEventListener('submit',async e=>{e.preventDefault();const i=items.find(x=>x.id===$('#editItemId').value);if(!i)return;const newUrl=$('#editUrl').value.trim();const collision=items.find(x=>x.id!==i.id&&canon(x.url)===canon(newUrl));if(collision)return toast('That URL would duplicate another record.');i.title=$('#editTitle').value.trim();i.url=newUrl;i.canonicalUrl=canon(newUrl);i.domain=domain(newUrl);i.type=$('#editType').value;i.category=$('#editCategory').value;i.subcategory=$('#editSubcategory').value.trim();i.theme=$('#editTheme').value.trim();i.tags=$('#editTags').value.split(',').map(x=>x.trim()).filter(Boolean);i.note=$('#editNote').value.trim();i.status=$('#editStatus').value;let uploadedProfile=$('#editProfileImage')?.dataset.dataUrl||'';
 if(i.type==='account'&&!uploadedProfile&&$('#editProfileImage')?.files?.[0]){
   try{uploadedProfile=await readImageFile($('#editProfileImage').files[0]);}catch(err){return notify(err.message,'error','Profile image')}
 }
 const coverText=$('#editCoverUrl').value.trim();
 i.coverUrl=(i.type==='account'&&uploadedProfile)?uploadedProfile:(coverText||i.coverUrl||'');i.pinned=$('#editPinned').checked;i.updatedAt=new Date().toISOString();
 const selected=new Set([...$('#editCollections').selectedOptions].map(o=>o.value));
 collections.forEach(c=>{c.itemIds=(c.itemIds||[]).filter(id=>id!==i.id);if(selected.has(c.id))c.itemIds.push(i.id)});
 save();closeDialogs();renderAll();notify('Changes saved','success');});
$('#deleteItemBtn').addEventListener('click',async()=>{const i=items.find(x=>x.id===$('#editItemId').value);if(i&&confirm(`Delete "${i.title}" from Bagpack? This removes the local copy and, when signed in, the cloud copy too.`)){items=items.filter(x=>x.id!==i.id);collections.forEach(c=>c.itemIds=(c.itemIds||[]).filter(id=>id!==i.id));save();await cloudDeleteResource(i.id);closeDialogs();renderAll();notify('Record deleted','warning')}});


document.addEventListener('click',e=>{
 const a=e.target.closest('[data-open-id]');
 if(!a)return;
 const i=items.find(x=>x.id===a.dataset.openId);
 if(i){i.lastOpenedAt=new Date().toISOString();i.updatedAt=i.lastOpenedAt;i.openCount=(i.openCount||0)+1;save();}
});


document.addEventListener('click',e=>{
 const p=e.target.closest('.preview-resource');if(!p)return;
 const i=items.find(x=>x.id===p.dataset.id);if(!i)return;
 let safe;try{safe=new URL(i.url)}catch{return notify('Invalid URL','error','Preview blocked')}
 if(!['http:','https:'].includes(safe.protocol))return notify('Only http:// and https:// URLs can be previewed','warning','Preview blocked');
 $('#previewTitle').textContent=i.title||titleFrom(i.url);$('#previewDomain').textContent=i.domain||domain(i.url);$('#previewUrl').textContent=i.url;$('#previewExternal').href=i.url;$('#previewFrame').src=i.url;openDialog($('#previewDialog'));
});
$('#previewDialog').addEventListener('close',()=>{$('#previewFrame').src='about:blank'});

['#libraryCategory','#libraryType','#libraryStatus','#libraryPinned','#librarySort'].forEach(id=>$(id)?.addEventListener('change',()=>{libraryPage=1;renderLibrary()}));
$('#librarySearch')?.addEventListener('input',()=>{libraryPage=1;renderLibrary()});
$('#clearLibraryFilters')?.addEventListener('click',()=>{if($('#librarySearch'))$('#librarySearch').value='';$('#libraryCategory').value='all';$('#libraryType').value='all';$('#libraryStatus').value='all';$('#libraryPinned').value='all';$('#librarySort').value='newest';libraryPage=1;renderLibrary();window.BagpackUI?.refreshSelects?.()});
$('#libraryPagination')?.addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(!b||b.disabled)return;libraryPage=Number(b.dataset.page)||1;renderLibrary();window.scrollTo({top:60,behavior:'smooth'})});

$('#newNoteBtn')?.addEventListener('click',()=>{
 const n=createNote();
 requestAnimationFrame(()=>{ $('#noteTitle')?.focus(); $('#noteTitle')?.select(); });
});
$('#importNotesBtn')?.addEventListener('click',()=>$('#noteFileInput').click());
$('#noteFileInput')?.addEventListener('change',async e=>{
 const files=[...e.target.files];for(const f of files){const content=await f.text();const title=f.name.replace(/\.(txt|md|markdown)$/i,'');createNote(title,content,'slate')}e.target.value='';renderNotes();toast(`${files.length} note file${files.length===1?'':'s'} imported.`);
});
$('#notesSearch')?.addEventListener('input',renderNotes);
$('#noteToolbar')?.addEventListener('click',e=>{
 const b=e.target.closest('[data-note-format]');if(!b)return;applyNoteFormat(b.dataset.noteFormat);
});
$('#noteColorFilter')?.addEventListener('click',e=>{const b=e.target.closest('[data-note-color]');if(!b)return;noteColorFilter=b.dataset.noteColor;$$('[data-note-color]').forEach(x=>x.classList.toggle('active',x===b));renderNotes()});
$('#notesList')?.addEventListener('click',e=>{const b=e.target.closest('[data-note-id]');if(!b)return;activeNoteId=b.dataset.noteId;renderNotes()});
['#noteTitle','#noteContent','#noteTags'].forEach(id=>$(id)?.addEventListener('input',()=>{
 clearTimeout(noteSaveTimer);$('#noteSavedState').textContent='Saving…';
 if(id==='#noteContent'){recordNoteHistory();updateNoteStats();if(!$('#notePreviewPane').classList.contains('hidden'))$('#notePreviewPane').innerHTML=renderSimpleMarkdown($('#noteContent').value)}
 noteSaveTimer=setTimeout(saveActiveNoteFromEditor,350);
}));
$('#noteColor')?.addEventListener('change',saveActiveNoteFromEditor);
$('#pinNoteBtn')?.addEventListener('click',()=>{const n=currentNote();if(!n)return;n.pinned=!n.pinned;n.updatedAt=new Date().toISOString();save();renderNotes()});

$('#noteUndoBtn')?.addEventListener('click',noteUndo);
$('#noteRedoBtn')?.addEventListener('click',noteRedo);
$('#notePreviewBtn')?.addEventListener('click',()=>toggleNotePreview());
document.addEventListener('keydown',e=>{
 const inNote=e.target.closest?.('#view-notes');
 if(!inNote)return;
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();saveActiveNoteFromEditor();notify('Note saved','success');}
 if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();toggleNotePreview();}
});

$('#deleteNoteBtn')?.addEventListener('click',()=>{const n=currentNote();if(!n)return;if(confirm(`Delete "${n.title}"?`)){notes=notes.filter(x=>x.id!==n.id);activeNoteId=null;save();cloudDeleteNote(n.id);renderNotes();notify('Note deleted','warning')}});

$('#libraryCategory').addEventListener('change',renderLibrary);$('#libraryType').addEventListener('change',renderLibrary);
$$('[data-density]').forEach(b=>b.addEventListener('click',()=>{density=b.dataset.density;$$('[data-density]').forEach(x=>x.classList.toggle('active',x===b));renderLibrary()}));
$('#globalSearch').addEventListener('input',()=>{if(activeView!=='library')showView('library');renderLibrary()});
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('#globalSearch').focus();}});
$('#resetBtn').addEventListener('click',()=>BagpackBackup.resetWithBackup());



async function cloudDeleteResource(id){
 if(!supabaseClient)return;
 try{const {data:{session}}=await supabaseClient.auth.getSession();if(!session)return;const {error}=await supabaseClient.from('resources').delete().eq('id',String(id));if(error)throw error}catch(err){notify(`Cloud delete failed: ${err.message||err}`,'error')}
}
async function cloudDeleteNote(id){
 if(!supabaseClient)return;
 try{const {data:{session}}=await supabaseClient.auth.getSession();if(!session)return;const {error}=await supabaseClient.from('notes').delete().eq('id',String(id));if(error)throw error}catch(err){notify(`Cloud note delete failed: ${err.message||err}`,'error')}
}

// ---------- Supabase cloud sync ----------
let cloudSyncTimer=null;
function makeSupabaseClient(){
 if(!supabaseConfig.url||!supabaseConfig.anonKey||!window.supabase?.createClient){supabaseClient=null;return null}
 try{supabaseClient=window.supabase.createClient(supabaseConfig.url,supabaseConfig.anonKey,{auth:{persistSession:true}});return supabaseClient}catch{supabaseClient=null;return null}
}
async function updateCloudUI(message){
 const badge=$('#cloudBadge'), status=$('#supabaseStatus'), push=$('#pushSupabaseBtn'), pull=$('#pullSupabaseBtn');
 let session=null;
 if(supabaseClient){ const {data}=await supabaseClient.auth.getSession(); session=data.session; }
 const signedIn=!!session;
 if(badge){badge.textContent=signedIn?'Signed in':'Not signed in';badge.className='cloud-badge '+(signedIn?'online':'offline')}
 if(push)push.disabled=!signedIn;if(pull)pull.disabled=!signedIn;
 if(status){
   status.textContent=message || (signedIn?'Supabase is connected and your private archive is available.':'Database configured. Sign in to access your private rows.');
   status.className='check-box '+(signedIn?'good':'idle');
 }
 const si=$('#signInBtn'), su=$('#signUpBtn'), so=$('#signOutBtn');
 if(si)si.classList.toggle('hidden',signedIn);
 if(su)su.classList.toggle('hidden',signedIn);
 if(so)so.classList.toggle('hidden',!signedIn);
 const auth=$('#authStatus');
 if(auth){auth.textContent=signedIn?`Signed in as ${session.user.email||'user'}.`:'Not signed in.';auth.className='check-box '+(signedIn?'good':'idle')}
 return session;
}
async function testSupabaseConnection(){
 const client=makeSupabaseClient();
 if(!client){await updateCloudUI('Supabase client could not initialize.');return false}
 try{
   const {data:{session}}=await client.auth.getSession();
   if(!session){await updateCloudUI('Database reachable. Sign in to query your private rows.');return true}
   const {error}=await client.from('resources').select('id',{count:'exact',head:true});
   if(error)throw error;
   await updateCloudUI('Connected to Supabase and your private resources table is reachable.');
   return true;
 }catch(err){
   const s=$('#supabaseStatus');if(s){s.textContent='Connection problem: '+(err.message||err);s.className='check-box bad'}
   return false;
 } 
}
async function pushAllToSupabase(options={}){
 if(!supabaseClient)return;
 const {data:{session}}=await supabaseClient.auth.getSession(); if(!session){await updateCloudUI('Sign in before pushing data.');return;}
 const lastSync=localStorage.getItem(BAGPACK_CONFIG.STORAGE.lastCloudSync)||'';
 const full=options.full===true;
 const vaultLocalOnly=localStorage.getItem(BAGPACK_CONFIG.STORAGE.vaultLocalOnly)!=='0';
 const resourceSource=items.filter(i=>!(vaultLocalOnly&&i.category==='Private Vault')).filter(i=>full||!lastSync||String(i.updatedAt||i.createdAt||'')>lastSync);
 const resourceRows=resourceSource.map(i=>({
   id:String(i.id),title:i.title||'',url:i.url,canonical_url:canon(i.url),domain:i.domain||domain(i.url),note:i.note||'',
   type:i.type||'resource',category:i.category||'',subcategory:i.subcategory||'',theme:i.theme||'',tags:i.tags||[],
   visibility:i.visibility||'private',favorite:!!i.favorite,pinned:!!i.pinned,status:i.status||'active',cover_url:i.coverUrl||'',open_count:i.openCount||0,
   last_opened_at:i.lastOpenedAt||null,created_at:i.createdAt||new Date().toISOString(),updated_at:i.updatedAt||i.createdAt||new Date().toISOString()
 }));
 const categoryRows=categories.map(c=>({id:String(c.id),name:c.name,description:c.description||''}));
 const collectionRows=collections.map(c=>({id:String(c.id),name:c.name,description:c.description||'',created_at:c.createdAt||new Date().toISOString()}));
 const noteRows=notes.filter(n=>full||!lastSync||String(n.updatedAt||n.createdAt||'')>lastSync).map(n=>({id:String(n.id),title:n.title||'',content:n.content||'',color_key:n.colorKey||'slate',tags:n.tags||[],pinned:!!n.pinned,created_at:n.createdAt||new Date().toISOString(),updated_at:n.updatedAt||new Date().toISOString()}));
 try{
   let r=await supabaseClient.from('categories').upsert(categoryRows,{onConflict:'id'});if(r.error)throw r.error;
   if(resourceRows.length){r=await supabaseClient.from('resources').upsert(resourceRows,{onConflict:'id'});if(r.error)throw r.error;}
   r=await supabaseClient.from('collections').upsert(collectionRows,{onConflict:'id'});if(r.error)throw r.error;
   if(noteRows.length){r=await supabaseClient.from('notes').upsert(noteRows,{onConflict:'id'});if(r.error)throw r.error;}
   const joins=[];collections.forEach(c=>(c.itemIds||[]).forEach(id=>joins.push({collection_id:String(c.id),resource_id:String(id)})));
   if(joins.length){r=await supabaseClient.from('collection_items').upsert(joins,{onConflict:'collection_id,resource_id'});if(r.error)throw r.error}
   localStorage.setItem(BAGPACK_CONFIG.STORAGE.lastCloudSync,new Date().toISOString());updateCloudUI(`Cloud sync complete · ${resourceRows.length} changed resources pushed${vaultLocalOnly?' · Vault stayed local':''}.`);
 }catch(err){const s=$('#supabaseStatus');if(s){s.textContent='Push failed: '+(err.message||err);s.className='check-box bad'}}
}
async function pullAllFromSupabase(){
 if(!supabaseClient)return;
 const {data:{session}}=await supabaseClient.auth.getSession(); if(!session){await updateCloudUI('Sign in before pulling data.');return;}
 try{
   const [rr,cr,colr,jr,nr]=await Promise.all([
     supabaseClient.from('resources').select('*'),
     supabaseClient.from('categories').select('*'),
     supabaseClient.from('collections').select('*'),
     supabaseClient.from('collection_items').select('*'),
     supabaseClient.from('notes').select('*')
   ]);
   for(const r of [rr,cr,colr,jr,nr])if(r.error)throw r.error;
   if(rr.data?.length){
   const localVault=items.filter(i=>i.category==='Private Vault');
   const cloudItems=rr.data.map(r=>normalizeItemShape({
     id:r.id,title:r.title,url:r.url,canonicalUrl:r.canonical_url,domain:r.domain,note:r.note,type:r.type,category:r.category,
     subcategory:r.subcategory,theme:r.theme,tags:r.tags||[],visibility:r.visibility,favorite:r.favorite,pinned:r.pinned,status:r.status||'active',coverUrl:r.cover_url||'',
     openCount:r.open_count,lastOpenedAt:r.last_opened_at,createdAt:r.created_at,updatedAt:r.updated_at
   }));
   const keepVault=localStorage.getItem(BAGPACK_CONFIG.STORAGE.vaultLocalOnly)!=='0';
   items=keepVault?[...cloudItems.filter(i=>i.category!=='Private Vault'),...localVault]:cloudItems;
   }
   if(cr.data?.length)categories=cr.data.map(c=>({id:c.id,name:c.name,description:c.description||''}));
   if(colr.data)collections=colr.data.map(c=>({id:c.id,name:c.name,description:c.description||'',createdAt:c.created_at,itemIds:(jr.data||[]).filter(j=>j.collection_id===c.id).map(j=>j.resource_id)}));
   if(nr.data)notes=nr.data.map(n=>normalizeNote({id:n.id,title:n.title,content:n.content,colorKey:n.color_key,tags:n.tags||[],pinned:n.pinned,createdAt:n.created_at,updatedAt:n.updated_at}));
   const audited=normalizeActiveAndAudit(items);if(audited.changed)localStorage.removeItem(BAGPACK_CONFIG.STORAGE.lastCloudSync);
   save();renderAll();updateCloudUI(`Pulled ${items.length} resources from Supabase.`);
 }catch(err){const s=$('#supabaseStatus');if(s){s.textContent='Pull failed: '+(err.message||err);s.className='check-box bad'}}
}
function scheduleCloudSync(){
 if(!supabaseClient)return;
 clearTimeout(cloudSyncTimer);
 cloudSyncTimer=setTimeout(()=>pushAllToSupabase(),1200);
}
$('#signInBtn').addEventListener('click',async()=>{
 const email=$('#authEmail').value.trim(), password=$('#authPassword').value;
 if(!email||!password)return toast('Enter your email and password.');
 const {error}=await supabaseClient.auth.signInWithPassword({email,password});
 if(error){const s=$('#authStatus');s.textContent=error.message;s.className='check-box bad';return}
 await updateCloudUI('Signed in. Your private database is ready.');
});
$('#signUpBtn').addEventListener('click',async()=>{
 const email=$('#authEmail').value.trim(), password=$('#authPassword').value;
 if(!email||password.length<6)return toast('Enter an email and a password of at least 6 characters.');
 const {data,error}=await supabaseClient.auth.signUp({email,password});
 const s=$('#authStatus');
 if(error){s.textContent=error.message;s.className='check-box bad';return}
 if(data.session){s.textContent='Account created and signed in.';s.className='check-box good';await updateCloudUI();}
 else {s.textContent='Account created. Check your email to confirm it, then sign in.';s.className='check-box warn';}
});
$('#signOutBtn').addEventListener('click',async()=>{await supabaseClient.auth.signOut();await updateCloudUI('Signed out. Local data is still available offline.');});
$('#pushSupabaseBtn').addEventListener('click',()=>pushAllToSupabase({full:true}));
$('#pullSupabaseBtn').addEventListener('click',pullAllFromSupabase);
makeSupabaseClient();
if(supabaseClient){
 supabaseClient.auth.onAuthStateChange(()=>setTimeout(()=>updateCloudUI(),0));
 setTimeout(()=>testSupabaseConnection(),0);
}


function statusOptionMarkup(key){
 const m=statusMeta[key]||statusMeta.active;
 return `${svgIcon(m.icon,'status-icon')}<span>${m.label}</span><span class="status-option-dot" style="background:${m.color}"></span>`;
}
function syncStatusPicker(id){
 const select=$('#'+id), trigger=document.querySelector(`[data-status-trigger="${id}"]`), menu=document.querySelector(`[data-status-menu="${id}"]`);
 if(!select||!trigger||!menu)return;
 const current=select.value||'active', meta=statusMeta[current]||statusMeta.active;
 trigger.innerHTML=`<span class="status-picker-current" style="--status:${meta.color}">${statusOptionMarkup(current)}</span>${svgIcon('chevron','status-picker-chevron')}`;
 menu.innerHTML=Object.keys(statusMeta).map(key=>`<button type="button" class="status-option ${key===current?'active':''}" data-status-value="${key}" style="--status:${statusMeta[key].color}">${statusOptionMarkup(key)}</button>`).join('');
}
function initStatusPickers(){
 ['linkStatus','editStatus'].forEach(syncStatusPicker);
}
document.addEventListener('click',e=>{
 const trigger=e.target.closest('[data-status-trigger]');
 if(trigger){
   const id=trigger.dataset.statusTrigger, menu=document.querySelector(`[data-status-menu="${id}"]`);
   document.querySelectorAll('.status-picker-menu').forEach(m=>{if(m!==menu)m.classList.add('hidden')});
   menu?.classList.toggle('hidden');
   return;
 }
 const opt=e.target.closest('.status-option');
 if(opt){
   const menu=opt.closest('[data-status-menu]'), id=menu?.dataset.statusMenu, select=id?$('#'+id):null;
   if(select){select.value=opt.dataset.statusValue;select.dispatchEvent(new Event('change',{bubbles:true}));syncStatusPicker(id);}
   menu?.classList.add('hidden');
   return;
 }
 if(!e.target.closest('.status-picker'))document.querySelectorAll('.status-picker-menu').forEach(m=>m.classList.add('hidden'));
});

function setupMotion(){
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduce) return;

  const observer = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      }
    });
  },{threshold:.08});

  $$('.panel,.resource-card,.account-card,.category-card,.duplicate-group,.stats article,.hero,.page-head').forEach((el,i)=>{
    if(!el.classList.contains('reveal')){
      el.classList.add('reveal');
      el.style.setProperty('--delay', (i%12)*45+'ms');
      observer.observe(el);
    }
  });

  const glow = $('#cursorGlow');
  if(glow && !window.__cursorGlowBound){
    window.__cursorGlowBound = true;
    window.addEventListener('pointermove',(e)=>{
      glow.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      glow.style.opacity = '.8';
    });
    window.addEventListener('pointerleave',()=>{ glow.style.opacity='0'; });

    document.addEventListener('mousemove',(e)=>{
      const card = e.target.closest('.resource-card,.account-card,.category-card,.panel');
      if(!card || window.innerWidth < 900) return;
      const rect = card.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      const rx = (0.5 - py) * 6;
      const ry = (px - 0.5) * 8;
      card.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-4px)`;
    });

    document.addEventListener('mouseout',(e)=>{
      const card = e.target.closest('.resource-card,.account-card,.category-card,.panel');
      if(card && !card.contains(e.relatedTarget)) card.style.transform='';
    });
  }
}

const repairedAtStartup=assignMissingCategories(items);const subcategoryRepaired=fillMissingSubcategories(items);if(repairedAtStartup||subcategoryRepaired)save();
renderAll();
initStatusPickers();
setupMotion();
hydrateDatabase();
})();