/* Jabner · service worker. Páginas: red primero (si no hay red, la última copia).
   Estáticos: copia primero. Supabase y cualquier otro origen: nunca se cachean. */
const V='jabner-v8';
const ESTATICOS=['/','/jabner.css','/recomp.css','/jabner.js','/inicio.js','/conclusiones.js','/habitos.js','/finanzas.js','/recomp.js','/recomp-logica.js','/recomp-cartas.js','/vendor/supabase.js','/manifest.json','/icon.svg','/icon-192.png',
  '/fonts/inter-tight-latin-400-normal.woff2','/fonts/inter-tight-latin-500-normal.woff2','/fonts/inter-tight-latin-600-normal.woff2','/fonts/inter-tight-latin-700-normal.woff2','/fonts/instrument-serif-latin-400-italic.woff2','/fonts/instrument-serif-latin-400-normal.woff2'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(ESTATICOS)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const r=e.request, u=new URL(r.url);
  if(r.method!=='GET'||u.origin!==location.origin) return;
  if(r.mode==='navigate'){
    e.respondWith(fetch(r).then(res=>{const c=res.clone();caches.open(V).then(x=>x.put(u.pathname,c));return res}).catch(()=>caches.match(u.pathname).then(m=>m||caches.match('/'))));
    return;
  }
  // JS y CSS: red primero para no quedarse con código viejo; fuentes e iconos: copia primero.
  const red=/\.(js|css|json)$/.test(u.pathname);
  e.respondWith(red
    ? fetch(r).then(res=>{const c=res.clone();caches.open(V).then(x=>x.put(r,c));return res}).catch(()=>caches.match(r))
    : caches.match(r).then(m=>m||fetch(r)));
});
