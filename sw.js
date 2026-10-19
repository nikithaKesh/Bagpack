const VERSION='bagpack-image-v3-20261019';
const APP_CACHE=`${VERSION}-app`;
const PREVIEW_CACHE=`${VERSION}-previews`;
const APP_SHELL=[
  './','./index.html','./styles.css','./app.js','./seed-data.js',
  './js/config.js','./js/security.js','./js/backup.js','./js/ui.js','./js/pwa.js',
  './manifest.webmanifest','./favicon.ico','./favicon-32.png','./favicon-16.png','./icon-192.png','./icon-512.png'
];
self.addEventListener('install',event=>event.waitUntil(caches.open(APP_CACHE).then(c=>c.addAll(APP_SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>!k.startsWith(VERSION)).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const req=event.request;if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.hostname==='image.thum.io'){
    event.respondWith(caches.open(PREVIEW_CACHE).then(async cache=>{
      const cached=await cache.match(req);if(cached)return cached;
      try{const res=await fetch(req);if(res.ok)cache.put(req,res.clone());return res}catch{return new Response('',{status:504})}
    }));return;
  }
  if(url.origin===location.origin){
    event.respondWith(fetch(req).then(res=>{if(res.ok){const copy=res.clone();caches.open(APP_CACHE).then(c=>c.put(req,copy))}return res}).catch(async()=>await caches.match(req)||await caches.match('./index.html')));return;
  }
  // Pinned CDN assets become available offline after first successful load.
  if(['cdn.jsdelivr.net','cdnjs.cloudflare.com'].includes(url.hostname)){
    event.respondWith(caches.open(APP_CACHE).then(async cache=>{
      const cached=await cache.match(req);
      try{const res=await fetch(req);if(res.ok||res.type==='opaque')cache.put(req,res.clone());return res}catch{if(cached)return cached;throw new Error('offline')}
    }));
  }
});